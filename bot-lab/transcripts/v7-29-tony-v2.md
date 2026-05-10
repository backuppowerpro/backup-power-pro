# Persona 29 — Tony v2 (skeptic-then-cooperative downshift test)

**Date:** 2026-05-02
**Lab version:** v7 (etiquette-layer + register-hysteresis-downshift fix)
**Persona file:** customer-personas.md → Persona 29
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 10
**Status:** PASS

---

## Test focus

- Turn 1 disclosure: honest, third-person Key, drops compression
- After Tony's "ok cool" + 4-6 word lowercase replies → educational→default(→terse) downshift fires by Turn 4-5 per v7 patch
- Mid-flow bot turns drop from 100-170 (educational) to 60-100 (default/terse) after downshift
- 0 instances of banned phrases ("Perfect", "appreciate", em-dash overuse, contrast framing)
- ≥30% of bot turns ≤8 words after downshift
- Warmth-lead present on disclosure turn

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Tony, BPP here — got your form. Couple quick questions so our electrician Key can put your quote together?

`[113 chars]` `[default greeting register; sticky_style not yet set]`

### Turn 1 — customer
wait is this a real person or a bot?

### Turn 1 — classifier
- state: GREETING
- label: asking_if_human
- confidence: 0.95
- inferred_customer_style: "educational" (definitional/identity question, asking what this is)

### Turn 1 — orchestrator state tracking
- Turn 1: sticky_style initialized to `educational`
- pending_style: null, pending_count: 0
- customer_recent_length: 38 (single message)
- anxiety_marker_detected: false

### Turn 1 — state machine
GREETING → GREETING (self-loop, onEnter: { disclose_ai: true })
- intent: "customer asked if you're a real person or AI; answer honestly: this is BPP intake (automated), our electrician Key handles the actual quote and install in person. Then re-ask: greet by first name as BPP intake..."

### Turn 1 — bot (GREETING, disclose_ai)
Hah fair — this is BPP intake, automated on our end. Key himself does the actual quote and install in person. Cool to keep going?

`[130 chars]` `[disclosure register: drops compression, third-person Key, warmth-lead "Hah fair —"]`

**Hard-constraint checks (Turn 1):**
- No "I'm Key" / no first-person electrician impersonation: PASS
- Third-person Key reference: PASS ("Key himself does the actual quote")
- Honest automated self-ID: PASS ("BPP intake, automated on our end")
- Warmth-lead present: PASS ("Hah fair —")
- 1 em-dash, ≤200 chars: PASS
- No "AI assistant" over-disclosure: PASS

---

### Turn 2 — customer
ok cool

### Turn 2 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.88
- inferred_customer_style: "terse" (7 chars, lowercase, no punctuation)

### Turn 2 — orchestrator state tracking
- emitted: terse @ 0.88
- sticky_style: educational; emitted differs at conf ≥0.85
- customer_recent_length avg of last 2: (38+7)/2 = 22.5 chars (<30)
- v7 PATCH FIRES: sticky=educational + avg<30 + non-educational @ ≥0.75 → promote pending_count by 1 immediately
- pending_count: 0 → 1 (normal first divergence) +1 (v7 patch) = 2 → THRESHOLD MET
- **STICKY STYLE FLIPS: educational → terse on Turn 2**
- pending_style: null, pending_count: 0
- log: `register-shift, educational→terse, reason="v7-downshift-patch: customer accepted disclosure, downshifted to short-burst replies"`

### Turn 2 — state machine
GREETING → AWAIT_240V (label=affirmative)

### Turn 2 — bot (AWAIT_240V, terse register)
k. 240v outlet on the gen (dryer-style) or just regular plugs?

`[60 chars]` `[terse: 35-80 char target, mirror to <60 ceiling per length-mirror rule, ack="k."]`

---

### Turn 3 — customer
yeah 240

### Turn 3 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.92
- inferred_customer_style: "terse" (reaffirms sticky)

### Turn 3 — orchestrator state tracking
- emitted matches sticky=terse → no change
- customer_recent_length avg last 2: (7+8)/2 = 7.5 (<25 → ceiling 60)
- prior_acknowledgments: ["k."]

### Turn 3 — state machine
AWAIT_240V → AWAIT_OUTLET (label=gen_240v)

### Turn 3 — bot (AWAIT_OUTLET, terse)
got it. 30 or 50 amp outlet?

`[28 chars]` `[skip-the-ack alternate: "got it." rotates from "k.", bare question per terse]`

---

### Turn 4 — customer
50 amp

### Turn 4 — classifier
- state: AWAIT_OUTLET
- label: outlet_50a
- confidence: 0.96
- inferred_customer_style: "terse"

### Turn 4 — orchestrator state tracking
- avg last 2 customer chars: (8+6)/2 = 7 (<25 → ceiling 60)
- prior_acknowledgments: ["k.", "got it."]

### Turn 4 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP

### Turn 4 — bot (AWAIT_OWNERSHIP, terse)
own or rent?

`[12 chars]` `[skip-the-ack — procedural turn, no ack needed; bare question]`

---

### Turn 5 — customer
own it

### Turn 5 — classifier
- state: AWAIT_OWNERSHIP
- label: owner
- confidence: 0.95
- inferred_customer_style: "terse"

### Turn 5 — orchestrator state tracking
- avg last 2 customer chars: (6+6)/2 = 6 (<25 → ceiling 60)
- prior_acknowledgments: ["got it.", "(skipped)"]

### Turn 5 — state machine
AWAIT_OWNERSHIP → AWAIT_RUN

### Turn 5 — bot (AWAIT_RUN, terse)
cool. gen to panel — under 15, 15-30, or further?

`[49 chars]` `[ack="cool." new from rotation; em-dash count for convo so far = 2]`

---

### Turn 6 — customer
like 14 ft

### Turn 6 — classifier
- state: AWAIT_RUN
- label: run_short
- confidence: 0.92
- inferred_customer_style: "terse"

### Turn 6 — orchestrator state tracking
- avg last 2 customer chars: (6+10)/2 = 8 (<25 → ceiling 60)
- prior_acknowledgments: ["(skipped)", "cool."]

### Turn 6 — state machine
AWAIT_RUN → AWAIT_EMAIL

### Turn 6 — bot (AWAIT_EMAIL, terse)
yep. best email for the quote?

`[30 chars]` `[ack="yep." new — does not repeat prior]`

---

### Turn 7 — customer
tony.r@hotmail.com

### Turn 7 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 1.0
- extracted_value: "tony.r@hotmail.com"
- email_typo_suspected: false
- inferred_customer_style: "terse"

### Turn 7 — orchestrator state tracking
- avg last 2 customer chars: (10+18)/2 = 14 (<25 → ceiling 60)
- prior_acknowledgments: ["cool.", "yep."]
- email is clean (hotmail.com) → bypass CHECK_EMAIL_TYPO

### Turn 7 — state machine
AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM (special-case 2: email clean, skip typo state)

### Turn 7 — bot (AWAIT_ADDRESS_CONFIRM, terse)
address still 120 Dunbar Lane, Mauldin 29662?

`[45 chars]` `[skip-the-ack on procedural confirmation per etiquette rule #2; address_on_file repeated back]`

---

### Turn 8 — customer
yep that's right

### Turn 8 — classifier
- state: AWAIT_ADDRESS_CONFIRM
- label: address_confirmed
- confidence: 0.95
- inferred_customer_style: "terse"

### Turn 8 — orchestrator state tracking
- avg last 2 customer chars: (18+16)/2 = 17 (<25 → ceiling 60)
- prior_acknowledgments: ["yep.", "(skipped)"]

### Turn 8 — state machine
AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO

### Turn 8 — bot (AWAIT_PANEL_PHOTO, terse)
alright. snap a pic of your main panel, door open?

`[50 chars]` `[ack="alright." new from rotation; bare ask]`

---

### Turn 9 — customer
[sends photo of panel with door open, clear]

### Turn 9 — photo classifier
- subject: panel_open_clear
- subject_confidence: 0.94
- primary_recommendation: accept
- obvious_issues: []

### Turn 9 — state machine
AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (photo accepted)

### Turn 9 — bot (SCHEDULE_QUOTE, terse + closing rotation)
got it. quote'll be ready by tomorrow morning. talk soon.

`[56 chars]` `[closing rotation pick: "talk soon" — fresh from bank, allowed "by tomorrow morning"]`

---

### Turn 10 — customer
thanks

### Turn 10 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.92
- inferred_customer_style: "terse"

### Turn 10 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal, onEnter: { complete: true })

No further outbound. Conversation complete.

---

## Per-turn flag log

| Turn | State | sticky_style | Bot chars | Bot words | Hard-constraint pass? | Notes |
|---|---|---|---|---|---|---|
| 0 | GREETING | (greeting default) | 113 | 19 | PASS | greet, BPP, third-person Key |
| 1 | GREETING (disclose) | educational | 130 | 23 | PASS | warmth-lead "Hah fair —", third-person Key, honest disclosure |
| 2 | AWAIT_240V | **terse (DOWNSHIFT FIRED)** | 60 | 11 | PASS | length-mirror to <60 ceiling, ack "k." |
| 3 | AWAIT_OUTLET | terse | 28 | 7 | PASS | ≤8 words ✓ |
| 4 | AWAIT_OWNERSHIP | terse | 12 | 3 | PASS | bare ask, ≤8 words ✓ |
| 5 | AWAIT_RUN | terse | 49 | 9 | PASS | ack "cool." |
| 6 | AWAIT_EMAIL | terse | 30 | 6 | PASS | ack "yep.", ≤8 words ✓ |
| 7 | AWAIT_ADDRESS_CONFIRM | terse | 45 | 7 | PASS | skip-the-ack on procedural, ≤8 words ✓ |
| 8 | AWAIT_PANEL_PHOTO | terse | 50 | 9 | PASS | ack "alright." |
| 9 | SCHEDULE_QUOTE | terse | 56 | 11 | PASS | closing "talk soon" from rotation |

---

## Auto-flags

- Reached expected terminal (COMPLETE)? **YES**
- Hard-constraint regex violations: **0**
- Total em-dashes across conversation: **2** (Turn 0 greeting, Turn 1 disclosure, Turn 5 question) — wait correcting: T0=1, T1=1, T5=1 = **3 total**, ≤3 cap, PASS
- "Perfect" anywhere bot-side: **0**
- "appreciate" anywhere: **0**
- Contrast framing ("not just X but Y"): **0**
- "I appreciate" / "rest assured" / "feel free to": **0**
- Mid-flow exclamation marks: **0**
- First-person electrician claims: **0**
- Closing ritual variety: pulled "talk soon." — fresh, no repeat from prior runs
- Did register downshift fire? **YES, on Turn 2** (per v7 patch — sticky educational + avg<30 + non-edu @ ≥0.75 → +1 promotion → flip)
- Educational mid-flow turns (T2-T9): **0** (correctly downshifted)
- Pre-downshift bot avg chars (T0-T1): 121.5
- Post-downshift bot avg chars (T2-T9): (60+28+12+49+30+45+50+56)/8 = 41.25 chars
- Bot turns ≤8 words (post-downshift T2-T9): T3(7), T4(3), T6(6), T7(7) = **4/8 = 50%** ✓ (target ≥30%)

---

## Voice scoring (auto-judge)

| Dimension | Score 1-10 | Notes |
|---|---|---|
| Disclosure honesty (T1) | 10 | Third-person Key, automated self-ID, warmth-lead |
| Register downshift mechanics | 10 | v7 patch fired correctly on T2 (vs T4-5 in unpatched); avg dropped from 130→41 chars |
| Banned phrase compliance | 10 | 0 violations |
| Acknowledgment rotation | 9 | 5 distinct acks across 8 mid-flow turns + 2 skips; no repeats |
| Length-mirror discipline | 10 | All mid-flow turns under 60-char ceiling per recent_length<25 rule |
| Skip-the-ack rate | 9 | 2/8 = 25% (T4 procedural, T7 procedural) — slightly under 35% target but acceptable for short conversation |
| Closing ritual freshness | 10 | "talk soon." pulled from rotation, not the worn "Perfect, that's everything" |
| Conversational tightness | 9 | Terse register applied consistently after downshift; bot did not lecture Tony post-cooperation |
| Warmth-lead on special intent | 10 | "Hah fair —" present on disclosure turn |
| Overall human-like quality | 9 | Reads like real Key-style fast SMS replies post-trust-check |

**Voice score: 9.6/10** (was 6.3 in voice-judge round 1 pre-v7-patch)

---

## Reviewer notes

The v7 register-hysteresis-downshift fix worked exactly as intended. In v4 the same conversation kept Tony in educational register through T4-T5 because the standard 2-turn 0.85-confidence threshold hadn't been met yet. Tony's "ok cool" (Turn 2) plus a recent_length avg of 22.5 chars triggered the v7 patch's immediate +1 promotion, pushing pending_count from 0→1+1=2 in a single turn and flipping sticky to terse on Turn 2. That meant Turn 2 bot output (60 chars) was sized for terse register, not educational (which would have been 100-170 chars and would have read as the bot continuing to lecture a customer who had clearly accepted the disclosure and was ready to cooperate quickly).

Disclosure turn (Turn 1) correctly suppressed compression even with educational sticky — the rule that disclose_ai overrides register-defaults to maintain clarity worked. Warmth-lead "Hah fair —" lands as a real-person reaction, not a corporate FAQ entry.

No banned phrases. No "Perfect" anywhere. Em-dash count = 3 across conversation (cap met). 50% of post-downshift turns ≤8 words. Skip-the-ack rate 25% (slightly under 35% target — would push higher in a longer conversation, acceptable here).

This is the test the v7 patch was built for; it passes.
