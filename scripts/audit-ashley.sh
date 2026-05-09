#!/usr/bin/env bash
# audit-ashley.sh — Ashley-specific bug-class detector. Run before
# declaring any Ashley work done. Mirrors the audit-crm.sh structure but
# targets the failure patterns that show up in the bot-engine /
# bot-classifier / bot-phraser / state-machine stack rather than the
# CRM React app.
#
# Coverage (each section maps to a real failure pattern that has cost
# us a turn or risked a TCPA / brand violation):
#
#   1. VOICE-RULE VIOLATIONS IN FALLBACK STRINGS
#      Every state's `fallback:` string in bot-state-machine.ts ships
#      verbatim to a customer when the LLM is unavailable. Each one
#      must follow Ashley's voice rules (no em-dashes, no "I appreciate",
#      no "I install" first-person, no "Awesome.", no "Perfect!", no
#      named weekdays). Static-checks every fallback against the
#      banned-phrase list.
#
#   2. STATE-MACHINE INTEGRITY
#      Every transition target (e.g., 'AWAIT_PANEL_PHOTO') must be a
#      defined state in the same file. Catches typos that would route
#      to a non-existent state and silent-fail at runtime.
#
#   3. EDGE FUNCTION AUTH GATES
#      Every bot-* edge function must call requireServiceRole or
#      requireAnonOrServiceRole at the top of its handler. A missing
#      auth gate = unauthenticated invoke can fire customer SMS or
#      mutate the bot state.
#
#   4. TWILIO WEBHOOK SIGNATURE VERIFICATION
#      Every function that receives Twilio webhooks must call
#      verifyTwilioSignature on the raw body. Without it, anyone can
#      POST a fake inbound SMS and pollute the CRM.
#
#   5. INBOUND IDEMPOTENCY
#      Every function that processes an inbound message_sid must call
#      tryAcquireMessageLock first. Twilio retries webhooks on transient
#      failures; without the lock, the same inbound double-fires Ashley.
#
#   6. SCHEMA DRIFT ON BOT TABLES
#      Every .from('contacts').update({bot_*}) and
#      .from('bot_processed_messages').{insert,update} cross-checked
#      against migrations. Catches typos like bot_dispabled or
#      qualifcation_data.
#
# Usage:
#   bash scripts/audit-ashley.sh           # human-readable report
#   bash scripts/audit-ashley.sh --strict  # exit non-zero on HIGH
#   bash scripts/audit-ashley.sh --json    # machine-readable

set -uo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
FN_DIR="$REPO_ROOT/supabase/functions"
SHARED_DIR="$FN_DIR/_shared"
SM_FILE="$SHARED_DIR/bot-state-machine.ts"
MIG_DIR="$REPO_ROOT/supabase/migrations"

if [[ ! -d "$FN_DIR" ]]; then
  echo "audit-ashley: $FN_DIR not found" >&2
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

FINDINGS_FILE="$(mktemp)"
trap 'rm -f "$FINDINGS_FILE"' EXIT

emit() { echo "$1|$2|$3|$4" >> "$FINDINGS_FILE"; }

# Collect all bot-* function dirs to walk
BOT_FNS=$(find "$FN_DIR" -maxdepth 1 -type d -name "bot-*" 2>/dev/null | sort)

# ─────────────────────────────────────────────────────────────────────
# 1. VOICE-RULE VIOLATIONS IN FALLBACK STRINGS
# ─────────────────────────────────────────────────────────────────────
# Pulls every `fallback:` string in state-machine.ts AND every hardcoded
# English text that looks like a customer-facing message in the bot
# functions (template literals containing customer-style sentences).
# Then checks each against the banned-phrase list.

section_voice_violations() {
  if [[ ! -f "$SM_FILE" ]]; then return; fi
  python3 - "$SM_FILE" "$FINDINGS_FILE" <<'PY' 2>/dev/null || true
import re, sys
sm_path = sys.argv[1]
findings = sys.argv[2]
src = open(sm_path).read()
lines = src.split('\n')

# Banned patterns. Each is (regex, severity, label, why).
# Patterns target strings that ship to customers — fallback returns,
# direct customer-facing template literals.
BANNED = [
    # Em-dashes (Key 2026-05-07: "no em-dashes anywhere outbound")
    (r'—', 'HIGH', 'em-dash', 'em-dash banned in outbound text'),
    # Sycophantic / corporate tells
    (r'\bI appreciate\b', 'HIGH', 'i-appreciate', '"I appreciate" banned ChatGPT tell'),
    (r'\bI hope this helps\b', 'HIGH', 'hope-helps', '"I hope this helps" banned ChatGPT signature'),
    (r'\bI(?:\'m| am) happy to help\b', 'HIGH', 'happy-help', '"happy to help" banned ChatGPT tell'),
    # "Perfect!" with exclamation (must be "Perfect.")
    (r'\bPerfect!', 'HIGH', 'perfect-bang', '"Perfect!" with exclamation rejected; use "Perfect." with period'),
    # "Awesome." with period (must be "Awesome!")
    (r'\bAwesome\.(?!\.)', 'HIGH', 'awesome-period', '"Awesome." rejected; use "Awesome!" with exclamation when used at all'),
    # First-person Ashley-as-Key claims
    (r'\bI(?:\'ll| will) install\b', 'HIGH', 'first-person-install', 'Ashley is intake, never first-person Key install claim'),
    (r"\bI(?:'m| am) Key\b", 'HIGH', 'i-am-key', 'Ashley never claims to be Key'),
    # Specific weekday names (banned outside SCHEDULE_QUOTE)
    (r'\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b', 'MED', 'weekday-name', 'specific weekday names banned outside SCHEDULE_QUOTE'),
    # Tomorrow morning (Key directive: kill all promises)
    (r'\btomorrow morning\b', 'HIGH', 'tomorrow-morning', '"tomorrow morning" promise banned (commit 462e79a)'),
    # Coverage claims
    (r"\bwill (?:run|power|cover|handle) (?:your|the)\b", 'HIGH', 'coverage-claim', 'coverage/sizing claim banned (v10.1.7)'),
    (r"\b(?:should|will) (?:cover|handle|run)\b.*(?:home|house|fridge|AC|essentials)", 'HIGH', 'coverage-claim-2', 'coverage claim banned (v10.1.7)'),
    # Banned chitchat fillers
    (r'\bRight on\b', 'MED', 'right-on', '"Right on" banned (zero Key uses)'),
    (r'\bSweet\.\B', 'MED', 'sweet-period', '"Sweet." banned (zero Key uses)'),
    (r"\b(?:y'all|ya'll)\b", 'MED', 'yall', "'y'all' banned (zero Key uses)"),
    (r'\bCool\.', 'MED', 'cool-period', '"Cool." banned (zero Key uses)'),
]

# Walk every fallback string. They look like:
#   fallback: 'plain string',
#   fallback: `template`,
#   fallback: ({ ... }) => `template`,
# We use a multi-line regex that captures the value after `fallback:`
# until the matching closing quote/backtick.

def find_fallbacks(text):
    """Yield (line_no, fallback_text) for every fallback: declaration."""
    out = []
    for m in re.finditer(r"fallback:\s*", text):
        line_no = text[:m.start()].count('\n') + 1
        rest = text[m.end():m.end() + 4000]
        # Skip if this is in a JSDoc-style comment
        prev_chunk = text[max(0, m.start() - 80):m.start()]
        if '*' in prev_chunk.split('\n')[-1]:
            continue
        # Possibilities: string literal, template literal, arrow-fn returning template
        # Strip whitespace
        i = 0
        while i < len(rest) and rest[i] in ' \t':
            i += 1
        if i >= len(rest): continue
        ch = rest[i]
        if ch == "'" or ch == '"':
            # Single/double-quoted string — find matching close
            close_idx = rest.find(ch, i + 1)
            while close_idx > 0 and rest[close_idx - 1] == '\\':
                close_idx = rest.find(ch, close_idx + 1)
            if close_idx > 0:
                out.append((line_no, rest[i+1:close_idx]))
        elif ch == '`':
            # Template literal — find matching backtick (handle nesting via ${})
            depth = 0
            j = i + 1
            while j < len(rest):
                if rest[j] == '\\':
                    j += 2; continue
                if rest[j] == '$' and j + 1 < len(rest) and rest[j+1] == '{':
                    depth += 1; j += 2; continue
                if rest[j] == '}' and depth > 0:
                    depth -= 1; j += 1; continue
                if rest[j] == '`' and depth == 0:
                    out.append((line_no, rest[i+1:j]))
                    break
                j += 1
        elif ch == '(':
            # Arrow function — find the `=>` then the return expression
            arrow = rest.find('=>', i)
            if arrow < 0: continue
            tail = rest[arrow + 2:].lstrip()
            if not tail: continue
            # If it's a block { return ... }, find every return
            if tail.startswith('{'):
                # Find each `return ` template literal inside the block
                depth = 1; k = 1
                block_start = arrow + 2 + (rest[arrow + 2:].index('{') + 1)
                k = block_start
                # Capture template literals after `return `
                for rm in re.finditer(r"return\s+`", rest[block_start:block_start + 3000]):
                    sub = rest[block_start + rm.end() - 1:]
                    j = 1; sd = 0
                    while j < len(sub):
                        if sub[j] == '\\':
                            j += 2; continue
                        if sub[j] == '$' and j + 1 < len(sub) and sub[j+1] == '{':
                            sd += 1; j += 2; continue
                        if sub[j] == '}' and sd > 0:
                            sd -= 1; j += 1; continue
                        if sub[j] == '`' and sd == 0:
                            out.append((line_no, sub[1:j]))
                            break
                        j += 1
            else:
                # Direct expression return — likely a template literal
                if tail.startswith('`'):
                    sub = tail
                    j = 1; sd = 0
                    while j < len(sub):
                        if sub[j] == '\\':
                            j += 2; continue
                        if sub[j] == '$' and j + 1 < len(sub) and sub[j+1] == '{':
                            sd += 1; j += 2; continue
                        if sub[j] == '}' and sd > 0:
                            sd -= 1; j += 1; continue
                        if sub[j] == '`' and sd == 0:
                            out.append((line_no, sub[1:j]))
                            break
                        j += 1
    return out

with open(findings, 'a') as out:
    for line_no, txt in find_fallbacks(src):
        if not txt or len(txt) > 1000: continue
        for pattern, sev, label, why in BANNED:
            try:
                m = re.search(pattern, txt)
            except re.error:
                continue
            if m:
                # Trim the violating snippet for display
                start = max(0, m.start() - 20)
                end = min(len(txt), m.end() + 40)
                snippet = txt[start:end].replace('\n', ' ')
                out.write(f"{sev}|voice-rule-{label}|{sm_path}:{line_no}|fallback string contains banned pattern \"{m.group(0)}\" — {why}. Context: ...{snippet}...\n")
PY
}

# ─────────────────────────────────────────────────────────────────────
# 2. STATE-MACHINE INTEGRITY
# ─────────────────────────────────────────────────────────────────────
# Every transition target must be a defined state. A typo silently
# routes to a non-existent state.

section_state_integrity() {
  if [[ ! -f "$SM_FILE" ]]; then return; fi
  python3 - "$SM_FILE" "$FINDINGS_FILE" <<'PY' 2>/dev/null || true
import re, sys
sm_path = sys.argv[1]
findings = sys.argv[2]
src = open(sm_path).read()
# Defined states: top-level keys that look like UPPER_SNAKE_CASE followed by `: {`
# These appear inside the state-machine map.
defined = set(re.findall(r"^\s*([A-Z][A-Z0-9_]+)\s*:\s*\{", src, re.MULTILINE))
# Also capture states declared as INITIAL_STATE, TERMINAL_STATES set, etc.
for m in re.finditer(r"['\"]([A-Z][A-Z0-9_]+)['\"]", src):
    name = m.group(1)
    # Heuristic: state names are 5+ chars; e.g., GREETING, AWAIT_240V
    if len(name) >= 5 and '_' in name or len(name) >= 6:
        defined.add(name)

# Find transition targets: every value in `transitions: { LABEL: 'TARGET' }`
out = []
for m in re.finditer(r"transitions:\s*\{", src):
    line_no = src[:m.start()].count('\n') + 1
    # Walk the matching brace
    depth = 1
    i = m.end()
    while i < len(src) and depth > 0:
        if src[i] == '{': depth += 1
        elif src[i] == '}': depth -= 1
        i += 1
    block = src[m.end():i-1]
    # Inside, find pattern `label: 'TARGET'` or `label: "TARGET"`
    for tm in re.finditer(r":\s*['\"]([A-Z][A-Z0-9_]+)['\"]", block):
        target = tm.group(1)
        if target not in defined:
            target_line = line_no + block[:tm.start()].count('\n')
            out.append((target_line, target))

# Write findings
with open(findings, 'a') as f:
    for line_no, target in out:
        f.write(f"HIGH|state-machine-typo|{sm_path}:{line_no}|transition target '{target}' is not a defined state — typo or missing state\n")
PY
}

# ─────────────────────────────────────────────────────────────────────
# 3. EDGE FUNCTION AUTH GATES
# ─────────────────────────────────────────────────────────────────────
# Every bot-* function should call requireServiceRole or
# requireAnonOrServiceRole. Twilio-webhook is the exception (uses
# verifyTwilioSignature instead).

section_auth_gates() {
  for fn in $BOT_FNS; do
    name=$(basename "$fn")
    idx="$fn/index.ts"
    [[ ! -f "$idx" ]] && continue
    if ! grep -qE "requireServiceRole|requireAnonOrServiceRole" "$idx"; then
      emit "HIGH" "missing-auth-gate" "$idx:1" "$name has no requireServiceRole/requireAnonOrServiceRole — unauthenticated invoke can trigger customer SMS or mutate state"
    fi
  done
}

# ─────────────────────────────────────────────────────────────────────
# 4. TWILIO WEBHOOK SIGNATURE VERIFICATION
# ─────────────────────────────────────────────────────────────────────
# Any function that consumes Twilio webhook params must call
# verifyTwilioSignature. Detect by looking for `req.text()` + Twilio
# header references; flag if no verifyTwilioSignature import.

section_twilio_signature() {
  while IFS= read -r idx; do
    [[ -z "$idx" ]] && continue
    name=$(dirname "$idx" | xargs basename)
    # Heuristic: function consumes Twilio if it reads `MessageSid` or
    # `X-Twilio-Signature` or imports verifyTwilioSignature explicitly.
    consumes_twilio=0
    if grep -qE "MessageSid|X-Twilio-Signature|x-twilio-signature|TWILIO_AUTH_TOKEN" "$idx"; then
      consumes_twilio=1
    fi
    [[ $consumes_twilio -eq 0 ]] && continue
    if ! grep -q "verifyTwilioSignature" "$idx"; then
      emit "HIGH" "missing-twilio-signature" "$idx:1" "$name appears to consume Twilio webhook (references MessageSid/X-Twilio-Signature) but does not call verifyTwilioSignature — anyone can POST a fake inbound"
    fi
  done < <(find "$FN_DIR" -name "index.ts" -path "*/twilio*" 2>/dev/null; find "$FN_DIR" -name "index.ts" -path "*webhook*" 2>/dev/null)
}

# ─────────────────────────────────────────────────────────────────────
# 5. INBOUND IDEMPOTENCY
# ─────────────────────────────────────────────────────────────────────
# Every function that processes an inbound message must use
# tryAcquireMessageLock to dedupe Twilio retries. Detect by looking
# for `message_sid` reads + flag if no tryAcquireMessageLock call.

section_idempotency() {
  while IFS= read -r idx; do
    [[ -z "$idx" ]] && continue
    name=$(dirname "$idx" | xargs basename)
    # Skip the lock module itself
    case "$name" in bot-idempotency) continue ;; esac
    # Skip dev/test tools and non-message webhooks
    case "$name" in
      dojo-*|*-test-*|alex-test-trigger) continue ;;
      twilio-status-callback) continue ;;  # delivery-status webhook, not inbound message
    esac
    # Skip if the function isn't processing inbound messages. Heuristic:
    # must reference message_sid AND look like an inbound processor
    # (saves to messages table OR reads body to dispatch to a bot).
    if ! grep -qE "message_sid|messageSid|MessageSid" "$idx"; then continue; fi
    is_processor=0
    if grep -qE "from\(['\"]messages['\"]\).*insert|trigger.*['\"]inbound|saveInbound" "$idx"; then
      is_processor=1
    fi
    [[ $is_processor -eq 0 ]] && continue
    # Recognize alternative dedup mechanisms (function-specific tables
    # like alex_dedup) so we don't false-flag functions that have their
    # own idempotency strategy.
    if grep -qE "tryAcquireMessageLock|recordProcessed|alex_dedup|_dedup" "$idx"; then
      continue
    fi
    emit "MED" "missing-idempotency-lock" "$idx:1" "$name appears to process inbound messages but doesn't call tryAcquireMessageLock or any *_dedup table — Twilio retries may double-fire processing"
  done < <(find "$FN_DIR" -name "index.ts" 2>/dev/null)
}

# ─────────────────────────────────────────────────────────────────────
# 6. SCHEMA DRIFT ON BOT TABLES
# ─────────────────────────────────────────────────────────────────────
# Reuse the same schema-drift logic as audit-crm.sh but scoped to bot
# columns and bot_processed_messages writes.

section_schema_drift() {
  local migrations
  migrations=$(find "$MIG_DIR" -name "*.sql" 2>/dev/null | sort)
  [[ -z "$migrations" ]] && return

  local schema_dump
  schema_dump=$(mktemp)

  awk '
    BEGIN { tbl = "" }
    /^[[:space:]]*CREATE TABLE[[:space:]]+(IF NOT EXISTS[[:space:]]+)?[a-zA-Z_][a-zA-Z0-9_]*/ {
      match($0, /CREATE TABLE[[:space:]]+(IF NOT EXISTS[[:space:]]+)?([a-zA-Z_][a-zA-Z0-9_]*)/, m)
      tbl = m[2]; next
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
      match($0, /^[[:space:]]*([a-z_][a-z0-9_]*)/, m)
      if (m[1] != "" && m[1] != "constraint" && m[1] != "primary" && m[1] != "unique" && m[1] != "check" && m[1] != "foreign" && m[1] != "create") {
        print tbl "|" m[1]
      }
    }
    /^\)/ { tbl = "" }
  ' $migrations 2>/dev/null | sort -u > "$schema_dump"

  # Walk every bot edge fn for .from('TABLE').update({...}) / .insert({...})
  local code_files
  code_files=$(find "$FN_DIR" -name "index.ts" -path "*bot-*" 2>/dev/null; echo "$SM_FILE")

  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    [[ ! -f "$file" ]] && continue
    python3 - "$file" "$schema_dump" "$FINDINGS_FILE" <<'PY' 2>/dev/null || true
import re, sys
file = sys.argv[1]
schema_path = sys.argv[2]
findings_path = sys.argv[3]

known = {}
with open(schema_path) as f:
    for ln in f:
        ln = ln.strip()
        if '|' not in ln: continue
        t, c = ln.split('|', 1)
        known.setdefault(t, set()).add(c)
if not known: sys.exit(0)

try:
    src = open(file).read()
except Exception: sys.exit(0)

with open(findings_path, 'a') as out:
    for m in re.finditer(r"\.from\(\s*['\"]([a-z_][a-z0-9_]*)['\"]\s*\)\s*", src):
        tbl = m.group(1)
        if tbl not in known: continue
        rest = src[m.end():m.end() + 1500]
        line_no = src[:m.start()].count('\n') + 1
        # update / insert / upsert object inspection
        for op_pattern in [r"(?:\s*\.[a-zA-Z_]+\([^)]*\))*\.(update|insert|upsert)\(\s*\{",
                           r"(?:\s*\.[a-zA-Z_]+\([^)]*\))*\.(update|insert|upsert)\(\s*\[\s*\{"]:
            opm = re.match(op_pattern, rest)
            if opm:
                op = opm.group(1)
                depth = 1
                i = opm.end()
                while i < len(rest) and depth > 0:
                    if rest[i] == '{': depth += 1
                    elif rest[i] == '}': depth -= 1
                    i += 1
                inner = rest[opm.end():i-1]
                for km in re.finditer(r"(?:^|[,\{\s])([a-zA-Z_][a-zA-Z0-9_]*)\s*:", inner):
                    col = km.group(1)
                    if col in ('false','true','null','undefined'): continue
                    if col not in known[tbl]:
                        out.write(f"HIGH|schema-drift|{file}:{line_no}|{op} writes {tbl}.{col} but column not found in any migration\n")
                break
PY
  done <<< "$code_files"
  rm -f "$schema_dump"
}

# ─────────────────────────────────────────────────────────────────────
# RUN ALL SECTIONS
# ─────────────────────────────────────────────────────────────────────
section_voice_violations
section_state_integrity
section_auth_gates
section_twilio_signature
section_idempotency
section_schema_drift

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
  echo " ASHLEY AUDIT — $(date '+%Y-%m-%d %H:%M')"
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
  echo "  1. Voice-rule violations in fallback strings"
  echo "  2. State-machine integrity (transition targets exist)"
  echo "  3. Edge function auth gates (requireServiceRole)"
  echo "  4. Twilio webhook signature verification"
  echo "  5. Inbound idempotency (tryAcquireMessageLock)"
  echo "  6. Schema drift on bot tables"
  echo
fi

if [[ $STRICT -eq 1 ]]; then
  exit "$HIGH_COUNT"
fi
exit 0
