#!/bin/bash
# refresh-brain.sh — Master orchestrator. Runs all data fetchers and appends summary to 00 Log.md.
# Usage: bash scripts/brain/refresh-brain.sh
# Scheduled via ~/Library/LaunchAgents/com.bpp.brain-refresh.plist
set -uo pipefail

BRAIN_DIR="/Users/keygoodson/Desktop/CLAUDE/scripts/brain"
WIKI_LOG="/Users/keygoodson/Desktop/CLAUDE/wiki/00 Log.md"
LOG_FILE="$BRAIN_DIR/.last-refresh.log"
TODAY=$(date +%Y-%m-%d)
TS=$(date +%H:%M)
START=$(date +%s)

echo "=== brain refresh @ $TODAY $TS ===" > "$LOG_FILE"

# Run each fetcher, capture the one-line summary it prints
META_OUT=""; POSTHOG_OUT=""; CRM_OUT=""; QUO_OUT=""
META_STATUS="OK"; POSTHOG_STATUS="OK"; CRM_STATUS="OK"; QUO_STATUS="OK"

if META_OUT=$(bash "$BRAIN_DIR/fetch-meta.sh" 2>&1); then
  echo "$META_OUT" >> "$LOG_FILE"
else
  META_STATUS="FAIL"
  echo "META FAILED: $META_OUT" >> "$LOG_FILE"
fi

if POSTHOG_OUT=$(bash "$BRAIN_DIR/fetch-posthog.sh" 2>&1); then
  echo "$POSTHOG_OUT" >> "$LOG_FILE"
else
  POSTHOG_STATUS="FAIL"
  echo "POSTHOG FAILED: $POSTHOG_OUT" >> "$LOG_FILE"
fi

if CRM_OUT=$(bash "$BRAIN_DIR/fetch-crm-stats.sh" 2>&1); then
  echo "$CRM_OUT" >> "$LOG_FILE"
else
  CRM_STATUS="FAIL"
  echo "CRM FAILED: $CRM_OUT" >> "$LOG_FILE"
fi

if QUO_OUT=$(bash "$BRAIN_DIR/fetch-quo.sh" 2>&1); then
  echo "$QUO_OUT" >> "$LOG_FILE"
else
  QUO_STATUS="FAIL"
  echo "QUO FAILED: $QUO_OUT" >> "$LOG_FILE"
fi

# Synthesize CEO morning brief from all fetched data
BRIEF_OUT=""; BRIEF_STATUS="OK"
if BRIEF_OUT=$(bash "$BRAIN_DIR/synthesize-ceo-brief.sh" 2>&1); then
  echo "$BRIEF_OUT" >> "$LOG_FILE"
else
  BRIEF_STATUS="FAIL"
  echo "BRIEF FAILED: $BRIEF_OUT" >> "$LOG_FILE"
fi

END=$(date +%s)
DURATION=$((END - START))

# Build a compact one-line summary for 00 Log.md
# Try to extract key numbers from the outputs
META_LINE=$(echo "$META_OUT" | tail -1)
POSTHOG_LINE=$(echo "$POSTHOG_OUT" | tail -1)
CRM_LINE=$(echo "$CRM_OUT" | tail -1)
QUO_LINE=$(echo "$QUO_OUT" | tail -1)

# Append to 00 Log.md (create if needed)
if [ ! -f "$WIKI_LOG" ]; then
  cat > "$WIKI_LOG" <<EOF
---
title: Brain Log
type: log
updated: $TODAY
tags: [log, history]
---

# BPP Second Brain — Log

Append-only history of changes and automated data refreshes.

---

EOF
fi

# Append today's refresh entry
cat >> "$WIKI_LOG" <<EOF

### $TODAY $TS — Automated brain refresh (${DURATION}s)
- **Meta**: $META_STATUS — $META_LINE
- **PostHog**: $POSTHOG_STATUS — $POSTHOG_LINE
- **CRM**: $CRM_STATUS — $CRM_LINE
- **Quo**: $QUO_STATUS — $QUO_LINE
- See [[Ads/Meta Performance]], [[Website/Site Analytics]], [[CRM/CRM Usage]], [[CRM/Quo Conversations]]
EOF

echo "=== refresh complete in ${DURATION}s ===" >> "$LOG_FILE"
echo "[refresh-brain] done in ${DURATION}s (meta=$META_STATUS posthog=$POSTHOG_STATUS crm=$CRM_STATUS quo=$QUO_STATUS)"

# Exit 0 even if some fetchers failed — we want launchd to keep scheduling
exit 0
