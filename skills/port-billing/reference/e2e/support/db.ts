import { execFileSync } from "node:child_process"

/**
 * Runs SQL against the dev database through the compose service, so the suite
 * needs no database driver or credentials of its own. Callers pass only values
 * they generated; nothing user-supplied reaches this string.
 */
export const sql = (statement: string): string =>
  execFileSync(
    "docker",
    [
      "compose", "-f", "docker-compose.dev.yml", "--env-file", ".env",
      "exec", "-T", "db", "sh", "-c",
      `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "${statement.replaceAll('"', '\\"')}"`,
    ],
    { encoding: "utf8" },
  ).trim()
