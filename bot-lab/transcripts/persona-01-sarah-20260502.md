# Persona 01 — Sarah (Cooperative 240v Owner)

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 01
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 9
**Status:** PASS

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Sarah, this is Backup Power Pro reaching out about your generator inlet form. Got a couple quick questions so our electrician Key can put your quote together — good time to run through 'em?

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
Perfect. Quick one — does your generator have a big 240-volt outlet (the kind your clothes dryer plugs into), or just regular 120-volt household outlets?

### Turn 2 — customer
yep, 240. it's a 50 amp twist lock plug

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.97
- extracted_value: —
- off_topic_excerpt: —
- note: customer volunteered amp info; state-specific label is still gen_240v on this state

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET (intent: ask if 30A or 50A, or send a photo)

### Turn 2 — bot (AWAIT_OUTLET)
Got it — sounds like 50-amp from what you said. Just to lock it in, that's the bigger 4-prong twist-lock right, not the smaller 3-prong?

### Turn 3 — customer
yes the 4 prong one

### Turn 3 — classifier
- state: AWAIT_OUTLET
- label: outlet_50a
- confidence: 0.95
- extracted_value: —
- off_topic_excerpt: —

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP (intent: ask if they own the home or rent)

### Turn 3 — bot (AWAIT_OWNERSHIP)
Perfect, 50-amp it is. Two more quick things — do y'all own the home or rent? (Owner has to sign off on panel work.)

### Turn 4 — customer
we own it

### Turn 4 — classifier
- state: AWAIT_OWNERSHIP
- label: owner
- confidence: 0.98
- extracted_value: —
- off_topic_excerpt: —

### Turn 4 — state machine
AWAIT_OWNERSHIP → AWAIT_RUN (intent: ask roughly how far the generator will sit from the panel)

### Turn 4 — bot (AWAIT_RUN)
Good deal. Last quick one — roughly how far is the generator gonna sit from your electrical panel? Short (under 15ft), medium (15-30ft), or longer than that?

### Turn 5 — customer
probably about 20-25 feet

### Turn 5 — classifier
- state: AWAIT_RUN
- label: run_medium
- confidence: 0.93
- extracted_value: —
- off_topic_excerpt: —

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL (intent: ask for the best email to send the quote to)

### Turn 5 — bot (AWAIT_EMAIL)
Got it, medium run. What's the best email to send your quote to?

### Turn 6 — customer
sarah.becker.gvl@gmail.com

### Turn 6 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.99
- extracted_value: sarah.becker.gvl@gmail.com
- off_topic_excerpt: —

### Turn 6 — state machine
AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM (intent: confirm the install address)

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM)
Perfect. Install address — is it 412 Oakmont Drive, Greer SC 29651, or somewhere else?

### Turn 7 — customer
yep that's the one

### Turn 7 — classifier
- state: AWAIT_ADDRESS_CONFIRM
- label: address_confirmed
- confidence: 0.97
- extracted_value: —
- off_topic_excerpt: —

### Turn 7 — state machine
AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO (intent: ask for a photo of their main electrical panel with the door open)

### Turn 7 — bot (AWAIT_PANEL_PHOTO)
Awesome. Last thing — could you snap a pic of your main electrical panel with the door open and send it over? Helps Key size up the install.

### Turn 8 — customer
[sends photo of panel]

### Turn 8 — state machine (synthetic event)
- event: __photo_received__ (orchestrator-emitted synthetic; bypasses classifier per orchestrator spec)
- label-equivalent: photo_received
- AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (intent: thank them and tell them Key will have the quote ready by tomorrow morning)

### Turn 8 — bot (SCHEDULE_QUOTE)
Perfect, that's everything we need. Key'll look over your panel pic and have your quote to you by tomorrow morning. Talk soon.

### Turn 9 — customer
thanks!

### Turn 9 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.92
- extracted_value: —
- off_topic_excerpt: —

### Turn 9 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal, no further outbound; onEnter signals qualified-lead notification fires)

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|
| 0 | GREETING | PASS | — | first-message exclamation allowed but not used; opens with "Hey Sarah" + BPP + Key third-person + question |
| 1 | AWAIT_240V | PASS | — | acknowledges with "Perfect."; one question; explains 240 vs 120 plainly |
| 2 | AWAIT_OUTLET | PASS | — | acknowledges customer's volunteered info ("50-amp from what you said"); confirms 4-prong vs 3-prong without re-asking from scratch |
| 3 | AWAIT_OWNERSHIP | PASS | — | "Perfect, 50-amp it is." + pivot; uses "y'all" (matches voice corpus #7) |
| 4 | AWAIT_RUN | PASS | — | "Good deal." acknowledgment; one question with the three buckets |
| 5 | AWAIT_EMAIL | PASS | — | terse, one ask, lowercase casual ("Got it, medium run.") |
| 6 | AWAIT_ADDRESS_CONFIRM | PASS | — | repeats full address back per phraser test case 8 criterion |
| 7 | AWAIT_PANEL_PHOTO | PASS | — | "snap a pic" matches voice corpus #11; "Helps Key size up" third-person Key |
| 8 | SCHEDULE_QUOTE | PASS | — | uses sanctioned "by tomorrow morning" phrase only; "Key'll look over" third-person; warm sign-off "Talk soon." |
| 9 | (terminal) | — | — | no outbound on COMPLETE |

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **YES** (COMPLETE in 9 turns)
- Did any phraser output violate a hard constraint (regex check)?
  - `/\$\d/` price leak — **none**
  - `/\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/` weekday leak — **none**
  - `/I'm Key|this is Key personally|I'll be there|I can install/i` first-person Key — **none**
  - length > 280 — **none** (max was Turn 0 at ~205 chars)
  - `/thank you for your interest|I appreciate|rest assured|feel free to/i` corporate phrase — **none**
- Did any classifier output have confidence <0.6 on a critical state? **No** (range 0.92-0.99)
- Did the conversation exceed 15 turns? **No** (9 turns; in expected 4-15 range)
- Did any state self-loop more than 2x? **No** (zero self-loops)
- Did the bot self-disclose AI status correctly when asking_if_human fired? **N/A** (Sarah never asked; this persona doesn't exercise that path)
- Did the bot use exclamation marks outside the first message? **No** (zero exclamations bot-side; one customer-side at Turn 9 "thanks!")
- Did the bot mirror emoji? **N/A** (Sarah used no emoji; acknowledge_emoji stayed false throughout)
- Did the bot use "by tomorrow morning" only inside SCHEDULE_QUOTE? **YES** (single occurrence, Turn 8)
- Did the phraser fall back to hardcoded text? **No** (zero fallbacks used; all turns LLM-phrased and clean)
- Voice corpus alignment: acknowledgment-then-pivot rate = 8/8 non-greeting turns (100%, target >70%); contraction rate uses "we're not used"/"y'all"/"Key'll"/"gonna"/"'em" — present in 6/9 turns

---

## Scoring (filled at review time)

- State machine score: ___ / 10
- Classifier score: ___ / 10
- Voice score: ___ / 10

## Reviewer notes

(Empty until human review — Key fills this in)
