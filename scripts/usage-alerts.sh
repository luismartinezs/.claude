#!/usr/bin/env bash
# Claude-specific settings for the shared usage alert rules.
set -euo pipefail
export USAGE_ALERT_LABEL="${CC_USAGE_LABEL:-Claude Code}"
export USAGE_ALERT_STATE_DIR="${CC_USAGE_STATE_DIR:-$HOME/.claude/state/usage-alerts}"
export USAGE_ALERT_DRY_RUN="${CC_USAGE_DRY_RUN:-0}"
export USAGE_ALERT_5H_PCT="${CC_USAGE_5H_PCT:-85}"
export USAGE_ALERT_7D_PCT="${CC_USAGE_7D_PCT:-90}"
export USAGE_ALERT_7D_PACE_GRACE="${CC_USAGE_7D_PACE_GRACE:-3}"
if [[ -n "${CC_NTFY_TOPIC:-}" ]]; then export USAGE_ALERT_NTFY_TOPIC="$CC_NTFY_TOPIC"; fi
exec bash "$HOME/bin/usage-alerts/usage-alerts.sh"
