#!/usr/bin/env bash
# Send a test SMS via Vonage Messages API (Basic auth).
# Do not commit API secrets. Set variables in your shell or a local .env (not tracked).
#
# Usage (Git Bash, macOS, Linux):
#   export VONAGE_API_KEY='your_api_key'
#   export VONAGE_API_SECRET='your_api_secret'
#   export SMS_TO='14693887541'
#   export VONAGE_SMS_FROM='Vonage APIs'
#   bash scripts/send-sms.sh
#
# Windows PowerShell uses different syntax — see scripts/send-sms.ps1
#
# https://developer.vonage.com/en/messages/overview

set -euo pipefail

VONAGE_API_KEY="${VONAGE_API_KEY:?Set VONAGE_API_KEY (see Vonage API Settings)}"
VONAGE_API_SECRET="${VONAGE_API_SECRET:?Set VONAGE_API_SECRET (never commit this)}"
SMS_TO="${SMS_TO:?Set SMS_TO to the destination in E.164, e.g. 14693887541}"
VONAGE_SMS_FROM="${VONAGE_SMS_FROM:-Vonage APIs}"
SMS_BODY="${SMS_BODY:-This is an SMS text message sent using the Vonage Messages API.}"

# JSON-escape backslashes and double quotes in the message body
escape_json() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

BODY="$(printf '%s' "{
  \"to\": \"$(escape_json "$SMS_TO")\",
  \"from\": \"$(escape_json "$VONAGE_SMS_FROM")\",
  \"channel\": \"sms\",
  \"message_type\": \"text\",
  \"text\": \"$(escape_json "$SMS_BODY")\"
}")"

curl -X POST 'https://api.nexmo.com/v1/messages' \
  -u "${VONAGE_API_KEY}:${VONAGE_API_SECRET}" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d "${BODY}"

printf '\n'
