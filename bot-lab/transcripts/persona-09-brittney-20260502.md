# Persona 09 — Brittney (Emoji-Heavy)

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 09
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 9
**Status:** PASS

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
- "👍" alone → affirmative classifier label with low confidence (tested at turn 2 boundary, where she pairs "👍" with "240 yep" — emoji-only would force conf <0.6)

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
  "address_on_file": null
}
```
*Constraint check: no emoji (correct — Brittney hasn't led yet), no $, no weekday, no first-person Key, ≤280 chars. PASS.*

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

Perfect 🙌 quick one — does your generator have a big 240-volt outlet (the kind your dryer plugs into) or just regular 120-volt outlets?

**Phraser input:**
```json
{
  "intent": "ask whether their generator has a 240-volt outlet (the kind a clothes-dryer plugs into) or only 120-volt household outlets",
  "customer_first_name": "Brittney",
  "customer_last_message": "yes lol go ahead 🙌",
  "acknowledge_emoji": true,
  "address_on_file": null
}
```
*Note: `acknowledge_emoji` flipped to true on this turn after Brittney's 🙌. Bot mirrors with same emoji. Constraint check: PASS.*

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
  "address_on_file": null
}
```
*Constraint check: PASS. Bot mirrors 👍 (Brittney's emoji), acknowledges with "Got it" before pivot.*

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

Perfect 🙌 two more quick things — do you own the home, or rent? (owner has to sign off on panel work.)

**Phraser input:**
```json
{
  "intent": "ask if they own the home or rent (because owner approval is required for panel work)",
  "customer_first_name": "Brittney",
  "customer_last_message": "50 amp 🔌",
  "acknowledge_emoji": true,
  "address_on_file": null
}
```
*Constraint check: PASS.*

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

Got it 🏠 last quick one — roughly how far is the generator gonna sit from your panel? short (under 15ft), medium (15-30ft), or longer than that?

**Phraser input:**
```json
{
  "intent": "ask roughly how far the generator will sit from the electrical panel — short under 15ft, medium 15-30ft, or longer than 30ft",
  "customer_first_name": "Brittney",
  "customer_last_message": "we own it 🏠",
  "acknowledge_emoji": true,
  "address_on_file": null
}
```
*Constraint check: PASS. Mirrors 🏠.*

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

Perfect, nice and short. what's the best email to send your quote to?

**Phraser input:**
```json
{
  "intent": "ask for the best email to send the quote to",
  "customer_first_name": "Brittney",
  "customer_last_message": "like 8 feet lol pretty close 🙏",
  "acknowledge_emoji": true,
  "address_on_file": null
}
```
*Constraint check: PASS. Brittney used 🙏 but bot doesn't have to mirror every turn — restraint shows phraser isn't on autopilot.*

---

### Turn 6 — customer

brittneyparker@icloud.com 📧

### Turn 6 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.98
- extracted_value: "brittneyparker@icloud.com"

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
  "address_on_file": "245 Augusta Road, Greenville SC 29605"
}
```
*Constraint check: PASS. Address repeated back verbatim.*

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

Last thing — could you snap a pic of your main electrical panel with the door open and send it over? helps Key size up the install.

**Phraser input:**
```json
{
  "intent": "ask for a photo of their main electrical panel with the door open so Key can size up the install",
  "customer_first_name": "Brittney",
  "customer_last_message": "yep that's it 👌",
  "acknowledge_emoji": true,
  "address_on_file": null
}
```
*Constraint check: PASS.*

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

### Turn 8 — bot (SCHEDULE_QUOTE)

Perfect 🙌 that's everything we need. Key will look over your panel photo and have your quote to you by tomorrow morning. talk soon.

**Phraser input:**
```json
{
  "intent": "thank them and tell them Key will review the photo and have the quote ready by tomorrow morning. soft commitment — no specific time",
  "customer_first_name": "Brittney",
  "customer_last_message": "k one sec 📸",
  "acknowledge_emoji": true,
  "address_on_file": null
}
```
*Constraint check: "by tomorrow morning" is the SCHEDULE_QUOTE sanctioned phrase. No weekday name. No $. No first-person Key. PASS.*

**onEnter:** `{ complete: true }` — fires Key's qualified-lead notification.

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

| Turn | State | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|
| 0 | GREETING | PASS | — | No emoji (correct, Brittney hasn't led) |
| 1 | AWAIT_240V | PASS | — | First emoji mirror after acknowledge_emoji=true |
| 2 | AWAIT_OUTLET | PASS | — | Mirrors 👍 |
| 3 | AWAIT_OWNERSHIP | PASS | — | Mirrors 🙌 |
| 4 | AWAIT_RUN | PASS | — | Mirrors 🏠 |
| 5 | AWAIT_EMAIL | PASS | — | Restrained — doesn't mirror every turn |
| 6 | AWAIT_ADDRESS_CONFIRM | PASS | — | Address echoed verbatim |
| 7 | AWAIT_PANEL_PHOTO | PASS | — | |
| 8 | SCHEDULE_QUOTE | PASS | — | "by tomorrow morning" sanctioned phrase |

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **YES — COMPLETE**
- Did any phraser output violate a hard constraint? **NO**
  - `/\$\d/` — clean
  - `/\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/` — clean
  - `/I'm Key|this is Key personally|I'll be there|I can install/i` — clean
  - length > 280 — all under
  - `/thank you for your interest|I appreciate|rest assured|feel free to/i` — clean
  - exclamation marks outside turn 0 — clean (none used)
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
| `"👍"` alone → affirmative classifier label with low confidence | Tested adjacent — Brittney sent "240 yep 👍" (paired text+emoji) which yielded gen_240v conf 0.92. Pure-emoji case still untested at this turn but classifier-agent.md test #30 covers the lone-emoji case (conf 0.5). Surface left to a future persona run with emoji-only inbounds. |

---

## Scoring (filled at review time)

- State machine score: ___ / 10
- Classifier score: ___ / 10
- Voice score: ___ / 10

## Reviewer notes

(Empty until human review — Key fills this in)
