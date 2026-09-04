#!/usr/bin/env bash
# Feeds the alert rule engine when no Claude Code session is running.
#
# Prefers a live read of the plan-usage endpoint. That needs the OAuth access
# token Claude Code stores, which is short-lived (~8h), so on any failure this
# falls back to the sample the status line last wrote. Stale cache is safe here:
# if you have not been using Claude Code, your utilization has not moved, and
# the rule engine ignores windows whose resets_at has already passed.
set -uo pipefail

CREDS="$HOME/.claude/.credentials.json"
CACHE="$HOME/.claude/state/usage.json"
ENDPOINT="https://api.anthropic.com/api/oauth/usage"

# ISO 8601 (with fractional seconds and offset) -> epoch seconds, or "null".
to_epoch() {
  [[ -z "$1" || "$1" == "null" ]] && { printf 'null'; return; }
  date -d "$1" +%s 2>/dev/null || printf 'null'
}

fetch_live() {
  [[ -r "$CREDS" ]] || return 1
  local token body code
  token=$(jq -r '.claudeAiOauth.accessToken // empty' "$CREDS" 2>/dev/null)
  [[ -n "$token" ]] || return 1

  body=$(curl -sS --max-time 10 -w '\n%{http_code}' \
    -H "Authorization: Bearer $token" -H "Content-Type: application/json" \
    "$ENDPOINT" 2>/dev/null) || return 1
  code=$(tail -n1 <<<"$body")
  body=$(sed '$d' <<<"$body")
  [[ "$code" == "200" ]] || return 1

  local r5 r7
  r5=$(to_epoch "$(jq -r '.five_hour.resets_at // "null"' <<<"$body" 2>/dev/null)")
  r7=$(to_epoch "$(jq -r '.seven_day.resets_at // "null"' <<<"$body" 2>/dev/null)")

  jq -c --argjson r5 "$r5" --argjson r7 "$r7" '
    { five_hour: (if .five_hour and $r5 != null
                  then {used_percentage: .five_hour.utilization, resets_at: $r5}
                  else null end),
      seven_day: (if .seven_day and $r7 != null
                  then {used_percentage: .seven_day.utilization, resets_at: $r7}
                  else null end),
      sampled_at: (now | floor), source: "api" }' <<<"$body" 2>/dev/null
}

usage=$(fetch_live)

if [[ -n "${usage:-}" ]]; then
  # A live read beats whatever the status line last sampled.
  tmp=$(mktemp "$CACHE.XXXXXX" 2>/dev/null) \
    && printf '%s\n' "$usage" > "$tmp" && mv -f "$tmp" "$CACHE" || rm -f "${tmp:-}"
elif [[ -r "$CACHE" ]]; then
  usage=$(cat "$CACHE")
else
  exit 0
fi

printf '%s\n' "$usage" | "$HOME/.claude/scripts/usage-alerts.sh"
