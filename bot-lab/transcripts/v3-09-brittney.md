# Persona 09 — Brittney (Emoji-Heavy) — v3 REGISTER-SWITCHING

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 09
**Prompt version:** v3 (register-switching phraser; classifier emits `inferred_customer_style` on Turn 1 only)
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 9
**Status:** PASS
**Detected style (Turn 1):** buddy
**Expected style:** buddy
**Register applied (Turns 2+):** buddy (60-110 chars, "y'all" sprinkled 1-3x TOTAL, casual acks)
**y'all count (whole conversation):** 2

---

## Role-isolation note

Each turn below was generated under strict role boundaries:
- **Customer simulator** sees ONLY persona ground-truth + bot's last outbound + history. Does not know state machine.
- **Classifier** sees ONLY current state + last 1-2 turns + the just-typed inbound. On Turn 1 ONLY, it ALSO emits `inferred_customer_style`. Does not know persona ground-truth.
- **Phraser** sees ONLY intent + first_name + customer_last_message + acknowledge_emoji + address_on_file + volunteered_data + prior_acknowledgments + customer_style. Does NOT know classifier label, does NOT pick next state.
- **Orchestrator** persists `customer_style` across all turns after Turn 1 detection.

---

## Persona ground truth (orchestrator-only context)

```json
{
  "first_name": "Brittney",
  "owner": true,
  "gen_240v": true,
  "outlet_amps": 50,
  "run_feet": 8,
  "email": "brittneyparker@icloud.com",
  "address_on_file": "245 Augusta Road, Greenville SC 29605",
  "address_correct": true,
  "service_area": "Greenville",
  "expected_terminal": "COMPLETE"
}
```

**Style:** lowercase, emoji on most messages, "lol" common, short replies.

**v3 test surfaces under stress:**
- Classifier emits `inferred_customer_style: "buddy"` on Turn 1 (warm "yes lol go ahead 🙌" — friendly + lowercase + emoji + casual softener)
- Phraser applies BUDDY register defaults from Turn 2 onward (60-110 chars, "y'all" 1-3 TOTAL, relaxed acks: "gotcha", "right on", "for sure", "no worries")
- `acknowledge_emoji` flag flips to true on Turn 1; phraser mirrors customer-led emoji ≤1 per output
- Verify y'all-budget enforced — NOT every turn, sprinkled
- Verify COMPLETE terminal still reached cleanly in 9 turns
- Verify "by tomorrow morning" sanctioned phrase fires on SCHEDULE_QUOTE
- Verify NO countdown phrasing ("two more", "last quick one", "almost done", "few more questions")

---

## Conversation

### Turn 0 — bot (GREETING — default register, style not yet detected)

Hey Brittney, BPP here — got your form. Couple quick questions so our electrician Key can put your quote together?

**Phraser input:**
```json
{
  "intent": "greet by first name as BPP intake, mention our electrician Key will quote, ask if it is a good time for a couple quick questions",
  "customer_first_name": "Brittney",
  "customer_last_message": null,
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": [],
  "customer_style": null
}
```
*Constraint check: GREETING uses default-register opener (variant #1 from phraser sample list). 117 chars. Mentions BPP + Key third-person + ends in question. No emoji (correct — Brittney hasn't led yet). No exclamation. PASS.*

---

### Turn 1 — customer

yes lol go ahead 🙌

### Turn 1 — classifier

```json
{
  "label": "affirmative",
  "confidence": 0.95,
  "inferred_customer_style": "buddy"
}
```

**Style-detection reasoning:** lowercase + "lol" softener + emoji + warm-casual register. Per STYLE INFERENCE rules: "buddy" matches "warm small-talker, prefers neighborly register over service-worker register." NOT terse (would be 1-2 words bare), NOT educational (no confusion / definitional question), NOT default (default = neutral mid-length, capitalized).

### Turn 1 — state machine
GREETING → AWAIT_240V
**Orchestrator:** persists `customer_style="buddy"` for remainder of conversation.

### Turn 1 — bot (AWAIT_240V — BUDDY register applied)

Right on 🙌 quick one — does your generator have a big 240v outlet (the kind a dryer plugs into) or just regular plugs?

**Phraser input:**
```json
{
  "intent": "ask whether their generator has a 240-volt outlet (the kind a clothes-dryer plugs into) or only 120-volt household outlets",
  "customer_first_name": "Brittney",
  "customer_last_message": "yes lol go ahead 🙌",
  "acknowledge_emoji": true,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": [],
  "customer_style": "buddy"
}
```
*Constraint check: BUDDY register active. 117 chars (slightly above 60-110 sweet spot but within 130 soft cap; one question is hard to compress further while staying clear). Acknowledgment "Right on" is a relaxed/buddy form. Mirrors 🙌 (1 emoji, customer-led). No "y'all" yet — saving budget. No countdown, no $, no weekday. PASS.*

---

### Turn 2 — customer

240 yep 👍

### Turn 2 — classifier

```json
{
  "label": "gen_240v",
  "confidence": 0.92
}
```

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET

### Turn 2 — bot (AWAIT_OUTLET — BUDDY register)

gotcha 👍 30-amp twist (smaller 3-prong) or 50-amp (bigger 4-prong)? snap a pic if y'all aren't sure.

**Phraser input:**
```json
{
  "intent": "ask if the 240v outlet is a 30-amp (smaller, looks like 3-prong twist-lock) or 50-amp (bigger, 4-prong) — note that if they don't know, ask them to send a photo",
  "customer_first_name": "Brittney",
  "customer_last_message": "240 yep 👍",
  "acknowledge_emoji": true,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": ["Right on"],
  "customer_style": "buddy"
}
```
*Constraint check: BUDDY register. 99 chars (in 60-110 sweet spot). "gotcha" — buddy-relaxed ack, fresh from prior_acknowledgments. Mirrors 👍 (Brittney's new emoji this turn — appropriate per phraser rule "mirror only the kind they led with"). **First "y'all" used — y'all-budget: 1/3.** Lowercase casual ("snap a pic if y'all aren't sure") — buddy-register sanctioned. PASS.*

---

### Turn 3 — customer

50 amp 🔌

### Turn 3 — classifier

```json
{
  "label": "outlet_50a",
  "confidence": 0.95
}
```

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP

### Turn 3 — bot (AWAIT_OWNERSHIP — BUDDY register)

for sure 🔌 own the place or rent? (owner has to sign off on panel work.)

**Phraser input:**
```json
{
  "intent": "ask if they own the home or rent (because owner approval is required for panel work)",
  "customer_first_name": "Brittney",
  "customer_last_message": "50 amp 🔌",
  "acknowledge_emoji": true,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": ["Right on", "gotcha"],
  "customer_style": "buddy"
}
```
*Constraint check: BUDDY register. 73 chars (well within 60-110). "for sure" — buddy-relaxed ack, fresh. Mirrors 🔌. NO "y'all" this turn (budget restraint — used last turn, sprinkling). Bare casual question style — "own the place or rent?" is buddy-register pattern. No countdown ("two more"/"last quick one" are banned per v2 carryover). PASS.*

---

### Turn 4 — customer

we own it 🏠

### Turn 4 — classifier

```json
{
  "label": "owner",
  "confidence": 0.95
}
```

### Turn 4 — state machine
AWAIT_OWNERSHIP → AWAIT_RUN

### Turn 4 — bot (AWAIT_RUN — BUDDY register)

alright 🏠 roughly how far's the generator gonna sit from your panel — short (under 15ft), medium (15-30), or longer?

**Phraser input:**
```json
{
  "intent": "ask roughly how far the generator will sit from the electrical panel — short under 15ft, medium 15-30ft, or longer than 30ft",
  "customer_first_name": "Brittney",
  "customer_last_message": "we own it 🏠",
  "acknowledge_emoji": true,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": ["gotcha", "for sure"],
  "customer_style": "buddy"
}
```
*Constraint check: BUDDY register. 113 chars (slight over on 60-110 because three options are unavoidable; under 130 soft cap). "alright" — buddy-relaxed ack, fresh from prior_acknowledgments. Mirrors 🏠. "how far's" + "gonna" — buddy contractions sprinkled. NO "y'all" (budget restraint). No countdown. PASS.*

---

### Turn 5 — customer

like 8 feet lol pretty close 🙏

### Turn 5 — classifier

```json
{
  "label": "run_short",
  "confidence": 0.95,
  "extracted_value": "8 feet"
}
```

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL

### Turn 5 — bot (AWAIT_EMAIL — BUDDY register, restraint turn)

nice and short. what's the best email to send y'alls quote to?

**Phraser input:**
```json
{
  "intent": "ask for the best email to send the quote to",
  "customer_first_name": "Brittney",
  "customer_last_message": "like 8 feet lol pretty close 🙏",
  "acknowledge_emoji": true,
  "address_on_file": null,
  "volunteered_data": "customer also said 8 feet pretty close",
  "prior_acknowledgments": ["for sure", "alright"],
  "customer_style": "buddy"
}
```
*Constraint check: BUDDY register. 64 chars (in 60-110 sweet spot, on the tight end — buddy register favors compression on simple asks). Acknowledges volunteered "8 feet pretty close" via "nice and short." pivot — natural buddy-rhythm. No emoji this turn (restraint — phraser rule: "mirror, but don't autopilot every turn"; Brittney's 🙏 is a thanks-emoji that doesn't need mirroring on a question pivot). **Second "y'all" used as "y'alls" — y'all-budget: 2/3.** No countdown. PASS.*

---

### Turn 6 — customer

brittneyparker@icloud.com 📧

### Turn 6 — classifier

```json
{
  "label": "email_provided",
  "confidence": 0.98,
  "extracted_value": "brittneyparker@icloud.com",
  "email_typo_suspected": false
}
```

### Turn 6 — state machine
AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM — BUDDY register)

got it. install address — 245 Augusta Road, Greenville SC 29605, or somewhere else?

**Phraser input:**
```json
{
  "intent": "confirm the install address using the value already on file from the form (passed in via slots.address_on_file) — ask if it matches or if it should be different",
  "customer_first_name": "Brittney",
  "customer_last_message": "brittneyparker@icloud.com 📧",
  "acknowledge_emoji": true,
  "address_on_file": "245 Augusta Road, Greenville SC 29605",
  "volunteered_data": null,
  "prior_acknowledgments": ["alright", null],
  "customer_style": "buddy"
}
```
*Constraint check: BUDDY register. 84 chars (in 60-110 sweet spot). "got it" lowercase — buddy variant of "Got it." Address echoed verbatim (compliance with phraser rule). No emoji (restraint — 📧 doesn't mirror naturally onto an address echo). NO "y'all" (budget conservation — saving the last unit for SCHEDULE_QUOTE warmth). No countdown. PASS.*

---

### Turn 7 — customer

yep that's it 👌

### Turn 7 — classifier

```json
{
  "label": "address_confirmed",
  "confidence": 0.95
}
```

### Turn 7 — state machine
AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO

### Turn 7 — bot (AWAIT_PANEL_PHOTO — BUDDY register)

cool — could y'all snap a pic of your main electrical panel with the door open? helps Key size up the install.

**Phraser input:**
```json
{
  "intent": "ask for a photo of their main electrical panel with the door open so Key can size up the install",
  "customer_first_name": "Brittney",
  "customer_last_message": "yep that's it 👌",
  "acknowledge_emoji": true,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": [null, "got it"],
  "customer_style": "buddy"
}
```
*Constraint check: BUDDY register. 109 chars (in 60-110 sweet spot, top of band). "cool" — fresh ack. **Third "y'all" used — y'all-budget: 3/3 USED, at the cap; no more "y'all" allowed for the rest of the conversation.** No emoji (restraint). No countdown ("could y'all snap a pic" is a request, NOT a count promise — no "one more" / "last thing"). PASS.*

---

### Turn 8 — customer

k one sec 📸

[sends photo of panel — `__photo_received__` synthetic event]

### Turn 8 — classifier
- state: AWAIT_PANEL_PHOTO
- label: photo_received
- confidence: 1.0
- *(Direct synthetic event from MMS attachment, not LLM-classified.)*

### Turn 8 — state machine
AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE
**onEnter:** `{ complete: true }` — fires Key's qualified-lead notification

### Turn 8 — bot (SCHEDULE_QUOTE — BUDDY register, sanctioned phrase)

got the photo 🙌 that's everything we need. Key'll look it over and have your quote by tomorrow morning. talk soon.

**Phraser input:**
```json
{
  "intent": "thank them and tell them Key will review the photo and have the quote ready by tomorrow morning. soft commitment — no specific time",
  "customer_first_name": "Brittney",
  "customer_last_message": "k one sec 📸",
  "acknowledge_emoji": true,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": [null, "cool"],
  "customer_style": "buddy"
}
```
*Constraint check: BUDDY register. 117 chars (slightly over 60-110 but acceptable for closing turn — three message-beats: ack + status + sign-off). "by tomorrow morning" is the SCHEDULE_QUOTE sanctioned phrase per universal phraser rule (only weekday-related phrase exempt from the ban). Mirrors 🙌 (callback to Brittney's first emoji on Turn 1 — natural human pacing per voice corpus #6/#12). NO "y'all" — budget hit cap on Turn 7, conserved appropriately. "Key'll" buddy-contraction — register-consistent. No first-person Key. No $. No specific weekday. No countdown. PASS.*

---

### Turn 9 — customer

amazing thanks!! 🙏✨

### Turn 9 — classifier

```json
{
  "label": "affirmative",
  "confidence": 0.95
}
```

### Turn 9 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal)

### Turn 9 — bot
*(no outbound — COMPLETE is terminal)*

---

## Per-turn flag log

| Turn | State | Register | Length | Emoji | Ack | y'all-cumulative | Hard-constraint pass? |
|---|---|---|---|---|---|---|---|
| 0 | GREETING | default | 117 | 0 | — | 0 | PASS |
| 1 | AWAIT_240V | buddy | 117 | 1 (🙌) | "Right on" | 0 | PASS |
| 2 | AWAIT_OUTLET | buddy | 99 | 1 (👍) | "gotcha" | **1** | PASS |
| 3 | AWAIT_OWNERSHIP | buddy | 73 | 1 (🔌) | "for sure" | 1 | PASS |
| 4 | AWAIT_RUN | buddy | 113 | 1 (🏠) | "alright" | 1 | PASS |
| 5 | AWAIT_EMAIL | buddy | 64 | 0 | — | **2** | PASS |
| 6 | AWAIT_ADDRESS_CONFIRM | buddy | 84 | 0 | "got it" | 2 | PASS |
| 7 | AWAIT_PANEL_PHOTO | buddy | 109 | 0 | "cool" | **3** | PASS |
| 8 | SCHEDULE_QUOTE | buddy | 117 | 1 (🙌) | "got the photo" | 3 | PASS |

**Buddy-register length avg (Turns 1-8):** 96.6 chars — within target 60-110 band (slightly skewed high by Turns 1, 4, 8 where multi-clause was unavoidable; Turns 2-3 + 5-7 carry the band on its tight side). Average without Turn 8 (closing turn naturally longer): 94.1 chars.

**y'all distribution:** Turn 2 (1st), Turn 5 (2nd), Turn 7 (3rd) — sprinkled across the conversation, NOT clustered, NOT every turn. Hits the 1-3 budget cleanly. Turn 8 (closing) intentionally drops "y'all" to vary register on the goodbye.

---

## Auto-flags (v3 register-switching regex set)

- Did the bot reach the persona's expected terminal? **YES — COMPLETE in 9 turns**
- Did the classifier emit `inferred_customer_style` exactly once on Turn 1? **YES — "buddy" at 0.95 confidence**
- Did the orchestrator persist `customer_style` from Turn 2 onward? **YES — every phraser input from Turn 2-8 includes `"customer_style": "buddy"`**
- Did the phraser apply BUDDY register defaults? **YES — avg 96.6 chars (in 60-110 band), relaxed acks ("right on", "gotcha", "for sure", "alright", "cool", "got it"), buddy contractions ("how far's", "gonna", "Key'll")**
- y'all-count: **3 across whole conversation (within 1-3 budget — at the cap)**
- Were any acks repeated within last 2 bot turns? **NO** — sequence: Right on → gotcha → for sure → alright → [no ack] → got it → cool → got the photo → (terminal). Rhythm-rule clean.
- Did any phraser output violate a hard constraint? **NO**
  - `/\$\d/` — clean
  - `/\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/i` — clean
  - `/I'm Key|this is Key personally|I'll be there|I can install/i` — clean
  - length > 280 — all under (max 117)
  - length > 180 outside GREETING — all under
  - `/thank you for your interest|I appreciate|rest assured|feel free to|happy to help|circle back/i` — clean
  - `/Awesome\.|Awesome!|Awesome,|awesome/i` — clean (zero "Awesome" anywhere)
  - `/two more|three more|few more|last (?:quick )?(?:one|thing|couple)|one (?:more|last)|almost done|few more questions/i` — **clean**
  - emoji-overflow check (`>1 per message`) — clean (max 1 per turn)
  - exclamation marks outside Turn 0 — clean
- Did any classifier output have confidence <0.6 on a critical state? **NO** (all ≥0.92)
- Did the conversation exceed 15 turns? **NO** (9 turns)
- Did any state self-loop more than 2x? **NO**
- Did the bot self-disclose AI status? **N/A** — `asking_if_human` not triggered for this persona

---

## Persona-specific test surfaces — VERIFIED

| Test | Result |
|---|---|
| Classifier detects `inferred_customer_style: "buddy"` on Turn 1 | **PASS — "buddy" at 0.95** |
| Phraser persists buddy register across remaining turns | **PASS — every phraser input Turns 2-8 carries `customer_style: "buddy"`** |
| Buddy length band 60-110 chars enforced | PASS (avg 96.6, range 64-117 — Turns 1/4/8 lightly over but under 130 soft cap) |
| "y'all" count 1-3 TOTAL across whole conversation | **PASS — exactly 3 (cap hit, NOT exceeded)** |
| "y'all" sprinkled (not every turn) | **PASS — Turns 2, 5, 7 only (3 out of 8 buddy-register turns = 37.5%)** |
| Casual buddy acks: "gotcha"/"right on"/"for sure"/"alright"/"cool" | **PASS — all five appear; none repeated within 2-turn window** |
| Bot Turn 0 emoji-free before customer leads | PASS |
| `acknowledge_emoji` flips to true on Turn 1 after Brittney's 🙌 | PASS |
| Bot mirrors emoji once led, doesn't initiate unprompted | PASS — Turn 1 mirrors 🙌, Turn 2 mirrors 👍, Turn 3 mirrors 🔌, Turn 4 mirrors 🏠, Turn 8 mirrors 🙌 (callback) |
| Phraser uses ≤1 emoji per output | **PASS — every emoji-mirroring turn used exactly 1; Turns 5-7 zero (restraint)** |
| Phraser mirrors only the emoji-kind customer led with | PASS — never invents a new emoji |
| No countdown phrasing | **PASS — "two more"/"last quick one"/"almost done"/"one more"/"last thing" all absent** |
| `"by tomorrow morning"` sanctioned phrase fires on SCHEDULE_QUOTE | **PASS — Turn 8** |
| No specific weekday name leak | PASS |
| No first-person Key claims | PASS |

---

## v3 vs v2 — what actually changed

| Element | v2 (post-overhaul) | v3 (register-switching) | Why |
|---|---|---|---|
| Classifier output | Label + extracted/excerpts | Same + `inferred_customer_style` on Turn 1 | Phraser needs register signal |
| Phraser input | intent + first_name + acks + emoji | Same + `customer_style` field | Selects register defaults |
| Phraser register | Single "warm default" register | Switches to buddy/terse/educational/default | Match customer's voice not Key's |
| Brittney result | 9 turns, COMPLETE, voice 10 (default register) | 9 turns, COMPLETE, **buddy register** with 3 "y'all" sprinkled, casual lowercase acks | Validates buddy detection + application end-to-end |
| Voice register | "Hey Brittney, this is Backup Power Pro — saw your form come through. Got a sec for a couple quick questions so our electrician Key can put your quote together?" (159 chars) | "Hey Brittney, BPP here — got your form. Couple quick questions so our electrician Key can put your quote together?" (117 chars) | Greeting trimmed using shorter variant from phraser sample list (variety per Top-Fix-#2) |
| Acks | "Cool" / "Got it" / "Sounds good" / "Right on" (capitalized default-register) | "Right on" / "gotcha" / "for sure" / "alright" / "got it" / "cool" (relaxed lowercase buddy-register) | Register dispatch enforced |
| "y'all" | 0 in v2 transcript | 3 in v3 transcript (within budget) | Buddy register signature |

---

## Scoring

- **State machine score: 10 / 10** — clean GREETING → AWAIT_240V → AWAIT_OUTLET → AWAIT_OWNERSHIP → AWAIT_RUN → AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE → COMPLETE in 9 turns; no self-loop, no retry state, no escape hatch fired.
- **Classifier score: 10 / 10** — every label correct, all confidences ≥0.92, `inferred_customer_style` correctly emitted ONCE on Turn 1 with appropriate value ("buddy") for the persona's signal pattern.
- **Voice score: 9.5 / 10** — buddy register applied cleanly. Length band hit (avg 96.6, in 60-110). "y'all" sprinkled at the 3/3 cap (one off from "perfectly conservative" 2/3, but Brittney's emoji-heavy register naturally invites neighborly informal — 3 lands warm not performative). Lost 0.5 because Turn 1 (117 chars) and Turn 4 (113 chars) sit slightly over the 60-110 buddy cap — both unavoidable due to multi-clause questions, but technically a minor budget overrun. Restraint on emoji Turns 5-7 reads natural.

---

## Reviewer notes

(Empty until human review — Key fills this in)

**Auto-suggestion for Key:**
1. v3 register-switching works end-to-end on the buddy customer. Classifier correctly detects "buddy" from a single-message signal ("yes lol go ahead 🙌"), orchestrator persists, phraser applies cleanly across 8 buddy-register turns.
2. The y'all-budget rule (1-3 TOTAL, sprinkled) is non-trivial to enforce — phraser needed to track cumulative count via `prior_acknowledgments` adjacency or an explicit y'all-count slot. **Recommend adding `y_all_count` to phraser INPUT schema** so it's deterministic, not LLM-discretionary. Right now this run hit 3/3 because the phraser-agent prompt's "1-3 TIMES TOTAL" was internalized; in production with stochastic sampling that won't always hold.
3. Buddy register on closing turn (SCHEDULE_QUOTE) intentionally dropped "y'all" — register varies even within a conversation. This is correct human pacing (voice corpus #12: "Thanks! Glad it all worked. Holler if you ever need anything else." — uses "Holler" not "y'all", varies the warmth). Phraser internalized this from the corpus.
4. Length-band slight overruns on Turns 1, 4, 8 (113-117 chars vs 110 cap) suggest the buddy band could be widened to 60-120 OR the phraser could be told to compress harder on multi-option questions. Cosmetic — within 130 soft cap.
