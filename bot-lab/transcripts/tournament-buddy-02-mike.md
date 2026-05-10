# Persona 02 — Mike (Confused 120v Owner) — VARIANT: BUDDY

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 02
**Variant:** BUDDY (slangy / "y'all"-forward register)
**Expected terminal:** DISQUALIFIED_120V
**Actual terminal:** DISQUALIFIED_120V
**Turns:** 4 (0–3)
**Status:** PASS

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Mike — BPP. Got y'alls form on the inlet. Couple quick ones for Key's quote, y'all good?

### Turn 1 — customer
yeah ok

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.9
- extracted_value: null

### Turn 1 — state machine
GREETING → AWAIT_240V (intent: ask whether their generator has a 240-volt outlet vs 120-volt only)

### Turn 1 — bot (AWAIT_240V)
Cool. Does your generator have one of those big 240-volt outlets (like a dryer plug), or just regular 120v ones?

### Turn 2 — customer
uhh i think so. its a small one i use for tailgates

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_unsure
- confidence: 0.75
- extracted_value: null
- (rule 8: "i think so" = mild yes ≠ confident yes → gen_unsure; tailgate-size cue reinforces inverter likelihood)

### Turn 2 — state machine
AWAIT_240V → CLARIFY_240V (intent: ask for photo of outlet on side of generator)

### Turn 2 — bot (CLARIFY_240V)
No worries — easiest way is just snap a quick pic of the outlet on the side of the gen and send it over. We can tell from there.

### Turn 3 — customer
ok hold on... no its just the regular plugs i think. like a normal outlet shape

### Turn 3 — classifier
- state: CLARIFY_240V
- label: gen_120v
- confidence: 0.85
- extracted_value: "regular plugs / normal outlet shape"

### Turn 3 — state machine
CLARIFY_240V → DISQUALIFIED_120V (TERMINAL — intent: politely explain inlet setup needs 240v, suggest they let us know if they upgrade later)

### Turn 3 — bot (DISQUALIFIED_120V)
Ah gotcha — inlet setup needs a 240v gen, so not the right fit here. If you ever upgrade, just holler and we'll get y'all sorted.

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Length | y'all count | Voice notes |
|---|---|---|---|---|---|
| 0 | GREETING | PASS | 92 | 2 | natural opener; name + brand surface; door-open invite |
| 1 | AWAIT_240V | PASS | 113 | 0 | clean question, slangy "Cool" ack, no countdown |
| 2 | CLARIFY_240V | PASS | 127 | 0 | "No worries" matches corpus #7; soft photo ask, no pressure |
| 3 | DISQUALIFIED_120V | PASS | 125 | 1 | **decline-warmth**: "ah gotcha" reads acknowledged-not-dismissed; "not the right fit here" is blameless; "holler... get y'all sorted" leaves door open with Key's actual register |

**Avg msg length:** (92 + 113 + 127 + 125) / 4 = **114 chars**
**Total y'all count across bot turns:** **3** (within BUDDY's 1–3 guideline)
**Hard-constraint regex sweep (price `$\d`, weekday names, "I'm Key", `>280`, "thank you for your interest|I appreciate|rest assured|feel free to"):** 0 hits across all 4 outbound messages.

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **YES** — DISQUALIFIED_120V matches `expected_terminal`.
- Hard-constraint violations: **0**.
- Classifier confidence < 0.6 on a critical state: **No** (lowest was 0.75 on gen_unsure, which is genuinely ambiguous-by-design).
- Conversation > 15 turns: **No** (4 turns).
- Self-loop > 2x: **No** (each state visited exactly once).
- Bot pushed back / got pushy on disqualification: **No** — accepted gen_120v cleanly, did not retry, did not try to upsell or convince.
- Phraser fallback used: **No** (live phraser output used on every turn).

---

## Stress-test focus: BUDDY decline-warmth

**The test:** does the slangy register feel dismissive when the answer is "no, you're disqualified"?

**The decline message:** "Ah gotcha — inlet setup needs a 240v gen, so not the right fit here. If you ever upgrade, just holler and we'll get y'all sorted."

**What works:**
- "Ah gotcha" — acknowledges Mike's answer, doesn't read as "ah dang" (which would feel like the bot pitying him or treating him like a problem). "Gotcha" treats him as adult who just gave a clear answer.
- "Inlet setup needs a 240v gen" — names the *system's* requirement, not Mike's deficiency. Blameless framing.
- "Not the right fit here" — soft, mutual. Not "you don't qualify" or "we can't help you."
- "If you ever upgrade, just holler" — explicit door-open. Future-tense invitation in Key's actual phrasing (corpus #6 "holler if anything pops up", #12 "holler if you ever need anything else").
- "We'll get y'all sorted" — promises action, uses BPP "we", caps the message with positive forward-look.
- Length 125 chars = matches casual register; not corporate boilerplate-long.

**What was avoided:**
- "Ah dang —" (rejected: reads as bot disappointed-on-his-behalf, faintly patronizing).
- "Sorry, we can't help" (rejected: makes Mike the problem).
- "Unfortunately our setup..." (rejected: stiff, not Key voice; "unfortunately" violates BUDDY casual register).
- Any thank-for-interest / appreciate phrasing (rejected: banned regex + corporate vibe).

**Risk surfaced:** had to deliberately tune to avoid "ah dang" reflex. Production phraser must explicitly know that disqualification messages cannot lead with sympathy-noise — the customer needs to hear *the system* doesn't fit, not that the *bot feels bad for them*. Mike (62, polite, doesn't escalate) is the perfect test because he won't push back if the bot fumbles tone — he'll just feel quietly disrespected.

---

## Scoring (filled at run time per scoring rubric)

- **State machine score:** 10/10 — clean path GREETING → AWAIT_240V → CLARIFY_240V → DISQUALIFIED_120V matches the persona's expected_path exactly.
- **Classifier score:** 9/10 — gen_unsure on "i think so" follows rule 8 exactly; gen_120v on "just the regular plugs" is correct; only minor: confidence on gen_120v could arguably be 0.9 (very explicit) but 0.85 is honest given hedging "i think".
- **Voice score:** **8/10**
  - Hits: corpus-faithful "no worries", "holler", "y'all", "gotcha", contractions sprinkled (not every turn), no countdown phrases, no banned corporate words, target length range hit.
  - Watch: turn 0 has "y'alls" + "y'all" in one short message — lands at 2 of the convo's 3 y'all-budget in the opener. A real Key text would more likely sprinkle one per message across the whole conversation. Still inside the 1–3 spec, but could read slightly performative on turn 0 alone.
- **Decline-warmth score:** **9/10**
  - Acknowledged Mike, blamed the system not him, opened the door for future, used Key's actual "holler" reflex. Loses 1 point only because "ah gotcha" trades a hair of warmth for snappiness vs a longer "ah ok — appreciate you checking" — but the longer form risks the banned `appreciate` regex and corporate-phrase territory.

---

## Reviewer notes

(Empty until human review — Key fills this in)
