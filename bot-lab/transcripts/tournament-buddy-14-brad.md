# Persona 14 — Brad (Burst Texter, Generac 7500W) — VARIANT: BUDDY

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 14
**Variant:** BUDDY (variants/buddy/phraser-agent.md)
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 9
**Status:** PASS

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Brad — BPP. Got y'alls form on the inlet. Couple quick ones for Key's quote, y'all good?

### Turn 1 — customer
yeah it's a generac
like 7500 watts
what do u need to know

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.85
- extracted_value: "generator: Generac 7500W"
- notes: three-message burst (orchestrator joined w/ `\n`); affirmative tone via "yeah" + cooperative "what do u need to know"; Generac/7500W captured as volunteered_data for downstream phraser turn

### Turn 1 — state machine
GREETING → AWAIT_240V (volunteered_data: "customer also said it's a Generac 7500W")

### Turn 1 — bot (AWAIT_240V)
Gotcha — Generac 7500's solid. Y'all got a 240v outlet on it (big twist-lock) or just regular plugs?

### Turn 2 — customer
240, 50 amp twist lock

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.95
- extracted_value: "240v confirmed"
- notes: "50 amp twist lock" passes downstream as volunteered_data for AWAIT_OUTLET

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET (volunteered_data: "customer said 50 amp twist lock")

### Turn 2 — bot (AWAIT_OUTLET)
Right on — sounds like the 50-amp twist-lock. Y'all confirm that's the 4-prong one (NEMA L14-50)?

### Turn 3 — customer
yep that's it

### Turn 3 — classifier
- state: AWAIT_OUTLET
- label: outlet_50a
- confidence: 0.95

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP

### Turn 3 — bot (AWAIT_OWNERSHIP)
Cool. Y'all owning the place or rentin?

### Turn 4 — customer
own it

### Turn 4 — classifier
- state: AWAIT_OWNERSHIP
- label: owner
- confidence: 0.95

### Turn 4 — state machine
AWAIT_OWNERSHIP → AWAIT_RUN

### Turn 4 — bot (AWAIT_RUN)
Nice. Bout how far from the generator spot to the breaker panel — under 15ft, 15-30, or longer?

### Turn 5 — customer
like 18 ft

### Turn 5 — classifier
- state: AWAIT_RUN
- label: run_medium
- confidence: 0.92

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL

### Turn 5 — bot (AWAIT_EMAIL)
Gotcha. Best email to send the quote to?

### Turn 6 — customer
brad.f@gmail.com

### Turn 6 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.98
- extracted_value: "brad.f@gmail.com"
- email_typo_suspected: false

### Turn 6 — state machine
AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM (address_on_file: "44 Lakewood Drive, Simpsonville SC 29680")

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM)
k cool. Got 44 Lakewood Drive, Simpsonville 29680 — that the install spot?

### Turn 7 — customer
yep

### Turn 7 — classifier
- state: AWAIT_ADDRESS_CONFIRM
- label: address_confirmed
- confidence: 0.95

### Turn 7 — state machine
AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO

### Turn 7 — bot (AWAIT_PANEL_PHOTO)
For sure. Last bit — can y'all snap a pic of the breaker panel (door open if easy) so we can size the interlock right?

### Turn 8 — customer
[sends photo of breaker panel] → __photo_received__

### Turn 8 — state machine
AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (synthetic photo_received event)

### Turn 8 — bot (SCHEDULE_QUOTE)
Got it — that'll do. Key'll have y'alls quote out by tomorrow morning, holler if anything pops up.

### Turn 9 — customer
thanks

### Turn 9 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.9

### Turn 9 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal)

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Length | y'all-count | Notes |
|---|---|---|---|---|---|
| 0 | GREETING | PASS | 95 | 2 | opener — 1 of 4 BUDDY templates |
| 1 | AWAIT_240V | PASS | 100 | 1 | acknowledges Generac 7500 (persona requirement met) |
| 2 | AWAIT_OUTLET | PASS | 96 | 1 | confirms volunteered 50A as L14-50 |
| 3 | AWAIT_OWNERSHIP | PASS | 39 | 1 | "rentin" matches BUDDY casual register |
| 4 | AWAIT_RUN | PASS | 96 | 0 | three-bucket distance question |
| 5 | AWAIT_EMAIL | PASS | 40 | 0 | "Gotcha" ack; clean ask |
| 6 | AWAIT_ADDRESS_CONFIRM | PASS | 74 | 0 | "k cool" ack matches BUDDY voice |
| 7 | AWAIT_PANEL_PHOTO | PASS | 118 | 1 | soft warning (>130 trigger threshold not hit) |
| 8 | SCHEDULE_QUOTE | PASS | 97 | 1 | "by tomorrow morning" allowed phrase per orchestrator |

Total messages: 9
Total chars (bot): 755
Average bot message length: 84 chars (target 60-110: PASS)

---

## Auto-flags

- Reached expected terminal (COMPLETE): YES
- Hard-constraint regex check: 0 violations
  - No `$` price leak
  - No weekday names (Saturday/Sunday/etc.)
  - No "I'm Key" first-person Key claims
  - No banned phrases ("rest assured", "I appreciate", "feel free to", "thank you for your interest")
  - All messages <=130 char soft cap (max 118)
- Classifier confidence on critical states: all >=0.85 (PASS)
- Conversation length: 9 turns (well under 15-turn bloat threshold)
- State self-loops: 0
- Bot self-disclosed AI status correctly when asking_if_human fired: N/A (didn't fire)
- Generac/7500W acknowledged in bot's first AWAIT_240V reply: YES (persona-specific requirement met)
- volunteered_data passthrough demonstrated on turns 1 and 2: YES

---

## Voice / register analysis (BUDDY variant)

- y'all count: 7 across 9 messages (turns 0, 0, 1, 2, 3, 7, 8). Variant target: 1-3 per conversation. **Over budget — 7 is performative, reads as forced.** Should drop to 2-3 by removing turns 1, 2, 3 instances.
- Slang sprinkled: "Gotcha", "Right on", "Cool", "Nice", "Gotcha", "k cool", "For sure" — all appropriate, no two repeated back-to-back
- Contractions: "Y'all", "Generac's", "Y'all", "Y'all" — within budget
- Acknowledgments: 6/9 turns lead with relaxed ack — within ~50% target
- No corporate phrases, no exclamation marks (except none — even GREETING avoids it)
- Tony-style transparency: not triggered (no asking_if_human)

---

## Generac-callout quality

Persona-specific bar: "the bot's first reply MUST mention the Generac in some way."

Bot turn 1: "Gotcha — Generac 7500's solid. Y'all got a 240v outlet on it (big twist-lock) or just regular plugs?"

Quality: GOOD. Acknowledges the model name explicitly, adds a quick warmth beat ("solid"), then transitions cleanly to the 240v question. Doesn't over-perform — no asking redundant questions about the gen the customer already volunteered. Score: 8/10.

What would push to 10/10: reference the actual 7500W wattage as relevant ("plenty of headroom for the whole house with that 7500W") — would feel more domain-aware. The current phrasing acknowledges but doesn't demonstrate expertise on the spec.

---

## Scoring

- State machine score: 10/10 (clean transitions, terminal as expected, no retries)
- Classifier score: 10/10 (all labels correct, high confidence, volunteered_data captured on turn 1)
- Voice score: 7/10
  - PROS: relaxed register matches Brad's burst-texter style well — he'd mirror "k cool" and "right on" naturally; brevity is on-target (avg 84 chars)
  - CONS: "y'all" used 7 times across 9 messages — feels performative not casual; should appear 2-3x max
  - "rentin" instead of "renting" is borderline — works for BUDDY register, but 1 contraction-drop across the run is enough; it's already at the edge
  - One soft-warning at turn 7 (118 chars) — fine but trending verbose

- Generac-callout-quality: 8/10 (acknowledges model, brief warmth, transitions cleanly; doesn't quite leverage the 7500W spec for credibility)

---

## Reviewer notes

(Empty until Key fills in — flag the y'all-overuse as the top thing to dial back in v2)
