# Persona 18 — Pivot Pat (amend-at-AWAIT_RUN variant)

**Date:** 2026-05-07
**Test goal:** Customer amends an EARLIER slot (`outlet`) three turns
after answering, while bot is at `AWAIT_RUN`. Amendment text "smaller
plug" implies 3-prong (TT-30R / L5-30R = 120V) — should rewind to
`AWAIT_OUTLET`, classify as `outlet_30a_3prong`, and route to
`DISQUALIFIED_120V`.

**Persona:** Pat, 39F, lowercase, helpful but uncertain. Originally
answered "240v 4-prong" + "50 amp" confidently. Walks back to the
generator mid-conversation, sees TT-30R, says "smaller plug." Strict
role-blur prevention — Pat NEVER speaks as Ashley, Ashley NEVER speaks
as Pat.

**Ground truth (variant):**
- gen_240v: false (actual outlet is 120V TT-30R 3-prong)
- outlet_amps_first_answer: 50
- outlet_actual: 30A 3-prong / 120V
- expected_terminal: DISQUALIFIED_120V

---

## Pre-conversation state

- Form pre-confirms 240V checkbox (required to submit)
- contact_id assigns greeting_variant via sha256 — variant `C` for Pat
- time_of_day_bucket: `morning`

---

## Turn 1 — GREETING

**Ashley (templated, variant C):**
> Hi Pat, I'm Ashley, the automated assistant at Backup Power Pro.
> Thanks for reaching out about a home connection for your portable
> generator. Happy to help get this rolling. Got a few minutes to walk
> through what our electrician Key needs to provide an accurate quote?

**Pat:**
> sure go ahead

**Classifier:**
```json
{ "label": "affirmative", "confidence": 0.94 }
```

**State:** GREETING → AWAIT_240V

---

## Turn 2 — AWAIT_240V

**Ashley (phraser):**
> Awesome. To start — does the generator put out 240V, and if you
> happen to know the outlet style, is it the 4-prong twist-lock or
> the bigger 4-prong straight-blade 50A? A pic of the outlet works
> too if it's easier.

**Pat:**
> 240v 4-prong

**Classifier:**
```json
{
  "label": "gen_240v",
  "confidence": 0.92,
  "extracted_slots": { "gen_240v": true, "outlet_hint": "4-prong" }
}
```

**State:** AWAIT_240V → AWAIT_OUTLET
**Slot store:** `{ gen_240v: true }`

---

## Turn 3 — AWAIT_OUTLET

**Ashley (phraser):**
> Got it, 240V 4-prong. Just to nail it down — is that the 30A twist-lock
> (the round one with 4 holes) or the 50A straight-blade (the bigger
> rectangular one)?

**Pat:**
> 50 amp i'm pretty sure

**Classifier:**
```json
{
  "label": "outlet_50a",
  "confidence": 0.86,
  "extracted_slots": { "outlet_amps": 50, "outlet_type": "14-50R" }
}
```

**State:** AWAIT_OUTLET → AWAIT_PANEL_PHOTO
**Slot store:** `{ gen_240v: true, outlet: "50a_240v" }`

---

## Turn 4 — AWAIT_PANEL_PHOTO

**Ashley (phraser):**
> Perfect. Last quick one before I pass this to Key — could you snap
> a pic of your main electrical panel with the door open so he can
> see the breakers? No rush.

**Pat:**
> [image: panel.jpg — 200A panel, main breaker top, ~30 breakers]

**Photo classifier:**
```json
{ "is_panel": true, "main_breaker_present": true, "amps": 200 }
```

**Orchestrator emits:** `photo_received`

**State:** AWAIT_PANEL_PHOTO → AWAIT_RUN
**Slot store:** `{ ..., panel_photo: ok, panel_amps: 200 }`

---

## Turn 5 — AWAIT_RUN (THE PIVOT)

**Ashley (phraser):**
> Thanks Pat. Most main panels around here are mounted in the garage
> on an exterior wall (a wall that backs up to the outside of the
> house). Is that your setup, or is it somewhere else?

**Pat:**
> wait actually i think it's the smaller plug

*(Pat is referencing the OUTLET on the generator, not the panel
location. This is an amendment to the earlier `outlet` slot.)*

**Classifier (LIVE prompt — section 6: AMENDING vs UNCLEAR):**

Phrases that signal amend: "wait actually", "i think it's", reference
to a SLOT already answered ("plug" → outlet). Customer is at AWAIT_RUN
but referring back to the outlet question.

```json
{
  "label": "amending_prior_answer",
  "confidence": 0.91,
  "amended_slot": "outlet",
  "extracted_slots": {
    "outlet_hint": "smaller_plug"
  },
  "rationale": "phrase 'wait actually i think it's' + 'smaller plug' references the outlet slot answered 2 turns ago. amended_slot=outlet."
}
```

**State machine `transition()`:**
```js
if (label === 'amending_prior_answer' && ctx.amended_slot) {
  const rewindTarget = SLOT_TO_STATE[ctx.amended_slot];  // 'AWAIT_OUTLET'
  return { next: 'AWAIT_OUTLET', amended: true, ... };
}
```

**Result:** AWAIT_RUN → AWAIT_OUTLET (rewind, amended=true)
**Slot store:** `outlet` slot CLEARED pending re-answer.

---

## Turn 6 — AWAIT_OUTLET (re-ask after amend)

**Ashley (phraser, intent: "customer is amending their earlier answer
about outlet; acknowledge graciously and re-ask"):**

> No worries Pat, easy fix. So just to re-ground — is it the 30A
> 4-prong twist-lock (round, 4 holes) or the smaller 3-prong RV-style
> outlet? A pic of the outlet itself would lock it in if you're near
> the generator.

**Pat:**
> ok looking at it now... it's the 3-prong one. like the rv kind. tt
> something. that mean i'm out?

**Classifier:**
```json
{
  "label": "outlet_30a_3prong",
  "confidence": 0.97,
  "extracted_slots": {
    "outlet_amps": 30,
    "outlet_type": "TT-30R",
    "voltage": 120
  },
  "rationale": "explicit '3-prong', 'rv kind', 'tt' = TT-30R. 120V, not BPP-compatible."
}
```

**State:** AWAIT_OUTLET → DISQUALIFIED_120V (per transition table:
`outlet_30a_3prong: 'DISQUALIFIED_120V'`)

---

## Turn 7 — DISQUALIFIED_120V (terminal)

**Ashley (phraser, KEY-VOICE DQ):**
> Appreciate you double-checking, Pat — that's actually really helpful.
> The TT-30 outlet is 120V only, and our home connection is built
> around the 240V outlets (30A twist-lock or 50A). So unfortunately
> this one isn't a fit for the install we do. Key may still be able
> to point you toward an electrician who handles 120V transfer setups
> if you want — want me to flag that for him?

**Pat:**
> yeah that'd be great thanks

**Terminal:** `DISQUALIFIED_120V`
**Handoff payload to Key:** dq_reason=120V_outlet, original_answer=50a,
amended=true, customer_requested_referral=true.

---

## Verdict

| Check | Result |
|---|---|
| Amendment detected | YES — `amending_prior_answer` + `amended_slot=outlet` |
| Rewind to correct state | YES — AWAIT_OUTLET via SLOT_TO_STATE map |
| Phraser acknowledged amend graciously | YES — "no worries, easy fix" |
| Re-ask included photo offer | YES |
| Re-classification of 3-prong → DQ | YES — `outlet_30a_3prong` → DISQUALIFIED_120V |
| Stale slot value persisted? | NO — outlet cleared on rewind |
| Role blur | NONE |

**Final terminal:** DISQUALIFIED_120V
**Final outlet slot:** 30A 3-prong / TT-30R / 120V (correctly amended)
**Critical path tested:** classifier amended_slot detection → state-machine
SLOT_TO_STATE rewind → re-classification at rewound state → terminal DQ.
All three layers handled the pivot correctly.
