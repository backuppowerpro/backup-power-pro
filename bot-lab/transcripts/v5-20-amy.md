# Persona 20 — Amy ("i'll send it tonight when i get home") — v5

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 20
**Expected terminal:** COMPLETE (after deferred photo)
**Actual terminal:** COMPLETE
**Turns:** 14
**Status:** PASS
**Iteration:** v5 (new `photo_will_send_later` classifier label + phraser "no-pressure soft-pause" intent + state machine self-loop on AWAIT_PANEL_PHOTO; resumes on next-day photo)
**Prior runs:** none — this is the first persona-20 run

---

## What's new in v5

Adds first-class handling for the deferred-photo case. Before v5, "i'm at work,
will send tonight" landed on `unclear` and the state machine self-looped on
AWAIT_PANEL_PHOTO without a sanctioned phraser intent, often producing a
re-prompt that read as pressure. v5 ships:

- **Classifier label `photo_will_send_later`** — fires when the customer
  explicitly defers a photo with a future-tense send commitment ("tonight",
  "tomorrow morning", "when I get home", "after work"). Distinct from
  `photo_refused` (can't / won't) and `unclear` (filler / no commitment).
- **State machine transition** — `photo_will_send_later` self-loops on
  AWAIT_PANEL_PHOTO and AWAIT_OUTLET_PHOTO with intent "photo will send later
  (customer deferred)" and `onEnter: { schedule_24h_reminder: true }`. The
  reminder fires from a separate cron, not in-conversation.
- **Phraser intent "photo will send later"** — sanctions a no-pressure
  acknowledgment ("No worries — just text it over when you get a chance.").
  Hard-constrained to NEVER ask "when exactly", NEVER repeat the panel-photo
  request, NEVER use countdown phrasing.
- **Resumption protocol** — orchestrator narrates `[next day]` and emits the
  `__photo_received__` synthetic event. The bot continues from the same
  AWAIT_PANEL_PHOTO state to SCHEDULE_QUOTE without a fresh greeting (per
  ARCHITECTURE.md state-row continuity rule).

Amy's whole point is to stress-test that the bot **does not blow this**. She
is a happy-path qualified lead temporarily blocked by the time of day. Any
pressure on Turn 9 risks her ghosting the conversation — that's the failure
mode v5 prevents.

---

## Style call

Amy's first reply ("yeah, go ahead") and ongoing replies are short,
lowercase, cooperative, no chitchat, no confusion. Reads close to terse, but
her messages are 2-5 words with consistent punctuation/lowercase mix and she
never burst-texts. Per classifier STYLE INFERENCE rules, terse requires
"<6 words, all lowercase, no punctuation" with high-context jumping. Amy is
brief but not terse-by-spec — closest match is **default**. Sticky default
holds through the conversation.

Counter-argument: a reviewer might call this terse because of length alone.
But the persona spec calls Amy "brief, cooperative, no fuss" not "terse" —
and the v3 corpus distinguishes "concise default" from "terse" exactly along
the punctuation+context-jumping axis. Default is the right call; her replies
fit comfortably in default's 60-130 char ack-rate envelope on the bot side.

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Amy, BPP here — got your form. Couple quick questions so our electrician Key can put your quote together?

- length: 110 chars (in 80-140 GREETING target)
- customer_style: not yet set (Turn 0 — register is default for the greeting per phraser GREETING dispatch rule)
- prior_acknowledgments going in: []
- ack used: none (GREETING opener)
- regex sweeps: /\$\d/ none · weekday none · first-person none · "Awesome." none · countdown none · banned-corporate none — PASS

### Turn 1 — customer
yeah, go ahead

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.95
- inferred_customer_style: "default"
- notes: brief affirmative, lowercase but with punctuation, no slang, no chitchat, no confusion, no impatience, no length-pressure. Not terse-by-spec (terse requires no punctuation + multi-fact burst per STYLE INFERENCE rules). Maps to default.

### Turn 1 — state machine
GREETING → AWAIT_240V

### Turn 1 — bot (AWAIT_240V) — register: default
Cool. Does your generator have a big 240-volt outlet (the kind your dryer plugs into) or just regular 120-volt outlets?

- length: 117 chars (in 60-130 default target)
- customer_style: default
- prior_acknowledgments going in: []
- ack used: "Cool."
- prior_acknowledgments rolling out: ["Cool."]
- regex sweeps: clean — PASS

### Turn 2 — customer
240, dryer plug style

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.97
- notes: confident confirmation that mirrors the bot's framing back ("dryer plug style" echoes the question's "kind your dryer plugs into"). Clean gen_240v.

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET

### Turn 2 — bot (AWAIT_OUTLET) — register: default
Got it. 30-amp (smaller 3-prong twist) or 50-amp (bigger 4-prong)?

- length: 64 chars (in 60-130 default target — bare end)
- customer_style: default (sticky)
- prior_acknowledgments going in: ["Cool."]
- ack used: "Got it." (≠ "Cool." — rhythm rule satisfied)
- prior_acknowledgments rolling out: ["Cool.", "Got it."]
- regex sweeps: clean — PASS
- skipped the photo offer in the question — Amy's previous reply was confident, so there's no signal she'd need the photo path. Tighter is better here.

### Turn 3 — customer
30 amp, the smaller one

### Turn 3 — classifier
- state: AWAIT_OUTLET
- label: outlet_30a
- confidence: 0.97
- notes: clean outlet_30a — explicit "30 amp" with confirming descriptor "the smaller one" mirroring the bot's framing.

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP

### Turn 3 — bot (AWAIT_OWNERSHIP) — register: default
Right on. Own the place or rent? (Owner has to sign off on panel work.)

- length: 70 chars (in 60-130 default target)
- customer_style: default (sticky)
- prior_acknowledgments going in: ["Cool.", "Got it."]
- ack used: "Right on." (≠ "Cool." / "Got it." — rhythm rule satisfied)
- prior_acknowledgments rolling out: ["Got it.", "Right on."]
- regex sweeps: clean — PASS

### Turn 4 — customer
own it

### Turn 4 — classifier
- state: AWAIT_OWNERSHIP
- label: owner
- confidence: 0.96
- notes: bare confirmation. Two words but with no other signals (not terse-burst, not confusion, not chitchat). Sticky default holds.

### Turn 4 — state machine
AWAIT_OWNERSHIP → AWAIT_RUN

### Turn 4 — bot (AWAIT_RUN) — register: default
Sounds good. How far is the generator gonna sit from your panel? Under 15ft, 15-30ft, or longer?

- length: 96 chars (in 60-130 default target)
- customer_style: default (sticky)
- prior_acknowledgments going in: ["Got it.", "Right on."]
- ack used: "Sounds good." (≠ "Got it." / "Right on." — rhythm rule satisfied)
- prior_acknowledgments rolling out: ["Right on.", "Sounds good."]
- regex sweeps: clean — PASS

### Turn 5 — customer
about 12 feet

### Turn 5 — classifier
- state: AWAIT_RUN
- label: run_short
- confidence: 0.95
- notes: 12ft is comfortably under 15ft, clean run_short.

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL

### Turn 5 — bot (AWAIT_EMAIL) — register: default
Yep. What's the best email for the quote?

- length: 41 chars (short clean ask, under default's 60-char floor — acceptable for one-line ask after acknowledgment, same pattern as Trevor v3 Turn 7)
- customer_style: default (sticky)
- prior_acknowledgments going in: ["Right on.", "Sounds good."]
- ack used: "Yep." (≠ "Right on." / "Sounds good." — rhythm rule satisfied)
- prior_acknowledgments rolling out: ["Sounds good.", "Yep."]
- regex sweeps: clean — PASS

### Turn 6 — customer
amy.tyson@yahoo.com

### Turn 6 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.99
- extracted_value: amy.tyson@yahoo.com
- email_typo_suspected: false (yahoo.com is clean — no typo flag fires)

### Turn 6 — state machine
AWAIT_EMAIL + email_provided + email_typo_suspected=false → AWAIT_ADDRESS_CONFIRM (skips CHECK_EMAIL_TYPO)

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM) — register: default
Alright. Install address — 118 Westbrook Drive, Greer SC 29651, or somewhere else?

- length: 81 chars (in 60-130 default target)
- customer_style: default (sticky)
- prior_acknowledgments going in: ["Sounds good.", "Yep."]
- ack used: "Alright." (≠ "Sounds good." / "Yep." — rhythm rule satisfied)
- prior_acknowledgments rolling out: ["Yep.", "Alright."]
- address_on_file passed correctly into phraser input
- regex sweeps: clean — PASS

### Turn 7 — customer
yep that's it

### Turn 7 — classifier
- state: AWAIT_ADDRESS_CONFIRM
- label: address_confirmed
- confidence: 0.97

### Turn 7 — state machine
AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO

### Turn 7 — bot (AWAIT_PANEL_PHOTO) — register: default
Could you snap a pic of your main panel with the door open? Helps Key size up the install.

- length: 91 chars (in 60-130 default target)
- customer_style: default (sticky)
- prior_acknowledgments going in: ["Yep.", "Alright."]
- ack used: none (skipping ack is acceptable per voice rule; rhythm rule satisfied trivially when no ack used)
- prior_acknowledgments rolling out: ["Alright.", "(none)"]
- regex sweeps: clean — PASS

### Turn 8 — customer
i'm at work, i'll send it tonight when i get home

### Turn 8 — classifier
- state: AWAIT_PANEL_PHOTO
- label: photo_will_send_later
- confidence: 0.97
- notes: textbook v5 case — explicit deferral with future-tense send commitment ("send it tonight when I get home"). Not photo_refused (no refusal language: no "can't", "don't know how", "won't"). Not unclear (an explicit commitment was made). Not asking_for_human / off_topic_question / friendly_chitchat. Distinguishing signal per classifier spec: future-tense + send verb + relative time anchor = `photo_will_send_later`.

### Turn 8 — state machine
AWAIT_PANEL_PHOTO → AWAIT_PANEL_PHOTO (self-loop, soft-pause)
- intent: "photo will send later (customer deferred)"
- onEnter: { schedule_24h_reminder: true } — the reminder fires from a separate cron, not in-conversation. The bot does NOT prompt again within this conversation.

### Turn 8 — bot (AWAIT_PANEL_PHOTO, self-loop — soft-pause) — register: default
No worries — just text it over when you get a chance. We'll hold the spot.

- length: 73 chars (in 60-130 default target)
- customer_style: default (sticky)
- prior_acknowledgments going in: ["Alright.", "(none)"]
- ack used: "No worries" (warmth-budget ack matching voice corpus exemplar 7 register "No worries — take your time"; ≠ "Alright." — rhythm rule satisfied)
- prior_acknowledgments rolling out: ["(none)", "No worries"]
- regex sweeps: /\$\d/ none · weekday none · first-person none · "Awesome." none · countdown none · banned-corporate none — PASS
- **HARD CHECK — no-pressure intent enforced:**
  - did NOT ask "when exactly" — PASS
  - did NOT repeat the panel-photo request — PASS
  - did NOT use countdown phrasing ("almost done", "last thing") — PASS
  - did NOT use "by tomorrow morning" or any specific time anchor — PASS
  - did NOT guilt-trip ("we really need this", "won't be able to quote without it") — PASS
  - "We'll hold the spot" is a passive reassurance, not a commitment — PASS (no specific timeframe, no schedule promise)
- **Soft-pause quality:** the message reads as a real contractor would write it — voice corpus exemplar 7 ("No worries — take your time. Just text when y'all are ready.") is the direct register match. No service-bro warmth performative ("totally understand!"), no SaaS-ish reassurance ("we appreciate your patience"). Just the right ratio of "you do you" + "we're here when you are".

### Turn 9 — orchestrator narration
[next day]

### Turn 9 — customer
[sends photo of panel]

### Turn 9 — synthetic event (bypasses classifier)
- event: __photo_received__
- routed directly to state machine per orchestrator-agent.md photo-event protocol
- conversation continuity: state row persisted unchanged across the day-gap (no fresh greeting needed per ARCHITECTURE.md state-row continuity rule). The 24h cron-scheduled reminder did NOT need to fire because the photo arrived inside the reminder window.

### Turn 9 — state machine
AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE
- onEnter: { complete: true } — qualified-lead notification fires for Key

### Turn 9 — bot (SCHEDULE_QUOTE) — register: default
Got the photo, thanks. Key will look it over and have your quote to you by tomorrow morning. Talk soon.

- length: 105 chars (in 60-130 default target)
- customer_style: default (sticky)
- prior_acknowledgments going in: ["(none)", "No worries"]
- ack used: "Got the photo, thanks" (substantive ack mirroring voice corpus exemplar 11 register "Got the photo, that's a Cutler-Hammer panel"; ≠ "No worries" — rhythm rule satisfied)
- prior_acknowledgments rolling out: ["No worries", "Got the photo, thanks"]
- regex sweeps: /\$\d/ none · weekday none · first-person none · "Awesome." none · countdown none · banned-corporate none — PASS
- "by tomorrow morning" — the ONE sanctioned timeframe per phraser rules (no weekday name, no specific time)
- third-person Key discipline: "Key will look it over" not "I'll look it over"
- did NOT acknowledge or apologize for the day-gap ("thanks for getting that over!" / "appreciate the patience" — both would be SaaS-ish over-disclosure of the soft-pause from the bot side). The bot just continues the flow as if no time has passed — exactly right.

### Turn 10 — customer
sounds good, thanks!

### Turn 10 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.93

### Turn 10 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal)

---

## Per-turn flag log

| Turn | State | Hard-constraint pass | Length | Register | Rhythm rule | Notes |
|---|---|---|---|---|---|---|
| 0 | GREETING | PASS | 110 (80-140 ok) | default (Turn 0 dispatch) | n/a (greeting) | "our electrician Key" third-person; opener variant 1 |
| 1 | AWAIT_240V | PASS | 117 (60-130 ok) | default | PASS | "Cool." ack |
| 2 | AWAIT_OUTLET | PASS | 64 (60-130 ok bare end) | default | PASS (Got it. ≠ Cool.) | tight ask, no photo offer (no signal she'd need it) |
| 3 | AWAIT_OWNERSHIP | PASS | 70 (60-130 ok) | default | PASS (Right on. ≠ Cool./Got it.) | clean ownership question with reason |
| 4 | AWAIT_RUN | PASS | 96 (60-130 ok) | default | PASS (Sounds good. ≠ Got it./Right on.) | clean tri-option |
| 5 | AWAIT_EMAIL | PASS | 41 (short clean ask) | default | PASS (Yep. ≠ Right on./Sounds good.) | tight ask |
| 6 | AWAIT_ADDRESS_CONFIRM | PASS | 81 (60-130 ok) | default | PASS (Alright. ≠ Sounds good./Yep.) | repeats address back per intent |
| 7 | AWAIT_PANEL_PHOTO | PASS | 91 (60-130 ok) | default | PASS (no ack used) | direct request, no preamble |
| 8 | AWAIT_PANEL_PHOTO (self-loop, soft-pause) | PASS | 73 (60-130 ok) | default | PASS (No worries ≠ Alright./none) | **v5 critical turn — see no-pressure check below** |
| 9 | SCHEDULE_QUOTE | PASS | 105 (60-130 ok) | default | PASS (Got the photo, thanks ≠ No worries/none) | "by tomorrow morning" sanctioned; no day-gap acknowledgment |

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **PASS** — COMPLETE reached at Turn 10 (after a `[next day]` narration between Turn 8 and Turn 9)
- Did any phraser output violate a hard constraint?
  - /\$\d/ — **none**
  - weekday names (Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday) — **none** (only "by tomorrow morning" in SCHEDULE_QUOTE, sanctioned)
  - "I'm Key" / "this is Key personally" / "I'll be there" / "I can install" — **none** ("our electrician Key", "Key will look it over", "Key size up the install")
  - length >280 — **none** (max 117 chars)
  - banned corporate ("I appreciate", "rest assured", "feel free to", "thank you for your interest", "happy to help", "circle back") — **none**
  - "Awesome." anywhere — **none**
  - countdown phrasing ("two more", "three more", "few more", "last quick", "almost done", "few more questions") — **none**
  - prior_acknowledgments rhythm rule — tracked per turn; **0 violations**
  - multiple "?" stacked — **none** (every turn has at most 1 question mark)
  - more than 1 emoji — **none** (acknowledge_emoji = false throughout; bot uses 0 emoji)
- Did any classifier output have confidence <0.6 on a critical state? **NO** (lowest was 0.93 on Turn 10 SCHEDULE_QUOTE → COMPLETE wrap)
- Did the conversation exceed 15 turns? **NO** (10 turns + 1 narrative `[next day]` marker, in expected 4-15 band)
- Did any state self-loop more than 2x? **NO** (AWAIT_PANEL_PHOTO entered once + 1 self-loop on photo_will_send_later, then exited via photo_received synthetic event — under 4x stuck threshold)
- Did the bot self-disclose AI status? **N/A** — `asking_if_human` did not fire (Amy doesn't ask)
- Did the bot accept volunteered_data correctly? **N/A** — Amy never volunteered extra data alongside a routing answer
- Was customer_style detected and persisted? **YES** — "default" emitted Turn 1, sticky through Turns 2-10
- Did the day-gap break the state row? **NO** — state row persisted across `[next day]` narration; resumed cleanly at AWAIT_PANEL_PHOTO with __photo_received__ event

---

## v5 critical-turn audit — Turn 8 (the `photo_will_send_later` moment)

This is the entire reason persona 20 exists. The bot's Turn 8 reply must:

1. **Classifier-side:** emit `photo_will_send_later` (NOT `unclear`, NOT `photo_refused`, NOT `asking_for_human`).
2. **State machine:** self-loop on AWAIT_PANEL_PHOTO with soft-pause intent (NOT advance, NOT escalate to NEEDS_CALLBACK).
3. **Phraser:** apply the "photo will send later" intent — accept gracefully, no pressure.

Audit:

| Requirement | Result | Evidence |
|---|---|---|
| Classifier emits `photo_will_send_later` | **YES** | label = photo_will_send_later, confidence 0.97, future-tense send commitment recognized |
| State machine self-loops AWAIT_PANEL_PHOTO | **YES** | from: AWAIT_PANEL_PHOTO, to: AWAIT_PANEL_PHOTO; onEnter: { schedule_24h_reminder: true } |
| Phraser does NOT pressure | **YES** | "No worries — just text it over when you get a chance. We'll hold the spot." |
| Phraser does NOT ask "when exactly" | **YES** | no time-anchor question; passive "when you get a chance" |
| Phraser does NOT repeat the panel-photo request | **YES** | does not say "send the panel photo" / "the picture of the panel" / re-ask the original ask |
| Phraser does NOT use countdown ("almost done") | **YES** | no countdown phrasing |
| Phraser does NOT use specific timeframe ("by tomorrow morning") | **YES** | "we'll hold the spot" is open-ended, not a commitment |
| Phraser does NOT guilt-trip | **YES** | no "we really need this", no "the quote can't go out without it" |
| Voice register matches default + voice corpus | **YES** | "No worries — just text it over when you get a chance" mirrors voice corpus exemplar 7 register |

**Soft-pause quality: 10/10.** The reply reads exactly like exemplar 7 ("No
worries — take your time. Just text when y'all are ready.") with the panel-photo
context substituted. It's the right warmth-to-restraint ratio: warm enough to
make Amy feel okay deferring, restrained enough not to feel performatively
patient.

---

## Resumption audit — Turn 9 (the `[next day]` recovery)

After the day-gap, the bot must:

1. Continue from AWAIT_PANEL_PHOTO (no fresh greeting, no re-asking previous slots)
2. Accept the photo via the synthetic `__photo_received__` event
3. Transition to SCHEDULE_QUOTE
4. NOT acknowledge the day-gap explicitly ("thanks for getting that over!" reads as the bot tracking time-of-arrival, which is creepy)
5. NOT apologize for the wait ("appreciate the patience" — banned corporate phrase pattern)
6. Send the standard SCHEDULE_QUOTE wrap with "by tomorrow morning"

Audit:

| Requirement | Result | Evidence |
|---|---|---|
| State row continuity across `[next day]` | **YES** | bot resumes at AWAIT_PANEL_PHOTO; no fresh GREETING |
| Photo accepted via __photo_received__ event | **YES** | state machine transitions AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE |
| Standard SCHEDULE_QUOTE wrap with sanctioned timeframe | **YES** | "by tomorrow morning" used, no weekday name |
| No day-gap acknowledgment from bot | **YES** | "Got the photo, thanks." mirrors voice corpus 11 register; no "thanks for sending that over so fast / so late / overnight" framing |
| No apology for the wait | **YES** | no "appreciate the patience", no "thanks for getting back" |
| Third-person Key discipline | **YES** | "Key will look it over" |

**Resumption quality: 10/10.** Indistinguishable from a same-day wrap-up.
The bot doesn't reveal that any time passed — which is correct, because the
reminder cron is what tracks time, not the conversation surface.

---

## Stress-test outcomes (from persona spec)

Persona 20 explicitly tests four behaviors. All four pass in v5:

1. New `photo_will_send_later` classifier label fires correctly — **PASS** (Turn 8, conf 0.97)
2. Phraser's "no worries, just text when you can" intent applied — **PASS** (Turn 8 output is the canonical example from phraser-agent.md SPECIAL INTENT HANDLING)
3. Bot does NOT pressure, does NOT ask "when exactly" — **PASS** (audit table above)
4. Soft-pause + later resumption (state row persists across day gap, photo arrival continues to COMPLETE) — **PASS** (Turn 9 resumption audit above)

---

## v4 → v5 delta

| Surface | v4 | v5 | Why it matters |
|---|---|---|---|
| Classifier labels | (no `photo_will_send_later`; deferral landed on `unclear`) | new label `photo_will_send_later` for explicit future-tense send commitments | Distinguishes deferral from filler; unlocks the soft-pause path |
| State machine | AWAIT_PANEL_PHOTO unclear → self-loop with generic re-ask | AWAIT_PANEL_PHOTO photo_will_send_later → self-loop with onEnter { schedule_24h_reminder } | Bot stops re-prompting in-conversation; reminder cron handles 24h follow-up |
| Phraser intent | (no "photo will send later" intent) | new intent "photo will send later" with hardcoded no-pressure constraints | Sanctioned phrasing; hard checks against pressure / re-ask / countdown |
| Resumption protocol | implicit | explicit — `[next day]` narration + __photo_received__ event continues from existing state row | Tests that long gaps don't break flow (latches onto Beverly's persona-08 latency pattern but extends to multi-day) |
| Turns | n/a (gap) | 10 turns + 1 narration | Within expected 4-15 band even with the day-gap |
| Terminal | n/a (gap) | COMPLETE | First successful run of this scenario |

State machine + classifier + phraser additions are all backwards-compatible:
no existing persona's path changes. v5 is purely additive.

---

## Voice score

**10/10.**

- All hard constraints pass (regex sweep clean across 10 phraser outputs)
- Register detected correctly (default) and applied consistently across day-gap
- Acknowledgment rhythm clean (no repeats in last-2 window across 10 turns)
- Voice corpus echoes hit naturally and CRITICALLY at Turn 8: "No worries — just text it over when you get a chance" mirrors corpus exemplar 7 ("No worries — take your time. Just text when y'all are ready.")
- The `photo_will_send_later` flow is the persona's stress test and is handled with PERFECT restraint: no pressure, no re-ask, no countdown, no time-anchor question
- The `[next day]` resumption is invisible from the customer's POV — bot just continues as if no time passed (correct behavior; reminder cron tracks time)
- No countdown phrasing, no first-person Key, no banned corporate phrases
- Length distribution matches default register (41-117 chars, mostly 64-110)
- Third-person Key discipline held throughout ("our electrician Key", "Key size up the install", "Key will look it over")
- "by tomorrow morning" used correctly and only in SCHEDULE_QUOTE (sanctioned timeframe per phraser rules)

---

## Reviewer notes

(Empty until human review — Key fills this in)

---

## Status line (machine-readable)

```
[v5] Persona 20 (amy) — reached COMPLETE in 10 turns. photo_will_send_later-fired: yes. Bot-pressured: no. Soft-pause-quality 10. Resumed-after-day-gap: yes. Voice 10. Status: PASS.
```
