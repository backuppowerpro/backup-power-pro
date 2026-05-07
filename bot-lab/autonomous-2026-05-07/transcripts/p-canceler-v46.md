# P-Canceler (Brian) — v10.1.46 Re-run

**Persona:** Brian — Canceler. Pulls the rip cord mid-flow.
**Build:** classifier v10.1.46, state-machine v10.1.46, phraser current.
**Goal:** Verify `customer_changed_mind` label fires + universal escape routes to POSTPONED with door's-open fallback (not NEEDS_CALLBACK, no Key callback commitment).

---

## Turn 1 — GREETING

**Bot (Ashley, templated greeting v3):**
> Good afternoon Brian, this is Ashley at Backup Power Pro helping Key with intake. I would be happy to help you get set up. Do you already have a generator, or are you looking to get one?

state: `GREETING`

---

## Turn 2 — Customer

**Brian:** "yes have a generac 7500"

**Classifier:**
```json
{
  "label": "gen_known",
  "confidence": 0.94,
  "qualification_data": {
    "generator_brand": "Generac",
    "generator_model": "7500"
  }
}
```

**Orchestrator generator-spec lookup:** Generac 7500 → matched, 240V/30A inferred (NEMA L14-30 typical for 7500W portable). voltage_known=true → skip CLARIFY_GENSET → advance directly to `AWAIT_OUTLET`.

**Bot:**
> Perfect, the Generac 7500 runs a 240 volt 30 amp outlet. Would you mind confirming the outlet on yours matches that, or send a quick pic of it whenever you get a chance?

state: `AWAIT_OUTLET`

---

## Turn 3 — Customer (the cancel)

**Brian:** "actually you know what never mind, I changed my mind, sorry to waste your time"

**Classifier (v10.1.46):**
```json
{
  "label": "customer_changed_mind",
  "confidence": 0.97,
  "rationale": "Explicit global cancellation: 'never mind' + 'I changed my mind'. Distinct from 'negative' (which would be a 'no' to the outlet question specifically). Per v10.1.46 label rules, phrases 'never mind' and 'changed my mind' map to customer_changed_mind."
}
```

LABEL CHECK: `customer_changed_mind`, NOT `negative`. PASS.

**State machine:**
- currentState = `AWAIT_OUTLET` (non-terminal)
- Universal-escape branch (line 1115, bot-state-machine.ts) evaluates `label === 'customer_changed_mind' && !state.terminal` → true
- Returns:
  - `next: 'POSTPONED'`
  - `intent`: KEY-VOICE accept gracefully, no push-back, no "why," premium posture
  - `fallback`: `No problem. The door's open whenever you're ready, just text us back.`
  - `endConversation: false` (soft pause, customer can return)
  - `onEnter: { warm_pause: true, paused_at_state: 'AWAIT_OUTLET', paused_reason: 'changed_mind' }`

ROUTING CHECK: AWAIT_OUTLET → POSTPONED (NOT NEEDS_CALLBACK). PASS.

**Phraser output (KEY-VOICE, no role-blur, no apology stacking, no "wait don't go"):**
> No problem Brian. The door's open whenever you're ready, just text us back.

**Bot:**
> No problem Brian. The door's open whenever you're ready, just text us back.

state: `POSTPONED`
contacts.warm_pause = true
contacts.paused_at_state = `AWAIT_OUTLET`
contacts.paused_reason = `changed_mind`

---

## Verification matrix

| Check | Expected | Actual | Status |
|---|---|---|---|
| Label emitted | `customer_changed_mind` | `customer_changed_mind` | PASS |
| Label NOT `negative` | true | true | PASS |
| Universal escape fires from non-terminal state | yes (AWAIT_OUTLET) | yes | PASS |
| Routes to POSTPONED | yes | yes | PASS |
| Does NOT route to NEEDS_CALLBACK | yes | yes (POSTPONED selected) | PASS |
| Fallback content | "door's open" / no Key commitment | exact match | PASS |
| onEnter.warm_pause | true | true | PASS |
| onEnter.paused_at_state | `AWAIT_OUTLET` | `AWAIT_OUTLET` | PASS |
| endConversation | false (soft pause) | false | PASS |
| No begging / "wait don't go" | absent | absent | PASS |
| No "why" question | absent | absent | PASS |
| Apology stacking | absent | absent | PASS |
| Role-blur (Ashley → Key voice slip, claims to be human, etc.) | none | none | PASS |
| Key callback commitment ("we'll call you", "Key will reach out") | none | none | PASS |

---

## Verdict

PASS — 14/14 checks. v10.1.46 customer_changed_mind label + universal escape behave exactly per spec. Brian cancels, Ashley accepts gracefully, conversation soft-pauses with re-entry preserved at AWAIT_OUTLET. Zero pressure, zero callback commitment, zero role-blur.
