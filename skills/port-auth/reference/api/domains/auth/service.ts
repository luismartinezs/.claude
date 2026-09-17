import { and, eq, gt, lt } from "drizzle-orm"
import type { Account } from "@pawacook/contracts"
import { db } from "../../platform/db.ts"
import { accounts, identities, loginTokens, sessions } from "../../db/schema/index.ts"
import { hashToken, newId, newToken } from "../../platform/ids.ts"
import { log } from "../../platform/logger.ts"

const DAY_MS = 24 * 60 * 60 * 1000
export const SESSION_TTL_MS = 30 * DAY_MS
/** A session used with less than this left is extended, so active people are not signed out mid-use. */
export const SESSION_RENEW_WITHIN_MS = 15 * DAY_MS
export const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000

/**
 * An identity whose email the provider has proven the person controls: Google
 * with `email_verified`, or a magic link that was opened. Only verified
 * identities may be resolved, because the email is what links them.
 */
export type VerifiedIdentity = {
  provider: "google" | "email"
  subject: string
  email: string
  name: string | null
  picture: string | null
}

export type Resolution = { account: Account; outcome: "existing" | "linked" | "created" }

const accountColumns = { id: accounts.id, email: accounts.email, name: accounts.name, picture: accounts.picture }

/**
 * Standard account linking:
 *   1. a known (provider, subject) signs in its account;
 *   2. otherwise an account with the same verified email gains this identity;
 *   3. otherwise a new account is created with this identity.
 * Unique keys on identities and account email make concurrent first sign-ins
 * converge on one account instead of creating two.
 */
export const resolveAccount = async (identity: VerifiedIdentity): Promise<Resolution> =>
  db.transaction(async (tx) => {
    const known = await tx
      .select(accountColumns)
      .from(identities)
      .innerJoin(accounts, eq(accounts.id, identities.accountId))
      .where(and(eq(identities.provider, identity.provider), eq(identities.subject, identity.subject)))
      .limit(1)
    const existing = known[0]
    if (existing) {
      if (identity.provider !== "google") return { account: existing, outcome: "existing" as const }
      // Google is the source of the display name and picture, so keep them current.
      const name = identity.name ?? existing.name
      await tx.update(accounts).set({ name, picture: identity.picture }).where(eq(accounts.id, existing.id))
      return { account: { ...existing, name, picture: identity.picture }, outcome: "existing" as const }
    }

    const created = await tx
      .insert(accounts)
      .values({
        id: newId(),
        email: identity.email,
        name: identity.name ?? identity.email.split("@")[0] ?? "Home cook",
        picture: identity.picture,
      })
      .onConflictDoNothing({ target: accounts.email })
      .returning({ id: accounts.id })

    const [owner] = await tx.select(accountColumns).from(accounts).where(eq(accounts.email, identity.email))
    if (!owner) throw new Error("account missing after upsert")

    await tx
      .insert(identities)
      .values({ provider: identity.provider, subject: identity.subject, accountId: owner.id })
      .onConflictDoNothing()

    const outcome = created.length > 0 ? ("created" as const) : ("linked" as const)
    log.info(outcome === "created" ? "auth.account_created" : "auth.identity_linked", {
      userId: owner.id,
      provider: identity.provider,
    })
    return { account: owner, outcome }
  })

export const createSession = async (accountId: string): Promise<{ token: string; expiresAt: Date }> => {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
  const token = newToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.insert(sessions).values({ tokenHash: hashToken(token), accountId, expiresAt })
  return { token, expiresAt }
}

export type ValidSession = { account: Account; expiresAt: Date; renewed: boolean }

export const validateSession = async (token: string, now = new Date()): Promise<ValidSession | null> => {
  const tokenHash = hashToken(token)
  const [row] = await db
    .select({ ...accountColumns, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(accounts, eq(accounts.id, sessions.accountId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1)
  if (!row) return null

  const { expiresAt, ...account } = row
  if (expiresAt.getTime() - now.getTime() >= SESSION_RENEW_WITHIN_MS) {
    return { account, expiresAt, renewed: false }
  }
  const renewedUntil = new Date(now.getTime() + SESSION_TTL_MS)
  await db.update(sessions).set({ expiresAt: renewedUntil }).where(eq(sessions.tokenHash, tokenHash))
  return { account, expiresAt: renewedUntil, renewed: true }
}

export const destroySession = async (token: string): Promise<void> => {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)))
}

export const createLoginToken = async (email: string): Promise<string> => {
  await db.delete(loginTokens).where(lt(loginTokens.expiresAt, new Date()))
  const token = newToken()
  await db.insert(loginTokens).values({
    tokenHash: hashToken(token),
    email,
    expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MS),
  })
  return token
}

/** Single use: the row is deleted in the same statement that reads it, so two concurrent uses cannot both succeed. */
export const consumeLoginToken = async (token: string): Promise<string | null> => {
  const [row] = await db
    .delete(loginTokens)
    .where(and(eq(loginTokens.tokenHash, hashToken(token)), gt(loginTokens.expiresAt, new Date())))
    .returning({ email: loginTokens.email })
  return row?.email ?? null
}
