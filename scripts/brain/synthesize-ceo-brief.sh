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
SERVICE_KEY=$(grep "Service Role Key" "$CREDS" | grep -o "eyJ[A-Za-z0-9._-]*" | head -1)

if [ -z "$ANTHROPIC_KEY" ]; then
  echo "[synthesize-ceo-brief] ERROR: No Anthropic key found" >&2; exit 1
fi

sb_get() {
  curl -s "$SUPABASE_URL/rest/v1/sparky_memory?$1" \
    -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY"
}
sb_upsert() {
  curl -s -X POST "$SUPABASE_URL/rest/v1/sparky_memory" \
    -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" -H "Prefer: resolution=merge-duplicates" \
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

meta_cpl    = first_num(r'(?:cost per lead|CPL)[^\d\$]*[\$]?([\d,]+\.?\d*)', meta)
meta_spend  = first_num(r'(?:spend|amount spent)[^\d\$]*[\$]?([\d,]+\.?\d*)', meta)
meta_leads  = first_num(r'(?:^|\|)\s*(?:leads|lead count)\s*\|\s*([\d,]+)', meta)
site_uv     = first_num(r'(?:unique visitor)[^\d]*([\d,]+)', ph)
site_conv   = first_num(r'(?:conversion rate)[^\d]*([\d.]+)', ph)
site_leads  = first_num(r'(?:lead form|lead_captured|lead submit)[^\d]*([\d]+)', ph)
crm_active  = first_num(r'(?:active contact)[^\d]*([\d]+)', crm)
crm_pipe    = first_num(r'(?:pipeline value)[^\d\$]*[\$]?([\d,]+)', crm)
crm_close   = first_num(r'(?:conversion rate|close rate)[^\d]*([\d.]+)', crm)
crm_new     = first_num(r'(?:new lead|new contact)[^\d]*([\d]+)', crm)

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

Today is $TODAY. You have today's live metrics AND multi-week trend data. Write a CEO Morning Brief that thinks in trajectories — not snapshots. Where is each metric heading? What does that trajectory mean for the business? When should we recalibrate what 'good' looks like?

Rules:
- If CPL has been dropping consistently, don't say 'CPL is under target' — say the floor is moving and what new ceiling makes sense
- If close rate is declining, that's a crisis signal even if the number still looks OK
- Connect the dots: ad performance → site traffic → pipeline → revenue
- Surface the 1-2 decisions Key should make TODAY given where things are heading
- If any permit is Ready to Pay, call it out — it costs money to sit on it
- End with 'What I'd tackle first:' and one specific action
- Max 280 words. Confident operating partner tone. No bullet dumps.

Business context:
- Original CPL target was under \$30 — recalibrate if trends warrant it
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
${PERMIT_DATA:-No active permits or permit check unavailable}"

# ── Call Claude ──
PROMPT_FILE=$(mktemp /tmp/bpp-ceo-prompt.XXXXXX)
echo "$PROMPT" > "$PROMPT_FILE"
REQUEST_FILE=$(mktemp /tmp/bpp-ceo-request.XXXXXX)
python3 -c "
import json
prompt = open('$PROMPT_FILE').read()
payload = {
    'model': 'claude-haiku-4-5',
    'max_tokens': 500,
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

BRIEF=$(echo "$RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d['content'][0]['text'])
except Exception as e:
    print('Brief unavailable: ' + str(e))
")

if [ -z "$BRIEF" ] || echo "$BRIEF" | grep -q "Brief unavailable"; then
  echo "[synthesize-ceo-brief] Claude synthesis failed" >&2; exit 1
fi

# ── Write brief to Supabase ──
BRIEF_JSON=$(python3 -c "
import json, sys
brief = sys.stdin.read()
print(json.dumps({'key': 'ceo_morning_brief', 'value': brief}))
" <<< "$BRIEF")

sb_upsert "$BRIEF_JSON"

# ── Also write to Sparky inbox → CRM notification + Twilio ping to Key ──
# Short summary with the key numbers. Full brief is in the Briefing card below.
INBOX_SUMMARY="Morning brief ready — CPL \$$META_CPL | $META_LEADS leads this week | Pipeline \$$CRM_PIPELINE"
[ -n "$CRM_CLOSE" ] && INBOX_SUMMARY="$INBOX_SUMMARY | Close rate $CRM_CLOSE%"

# Extract "What I'd tackle first:" line from brief as suggested action
TACKLE=$(echo "$BRIEF" | grep -A2 "What I.d tackle first" | tail -1 | sed 's/^[[:space:]]*//')
[ -z "$TACKLE" ] && TACKLE="See full briefing in the Briefing section below."

INBOX_JSON=$(python3 -c "
import json
print(json.dumps({
  'agent': 'brief',
  'priority': 'normal',
  'summary': '''$INBOX_SUMMARY''',
  'suggested_action': '''$TACKLE'''
}))
")

curl -s -X POST "$SUPABASE_URL/functions/v1/sparky-notify" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "$INBOX_JSON" > /dev/null

echo "[synthesize-ceo-brief] CEO brief + snapshot + inbox written ($TODAY $TS) — CPL=\$$META_CPL leads=$META_LEADS pipeline=\$$CRM_PIPELINE"
