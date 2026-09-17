# Porting steps

Each step leaves the target consistent (typechecks, existing tests pass).

## 0. Survey the target and make every gating decision

**First, read the target's own docs**: `CLAUDE.md`/`AGENTS.md`,
`context/MEMORY.md`, `docs/spec.md`, `docs/architecture/`, active
`docs/plans/`. On any conflict the target's docs override the reference. Read
`/home/luis/claymore/coding/google-oauth-stripe-setup.md` every time: it is the
account policy this port implements.

Answer each question; each feeds a named decision from SKILL.md. Write the
decisions into `docs/plans/billing.md` BEFORE writing code, modeled on
`reference/docs/billing-plan.example.md` (operator decisions, pricing
arithmetic, design, decisions taken without asking, setup). If any decision is
ambiguous, ask the user now; price, trial and refund policy are always the
user's.

| Question | Decision |
|---|---|
| What does the spec say about price, plans, trial, what is paid? Is there a story with acceptance criteria? | **Plans**, **Free trial**, **What the paywall covers** (+ spec amendment) |
| Does anything cost money per request (model calls, paid APIs)? Measured cost per call? | **Usage allowance** |
| Existing billing code, plan columns, Stripe objects, subscribers in any environment? | **Existing billing**, **Existing subscribers** |
| Does the target have accounts, sessions, an Origin guard, a Postgres rate limiter? | prerequisite (`port-auth`) |
| App slug per the shared doc; which Stripe account and mode keys are available locally? | **Stripe account** |
| How is the API reached in prod and dev; is `stripe listen` possible locally? | **Topology** |
| Framework, raw body access, where routes and middleware are registered | **Backend framework** |
| Contracts location, SPA API client and error shape, store pattern, design system | placement, **UI** |
| Legal pages present? Live product or template? | **Legal pages** |
| Test runner, real-DB integration tests, `vi.mock` support, Playwright, command wrappers | toolchain |

## 1. Configuration

Reference: `api/platform/env.ts`, `wiring/env.example`

- Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_<KEY>_PRICE_ID`,
  `STRIPE_PORTAL_CONFIGURATION_ID` (blank = unset), all required in the
  production `superRefine`; expose one `stripeConfig` object or null.
- Make `NODE_ENV` required with no default. **Trap**: every script that loads
  the env (dev server, migrator, drizzle-kit config, test runner) must then
  get it; put `NODE_ENV=development` in `.env` and the example, and rely on
  the test runner setting `test`.
- Port `env.test.ts` cases: production refusal lists every Stripe key, missing
  `NODE_ENV` refused.
- **Typecheck now.**

## 2. Schema and migration

Reference: `api/db/schema/billing.ts`, `api/drizzle/subscriptions.sql`

- Greenfield: add the table (FK to accounts with cascade, unique customer id),
  generate the migration, apply, re-run generate: no changes.
- Replacing a plan column: add the table, backfill per **Existing
  subscribers**, drop the column in a later migration once code no longer
  reads it.

## 3. Billing domain and gate

Reference: `api/domains/billing/`, `api/app.ts`, `wiring/gated-routes.txt`

- Port `service.ts`, `api.ts`, `public.ts`. Set `APP_METADATA` to the target's
  slug and plan key. Granularity follows the target.
- Register the webhook route before the Origin guard and after security
  headers. **Trap**: in Hono a later `app.route("/api/billing", ...)` with
  `use("*", requireAccount)` still matches the webhook path; registering the
  webhook first and returning a response keeps the chain from reaching it.
  Prove it with the "reachable without an Origin header" test.
- **Trap**: the webhook must read the raw body (`c.req.text()`) and nothing may
  parse JSON before it. Body-parsing middleware on `/api/*` breaks signatures.
- Mount `requireSubscription` after `requireAccount` on every gated route
  family; `requireAssistantAllowance` after it where per-call cost applies.
  Add `payment_required` and `conflict` to the shared API error enum.
- **Typecheck now.**

## 4. Tests on the real database

Reference: `*.test.ts` under `api/domains/billing/`

- Port all three suites. `billing.integration.test.ts` fakes Stripe through
  the `StripeReader` seam and signs real webhook requests with
  `generateTestHeaderStringAsync`; `paywall.integration.test.ts` switches
  billing on with `vi.mock` of the env module and fakes the Stripe client via
  `vi.mock` of the service module.
- **Trap**: tests must pass whether or not the developer's `.env` has Stripe
  values. Anything that depends on billing being ON belongs in the paywall
  suite (mocked config), not in suites that read the real env.
- **Trap**: the target's `.env` may hold real provider keys (Resend, Stripe
  live). Integration tests must never reach a live service; blank those keys
  for the test run or make the suite hermetic.
- **Run tests and typecheck now.**

## 5. SPA and site

Reference: `app/`, `contracts/billing.ts`, `docs/legal-pages.diff`

- Contracts, billing store, then the gate in the root component: session →
  billing status → loading / Subscribe / workspace. Reset billing state on
  every account change. Load product data only once access is confirmed.
- Subscribe: full-page redirect; on 409 reload status instead of erroring;
  on `?checkout=success` scrub the flag and poll status.
- Manage button where the target keeps account settings, only when
  `manageable`.
- Legal pages per **Legal pages**. Spec story for the paywall if the target
  has a spec (reference: `docs/billing-plan.example.md` names story 12).
- **Build the SPA and site now.**

## 6. Browser tests

Reference: `e2e/`

- `support/db.ts` runs SQL through the compose service; `signIn` subscribes the
  account by default so existing workspace specs keep passing once Stripe is
  configured locally. **Trap**: without this, every workspace spec starts
  failing the moment a developer fills the Stripe test keys, which is exactly
  when billing work happens.
- Auth specs assert "signed in" through something both the paywall and the
  workspace show (Sign out), not a workspace heading.
- Port `billing.spec.ts`; its tests skip themselves when Stripe is not
  configured.

## 7. Provision Stripe (test, then live)

Reference: `provision/provision-stripe.sh`

- Test mode first, with `--no-webhook` (local delivery is `stripe listen`):
  ```
  provision-stripe.sh --env-file .env --key-var STRIPE_SECRET_KEY --app <slug> \
    --product-key pro --name <Product> --amount <cents> --currency usd --interval month \
    --origin https://<domain> --no-webhook --check
  ```
  Review, drop `--check`, run again. It writes the price and portal ids.
- Live: the operator puts a live restricted key into the env file under a
  temporary name (e.g. `STRIPE_SECRET_KEY_LIVE`) and runs the script with
  `--suffix _LIVE --api-version <SDK's version>`; it creates the webhook and
  writes its signing secret without printing it. **Trap**: an agent's
  permission layer may refuse to load a live key into a shell. Do not work
  around it: hand the exact command to the user to run with `!`.
- **Trap**: the webhook's signing secret is returned only at creation. The
  script refuses to proceed when the endpoint exists but the secret was never
  captured; the fix is rolling the secret in the Dashboard.
- **Manual, account-wide**: Billing > Revenue recovery > Retries, "If all
  retries fail" must be cancel or mark unpaid, in each mode. Reading it in the
  Dashboard is safe; changing it affects every app, so ask first.
- Do not change the restricted key's permission scope; its breadth is an
  operator decision.
- Record the non-secret ids per mode in the plan doc (shared doc checklist
  step 8).

## Verification

Use the TARGET's commands.

1. Typecheck, architecture checks, full build.
2. Unit + integration tests against the real database. Expected coverage:
   foreign-app events untouched, re-read on checkout and subscription events,
   foreign price denied, late checkout does not replace live subscription,
   duplicate kept + logged, resubscribe replaces ended, stale row healed, final
   statuses not re-read, lost-webhook subscription found before checkout,
   signed delivery recorded, tampered/foreign-secret/unsigned refused before
   any read, webhook reachable without Origin, 402 on every gated family, 409
   on second checkout, checkout session params (mode, client_reference_id,
   both metadata, price, server-built URLs), allowance boundary, production
   env refusal, missing `NODE_ENV` refused.
3. **Negative test**: re-point `verify/mutate.py` at the ported files and run
   it. Every mutant must print `caught`; confirm `git diff` is unchanged
   afterwards. **Trap**: do not back files up with a shell `cp`, which may be
   aliased to `cp -i` and silently skip the backup.
4. Playwright against the running dev stack with Stripe test keys configured.
5. **One real test-mode payment through the running app** (`./dev` +
   `stripe listen`): subscribe with card 4242 (the user types card details on
   Stripe's page; browser automation neither can nor should), workspace opens;
   portal shows the app's configuration; cancel at period end keeps access;
   `stripe subscriptions cancel <id>` returns the paywall and the API answers
   402. Watch the API log for `billing.*` events and errors while doing it.
6. Report: file map; decisions from step 0; copied vs adapted vs dropped;
   provisioned ids per mode; manual actions left for the user (live env
   values, retry setting, legal review of Terms).

If the target's reality forced a deviation from this skill, or you hit a trap
it did not warn about, report it to the user and propose the skill edit as a
general rule, not a target-specific patch.
