#!/usr/bin/env bash
# Claude Code status line.
#
# Three jobs, in order of importance:
#   1. Render the status line.
#   2. Sample .rate_limits into ~/.claude/state/usage.json, so anything running
#      outside a session (the systemd timer) has recent plan-usage numbers even
#      when the OAuth access token has expired.
#   3. Trigger the alert rule engine, throttled and detached so it never blocks
#      a render.
set -uo pipefail

STATE_DIR="$HOME/.claude/state"
CACHE="$STATE_DIR/usage.json"
THROTTLE="$STATE_DIR/usage-alerts/.last-check"
THROTTLE_SECONDS="${CC_USAGE_THROTTLE_SECONDS:-60}"

input=$(cat)

# ---------------------------------------------------------------- render ----
IFS=$'\t' read -r model dir branch_hint ctx p5 p7 <<<"$(jq -r '
  [ (.model.display_name // "?"),
    (.workspace.current_dir // .cwd // "?"),
    (.workspace.git_worktree // "-"),
    (.context_window.used_percentage // "-"),
    (.rate_limits.five_hour.used_percentage // "-"),
    (.rate_limits.seven_day.used_percentage // "-") ]
  | @tsv' <<<"$input" 2>/dev/null)"

branch=$(git -C "$dir" --no-optional-locks branch --show-current 2>/dev/null)
[[ -z "$branch" && "$branch_hint" != "-" ]] && branch="$branch_hint"

DIM=$'\033[2m'; RESET=$'\033[0m'; YEL=$'\033[33m'; RED=$'\033[31m'
sep="${DIM} · ${RESET}"

# Colour a percentage by how close it is to its ceiling.
pct() { # value warn crit label
  local v=$1 warn=$2 crit=$3 label=$4 c=""
  [[ "$v" == "-" ]] && return 0
  v=$(awk -v a="$v" 'BEGIN { printf "%d", a + 0.5 }')
  (( v >= warn )) && c="$YEL"
  (( v >= crit )) && c="$RED"
  printf '%s%s%s %s%d%%%s' "$sep" "$DIM" "$label" "$c" "$v" "$RESET"
}

printf '%s%s' "$DIM" "$model"
printf '%s %s%s' "$RESET" "$DIM" "$(basename "$dir")"
[[ -n "$branch" ]] && printf ' ⎇ %s' "$branch"
printf '%s' "$RESET"
pct "$ctx" 70 90 "ctx"
pct "$p5"  70 85 "5h"
pct "$p7"  75 90 "7d"
printf '\n'

# ----------------------------------------------------- sample and alert ----
# rate_limits only appears for subscribers after the first API response.
usage=$(jq -c '
  select(.rate_limits != null)
  | { five_hour: .rate_limits.five_hour, seven_day: .rate_limits.seven_day,
      sampled_at: now | floor, source: "statusline" }' <<<"$input" 2>/dev/null)
[[ -z "$usage" ]] && exit 0

mkdir -p "$STATE_DIR" "$(dirname "$THROTTLE")" 2>/dev/null
tmp=$(mktemp "$CACHE.XXXXXX" 2>/dev/null) || exit 0
printf '%s\n' "$usage" > "$tmp" && mv -f "$tmp" "$CACHE" || rm -f "$tmp"

now=$(date +%s)
last=0
[[ -f "$THROTTLE" ]] && last=$(stat -c %Y "$THROTTLE" 2>/dev/null || echo 0)
(( now - last < THROTTLE_SECONDS )) && exit 0
touch "$THROTTLE"

( printf '%s\n' "$usage" | "$HOME/.claude/scripts/usage-alerts.sh" >/dev/null 2>&1 & ) >/dev/null 2>&1

exit 0
