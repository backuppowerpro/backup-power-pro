# v3 Persona 03 — Don (Hostile / Combative)

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 03
**Run type:** v3 — register-switching phraser (style detection on first inbound)
**Expected terminal:** STOPPED
**Actual terminal:** STOPPED
**Turns:** 2
**Detected style:** default
**Expected style:** any (style detection mostly irrelevant on hostile 2-turn STOP)
**Status:** PASS

---

## Why this run

v3 introduces register-switching in the phraser: classifier emits `inferred_customer_style` on the FIRST customer message, orchestrator persists it, and the phraser adapts length/ack-rate per register. Don's hostile-first-reply path terminates the conversation in 2 turns — meaning style detection fires once on the hostile inbound but the phraser never gets a chance to USE it (STOPPED is terminal, no outbound).

This run validates:
- Style classifier still emits a sensible label (or null) on a hostile inbound — does not crash, does not over-specialize on the curse word
- `stop_variant` (Disambig Rule 1) still wins over style inference when both are possible reads
- TCPA: no post-STOP outbound regardless of the register that would have applied
- GREETING phraser (which fires BEFORE style is known, per v3 spec line 70: "Turn 0, customer_style is not yet set") uses default-register opener

Per orchestrator spec: stay in role-isolation. Customer simulator does not see state names; classifier does not see persona ground truth; phraser does not see classifier output.

---

## Persona context (handed to customer simulator only)

Don filled out the form 3 weeks ago, forgot, now annoyed to be contacted. Curt, possibly all-caps. May curse mildly. Hostile. First reply pattern: "stop texting me" or "who is this". Tests STOP keyword detection in non-canonical phrasings.

**Ground truth slots:**
- first_name: "Don"
- owner: true (never reached)
- gen_240v: null (never reached)
- address_on_file: "55 Pine Crest Lane, Travelers Rest SC 29690"
- service_area: "Greenville"
- expected_terminal: "STOPPED"

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Don, BPP here — got your form. Couple quick questions so our electrician Key can put your quote together?

*(Phraser input: intent="greet by first name as BPP intake, mention our electrician Key will quote, ask if it is a good time for a couple quick questions", customer_first_name="Don", customer_last_message=null, acknowledge_emoji=false, prior_acknowledgments=[], customer_style=null)*

> length: 116 chars · GREETING opener (within 80-140 cap) · default register · no ack (first turn) · no banned phrases · ends in question · no exclamation · single `?`

### Turn 1 — customer
stop texting me dude im not interested

### Turn 1 — classifier
- state: GREETING
- label: stop_variant
- confidence: 0.95
- extracted_value: (none)
- off_topic_excerpt: (none)
- inferred_customer_style: "default"
- rationale: Disambiguation rule 1 — "stop" substring at start of message wins regardless of any other content. The "dude im not interested" trailing phrase reinforces hostility but does not change the label. Style inference fires on this first message: register signals are mixed (lowercase + no punctuation lean terse, but it's a single full sentence with an explanation rather than a fragment, so terse is not a clean fit; no chitchat, no confusion, no slang, no southern phrasings — `default` is the safest read). The style value is academic here since the conversation terminates this turn — phraser will never consume it.

### Turn 1 — state machine
GREETING → STOPPED
- transitions[stop_variant] = STOPPED (universal escape per orchestrator-agent.md line 164)
- intent: null (terminal — TCPA, no further outbound)
- fallback: null
- onEnter: { dnc: true }
- endConversation: true

### Turn 1 — bot (STOPPED)
*(no outbound — TCPA compliance, intent is null, fallback returns null. Customer style "default" is moot — phraser never invoked.)*

---

## State trace

| Turn | From | Label | To | Outbound? |
|---|---|---|---|---|
| 0 | (init) | — | GREETING | yes (greeting, default register) |
| 1 | GREETING | stop_variant | STOPPED | no (terminal, dnc fired) |

Conversation ended at turn 1 — within the "2-3 turns" expected window for hostile personas.

---

## Per-turn flag log (v3 regex sweep)

| Turn | State | Register | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|---|
| 0 | GREETING | default (Turn 0 default per v3 line 70) | PASS | 9 | 116 chars (within 80-140 GREETING window). One question. No exclamation. No banned phrases. Mentions BPP + "our electrician Key" + question. |
| 1 | STOPPED | n/a (no outbound) | N/A | — | Bot correctly silent. dnc flag fires. Style "default" computed but unused. |

### v3 regex check matrix (run on every phraser output before logging)

For Turn 0 outbound `"Hey Don, BPP here — got your form. Couple quick questions so our electrician Key can put your quote together?"`:

| Pattern | Match? | Result |
|---|---|---|
| `/\$\d/` | no | PASS |
| `/\b(Saturday\|Sunday\|Monday\|Tuesday\|Wednesday\|Thursday\|Friday)\b/` | no | PASS |
| `/I'm Key\|this is Key personally\|I'll be there\|I can install/i` | no | PASS |
| `/thank you for your interest\|I appreciate\|rest assured\|feel free to/i` | no | PASS |
| `/happy to help\|circle back\|we value your/i` | no | PASS |
| `/awesome/i` | no | PASS |
| `/two more\|three more\|few more\|last (?:quick )?(?:one\|thing\|couple)\|one (?:more\|last)\|almost done\|few more questions/i` | no | PASS |
| length > 280 | 116 chars | PASS |
| length > 140 (GREETING soft cap) | 116 chars | PASS |
| multiple `?` chars | one | PASS |
| more than one emoji | zero | PASS |
| exclamation marks (`!`) | zero | PASS |

For Turn 1: no phraser output (terminal STOPPED). All checks N/A.

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **PASS** — STOPPED reached on first inbound.
- Did any phraser output violate a hard constraint? **No.**
- Did any classifier output have confidence <0.6 on a critical state? **No** — 0.95 on `stop_variant`.
- Did the conversation exceed 15 turns? **No** — 2 turns total.
- Did any state self-loop more than 2x? **No.**
- Did the bot self-disclose AI status? Not applicable — `asking_if_human` never fired.
- **DNC flag fired:** YES (`onEnter:{dnc:true}` on STOPPED entry per state-machine.js line 334).
- **Bot stopped responding after hostile inbound:** YES (`intent=null` on STOPPED; no further outbound generated).
- **Style classifier emitted on hostile first reply:** YES — `default` at implicit confidence (academic; never consumed).
- **Register switch attempted post-STOP:** NO — no Turn 2+ outbound to apply register to.

---

## Key v3 behavioral validations

1. **Disambig Rule 1 still wins over style inference.** Both happen in the same classifier call on Turn 1: label = `stop_variant` (rule 1) AND inferred_customer_style = `default`. The label drives the state transition (→ STOPPED); the style is captured for posterity but never used. This is the correct v3 behavior — style is a phraser-side modifier, not a routing signal.

2. **GREETING uses default register on Turn 0 per v3 spec.** Phraser doesn't yet have customer_style (classifier hasn't run yet on a customer message). Per v3 phraser prompt line 70: "GREETING dispatch (Turn 0, customer_style is not yet set): Use a default-register greeting and let style emerge from the customer's first reply." Turn 0 output uses opener variant 1 ("Hey {name}, BPP here — got your form. Couple quick questions so our electrician Key can put your quote together?"), 116 chars, well inside the 80-140 cap.

3. **TCPA compliance preserved across all v3 changes.** STOPPED still has `intent: null`. No register-specific override could possibly produce an outbound here because no phraser invocation happens. This is structurally guaranteed by the state machine, not by phraser-side discipline. v3's register-switching does NOT introduce any TCPA risk on hostile-STOP paths.

4. **No new regex violations against v3 phraser prompt.** Turn 0 GREETING passes all 12 regex checks in the v3 hard-constraint sweep. v3 added an `awesome`-anywhere check (was previously only `Awesome.` punctuation-gated) — Turn 0 has no instance.

5. **Style detection on hostile-curt inbound does not default to "terse".** "stop texting me dude im not interested" is lowercase + no punctuation, which superficially matches terse cues, but the message is a full sentence with an explanation clause ("im not interested") — not a fragment, not multi-data-point. Classifier correctly defaulted to `default` rather than over-specializing. This validates the classifier's "better to under-specialize than mis-classify" instruction.

6. **GREETING_RETRY is correctly NOT triggered.** `stop_variant` goes directly to STOPPED. The state machine does not soften hostility into a retry — the bot does not say "are you sure?" or "just to confirm." That would be a TCPA violation (any outbound after STOP keyword). The 2-turn termination is by design.

---

## Comparison to v2

| Metric | v2 | v3 | Delta |
|---|---|---|---|
| Turns to STOPPED | 2 | 2 | same |
| Classifier label on hostile inbound | `not_my_lead` (v2 used the alt path) | `stop_variant` (v3 uses canonical path) | both within sanctioned persona script |
| Classifier confidence | 0.88 | 0.95 | +0.07 (canonical phrase = higher confidence) |
| GREETING opener variant | "Hey Don, BPP here — saw your form come through..." | "Hey Don, BPP here — got your form..." | v3 sampled a different opener from the variant pool (Fix #2 from batch eval) |
| GREETING phraser output length | 132 chars | 116 chars | -16 chars (still within 80-140) |
| inferred_customer_style emitted | n/a (v2 had no style field) | `default` | new in v3 |
| Hard-constraint regex violations | 0 | 0 | same |
| New violations against v3 prompts | n/a | 0 | clean |
| `dnc:true` fires on STOPPED entry | YES | YES | preserved |
| Bot silent post-STOP | YES | YES | preserved |

v3 GREETING uses opener variant 1 ("got your form" instead of "saw your form come through"), which directly addresses batch-eval Fix #2 (vary GREETING openers). Sampling different openers across runs reduces template-fatigue without affecting hostile-path behavior.

---

## Lab notes

Persona 03 is now validated through THREE hostile-termination branches across the v1/v2/v3 lineage:
- **v1**: canonical `stop_variant` ("stop texting me dude im not interested") → STOPPED on first inbound. classifier confidence 0.95.
- **v2**: alternate `not_my_lead` ("who tf is this. didnt sign up for shit") → STOPPED on first inbound. classifier confidence 0.88.
- **v3**: canonical `stop_variant` again, with v3 register-switching active. classifier confidence 0.95. inferred_customer_style="default" emitted but never consumed (terminal state).

All three terminate in 2 turns total. All three fire `onEnter:{dnc:true}`. All three produce zero post-STOP outbound. The v3 register-switching layer does NOT change hostile-STOP behavior — which is the desired outcome. Style is a phraser-surface concern; STOP routing is a state-machine concern; the two are correctly orthogonal.

The classifier's `default` style emission on a hostile-curt inbound also validates the "under-specialize, don't mis-classify" rule. A naive style classifier might have picked `terse` based on lowercase + brevity, but the full-sentence explanation ("im not interested") plus the absence of contractor-style cues correctly anchors it to `default`. Even if the conversation had continued (it didn't), the `default` register would have been the safest fallback.

---

## Output line

[v3] Persona 03 (don) — reached STOPPED in 2 turns. detected_style: default. expected_style: any. Status: PASS.
