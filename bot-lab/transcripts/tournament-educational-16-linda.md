# Tournament — EDUCATIONAL variant — Persona 16 (Linda, Friendly Chatter)

**Date:** 2026-05-02
**Variant:** EDUCATIONAL (`bot-lab/variants/educational/phraser-agent.md`)
**Persona:** 16 — Linda (friendly chitchat stress test)
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 10
**Status:** PASS

---

## Variant under test

EDUCATIONAL phraser: target length 100-170 chars, teach-then-ask pattern (one short clause of context before each technical question), substantive acknowledgments. Same hard constraints as baseline.

## Critical test for this persona

Educational chitchat acks must stay **warm and brief** — DO NOT turn the chitchat moment into a lecture. The teaching register applies to the technical question that follows the ack, NOT to the social aside itself.

Failure mode to watch for: bot acks Linda's "did y'all do the Hendrix house?" with a 3-sentence explainer about how BPP keeps install records. That kills warmth and turns small talk into corporate-speak.

Correct shape: 4-7 word warm chitchat ack → teach-then-ask on the next slot.

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

---

## Conversation

### Turn 0 — bot (GREETING)

> Hey Linda, BPP here. Saw your form for a generator inlet — that's the wall plug we install for backup power. Couple quick questions so Key can put your quote together?

**Phraser notes (EDUCATIONAL register):**
- Uses one of the sanctioned EDUCATIONAL greeting openers (the first variant in the spec).
- Adds a one-clause inlet definition ("the wall plug we install for backup power") — this is the educational hook a first-time-generator-buyer would appreciate.
- Third-person Key ("so Key can put your quote together"), no first-person leak.
- Length: 165 chars (within EDUCATIONAL target 100-170).
- Hard-constraint check: no `$`, no weekday name, no first-person Key, length ≤280, no banned phrases. PASS.

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

**Classifier note:** Linda answered the bot's question (affirmative — good time) AND threw a friendly aside identifying Key by truck color. Per disambiguation rule 10: label `friendly_chitchat`, `extracted_value` carries the routing answer, chitchat captured. Per rule 4: a stranger could answer "yeah, white truck" without committing BPP to anything → chitchat, NOT off_topic_question.

### Turn 1 — state machine

GREETING → AWAIT_240V (label `friendly_chitchat` self-loops by default, but `extracted_value=affirmative` advances per orchestrator-agent line 168-169; chitchat-ack intent layers on the next state's intent).

intent passed to phraser: `acknowledge friendly chitchat in 4-7 words then ask whether their generator has a 240-volt outlet (the kind a clothes-dryer plugs into) or only 120-volt household outlets`

inputs to phraser:
- customer_first_name: "Linda"
- customer_last_message: "yeah good time to go ahead. is Key the one with the white truck?"
- chitchat_excerpt: "is Key the one with the white truck?"
- acknowledge_emoji: false
- prior_acknowledgments: []

### Turn 1 — bot (AWAIT_240V)

> Yep, that's him. Generators come in two flavors — 240v (whole-home power) and 120v (just a few outlets). Which kind is yours?

**Phraser notes (EDUCATIONAL):**
- Chitchat ack: "Yep, that's him." — 4 words, warm, no commitment. Critically: did NOT turn the truck question into a lecture (no "we always drive marked vehicles for safety reasons..."). The educational register stays on the technical question, not the social aside. **This is the chitchat-warmth test passing.**
- Teach-then-ask: one clause of context ("Generators come in two flavors — 240v (whole-home power) and 120v (just a few outlets)") before the question ("Which kind is yours?"). This is the EDUCATIONAL pattern from the variant spec.
- No countdown phrasing, no "two more quick", no "almost done."
- Length: 132 chars (within EDUCATIONAL target).
- Hard-constraint check: PASS on all axes.

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

**Classifier note:** Same pattern as turn 1 — Linda answered (`gen_240v`) AND added a neighbor-curiosity aside. Per rule 4: asking whether BPP did a specific past install isn't commitment-seeking; a stranger could honestly say "we'd have to check our records" → chitchat. NOT off_topic_question.

### Turn 2 — state machine

AWAIT_240V → AWAIT_OUTLET (extracted_value=gen_240v advances; chitchat-ack intent layered).

intent passed to phraser: `acknowledge friendly chitchat in 4-7 words without engaging on neighbor specifics, then ask if the 240v outlet is a 30-amp (smaller, looks like 3-prong twist-lock) or 50-amp (bigger, 4-prong)`

inputs to phraser:
- customer_first_name: "Linda"
- customer_last_message: "oh yeah it's a big 240, the round one. did y'all do the Hendrix house on Oakwood last year?"
- chitchat_excerpt: "did y'all do the Hendrix house on Oakwood last year?"
- acknowledge_emoji: false
- prior_acknowledgments: ["Yep, that's him."]

### Turn 2 — bot (AWAIT_OUTLET)

> Could be — Key'd remember way better than us. On the outlet itself, two common sizes: 30-amp (smaller 3-prong twist) or 50-amp (bigger 4-prong). Which one's yours?

**Phraser notes (EDUCATIONAL):**
- Chitchat ack: "Could be — Key'd remember way better than us." — 8 words. Slightly above the 4-7 target but reads as natural deferral; does NOT confirm or deny the Hendrix house, defers to Key without commitment. **Did NOT lecture on chitchat** — this is the warmth test passing.
- Teach-then-ask: "two common sizes" framing before the 30A/50A question. EDUCATIONAL adds the brief context that there's a standard binary, then asks.
- No first-person Key, no weekday, no `$`, no corporate phrases, no countdown.
- Length: 162 chars (within EDUCATIONAL 100-170 target).
- Soft note: ack is 8 words instead of strict 4-7. That's a minor stretch but stays warm and avoids the "lecture" failure mode. The dash structure ("Could be — Key'd remember way better than us") reads as one breath, not two clauses.
- Did NOT reuse "Yep, that's him." — fresh acknowledgment per rolling 2-turn rhythm.

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

AWAIT_OUTLET → AWAIT_OWNERSHIP

intent passed to phraser: `ask if they own the home or rent (because owner approval is required for panel work)`

inputs to phraser:
- customer_first_name: "Linda"
- customer_last_message: "30 amp, the smaller 3 prong one"
- acknowledge_emoji: false
- prior_acknowledgments: ["Yep, that's him.", "Could be — Key'd remember way better than us."]

### Turn 3 — bot (AWAIT_OWNERSHIP)

> Got it — 30-amp's the most common for whole-home setups. Quick one — own the place or rent? Owner has to sign off on panel work.

**Phraser notes (EDUCATIONAL):**
- Substantive ack: "Got it — 30-amp's the most common for whole-home setups." This teaches what her answer means (per EDUCATIONAL spec example: "Got it — 50-amp's the most common for whole-home setups. Quick one — own the place or rent?"). It's the hallmark EDUCATIONAL move — turning a confirmation into a micro-explanation.
- One question, with a brief reason for the question ("Owner has to sign off on panel work").
- Length: 127 chars (within EDUCATIONAL target).
- Fresh ack — not in prior list.
- Hard-constraint check: PASS.

### Turn 4 — customer

> we own the place, been here 22 years

### Turn 4 — classifier

```json
{
  "label": "owner",
  "confidence": 0.98
}
```

**Classifier note:** "been here 22 years" is volunteered tenure data, natural elaboration on owner — not a separate chitchat excerpt. Routing label stays `owner`.

### Turn 4 — state machine

AWAIT_OWNERSHIP → AWAIT_RUN

intent passed to phraser: `ask roughly how far the generator will sit from the electrical panel — short under 15ft, medium 15-30ft, or longer than 30ft`

inputs to phraser:
- customer_first_name: "Linda"
- customer_last_message: "we own the place, been here 22 years"
- acknowledge_emoji: false
- prior_acknowledgments: ["Could be — Key'd remember way better than us.", "Got it — 30-amp's the most common for whole-home setups."]

### Turn 4 — bot (AWAIT_RUN)

> 22 years, nice. Distance matters because it changes the wire run and conduit — how far is the generator gonna sit from your panel? Under 15ft, 15-30ft, or longer?

**Phraser notes (EDUCATIONAL):**
- Brief warm ack on tenure ("22 years, nice.") — does not over-engage.
- Teach-then-ask: explains WHY distance matters ("changes the wire run and conduit") before asking the question. This is the EDUCATIONAL register doing what it's supposed to do — the explanation tells a first-time owner what's behind the question.
- Three options offered, not corporate.
- Length: 167 chars (within EDUCATIONAL 100-170 target, just at the upper edge).
- Hard-constraint check: PASS.
- Fresh ack — "22 years, nice." not in prior list.

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

AWAIT_RUN → AWAIT_EMAIL

intent passed to phraser: `ask for the best email to send the quote to`

inputs to phraser:
- customer_first_name: "Linda"
- customer_last_message: "about 20 feet i'd say"
- acknowledge_emoji: false
- prior_acknowledgments: ["Got it — 30-amp's the most common for whole-home setups.", "22 years, nice."]

### Turn 5 — bot (AWAIT_EMAIL)

> 20ft is right in the sweet spot — short cable run, clean install. What's the best email to send the quote to?

**Phraser notes (EDUCATIONAL):**
- Substantive ack: "20ft is right in the sweet spot — short cable run, clean install." Teaches what her distance means (favorable for installation).
- Crisp ask, no over-engineering.
- Length: 110 chars (within EDUCATIONAL target).
- Fresh ack.
- Hard-constraint check: PASS.

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

AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM (special-case: email_provided + typo_suspected=false → direct route to address confirm)

intent passed to phraser: `confirm the install address using the value already on file from the form (passed in via address_on_file) — ask if it matches or if it should be different`

inputs to phraser:
- customer_first_name: "Linda"
- customer_last_message: "lindak1968@aol.com"
- address_on_file: "211 Oakwood Lane, Greenville SC 29609"
- acknowledge_emoji: false
- prior_acknowledgments: ["22 years, nice.", "20ft is right in the sweet spot — short cable run, clean install."]

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM)

> Locked in. Last couple — address we'd install at is 211 Oakwood Lane, Greenville SC 29609. That still right, or somewhere else?

**Phraser notes (EDUCATIONAL):**
- Brief ack ("Locked in.") — short by EDUCATIONAL standards but the address itself does the substantive work.
- Echoes the full address per phraser test case 8 criterion.
- "Last couple" is borderline countdown — but the EDUCATIONAL spec bans "last one" specifically; "last couple" is conversational scoping ("we're nearly through"), not a hard countdown phrase. Acceptable but flagged for review.
- Length: 124 chars.
- Hard-constraint check: PASS on all hard rules. Soft flag on "last couple" → see per-turn log.

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

AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO

intent passed to phraser: `ask for a photo of their main electrical panel with the door open so Key can size up the install`

inputs to phraser:
- customer_first_name: "Linda"
- customer_last_message: "yep that's the place"
- acknowledge_emoji: false
- prior_acknowledgments: ["20ft is right in the sweet spot — short cable run, clean install.", "Locked in."]

### Turn 7 — bot (AWAIT_PANEL_PHOTO)

> Cool. One last thing — could you snap a pic of your main electrical panel with the door open? Helps Key see the brand and breaker layout before quoting.

**Phraser notes (EDUCATIONAL):**
- Brief ack ("Cool.").
- Teach-then-ask: explains WHY the photo matters ("see the brand and breaker layout before quoting"). Educational pattern teaches the customer what Key actually does with the photo.
- "snap a pic" matches voice corpus #11 register.
- "Helps Key" — third-person Key.
- Length: 152 chars (within EDUCATIONAL target).
- "One last thing" is a soft countdown phrase — flagged. EDUCATIONAL spec bans "last one" / "almost done" — "one last thing" is in the same family. Borderline. **Soft flag.**
- Fresh ack.

### Turn 8 — customer

> [sends photo of panel]

### Turn 8 — state machine (synthetic event)

- event: `__photo_received__` (orchestrator-emitted; bypasses classifier)
- label-equivalent: `photo_received`
- AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (onEnter: { complete: true } fires Key's qualified-lead notification)

intent passed to phraser: `thank them and tell them Key will review the photo and have the quote ready by tomorrow morning. soft commitment — no specific time`

inputs to phraser:
- customer_first_name: "Linda"
- customer_last_message: null (synthetic photo event)
- acknowledge_emoji: false
- prior_acknowledgments: ["Locked in.", "Cool."]

### Turn 8 — bot (SCHEDULE_QUOTE)

> Got the panel pic — that's everything we need. Key'll review the photo, line up the parts, and have your quote to you by tomorrow morning. Talk soon.

**Phraser notes (EDUCATIONAL):**
- Substantive sign-off — teaches what Key does next ("review the photo, line up the parts") rather than just "thanks, talk soon." This is the EDUCATIONAL pattern landing on the closer.
- "by tomorrow morning" — sanctioned-only-for-SCHEDULE_QUOTE phrase, used correctly per state-machine.js intent.
- "Key'll review" — third-person Key.
- "Talk soon." — warm sign-off matching voice corpus #6.
- Length: 149 chars (within EDUCATIONAL target).
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

**Classifier note:** Mild positive chitchat at SCHEDULE_QUOTE → routes to COMPLETE per test case 28. No need to fire `friendly_chitchat` here.

### Turn 9 — state machine

SCHEDULE_QUOTE → COMPLETE (terminal; onEnter: { complete: true } already fired notification on entry to SCHEDULE_QUOTE in turn 8; no further outbound).

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|
| 0 | GREETING | PASS | — | EDUCATIONAL opener (sanctioned variant 1); inlet definition ("wall plug we install for backup power") added per teach-then-ask register |
| 1 | AWAIT_240V | PASS | — | Chitchat ack 4 words ("Yep, that's him.") + 240v explainer ("two flavors — 240v whole-home, 120v few outlets"). Did NOT lecture on chitchat |
| 2 | AWAIT_OUTLET | PASS | — | Chitchat ack 8 words ("Could be — Key'd remember way better than us") — slightly over 4-7 target but stays warm; deferred to Key without committing. EDUCATIONAL teach-then-ask on outlet question |
| 3 | AWAIT_OWNERSHIP | PASS | — | Substantive ack teaching what 30-amp means ("most common for whole-home setups"); brief reason for ownership question |
| 4 | AWAIT_RUN | PASS | — | "22 years, nice." + WHY-distance-matters ("changes the wire run and conduit"). Classic EDUCATIONAL teach-then-ask |
| 5 | AWAIT_EMAIL | PASS | — | "20ft is right in the sweet spot — short cable run, clean install." Substantive ack teaches what 20ft means |
| 6 | AWAIT_ADDRESS_CONFIRM | PASS (soft flag) | — | "Last couple — " borderline countdown phrase; not banned hard but in the same family. Address echoed per spec |
| 7 | AWAIT_PANEL_PHOTO | PASS (soft flag) | — | "One last thing —" same soft-countdown family. Teach-then-ask on photo (why panel photo helps) is solid |
| 8 | SCHEDULE_QUOTE | PASS | — | "by tomorrow morning" sanctioned; substantive close teaches what Key does next ("review, line up parts"); third-person Key; "Talk soon." sign-off |
| 9 | COMPLETE | — | — | No outbound on COMPLETE |

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **YES — COMPLETE in 10 turns** (matches persona's expected 10-12 turn range).
- Did any phraser output violate a HARD constraint (regex check)?
  - `/\$\d/` price leak — **none**
  - `/\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/` weekday — **none** (only "tomorrow morning" in SCHEDULE_QUOTE, sanctioned)
  - `/I'm Key|this is Key personally|I'll be there|I can install/i` first-person Key — **none**
  - length > 280 — **none** (max was Turn 0 at 165 chars; max EDUCATIONAL target is 170)
  - `/thank you for your interest|I appreciate|rest assured|feel free to/i` corporate — **none**
  - `/Awesome\.|Awesome!|Awesome,/`, `/Perfect!|Excellent\.|Great!/` SaaS-bro — **none**
  - `/two more quick|last quick one|almost done|few more questions/` countdown — **none of these exact phrases**, but **two soft-family violations** flagged: "Last couple —" (Turn 6) and "One last thing —" (Turn 7). These are NOT in the hard-banned regex but adjacent in spirit. EDUCATIONAL spec banlist explicitly includes "almost done" and "last one." Borderline.
- Did any classifier output have confidence <0.6 on a critical state? **No** (range 0.91-0.99).
- Did the conversation exceed 15 turns? **No** (10 turns).
- Did any state self-loop more than 2x? **No** (zero pure self-loops; both chitchat events advanced via `extracted_value`).
- Did the bot self-disclose AI status correctly when asking_if_human fired? **N/A** (Linda never asked).
- Did the phraser fall back to hardcoded text? **No** (zero fallbacks).
- Did the phraser repeat any acknowledgment from prior_acknowledgments (rolling 2-turn window)? **No** (fresh ack each turn).

---

## Stress-test results (per persona's known stressors + variant-specific)

### Test 1: Educational chitchat ack stays WARM and BRIEF (does NOT lecture on the social aside)
**PASS.**
- Turn 1: "Yep, that's him." — 4 words. Did NOT add a paragraph about how Key drives a marked vehicle for visibility / safety / regulation. The teach-then-ask register kicked in only on the 240v question that followed.
- Turn 2: "Could be — Key'd remember way better than us." — 8 words (slightly over the 4-7 target but stays warm). Did NOT lecture about how BPP keeps installation records by neighborhood, did NOT confirm or deny the Hendrix house, deferred honestly to Key. Critically, the EDUCATIONAL teach-then-ask resumed on the outlet question, not the chitchat.

This is the variant-specific failure mode the test was designed to catch, and it didn't happen. **Chitchat-warmth: 8/10.**

The 1-point deduction is for Turn 2 ack running 8 words instead of 4-7, and the small-but-real risk that EDUCATIONAL phrasers in another run might over-explain. The structural shape held but the upper-bound discipline was loose.

### Test 2: `friendly_chitchat` classifier label fires correctly (NOT off_topic_question)
**PASS.** Both chitchat asides labeled correctly. If they had defaulted to off_topic_question, Linda would be in NEEDS_CALLBACK at turn 1 — pointless human handoff for neighborly small talk.

### Test 3: `extracted_value` carries the routing answer alongside chitchat
**PASS.** Both chitchat-flagged messages had `extracted_value` set; state machine self-loop overridden correctly.

### Test 4: Phraser acknowledges chitchat in 4-7 words without engaging on specifics
**MOSTLY PASS** (1 minor flag).
- Turn 1: 4 words ✓
- Turn 2: 8 words — slight overflow but the structure ("Could be — Key'd remember way better than us") reads as a single warm deferral, not two clauses. Does not engage on the Hendrix house specifics.

### Test 5: Bot does NOT route to NEEDS_CALLBACK on chitchat
**PASS.** Final terminal is COMPLETE.

### Test 6: Bot did NOT engage on neighbor specifics (would be lying or false-committing)
**PASS.** Bot never confirmed the Hendrix house, never said "yes/no we did that." Stayed in honest deferral mode ("Key'd remember better than us"). Correct restraint.

### Test 7: EDUCATIONAL teach-then-ask register applied on technical questions
**PASS** with soft flags.
- Turn 1: 240v vs 120v explained as "two flavors — whole-home power vs few outlets" before asking. ✓
- Turn 2: outlet sizes framed as "two common sizes" before asking. ✓
- Turn 3: ack TEACHES what 30-amp means ("most common for whole-home setups"). ✓
- Turn 4: explains WHY distance matters ("changes the wire run and conduit") before asking. ✓
- Turn 5: ack teaches what 20ft means ("right in the sweet spot — short cable run, clean install"). ✓
- Turn 7: explains WHY panel photo matters ("see the brand and breaker layout before quoting"). ✓
- Turn 8: substantive close teaches what Key does next ("review the photo, line up the parts"). ✓

EDUCATIONAL register applied consistently. The variant fingerprint ("acknowledgments are substantive", "teaches before asking") is hit on every turn after Turn 0.

### Test 8: EDUCATIONAL message length within 100-170 char target
**PASS.** All turns 0-8 fall in range. Distribution:
- Turn 0: 165 chars
- Turn 1: 132 chars
- Turn 2: 162 chars
- Turn 3: 127 chars
- Turn 4: 167 chars
- Turn 5: 110 chars
- Turn 6: 124 chars
- Turn 7: 152 chars
- Turn 8: 149 chars

Average bot-message length: **143 chars.** EDUCATIONAL target: 130 chars average per variant fingerprint. We're slightly above (143 vs target 130), but within the 100-170 range on every turn. No turn was under 100 or over 170.

### Test 9: Soft-countdown phrase discipline
**FLAG (soft, not hard).** Two borderline phrases:
- Turn 6: "Last couple —" (frames remaining slots as a small set)
- Turn 7: "One last thing —" (signals the photo is the final item)

EDUCATIONAL spec bans "almost done", "last quick one", "few more questions" by name. "Last couple" and "one last thing" aren't in the regex banlist but are in the same family. Two minor instances over 9 bot turns is acceptable; if EDUCATIONAL phrasers slide further into "two more questions, then last one" territory, that's a hard violation.

---

## State trace summary

```
GREETING (turn 0)
  → friendly_chitchat (extracted_value=affirmative)
AWAIT_240V (turn 1)  [chitchat ack: "Yep, that's him."]
  → friendly_chitchat (extracted_value=gen_240v)
AWAIT_OUTLET (turn 2)  [chitchat ack: "Could be — Key'd remember way better than us."]
  → outlet_30a
AWAIT_OWNERSHIP (turn 3)  [substantive ack: "30-amp's the most common for whole-home setups"]
  → owner
AWAIT_RUN (turn 4)  [substantive ack: "22 years, nice." + teach-why-distance-matters]
  → run_medium
AWAIT_EMAIL (turn 5)  [substantive ack: "20ft is right in the sweet spot..."]
  → email_provided (typo_suspected=false)
AWAIT_ADDRESS_CONFIRM (turn 6)
  → address_confirmed
AWAIT_PANEL_PHOTO (turn 7)  [teach-why-photo-matters]
  → photo_received (synthetic)
SCHEDULE_QUOTE (turn 8) [onEnter: complete=true → notification fires]
  → affirmative
COMPLETE (turn 9) [TERMINAL]
```

Slots captured: { gen_240v: true, outlet_amps: 30, owner: true, run_medium (15-30ft, ~20ft), email: lindak1968@aol.com, address: 211 Oakwood Lane Greenville SC 29609, panel_photo: received }

All ground-truth slots captured correctly. EDUCATIONAL chitchat handling did not poison any of them.

---

## EDUCATIONAL variant comparison vs WARM baseline (Persona 16, prior run)

| Dimension | WARM baseline (prior) | EDUCATIONAL (this run) |
|---|---|---|
| Turn count | 10 | 10 |
| Avg msg length | ~95 chars | ~143 chars |
| Chitchat ack length | 4 words / 6 words | 4 words / 8 words |
| Substantive acks | "Got it, 30-amp." | "Got it — 30-amp's the most common for whole-home setups." |
| Teach-then-ask present | No (just asks) | Yes, on every technical Q |
| Hard-constraint violations | 0 (1 soft flag: `!` mid-flow) | 0 (2 soft flags: "Last couple", "One last thing") |
| Chitchat warmth preserved | Yes | Yes |
| Did NOT lecture on chitchat | Yes | Yes ✓ critical test |

Key takeaway: **EDUCATIONAL passes the chitchat-warmth test.** The teach-then-ask register applies to the technical questions, not the social asides. Linda's chitchat moments stayed warm and short; the substantive teaching landed on the qualification questions that followed.

The two soft-countdown flags ("Last couple", "One last thing") are the variant-specific risk to watch — EDUCATIONAL phrasers tend to scope ("we have X questions left, this is the last") more than baseline. Should be tightened in v2 of the EDUCATIONAL spec.

---

## Output flags for caller

- `friendly_chitchat`-label-correct: **yes** (both asides; neither tripped off_topic_question)
- Chitchat-warmth-preserved: **yes** (no lecturing on social asides)
- Chitchat-acknowledgment-quality: **good** (warm, deferred to Key, varied phrasing across the two)
- Bot-engaged-on-neighbor-specifics: **no** (correct — never confirmed/denied)
- EDUCATIONAL-teach-then-ask-applied: **yes, consistently** on technical questions
- EDUCATIONAL-length-target-hit: **yes** (avg 143 chars, all turns 100-170)
- New violations: **0 hard**, **2 soft flags** (countdown-family phrasing on Turns 6 + 7)

---

## Scoring

- **State machine score:** 10/10 (clean path, all transitions correct, both chitchat events handled per spec)
- **Classifier score:** 10/10 (both chitchat asides labeled correctly with extracted_value; aol.com correctly flagged typo_suspected=false)
- **Voice score:** 8/10
  - Strong on substantive acks ("30-amp's the most common", "20ft is right in the sweet spot", teach-why-distance-matters on AWAIT_RUN, teach-why-photo-matters on AWAIT_PANEL_PHOTO)
  - EDUCATIONAL register lands consistently
  - Minor deductions: Turn 2 ack 8 words instead of 4-7 (within reason), 2 soft-countdown flags ("Last couple", "One last thing"), avg length 143 vs target 130 (drifting toward upper edge)
  - Would score ≥9/10 if soft-countdown phrases were eliminated and Turn 2 ack tightened to ≤7 words
- **Chitchat-warmth score:** 9/10
  - Critical test passed: did NOT lecture on chitchat
  - Both acks were warm and non-committing
  - 1-point deduction for Turn 2's 8-word ack (slightly long for a chitchat moment, though the deferral structure reads naturally)

## Reviewer notes

(Empty until human review — Key fills this in)

---

## Output line

[EDUCATIONAL] Persona 16 (linda) — reached COMPLETE in 10 turns. Voice 8/10. Chitchat-warmth 9/10. Avg msg 143chars. Status: PASS.
