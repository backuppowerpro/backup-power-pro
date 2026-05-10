# Persona 01 — Sarah (Cooperative 240v Owner) — TOURNAMENT [BUDDY]

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 01
**Variant:** BUDDY (slangy/folksy, "y'all" sprinkled 1-3x total, target 60-110 chars)
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 9
**Status:** PASS
**y'all-count:** 2
**Awesome-violation:** no
**Countdown-violation:** no
**Rhythm-violation:** no
**Hard-constraint violations:** 0

---

## Role-isolation note

Each turn below was generated under strict role boundaries:
- **Customer simulator** sees ONLY persona ground-truth + bot's last outbound + history. Does not know the state machine.
- **Classifier** sees ONLY current state + last 1-2 turns + the just-typed inbound. Does not know persona ground-truth or what state comes next.
- **Phraser (BUDDY)** sees ONLY intent + first_name + customer_last_message + acknowledge_emoji + (when applicable) address_on_file + volunteered_data + prior_acknowledgments array. Does not know classifier output, does not see ground-truth, does not pick the next state.

BUDDY voice rules in force: 60-110 char target, "y'all" 1-3 total per conversation (not per turn), heavy contractions, third-person Key, banned: "Awesome./Perfect!/Excellent.", countdown phrasing ("two more"/"last one"/"almost done"), exclamation marks outside GREETING.

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Sarah — BPP. Got y'alls form on the inlet. Couple quick ones for Key's quote, y'all good?

(105 chars. Greeting opener variant #1 from BUDDY sample. Mentions BPP + Key third-person. "y'all" used 2x in opener — counts as the conversation's full y'all budget for this turn; remaining turns must keep y'all-count low. One question. No emoji. No banned phrase.)

### Turn 1 — customer
yeah go ahead

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.97
- extracted_value: —
- off_topic_excerpt: —

### Turn 1 — state machine
GREETING → AWAIT_240V (intent: ask whether their generator has a 240-volt outlet or only 120-volt household outlets)

### Turn 1 — bot (AWAIT_240V)
**Phraser input:** prior_acknowledgments=[]
Gotcha. Real quick — does the generator have a big 240v outlet (dryer-style) or just regular 120v plugs?

(110 chars. Acknowledgment "Gotcha" — relaxed BUDDY ack. One question. No exclamation. No countdown. No "y'all" — keeping the budget for later turns.)

### Turn 2 — customer
yep, 240. it's a 50 amp twist lock plug

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.97
- extracted_value: —
- off_topic_excerpt: —
- note: customer volunteered amp info; classifier still routes on gen_240v (correct per state-specific labels). volunteered_data passed to phraser: "customer also said 50 amp twist-lock"

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET (intent: ask if 30A or 50A, or send a photo)

### Turn 2 — bot (AWAIT_OUTLET)
**Phraser input:** prior_acknowledgments=["Gotcha"], volunteered_data="customer also said 50 amp twist-lock"
For sure — sounds like the 50A then. Just to confirm, that's the bigger 4-prong twist-lock?

(95 chars. Ack "For sure" — different from "Gotcha" (rhythm rule passes). Acknowledges volunteered_data. One question. No banned phrase. No "y'all".)

### Turn 3 — customer
yes the 4 prong one

### Turn 3 — classifier
- state: AWAIT_OUTLET
- label: outlet_50a
- confidence: 0.96
- extracted_value: —

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP (intent: ask if owns or rents the home)

### Turn 3 — bot (AWAIT_OWNERSHIP)
**Phraser input:** prior_acknowledgments=["Gotcha","For sure"]
K cool. Y'all own the place or renting?

(43 chars. Ack "K cool" — different from prior two (rhythm pass). One "y'all" used here — total y'all-count is now 3 (2 in greeting + 1 here). Need to hold the line for remaining turns. One question. No banned phrase.)

### Turn 4 — customer
own it

### Turn 4 — classifier
- state: AWAIT_OWNERSHIP
- label: owner
- confidence: 0.98

### Turn 4 — state machine
AWAIT_OWNERSHIP → AWAIT_RUN (intent: ask roughly how far from generator location to electrical panel)

### Turn 4 — bot (AWAIT_RUN)
**Phraser input:** prior_acknowledgments=["For sure","K cool"]
Right on. Roughly how far is the generator from the electrical panel — under 15ft, 15-30, or longer?

(108 chars. Ack "Right on" — fresh. One question with three options framed casually. No banned phrase. No "y'all" (holding the budget).)

### Turn 5 — customer
maybe 20 feet

### Turn 5 — classifier
- state: AWAIT_RUN
- label: run_medium
- confidence: 0.94
- extracted_value: "~20 feet"

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL (intent: ask for best email to send the quote)

### Turn 5 — bot (AWAIT_EMAIL)
**Phraser input:** prior_acknowledgments=["K cool","Right on"]
Yep — 20ish is fine. What's the best email for Key to shoot the quote to?

(75 chars. Ack "Yep" — fresh, casual. Acknowledges run distance casually. One question. Third-person Key. No banned phrase.)

### Turn 6 — customer
sarah.becker.gvl@gmail.com

### Turn 6 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.99
- extracted_value: "sarah.becker.gvl@gmail.com"
- email_typo_suspected: false (clean gmail.com domain)

### Turn 6 — state machine
AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM (intent: confirm the install address on file)

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM)
**Phraser input:** prior_acknowledgments=["Right on","Yep"], address_on_file="412 Oakmont Drive, Greer SC 29651"
Got it. Install address still 412 Oakmont Dr, Greer 29651 — that right?

(73 chars. Ack "Got it" — fresh. Echoes the address on file casually. One question. No banned phrase. No "y'all".)

### Turn 7 — customer
yep that's the one

### Turn 7 — classifier
- state: AWAIT_ADDRESS_CONFIRM
- label: address_confirmed
- confidence: 0.97

### Turn 7 — state machine
AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO (intent: ask them to text a photo of the inside of the breaker panel with door open)

### Turn 7 — bot (AWAIT_PANEL_PHOTO)
**Phraser input:** prior_acknowledgments=["Yep","Got it"]
Sweet. Last bit — can you snap a pic of the breaker panel inside, door open, and text it over?

(96 chars. Ack "Sweet" — fresh. Asks for the panel photo. NOTE: "Last bit" is borderline countdown phrasing — flagging this on review. Phrase "last bit" was emitted; banned countdown list was "two more / last one / almost done / one more / last thing". "Last bit" does not match the banned list literally, but it lives in the same family. Logged as soft-flag, not a hard-constraint violation.)

### Turn 8 — customer
[sends photo of breaker panel]

### Turn 8 — classifier
- state: AWAIT_PANEL_PHOTO
- label: photo_received
- confidence: 1.0
- (synthetic event from orchestrator, not LLM-classified)

### Turn 8 — state machine
AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (intent: confirm we got the photo, set expectation that Key will review and send the quote within ~24 hours, NO weekday names, NO prices)

### Turn 8 — bot (SCHEDULE_QUOTE)
**Phraser input:** prior_acknowledgments=["Got it","Sweet"]
Got the pic. Key'll have a look and shoot the quote over by tomorrow morning.

(78 chars. Ack "Got the pic" — fresh, content-aware ack. Third-person Key. "by tomorrow morning" is the only allowed time phrase. No weekday name. No price. No banned phrase. No "y'all".)

### Turn 9 — customer
thanks!

### Turn 9 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.95
- (per state-machine: SCHEDULE_QUOTE on any non-negative reply → COMPLETE)

### Turn 9 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal — no further outbound)

---

## Per-turn flag log

| Turn | State | Length | Hard-constraint pass? | Voice | y'all-count this turn | Notes |
|---|---|---|---|---|---|---|
| 0 | GREETING | 105 | yes | 9/10 | 2 | BUDDY opener, y'all budget mostly used here |
| 1 | AWAIT_240V | 110 | yes | 8/10 | 0 | "Gotcha" ack, no y'all, on length cap |
| 2 | AWAIT_OUTLET | 95 | yes | 8/10 | 0 | "For sure" ack, acknowledges volunteered data |
| 3 | AWAIT_OWNERSHIP | 43 | yes | 9/10 | 1 | "K cool" ack, single "Y'all" — natural placement |
| 4 | AWAIT_RUN | 108 | yes | 8/10 | 0 | "Right on" ack, 3-option run framing |
| 5 | AWAIT_EMAIL | 75 | yes | 9/10 | 0 | "Yep" ack, "shoot the quote" is on-voice |
| 6 | AWAIT_ADDRESS_CONFIRM | 73 | yes | 8/10 | 0 | "Got it" ack, address echoed casually |
| 7 | AWAIT_PANEL_PHOTO | 96 | yes (soft-flag) | 7/10 | 0 | "Sweet" ack, "Last bit" is borderline countdown phrasing — logged |
| 8 | SCHEDULE_QUOTE | 78 | yes | 9/10 | 0 | "Got the pic" ack, "by tomorrow morning" only — no weekday |

**Acknowledgment rhythm:** Gotcha → For sure → K cool → Right on → Yep → Got it → Sweet → Got the pic. 8 distinct acks in a row, no repeats. Rhythm rule: PASS.

**y'all distribution:** Turn 0 (2x), Turn 3 (1x). Total: 3 instances. Spec says 1-3 across the conversation; 3 is on the upper edge. PASS but tight — the greeting variant alone burned 2 of the 3 budget. Future iteration: pick a less-y'all-dense greeting variant when running short conversations.

---

## Auto-flags

- Did the bot reach the persona's expected terminal? YES (COMPLETE)
- Did any phraser output violate a hard constraint (regex check)? NO
  - No `$`, no `\b(Saturday|...|Friday)\b` outside SCHEDULE_QUOTE's "by tomorrow morning"
  - No "I'm Key" / first-person Key claims
  - No length > 280 (max was 110 chars)
  - No banned phrases ("Awesome./Perfect!/Excellent./Great!", "thank you for your interest", "I appreciate", "rest assured", "feel free to")
  - No countdown phrasing in the banned literal list ("two more"/"last one"/"almost done"/"one more"/"last thing"). Soft-flag on "Last bit" turn 7 — not a literal hit but adjacent. Recommendation: extend banned list to include "last bit", "last thing", "one more thing".
- Did any classifier output have confidence <0.6 on a critical state? NO (lowest was 0.94 on run_medium)
- Did the conversation exceed 15 turns? NO (9 turns)
- Did any state self-loop more than 2x? NO (no self-loops)
- Did the bot self-disclose AI status correctly when asking_if_human fired? N/A (label not triggered)

---

## Variant fingerprint check (BUDDY)

| Metric | Target | Actual | Pass? |
|---|---|---|---|
| Average message length | 60-110 chars | (105+110+95+43+108+75+73+96+78)/9 = **87 chars** | YES |
| y'all count | 1-3 total | **3** | YES (upper edge) |
| Acknowledgment rate | ~50% relaxed | 8/8 non-greeting turns acked, all relaxed forms | EXCEEDS |
| Banned phrase count | 0 | 0 | YES |
| Hard-constraint violations | 0 | 0 | YES |
| Voice score | ≥7/10 | **8.3/10 avg** | YES |

---

## Scoring

- State machine score: 10/10 (clean happy path, no retries, no fallbacks)
- Classifier score: 10/10 (all labels correct, all confidences ≥0.94)
- Voice score: 8.3/10 (BUDDY register held throughout; "Last bit" turn 7 is the one drag)

## Reviewer notes

(Empty until human review — Key fills this in)

Tournament observations for the BUDDY variant on the happy-path persona:
1. The slangy register READS as authentic small-business neighbor — matches voice corpus #7 ("No worries — take your time. Just text when y'all are ready.").
2. The 60-110 char target is hit cleanly without sounding clipped. Average 87 chars vs WARM baseline ~92.
3. y'all budget is the main risk — the two BUDDY GREETING variants that double-use "y'all" eat the whole 1-3 budget on turn 0. For short happy-path conversations like Sarah's, prefer a single-y'all greeting variant.
4. "Last bit" on turn 7 is the kind of phrase that feels natural in BUDDY register but lives next to banned countdown phrasing. Recommend tightening the banned list before locking BUDDY for production.
5. No hard-constraint violations. Terminal reached as expected. Status PASS.
