---
name: port-billing
description: Port a production-grade Stripe subscription paywall (hosted Checkout and Customer Portal, signature-verified webhook that re-reads subscriptions from Stripe, access tied to this app's price metadata on the shared App Forge Labs Stripe account, double-charge guards, server-side 402 gate, optional monthly usage allowance, fail-closed env) into a Hono/Vue/Postgres codebase, plus idempotent provisioning of the product, price, portal configuration and webhook. Use when asked to add payments, billing, subscriptions, a paywall, Stripe, checkout, "charge users", a pricing plan, or to review or harden an existing Stripe integration. Contains the reference implementation, security invariants, porting steps, real-database integration tests, Playwright flows, a mutation check that proves every guard survived the port, and the provisioning script.
---

# port-billing: Stripe subscription paywall

You are porting a hardened, tested subscription paywall into the current
codebase. The code in `reference/` is ONE instantiation (Pawacook: Hono API
with `domains/` + `platform/`, Drizzle/PostgreSQL, Zod contracts package, Vue 3
SPA at `/app/`, Astro site, Caddy single origin, one $29/month plan with a
usage cap). Adapt placement, naming, styling, plans and copy to the target. Do
NOT impose the reference's plan, price, cap or screen design. The
**invariants** are what must survive; every one of them is pinned by a test you
port along with the code.

Two documents govern this skill and override it on conflict:
- `/home/luis/claymore/coding/google-oauth-stripe-setup.md`: the shared Stripe
  account policy (slug, metadata, restricted keys, one webhook per app).
- `/home/luis/claymore/coding/software-architecture.md`: the architecture
  doctrine the reference layout follows.

**Prerequisite: accounts and sessions.** Billing hangs off a signed-in
account (`requireAccount` / `currentAccount`), an Origin guard it must be
mounted ahead of, and a Postgres rate-limit counter for the usage allowance.
If the target lacks them, run `port-auth` first.

## What the feature is

- **Subscribe screen**: a signed-in account without access sees only the plan,
  a Subscribe button, Sign out and the legal links. `POST /api/billing/checkout`
  returns a Stripe Checkout URL; the SPA does a full-page redirect.
- **Return from Checkout**: `/app/?checkout=success` polls `GET /api/billing`
  for up to a minute while the webhook lands, then opens the workspace. The
  query flag is only a UI hint and grants nothing.
- **Manage subscription**: `POST /api/billing/portal` opens Stripe's Customer
  Portal with the app's own portal configuration (card update, invoices,
  cancel at period end; no plan switching).
- **Webhook** `POST /api/billing/webhook`: `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted`. Signature
  verified over the raw body, mounted ahead of the Origin guard.
- **Gate**: `requireSubscription` (402) on every route family holding account
  data; `requireAssistantAllowance` (429) on routes that spend money per call.
- **One row per account** in `subscriptions`: Stripe customer, subscription id,
  status, and the `product_key` read from this app's price on the subscription.
- **Without Stripe configured** (development, tests) everyone counts as
  subscribed; production refuses to start without every Stripe value.
- **Design-only**: the Subscribe screen, the confirming state, where the
  Manage button sits, all copy. Restyle freely.

## File inventory (reference/)

| File | Role |
|---|---|
| `api/domains/billing/service.ts` | Access rule, webhook handling, stale-row re-read, pre-checkout check. Core semantics |
| `api/domains/billing/api.ts` | Status, checkout, portal routes; `createStripeWebhook` factory (testable with real signatures) |
| `api/domains/billing/public.ts` | `requireSubscription`, `requireAssistantAllowance`, `ASSISTANT_ALLOWANCE`: the whole surface for other domains |
| `api/domains/billing/service.test.ts` | Access rule and price-metadata reading (pure) |
| `api/domains/billing/billing.integration.test.ts` | Real Postgres: event filtering, re-read, late/duplicate checkouts, stale rows, signed webhook deliveries, 409, allowance |
| `api/domains/billing/paywall.integration.test.ts` | Billing switched ON via `vi.mock` of env + a fake Stripe: 402 on every protected family, checkout session params, missed-webhook 409 |
| `api/db/schema/billing.ts`, `api/drizzle/subscriptions.sql` | The table and its greenfield SQL |
| `api/platform/env.ts` + test | `NODE_ENV` required, Stripe vars, production `superRefine`, `stripeConfig` |
| `api/app.ts` | Webhook registered BEFORE the Origin guard |
| `contracts/billing.ts` | `PLAN` label and cap, `BillingStatus`, `Redirect`, usage-limit message |
| `app/App.vue`, `app/stores/billing.ts`, `app/views/Subscribe.vue`, `app/views/ProfileView.vue` | Session → billing status → paywall or workspace; checkout confirmation polling; 409 handling; Manage button |
| `e2e/billing.spec.ts`, `e2e/support/{auth,db,global-setup}.ts` | Playwright: paywall + 402, hand-over to checkout.stripe.com, subscribed workspace + 409; `signIn` subscribes test accounts by default |
| `wiring/gated-routes.txt`, `wiring/env.example` | How other domains mount the gate; error enum additions; env block |
| `docs/billing-plan.example.md` | The reference's plan doc: operator decisions, pricing arithmetic, design, setup, provisioned ids |
| `docs/legal-pages.diff` | Terms (price, renewal, cancellation, refunds) and Privacy (Stripe as processor) additions |
| `provision/provision-stripe.sh` | Idempotent product/price/portal/webhook provisioning per mode; never prints secrets |
| `verify/mutate.py` | Breaks each guard in turn and expects the suite to fail. Paths/patterns are reference-specific: re-point them |

## Invariants

1. **The webhook verifies `Stripe-Signature` over the unmodified raw body
   before anything is parsed or read**, and is mounted ahead of the Origin
   guard (Stripe sends no browser Origin). Its secret is the endpoint's own.
2. **Events about other apps are acknowledged and ignored.** The shared account
   sends every app's events to every endpoint. Filter on `metadata.app` of the
   event object, before any Stripe call or database write. Checkout sets the
   metadata on the session AND `subscription_data` (it does not copy over).
3. **Every delivery records Stripe's current state, never the event's copy.**
   Re-read the subscription; this makes retries, replays and out-of-order
   delivery harmless without an event-id table (shared setup doc, step 8).
   Processing errors answer 500 so Stripe retries; nothing is acknowledged
   unapplied.
4. **Subscription events only change the subscription the account holds.** A
   late event about a replaced subscription is ignored.
5. **Access = live status AND this app's price.** `active` or `past_due`, and
   `product_key` from the metadata of an item's price whose `app` is this app.
   Status alone would honour a subscription switched to another app's price on
   the shared account. Metadata (not the price id) keeps grandfathered
   subscribers valid when the price is replaced.
6. **Never start a second subscription.** Checkout answers 409 when the account
   has access, and a completed checkout never replaces a held subscription that
   still grants access. When both are live, log
   `billing.duplicate_subscription` with both ids for a person to refund.
7. **The stored row may say yes, but never alone says no.** A row that denies
   access is re-read from Stripe before the paywall is shown (except final
   statuses `canceled`, `incomplete_expired`, so lapsed accounts do not call
   Stripe per page load), and checkout also lists the returning customer's
   subscriptions. Found in production-like testing: a row written before a
   schema change showed the paywall to a paying subscriber, who paid twice.
8. **The server enforces the paywall on every route family with account data
   or per-call cost.** 402 whatever the page shows. The SPA gate is UX only.
9. **Redirect URLs are built on the server from `APP_ORIGIN`.** Never accept
   `successUrl`/`returnUrl` from the client (open redirect via Stripe).
10. **The portal uses the app's own configuration**, created through the API
    (the Dashboard edits only the shared default): no plan switching, cancel at
    period end.
11. **Production fails closed.** `NODE_ENV` has no default; production refuses
    to start without the secret key, webhook secret, price id and portal
    configuration id, and billing-off only exists in development and test.
12. **Secrets never reach logs, code, or the conversation.** Restricted keys
    (per the shared doc); the provisioning script writes the signing secret
    straight into the env file. Logs carry `userId`, status and product key.
13. **Every invariant above has a test, and the mutation check passes.** A port
    without the tests is not a port of this skill.

## Known adaptation points (decision rules)

- **Plans** (read the target spec): *one plan* → as reference. *Several plans or
  tiers* → one price per `product_key`, `STRIPE_<KEY>_PRICE_ID` each, checkout
  takes a plan key validated against a server-side list (never a raw price id
  from the client), `grantsAccess` compares against the plans that grant the
  requested capability. *Annual + monthly of one plan* → same `product_key` on
  both prices. *Spec silent on price* → stop and ask; do not invent a price.
- **Free trial**: *none* → as reference (`trialing` denied). *Trial* →
  `subscription_data.trial_period_days` and add `trialing` to the access
  statuses; test both.
- **Failed renewals**: *keep access while Stripe retries* → `past_due` grants
  (reference). *Cut off immediately* → drop `past_due`. Either way the
  account-wide retry setting must end in cancel or unpaid.
- **What the paywall covers**: *whole workspace* → as reference. *Some
  features* → gate only those route families and let the SPA show both states;
  the 402 test lists exactly the gated families.
- **Usage allowance**: *per-call cost (LLM, API)* → keep
  `requireAssistantAllowance`, set the number from measured cost per call and
  write the arithmetic into the plan doc. *No per-call cost* → drop it and its
  tests. The rate-limit prune window must exceed the allowance window.
- **Existing billing in the target**: *none* → greenfield. *Boilerplate-style*
  (plan column on users, trusts event body, client-supplied redirect URLs,
  event-id lock that swallows failures) → replace; map `plan = pro` rows to
  subscriptions by listing each customer's subscriptions in Stripe, never by
  guessing. *Stripe Billing via a library or hosted (Lemon Squeezy, Paddle)* →
  ask before replacing.
- **Existing subscribers**: *none* → generated migration. *Some* → after
  migrating, run a one-off that re-reads every row from Stripe (invariant 7
  heals rows lazily, but a backfill avoids a first slow page load and makes the
  data honest immediately).
- **Stripe account**: *App Forge Labs product* → the shared account, slug =
  product slug. *Different legal entity or payout* → a separate account (shared
  doc); metadata filtering still costs nothing, keep it.
- **Topology**: *webhook reaches the API through the same proxy* → as
  reference. *Different host* → the endpoint URL follows the API; the Origin
  guard exemption stays route-specific, never a blanket bypass.
- **Backend framework**: *Hono* → near-verbatim. *Other* → keep the raw-body
  read before JSON parsing (many frameworks consume the body first), status
  codes, and the webhook-factory seam for signature tests.
- **UI**: *design system* → rebuild Subscribe and the Manage button with it.
  *None* → semantic HTML, zero classes. Required states: plan + Subscribe,
  opening checkout, confirming payment, still-confirming message, checkout
  error, Manage button only when `manageable`.
- **Legal pages**: *live product* → Terms state price, automatic renewal,
  cancellation via the portal, refund policy; Privacy names Stripe as payment
  processor. *Template* → one loudly marked `STUB:` paragraph.

## Dependencies

`stripe` (Node SDK). Note the API version it pins
(`node_modules/stripe/esm/apiVersion.js` or its types): the webhook endpoint is
created with that version so event shapes match. No client-side Stripe.js
(Checkout and Portal are hosted); no publishable key. `jq` and `curl` for
provisioning.

## Process

Follow `PORTING.md`. Not done until its verification passes, including the
mutation check with every guard reported `caught` and one real test-mode
payment through the running app.
