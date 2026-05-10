# Persona 09 — Brittney (Emoji-Heavy) — REGRESSION v2

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 09
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 9
**Status:** PASS
**Run type:** Regression (v2) — re-run with updated phraser prompt
**Diff vs v1 (`persona-09-brittney-20260502.md`):**
- Phraser rule "1 emoji max per message" is now explicit (`phraser-agent.md` §VOICE + §HARD CONSTRAINTS auto-checks: "More than one emoji → reject")
- Phraser countdown ban now explicit ("two more quick", "last quick one", "almost done", "few more questions" all blocked)
- v1 turns 3 and 4 contained banned countdown phrasing ("two more quick things", "last quick one") — fixed in v2
- Same expected path, same persona ground truth, same expected_terminal

---

## Persona ground truth (orchestrator-only context)

```json
{
  "first_name": "Brittney",
  "owner": true,
  "gen_240v": true,
  "outlet_amps": 50,
  "run_feet": 8,
  "email": "brittneyparker@icloud.com",
  "address_on_file": "245 Augusta Road, Greenville SC 29605",
  "address_correct": true,
  "service_area": "Greenville",
  "expected_terminal": "COMPLETE"
}
```

**Style:** lowercase, emojis on most messages, "lol" common, short replies.

**Test surfaces under stress:**
- `acknowledge_emoji` flag flips to `true` after Brittney's first emoji and the bot must mirror, not initiate
- Bot greeting (turn 0) MUST be emoji-free since Brittney hasn't used one yet
- Bot must mirror only the kind she led with (per phraser rule: "1 emoji max per message, and only the kind they led with")
- **NEW v2:** verify zero doubled-emoji outputs (auto-check: more than one emoji → reject)
- **NEW v2:** verify no countdown phrasing ("two more", "last quick one", "almost done", "few more questions")
- "👍" alone → affirmative classifier label with low confidence (tested adjacent — see persona-specific surfaces)

---

## Conversation

### Turn 0 — bot (GREETING)

Hey Brittney, this is Backup Power Pro — saw your form come through. Got a sec for a couple quick questions so our electrician Key can put your quote together?

**Phraser input:**
```json
{
  "intent": "greet by first name as BPP intake, mention our electrician Key will quote, ask if it is a good time for a couple quick questions",
  "customer_first_name": "Brittney",
  "customer_last_message": null,
  "acknowledge_emoji": false,
  "address_on_file": null,
  "prior_acknowledgments": []
}
```
*Constraint check: no emoji (correct — Brittney hasn't led yet), no $, no weekday, no first-person Key, no corp phrases, no countdown, ≤280 chars (159 chars). Single emoji-count: 0. PASS.*

---

### Turn 1 — customer

yes lol go ahead 🙌

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.95

### Turn 1 — state machine
GREETING → AWAIT_240V

### Turn 1 — bot (AWAIT_240V)

Cool 🙌 quick one — does your generator have a big 240-volt outlet (the kind your dryer plugs into) or just regular 120-volt outlets?

**Phraser input:**
```json
{
  "intent": "ask whether their generator has a 240-volt outlet (the kind a clothes-dryer plugs into) or only 120-volt household outlets",
  "customer_first_name": "Brittney",
  "customer_last_message": "yes lol go ahead 🙌",
  "acknowledge_emoji": true,
  "address_on_file": null,
  "prior_acknowledgments": []
}
```
*Note: `acknowledge_emoji` flipped to true on this turn after Brittney's 🙌. Bot mirrors with same emoji (1 only). Switched from "Perfect" (banned with !, OK without; v1 used "Perfect 🙌") to "Cool" to vary acknowledgment vocab. Constraint check: 1 emoji, ≤280 chars (132). PASS.*

---

### Turn 2 — customer

240 yep 👍

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.92

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET

### Turn 2 — bot (AWAIT_OUTLET)

Got it 👍 is it a 30-amp outlet (smaller 3-prong twist) or 50-amp (bigger 4-prong)? if you're unsure, snap a pic of the outlet and send it over.

**Phraser input:**
```json
{
  "intent": "ask if the 240v outlet is a 30-amp (smaller, looks like 3-prong twist-lock) or 50-amp (bigger, 4-prong) — note that if they don't know, ask them to send a photo",
  "customer_first_name": "Brittney",
  "customer_last_message": "240 yep 👍",
  "acknowledge_emoji": true,
  "address_on_file": null,
  "prior_acknowledgments": ["Cool"]
}
```
*Constraint check: PASS. Bot mirrors 👍 (Brittney's emoji on this turn — switched from 🙌 since she switched). 1 emoji, 143 chars, no countdown, no $. Acknowledgment "Got it" not in prior_acknowledgments — OK.*

---

### Turn 3 — customer

50 amp 🔌

### Turn 3 — classifier
- state: AWAIT_OUTLET
- label: outlet_50a
- confidence: 0.95

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP

### Turn 3 — bot (AWAIT_OWNERSHIP)

Sounds good 🔌 do you own the home or rent? (owner has to sign off on panel work.)

**Phraser input:**
```json
{
  "intent": "ask if they own the home or rent (because owner approval is required for panel work)",
  "customer_first_name": "Brittney",
  "customer_last_message": "50 amp 🔌",
  "acknowledge_emoji": true,
  "address_on_file": null,
  "prior_acknowledgments": ["Cool", "Got it"]
}
```
*Constraint check: PASS. Mirrors 🔌. **v1 fix:** v1 said "Perfect 🙌 two more quick things — do you own the home, or rent?" — that violates updated countdown rule ("two more quick things"). v2 drops the countdown, mirrors the emoji Brittney just used (🔌 instead of v1's 🙌), and uses "Sounds good" (not in prior_acknowledgments). 1 emoji, 81 chars, no countdown.*

---

### Turn 4 — customer

we own it 🏠

### Turn 4 — classifier
- state: AWAIT_OWNERSHIP
- label: owner
- confidence: 0.95

### Turn 4 — state machine
AWAIT_OWNERSHIP → AWAIT_RUN

### Turn 4 — bot (AWAIT_RUN)

Right on 🏠 roughly how far is the generator gonna sit from your panel? short (under 15ft), medium (15-30ft), or longer than that?

**Phraser input:**
```json
{
  "intent": "ask roughly how far the generator will sit from the electrical panel — short under 15ft, medium 15-30ft, or longer than 30ft",
  "customer_first_name": "Brittney",
  "customer_last_message": "we own it 🏠",
  "acknowledge_emoji": true,
  "address_on_file": null,
  "prior_acknowledgments": ["Got it", "Sounds good"]
}
```
*Constraint check: PASS. Mirrors 🏠. **v1 fix:** v1 said "Got it 🏠 last quick one — roughly how far…" — "last quick one" is banned countdown phrasing in v2. v2 drops it and uses "Right on" (varied — not in prior_acknowledgments). 1 emoji, 129 chars, no countdown.*

---

### Turn 5 — customer

like 8 feet lol pretty close 🙏

### Turn 5 — classifier
- state: AWAIT_RUN
- label: run_short
- confidence: 0.92
- extracted_value: "8 feet"

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL

### Turn 5 — bot (AWAIT_EMAIL)

Nice and short. what's the best email to send your quote to?

**Phraser input:**
```json
{
  "intent": "ask for the best email to send the quote to",
  "customer_first_name": "Brittney",
  "customer_last_message": "like 8 feet lol pretty close 🙏",
  "acknowledge_emoji": true,
  "address_on_file": null,
  "prior_acknowledgments": ["Sounds good", "Right on"]
}
```
*Constraint check: PASS. Brittney used 🙏 but bot doesn't mirror every turn (restraint per phraser rule "vary or drop the acknowledge-then-ask pattern"). 0 emojis on this turn — phraser proves it isn't on autopilot. 60 chars (well under 60-130 target floor — slightly tight but on-brand for Key's voice).*

---

### Turn 6 — customer

brittneyparker@icloud.com 📧

### Turn 6 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.98
- extracted_value: "brittneyparker@icloud.com"
- email_typo_suspected: false (icloud.com is clean — not in typo list)

### Turn 6 — state machine
AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM)

Got it. install address — is it 245 Augusta Road, Greenville SC 29605, or somewhere else?

**Phraser input:**
```json
{
  "intent": "confirm the install address using the value already on file from the form (passed in via slots.address_on_file) — ask if it matches or if it should be different",
  "customer_first_name": "Brittney",
  "customer_last_message": "brittneyparker@icloud.com 📧",
  "acknowledge_emoji": true,
  "address_on_file": "245 Augusta Road, Greenville SC 29605",
  "prior_acknowledgments": ["Right on", null]
}
```
*Constraint check: PASS. Address echoed verbatim. Bot does NOT mirror 📧 — restraint. "Got it" was used 4 turns ago so OK to recycle (only last-2 acks blocked). 0 emojis, 89 chars.*

---

### Turn 7 — customer

yep that's it 👌

### Turn 7 — classifier
- state: AWAIT_ADDRESS_CONFIRM
- label: address_confirmed
- confidence: 0.95

### Turn 7 — state machine
AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO

### Turn 7 — bot (AWAIT_PANEL_PHOTO)

One more — could you snap a pic of your main electrical panel with the door open and send it over? helps Key size up the install.

**Phraser input:**
```json
{
  "intent": "ask for a photo of their main electrical panel with the door open so Key can size up the install",
  "customer_first_name": "Brittney",
  "customer_last_message": "yep that's it 👌",
  "acknowledge_emoji": true,
  "address_on_file": null,
  "prior_acknowledgments": ["Got it", null]
}
```
*Constraint check: PASS. 0 emojis (restraint). "One more —" is borderline countdown but is descriptive of state, not a question-count promise; phrased without "quick" / "almost done". 129 chars.*

> Reviewer flag: "One more —" is on the edge of the countdown rule. The banned set is specifically "two more quick", "last quick one", "almost done", "few more questions". A bare "one more" without "quick" is allowable per the listed regex but adjacent to the spirit of the rule. Acceptable until Key tightens the regex; flagged for human review.

---

### Turn 8 — customer

k one sec 📸

[sends photo of panel — `__photo_received__` synthetic event]

### Turn 8 — classifier
- state: AWAIT_PANEL_PHOTO
- label: photo_received
- confidence: 1.0
- *(Direct synthetic event from MMS attachment, not LLM-classified per state-machine.js convention.)*

### Turn 8 — state machine
AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE
**onEnter:** `{ complete: true }` — fires Key's qualified-lead notification

### Turn 8 — bot (SCHEDULE_QUOTE)

Got the photo 🙌 that's everything we need. Key will look it over and have your quote to you by tomorrow morning. talk soon.

**Phraser input:**
```json
{
  "intent": "thank them and tell them Key will review the photo and have the quote ready by tomorrow morning. soft commitment — no specific time",
  "customer_first_name": "Brittney",
  "customer_last_message": "k one sec 📸",
  "acknowledge_emoji": true,
  "address_on_file": null,
  "prior_acknowledgments": [null, "Got it"]
}
```
*Constraint check: "by tomorrow morning" is the SCHEDULE_QUOTE sanctioned phrase. No weekday name (no Friday/Monday/etc). No $. No first-person Key. 1 emoji 🙌 (echoes the same emoji Brittney first led with at turn 1; valid mirror — not 📸 because 🙌 has been the persona's highest-frequency emoji this thread, totally optional). 123 chars. PASS.*

---

### Turn 9 — customer

amazing thanks!! 🙏✨

### Turn 9 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.95

### Turn 9 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal)

### Turn 9 — bot
*(no outbound — COMPLETE is terminal)*

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Emoji-count | Notes |
|---|---|---|---|---|
| 0 | GREETING | PASS | 0 | No emoji (correct, Brittney hasn't led) |
| 1 | AWAIT_240V | PASS | 1 (🙌) | First mirror after acknowledge_emoji=true; "Cool" varies from v1's "Perfect" |
| 2 | AWAIT_OUTLET | PASS | 1 (👍) | Mirrors what she just sent |
| 3 | AWAIT_OWNERSHIP | PASS | 1 (🔌) | **v1→v2 fix:** removed "two more quick things" countdown |
| 4 | AWAIT_RUN | PASS | 1 (🏠) | **v1→v2 fix:** removed "last quick one" countdown |
| 5 | AWAIT_EMAIL | PASS | 0 | Restraint — doesn't mirror every turn |
| 6 | AWAIT_ADDRESS_CONFIRM | PASS | 0 | Address echoed verbatim |
| 7 | AWAIT_PANEL_PHOTO | PASS | 0 | "One more —" flagged for human review (edge case) |
| 8 | SCHEDULE_QUOTE | PASS | 1 (🙌) | "by tomorrow morning" sanctioned phrase |

---

## Auto-flags (re-run with v2 regex set)

- Did the bot reach the persona's expected terminal? **YES — COMPLETE**
- Did any phraser output violate a hard constraint? **NO**
  - `/\$\d/` — clean
  - `/\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/i` — clean
  - `/I'm Key|this is Key personally|I'll be there|I can install/i` — clean
  - length > 280 — all under (max 159 on turn 0 / 143 on turn 2)
  - `/thank you for your interest|I appreciate|rest assured|feel free to|happy to help|circle back/i` — clean
  - `/Awesome\.|Awesome!|Awesome,/` — clean (zero "Awesome" anywhere)
  - **NEW v2:** `/two more quick|last quick one|almost done|few more questions/i` — **clean** (v1 violations on turns 3+4 were fixed; "One more —" on turn 7 does not match the regex but is flagged for human review)
  - **NEW v2 emoji-overflow check:** every output ≤1 emoji — **clean** (max emoji-count on any turn is 1)
  - exclamation marks outside turn 0 — clean (turn 0 has none either; allowed but not used)
  - acknowledgment-rhythm: no acknowledgment phrase reused within last 2 bot turns — **clean** (used Cool → Got it → Sounds good → Right on → [none] → Got it → [none] → [none])
- Did any classifier output have confidence <0.6 on a critical state? **NO** (all ≥0.92)
- Did the conversation exceed 15 turns? **NO** (9 turns — well within 4-15 healthy band)
- Did any state self-loop more than 2x? **NO**
- Did the bot self-disclose AI status? N/A — `asking_if_human` not triggered for this persona

---

## Persona-specific test surfaces — VERIFIED

| Test | Result |
|---|---|
| Bot greeting (turn 0) is emoji-free before customer leads with one | PASS — turn 0 has zero emoji |
| `acknowledge_emoji` flag flips to true on turn 1 (after Brittney's 🙌) | PASS |
| Bot mirrors emoji once led but doesn't initiate unprompted | PASS — bot mirrored on turns 1-4 and turn 8, restrained on turns 5-7 |
| Phraser uses ONE emoji max per output (new explicit v2 rule) | **PASS — every emoji-mirroring turn used exactly 1 emoji; zero double-emoji outputs** |
| Phraser mirrors only the kind customer led with | PASS — turn 1 mirrors 🙌, turn 2 mirrors 👍, turn 3 mirrors 🔌, turn 4 mirrors 🏠, turn 8 mirrors 🙌 (a previously-used customer emoji) |
| No countdown phrasing in any turn (new v2 explicit) | **PASS — v1's "two more quick things" and "last quick one" both replaced; turn 7's "One more —" flagged for human review but does not match the listed regex** |
| Acknowledgment-rhythm rule (no reuse within last 2 bot turns) | PASS |
| `"👍"` alone → affirmative classifier label with low confidence | Tested adjacent — Brittney sent "240 yep 👍" (paired text+emoji) which yielded gen_240v conf 0.92. Pure-emoji case still untested at this turn but classifier-agent.md test #30 covers the lone-emoji case (conf 0.5). Surface left to a future persona run with emoji-only inbounds. |

---

## Diff vs v1 — what actually changed

| Turn | v1 output | v2 output | Why |
|---|---|---|---|
| 1 | "Perfect 🙌 quick one — does your generator…" | "Cool 🙌 quick one — does your generator…" | "Perfect" overused / acknowledgment-rhythm freshness |
| 3 | "Perfect 🙌 two more quick things — do you own the home, or rent?" | "Sounds good 🔌 do you own the home or rent? (owner has to sign off on panel work.)" | **v2 rule: "two more quick" is banned countdown** |
| 4 | "Got it 🏠 last quick one — roughly how far is…" | "Right on 🏠 roughly how far is…" | **v2 rule: "last quick one" is banned countdown** |
| 7 | "Last thing — could you snap a pic…" | "One more — could you snap a pic…" | "Last thing" → "One more" (similar register, neither matches the banned regex; cosmetic) |
| 8 | "Perfect 🙌 that's everything we need…" | "Got the photo 🙌 that's everything we need…" | More specific acknowledgment of the photo synthetic event |

All other turns identical to v1.

---

## Scoring (filled at review time)

- State machine score: ___ / 10
- Classifier score: ___ / 10
- Voice score: ___ / 10

## Reviewer notes

(Empty until human review — Key fills this in)

Auto-suggestion for Key: tighten the countdown regex to also catch "one more" / "last thing" so the spirit of the rule is enforced regardless of phrasing, e.g. `/(?:two more|three more|few more|last (?:quick )?(?:one|thing)|one more|almost done|few more questions)/i`. Otherwise turn-7-style "One more —" stays in the dataset and the rule stays a vocabulary game instead of a behavior rule.
