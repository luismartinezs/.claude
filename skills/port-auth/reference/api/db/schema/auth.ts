import { index, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    /** Normalized (trimmed, lower-case). Unique because a verified email is what links identities. */
    email: text("email").notNull(),
    name: text("name").notNull(),
    picture: text("picture"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("accounts_email_idx").on(t.email)],
)

/**
 * One row per way a person signs in. The (provider, subject) pair is the
 * association key: Google's stable `sub`, or the normalized email for magic
 * links. Accounts are never looked up by a provider's email alone.
 */
export const identities = pgTable(
  "identities",
  {
    provider: text("provider", { enum: ["google", "email"] }).notNull(),
    subject: text("subject").notNull(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.subject] }), index("identities_account_idx").on(t.accountId)],
)

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the cookie value. The token itself is never stored. */
    tokenHash: text("token_hash").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_account_idx").on(t.accountId), index("sessions_expires_idx").on(t.expiresAt)],
)

/** Pending magic links. A row is deleted the moment its link is used. */
export const loginTokens = pgTable(
  "login_tokens",
  {
    /** SHA-256 of the token in the emailed link. */
    tokenHash: text("token_hash").primaryKey(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("login_tokens_expires_idx").on(t.expiresAt)],
)
