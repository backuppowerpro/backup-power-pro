# Persona 22 — Jen (Multi-Photo Burst) — v5

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 22
**Lab batch:** v5 (multi-photo burst handling — P35)
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 10
**Detected customer_style:** default
**Expected customer_style:** default
**Register applied:** yes (60-130 char target, 50-70% ack rate)
**Status:** PASS

---

## What this persona stress-tests

- **P35 multi-photo handling.** Jen sends THREE MMS attachments in a burst at the AWAIT_PANEL_PHOTO step (garage / side of house / panel with door open) plus a follow-up text "let me know if you need anything else".
- **Orchestrator emits 3× `__photo_received__` synthetic events** — one per attachment.
- **State machine semantics:** the FIRST `__photo_received__` event transitions AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE. The SECOND and THIRD events arrive AFTER the state has already advanced and are NOT a new transition — orchestrator appends each to `qualification_data.extra_photos[]` per architecture P35 (first valid photo wins; subsequent photos appended for Key's reference).
- **Bot must accept all three gracefully.** No apology for surplus, no "we just need the panel one — please re-send", no confusion. The phraser at SCHEDULE_QUOTE acknowledges the photo set as a whole and continues.
- **Final follow-up "let me know if you need anything else"** arrives at COMPLETE state. Bot does not respond (terminal). The architecture's terminal-state rule treats any post-COMPLETE inbound as a Key-handles-personally event.

---

## Role-isolation note

- **Customer simulator** sees ONLY Jen's ground truth + bot's last outbound + history. Generates eager, slightly anxious "send everything that might be useful" behavior.
- **Classifier** sees ONLY current state + last 1-2 turns + the inbound. Synthetic `__photo_received__` events bypass classifier entirely (per orchestrator-agent.md photo-event protocol — same as v3-07-trevor.md Turn 5).
- **Phraser** sees ONLY intent + first_name + customer_last_message + acknowledge_emoji + address_on_file + volunteered_data + prior_acknowledgments + customer_style. Does not see classifier output, does not pick state.
- **Orchestrator** persists `customer_style` across turns; routes the first `__photo_received__` through the state machine, swallows the next two as P35 appends.

---

## Persona ground truth (orchestrator-only context)

```json
{
  "first_name": "Jen",
  "owner": true,
  "gen_240v": true,
  "outlet_amps": 50,
  "run_feet": 22,
  "email": "jen.olson@gmail.com",
  "address_on_file": "76 Greenwood Court, Greenville SC 29615",
  "address_correct": true,
  "service_area": "Greenville",
  "expected_terminal": "COMPLETE"
}
```

**Style:** Helpful, eager, slightly anxious to do it "right". Mid-length replies, mostly proper capitalization, occasional run-on. No emoji. Wants to over-supply context.

---

## Conversation

### Turn 0 — bot (GREETING — default register, style not yet detected)

Hey Jen, BPP here — got your form. Couple quick questions so our electrician Key can put your quote together?

**Phraser input:**
```json
{
  "intent": "greet by first name as BPP intake, mention our electrician Key will quote, ask if it is a good time for a couple quick questions",
  "customer_first_name": "Jen",
  "customer_last_message": null,
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": [],
  "customer_style": null
}
```
*Constraint check: 110 chars. Mentions BPP + Key third-person + ends in single question. No emoji. PASS.*

---

### Turn 1 — customer

Yes that works! happy to answer whatever you need

### Turn 1 — classifier

```json
{
  "label": "affirmative",
  "confidence": 0.96,
  "inferred_customer_style": "default"
}
```
Reasoning: cooperative reply, mid-length (~50 chars), capitalized, neutral tone with mild eagerness. Not terse (length + capitalization). Not buddy (no southern phrasing or "y'all"). Not educational (no confusion or definitional ask). Default plurality.

**Sticky style update (Turn 1 → set initial):** `sticky_style = "default"`

### Turn 1 — state machine

GREETING → AWAIT_240V (intent: ask whether their generator has a 240-volt outlet)

### Turn 1 — bot (AWAIT_240V) — register: default

Cool. Does your generator have the big 240-volt outlet (the kind your dryer plugs into), or just regular 120-volt outlets?

**Phraser input:**
```json
{
  "intent": "ask whether their generator has a 240-volt outlet (the kind a clothes-dryer plugs into) or only 120-volt household outlets",
  "customer_first_name": "Jen",
  "customer_last_message": "Yes that works! happy to answer whatever you need",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": [],
  "customer_style": "default"
}
```
*Constraint check: 117 chars (in default 60-130 band). Single ?. No banned phrases. Ack "Cool." not in prior_acks. PASS. prior_acks rolling out: ["Cool."]*

---

### Turn 2 — customer

It does have the big one yeah, looks like the 4-prong round one

### Turn 2 — classifier

```json
{
  "label": "gen_240v",
  "confidence": 0.95,
  "inferred_customer_style": "default"
}
```
Volunteered_data detected by orchestrator: customer described 4-prong round outlet → matches 50A NEMA L14-50. Pass to phraser as "customer also said it looks like the 4-prong round one (matches 50A)".

**Sticky style:** `default` (reaffirmed).

### Turn 2 — state machine

AWAIT_240V → AWAIT_OUTLET (intent: ask if 30A or 50A, with volunteered context)

### Turn 2 — bot (AWAIT_OUTLET) — register: default

Got it — 4-prong round is the 50-amp setup. Just confirming: 50A sound right?

**Phraser input:**
```json
{
  "intent": "ask if the 240v outlet is a 30-amp (smaller, looks like 3-prong twist-lock) or 50-amp (bigger, 4-prong) — note that if they don't know, ask them to send a photo",
  "customer_first_name": "Jen",
  "customer_last_message": "It does have the big one yeah, looks like the 4-prong round one",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": "customer described 4-prong round outlet (matches 50A NEMA L14-50)",
  "prior_acknowledgments": ["Cool."],
  "customer_style": "default"
}
```
*Constraint check: 75 chars. Acknowledges volunteered_data ("4-prong round is the 50-amp setup") rather than re-asking blindly. Single ?. Ack "Got it." not in prior. PASS. prior_acks rolling out: ["Cool.", "Got it."]*

---

### Turn 3 — customer

Yep that's the one, 50 amp

### Turn 3 — classifier

```json
{
  "label": "outlet_50a",
  "confidence": 0.98,
  "inferred_customer_style": "default"
}
```

**Sticky style:** `default` (reaffirmed).

### Turn 3 — state machine

AWAIT_OUTLET → AWAIT_OWNERSHIP (intent: ask if they own or rent)

### Turn 3 — bot (AWAIT_OWNERSHIP) — register: default

Perfect. Do you own the place or rent? (Owner has to sign off on panel work.)

**Phraser input:**
```json
{
  "intent": "ask if they own the home or rent (because owner approval is required for panel work)",
  "customer_first_name": "Jen",
  "customer_last_message": "Yep that's the one, 50 amp",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": ["Cool.", "Got it."],
  "customer_style": "default"
}
```
*Constraint check: 76 chars. Single ?. Ack "Perfect." not in prior. PASS. prior_acks rolling out: ["Got it.", "Perfect."]*

---

### Turn 4 — customer

We own it, bought the house in 2019

### Turn 4 — classifier

```json
{
  "label": "owner",
  "confidence": 0.98,
  "inferred_customer_style": "default"
}
```
Volunteered context (purchase year) is conversational color, not a structured slot — no volunteered_data passthrough.

**Sticky style:** `default` (reaffirmed).

### Turn 4 — state machine

AWAIT_OWNERSHIP → AWAIT_RUN (intent: ask roughly how far generator will sit from electrical panel)

### Turn 4 — bot (AWAIT_RUN) — register: default

Roughly how far will the generator sit from your panel — under 15ft, 15-30ft, or longer?

**Phraser input:**
```json
{
  "intent": "ask roughly how far the generator will sit from the electrical panel — short under 15ft, medium 15-30ft, or longer than 30ft",
  "customer_first_name": "Jen",
  "customer_last_message": "We own it, bought the house in 2019",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": ["Got it.", "Perfect."],
  "customer_style": "default"
}
```
*Constraint check: 89 chars. Single ?. NO ack this turn — rhythm rule applied (varied from prior 2 acks; skipping is preferable). PASS. prior_acks rolling out: ["Perfect.", null]*

---

### Turn 5 — customer

Probably about 22 feet, give or take a couple

### Turn 5 — classifier

```json
{
  "label": "run_medium",
  "confidence": 0.97,
  "inferred_customer_style": "default"
}
```

**Sticky style:** `default` (reaffirmed).

### Turn 5 — state machine

AWAIT_RUN → AWAIT_EMAIL (intent: ask for the best email to send the quote to)

### Turn 5 — bot (AWAIT_EMAIL) — register: default

Sounds good. What's the best email for the quote?

**Phraser input:**
```json
{
  "intent": "ask for the best email to send the quote to",
  "customer_first_name": "Jen",
  "customer_last_message": "Probably about 22 feet, give or take a couple",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": ["Perfect.", null],
  "customer_style": "default"
}
```
*Constraint check: 51 chars (under 60-char default floor — acceptable for clean one-line email ask). Single ?. Ack "Sounds good." not in prior. PASS. prior_acks rolling out: [null, "Sounds good."]*

---

### Turn 6 — customer

jen.olson@gmail.com

### Turn 6 — classifier

```json
{
  "label": "email_provided",
  "confidence": 0.99,
  "extracted_value": "jen.olson@gmail.com",
  "email_typo_suspected": false,
  "inferred_customer_style": "default"
}
```
Domain `gmail.com` is clean — no typo flag fires.

**Sticky style:** `default` (reaffirmed).

### Turn 6 — state machine

AWAIT_EMAIL + email_provided + email_typo_suspected=false → AWAIT_ADDRESS_CONFIRM (skips CHECK_EMAIL_TYPO; intent: confirm install address)

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM) — register: default

Got that. Install address — 76 Greenwood Court, Greenville SC 29615, or somewhere different?

**Phraser input:**
```json
{
  "intent": "confirm the install address using the value already on file from the form (passed in via slots.address_on_file) — ask if it matches or if it should be different",
  "customer_first_name": "Jen",
  "customer_last_message": "jen.olson@gmail.com",
  "acknowledge_emoji": false,
  "address_on_file": "76 Greenwood Court, Greenville SC 29615",
  "volunteered_data": null,
  "prior_acknowledgments": [null, "Sounds good."],
  "customer_style": "default"
}
```
*Constraint check: 93 chars. Single ?. Ack "Got that." not in prior (vary from "Got it."). Address echoed back verbatim. PASS. prior_acks rolling out: ["Sounds good.", "Got that."]*

---

### Turn 7 — customer

Yes that's the right address!

### Turn 7 — classifier

```json
{
  "label": "address_confirmed",
  "confidence": 0.97,
  "inferred_customer_style": "default"
}
```

**Sticky style:** `default` (reaffirmed).

### Turn 7 — state machine

AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO (intent: ask for photo of main electrical panel with door open)

### Turn 7 — bot (AWAIT_PANEL_PHOTO) — register: default

Could you snap a pic of your main electrical panel with the door open? Helps Key size up the install.

**Phraser input:**
```json
{
  "intent": "ask for a photo of their main electrical panel with the door open so Key can size up the install",
  "customer_first_name": "Jen",
  "customer_last_message": "Yes that's the right address!",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": ["Sounds good.", "Got that."],
  "customer_style": "default"
}
```
*Constraint check: 100 chars. Single ?. No ack (skip — rhythm rule; "Sounds good." and "Got that." used recently). No countdown phrasing ("Last thing on our end" / "One last quick" — banned). PASS. prior_acks rolling out: ["Got that.", null]*

---

### Turn 8 — customer (BURST — three MMS + one text)

[sends photo of garage]
[sends photo of side of house]
[sends photo of panel with door open]
let me know if you need anything else

### Turn 8 — synthetic events (P35 MULTI-PHOTO HANDLING)

Three `__photo_received__` events fire in sequence as MMS attachments arrive (orchestrator simulates production webhook order):

```
event 1: __photo_received__ (attachment_url = mms_garage.jpg)
event 2: __photo_received__ (attachment_url = mms_side_of_house.jpg)
event 3: __photo_received__ (attachment_url = mms_panel_door_open.jpg)
text: "let me know if you need anything else" (arrives debounced after MMS burst)
```

**Orchestrator P35 routing logic:**

- **Event 1 (garage photo)** — current state is `AWAIT_PANEL_PHOTO`. State machine transitions to `SCHEDULE_QUOTE`. `qualification_data.panel_photo_url` is set to mms_garage.jpg (FIRST valid photo wins per P35). Phraser is queued to render the SCHEDULE_QUOTE intent.
- **Event 2 (side of house)** — current state is now `SCHEDULE_QUOTE` (post-transition, terminal-bound). The state machine does NOT re-transition. Per P35, orchestrator appends mms_side_of_house.jpg to `qualification_data.extra_photos[]`. No new outbound is generated. Phraser is NOT re-invoked.
- **Event 3 (panel door open)** — same as Event 2. Appended to `qualification_data.extra_photos[]`. No new outbound.
- **Text "let me know if you need anything else"** — arrives after the photo burst. Per the orchestrator's 5-second debounce (architecture P23), the text is grouped with the photo events as one inbound turn. Because the state has already advanced to SCHEDULE_QUOTE on Event 1, this text is NOT classified as a new turn input. The single SCHEDULE_QUOTE outbound (queued from Event 1) addresses both the photos AND the follow-up offer.

**Resulting qualification_data after burst:**
```json
{
  "panel_photo_url": "mms_garage.jpg",
  "extra_photos": [
    "mms_side_of_house.jpg",
    "mms_panel_door_open.jpg"
  ]
}
```

> **Note for Key (review):** the FIRST photo wins by webhook order, which in this case is the garage shot — not the actually-useful panel-door-open shot. This is the documented P35 behavior ("first valid photo wins; subsequent photos appended for Key's reference"). When Key reviews qualification_data manually he'll see all three URLs in the lead notification and pick the panel one. If the production team later wants the bot to be smarter (vision-classify which photo is the panel and promote it to primary), that's a separate scoped feature, not a state-machine concern. For this lab run, the bot's role is just to accept gracefully — which it does.

### Turn 8 — state machine

AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (on Event 1; subsequent events appended per P35)
onEnter: { complete: true }  ← signals Key's "qualified lead" notification fires

### Turn 8 — bot (SCHEDULE_QUOTE) — register: default

Got 'em — Key will look the photos over and have your quote ready by tomorrow morning. Talk soon, Jen.

**Phraser input:**
```json
{
  "intent": "thank them and tell them Key will review the photo and have the quote ready by tomorrow morning. soft commitment — no specific time",
  "customer_first_name": "Jen",
  "customer_last_message": "[sends photo of garage]\n[sends photo of side of house]\n[sends photo of panel with door open]\nlet me know if you need anything else",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": "customer sent multiple photos (garage, side of house, panel) plus a friendly follow-up",
  "prior_acknowledgments": ["Got that.", null],
  "customer_style": "default"
}
```

*Phraser self-check on multi-photo handling:*
- "Got 'em" pluralizes the acknowledgment naturally — covers the burst without singling one photo out, without apologizing, without asking which one is the panel.
- Does NOT say "we just need the panel one — please re-send" (would violate persona's expected-pass criteria + would feel petty).
- Does NOT say "sorry for the confusion" or "no need to send the others" (would imply the surplus was wrong, which it isn't — Key uses extras as reference per P35).
- "Talk soon, Jen" softly closes the offer of "let me know if you need anything else" without re-engaging. The implicit message is: we're set, no more action needed from you, Key will handle from here.

*Constraint check: 102 chars (in default 60-130 band). Single sentence comma-joined. No ?. "by tomorrow morning" is the sanctioned SCHEDULE_QUOTE exception phrase. No weekday names. No "$". No "I'm Key" / "this is Key personally". No "Awesome". No countdown phrasing. No banned phrases. Ack "Got 'em" varies from prior ("Got that." in prior_acks; "'em" plural form not in prior list — rhythm rule satisfied). PASS.*

---

### Turn 9 — customer

Awesome thank you!!

### Turn 9 — classifier

```json
{
  "label": "affirmative",
  "confidence": 0.97,
  "inferred_customer_style": "default"
}
```
Customer's gratitude / wrap-up — closes the loop on SCHEDULE_QUOTE.

**Sticky style:** `default` (final state).

### Turn 9 — state machine

SCHEDULE_QUOTE → COMPLETE (terminal — onEnter: { complete: true } already fired on Turn 8)

### Turn 9 — bot

*[no further outbound — COMPLETE is terminal. Per state-machine.js: COMPLETE has `transitions: {}` and any post-COMPLETE inbound routes to NEEDS_CALLBACK so Key handles personally. None has arrived.]*

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Length (chars) | Voice 1-10 | Notes |
|---|---|---|---|---|---|
| 0 | GREETING | yes | 110 | 9 | clean opener, third-person Key, single ?, fits 80-140 default opener band |
| 1 | AWAIT_240V | yes | 117 | 9 | "Cool." ack + clean question, in 60-130 default band |
| 2 | AWAIT_OUTLET | yes | 75 | 9.5 | volunteered_data acknowledged ("4-prong round is the 50-amp setup") — phraser used customer's own description rather than re-asking blindly |
| 3 | AWAIT_OWNERSHIP | yes | 76 | 9 | "Perfect." vary, single ?, parens for the rationale read natural |
| 4 | AWAIT_RUN | yes | 89 | 9 | NO ack — rhythm rule applied; varied 3 of last 4 turns acked, this one skipped |
| 5 | AWAIT_EMAIL | yes | 51 | 9 | short ask after "Sounds good." ack — under 60-char default floor, acceptable for clean email ask |
| 6 | AWAIT_ADDRESS_CONFIRM | yes | 93 | 9.5 | "Got that." vary from "Got it."; address echoed back verbatim |
| 7 | AWAIT_PANEL_PHOTO | yes | 100 | 9 | NO ack (rhythm), no countdown phrasing, clean photo ask with one-line why-it-matters |
| 8 | SCHEDULE_QUOTE | yes | 102 | 9.5 | **P35 multi-photo handled gracefully** — "Got 'em" pluralized ack covers burst, "by tomorrow morning" sanctioned exception, soft close addresses follow-up offer without re-engaging |
| 9 | COMPLETE | yes (no outbound) | 0 | — | terminal, correct |

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **yes** (COMPLETE in 10 turns counting Turn 9 wrap-up)
- Did any phraser output violate a hard constraint? **no** (no fallback used)
- Did any classifier output have confidence <0.6 on a critical state? **no** (lowest was 0.95)
- Did the conversation exceed 15 turns? **no** (10 turns)
- Did any state self-loop more than 2x? **no**
- Did the bot self-disclose AI status correctly when asking_if_human fired? **n/a — never fired for Jen**
- Did the bot disclose price or weekday? **no** (only sanctioned "by tomorrow morning" on SCHEDULE_QUOTE)
- Did "Awesome" appear in BOT output? **no** (Jen used it on Turn 9, which is allowed per the rule "the customer can use 'awesome', you cannot")
- Did countdown phrasing land in any final output? **no**
- Did emoji appear? **no** (acknowledge_emoji=false throughout — Jen never led with one)

---

## P35 multi-photo audit (v5 specific)

This is the test surface that distinguishes Persona 22 from every other persona in the suite.

| Check | Result | Evidence |
|---|---|---|
| Bot accepted multiple photos gracefully | **yes** | Turn 8 phraser output "Got 'em" — pluralized, no apology, no surplus complaint |
| Bot did NOT ask Jen to re-send only the panel one | **yes** | Turn 8 contains no re-ask, no "we just need", no "please send only the panel" |
| Bot did NOT apologize for surplus | **yes** | No "sorry", no "no need to send the others" anywhere in the bot output |
| Orchestrator emitted 3× `__photo_received__` events | **yes** | Three events, in webhook arrival order |
| Only the FIRST event transitioned state | **yes** | Event 1 → AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE; Events 2 and 3 did NOT re-transition |
| Subsequent events appended to qualification_data.extra_photos[] | **yes** | extra_photos = [mms_side_of_house.jpg, mms_panel_door_open.jpg] |
| Phraser invoked exactly once (not three times) | **yes** | Single SCHEDULE_QUOTE outbound generated; no duplicate sends |
| Customer follow-up text "let me know if you need anything else" handled cleanly | **yes** | Debounced into the same turn as the MMS burst (P23); not re-classified as a new state input |
| onEnter: { complete: true } fired exactly once | **yes** | Triggered on Event 1 transition into SCHEDULE_QUOTE; not re-fired on Events 2-3 |

**P35 verdict:** behaviour matches architecture spec. Bot does not get confused by the burst, does not apologize for the surplus, does not ask for a re-send. Key receives the lead notification with `panel_photo_url = mms_garage.jpg` (first won by webhook order — see reviewer note above) and `extra_photos = [mms_side_of_house.jpg, mms_panel_door_open.jpg]` so he can manually pick the most useful photo when reviewing.

---

## Register-switching audit (v3-style carryover)

- **Turn 1 classifier emitted inferred_customer_style?** yes → "default"
- **Sticky persistence across turns?** yes; default reaffirmed Turns 1-9, no overrides triggered
- **Phraser applied default-register defaults?**
  - Length target 60-130 chars: 7 of 9 turns inside band (Turn 5 = 51 chars on a clean email ask, Turn 9 = 0 chars terminal — both sanctioned exceptions)
  - **Average msg length (Turns 0-8): 90.3 chars** — hits default-register aim of ~90 cleanly
  - Ack rate: 7 of 9 outbound turns acknowledged (Turn 4 and Turn 7 skipped) = **77%** — slightly above the 50-70% band, similar to Sarah; rhythm-driven, no repeats
  - Acknowledgment phrases used (no repeats in any 2-turn window): Cool. / Got it. / Perfect. / [skip] / Sounds good. / Got that. / [skip] / Got 'em → **6 unique acks across 9 outbound turns; rhythm rule never violated**
- **No corporate phrases?** confirmed (grepped output for "appreciate|rest assured|feel free|happy to help|circle back|thank you for your interest" → 0)
- **No countdown phrasing?** confirmed (grepped for "two more|three more|few more|last (?:quick )?(?:one|thing|couple)|one (?:more|last)|almost done|few more questions" → 0)
- **No banned weekday names?** confirmed (grepped for Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday → 0; only "tomorrow morning" on SCHEDULE_QUOTE which is sanctioned)
- **Voice corpus alignment?** matches placeholder corpus on lowercase casual / contractions ("Key will", "snap a pic", "Got 'em") / no first-person Key / third-person "our electrician Key" → "Key" reduce after first mention.

---

## Scoring

- State machine score: **10 / 10** (clean linear path through the full qualification flow; P35 multi-photo behavior matches spec exactly — first event transitions, subsequent events append, phraser invoked once)
- Classifier score: **10 / 10** (style inference correct on Turn 1, all 9 labels correct, lowest confidence 0.95, photo events correctly bypass classifier)
- Voice score: **9.5 / 10** (the multi-photo turn's "Got 'em" handled the surplus with zero awkwardness; everything else clean and varied; no fallback used)

## Reviewer notes

(Empty — Key fills this in)

---

## v5 batch summary line

[v5] Persona 22 (jen) — reached COMPLETE in 10 turns. Multi-photo-handled: yes. Bot-asked-to-resend: no. Bot-apologized-for-surplus: no. Voice 9.5/10. Status: PASS.
