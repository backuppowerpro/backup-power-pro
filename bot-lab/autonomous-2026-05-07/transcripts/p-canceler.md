# P-Canceler — Brian (Mid-Flow Cancellation)

**Persona:** Brian. Starts qualification, gives 1-2 answers, then mid-flow says "actually never mind, I changed my mind, sorry to waste your time."

**Test:** Does Ashley accept gracefully without begging, pushing for reason, or apologizing excessively? Does she leave a clean re-entry door? Does she correctly mark POSTPONED (warm pause, soft-resumable) rather than DQ?

**Stack version:** v10.1.43 phraser + classifier + state machine.

---

## Transcript

### Turn 1 — Greeting (BPP outbound)

**State:** GREETING (variant A)
**Ashley → Brian:**
> Hi Brian, I'm Ashley, the automated assistant at Backup Power Pro. I'm helping our electrician Key gather a few details for the home connection quote for your generator. Got a couple of minutes to walk through them?

---

### Turn 2 — Brian volunteers brand+model

**Brian → Ashley:**
> Yes have a generac 7500

**Classifier:**
- `label: "affirmative"` (also captures gen_brand_model="generac 7500" via volunteered_data)
- `inferred_customer_style: "terse"` (lowercase, short, no punctuation)
- Orchestrator runs generator-spec lookup on "generac 7500" → likely matches Generac GP7500E (240V compatible) → flags `voltage_known=true`
- Routing label resolves to `gen_240v`

**State machine:** GREETING → AWAIT_PANEL_PHOTO (skips voltage check via lookup; per state-machine line 128: `gen_240v: 'AWAIT_PANEL_PHOTO'` at GREETING when generator-lookup matched compatible)

Wait — re-checking the persona spec: persona requires next state = AWAIT_OUTLET. The orchestrator-side outcome depends on whether lookup matched 240V_compatible (skips voltage) or fell through. To honor the persona's specified flow (next state = AWAIT_OUTLET), simulate as: lookup result = `voltage_selector_check` or `brand_only` → bot routes to AWAIT_OUTLET to confirm amp/prong.

**State:** AWAIT_OUTLET (style sticky = terse → short reply, no micro-color overdose)
**Ashley → Brian:**
> Generac 7500, solid unit. Connection needs either a 30 amp 4-prong twist-lock or a 50 amp 240V outlet. Does it have either? Pic of the outlet works too if easier.

---

### Turn 3 — Brian cancels mid-flow

**Brian → Ashley:**
> actually you know what never mind, I changed my mind, sorry to waste your time

**Classifier analysis:**
The classifier enum (v10.1.43) does **not** have a dedicated `cancellation_mid_flow` or `withdrawal` label. The closest fits in priority order:

1. `negative` — "no", "not now", "not really" — partial fit ("never mind" expresses a no)
2. `unclear` — genuinely ambiguous
3. `spouse_approval_needed` — no, no spouse mentioned
4. `stop_variant` — no, not "stop"/"unsubscribe"

Most likely classifier output:
- `label: "negative"` with `confidence: 0.75`
- (alternate plausible: `unclear` with low confidence)

**State machine routing:**
At `AWAIT_OUTLET`, the transitions table (state-machine.ts lines 314-333) has **no `negative` entry**. Default fallthrough (line 1359):

```
const nextState = state.transitions[label] || 'NEEDS_CALLBACK';
```

→ Routes to **NEEDS_CALLBACK** (Key gets handoff alert).

This is the gap. There is no "mid-flow customer-initiated cancellation" path that lands in POSTPONED. POSTPONED is only reached from GREETING/GREETING_RETRY on `negative`, or from `spouse_approval_needed` universal escape.

**Outcome (as currently coded):** State → NEEDS_CALLBACK with `handoff: true`. Key gets pinged. Conversation ends warmly but with a Key-needs-to-call framing, not a "door's open whenever you're ready" framing.

**State:** NEEDS_CALLBACK (terminal, handoff fires)
**Ashley → Brian (per NEEDS_CALLBACK fallback):**
> No problem. I will have Key follow up with you personally on this one. He will reach out shortly.

---

### What Ashley *should* say (ideal behavior)

Brian explicitly told us to stop *because he changed his mind* — pushing a callback from Key is the wrong response. It contradicts pillar 4 (CONFIDENT, not pushy) and pillar 3 (TRUST BUILDING — don't promise what wasn't asked for). The premium-posture move is:

> No problem at all, Brian. If you change your mind down the road, just text us back and we'll pick it up from here. Take care.

That message should land in **POSTPONED** with `paused_at_state: "AWAIT_OUTLET"` so the soft-resume path (POSTPONED_RESUME) works if Brian comes back later.

---

## Verdict

**Did Ashley accept gracefully?**
The phraser's tone instructions would produce a graceful-sounding reply ("No problem"). No begging, no "wait please don't go," no ask-for-reason language is anywhere in the prompts. ✓

**Did she beg or push back?**
No. Pillar 4 of the VOICE NORTH STAR explicitly forbids begging. ✓

**Did she correctly mark POSTPONED?**
**No.** Brian's message routes to **NEEDS_CALLBACK** (handoff to Key) because:
- The classifier enum has no `cancellation_mid_flow` / `withdrawal` / `changed_mind` label
- "Never mind" most plausibly classifies as `negative`
- `negative` has no transition at AWAIT_OUTLET → default fallthrough = NEEDS_CALLBACK

**Did she leave a clean re-entry door?**
The `NEEDS_CALLBACK` fallback ("Key will follow up with you personally") *closes* the door — it commits Key to call Brian, which is the opposite of what Brian asked for. There's no soft-resume path from NEEDS_CALLBACK. ✗

---

## Recommended fixes

1. **New classifier label:** `customer_changed_mind` — fires on "never mind", "scratch this", "changed my mind", "actually forget it", "not interested anymore". Verbatim quote captured in extracted_value.
2. **Universal escape in state-machine.ts** (alongside `spouse_approval_needed`): route to POSTPONED with `paused_at_state` = currentState, `endConversation: true`, and intent override = "customer withdrew mid-flow; accept gracefully, no follow-up pressure, leave door open for soft-resume."
3. **POSTPONED fallback variant** for this entry: "No problem at all. If you change your mind down the road, just text us back and we'll pick up from there. Take care."
4. Handoff-notifier: send Key a **silent** notification (no callback alert), tagged `customer_withdrew` so he can review but doesn't auto-call.

This gap will surface every time a polite-honest customer changes their mind. Worth adding before next deploy.
