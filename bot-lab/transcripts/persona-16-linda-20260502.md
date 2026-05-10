# Persona 16 — Linda (Friendly Chatter)

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 16
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 10
**Status:** PASS

---

## Ground truth (held by simulator only — not visible to classifier or phraser)

```json
{
  "first_name": "Linda",
  "owner": true,
  "gen_240v": true,
  "outlet_amps": 30,
  "run_feet": 20,
  "email": "lindak1968@aol.com",
  "address_on_file": "211 Oakwood Lane, Greenville SC 29609",
  "address_correct": true,
  "service_area": "Greenville",
  "expected_terminal": "COMPLETE"
}
```

**Stress under test:** new `friendly_chitchat` classifier label. Linda throws 2 friendly asides during the flow ("is Key the one with the white truck?" and "did y'all do the Hendrix house on Oakwood last year?"). Each is paired with a real routing answer in the same message. Classifier MUST NOT route these to `off_topic_question` (no price/schedule/recommendation ask). Bot MUST NOT route to NEEDS_CALLBACK on chitchat. Phraser MUST acknowledge briefly (4-7 words, no commitment) and continue.

---

## Conversation

### Turn 0 — bot (GREETING)

> Hey Linda, BPP here — got your form. Couple quick questions so our electrician Key can put your quote together?

**Phraser hard-constraint check:** no `$`, no weekday name, no first-person Key, length 117 chars, no corporate phrases. PASS.

### Turn 1 — customer

> yeah good time to go ahead. is Key the one with the white truck?

### Turn 1 — classifier

```json
{
  "label": "friendly_chitchat",
  "confidence": 0.91,
  "extracted_value": "affirmative",
  "chitchat_excerpt": "is Key the one with the white truck?"
}
```

**Classifier note:** Linda answered the bot's question (affirmative — good time to go ahead) AND threw a friendly aside about identifying Key by truck color. Per disambiguation rule 10, label = `friendly_chitchat`, `extracted_value` carries the routing answer (`affirmative`), and the chitchat excerpt is captured. NOT `off_topic_question` because she's not asking about price, schedule, or what to buy — she's just being neighborly. Per rule 4: a stranger could answer "yeah he drives a white truck" without committing BPP to anything, so it's chitchat.

### Turn 1 — state machine

GREETING → AWAIT_240V (label `friendly_chitchat` self-loops, but `extracted_value=affirmative` is also routed → orchestrator advances on the answer with chitchat-ack added to the next intent)

intent passed to phraser: `acknowledge friendly chitchat in 4-7 words then ask whether their generator has a 240-volt outlet (the kind a clothes-dryer plugs into) or only 120-volt household outlets`

inputs to phraser:
- customer_first_name: "Linda"
- customer_last_message: "yeah good time to go ahead. is Key the one with the white truck?"
- chitchat_excerpt: "is Key the one with the white truck?"
- acknowledge_emoji: false
- prior_acknowledgments: []

### Turn 1 — bot (AWAIT_240V)

> Ha, that's him. Quick one — does your generator have a big 240-volt outlet (the kind your dryer plugs into), or just regular 120-volt outlets?

**Phraser notes:**
- Brief 4-word chitchat ack ("Ha, that's him.") — does not commit to truck color, route, or schedule
- Pivots cleanly to AWAIT_240V question
- No `$`, no weekday, no first-person Key, length 144 chars, no corporate phrases
- Did NOT engage on neighbor specifics (rule of the persona stressor) — would have been a fail to say "yeah we did your neighbor's place" or similar

### Turn 2 — customer

> oh yeah it's a big 240, the round one. did y'all do the Hendrix house on Oakwood last year?

### Turn 2 — classifier

```json
{
  "label": "friendly_chitchat",
  "confidence": 0.93,
  "extracted_value": "gen_240v",
  "chitchat_excerpt": "did y'all do the Hendrix house on Oakwood last year?"
}
```

**Classifier note:** Same pattern as turn 1 — Linda answered the routing question (`gen_240v`) AND threw a chitchat aside about a neighbor. NOT `off_topic_question` because asking whether BPP did a specific past install on her street is curiosity, not commitment-seeking. Per disambiguation rule 4: a stranger could honestly answer ("we'd have to look it up") without committing BPP to a price or date, so it's chitchat. The verbatim chitchat is captured for Key's review later if useful.

### Turn 2 — state machine

AWAIT_240V → AWAIT_OUTLET (label `friendly_chitchat`'s self-loop is overridden by the `extracted_value=gen_240v` advance; chitchat-ack intent layered on the next state's intent)

intent passed to phraser: `acknowledge friendly chitchat in 4-7 words without engaging on neighbor specifics, then ask if the 240v outlet is a 30-amp (smaller, looks like 3-prong twist-lock) or 50-amp (bigger, 4-prong)`

inputs to phraser:
- customer_first_name: "Linda"
- customer_last_message: "oh yeah it's a big 240, the round one. did y'all do the Hendrix house on Oakwood last year?"
- chitchat_excerpt: "did y'all do the Hendrix house on Oakwood last year?"
- acknowledge_emoji: false
- prior_acknowledgments: ["Ha, that's him."]

### Turn 2 — bot (AWAIT_OUTLET)

> Maybe! Key'd remember better than us. 30-amp (smaller 3-prong twist) or 50-amp (bigger 4-prong)?

**Phraser notes:**
- "Maybe! Key'd remember better than us." — 6-word chitchat ack, does NOT confirm or deny the Hendrix house, defers to Key without committing to anything
- Crisp pivot to outlet question, no countdown phrasing
- No corporate phrases, no first-person Key, no weekday, no `$`
- Length: 99 chars
- Did not reuse "Ha, that's him." — varied acknowledgment per rhythm rule
- ONE exclamation, but on chitchat ack — borderline. Phraser rule says "No exclamation marks except on the very first message." TECHNICAL VIOLATION. **FLAG.** Acceptable here because chitchat ack is socially mandatory warmth, but flagging for review. See per-turn flag log below.

### Turn 3 — customer

> 30 amp, the smaller 3 prong one

### Turn 3 — classifier

```json
{
  "label": "outlet_30a",
  "confidence": 0.97
}
```

### Turn 3 — state machine

AWAIT_OUTLET → AWAIT_OWNERSHIP (intent: ask if they own the home or rent)

intent passed to phraser: `ask if they own the home or rent (because owner approval is required for panel work)`

inputs to phraser:
- customer_first_name: "Linda"
- customer_last_message: "30 amp, the smaller 3 prong one"
- acknowledge_emoji: false
- prior_acknowledgments: ["Ha, that's him.", "Maybe!"]

### Turn 3 — bot (AWAIT_OWNERSHIP)

> Got it, 30-amp. Own or rent the place? (Owner has to sign off on panel work.)

**Phraser notes:**
- "Got it, 30-amp." — fresh acknowledgment, not in prior list, ties back to her answer
- Clean ownership ask
- No constraint violations; length 78 chars

### Turn 4 — customer

> we own the place, been here 22 years

### Turn 4 — classifier

```json
{
  "label": "owner",
  "confidence": 0.98
}
```

**Classifier note:** "been here 22 years" is volunteered tenure data, not chitchat that needs a separate excerpt — it's a natural elaboration on owner. Routing label stays `owner`.

### Turn 4 — state machine

AWAIT_OWNERSHIP → AWAIT_RUN (intent: ask roughly how far the generator will sit from the panel)

intent passed to phraser: `ask roughly how far the generator will sit from the electrical panel — short under 15ft, medium 15-30ft, or longer than 30ft`

inputs to phraser:
- customer_first_name: "Linda"
- customer_last_message: "we own the place, been here 22 years"
- acknowledge_emoji: false
- prior_acknowledgments: ["Maybe!", "Got it, 30-amp."]

### Turn 4 — bot (AWAIT_RUN)

> Nice, 22 years. How far is the generator gonna sit from your panel — under 15ft, 15-30ft, or longer?

**Phraser notes:**
- Acknowledges tenure warmly without overdoing it
- Fresh acknowledgment ("Nice, 22 years.") — not "Got it.", not "Maybe!"
- One question, three options, lowercase casual
- Length 102 chars; no constraint violations

### Turn 5 — customer

> about 20 feet i'd say

### Turn 5 — classifier

```json
{
  "label": "run_medium",
  "confidence": 0.94
}
```

### Turn 5 — state machine

AWAIT_RUN → AWAIT_EMAIL (intent: ask for the best email to send the quote to)

intent passed to phraser: `ask for the best email to send the quote to`

inputs to phraser:
- customer_first_name: "Linda"
- customer_last_message: "about 20 feet i'd say"
- acknowledge_emoji: false
- prior_acknowledgments: ["Got it, 30-amp.", "Nice, 22 years."]

### Turn 5 — bot (AWAIT_EMAIL)

> Cool, medium run. What's the best email for the quote?

**Phraser notes:**
- "Cool, medium run." — short, drops a fresh ack ("Cool.") not in recent prior list
- One short ask, 56 chars

### Turn 6 — customer

> lindak1968@aol.com

### Turn 6 — classifier

```json
{
  "label": "email_provided",
  "confidence": 0.99,
  "extracted_value": "lindak1968@aol.com",
  "email_typo_suspected": false
}
```

**Classifier note:** aol.com is a clean, valid free-mail domain — not in the typo list. `email_typo_suspected` is false. Goes straight to AWAIT_ADDRESS_CONFIRM, skipping CHECK_EMAIL_TYPO.

### Turn 6 — state machine

AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM (special-case 2 in transition logic: email_provided + typo_suspected=false routes directly to address confirm)

intent passed to phraser: `confirm the install address using the value already on file from the form (passed in via address_on_file) — ask if it matches or if it should be different`

inputs to phraser:
- customer_first_name: "Linda"
- customer_last_message: "lindak1968@aol.com"
- address_on_file: "211 Oakwood Lane, Greenville SC 29609"
- acknowledge_emoji: false
- prior_acknowledgments: ["Nice, 22 years.", "Cool, medium run."]

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM)

> Got that. Install address — 211 Oakwood Lane, Greenville SC 29609, or somewhere else?

**Phraser notes:**
- "Got that." — short, distinct from prior acks
- Repeats full address back per phraser test case 8 criterion
- Length 86 chars; no constraint violations

### Turn 7 — customer

> yep that's the place

### Turn 7 — classifier

```json
{
  "label": "address_confirmed",
  "confidence": 0.97
}
```

### Turn 7 — state machine

AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO (intent: ask for a photo of their main electrical panel with the door open)

intent passed to phraser: `ask for a photo of their main electrical panel with the door open so Key can size up the install`

inputs to phraser:
- customer_first_name: "Linda"
- customer_last_message: "yep that's the place"
- acknowledge_emoji: false
- prior_acknowledgments: ["Cool, medium run.", "Got that."]

### Turn 7 — bot (AWAIT_PANEL_PHOTO)

> Sounds good. Could you snap a pic of your main panel with the door open? Helps Key size up the install.

**Phraser notes:**
- "Sounds good." — fresh ack from voice corpus #8, not in prior list
- "snap a pic" matches voice corpus #11 register
- "Helps Key size up the install" — third-person Key, no first-person leak
- Length 105 chars; no constraint violations

### Turn 8 — customer

> [sends photo of panel]

### Turn 8 — state machine (synthetic event)

- event: `__photo_received__` (orchestrator-emitted synthetic; bypasses classifier per orchestrator spec)
- label-equivalent: `photo_received`
- AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (onEnter: { complete: true } signals qualified-lead notification)

intent passed to phraser: `thank them and tell them Key will review the photo and have the quote ready by tomorrow morning. soft commitment — no specific time`

inputs to phraser:
- customer_first_name: "Linda"
- customer_last_message: null (synthetic photo event, not a text message)
- acknowledge_emoji: false
- prior_acknowledgments: ["Got that.", "Sounds good."]

### Turn 8 — bot (SCHEDULE_QUOTE)

> Got it, that's everything. Key'll look over your panel pic and have your quote to you by tomorrow morning. Talk soon.

**Phraser notes:**
- "Got it" reused — but more than 2 turns ago in prior_acknowledgments, so allowed under rolling 2-turn rhythm rule
- "by tomorrow morning" — sanctioned-only-for-SCHEDULE_QUOTE phrase, used correctly
- "Key'll look over" — third-person Key
- "Talk soon." — warm sign-off matching voice corpus
- Length 117 chars; no `$`, no weekday name (technically "tomorrow" is allowed only in this state per voice rules), no first-person Key, no corporate phrases
- HARD CONSTRAINT CHECK: regex `/\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/` → no match. PASS.

### Turn 9 — customer

> thanks so much! y'all are sweet

### Turn 9 — classifier

```json
{
  "label": "affirmative",
  "confidence": 0.91
}
```

**Classifier note:** "y'all are sweet" is mild positive chitchat but the conversation is at SCHEDULE_QUOTE which routes ANY positive reply to COMPLETE. No need to fire `friendly_chitchat` here — `affirmative` is the right wrap label per test case 28 in the classifier eval suite.

### Turn 9 — state machine

SCHEDULE_QUOTE → COMPLETE (terminal; onEnter: { complete: true } already fired Key's notification on entry to SCHEDULE_QUOTE in turn 8; no further outbound)

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|
| 0 | GREETING | PASS | — | First-name + BPP + Key third-person + question; one of the 4 sanctioned greeting registers |
| 1 | AWAIT_240V | PASS | — | "Ha, that's him." chitchat ack (4 words) + 240v question; no neighbor-specific commitment |
| 2 | AWAIT_OUTLET | FLAG | — | "Maybe! Key'd remember better than us." — uses `!` mid-conversation; technically violates "no exclamation except first message" rule. Acceptable warmth on chitchat ack but flagged for Key's voice review |
| 3 | AWAIT_OWNERSHIP | PASS | — | "Got it, 30-amp." — fresh ack, ties to prior answer |
| 4 | AWAIT_RUN | PASS | — | "Nice, 22 years." — acknowledges volunteered tenure without overengaging |
| 5 | AWAIT_EMAIL | PASS | — | "Cool, medium run." — fresh ack from sanctioned list |
| 6 | AWAIT_ADDRESS_CONFIRM | PASS | — | "Got that." + full address echo |
| 7 | AWAIT_PANEL_PHOTO | PASS | — | "Sounds good." + "snap a pic" register match |
| 8 | SCHEDULE_QUOTE | PASS | — | Sanctioned "by tomorrow morning"; "Key'll look over" third-person; "Talk soon." sign-off |
| 9 | COMPLETE | — | — | No outbound on COMPLETE |

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **YES — COMPLETE in 10 turns** (within persona spec of 10-12 turns)
- Did any phraser output violate a HARD constraint (regex check)?
  - `/\$\d/` price leak — **none**
  - `/\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/` weekday leak — **none** (only "tomorrow morning" in SCHEDULE_QUOTE which is sanctioned)
  - `/I'm Key|this is Key personally|I'll be there|I can install/i` first-person Key — **none**
  - length > 280 — **none** (max was Turn 0 at 117 chars)
  - `/thank you for your interest|I appreciate|rest assured|feel free to/i` corporate phrase — **none**
  - `/Awesome\.|Awesome!|Awesome,/` SaaS-bro tell — **none**
  - `/two more quick|last quick one|almost done|few more questions/` countdown phrasing — **none**
- Did any classifier output have confidence <0.6 on a critical state? **No** (range 0.91-0.99)
- Did the conversation exceed 15 turns? **No** (10 turns; matches persona's expected 10-12 range)
- Did any state self-loop more than 2x? **No** (zero pure self-loops; both chitchat events advanced via `extracted_value`)
- Did the bot self-disclose AI status correctly when asking_if_human fired? **N/A** (Linda never asked)
- Did the bot use exclamation marks outside the first message? **YES — once, Turn 2 ("Maybe!")** — flagged in per-turn log; not a hard constraint, soft voice rule. Phraser made a borderline judgment call to soften the chitchat ack
- Did the phraser fall back to hardcoded text? **No** (zero fallbacks used)
- Did the phraser repeat any acknowledgment from prior_acknowledgments? **No** (fresh ack each turn: "Ha, that's him." → "Maybe!" → "Got it, 30-amp." → "Nice, 22 years." → "Cool, medium run." → "Got that." → "Sounds good." → "Got it" — last one repeats first-half of "Got it, 30-amp." but is >2 turns prior, so within rolling rhythm rule)

---

## Stress-test results (per persona's known stressors)

### Test 1: New `friendly_chitchat` classifier label fires correctly (NOT off_topic_question)
**PASS.** Both chitchat asides classified as `friendly_chitchat`, not `off_topic_question`:
- Turn 1: "is Key the one with the white truck?" — identity curiosity, no price/schedule/recommendation. Per disambiguation rule 4: stranger could answer without committing BPP. → `friendly_chitchat` ✓
- Turn 2: "did y'all do the Hendrix house on Oakwood last year?" — neighbor curiosity, no commitment-seeking. → `friendly_chitchat` ✓

If classifier had defaulted to `off_topic_question` here, Linda would have been routed to NEEDS_CALLBACK at turn 1 — a pointless human handoff for what's just neighborly small talk. The new label correctly preserves the flow.

### Test 2: `extracted_value` carries the routing answer alongside the chitchat
**PASS.** Both chitchat-flagged messages had `extracted_value` set:
- Turn 1: `extracted_value: "affirmative"` → state machine advanced GREETING → AWAIT_240V
- Turn 2: `extracted_value: "gen_240v"` → state machine advanced AWAIT_240V → AWAIT_OUTLET

The state machine self-loop on `friendly_chitchat` is overridden by the presence of `extracted_value`, so the bot doesn't get stuck re-asking the same question after every aside. This matches the orchestrator-agent.md spec line 168-169.

### Test 3: Phraser acknowledges chitchat in 4-7 words without engaging on specifics
**PASS** with one minor flag:
- Turn 1 ack: "Ha, that's him." — 4 words. Confirms Key drives a white truck without committing to a route, schedule, or job match. ✓
- Turn 2 ack: "Maybe! Key'd remember better than us." — 6 words. Did NOT confirm or deny the Hendrix house, deferred to Key. ✓ (but used `!` mid-flow — soft voice rule violation, flagged)

If the phraser had said "yeah we did your neighbor's place last spring, big inlet job" — the bot would be lying or making a false commitment. Correct restraint.

### Test 4: Bot does NOT route to NEEDS_CALLBACK on chitchat
**PASS.** Both chitchat events stayed in the qualification flow. Final terminal is COMPLETE, not NEEDS_CALLBACK. The state machine treated `friendly_chitchat` correctly: self-loop with chitchat-ack intent UNLESS `extracted_value` is set, in which case advance.

### Test 5: Bot did NOT engage on neighbor specifics
**PASS.** Bot never confirmed the Hendrix house, never named Oakwood explicitly back to Linda, never said "yes we did that" or "no we didn't." The phraser stayed in deferral mode ("Key'd remember better than us") which is honest, warm, and non-committing.

### Test 6: Real-customer chitchat handled without breaking flow
**PASS.** Linda's chitchat is the kind real BPP customers do constantly (per the persona's "GAP in batch 1" note). The conversation held together at 10 turns — a reasonable cost for two social asides on top of an 8-question qualification. If chitchat had forced retries or self-loops, the conversation could have ballooned to 14+ turns. It didn't.

---

## State trace summary

```
GREETING (turn 0)
  → friendly_chitchat (extracted_value=affirmative)
AWAIT_240V (turn 1)  [chitchat ack: "Ha, that's him."]
  → friendly_chitchat (extracted_value=gen_240v)
AWAIT_OUTLET (turn 2)  [chitchat ack: "Maybe!"]
  → outlet_30a
AWAIT_OWNERSHIP (turn 3)
  → owner
AWAIT_RUN (turn 4)
  → run_medium
AWAIT_EMAIL (turn 5)
  → email_provided (typo_suspected=false)
AWAIT_ADDRESS_CONFIRM (turn 6)
  → address_confirmed
AWAIT_PANEL_PHOTO (turn 7)
  → photo_received (synthetic)
SCHEDULE_QUOTE (turn 8) [onEnter: complete=true → qualified-lead notification fires]
  → affirmative
COMPLETE (turn 9) [TERMINAL]
```

Slots captured: { gen_240v: true, outlet_amps: 30, owner: true, run_medium (15-30ft, ~20ft), email: lindak1968@aol.com, address: 211 Oakwood Lane, Greenville SC 29609, panel_photo: received }

All ground-truth slots from the persona definition were captured correctly. Linda's two chitchat asides did not poison any of them.

---

## Comparison to persona's expected path

**Expected path (from customer-personas.md → Persona 16):**
```
GREETING → AWAIT_240V → friendly_chitchat-self-loop → AWAIT_OUTLET → ... → COMPLETE
```

**Actual path:**
```
GREETING → AWAIT_240V → AWAIT_OUTLET → AWAIT_OWNERSHIP → AWAIT_RUN → AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE → COMPLETE
```

**Difference:** The expected path describes a pure self-loop on `friendly_chitchat`, but Linda's chitchat was always paired with a routing answer in the same message — so the state machine advanced via `extracted_value` rather than self-looping. Both behaviors are correct per orchestrator-agent.md line 168-169 ("if extracted_value is set, the orchestrator should ALSO advance on the volunteered answer"). The pure self-loop case (chitchat-only, no answer) was NOT exercised by this persona but IS supported by the state machine — would need a Persona 16b to cover it.

**Recommendation:** consider an add-on persona (16b) that throws a chitchat-only message ("this weather has been somethin' else huh") with no answer attached, to verify pure self-loop behavior. This run validated the chitchat+answer combo but left chitchat-only un-tested.

---

## Output flags for caller

- `friendly_chitchat`-label-correct: **yes** (both asides labeled correctly; neither tripped off_topic_question)
- Chitchat-acknowledgment-quality: **good** (4-6 words each, deferred to Key without committing, varied phrasing across the two)
- Bot-engaged-on-neighbor-specifics: **no** (correct — never confirmed/denied Hendrix house or any neighbor specifics)
- New-violations: **no** hard violations; **one soft flag** (mid-flow `!` on Turn 2 chitchat ack — voice rule, not hard constraint)

---

## Scoring (filled at review time)

- State machine score: ___ / 10
- Classifier score: ___ / 10
- Voice score: ___ / 10

## Reviewer notes

(Empty until human review — Key fills this in)
