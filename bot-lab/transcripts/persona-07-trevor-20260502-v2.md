# Persona 07 — Trevor (Unsure on Outlet) — REGRESSION v2

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 07
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 11
**Status:** PASS
**Iteration:** v2 (regression with updated phraser/classifier prompts)
**Prior run:** persona-07-trevor-20260502.md (also 11 turns, also PASS)

---

## What changed in v2 (vs the May-2 baseline run)

The phraser prompt picked up four new hard rules in iteration 2:

1. **Banned word "Awesome."** anywhere — SaaS-bro tell.
2. **No countdown phrasing** — "two more quick things", "last quick one",
   "almost done", "few more questions" all rejected.
3. **Acknowledgment-rhythm rule** — `prior_acknowledgments` array of last 2
   bot acks; phraser must not reuse them in the next turn (vary or skip).
4. **Tighter length target** (60-130 chars mid-flow; 80-140 GREETING).

The classifier picked up the new labels (`asking_for_context`,
`friendly_chitchat`, `answered_with_impatience`, `amending_prior_answer`,
`email_typo_suspected`), none of which fire on Trevor's path — but all
existing behavior (outlet_unknown, photo_received, run_medium boundary,
clean email_provided) still must hold.

The v1 transcript had two latent violations that the v2 prompt prevents:

- Turn 5 (AWAIT_OWNERSHIP) used **"Two more quick things"** — countdown
  phrasing. v2 rejects.
- Turn 9 (AWAIT_PANEL_PHOTO) used **"Last thing"** — countdown-adjacent.
  v2 rejects.

Both fixed below. State machine path is identical.

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Trevor, BPP here — got your form. Couple quick questions so our electrician Key can put your quote together?

- length: 113 chars (in 80-140 GREETING target)
- prior_acknowledgments going in: []
- ack used: none (greeting opener)
- regex sweeps: /\$\d/ none · weekday none · first-person none · "Awesome." none · countdown none · banned-corporate none — PASS

### Turn 1 — customer
yeah sure, fire away

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.95

### Turn 1 — state machine
GREETING -> AWAIT_240V

### Turn 1 — bot (AWAIT_240V)
Cool. Quick one — does it have a big 240-volt outlet (the kind your dryer plugs into) or just regular 120-volt?

- length: 110 chars (in 60-130 target)
- prior_acknowledgments going in: []
- ack used: "Cool."
- prior_acknowledgments rolling out: ["Cool."]
- regex sweeps: clean — PASS

### Turn 2 — customer
yeah it's 240, definitely

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.95

### Turn 2 — state machine
AWAIT_240V -> AWAIT_OUTLET

### Turn 2 — bot (AWAIT_OUTLET)
Got it. 30-amp (smaller 3-prong twist) or 50-amp (bigger 4-prong)? Or snap a quick pic of the outlet.

- length: 100 chars (in 60-130 target)
- prior_acknowledgments going in: ["Cool."]
- ack used: "Got it." (NOT "Cool." — rhythm rule satisfied)
- prior_acknowledgments rolling out: ["Cool.", "Got it."]
- regex sweeps: clean — PASS

### Turn 3 — customer
uh, no idea on that one honestly

### Turn 3 — classifier
- state: AWAIT_OUTLET
- label: outlet_unknown
- confidence: 0.95

### Turn 3 — state machine
AWAIT_OUTLET -> AWAIT_OUTLET_PHOTO

### Turn 3 — bot (AWAIT_OUTLET_PHOTO)
No worries — just snap a quick pic of the outlet on the side of the generator and send it over when you get a sec.

- length: 115 chars (in 60-130 target)
- prior_acknowledgments going in: ["Cool.", "Got it."]
- ack used: "No worries" (matches corpus exemplar 7 register, not in prior list — rhythm rule satisfied)
- prior_acknowledgments rolling out: ["Got it.", "No worries"]
- regex sweeps: clean — PASS

### Turn 4 — customer
ok yeah lemme go look real quick

### Turn 4 — classifier
- state: AWAIT_OUTLET_PHOTO
- label: unclear
- confidence: 0.6
- notes: filler reply with no MMS — classifier correctly does NOT emit photo_received without an actual photo

### Turn 4 — state machine
AWAIT_OUTLET_PHOTO -> AWAIT_OUTLET_PHOTO (self-loop on unclear, waiting for photo)

### Turn 4 — bot (AWAIT_OUTLET_PHOTO, self-loop)
Sounds good — take your time.

- length: 29 chars (mid-flow short ack is fine)
- prior_acknowledgments going in: ["Got it.", "No worries"]
- ack used: "Sounds good" (matches corpus register, not in prior list — rhythm rule satisfied)
- prior_acknowledgments rolling out: ["No worries", "Sounds good"]
- regex sweeps: clean — PASS
- self-loop counter: AWAIT_OUTLET_PHOTO visited 2x consecutively (entry + 1 self-loop). Still under the 4x stuck-failure threshold.

### Turn 5 — customer
[sends photo of outlet]

### Turn 5 — synthetic event (bypasses classifier)
- event: __photo_received__
- routed directly to state machine per orchestrator-agent.md photo-event protocol

### Turn 5 — state machine
AWAIT_OUTLET_PHOTO -> AWAIT_OWNERSHIP

### Turn 5 — bot (AWAIT_OWNERSHIP)
Got the photo, thanks. Own the place or rent? (Owner has to sign off on panel work.)

- length: 84 chars (in 60-130 target)
- prior_acknowledgments going in: ["No worries", "Sounds good"]
- ack used: "Got the photo, thanks" (mirrors corpus exemplar 11 — "Got the photo, that's a Cutler-Hammer panel"; not a generic ack, not in prior list — rhythm rule satisfied)
- prior_acknowledgments rolling out: ["Sounds good", "Got the photo, thanks"]
- regex sweeps: clean — PASS
- **v2 fix vs v1**: v1 used "Two more quick things" (countdown phrasing). v2 drops the count and just asks the next question with the corpus-style "Got the photo, thanks" pivot.

### Turn 6 — customer
yeah we own it

### Turn 6 — classifier
- state: AWAIT_OWNERSHIP
- label: owner
- confidence: 0.97

### Turn 6 — state machine
AWAIT_OWNERSHIP -> AWAIT_RUN

### Turn 6 — bot (AWAIT_RUN)
Cool. How far is the generator gonna sit from your panel? Under 15ft, 15-30ft, or longer?

- length: 91 chars (in 60-130 target)
- prior_acknowledgments going in: ["Sounds good", "Got the photo, thanks"]
- ack used: "Cool." (used in Turn 1 but NOT in last 2 — rhythm rule satisfied; the rule looks at the last 2 only)
- prior_acknowledgments rolling out: ["Got the photo, thanks", "Cool."]
- regex sweeps: clean — PASS
- **v2 fix vs v1**: v1 used "Last quick one" (countdown phrasing). v2 just asks the next thing.

### Turn 7 — customer
id say bout 15 feet, give or take

### Turn 7 — classifier
- state: AWAIT_RUN
- label: run_medium
- confidence: 0.7
- notes: 15ft is the boundary; "bout 15, give or take" reads as the lower end of medium (run_short is strictly under 15ft)

### Turn 7 — state machine
AWAIT_RUN -> AWAIT_EMAIL

### Turn 7 — bot (AWAIT_EMAIL)
Alright. What's the best email for the quote?

- length: 45 chars (mid-flow short ask is fine)
- prior_acknowledgments going in: ["Got the photo, thanks", "Cool."]
- ack used: "Alright." (acceptable per phraser rules, not in prior list — rhythm rule satisfied)
- prior_acknowledgments rolling out: ["Cool.", "Alright."]
- regex sweeps: clean — PASS

### Turn 8 — customer
trev.mathis@gmail.com

### Turn 8 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.99
- extracted_value: trev.mathis@gmail.com
- email_typo_suspected: false (gmail.com is clean — no typo flag fires)

### Turn 8 — state machine
AWAIT_EMAIL + email_provided + email_typo_suspected=false -> AWAIT_ADDRESS_CONFIRM (skips CHECK_EMAIL_TYPO)

### Turn 8 — bot (AWAIT_ADDRESS_CONFIRM)
Yep — install address: 67 Crescent Avenue, Greenville SC 29605, or somewhere else?

- length: 82 chars (in 60-130 target)
- prior_acknowledgments going in: ["Cool.", "Alright."]
- ack used: "Yep" (acceptable per phraser rules, not in prior list — rhythm rule satisfied)
- prior_acknowledgments rolling out: ["Alright.", "Yep"]
- address_on_file passed correctly into phraser input
- regex sweeps: clean — PASS

### Turn 9 — customer
yep that's the place

### Turn 9 — classifier
- state: AWAIT_ADDRESS_CONFIRM
- label: address_confirmed
- confidence: 0.97

### Turn 9 — state machine
AWAIT_ADDRESS_CONFIRM -> AWAIT_PANEL_PHOTO

### Turn 9 — bot (AWAIT_PANEL_PHOTO)
Could you snap a pic of your main panel with the door open? Helps Key size up the install.

- length: 91 chars (in 60-130 target)
- prior_acknowledgments going in: ["Alright.", "Yep"]
- ack used: none (skipping ack is acceptable per voice rule "or none"; per the rhythm rule, no ack means nothing to repeat)
- prior_acknowledgments rolling out: ["Yep", "(none)"]
- regex sweeps: clean — PASS
- **v2 fix vs v1**: v1 used "Last thing —" (countdown-adjacent). v2 just asks the request directly.

### Turn 10 — customer
[sends photo of panel]

### Turn 10 — synthetic event (bypasses classifier)
- event: __photo_received__
- routed directly to state machine per orchestrator-agent.md photo-event protocol

### Turn 10 — state machine
AWAIT_PANEL_PHOTO -> SCHEDULE_QUOTE
- onEnter: { complete: true } — qualified-lead notification fires for Key

### Turn 10 — bot (SCHEDULE_QUOTE)
Got it, that's everything we need. Key will look over your panel photo and have your quote to you by tomorrow morning. Talk soon.

- length: 130 chars (at upper edge of 60-130 target — acceptable for SCHEDULE_QUOTE wrap-up)
- prior_acknowledgments going in: ["Yep", "(none)"]
- ack used: "Got it" (used in Turn 2 but NOT in last 2 — rhythm rule satisfied)
- "by tomorrow morning" — the ONE sanctioned timeframe per phraser rules (no weekday name, no specific time)
- regex sweeps: /\$\d/ none · weekday none · first-person none · "Awesome." none · countdown none · banned-corporate none — PASS

### Turn 11 — customer
sounds good, thanks!

### Turn 11 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.93

### Turn 11 — state machine
SCHEDULE_QUOTE -> COMPLETE (terminal)

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Length | Rhythm rule | Notes |
|---|---|---|---|---|---|
| 0 | GREETING | PASS | 113 (80-140 ok) | n/a (greeting) | first-turn opener; uses "our electrician Key" third-person |
| 1 | AWAIT_240V | PASS | 110 (60-130 ok) | PASS | "Cool." ack |
| 2 | AWAIT_OUTLET | PASS | 100 (60-130 ok) | PASS (Got it. != Cool.) | pre-offers photo path |
| 3 | AWAIT_OUTLET_PHOTO | PASS | 115 (60-130 ok) | PASS (No worries != Got it./Cool.) | corpus exemplar 7 register |
| 4 | AWAIT_OUTLET_PHOTO (self-loop) | PASS | 29 (short ok) | PASS (Sounds good != No worries/Got it.) | minimal ack to avoid pushy double-prompt |
| 5 | AWAIT_OWNERSHIP | PASS | 84 (60-130 ok) | PASS (Got the photo != Sounds good/No worries) | **v2 fix: dropped "Two more quick things" countdown** |
| 6 | AWAIT_RUN | PASS | 91 (60-130 ok) | PASS (Cool. is fine; not in last 2) | **v2 fix: dropped "Last quick one" countdown** |
| 7 | AWAIT_EMAIL | PASS | 45 (short ok) | PASS (Alright. != Got the photo/Cool.) | tight ask |
| 8 | AWAIT_ADDRESS_CONFIRM | PASS | 82 (60-130 ok) | PASS (Yep != Cool./Alright.) | repeats address back per intent |
| 9 | AWAIT_PANEL_PHOTO | PASS | 91 (60-130 ok) | PASS (no ack used) | **v2 fix: dropped "Last thing" countdown** |
| 10 | SCHEDULE_QUOTE | PASS | 130 (at upper edge) | PASS (Got it not in last 2) | "by tomorrow morning" — only sanctioned timeframe |

---

## Auto-flags (regression)

- Did the bot reach the persona's expected terminal? **PASS** — COMPLETE reached at Turn 11
- Did any phraser output violate a hard constraint (regex check)?
  - /\$\d/ — **none**
  - weekday names (Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday) — **none** (only "by tomorrow morning" in SCHEDULE_QUOTE, sanctioned)
  - "I'm Key" / "this is Key personally" / "I'll be there" / "I can install" — **none** ("our electrician Key", "Key will look over")
  - length >280 — **none** (max 130 chars)
  - banned corporate ("I appreciate", "rest assured", "feel free to", "thank you for your interest", "happy to help", "circle back") — **none**
  - **NEW v2: "Awesome." anywhere** — **none**
  - **NEW v2: countdown phrasing ("two more quick", "last quick one", "almost done", "few more questions")** — **none** (v1 had two; both fixed)
  - **NEW v2: prior_acknowledgments rhythm rule** — tracked per turn; **0 violations** (every ack differs from the prior 2)
- Did any classifier output have confidence <0.6 on a critical state? **NO**
  - Lowest was 0.6 on Turn 4 (intentional — filler reply, correctly returned `unclear` per disambiguation rule 9)
  - Turn 7 was 0.7 (boundary 15ft / "give or take") — acceptable for run_medium
- Did the conversation exceed 15 turns? **NO** (11 turns, in expected 4-15 band)
- Did any state self-loop more than 2x? **NO** (AWAIT_OUTLET_PHOTO entered once + 1 self-loop on filler reply, then exited via photo_received — under 4x stuck threshold)
- Did the bot self-disclose AI status? **N/A** — `asking_if_human` did not fire for Trevor (he doesn't ask)
- Did the bot accept volunteered_data correctly? **N/A** — Trevor never volunteered extra data

---

## Stress-test outcomes (from persona spec)

Persona 07 explicitly tests three behaviors. All three passed in v2:

1. `outlet_unknown` -> AWAIT_OUTLET_PHOTO transition — **PASS** (Turn 3)
2. `photo_received` synthetic event handling (bypasses classifier) — **PASS** (Turns 5 and 10)
3. Bot does NOT ask the outlet question 3 times before giving up — **PASS** (asked once in AWAIT_OUTLET, pivoted to photo path; one gentle self-loop ack on filler reply, then advanced on photo)

---

## v1 -> v2 delta

| Surface | v1 | v2 | Why it matters |
|---|---|---|---|
| Turn 0 length | 154 chars | 113 chars | v1 ran over 140-char GREETING ceiling; v2 fits |
| Turn 5 ack | "Got the photo, thanks. Two more quick things —" | "Got the photo, thanks." (no count) | v2 drops countdown phrasing per new banned-words rule |
| Turn 6 ack | "Perfect. Last quick one —" | "Cool." (no count) | v2 drops countdown phrasing AND replaces "Perfect." (which was used in Turn 1 of v1, also a rhythm violation under new rule since same ack 2x within 2 turns) |
| Turn 9 opener | "Last thing —" | (no preamble) | v2 drops countdown-adjacent phrasing |
| Acknowledgment variety | "Perfect." used 2x in 5 turns | every ack distinct from prior 2 | rhythm rule prevents template feel |
| Length distribution | 3 messages >130 chars | all messages 29-130 chars | tighter to corpus average |

State machine path: **identical** (GREETING → AWAIT_240V → AWAIT_OUTLET → AWAIT_OUTLET_PHOTO → [self-loop] → AWAIT_OWNERSHIP → AWAIT_RUN → AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE → COMPLETE)
Classifier labels: **identical** (affirmative, gen_240v, outlet_unknown, unclear, photo_received synthetic, owner, run_medium, email_provided, address_confirmed, photo_received synthetic, affirmative)
Turn count: **identical** (11)
Terminal: **identical** (COMPLETE)

The state machine + classifier are stable across both runs. v2 only tightens the phraser surface — which is exactly the surface that v2's new prompt targets. Regression is clean.

---

## New-violations check

Were any **new** violations introduced in v2 that weren't in v1? **NO.**

The opposite is true: v2 fixes 3 latent violations that v1 had (countdown phrasing in Turns 5, 6, 9) plus 1 latent rhythm-rule violation (v1 used "Perfect." in Turn 1 and "Perfect." again in Turn 6 — same ack within 5 turns; new rule scopes the rhythm window to the last 2 turns, so Turn 6 in v1 wouldn't strictly violate, but v2's broader feel-of-template avoidance still earns the rewrite).

No regressions. No new violations.

---

## Scoring (filled at review time)

- State machine score: ___ / 10
- Classifier score: ___ / 10
- Voice score: ___ / 10

## Reviewer notes

(Empty until human review — Key fills this in)
