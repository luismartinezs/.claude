import { sql } from "./db.ts"

/**
 * Every run signs in several fresh accounts from one IP. Clearing the counters
 * keeps repeated local runs from tripping the production rate limits, which
 * stay unchanged.
 */
export default function globalSetup(): void {
  sql("delete from rate_limits")
}
