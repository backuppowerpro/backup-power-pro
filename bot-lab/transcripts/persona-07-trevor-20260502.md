# Persona 07 — Trevor (Unsure on Outlet)

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 07
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 11
**Status:** PASS

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Trevor, this is Backup Power Pro — saw your form come through. Got a sec for a couple quick questions so our electrician Key can put your quote together?

### Turn 1 — customer
yeah sure, fire away

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.95

### Turn 1 — state machine
GREETING -> AWAIT_240V

### Turn 1 — bot (AWAIT_240V)
Perfect. Quick one — does your generator have a big 240-volt outlet (the kind your dryer plugs into), or just regular 120-volt household outlets?

### Turn 2 — customer
yeah it's 240, definitely

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.95

### Turn 2 — state machine
AWAIT_240V -> AWAIT_OUTLET

### Turn 2 — bot (AWAIT_OUTLET)
Got it. Is the outlet 30-amp (smaller round 3-prong twist) or 50-amp (bigger 4-prong)? If you're not sure, snap a quick pic of the outlet and send it over.

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

### Turn 4 — customer
ok yeah lemme go look real quick

### Turn 4 — classifier
- state: AWAIT_OUTLET_PHOTO
- label: unclear
- confidence: 0.6
- notes: filler reply, no MMS — classifier correctly does NOT emit photo_received without actual photo

### Turn 4 — state machine
AWAIT_OUTLET_PHOTO -> AWAIT_OUTLET_PHOTO (self-loop on unclear, waiting for photo)

### Turn 4 — bot (AWAIT_OUTLET_PHOTO, self-loop)
Sounds good — take your time.

### Turn 5 — customer
[sends photo of outlet]

### Turn 5 — synthetic event (bypasses classifier)
- event: __photo_received__
- routed directly to state machine per orchestrator-agent.md photo-event protocol

### Turn 5 — state machine
AWAIT_OUTLET_PHOTO -> AWAIT_OWNERSHIP

### Turn 5 — bot (AWAIT_OWNERSHIP)
Got the photo, thanks. Two more quick things — do you own the home, or rent? (Owner has to be the one to approve panel work.)

### Turn 6 — customer
yeah we own it

### Turn 6 — classifier
- state: AWAIT_OWNERSHIP
- label: owner
- confidence: 0.97

### Turn 6 — state machine
AWAIT_OWNERSHIP -> AWAIT_RUN

### Turn 6 — bot (AWAIT_RUN)
Perfect. Last quick one — roughly how far is the generator going to sit from your electrical panel? Short (under 15ft), medium (15-30ft), or longer than that?

### Turn 7 — customer
id say bout 15 feet, give or take

### Turn 7 — classifier
- state: AWAIT_RUN
- label: run_medium
- confidence: 0.7
- notes: 15ft is the boundary; "bout 15, give or take" reads as the lower end of medium

### Turn 7 — state machine
AWAIT_RUN -> AWAIT_EMAIL

### Turn 7 — bot (AWAIT_EMAIL)
Got it. What's the best email to send your quote to?

### Turn 8 — customer
trev.mathis@gmail.com

### Turn 8 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.99
- extracted_value: trev.mathis@gmail.com

### Turn 8 — state machine
AWAIT_EMAIL -> AWAIT_ADDRESS_CONFIRM

### Turn 8 — bot (AWAIT_ADDRESS_CONFIRM)
Got it. Install address — is it 67 Crescent Avenue, Greenville SC 29605, or somewhere else?

### Turn 9 — customer
yep that's the place

### Turn 9 — classifier
- state: AWAIT_ADDRESS_CONFIRM
- label: address_confirmed
- confidence: 0.97

### Turn 9 — state machine
AWAIT_ADDRESS_CONFIRM -> AWAIT_PANEL_PHOTO

### Turn 9 — bot (AWAIT_PANEL_PHOTO)
Last thing — could you snap a pic of your main electrical panel with the door open and send it over? Helps Key size up the install.

### Turn 10 — customer
[sends photo of panel]

### Turn 10 — synthetic event (bypasses classifier)
- event: __photo_received__
- routed directly to state machine per orchestrator-agent.md photo-event protocol

### Turn 10 — state machine
AWAIT_PANEL_PHOTO -> SCHEDULE_QUOTE
- onEnter: { complete: true } — qualified-lead notification fires

### Turn 10 — bot (SCHEDULE_QUOTE)
Perfect, that's everything we need. Key will look over your panel photo and have your quote to you by tomorrow morning. Talk soon.

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

| Turn | State | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|
| 0 | GREETING | PASS | — | first-turn exclamation allowed; uses "our electrician Key" third-person |
| 1 | AWAIT_240V | PASS | — | "Perfect." acknowledgment + pivot |
| 2 | AWAIT_OUTLET | PASS | — | "Got it." acknowledgment + clean question; pre-offers photo path |
| 3 | AWAIT_OUTLET_PHOTO | PASS | — | "No worries" register matches corpus exemplar 7 |
| 4 | AWAIT_OUTLET_PHOTO (self-loop) | PASS | — | minimal acknowledgment to avoid pushy double-prompt |
| 5 | AWAIT_OWNERSHIP | PASS | — | "Got the photo, thanks." mirrors corpus exemplar 11 |
| 6 | AWAIT_RUN | PASS | — | "Perfect." pivot |
| 7 | AWAIT_EMAIL | PASS | — | "Got it." short ask |
| 8 | AWAIT_ADDRESS_CONFIRM | PASS | — | repeats address back per intent |
| 9 | AWAIT_PANEL_PHOTO | PASS | — | "snap a pic" register, third-person Key |
| 10 | SCHEDULE_QUOTE | PASS | — | "by tomorrow morning" — only sanctioned timeframe; no weekday |

---

## Auto-flags

- Did the bot reach the persona's expected terminal? PASS — COMPLETE reached
- Did any phraser output violate a hard constraint (regex check)? NO
  - /\$\d/ — none
  - weekday names — none (only "by tomorrow morning" in SCHEDULE_QUOTE, sanctioned)
  - "I'm Key" / first-person — none ("our electrician Key", "Key will look over")
  - length >280 — none (max 187 chars)
  - corporate phrases ("I appreciate", "rest assured", "feel free to") — none
- Did any classifier output have confidence <0.6 on a critical state? NO
  - Lowest was 0.6 on Turn 4 (intentionally — filler reply, correctly returned `unclear`)
  - Turn 7 was 0.7 (boundary 15ft / "give or take") — acceptable
- Did the conversation exceed 15 turns? NO (11 turns, in expected 4-15 band)
- Did any state self-loop more than 2x? NO (AWAIT_OUTLET_PHOTO visited twice — first on entry, then once on filler reply, then exited via photo_received)
- Did the bot self-disclose AI status? N/A — `asking_if_human` did not fire for Trevor

---

## Stress-test outcomes (from persona spec)

Persona 07 explicitly tests three things. All three passed:

1. `outlet_unknown` -> AWAIT_OUTLET_PHOTO transition — PASS (Turn 3)
2. `photo_received` synthetic event handling (bypasses classifier) — PASS (Turns 5 and 10)
3. Bot does NOT ask the outlet question 3 times before giving up — PASS (asked once in AWAIT_OUTLET, then politely pivoted to photo path; one gentle self-loop acknowledgment, then advanced on photo)

---

## Scoring (filled at review time)

- State machine score: ___ / 10
- Classifier score: ___ / 10
- Voice score: ___ / 10

## Reviewer notes

(Empty until human review — Key fills this in)
