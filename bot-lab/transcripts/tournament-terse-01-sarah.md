# Tournament Run — TERSE Variant — Persona 01 (Sarah, Cooperative 240v Owner)

**Date:** 2026-05-02
**Variant:** TERSE phraser (35-80 char target, ~30% ack rate)
**Persona file:** customer-personas.md → Persona 01 (Sarah)
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 9 bot outbounds, 9 customer inbounds (including closing thanks)
**Status:** PASS

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Sarah — BPP. Got your form. Couple quick Qs for Key's quote, cool?

> length: 66 chars · greeting opener (allowed up to 110) · no ack (first turn) · no banned phrases

### Turn 1 — customer
yeah go ahead

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.96
- extracted_value: null

### Turn 1 — state machine
GREETING → AWAIT_240V (intent: ask whether their generator has a 240-volt outlet or only 120-volt)

### Turn 1 — bot (AWAIT_240V)
k. generator have a 240v outlet (dryer-style) or just regular 120v?

> length: 67 chars · ack="k." (counted in prior_acknowledgments) · 1 question · constraint pass

### Turn 2 — customer
240, it's a 50 amp twist lock

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.97
- extracted_value: "gen_240v"
- volunteered_data: "customer also said 50 amp twist lock outlet"

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET (intent: ask 30A vs 50A; volunteered_data set → phraser confirms volunteered 50A instead of asking blind)

### Turn 2 — bot (AWAIT_OUTLET, volunteered=50A)
50a 4-prong twist — that right?

> length: 31 chars · no explicit ack (the confirm IS the ack of her volunteered detail) · 1 question · prior_acknowledgments=["k."] so no repeat

### Turn 3 — customer
yep

### Turn 3 — classifier
- state: AWAIT_OUTLET
- label: outlet_50a
- confidence: 0.86
- extracted_value: "outlet_50a"
- (rationale: bot proposed 50A 4-prong, "yep" confirms in context)

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP

### Turn 3 — bot (AWAIT_OWNERSHIP)
own the place or rent?

> length: 22 chars · no ack (~30% rule, just shipped one on T1) · 1 question · fragment-style ("own the place or rent?" not "do you own…")

### Turn 4 — customer
we own it

### Turn 4 — classifier
- state: AWAIT_OWNERSHIP
- label: owner
- confidence: 0.98
- extracted_value: "owner"

### Turn 4 — state machine
AWAIT_OWNERSHIP → AWAIT_RUN

### Turn 4 — bot (AWAIT_RUN)
how far from generator to panel — under 15ft, 15-30, or further?

> length: 64 chars · no ack · 1 question · fragment style

### Turn 5 — customer
about 22 feet

### Turn 5 — classifier
- state: AWAIT_RUN
- label: run_medium
- confidence: 0.95
- extracted_value: "22 feet"

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL

### Turn 5 — bot (AWAIT_EMAIL)
got it. best email for the quote?

> length: 33 chars · ack="got it." (different from prior "k.") · 1 question

### Turn 6 — customer
sarah.becker.gvl@gmail.com

### Turn 6 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.99
- extracted_value: "sarah.becker.gvl@gmail.com"
- email_typo_suspected: false

### Turn 6 — state machine
AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM (typo NOT suspected, skip CHECK_EMAIL_TYPO)

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM)
install at 412 Oakmont Drive, Greer SC 29651 — that right?

> length: 58 chars · no ack · 1 question · uses address_on_file from persona slots

### Turn 7 — customer
yep that's right

### Turn 7 — classifier
- state: AWAIT_ADDRESS_CONFIRM
- label: address_confirmed
- confidence: 0.97

### Turn 7 — state machine
AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO

### Turn 7 — bot (AWAIT_PANEL_PHOTO)
pic of your main panel with the door open?

> length: 42 chars · no ack · 1 question · NO countdown phrasing ("last thing", "almost done") even though tempting

### Turn 8 — customer
[sends photo of main panel]

### Turn 8 — synthetic event
- photo_received → state machine

### Turn 8 — state machine
AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (onEnter: complete=true → fire qualified-lead notification)

### Turn 8 — bot (SCHEDULE_QUOTE)
got it. Key'll review and have your quote by tomorrow morning.

> length: 62 chars · ack="got it." · "by tomorrow morning" allowed only in SCHEDULE_QUOTE intent · no weekday name · no $-amount

### Turn 9 — customer
thanks!

### Turn 9 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.92

### Turn 9 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal — no further outbound)

---

## Per-turn flag log

| Turn | State | Length | Ack? | Hard-constraint pass | Voice 1-10 | Notes |
|---|---|---|---|---|---|---|
| 0 | GREETING | 66 | no | pass | 8 | TERSE greeting, casual, third-person Key |
| 1 | AWAIT_240V | 67 | yes ("k.") | pass | 9 | fragment-style, lowercase, ack-then-pivot |
| 2 | AWAIT_OUTLET | 31 | implicit | pass | 9 | volunteered_data acknowledged via confirm-question |
| 3 | AWAIT_OWNERSHIP | 22 | no | pass | 9 | bare fragment; matches voice corpus #3 register |
| 4 | AWAIT_RUN | 64 | no | pass | 8 | three-option ask, no helping verbs |
| 5 | AWAIT_EMAIL | 33 | yes ("got it.") | pass | 9 | min-effort ack, then question |
| 6 | AWAIT_ADDRESS_CONFIRM | 58 | no | pass | 9 | uses address_on_file inline, "that right?" tail |
| 7 | AWAIT_PANEL_PHOTO | 42 | no | pass | 8 | no countdown phrase, just asks the next thing |
| 8 | SCHEDULE_QUOTE | 62 | yes ("got it.") | pass | 9 | "by tomorrow morning" sanctioned phrase only |

**Bot turns:** 9
**Acknowledgments fired:** 3 of 9 = 33% (target ~30%, on register)
**Average bot msg length:** (66+67+31+22+64+33+58+42+62)/9 = **49.4 chars** (target 35-80, on register)
**Greeting length:** 66 chars (within 50-110 GREETING window)
**Mid-flow message lengths:** all ≤ 67 chars, none >110
**prior_acknowledgments used:** ["k.", "got it.", "got it."] — second "got it." on T8 is fine (separated by 7 turns from first "got it." on T5; lab rule is no immediate repeat, not no-repeat-ever)

---

## Auto-flags

- Reached expected terminal? **YES** — COMPLETE matches Sarah's `expected_terminal`
- Hard-constraint violations? **0**
  - No `$`-amount: pass
  - No weekday names anywhere: pass ("tomorrow morning" used only in SCHEDULE_QUOTE — does not contain weekday name)
  - No first-person "I'm Key" / "I'll install": pass
  - No `>280` chars on any message: pass (max 67)
  - No banned corporate phrases ("appreciate", "rest assured", "feel free to", "thank you for your interest"): pass
  - No countdown phrases ("almost done", "last one", "two more"): pass — explicitly resisted on Turn 7
  - Multiple `?` in one message: pass (max 1 each)
  - Repeated ack from prior_acknowledgments back-to-back: pass
- Phraser fallback used? **0 times**
- Confidence <0.6 on any classifier output? **0**
- Conversation length within 4-15 turn band? **9 turns — yes**
- Same state visited 4+ times? **No state self-looped**
- AI self-disclosure correctly triggered? **N/A** — Sarah never asked

---

## TERSE variant fingerprint match

| Metric | Variant target | This run |
|---|---|---|
| Avg message length | 35-80 chars | **49.4 chars** ✓ |
| Acknowledgment rate | ~30% | **33%** ✓ |
| Question style | bare fragments ("own or rent?") | matches ✓ |
| Voice register | contractor-on-the-job | matches ✓ |
| Greeting length | 50-110 | **66** ✓ |
| Banned phrases | 0 | **0** ✓ |
| Hard constraint violations | 0 | **0** ✓ |

---

## Summary

Sarah is the regression baseline. TERSE phraser delivered her to COMPLETE in 9 turns with no constraint violations, on-register avg length (49.4 chars), and on-register ack rate (33%). The volunteered_data passthrough on Turn 2 (50A twist lock mentioned alongside the 240v answer) was handled cleanly — phraser folded the confirmation into the next-state question instead of re-asking blindly, saving a turn. State machine deterministic, classifier confidences all ≥0.86.

Voice score average: **8.7/10** (clean, fast, contractor-real; would feel like a Key-on-the-job text rather than a corporate intake bot).

---

## Output line

[TERSE] Persona 01 (sarah) — reached COMPLETE in 9 turns. Voice 9/10. Avg msg 49chars. Status: PASS.
