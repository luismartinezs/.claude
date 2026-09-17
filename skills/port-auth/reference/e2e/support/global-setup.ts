import { execFileSync } from "node:child_process"

/**
 * Every run signs in several fresh accounts from one IP. Clearing the counters
 * keeps repeated local runs from tripping the production rate limits, which
 * stay unchanged.
 */
export default function globalSetup(): void {
  execFileSync(
    "docker",
    [
      "compose", "-f", "docker-compose.dev.yml", "--env-file", ".env",
      "exec", "-T", "db", "sh", "-c",
      'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "delete from rate_limits"',
    ],
    { stdio: "ignore" },
  )
}
