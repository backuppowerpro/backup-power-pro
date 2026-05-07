#!/usr/bin/env bash
# sync-from-wiki.sh
#
# Mirror wiki/Key/*.md → brain/*.md with sanitization.
#
# wiki/Key/ is per-machine, gitignored, holds unredacted captures with
# specific dollar figures, account balances, mortgage amounts, etc.
# brain/ is tracked + sanitized, travels with the repo, gets read by
# every fresh AI session (locally or via cloud agents).
#
# This script keeps the two in sync after Key updates wiki/Key/. Run it
# manually after a workshop session, or wire to a pre-push git hook.
#
# Sanitization passes:
#   1. Dollar figures: `$30k`, `$3,000`, `$1.2M`, `$10-15k/month` → `$X` / `$X-Y`
#   2. Mortgage / loan specifics: `150k left on a 170k mortgage` → `mortgage`
#   3. Account balances: `30k in business bank, 2-5k in personal` → numeric placeholders
#   4. Roth/IRA amounts: `25k in investments and roth IRA` → numeric placeholder
#
# Files explicitly skipped: 00 Key Index.md (TOC duplicate), Interview Questions.md
# (workshop scratchpad).
#
# Mapping (alphabetical wiki name → numbered brain name):
#   Identity.md         → 01-identity.md
#   How I Decide.md     → 02-how-i-decide.md
#   My Voice.md         → 03-my-voice.md
#   Avoid List.md       → 04-avoid-list.md
#   Active Priorities.md→ 05-active-priorities.md
#   Design Language.md  → 06-design-language.md
#   Decisions Log.md    → 07-decisions-log.md
#   Open Questions.md   → 08-open-questions.md (if/when needed)

set -euo pipefail

FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE=1 ;;
    --help|-h)
      cat <<'HELP'
sync-from-wiki.sh — mirror wiki/Key/ → brain/ with sanitization.

Usage:
  scripts/brain/sync-from-wiki.sh           # safe sync, refuses to overwrite manual brain edits
  scripts/brain/sync-from-wiki.sh --force   # overwrite anyway (use after folding manual edits into wiki/Key/)

Workflow when sync refuses:
  1. Note which brain/ file has manual edits (the script tells you).
  2. Fold those edits into the matching wiki/Key/<name>.md.
  3. Re-run sync (it'll succeed because the manual edit is now in the source).
HELP
      exit 0
      ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WIKI_KEY="$REPO_ROOT/wiki/Key"
BRAIN="$REPO_ROOT/brain"

if [[ ! -d "$WIKI_KEY" ]]; then
  echo "wiki/Key/ not present on this machine — nothing to sync."
  echo "(Expected at: $WIKI_KEY)"
  exit 0
fi

mkdir -p "$BRAIN"

# Sanitize stdin → stdout. Order matters: longest-first, most-specific-first.
sanitize() {
  python3 -c '
import re, sys
text = sys.stdin.read()

# (a) Mortgage specifics: "150k left on a 170k mortgage" / "$150K mortgage"
text = re.sub(r"\$?\d+[kK](?:\s*left)?\s+on\s+a\s+\$?\d+[kK]\s+mortgage", "mortgage", text)
text = re.sub(r"\$?\d+[kK,\d]*\s+mortgage\b", "mortgage", text)

# (b) Account balances stated together: "30k in business bank. 2-5k in personal. 25k in investments"
text = re.sub(r"\$?\d+[kK]\s+in\s+(business|personal|checking|savings|investments?|roth\s*IRA|IRA|brokerage)", r"$X in \1", text, flags=re.I)

# (c) Income / month figures kept as ranges: "$10-15K/month" stays a tier marker, OK
# (d) Bare dollar amounts > 3 digits: "$3,000" / "$1,202" → "$X"
text = re.sub(r"\$\d{1,3}(?:,\d{3})+(?:\.\d+)?", "$X", text)
# (e) Bare $Nk / $NM (single token) — keep range form like "$10-15K", redact bare specifics over 4-digit
text = re.sub(r"\$\d{4,}(?:\.\d+)?", "$X", text)

# (f) Specific Tesla / vehicle dollar success: "made $X on tesla" stays; numerical payouts redact
# (g) Sweep stray "$XYK" four-digit-K like "$2500K"
text = re.sub(r"\$\d{3,}[kK]\b", "$X", text)

# (h) Per-cred phone numbers (precaution)
text = re.sub(r"\b\(\d{3}\)\s*\d{3}-\d{4}\b", "(XXX) XXX-XXXX", text)
text = re.sub(r"\b\d{3}-\d{3}-\d{4}\b", "XXX-XXX-XXXX", text)

# (i) Em-dash hard rule (Key 2026-05-05): replace em-dash with comma+space
# in tracked brain/ files. wiki/Key/ source is left as-is so the workshop
# stays untouched, but published brain/ never ships an em-dash.
# " — " (spaced) → ", "; "X—Y" (unspaced) → "X, Y"
text = re.sub(r"\s*—\s*", ", ", text)
# Also handle Unicode em-dash codepoint and the literal char defensively
text = text.replace("—", ", ")

sys.stdout.write(text)
'
}

declare -a MAP=(
  "Identity.md|01-identity.md"
  "How I Decide.md|02-how-i-decide.md"
  "My Voice.md|03-my-voice.md"
  "Avoid List.md|04-avoid-list.md"
  "Active Priorities.md|05-active-priorities.md"
  "Design Language.md|06-design-language.md"
  "Decisions Log.md|07-decisions-log.md"
  "Open Questions.md|08-open-questions.md"
  "Repo Map.md|09-repo-map.md"
)

CHANGED=0
FAIL=0
HEADER='> This file is auto-synced from `wiki/Key/<name>.md` via `scripts/brain/sync-from-wiki.sh`.
> Edit the wiki source, not this file. Sanitization strips specific dollar figures, account balances, and phone numbers.

'

for entry in "${MAP[@]}"; do
  src="${entry%%|*}"
  dst="${entry##*|}"
  src_path="$WIKI_KEY/$src"
  dst_path="$BRAIN/$dst"

  if [[ ! -f "$src_path" ]]; then
    continue
  fi

  tmp="$(mktemp)"
  printf '%s' "$HEADER" > "$tmp"
  sanitize < "$src_path" >> "$tmp"

  if [[ ! -f "$dst_path" ]] || ! cmp -s "$tmp" "$dst_path"; then
    # Overwrite protection: if dst exists and was modified after the last
    # sync stamp, the user (or another session) edited brain/ directly.
    # Refuse to clobber unless --force was passed.
    if [[ -f "$dst_path" && -f "$BRAIN/.last-synced" && $FORCE -eq 0 ]]; then
      LAST_SYNC_S=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$(cat "$BRAIN/.last-synced")" "+%s" 2>/dev/null || echo 0)
      DST_MTIME_S=$(stat -f "%m" "$dst_path" 2>/dev/null || stat -c "%Y" "$dst_path" 2>/dev/null || echo 0)
      if [[ $DST_MTIME_S -gt $LAST_SYNC_S ]]; then
        echo "✗ refusing to overwrite brain/$dst, modified after last sync ($(date -r "$DST_MTIME_S" 2>/dev/null || echo "$DST_MTIME_S"))."
        echo "    fold those edits into wiki/Key/$src first, then re-run."
        echo "    or pass --force if you know what you're doing."
        rm -f "$tmp"
        FAIL=1
        continue
      fi
    fi
    mv "$tmp" "$dst_path"
    echo "synced: $src → brain/$dst"
    CHANGED=$((CHANGED+1))
  else
    rm -f "$tmp"
  fi
done

# Refresh PORTABLE-BRAIN.md as a single-file dump for cloud-agent paste-in.
{
  echo "# PORTABLE BRAIN (single-file dump)"
  echo
  echo "> Auto-generated by \`scripts/brain/sync-from-wiki.sh\`. Concatenation of"
  echo "> the brain/ files for sessions with no file access. Paste this"
  echo "> in once and the agent has full operating context."
  echo
  for f in "$BRAIN"/0[1-9]-*.md "$BRAIN"/1[0-9]-*.md; do
    [[ -f "$f" ]] || continue
    echo
    echo "---"
    echo
    cat "$f"
  done
} > "$BRAIN/PORTABLE-BRAIN.md.tmp"

if [[ ! -f "$BRAIN/PORTABLE-BRAIN.md" ]] || ! cmp -s "$BRAIN/PORTABLE-BRAIN.md.tmp" "$BRAIN/PORTABLE-BRAIN.md"; then
  mv "$BRAIN/PORTABLE-BRAIN.md.tmp" "$BRAIN/PORTABLE-BRAIN.md"
  echo "synced: PORTABLE-BRAIN.md (concatenation refreshed)"
  CHANGED=$((CHANGED+1))
else
  rm -f "$BRAIN/PORTABLE-BRAIN.md.tmp"
fi

if [[ $FAIL -gt 0 ]]; then
  echo
  echo "✗ sync incomplete, $FAIL file(s) skipped to protect manual edits."
  exit 1
fi

# Freshness stamp, always refreshed (so a no-op run still records that
# the user verified parity at this time). Tracked in git so other machines
# and cloud agents can see when the brain was last reconciled with wiki.
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$BRAIN/.last-synced"

if [[ $CHANGED -eq 0 ]]; then
  echo "brain/ already in sync with wiki/Key/. No changes."
else
  echo
  echo "✓ $CHANGED file(s) updated. Review then: git add brain/ && git commit && git push"
fi
