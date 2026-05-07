# Ashley Pre-Rollout Readiness Checklist

> Single-source punch list of what's done, what Key needs to do, and what's deferred to next session. Read this AFTER `SESSION-VERDICT.md`.

---

## ✓ Done (no Key action needed)

### Voice + behavior
- [x] 5-pillar voice north star locked at top of phraser prompt + brain (warm, easy to talk to, trust building, confident, professional)
- [x] 600+ outbound bot messages across 35+ persona simulations, 0 audit hits in production filter path
- [x] Em-dash + en-dash hard ban (regex)
- [x] Awesome. opener hard ban (regex any-occurrence)
- [x] Slang ban: y'all, holler, cool, ha, sweet, gotcha, yep, right on
- [x] Desperation-tell bans: "I just want," "I would be happy," "I appreciate," "I apologize"
- [x] No professional-judgment generalizations ("most X are Y") — defer to Key or generator-lookup
- [x] No "Quote due by tomorrow morning" anywhere (11 instances killed across phraser + state machine)

### Edge cases
- [x] Hostile customer (Don) → STOPPED clean, no defensive replies
- [x] Bot-skeptic (Tony) → AI disclosure honest + conversation continues at any state
- [x] Burst texter (Brad) → coalesced into one reply
- [x] Photo spammer (Linda) → 5-second debounce, last photo wins (1 reply for 5-photo burst)
- [x] Email typo (Tom) → caught + polite confirm
- [x] Renter mid-flow disclosure (Liar persona) → universal escape catches "landlord" keyword + DQ_RENTER from any state
- [x] Multi-generator customer (Steve) → primary picked, secondary captured for handoff
- [x] Cold lead returning days later (Jen) → clean reconnection, no awkward "thanks for getting back"
- [x] Mid-flow cancellation (Brian) → POSTPONED with door's-open fallback (not NEEDS_CALLBACK begging)
- [x] Workshop owner with detached structure → NEEDS_CALLBACK with sub-panel flag
- [x] Stuck-state escalation cap (Patricia) → 3 deflections at same state auto-escalates
- [x] Storm urgency (Carl) → no over-promise, no apologetic register, clean callback handoff

### Robustness
- [x] Per-message-SID idempotency lock (prevents duplicate processing)
- [x] Per-contact advisory lock (serializes concurrent inbounds)
- [x] LLM fetch timeouts (12s with AbortController, no more hung edge fns)
- [x] Send-fail state-rollback (state advance reverts if send-sms fails)
- [x] Photo burst coalescing (5s debounce on photo states)
- [x] Stage 1→2 auto-advance on first customer reply (both Ashley + Alex paths)
- [x] Permit-pipeline carve-out preserved (Stage 4+ no AI customer comms except permit status)

### Routing
- [x] OpenPhone wildcard active for customer-facing sends (Twilio 10DLC immune)
- [x] Internal alerts (lead-volume, permit-morning-check, comm-orchestrator stalled-digest, handoff-notifier) all OpenPhone-aware
- [x] oosaCities synced with sc-jurisdictions.json (Anderson, Oconee, Cherokee, Laurens, Greenwood + city stubs)

### Build 2 (per-jurisdiction permit playbook)
- [x] permits/jurisdictions.json: 5-jurisdiction reference data (URL, submission method, typical_days, contact info)
- [x] comm-orchestrator wired with per-jurisdiction typical_days lookup for stage 5 +3d copy

### Build 1 (comm-orchestrator)
- [x] Edge function deployed, all triggers wired
- [x] Cron-fired hourly via alex-followup-hourly piggyback (workaround for migration drift)

---

## ⏳ Key's action items (60 sec each)

1. **Backfill the existing 62 frozen-Stage-1 contacts.**
   ```sql
   UPDATE contacts SET stage=2 WHERE stage=1 AND id IN (
     SELECT contact_id FROM messages WHERE direction='inbound' GROUP BY contact_id
   );
   ```
   Run in Supabase SQL Editor. Surfaces engaged-but-hidden leads in CRM Stage 2 lane immediately. Going forward both Ashley + Alex will auto-advance.

2. **Tyler-style live test from your cell.**
   Text Ashley 3-5 conversations as different personas (happy 240v owner, confused 120v, hostile, urgent). Read the replies on your phone. The simulator surfaces structural / voice issues at scale; live testing surfaces what only YOU notice when reading the bot's reply on YOUR phone. Past Tyler rounds each surfaced 4-5 things the dojo missed.

3. **Optional: 5-10 panel photos for photo-classifier verification** before flipping the gate. Plan B from `bot-lab/eval/v10.1.14-photo-classifier-test-plan.md`. Run them through bot-photo-classifier endpoint, manually label results. ~$0.30 of API cost. Catches false-positive sub-panel-as-main detection before customers see it.

After 1+2 (and optionally 3) all clean: flip `ASHLEY_ALLOWED_PHONES` from `+19414417996` to `*`. Watch first 10 real conversations closely.

---

## 📋 Deferred to next session(s)

- **Per-jurisdiction permit state tracker** (Build 2 deeper). Per-permit state machine (submitted → ready_to_pay → approved → scheduled → closed) with auto-detection of state changes from notes markers. Currently Greenville auto-tracks via permit-morning-check; others are manual.
- **Spartanburg / Pickens / City portals auto-checking.** Each needs a portal-specific scraper similar to permit-morning-check. Multi-day work.
- **Photo classifier dedicated test against real photos** (synthetic done; real 10-photo verification pending).
- **EXP-009 greeting variant decision** (sample target 40 still in flight).
- **Fully resolve the local-vs-remote migration history drift** so cron migrations can deploy via db push instead of piggyback workaround.

---

## Net state

- **Bot pipeline shipped + tested across 35+ adversarial scenarios.**
- **Production-readiness gaps closed** at the structural level (robustness, routing, stage advancement, voice).
- **Build 1 (comm-orchestrator) actively running** via piggyback cron.
- **Build 2 (jurisdictions playbook) foundation shipped** + integrated.
- **Internal alerts restored** (no longer silently failing on 10DLC).

When Key flips the gate after Tyler test passes, Ashley should hold up under real customer load. The simulator showed her holding all 5 voice pillars even under hostile / urgent / lying / confused / cancelling customers. The structural failure modes (stuck-state, send-fail, photo bursts) all have explicit guards now.

The one thing simulator can't tell us: how she SOUNDS to Key when he reads her replies on his phone. That's the Tyler test. Past rounds proved that step always finds 4-5 things the dojo misses. Worth doing before broader rollout.
