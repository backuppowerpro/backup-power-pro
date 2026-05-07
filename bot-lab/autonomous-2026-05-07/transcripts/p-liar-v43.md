# Persona: Brad-the-Liar v10.1.43 Re-test (Universal Renter Escape)

**Date:** 2026-05-07
**Persona:** Brad-the-Liar (lies at AWAIT_OWNERSHIP path bypassed; reveals via "landlord" mid-flow)
**Bot version:** v10.1.43
**Expected terminal:** DISQUALIFIED_RENTER
**Actual terminal:** DISQUALIFIED_RENTER
**Turns:** 5 (terminated at lie-reveal)
**Status:** PASS — universal renter escape fired mid-flow as designed

---

## Persona ground truth

```json
{
  "first_name": "Brad",
  "owner": false,
  "is_lying_about_ownership": true,
  "actual_relationship": "renter",
  "gen_240v": true,
  "outlet_amps": 50,
  "address": "812 Pelham Road, Greenville SC 29615",
  "service_area": "Greenville",
  "expected_terminal": "DISQUALIFIED_RENTER"
}
```

Brad initially answers cooperatively. At Turn 4 he casually drops "yeah landlord said it'd be cool to mount it on the side." This time the classifier prompt (v10.1.43) instructs that "landlord" mid-flow emits the `renter` label regardless of state, and the state machine (line ~1090) has a universal `renter` → DISQUALIFIED_RENTER escape from any non-terminal state.

---

## Conversation

### Turn 0 — bot (GREETING, variant A)
Hi Brad, I'm Ashley, the automated assistant at Backup Power Pro. I'm helping our electrician Key gather a few details for the home connection quote for your generator. Got a couple of minutes to walk through them?

### Turn 1 — customer
yeah go ahead

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.96
- inferred_customer_style: terse

### Turn 1 — state machine
GREETING → AWAIT_240V

### Turn 1 — bot (AWAIT_240V)
Perfect. Just confirming the generator has a 240V outlet on it, either the 4-prong twist-lock or the 50-amp. A pic of the generator's outlet works too if easier.

### Turn 2 — customer
yeah 50 amp

### Turn 2 — classifier
- state: AWAIT_240V
- label: outlet_50a
- confidence: 0.94
- extracted_value: "50A"

### Turn 2 — state machine
AWAIT_240V → AWAIT_PANEL_PHOTO

### Turn 2 — bot (AWAIT_PANEL_PHOTO)
Got it, 50 amp. To put together an accurate quote, Key will also need a picture of your main electrical panel and breakers. No rush, whenever you get the chance.

### Turn 3 — customer
[sends photo of panel — door open, breakers visible, 200A main at top]

### Turn 3 — photo classifier
- subject: panel_main_open
- subject_confidence: 0.93
- primary_recommendation: accept
- main_breaker_visible: true

### Turn 3 — state machine
AWAIT_PANEL_PHOTO → AWAIT_RUN (default install offer / panel location ask)

### Turn 3 — bot (AWAIT_RUN)
Thank you. Most main panels around here are mounted in the garage on an exterior wall (a wall that backs up to the outside of the house, where you could mount something on the other side). Is that your setup, or is it somewhere else?

### Turn 4 — customer
yeah landlord said it'd be cool to mount it on the side

### Turn 4 — classifier (v10.1.43)
- state: AWAIT_RUN
- label: **renter**
- confidence: 0.88
- extracted_value: "landlord said it'd be cool to mount it on the side"
- inferred_customer_style: terse

**CLASSIFIER NOTE (v10.1.43):** The updated classifier prompt's UNIVERSAL_LABELS section explicitly lists `renter` as cross-state-eligible. The phrase "landlord said it'd be cool to mount it" matches the documented example pattern verbatim. The classifier emits `renter` instead of `panel_outdoor` because "landlord" is a strong standalone signal — owners do not casually reference a landlord on their own property. Confidence 0.88 (higher than the 0.62 panel_outdoor classification in the prior run) because the renter rule is now anchored, not inferred against context.

### Turn 4 — state machine (v10.1.43 universal escape)
AWAIT_RUN → DISQUALIFIED_RENTER (universal renter escape, line ~1090 of bot-state-machine.ts)
- onEnter: { renter_revealed_at: 'AWAIT_RUN' }
- endConversation: true

### Turn 4 — bot (DISQUALIFIED_RENTER)
Got it. For panel work like this we would need the property owner to sign off. If you can loop in your landlord, we would be happy to take it from there.

**PHRASER NOTE:** Output uses the hardcoded fallback (matches DISQUALIFIED_RENTER.fallback). Per phraser system prompt line ~1252, DQ states blame the system constraint ("panel work needs the property owner"), leave the door open ("loop in your landlord"), avoid first-person bot claims, and do NOT call out the prior contradiction. There is no "you said you owned earlier" or "you lied" — the bot is gracefully ignorant of the contradiction by design. The customer experience is a clean policy explanation, not an accusation.

### Turn 5 — customer
[no further inbound — terminal state reached, conversation ends]

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Lie-detected? | Notes |
|---|---|---|---|---|
| 0 | GREETING | PASS | n/a | |
| 1 | AWAIT_240V | PASS | n/a | |
| 2 | AWAIT_PANEL_PHOTO | PASS | n/a | |
| 3 | AWAIT_RUN | PASS | n/a | panel pic accepted |
| 4 | DISQUALIFIED_RENTER | PASS | YES — classifier emitted `renter` from AWAIT_RUN; universal escape fired | Mid-flow lie caught at first reveal |

---

## Auto-flags

- Did the bot reach the persona's expected terminal (DISQUALIFIED_RENTER)? **YES**
- Did any phraser output violate a hard constraint? No
- Did the bot avoid making the customer feel caught lying? **YES** — fallback message frames it as a policy ("we'd need the owner to sign off"), no reference to "earlier you said," no "you lied," no "actually." Door left open via "loop in your landlord." Diplomatic and graceful.
- Was the renter status captured in conversation_data? YES — `renter_revealed_at: 'AWAIT_RUN'` written via onEnter hook.
- Conversation length: 5 turns (vs 8 turns + wrong terminal in pre-fix run). Faster + correct.

---

## Comparison to pre-v10.1.43 run

| Metric | Pre-fix (p-liar.md) | v10.1.43 (this run) |
|---|---|---|
| Terminal | NEEDS_CALLBACK (accidental) | DISQUALIFIED_RENTER (intentional) |
| Turn lie was caught | Never (RECAP fell through to NEEDS_CALLBACK only because off_topic_question wasn't in the table) | Turn 4 (first reveal) |
| Classifier label at lie-reveal | panel_outdoor (0.62) | renter (0.88) |
| Conversation length | 8 turns | 5 turns |
| renter_revealed_at logged | No | Yes (AWAIT_RUN) |
| Wasted Key time | Would have advanced to SCHEDULE_QUOTE if Brad hadn't asked the bill-direct question at RECAP | Zero — terminated immediately |
| Customer felt accused? | n/a (no detection) | No (clean policy framing) |

---

## Verification of all three v10.1.43 fixes

1. **Classifier emits `renter` mid-flow** — VERIFIED (Turn 4, confidence 0.88, anchored to "landlord" keyword per system-prompt.ts line ~286-301).

2. **Universal renter escape fires regardless of current state** — VERIFIED. Fired from AWAIT_RUN; would fire identically from AWAIT_INLET_LOCATION, AWAIT_EMAIL, RECAP, or any other non-terminal state per bot-state-machine.ts line 1097-1105.

3. **Bot delivery is graceful** — VERIFIED. Fallback text: "Got it. For panel work like this we would need the property owner to sign off. If you can loop in your landlord, we would be happy to take it from there." No "you lied," no "earlier you said," no accusation. System-constraint framing per phraser-agent.md DQ rules.

---

## Reviewer notes

(Empty — Key fills this in.)
