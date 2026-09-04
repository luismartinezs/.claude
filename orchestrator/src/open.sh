#!/usr/bin/env bash
# Start the server if it is not already up, then open the window.
set -uo pipefail
PORT="${ORCHESTRATOR_PORT:-7717}"
URL="http://127.0.0.1:${PORT}"

if ! curl -fsS --max-time 1 "${URL}/api/projects" >/dev/null 2>&1; then
  nohup bun "$HOME/.claude/orchestrator/src/server.ts" \
    > "$HOME/.claude/orchestrator/server.log" 2>&1 &
  for _ in $(seq 1 40); do
    curl -fsS --max-time 1 "${URL}/api/projects" >/dev/null 2>&1 && break
    sleep 0.25
  done
fi

exec google-chrome --app="$URL" --class=Orchestrator \
  --user-data-dir="${XDG_CACHE_HOME:-$HOME/.cache}/orchestrator/window" >/dev/null 2>&1
