#!/usr/bin/env bash
# Rule engine for Claude Code plan-usage alerts.
#
# Reads normalized usage JSON on stdin:
#   {"five_hour": {"used_percentage": N, "resets_at": EPOCH_SECONDS},
#    "seven_day": {"used_percentage": N, "resets_at": EPOCH_SECONDS}}
# Either window may be absent or null.
#
# Fires at most one notification per rule per window, latched on the window's
# resets_at so a new window re-arms the rule automatically.
set -uo pipefail

TOPIC="${CC_NTFY_TOPIC:-cc-luis-v5qkiuu73pl69jdq}"
FIVE_HOUR_PCT="${CC_USAGE_5H_PCT:-85}"
WEEKLY_PCT="${CC_USAGE_7D_PCT:-90}"
WEEKLY_LEAD_HOURS="${CC_USAGE_7D_LEAD_HOURS:-24}"
STATE_DIR="${CC_USAGE_STATE_DIR:-$HOME/.claude/state/usage-alerts}"
DRY_RUN="${CC_USAGE_DRY_RUN:-0}"

mkdir -p "$STATE_DIR" || exit 0
now=$(date +%s)

# Drop latches older than 14 days so the directory does not grow forever.
find "$STATE_DIR" -maxdepth 1 -type f -mtime +14 -delete 2>/dev/null

latched()  { [[ -f "$STATE_DIR/$1" ]]; }
latch()    { : > "$STATE_DIR/$1"; }
num()      { [[ "$1" =~ ^-?[0-9]+([.][0-9]+)?$ ]]; }
gte()      { awk -v a="$1" -v b="$2" 'BEGIN { exit !(a >= b) }'; }
lt()       { awk -v a="$1" -v b="$2" 'BEGIN { exit !(a <  b) }'; }
round()    { awk -v a="$1" 'BEGIN { printf "%d", (a < 0 ? a - 0.5 : a + 0.5) }'; }
at()       { date -d "@$1" +'%a %H:%M' 2>/dev/null; }

# The server recomputes resets_at per request and it jitters by a fraction of a
# second, which can flip the epoch value and mint a second latch key for the
# same window. Bucket to 5 minutes so a window has one stable key.
bucket()   { awk -v a="$1" 'BEGIN { printf "%d", int((a + 150) / 300) }'; }

notify() { # title body priority tags
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '[dry-run] %s | %s (priority=%s tags=%s)\n' "$1" "$2" "$3" "$4"
    return 0
  fi
  curl -fsS --max-time 10 \
    -H "Title: $1" -H "Priority: $3" -H "Tags: $4" \
    -d "$2" "https://ntfy.sh/$TOPIC" >/dev/null 2>&1 || true
}

payload=$(cat)
[[ -z "$payload" ]] && exit 0

IFS=$'\t' read -r p5 r5 p7 r7 <<<"$(jq -r '
  [ (.five_hour.used_percentage // "-"), (.five_hour.resets_at // "-"),
    (.seven_day.used_percentage // "-"), (.seven_day.resets_at // "-") ]
  | @tsv' <<<"$payload" 2>/dev/null)"

# Rule 1: the 5-hour session window is close to its limit.
if num "${p5:-}" && num "${r5:-}" && (( r5 > now )) && gte "$p5" "$FIVE_HOUR_PCT"; then
  key="5h-$(bucket "$r5")"
  if ! latched "$key"; then
    latch "$key"
    mins=$(( (r5 - now) / 60 ))
    (( mins < 0 )) && mins=0
    notify \
      "5h limit at $(round "$p5")%" \
      "Session window resets $(at "$r5") (in ${mins}m). Threshold ${FIVE_HOUR_PCT}%." \
      high warning
  fi
fi

# Rule 2: the weekly window is about to reset with quota left unspent.
if num "${p7:-}" && num "${r7:-}" && lt "$p7" "$WEEKLY_PCT"; then
  left=$(( r7 - now ))
  if (( left > 0 && left <= WEEKLY_LEAD_HOURS * 3600 )); then
    key="7d-underuse-$(bucket "$r7")"
    if ! latched "$key"; then
      latch "$key"
      hours=$(( left / 3600 ))
      unused=$(awk -v p="$p7" 'BEGIN { printf "%d", 100 - p + 0.5 }')
      notify \
        "Weekly quota resets in ${hours}h" \
        "At $(round "$p7")% with ${unused}% unused. Resets $(at "$r7")." \
        default hourglass
    fi
  fi
fi

exit 0
