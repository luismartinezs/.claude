#!/usr/bin/env bash
# Provisions one app's Stripe objects on the shared App Forge Labs account, for
# one mode (test sandbox or live): product, recurring price, the app's own
# Customer Portal configuration and, unless --no-webhook, its webhook endpoint.
#
# Safe to re-run: every object is looked up by the app's metadata first and
# reused; creates carry idempotency keys. It never prints a key or a signing
# secret. It refuses to guess when Stripe already holds something that differs
# from what was asked (a price at another amount, two products, an endpoint
# whose secret was never captured).
#
# The account-wide failed-payment setting has no API; the script ends by
# telling the operator to check it.
#
# Usage (from the target repository root):
#   provision-stripe.sh --env-file .env --key-var STRIPE_SECRET_KEY \
#     --app pawacook --product-key pro --name Pawacook --amount 2900 --currency usd --interval month \
#     --origin https://pawacook.app --api-version 2026-08-26.dahlia \
#     [--webhook-path /api/billing/webhook] [--no-webhook] [--suffix _LIVE] [--out-file .env] [--check]
#
#   --key-var      variable in --env-file holding the (restricted) secret key; read, never printed
#   --suffix       appended to every variable written, e.g. _LIVE while live values wait in a local .env
#   --out-file     where variables are written (default: --env-file)
#   --no-webhook   test mode with `stripe listen`, which prints its own signing secret
#   --check        report what exists and what would be created; change nothing
set -euo pipefail

usage() { sed -n '2,/^set -euo/p' "$0" | sed 's/^# \{0,1\}//;/^set -euo/d'; exit 2; }

ENV_FILE="" KEY_VAR="" APP="" PRODUCT_KEY="" NAME="" AMOUNT="" CURRENCY="" INTERVAL=""
ORIGIN="" API_VERSION="" WEBHOOK_PATH="/api/billing/webhook" NO_WEBHOOK=0 SUFFIX="" OUT_FILE="" CHECK=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file) ENV_FILE=$2; shift 2 ;;
    --key-var) KEY_VAR=$2; shift 2 ;;
    --app) APP=$2; shift 2 ;;
    --product-key) PRODUCT_KEY=$2; shift 2 ;;
    --name) NAME=$2; shift 2 ;;
    --amount) AMOUNT=$2; shift 2 ;;
    --currency) CURRENCY=$2; shift 2 ;;
    --interval) INTERVAL=$2; shift 2 ;;
    --origin) ORIGIN=${2%/}; shift 2 ;;
    --api-version) API_VERSION=$2; shift 2 ;;
    --webhook-path) WEBHOOK_PATH=$2; shift 2 ;;
    --no-webhook) NO_WEBHOOK=1; shift ;;
    --suffix) SUFFIX=$2; shift 2 ;;
    --out-file) OUT_FILE=$2; shift 2 ;;
    --check) CHECK=1; shift ;;
    -h|--help) usage ;;
    *) echo "unknown argument: $1"; usage ;;
  esac
done
for required in ENV_FILE KEY_VAR APP PRODUCT_KEY NAME AMOUNT CURRENCY INTERVAL ORIGIN; do
  [[ -n "${!required}" ]] || { echo "missing --$(tr 'A-Z_' 'a-z-' <<<"$required")"; usage; }
done
[[ $NO_WEBHOOK == 1 || -n "$API_VERSION" ]] || { echo "missing --api-version (the version the installed Stripe SDK pins)"; exit 2; }
[[ "$APP" =~ ^[a-z0-9-]+$ && "$PRODUCT_KEY" =~ ^[a-z0-9_]+$ ]] || { echo "--app and --product-key must be lowercase slugs"; exit 2; }
OUT_FILE=${OUT_FILE:-$ENV_FILE}
command -v jq > /dev/null || { echo "jq is required"; exit 2; }

KEY=$(grep "^${KEY_VAR}=" "$ENV_FILE" | cut -d= -f2- || true)
[[ -n "$KEY" ]] || { echo "$KEY_VAR is empty or missing in $ENV_FILE"; exit 1; }
case "$KEY" in
  sk_live_*|rk_live_*) MODE=live ;;
  sk_test_*|rk_test_*) MODE=test ;;
  *) echo "$KEY_VAR does not look like a Stripe secret or restricted key"; exit 1 ;;
esac

PRICE_VAR="STRIPE_$(tr 'a-z' 'A-Z' <<<"$PRODUCT_KEY")_PRICE_ID${SUFFIX}"
PORTAL_VAR="STRIPE_PORTAL_CONFIGURATION_ID${SUFFIX}"
SECRET_VAR="STRIPE_WEBHOOK_SECRET${SUFFIX}"
WEBHOOK_URL="${ORIGIN}${WEBHOOK_PATH}"
IDEMPOTENCY="${APP}-${PRODUCT_KEY}-${MODE}-${AMOUNT}${CURRENCY}${INTERVAL}"

echo "==> $APP / $PRODUCT_KEY in $MODE mode$([[ $CHECK == 1 ]] && echo ' (check only)')"

stripe_get() { curl -sS -G "https://api.stripe.com/v1/$1" -u "$KEY:" "${@:2}"; }
stripe_post() { curl -sS "https://api.stripe.com/v1/$1" -u "$KEY:" -H "Idempotency-Key: $2" "${@:3}"; }
fail_on_error() {
  local message
  message=$(jq -r '.error.message // empty' <<<"$1")
  [[ -z "$message" ]] || { echo "Stripe refused ($2): $message"; exit 1; }
}

# Writes NAME=value into the out file, replacing an existing line. Values are
# never echoed; callers print the non-secret ones themselves.
write_var() {
  local name=$1 value=$2
  touch "$OUT_FILE"
  if grep -q "^${name}=" "$OUT_FILE"; then
    local tmp; tmp=$(mktemp)
    awk -v n="$name" -v v="$value" 'BEGIN { FS = OFS = "=" } $1 == n { print n "=" v; next } { print }' "$OUT_FILE" > "$tmp"
    cat "$tmp" > "$OUT_FILE"; rm -f "$tmp"
  else
    printf '%s=%s\n' "$name" "$value" >> "$OUT_FILE"
  fi
}

# --- product -----------------------------------------------------------------
products=$(stripe_get products/search --data-urlencode "query=active:'true' AND metadata['app']:'$APP' AND metadata['product_key']:'$PRODUCT_KEY'")
fail_on_error "$products" "product search"
count=$(jq '.data | length' <<<"$products")
if [[ $count -gt 1 ]]; then
  echo "Several active products carry app=$APP product_key=$PRODUCT_KEY:"; jq -r '.data[] | "  \(.id) \(.name)"' <<<"$products"
  echo "Archive the extras in the Dashboard, then re-run."; exit 1
elif [[ $count -eq 1 ]]; then
  PRODUCT_ID=$(jq -r '.data[0].id' <<<"$products"); echo "product   reuse  $PRODUCT_ID"
elif [[ $CHECK == 1 ]]; then
  PRODUCT_ID=""; echo "product   would create \"$NAME\""
else
  created=$(stripe_post products "$IDEMPOTENCY-product" -d name="$NAME" -d "metadata[app]=$APP" -d "metadata[product_key]=$PRODUCT_KEY")
  fail_on_error "$created" "product create"
  PRODUCT_ID=$(jq -r '.id' <<<"$created"); echo "product   create $PRODUCT_ID"
fi

# --- price -------------------------------------------------------------------
PRICE_ID=""
if [[ -n "$PRODUCT_ID" ]]; then
  prices=$(stripe_get prices/search --data-urlencode "query=active:'true' AND product:'$PRODUCT_ID' AND metadata['app']:'$APP' AND metadata['product_key']:'$PRODUCT_KEY'")
  fail_on_error "$prices" "price search"
  PRICE_ID=$(jq -r --argjson amount "$AMOUNT" --arg currency "$CURRENCY" --arg interval "$INTERVAL" \
    '[.data[] | select(.unit_amount == $amount and .currency == $currency and .recurring.interval == $interval)][0].id // empty' <<<"$prices")
  others=$(jq -r --arg id "$PRICE_ID" '[.data[] | select(.id != $id)] | length' <<<"$prices")
  if [[ -z "$PRICE_ID" && $others -gt 0 ]]; then
    echo "The product already has an active tagged price that differs from $AMOUNT $CURRENCY per $INTERVAL:"
    jq -r '.data[] | "  \(.id) \(.unit_amount) \(.currency) per \(.recurring.interval)"' <<<"$prices"
    echo "A price change is a product decision (existing subscribers keep their price). Decide, then re-run."; exit 1
  fi
fi
if [[ -n "$PRICE_ID" ]]; then
  echo "price     reuse  $PRICE_ID"
elif [[ $CHECK == 1 ]]; then
  echo "price     would create $AMOUNT $CURRENCY per $INTERVAL"
else
  created=$(stripe_post prices "$IDEMPOTENCY-price" -d product="$PRODUCT_ID" -d currency="$CURRENCY" -d unit_amount="$AMOUNT" \
    -d "recurring[interval]=$INTERVAL" -d nickname="$NAME $PRODUCT_KEY per $INTERVAL" \
    -d "metadata[app]=$APP" -d "metadata[product_key]=$PRODUCT_KEY")
  fail_on_error "$created" "price create"
  PRICE_ID=$(jq -r '.id' <<<"$created"); echo "price     create $PRICE_ID"
  fail_on_error "$(stripe_post "products/$PRODUCT_ID" "$IDEMPOTENCY-default-price-$PRICE_ID" -d default_price="$PRICE_ID")" "default price"
fi

# --- portal configuration ----------------------------------------------------
# The Dashboard edits only the account's default configuration, shared by every
# app; an app's own configuration exists only through the API.
portals=$(stripe_get billing_portal/configurations -d limit=100)
fail_on_error "$portals" "portal list"
PORTAL_ID=$(jq -r --arg app "$APP" '[.data[] | select(.metadata.app == $app and .active)][0].id // empty' <<<"$portals")
if [[ -n "$PORTAL_ID" ]]; then
  echo "portal    reuse  $PORTAL_ID"
elif [[ $CHECK == 1 ]]; then
  echo "portal    would create (card updates, invoices, cancel at period end; no plan switching)"
else
  created=$(stripe_post billing_portal/configurations "$APP-$MODE-portal-v1" \
    -d name="$NAME" -d "metadata[app]=$APP" \
    -d "business_profile[headline]=$NAME subscription" \
    -d "business_profile[privacy_policy_url]=$ORIGIN/privacy" \
    -d "business_profile[terms_of_service_url]=$ORIGIN/terms" \
    -d "features[payment_method_update][enabled]=true" \
    -d "features[invoice_history][enabled]=true" \
    -d "features[subscription_cancel][enabled]=true" \
    -d "features[subscription_cancel][mode]=at_period_end" \
    -d "features[subscription_cancel][proration_behavior]=none" \
    -d "features[subscription_update][enabled]=false" \
    -d "features[customer_update][enabled]=false")
  fail_on_error "$created" "portal create"
  PORTAL_ID=$(jq -r '.id' <<<"$created"); echo "portal    create $PORTAL_ID"
fi

# --- webhook -----------------------------------------------------------------
WROTE_SECRET=0
if [[ $NO_WEBHOOK == 1 ]]; then
  echo "webhook   skipped (use: stripe listen --forward-to <api>${WEBHOOK_PATH}; it prints the signing secret)"
else
  endpoints=$(stripe_get webhook_endpoints -d limit=100)
  fail_on_error "$endpoints" "webhook list"
  echo "          endpoints on this account: $(jq '.data | length' <<<"$endpoints") of 16 allowed"
  existing=$(jq -c --arg url "$WEBHOOK_URL" '[.data[] | select(.url == $url)]' <<<"$endpoints")
  if [[ $(jq length <<<"$existing") -gt 0 ]]; then
    jq -r '.[] | "webhook   exists \(.id) \(.url) api=\(.api_version) events=\(.enabled_events | join(","))"' <<<"$existing"
    if ! grep -q "^${SECRET_VAR}=." "$OUT_FILE" 2> /dev/null; then
      echo "          $SECRET_VAR is not in $OUT_FILE, and Stripe shows a signing secret only at creation."
      echo "          Roll the endpoint's secret in the Dashboard and store it by hand, or delete the endpoint and re-run."
      exit 1
    fi
  elif [[ $CHECK == 1 ]]; then
    echo "webhook   would create $WEBHOOK_URL (api $API_VERSION)"
  else
    created=$(stripe_post webhook_endpoints "$APP-$MODE-webhook-v1" \
      -d url="$WEBHOOK_URL" -d api_version="$API_VERSION" -d description="$APP-$MODE" -d "metadata[app]=$APP" \
      -d "enabled_events[]=checkout.session.completed" \
      -d "enabled_events[]=customer.subscription.updated" \
      -d "enabled_events[]=customer.subscription.deleted")
    fail_on_error "$created" "webhook create"
    secret=$(jq -r '.secret // empty' <<<"$created")
    [[ -n "$secret" ]] || { echo "Stripe returned no signing secret; it was created by an earlier call with the same idempotency key. Roll the secret in the Dashboard."; exit 1; }
    write_var "$SECRET_VAR" "$secret"; unset secret; WROTE_SECRET=1
    echo "webhook   create $(jq -r '.id' <<<"$created") $WEBHOOK_URL"
  fi
fi

# --- results -----------------------------------------------------------------
if [[ $CHECK == 0 ]]; then
  write_var "$PRICE_VAR" "$PRICE_ID"
  write_var "$PORTAL_VAR" "$PORTAL_ID"
  echo "==> wrote $PRICE_VAR=$PRICE_ID and $PORTAL_VAR=$PORTAL_ID to $OUT_FILE$([[ $WROTE_SECRET == 1 ]] && echo ", and $SECRET_VAR (not printed)")"
fi

cat <<EOF
==> manual, account-wide (no API): Billing > Revenue recovery > Retries in $MODE mode
    "If all retries for a payment fail" must be "cancel the subscription" or
    "mark the subscription as unpaid". "Leave past-due" keeps access forever,
    because past_due grants access. Other apps share this setting.
EOF
