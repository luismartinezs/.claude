import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { z } from "zod"
import { env } from "./env.ts"
import { log } from "./logger.ts"

export type Email = { to: string; subject: string; text: string; html: string }

/**
 * Where emails go when no provider is configured (development and tests). Each
 * message is one JSON file, so a person, an agent or Playwright can open the
 * latest sign-in link without a mail server.
 */
export const OUTBOX_DIR = fileURLToPath(new URL("../../../../.dev/outbox/", import.meta.url))

const ResendResponseSchema = z.object({ id: z.string() })

const writeToOutbox = (email: Email): void => {
  mkdirSync(OUTBOX_DIR, { recursive: true })
  const file = `${OUTBOX_DIR}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`
  writeFileSync(file, JSON.stringify({ ...email, sentAt: new Date().toISOString() }, null, 2))
  log.info("email.captured", { file })
}

/** Throws when the provider rejects the message, so callers never report a send that did not happen. */
export const sendEmail = async (email: Email): Promise<void> => {
  if (env.RESEND_API_KEY === null) return writeToOutbox(email)

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, ...email }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    log.error("email.send_failed", { status: response.status })
    throw new Error(`Email provider rejected the message (${response.status})`)
  }
  const sent = ResendResponseSchema.safeParse(await response.json().catch(() => null))
  log.info("email.sent", { providerId: sent.success ? sent.data.id : null })
}
