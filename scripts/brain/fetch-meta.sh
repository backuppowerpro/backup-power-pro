#!/bin/bash
# fetch-meta.sh — Pull Meta Ads performance for last 7 days and write to wiki
# Source: Meta Graph API v21.0 / Ad account act_923542753352966
# Output: wiki/Ads/Meta Performance.md (overwritten each run + appended log entry)
set -e

CREDS="/Users/keygoodson/.claude/credentials.md"
WIKI_PAGE="/Users/keygoodson/Desktop/CLAUDE/wiki/Ads/Meta Performance.md"
ACCOUNT_ID="act_923542753352966"
API_BASE="https://graph.facebook.com/v21.0"
TODAY=$(date +%Y-%m-%d)
TS=$(date +%Y-%m-%d\ %H:%M)

# Extract Meta token from credentials file
# The credentials format is `- **Token**: EAAUE7r3N3Z...`
TOKEN=$(grep -oE '\*\*Token\*\*: EAA[A-Za-z0-9]+' "$CREDS" | head -1 | sed 's/\*\*Token\*\*: //')
if [ -z "$TOKEN" ]; then
  echo "ERROR: Could not find Meta token in $CREDS" >&2
  exit 1
fi

# Account-level insights, last 7 days
ACCT_JSON=$(curl -s "$API_BASE/$ACCOUNT_ID/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,actions,cost_per_action_type&date_preset=last_7d&access_token=$TOKEN")

# Campaign-level insights, last 7 days
CAMP_JSON=$(curl -s "$API_BASE/$ACCOUNT_ID/insights?level=campaign&fields=campaign_name,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type&date_preset=last_7d&access_token=$TOKEN")

# Ad-level insights, last 7 days (top performers)
AD_JSON=$(curl -s "$API_BASE/$ACCOUNT_ID/insights?level=ad&fields=ad_name,campaign_name,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type&date_preset=last_7d&limit=25&access_token=$TOKEN")

# Parse account totals
ACCT_SPEND=$(echo "$ACCT_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(round(float(d['data'][0].get('spend','0')),2) if d.get('data') else '0')")
ACCT_IMPR=$(echo "$ACCT_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"{int(d['data'][0].get('impressions','0')):,}\" if d.get('data') else '0')")
ACCT_CLICKS=$(echo "$ACCT_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"{int(d['data'][0].get('clicks','0')):,}\" if d.get('data') else '0')")
ACCT_CTR=$(echo "$ACCT_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(round(float(d['data'][0].get('ctr','0')),2) if d.get('data') else '0')")
ACCT_CPC=$(echo "$ACCT_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(round(float(d['data'][0].get('cpc','0')),2) if d.get('data') else '0')")

# Find lead count + CPL from actions array
ACCT_LEADS=$(echo "$ACCT_JSON" | python3 -c "
import sys,json
d=json.load(sys.stdin)
leads=0
if d.get('data'):
    for a in (d['data'][0].get('actions') or []):
        if a.get('action_type') in ('lead','onsite_conversion.lead_grouped','offsite_conversion.fb_pixel_lead'):
            leads += int(float(a.get('value','0')))
print(leads)
")

ACCT_CPL=$(echo "$ACCT_JSON" | python3 -c "
import sys,json
d=json.load(sys.stdin)
cpl='N/A'
if d.get('data'):
    for a in (d['data'][0].get('cost_per_action_type') or []):
        if a.get('action_type') in ('lead','onsite_conversion.lead_grouped','offsite_conversion.fb_pixel_lead'):
            cpl='\$' + str(round(float(a.get('value','0')),2))
            break
print(cpl)
")

# Campaign breakdown
CAMP_TABLE=$(echo "$CAMP_JSON" | python3 -c "
import sys,json
d=json.load(sys.stdin)
rows=[]
for c in (d.get('data') or []):
    name=c.get('campaign_name','?')
    spend='\$' + str(round(float(c.get('spend','0')),2))
    clicks=c.get('clicks','0')
    cpl='N/A'
    leads=0
    for a in (c.get('actions') or []):
        if a.get('action_type') in ('lead','onsite_conversion.lead_grouped','offsite_conversion.fb_pixel_lead'):
            leads += int(float(a.get('value','0')))
    for a in (c.get('cost_per_action_type') or []):
        if a.get('action_type') in ('lead','onsite_conversion.lead_grouped','offsite_conversion.fb_pixel_lead'):
            cpl='\$' + str(round(float(a.get('value','0')),2))
            break
    rows.append(f'| {name[:40]} | {spend} | {clicks} | {leads} | {cpl} |')
if not rows:
    rows=['| (no campaign data returned) | - | - | - | - |']
print('\n'.join(rows))
")

# Top ads by leads
AD_TABLE=$(echo "$AD_JSON" | python3 -c "
import sys,json
d=json.load(sys.stdin)
ads=[]
for a in (d.get('data') or []):
    leads=0
    cpl_val=None
    for act in (a.get('actions') or []):
        if act.get('action_type') in ('lead','onsite_conversion.lead_grouped','offsite_conversion.fb_pixel_lead'):
            leads += int(float(act.get('value','0')))
    for act in (a.get('cost_per_action_type') or []):
        if act.get('action_type') in ('lead','onsite_conversion.lead_grouped','offsite_conversion.fb_pixel_lead'):
            cpl_val=round(float(act.get('value','0')),2)
            break
    ads.append({
        'name': a.get('ad_name','?')[:45],
        'camp': a.get('campaign_name','?')[:25],
        'spend': round(float(a.get('spend','0')),2),
        'leads': leads,
        'cpl': cpl_val
    })
# Sort by leads desc, then CPL asc
ads.sort(key=lambda x: (-x['leads'], x['cpl'] if x['cpl'] is not None else 9999))
rows=[]
for a in ads[:10]:
    cpl_str = '\$' + str(a['cpl']) if a['cpl'] is not None else 'N/A'
    rows.append(f'| {a[\"name\"]} | {a[\"camp\"]} | \${a[\"spend\"]} | {a[\"leads\"]} | {cpl_str} |')
if not rows:
    rows=['| (no ad data) | - | - | - | - |']
print('\n'.join(rows))
")

# Write the wiki page
cat > "$WIKI_PAGE" <<EOF
---
title: Meta Ads Performance
branch: Ads
type: analysis
updated: $TODAY
tags: [meta, ads, performance, data, auto-updated]
---

# Meta Ads Performance — Last 7 Days

> **Auto-updated daily** by \`scripts/brain/fetch-meta.sh\`. Last refresh: **$TS**. Snapshot of spend, leads, and CPL across campaigns and top ads. For strategy see [[Ads/Meta Ads]]. For why this exists see [[Operations/Data Intelligence]].

## Account Totals (Last 7 Days)

| Metric | Value |
|--------|-------|
| **Spend** | \$$ACCT_SPEND |
| **Impressions** | $ACCT_IMPR |
| **Clicks** | $ACCT_CLICKS |
| **CTR** | ${ACCT_CTR}% |
| **CPC** | \$$ACCT_CPC |
| **Leads** | $ACCT_LEADS |
| **CPL** | $ACCT_CPL |

**Target CPL**: <\$30. **Current**: $ACCT_CPL.

## Campaign Breakdown

| Campaign | Spend (7d) | Clicks | Leads | CPL |
|----------|-----------|--------|-------|-----|
$CAMP_TABLE

## Top 10 Ads by Leads

| Ad Name | Campaign | Spend | Leads | CPL |
|---------|----------|-------|-------|-----|
$AD_TABLE

## Connected Pages

- [[Ads/Meta Ads]] — full Meta Ads strategy and history
- [[Ads/Ad Creative + Copy]] — creative library
- [[Operations/Data Intelligence]] — data hub (why this page exists)
- [[BPP/Growth Ideas]] — experiments to test based on this data
- [[00 Home]] — master dashboard
EOF

echo "[fetch-meta] Wrote $WIKI_PAGE — spend=\$$ACCT_SPEND leads=$ACCT_LEADS CPL=$ACCT_CPL"
