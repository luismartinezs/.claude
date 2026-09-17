# Billing: a minimal Stripe paywall

Spec: `docs/spec.md` story 12, "Subscribe to use Pawacook" (revision 28).

## Operator decisions

- Launch requires payment. One monthly plan, USD, no free trial.
- Price = model cost of about 3,000 recipes; usage cap = about 100 recipes per month.

## How the numbers were set

Measured on 2026-09-17 with the real prompts, `google/gemini-2.5-flash`, a
30-item pantry: one generation $0.0020 (962 in / 687 out tokens), one chat
change $0.0023 (1,700 in / 713 out). A recipe with about three chat turns costs
about $0.009, so 3,000 recipes is about $27. The price is **$29/month**.

The cap is **400 assistant requests per rolling 30 days** (generations and chat
messages count alike, since they cost the same): about 100 recipes, and at most
about $1 of model cost per subscriber. Changing the model (the 3.x Flash models
cost 2.5 to 3.6 times as much) means redoing this arithmetic.

## Design

- **Stripe hosts every payment screen.** Checkout for subscribing, the Customer
  Portal for card changes and cancellation. Pawacook has no billing UI beyond
  a Subscribe screen and a "Manage subscription" button.
- **`subscriptions` table**, one row per account: Stripe customer, subscription
  id, status, and the `product_key` of this app's price on the subscription.
  Access = `active` or `past_due` **and** `product_key = "pro"`. Status alone
  would also accept a subscription moved to another app's price on the shared
  account; checking price metadata instead of the price id keeps grandfathered
  subscribers working if the price is ever replaced.
- **Webhook** (`/api/billing/webhook`, mounted ahead of the same-origin guard,
  authenticated by signature) handles `checkout.session.completed`,
  `customer.subscription.updated` and `customer.subscription.deleted`. Each
  delivery re-reads the subscription from Stripe instead of trusting the event
  body, so out-of-order and replayed events are harmless. Subscription events
  only apply to the subscription the account currently holds. A completed
  checkout does not replace a held subscription that still grants access (a
  late retry for an older checkout, or a second checkout paid in another tab);
  when both are live it logs `billing.duplicate_subscription` for a person to
  refund. Processing errors answer 500, so Stripe retries.
- **One subscription per account:** `POST /api/billing/checkout` answers 409
  when the account already has access. The stored row is never trusted to say
  no: `GET /api/billing` re-reads a row that denies access (unless it ended for
  good: `canceled`, `incomplete_expired`), and checkout also lists the returning
  customer's subscriptions in Stripe. Found in the 2026-09-17 end-to-end run: a
  row written before `product_key` existed showed the paywall to a paying
  subscriber, who then paid a second time.
- **Shared Stripe account** (`~/claymore/coding/google-oauth-stripe-setup.md`):
  Checkout sets `{ app: "pawacook", product_key: "pro" }` on the session and on
  `subscription_data`. The webhook acknowledges and ignores any event whose
  object lacks `app: "pawacook"`. Processed event ids are not recorded: every
  delivery writes Stripe's current state, so repeating one cannot repeat a
  state change (the shared setup's step 8, amended 2026-09-17 to prefer this).
- **Gate:** `requireSubscription` (402) on profile, recipes and assistant;
  `requireAssistantAllowance` (429) on assistant, reusing the Postgres
  fixed-window counter. `pruneRateLimits` now keeps 31 days so it never resets
  a live monthly counter.
- **SPA:** after sign-in, `GET /api/billing` decides between the Subscribe
  screen and the workspace. Returning from Checkout polls for up to a minute
  while the webhook lands.
- **Without Stripe env vars** (development, tests) every account counts as
  subscribed. Production refuses to start without them, and `NODE_ENV` has no
  default, so a deploy that forgets it fails to start instead of running
  without the paywall.

## Decisions taken without asking

- Past-due keeps access while Stripe retries the card.
- No refunds except where required by law; cancellation takes effect at the end
  of the paid month (the portal's default "cancel at period end").
- Deliberately absent: pricing page, multiple plans, annual billing, coupons,
  metered billing, in-app invoices, reconciliation jobs.

## Stripe setup (manual, once per mode)

Follows `~/claymore/coding/google-oauth-stripe-setup.md` (slug `pawacook`).

1. Product "Pawacook" with one recurring price: $29.00 USD monthly. Both carry
   metadata `app=pawacook`, `product_key=pro`. **The price metadata is
   load-bearing**: without it no subscriber gets access. Copy the price id
   into `STRIPE_PRO_PRICE_ID`.
2. A Customer Portal configuration of Pawacook's own (not the account default,
   which every app shares): payment method updates, invoice history,
   cancellation at the end of the billing period, no plan switching. Copy its
   `bpc_...` id into `STRIPE_PORTAL_CONFIGURATION_ID`.
3. Webhook endpoint `https://pawacook.app/api/billing/webhook` with the three
   events above. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
4. A restricted key named `pawacook-<mode>` into `STRIPE_SECRET_KEY`, never the
   full secret key of the shared account: Checkout Sessions write, Customer
   portal write, Subscriptions read, everything else none.
5. Check the account-wide failed-payment setting (Billing, Revenue recovery):
   after all retries fail the subscription must be **cancelled** or **marked
   unpaid**. "Leave past due" would keep access forever without payment,
   because `past_due` grants access. The setting is shared with the other apps,
   so change it only knowing their assumptions.

## Provisioned objects (2026-09-17)

Non-secret identifiers only. Secrets live in the environment: locally in
`.env` (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the provisional
`STRIPE_SECRET_KEY_LIVE`, `STRIPE_WEBHOOK_SECRET_LIVE`), in production in its
secret environment under the unsuffixed names.

| | Test sandbox (`acct_1UGe2FLgmt466H1j`) | Live (`acct_1Quy3XLPSGXdiazB`, shared) |
|---|---|---|
| Product | `prod_VHCqud0ygkmrG6` | `prod_VHDbZenVnTZeyK` |
| Price, $29/month (`STRIPE_PRO_PRICE_ID`) | `price_1UGeQrLgmt466H1jWqzAtBAL` | `price_1UGf9sLPSGXdiazBTM6tL0P0` |
| Portal configuration (`STRIPE_PORTAL_CONFIGURATION_ID`) | `bpc_1UGfA2Lgmt466H1j89JAv3Sj` | `bpc_1UGfA2LPSGXdiazBr2DmKEtw` |
| Webhook | `stripe listen` | `we_1UGf8JLPSGXdiazBizufIsQi`, `https://pawacook.app/api/billing/webhook`, API `2026-08-26.dahlia` |
| After all retries fail | not checked | cancel the subscription (checked 2026-09-17) |

Portal configurations were created through the API (the Dashboard only edits
the default one): payment method update, invoice history, cancel at period end
without proration; plan switching and customer detail edits off; privacy and
terms links to pawacook.app.

Local testing: fill the three variables with test-mode values and run
`stripe listen --forward-to localhost:8787/api/billing/webhook` (the CLI prints
the webhook secret to use). Test card `4242 4242 4242 4242`.
