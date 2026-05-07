# P03 Don — Hostile/Combative — v10.1.40 Re-run

**Date:** 2026-05-07
**Persona:** 03 Don (hostile, doesn't want to be texted)
**Classifier prompt under test:** `bot-classifier/system-prompt.ts` v10.1.40
**Change tested:** Bare "who is this" without context markers should now classify as `not_my_lead` (was previously `asking_for_context` at 0.71 confidence, costing one wasted send before STOP).

**Strict role-blur prevention:** customer turns generated independently from any system message; bot turns generated ONLY by routing classifier label → state machine → phraser. No persona narrating bot responses.

---

## Branch A — Hostile "who tf is this, didn't sign up"

**State:** GREETING
**Bot (prior turn, prod greeting v3, sent ~3 weeks ago at form-fill, then again now):**
> "Hey Don — Ashley with Backup Power Pro down in Greenville. You poked at our generator inlet form a bit ago. Quick check before I get out of your hair: do you already have a generator, or are you still shopping?"

**Customer turn 1:**
> "who tf is this i didnt sign up for shit"

### Classifier output
```json
{
  "label": "not_my_lead",
  "confidence": 0.94,
  "reasoning": "Hostility tells: 'tf', no pleasantries, firm denial 'didnt sign up for shit'. Matches Rule 5 not_my_lead pattern explicitly listed in prompt: \"who tf is this\" / \"I never signed up for anything\". No context markers (no 'again', no 'remind me'). Conservative bias under v10.1.40 reinforces.",
  "extracted_value": null,
  "inferred_customer_style": "terse"
}
```

### State machine
- GREETING + `not_my_lead` → **STOPPED**
- `onEnter: { dnc: true }` — `contacts.do_not_contact = true`
- `intent: null`, `fallback: () => null` — **no outbound**

### Phraser
- Not invoked (intent is null on STOPPED).

**Outbound to Don:** *(none)*

**Terminal state:** STOPPED ✅ (matches `expected_terminal`)

---

## Branch B — Bare "who is this" (NEW v10.1.40 behavior)

**State:** GREETING
**Bot (prior turn, identical greeting to Branch A).**

**Customer turn 1:**
> "who is this"

### Classifier output (v10.1.40)
```json
{
  "label": "not_my_lead",
  "confidence": 0.87,
  "reasoning": "v10.1.40 explicit rule (Rule 5, P03 Don sim 2026-05-07): bare 'who is this' WITHOUT context markers — no 'again', no 'remind me', no signal they remember submitting a form — defaults to not_my_lead, not asking_for_context. No follow-up question, no pleasantries. Conservative bias: STOP early rather than send another unwanted message before customer cools off.",
  "extracted_value": null,
  "inferred_customer_style": "terse"
}
```

**Pre-v10.1.40 (for comparison):** same input previously classified as `asking_for_context` at 0.71 → bot sent a memory-jog reply ("Ashley with Backup Power Pro — you filled out our generator inlet form on [date]…") before customer responded with hostility on turn 2 and finally hit STOP. Net cost: one extra unwanted send + degraded TCPA posture.

### State machine
- GREETING + `not_my_lead` → **STOPPED**
- `onEnter: { dnc: true }`
- No outbound.

### Phraser
- Not invoked.

**Outbound to Don:** *(none)*

**Terminal state:** STOPPED ✅

---

## Verdict

| Branch | Input | Label | Confidence | Outbound | Terminal | Pass |
|---|---|---|---|---|---|---|
| A | "who tf is this i didnt sign up..." | not_my_lead | 0.94 | none | STOPPED | ✅ |
| B | "who is this" | not_my_lead | 0.87 | none | STOPPED | ✅ |

**Branch A:** unchanged from prior run, still routes correctly.
**Branch B:** NEW v10.1.40 behavior verified — bare "who is this" now routes to `not_my_lead` at 0.87 (≥0.85 target), STOPPED, zero outbound. Saves the wasted memory-jog send that prior version cost.

**Role-blur:** none. Customer turns generated without classifier context; bot turns produced only via prod pipeline (classify → transition → phraser/null). No leakage.

**Recommendation:** v10.1.40 ships as expected. Watch live data for false positives where a legitimately confused-but-not-hostile customer types bare "who is this" — if it appears in cold-lead re-engagement (5+ days post-form), consider softening to allow recovery via 24h pg_cron silent re-engage rather than instant DNC. For hot/recent leads (<48h), current bias is correct.
