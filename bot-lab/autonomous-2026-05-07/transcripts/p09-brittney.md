# Persona 09 — Brittney (Emoji-Heavy / Twitter-Style Texter)

**Date:** 2026-05-07
**Persona file:** customer-personas.md → Persona 09
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 11
**Status:** PASS-with-FLAG (see Auto-flags — Ashley emitted 1 emoji after acknowledge_emoji=true; passes phraser rule, but contradicts Key's "no emoji" voice principle in CLAUDE memory)

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Brittney, this is Backup Power Pro — saw your form come through. Got a sec for a couple quick questions so our electrician Key can put your quote together?

### Turn 1 — customer
yeahhh go for it 🙌

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.93
- inferred_customer_style: terse
- notes: "yeahhh" lengthens "yeah" for vibe — same affirmative semantics. Emoji 🙌 confirms cooperative tone. No ambiguity.

### Turn 1 — orchestrator state
- sticky_style = terse (Turn 1 init)
- acknowledge_emoji = TRUE (sticky for rest of conversation)
- volunteered: {}

### Turn 1 — state machine
GREETING → AWAIT_240V

### Turn 1 — bot (AWAIT_240V)
Perfect. Quick one — does your generator have a 240v outlet (the big one, looks like a dryer plug) or just regular 120v plugs? If unsure, a pic of the outlet works too.

### Turn 2 — customer
yeahhh i got a generac 7500 🔌

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.78
- extracted_value: "Generac 7500"
- volunteered_data: gen_brand_model="Generac 7500"
- notes: customer didn't literally say "240v", but "Generac 7500" is a known 240v 30A unit; classifier emits gen_240v with extracted brand+model.

### Turn 2 — generator-lookup.js
- matched: true
- brand: Generac, model: GP7500E
- compatibility: compatible_30a (240V/30A NEMA L14-30 outlet)
- → skip outlet question, advance to AWAIT_PANEL_PHOTO; voltage_known=true

### Turn 2 — state machine
AWAIT_240V → AWAIT_PANEL_PHOTO (lookup short-circuit)

### Turn 2 — bot (AWAIT_PANEL_PHOTO)
Generac 7500, nice — that one's a 30 amp 240v, so we're good there. To put together an accurate quote Key will need a quick pic of your main panel with the door open. No rush.

### Turn 3 — customer
panel? in the garage prob 🤔

### Turn 3 — classifier
- state: AWAIT_PANEL_PHOTO
- label: asking_clarifying_technical
- confidence: 0.82
- clarifying_excerpt: "panel? in the garage prob"
- notes: customer is locating the panel, not refusing. Self-loop with brief answer.

### Turn 3 — state machine
AWAIT_PANEL_PHOTO → AWAIT_PANEL_PHOTO (self-loop, asking_clarifying_technical)

### Turn 3 — bot (AWAIT_PANEL_PHOTO)
Yep that's the one — gray metal box with all the breakers. Open the door and snap one pic so the breaker labels are readable. No rush.

### Turn 4 — customer
k can do that 📸

### Turn 4 — classifier
- state: AWAIT_PANEL_PHOTO
- label: affirmative
- confidence: 0.81
- notes: "k" + 📸 = will comply. Self-loop until photo arrives.

### Turn 4 — state machine
AWAIT_PANEL_PHOTO → AWAIT_PANEL_PHOTO (waiting on photo)

### Turn 4 — bot
(no outbound — bot does not double-message after a willing-to-comply ack)

### Turn 5 — customer
[sends photo of panel with door open, breakers visible]

### Turn 5 — photo classifier
- subject: panel_open_clear
- subject_confidence: 0.94
- primary_recommendation: accept
- obvious_issues: []

### Turn 5 — state machine
AWAIT_PANEL_PHOTO → AWAIT_RUN (default-install-offer)

### Turn 5 — bot (AWAIT_RUN)
Perfect, got it. Default install for that 7500 is a 30-amp inlet right beside the panel, 20 ft cord runs to wherever you set the gen. Work for you?

### Turn 6 — customer
yesss 🙏 it'd sit like 8 ft from the panel anyway lol

### Turn 6 — classifier
- state: AWAIT_RUN
- label: affirmative
- confidence: 0.95
- volunteered_data: run_feet=8

### Turn 6 — state machine
AWAIT_RUN → AWAIT_EMAIL

### Turn 6 — bot (AWAIT_EMAIL)
Nice, 8 ft is easy. Last thing — what's your last name + best email for the quote, and is the address on file the right install address?

### Turn 7 — customer
parker, brittneyparker@icloud.com 245 augusta rd is right 🏠

### Turn 7 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.98
- extracted_value: brittneyparker@icloud.com
- email_typo_suspected: false
- volunteered: address_confirmed=true ("245 augusta rd is right")

### Turn 7 — state machine
AWAIT_EMAIL → RECAP (typo not suspected, address captured/confirmed)

### Turn 7 — bot (RECAP)
Got it — Parker, brittneyparker@icloud.com, 245 Augusta Rd Greenville. Generac 7500, 30A 240v inlet right beside the panel, ~8 ft run. Sound right?

### Turn 8 — customer
yep 🙌

### Turn 8 — classifier
- state: RECAP
- label: affirmative
- confidence: 0.96

### Turn 8 — state machine
RECAP → SCHEDULE_QUOTE

### Turn 8 — bot (SCHEDULE_QUOTE)
Awesome. Key will have the quote over to you by tomorrow morning. He'll text you back from this same number 👍

### Turn 9 — customer
sounds good ty 🙏

### Turn 9 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.97

### Turn 9 — state machine
SCHEDULE_QUOTE → COMPLETE

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|
| 0 | GREETING | Pass | — | Standard greeting |
| 1 | AWAIT_240V | Pass | — | Paired voltage+photo offer, terse register |
| 2 | AWAIT_PANEL_PHOTO | Pass | — | generator-lookup short-circuit on Generac 7500; brand-recognition ack lands clean |
| 3 | AWAIT_PANEL_PHOTO | Pass | — | Self-loop on "panel?" answered without lecture |
| 5 | AWAIT_RUN | Pass | — | Default-install offer |
| 6 | AWAIT_EMAIL | Pass | — | Combined close |
| 7 | RECAP | Pass | — | Address+email confirmed in one |
| 8 | SCHEDULE_QUOTE | FLAG | 7 | Bot used 👍 — phraser rule allows ≤1 emoji when acknowledge_emoji=true, but Key's voice principle (CLAUDE.md memory) is "Key doesn't text emoji". Conflict between phraser-agent.md and brand-voice. |

---

## Auto-flags

- Reached expected terminal? YES (COMPLETE)
- Hard-constraint regex violations? None — no $, no weekday names, no "I'm Key", all msgs <280 chars.
- Classifier confidence <0.6 on critical state? No — all critical labels at 0.78+.
- Conversation >15 turns? No (9 active turns + photo).
- Self-loop >2x? No (AWAIT_PANEL_PHOTO looped twice — within budget).
- Self-disclosure on asking_if_human? N/A (Brittney didn't ask).
- Emoji emitted by bot? YES — once at Turn 8 (👍). This passes the phraser hard rule (≤1 emoji when acknowledge_emoji=true) but VIOLATES Key's "no emoji ever" voice instinct per CLAUDE.md memory. Recommend Key resolve: either tighten phraser rule to forbid all emoji, or accept the controlled mirror.
- Did classifier confuse "yeahhh" / "k" with anything else? NO. Both classified correctly as affirmative at high confidence.

---

## Reviewer notes

Key risk surface tested: non-conventional SMS (emoji, lowercase, abbreviations, lengthened vowels).

1. **Classifier handled "yeahhh" cleanly** — treated as affirmative, did not get tripped up by extra letters. Good.
2. **Classifier handled "k" cleanly** — affirmative at 0.81, no confusion with "okay" vs disengagement.
3. **Classifier handled "panel? in the garage prob 🤔"** correctly as asking_clarifying_technical instead of mis-routing to negative or unclear. Emoji didn't pollute the label.
4. **Ashley matched but did not mimic.** Register stayed terse-warm without aping "yeahhh"/"lol"/lowercase-only. Bot said "Generac 7500, nice" not "generac 7500 nice 🙌". Tone parity without style theft. This is the right behavior for a real-Key voice mirror.
5. **One emoji emitted (👍 at Turn 8).** This is the only design-tension finding. Per `phraser-agent.md` rule "≤1 emoji when acknowledge_emoji=true" this passes. Per Key's voice memory ("Key doesn't text emoji per voice rules") this should be zero. Recommendation: lock phraser to never emit emoji, even when mirrored, since real-Key never does. The current rule encourages mimicry that doesn't match the human reference.
6. **Generator-lookup short-circuit fired correctly** on "Generac 7500" — skipped the outlet question, saved a turn, brand-recognition ack landed natural ("Generac 7500, nice — that one's a 30 amp 240v").

## Scoring (filled at review time)

- State machine score: 9 / 10 (clean, no missteps)
- Classifier score: 9 / 10 (handled all non-standard tokens)
- Voice score: 7 / 10 (emoji emission cost 2 points — would be 9 without)
