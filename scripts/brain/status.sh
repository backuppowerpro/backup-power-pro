#!/usr/bin/env bash
# status.sh — at-a-glance brain health.
#
# Reports: last-sync timestamp, drift vs wiki/Key/, validation result,
# open-questions count, file sizes. One command, no args.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BRAIN="$REPO_ROOT/brain"
WIKI="$REPO_ROOT/wiki/Key"

echo "═══ BRAIN STATUS ═══"
echo

# Last-synced
if [[ -f "$BRAIN/.last-synced" ]]; then
  LAST=$(cat "$BRAIN/.last-synced")
  LAST_S=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$LAST" "+%s" 2>/dev/null || echo 0)
  NOW_S=$(date "+%s")
  AGE_HRS=$(( (NOW_S - LAST_S) / 3600 ))
  echo "last sync: $LAST  (${AGE_HRS}h ago)"
else
  echo "last sync: NEVER (run scripts/brain/sync-from-wiki.sh)"
fi

# Drift vs wiki
if [[ -d "$WIKI" ]]; then
  DRIFT=0
  for f in "$WIKI"/*.md; do
    [[ -f "$f" ]] || continue
    name=$(basename "$f")
    case "$name" in
      "00 Key Index.md"|"Interview Questions.md") continue ;;
    esac
    if [[ "$f" -nt "$BRAIN/.last-synced" ]] 2>/dev/null; then
      [[ $DRIFT -eq 0 ]] && echo
      echo "  drift: wiki/Key/$name newer than last sync"
      DRIFT=$((DRIFT+1))
    fi
  done
  if [[ $DRIFT -eq 0 ]]; then
    echo "drift:     none (wiki/Key/ unchanged since last sync)"
  fi
else
  echo "drift:     n/a (wiki/Key/ not present on this machine)"
fi
echo

# File census
echo "files:"
TOTAL_BYTES=0
for f in "$BRAIN"/0[0-9]-*.md "$BRAIN/PORTABLE-BRAIN.md"; do
  [[ -f "$f" ]] || continue
  sz=$(wc -c < "$f")
  lines=$(wc -l < "$f")
  printf "  %-32s  %6d lines  %7d bytes\n" "$(basename "$f")" "$lines" "$sz"
  TOTAL_BYTES=$((TOTAL_BYTES + sz))
done
echo "  total: $TOTAL_BYTES bytes"
echo

# Open questions count
if [[ -f "$BRAIN/08-open-questions.md" ]]; then
  Q=$(grep -cE '^(### |## Q|^- \[ \])' "$BRAIN/08-open-questions.md" 2>/dev/null || echo 0)
  echo "open questions: ~$Q (review brain/08-open-questions.md)"
fi
echo

# Validation
echo "─── validation ───"
if [[ -x "$REPO_ROOT/scripts/brain/validate.sh" ]]; then
  "$REPO_ROOT/scripts/brain/validate.sh" 2>&1 | tail -1
else
  echo "validate.sh not executable"
fi
