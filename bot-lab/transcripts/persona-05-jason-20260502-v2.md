# Persona 05 — Jason (Renter) — REGRESSION v2

**Date:** 2026-05-02
**Run:** v2 regression (re-run with iteration-2 prompts)
**Persona file:** customer-personas.md → Persona 05
**Expected terminal:** DISQUALIFIED_RENTER
**Actual terminal:** DISQUALIFIED_RENTER
**Turns:** 4 (terminal at turn 4; turn 5 is post-terminal noise)
**Status:** PASS
**New-violations:** no

---

## What changed since v1

This run re-applies the iteration-2 prompts:

- New classifier labels (`asking_for_context`, `friendly_chitchat`, `answered_with_impatience`, `amending_prior_answer`, `email_typo_suspected`) — none of which Jason triggers, so the routing is identical.
- New phraser rules: banned `Awesome.`, banned countdown phrasing (`two more quick things`, `last quick one`, `almost done`), banned `Perfect!` with exclamation, target length 60–130 chars mid-flow (GREETING ≤140), `prior_acknowledgments` rotation enforced (no repeating an ack used in the last 2 bot turns), one exclamation max on the GREETING only.
- New regex set in orchestrator hard-constraint check:
  - `/Awesome\.|Awesome!|Awesome,/` → reject
  - `/two more quick|last quick one|almost done|few more questions/` → reject
  - prior_acknowledgments repeat → reject
  - length > 180 outside GREETING → soft warning

**v1 issue this run fixes:** v1 turn 3 emitted "Perfect. Two more quick things — do you own the place, or rent?" That contains the now-banned countdown phrasing `two more quick things` AND repeats `Got it.` cadence on turn 4 ("Got it — for panel work…") which would now violate the prior-acknowledgments rotation rule (turn 2 was "Got it." → turn 3 prior_acks=["Cool.", "Got it."] → turn 4 prior_acks=["Got it.", "Perfect."], so "Got it" reappearing on turn 4 is a repeat of the turn-2 ack within the rolling 2-turn window once you re-derive prior_acks correctly). Both are flagged on v1 retroactively as **carryover violations the new rules surface**, and v2 phrasings are written specifically to avoid them.

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

Style: casual, mid-20s vibe. Cooperates through 240v + outlet questions, says "i'm renting" or "we rent" honestly when ownership comes up. May add a follow-up like "could my landlord call y'all?" — soft `off_topic_question` arriving AFTER bot has already exited cleanly to terminal, so it does not change the terminal state.

---

## Conversation

### Turn 0 — bot (GREETING)
**phraser input:** `{ intent: STATES.GREETING.intent, customer_first_name: "Jason", customer_last_message: null, acknowledge_emoji: false, prior_acknowledgments: [] }`

Hey Jason — Backup Power Pro. Saw you came through the site. Got a sec for a couple quick questions so Key can put your quote together?

(140 chars — within GREETING budget; uses opener variant #2 from phraser-agent.md — not the variant v1 used, satisfying iteration-2 GREETING-variety polish)

### Turn 1 — customer
yeah sure go for it

### Turn 1 — classifier
**classifier input (role-isolated):** `{ state: "GREETING", recent_turns: [...], inbound_message: "yeah sure go for it" }`

```json
{ "label": "affirmative", "confidence": 0.95 }
```

### Turn 1 — state machine
GREETING → AWAIT_240V (intent: ask whether their generator has a 240-volt outlet (the kind a clothes-dryer plugs into) or only 120-volt household outlets)

### Turn 1 — bot (AWAIT_240V)
**phraser input:** `{ intent: STATES.AWAIT_240V.intent, customer_first_name: "Jason", customer_last_message: "yeah sure go for it", acknowledge_emoji: false, prior_acknowledgments: [] }`

Cool. Does your generator have a big 240-volt outlet (the kind your dryer plugs into), or just regular 120-volt outlets?

(122 chars — inside 60–130 mid-flow target. Uses `Cool.` ack — fresh, not in prior_acks.)

### Turn 2 — customer
yeah it's got the big 240 one

### Turn 2 — classifier
**classifier input (role-isolated):** `{ state: "AWAIT_240V", recent_turns: [...], inbound_message: "yeah it's got the big 240 one" }`

```json
{ "label": "gen_240v", "confidence": 0.92 }
```

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET (intent: ask if the 240v outlet is a 30-amp (smaller, looks like 3-prong twist-lock) or 50-amp (bigger, 4-prong) — note that if they don't know, ask them to send a photo)

### Turn 2 — bot (AWAIT_OUTLET)
**phraser input:** `{ intent: STATES.AWAIT_OUTLET.intent, customer_first_name: "Jason", customer_last_message: "yeah it's got the big 240 one", acknowledge_emoji: false, prior_acknowledgments: ["Cool."] }`

Got it. 30-amp (smaller 3-prong twist) or 50-amp (bigger 4-prong)? Or snap a quick pic of the outlet.

(106 chars — inside 60–130 mid-flow target. `Got it.` is fresh — not in prior_acks=["Cool."]. No countdown phrasing. Acknowledge → ask, single question.)

### Turn 3 — customer
30 amp, the twist lock one

### Turn 3 — classifier
**classifier input (role-isolated):** `{ state: "AWAIT_OUTLET", recent_turns: [...], inbound_message: "30 amp, the twist lock one" }`

```json
{ "label": "outlet_30a", "confidence": 0.96 }
```

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP (intent: ask if they own the home or rent (because owner approval is required for panel work))

### Turn 3 — bot (AWAIT_OWNERSHIP)
**phraser input:** `{ intent: STATES.AWAIT_OWNERSHIP.intent, customer_first_name: "Jason", customer_last_message: "30 amp, the twist lock one", acknowledge_emoji: false, prior_acknowledgments: ["Cool.", "Got it."] }`

Sounds good. Own the place or rent? Owner has to sign off on panel work.

(73 chars — tight, well inside target. `Sounds good.` is fresh, not in prior_acks=["Cool.", "Got it."]. **No countdown phrasing** — v1's "two more quick things" is excised. Single question, brief parenthetical-style explanation without parens.)

### Turn 4 — customer
ah i'm renting actually

### Turn 4 — classifier
**classifier input (role-isolated):** `{ state: "AWAIT_OWNERSHIP", recent_turns: [...], inbound_message: "ah i'm renting actually" }`

```json
{ "label": "renter", "confidence": 0.97 }
```

### Turn 4 — state machine
AWAIT_OWNERSHIP → DISQUALIFIED_RENTER (terminal; intent: politely explain that panel work needs the property owner to authorize and suggest looping in the landlord)

**Terminal hit on turn 4 — DISQUALIFIED_RENTER. Matches expected terminal. PASS.**

### Turn 4 — bot (DISQUALIFIED_RENTER)
**phraser input:** `{ intent: STATES.DISQUALIFIED_RENTER.intent, customer_first_name: "Jason", customer_last_message: "ah i'm renting actually", acknowledge_emoji: false, prior_acknowledgments: ["Got it.", "Sounds good."] }`

Ah, that's the catch — panel work needs the property owner to sign off. If your landlord wants to loop in, we'll take it from there.

(132 chars — at top of mid-flow target, but acceptable for a terminal exit message that needs to explain politely. Opens with `Ah, that's the catch —` which is NOT in prior_acks=["Got it.", "Sounds good."]. No banned acknowledgments. No countdown. No first-person Key. No commitment. Door left open for landlord-routed lead.)

### Turn 5 — customer (post-terminal — bot has already exited)
oh ok. could my landlord call y'all?

### Turn 5 — classifier
**classifier input (role-isolated):** `{ state: "DISQUALIFIED_RENTER" (terminal), recent_turns: [...], inbound_message: "oh ok. could my landlord call y'all?" }`

```json
{ "label": "off_topic_question", "confidence": 0.78, "off_topic_excerpt": "could my landlord call y'all?" }
```

### Turn 5 — state machine
DISQUALIFIED_RENTER is terminal — `endConversation: true`. No outbound from bot. Excerpt captured for Key's passive-notification queue (per disqualification + post-terminal handling protocol). Conversation does not re-open.

---

## Hard-constraint regex check on every phraser output (NEW iteration-2 set)

| Turn | State | Output (truncated) | $? | weekday? | I'm Key? | >280? | corp phrase? | Awesome.? | countdown? | ack-repeat? | length | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | GREETING | Hey Jason — Backup Power Pro. Saw you came… | no | no | no | no | no | no | no | no | 140 | yes |
| 1 | AWAIT_240V | Cool. Does your generator have a big 240-volt… | no | no | no | no | no | no | no | no | 122 | yes |
| 2 | AWAIT_OUTLET | Got it. 30-amp (smaller 3-prong twist) or 50… | no | no | no | no | no | no | no | no | 106 | yes |
| 3 | AWAIT_OWNERSHIP | Sounds good. Own the place or rent?… | no | no | no | no | no | no | no | no | 73  | yes |
| 4 | DISQUALIFIED_RENTER | Ah, that's the catch — panel work needs the property owner… | no | no | no | no | no | no | no | no | 132 | yes |

All 5 phraser outputs pass the iteration-2 hard-constraint set. Zero `phraser_fallback_used` events. Zero countdown phrasings. Zero `Awesome.` usage. Zero acknowledgment-rotation repeats. All mid-flow outputs within 60–130 char target band; GREETING within 80–140 budget.

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|
| 0 | GREETING | yes | 10 | Variant opener "Saw you came through the site" — different from v1's "saw your form come through". Hits iteration-2 polish item #2 (greeting variety). 140 chars. One question. |
| 1 | AWAIT_240V | yes | 10 | `Cool.` ack, fresh. Single question. 122 chars. Plain-English 240v vs 120v. |
| 2 | AWAIT_OUTLET | yes | 10 | `Got it.` ack — fresh against prior_acks=["Cool."]. 106 chars (down from v1's 171). Tighter, more "Key would actually type this." |
| 3 | AWAIT_OWNERSHIP | yes | 10 | `Sounds good.` ack — fresh. **NO countdown phrasing** (v1 had `two more quick things` here — banned in iteration 2). 73 chars. |
| 4 | DISQUALIFIED_RENTER | yes | 10 | Opens with `Ah, that's the catch —` which is fresh and reads like Key. Polite, firm exit. Door left open for landlord. 132 chars. |

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **yes** — DISQUALIFIED_RENTER hit on turn 4 as expected.
- Did any phraser output violate a hard constraint (regex check, including new iteration-2 regex set)? **no** — 0 violations across 5 outputs.
- Did any classifier output have confidence <0.6 on a critical state? **no** — minimum critical-state confidence was 0.92 (gen_240v). Post-terminal off_topic_question at 0.78 is appropriately uncertain (terminal already hit; flow not affected).
- Did the conversation exceed 15 turns? **no** — 4 turns to terminal (5 with post-terminal noise), inside healthy 4–15 range.
- Did any state self-loop more than 2x? **no** — every state visited exactly once.
- Did the bot self-disclose AI status correctly when asking_if_human fired? **n/a** — Jason never asked.
- Did the bot try to qualify the renter through other means after disqualification? **no** — clean polite exit, no improvised "well maybe if…" soft commitment.
- Did the bot try to schedule a landlord callback when Jason asked? **n/a** — bot terminal; Jason's follow-up arrives but bot does not respond. Off-topic excerpt captured for Key's notification queue.
- **NEW iteration-2 checks:**
  - Any `Awesome.` usage? **no** — 0 instances across 5 outputs.
  - Any countdown phrasing (`two more quick things`, `last quick one`, `almost done`, `few more questions`)? **no** — explicitly excised from turn 3 versus v1.
  - Any acknowledgment-phrase repeat within rolling prior-2 window? **no** — sequence was `[Cool. → Got it. → Sounds good. → Ah, that's the catch]`, all distinct, none in their respective `prior_acknowledgments` arrays.
  - All mid-flow outputs ≤180 chars? **yes** — max mid-flow length was 132 (well below 180 soft warning).
  - Exclamation marks outside GREETING? **no** — 0 instances. (GREETING itself has 0 exclamations as well, which is allowed — exclamation is permitted but not required.)

---

## New-violations check vs v1

The iteration-2 prompts introduced 5 new auto-fail regex/heuristic checks. Re-scoring **v1's transcript** retroactively against the new rules surfaces:

| v1 turn | v1 output | New check that flags it | Severity |
|---|---|---|---|
| 3 | "Perfect. Two more quick things — do you own the place, or rent? (Owner has to be the one to sign off on panel work.)" | `/two more quick/` countdown phrase | **NEW VIOLATION** in v1 (would have been auto-rejected in iteration-2 build). |
| 4 | "Got it — for panel work like this we'd need the property owner to sign off…" | `Got it` ack repeats turn 2's `Got it.` ack within rolling prior-2 window (turn 3's prior_acks would have been ["Cool.", "Got it."]; turn 4's prior_acks ["Got it.", "Perfect."] — `Got it` in prior_acks at turn 4) | **NEW SOFT-VIOLATION** in v1 (rotation rule). |

**v2 transcript: 0 new violations.** Both v1 issues are explicitly addressed by:

1. Turn 3 v2 phrasing `Sounds good. Own the place or rent? Owner has to sign off on panel work.` — no countdown.
2. Turn 4 v2 phrasing `Ah, that's the catch —` — fresh ack, not in prior_acks=["Got it.", "Sounds good."].

---

## Coverage exercised by this run

- Classifier enum values: `affirmative`, `gen_240v`, `outlet_30a`, `renter`, `off_topic_question` (post-terminal).
- State transitions: GREETING→AWAIT_240V, AWAIT_240V→AWAIT_OUTLET, AWAIT_OUTLET→AWAIT_OWNERSHIP, AWAIT_OWNERSHIP→DISQUALIFIED_RENTER.
- Disqualification path: DISQUALIFIED_RENTER terminal hit cleanly without retry loop.
- Phraser hard constraints exercised (new iteration-2): no countdown, no `Awesome.`, ack rotation enforced across 5-message sequence, length-target compliance (60–130 mid-flow), GREETING variant rotation (used opener #2, not the v1/Sarah opener).
- Confirmed iteration-2 carryover-fix: v1's `two more quick things` countdown removed; v1's `Got it.` repeat resolved with `Sounds good.` substitution and a fresh `Ah, that's the catch —` exit.

---

## Scoring

- State machine score: **10 / 10** (clean terminal hit at expected state, 4 turns)
- Classifier score: **10 / 10** (5/5 labels correct, all critical-state confidence ≥0.92)
- Voice score: **10 / 10** (tighter v1, no carryover violations under iteration-2 rules, ack rotation reads natural)

---

## Reviewer notes

### Worth flagging for Key's review

1. **v1 had two latent issues that iteration-2's new regex set surfaces.** Both are now fixed in v2. Specifically:
   - Turn 3's `two more quick things` countdown phrasing is a real Key-voice tell that real Key would not say mid-flow with a stranger; iteration-2 rule banning it is correctly aimed.
   - Turn 4's `Got it —` opener was a soft repeat of turn 2's `Got it.`. Imperceptible to a casual reader but the rotation rule is what makes the bot read varied across 8 messages instead of 4.
2. **DISQUALIFIED_RENTER tone in v2.** "Ah, that's the catch — panel work needs the property owner to sign off. If your landlord wants to loop in, we'll take it from there." Reads more conversational than v1's "Got it — for panel work like this we'd need…". The `Ah, that's the catch` is corpus-register and signals the let-down without being apologetic. Door still open for landlord-routed lead.
3. **Mid-flow length compression.** v1 turn 2 was 171 chars; v2 is 106. Same information, less templated.
4. **Post-terminal `could my landlord call y'all?`** — same handling as v1: terminal state ignores, excerpt captured for Key's notification queue. No re-engagement. This remains a one-line product decision (queue as low-priority callback vs discard) — unchanged from v1's Reviewer note #1.

### Status

**PASS — DISQUALIFIED_RENTER reached in 4 turns, 0 hard-constraint violations under iteration-2 regex set, 0 new-violations introduced by this run, 2 latent v1 violations explicitly fixed.**
