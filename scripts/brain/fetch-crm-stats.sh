#!/bin/bash
# fetch-crm-stats.sh — Pull CRM/pipeline stats from Supabase and write to wiki
#
# Source: /functions/v1/crm-stats edge function (RLS-bypassing rollups, auth
# via publishable key). Replaces the prior direct-PostgREST query that needed
# the rotated service-role JWT.
#
# Output: wiki/CRM/CRM Usage.md (overwritten)
set -e

WIKI_PAGE="/Users/keygoodson/Desktop/CLAUDE/wiki/CRM/CRM Usage.md"
ENDPOINT="https://reowtzedjflwmlptupbk.supabase.co/functions/v1/crm-stats"
PUB_KEY="sb_publishable_4tYd9eFAYCTjnoKl1hbBBg_yyO9-vMB"
CREDS="/Users/keygoodson/.claude/credentials.md"
TODAY=$(date +%Y-%m-%d)
TS=$(date "+%Y-%m-%d %H:%M")

# 32-byte brain token authenticates this script to the crm-stats edge
# function. The publishable key alone is NOT enough — it's in every
# page of the public website, so it's not really a secret. The brain
# token lives only in credentials.md + supabase secrets.
BRAIN_TOKEN=$(grep -E 'BPP_BRAIN_TOKEN|brain[-_]token' "$CREDS" | grep -oE '[0-9a-f]{64}' | head -1)
if [ -z "$BRAIN_TOKEN" ]; then
  echo "ERROR: BPP_BRAIN_TOKEN missing from $CREDS" >&2
  exit 1
fi

JSON=$(curl -s -f "$ENDPOINT" \
  -H "Authorization: Bearer $PUB_KEY" \
  -H "x-bpp-brain-token: $BRAIN_TOKEN") || {
  echo "ERROR: crm-stats endpoint failed" >&2
  exit 1
}

# Parse the JSON rollup into shell vars + ready-to-write tables.
ANALYSIS=$(python3 <<PYEOF
import json, sys

d = json.loads('''$JSON''')
STAGES = {
  1: 'New Lead', 2: 'Quoted', 3: 'Booked', 4: 'Permit Filed',
  5: 'Permit Approved', 6: 'Materials Ordered', 7: 'Installed',
  8: 'Inspected', 9: 'Complete',
}

stage_rows = []
for s in sorted(d.get('stages', {}).keys(), key=int):
    n = d['stages'][s]
    label = STAGES.get(int(s), 'Stage ' + str(s))
    stage_rows.append(f"| {label} (stage {s}) | {n} |")
stage_table = '\n'.join(stage_rows) if stage_rows else '| (no active leads) | - |'

# Sender table from msgs counts
total_out = d.get('msgs_7d_outbound', 0)
alex_out  = d.get('msgs_7d_alex', 0)
key_out   = d.get('msgs_7d_key', 0)
other_out = max(0, total_out - alex_out - key_out)
sender_rows = [f"| ai (alex) | {alex_out} |", f"| key | {key_out} |"]
if other_out:
    sender_rows.append(f"| other | {other_out} |")
sender_table = '\n'.join(sender_rows)

print(f"ACTIVE={d.get('active_contacts', 0)}")
print(f"ARCHIVED={d.get('archived_contacts', 0)}")
print(f"DNC={d.get('dnc_contacts', 0)}")
print(f"TOTAL={d.get('total_contacts', 0)}")
print(f"PIPELINE_DOLLARS={d.get('pipeline_value', 0)}")
print(f"AVG_QUOTE={d.get('avg_quote', 0)}")
print(f"WON_VALUE_30D={d.get('won_value_30d', 0)}")
print(f"WON_30D={d.get('won_leads_30d', 0)}")
print(f"AI_ON={d.get('ai_enabled_count', 0)}")
print(f"INBOUND_7D={d.get('msgs_7d_inbound', 0)}")
print(f"OUTBOUND_7D={d.get('msgs_7d_outbound', 0)}")
print(f"CALLS_7D={d.get('calls_7d', 0)}")
print(f"NEW_LEADS_30D={d.get('new_leads_30d', 0)}")
print(f"NEW_LEADS_7D={d.get('new_leads_7d', 0)}")
print(f"CONV_RATE={d.get('conversion_rate_30d', 0)}")
print(f"FOLLOWUP_PENDING={d.get('followup_pending', 0)}")
print("STAGE_TABLE<<<")
print(stage_table)
print(">>>")
print("SENDER_TABLE<<<")
print(sender_table)
print(">>>")
PYEOF
)

eval "$(echo "$ANALYSIS" | grep -E '^[A-Z_][A-Z0-9_]*=' | sed 's/^/export /')"
STAGE_TABLE=$(echo "$ANALYSIS" | awk '/^STAGE_TABLE<<<$/{flag=1;next} /^>>>$/{flag=0} flag')
SENDER_TABLE=$(echo "$ANALYSIS" | awk '/^SENDER_TABLE<<<$/{flag=1;next} /^>>>$/{flag=0} flag')

PIPELINE_FMT=$(printf "\$%'d" $PIPELINE_DOLLARS 2>/dev/null || echo "\$$PIPELINE_DOLLARS")
WON_VALUE_FMT=$(printf "\$%'d" $WON_VALUE_30D 2>/dev/null || echo "\$$WON_VALUE_30D")
AVG_QUOTE_FMT=$(printf "\$%'d" $AVG_QUOTE 2>/dev/null || echo "\$$AVG_QUOTE")

cat > "$WIKI_PAGE" <<EOF
---
title: CRM Usage & Pipeline Stats
branch: CRM
type: analysis
updated: $TODAY
tags: [crm, pipeline, data, supabase, auto-updated]
---

# CRM Usage & Pipeline Stats

> **Auto-updated daily** by \`scripts/brain/fetch-crm-stats.sh\`. Last refresh: **$TS**. Pulled from \`/functions/v1/crm-stats\` (RLS-bypassing rollup endpoint deployed 2026-04-26 after the SR JWT rotation). For CRM architecture see [[CRM/CRM Overview]]. For why this exists see [[Operations/Data Intelligence]].

## Pipeline Snapshot

| Metric | Value |
|--------|-------|
| **Active leads** | $ACTIVE |
| **Pipeline \$ (stage 1-8)** | $PIPELINE_FMT |
| **Won revenue 30d** | $WON_VALUE_FMT ($WON_30D jobs) |
| **Avg quote** | $AVG_QUOTE_FMT |
| **Total contacts** | $TOTAL |
| **Archived** | $ARCHIVED |
| **Do-not-contact** | $DNC |
| **AI enabled** | $AI_ON / $TOTAL |

## Active Leads by Stage

| Stage | Count |
|-------|-------|
$STAGE_TABLE

## Lead Flow — Last 30 Days

| Metric | Value |
|--------|-------|
| **New leads** | $NEW_LEADS_30D |
| **New leads (7d)** | $NEW_LEADS_7D |
| **Won (stage 9)** | $WON_30D |
| **Conversion rate** | ${CONV_RATE}% |

## Messaging — Last 7 Days

| Metric | Value |
|--------|-------|
| **Inbound** | $INBOUND_7D |
| **Outbound** | $OUTBOUND_7D |
| **Calls / VMs** | $CALLS_7D |
| **Follow-ups pending** | $FOLLOWUP_PENDING |

### Outbound by sender

| Sender | Count |
|--------|-------|
$SENDER_TABLE

## What to Watch

- **Stage 1 backlog?** A high count at stage 1 means new leads are not getting a meaningful first touch. The hourly \`alex-followup-hourly\` cron should be working it down — if not, check Supabase logs.
- **Conversion rate dropping?** Look at where leads are stalling — quoted-not-booked is usually a follow-up issue, booked-not-installed is a scheduling issue.
- **\`msgs_7d_key = 0\`?** Means Alex is doing all of the talking. Some loops require Key to step in (medical urgency, complex permits, frustrated customers).

## Connected Pages

- [[CRM/CRM Overview]] — architecture
- [[Operations/Data Intelligence]] — why this page exists
- [[Ads/Meta Performance]] — top-of-funnel that drives these counts
- [[Website/Site Analytics]] — site funnel before the CRM
- [[00 Home]] — master dashboard
EOF

echo "[fetch-crm-stats] Wrote $WIKI_PAGE — active=$ACTIVE pipeline=$PIPELINE_FMT new_30d=$NEW_LEADS_30D conv=${CONV_RATE}%"
