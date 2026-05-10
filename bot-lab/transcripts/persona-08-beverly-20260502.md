# Persona 08 — Beverly (Slow Responder)

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 08
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 9
**Status:** PASS

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Beverly, this is Backup Power Pro — saw your form come through. Got a sec for a couple quick questions so our electrician Key can put your quote together?

---

`[2 hour gap]`

### Turn 1 — customer
YES go ahead

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.95

### Turn 1 — state machine
GREETING → AWAIT_240V (intent: ask_if_240v_or_120v)

### Turn 1 — bot (AWAIT_240V)
Perfect. Quick one — does your generator have a big 240-volt outlet (the kind your dryer plugs into), or just regular 120-volt household outlets?

---

`[2 hour gap]`

### Turn 2 — customer
240. The big one

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.95

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET

### Turn 2 — bot (AWAIT_OUTLET)
Got it. Is it a 30-amp outlet (smaller 3-prong twist) or 50-amp (bigger 4-prong)? If unsure, snap a pic of the outlet and send it over.

---

`[2 hour gap]`

### Turn 3 — customer
50 amp

### Turn 3 — classifier
- state: AWAIT_OUTLET
- label: outlet_50a
- confidence: 0.97

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP

### Turn 3 — bot (AWAIT_OWNERSHIP)
Perfect. Couple more quick ones — do you own the home, or rent? (Owner has to approve panel work.)

---

`[2 hour gap]`

### Turn 4 — customer
OWN

### Turn 4 — classifier
- state: AWAIT_OWNERSHIP
- label: owner
- confidence: 0.98

### Turn 4 — state machine
AWAIT_OWNERSHIP → AWAIT_RUN

### Turn 4 — bot (AWAIT_RUN)
Got it. Last quick one — roughly how far is the generator going to sit from your electrical panel? Short (under 15ft), medium (15-30ft), or longer than that?

---

`[2 hour gap]`

### Turn 5 — customer
About 30 feet

### Turn 5 — classifier
- state: AWAIT_RUN
- label: run_medium
- confidence: 0.72
- notes: 30 ft sits on the medium/long boundary; "about" hedges low — classifier picks medium with reduced confidence. Either label routes to AWAIT_EMAIL so flow is unaffected.

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL

### Turn 5 — bot (AWAIT_EMAIL)
Got it. What's the best email to send your quote to?

---

`[2 hour gap]`

### Turn 6 — customer
bev.simmons@bellsouth.net

### Turn 6 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.99
- extracted_value: bev.simmons@bellsouth.net

### Turn 6 — state machine
AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM)
Got it. Install address — is it 78 Mill Pond Road, Pickens SC 29671, or somewhere else?

---

`[2 hour gap]`

### Turn 7 — customer
YES that is correct

### Turn 7 — classifier
- state: AWAIT_ADDRESS_CONFIRM
- label: address_confirmed
- confidence: 0.96

### Turn 7 — state machine
AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO

### Turn 7 — bot (AWAIT_PANEL_PHOTO)
Last thing — could you snap a pic of your main electrical panel with the door open and send it over? Helps Key size up the install.

---

`[2 hour gap]`

### Turn 8 — customer
`[sends photo of panel]`

### Turn 8 — classifier
- (synthetic event — no classifier call)
- label: photo_received
- confidence: n/a

### Turn 8 — state machine
AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (onEnter.complete = true — fires Key's "qualified lead" notification)

### Turn 8 — bot (SCHEDULE_QUOTE)
Perfect, that's everything we need. Key will look over your panel photo and have your quote to you by tomorrow morning. Talk soon.

---

`[2 hour gap]`

### Turn 9 — customer
OK thank you

### Turn 9 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.9

### Turn 9 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal — no further outbound)

### Turn 9 — bot (COMPLETE)
(no message — terminal state)

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|
| 0 | GREETING | yes | — | First-name greet, BPP intake, third-person Key, single question, single "!" allowed on first message — under 280 chars |
| 1 | AWAIT_240V | yes | — | Acknowledges with "Perfect.", one question, mentions both 240 and 120, no weekdays |
| 2 | AWAIT_OUTLET | yes | — | Acknowledges with "Got it.", explains both options, offers photo fallback |
| 3 | AWAIT_OWNERSHIP | yes | — | Acknowledges, asks ownership cleanly with the owner-approval note |
| 4 | AWAIT_RUN | yes | — | Acknowledges, three-bucket distance question |
| 5 | AWAIT_EMAIL | yes | — | Short, single ask |
| 6 | AWAIT_ADDRESS_CONFIRM | yes | — | Repeats address verbatim from slots |
| 7 | AWAIT_PANEL_PHOTO | yes | — | "snap a pic" voice, mentions reason |
| 8 | SCHEDULE_QUOTE | yes | — | "by tomorrow morning" — only sanctioned timeframe; no weekday name; no price; warm sign-off |
| 9 | COMPLETE | n/a | — | Terminal, no outbound |

---

## Auto-flags

- Reached persona's expected terminal? **YES** (COMPLETE)
- Phraser hard-constraint violations? **0** — no `$`, no weekday names (only "by tomorrow morning"), no first-person Key, no banned corporate phrases, no message > 280 chars
- Classifier confidence < 0.6 on critical state? **No** — lowest was 0.72 on Turn 5 (run_medium) and that label still routes to AWAIT_EMAIL, so confidence drift had zero flow impact
- Conversation > 15 turns? **No** (9 turns)
- Any state self-loop > 2x? **No** — every transition was forward
- asking_if_human disclosure check fired correctly? **n/a** — Beverly never asks
- **Bot double-message during gaps?** **No** — bot waited for Beverly's reply each time. Latency-tolerance verified.
- **Transcript readability with `[2 hour gap]` markers?** **Readable** — gaps clearly separate turns; no ambiguity about who spoke when

---

## Scoring (filled at review time)

- State machine score: ___ / 10
- Classifier score: ___ / 10
- Voice score: ___ / 10

## Reviewer notes

(Empty until human review — Key fills this in)
