import { createHash, randomBytes, randomUUID } from "node:crypto"

export const newId = (): string => randomUUID()

/** 256 bits from the CSPRNG, URL-safe so it fits cookies, links and fragments unescaped. */
export const newToken = (): string => randomBytes(32).toString("base64url")

/**
 * Bearer secrets (session tokens, sign-in links) are stored only as this hash,
 * so a leaked database row cannot be replayed as a live credential. A fast hash
 * is correct here: the input is 256 random bits, not a guessable password.
 */
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex")
