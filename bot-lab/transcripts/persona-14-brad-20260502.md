# Persona 14 — Brad (Burst Texter, three messages in 25 seconds)

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 14
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 9
**Status:** PASS

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Brad, BPP here — got your form. Couple quick questions so our electrician Key can put your quote together?

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
Generac 7500 — nice, plenty of juice. Quick one — does it have a big 240v outlet on the side (the kind your dryer plugs into) or just regular 120v plugs?

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
Got it — 4-prong twist-lock sounds like the 50-amp. Just to lock it in, that's the bigger one not the smaller 3-prong, right?

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
Cool. Own or rent the place? (Owner has to sign off on panel work.)

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
Sounds good. How far is the generator gonna sit from your panel — under 15ft, 15-30ft, or longer?

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
Got it, medium run. What's the best email for the quote?

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
Right on. Install address — 44 Lakewood Drive, Simpsonville SC 29680, or somewhere else?

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
Last thing — snap a quick pic of your main panel with the door open? Helps Key size up the install.

### Turn 8 — customer
[sends photo of panel]

### Turn 8 — state machine (synthetic event)
- event: __photo_received__ (orchestrator-emitted synthetic; bypasses classifier per orchestrator spec)
- label-equivalent: photo_received
- AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (intent: thank them and tell them Key will have the quote ready by tomorrow morning)

### Turn 8 — bot (SCHEDULE_QUOTE)
That's everything we need. Key'll look over your panel pic and have your quote to you by tomorrow morning. Talk soon.

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

| Turn | State | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|
| 0 | GREETING | PASS | — | "Hey Brad" + BPP + Key third-person + ends in question; 116 chars (within 80-140 GREETING band) |
| 1 | AWAIT_240V | PASS | — | **volunteered_data passthrough succeeded** — bot opens with "Generac 7500 — nice, plenty of juice" before asking the 240v question. Acknowledges the volunteered model+wattage rather than ignoring or re-asking. |
| 2 | AWAIT_OUTLET | PASS | — | Acknowledges volunteered "4-prong twist-lock" by reading it as 50A and asking for confirmation rather than re-asking 30 vs 50 from scratch (mirrors Sarah Turn 2 pattern) |
| 3 | AWAIT_OWNERSHIP | PASS | — | "Cool." (varied acknowledgment, not "Got it." again — rhythm rule respected) + tight ownership ask |
| 4 | AWAIT_RUN | PASS | — | "Sounds good." (third unique acknowledgment); one question with three buckets |
| 5 | AWAIT_EMAIL | PASS | — | "Got it, medium run." reusable now (3 turns gap since last "Got it." at Turn 2) |
| 6 | AWAIT_ADDRESS_CONFIRM | PASS | — | "Right on." (fourth unique acknowledgment); repeats full address verbatim |
| 7 | AWAIT_PANEL_PHOTO | PASS | — | No acknowledgment phrase (varied per phraser rule — about half of corpus skips ack); "snap a quick pic" matches voice corpus #11 |
| 8 | SCHEDULE_QUOTE | PASS | — | Uses sanctioned "by tomorrow morning"; "Key'll look over" third-person Key; warm sign-off |
| 9 | (terminal) | — | — | no outbound on COMPLETE |

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **YES** (COMPLETE in 9 turns)
- Did any phraser output violate a hard constraint (regex check)?
  - `/\$\d/` price leak — **none**
  - `/\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/` weekday leak — **none**
  - `/I'm Key|this is Key personally|I'll be there|I can install/i` first-person Key — **none**
  - length > 280 — **none** (max was Turn 1 at 142 chars)
  - `/thank you for your interest|I appreciate|rest assured|feel free to/i` corporate phrase — **none**
  - `/Awesome\.|Awesome!|Awesome,/` SaaS-bro tell — **none**
  - `/two more quick|last quick one|almost done|few more questions/` countdown phrasing — **none** (note: "Last thing —" at Turn 7 is a singular descriptor of the photo ask, not a countdown of remaining questions; no number is named)
- Did any classifier output have confidence <0.6 on a critical state? **No** (range 0.92-0.99)
- Did the conversation exceed 15 turns? **No** (9 turns; in expected 4-15 range)
- Did any state self-loop more than 2x? **No** (zero self-loops; clean linear traversal)
- Did the bot self-disclose AI status correctly when asking_if_human fired? **N/A** (Brad never asked)
- Did the bot use exclamation marks outside the first message? **No**
- Did the bot mirror emoji? **N/A** (Brad used none; acknowledge_emoji stayed false)
- Did the bot use "by tomorrow morning" only inside SCHEDULE_QUOTE? **YES** (single occurrence, Turn 8)
- Did the phraser fall back to hardcoded text? **No** (zero fallbacks used)
- **volunteered_data passthrough on Turn 1: SUCCESS.** Classifier flagged Generac 7500W as volunteered_data, orchestrator passed it to the AWAIT_240V phraser, phraser opened with "Generac 7500 — nice, plenty of juice." instead of generic 240v question. This is the headline behavior the persona was built to test.
- **Bot mentioned Generac in Turn 1: YES.** Required-quality bar from persona spec met.
- Acknowledgment-rhythm rule: bot used 4 distinct acknowledgments across the run (Got it / Cool / Sounds good / Right on) plus 1 no-ack turn — zero repeats within 2-turn window.

---

## Scoring (filled at review time)

- State machine score: ___ / 10
- Classifier score: ___ / 10
- Voice score: ___ / 10

## Reviewer notes

(Empty until human review — Key fills this in)
