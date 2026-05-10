# Persona 14 — Brad (Burst Texter, three messages in 25 seconds) — v5

**Date:** 2026-05-02
**Variant:** v5 (regression run on locked v3 register-switching system)
**Persona file:** customer-personas.md → Persona 14
**Expected style:** terse
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Detected style:** terse (Turn 1, confidence 0.94)
**Register-applied:** yes (terse phraser invoked Turns 1-8)
**Generac-callout:** YES (Turn 1, "Generac 7500" acknowledged)
**Turns:** 9
**Status:** PASS

---

## v5 regression target

This run re-validates that the v3-locked register-switching architecture
still passes Brad's two headline tests on the current prompt set:

1. **Terse style detection** — classifier reads Brad's Turn 1 burst
   ("yeah it's a generac / like 7500 watts / what do u need to know")
   and emits `inferred_customer_style="terse"` with confidence ≥0.85.
   Orchestrator persists the style; phraser switches to TERSE register
   from Turn 1 outbound onward.
2. **Generac callout via volunteered_data passthrough** — the AWAIT_240V
   phraser, on the same turn that the register switches to TERSE, opens
   with a Generac/7500 acknowledgment (≤30 chars) before pivoting to
   the 240v question. The two subsystems must fire cleanly on the same
   turn boundary.

Both must hold. If either fails, regression flag.

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Brad, BPP here — got your form. Couple quick questions so our electrician Key can put your quote together?

(116 chars — GREETING uses neutral/default opener since style is not yet known on Turn 0; greeting cap is 80-140)

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
- **inferred_customer_style: "terse"**
- **style_confidence: 0.94**
- note: classifier received the three messages joined with newlines (production 5-second debounce surfaces the latest but recent_turns context contains all three). Five terse signals fire simultaneously: (a) all-lowercase across all three fragments, (b) "u" abbreviation, (c) zero punctuation across all three, (d) burst-texted three data points in one window without bot prompting, (e) jumps ahead with brand+wattage before bot asks anything specific — high-context "I know what I have, what do you need" energy. Textbook terse profile per STYLE INFERENCE rubric (>2 of the 5 signals trigger high-confidence terse). "what do u need to know" is the affirmative-toned consent to proceed; the generator make + wattage is volunteered context the next state's phraser should acknowledge.

### Turn 1 — state machine + orchestrator
GREETING → AWAIT_240V (intent: ask whether their generator has a 240-volt outlet or only 120-volt household outlets)
- volunteered_data passed to phraser: "customer also said it's a Generac 7500W"
- **conversation.customer_style := "terse"** (persisted from classifier; orchestrator selects TERSE register for every subsequent phraser call)
- sticky_style="terse", pending_style=null, pending_count=0

### Turn 1 — bot (AWAIT_240V — TERSE register)
Generac 7500, solid. 240v outlet on the side or just regular plugs?

(67 chars) — **CRITICAL TEST PASS: Generac 7500 acknowledged in TERSE register; volunteered_data passthrough fired correctly under the v5 regression check. Style switch from GREETING-default to TERSE happened at the right boundary (Turn 1 outbound, immediately after style detection on Turn 1 inbound). 19 chars of brand-acknowledgment + 47 chars for the question, well within 35-80 char terse target band.**

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
- inferred_customer_style: "terse" (reaffirmed; lowercase, no punctuation, two-message burst again)
- style_confidence: 0.93

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET (intent: ask if the 240v outlet is 30A or 50A)
- volunteered_data passed to phraser: "customer also said 4-prong twist-lock (likely 50A)"
- sticky_style="terse" (reaffirmed; pending_style stays null)

### Turn 2 — bot (AWAIT_OUTLET — TERSE register)
4-prong sounds 50-amp. that right?

(35 chars) — bare confirmation, drops subject pronoun, lowercase. Acknowledges the volunteered "4-prong twist lock" by naming the inference back (50-amp) rather than asking the same outlet question generically. Mid-flow ack rate satisfied via the data acknowledgment without an explicit "Got it." prefix.

### Turn 3 — customer
yep 50

### Turn 3 — classifier
- state: AWAIT_OUTLET
- label: outlet_50a
- confidence: 0.96
- extracted_value: —
- off_topic_excerpt: —
- inferred_customer_style: "terse" (reaffirmed)

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP (intent: ask if they own or rent)
- sticky_style="terse"

### Turn 3 — bot (AWAIT_OWNERSHIP — TERSE register)
own or rent the place?

(22 chars) — no ack (TERSE ~30% ack rate; this is the no-ack turn). Bare question, drops "do you", drops helping verb.

### Turn 4 — customer
own it

### Turn 4 — classifier
- state: AWAIT_OWNERSHIP
- label: owner
- confidence: 0.98
- extracted_value: —
- off_topic_excerpt: —
- inferred_customer_style: "terse" (reaffirmed)

### Turn 4 — state machine
AWAIT_OWNERSHIP → AWAIT_RUN (intent: ask roughly how far the generator will sit from the panel)
- sticky_style="terse"

### Turn 4 — bot (AWAIT_RUN — TERSE register)
how far from the panel — under 15ft, 15-30, or longer?

(54 chars) — no ack again, dropped "do you" and helping verb. Three buckets compact.

### Turn 5 — customer
prob 18 ft
maybe 20

### Turn 5 — classifier
- state: AWAIT_RUN
- label: run_medium
- confidence: 0.94
- extracted_value: —
- off_topic_excerpt: —
- inferred_customer_style: "terse" (reaffirmed; another burst)
- note: two-message burst again, both joined; classifier reads 18-20ft → run_medium. Burst pattern reinforces the terse style call from Turn 1.

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL (intent: ask for the best email)
- sticky_style="terse"

### Turn 5 — bot (AWAIT_EMAIL — TERSE register)
got it. best email for the quote?

(33 chars) — minimum-effort 2-word ack ("got it.") within the terse 1-3 word ack budget. prior_acknowledgments=[] (none emitted in mid-flow yet), so "got it." is fresh.

### Turn 6 — customer
brad.f@gmail.com

### Turn 6 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.99
- extracted_value: brad.f@gmail.com
- email_typo_suspected: false
- off_topic_excerpt: —
- inferred_customer_style: "terse" (reaffirmed)

### Turn 6 — state machine
AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM (intent: confirm the install address)
- typo check: clean gmail.com domain, skips CHECK_EMAIL_TYPO
- sticky_style="terse"

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM — TERSE register)
install at 44 Lakewood Drive, Simpsonville? or somewhere else?

(62 chars) — fragment form, drops "the" prefix, no opening ack. prior_acknowledgments=["got it."] from Turn 5 — skipping ack here is the right rhythm move (alternation).

### Turn 7 — customer
thats it

### Turn 7 — classifier
- state: AWAIT_ADDRESS_CONFIRM
- label: address_confirmed
- confidence: 0.96
- extracted_value: —
- off_topic_excerpt: —
- inferred_customer_style: "terse" (reaffirmed)

### Turn 7 — state machine
AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO (intent: ask for a photo of their main electrical panel with the door open)
- sticky_style="terse"

### Turn 7 — bot (AWAIT_PANEL_PHOTO — TERSE register)
quick pic of your main panel, door open? helps Key size it up.

(62 chars) — casual lowercase opening, mirrors voice corpus #11 phrasing ("Got the photo, that's a Cutler-Hammer panel"). Brief why-it-matters clause ("helps Key size it up") within terse register's compressed teach budget. No ack — alternation since "got it." used Turn 5.

### Turn 8 — customer
[sends photo of panel]

### Turn 8 — state machine (synthetic event)
- event: __photo_received__ (orchestrator-emitted synthetic; bypasses classifier per orchestrator spec)
- label-equivalent: photo_received
- AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (intent: thank them and tell them Key will have the quote ready by tomorrow morning)
- sticky_style="terse" (SCHEDULE_QUOTE outbound also runs through TERSE register)

### Turn 8 — bot (SCHEDULE_QUOTE — TERSE register)
got it — that's everything. Key'll have your quote by tomorrow morning.

(71 chars) — "got it" reused (3-turn gap since Turn 5; prior_acknowledgments=["got it."] from Turn 5 has rolled out of the 2-deep window by Turn 8 since we count from the last 2 emitted acks); third-person Key ("Key'll") + sanctioned "by tomorrow morning" (the ONE allowed timeframe phrase, scoped to SCHEDULE_QUOTE). Fragment form, lowercase opening, contracted "Key'll".

### Turn 9 — customer
sweet thanks

### Turn 9 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.93
- extracted_value: —
- off_topic_excerpt: —

### Turn 9 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal, no further outbound; onEnter signals qualified-lead notification fires to Key with full slot set: Generac 7500W, 240v, 50A, owner, 18-20ft run, brad.f@gmail.com, 44 Lakewood Dr Simpsonville, panel photo received)

---

## Per-turn flag log

| Turn | State | Chars | Register | Hard-constraint pass? | Notes |
|---|---|---|---|---|---|
| 0 | GREETING | 116 | default (pre-detection) | PASS | Style not yet known on Turn 0; uses default opener. Inside 80-140 GREETING band. |
| 1 | AWAIT_240V | 67 | **TERSE (just-detected)** | PASS | **Style detection + volunteered_data passthrough both fired on the same turn.** "Generac 7500, solid." in 19 chars before pivoting to 240v question in 47 chars. Headline regression test passed. |
| 2 | AWAIT_OUTLET | 35 | TERSE | PASS | Fragment ("4-prong sounds 50-amp"), confirmation question, lowercase. Inferred 50A from volunteered "4-prong twist lock" instead of generic 30-or-50 ask. |
| 3 | AWAIT_OWNERSHIP | 22 | TERSE | PASS | Bare question, no ack — correct for ~30% ack rate. |
| 4 | AWAIT_RUN | 54 | TERSE | PASS | No ack, dropped pronoun + helping verb, three buckets compact. |
| 5 | AWAIT_EMAIL | 33 | TERSE | PASS | "got it." min-effort 2-word ack, then bare question. |
| 6 | AWAIT_ADDRESS_CONFIRM | 62 | TERSE | PASS | Fragment form, no opening ack. |
| 7 | AWAIT_PANEL_PHOTO | 62 | TERSE | PASS | Casual lowercase, voice-corpus-aligned, brief why-it-matters. |
| 8 | SCHEDULE_QUOTE | 71 | TERSE | PASS | "got it" reused safely; third-person Key; "by tomorrow morning" sanctioned. |
| 9 | (terminal) | — | — | — | no outbound on COMPLETE |

**Average outbound length (Turns 0-8): 58.0 chars.** Excluding the default-register Turn 0 (116 chars), Turns 1-8 average **50.8 chars** — squarely inside the 35-80 char TERSE target band. Mid-flow average (Turns 2-7): 44.7 chars — even tighter. Identical to v3 baseline (no drift).

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **YES** (COMPLETE in 9 turns)
- Did any phraser output violate a hard constraint (regex check)?
  - `/\$\d/` price leak — **none**
  - `/\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/` weekday leak — **none**
  - `/I'm Key|this is Key personally|I'll be there|I can install/i` first-person Key — **none**
  - length > 280 — **none** (max was Turn 0 at 116 chars; default register on Turn 0 only)
  - length > 180 outside GREETING — **none** (max non-greeting 71 chars)
  - `/thank you for your interest|I appreciate|rest assured|feel free to|happy to help|circle back/i` corporate phrase — **none**
  - `/awesome/i` SaaS-bro tell — **none**
  - `/two more|three more|few more|last (?:quick )?(?:one|thing|couple)|one (?:more|last)|almost done|few more questions/` countdown phrasing — **none**
  - exclamation marks outside GREETING — **none** (Turn 0 has no exclamation either; question mark only)
  - multiple "?" in one message — **none**
  - emoji count >1 per message — **none** (zero emoji used; acknowledge_emoji stayed false because Brad never used one)
- Did any classifier output have confidence <0.6 on a critical state? **No** (range 0.92-0.99)
- **Did style detection fire on Turn 1? YES — `inferred_customer_style="terse"` with confidence 0.94. REGRESSION CHECK PASS.**
- Did style hold sticky? **YES** — every subsequent turn reaffirmed terse signals; sticky_style stayed "terse" throughout. No hysteresis flips needed.
- Did the orchestrator pass `customer_style="terse"` to the phraser on every subsequent turn? **YES** (Turns 1-8)
- Did the conversation exceed 15 turns? **No** (9 turns; in expected 4-15 range)
- Did any state self-loop more than 2x? **No** (zero self-loops; clean linear traversal)
- Did the bot self-disclose AI status correctly when asking_if_human fired? **N/A** (Brad never asked)
- Did the bot mirror emoji? **N/A** (Brad used none; acknowledge_emoji stayed false)
- Did the bot use "by tomorrow morning" only inside SCHEDULE_QUOTE? **YES** (single occurrence, Turn 8)
- Did the phraser fall back to hardcoded text? **No** (zero fallbacks used)
- **Generac-callout regression check: PASS.** Turn 1 outbound contains "Generac 7500" within the first 19 chars, satisfying the volunteered_data passthrough requirement that was the original Brad-as-gap motivator in batch 1.
- Acknowledgment-rhythm rule: bot used 1 distinct ack phrase across the run ("got it" x2 — Turn 5 and Turn 8) + zero-ack on 6 turns. TERSE expects ~30% ack rate — actual 22% (2/9 outbounds with explicit ack). Identical to v3 baseline.

---

## v5 regression evaluation

**Style-detection accuracy:**
- Detected: terse (confidence 0.94)
- Expected: terse
- Match: **YES**
- **REGRESSION CHECK 1: PASS**

**Generac-callout passthrough:**
- volunteered_data flagged on Turn 1 inbound: YES ("customer also said it's a Generac 7500W")
- Generac/7500 acknowledged on Turn 1 outbound: YES ("Generac 7500, solid.")
- Acknowledgment fit within terse 35-80 char target: YES (67 chars total including the question)
- **REGRESSION CHECK 2: PASS**

**Register-application correctness:**
- Turn 0: default (pre-detection) — correct
- Turns 1-8: terse phraser variant invoked — correct
- No bleed-through (no warm/educational/buddy phrasing leaked into outbound) — correct
- Average length 50.8 chars (target 50, range 35-80) — within band
- No drift from v3 baseline — output matches v3 transcript turn-for-turn

**Variant fingerprint check (TERSE target):**
- Average message length (Turns 1-8): **50.8 chars** (target 50, range 35-80). PASS.
- Acknowledgment rate: **22%** (target ~30%). Slightly under but defensible — Brad's burst-texter style invites bare-question replies, and skipping the ack gives the rhythm room to breathe.
- Question style: bare ("own or rent the place?", "best email for the quote?"). PASS.
- Voice: contractor-on-the-job. PASS — fragments dominate, lowercase casual, drops pronouns/helpers.

---

## Scoring (this run)

- **State machine score: 10/10** — clean linear traversal, no retries, no detours.
- **Classifier score: 10/10** — all confidences 0.92+; volunteered_data + style both flagged correctly on Turn 1; no schema violations; style sticky-reaffirmation correct on Turns 2-9.
- **Orchestrator score: 10/10** — persisted `customer_style="terse"` from Turn 1 onward; routed every subsequent phraser call through the terse register; passed volunteered_data through cleanly on the style-switch turn.
- **Voice score: 8/10** — TERSE register cleanly executed; Generac callout preserved despite character budget; only deduction is acknowledgment rate slightly below 30% target (22% — leans more bare-question than rhythm rule prescribes). Reads convincingly as Key on a job site between calls. Identical to v3 baseline (no regression, no improvement).
- **Generac-callout-quality: 9/10** — "Generac 7500, solid." is 19 chars of brand-acknowledgment that feels like Key actually heard the customer, not robot pattern-matching.

## Reviewer notes

(Empty until human review — Key fills this in)

The v5 regression for this run was whether the locked v3 register-switching architecture still holds Brad's two headline tests on the current prompt set: terse style detection on Turn 1 and Generac volunteered_data passthrough on the same turn boundary as the register switch. Result: classifier emitted `style="terse"` with 0.94 confidence in the same payload that flagged `volunteered_data: "Generac 7500W"`; orchestrator persisted the style; the AWAIT_240V phraser ran the terse register; output opened with "Generac 7500, solid." (19 chars) and pivoted to the 240v question in 47 chars — total 67 chars, well under the 80-char terse ceiling. Both subsystems fired cleanly without interference. No drift from v3 baseline — same terminal, same turn count, same average char length, same voice score. Locked prompts are still locked.
