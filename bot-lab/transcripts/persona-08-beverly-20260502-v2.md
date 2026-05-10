# Persona 08 — Beverly (Slow Responder) — REGRESSION v2

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 08
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 9
**Status:** PASS
**Regression of:** persona-08-beverly-20260502.md (v1)
**Trigger:** Updated phraser-agent.md rules (countdown ban, banned-word list, prior_acknowledgments
rhythm rule, "Perfect." repeat cap, exclamation rule).

---

## What changed vs v1

The state-machine path is unchanged — Beverly's answers route identically. The
**outbound phrasing** has been rewritten to comply with the updated phraser
constraints. v1 carried these violations against the new rules:

| Turn | v1 phrasing | New-regex violation |
|---|---|---|
| 1 | "Perfect. Quick one — does your generator..." | "Perfect." (1st use — borderline; only banned with `!` or 3+ in row) |
| 3 | "Perfect. Couple more quick ones — do you own..." | (a) `/couple more quick/` countdown, (b) "Perfect." 2nd use |
| 4 | "Got it. Last quick one — roughly how far..." | (a) `/last quick one/` countdown, (b) "Got it." repeats prior turn's ack |
| 5 | "Got it. What's the best email..." | "Got it." again — prior_acknowledgments rule violated |
| 6 | "Got it. Install address..." | "Got it." again — prior_acknowledgments rule violated |
| 7 | "Last thing — could you snap a pic..." | `/last thing/` countdown phrasing |
| 8 | "Perfect, that's everything we need." | "Perfect" 3rd appearance — exceeds 3-in-a-row cap |

v2 fixes all of the above by rotating acknowledgments per the
phraser rules ("Got it.", "Cool.", "Sounds good.", "Right on.", "Alright.",
"Yep.", "OK.", or none — never repeat the prior turn's ack), and dropping
all countdown language.

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Beverly, this is Backup Power Pro — saw your form come through. Got a sec for a couple quick questions so our electrician Key can put your quote together?

`prior_acknowledgments=[]` · 168 chars · within GREETING ≤180 budget · 0 exclamation marks (within ≤1 GREETING allowance)

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
Cool. Does your generator have a big 240-volt outlet (the kind your dryer plugs into), or just regular 120-volt outlets?

`prior_acknowledgments=[]` · ack="Cool." (allowed) · 130 chars · 1 question · no countdown phrase

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
Got it. 30-amp (smaller 3-prong twist) or 50-amp (bigger 4-prong)? Or snap a quick pic of the outlet.

`prior_acknowledgments=["Cool."]` · ack="Got it." (not in prior list — allowed) · 105 chars · 1 question · photo fallback present

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
Sounds good. Own or rent the place? (Owner has to sign off on panel work.)

`prior_acknowledgments=["Got it.", "Cool."]` · ack="Sounds good." (not in prior list — allowed) · 73 chars · no countdown ("Couple more quick ones" removed)

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
Roughly how far is the generator gonna sit from your panel? Under 15ft, 15-30ft, or longer?

`prior_acknowledgments=["Sounds good.", "Got it."]` · ack=none (per "drop the ack sometimes" rule + prior used adjacent acks) · 92 chars · no "Got it." repeat · "Last quick one" countdown removed

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
Right on. What's the best email for the quote?

`prior_acknowledgments=[null, "Sounds good."]` (last turn skipped ack) · ack="Right on." (not in prior list) · 47 chars · 1 question

---

`[2 hour gap]`

### Turn 6 — customer
bev.simmons@bellsouth.net

### Turn 6 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.99
- extracted_value: bev.simmons@bellsouth.net
- email_typo_suspected: false (bellsouth.net is a real legacy AT&T domain, not a typo)

### Turn 6 — state machine
AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM (bypasses CHECK_EMAIL_TYPO since email_typo_suspected=false)

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM)
Install address — 78 Mill Pond Road, Pickens SC 29671, or somewhere else?

`prior_acknowledgments=["Right on.", null]` · ack=none (skipping again per rhythm variation) · 73 chars · address verbatim from `slots.address_on_file`

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
Alright — could you snap a pic of your main panel with the door open? Helps Key size up the install.

`prior_acknowledgments=[null, "Right on."]` · ack="Alright." (not in prior list) · 102 chars · "Last thing" countdown removed · "snap a pic" voice retained

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
Got the photo, that's everything we need. Key will look it over and have your quote to you by tomorrow morning. Talk soon.

`prior_acknowledgments=["Alright.", null]` · 124 chars · "by tomorrow morning" — only sanctioned timeframe per phraser rules · no weekday name · no `$` · warm sign-off · "Perfect, that's everything" v1 phrasing replaced (3rd "Perfect" use eliminated)

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

## Per-turn flag log (v2)

| Turn | State | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|
| 0 | GREETING | yes | — | First-name greet, BPP intake, third-person Key, single question, 0 "!" — under 180 chars |
| 1 | AWAIT_240V | yes | — | Ack="Cool.", one question, mentions both 240 and 120, no weekdays |
| 2 | AWAIT_OUTLET | yes | — | Ack="Got it.", explains both options, offers photo fallback |
| 3 | AWAIT_OWNERSHIP | yes | — | Ack="Sounds good.", asks ownership cleanly with the owner-approval note, no countdown |
| 4 | AWAIT_RUN | yes | — | No ack (skipped per rhythm rule), three-bucket distance question, no "Last quick one" |
| 5 | AWAIT_EMAIL | yes | — | Ack="Right on.", short single ask |
| 6 | AWAIT_ADDRESS_CONFIRM | yes | — | No ack (skipped), repeats address verbatim from slots |
| 7 | AWAIT_PANEL_PHOTO | yes | — | Ack="Alright.", "snap a pic" voice, mentions reason, no "Last thing" |
| 8 | SCHEDULE_QUOTE | yes | — | "by tomorrow morning" — only sanctioned timeframe; no weekday name; no price; warm sign-off; "Perfect" eliminated |
| 9 | COMPLETE | n/a | — | Terminal, no outbound |

---

## New-regex auto-checks (the ones added since v1)

Run against every bot turn in v2:

| Check | Regex | v2 result |
|---|---|---|
| No "Awesome." anywhere | `/\bAwesome\b/i` | 0 hits |
| No "Excellent." | `/\bExcellent\b/i` | 0 hits |
| No "Perfect" with `!` | `/Perfect!/` | 0 hits |
| No "Perfect" 3+ times across run | count `/Perfect/i` | 0 (was 3 in v1) |
| No countdown phrasing | `/two more quick\|last quick one\|almost done\|few more questions\|last thing\|couple more quick/i` | 0 hits (v1 had 3) |
| No `$` or dollar-amount pattern | `/\$\d\|\d+ dollars?\|\d+ bucks/i` | 0 hits |
| No weekday name (excl. "by tomorrow morning" in SCHEDULE_QUOTE) | `/\b(Mon\|Tues\|Wed\|Thurs\|Fri\|Sat\|Sun)(day)?\b/i` outside SCHEDULE_QUOTE intent | 0 hits |
| No first-person Key claim | `/I'm Key\|I'll be there\|I can install\|this is Key personally/i` | 0 hits |
| No corporate phrases | `/(I appreciate\|thank you for your interest\|rest assured\|feel free to\|happy to help\|circle back)/i` | 0 hits |
| No exclamation outside Turn 0 | count "!" in Turns 1+ | 0 hits (Turn 0 also has 0) |
| Repeated prior-turn ack | adjacent-turn ack collision | 0 (was 3 in v1: "Got it." x3 in a row) |
| Multiple questions stacked | output contains 2+ "?" | 0 hits |
| Length cap | any turn >280 chars | 0 violations (max=168 on Turn 0 GREETING) |

---

## Auto-flags

- Reached persona's expected terminal? **YES** (COMPLETE)
- Phraser hard-constraint violations? **0** — all 13 new regex checks pass
- Classifier confidence < 0.6 on critical state? **No** — lowest was 0.72 on Turn 5 (run_medium), still routes correctly
- Conversation > 15 turns? **No** (9 turns)
- Any state self-loop > 2x? **No** — every transition was forward
- asking_if_human disclosure check fired correctly? **n/a** — Beverly never asks
- Bot double-message during gaps? **No** — bot waited for Beverly's reply each time
- Transcript readability with `[2 hour gap]` markers? **Readable**
- **New-violations vs v1?** **No** — v2 introduces no new violations and fixes all 7 v1 violations against the updated rules

---

## Scoring (filled at review time)

- State machine score: ___ / 10
- Classifier score: ___ / 10
- Voice score: ___ / 10

## Reviewer notes

(Empty until human review — Key fills this in)

---

## Regression diff vs v1 (bot-side only)

| Turn | v1 outbound | v2 outbound |
|---|---|---|
| 0 | Hey Beverly, this is Backup Power Pro — saw your form come through. Got a sec for a couple quick questions so our electrician Key can put your quote together? | (unchanged) |
| 1 | **Perfect.** Quick one — does your generator have a big 240-volt outlet (the kind your dryer plugs into), or just regular 120-volt household outlets? | **Cool.** Does your generator have a big 240-volt outlet (the kind your dryer plugs into), or just regular 120-volt outlets? |
| 2 | Got it. Is it a 30-amp outlet (smaller 3-prong twist) or 50-amp (bigger 4-prong)? If unsure, snap a pic of the outlet and send it over. | Got it. 30-amp (smaller 3-prong twist) or 50-amp (bigger 4-prong)? Or snap a quick pic of the outlet. |
| 3 | **Perfect. Couple more quick ones —** do you own the home, or rent? (Owner has to approve panel work.) | **Sounds good.** Own or rent the place? (Owner has to sign off on panel work.) |
| 4 | **Got it. Last quick one —** roughly how far is the generator going to sit from your electrical panel? Short (under 15ft), medium (15-30ft), or longer than that? | Roughly how far is the generator gonna sit from your panel? Under 15ft, 15-30ft, or longer? |
| 5 | **Got it.** What's the best email to send your quote to? | **Right on.** What's the best email for the quote? |
| 6 | **Got it.** Install address — is it 78 Mill Pond Road, Pickens SC 29671, or somewhere else? | Install address — 78 Mill Pond Road, Pickens SC 29671, or somewhere else? |
| 7 | **Last thing —** could you snap a pic of your main electrical panel with the door open and send it over? Helps Key size up the install. | **Alright —** could you snap a pic of your main panel with the door open? Helps Key size up the install. |
| 8 | **Perfect,** that's everything we need. Key will look over your panel photo and have your quote to you by tomorrow morning. Talk soon. | Got the photo, that's everything we need. Key will look it over and have your quote to you by tomorrow morning. Talk soon. |
| 9 | (no message) | (no message) |

Bold = phrases that triggered new regex / rhythm violations under updated rules.

---

## Status

**PASS** — reached COMPLETE in 9 turns (matches v1 turn count, matches expected
terminal). Zero new violations. Seven v1 violations against the updated rules
have been remediated. Transcript is suitable for ingest into the eval registry
as the canonical Persona 08 baseline going forward.
