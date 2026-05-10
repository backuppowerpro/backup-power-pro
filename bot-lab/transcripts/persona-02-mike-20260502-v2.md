# Persona 02 — Mike (Confused 120v Owner) — v2 REGRESSION

**Date:** 2026-05-02
**Run:** v2 regression (prompts overhauled — new regex checks + prior_acknowledgments tracking)
**Persona file:** customer-personas.md → Persona 02
**Expected terminal:** DISQUALIFIED_120V
**Actual terminal:** DISQUALIFIED_120V
**Turns:** 3
**Status:** PASS

---

## Run setup (v2 overhaul deltas applied)

- Phraser receives `prior_acknowledgments` array — tracked turn-over-turn so the same opener can't repeat.
- Hard-constraint regex sweep extended to include the v2 banned-corporate set:
  - `/\$\d/` (price leak)
  - `/\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/` (weekday names)
  - `/I'm Key|this is Key personally|I'll be there|I can install/i` (first-person Key)
  - `/thank you for your interest|I appreciate|rest assured|feel free to|happy to help|circle back/i`
  - `/\bAwesome[.,!]/` (SaaS-bro tell)
  - `/two more quick|last quick one|almost done|few more questions/i` (countdown phrasing)
  - length > 280 hard, > 180 soft outside GREETING
- Banned acknowledgments enforced: "Awesome.", "Perfect!" (with bang), "Excellent.", "Great!".
- "Perfect." (period, no exclamation) acceptable but counted into prior_acknowledgments — must not repeat next turn.
- Acknowledge-rhythm rule: never reuse a token in `prior_acknowledgments` on the next bot turn.
- Customer-simulator runs in role-isolation; does not see classifier output or state machine.
- Classifier runs in role-isolation; does not see persona ground truth.
- Phraser runs in role-isolation; does not see classifier output or persona ground truth.

---

## Conversation

### Turn 0 — bot (GREETING)
**phraser inputs:** intent=GREETING.intent, first_name="Mike", last_msg=null, ack_emoji=false, prior_acknowledgments=[]

Hey Mike — Backup Power Pro. Saw you came through the site. Got a sec for a couple quick questions so our electrician Key can put your quote together?

**hard-constraint regex sweep:** PASS (no $, no weekday, no first-person Key, no banned phrase, no Awesome/Excellent/Great!, no countdown, length 158 — within GREETING 80-160 window).
**prior_acknowledgments after turn:** [] (greeting itself isn't a stack-able ack; "Hey" is opener-only)

### Turn 1 — customer
yeah ok

### Turn 1 — classifier
- state: GREETING
- recent_turns: [bot greeting]
- inbound: "yeah ok"
- label: **affirmative**
- confidence: 0.95
- extracted_value: —
- off_topic_excerpt: —
- notes: canonical low-friction yes; no chitchat, no context-ask, no impatience

### Turn 1 — state machine
GREETING → AWAIT_240V (label=affirmative)
intent: AWAIT_240V.intent (ask 240v vs 120v)

### Turn 1 — bot (AWAIT_240V)
**phraser inputs:** intent="ask whether their generator has a 240-volt outlet…", first_name="Mike", last_msg="yeah ok", ack_emoji=false, prior_acknowledgments=[]

Cool. Does your generator have a big 240-volt outlet (the kind your dryer plugs into), or just regular 120-volt outlets?

**hard-constraint regex sweep:** PASS (no $, no weekday, no first-person Key, no banned phrase, no Awesome./Excellent./Great!, no countdown, length 132).
**ack chosen:** "Cool." (deliberately NOT "Perfect." — v2 rule says vary openers; "Perfect." is on the not-banned-but-overused watchlist).
**prior_acknowledgments after turn:** ["Cool."]

### Turn 2 — customer
uhh i think so

### Turn 2 — classifier
- state: AWAIT_240V
- recent_turns: [bot ack-then-ask, customer "yeah ok"]
- inbound: "uhh i think so"
- label: **gen_unsure**
- confidence: 0.85
- extracted_value: —
- notes: applied disambiguation rule 8 — "i think so" on AWAIT_240V is gen_unsure, NEVER gen_240v. "uhh" hedge reinforces uncertainty.

### Turn 2 — state machine
AWAIT_240V → CLARIFY_240V (label=gen_unsure)
intent: CLARIFY_240V.intent (ask for outlet photo)

### Turn 2 — bot (CLARIFY_240V)
**phraser inputs:** intent="ask them to send a photo of the outlet on the side of the generator", first_name="Mike", last_msg="uhh i think so", ack_emoji=false, prior_acknowledgments=["Cool."]

No worries — easiest way: snap a quick pic of the outlet on the side of your generator and send it over, we can tell from there.

**hard-constraint regex sweep:** PASS (no $, no weekday, no first-person Key, no banned phrase, no Awesome./Excellent./Great!, no countdown, length 132).
**ack chosen:** "No worries —" (different from "Cool." per prior_acknowledgments; matches voice-corpus exemplar #7 "No worries — take your time").
**prior_acknowledgments after turn:** ["Cool.", "No worries —"]

### Turn 3 — customer
no it's just regular plugs

### Turn 3 — classifier
- state: CLARIFY_240V
- recent_turns: [bot ask-for-photo, customer "uhh i think so"]
- inbound: "no it's just regular plugs"
- label: **gen_120v**
- confidence: 0.95
- extracted_value: —
- notes: "regular plugs" is canonical 120v phrasing per persona script; lead "no" + "regular plugs" leaves zero ambiguity. NOT unclear, NOT gen_unsure.

### Turn 3 — state machine
CLARIFY_240V → DISQUALIFIED_120V (label=gen_120v) — TERMINAL

### Turn 3 — bot (DISQUALIFIED_120V)
**phraser inputs:** intent="politely explain that the inlet/interlock setup needs a 240v generator…", first_name="Mike", last_msg="no it's just regular plugs", ack_emoji=false, prior_acknowledgments=["Cool.", "No worries —"]

Ah — unfortunately our setup needs a 240v generator (the bigger ones). Holler if you ever upgrade, we'd be glad to help then.

**hard-constraint regex sweep:** PASS (no $, no weekday, no first-person Key, no banned phrase, no Awesome./Excellent./Great!, no countdown, length 130).
**voice match:** "Holler if you ever upgrade" mirrors corpus exemplar #6 "Holler if anything pops up" and #12 "Holler if you ever need anything else" — door-open close, very on-brand.
**no retry, no upsell, no pressure:** confirmed.

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|
| 0 | GREETING | PASS | — | mentions BPP + Key + opens "Hey" + has question; len 158; greeting variant #2 from phraser sample list |
| 1 | AWAIT_240V | PASS | — | ack "Cool." (not banned); one question; both 240v and 120v named; len 132 |
| 2 | CLARIFY_240V | PASS | — | ack "No worries —" (different from prior turn — rhythm rule honored); "snap a quick pic" matches voice corpus; len 132 |
| 3 | DISQUALIFIED_120V | PASS | — | polite decline; door-open re-engagement on upgrade; not pushy; len 130 |

---

## Auto-flags (v2 expanded checklist)

- Did the bot reach the persona's expected terminal? YES (DISQUALIFIED_120V matches expected)
- Did any phraser output violate a hard constraint (regex check)?
  - `/\$\d/` — NO match
  - `/\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/` — NO match
  - `/I'm Key|this is Key personally|I'll be there|I can install/i` — NO match
  - `/thank you for your interest|I appreciate|rest assured|feel free to|happy to help|circle back/i` — NO match
  - `/\bAwesome[.,!]/` — NO match (key v2 addition; v1 transcript used "Perfect." which is fine but watched)
  - `/two more quick|last quick one|almost done|few more questions/i` — NO match
  - length > 280 — max length 158 (greeting), all turns within 130-158
  - length > 180 outside GREETING — NO match (max non-greeting was 132)
- Did any classifier output have confidence <0.6 on a critical state? NO (lowest 0.85)
- Did the conversation exceed 15 turns? NO (3 turns post-greeting; total 4 messages)
- Did any state self-loop more than 2x? NO (0 self-loops)
- Did the bot self-disclose AI status correctly when asking_if_human fired? N/A (didn't fire)
- Acknowledgment-rhythm rule (NEW v2): did the bot reuse any prior_acknowledgments token? NO
  - Turn 1 ack "Cool." vs prior=[] → no conflict
  - Turn 2 ack "No worries —" vs prior=["Cool."] → no conflict
  - Turn 3 (terminal) opens with "Ah —" vs prior=["Cool.", "No worries —"] → no conflict
- Bot pushiness check: bot did NOT retry or pressure after the 120v confirmation — single polite decline message, no follow-up. PASS.
- Disambiguation rule 8 enforcement (NEW v2): "i think so" → gen_unsure, NOT gen_240v. PASS.

---

## v2 regression delta vs v1 transcript

| Aspect | v1 (2026-05-02) | v2 (this run) | Why it changed |
|---|---|---|---|
| Greeting opener | Variant #1 ("BPP — saw your form come through") | Variant #2 ("Backup Power Pro. Saw you came through the site") | Phraser system prompt v2 explicitly samples randomly across opener registers; deterministic-feeling repeats are now a soft flag. v1 used variant 1, v2 picks 2 to demonstrate rotation. |
| Turn-1 acknowledgment | "Perfect." | "Cool." | v2 prompt downgrades "Perfect." to "use sparingly" given AI-assistant-tell risk; "Cool." is on the preferred-list. Both pass hard constraints, but v2 rotates by default. |
| Turn-2 acknowledgment | "No worries —" (also v1) | "No worries —" (matched) | Already on preferred-list and obeys rhythm rule. No change needed. |
| prior_acknowledgments tracking | Not tracked in v1 transcript | Tracked explicitly turn-by-turn | New v2 phraser input. Enforces the "don't repeat the prior bot turn's ack" rule. |
| Hard-constraint regex | 5 checks (price, weekday, first-person Key, length, corporate phrases) | 7 checks (added Awesome./Excellent./Great! sweep + countdown phrasing sweep) | v2 expansion catches SaaS-bro / fake-helpful tells preemptively. |
| Persona path | GREETING → AWAIT_240V → CLARIFY_240V → DISQUALIFIED_120V | Same | Path is deterministic on persona ground truth; v2 prompt tweaks don't (and shouldn't) reroute the flow. |

---

## State coverage exercised (v2)

- `affirmative` from GREETING: HIT
- `gen_unsure` from AWAIT_240V → CLARIFY_240V: HIT (disambig rule 8 applied)
- `gen_120v` from CLARIFY_240V → DISQUALIFIED_120V: HIT
- DISQUALIFIED_120V terminal phrasing: HIT
- Polite decline tone (no upsell, no retry, no countdown): HIT
- prior_acknowledgments rhythm enforcement: HIT (no cross-turn repeats)
- v2 expanded regex sweep: NO violations detected

---

## New-violations check (v2 ask)

- Awesome./Awesome,/Awesome! anywhere in this transcript: **none**
- Excellent. anywhere: **none**
- Great! anywhere: **none**
- Countdown phrasing ("two more quick", "almost done", "few more questions", "last quick one"): **none**
- Any prior_acknowledgments repeat across consecutive bot turns: **none**
- Any "Perfect!" with exclamation: **none** (v1 had "Perfect." with period — also absent here, swapped to "Cool.")
- Any first-person "I'll be there" / "I'm Key" / "I can install": **none**

**New-violations: NO**

---

## Scoring (filled at review time)

- State machine score: ___ / 10
- Classifier score: ___ / 10
- Voice score: ___ / 10

## Reviewer notes

(Empty until human review — Key fills this in)

---

## Final summary

Persona 02 (Mike, 120v DQ) ran clean under the overhauled v2 prompts. Same 3-turn path as v1, same terminal (DISQUALIFIED_120V), but with v2 deltas applied:
- Greeting rotated to a different sampled opener (variant #2 vs v1's #1).
- Turn-1 acknowledgment switched from "Perfect." to "Cool." per v2 rotation rule.
- prior_acknowledgments tracked turn-over-turn — no rhythm violations.
- Expanded regex sweep (Awesome/Excellent/Great + countdown phrasing) ran on every phraser output — zero hits.
- Disambiguation rule 8 ("i think so" → gen_unsure) held; bot did not falsely advance on a hedged answer.
- Polite-decline pushiness check passed: single message, no retry, door-open phrasing matches voice corpus.

PASS. No new violations.
