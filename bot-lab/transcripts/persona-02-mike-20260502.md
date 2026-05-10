# Persona 02 — Mike (Confused 120v Owner)

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 02
**Expected terminal:** DISQUALIFIED_120V
**Actual terminal:** DISQUALIFIED_120V
**Turns:** 3
**Status:** PASS

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Mike, this is Backup Power Pro — saw your form come through. Got a sec for a couple quick questions so our electrician Key can put your quote together?

### Turn 1 — customer
yeah ok

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.95

### Turn 1 — state machine
GREETING → AWAIT_240V

### Turn 1 — bot (AWAIT_240V)
Perfect. Quick one — does your generator have a big 240-volt outlet (the kind your dryer plugs into), or just regular 120-volt household outlets?

### Turn 2 — customer
uhh i think so

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_unsure
- confidence: 0.85
- notes: applied disambiguation rule 4 — "i think so" on AWAIT_240V is gen_unsure, never gen_240v

### Turn 2 — state machine
AWAIT_240V → CLARIFY_240V

### Turn 2 — bot (CLARIFY_240V)
No worries — easiest way is to snap a quick pic of the outlet on the side of the generator and send it over. We can tell from there.

### Turn 3 — customer
no it's just regular plugs

### Turn 3 — classifier
- state: CLARIFY_240V
- label: gen_120v
- confidence: 0.95
- notes: "regular plugs" is canonical 120v phrasing — clear gen_120v, not unclear

### Turn 3 — state machine
CLARIFY_240V → DISQUALIFIED_120V (terminal)

### Turn 3 — bot (DISQUALIFIED_120V)
Ah — unfortunately our setup needs a 240v generator (the bigger ones). Holler if you ever upgrade and we'd be glad to help then.

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|
| 0 | GREETING | PASS | — | mentions BPP + Key + opens "Hey" + has question; len 167 |
| 1 | AWAIT_240V | PASS | — | acknowledges with "Perfect."; one question; both 240 and 120 named; len 173 |
| 2 | CLARIFY_240V | PASS | — | acknowledges with "No worries"; "snap a quick pic" matches voice corpus; len 138 |
| 3 | DISQUALIFIED_120V | PASS | — | polite decline; door-open re-engagement on upgrade; not pushy; len 133 |

---

## Auto-flags

- Did the bot reach the persona's expected terminal? YES (DISQUALIFIED_120V matches expected)
- Did any phraser output violate a hard constraint (regex check)?
  - `/\$\d/` — no match in any turn
  - `/\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/` — no match
  - `/I'm Key|this is Key personally|I'll be there|I can install/i` — no match
  - length > 280 — max len was 173
  - `/thank you for your interest|I appreciate|rest assured|feel free to/i` — no match
- Did any classifier output have confidence <0.6 on a critical state? NO (lowest was 0.85)
- Did the conversation exceed 15 turns? NO (3 turns)
- Did any state self-loop more than 2x? NO
- Did the bot self-disclose AI status correctly when asking_if_human fired? N/A (didn't fire)
- Bot pushiness check: bot did NOT retry or pressure after the 120v confirmation — went straight to polite decline. PASS.

---

## State coverage exercised

- gen_unsure → CLARIFY_240V transition: HIT
- gen_120v from clarification (CLARIFY_240V → DISQUALIFIED_120V): HIT
- DISQUALIFIED_120V terminal phrasing: HIT
- Polite decline tone (no upsell, no retry): HIT

---

## Scoring (filled at review time)

- State machine score: ___ / 10
- Classifier score: ___ / 10
- Voice score: ___ / 10

## Reviewer notes

(Empty until human review — Key fills this in)
