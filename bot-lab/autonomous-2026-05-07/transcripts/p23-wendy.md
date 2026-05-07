# Persona 23 — Wendy (Wrong-Photo: Meter Instead of Panel)

**Date:** 2026-05-07
**Persona file:** customer-personas.md → Persona 23
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 12
**Status:** PASS

**Critical test:** Photo classifier must identify `meter` (not panel) when Wendy
sends a photo of her electric meter outside, and the bot must re-ask for the
panel without making her feel dumb. Then she sends the right photo on the
second try and conversation continues to SCHEDULE_QUOTE.

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Wendy — Ashley with Backup Power Pro. Saw your form come through. Got a sec for a few quick questions so Key can put your quote together?

### Turn 1 — customer
yes go ahead

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.96
- inferred_customer_style: default

### Turn 1 — state machine
GREETING → AWAIT_240V

### Turn 1 — bot (AWAIT_240V)
Perfect. I just want to confirm the outlet on your generator is 240V 30-amp or 50-amp. If you're not sure, snap a pic of the outlet whenever you get a chance.

### Turn 2 — customer
240, 50 amp twist lock

### Turn 2 — classifier
- state: AWAIT_240V
- label: outlet_50a
- confidence: 0.95
- extracted_value: "50A"
- volunteered_data: "50 amp twist lock (4-prong)"

### Turn 2 — state machine
AWAIT_240V → AWAIT_PANEL_PHOTO (50A skips outlet step)

### Turn 2 — bot (AWAIT_PANEL_PHOTO) — two-message split
A: Got it — 50 amp twist lock, that's perfect.
B: Last thing — to put the quote together Key will also need a quick pic of your main panel and breakers (the gray box inside with the breaker switches). No rush.

### Turn 3 — customer
ok one sec
[sends photo of electric meter on the outside wall of the house — round glass dome over a digital kWh readout, single utility connection, no breakers]

### Turn 3 — photo classifier
- subject: meter
- subject_confidence: 0.92
- amperage_visible: unknown
- prong_count: unknown
- panel_brand_visible: null
- is_main_panel_likely: false
- main_breaker_confidence: 0.95
- main_breaker_visual_signals: ["round glass dome over digital readout", "single utility connection (no branch breakers)", "exterior wall mount", "no breaker handles visible anywhere in frame"]
- obvious_issues: ["this is the utility meter, not the breaker panel"]
- primary_recommendation: ask_correct

### Turn 3 — state machine
- state stays at AWAIT_PANEL_PHOTO (recommendation = ask_correct)
- phraser intent: "wrong photo received (meter outside); thank them, explain panel is the gray metal box inside the house with breaker switches, give common locations (closet/garage/basement)"

### Turn 3 — bot (AWAIT_PANEL_PHOTO — re-ask, friendly)
Ah that's the meter outside — what we actually need is the breaker panel inside the house. Usually a gray metal box with a bunch of breaker switches inside, often in a closet, garage, or basement. Pop the door open and snap once you find it.

### Turn 4 — customer
ohh got it lol my bad

### Turn 4 — classifier
- state: AWAIT_PANEL_PHOTO
- label: friendly_chitchat
- confidence: 0.84
- chitchat_excerpt: "ohh got it lol my bad"
- inferred_customer_style: default

### Turn 4 — state machine
- self-loop AWAIT_PANEL_PHOTO (chitchat ack, no advance — still waiting on panel pic)
- phraser intent: "brief warm ack, no big deal, no re-explanation"

### Turn 4 — bot (AWAIT_PANEL_PHOTO — soft ack)
no worries, happens all the time

### Turn 5 — customer
[sends photo of opened gray panel inside garage — clear shot, ~24 breaker slots, double-pole 200A main breaker visible at top, "Cutler-Hammer" label readable]

### Turn 5 — photo classifier
- subject: panel_main_open_clear
- subject_confidence: 0.94
- panel_brand_visible: "Cutler-Hammer"
- panel_amperage_visible: "200A"
- is_main_panel_likely: true
- main_breaker_confidence: 0.93
- main_breaker_visual_signals: ["clear double-pole breaker at top labeled 200", "rows of 15A/20A branch breakers below", "well-lit, door open, full panel visible"]
- obvious_issues: []
- primary_recommendation: accept

### Turn 5 — state machine
AWAIT_PANEL_PHOTO → AWAIT_RUN (default-install-offer)

### Turn 5 — bot (AWAIT_RUN)
Got the photo — 200A Cutler-Hammer, clean for the interlock. Key's default install puts the inlet box right beside your panel with a 20-foot cord to your generator. That work for you?

### Turn 6 — customer
yes that works

### Turn 6 — classifier
- state: AWAIT_RUN
- label: affirmative
- confidence: 0.96

### Turn 6 — state machine
AWAIT_RUN → AWAIT_EMAIL

### Turn 6 — bot (AWAIT_EMAIL)
Perfect. To send the quote over — what's the best email, your last name, and is the install address the one on the form (30 Briar Patch Lane, Greer)?

### Turn 7 — customer
wendy.k@gmail.com, last name is Kessler, yes that address is right

### Turn 7 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.97
- extracted_value: "wendy.k@gmail.com"
- email_typo_suspected: false
- volunteered_data: "last name Kessler, address confirmed"

### Turn 7 — state machine
AWAIT_EMAIL → RECAP

### Turn 7 — bot (RECAP)
Got it. So: 50A 240V outlet, 200A Cutler-Hammer panel, default install at 30 Briar Patch Lane, quote going to wendy.k@gmail.com. Anything off?

### Turn 8 — customer
nope all good

### Turn 8 — classifier
- state: RECAP
- label: affirmative
- confidence: 0.95

### Turn 8 — state machine
RECAP → SCHEDULE_QUOTE

### Turn 8 — bot (SCHEDULE_QUOTE)
Perfect — Key will have your quote put together by tomorrow morning and send it right over.

### Turn 9 — customer
sounds good thanks

### Turn 9 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.97

### Turn 9 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal)

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|
| 0 | GREETING | PASS | — | greeting v3 |
| 1 | AWAIT_240V | PASS | — | paired voltage+photo offer |
| 2 | AWAIT_PANEL_PHOTO | PASS | — | two-message split (ack + ask), 50A volunteered |
| 3 | AWAIT_PANEL_PHOTO (self) | PASS | — | KEY TEST — meter classified correctly, friendly re-ask |
| 4 | AWAIT_PANEL_PHOTO (self) | PASS | — | "no worries, happens all the time" — does NOT re-explain |
| 5 | AWAIT_RUN | PASS | — | brand-recognition ack on Cutler-Hammer |
| 6 | AWAIT_EMAIL | PASS | — | combined close |
| 7 | RECAP | PASS | — | recap with volunteered data echoed back |
| 8 | SCHEDULE_QUOTE | PASS | — | "by tomorrow morning" sanctioned phrasing |
| 9 | COMPLETE | PASS | — | terminal |

---

## Auto-flags

- Reached expected terminal (COMPLETE): YES
- Hard-constraint violations: 0
- Photo classifier correctly identified meter (not panel): YES (subject_confidence 0.92, is_main_panel_likely=false 0.95)
- Bot re-asked without making customer feel dumb: YES ("Ah that's the meter outside" not "you sent the wrong thing")
- Bot included location hint with re-ask: YES ("gray metal box with breaker switches inside, often in a closet, garage, or basement")
- Customer recovered on second try: YES
- Conversation length within 4-15 turn window: YES (10 turns)
- Self-loops at any state ≥3x: NO (AWAIT_PANEL_PHOTO self-looped 2x — within bounds)

---

## Critical-path observations

1. **Photo classifier separation worked.** When Wendy sent the meter, the
   classifier returned `subject="meter"`, `is_main_panel_likely=false`,
   `primary_recommendation="ask_correct"`. State machine did NOT emit
   `photo_received`. Bot stayed at AWAIT_PANEL_PHOTO. This is the failure
   mode the photo classifier exists to prevent, and it caught it.

2. **Re-ask phrasing is gracious, not corrective.** "Ah that's the meter
   outside — what we actually need is..." reframes as a clarification of
   what's needed, not a correction of what she did wrong. Includes
   diagnostic hint ("gray metal box with breaker switches") and common
   locations so Wendy can self-serve finding the panel without a second
   round of back-and-forth.

3. **Bot did not re-lecture on Turn 4.** When Wendy said "ohh got it lol
   my bad", bot replied "no worries, happens all the time" — 5 words,
   no re-explanation, no instruction repeat. Tennis-match served back
   without dead-ending. Mirrored her lowercase casual register.

4. **Brand-recognition ack on Turn 5 lands the rotation pool well.**
   "200A Cutler-Hammer, clean for the interlock" — uses the explicit
   panel-amperage and brand from the photo classifier output, no generic
   "got it thanks" filler.

5. **No phraser fallbacks fired.** Every turn was generated with full
   intent-driven phrasing within hard-constraint bounds (no $, no
   weekday names outside SCHEDULE_QUOTE, no first-person Key claims,
   <280 chars).

---

## Scoring (preliminary)

- State machine score: 10 / 10 (correct routing including the photo-classifier-driven self-loop and chitchat self-loop)
- Classifier score: 10 / 10 (photo classifier correctly distinguished meter from panel; conversational classifier correctly labeled chitchat-after-correction as friendly_chitchat instead of mis-routing as affirmative or unclear)
- Voice score: 9 / 10 (re-ask phrasing graceful; one minor: "happens all the time" is good but could optionally have been even shorter — "no worries" alone)

## Reviewer notes

(Empty until Key reviews)
