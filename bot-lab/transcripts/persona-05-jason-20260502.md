# Persona 05 — Jason (Renter)

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 05
**Expected terminal:** DISQUALIFIED_RENTER
**Actual terminal:** DISQUALIFIED_RENTER
**Turns:** 5
**Status:** PASS

---

## Persona ground truth (orchestrator's eyes only)

```json
{
  "first_name": "Jason",
  "owner": false,
  "gen_240v": true,
  "outlet_amps": 30,
  "run_feet": 12,
  "email": null,
  "address_on_file": "812 Pelham Road #B, Greenville SC 29615",
  "address_correct": true,
  "service_area": "Greenville",
  "expected_terminal": "DISQUALIFIED_RENTER"
}
```

Style: casual, mid-20s vibe. Cooperates through 240v + outlet questions, says "i'm renting" or "we rent" honestly when ownership comes up. May add a follow-up like "could my landlord call y'all?" — soft `off_topic_question` arriving AFTER bot has already exited cleanly to terminal, so it does not change the terminal state.

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Jason, this is Backup Power Pro — saw your form come through. Got a sec for a couple quick questions so our electrician Key can put your quote together?

### Turn 1 — customer
yeah sure go for it

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.95
- extracted_value: —
- off_topic_excerpt: —

### Turn 1 — state machine
GREETING → AWAIT_240V (intent: ask whether their generator has a 240-volt outlet (the kind a clothes-dryer plugs into) or only 120-volt household outlets)

### Turn 1 — bot (AWAIT_240V)
Cool. Quick one — does your generator have a big 240-volt outlet (the kind your clothes dryer plugs into), or just regular 120-volt household outlets?

### Turn 2 — customer
yeah it's got the big 240 one

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.92
- extracted_value: —
- off_topic_excerpt: —

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET (intent: ask if the 240v outlet is a 30-amp (smaller, looks like 3-prong twist-lock) or 50-amp (bigger, 4-prong) — note that if they don't know, ask them to send a photo)

### Turn 2 — bot (AWAIT_OUTLET)
Got it. Is it a 30-amp outlet (smaller round 3-prong twist-lock) or a 50-amp (bigger 4-prong)? If you're not sure, snap a quick pic of the outlet and send it over.

### Turn 3 — customer
30 amp, the twist lock one

### Turn 3 — classifier
- state: AWAIT_OUTLET
- label: outlet_30a
- confidence: 0.96
- extracted_value: —
- off_topic_excerpt: —

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP (intent: ask if they own the home or rent (because owner approval is required for panel work))

### Turn 3 — bot (AWAIT_OWNERSHIP)
Perfect. Two more quick things — do you own the place, or rent? (Owner has to be the one to sign off on panel work.)

### Turn 4 — customer
ah i'm renting actually

### Turn 4 — classifier
- state: AWAIT_OWNERSHIP
- label: renter
- confidence: 0.97
- extracted_value: —
- off_topic_excerpt: —

### Turn 4 — state machine
AWAIT_OWNERSHIP → DISQUALIFIED_RENTER (terminal; intent: politely explain that panel work needs the property owner to authorize and suggest looping in the landlord)

### Turn 4 — bot (DISQUALIFIED_RENTER)
Got it — for panel work like this we'd need the property owner to sign off. If you can loop in your landlord, we're happy to take it from there.

### Turn 5 — customer
oh ok. could my landlord call y'all?

### Turn 5 — classifier
- state: DISQUALIFIED_RENTER (terminal — bot already exited)
- label: off_topic_question
- confidence: 0.78
- extracted_value: —
- off_topic_excerpt: "could my landlord call y'all?"

### Turn 5 — state machine
DISQUALIFIED_RENTER is terminal — no further outbound from bot. Jason's follow-up arrives after clean exit; bot does not respond. (In production this would queue a passive notification to Key with the verbatim excerpt; the conversation does not re-open.)

---

## Hard-constraint regex check on every phraser output

| Turn | State | Output (truncated) | $? | weekday? | I'm Key? | >280? | corp phrase? | Pass |
|---|---|---|---|---|---|---|---|---|
| 0 | GREETING | Hey Jason, this is Backup Power Pro... | no | no | no | no (158) | no | yes |
| 1 | AWAIT_240V | Cool. Quick one — does your generator... | no | no | no | no (148) | no | yes |
| 2 | AWAIT_OUTLET | Got it. Is it a 30-amp outlet... | no | no | no | no (171) | no | yes |
| 3 | AWAIT_OWNERSHIP | Perfect. Two more quick things — do you own... | no | no | no | no (107) | no | yes |
| 4 | DISQUALIFIED_RENTER | Got it — for panel work like this we'd need... | no | no | no | no (147) | no | yes |

All 5 phraser outputs pass hard-constraint checks. Zero `phraser_fallback_used` events.

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|
| 0 | GREETING | yes | — | First-name greeting, BPP intake framing, third-person Key reference, single question |
| 1 | AWAIT_240V | yes | — | "Cool." acknowledges, plain-English explanation of 240v vs 120v |
| 2 | AWAIT_OUTLET | yes | — | "Got it." acknowledges 240v answer, offers photo path for unknown |
| 3 | AWAIT_OWNERSHIP | yes | — | "Perfect." acknowledges, parenthetical explains the why ("Owner has to be the one to sign off") |
| 4 | DISQUALIFIED_RENTER | yes | — | Polite-but-firm exit, suggests looping in landlord, no false hope |

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **yes** — DISQUALIFIED_RENTER hit on turn 4 as expected
- Did any phraser output violate a hard constraint (regex check)? **no** — 0 violations across 5 outputs
- Did any classifier output have confidence <0.6 on a critical state? **no** — minimum confidence was 0.78 on the post-terminal off_topic_question (not a critical state)
- Did the conversation exceed 15 turns? **no** — 5 turns total, well within healthy 4-15 range
- Did any state self-loop more than 2x? **no** — every state was visited exactly once
- Did the bot self-disclose AI status correctly when asking_if_human fired? **n/a** — Jason never asked
- Did the bot try to qualify the renter through other means after disqualification? **no** — clean polite exit, no improvised "well maybe if..." soft commitments
- Did the bot try to schedule a landlord callback when Jason asked? **n/a** — bot is terminal; Jason's follow-up question arrives but bot does not respond. Off-topic excerpt captured for Key's notification queue.

---

## Coverage exercised by this run

- Classifier enum values exercised: `affirmative`, `gen_240v`, `outlet_30a`, `renter`, `off_topic_question`
- State transitions exercised: GREETING→AWAIT_240V, AWAIT_240V→AWAIT_OUTLET, AWAIT_OUTLET→AWAIT_OWNERSHIP, AWAIT_OWNERSHIP→DISQUALIFIED_RENTER
- Disqualification path: DISQUALIFIED_RENTER terminal hit cleanly without retry loops
- Phraser hard constraints exercised: no price leak under polite disqualification, no weekday name, no first-person Key claim, no corporate phrases, all outputs ≤280 chars

---

## Scoring (filled at review time)

- State machine score: ___ / 10
- Classifier score: ___ / 10
- Voice score: ___ / 10

## Reviewer notes

(Empty until human review — Key fills this in)

### Worth flagging for Key's review

1. **Post-terminal follow-up handling.** Jason's "could my landlord call y'all?" arrives AFTER the bot has cleanly exited to DISQUALIFIED_RENTER. The state machine correctly does not re-engage. In production we should confirm the orchestrator captures this excerpt and surfaces it to Key as a passive notification (so Key can text Jason back manually with "yeah, have him text this number" if he wants the lead). This is not a bug — it's a question of what happens to the off_topic_excerpt after a terminal disqualification. Worth a one-line decision: discard, or queue as a low-priority callback?

2. **DISQUALIFIED_RENTER messaging tone.** The fallback "Got it — for panel work like this we'd need the property owner to sign off. If you can loop in your landlord, we're happy to take it from there" is polite-but-firm and leaves the door open. Reads correctly. No false promise, no quote, no schedule.
