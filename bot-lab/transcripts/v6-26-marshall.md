# Persona 26 — Marshall ("this feels like a lot just for a quote tbh") [v6 friction-without-refusal]

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 26
**Lab batch:** v6 (disambig rule 13: friction-without-refusal → asking_clarifying_technical, NOT negative)
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 11
**Detected customer_style:** default (held throughout — Marshall texts in standard cooperative casual lowercase, no compression bursts, no confusion-marker, no southern-warmth marker)
**Expected customer_style:** default
**Register applied:** yes (60-130 char target, 50-70% ack rate; brief-answer-then-reask override on Turn 8 friction turn)
**Status:** PASS

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Marshall, BPP here — got your form. Couple quick questions so our electrician Key can put your quote together?

*[length: 117 chars · GREETING dispatch · default register opener (variant 1) · third-person "our electrician Key" · single ?, 80-140 band]*

### Turn 1 — customer
yeah go ahead

### Turn 1 — classifier
```json
{
  "label": "affirmative",
  "confidence": 0.96,
  "inferred_customer_style": "default"
}
```
Reasoning: cooperative brief reply, lowercase casual but punctuated phrasing, no burst, no confusion, no southern warmth marker. Default plurality.

### Turn 1 — state machine
GREETING → AWAIT_240V (intent: ask whether their generator has a 240-volt outlet)

### Turn 1 — bot (AWAIT_240V)
Cool. Does your generator have a big 240-volt outlet (the kind your dryer plugs into), or just regular 120-volt outlets?

*[length: 119 chars · default register · ack "Cool." + clean either/or · prior_acks=[]]*

### Turn 2 — customer
yeah it's 240

### Turn 2 — classifier
```json
{
  "label": "gen_240v",
  "confidence": 0.97,
  "inferred_customer_style": "default"
}
```

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET (intent: ask if 30A or 50A)

### Turn 2 — bot (AWAIT_OUTLET)
Got it. 30-amp (smaller, 3-prong twist) or 50-amp (bigger, 4-prong)?

*[length: 67 chars · default register · ack "Got it." + clean either/or · prior_acks=["Cool."]]*

### Turn 3 — customer
50 amp

### Turn 3 — classifier
```json
{
  "label": "outlet_50a",
  "confidence": 0.98,
  "inferred_customer_style": "default"
}
```

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP (intent: ask if they own or rent)

### Turn 3 — bot (AWAIT_OWNERSHIP)
Perfect. Own or rent the place? (Owner has to sign off on panel work.)

*[length: 70 chars · default register · ack "Perfect." vary · single ?, parenthetical reason · prior_acks=["Cool.", "Got it."]]*

### Turn 4 — customer
own it

### Turn 4 — classifier
```json
{
  "label": "owner",
  "confidence": 0.97,
  "inferred_customer_style": "default"
}
```

### Turn 4 — state machine
AWAIT_OWNERSHIP → AWAIT_RUN (intent: ask roughly how far generator will sit from electrical panel)

### Turn 4 — bot (AWAIT_RUN)
How far is the generator gonna sit from your panel? Under 15ft, 15-30ft, or longer?

*[length: 84 chars · default register · NO ack — rhythm rule applied (vary from prior 3 acks) · prior_acks=["Got it.", "Perfect."]]*

### Turn 5 — customer
about 25 feet

### Turn 5 — classifier
```json
{
  "label": "run_medium",
  "confidence": 0.95,
  "inferred_customer_style": "default"
}
```

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL (intent: ask for the best email to send the quote to)

### Turn 5 — bot (AWAIT_EMAIL)
Sounds good. What's the best email for the quote?

*[length: 49 chars · default register · ack "Sounds good." + clean ask · prior_acks=["Perfect.", null]]*

### Turn 6 — customer
marshall.t@gmail.com

### Turn 6 — classifier
```json
{
  "label": "email_provided",
  "confidence": 0.99,
  "extracted_value": "marshall.t@gmail.com",
  "email_typo_suspected": false,
  "inferred_customer_style": "default"
}
```

### Turn 6 — state machine
AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM (typo not suspected, route direct; intent: confirm install address using slots.address_on_file)

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM)
Got that. Install address — 98 Buckingham Drive, Greer SC 29650, or somewhere else?

*[length: 84 chars · default register · ack "Got that." vary · address echoed verbatim · prior_acks=["Sounds good.", null]]*

### Turn 7 — customer
yep that's right

### Turn 7 — classifier
```json
{
  "label": "address_confirmed",
  "confidence": 0.97,
  "inferred_customer_style": "default"
}
```

### Turn 7 — state machine
AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO (intent: ask for photo of main electrical panel with door open so Key can size up the install)

### Turn 7 — bot (AWAIT_PANEL_PHOTO)
Could you snap a pic of your main panel with the door open? Helps Key size up the install.

*[length: 90 chars · default register · no ack (recently used "Got that.") · matches voice corpus exemplar 11 ("size up the interlock") · prior_acks=["Got that.", "Sounds good."] · constraints clean]*

### Turn 8 — customer
this feels like a lot just for a quote tbh

### Turn 8 — classifier
```json
{
  "label": "asking_clarifying_technical",
  "confidence": 0.91,
  "clarifying_question": "this feels like a lot just for a quote tbh",
  "inferred_customer_style": "default"
}
```
Reasoning: per disambig rule 13 (FRICTION WITHOUT EXPLICIT REFUSAL), phrases like "this feels like a lot" / "do i have to do all this" are FRICTION expressing process-fatigue, NOT refusal — the customer hasn't said "no" or "stop", they're questioning the volume of asks. Route to `asking_clarifying_technical` with `clarifying_question` = the verbatim friction line. Explicitly NOT `negative` (they didn't say no to the question — they're commenting on the process). Explicitly NOT `off_topic_question` (no price/schedule/recommendation ask). Explicitly NOT `photo_refused` (they haven't said they can't or won't send the photo — they're expressing fatigue before complying). Explicitly NOT `unclear` (the friction is clear, the appropriate handling is well-defined). Style still "default" — single questioning turn doesn't promote to educational under hysteresis (would need 2 consecutive high-confidence drifts).

**friction-routed-to-clarifying-not-negative: yes** ✓

### Turn 8 — state machine
AWAIT_PANEL_PHOTO → AWAIT_PANEL_PHOTO (self-loop on asking_clarifying_technical; intent: "answer technical question briefly + re-ask the panel photo" — phraser receives clarifying_question="this feels like a lot just for a quote tbh")

Bot did NOT route to NEEDS_CALLBACK ✓
Bot did NOT route to POSTPONED (would have happened if mis-classified as `negative`) ✓

### Turn 8 — bot (AWAIT_PANEL_PHOTO)
Totally fair — only takes one quick pic of the panel to get the quote right without a site visit. That's the last thing on our end.

*[length: 130 chars · default register · brief-answer-then-reask intent (special-handler override) · process-blame: "without a site visit" frames the asks as substituting for a truck roll, not bureaucracy · brief reassurance ("Totally fair") that names the friction without arguing with it · re-ask of the panel photo embedded ("only takes one quick pic of the panel") · NO lecture about why panels matter electrically · NO guilt-trip ("we really need this") · NO countdown phrasing exception ("That's the last thing on our end" describes scope-of-remaining-asks, not "one more question" — sanctioned in reassure_impatient style here since the customer expressed process-fatigue) · NO marketing fluff, NO "great question" · prior_acks=["Got that.", null] · constraints clean]*

**Reassurance-quality assessment:** 8.5/10
- Process-blame correctly applied: "without a site visit" frames the asks as substituting for an in-person visit, which is true and reframes the friction productively.
- Brief reassurance ("Totally fair") acknowledges the customer's fatigue without dismissing it or apologizing excessively.
- Closure framing ("That's the last thing on our end") gives Marshall a finish-line — addresses the "this feels like a lot" specifically by making it small.
- Did NOT lecture about photos / electrical / why this matters technically.
- Did NOT guilt-trip ("we really need this", "without it we can't", "I'm sorry but").
- Did NOT defend the process aggressively ("we ask everyone these questions", "this is standard").
- Half-point off because the line is at 130 chars — comfortable in default-register band but a slightly tighter version (~100 chars) would feel even more like a contractor and less like a help-desk reply.

**Bot-guilt-tripped: no** ✓

### Turn 9 — customer
alright fine

### Turn 9 — classifier
```json
{
  "label": "unclear",
  "confidence": 0.55,
  "inferred_customer_style": "default"
}
```
Reasoning: "alright fine" is a soft acknowledgment / hold token — Marshall is acquiescing and signaling he'll send the photo, but no actual MMS yet. Per state-specific rules for AWAIT_PANEL_PHOTO, "unclear" self-loops (waits for photo). Confidence 0.55 honest — borderline affirmative but the photo MMS is what advances state, not a verbal "fine". Per disambig rule 9, single-character / hold acknowledgments on photo states stay unclear with low confidence. Tone is mildly resigned but cooperative — not negative, not stop, not asking_for_human.

### Turn 9 — state machine
AWAIT_PANEL_PHOTO → AWAIT_PANEL_PHOTO (self-loop on unclear; bot does NOT re-prompt aggressively)

Per orchestrator rules, low-confidence on a wait state should not trigger a duplicate ask. Bot stays silent and waits for photo MMS. No outbound this turn.

### Turn 9 — bot
*[no outbound — soft-hold; classifier signaled customer is acquiescing and gathering the photo. Per AWAIT_PANEL_PHOTO unclear self-loop semantics, the bot does not re-prompt during a momentary "alright fine" pause; it waits for the actual MMS. This avoids pestering and respects that Marshall just expressed process-fatigue — re-asking now would re-prove his complaint. If 24h elapses with no photo, the standard reminder fires.]*

### Turn 10 — customer
[sends photo of main panel with door open, all breakers visible, well-lit]

*[orchestrator emits photo and routes to photo classifier]*

### Turn 10 — photo classifier
```json
{
  "subject": "panel_open_clear",
  "subject_confidence": 0.96,
  "obvious_issues": [],
  "amperage_visible": null,
  "panel_brand_visible": null,
  "primary_recommendation": "accept"
}
```

### Turn 10 — state machine
AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (photo_received emitted from photo classifier "accept" recommendation; intent: thank them, Key will have quote by tomorrow morning)
onEnter: { complete: true }

### Turn 10 — bot (SCHEDULE_QUOTE)
Got the photo — thanks Marshall. Key will look it over and have your quote ready by tomorrow morning. Talk soon.

*[length: 110 chars · default register · ack "Got the photo — thanks" · "by tomorrow morning" sanctioned in SCHEDULE_QUOTE intent · third-person Key for the actual quote (professional judgment) · prior_acks=["Got that.", null] · constraints clean]*

### Turn 11 — customer
sounds good thanks

### Turn 11 — classifier
```json
{
  "label": "affirmative",
  "confidence": 0.96,
  "inferred_customer_style": "default"
}
```

### Turn 11 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal)

### Turn 11 — bot
*[no further outbound — COMPLETE is terminal; Key's notification fires per onEnter:{complete:true}]*

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Length (chars) | Voice 1-10 | Notes |
|---|---|---|---|---|---|
| 0 | GREETING | yes | 117 | 9 | default greeting opener (variant 1), 80-140 band |
| 1 | AWAIT_240V | yes | 119 | 9 | "Cool." ack + clean either/or |
| 2 | AWAIT_OUTLET | yes | 67 | 9 | "Got it." + 30/50 amp clean either/or |
| 3 | AWAIT_OWNERSHIP | yes | 70 | 9 | "Perfect." vary, single ?, parenthetical reason |
| 4 | AWAIT_RUN | yes | 84 | 9 | NO ack — rhythm rule applied (varied from prior 3) |
| 5 | AWAIT_EMAIL | yes | 49 | 9 | "Sounds good." short clean ask |
| 6 | AWAIT_ADDRESS_CONFIRM | yes | 84 | 9 | "Got that." vary; address echoed verbatim |
| 7 | AWAIT_PANEL_PHOTO | yes | 90 | 9 | clean photo ask, voice-corpus exemplar pattern |
| 8 | AWAIT_PANEL_PHOTO (self-loop, friction) | yes | 130 | 8.5 | **friction-routed-to-clarifying-not-negative: yes.** Brief reassurance ("Totally fair") + process-blame ("without a site visit") + re-ask + closure ("last thing"). NO lecture, NO guilt-trip. |
| 9 | AWAIT_PANEL_PHOTO (self-loop, hold) | n/a (no outbound) | — | — | soft-hold; bot did not pester after Marshall's "alright fine" |
| 10 | SCHEDULE_QUOTE | yes | 110 | 9 | "by tomorrow morning" sanctioned exception fires correctly; third-person Key |

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **yes** (COMPLETE)
- Did any phraser output violate a hard constraint at first emission? **no**
- Did any classifier output have confidence <0.6? **yes, Turn 9 ("alright fine") at 0.55** — honest low-confidence on a hold token; state machine handled correctly via unclear self-loop
- Did the conversation exceed 15 turns? **no** (11 turns)
- Did any state self-loop more than 2x? **no** (AWAIT_PANEL_PHOTO self-looped 2x: once for asking_clarifying_technical friction, once for unclear-hold; both legitimate)
- Did the bot self-disclose AI status correctly when asking_if_human fired? **n/a — never fired**
- Did the bot disclose price or weekday? **no**
- Did "Awesome" appear? **no**
- Did countdown phrasing land in any final output? **"That's the last thing on our end"** appears on Turn 8 — sanctioned per phraser spec because it's a reassure-impatient-style override during the friction-handling intent (the customer expressed process-fatigue, which is the canonical use case for this exception). It accurately describes scope-of-remaining-asks, not arbitrary message-counting.
- Did emoji appear? **no** (acknowledge_emoji=false throughout)
- Did the bot mis-route friction to NEEDS_CALLBACK? **no** ✓
- Did the bot mis-route friction to POSTPONED? **no** ✓ (would have happened if classified as `negative`)

## v6 specific flags — friction-without-refusal (disambig rule 13)

- **friction-routed-to-clarifying-not-negative:** **yes** ✓
  - Classifier on Turn 8 emitted `asking_clarifying_technical` (NOT `negative`, NOT `off_topic_question`, NOT `photo_refused`, NOT `unclear`).
  - clarifying_question field set verbatim: "this feels like a lot just for a quote tbh"
  - Confidence 0.91 — appropriate; matches the canonical disambig rule 13 example pattern listed in the classifier prompt ("this feels like a lot", "lot of questions just for a quote").
  - The risk this test guards against: if mis-classified as `negative`, AWAIT_PANEL_PHOTO has no `negative` transition listed, so it would fall through the default and route to NEEDS_CALLBACK — Marshall's lead would be handed off to Key as a "callback" instead of completing. Or if mis-classified as `photo_refused`, the bot would advance to SCHEDULE_QUOTE without the panel photo (per state machine: `photo_refused → SCHEDULE_QUOTE`), which would mean Key gets the quote-request without the panel pic he needs. Both routes lose the actual goal: Marshall sends a quick reassurance and then ships the photo. Disambig rule 13 captures this third path correctly.

- **Reassurance-quality:** **8.5/10**
  - Phraser used the brief-answer-then-reask special-intent override pattern.
  - Process-blame applied correctly: "without a site visit" reframes the asks as substituting for a truck roll, which is the honest reason BPP needs the photo (Key isn't there in person yet).
  - Brief reassurance leads ("Totally fair") names the customer's friction without arguing or apologizing excessively.
  - Closure framing ("That's the last thing on our end") gives Marshall a finish-line and directly addresses "this feels like a lot" by making the remaining scope concrete.
  - Did NOT lecture about photos / electrical / why panels matter technically.
  - Did NOT guilt-trip ("we really need this", "I'm sorry but", "without it we can't").
  - Did NOT defend the process aggressively ("we ask everyone these questions", "this is standard").
  - Half-point off because 130 chars is at the upper edge of default-register band; a tighter ~100-char version would feel even more like a contractor and less like a help-desk reply. Acceptable as-is.

- **Bot-guilt-tripped: no** ✓
  - No "I'm sorry but", no "we really need", no "without it we can't help", no "this is standard for everyone", no "the system requires it", no martyr-tone language. Reassurance was warm-and-brief, not defensive.

- **Voice score:** **9/10**
  - Plainspoken Southern small-business contractor register held throughout.
  - "Helps Key…" pattern echoed correctly when used (Turn 7).
  - Third-person Key reference correct on professional-judgment moments (Turn 0 "our electrician Key", Turn 7 "Helps Key size up the install", Turn 10 "Key will look it over").
  - No corporate phrases, no SaaS-bro tells, no "Awesome", no "I appreciate", no "feel free to".
  - Friction-handling line on Turn 8 sounds like a contractor reframing an objection, not a customer-service script.

## Register-switching audit (v6 / hysteresis)

- **Turn 1 classifier emitted inferred_customer_style?** yes → "default"
- **Sticky persistence across turns?** yes, stayed "default" all 11 turns. No drift candidate ever emitted.
- **Turn 8 (friction turn) — did the friction flip register to educational?** No. Marshall's friction was direct and concise ("this feels like a lot just for a quote tbh"), not framed as confusion or definitional confusion. Classifier correctly held "default" rather than inferring "educational." The `tbh` shortcode and lowercase suggest casual default register, not the slow careful style of an educational customer. Hysteresis would have required 2 consecutive high-confidence drifts anyway. Correct call.
- **Phraser applied default-register defaults?**
  - Length target 60-130 chars: 9 of 10 outbound turns inside band (Turn 0 = 117, Turn 1 = 119, Turn 2 = 67, Turn 3 = 70, Turn 4 = 84, Turn 5 = 49, Turn 6 = 84, Turn 7 = 90, Turn 8 = 130, Turn 10 = 110). Turn 5 at 49 chars is below band but acceptable for a short ask token; Turn 8 at 130 is at the band ceiling but still within.
  - **Average msg length: 92.0 chars** (hits default-register aim of ~90)
  - Ack rate: 7 of 10 outbound turns acknowledged (Turn 4, Turn 7, Turn 8 special-handled with "Totally fair" which counts as a friction-ack but not a generic ack) = **70%** — top of the 50-70% target band.
  - Acknowledgment phrases used (no repeats): Cool. / Got it. / Perfect. / [skip] / Sounds good. / Got that. / [skip] / [special: Totally fair friction-ack] / Got the photo, thanks → **6 unique acks across 10 outbound turns; rhythm rule never violated.**
- **No corporate phrases?** confirmed (grepped for "appreciate|rest assured|feel free|happy to help|circle back" → 0)
- **Voice corpus alignment?** matches voice corpus on lowercase casual, contractions ("Key will", "y'all" not used since not in customer's voice, "snap a pic", "size up the install"), no first-person Key impersonation, third-person "Key will…" form, "Got the photo" exemplar pattern echoed from corpus exemplar 11 ("Got the photo, that's a Cutler-Hammer panel…").

---

## Scoring

- State machine score: **10 / 10** (clean linear path; AWAIT_PANEL_PHOTO self-loop handled correctly for friction; advanced on photo MMS as expected via photo classifier "accept")
- Classifier score: **10 / 10** (correctly emitted `asking_clarifying_technical` on the friction turn per new disambig rule 13; correctly avoided the three mis-routing traps `negative` / `off_topic_question` / `photo_refused`; honest low-confidence on the hold token; style inference held default through the test)
- Voice score: **9 / 10** (clean register, friction-reassurance landed without lecture or guilt-trip, process-blame applied correctly; minor half-point off on the friction reply length being at band ceiling)

## Reviewer notes

(Empty — Key fills this in)

---

## v6 batch summary line

[v6] Persona 26 (marshall) — reached COMPLETE in 11 turns. friction-routed-to-clarifying-not-negative: yes. Reassurance-quality 8.5. Bot-guilt-tripped: no. Voice 9/10. Status: PASS.
