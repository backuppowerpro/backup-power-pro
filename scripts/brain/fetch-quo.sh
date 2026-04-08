#!/bin/bash
# fetch-quo.sh — Pull recent lead conversations from Quo (OpenPhone) legacy
# Until (864) 400-5302 ports to Twilio, real lead replies live in Quo, not Supabase.
# This fetcher gives the brain visibility into the actual lead flow.
# Source: https://api.openphone.com/v1
# Output: wiki/CRM/Quo Conversations.md
set -e

CREDS="/Users/keygoodson/.claude/credentials.md"
WIKI_PAGE="/Users/keygoodson/Desktop/CLAUDE/wiki/CRM/Quo Conversations.md"
TODAY=$(date +%Y-%m-%d)
TS=$(date +%Y-%m-%d\ %H:%M)

# Extract Quo API key
QUO_KEY=$(grep -A1 "Quo (formerly OpenPhone)" "$CREDS" | grep -A1 "API Key" | grep -oE "[a-f0-9]{64}" | head -1)
QUO_FROM_ID="PNTZHfvSsh"  # (864) 400-5302

if [ -z "$QUO_KEY" ]; then
  echo "ERROR: Could not find Quo API key" >&2
  exit 1
fi

# 1. List conversations from the (864) 400-5302 number, last 50
CONV_JSON=$(curl -s "https://api.openphone.com/v1/conversations?phoneNumberId=$QUO_FROM_ID&maxResults=50" \
  -H "Authorization: $QUO_KEY")

# Check if API returned an error
ERR=$(echo "$CONV_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',{}).get('message') if isinstance(d,dict) and d.get('error') else '')" 2>/dev/null || echo "")
if [ -n "$ERR" ]; then
  echo "[fetch-quo] API error: $ERR" >&2
  # Write a placeholder page so the brain still has something
  cat > "$WIKI_PAGE" <<EOF
---
title: Quo Conversations
branch: CRM
type: analysis
updated: $TODAY
tags: [quo, legacy, data, auto-updated]
---

# Quo Conversations — Last 7 Days

> **Auto-update failed** at $TS: \`$ERR\`

This page couldn't pull Quo data on this refresh. Check \`scripts/brain/fetch-quo.sh\` or the API key in credentials.

## Connected Pages
- [[Operations/Data Intelligence]]
- [[CRM/CRM Overview]]
EOF
  exit 0
fi

# Parse conversations and pull counts
ANALYSIS=$(python3 <<PYEOF
import json,sys
from datetime import datetime, timezone, timedelta

data = json.loads('''$CONV_JSON''')
convos = data.get('data', []) if isinstance(data, dict) else []

now = datetime.now(timezone.utc)
cutoff_7d = now - timedelta(days=7)
cutoff_30d = now - timedelta(days=30)

total_convos = len(convos)
active_7d = 0
active_30d = 0
rows = []

for c in convos:
    last_activity = c.get('lastActivityAt') or c.get('updatedAt') or c.get('createdAt')
    if not last_activity:
        continue
    try:
        ts = datetime.fromisoformat(last_activity.replace('Z', '+00:00'))
    except Exception:
        continue
    if ts >= cutoff_7d: active_7d += 1
    if ts >= cutoff_30d: active_30d += 1

    participants = c.get('participants') or []
    # Pick the first participant that isn't the BPP number
    lead_phone = 'unknown'
    for p in participants:
        if p and '4005302' not in p:
            lead_phone = p
            break

    name = c.get('name') or ''
    days_ago = (now - ts).days
    hours_ago = int((now - ts).total_seconds() / 3600)
    age = f"{days_ago}d" if days_ago >= 1 else f"{hours_ago}h"

    rows.append({
        'sort_key': (now - ts).total_seconds(),
        'age': age,
        'phone': lead_phone,
        'name': name[:20] if name else '-'
    })

rows.sort(key=lambda x: x['sort_key'])
table_rows = []
for r in rows[:20]:
    table_rows.append(f"| {r['age']} | {r['name']} | {r['phone']} |")

print(f"TOTAL={total_convos}")
print(f"ACTIVE_7D={active_7d}")
print(f"ACTIVE_30D={active_30d}")
print("TABLE<<<")
print('\n'.join(table_rows) if table_rows else "| - | (no conversations) | - |")
print(">>>")
PYEOF
)

eval "$(echo "$ANALYSIS" | grep -E '^[A-Z_][A-Z0-9_]*=' | sed 's/^/export /')"
TABLE=$(echo "$ANALYSIS" | awk '/^TABLE<<<$/{flag=1;next} /^>>>$/{flag=0} flag')

cat > "$WIKI_PAGE" <<EOF
---
title: Quo Conversations (Legacy)
branch: CRM
type: analysis
updated: $TODAY
tags: [quo, legacy, data, auto-updated]
---

# Quo Conversations — Legacy Inbound

> **Auto-updated daily** by \`scripts/brain/fetch-quo.sh\`. Last refresh: **$TS**. Pulls conversations from Quo (OpenPhone) phone (864) 400-5302 — the legacy number where **real lead replies currently live** until porting to Twilio completes. See [[CRM/Twilio Integration]] for the migration plan.

## Why This Page Exists

Until (864) 400-5302 ports from Quo to Twilio, the new-lead auto-responder goes out from Quo, and **all lead replies come back to Quo** — not to the Supabase CRM. That means Sparky and the CRM briefing are **blind to the actual lead flow**. This page bridges that gap so Claude can see what leads are saying even though the messages don't live in Supabase.

## Snapshot

| Metric | Value |
|--------|-------|
| **Total conversations (all time)** | $TOTAL |
| **Active in last 7 days** | $ACTIVE_7D |
| **Active in last 30 days** | $ACTIVE_30D |

## Most Recent 20 Conversations

| Age | Name | Phone |
|-----|------|-------|
$TABLE

## Action Items This Generates

- **Replies stuck in Quo** that Sparky can't see → Key must manually copy urgent ones into CRM until port completes
- **High activity but low CRM conversion** → port is getting urgent
- **Spike in replies after a specific ad goes live** → validates creative

## Connected Pages

- [[CRM/CRM Overview]]
- [[CRM/Twilio Integration]] — porting plan
- [[Operations/Data Intelligence]] — data hub
- [[CRM/CRM Usage]] — the CRM-side data this page supplements
- [[00 Home]]
EOF

echo "[fetch-quo] Wrote $WIKI_PAGE — total=$TOTAL active_7d=$ACTIVE_7D active_30d=$ACTIVE_30D"
