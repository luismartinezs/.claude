import { sql } from "drizzle-orm"
import { db } from "./db.ts"
import { log } from "./logger.ts"

export type RateLimit = { limit: number; windowSeconds: number }

/**
 * Fixed-window counter in PostgreSQL: one upsert that either starts a new
 * window or increments the current one, atomically under concurrency.
 * Returns true when the caller is over the limit.
 */
export const isRateLimited = async (key: string, rule: RateLimit): Promise<boolean> => {
  const rows = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, window_start, count)
    values (${key}, now(), 1)
    on conflict (key) do update set
      count = case
        when rate_limits.window_start < now() - make_interval(secs => ${rule.windowSeconds}) then 1
        else rate_limits.count + 1
      end,
      window_start = case
        when rate_limits.window_start < now() - make_interval(secs => ${rule.windowSeconds}) then now()
        else rate_limits.window_start
      end
    returning count
  `)
  const count = Number(rows[0]?.count ?? 0)
  if (count > rule.limit) {
    // The key's prefix names the bucket; the rest may be an IP or an email hash, which stay out of logs.
    log.warn("rate_limit.exceeded", { bucket: key.split(":")[0] })
    return true
  }
  return false
}

/** Windows older than a day are dead weight; callers on write paths prune them occasionally. */
export const pruneRateLimits = async (): Promise<void> => {
  await db.execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`)
}
