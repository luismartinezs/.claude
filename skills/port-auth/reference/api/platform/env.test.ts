import { describe, expect, test } from "vitest"
import { EnvSchema } from "./env.ts"

const base = { DATABASE_URL: "postgres://x" }

describe("EnvSchema", () => {
  test("production refuses to start without Google, Resend and an https origin", () => {
    const result = EnvSchema.safeParse({ ...base, NODE_ENV: "production" })
    expect(result.success).toBe(false)
    const paths = result.error?.issues.map((issue) => issue.path.join(".")) ?? []
    expect(paths).toEqual(
      expect.arrayContaining(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "RESEND_API_KEY", "APP_ORIGIN"]),
    )
  })

  test("production parses when auth is fully configured", () => {
    const result = EnvSchema.safeParse({
      ...base,
      NODE_ENV: "production",
      APP_ORIGIN: "https://pawacook.app",
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
      RESEND_API_KEY: "re_123",
    })
    expect(result.success).toBe(true)
  })

  test("development tolerates missing providers and treats blank values as unset", () => {
    const result = EnvSchema.parse({ ...base, GOOGLE_CLIENT_ID: "  ", RESEND_API_KEY: "" })
    expect(result.GOOGLE_CLIENT_ID).toBeNull()
    expect(result.RESEND_API_KEY).toBeNull()
  })
})
