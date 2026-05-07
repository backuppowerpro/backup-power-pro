#!/usr/bin/env bash
# validate.sh — quality gate for the tracked brain/ directory.
#
# Enforces Key's hard rules + sanitization integrity. Run manually or
# wired into a git pre-commit hook (see hooks/pre-commit).
#
# Checks:
#   1. No em-dashes (—). Key's named hard rule.
#   2. No specific dollar amounts that should have been sanitized:
#      - $1,234 / $1234 (4+ digits) / $5k+ bank/Roth/investment patterns
#   3. No specific phone numbers (10-digit forms).
#   4. All 7 numbered brain files exist (01-07).
#   5. PORTABLE-BRAIN.md is at least the size of all numbered files combined
#      (concat hasn't been truncated).
#
# Exit 0 = clean. Exit 1 = block. Output prints offending file + line.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BRAIN="$REPO_ROOT/brain"
FAIL=0

if [[ ! -d "$BRAIN" ]]; then
  echo "✗ brain/ missing entirely at $BRAIN"
  exit 1
fi

# ── 1. Em-dash audit ──────────────────────────────────────────────────────────
echo "→ check 1: em-dash audit"
EM_HITS=$(grep -rn -- "—" "$BRAIN" 2>/dev/null || true)
if [[ -n "$EM_HITS" ]]; then
  echo "$EM_HITS" | sed 's/^/    /'
  echo "✗ em-dashes found in brain/. Key's hard rule: no em-dashes ANYWHERE."
  FAIL=1
else
  echo "  ✓ clean"
fi

# ── 2. Sanitization leak detector ─────────────────────────────────────────────
echo "→ check 2: dollar / balance leak detector"
LEAKS=$(grep -rnE '\$[0-9]{1,3},[0-9]{3}|\$[0-9]{4,}|\b(150k|170k|30k\s+in\s+(business|personal)|25k\s+in\s+(roth|invest))' "$BRAIN" 2>/dev/null | grep -v 'PORTABLE-BRAIN' || true)
if [[ -n "$LEAKS" ]]; then
  echo "$LEAKS" | sed 's/^/    /'
  echo "✗ specific dollar/balance figures detected. Re-run sync-from-wiki.sh; if leak persists, harden sanitize() regex."
  FAIL=1
else
  echo "  ✓ clean"
fi

# ── 3. Phone-number leak ──────────────────────────────────────────────────────
echo "→ check 3: phone-number leak"
PHONE_HITS=$(grep -rnE '\b[0-9]{3}-[0-9]{3}-[0-9]{4}\b|\b\([0-9]{3}\)\s*[0-9]{3}-[0-9]{4}\b' "$BRAIN" 2>/dev/null \
  | grep -vE 'XXX-XXX-XXXX|\(XXX\) XXX-XXXX|800-|888-|877-|866-|855-|844-|833-|822-' || true)
if [[ -n "$PHONE_HITS" ]]; then
  echo "$PHONE_HITS" | sed 's/^/    /'
  echo "✗ raw phone numbers in brain/. Sanitize before commit."
  FAIL=1
else
  echo "  ✓ clean"
fi

# ── 4. Required files ─────────────────────────────────────────────────────────
echo "→ check 4: required files exist"
MISSING=()
for n in 00-INDEX 01-identity 02-how-i-decide 03-my-voice 04-avoid-list 05-active-priorities 06-design-language 07-decisions-log; do
  if [[ ! -f "$BRAIN/$n.md" ]]; then
    MISSING+=("$n.md")
  fi
done
if [[ ! -f "$BRAIN/PORTABLE-BRAIN.md" ]]; then
  MISSING+=("PORTABLE-BRAIN.md")
fi
if [[ ${#MISSING[@]} -gt 0 ]]; then
  for m in "${MISSING[@]}"; do echo "    missing: $m"; done
  echo "✗ required brain files missing."
  FAIL=1
else
  echo "  ✓ all 8 core files present"
fi

# ── 5. PORTABLE-BRAIN concatenation size sanity ───────────────────────────────
echo "→ check 5: PORTABLE-BRAIN.md concatenation integrity"
if [[ -f "$BRAIN/PORTABLE-BRAIN.md" ]]; then
  PORTABLE_SIZE=$(wc -c < "$BRAIN/PORTABLE-BRAIN.md")
  PARTS_SIZE=0
  for n in 01-identity 02-how-i-decide 03-my-voice 04-avoid-list 05-active-priorities 06-design-language 07-decisions-log; do
    if [[ -f "$BRAIN/$n.md" ]]; then
      sz=$(wc -c < "$BRAIN/$n.md")
      PARTS_SIZE=$((PARTS_SIZE + sz))
    fi
  done
  # Portable should be >= 90% of sum-of-parts (allow some sanitization shrinkage)
  THRESHOLD=$((PARTS_SIZE * 9 / 10))
  if [[ $PORTABLE_SIZE -lt $THRESHOLD ]]; then
    echo "    portable=$PORTABLE_SIZE parts=$PARTS_SIZE threshold=$THRESHOLD"
    echo "✗ PORTABLE-BRAIN.md looks truncated. Re-run sync-from-wiki.sh."
    FAIL=1
  else
    echo "  ✓ portable=$PORTABLE_SIZE parts=$PARTS_SIZE"
  fi
fi

echo
if [[ $FAIL -eq 0 ]]; then
  echo "✓ brain/ validation passed."
  exit 0
else
  echo "✗ brain/ validation FAILED. Fix the issues above before commit/push."
  exit 1
fi
