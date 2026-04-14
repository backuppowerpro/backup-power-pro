#!/bin/bash
# synthesize-ceo-brief.sh
# Reads all brain data wiki pages, calls Claude API to synthesize into a CEO brief,
# and writes the result to Supabase sparky_memory (key: ceo_morning_brief).
# Runs after all fetch-*.sh scripts complete in refresh-brain.sh
set -uo pipefail

CREDS="/Users/keygoodson/.claude/credentials.md"
WIKI_DIR="/Users/keygoodson/Desktop/CLAUDE/wiki"
TODAY=$(date +%Y-%m-%d)
TS=$(date +%H:%M)

# ── Extract credentials ──
ANTHROPIC_KEY=$(grep -A1 "Anthropic API" "$CREDS" | grep "sk-ant" | grep -o "sk-ant-[A-Za-z0-9_-]*" | head -1)
SUPABASE_URL="https://reowtzedjflwmlptupbk.supabase.co"
SERVICE_KEY=$(grep "Service Role Key" "$CREDS" | grep -o "eyJ[A-Za-z0-9._-]*" | head -1)

if [ -z "$ANTHROPIC_KEY" ]; then
  echo "[synthesize-ceo-brief] ERROR: No Anthropic key found" >&2
  exit 1
fi

# ── Read wiki data pages ──
META_DATA=""
POSTHOG_DATA=""
CRM_DATA=""

[ -f "$WIKI_DIR/Ads/Meta Performance.md" ]    && META_DATA=$(head -80 "$WIKI_DIR/Ads/Meta Performance.md")
[ -f "$WIKI_DIR/Website/Site Analytics.md" ]  && POSTHOG_DATA=$(head -60 "$WIKI_DIR/Website/Site Analytics.md")
[ -f "$WIKI_DIR/CRM/CRM Usage.md" ]           && CRM_DATA=$(head -80 "$WIKI_DIR/CRM/CRM Usage.md")

# ── Build the synthesis prompt ──
PROMPT="You are the operating brain of Backup Power Pro (BPP), a generator inlet installation business in Upstate SC owned by Key Goodson. You run the business day-to-day and surface decisions for Key.

Today is $TODAY. Below is this morning's business data pulled from live sources. Read it all, synthesize it, and produce a CEO Morning Brief — a tight, opinionated summary of where the business stands and what Key should decide or act on TODAY.

Format rules:
- Lead with the 1-2 most important decisions or flags
- Be direct and specific — dollar amounts, percentages, contact names when available
- Never bullet-dump data — translate data into business meaning
- End with 'What I'd tackle first:' and one clear recommendation
- Max 200 words total
- Tone: confident operating partner, not a report

Business context:
- CPL target: <\$30 | Close rate target: 35-40% | Min price: \$1,197
- Stage 3 trigger (hire first sub): when installs exceed solo capacity (currently 2-3/wk, max 5/wk)
- Geography: Greenville, Spartanburg, Pickens counties only

--- META ADS DATA ---
$META_DATA

--- WEBSITE ANALYTICS (PostHog) ---
$POSTHOG_DATA

--- CRM PIPELINE DATA ---
$CRM_DATA"

# ── Call Claude API ──
RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "{
    \"model\": \"claude-haiku-4-5\",
    \"max_tokens\": 400,
    \"messages\": [{
      \"role\": \"user\",
      \"content\": $(echo "$PROMPT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')
    }]
  }")

BRIEF=$(echo "$RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d['content'][0]['text'])
except Exception as e:
    print(f'Brief unavailable: {e}')
")

if [ -z "$BRIEF" ] || echo "$BRIEF" | grep -q "Brief unavailable"; then
  echo "[synthesize-ceo-brief] Claude synthesis failed" >&2
  exit 1
fi

# ── Write to Supabase sparky_memory ──
PAYLOAD=$(python3 -c "
import json
print(json.dumps({
  'key': 'ceo_morning_brief',
  'value': '''$BRIEF''',
  'updated_at': '${TS}:00+00:00'
}))
")

# Upsert (insert or update)
curl -s -X POST "$SUPABASE_URL/rest/v1/sparky_memory" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d "$PAYLOAD" > /dev/null

echo "[synthesize-ceo-brief] CEO brief written to sparky_memory ($TODAY $TS)"
