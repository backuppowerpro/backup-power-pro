#!/bin/bash
# fetch-crm-stats.sh — Pull CRM/pipeline stats from Supabase and write to wiki
# Source: Supabase REST API (service role key, reads across RLS)
# Output: wiki/CRM/CRM Usage.md (overwritten + appended log)
set -e

CREDS="/Users/keygoodson/.claude/credentials.md"
WIKI_PAGE="/Users/keygoodson/Desktop/CLAUDE/wiki/CRM/CRM Usage.md"
SUPA_URL="https://reowtzedjflwmlptupbk.supabase.co/rest/v1"
TODAY=$(date +%Y-%m-%d)
TS=$(date +%Y-%m-%d\ %H:%M)

# Extract service role key from credentials
SR_KEY=$(grep -A1 "Service Role Key" "$CREDS" | grep -oE "eyJ[A-Za-z0-9._-]+" | head -1)
if [ -z "$SR_KEY" ]; then
  echo "ERROR: Could not find Supabase service role key in $CREDS" >&2
  exit 1
fi

supa() {
  # Usage: supa "contacts?select=..."
  curl -s "$SUPA_URL/$1" -H "apikey: $SR_KEY" -H "Authorization: Bearer $SR_KEY"
}

# 1. Full contacts dump (all active + recent archived)
CONTACTS_JSON=$(supa "contacts?select=id,stage,status,quote_amount,created_at,ai_enabled&limit=1000&order=created_at.desc")

# 2. Last 7 days messages
SEVEN_DAYS_AGO=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d "7 days ago" +%Y-%m-%d)
MSGS_JSON=$(supa "messages?select=id,direction,created_at,status,sender&created_at=gte.$SEVEN_DAYS_AGO&limit=5000")

# 3. Last 30 days contacts (for trend)
THIRTY_DAYS_AGO=$(date -v-30d +%Y-%m-%d 2>/dev/null || date -d "30 days ago" +%Y-%m-%d)
NEW_LEADS_JSON=$(supa "contacts?select=id,created_at,stage,status&created_at=gte.$THIRTY_DAYS_AGO&limit=1000")

# 4. Follow-up queue (what's pending)
FOLLOWUP_JSON=$(supa "follow_up_queue?select=id,contact_id,scheduled_for,completed&completed=eq.false&limit=500")

# Parse everything with one Python block
ANALYSIS=$(python3 <<PYEOF
import json,sys
from datetime import datetime, timezone, timedelta

contacts = json.loads('''$CONTACTS_JSON''')
msgs = json.loads('''$MSGS_JSON''')
new_leads = json.loads('''$NEW_LEADS_JSON''')
followups = json.loads('''$FOLLOWUP_JSON''')

# Stage labels (from BPP CRM)
STAGES = {1:"New Lead",2:"Contacted",3:"Quote Sent",4:"Booked",5:"Scheduled",6:"In Progress",7:"Installed",8:"Invoiced",9:"Archived"}

total = len(contacts)
active = [c for c in contacts if c.get('status') != 'Archived' and (c.get('stage') or 1) < 9]
archived = [c for c in contacts if c.get('status') == 'Archived']

# Stage distribution
stage_counts = {}
for c in active:
    s = c.get('stage') or 1
    stage_counts[s] = stage_counts.get(s, 0) + 1

# Pipeline $ = sum of quote_amount for contacts in stages 3-6 (quoted → installed-not-paid)
pipeline_contacts = [c for c in active if (c.get('stage') or 1) >= 3 and (c.get('stage') or 1) <= 6]
pipeline_dollars = sum(float(c.get('quote_amount') or 0) for c in pipeline_contacts)

# Won revenue (stages 7-8 = installed/invoiced)
won = [c for c in contacts if (c.get('stage') or 1) in (7, 8)]
won_dollars = sum(float(c.get('quote_amount') or 0) for c in won)

# AI enabled ratio
ai_on = sum(1 for c in contacts if c.get('ai_enabled'))

# Messages analysis
inbound = [m for m in msgs if m.get('direction') == 'inbound']
outbound = [m for m in msgs if m.get('direction') == 'outbound']
msg_failed = [m for m in msgs if m.get('status') == 'failed']
by_sender = {}
for m in outbound:
    s = m.get('sender') or 'unknown'
    by_sender[s] = by_sender.get(s, 0) + 1

# New leads trend (last 30 days by week)
now = datetime.now(timezone.utc)
week_buckets = {0:0, 1:0, 2:0, 3:0}  # 0=this week, 1=last week, etc
for l in new_leads:
    try:
        ca = datetime.fromisoformat(l['created_at'].replace('Z','+00:00'))
        days_ago = (now - ca).days
        if days_ago < 7: week_buckets[0] += 1
        elif days_ago < 14: week_buckets[1] += 1
        elif days_ago < 21: week_buckets[2] += 1
        elif days_ago < 30: week_buckets[3] += 1
    except: pass

# Conversion rate (30d): new_leads → stage >=4 (booked)
booked_30d = sum(1 for l in new_leads if (l.get('stage') or 1) >= 4 and l.get('status') != 'Archived')
conv_rate = f"{round(booked_30d/len(new_leads)*100, 1)}%" if new_leads else "N/A"

# Reply-time proxy: look at inbound messages that have an outbound reply within 30min
# Too expensive w/o contact pairing — skip for now

# Overdue follow-ups (scheduled_for < now and not completed)
overdue = 0
pending = 0
for f in followups:
    try:
        sf = datetime.fromisoformat(f['scheduled_for'].replace('Z','+00:00'))
        if sf < now: overdue += 1
        else: pending += 1
    except: pending += 1

# Output as shell-friendly vars (one per line, key=value)
out = []
out.append(f"TOTAL={total}")
out.append(f"ACTIVE={len(active)}")
out.append(f"ARCHIVED={len(archived)}")
out.append(f"PIPELINE_DOLLARS={int(pipeline_dollars)}")
out.append(f"WON_DOLLARS={int(won_dollars)}")
out.append(f"WON_COUNT={len(won)}")
out.append(f"AI_ON={ai_on}")
out.append(f"INBOUND_7D={len(inbound)}")
out.append(f"OUTBOUND_7D={len(outbound)}")
out.append(f"MSG_FAILED_7D={len(msg_failed)}")
out.append(f"NEW_LEADS_30D={len(new_leads)}")
out.append(f"BOOKED_30D={booked_30d}")
out.append(f"CONV_RATE={conv_rate}")
out.append(f"OVERDUE_FOLLOWUPS={overdue}")
out.append(f"PENDING_FOLLOWUPS={pending}")
out.append(f"WEEK0={week_buckets[0]}")
out.append(f"WEEK1={week_buckets[1]}")
out.append(f"WEEK2={week_buckets[2]}")
out.append(f"WEEK3={week_buckets[3]}")

# Stage table
stage_rows = []
for s in sorted(stage_counts.keys()):
    stage_rows.append(f"| {STAGES.get(s,'Stage '+str(s))} (stage {s}) | {stage_counts[s]} |")
out.append("STAGE_TABLE<<<")
out.append('\n'.join(stage_rows) if stage_rows else "| (no active leads) | - |")
out.append(">>>")

# Sender table
sender_rows = []
for s, n in sorted(by_sender.items(), key=lambda x: -x[1]):
    sender_rows.append(f"| {s} | {n} |")
out.append("SENDER_TABLE<<<")
out.append('\n'.join(sender_rows) if sender_rows else "| (no outbound) | - |")
out.append(">>>")

print('\n'.join(out))
PYEOF
)

# Extract simple vars
eval "$(echo "$ANALYSIS" | grep -E '^[A-Z_][A-Z0-9_]*=' | sed 's/^/export /')"

# Extract tables (between <<< and >>>)
STAGE_TABLE=$(echo "$ANALYSIS" | awk '/^STAGE_TABLE<<<$/{flag=1;next} /^>>>$/{flag=0} flag')
SENDER_TABLE=$(echo "$ANALYSIS" | awk '/^SENDER_TABLE<<<$/{flag=1;next} /^>>>$/{flag=0} flag')

# Format pipeline $ with commas
PIPELINE_FMT=$(printf "\$%'d" $PIPELINE_DOLLARS 2>/dev/null || echo "\$$PIPELINE_DOLLARS")
WON_FMT=$(printf "\$%'d" $WON_DOLLARS 2>/dev/null || echo "\$$WON_DOLLARS")

# Write the wiki page
cat > "$WIKI_PAGE" <<EOF
---
title: CRM Usage & Pipeline Stats
branch: CRM
type: analysis
updated: $TODAY
tags: [crm, pipeline, data, supabase, auto-updated]
---

# CRM Usage & Pipeline Stats

> **Auto-updated daily** by \`scripts/brain/fetch-crm-stats.sh\`. Last refresh: **$TS**. Direct queries against Supabase \`contacts\`, \`messages\`, \`follow_up_queue\` tables (service role). For CRM architecture see [[CRM/CRM Overview]]. For why this exists see [[Operations/Data Intelligence]].

## Pipeline Snapshot

| Metric | Value |
|--------|-------|
| **Active leads** | $ACTIVE |
| **Pipeline $ (quoted → pre-install)** | $PIPELINE_FMT |
| **Won revenue (installed + invoiced)** | $WON_FMT ($WON_COUNT jobs) |
| **Total contacts (all time)** | $TOTAL |
| **Archived** | $ARCHIVED |
| **AI enabled contacts** | $AI_ON / $TOTAL |

## Active Leads by Stage

| Stage | Count |
|-------|-------|
$STAGE_TABLE

## Lead Flow — Last 30 Days

| Metric | Value |
|--------|-------|
| **New leads (30d)** | $NEW_LEADS_30D |
| **This week** | $WEEK0 |
| **Last week** | $WEEK1 |
| **2 weeks ago** | $WEEK2 |
| **3 weeks ago** | $WEEK3 |
| **Booked from 30d cohort** | $BOOKED_30D |
| **Conversion rate (30d)** | $CONV_RATE |

## Messaging Activity — Last 7 Days

| Metric | Value |
|--------|-------|
| **Inbound messages** | $INBOUND_7D |
| **Outbound messages** | $OUTBOUND_7D |
| **Failed outbound** | $MSG_FAILED_7D |

### Outbound by Sender

| Sender | Count |
|--------|-------|
$SENDER_TABLE

## Follow-up Queue

| Metric | Value |
|--------|-------|
| **Overdue (past due, not completed)** | $OVERDUE_FOLLOWUPS |
| **Pending (future, not completed)** | $PENDING_FOLLOWUPS |

## What to Watch

- **Overdue follow-ups > 5?** Sparky's not cleaning the queue — investigate briefing or nudge logic.
- **MSG_FAILED_7D > 0?** Twilio delivery problem or a bad phone number — check Twilio console.
- **Conversion rate dropping?** Messaging or response-time issue. Compare against previous week.
- **Outbound by sender heavily weighted to Key?** Sparky automation isn't pulling weight — tune prompts.
- **New leads trending down week-over-week?** Ad spend or creative issue — check [[Ads/Meta Performance]].

## Connected Pages

- [[CRM/CRM Overview]] — CRM architecture
- [[CRM/Sparky AI]] — AI agent (whose output shows up in sender counts)
- [[CRM/Twilio Integration]] — SMS transport
- [[Operations/Data Intelligence]] — data hub
- [[Ads/Meta Performance]] — upstream lead gen data
- [[BPP/Sales Process]] — the process these numbers measure
- [[00 Home]] — master dashboard
EOF

echo "[fetch-crm-stats] Wrote $WIKI_PAGE — active=$ACTIVE pipeline=$PIPELINE_FMT new_30d=$NEW_LEADS_30D conv=$CONV_RATE"
