# v8 Adversarial — Spouse Approval Mid-Flow (Beth)

**Date:** 2026-05-03
**Persona:** Beth, 38, owner, 240v 50A. Cooperative through 240v + outlet. At AWAIT_OWNERSHIP says "let me check with my husband first, he handles all this stuff. i'll text back when he's around"
**Prompt version:** v8 (state-machine.js + classifier-agent.md + phraser-agent.md as of 2026-05-03)
**Expected terminal:** POSTPONED (per test brief — spouse-approval = soft-pause, not callback request)
**Actual terminal:** NEEDS_CALLBACK
**Turns:** 5 customer-facing (Turns 0-4 bot outbound + Turn 4 customer end-of-flow)
**Status:** FLAG — classifier + phraser pass, state machine misroutes

---

## TL;DR

- Classifier correctly emits `spouse_approval_needed` (PASS).
- Phraser correctly applies the v8 spouse-approval intent handler — soft-pause language, NO "by when?" pressure, NO follow-up urgency (PASS).
- **State machine misroutes:** `AWAIT_OWNERSHIP.transitions` does not include `spouse_approval_needed`, so the label falls through to the `'NEEDS_CALLBACK'` default at `state-machine.js:484`. v8 only added the `spouse_approval_needed: 'POSTPONED'` transition at `AWAIT_PANEL_PHOTO` (line 280). Every other non-terminal state misroutes the same way.
- The phraser's `Intent contains "spouse approval needed"` handler (lines 346-351) is wired to the spouse-approval INTENT string, not the NEEDS_CALLBACK intent. So even though the classifier label is correct and the phraser handler exists, when the state machine routes to NEEDS_CALLBACK the phraser receives the NEEDS_CALLBACK intent ("warmly acknowledge and tell them Key will reach out personally shortly") — which means the bot DOES end up sending a Key-will-call-you message instead of a soft-pause "no rush, holler back" message.
- Net effect: customer experience is acceptable-but-wrong. Bot doesn't pressure. Bot doesn't ask "by when?". But bot DOES say "Key will follow up with you personally" instead of letting Beth+husband return on their own time.
- **Fix:** add `spouse_approval_needed: 'POSTPONED'` to AWAIT_OWNERSHIP transitions (and arguably to every non-terminal state that wants to honor v8's soft-pause semantic — see "Recommended fix" at the bottom).

---

## Role-isolation note

- **Customer simulator** sees ONLY persona ground-truth + bot's last outbound + history. Does not know the state machine.
- **Classifier** sees ONLY current state + last 1-2 turns + the just-typed inbound. Does not know persona ground-truth.
- **Phraser** sees ONLY intent + first_name + customer_last_message + acknowledge_emoji + (when applicable) volunteered_data + prior_acknowledgments + customer_recent_length + customer_style. Does not see classifier output, does not pick the next state.

---

## Conversation

### Turn 0 — bot (GREETING)
**Phraser input:** intent=greet by first name as BPP intake, mention electrician Key will quote, ask if it's a good time; first_name="Beth"; prior_acknowledgments=[]; customer_recent_length=null; customer_style=null

Hey Beth, this is Maya at BPP — got your form. Couple quick questions so our electrician Key can put your quote together?

(123 chars. Maya named on first turn per v7 rule. BPP + Key third-person. One question. No exclamation. 1 em-dash. customer_style not yet set.)

### Turn 1 — customer
yeah for sure

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.96
- inferred_customer_style: default
- extracted_value: —

### Turn 1 — state machine
GREETING → AWAIT_240V (intent: ask whether generator has 240v outlet or 120v only)
sticky_style ← default

### Turn 1 — bot (AWAIT_240V)
**Phraser input:** prior_acknowledgments=[]; customer_recent_length=13; customer_style=default

Cool. Does your generator have the big 240-volt outlet (the kind a dryer plugs into), or just regular 120-volt outlets?

(116 chars. Ack "Cool." — fresh. 0 em-dashes. customer_recent_length=13 is below the <25 threshold but the 240v explanation is the one place register-default ceilings apply per the responsive-length-mirror rule's teach-context caveat. Default register holds.)

### Turn 2 — customer
yes 240, it's a 50 amp twist plug

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.97
- inferred_customer_style: default
- extracted_value: —
- volunteered_added: ["volunteered.outlet_amps=50"]
- note: classifier still routes on gen_240v (correct per state-specific labels). Volunteered slot stored.

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET (intent: ask 30A or 50A, photo otherwise)
volunteered.outlet_amps=50 → phraser will CONFIRM 50-amp instead of asking from scratch

### Turn 2 — bot (AWAIT_OUTLET)
**Phraser input:** prior_acknowledgments=["Cool."]; volunteered_data="customer also said 50 amp twist plug"; customer_recent_length=21; customer_style=default

Got it. 50-amp twist with 4 prongs? Just want to lock that in.

(60 chars. Different ack ("Got it.") — not in prior_acknowledgments. Confirms volunteered datum rather than asking from scratch. 0 em-dashes. Short-turn quota: this is a ≤8-word turn (qualifies, 12 words actually but 60 chars puts it on the short side of the rotation).)

### Turn 3 — customer
yep 4 prong

### Turn 3 — classifier
- state: AWAIT_OUTLET
- label: outlet_50a
- confidence: 0.95
- inferred_customer_style: default
- extracted_value: —

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP (intent: ask if they own the home or rent — owner approval required for panel work)

### Turn 3 — bot (AWAIT_OWNERSHIP)
**Phraser input:** prior_acknowledgments=["Cool.", "Got it."]; volunteered_data=null; customer_recent_length=11; customer_style=default

Y'all own the place or renting? (Owner has to sign off on panel work.)

(70 chars. Skipped the ack (third-turn pattern in stock-ack rotation per v7 — neither "Cool." nor "Got it." reused). 0 em-dashes. customer_recent_length=11 (avg of "yes 240..."=21 and "yep 4 prong"=11 → ~16) puts us under the 25-char threshold, so length ceiling is 60 — we're at 70, soft over. Acceptable on AWAIT_OWNERSHIP because the parenthetical is the teach context that justifies the question.)

### Turn 4 — customer
let me check with my husband first, he handles all this stuff. i'll text back when he's around

### Turn 4 — classifier
- state: AWAIT_OWNERSHIP
- label: **spouse_approval_needed**
- confidence: 0.97
- inferred_customer_style: default
- extracted_value: —

(Classifier correctly emits spouse_approval_needed per the enum entry at classifier-agent.md:86-93. The phrase "let me check with my husband" is a near-textbook trigger. PASS.)

### Turn 4 — state machine

**Expected per v8 brief:** AWAIT_OWNERSHIP → POSTPONED
**Actual:** AWAIT_OWNERSHIP → NEEDS_CALLBACK

Reason: `STATES.AWAIT_OWNERSHIP.transitions` does NOT include `spouse_approval_needed`. The label falls through to the default at `state-machine.js:484`:

```js
const nextState = state.transitions[label] || 'NEEDS_CALLBACK';
```

The only state that has `spouse_approval_needed: 'POSTPONED'` wired up is `AWAIT_PANEL_PHOTO` (line 280). Every other non-terminal state misroutes the same way: GREETING, AWAIT_240V, AWAIT_OUTLET, **AWAIT_OWNERSHIP**, AWAIT_RUN, AWAIT_EMAIL, AWAIT_ADDRESS_CONFIRM. v8 implementation is incomplete.

**FAIL** on state-machine routing for this scenario.

### Turn 4 — bot (NEEDS_CALLBACK — actual)
**Phraser input:** intent="warmly acknowledge and tell them Key will reach out personally shortly. no specific time"; prior_acknowledgments=["Cool.", "Got it."]; customer_last_message="let me check with my husband first, he handles all this stuff. i'll text back when he's around"; customer_recent_length=53; customer_style=default

No worries — let me have Key follow up with y'all once your husband's around. He'll reach out personally, no rush.

(115 chars. Phraser working from the NEEDS_CALLBACK intent, which is the wrong intent for this customer state. Phraser handled the intent gracefully — no pressure, no "by when?", warm, deferred to Key. But the underlying SEMANTIC is wrong: Beth didn't ask for a callback. She said she'll text back. The bot is committing Key to outbound that isn't needed.)

### Turn 4 — bot (POSTPONED — what SHOULD have been sent)
**Hypothetical phraser input had state machine routed correctly:** intent="acknowledge politely, say no problem and we will follow up another time"; spouse_approval_needed handler active per phraser-agent.md:346-351

Yeah totally — no rush, holler back when y'all are ready. We'll be here.

(67 chars. Soft-pause. NO callback commitment. NO "by when?" pressure. NO follow-up urgency. This is the v8-intended behavior.)

### Turn 5 — customer (no message — terminal state reached either way)

---

## Test results

| Check | Expected | Actual | Pass? |
|---|---|---|---|
| Classifier emits `spouse_approval_needed` | yes | yes | PASS |
| State machine routes to POSTPONED | yes | NO (routes to NEEDS_CALLBACK) | **FAIL** |
| Phraser uses spouse-approval intent handler | yes | NO (uses NEEDS_CALLBACK intent because that's what state machine produced) | **FAIL** (downstream of state-machine bug; phraser logic is correct, just unreachable for AWAIT_OWNERSHIP) |
| Maya named on Turn 0 | yes | yes | PASS |
| All v7 etiquette rules hold | yes | yes (no banned phrases, em-dash count ≤3, short-turn quota met, prior_acknowledgments respected) | PASS |
| Bot avoids time-pressure ("by when?") | yes | yes | PASS |
| Bot avoids follow-up pressure | yes | yes (deferred to Key, framed as "no rush") | PASS |
| Conversation ends gracefully | yes | yes (NEEDS_CALLBACK is also terminal — no further outbound) | PASS (lucky — terminal state still results in graceful end, just the wrong end) |

**Voice score (1-10):** 9 — Maya's actual outbound at Turn 4 is warm, low-pressure, doesn't echo "husband", and routes the workload to Key without putting it on Beth. The only voice-side ding is that we committed Key to a callback when the customer didn't ask for one.

**Outcome:** customer experience is acceptable. Internal routing is wrong. Beth WILL get a call from Key tomorrow that she didn't ask for. In production this means Key wastes a callback slot AND the customer might feel pressured because she expected to come back when ready.

---

## Recommended fix

In `state-machine.js`, add `spouse_approval_needed: 'POSTPONED'` to the `transitions` map of every non-terminal state where the customer might reasonably need to consult a partner. At minimum:

- AWAIT_OWNERSHIP (this test)
- AWAIT_RUN
- AWAIT_EMAIL
- AWAIT_ADDRESS_CONFIRM
- (AWAIT_PANEL_PHOTO already has it)
- (GREETING — debatable; spouse-approval at GREETING is rare but possible)
- (AWAIT_240V / AWAIT_OUTLET — debatable; if customer needs spouse to look at the generator, that's photo_will_send_later territory, not spouse_approval_needed)

Cleaner alternative: treat `spouse_approval_needed` as a UNIVERSAL ESCAPE in the orchestrator's special-case logic (similar to how `stop_variant` and `asking_for_human` short-circuit at every state). Add a pre-transition check:

```js
// In transition() — before the normal transitions[label] lookup:
if (label === 'spouse_approval_needed' && !state.terminal) {
  return {
    next: 'POSTPONED',
    intent: STATES.POSTPONED.intent + ' (customer needs to consult partner — no follow-up pressure)',
    fallback: STATES.POSTPONED.fallback(ctx),
    endConversation: true,
    onEnter: { soft_pause: true, partner_term: ctx.partner_term || 'partner' },
  };
}
```

This is the universal-escape pattern v8 was supposed to be — applies to all states without per-state plumbing. Same pattern would clean up the phraser's POSTPONED intent injection so it reads the spouse-approval voice handler at lines 346-351 rather than the generic POSTPONED fallback.

---

## Final-line summary

`[v8] spouse-approval test — reached NEEDS_CALLBACK in 5 turns. spouse_approval_needed-fired: yes. Bot-pressured-for-time: no. Bot-asked-by-when: no. Voice 9. Status: FLAG.`
