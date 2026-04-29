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
  # Apr 29 fix: bash interpolation was double-quoting embedded single-quotes
  # in HogQL string literals (e.g., 'baseline', 'lead_form_started'), causing
  # the channel + scroll funnel queries to silently return validation errors.
  # PostHog's parser rejected them; the script returned empty results; rendering
  # said "(no channel data)" — making the experimentation funnel BLIND.
  # Fix: build the JSON via Python so single quotes inside string literals are
  # passed through cleanly. Slower (Python startup) but bullet-proof.
  local query="$1"
  local payload
  payload=$(python3 -c "import json,sys; print(json.dumps({'query':{'kind':'HogQLQuery','query':sys.argv[1]}}))" "$query")
  curl -s -X POST "$QUERY_URL" \
    -H "Authorization: Bearer $PH_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload"
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

# 7. Per-channel funnel (pageviews vs form starts vs captures vs delivered)
# Channel is registered on every event via posthog.register() on /m/, /g/,
# /city/*/ pages. Null channel = baseline /index.html traffic.
CHANNEL_QUERY="SELECT coalesce(properties.channel, 'baseline') AS channel,
countIf(event = '\$pageview') AS pageviews,
countIf(event = 'lead_form_started') AS form_starts,
countIf(event = 'lead_captured') AS captures,
countIf(event = 'lead_captured' AND properties.delivered = true) AS delivered,
countIf(event = 'lead_submit_failed') AS failures
FROM events
WHERE timestamp >= now() - INTERVAL 7 DAY
GROUP BY channel
ORDER BY pageviews DESC"
CHANNEL_RESULT=$(run_hogql "$CHANNEL_QUERY")
CHANNEL_BREAKDOWN=$(echo "$CHANNEL_RESULT" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    rows=[]
    for r in (d.get('results') or []):
        channel=str(r[0])
        pv,fs,cap,delv,fail=r[1],r[2],r[3],r[4],r[5]
        # Funnel percents
        fs_pct=f'{round(fs/pv*100,1)}%' if pv else '—'
        cap_pct=f'{round(cap/pv*100,1)}%' if pv else '—'
        delv_pct=f'{round(delv/cap*100,1)}%' if cap else '—'
        rows.append(f'| {channel} | {pv} | {fs} ({fs_pct}) | {cap} ({cap_pct}) | {delv} ({delv_pct}) | {fail} |')
    print('\n'.join(rows) if rows else '| (no channel data) | - | - | - | - | - |')
except Exception as e:
    print(f'| (error: {e}) | - | - | - | - | - |')
")

# 8. Scroll-depth dropoff per channel (lead_scroll_depth events)
SCROLL_QUERY="SELECT coalesce(properties.channel, 'baseline') AS channel,
countIf(properties.depth = 25) AS d25,
countIf(properties.depth = 50) AS d50,
countIf(properties.depth = 75) AS d75,
countIf(properties.depth = 100) AS d100
FROM events
WHERE event = 'lead_scroll_depth' AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY channel
ORDER BY d25 DESC"
SCROLL_RESULT=$(run_hogql "$SCROLL_QUERY")
SCROLL_BREAKDOWN=$(echo "$SCROLL_RESULT" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    rows=[]
    for r in (d.get('results') or []):
        channel=str(r[0])
        d25,d50,d75,d100=r[1],r[2],r[3],r[4]
        rows.append(f'| {channel} | {d25} | {d50} | {d75} | {d100} |')
    print('\n'.join(rows) if rows else '| (no scroll data) | - | - | - | - |')
except Exception as e:
    print(f'| (error: {e}) | - | - | - | - |')
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

## Per-Channel Funnel (last 7d)

Channel is registered on every event for /m/ (meta), /g/ (google), and /city/*/ (organic) pages. 'baseline' is the default / organic / direct traffic to /index.html.

| Channel | Pageviews | Form Starts | Captures | Delivered | Failures |
|---------|-----------|-------------|----------|-----------|----------|
$CHANNEL_BREAKDOWN

**How to read:** captures % = form completions / pageviews. Delivered % = how many of those captures actually landed in Supabase. A gap between captures and delivered means the resilient-submit path is having issues — investigate \`lead_submit_failed\` events.

## Scroll Depth — where users bail

Only fires on pages with the instrumentation (/m/, /g/, /city/*/). Higher counts at lower depths = user stopped reading early.

| Channel | 25% | 50% | 75% | 100% |
|---------|-----|-----|-----|------|
$SCROLL_BREAKDOWN

**How to read:** if 25% > 50% by a large margin, the first screen isn't hooking them. If 75% → 100% drops sharply, the bottom of the page is boring or the CTA isn't compelling.

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
