# Persona: Brad-the-Liar (Lies About Ownership, Reveals Mid-Flow)

**Date:** 2026-05-07
**Persona:** Adapted from Persona 05 (Jason, renter) + Persona 14 (Brad, casual lowercase texter)
**Expected terminal:** DISQUALIFIED_RENTER (correct behavior) OR NEEDS_CALLBACK (current behavior — fallthrough)
**Actual terminal:** NEEDS_CALLBACK
**Turns:** 8
**Status:** ⚠️ FLAG — bot did NOT detect the lie. Routed to NEEDS_CALLBACK, not DISQUALIFIED_RENTER.

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
  "expected_terminal": "DISQUALIFIED_RENTER (if bot catches lie) | NEEDS_CALLBACK (current fallthrough)"
}
```

**Ownership not asked at greeting (form filtered).** Brad volunteers nothing. Then at AWAIT_RUN he says "yeah landlord said it'd be fine to mount it on the side."

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
yeah landlord said it'd be fine to mount it on the side

### Turn 4 — classifier
- state: AWAIT_RUN
- label: panel_outdoor
- confidence: 0.62
- extracted_value: "side of house"
- off_topic_excerpt: null
- inferred_customer_style: terse

**CLASSIFIER NOTE:** The word "landlord" appears in the message, but the classifier prompt's renter examples are anchored to AWAIT_OWNERSHIP only. From AWAIT_RUN context, the model focuses on the routing answer ("side of house" = panel_outdoor or affirmative-ish) and treats "landlord said it'd be fine" as benign authorization context. There is no `renter` enum value documented as cross-state-eligible. Classifier emits `panel_outdoor` and moves on.

**RUN-SIDE ORCHESTRATOR SCAN (volunteered_data sweep):** The orchestrator's volunteered scan looks for ownership words ("we own", "renting", "my parents own") — but NOT for "landlord". The pattern "landlord said it'd be fine" is not in the regex/keyword set. No `volunteered.ownership = "renter"` is captured.

### Turn 4 — state machine
AWAIT_RUN → AWAIT_INLET_LOCATION (panel_outdoor route)

### Turn 4 — bot (AWAIT_INLET_LOCATION)
Where would you want the inlet box mounted on the outside? Standard install puts it right behind your panel with a 20ft cord. Or if you'd want it elsewhere (closer to the generator), roughly how far from the panel?

### Turn 5 — customer
behind the panel works, like 15 ft

### Turn 5 — classifier
- state: AWAIT_INLET_LOCATION
- label: inlet_default
- confidence: 0.91

### Turn 5 — state machine
AWAIT_INLET_LOCATION → AWAIT_EMAIL

### Turn 5 — bot (AWAIT_EMAIL)
Thank you. To complete the quote could I get your last name, email, and address?

### Turn 6 — customer
brad fielding, brad.f@gmail.com, 812 pelham rd greenville 29615

### Turn 6 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.97
- extracted_value: "brad.f@gmail.com / 812 Pelham Rd Greenville 29615"
- email_typo_suspected: false

### Turn 6 — state machine
AWAIT_EMAIL → CHECK_EMAIL_TYPO (no typo) → RECAP

### Turn 6 — bot (RECAP)
Thanks for all of that. Quick recap before Key reviews. Does everything look right on what you sent?

### Turn 7 — customer
yep all good. oh one thing — landlord wanted me to ask if you can just bill him direct since it's his place

### Turn 7 — classifier
- state: RECAP
- label: off_topic_question
- confidence: 0.71
- off_topic_excerpt: "landlord wanted me to ask if you can just bill him direct since it's his place"

**SECOND LIE-REVEAL.** The customer is now openly stating it's the landlord's house. This time the classifier has slightly more signal — "his place" — but the RECAP state has no `renter` transition either, AND the classifier label is off_topic_question (the bill-direct ask), not renter. The disclosure is buried inside a routing question.

### Turn 7 — state machine
RECAP → NEEDS_CALLBACK (off_topic_question is not in RECAP's transition table; falls through to default `unclear: SCHEDULE_QUOTE`... wait — RECAP's transitions DO have `unclear: SCHEDULE_QUOTE`, but `off_topic_question` is not listed. Falls to default `|| 'NEEDS_CALLBACK'`.)

### Turn 7 — bot (NEEDS_CALLBACK)
No problem. I will have Key follow up with you personally on this one. He will reach out shortly.

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Lie-detected? | Notes |
|---|---|---|---|---|
| 0 | GREETING | ✅ | n/a | |
| 1 | AWAIT_240V | ✅ | n/a | |
| 2 | AWAIT_PANEL_PHOTO | ✅ | n/a | |
| 3 | AWAIT_RUN | ✅ | n/a | panel pic accepted |
| 4 | AWAIT_INLET_LOCATION | ✅ | ❌ MISSED — "landlord said it'd be fine" classified as panel_outdoor | First lie-reveal slipped through |
| 5 | AWAIT_EMAIL | ✅ | ❌ | |
| 6 | RECAP | ✅ | ❌ | |
| 7 | NEEDS_CALLBACK | ✅ | ⚠️ partial — fell through to NEEDS_CALLBACK on the bill-direct question, but NOT because the bot detected the rental status; because RECAP has no off_topic_question transition |

---

## Auto-flags

- ❌ Did the bot reach the persona's expected terminal (DISQUALIFIED_RENTER)? **NO.** Reached NEEDS_CALLBACK instead.
- ✅ Did any phraser output violate a hard constraint? No.
- ✅ Did the bot avoid making the customer feel caught lying? **Yes — accidentally, by not catching the lie.** The bot was diplomatic by default because it never registered the contradiction.
- ⚠️ The bot DID terminate (NEEDS_CALLBACK), so the deal won't auto-close as won — Key will review the conversation manually before any quote goes out, which is a partial save.
- ❌ Renter status will NOT appear in qualification_data — `volunteered.ownership` was never set to "renter" because the orchestrator's scan keywords don't include "landlord".

---

## Findings (for the report back to Key)

1. **Classifier did not emit `renter`.** The classifier's renter enum is documented only under AWAIT_OWNERSHIP. From AWAIT_RUN and RECAP, "landlord said it'd be fine" is not flagged. Classifier returned `panel_outdoor` (Turn 4) and `off_topic_question` (Turn 7).

2. **State machine has no universal `renter` escape.** Even if the classifier emitted `renter` from AWAIT_RUN or RECAP, there is no transition for it in those states (only GREETING / AWAIT_OWNERSHIP / AWAIT_OWNERSHIP_RETRY have `renter: 'DISQUALIFIED_RENTER'`). It would fall through to the default `|| 'NEEDS_CALLBACK'` — same outcome we saw.

3. **Orchestrator volunteered_data sweep doesn't scan for "landlord".** Per orchestrator-agent.md, the ownership pattern set is `"we own"` / `"renting"` / `"my parents own"`. The phrase "landlord" is missing.

4. **NEEDS_CALLBACK was the accidental save.** The conversation terminated only because RECAP's transition table doesn't list `off_topic_question` and falls to NEEDS_CALLBACK by default. If Brad had said "yep all good" without the bill-direct ask, the bot would have advanced to SCHEDULE_QUOTE and Key would have spent time on a quote for a renter.

---

## Recommended fixes (out of scope for this persona run, listed for Key)

A. **Classifier:** Add a UNIVERSAL_LABELS section. `renter` should be emittable from any non-terminal state when "landlord", "rental", "renting", "leasing", "my landlord", "owner of the property" appears. Document examples with mid-flow context.

B. **State machine:** Add `renter: 'DISQUALIFIED_RENTER'` as a universal escape (alongside `stop_variant: 'STOPPED'` and `asking_for_human: 'NEEDS_CALLBACK'`) on every non-terminal state.

C. **Orchestrator volunteered scan:** Add `landlord`, `rental`, `leasing`, `tenant` to the ownership pattern keywords.

D. **DISQUALIFIED_RENTER intent (when triggered mid-flow after lie):** Add a softer phrasing variant for "the customer previously said yes to ownership, now revealed renter" — current intent assumes renter was disclosed cleanly. Should still be diplomatic ("Got it — sounds like the property is a rental, in that case we would need the owner to authorize the panel work directly..."), no accusation.

---

## Reviewer notes

(Empty — Key fills this in.)
