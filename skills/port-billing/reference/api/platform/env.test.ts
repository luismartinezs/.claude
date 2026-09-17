import { describe, expect, test } from "vitest"
import { EnvSchema } from "./env.ts"

const base = { DATABASE_URL: "postgres://x" }

describe("EnvSchema", () => {
  test("production refuses to start without Google, Resend, Stripe and an https origin", () => {
    const result = EnvSchema.safeParse({ ...base, NODE_ENV: "production" })
    expect(result.success).toBe(false)
    const paths = result.error?.issues.map((issue) => issue.path.join(".")) ?? []
    expect(paths).toEqual(
      expect.arrayContaining([
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "RESEND_API_KEY",
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "STRIPE_PRO_PRICE_ID",
        "STRIPE_PORTAL_CONFIGURATION_ID",
        "APP_ORIGIN",
      ]),
    )
  })

  test("production parses when auth and billing are fully configured", () => {
    const result = EnvSchema.safeParse({
      ...base,
      NODE_ENV: "production",
      APP_ORIGIN: "https://pawacook.app",
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
      RESEND_API_KEY: "re_123",
      STRIPE_SECRET_KEY: "sk_live_123",
      STRIPE_WEBHOOK_SECRET: "whsec_123",
      STRIPE_PRO_PRICE_ID: "price_123",
      STRIPE_PORTAL_CONFIGURATION_ID: "bpc_123",
    })
    expect(result.success).toBe(true)
  })

  test("refuses to start without an explicit NODE_ENV, since development switches the paywall off", () => {
    const result = EnvSchema.safeParse(base)
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain("NODE_ENV")
  })

  test("development tolerates missing providers and treats blank values as unset", () => {
    const result = EnvSchema.parse({ ...base, NODE_ENV: "development", GOOGLE_CLIENT_ID: "  ", RESEND_API_KEY: "" })
    expect(result.GOOGLE_CLIENT_ID).toBeNull()
    expect(result.RESEND_API_KEY).toBeNull()
  })
})
