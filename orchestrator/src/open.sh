#!/usr/bin/env bash
# Start the server if it is not already up, then open the window.
#
# A desktop launcher starts with a bare PATH, not the one from the shell
# profile, so bun, claude and wezterm are all invisible unless we say where
# they live. The server passes this environment down to everything it spawns.
set -uo pipefail
export PATH="$HOME/.bun/bin:$HOME/.local/bin:$HOME/bin:/usr/local/bin:$PATH"
BUN="$(command -v bun || echo "$HOME/.bun/bin/bun")"
PORT="${ORCHESTRATOR_PORT:-7717}"
URL="http://127.0.0.1:${PORT}"

if ! curl -fsS --max-time 1 "${URL}/api/projects" >/dev/null 2>&1; then
  nohup "$BUN" "$HOME/.claude/orchestrator/src/server.ts" \
    > "$HOME/.claude/orchestrator/server.log" 2>&1 &
  for _ in $(seq 1 40); do
    curl -fsS --max-time 1 "${URL}/api/projects" >/dev/null 2>&1 && break
    sleep 0.25
  done
fi

exec google-chrome --app="$URL" --class=Orchestrator \
  --user-data-dir="${XDG_CACHE_HOME:-$HOME/.cache}/orchestrator/window" >/dev/null 2>&1
