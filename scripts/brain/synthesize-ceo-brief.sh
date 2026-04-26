#!/bin/bash
# synthesize-ceo-brief.sh
# 1. Extracts key metrics from today's wiki data pages
# 2. Saves a dated snapshot to sparky_memory (key: metrics_YYYY-MM-DD)
# 3. Loads last 28 days of snapshots to compute trends
# 4. Calls Claude to write a trend-aware CEO brief
# 5. Writes brief to sparky_memory (key: ceo_morning_brief)
set -uo pipefail

CREDS="/Users/keygoodson/.claude/credentials.md"
WIKI_DIR="/Users/keygoodson/Desktop/CLAUDE/wiki"
TODAY=$(date +%Y-%m-%d)
TS=$(date +%H:%M)

# ── Credentials ──
ANTHROPIC_KEY=$(grep "sk-ant-api" "$CREDS" | grep -o "sk-ant-[A-Za-z0-9_-]*" | head -1)
SUPABASE_URL="https://reowtzedjflwmlptupbk.supabase.co"
# Service role key was rotated out of credentials.md in the 2026-04-23
# leak audit. Local scripts now write via the brain-write edge function
# (allowlisted memory keys) using the publishable key for auth. Reads
# stay on direct PostgREST since they go through public endpoints.
PUBLISHABLE_KEY="sb_publishable_4tYd9eFAYCTjnoKl1hbBBg_yyO9-vMB"
SERVICE_KEY="$PUBLISHABLE_KEY"  # legacy alias for code below

if [ -z "$ANTHROPIC_KEY" ]; then
  echo "[synthesize-ceo-brief] ERROR: No Anthropic key found" >&2; exit 1
fi

sb_get() {
  curl -s "$SUPABASE_URL/rest/v1/sparky_memory?$1" \
    -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY"
}
sb_upsert() {
  # Routes through the brain-write edge function which holds the
  # SR key server-side. The SR JWT was rotated out of credentials.md
  # in the 2026-04-23 leak audit so direct PostgREST writes from the
  # local script are no longer possible. brain-write enforces an
  # allowlist on which sparky_memory keys can be written via this path.
  curl -s -X POST "$SUPABASE_URL/functions/v1/brain-write" \
    -H "Authorization: Bearer $PUBLISHABLE_KEY" \
    -H "Content-Type: application/json" \
    -d "$1" > /dev/null
}

# ── Read wiki pages ──
META_DATA="";    [ -f "$WIKI_DIR/Ads/Meta Performance.md" ]   && META_DATA=$(head -80 "$WIKI_DIR/Ads/Meta Performance.md")
POSTHOG_DATA=""; [ -f "$WIKI_DIR/Website/Site Analytics.md" ] && POSTHOG_DATA=$(head -60 "$WIKI_DIR/Website/Site Analytics.md")
CRM_DATA="";     [ -f "$WIKI_DIR/CRM/CRM Usage.md" ]          && CRM_DATA=$(head -80 "$WIKI_DIR/CRM/CRM Usage.md")

# Permit data written by fetch-permits.sh earlier in the same refresh run
PERMIT_DATA=""
[ -f /tmp/bpp-permit-summary.txt ] && PERMIT_DATA=$(cat /tmp/bpp-permit-summary.txt)

# ── Extract metrics using Python (macOS-safe) ──
read META_CPL META_SPEND META_LEADS SITE_UV SITE_CONV SITE_LEADS CRM_ACTIVE CRM_PIPELINE CRM_CLOSE CRM_NEW <<< $(python3 - <<PYEOF
import re, sys

def first_num(pattern, text, default="0"):
    m = re.search(pattern, text, re.IGNORECASE)
    if m:
        s = re.sub(r'[,\$]', '', m.group(1))
        return s
    return default

meta = """$META_DATA"""
ph   = """$POSTHOG_DATA"""
crm  = """$CRM_DATA"""

# Markdown tables wrap labels in **bold**, so allow optional ** before/after
# the label. Without these, fresh fetches of Meta Performance.md and Site
# Analytics.md silently extracted 0 because the regex hit "Leads" (bold)
# but couldn't see past the asterisks to the value.
# Match values that appear in markdown table cells of the form
# pipe-space-label-space-pipe-space-value-pipe. Without the table-cell
# anchor, the regex caught text like "CPL across campaigns" and extracted
# bogus numbers (got 7 instead of 29.06). Multi-line so ^ matches each
# row start.
# Label match consumes the start of the cell up through the next column
# delimiter. The trailing pattern after label allows extra tokens such as
# "(stage 1-8)" before the delimiter without breaking the value capture.
TBL = lambda label, val: r'(?:^|\|)\s*[*]{0,2}\s*(?:' + label + r')[^|\n]*\|\s*[$]?\s*(' + val + r')'
NUM = r'[\d,]+\.?\d*'
INT = r'[\d,]+'
def first_num_table(label, text, default='0', val=NUM):
    m = re.search(TBL(label, val), text, re.IGNORECASE | re.MULTILINE)
    if m:
        return re.sub(r'[,\$]', '', m.group(1))
    return default

meta_cpl    = first_num_table(r'cpl|cost per lead', meta)
meta_spend  = first_num_table(r'spend|amount spent', meta)
meta_leads  = first_num_table(r'leads|lead count', meta, val=INT)
site_uv     = first_num_table(r'unique visitor[s]?', ph, val=INT)
site_conv   = first_num_table(r'conversion rate', ph)
site_leads  = first_num_table(r'lead form submit[s]?|lead form|lead submits?', ph, val=INT)
crm_active  = first_num_table(r'active contact[s]?|active leads', crm, val=INT)
crm_pipe    = first_num_table(r'pipeline value|pipeline \\\$', crm, val=INT)
crm_close   = first_num_table(r'conversion rate|close rate', crm)
crm_new     = first_num_table(r'new lead[s]?|new contact[s]?', crm, val=INT)

print(meta_cpl, meta_spend, meta_leads, site_uv, site_conv, site_leads, crm_active, crm_pipe, crm_close, crm_new)
PYEOF
)

echo "[synthesize-ceo-brief] Metrics: CPL=\$$META_CPL leads=$META_LEADS pipeline=\$$CRM_PIPELINE close=$CRM_CLOSE%"

# ── Save today's snapshot ──
python3 - <<PYEOF | xargs -0 -I{} bash -c 'sb_upsert "$@"' _ {} 2>/dev/null || true
import json
d = {
    "key": "metrics_${TODAY}",
    "value": json.dumps({
        "date": "${TODAY}",
        "meta_cpl": float("${META_CPL}" or 0),
        "meta_spend_7d": float("${META_SPEND}" or 0),
        "meta_leads_7d": int(float("${META_LEADS}" or 0)),
        "site_visitors_7d": int(float("${SITE_UV}" or 0)),
        "site_conv_pct": float("${SITE_CONV}" or 0),
        "site_leads_7d": int(float("${SITE_LEADS}" or 0)),
        "crm_active": int(float("${CRM_ACTIVE}" or 0)),
        "crm_pipeline": int(float("${CRM_PIPELINE}" or 0)),
        "crm_close_pct": float("${CRM_CLOSE}" or 0),
        "crm_new_30d": int(float("${CRM_NEW}" or 0)),
    })
}
print(json.dumps(d))
PYEOF

# Simpler upsert for snapshot
SNAPSHOT_JSON=$(python3 -c "
import json
d = {
    'key': 'metrics_${TODAY}',
    'value': json.dumps({
        'date': '${TODAY}',
        'meta_cpl': float('${META_CPL}' or 0),
        'meta_spend_7d': float('${META_SPEND}' or 0),
        'meta_leads_7d': int(float('${META_LEADS}' or 0)),
        'site_visitors_7d': int(float('${SITE_UV}' or 0)),
        'site_conv_pct': float('${SITE_CONV}' or 0),
        'site_leads_7d': int(float('${SITE_LEADS}' or 0)),
        'crm_active': int(float('${CRM_ACTIVE}' or 0)),
        'crm_pipeline': int(float('${CRM_PIPELINE}' or 0)),
        'crm_close_pct': float('${CRM_CLOSE}' or 0),
        'crm_new_30d': int(float('${CRM_NEW}' or 0)),
    })
}
print(json.dumps(d))
")
sb_upsert "$SNAPSHOT_JSON"

# ── Load last 28 days for trend analysis ──
HISTORY_RAW=$(sb_get "key=like.metrics_*&select=key,value&order=key.desc&limit=28")

TREND_DATA=$(python3 - <<PYEOF
import json, sys

try:
    entries = json.loads("""$HISTORY_RAW""")
except:
    entries = []

rows = []
for e in entries:
    try:
        v = json.loads(e['value'])
        rows.append(v)
    except:
        pass
rows.sort(key=lambda x: x.get('date', ''))

if len(rows) < 2:
    print("Trend history building — first week of tracking. No WoW comparison yet.")
    sys.exit(0)

def fmt_val(v, key):
    if 'cpl' in key or 'spend' in key or 'pipeline' in key:
        return f"\${v:,.2f}" if isinstance(v, float) else f"\${v:,}"
    elif 'pct' in key or 'conv' in key or 'close' in key:
        return f"{v:.1f}%"
    else:
        return str(int(v))

def trend_line(key, label, higher_is_good=True):
    vals = [(r['date'], r.get(key, 0)) for r in rows if r.get(key, 0)]
    if len(vals) < 2:
        return None
    latest_date, latest = vals[-1]
    prev_date, prev = vals[-2]
    if prev == 0:
        return None
    pct = (latest - prev) / prev * 100
    if higher_is_good:
        icon = "✅" if pct > 5 else ("⚠️" if pct < -10 else "→")
    else:
        icon = "✅" if pct < -5 else ("⚠️" if pct > 10 else "→")
    arrow = "↑" if pct > 0 else "↓"
    return f"{icon} {label}: {fmt_val(prev,key)} → {fmt_val(latest,key)} ({arrow}{abs(pct):.0f}% WoW)"

lines = ["=== WEEK-OVER-WEEK TRENDS ==="]
for key, label, good in [
    ("meta_cpl",       "CPL",              False),
    ("meta_leads_7d",  "Weekly leads",     True),
    ("meta_spend_7d",  "Ad spend",         True),
    ("site_conv_pct",  "Site conversion",  True),
    ("site_visitors_7d","Site visitors",   True),
    ("crm_close_pct",  "Close rate",       True),
    ("crm_pipeline",   "Pipeline value",   True),
    ("crm_new_30d",    "New leads 30d",    True),
]:
    t = trend_line(key, label, good)
    if t:
        lines.append(t)

# 4-week trajectory signals
lines.append("\n=== TRAJECTORY SIGNALS (4-week view) ===")
signals = []

cpl_vals = [r.get("meta_cpl",0) for r in rows[-4:] if r.get("meta_cpl",0)]
if len(cpl_vals) >= 3:
    if cpl_vals[-1] < cpl_vals[0] * 0.75:
        signals.append(f"⚡ CPL dropped {((cpl_vals[0]-cpl_vals[-1])/cpl_vals[0]*100):.0f}% over 4 weeks (\${cpl_vals[0]:.2f} → \${cpl_vals[-1]:.2f}). Recalibrate ceiling — \$30 target is obsolete.")
    elif cpl_vals[-1] > cpl_vals[0] * 1.3:
        signals.append(f"🚨 CPL climbed {((cpl_vals[-1]-cpl_vals[0])/cpl_vals[0]*100):.0f}% over 4 weeks. Creative fatigue or audience saturation — refresh ads.")

conv_vals = [r.get("site_conv_pct",0) for r in rows[-4:] if r.get("site_conv_pct",0)]
if len(conv_vals) >= 3 and conv_vals[-1] > conv_vals[0] * 1.2:
    signals.append(f"⚡ Site conversion up {((conv_vals[-1]-conv_vals[0])/conv_vals[0]*100):.0f}% over 4 weeks. Funnel tightening — this is the time to scale traffic.")

close_vals = [r.get("crm_close_pct",0) for r in rows[-4:] if r.get("crm_close_pct",0)]
if len(close_vals) >= 3 and close_vals[-1] < close_vals[0] * 0.8:
    signals.append(f"🚨 Close rate down {((close_vals[0]-close_vals[-1])/close_vals[0]*100):.0f}% over 4 weeks. Sales process breaking down — review follow-up speed and messaging.")

if not signals:
    signals.append("No major trajectory alerts this week.")

lines.extend(signals)
print("\n".join(lines))
PYEOF
)

# ── Build synthesis prompt ──
PROMPT="You are the CEO brain of Backup Power Pro (BPP), a generator inlet installation business in Upstate SC owned by Key Goodson.

Today is $TODAY. You have today's live metrics AND multi-week trend data.

Write two things and return them as a JSON object:

1. \"brief\" — full CEO morning brief (~280 words). Thinks in trajectories, not snapshots. Where is each metric heading? Connect ad performance → site traffic → pipeline → revenue. Surface the 1-2 decisions Key should make TODAY. End with 'What I'd tackle first:' and one specific action. Confident operating partner tone. No bullet dumps.

2. \"sms\" — the SAME brief formatted for SMS text message. Plain text only (no markdown, no asterisks). Max 1600 chars. This will be texted directly to Key — make it punchy and readable on a phone screen. Start with BPP $TODAY, then the brief content, end with 'Tackle first: [action]'

Rules for both:
- If CPL dropping consistently: don't say 'under target' — say floor is moving and what new ceiling makes sense
- If close rate declining: treat as crisis signal even if number still looks OK
- If any permit is Ready to Pay, call it out first — it costs money to sit on
- Recalibrate targets based on actual trends

Business context:
- CPL target: under \$30 (recalibrate if trends warrant)
- Close rate target: 35-40% | Min job price: \$1,197
- Stage 3 trigger: installs exceed solo capacity (2-3/wk now, max 5/wk)
- Geography: Greenville, Spartanburg, Pickens only

--- TODAY'S SNAPSHOT ---
CPL=\$$META_CPL | Ad spend(7d)=\$$META_SPEND | Leads(7d)=$META_LEADS
Site visitors(7d)=$SITE_UV | Site conversion=$SITE_CONV% | Form leads=$SITE_LEADS
CRM active=$CRM_ACTIVE | Pipeline=\$$CRM_PIPELINE | Close rate=$CRM_CLOSE% | New leads(30d)=$CRM_NEW

--- TREND DATA ---
$TREND_DATA

--- RAW DETAIL (Meta) ---
$(echo "$META_DATA" | head -35)

--- RAW DETAIL (CRM) ---
$(echo "$CRM_DATA" | head -35)

--- PERMIT STATUS ---
${PERMIT_DATA:-No active permits or permit check unavailable}

Respond with ONLY a JSON object, no other text:
{\"brief\": \"...\", \"sms\": \"...\"}"

# ── Call Claude ──
PROMPT_FILE=$(mktemp /tmp/bpp-ceo-prompt.XXXXXX)
echo "$PROMPT" > "$PROMPT_FILE"
REQUEST_FILE=$(mktemp /tmp/bpp-ceo-request.XXXXXX)
python3 -c "
import json
prompt = open('$PROMPT_FILE').read()
payload = {
    'model': 'claude-sonnet-4-6',
    'max_tokens': 1200,
    'messages': [{'role': 'user', 'content': prompt}]
}
print(json.dumps(payload))
" > "$REQUEST_FILE"
rm -f "$PROMPT_FILE"

RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "@$REQUEST_FILE")
rm -f "$REQUEST_FILE"

# Write the raw response to a temp file so the Python parser can read it
# verbatim — past attempts inlined RAW_TEXT into a heredoc, which was
# fragile any time the content contained quotes or escape sequences the
# bash heredoc misinterpreted.
RAW_FILE=$(mktemp /tmp/bpp-brief-raw-XXXXXX)
echo "$RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d['content'][0]['text'])
except Exception as e:
    print('ERROR: ' + str(e))
" > "$RAW_FILE"
RAW_TEXT=$(head -c 200 "$RAW_FILE")  # short preview only, used in error message

# ── Parse structured JSON from Claude ──
PARSE_RESULT=$(RAW_FILE="$RAW_FILE" python3 - <<'PYEOF'
import json, re, sys, os

with open(os.environ['RAW_FILE'], 'r') as f:
    raw = f.read()

# Strip markdown code-fence wrappers (three-backtick + optional language tag)
# the model frequently emits even when asked for raw JSON.
fence = chr(96) * 3  # 3 backticks
stripped = raw.strip()
if stripped.startswith(fence):
    # drop the opening fence (and optional language tag) plus the closing fence
    stripped = re.sub(r'^' + fence + r'[a-zA-Z]*\s*', '', stripped)
    stripped = re.sub(r'\s*' + fence + r'\s*$', '', stripped)

# Try direct JSON parse first (most reliable).
parsed = None
try:
    parsed = json.loads(stripped)
except Exception:
    # Fall back to scanning for the outermost balanced {...} block.
    depth = 0
    start = -1
    for i, ch in enumerate(stripped):
        if ch == '{':
            if depth == 0: start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start >= 0:
                try:
                    parsed = json.loads(stripped[start:i+1])
                    break
                except Exception:
                    start = -1

if not parsed:
    print('PARSE_FAIL')
    sys.exit(0)

try:
    brief = parsed.get('brief', '')
    sms   = parsed.get('sms', brief)  # fallback to brief if sms missing
    if not brief:
        print('PARSE_FAIL')
        sys.exit(0)
    print('PARSE_OK')
    print(json.dumps({'brief': brief, 'sms': sms}))
except Exception as e:
    print('PARSE_FAIL')
PYEOF
)

PARSE_STATUS=$(echo "$PARSE_RESULT" | head -1)
if [ "$PARSE_STATUS" != "PARSE_OK" ]; then
  echo "[synthesize-ceo-brief] JSON parse failed — response: ${RAW_TEXT:0:200}" >&2; exit 1
fi

PARSED_JSON=$(echo "$PARSE_RESULT" | tail -1)

BRIEF=$(python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print(d['brief'])" <<< "$PARSED_JSON")
BRIEF_SMS=$(python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print(d['sms'])" <<< "$PARSED_JSON")

# ── Write brief to Supabase sparky_memory ──
BRIEF_SAVE=$(python3 -c "
import json, sys
brief = sys.stdin.read()
print(json.dumps({'key': 'ceo_morning_brief', 'value': brief}))
" <<< "$BRIEF")

sb_upsert "$BRIEF_SAVE"

# ── Write to Sparky inbox ──
# Inbox card is compact (Key already has full brief in SMS)
# Extract "What I'd tackle first:" line as suggested action
TACKLE=$(echo "$BRIEF" | grep -A2 "What I.d tackle first" | tail -1 | sed 's/^[[:space:]]*//')
[ -z "$TACKLE" ] && TACKLE="See CRM for details."

INBOX_SUMMARY="Morning brief — CPL \$$META_CPL | $META_LEADS leads | Pipeline \$$CRM_PIPELINE | Close $CRM_CLOSE%"

# Read all three vars from env to avoid bash interpolating apostrophes
# in TACKLE / INBOX_SUMMARY into Python string-literal syntax errors.
INBOX_JSON=$(
  INBOX_SUMMARY="$INBOX_SUMMARY" \
  TACKLE="$TACKLE" \
  BRIEF_SMS="$BRIEF_SMS" \
  python3 -c '
import json, os
print(json.dumps({
    "agent": "brief",
    "priority": "normal",
    "summary": os.environ.get("INBOX_SUMMARY", ""),
    "suggested_action": os.environ.get("TACKLE", ""),
    "sms_body": os.environ.get("BRIEF_SMS", ""),
}))
')

curl -s -X POST "$SUPABASE_URL/functions/v1/sparky-notify" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "$INBOX_JSON" > /dev/null

echo "[synthesize-ceo-brief] Brief sent ($TODAY $TS) — CPL=\$$META_CPL leads=$META_LEADS pipeline=\$$CRM_PIPELINE"
