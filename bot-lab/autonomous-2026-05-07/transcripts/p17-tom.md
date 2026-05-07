# Persona 17 — Typo Tom (gmial.com)

**Date:** 2026-05-07
**Persona file:** customer-personas.md → Persona 17
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 10
**Status:** PASS

**Test focus:** Tom is a 52-year-old who types fast and doesn't proofread. He
sends multiple obvious typos through the conversation ("thnk", "240 generaor",
"garge"). Most should NOT trigger any classifier confusion — the routing words
are unambiguous. The CRITICAL test is when he sends "tom.h@gmial.com" at
AWAIT_EMAIL: the classifier must set `email_typo_suspected=true` with
`email_likely_meant="tom.h@gmail.com"`, the state machine must route to
CHECK_EMAIL_TYPO, and the phraser must ask politely (not patronizingly) using
the "give them an out" pattern from system-prompt.ts:1158.

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Tom — Backup Power Pro here, saw your form come through. Got a sec for a couple quick questions so Key (our electrician) can put your quote together?

### Turn 1 — customer
yea sure go ahead

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.95
- inferred_customer_style: terse
- volunteered_added: []

### Turn 1 — state machine
GREETING → AWAIT_240V
- sticky_style: terse (Turn 1 init)
- intent: "paired voltage+amperage+photo offer"

### Turn 1 — bot (AWAIT_240V)
Cool. Quick one — does your generator put out 240V (the bigger outlet, like a dryer plug, 30 or 50 amp), or is it just 120V household outlets? Pic of the outlet works too if easier.

### Turn 2 — customer
i thnk i have a 240 generaor, 30 amp

(typos: "thnk" → think, "generaor" → generator. Routing words "240" and "30 amp" are intact.)

### Turn 2 — classifier
- state: AWAIT_240V
- label: outlet_30a
- confidence: 0.92
- extracted_value: "30A"
- inferred_customer_style: terse (sticky reaffirmed)
- volunteered_added: ["outlet_amps=30"]
- notes: typos in "thnk" / "generaor" do NOT confuse classifier — token
  boundaries on "240" and "30 amp" are unambiguous; classifier ignores the
  spelling errors. Treats as outlet_30a (answered both voltage and amperage)
  per the AWAIT_240V transition table — skip AWAIT_OUTLET, go straight to
  AWAIT_PANEL_PHOTO.

### Turn 2 — state machine
AWAIT_240V → AWAIT_PANEL_PHOTO (outlet_30a answers both slots)
- volunteered.outlet_amps=30
- intent: "ack 30 amp + ask for panel photo"

### Turn 2 — bot (AWAIT_PANEL_PHOTO)
Got it, 30 amp. To put the quote together Key will also need a quick pic of your main electrical panel with the door open so he can see the breakers. No rush.

### Turn 3 — customer
ok the panel is in my garge, hold on

(typo: "garge" → garage. No routing impact.)

### Turn 3 — classifier
- state: AWAIT_PANEL_PHOTO
- label: friendly_chitchat
- confidence: 0.78
- chitchat_excerpt: "ok the panel is in my garge, hold on"
- inferred_customer_style: terse (sticky)
- notes: customer signaling they'll send the photo shortly. Classifier
  treats this as conversational filler while waiting — self-loop on
  AWAIT_PANEL_PHOTO. "garge" misspelling does not affect classification;
  classifier is intent-driven, not lexical.

### Turn 3 — state machine
AWAIT_PANEL_PHOTO → AWAIT_PANEL_PHOTO (self-loop, waiting for photo)
- intent: "brief ack + wait silently"

### Turn 3 — bot (AWAIT_PANEL_PHOTO)
No rush, take your time.

### Turn 4 — customer
[sends photo of panel, door open, breakers visible]

### Turn 4 — photo classifier
- subject: panel
- subject_confidence: 0.94
- primary_recommendation: accept
- obvious_issues: []

### Turn 4 — state machine
AWAIT_PANEL_PHOTO → AWAIT_RUN (default-install-offer)
- intent: "default-install-offer: right beside panel, 20ft cord, work for you?"

### Turn 4 — bot (AWAIT_RUN)
Perfect, that works. Default install puts the inlet right beside your panel with about a 20ft cord on your side — work for you, or do you need it somewhere else?

### Turn 5 — customer
yea right beside the panel is fine, prob 10 ft is plenty

### Turn 5 — classifier
- state: AWAIT_RUN
- label: affirmative
- confidence: 0.96
- extracted_value: "default-install accepted; ~10ft"
- inferred_customer_style: terse (sticky)
- volunteered_added: ["run_feet=10"]

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL
- volunteered.run_feet=10
- intent: "thanks + close-info ask: last name + email + address"

### Turn 5 — bot (AWAIT_EMAIL)
Sounds good. To complete the quote could I get your last name, email, and install address?

### Turn 6 — customer
hartley, tom.h@gmial.com, 67 maple street easley sc 29642

### Turn 6 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.97
- extracted_value: "tom.h@gmial.com"
- email_typo_suspected: true
- email_likely_meant: "tom.h@gmail.com"
- extracted_address: "67 Maple Street, Easley SC 29642"
- extracted_last_name: "Hartley"
- inferred_customer_style: terse (sticky)
- notes: domain "gmial.com" matches the typo list in classifier
  system-prompt.ts:346. Flag fires correctly. Address parses cleanly so
  no AWAIT_ADDRESS_CONFIRM detour needed after the typo check resolves.

### Turn 6 — state machine
AWAIT_EMAIL → CHECK_EMAIL_TYPO (email_typo_suspected=true)
- volunteered.email="tom.h@gmial.com" (NOT yet confirmed)
- volunteered.address="67 Maple Street, Easley SC 29642"
- volunteered.last_name="Hartley"
- intent: "confirm email spelling — give them an out, no patronizing"

### Turn 6 — bot (CHECK_EMAIL_TYPO)
Got `tom.h@gmial.com` — just want to make sure that's right or did you mean gmail with an 'a'?

### Turn 7 — customer
oh yeah lol meant gmail

### Turn 7 — classifier
- state: CHECK_EMAIL_TYPO
- label: address_corrected
- confidence: 0.93
- extracted_value: "tom.h@gmail.com"
- inferred_customer_style: terse (sticky)
- notes: classifier treats this as the "they corrected the email" branch
  per state-machine.ts:604 (`address_corrected → RECAP`). The label name is
  a slight misnomer (it covers email corrections too in CHECK_EMAIL_TYPO
  context). Confirmed corrected email overwrites volunteered.email.

### Turn 7 — state machine
CHECK_EMAIL_TYPO → RECAP
- volunteered.email="tom.h@gmail.com" (corrected, locked in)
- intent: "recap all captured slots + confirm ready to schedule quote"

### Turn 7 — bot (RECAP)
Awesome — so I've got a 240V 30-amp generator, panel pic looks good, install right beside the panel for Tom Hartley at 67 Maple St, Easley, with the quote going to tom.h@gmail.com. Look right?

### Turn 8 — customer
yep all good

### Turn 8 — classifier
- state: RECAP
- label: affirmative
- confidence: 0.97
- inferred_customer_style: terse (sticky)

### Turn 8 — state machine
RECAP → SCHEDULE_QUOTE
- intent: "tell them Key will text the quote shortly"

### Turn 8 — bot (SCHEDULE_QUOTE)
Perfect. Key will pull this together and text the quote over shortly. Anything else on your end?

### Turn 9 — customer
nope thanks

### Turn 9 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.98
- inferred_customer_style: terse (sticky)

### Turn 9 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal)

### Turn 9 — bot (COMPLETE)
[no further outbound — flow complete]

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Notes |
|---|---|---|---|
| 0 | GREETING | PASS | template variant |
| 1 | AWAIT_240V | PASS | paired voltage+amp+photo offer |
| 2 | AWAIT_PANEL_PHOTO | PASS | typos "thnk"/"generaor" ignored by classifier |
| 3 | AWAIT_PANEL_PHOTO | PASS | "garge" typo ignored; chitchat self-loop |
| 4 | AWAIT_RUN | PASS | photo accepted by photo-classifier |
| 5 | AWAIT_EMAIL | PASS | terse close-info ask |
| 6 | CHECK_EMAIL_TYPO | PASS | typo correctly flagged; ask is non-patronizing |
| 7 | RECAP | PASS | corrected email locked in |
| 8 | SCHEDULE_QUOTE | PASS | |
| 9 | COMPLETE | PASS | terminal reached |

---

## Auto-flags

- Reached expected terminal (COMPLETE)? YES
- Phraser hard-constraint violations? NONE
- Low-confidence classifier on critical state? NO (lowest was 0.78 on chitchat)
- >15 turns? NO (10 turns)
- State self-loop >2x? NO (AWAIT_PANEL_PHOTO looped once, not stuck)
- email_typo_suspected fired correctly? YES (Turn 6)
- email_likely_meant correct? YES ("tom.h@gmail.com")
- CHECK_EMAIL_TYPO entered? YES
- Bot's typo-confirm message polite + non-patronizing? YES — used the
  exemplar pattern from phraser system-prompt.ts:1158 ("just want to make
  sure that's right or did you mean gmail with an 'a'?")
- Other typos ("thnk", "generaor", "garge") confused classifier? NO — none
  affected routing tokens.

---

## Reviewer notes

(Empty until human review)
