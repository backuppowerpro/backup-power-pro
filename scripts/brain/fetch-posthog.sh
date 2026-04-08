#!/bin/bash
# fetch-posthog.sh — Pull marketing site analytics from PostHog project 356571
# Source: https://us.posthog.com — BPP marketing site (index.html, get-quote.html, guide.html)
# Output: wiki/Website/Site Analytics.md (overwritten + appended log)
set -e

CREDS="/Users/keygoodson/.claude/credentials.md"
WIKI_PAGE="/Users/keygoodson/Desktop/CLAUDE/wiki/Website/Site Analytics.md"
POSTHOG_HOST="https://us.posthog.com"
PROJECT_ID="356571"
TODAY=$(date +%Y-%m-%d)
TS=$(date +%Y-%m-%d\ %H:%M)

# Extract PostHog personal API key
PH_KEY=$(grep -A1 "Personal API Key (BPPDailyReport)" "$CREDS" | grep -o "phx_[A-Za-z0-9]*" | head -1)
if [ -z "$PH_KEY" ]; then
  echo "ERROR: Could not find PostHog personal API key in $CREDS" >&2
  exit 1
fi

QUERY_URL="$POSTHOG_HOST/api/projects/$PROJECT_ID/query/"

run_hogql() {
  local query="$1"
  curl -s -X POST "$QUERY_URL" \
    -H "Authorization: Bearer $PH_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"query\":{\"kind\":\"HogQLQuery\",\"query\":\"$query\"}}"
}

# 1. Total pageviews last 7d
PV_QUERY="SELECT count() FROM events WHERE event='\$pageview' AND timestamp >= now() - INTERVAL 7 DAY"
PV_RESULT=$(run_hogql "$PV_QUERY")
TOTAL_PV=$(echo "$PV_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('results',[['0']])[0][0] if d.get('results') else '0')" 2>/dev/null || echo "0")

# 2. Unique visitors last 7d
UV_QUERY="SELECT count(DISTINCT distinct_id) FROM events WHERE event='\$pageview' AND timestamp >= now() - INTERVAL 7 DAY"
UV_RESULT=$(run_hogql "$UV_QUERY")
UNIQ_VISITORS=$(echo "$UV_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('results',[['0']])[0][0] if d.get('results') else '0')" 2>/dev/null || echo "0")

# 3. Top 10 pages last 7d
TOP_QUERY="SELECT properties.\$pathname AS path, count() AS views FROM events WHERE event='\$pageview' AND timestamp >= now() - INTERVAL 7 DAY GROUP BY path ORDER BY views DESC LIMIT 10"
TOP_RESULT=$(run_hogql "$TOP_QUERY")
TOP_PAGES=$(echo "$TOP_RESULT" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    rows=[]
    for r in (d.get('results') or []):
        path=str(r[0])[:50] if r[0] else '(unknown)'
        views=r[1]
        rows.append(f'| {path} | {views} |')
    print('\n'.join(rows) if rows else '| (no data) | - |')
except Exception as e:
    print(f'| (error: {e}) | - |')
")

# 4. Lead form submissions last 7d (lead_captured event)
LEAD_QUERY="SELECT count() FROM events WHERE event='lead_captured' AND timestamp >= now() - INTERVAL 7 DAY"
LEAD_RESULT=$(run_hogql "$LEAD_QUERY")
LEAD_COUNT=$(echo "$LEAD_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('results',[['0']])[0][0] if d.get('results') else '0')" 2>/dev/null || echo "0")

# 5. Top referrers last 7d
REF_QUERY="SELECT properties.\$referring_domain AS ref, count() FROM events WHERE event='\$pageview' AND timestamp >= now() - INTERVAL 7 DAY AND properties.\$referring_domain IS NOT NULL AND properties.\$referring_domain != '' GROUP BY ref ORDER BY count() DESC LIMIT 5"
REF_RESULT=$(run_hogql "$REF_QUERY")
TOP_REFS=$(echo "$REF_RESULT" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    rows=[]
    for r in (d.get('results') or []):
        ref=str(r[0])[:40] if r[0] else '(direct)'
        cnt=r[1]
        rows.append(f'| {ref} | {cnt} |')
    print('\n'.join(rows) if rows else '| (no referrer data) | - |')
except Exception as e:
    print(f'| (error: {e}) | - |')
")

# 6. Device breakdown last 7d
DEV_QUERY="SELECT properties.\$device_type AS device, count() FROM events WHERE event='\$pageview' AND timestamp >= now() - INTERVAL 7 DAY GROUP BY device ORDER BY count() DESC"
DEV_RESULT=$(run_hogql "$DEV_QUERY")
DEV_BREAKDOWN=$(echo "$DEV_RESULT" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    rows=[]
    for r in (d.get('results') or []):
        dev=str(r[0]) if r[0] else '(unknown)'
        cnt=r[1]
        rows.append(f'| {dev} | {cnt} |')
    print('\n'.join(rows) if rows else '| (no data) | - |')
except Exception as e:
    print(f'| (error: {e}) | - |')
")

# Conversion rate = lead_captured / unique visitors
CONV_RATE=$(python3 -c "
uv=int('$UNIQ_VISITORS' or 0)
lc=int('$LEAD_COUNT' or 0)
if uv > 0:
    print(f'{round(lc/uv*100, 2)}%')
else:
    print('N/A')
")

# Write the wiki page
cat > "$WIKI_PAGE" <<EOF
---
title: Website Analytics
branch: Website
type: analysis
updated: $TODAY
tags: [website, analytics, posthog, data, auto-updated]
---

# Website Analytics — Last 7 Days

> **Auto-updated daily** by \`scripts/brain/fetch-posthog.sh\`. Last refresh: **$TS**. Pulled from PostHog project 356571 (backuppowerpro.com marketing site). Covers landing page, quote form, guide page. For strategy see [[Website/Website Overview]]. For why this exists see [[Operations/Data Intelligence]].

## Traffic Summary

| Metric | Value |
|--------|-------|
| **Pageviews** | $TOTAL_PV |
| **Unique Visitors** | $UNIQ_VISITORS |
| **Lead Form Submits** | $LEAD_COUNT |
| **Conversion Rate** | $CONV_RATE |

## Top 10 Pages by Views

| Page | Views |
|------|-------|
$TOP_PAGES

## Top Referrers

| Referrer | Visits |
|----------|--------|
$TOP_REFS

## Device Breakdown

| Device | Views |
|--------|-------|
$DEV_BREAKDOWN

## What to Watch

- **Conversion rate dropping?** Check if the quote form is broken or if messaging regressed. Run \`curl -I https://backuppowerpro.com/get-quote.html\` to confirm 200.
- **Pageviews up but leads flat?** Messaging issue. Test a different value prop or urgency angle.
- **High traffic to a non-converting page?** Opportunity to add a CTA.
- **Mobile-heavy traffic?** Mobile-first CRO wins matter more.

## Connected Pages

- [[Website/Website Overview]] — site structure and pages
- [[Operations/Data Intelligence]] — data hub (why this page exists)
- [[Ads/Meta Performance]] — ad spend that drives this traffic
- [[BPP/Growth Ideas]] — experiments to run based on this data
- [[00 Home]] — master dashboard
EOF

echo "[fetch-posthog] Wrote $WIKI_PAGE — pv=$TOTAL_PV uv=$UNIQ_VISITORS leads=$LEAD_COUNT conv=$CONV_RATE"
