import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"

/** Fixed-window counters used by platform/rate-limit.ts. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
})
