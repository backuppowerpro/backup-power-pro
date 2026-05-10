# Persona 14 — Brad (Burst Texter, three messages in 25 seconds) — TERSE VARIANT

**Date:** 2026-05-02
**Variant:** TERSE (variants/terse/phraser-agent.md)
**Persona file:** customer-personas.md → Persona 14
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 9
**Status:** PASS

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Brad — BPP. Got your form. Couple quick Qs for Key's quote, cool?

(69 chars)

### Turn 1 — customer (3-message burst, ~8s apart, collapsed by 5s debounce)
yeah it's a generac
like 7500 watts
what do u need to know

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.92
- extracted_value: affirmative
- volunteered_data: "customer also said it's a Generac 7500W"
- off_topic_excerpt: —
- note: classifier received the three messages joined with newlines (production 5-second debounce surfaces the latest but recent_turns context contains all three). "what do u need to know" is the affirmative-toned consent to proceed; the generator make + wattage is volunteered context the next state's phraser should acknowledge.

### Turn 1 — state machine
GREETING → AWAIT_240V (intent: ask whether their generator has a 240-volt outlet or only 120-volt household outlets)
- volunteered_data passed to phraser: "customer also said it's a Generac 7500W"

### Turn 1 — bot (AWAIT_240V)
Generac 7500, solid. 240v outlet on the side or just regular plugs?

(67 chars) — **CRITICAL TEST: Generac 7500 acknowledged in TERSE register with 13 chars to spare under the 80-char target.**

### Turn 2 — customer
yeah 240
4 prong twist lock

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.97
- extracted_value: —
- volunteered_data: "customer also said 4-prong twist-lock (likely 50A)"
- off_topic_excerpt: —

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET (intent: ask if the 240v outlet is 30A or 50A)
- volunteered_data passed to phraser: "customer also said 4-prong twist-lock (likely 50A)"

### Turn 2 — bot (AWAIT_OUTLET)
4-prong sounds 50-amp. That right?

(34 chars)

### Turn 3 — customer
yep 50

### Turn 3 — classifier
- state: AWAIT_OUTLET
- label: outlet_50a
- confidence: 0.96
- extracted_value: —
- off_topic_excerpt: —

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP (intent: ask if they own or rent)

### Turn 3 — bot (AWAIT_OWNERSHIP)
own or rent the place?

(22 chars)

### Turn 4 — customer
own it

### Turn 4 — classifier
- state: AWAIT_OWNERSHIP
- label: owner
- confidence: 0.98
- extracted_value: —
- off_topic_excerpt: —

### Turn 4 — state machine
AWAIT_OWNERSHIP → AWAIT_RUN (intent: ask roughly how far the generator will sit from the panel)

### Turn 4 — bot (AWAIT_RUN)
how far from the panel — under 15ft, 15-30, or longer?

(54 chars)

### Turn 5 — customer
prob 18 ft
maybe 20

### Turn 5 — classifier
- state: AWAIT_RUN
- label: run_medium
- confidence: 0.94
- extracted_value: —
- off_topic_excerpt: —
- note: two-message burst again, both joined; classifier reads 18-20ft → run_medium

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL (intent: ask for the best email)

### Turn 5 — bot (AWAIT_EMAIL)
got it. best email for the quote?

(33 chars)

### Turn 6 — customer
brad.f@gmail.com

### Turn 6 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.99
- extracted_value: brad.f@gmail.com
- email_typo_suspected: false
- off_topic_excerpt: —

### Turn 6 — state machine
AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM (intent: confirm the install address)
- typo check: clean gmail.com domain, skips CHECK_EMAIL_TYPO

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM)
install at 44 Lakewood Drive, Simpsonville? or somewhere else?

(62 chars)

### Turn 7 — customer
thats it

### Turn 7 — classifier
- state: AWAIT_ADDRESS_CONFIRM
- label: address_confirmed
- confidence: 0.96
- extracted_value: —
- off_topic_excerpt: —

### Turn 7 — state machine
AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO (intent: ask for a photo of their main electrical panel with the door open)

### Turn 7 — bot (AWAIT_PANEL_PHOTO)
quick pic of your main panel, door open? helps Key size it up.

(62 chars)

### Turn 8 — customer
[sends photo of panel]

### Turn 8 — state machine (synthetic event)
- event: __photo_received__ (orchestrator-emitted synthetic; bypasses classifier per orchestrator spec)
- label-equivalent: photo_received
- AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (intent: thank them and tell them Key will have the quote ready by tomorrow morning)

### Turn 8 — bot (SCHEDULE_QUOTE)
got it — that's everything. Key'll have your quote by tomorrow morning.

(71 chars)

### Turn 9 — customer
sweet thanks

### Turn 9 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.93
- extracted_value: —
- off_topic_excerpt: —

### Turn 9 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal, no further outbound; onEnter signals qualified-lead notification fires)

---

## Per-turn flag log

| Turn | State | Chars | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|---|
| 0 | GREETING | 69 | PASS | — | TERSE GREETING template #1; under 110 cap; "Hey Brad — BPP. Got your form. Couple quick Qs for Key's quote, cool?" — fragments preferred, no opening sentence-padding |
| 1 | AWAIT_240V | 67 | PASS | — | **TERSE volunteered_data passthrough succeeded.** "Generac 7500, solid." in 19 chars before pivoting to the 240v question. Generac+wattage acknowledged within ~50 chars of brand-fact + 47 chars of question. Headline behavior preserved despite tight register. |
| 2 | AWAIT_OUTLET | 34 | PASS | — | Reads volunteered "4-prong" as 50-amp and asks for confirmation in 5 words. Drops subject pronoun ("4-prong sounds 50-amp"); contractor-on-the-job register. |
| 3 | AWAIT_OWNERSHIP | 22 | PASS | — | Bare question, no acknowledgment (correct: ack rate ~30% in TERSE; this is the no-ack turn). Lowercase. |
| 4 | AWAIT_RUN | 54 | PASS | — | No ack, dropped "do you" pronoun + helping verb. Three buckets in compact form. |
| 5 | AWAIT_EMAIL | 33 | PASS | — | "got it." minimum-effort 2-word ack (within 1-3 word allowance), then bare question. |
| 6 | AWAIT_ADDRESS_CONFIRM | 62 | PASS | — | Address question in fragment form ("install at X? or somewhere else?"). Drops "the" prefix. State zip optional under register. |
| 7 | AWAIT_PANEL_PHOTO | 62 | PASS | — | "quick pic of your main panel, door open?" mirrors voice corpus #11 ("Got the photo, that's a Cutler-Hammer panel"). Casual lowercase opening. |
| 8 | SCHEDULE_QUOTE | 71 | PASS | — | "got it" ack reused (gap of 3 turns since Turn 5 — within reuse threshold); "Key'll have your quote by tomorrow morning" — third-person Key + sanctioned "by tomorrow morning". |
| 9 | (terminal) | — | — | — | no outbound on COMPLETE |

**Average outbound length (Turns 0-8): 52.7 chars** — squarely inside the 35-80 char TERSE target band. Mid-flow average (Turns 2-7): 44.5 chars — even tighter.

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **YES** (COMPLETE in 9 turns)
- Did any phraser output violate a hard constraint (regex check)?
  - `/\$\d/` price leak — **none**
  - `/\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/` weekday leak — **none**
  - `/I'm Key|this is Key personally|I'll be there|I can install/i` first-person Key — **none**
  - length > 280 — **none** (max was Turn 8 at 71 chars; max GREETING 69 chars)
  - length > 110 outside GREETING — **none** (max non-greeting 71 chars)
  - `/thank you for your interest|I appreciate|rest assured|feel free to/i` corporate phrase — **none**
  - `/Awesome\.|Awesome!|Awesome,|Perfect!|Excellent\.|Great!/` SaaS-bro tell — **none**
  - `/two more quick|last quick one|almost done|few more questions/` countdown phrasing — **none**
  - exclamation marks outside GREETING — **none** (zero exclamations in entire run; conservative read of the rule)
  - multiple "?" in one message — **none**
- Did any classifier output have confidence <0.6 on a critical state? **No** (range 0.92-0.99)
- Did the conversation exceed 15 turns? **No** (9 turns; in expected 4-15 range)
- Did any state self-loop more than 2x? **No** (zero self-loops; clean linear traversal)
- Did the bot self-disclose AI status correctly when asking_if_human fired? **N/A** (Brad never asked)
- Did the bot mirror emoji? **N/A** (Brad used none; acknowledge_emoji stayed false)
- Did the bot use "by tomorrow morning" only inside SCHEDULE_QUOTE? **YES** (single occurrence, Turn 8)
- Did the phraser fall back to hardcoded text? **No** (zero fallbacks used)
- **volunteered_data passthrough on Turn 1: SUCCESS in TERSE register.** Classifier flagged Generac 7500W as volunteered_data, orchestrator passed it to the AWAIT_240V phraser, phraser opened with "Generac 7500, solid." instead of generic 240v question. **This is the headline test for this run** — TERSE format had only ~50 chars to fit the brand-callout AND the 240v question, and pulled it off in 66 total chars.
- **Bot mentioned Generac in Turn 1: YES.** Required-quality bar from persona spec met under tight register.
- Acknowledgment-rhythm rule: bot used 2 distinct acks across the run (got it x2 + zero-ack on 4 turns). TERSE expects ~30% ack rate — actual: 22% (2/9 outbounds had explicit ack). Slightly under target but consistent with persona register match.

---

## TERSE-specific evaluation

**Variant fingerprint check:**
- Average message length: **52.7 chars** (target 50, range 35-80). PASS.
- Acknowledgment rate: **22%** (target ~30%). Slightly under but defensible — Brad's burst-texter style invites bare-question replies.
- Question style: bare ("own or rent the place?", "best email for the quote?"). PASS — matches "30 or 50 amp?" reference example.
- Voice: contractor-on-the-job. PASS — fragments dominate, lowercase casual, drops pronouns/helpers.

**TERSE acceptance criteria check (vs WARM baseline):**
- Reaches expected terminal: PASS (COMPLETE in 9 turns, matches WARM baseline turn count)
- Avg msg length 35-80 chars across batch: PASS (52.7 chars)
- Voice score ≥7/10: see Scoring section below
- 0 hard-constraint violations: PASS
- Disqualification clarity (Mike persona) — N/A this run
- Tony transparency clarity — N/A this run

---

## Scoring (this run)

- **State machine score: 10/10** — clean linear traversal, no retries, no detours, exact turn count match with WARM baseline.
- **Classifier score: 10/10** — all confidences 0.92+; volunteered_data flagged correctly on burst-text inputs; no schema violations.
- **Voice score: 8/10** — TERSE register cleanly executed; Generac callout preserved despite character budget; only deduction is acknowledgment rate slightly below 30% target (22% — leans more bare-question than rhythm rule prescribes). Reads convincingly as Key on a job site between calls.
- **Generac-callout-quality: 9/10** — "Generac 7500, solid." is 19 chars of brand-acknowledgment that feels like Key actually heard the customer, not robot pattern-matching. Only deduction: WARM baseline's "Generac 7500 — nice, plenty of juice" had slightly more texture; TERSE's compression is closer but still warm.

## Reviewer notes

(Empty until human review — Key fills this in)

The critical test for this run was whether TERSE register could STILL acknowledge volunteered Generac 7500W context in Turn 1 despite the ~50-char target. Result: bot opened with "Generac 7500, solid." (19 chars) and pivoted to the 240v question in 47 chars — total 66 chars, well under the 80-char ceiling. Bot still feels like it's listening despite brevity.
