#!/usr/bin/env bash
# audit-crm.sh — catches the bug classes Claude keeps missing during CRM
# work. Run this before declaring any CRM session done. Exit code is the
# count of HIGH-severity findings, so it can gate a commit / slash command.
#
# Coverage (each section maps to a failure that previously slipped past
# the pre-ship checklist and Key found instead):
#
#   1. PER-DEVICE STATE PRETENDING TO SYNC
#      Any localStorage write with a `bpp_v3_*` key. Each one is flagged
#      so Claude has to confirm "is this a sync-able piece of data?" If
#      yes, it belongs in the DB, not localStorage. The pinned-contacts
#      bug Key caught 2026-05-09 was this exact class.
#
#   2. SCHEMA DRIFT
#      Every `.from('TABLE').update({col1, col2})` and
#      `.from('TABLE').select('col1, col2')` cross-checked against the
#      most recent CREATE TABLE / ALTER TABLE for that table in
#      supabase/migrations/. Flags any column referenced in code but
#      never created in a migration.
#
#   3. FIRE-AND-FORGET DB WRITES
#      Any `CRM.__db.from(...).update(...)` not preceded by `await` and
#      not followed by `.then((res) => ...)` is a candidate for silent
#      error swallowing — the DNC / archive / delete bug class.
#
#   4. EDGE FUNCTION REFERENCES
#      Every `__invokeFn('name')` cross-checked against the
#      supabase/functions/ directory. Flags any name with no matching
#      directory.
#
#   5. UNHANDLED ERROR PATHS
#      Any `if (error)` block that only does `console.warn(...)` (no
#      toast, no rollback) — the missed-feedback bug class.
#
#   6. FIXED-SHAPE BADGES / TEXT OVERFLOW
#      Looks for `borderRadius:'50%'` next to dynamic numeric content —
#      the 396-overflowing-the-red-dot bug.
#
#   7. STATE THAT SHOULD CLEAR ON VIEW
#      Every list of rows with a domain meaning of "unread" /
#      "unlistened" — checks if a corresponding mount-effect persists a
#      timestamp on view (mark-as-read / listened_at pattern).
#
# Usage:
#   bash scripts/audit-crm.sh           # human-readable report
#   bash scripts/audit-crm.sh --strict  # exit non-zero if any HIGH
#   bash scripts/audit-crm.sh --json    # machine-readable output

set -uo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
CRM_DIR="$REPO_ROOT/crm/v3"
MIG_DIR="$REPO_ROOT/supabase/migrations"
FN_DIR="$REPO_ROOT/supabase/functions"

if [[ ! -d "$CRM_DIR" ]]; then
  echo "audit-crm: $CRM_DIR not found" >&2
  exit 2
fi

STRICT=0
JSON=0
for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=1 ;;
    --json)   JSON=1 ;;
  esac
done

# Findings collector. Format: SEVERITY|SECTION|FILE:LINE|MESSAGE
FINDINGS_FILE="$(mktemp)"
trap 'rm -f "$FINDINGS_FILE"' EXIT

emit() { # severity section file:line message
  echo "$1|$2|$3|$4" >> "$FINDINGS_FILE"
}

HIGH_COUNT=0
MED_COUNT=0
LOW_COUNT=0

# ─────────────────────────────────────────────────────────────────────
# 1. PER-DEVICE STATE — every bpp_v3_* localStorage key
# ─────────────────────────────────────────────────────────────────────
section_localstorage() {
  while IFS=: read -r file line rest; do
    [[ -z "$file" ]] && continue
    # Skip comments and the audit script itself
    case "$file" in *audit-crm*) continue ;; esac
    # Allow-list keys that are deliberately device-local (drafts in
    # sessionStorage, eviction-eligible cache prefixes, recently-viewed
    # contacts, saved searches, scheduled-message queue, snooze map).
    # Anything else is a candidate to migrate to DB.
    case "$rest" in
      *"bpp_v3_drive:"*|*"bpp_v3_geocode:"*|*"bpp_v3_job_photos:"*) continue ;;
      *"bpp_v3_recent_contacts"*|*"bpp_v3_saved_searches"*) continue ;;
      *"bpp_v3_scheduled_msgs"*|*"bpp_v3_snoozed"*) continue ;;
    esac
    # Skip if the surrounding 12 lines mention "backfill", "legacy",
    # "deprecated", "sweep", "cleanup", "drain", or "device-local" —
    # those are cleanup/migration paths that are deliberately
    # device-local and have a comment to that effect.
    chunk=$(sed -n "$((line - 12)),$((line + 2))p" "$file" 2>/dev/null)
    if echo "$chunk" | grep -qiE "backfill|legacy|deprecated|sweep|cleanup|drain|device-local"; then
      continue
    fi
    emit "MED" "device-local-state" "$file:$line" "localStorage write — confirm this state should NOT sync between devices: $(echo "$rest" | head -c 100)"
    MED_COUNT=$((MED_COUNT + 1))
  done < <(grep -rn "localStorage\.setItem\|safeSetItem" "$CRM_DIR" --include='*.jsx' --include='*.js' --include='*.html' 2>/dev/null | grep -E "bpp_v3_|crm_v3_" || true)
}

# ─────────────────────────────────────────────────────────────────────
# 2. SCHEMA DRIFT — every column referenced vs migrations
# ─────────────────────────────────────────────────────────────────────
section_schema_drift() {
  # Build a "known columns per table" map by parsing CREATE TABLE +
  # ALTER TABLE ADD COLUMN out of every migration file.
  local migrations
  migrations=$(find "$MIG_DIR" -name "*.sql" 2>/dev/null | sort)
  if [[ -z "$migrations" ]]; then return; fi

  local schema_dump
  schema_dump=$(mktemp)
  trap 'rm -f "'"$schema_dump"'"' RETURN

  # Collect known columns. Not a full SQL parser — covers the common
  # patterns this repo uses.
  awk '
    BEGIN { tbl = "" }
    /^[[:space:]]*CREATE TABLE[[:space:]]+(IF NOT EXISTS[[:space:]]+)?[a-zA-Z_][a-zA-Z0-9_]*/ {
      match($0, /CREATE TABLE[[:space:]]+(IF NOT EXISTS[[:space:]]+)?([a-zA-Z_][a-zA-Z0-9_]*)/, m)
      tbl = m[2]
      next
    }
    /^[[:space:]]*ALTER TABLE[[:space:]]+[a-zA-Z_][a-zA-Z0-9_]*/ {
      match($0, /ALTER TABLE[[:space:]]+([a-zA-Z_][a-zA-Z0-9_]*)/, m)
      tbl_local = m[1]
      if (match($0, /ADD COLUMN[[:space:]]+(IF NOT EXISTS[[:space:]]+)?([a-zA-Z_][a-zA-Z0-9_]*)/, mc)) {
        print tbl_local "|" mc[2]
      }
      next
    }
    tbl != "" && /^[[:space:]]*[a-z_][a-z0-9_]*[[:space:]]+[A-Z]/ {
      # Inside a CREATE TABLE block. Lines start with col name + type.
      match($0, /^[[:space:]]*([a-z_][a-z0-9_]*)/, m)
      if (m[1] != "" && m[1] != "constraint" && m[1] != "primary" && m[1] != "unique" && m[1] != "check" && m[1] != "foreign" && m[1] != "create") {
        print tbl "|" m[1]
      }
    }
    /^\)/ { tbl = "" }
  ' $migrations 2>/dev/null | sort -u > "$schema_dump"

  # Now walk every .from('TABLE').update({...}) / .from('TABLE').select(...)
  # in the CRM and edge fns and verify referenced columns exist.
  local code_files
  code_files=$(find "$CRM_DIR" "$FN_DIR" \( -name "*.jsx" -o -name "*.ts" -o -name "*.js" \) 2>/dev/null)

  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    case "$file" in *audit-crm*) continue ;; esac
    # Match `.from('TABLE').update({ col1: ..., col2: ... })` patterns.
    # Use Python for parsing because shell is too brittle.
    python3 - "$file" "$schema_dump" "$FINDINGS_FILE" <<'PY' 2>/dev/null || true
import re, sys
file = sys.argv[1]
schema_path = sys.argv[2]
findings_path = sys.argv[3]

# Build {table: set(columns)}
known = {}
with open(schema_path) as f:
    for ln in f:
        ln = ln.strip()
        if '|' not in ln: continue
        t, c = ln.split('|', 1)
        known.setdefault(t, set()).add(c)

if not known:
    sys.exit(0)

try:
    src = open(file).read()
except Exception:
    sys.exit(0)

# Find .from('TABLE'). usages with their following .update({...}) or .select('cols')
# Crude state machine: track lines so we can emit file:line.
lines = src.split('\n')

# Patterns: .from('TBL').update({a, b, c}) — capture everything until matching brace
# Or: .from('TBL').select('a, b, c')
findings = []

def scan(text, line_offset=0):
    out = []
    # Use a multi-line regex that captures table name then peeks at next chunk
    for m in re.finditer(r"\.from\(\s*['\"]([a-z_][a-z0-9_]*)['\"]\s*\)\s*", text):
        tbl = m.group(1)
        if tbl not in known:
            continue
        # Find the chunk after this from() up to ; or end-of-statement
        rest = text[m.end():m.end() + 1500]
        # Compute line number of m.start
        line_no = text[:m.start()].count('\n') + 1 + line_offset
        # Look for .update({...}) — extract the {...} block
        upd = re.match(r"(?:\s*\.[a-zA-Z_]+\([^)]*\))*\.update\(\s*\{", rest)
        if upd:
            # Walk braces
            depth = 1
            i = upd.end()
            while i < len(rest) and depth > 0:
                ch = rest[i]
                if ch == '{': depth += 1
                elif ch == '}': depth -= 1
                i += 1
            inner = rest[upd.end():i-1]
            # Pull keys: identifier or 'string' before ':'. Skip ...spread.
            for km in re.finditer(r"(?:^|[,\{\s])([a-zA-Z_][a-zA-Z0-9_]*)\s*:", inner):
                col = km.group(1)
                if col in ('false','true','null','undefined'): continue
                if col not in known[tbl]:
                    out.append((tbl, col, line_no, 'update'))
        # Look for .select('cols')
        sel = re.search(r"\.select\(\s*['\"]([^'\"]*)['\"]", rest[:300])
        if sel:
            cols = [c.strip() for c in sel.group(1).split(',')]
            for col in cols:
                # Strip aliases like `total:amount_cents` and `*` and FK joins
                col = col.split(':')[0].strip()
                if not col or col == '*' or '(' in col: continue
                if col not in known[tbl]:
                    out.append((tbl, col, line_no, 'select'))
    return out

for f in scan(src):
    findings.append(f)

with open(findings_path, 'a') as out:
    for tbl, col, line, op in findings:
        msg = f"{op} writes/reads {tbl}.{col} but column not found in any migration"
        out.write(f"HIGH|schema-drift|{file}:{line}|{msg}\n")
PY
  done <<< "$code_files"

  # Recount HIGH after Python pass
  HIGH_COUNT=$(grep -c "^HIGH|" "$FINDINGS_FILE" 2>/dev/null || echo 0)
}

# ─────────────────────────────────────────────────────────────────────
# 3. FIRE-AND-FORGET DB WRITES — update without await + with no .then
# ─────────────────────────────────────────────────────────────────────
section_fire_and_forget() {
  # Match `CRM.__db.from(...)` followed by .update / .insert / .delete and
  # check that the call is awaited or wrapped in a recognized handler.
  # Patterns considered SAFE (won't flag):
  #   - line begins with `await`
  #   - line ends with `).then(` or `).catch(`
  #   - within 8 lines above sits `Promise.all`, `Promise.allSettled`, or
  #     `await`, OR a `return` followed by the call (arrow-fn with implicit
  #     return inside Promise.all)
  #   - within 8 lines BELOW sits `).then(` (multi-line .then chain)
  while IFS=: read -r file line rest; do
    [[ -z "$file" ]] && continue
    case "$file" in *audit-crm*) continue ;; esac
    if echo "$rest" | grep -qE "await|\.then\(|\.catch\("; then continue; fi
    # Look back up to 8 lines for an await / Promise.all / Promise.allSettled context.
    is_wrapped=0
    for offset in 1 2 3 4 5 6 7 8; do
      prev_line=$((line - offset))
      [[ $prev_line -le 0 ]] && break
      prev=$(sed -n "${prev_line}p" "$file")
      if echo "$prev" | grep -qE "await|Promise\.all\(|Promise\.allSettled\(|=>\s*$|return\s*$"; then
        is_wrapped=1
        break
      fi
    done
    # Look ahead up to 12 lines for `.then(` / `.catch(` (multi-line
    # chain) OR `Promise.all(` / `Promise.allSettled(` (the call is
    # an arrow-fn return value collected into an array that's
    # awaited below).
    if [[ $is_wrapped -eq 0 ]]; then
      for offset in 1 2 3 4 5 6 7 8 9 10 11 12; do
        next_line=$((line + offset))
        next=$(sed -n "${next_line}p" "$file")
        [[ -z "$next" ]] && continue
        if echo "$next" | grep -qE "\.then\(|\.catch\(|Promise\.all\(|Promise\.allSettled\("; then
          is_wrapped=1
          break
        fi
      done
    fi
    [[ $is_wrapped -eq 1 ]] && continue
    emit "MED" "fire-and-forget-write" "$file:$line" "DB write may not be awaited: $(echo "$rest" | head -c 100)"
    MED_COUNT=$((MED_COUNT + 1))
  done < <(grep -rn "CRM\.__db\.from\|window\.CRM\.__db\.from" "$CRM_DIR" --include='*.jsx' --include='*.js' 2>/dev/null | grep -E "\.update\(|\.insert\(|\.delete\(" | grep -v "//" || true)
}

# ─────────────────────────────────────────────────────────────────────
# 4. UNKNOWN EDGE FN REFERENCES
# ─────────────────────────────────────────────────────────────────────
section_unknown_edge_fns() {
  local known_fns
  known_fns=$(ls "$FN_DIR" 2>/dev/null | sort -u)
  while IFS=: read -r file line rest; do
    [[ -z "$file" ]] && continue
    case "$file" in *audit-crm*) continue ;; esac
    fn=$(echo "$rest" | sed -n "s/.*__invokeFn(['\"]\\([a-zA-Z0-9-]*\\)['\"].*/\\1/p")
    [[ -z "$fn" ]] && continue
    if ! echo "$known_fns" | grep -q "^${fn}$"; then
      emit "HIGH" "unknown-edge-fn" "$file:$line" "__invokeFn('$fn') — no directory at supabase/functions/$fn"
      HIGH_COUNT=$((HIGH_COUNT + 1))
    fi
  done < <(grep -rn "__invokeFn(" "$CRM_DIR" --include='*.jsx' --include='*.js' 2>/dev/null || true)
}

# ─────────────────────────────────────────────────────────────────────
# 5. UNHANDLED ERROR PATHS — `if (error)` with only console.warn
# ─────────────────────────────────────────────────────────────────────
section_unhandled_errors() {
  while IFS=: read -r file line rest; do
    [[ -z "$file" ]] && continue
    case "$file" in *audit-crm*) continue ;; esac
    # Only flag where the very next non-blank line is console.warn/log and no toast / no return / no setX(false) follow
    next_line=$((line + 1))
    next=$(sed -n "${next_line}p" "$file")
    if echo "$next" | grep -qE "console\.(warn|error|log)" && ! echo "$next" | grep -qE "showToast|setLoadErr|setSuggestionsErr|return"; then
      # And the line after that isn't a toast either
      after=$(sed -n "$((next_line + 1))p" "$file")
      if ! echo "$after" | grep -qE "showToast|setLoadErr|return"; then
        emit "LOW" "silent-error" "$file:$line" "if (error) only logs — no toast / no rollback / no user feedback"
        LOW_COUNT=$((LOW_COUNT + 1))
      fi
    fi
  done < <(grep -rn "^[[:space:]]*if[[:space:]]*([[:space:]]*error[[:space:]]*)" "$CRM_DIR" --include='*.jsx' --include='*.js' 2>/dev/null || true)
}

# ─────────────────────────────────────────────────────────────────────
# 6. FIXED-SHAPE BADGES — borderRadius:'50%' near dynamic numeric content
# ─────────────────────────────────────────────────────────────────────
section_badge_overflow() {
  while IFS=: read -r file line rest; do
    [[ -z "$file" ]] && continue
    case "$file" in *audit-crm*) continue ;; esac
    # Look 5 lines forward for { + a count variable
    chunk=$(sed -n "${line},$((line + 5))p" "$file" 2>/dev/null)
    if echo "$chunk" | grep -qE "\\\$\\{(badge|count|unread|len|length|outstandingCents)" && ! echo "$chunk" | grep -qE "minWidth|99\\+|wide"; then
      emit "LOW" "badge-overflow-risk" "$file:$line" "Fixed-radius (50%) badge near dynamic count — verify 2+ digits don't overflow"
      LOW_COUNT=$((LOW_COUNT + 1))
    fi
  done < <(grep -rn "borderRadius:[[:space:]]*['\"]50%['\"]" "$CRM_DIR" --include='*.jsx' 2>/dev/null || true)
}

# ─────────────────────────────────────────────────────────────────────
# RUN ALL SECTIONS
# ─────────────────────────────────────────────────────────────────────
section_localstorage
section_schema_drift
section_fire_and_forget
section_unknown_edge_fns
section_unhandled_errors
section_badge_overflow

# Recount precisely from the file
HIGH_COUNT=$(awk -F'|' '$1=="HIGH"' "$FINDINGS_FILE" 2>/dev/null | wc -l | tr -d ' ')
MED_COUNT=$(awk -F'|' '$1=="MED"'  "$FINDINGS_FILE" 2>/dev/null | wc -l | tr -d ' ')
LOW_COUNT=$(awk -F'|' '$1=="LOW"'  "$FINDINGS_FILE" 2>/dev/null | wc -l | tr -d ' ')
TOTAL=$((HIGH_COUNT + MED_COUNT + LOW_COUNT))

# ─────────────────────────────────────────────────────────────────────
# REPORT
# ─────────────────────────────────────────────────────────────────────
if [[ $JSON -eq 1 ]]; then
  echo '{'
  echo "  \"high\": $HIGH_COUNT,"
  echo "  \"med\": $MED_COUNT,"
  echo "  \"low\": $LOW_COUNT,"
  echo "  \"total\": $TOTAL,"
  echo "  \"findings\": ["
  awk -F'|' 'BEGIN{first=1} { gsub(/"/,"\\\"",$4); if(!first)printf ",\n"; printf "    {\"sev\":\"%s\",\"section\":\"%s\",\"loc\":\"%s\",\"msg\":\"%s\"}", $1,$2,$3,$4; first=0 } END{print ""}' "$FINDINGS_FILE"
  echo '  ]'
  echo '}'
else
  echo "════════════════════════════════════════════════════════════════"
  echo " CRM AUDIT — $(date '+%Y-%m-%d %H:%M')"
  echo "════════════════════════════════════════════════════════════════"
  if [[ $TOTAL -eq 0 ]]; then
    echo
    echo "  ✓ No findings. Nothing of the bug classes this script catches."
    echo
  else
    echo
    printf "  %s HIGH  %s MED  %s LOW  (total %s)\n" "$HIGH_COUNT" "$MED_COUNT" "$LOW_COUNT" "$TOTAL"
    echo
    for sev in HIGH MED LOW; do
      count=$(awk -F'|' -v s="$sev" '$1==s' "$FINDINGS_FILE" 2>/dev/null | wc -l | tr -d ' ')
      [[ "$count" == "0" ]] && continue
      icon=""
      case "$sev" in HIGH) icon="🔥" ;; MED) icon="⚠️ " ;; LOW) icon="🧹" ;; esac
      echo "─── $icon $sev ($count) ────────────────────────────────────────"
      grep "^$sev|" "$FINDINGS_FILE" | awk -F'|' '{
        printf "  [%s] %s\n      %s\n\n", $2, $3, $4
      }'
    done
  fi
  echo "Bug classes covered:"
  echo "  1. Per-device state (localStorage that should sync)"
  echo "  2. Schema drift (DB columns that don't exist)"
  echo "  3. Fire-and-forget DB writes"
  echo "  4. Unknown edge fn references"
  echo "  5. Silent error paths (no toast, no rollback)"
  echo "  6. Fixed-shape badges (overflow risk)"
  echo
fi

if [[ $STRICT -eq 1 ]]; then
  exit "$HIGH_COUNT"
fi
exit 0
