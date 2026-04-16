#!/bin/bash
# fetch-permits.sh — Trigger permit-morning-check edge function and capture summary.
# Runs as part of refresh-brain.sh before brief synthesis so permit status
# is included in the CEO morning brief.
# Output: one-line summary to stdout + writes to /tmp/bpp-permit-summary.txt
set -uo pipefail

CREDS="/Users/keygoodson/.claude/credentials.md"
SUPABASE_URL="https://reowtzedjflwmlptupbk.supabase.co"
SERVICE_KEY=$(grep "Service Role Key" "$CREDS" | grep -o "eyJ[A-Za-z0-9._-]*" | head -1)

if [ -z "$SERVICE_KEY" ]; then
  echo "[fetch-permits] ERROR: No service key found" >&2
  exit 1
fi

# Call permit-morning-check — may take up to 2 minutes (Firecrawl scrape)
RESPONSE=$(curl -s --max-time 180 -X POST \
  "$SUPABASE_URL/functions/v1/permit-morning-check" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}')

# Extract the summary field from JSON
SUMMARY=$(echo "$RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('summary', 'No permit summary'))
except:
    print('Permit check failed or timed out')
" 2>/dev/null || echo "Permit check unavailable")

# Write to temp file so synthesize-ceo-brief.sh can read it
echo "$SUMMARY" > /tmp/bpp-permit-summary.txt

echo "[fetch-permits] $SUMMARY"
