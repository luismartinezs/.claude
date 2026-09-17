"""Breaks each billing guard in turn and expects the unit/integration suite to fail.

Run from the target's repository root with the database up. Paths and patterns
are the reference's: re-point them at the ported files. Every line must print
`caught`. Files are restored in `finally`; confirm `git diff` is unchanged after.
"""
import subprocess

B = "apps/api/src/domains/billing"
M = [
    (f"{B}/api.ts",
     "event = await verifier.constructEventAsync(await c.req.text(), signature, webhookSecret)",
     "event = JSON.parse(await c.req.text())",
     "webhook signature not verified"),
    (f"{B}/api.ts",
     'if (hasAccess(row)) return c.json({ error: "conflict"',
     'if (false) return c.json({ error: "conflict"',
     "second checkout allowed"),
    (f"{B}/api.ts",
     "const row = stripe ? await subscriptionBeforeCheckout(stripe, account.id) : await findSubscription(account.id)",
     "const row = await findSubscription(account.id)",
     "checkout trusts the stored row"),
    (f"{B}/service.ts",
     "    entitlement.productKey === APP_METADATA.product_key)",
     "    true)",
     "access by status alone (price not checked)"),
    (f"{B}/service.ts",
     "  object.metadata?.app === APP_METADATA.app",
     "  true",
     "other apps' events processed"),
    (f"{B}/service.ts",
     "    if (held && grantsAccess(entitlementOf(held), true)) {",
     "    if (false) {",
     "late checkout replaces a live subscription"),
    (f"{B}/service.ts",
     "  if (!client || !row || hasAccess(row) || FINAL_STATUSES.has(row.status)) return row",
     "  return row",
     "denied row never re-read from Stripe"),
    (f"{B}/service.ts",
     "  if (!client || !row || hasAccess(row) || FINAL_STATUSES.has(row.status)) return row",
     "  if (!client || !row || hasAccess(row)) return row",
     "ended subscriptions re-read on every load"),
    (f"{B}/service.ts",
     "  const live = data.find((subscription) => grantsAccess(entitlementOf(subscription), true))",
     "  const live = undefined",
     "customer's live subscriptions not listed before checkout"),
    (f"{B}/service.ts",
     '        .where(eq(subscriptions.stripeSubscriptionId, event.data.object.id))\n      if (!row) return\n      const subscription = await retrieveIfExists(client, row.stripeSubscriptionId)\n      if (subscription) await writeSubscription(row.accountId, subscription)',
     '        .where(eq(subscriptions.stripeSubscriptionId, event.data.object.id))\n      if (!row) return\n      await db.update(subscriptions).set({ status: event.data.object.status }).where(eq(subscriptions.accountId, row.accountId))',
     "event body trusted instead of re-read"),
    ("apps/api/src/domains/profile/api.ts",
     "requireAccount, requireSubscription)",
     "requireAccount)",
     "profile routes not behind the paywall"),
    ("apps/api/src/domains/recipes/api.ts",
     "requireAccount, requireSubscription)",
     "requireAccount)",
     "recipe routes not behind the paywall"),
    ("apps/api/src/domains/assistant/api.ts",
     "requireAccount, requireSubscription, requireAssistantAllowance)",
     "requireAccount, requireSubscription)",
     "usage allowance not enforced"),
    ("apps/api/src/platform/env.ts",
     '      "STRIPE_WEBHOOK_SECRET",\n',
     "",
     "production boots without a webhook secret"),
    ("apps/api/src/platform/env.ts",
     '    NODE_ENV: z.enum(["development", "production", "test"]),',
     '    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),',
     "NODE_ENV defaults to development (paywall silently off)"),
]

for path, old, new, label in M:
    orig = open(path).read()
    if orig.count(old) != 1:
        print("SKIP (pattern):", label)
        continue
    try:
        open(path, "w").write(orig.replace(old, new))
        r = subprocess.run(["pnpm", "exec", "vitest", "run", "apps/api"], capture_output=True, timeout=300)
        print(("caught:   " if r.returncode else "SURVIVED: ") + label)
    finally:
        open(path, "w").write(orig)
