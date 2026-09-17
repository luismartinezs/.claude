#!/usr/bin/env bash
# Unit and integration tests. Pass --e2e to also run the Playwright suite (./dev must be running).
set -euo pipefail
cd "$(dirname "$0")"

# Integration tests use the real database, so it must be up and migrated.
docker compose -f docker-compose.dev.yml --env-file .env up -d --wait db > /dev/null
pnpm --filter @pawacook/api db:migrate > /dev/null

pnpm exec vitest run

if [[ "${1:-}" == "--e2e" ]]; then
  pnpm exec playwright test
fi
