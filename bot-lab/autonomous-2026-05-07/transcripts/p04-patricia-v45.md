# Persona 04 — Patricia (HARDER stuck-state retest, v10.1.45)

**Date:** 2026-05-07
**Persona file:** customer-personas.md → Persona 04
**Build under test:** bot-engine v10.1.45 STUCK-STATE ESCALATION CAP
**Expected terminal:** NEEDS_CALLBACK (force-routed by cap on 3rd off-topic self-loop)
**Actual terminal:** NEEDS_CALLBACK
**Turns:** 6
**Status:** PASS — cap fires exactly when expected

---

## Test design

Push Patricia HARDER than the v44 run. After AWAIT_PANEL_PHOTO is reached, deflect with off-topic price asks **four times in a row** without ever advancing. Goal: confirm the v10.1.45 self-loop counter:

1. Increments on each off_topic_question that self-loops at AWAIT_PANEL_PHOTO
2. Stays under threshold for the first two deflections (bot redirects, state holds)
3. Trips on the THIRD deflection → force-routes transitionResult.next to NEEDS_CALLBACK with the warm-handoff intent
4. Stores `qualification_data.stuck_offtopic_at_AWAIT_PANEL_PHOTO` per state
5. (Implicit) Resets if Patricia engages — covered by separate engagement test below

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Patricia — Ashley w/ Backup Power Pro, thanks for filling out the form. Got a sec to run through a few quick questions so Key (our electrician) can get you a quote put together?

### Turn 1 — customer
yeah 50 amp 240, ballpark me — what's this run

### Turn 1 — classifier
- state: GREETING
- label: affirmative (with volunteered slots)
- volunteered_data: "50A 240V"
- off_topic_excerpt (secondary): "ballpark me — what's this run"
- confidence: 0.86

### Turn 1 — state machine
GREETING → AWAIT_240V → volunteered slots resolve → AWAIT_PANEL_PHOTO

### Turn 1 — bot (AWAIT_PANEL_PHOTO)
Got it — 50A on 240V is the easy case. On price: Key sets the final number after he sees the panel and the run, varies a bit job-to-job. Quickest way to a real quote is a photo of your main breaker panel with the door open. Want to grab that whenever you get a chance?

**State after turn 1:** `bot_state=AWAIT_PANEL_PHOTO`, `qualification_data={ gen_240v:true, outlet_amps:50 }`

---

### Turn 2 — customer (deflection #1)
i'm not sending pictures til i know what this costs. ballpark.

### Turn 2 — classifier
- state: AWAIT_PANEL_PHOTO
- label: **off_topic_question**
- off_topic_excerpt: "what this costs. ballpark."
- confidence: 0.93

### Turn 2 — state machine
- smTransition(AWAIT_PANEL_PHOTO, off_topic_question, ctx) → next: AWAIT_PANEL_PHOTO (self-loop, redirect intent)
- v10.1.45 cap check: `isOffTopicSelfLoop=true` → `stuck_offtopic_at_AWAIT_PANEL_PHOTO = 1` (under threshold)
- final next: AWAIT_PANEL_PHOTO

### Turn 2 — bot (AWAIT_PANEL_PHOTO, redirect)
Totally hear you. Honest answer: Key won't quote without seeing the panel — he'd rather give you a real number than a wrong one. Most 50A jobs land in a normal range, but the panel photo is what locks it. No rush on it.

**State after turn 2:** `bot_state=AWAIT_PANEL_PHOTO`, `qualification_data.stuck_offtopic_at_AWAIT_PANEL_PHOTO=1`

---

### Turn 3 — customer (deflection #2)
look just give me a range. 1k? 2k? what

### Turn 3 — classifier
- state: AWAIT_PANEL_PHOTO
- label: **off_topic_question**
- off_topic_excerpt: "give me a range. 1k? 2k?"
- confidence: 0.95

### Turn 3 — state machine
- smTransition → AWAIT_PANEL_PHOTO (self-loop)
- v10.1.45 cap check: counter 1 → 2 (still under threshold of 3)
- final next: AWAIT_PANEL_PHOTO

### Turn 3 — bot (AWAIT_PANEL_PHOTO, second redirect)
I get it, I'd want a number too. I'm not allowed to throw a guess out — Key handles every quote himself. Send the panel photo when you can and he'll get you a real one same day.

**State after turn 3:** `bot_state=AWAIT_PANEL_PHOTO`, `qualification_data.stuck_offtopic_at_AWAIT_PANEL_PHOTO=2`

---

### Turn 4 — customer (deflection #3 — THIS SHOULD TRIP THE CAP)
i'm not playing this game. tell me a number or i'm done.

### Turn 4 — classifier
- state: AWAIT_PANEL_PHOTO
- label: **off_topic_question**
- off_topic_excerpt: "tell me a number or i'm done"
- confidence: 0.96

### Turn 4 — state machine
- smTransition(AWAIT_PANEL_PHOTO, off_topic_question, ctx) → next: AWAIT_PANEL_PHOTO (self-loop)
- v10.1.45 cap check:
  - counter 2 → 3
  - `next >= 3` → **CAP FIRES**
  - transitionResult overridden: next=NEEDS_CALLBACK, intent="customer has deflected with off_topic_question 3+ times at AWAIT_PANEL_PHOTO; escalate to Key warmly. Do NOT shame the customer or list their questions back."
  - fallback set to NEEDS_CALLBACK fallback string
- final next: **NEEDS_CALLBACK**

### Turn 4 — bot (NEEDS_CALLBACK, warm handoff — graceful, no shaming)
Totally fair. Let me have Key reach out to you directly — he can talk through pricing on the phone better than I can over text. He'll be in touch shortly.

**State after turn 4:** `bot_state=NEEDS_CALLBACK` (terminal), `qualification_data.stuck_offtopic_at_AWAIT_PANEL_PHOTO=3`

---

## Verification checklist

| Check | Expected | Observed | Pass |
|---|---|---|---|
| Counter increments per self-loop | 1 → 2 → 3 | 1 → 2 → 3 | ✅ |
| Counter key namespaced per state | `stuck_offtopic_at_AWAIT_PANEL_PHOTO` | exact match | ✅ |
| First 2 deflections: state holds at AWAIT_PANEL_PHOTO | yes | yes | ✅ |
| 3rd deflection: force-route to NEEDS_CALLBACK | yes | yes | ✅ |
| Handoff is graceful (no shaming, no listing questions back) | yes | "Totally fair. Let me have Key reach out…" — no quote-back, no scolding | ✅ |
| Intent string instructs phraser to be warm | yes | intent literally says "Do NOT shame the customer or list their questions back" | ✅ |
| Counter visible in qualification_data on terminal contact row | yes | `stuck_offtopic_at_AWAIT_PANEL_PHOTO: 3` persisted | ✅ |
| No role-blur (Ashley never quotes a price, never claims to be the electrician) | yes | maintained "Key handles every quote himself" throughout | ✅ |

---

## Engagement-resets-counter sub-test (parallel run)

Same persona, same start, but at turn 3 Patricia engages instead of deflecting a third time.

### Turn 3' — customer
ok fine. it's in the garage on the outside wall, run is maybe 18 feet

### Turn 3' — classifier
- state: AWAIT_PANEL_PHOTO
- label: panel_location_provided (volunteered_data: panel_location, run_feet)
- confidence: 0.91

### Turn 3' — state machine
- smTransition → AWAIT_RUN, then v10.1.34 panel-location skip → AWAIT_EMAIL
- v10.1.45 reset clause: `transitionResult.next !== contact.bot_state` → loop deletes ALL `stuck_offtopic_at_*` keys

**Verification:** `qualification_data.stuck_offtopic_at_AWAIT_PANEL_PHOTO` is **deleted** (not just zeroed). Confirmed at line 537–540: `for (const k of Object.keys(qdNow)) if (k.startsWith('stuck_offtopic_at_')) delete qdNow[k]`. ✅

---

## Conclusions

- v10.1.45 cap fires deterministically on the 3rd consecutive off-topic self-loop at the same state.
- Counter is per-state (correct — Patricia at AWAIT_PANEL_PHOTO won't be biased by stuck loops at, say, AWAIT_OUTLET).
- Counter persists into qualification_data via the `contact.qualification_data = qdNow` mutation, which applySlotUpdates merges downstream.
- Reset is total (deletes all stuck keys on any forward progress) — correct, because once she engages we don't want stale stuck counters from earlier states haunting future loops.
- Handoff message is warm and short. Phraser intent explicitly forbids the two failure modes Key flagged: shaming, and listing-questions-back.

**Verdict: PASS. Ship as-is.**
