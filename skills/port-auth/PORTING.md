# Porting steps

Each step leaves the target consistent (typechecks, existing tests pass).

## 0. Survey the target and make every gating decision

**First, read the target's own docs**: `CLAUDE.md`/`AGENTS.md`,
`context/MEMORY.md`, `docs/spec.md`, `docs/architecture/`, active
`docs/plans/`. On any conflict the target's docs override the reference,
including file granularity and styling, not only placement. If the target
follows `/home/luis/claymore/coding/software-architecture.md`, read it too.

Answer each question; each one feeds a named decision from SKILL.md's
adaptation points. Write the decisions into `docs/plans/auth.md` (goal,
decisions, acceptance criteria = the invariants that apply, state) BEFORE
writing code. If any decision is ambiguous, ask the user now.

| Question | Decision |
|---|---|
| What does the spec say about sign-in methods and copy? Does it conflict with the user's request? | **Methods** (+ spec amendment) |
| Is there an existing auth implementation, library, or hosted provider? Existing users/sessions in any environment? | **Existing auth**, **Existing data** |
| How are site, SPA and API served in prod (Caddyfile/nginx) and in dev (proxies, ports)? | **Topology** |
| Backend framework and runtime; how routes and middleware are registered; is there CORS middleware now? | **Backend framework** |
| Database, ORM, migration workflow; is it a TTY-prompting generator? | **Database** |
| Email transport present? | **Email** |
| Where shared contracts live; how the SPA calls the API; session/state store pattern | placement |
| Design system present? Template or live product? | **UI**, **Legal pages** |
| Test runner, whether integration tests can reach a real DB, Playwright setup, command wrappers (`./check`, `./test`, `./verify`) | toolchain |
| Structured logger and env schema location | placement |

## 1. Configuration and platform

Reference: `api/platform/`, `wiring/env.example`

- Extend the target's env schema with `APP_ORIGIN`, provider keys and the
  production `superRefine`. Blank strings must mean unset.
  **Trap**: if the env loader resolves `.env` from `process.cwd()`, tests run
  from the repo root silently read nothing. Resolve from `import.meta.url`.
- Add `ids.ts` (`newToken`, `hashToken`), `email.ts` (outbox fallback),
  `rate-limit.ts`, `http.ts` (Origin guard, security headers, `clientIp`).
- Add `.dev/` (or the renamed outbox dir) to `.gitignore`.
- **Run the target's typecheck now**, plus `env.test.ts` and `http.test.ts`.

## 2. Schema and migration

Reference: `api/db/schema/auth.ts`, `platform.ts`, `api/drizzle/0001_...sql`

- Greenfield: add tables, generate the migration.
- Existing users: write the migration by hand from the upgrade example. Before
  adding the unique email index, query for emails that collide after
  `lower(trim())` and stop to ask if any exist.
- **Trap (drizzle-kit)**: `generate` prompts on column add/drop ambiguity and
  fails without a TTY. Run it under `script -q -c "..." /dev/null` and feed
  `\r` (first option = create), then review the SQL: generated
  `ADD COLUMN ... PRIMARY KEY NOT NULL` fails on populated tables.
- Apply the migration, then re-run generate: it must report no changes.

## 3. Auth domain

Reference: `api/domains/auth/`

- Port `service.ts`, `google.ts`, `session-cookie.ts`, `public.ts`, `api.ts`.
  Granularity follows the target (a small-domain target may merge files); the
  public surface stays `requireAccount` / `currentAccount` / `accountForRequest`.
- Replace every other domain's use of the old auth with the public surface.
- Split the app from the listener (`app.ts` / `index.ts`) if the target has
  not, so integration tests drive the app in-process.
- Remove CORS middleware. Mount security headers on `*` and the Origin guard
  on the API prefix. **Trap**: webhooks from third parties (Stripe) have no
  browser Origin; mount them outside the guard and authenticate by signature.
- **Typecheck now.**

## 4. Tests on the real database

Reference: `api/domains/auth/*.test.ts`

- Port the unit tests verbatim (PKCE uses the RFC 7636 vector).
- Port both integration suites. Make the test command start and migrate the
  database first (`wiring/test.sh`). **Traps**: in-process requests share one
  `local` client IP, so reset only the rate-limit keys each file owns (files
  run in parallel); outbox lookups must normalize the address; the Google suite
  sets env before a dynamic import of the app.
- **Run tests and typecheck now.** The first test file in a package may need
  test-runner types in `tsconfig`.

## 5. SPA and site

Reference: `app/`, `wiring/site.astro.config.mjs`, `wiring/app.vite.config.ts`

- Contracts first (`contracts/account.ts`), then the session store (reads and
  scrubs `#login_token` and `?auth_error` at module load), then the screen in
  the target's design system (or none).
- Google button is a plain link to `/api/auth/google/start`: a top-level
  navigation, not fetch.
- Dev topology: the site dev server proxies `/app` (ws on) and `/api`, the SPA
  dev server uses `strictPort: true`, and `APP_ORIGIN` is the site origin.
  **Trap**: without `strictPort` a port clash silently moves the SPA while its
  proxy keeps pointing at whatever owns the API port.
- Update landing-page CTAs that named a single provider.
- **Build the SPA and site now.**

## 6. Browser tests

Reference: `e2e/`, `wiring/playwright.config.ts`

- `baseURL` = site origin (env-overridable). Global setup clears rate-limit
  counters (never loosen production limits for tests).
- Replace any existing dev-stub sign-in helper with `support/auth.ts`.
- Port `auth.spec.ts`; adapt copy selectors to the target's text.

## 7. Production wiring and docs

Reference: `wiring/Caddyfile`

- Proxy config: security headers for static routes; the API reachable only
  through the proxy (rightmost `X-Forwarded-For` trust depends on it).
- Google Cloud Console: redirect URI `<APP_ORIGIN>/api/auth/google/callback`
  for every environment; JavaScript origins are not needed for this flow.
- Resend: verified sending domain (SPF, DKIM, DMARC) before launch.
- Docs: spec amendment if methods changed; Privacy Policy (processor,
  cookies, retention); architecture doc auth section; env example; plan state.

## Verification

Use the TARGET's commands.

1. Typecheck, architecture checks, full build.
2. Unit + integration tests against the real database. Expected coverage: link
   single use, hashed storage, identical request responses, expiry, malformed
   tokens, per-address limit, server-side sign-out, session replacement,
   sliding renewal, linking + subject stability + concurrency, cross-origin
   403, no CORS headers, security headers, Google start/callback/state
   mismatch/unverified/declined, production env refusal.
3. **Negative test**: re-point `verify/mutate.py` at the ported files and run it.
   Every mutant must print `caught`. It restores files in `finally`; confirm
   `git diff` is unchanged afterwards. **Trap**: do not back files up with a
   shell `cp`, which may be aliased to `cp -i` and silently skip the backup.
4. Playwright against the running dev stack, with a real magic-link sign-in.
5. Runtime evidence: `/api/auth/session` returns `methods`; an unauthenticated
   protected route returns 401; a request from another port confirms which app
   owns the API port.
6. Look at the sign-in screen: desktop and 390px wide, with Google enabled
   (set a dummy secret locally) and disabled.
7. Report: file map; decisions from step 0; copied vs adapted vs dropped;
   migration notes (existing users, invalidated sessions); console/DNS actions
   left for the user (Google redirect URI, client secret, Resend domain).

If the target's reality forced a deviation from this skill, or you hit a trap
it did not warn about, report it to the user and propose the skill edit as a
general rule, not a target-specific patch.
