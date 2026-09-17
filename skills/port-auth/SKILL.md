---
name: port-auth
description: Port production-grade authentication (Sign in with Google via OAuth code flow + PKCE, passwordless email magic links, identity linking by verified email, hashed server-side sessions, CSRF origin guard, Postgres rate limits, Resend email with a dev outbox) into a Hono/Vue/Postgres codebase. Use when asked to add sign-in, login, auth, Google login, magic link, passwordless login, sessions, or to replace or harden an existing auth implementation. Contains the reference implementation, security invariants, porting steps, real-database integration tests, Playwright flows, and a mutation check that proves every guard survived the port.
---

# port-auth: Google + magic-link authentication

You are porting a hardened, tested auth module into the current codebase. The
code in `reference/` is ONE instantiation (Hono API with `domains/` +
`platform/`, Drizzle/PostgreSQL, Zod contracts package, Vue 3 SPA at `/app/`,
Astro site, Caddy single origin). Adapt placement, granularity, naming, styling
and plumbing to the target. Do NOT impose the reference folder structure or its
UI design. The **invariants** are what must survive; every one of them is
pinned by a test you port along with the code.

The architecture doctrine this was built for is
`/home/luis/claymore/coding/software-architecture.md`. When the target follows
it, the reference layout maps almost one-to-one.

## What the feature is

- **Continue with Google**: `GET /api/auth/google/start` sets short-lived
  `state` + PKCE verifier cookies and redirects to Google;
  `GET /api/auth/google/callback` checks state, exchanges the code
  server-to-server with the client secret, validates the ID token claims, signs
  in, and redirects to `/app/` (or `/app/?auth_error=google`). No Google script
  runs in the browser.
- **Magic link**: `POST /api/auth/email/request {email}` always answers
  `{ok:true}`, emails `/app/#login_token=<token>`. The SPA reads the fragment,
  scrubs it from the URL, shows "Continue to Pawacook" (product copy), and
  `POST /api/auth/email/verify {token}` spends it.
- **Accounts and identities**: one account (unique normalized email), many
  identities `(provider, subject)`. Known identity → its account; else verified
  email match → link; else create. Concurrent first sign-ins converge.
- **Sessions**: opaque cookie, SHA-256 in the DB, 30 days sliding, replaced on
  every sign-in, deleted on sign-out. `requireAccount` / `currentAccount` /
  `accountForRequest` are the whole public surface for other domains.
- **Platform pieces**: Origin guard + security headers + client IP
  (`http.ts`), Postgres fixed-window rate limits, email transport (Resend via
  fetch, JSON files in `.dev/outbox/` when no key), env schema that fails
  closed in production, token hashing.
- **Design-only**: the sign-in screen's layout, the "or" divider, button
  hierarchy (Google primary, email secondary) and all copy. Restyle freely.

## File inventory (reference/)

| File | Role |
|---|---|
| `api/domains/auth/service.ts` | Linking, sessions, login tokens. Core semantics |
| `api/domains/auth/google.ts` | PKCE, authorization URL, claim validation, code exchange (pure + one fetch) |
| `api/domains/auth/api.ts` | Routes, rate-limit rules (`AUTH_LIMITS`), email body, OAuth cookies |
| `api/domains/auth/public.ts` | `requireAccount`, `currentAccount`, `accountForRequest` |
| `api/domains/auth/session-cookie.ts` | Cookie name (`__Host-` in prod) and flags |
| `api/domains/auth/*.test.ts` | Unit (claims, PKCE vector), integration on real Postgres (magic link, sessions, linking, CSRF, Google callback with stubbed token endpoint) |
| `api/platform/{env,email,http,rate-limit,ids}.ts` + tests | Mechanical infrastructure the domain uses |
| `api/app.ts` | App wiring without listener: headers, Origin guard, NO cors |
| `api/db/schema/{auth,platform}.ts` | accounts, identities, sessions, login_tokens, rate_limits |
| `api/drizzle/0001_upgrade_from_provider_column.sql` | Hand-edited upgrade from a `google_sub` column: backfill + in-place session hashing. Only for targets with existing users |
| `contracts/account.ts` | Zod: Account, Session (+ methods), email request/verify, URL keys |
| `app/stores/session.ts`, `app/views/SignIn.vue` | SPA state + reference screen (restyle; granularity follows target) |
| `e2e/auth.spec.ts`, `e2e/support/*` | Playwright: scanner-safe link, single use, Google error; sign-in helper reading the outbox |
| `wiring/*` | Caddyfile, site dev proxy, strict SPA port, test script, Playwright config, env block |
| `verify/mutate.py` | Breaks each guard in turn and expects the suite to fail. Paths/patterns are reference-specific: re-point them |

## Invariants

1. **Identity key is `(provider, subject)`; linking requires a verified email.**
   Google `sub` never changes; emails get reassigned and Google returns
   unverified emails for some accounts. Looking accounts up by a provider's
   email, or linking on `email_verified: false`, is account takeover.
2. **Emails are normalized (trim + lower-case) once, in the contract schema.**
   Otherwise `A@x.com` and `a@x.com` become two accounts and linking fails.
3. **Google = authorization code + `state` + PKCE S256, exchanged server-side.**
   `state` in an httpOnly cookie defeats login CSRF; PKCE binds the code to
   this browser. Claims checked: `iss`, `aud`, `exp`, `email_verified`. The
   signature is skipped ONLY because the token comes straight from Google's
   token endpoint over TLS (OIDC Core 3.1.3.7). If a port ever receives an ID
   token from the browser, it MUST verify the signature against Google's JWKS.
4. **Bearer secrets are 256-bit random and stored only as SHA-256.** Sessions
   and link tokens. A leaked DB row must not be a live credential.
5. **Link tokens: single use via atomic `DELETE ... RETURNING`, 15 min TTL,
   carried in the URL fragment, spent only by POST.** Fragment keeps the token
   out of access logs and Referer; POST-on-click means mail scanners (Outlook
   Safe Links) that GET the URL consume nothing.
6. **The link request response never depends on whether an account exists.**
   Otherwise the endpoint enumerates users. Accounts are created at verify.
7. **Cookies: `HttpOnly`, `SameSite=Lax`, `Path=/`, prod `Secure` + `__Host-`.**
   Lax (not Strict) because the session is set on Google's top-level redirect
   back. `__Host-` stops sibling subdomains shadowing the cookie.
8. **Sessions are server-side and revocable**: sign-out deletes the row;
   sign-in destroys the browser's previous session (fixation); sliding renewal
   re-sets the cookie.
9. **No CORS on a cookie-authenticated API; unsafe methods require an allowed
   `Origin`.** Reflective CORS with credentials lets same-site origins read
   user data; the Origin guard closes cross-site writes. Missing Origin → 403.
10. **Rate limits live in the primary database** (no Redis): per IP and per
    address on link requests, per IP on verify and Google. Client IP is the
    rightmost `X-Forwarded-For` entry only behind the one trusted proxy.
11. **Production fails closed.** Env parsing refuses to boot without provider
    credentials, email key and an https origin. There is no dev sign-in
    endpoint in any environment; dev email goes to a file outbox so dev,
    tests and Playwright exercise the real flow.
12. **Logs carry `userId`, method, outcome and rejection reason; never tokens,
    never email addresses.**
13. **Every invariant above has a test, and the mutation check passes.** A port
    without the tests is not a port of this skill.

## Known adaptation points (decision rules)

- **Sign-in methods** (read the target spec): *Google + email* → full port.
  *Email only* → drop `google.ts`, its routes, cookies, tests and env keys.
  *Google only* → drop login tokens, email routes and (unless used elsewhere)
  email transport; Playwright then signs in by inserting a session row and
  setting the cookie from a test helper, NEVER through an HTTP dev endpoint.
  *Spec says one method but user asked for both* → amend the spec first.
- **Topology**: *site + SPA + API on one origin* → as reference. *API on
  another origin/subdomain* → stop and ask; the default answer is to put a
  proxy in front so they share an origin. Only if the user insists: CORS
  allow-list of exactly the SPA origin with credentials, same list in the
  Origin guard, drop `__Host-` for a `Domain=` cookie, and record the decision.
- **Existing auth in the target**: *none* → greenfield. *Hand-rolled* →
  replace; migrate data (next rule). *Auth library (better-auth, lucia,
  Auth.js…) or hosted auth (Clerk, Supabase)* → ask before replacing.
- **Existing data**: *no users* → generated migration. *Accounts with a provider
  column* → hand-written migration modeled on `0001_upgrade...sql` (backfill
  identities, normalize emails, check for case-duplicate emails FIRST).
  *Plaintext session ids* → hash in place with `sha256()`. *JWT/other
  sessions* → cannot convert; invalidate and tell the user everyone signs in again.
- **Backend framework**: *Hono* → near-verbatim. *Other* → translate middleware
  and cookie helpers; keep status codes, redirects and semantics. *Non-Node
  runtime* → replace `@hono/node-server/conninfo` with the runtime's
  equivalent in `clientIp`.
- **Database**: *PostgreSQL* → as reference. *Other SQL* → translate the
  rate-limit upsert and `DELETE ... RETURNING` (use a transaction with
  `SELECT ... FOR UPDATE` if unsupported). *No SQL database* → stop and ask.
- **Email**: *no transport* → add `platform/email.ts`. *Existing transport* →
  route through it but keep the outbox fallback when no key is set. *Different
  provider* → swap the fetch call; keep "throw on non-2xx" and the outbox.
- **Account columns**: `name`/`picture` are reference product fields; keep,
  rename or drop per target. Auth owns identity columns only; product columns
  (plan, role) belong to their domains.
- **Other domains' data on account deletion / sign-out everywhere**: not in the
  reference. If the target spec needs them: FK `ON DELETE CASCADE` from product
  tables, delete sessions by `account_id`; cross-domain side effects (billing)
  go through that domain's `public.ts`, never inside auth.
- **UI**: *target has a design system* → rebuild the screen with it.
  *No design system* (null class) → semantic HTML, zero classes; do NOT invent
  one. Required states whatever the look: form, "check your email", confirm
  button for a pending token, inline `role="alert"` errors, Google button
  only when `methods.google`. Copy is product-specific.
- **Rate limit numbers, TTLs, session length**: reference defaults are sane;
  change only on explicit product need. Tests read `AUTH_LIMITS`.
- **Legal pages**: *live product* → Privacy Policy names the email provider as
  processor, the sign-in cookies, and retention of sessions/links. *Template* →
  one loudly marked `STUB:` paragraph listing those facts.
- **Product naming**: email subject/body, cookie name prefix
  (`pawacook_session`), `EMAIL_FROM`, `.dev/outbox` path. Rename to the target.

## Dependencies

None new for the auth logic beyond Hono, Drizzle, Zod. `@hono/node-server`
(conninfo) only on Node. No Google or Resend SDKs (plain fetch). Playwright
only if the target has browser tests (doctrine says it should).

## Process

Follow `PORTING.md`. Not done until its verification passes, including the
mutation check with every guard reported `caught`.
