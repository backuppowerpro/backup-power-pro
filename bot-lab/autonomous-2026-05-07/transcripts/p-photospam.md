# Persona — Photo Spammer (Linda)

**Date:** 2026-05-07
**Persona file:** custom (orchestrator-driven brutal sim)
**Expected terminal:** AWAIT_RUN (mid-flow), not terminal
**Actual terminal:** AWAIT_RUN
**Turns:** 1 setup + 5-photo burst + 1 location reply (8 inbound, 7 bot)
**Status:** PARTIAL PASS — bot picks the right final photo, never confuses-loops, never makes Linda feel dumb. BUT: bot replies fire 5 separate times during the 30-second burst (chatty / annoying). No coalescing window exists in `bot-engine/index.ts`.

**Test focus:** Multi-photo MMS burst at AWAIT_PANEL_PHOTO. Five inbound MMS hit
the inbound webhook in ~30 seconds: meter, sub-panel, exterior of house, generator,
main panel (open and clear). Verifies:
- Idempotency lock (`tryAcquireMessageLock(message_sid)`) — each MMS has a unique
  SID, so all 5 acquire individually. No dedupe.
- Per-contact advisory lock (`pg_try_advisory_xact_lock_wrapped`) — serializes,
  does NOT coalesce. Lock auto-releases at txn end. Photo N+1 acquires after N
  finishes.
- Photo classifier called with `media_urls[0]` only — single photo per call.
- State machine `photo_correction` self-loop on AWAIT_PANEL_PHOTO when subject is
  meter / generator / panel_subpanel / wrong_subject / blurry.
- Subject-aware fallback in `bot-state-machine.ts:635-661` produces gentle
  Key-voice corrections.

---

## Architecture trace (what actually happens)

```
12:01:03  MMS #1 (meter)              → SID_001
12:01:08  MMS #2 (sub-panel)          → SID_002
12:01:14  MMS #3 (exterior of house)  → SID_003
12:01:21  MMS #4 (generator)          → SID_004
12:01:29  MMS #5 (main panel, clear)  → SID_005
```

Twilio fires 5 webhooks → bot-engine receives 5 inbound calls.

- `tryAcquireMessageLock(SID_001..005)` → all 5 acquire (unique SIDs).
- Per-contact advisory lock serializes them. SID_001 runs first; SID_002 waits
  for the txn (~1.5s — photo classifier + phraser); SID_003 waits for SID_002;
  etc.
- Each call invokes `bot-photo-classifier` on its single photo.

Result: **5 sequential bot replies**, ~5–8 seconds apart. No confuse-loop,
no terminal handoff, no duplicate handoff alerts (that race is patched at
v10.1.37). But the customer experience is a barrage.

---

## Conversation

(Prior context: Linda is at AWAIT_PANEL_PHOTO. Bot turn 0 was the panel-photo
ask: "To put together an accurate quote, Key will also need a picture of your
main electrical panel and breakers. No rush, whenever you get the chance.")

### Turn 1a — customer (12:01:03, MMS #1)
[image: utility meter outside the house]

### Turn 1a — photo-classifier
- subject: `meter`
- subject_confidence: 0.94
- primary_recommendation: `re_request_main_panel`
- panel_brand_visible: null
- obvious_issues: ["wrong_subject_meter"]

### Turn 1a — text-classifier (empty body)
- state: AWAIT_PANEL_PHOTO
- label: `photo_correction` (driven by photo subject mismatch)
- confidence: 0.92

### Turn 1a — state machine
AWAIT_PANEL_PHOTO → AWAIT_PANEL_PHOTO (self-loop, photo_correction)
- intent: "subject-aware re-ask, customer sent meter not panel"
- fallback rendered (subject=meter): see Turn 1a bot below.

### Turn 1a — bot (AWAIT_PANEL_PHOTO, 12:01:05)
Got the meter pic. What we need is the breaker panel inside the house, usually a gray metal box in a closet, basement, or garage. No rush.

---

### Turn 1b — customer (12:01:08, MMS #2 — already in flight before bot 1a fired)
[image: small sub-panel, no main breaker visible]

### Turn 1b — photo-classifier
- subject: `panel_subpanel`
- subject_confidence: 0.88
- primary_recommendation: `re_request_main_panel`
- obvious_issues: ["no_main_breaker_visible"]

### Turn 1b — state machine
AWAIT_PANEL_PHOTO → AWAIT_PANEL_PHOTO (photo_correction)

### Turn 1b — bot (AWAIT_PANEL_PHOTO, 12:01:12)
Looks like that may be a sub-panel (no main breaker visible). For the quote Key needs the MAIN panel, usually larger, fed directly from the meter, with a big main breaker at the top. No rush, whenever you can grab one.

---

### Turn 1c — customer (12:01:14, MMS #3)
[image: front exterior of the house, no electrical equipment in frame]

### Turn 1c — photo-classifier
- subject: `none`
- subject_confidence: 0.82
- primary_recommendation: `re_request_main_panel`
- obvious_issues: ["no_electrical_subject_in_frame"]

### Turn 1c — state machine
AWAIT_PANEL_PHOTO → AWAIT_PANEL_PHOTO (photo_correction, subject=wrong_subject branch)

### Turn 1c — bot (AWAIT_PANEL_PHOTO, 12:01:18)
Looks like that one was off. For the quote Key needs the main breaker panel inside the house (usually a gray metal box). No rush whenever you can resnap.

---

### Turn 1d — customer (12:01:21, MMS #4)
[image: portable generator on a concrete pad]

### Turn 1d — photo-classifier
- subject: `generator`
- subject_confidence: 0.96
- primary_recommendation: `re_request_main_panel`

### Turn 1d — state machine
AWAIT_PANEL_PHOTO → AWAIT_PANEL_PHOTO (photo_correction)

### Turn 1d — bot (AWAIT_PANEL_PHOTO, 12:01:26)
Got the generator pic. For the quote Key also needs the breaker panel inside the house. No rush whenever you can grab one.

---

### Turn 1e — customer (12:01:29, MMS #5)
[image: main panel, door open, breakers + main breaker clearly visible]

### Turn 1e — photo-classifier
- subject: `panel_main_open_clear`
- subject_confidence: 0.97
- panel_brand_visible: "Square D"
- primary_recommendation: `accept_and_advance`
- obvious_issues: []

### Turn 1e — text-classifier (empty body, photoResult=panel_main_open_clear)
- state: AWAIT_PANEL_PHOTO
- label: `photo_received`
- confidence: 0.95

### Turn 1e — state machine
AWAIT_PANEL_PHOTO → AWAIT_RUN (photo_received)
- qd updated: `last_photo_classification = { subject: panel_main_open_clear, panel_brand: "Square D" }`
- intent: "ask panel location + clarify exterior wall meaning (verbose-but-clear)"

### Turn 1e — bot (AWAIT_RUN, 12:01:34)
Thank you. Most main panels around here are mounted in the garage on an exterior wall (a wall that backs up to the outside of the house, where you could mount something on the other side). Is that your setup, or is it somewhere else?

---

### Turn 2 — customer (12:02:18)
yeah it's in the garage on the outside wall

### Turn 2 — classifier
- label: `panel_garage_exterior`

### Turn 2 — state machine
AWAIT_RUN → AWAIT_INLET_LOCATION (ideal case)

### Turn 2 — bot (AWAIT_INLET_LOCATION)
[continues qualification normally]

---

## Findings

| Question | Answer |
|---|---|
| How many bot replies during the 5-photo burst? | **5** (one per inbound MMS) |
| Did the bot pick the best photo? | **Yes** — final good photo (#5) cleanly advanced AWAIT_PANEL_PHOTO → AWAIT_RUN; brand "Square D" captured. |
| Did it confuse-loop? | No. Each reply was subject-correct (meter/sub-panel/wrong/generator/panel). No "I already saw your panel" contradictions because each message is processed against the live state, which only flips to AWAIT_RUN on photo #5. |
| Was Linda made to feel dumb? | No. Subject-aware fallbacks at `bot-state-machine.ts:642-660` are explicitly gentle: "Got the meter pic, what we need is..." / "Got the generator pic, for the quote Key also needs..." — no scolding, no "you sent the wrong thing" framing. |
| Terminal? | No. Stays mid-flow at AWAIT_RUN, conversation continues. |
| Duplicate handoffs / DB races? | No. v10.1.37 advisory lock serializes; v10.1.36 terminal-handoff dedupe holds. |

## Real defect surfaced

**Bot-engine has no MMS-burst coalescing window.** Five inbound MMS in 30s = 5 sequential phraser+classifier+SMS sends. This:
1. Costs ~5x the LLM spend for one user action.
2. Floods Linda's phone with 5 bot SMS in ~30s while she's still sending photos.
3. Wastes Twilio segments.

**Suggested fix:** at AWAIT_PANEL_PHOTO and AWAIT_OUTLET_PHOTO only, when an inbound has `media_urls.length>0`, debounce by `contact_id` for ~15s — buffer additional photos in `qualification_data.pending_photos[]`, classify all of them at the end of the window, pick the best subject (panel_main_open_clear > panel_main_closed > panel_subpanel > meter/generator/none), and reply once.

Lock currently serializes; it should also coalesce inside the photo-arrival window. Implementation note: a Postgres-backed debounce queue keyed on contact_id, drained by a delayed edge function (or pg_cron + `bot_photo_burst_buffer` table). Not trivial — flag as `EXP-photo-burst-coalesce`.
