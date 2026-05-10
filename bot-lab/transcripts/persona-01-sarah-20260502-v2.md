# Persona 01 — Sarah (Cooperative 240v Owner) — v2 REGRESSION

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 01
**Prompt version:** v2 (post-overhaul: GREETING variants, banned "Awesome.", banned countdown phrasing, acknowledgment-rhythm rule, 5 new classifier labels)
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 9
**Status:** PASS
**Awesome-violation:** no
**Countdown-violation:** no
**Rhythm-violation:** no

---

## Role-isolation note

Each turn below was generated under strict role boundaries:
- **Customer simulator** sees ONLY persona ground-truth + bot's last outbound + history. Does not know the state machine.
- **Classifier** sees ONLY current state + last 1-2 turns + the just-typed inbound. Does not know persona ground-truth or what state comes next.
- **Phraser** sees ONLY intent + first_name + customer_last_message + acknowledge_emoji + (when applicable) address_on_file + volunteered_data + prior_acknowledgments array. Does not know classifier output, does not see ground-truth, does not pick the next state.

`prior_acknowledgments` is updated turn-by-turn — the phraser sees the last 2 bot turns' opening acknowledgment phrases (or empty if none) and is forbidden from reusing them.

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Sarah — Backup Power Pro. Saw you came through the site. Got a sec for a couple quick questions so our electrician Key can put your quote together?

(GREETING register variant #2 from phraser sample list. 137 chars. Mentions BPP + Key third-person. Ends in question. No emoji. No exclamation used.)

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
**Phraser input:** prior_acknowledgments=[] (no prior bot acks yet)
Cool. Does your generator have a big 240-volt outlet — the kind a dryer plugs into — or just regular 120-volt outlets?

(118 chars. Acknowledgment "Cool." — fresh, not in prior_acknowledgments. One question. No banned word. No countdown.)

### Turn 2 — customer
yep, 240. it's a 50 amp twist lock plug

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.97
- extracted_value: —
- off_topic_excerpt: —
- note: customer volunteered amp info; classifier still routes on gen_240v (correct per state-specific labels)

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET (intent: ask if 30A or 50A, or send a photo)

### Turn 2 — bot (AWAIT_OUTLET)
**Phraser input:** prior_acknowledgments=["Cool."], volunteered_data="customer also said 50 amp twist-lock"
Got it — sounds like 50-amp from what you said. Just to lock it in, that's the bigger 4-prong twist-lock, right?

(105 chars. Acknowledgment "Got it." — different from "Cool." (rhythm rule passes). Acknowledges volunteered_data. One question. No banned word.)

### Turn 3 — customer
yes the 4 prong one

### Turn 3 — classifier
- state: AWAIT_OUTLET
- label: outlet_50a
- confidence: 0.96
- extracted_value: —
- off_topic_excerpt: —

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP (intent: ask if they own the home or rent)

### Turn 3 — bot (AWAIT_OWNERSHIP)
**Phraser input:** prior_acknowledgments=["Got it.", "Cool."]
Sounds good, 50-amp confirmed. Y'all own the place or rent? (Owner has to sign off on panel work.)

(94 chars. Acknowledgment "Sounds good." — not in prior_acknowledgments. NO countdown phrasing — does NOT say "two more quick things" like v1 did. One question. Voice corpus #7 register match ("y'all").)

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
**Phraser input:** prior_acknowledgments=["Sounds good.", "Got it."]
Right on. How far is the generator gonna sit from your panel? Under 15ft, 15-30ft, or longer?

(96 chars. Acknowledgment "Right on." — fresh, not in prior_acknowledgments. NO countdown phrasing — does NOT say "Last quick one" like v1 did. One question with all three buckets.)

### Turn 5 — customer
probably about 20-25 feet

### Turn 5 — classifier
- state: AWAIT_RUN
- label: run_medium
- confidence: 0.94
- extracted_value: —
- off_topic_excerpt: —

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL (intent: ask for the best email to send the quote to)

### Turn 5 — bot (AWAIT_EMAIL)
**Phraser input:** prior_acknowledgments=["Right on.", "Sounds good."]
Yep, that's medium. What's the best email for the quote?

(56 chars. Acknowledgment "Yep." — fresh. Tight, terse, mid-flow length per voice rules. One ask.)

### Turn 6 — customer
sarah.becker.gvl@gmail.com

### Turn 6 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.99
- extracted_value: sarah.becker.gvl@gmail.com
- email_typo_suspected: false (clean gmail.com domain)
- off_topic_excerpt: —

### Turn 6 — state machine
AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM (intent: confirm the install address using value from form)
(special-case email branch: typo_suspected=false, so skips CHECK_EMAIL_TYPO and goes direct to AWAIT_ADDRESS_CONFIRM)

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM)
**Phraser input:** prior_acknowledgments=["Yep.", "Right on."], address_on_file="412 Oakmont Drive, Greer SC 29651"
Alright. Install address — 412 Oakmont Drive, Greer SC 29651 — that the right one or somewhere else?

(101 chars. Acknowledgment "Alright." — fresh. Repeats full address back per phraser test case 8 criterion. One question.)

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
**Phraser input:** prior_acknowledgments=["Alright.", "Yep."]
OK. Could you snap a pic of your main panel with the door open? Helps Key size up the install.

(95 chars. Acknowledgment "OK." — fresh, not in prior_acknowledgments. **CRITICAL v2 CHECK:** v1 used "Awesome." here — v2 does NOT. "snap a pic" matches voice corpus #11 register. Third-person Key.)

### Turn 8 — customer
[sends photo of panel]

### Turn 8 — state machine (synthetic event)
- event: __photo_received__ (orchestrator-emitted synthetic; bypasses classifier per orchestrator spec)
- label-equivalent: photo_received
- AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (intent: thank them and tell them Key will have the quote ready by tomorrow morning)

### Turn 8 — bot (SCHEDULE_QUOTE)
**Phraser input:** prior_acknowledgments=["OK.", "Alright."]
Got the photo, that's everything we need. Key will look over your panel pic and have your quote to you by tomorrow morning. Talk soon.

(135 chars. NO acknowledgment-phrase reuse — opens with "Got the photo" which is content-led, not a generic ack token; matches voice corpus #11 ("Got the photo, that's a Cutler-Hammer panel"). Uses sanctioned "by tomorrow morning" phrase only — no other timeline. Third-person "Key will look over". Warm sign-off "Talk soon.")

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

| Turn | State | Hard-constraint pass? | Acknowledgment used | Voice 1-10 | Notes |
|---|---|---|---|---|---|
| 0 | GREETING | PASS | (greeting register #2) | — | "Hey Sarah — Backup Power Pro." opener, 137 chars, no emoji, no banned words |
| 1 | AWAIT_240V | PASS | "Cool." | — | acknowledgment fresh; one question; explains 240 vs 120 plainly |
| 2 | AWAIT_OUTLET | PASS | "Got it." | — | acknowledges volunteered_data ("50-amp from what you said"); ack rotated from prior turn |
| 3 | AWAIT_OWNERSHIP | PASS | "Sounds good." | — | NO countdown phrase ("two more quick things" replaced with clean pivot); ack rotated |
| 4 | AWAIT_RUN | PASS | "Right on." | — | NO countdown phrase ("Last quick one" replaced with clean pivot); ack rotated |
| 5 | AWAIT_EMAIL | PASS | "Yep." | — | terse, one ask; ack rotated |
| 6 | AWAIT_ADDRESS_CONFIRM | PASS | "Alright." | — | repeats full address back; ack rotated |
| 7 | AWAIT_PANEL_PHOTO | PASS | "OK." | — | **"Awesome." replaced with "OK."** — v1 violation fixed; ack rotated |
| 8 | SCHEDULE_QUOTE | PASS | (content-led: "Got the photo") | — | sanctioned "by tomorrow morning" only; voice corpus #11 echo; warm sign-off |
| 9 | (terminal) | — | — | — | no outbound on COMPLETE |

---

## Hard-constraint regex sweep (all phraser outputs, Turns 0-8)

| Check | Regex | Result |
|---|---|---|
| Price leak | `/\$\d/` | NONE |
| Weekday leak | `/\b(Saturday\|Sunday\|Monday\|Tuesday\|Wednesday\|Thursday\|Friday)\b/` | NONE |
| First-person Key claim | `/I'm Key\|this is Key personally\|I'll be there\|I can install/i` | NONE |
| Length > 280 | — | NONE (max = Turn 0 at 137 chars; all mid-flow ≤ 135 chars) |
| Corporate phrase | `/thank you for your interest\|I appreciate\|rest assured\|feel free to\|happy to help\|circle back/i` | NONE |
| **NEW: "Awesome."** | `/\bAwesome[.!,]/i` | **NONE** ✅ (v1 had it on Turn 7; v2 fixed) |
| **NEW: Countdown phrasing** | `/two more quick\|last quick one\|almost done\|few more questions\|last thing\|two more\|one more thing\|just one more/i` | **NONE** ✅ (v1 had "Two more quick things" Turn 3 + "Last quick one" Turn 4 + "Last thing" Turn 7; v2 fixed all three) |
| Multiple "?" | count("?") > 1 in same message | NONE (every bot turn has ≤1 question mark) |
| Emoji while acknowledge_emoji=false | — | NONE |
| Exclamation outside Turn 0 | — | NONE (zero bot exclamations across all turns) |

---

## Acknowledgment-rhythm trace (NEW v2 rule)

The phraser MUST NOT reuse an acknowledgment phrase that appeared in the last 2 bot turns. Trace:

| Turn | Acknowledgment | prior_acknowledgments at phraser-time | Repeat? |
|---|---|---|---|
| 0 | (greeting — N/A) | [] | N/A |
| 1 | "Cool." | [] | no |
| 2 | "Got it." | ["Cool."] | no |
| 3 | "Sounds good." | ["Got it.", "Cool."] | no |
| 4 | "Right on." | ["Sounds good.", "Got it."] | no |
| 5 | "Yep." | ["Right on.", "Sounds good."] | no |
| 6 | "Alright." | ["Yep.", "Right on."] | no |
| 7 | "OK." | ["Alright.", "Yep."] | no |
| 8 | (content-led "Got the photo" — no generic ack token) | ["OK.", "Alright."] | no |

**Rhythm-violation count: 0.** All 7 acknowledgments rotated through distinct phrases from the allowed set ("Got it.", "Cool.", "Sounds good.", "Right on.", "Alright.", "Yep.", "OK."). The final SCHEDULE_QUOTE message broke the ack-rhythm by going content-led ("Got the photo, …") which is exactly the voice rule's "about half the corpus is just the next thing without a preamble" guidance.

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **YES** (COMPLETE in 9 turns)
- Awesome-violation? **no**
- Countdown-violation? **no**
- Rhythm-violation? **no**
- Did any classifier output have confidence <0.6 on a critical state? **No** (range 0.92-0.99)
- Did the conversation exceed 15 turns? **No** (9 turns; in expected 4-15 range)
- Did any state self-loop more than 2x? **No** (zero self-loops)
- Did the bot self-disclose AI status when asking_if_human fired? **N/A** (Sarah never asked)
- Did the bot use exclamation marks outside the first message? **No** (zero exclamations bot-side)
- Did the bot mirror emoji? **N/A** (Sarah used no emoji; acknowledge_emoji stayed false throughout)
- Did the bot use "by tomorrow morning" only inside SCHEDULE_QUOTE? **YES** (single occurrence, Turn 8)
- Did the phraser fall back to hardcoded text? **No** (zero fallbacks; all turns LLM-phrased and clean)
- GREETING register variant used? **YES** (variant #2 — "Hey {name} — Backup Power Pro. Saw you came through the site…"); previous Sarah run (v1) used a different opener, so no template-feel collision when the same lead is re-greeted
- Acknowledgment phrase reuse across last 2 turns? **0 instances** (rhythm rule passes)
- New classifier labels exercised this run? Sarah's happy path is strictly the cooperative track — none of the 5 new labels (asking_for_context / friendly_chitchat / answered_with_impatience / amending_prior_answer / email_typo_suspected) fired. This is **expected for the regression baseline**: Sarah's purpose is to confirm the new prompts don't break the happy path. The 5 new labels are exercised by Personas 02-12.

---

## v2 vs v1 diff (regression takeaway)

| Turn | v1 phraser output | v2 phraser output | Change |
|---|---|---|---|
| 0 | "Hey Sarah, this is Backup Power Pro reaching out about your generator inlet form. Got a couple quick questions…" | "Hey Sarah — Backup Power Pro. Saw you came through the site. Got a sec for a couple quick questions…" | rotated to greeting variant #2 |
| 1 | "Perfect. Quick one — does your generator have…" | "Cool. Does your generator have…" | banned "Perfect." reduced; tightened intro |
| 2 | "Got it — sounds like 50-amp from what you said…" | "Got it — sounds like 50-amp from what you said…" | unchanged (already clean) |
| 3 | "Perfect, 50-amp it is. **Two more quick things** — do y'all own…" | "Sounds good, 50-amp confirmed. Y'all own the place or rent?" | **countdown phrase removed** + "Perfect" rotated out |
| 4 | "Good deal. **Last quick one** — roughly how far…" | "Right on. How far is the generator gonna sit…" | **countdown phrase removed** |
| 5 | "Got it, medium run." | "Yep, that's medium." | "Got it" rotated (was used Turn 2) |
| 6 | "Perfect. Install address — is it…" | "Alright. Install address — 412 Oakmont…" | "Perfect" replaced |
| 7 | "**Awesome.** Last thing — could you snap a pic…" | "OK. Could you snap a pic…" | **"Awesome." removed** + countdown "Last thing" removed |
| 8 | "Perfect, that's everything we need. Key'll…" | "Got the photo, that's everything we need. Key will…" | content-led opener; "Perfect" replaced |

**Net effect:** v2 fixes 4 hard-constraint violations from v1 (1× "Awesome.", 3× countdown phrases) and rotates the "Perfect."-heavy register that would have failed the rhythm rule had it been graded under v2 prompts. The flow length is identical (9 turns), the terminal is identical (COMPLETE), the classifier behavior is identical — only the phraser output differs, exactly as expected since the prompt overhaul targeted phraser register/rhythm/banned-words.

---

## Scoring (filled at review time)

- State machine score: ___ / 10
- Classifier score: ___ / 10
- Voice score: ___ / 10

## Reviewer notes

(Empty until human review — Key fills this in)
