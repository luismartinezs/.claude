import { z } from "zod"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

/**
 * Loads the workspace-root .env without a dotenv dependency. The path is
 * resolved from this file rather than the working directory, so the API, the
 * migrator and tests run from the repository root all read the same file.
 */
const loadRootEnv = (): void => {
  try {
    const raw = readFileSync(fileURLToPath(new URL("../../../../.env", import.meta.url)), "utf8")
    for (const line of raw.split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
      if (!match) continue
      const [, key, value] = match
      if (key && process.env[key] === undefined) process.env[key] = value?.trim() ?? ""
    }
  } catch {
    // No .env file: rely on the ambient environment.
  }
}

const optional = z
  .string()
  .default("")
  .transform((value) => (value.trim() === "" ? null : value.trim()))

export const EnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    API_PORT: z.coerce.number().int().positive().default(8787),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    /** The one public origin serving the site, the SPA and the API. Links and redirects are built from it. */
    APP_ORIGIN: z.url().default("http://localhost:4321"),
    GOOGLE_CLIENT_ID: optional,
    GOOGLE_CLIENT_SECRET: optional,
    /** Unset outside production: emails are written to the dev outbox instead of being sent. */
    RESEND_API_KEY: optional,
    EMAIL_FROM: z.string().default("Pawacook <signin@pawacook.app>"),
    OPENROUTER_API_KEY: z.string().default(""),
    OPENROUTER_MODEL: z.string().default("google/gemini-2.5-flash"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return
    // Production must never fall back to development behaviour because a variable is missing.
    const required = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "RESEND_API_KEY"] as const
    for (const key of required) {
      if (env[key] === null) ctx.addIssue({ code: "custom", path: [key], message: "required in production" })
    }
    if (!env.APP_ORIGIN.startsWith("https://")) {
      ctx.addIssue({ code: "custom", path: ["APP_ORIGIN"], message: "must be https in production" })
    }
  })

export type Env = z.infer<typeof EnvSchema>

loadRootEnv()

export const env = EnvSchema.parse(process.env)

export const isProduction = env.NODE_ENV === "production"

export const google =
  env.GOOGLE_CLIENT_ID !== null && env.GOOGLE_CLIENT_SECRET !== null
    ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
    : null
