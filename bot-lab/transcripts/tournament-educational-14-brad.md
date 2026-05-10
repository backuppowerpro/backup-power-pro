# Persona 14 — Brad (Burst Texter, Generac 7500W) [EDUCATIONAL variant]

**Date:** 2026-05-02
**Variant:** EDUCATIONAL
**Persona file:** customer-personas.md → Persona 14
**Phraser:** bot-lab/variants/educational/phraser-agent.md
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 9
**Status:** PASS (with FLAG — over-explanation tension surfaced but managed)

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Brad, BPP here. Saw your form for a generator inlet — that's the wall plug we install for backup power. Couple quick questions so Key can put your quote together?

(157 chars)

### Turn 1 — customer (3-message burst, ~8s apart, collapsed by 5s debounce)
yeah it's a generac
like 7500 watts
what do u need to know

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.92
- extracted_value: affirmative
- volunteered_data: "customer also said it's a Generac 7500W"
- off_topic_excerpt: —
- note: classifier received the three messages joined with newlines (production 5-second debounce surfaces the latest but recent_turns context contains all three). "what do u need to know" is the affirmative-toned consent to proceed; the generator make + wattage is volunteered context the next state's phraser should acknowledge.

### Turn 1 — state machine
GREETING → AWAIT_240V (intent: ask whether their generator has a 240-volt outlet or only 120-volt household outlets)
- volunteered_data passed to phraser: "customer also said it's a Generac 7500W"

### Turn 1 — bot (AWAIT_240V)
Generac 7500 — nice, that size usually does whole-home no problem. Two flavors out there: 240v (the dryer-style outlet) or just 120v plugs. Which one's on yours?

(165 chars)

### Turn 2 — customer
yeah 240
4 prong twist lock

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.97
- extracted_value: —
- volunteered_data: "customer also said 4-prong twist-lock (likely 50A)"
- off_topic_excerpt: —

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET (intent: ask if the 240v outlet is 30A or 50A)
- volunteered_data passed to phraser: "customer also said 4-prong twist-lock (likely 50A)"

### Turn 2 — bot (AWAIT_OUTLET)
Got it — 4-prong twist-lock is the 50-amp shape, biggest of the two common ones. Just lockin' it in: that's the bigger one not the smaller 3-prong, right?

(157 chars)

### Turn 3 — customer
yep 50

### Turn 3 — classifier
- state: AWAIT_OUTLET
- label: outlet_50a
- confidence: 0.96
- extracted_value: —
- off_topic_excerpt: —

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP (intent: ask if they own or rent)

### Turn 3 — bot (AWAIT_OWNERSHIP)
Cool. Own or rent the place? Asking because the panel work has to be signed off by the owner before we can pull the permit.

(123 chars)

### Turn 4 — customer
own it

### Turn 4 — classifier
- state: AWAIT_OWNERSHIP
- label: owner
- confidence: 0.98
- extracted_value: —
- off_topic_excerpt: —

### Turn 4 — state machine
AWAIT_OWNERSHIP → AWAIT_RUN (intent: ask roughly how far the generator will sit from the panel)

### Turn 4 — bot (AWAIT_RUN)
Sounds good. Next up — distance from where the generator sits to your main panel. Rough is fine: under 15ft, 15-30ft, or longer? It changes the wire size we bring.

(165 chars)

### Turn 5 — customer
prob 18 ft
maybe 20

### Turn 5 — classifier
- state: AWAIT_RUN
- label: run_medium
- confidence: 0.94
- extracted_value: —
- off_topic_excerpt: —
- note: two-message burst again, both joined; classifier reads 18-20ft → run_medium

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL (intent: ask for the best email)

### Turn 5 — bot (AWAIT_EMAIL)
Got it, medium run — easy. What's the best email for the quote? Key sends the writeup as a PDF so it's easier to read than a text wall.

(135 chars)

### Turn 6 — customer
brad.f@gmail.com

### Turn 6 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.99
- extracted_value: brad.f@gmail.com
- email_typo_suspected: false
- off_topic_excerpt: —

### Turn 6 — state machine
AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM (intent: confirm the install address)
- typo check: clean gmail.com domain, skips CHECK_EMAIL_TYPO

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM)
Right on. Install address from your form is 44 Lakewood Drive, Simpsonville SC 29680 — same spot the inlet's going, or somewhere else?

(135 chars)

### Turn 7 — customer
thats it

### Turn 7 — classifier
- state: AWAIT_ADDRESS_CONFIRM
- label: address_confirmed
- confidence: 0.96
- extracted_value: —
- off_topic_excerpt: —

### Turn 7 — state machine
AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO (intent: ask for a photo of their main electrical panel with the door open)

### Turn 7 — bot (AWAIT_PANEL_PHOTO)
One last ask — snap a pic of your main panel with the door open? Key uses it to spot the brand and breaker layout so the quote's accurate, not a guess.

(154 chars)

### Turn 8 — customer
[sends photo of panel]

### Turn 8 — state machine (synthetic event)
- event: __photo_received__ (orchestrator-emitted synthetic; bypasses classifier per orchestrator spec)
- label-equivalent: photo_received
- AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (intent: thank them and tell them Key will have the quote ready by tomorrow morning)

### Turn 8 — bot (SCHEDULE_QUOTE)
That's everything we need. Key'll look over your panel pic and have your quote to you by tomorrow morning. Talk soon.

(116 chars)

### Turn 9 — customer
sweet thanks

### Turn 9 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.93
- extracted_value: —
- off_topic_excerpt: —

### Turn 9 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal, no further outbound; onEnter signals qualified-lead notification fires)

---

## Per-turn flag log

| Turn | State | Chars | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|---|
| 0 | GREETING | 157 | PASS | — | EDUCATIONAL opener variant #1 — defines "inlet" inline (Brad never asked, but this is the variant's signature move). Within 110-160 char band. |
| 1 | AWAIT_240V | 165 | PASS | — | volunteered_data passthrough WORKS — opens "Generac 7500 — nice, that size usually does whole-home no problem" before teaching the 240v vs 120v distinction. Educational add: "Two flavors out there: 240v (dryer-style outlet) or 120v plugs." Risk: Brad may already know this. Mitigation: framed as quick definition not a lecture. |
| 2 | AWAIT_OUTLET | 157 | PASS | — | Acknowledges volunteered "4-prong twist-lock" by reading it as 50A. Educational add: "biggest of the two common ones" — teaches without re-asking. |
| 3 | AWAIT_OWNERSHIP | 123 | PASS | — | "Cool." varied acknowledgment + WHY ("has to be signed off by owner before we pull permit"). Within band. |
| 4 | AWAIT_RUN | 165 | PASS | — | "Sounds good." third unique ack + WHY ("It changes the wire size we bring") — teaching the reason behind the question. Top of band. |
| 5 | AWAIT_EMAIL | 135 | PASS | — | "Got it, medium run." (3 turns since last "Got it") + brief WHY ("PDF so it's easier to read than a text wall"). Within band. |
| 6 | AWAIT_ADDRESS_CONFIRM | 135 | PASS | — | "Right on." fourth unique ack; repeats full address. Adds clarity: "same spot the inlet's going" disambiguates without lecturing. |
| 7 | AWAIT_PANEL_PHOTO | 154 | PASS | — | "One last ask" (singular descriptor not countdown) + WHY ("Key uses it to spot the brand and breaker layout so the quote's accurate, not a guess"). Within band. |
| 8 | SCHEDULE_QUOTE | 116 | PASS | — | Uses sanctioned "by tomorrow morning"; "Key'll look over" third-person Key; warm sign-off. Notably SHORTER than other educational turns — variant rule allows tight closes. |
| 9 | (terminal) | — | — | — | no outbound on COMPLETE |

**Average outbound message length: 145 chars** (vs. EDUCATIONAL band 100-170 — within spec; vs. Brad's terse-variant 9-turn run at ~92 chars — 53 chars longer per message)

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **YES** (COMPLETE in 9 turns — same turn count as terse variant)
- Did any phraser output violate a hard constraint (regex check)?
  - `/\$\d/` price leak — **none**
  - `/\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/` weekday leak — **none**
  - `/I'm Key|this is Key personally|I'll be there|I can install/i` first-person Key — **none**
  - length > 280 — **none** (max was Turn 1 / Turn 4 at 165 chars)
  - `/thank you for your interest|I appreciate|rest assured|feel free to/i` corporate phrase — **none**
  - `/Awesome\.|Awesome!|Awesome,/` / "Perfect!" / "Great!" / "Excellent." — **none**
  - `/two more quick|last quick one|almost done|few more questions/` countdown phrasing — **none** (Turn 7 "One last ask" is singular descriptor of the photo ask; no number named)
  - Multiple "?" in one message — **none**
  - Exclamation marks outside greeting — **none** (greeting has none either; clean run)
- Did any classifier output have confidence <0.6 on a critical state? **No** (range 0.92-0.99 — same as terse variant; classifier untouched)
- Did the conversation exceed 15 turns? **No** (9 turns; in expected 4-15 range)
- Did any state self-loop more than 2x? **No** (zero self-loops; clean linear traversal)
- Did the bot use "by tomorrow morning" only inside SCHEDULE_QUOTE? **YES** (Turn 8 only)
- Did the phraser fall back to hardcoded text? **No** (zero fallbacks used)
- **volunteered_data passthrough on Turn 1: SUCCESS.** Classifier flagged Generac 7500W; phraser opened with the model + a one-clause comment ("that size usually does whole-home no problem") before the 240v question. This is EDUCATIONAL variant's strength — the explanatory clause adds value to the acknowledgment.
- **Bot mentioned Generac in Turn 1: YES.** Required-quality bar from persona spec met.
- Acknowledgment-rhythm rule: 4 distinct substantive acknowledgments (Got it / Cool / Sounds good / Right on) — zero repeats within 2-turn window. Educational acknowledgments include teach-clauses (e.g. "Got it — 4-prong twist-lock is the 50-amp shape, biggest of the two common ones") rather than bare "Got it."

---

## Variant-specific risk analysis

**Hypothesis under test:** EDUCATIONAL variant adds context to every question; Brad is a burst-texter who already volunteered Generac+7500W and answers in 3-5 word fragments. Risk = bot reads condescending or templated.

**Findings:**

1. **Over-explanation risk — REAL but managed.** Turn 1 ("Two flavors out there: 240v vs 120v") teaches a distinction Brad probably already knows since he had the foresight to send make+wattage. However, the framing ("flavors" + parenthetical) keeps it casual rather than lecturing. **Risk score: 4/10** (low side of medium — would be 7-8/10 with a different first-time-buyer persona where this teaching adds no signal).

2. **Burst-texter rhythm clash — minimal.** Brad's average inbound is 5 chars ("yep 50", "own it", "thats it"). Bot's average outbound is 145 chars — a 29:1 outbound-to-inbound ratio. Terse variant ratio was ~18:1. The asymmetry is more pronounced but doesn't cause Brad to disengage in this run because answers are still always concrete questions, not soliloquies.

3. **Generac-callout quality (Turn 1) — STRONG.** "Generac 7500 — nice, that size usually does whole-home no problem" demonstrates the educational variant's actual value: it earns the longer message by adding a domain-specific observation Brad would notice. A first-time buyer reads this as informed-contractor signal. Brad reads it as "ok this guy knows what he's doing" — the variant's stated goal. **Score: 9/10**.

4. **Voice authenticity vs Key's actual register.** Voice corpus exemplars average 55-95 chars; this transcript averages 145 chars. The teach-clauses ("It changes the wire size we bring", "Key uses it to spot the brand and breaker layout") sound contractor-authentic but add length the corpus doesn't model. **For Brad specifically: voice score 7/10** — reads informed, not condescending, but slightly more verbose than persona prefers.

5. **Where EDUCATIONAL beat TERSE for Brad:** Turn 4 (AWAIT_RUN) — adding "It changes the wire size we bring" is genuinely useful context Brad couldn't have known from the question alone. Turn 7 (AWAIT_PANEL_PHOTO) — "spot the brand and breaker layout so the quote's accurate" gives Brad a reason to comply that the terse variant doesn't.

6. **Where TERSE beat EDUCATIONAL for Brad:** Turn 1 — Brad already volunteered model+wattage, doesn't need 240v-vs-120v defined; terse variant's "Quick one — does it have a big 240v outlet on the side or just regular 120v plugs?" hits the same spot in 95 chars vs educational's 165. Turn 3 (ownership) — Brad doesn't need permit-pull rationale; he answered "own it" in 6 chars.

**Variant verdict for this persona:** EDUCATIONAL is acceptable but not optimal for Brad. Voice score 7/10 reflects that the teach-clauses don't actively hurt but don't earn their length on a customer who already signaled competence. Educational variant should shine on first-time-buyer personas (Mike, Trevor, Tara) where the same teach-clauses add real signal.

---

## Scoring

- State machine score: 10/10 (clean linear traversal, zero retries, zero fallbacks)
- Classifier score: 10/10 (confidence range 0.92-0.99, both burst-texter classifications correct, volunteered_data extracted on Turns 1 + 2)
- Voice score: **7/10** (educational register competent, no constraint violations, but length-to-information ratio penalizes Brad's terse-cooperator style; teach-clauses on Turns 1 + 3 are slightly templated for an experienced customer)
- Generac-callout quality: **9/10** (Turn 1 acknowledgment is the variant's high-water mark — adds contractor-signal observation, doesn't ignore volunteered data)
- Over-explanation risk: **4/10** (lower-is-better; Turn 1 + Turn 3 add length Brad doesn't need, but framing stays casual not lecturing)
- Average message length: **145 chars** (within EDUCATIONAL band 100-170; vs terse-variant 92 chars, +57.6%)

## Reviewer notes

(Empty until human review — Key fills this in)

EDUCATIONAL variant tournament status for Persona 14: PASS with FLAG. Variant survives the experienced-customer torture test (no condescension, no constraint violations, COMPLETE in 9 turns), but the length premium isn't earned on Brad specifically. Predicted A/B: educational wins for Mike/Trevor/Tara; terse wins for Brad/Nate/Patricia. Recommendation: dynamic variant selection by inferred-knowledge signal (volunteered model+wattage on Turn 1 → switch to terse variant for the rest of the run).
