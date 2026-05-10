# Persona 05 — Jason (Renter) — v3

**Date:** 2026-05-02
**Run:** v3 (register-switching phraser; classifier emits `inferred_customer_style` on first inbound; orchestrator persists)
**Persona file:** `agents/customer-personas.md` → Persona 05
**Expected terminal:** DISQUALIFIED_RENTER
**Actual terminal:** DISQUALIFIED_RENTER
**Turns to terminal:** 4 (turn 5 is post-terminal noise — bot already exited)
**Expected detected_style:** default
**Actual detected_style:** default
**Status:** PASS

---

## What changed since v2

This is the v3 prompt build. Mechanics specific to this run:

1. **Classifier emits `inferred_customer_style` on the first inbound only.** For Jason, the first reply is `yeah sure go for it` — short-ish (5 words), lowercase, no punctuation, but NOT a burst of multiple data points and NOT confused/asking-for-context and NOT chatty/southern. It's plain cooperation. Per the classifier's STYLE INFERENCE rules, the right call is `default` — the plurality bucket. Better to under-specialize than mis-classify a casual mid-20s vibe as `terse` and force the phraser into <80-char bare asks that would feel curt for a DQ exit.
2. **Orchestrator persists `customer_style="default"` for the rest of the conversation** and passes it on every phraser call.
3. **Phraser applies the default register:** target length 60–130, acknowledge 50–70% of the time, rotate acknowledgments per `prior_acknowledgments`. Same rules as v2 — v3 is a no-op for default-register customers, which is exactly the test.
4. **DQ warmth-budget rule (v3 explicit):** `Disqualifications carry warmth budget that overrides register length caps.` Jason's DQ message is allowed 110+ chars even in Terse register; for Default register it's even more comfortable. We use that headroom — the DQ message is 132 chars, slightly above the 60–130 mid-flow target, justified by the polite-decline intent.
5. **Decline-warmth criterion:** v3 explicitly forbids `"ah dang"` / `"unfortunately"` and requires (a) blame the system constraint, (b) leave the door open. Both satisfied below.

---

## Persona ground truth (orchestrator's eyes only — NOT visible to classifier or phraser)

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

Style cues per personas file: casual, mid-20s vibe; cooperates through 240v + outlet; honestly says he rents on the ownership question; may ask "could my landlord call y'all?" AFTER the bot has already exited.

---

## Conversation

### Turn 0 — bot (GREETING)

**phraser input:**
```json
{
  "intent": "greet by first name as BPP intake; one question to gate the consent",
  "customer_first_name": "Jason",
  "customer_last_message": null,
  "acknowledge_emoji": false,
  "prior_acknowledgments": [],
  "customer_style": null
}
```

**phraser output:**

> Hey Jason — Backup Power Pro. Saw you came through the site. Got a sec for a couple quick questions so Key can put your quote together?

(140 chars — at GREETING ceiling. Opener variant #2 from v3 phraser-agent.md GREETING list. Style not yet detected.)

### Turn 1 — customer

> yeah sure go for it

### Turn 1 — classifier

**classifier input (role-isolated):**
```json
{
  "state": "GREETING",
  "recent_turns": [{ "role": "bot", "text": "Hey Jason — Backup Power Pro..." }],
  "inbound_message": "yeah sure go for it"
}
```

**classifier output:**
```json
{
  "label": "affirmative",
  "confidence": 0.95,
  "inferred_customer_style": "default"
}
```

**Style inference reasoning (classifier's, role-isolated):** 5 words, lowercase, no punctuation, plain cooperation. Not <6 words AND with multiple data points → not `terse`. No confusion or definitional question → not `educational`. No "y'all"/southern phrasing/chitchat → not `buddy`. Falls to `default` (plurality bucket). Per the classifier rule: "If you can't tell, default to default. Better to under-specialize than mis-classify."

### Turn 1 — state machine
GREETING → AWAIT_240V (intent: ask whether their generator has a 240-volt outlet (the kind a clothes-dryer plugs into) or only 120-volt household outlets).
**customer_style now persisted = `default`** for the rest of the conversation.

### Turn 1 — bot (AWAIT_240V)

**phraser input:**
```json
{
  "intent": "ask if generator has 240v outlet (dryer-style) or 120v only",
  "customer_first_name": "Jason",
  "customer_last_message": "yeah sure go for it",
  "acknowledge_emoji": false,
  "prior_acknowledgments": [],
  "customer_style": "default"
}
```

**phraser output:**

> Cool. Does your generator have a big 240-volt outlet (the kind your dryer plugs into), or just regular 120-volt outlets?

(122 chars — inside default 60–130 target. `Cool.` ack — fresh, prior_acks=[]. One question. Default register applied cleanly.)

### Turn 2 — customer

> yeah it's got the big 240 one

### Turn 2 — classifier

**classifier input (role-isolated):**
```json
{
  "state": "AWAIT_240V",
  "recent_turns": [
    { "role": "bot", "text": "Cool. Does your generator have a big 240-volt outlet..." },
    { "role": "customer", "text": "yeah it's got the big 240 one" }
  ],
  "inbound_message": "yeah it's got the big 240 one"
}
```

**classifier output:**
```json
{
  "label": "gen_240v",
  "confidence": 0.93
}
```

(no `inferred_customer_style` on turn 2+ per v3 rules — orchestrator already has `default` persisted)

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET (intent: ask if 240v outlet is 30A 3-prong twist or 50A 4-prong; offer the photo path if they don't know).

### Turn 2 — bot (AWAIT_OUTLET)

**phraser input:**
```json
{
  "intent": "ask if 30-amp (3-prong twist) or 50-amp (4-prong); offer photo if unsure",
  "customer_first_name": "Jason",
  "customer_last_message": "yeah it's got the big 240 one",
  "acknowledge_emoji": false,
  "prior_acknowledgments": ["Cool."],
  "customer_style": "default"
}
```

**phraser output:**

> Got it. 30-amp (smaller 3-prong twist) or 50-amp (bigger 4-prong)? Or snap a quick pic of the outlet.

(106 chars — inside default 60–130. `Got it.` is fresh against prior_acks=["Cool."]. One question with photo escape hatch as a tail clause, not a second `?`.)

### Turn 3 — customer

> 30 amp, the twist lock one

### Turn 3 — classifier

**classifier output:**
```json
{
  "label": "outlet_30a",
  "confidence": 0.96
}
```

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP (intent: ask if they own or rent — owner approval required for panel work).

### Turn 3 — bot (AWAIT_OWNERSHIP)

**phraser input:**
```json
{
  "intent": "ask own-or-rent (owner approval required for panel work)",
  "customer_first_name": "Jason",
  "customer_last_message": "30 amp, the twist lock one",
  "acknowledge_emoji": false,
  "prior_acknowledgments": ["Cool.", "Got it."],
  "customer_style": "default"
}
```

**phraser output:**

> Sounds good. Own the place or rent? Owner has to sign off on panel work.

(73 chars — tight; default register allows 60–130 so this is on the lean side, but the question is binary and a brief explanation reads natural here. `Sounds good.` is fresh against prior_acks=["Cool.", "Got it."]. **No countdown phrasing** — v1's `two more quick things` is excised. Single `?`.)

### Turn 4 — customer

> ah i'm renting actually

### Turn 4 — classifier

**classifier output:**
```json
{
  "label": "renter",
  "confidence": 0.97
}
```

### Turn 4 — state machine
AWAIT_OWNERSHIP → DISQUALIFIED_RENTER (terminal; intent: polite decline — panel work needs property owner authorization; suggest looping in landlord; warmth budget overrides length cap; blame the system not the customer; door-open).

**Terminal hit on turn 4 — DISQUALIFIED_RENTER. Matches expected. PASS on routing.**

### Turn 4 — bot (DISQUALIFIED_RENTER)

**phraser input:**
```json
{
  "intent": "polite decline — panel work needs property owner sign-off; door-open for landlord-routed lead",
  "customer_first_name": "Jason",
  "customer_last_message": "ah i'm renting actually",
  "acknowledge_emoji": false,
  "prior_acknowledgments": ["Got it.", "Sounds good."],
  "customer_style": "default"
}
```

**phraser output:**

> Ah, that's the catch — panel work needs the property owner to sign off. If your landlord wants to loop in, we'll take it from there.

(132 chars — slightly above the 60–130 mid-flow target, but explicitly allowed by the v3 DQ warmth-budget rule (`Disqualifications carry warmth budget that overrides register length caps`). Opens with `Ah, that's the catch —` which is NOT in prior_acks=["Got it.", "Sounds good."] and is NOT one of the banned `ah dang`/`unfortunately` phrasings. Blames the system constraint (`panel work needs the property owner to sign off`), not Jason. Door left open (`If your landlord wants to loop in, we'll take it from there`). No first-person Key. No commitment of timing or price.)

### Turn 5 — customer (post-terminal — bot has already exited)

> oh ok. could my landlord call y'all?

### Turn 5 — classifier

**classifier output:**
```json
{
  "label": "off_topic_question",
  "confidence": 0.78,
  "off_topic_excerpt": "could my landlord call y'all?"
}
```

### Turn 5 — state machine
DISQUALIFIED_RENTER is terminal — `endConversation: true`. No outbound from bot. Excerpt captured for Key's passive-notification queue (per disqualification + post-terminal handling protocol). Conversation does not re-open.

---

## Hard-constraint regex check on every phraser output (v3 set)

| Turn | State | Output (truncated) | $? | weekday? | I'm Key? | >280? | corp phrase? | Awesome? | countdown? | ack-repeat? | multi-? | length | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | GREETING | Hey Jason — Backup Power Pro. Saw you came… | no | no | no | no | no | no | no | no | no | 140 | yes |
| 1 | AWAIT_240V | Cool. Does your generator have a big 240-volt… | no | no | no | no | no | no | no | no | no | 122 | yes |
| 2 | AWAIT_OUTLET | Got it. 30-amp (smaller 3-prong twist) or 50… | no | no | no | no | no | no | no | no | no | 106 | yes |
| 3 | AWAIT_OWNERSHIP | Sounds good. Own the place or rent?… | no | no | no | no | no | no | no | no | no | 73  | yes |
| 4 | DISQUALIFIED_RENTER | Ah, that's the catch — panel work needs the property owner… | no | no | no | no | no | no | no | no | no | 132 | yes |

All 5 phraser outputs pass v3 hard constraints. Zero `phraser_fallback_used` events. Zero countdown phrasings. Zero `Awesome.` usage. Zero `ah dang` / `unfortunately`. Zero acknowledgment-rotation repeats. Zero stacked questions. All mid-flow outputs ≤180 (max was 132).

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|
| 0 | GREETING | yes | 9 | Variant opener #2 — different from v1's "saw your form come through". 140 chars. One question. Style not yet detected (correct — Turn 0 is pre-style). |
| 1 | AWAIT_240V | yes | 10 | `Cool.` ack, fresh. Single question. 122 chars. Plain-English 240v vs 120v. Default register applied first time. |
| 2 | AWAIT_OUTLET | yes | 10 | `Got it.` ack — fresh against prior_acks=["Cool."]. 106 chars. Photo escape hatch on the tail. |
| 3 | AWAIT_OWNERSHIP | yes | 9 | `Sounds good.` ack — fresh. NO countdown phrasing. 73 chars (lean side of default range; binary question + brief reason justifies it). |
| 4 | DISQUALIFIED_RENTER | yes | 10 | Opens with `Ah, that's the catch —` which is fresh and corpus-register. Polite, firm exit. Door open for landlord. 132 chars (allowed by DQ warmth budget). |

Voice score average: 9.6 / 10.

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **yes** — DISQUALIFIED_RENTER hit on turn 4 as expected.
- Did any phraser output violate a v3 hard constraint? **no** — 0 violations across 5 outputs.
- Did any classifier output have confidence <0.6 on a critical state? **no** — minimum critical-state confidence was 0.93 (gen_240v). Post-terminal off_topic_question at 0.78 is appropriately uncertain (terminal already hit; flow not affected).
- Did the conversation exceed 15 turns? **no** — 4 turns to terminal (5 with post-terminal noise), inside healthy 4–15 range.
- Did any state self-loop more than 2x? **no** — every state visited exactly once.
- Did the bot self-disclose AI status correctly when asking_if_human fired? **n/a** — Jason never asked.
- Did the bot try to qualify the renter through other means after disqualification? **no** — clean polite exit, no improvised "well maybe if…" soft commitment.
- Did the bot try to schedule a landlord callback when Jason asked? **n/a** — bot terminal; Jason's follow-up arrives but bot does not respond. Off-topic excerpt captured for Key's notification queue.
- **v3-specific checks:**
  - `inferred_customer_style` emitted on turn 1 only? **yes** — `default`.
  - Style persisted through subsequent turns? **yes** — passed to phraser on turns 1–4 as `customer_style="default"`.
  - Phraser applied the correct register defaults? **yes** — all mid-flow outputs in 60–130 range (except DQ which legitimately exceeded for warmth budget). Acks rotated. No register-mismatch tells (e.g., no "y'all" overuse, no `terse`-style sub-50-char bare asks, no `educational`-style teach-then-ask preambles).
  - Style detection confidence high enough? Implicit — classifier emitted "default" with no explicit confidence, but per the v3 spec default is the safe bucket when in doubt; not flagged.
  - Decline warmth: `ah dang` / `unfortunately` used? **no**. System-blame? **yes** ("panel work needs the property owner to sign off"). Door-open? **yes** ("If your landlord wants to loop in, we'll take it from there").

---

## Decline-warmth scoring (v3-specific axis)

The v3 phraser spec singles out DQ messages with three explicit warmth criteria:

1. **Blame the system constraint, not the customer.** v3 output: `panel work needs the property owner to sign off` — frames the requirement, not Jason. ✓
2. **Leave the door open.** v3 output: `If your landlord wants to loop in, we'll take it from there.` — invites a landlord-routed lead. ✓
3. **Avoid `ah dang` / `unfortunately` (performative sympathy).** v3 output uses `Ah, that's the catch —` which is observational, not performative apology. ✓

Plus implicit warmth checks:
- No first-person Key claims (no "I'll get him to call your landlord")
- No commitment timeframe (no "we can be out next week")
- No price quoted
- No condescension toward the rental situation
- Reads like Key would say it across a counter

**Decline-warmth score: 9 / 10.** One point off because `Ah, that's the catch —` is slightly more flippant than ideal for a renter who genuinely thought he could do this; a reading like "Yeah — panel work needs the property owner to sign off…" might land as a touch warmer. Acceptable, not perfect.

---

## Coverage exercised by this run

- Classifier enum values: `affirmative`, `gen_240v`, `outlet_30a`, `renter`, `off_topic_question` (post-terminal).
- Classifier `inferred_customer_style` on first inbound: `default`.
- State transitions: GREETING→AWAIT_240V, AWAIT_240V→AWAIT_OUTLET, AWAIT_OUTLET→AWAIT_OWNERSHIP, AWAIT_OWNERSHIP→DISQUALIFIED_RENTER.
- Disqualification path: DISQUALIFIED_RENTER terminal hit cleanly without retry loop.
- Phraser hard constraints (v3): no countdown, no `Awesome.`, ack rotation enforced across 5-message sequence, length compliance (60–130 mid-flow, 80–140 GREETING, 60–280 with warmth-budget for DQ), GREETING variant rotation (used opener #2).
- Phraser register dispatch: `default` register applied on turns 1–4. No mis-firing into terse/educational/buddy.
- DQ warmth-budget exercised: 132-char DQ output legitimately exceeds 130 mid-flow target.
- v3-specific: classifier first-turn-only style emission verified; orchestrator persistence verified; phraser register-default behavior verified.

---

## Scoring

- State machine score: **10 / 10** (clean terminal hit at expected state in 4 turns; no retries; no stuck loops)
- Classifier score: **10 / 10** (5/5 labels correct; style inference correct; minimum critical-state confidence 0.93)
- Voice score: **9.6 / 10** (avg of per-turn 9, 10, 10, 9, 10)
- Decline-warmth score: **9 / 10** (system-blame + door-open + no performative sympathy; minor flippancy in opener)

---

## Reviewer notes

### What v3 specifically tests on this persona

Jason is the **default-register control case** for v3. He's casual but not a strong-signal customer for any specialized register (not terse, not educational, not buddy). The right outcome is for the classifier to detect `default` and the phraser to operate identically to v2. **That happened.** v3 introduces no regressions for default-register customers, which is the necessary baseline before claiming v3 is safe to ship.

If the classifier had over-specialized to `terse` (because Jason's first reply was 5 words lowercase no punctuation), the phraser would have produced sub-80-char bare asks across all turns — including the DQ. A 60-80-char DQ on a renter would feel curt. The classifier correctly resisted that pull.

### Worth flagging for Key's review

1. **Classifier style inference passed its first hard test on Jason.** The temptation to over-classify casual lowercase as "terse" is real; v3's STYLE INFERENCE rule (`If you can't tell, default to default`) caught this correctly. Watch this on Persona 02 (Mike — phone-typer, brief but cooperative) and Persona 11 (Tony — actually-terse) to confirm the discriminator holds.
2. **DQ warmth budget worked as designed.** The 132-char DQ exceeds the default mid-flow 60–130 cap but is explicitly allowed by the v3 polite-decline rule. If we want stricter enforcement, change the rule to "DQ ≤ 150" — but 132 reads natural, not bloated, so leaving the soft cap as-is.
3. **`Ah, that's the catch —` is a corpus-register choice that reads like Key.** It's not in the v3 banned list (which only excludes `ah dang` / `unfortunately`). If Key wants to also ban "ah" openers as performative, add to phraser banlist; otherwise this stays.
4. **Post-terminal `could my landlord call y'all?`** — same handling as v1/v2: terminal state ignores, excerpt captured for Key's notification queue. No re-engagement. This remains a one-line product decision (queue as low-priority callback vs discard) — unchanged from prior runs.
5. **No new violations vs v2.** The v2 fixes (no countdown, ack rotation) hold under v3 rules.

### Status

**PASS — DISQUALIFIED_RENTER reached in 4 turns; detected_style = default (matches expected); 0 hard-constraint violations under v3 regex set; voice 9.6/10; decline-warmth 9/10. v3 default-register control case verified.**
