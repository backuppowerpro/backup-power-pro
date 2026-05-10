# Persona 25 — Cassidy (Wrong-Photo Correction Post-SCHEDULE_QUOTE) — v6

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 25
**Lab batch:** v6 (photo_correction classifier label + state-machine rewind from SCHEDULE_QUOTE)
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 12
**Detected customer_style:** default
**Expected customer_style:** default
**Register applied:** yes (60-130 char target, 50-70% ack rate)
**Status:** PASS

---

## What this persona stress-tests

- **`photo_correction` classifier label (NEW in v6).** Cassidy realizes one
  turn AFTER the bot moved on to SCHEDULE_QUOTE that the photo she sent
  was her sub-panel from the basement, not the main panel. Her self-correction
  message ("wait actually that was a sub-panel from my basement, not the main
  one — hold on lemme send the actual one") MUST be classified as
  `photo_correction` — not `amending_prior_answer` (no slot-system tracking
  for photos), not `off_topic_question` (no price/schedule ask), not
  `friendly_chitchat` (operational, not social), not `unclear`.
- **State-machine rewind from SCHEDULE_QUOTE → AWAIT_PANEL_PHOTO.** Per
  state-machine.js line 294, `SCHEDULE_QUOTE.transitions.photo_correction =
  'AWAIT_PANEL_PHOTO'`. The state must actually rewind, not stick at
  SCHEDULE_QUOTE or jump to NEEDS_CALLBACK.
- **Phraser `photo_correction` intent at SCHEDULE_QUOTE rewind.** Per
  phraser-agent.md special intent handler:
  > "At SCHEDULE_QUOTE (rewinding): 'Got it — go ahead and send the right
  > panel pic when you have it. Key'll use that one.'"
  Phraser MUST acknowledge graciously without making Cassidy feel like she
  screwed up. No "ok please re-send" (sounds annoyed). No
  "no problem we'll just need to start over" (catastrophizes).
- **Final qualification_data.panel_photo is the CORRECTED one.** When the
  replacement photo arrives, it must overwrite the sub-panel URL, not append
  to extras. Per the photo-correction semantics, the prior photo was wrong
  and the replacement IS the panel — the sub-panel URL gets demoted to
  `extra_photos[]` so Key can still see it for context.
- **Photo classifier integration (v6).** First photo classifier output:
  `{subject: "subpanel", primary_recommendation: "accept_with_followup"}`.
  Second photo classifier output: `{subject: "panel_open_clear",
  primary_recommendation: "accept"}`. The "accept_with_followup" on the
  first photo is what allowed the state machine to advance to
  SCHEDULE_QUOTE in the first place — it's electrical, informative, and
  Key would have just flagged it for clarification on his end. Cassidy's
  self-correction is what makes this a clean fix.

---

## Role-isolation note

- **Customer simulator** sees ONLY Cassidy's ground truth + bot's last
  outbound + history. Generates fast, efficient, mid-conversational replies.
  Self-corrects between turns 9 and 10 — not because the bot prompted her,
  but because she realized on her own that the photo was her basement
  sub-panel, not the main one.
- **Conversational classifier** sees ONLY current state + last 1-2 turns +
  the inbound message. Synthetic `__photo_received__` events bypass the
  conversational classifier entirely (they're routed to the photo classifier
  per orchestrator-agent.md photo-event protocol). The TEXT message
  "wait actually that was a sub-panel..." DOES go through the conversational
  classifier — that's where the new `photo_correction` label fires.
- **Photo classifier** runs only when MMS arrives at a photo-expecting state
  (or post-SCHEDULE_QUOTE per agents/photo-classifier-agent.md "When this fires"
  list). Two photo-classifier invocations this run.
- **Phraser** sees ONLY intent + first_name + customer_last_message +
  acknowledge_emoji + address_on_file + volunteered_data +
  prior_acknowledgments + customer_style. Does not see classifier output,
  does not pick state. On the rewind turn, intent = "photo correction
  acknowledgment at SCHEDULE_QUOTE rewind".
- **Orchestrator** persists `customer_style`, routes the first photo through
  photo-classifier (subpanel + accept_with_followup → emit photo_received),
  routes the self-correction text through conversational classifier
  (`photo_correction` label), applies state-machine rewind, runs phraser at
  AWAIT_PANEL_PHOTO with the photo_correction intent, then routes the
  replacement photo through photo-classifier again (panel_open_clear +
  accept → emit photo_received), advances state machine SCHEDULE_QUOTE again,
  re-renders SCHEDULE_QUOTE outbound (varied wording from Turn 9 since
  prior_acknowledgments rolling).

---

## Persona ground truth (orchestrator-only context)

```json
{
  "first_name": "Cassidy",
  "owner": true,
  "gen_240v": true,
  "outlet_amps": 50,
  "run_feet": 18,
  "email": "cass.b@yahoo.com",
  "address_on_file": "55 Sterling Drive, Greenville SC 29615",
  "address_correct": true,
  "service_area": "Greenville",
  "expected_terminal": "COMPLETE"
}
```

**Style:** Fast worker. Mid-length replies, mostly proper capitalization,
casual contractions ("lemme", "hold on"). No emoji. Not chatty, not terse —
default register. Confident in flow, but self-corrects when she realizes a
mistake — no anxious over-apology, just a quick "wait actually" pivot.

---

## Conversation

### Turn 0 — bot (GREETING — default register, style not yet detected)

Hey Cassidy, BPP here — got your form. Couple quick questions so our electrician Key can put your quote together?

**Phraser input:**
```json
{
  "intent": "greet by first name as BPP intake, mention our electrician Key will quote, ask if it is a good time for a couple quick questions",
  "customer_first_name": "Cassidy",
  "customer_last_message": null,
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": [],
  "customer_style": null
}
```
*Constraint check: 113 chars. Mentions BPP + Key third-person + ends in single question. No emoji. PASS.*

---

### Turn 1 — customer

Yeah go ahead

### Turn 1 — classifier

```json
{
  "label": "affirmative",
  "confidence": 0.96,
  "inferred_customer_style": "default"
}
```
Reasoning: cooperative reply, mid-short (13 chars), capitalized first word. Not terse alone — single confident affirmative without burst-data. Default plurality.

**Sticky style update (Turn 1 → set initial):** `sticky_style = "default"`

### Turn 1 — state machine

GREETING → AWAIT_240V (intent: ask whether their generator has a 240-volt outlet)

### Turn 1 — bot (AWAIT_240V) — register: default

Cool. Does your generator have the big 240-volt outlet (the kind your dryer plugs into), or just regular 120-volt outlets?

**Phraser input:**
```json
{
  "intent": "ask whether their generator has a 240-volt outlet (the kind a clothes-dryer plugs into) or only 120-volt household outlets",
  "customer_first_name": "Cassidy",
  "customer_last_message": "Yeah go ahead",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": [],
  "customer_style": "default"
}
```
*Constraint check: 119 chars. Single ?. "Cool." ack not in prior. PASS. prior_acks rolling out: ["Cool."]*

---

### Turn 2 — customer

Yep 240, it's a 50 amp outlet

### Turn 2 — classifier

```json
{
  "label": "gen_240v",
  "confidence": 0.97,
  "inferred_customer_style": "default"
}
```
Volunteered_data detected by orchestrator: customer specified "50 amp outlet" alongside the 240v confirm. Pass to phraser as "customer also said it's a 50 amp outlet (matches outlet_50a slot)".

**Sticky style:** `default` (reaffirmed).

### Turn 2 — state machine

AWAIT_240V → AWAIT_OUTLET (intent: ask if 30A or 50A — but customer already volunteered 50A; phraser confirms rather than re-asks blindly)

### Turn 2 — bot (AWAIT_OUTLET) — register: default

Got it — 50-amp setup. Just confirming: 4-prong twist-lock?

**Phraser input:**
```json
{
  "intent": "ask if the 240v outlet is a 30-amp (smaller, looks like 3-prong twist-lock) or 50-amp (bigger, 4-prong) — note that if they don't know, ask them to send a photo",
  "customer_first_name": "Cassidy",
  "customer_last_message": "Yep 240, it's a 50 amp outlet",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": "customer also said it's a 50 amp outlet (matches outlet_50a slot)",
  "prior_acknowledgments": ["Cool."],
  "customer_style": "default"
}
```
*Constraint check: 60 chars. Acknowledges volunteered 50A, asks confirming detail (4-prong is the 50A NEMA L14-50 shape). Single ?. "Got it." not in prior. PASS. prior_acks rolling out: ["Cool.", "Got it."]*

---

### Turn 3 — customer

Yes 4-prong

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
  "customer_first_name": "Cassidy",
  "customer_last_message": "Yes 4-prong",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": ["Cool.", "Got it."],
  "customer_style": "default"
}
```
*Constraint check: 76 chars. Single ?. "Perfect." not in prior. PASS. prior_acks rolling out: ["Got it.", "Perfect."]*

---

### Turn 4 — customer

We own it

### Turn 4 — classifier

```json
{
  "label": "owner",
  "confidence": 0.99,
  "inferred_customer_style": "default"
}
```

**Sticky style:** `default` (reaffirmed).

### Turn 4 — state machine

AWAIT_OWNERSHIP → AWAIT_RUN (intent: ask roughly how far generator will sit from electrical panel)

### Turn 4 — bot (AWAIT_RUN) — register: default

Roughly how far will the generator sit from your panel — under 15ft, 15-30ft, or longer?

**Phraser input:**
```json
{
  "intent": "ask roughly how far the generator will sit from the electrical panel — short under 15ft, medium 15-30ft, or longer than 30ft",
  "customer_first_name": "Cassidy",
  "customer_last_message": "We own it",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": ["Got it.", "Perfect."],
  "customer_style": "default"
}
```
*Constraint check: 89 chars. Single ?. NO ack — rhythm rule (varied 2-of-2 prior; skipping is preferable). PASS. prior_acks rolling out: ["Perfect.", null]*

---

### Turn 5 — customer

About 18 feet

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
  "customer_first_name": "Cassidy",
  "customer_last_message": "About 18 feet",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": ["Perfect.", null],
  "customer_style": "default"
}
```
*Constraint check: 51 chars (under 60-char default floor — sanctioned for clean email ask, same exemption used by Persona 22 / Persona 01). Single ?. "Sounds good." not in prior. PASS. prior_acks rolling out: [null, "Sounds good."]*

---

### Turn 6 — customer

cass.b@yahoo.com

### Turn 6 — classifier

```json
{
  "label": "email_provided",
  "confidence": 0.99,
  "extracted_value": "cass.b@yahoo.com",
  "email_typo_suspected": false,
  "inferred_customer_style": "default"
}
```
Domain `yahoo.com` is clean — no typo flag fires.

**Sticky style:** `default` (reaffirmed).

### Turn 6 — state machine

AWAIT_EMAIL + email_provided + email_typo_suspected=false → AWAIT_ADDRESS_CONFIRM (skips CHECK_EMAIL_TYPO; intent: confirm install address)

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM) — register: default

Got that. Install address — 55 Sterling Drive, Greenville SC 29615, or somewhere different?

**Phraser input:**
```json
{
  "intent": "confirm the install address using the value already on file from the form (passed in via slots.address_on_file) — ask if it matches or if it should be different",
  "customer_first_name": "Cassidy",
  "customer_last_message": "cass.b@yahoo.com",
  "acknowledge_emoji": false,
  "address_on_file": "55 Sterling Drive, Greenville SC 29615",
  "volunteered_data": null,
  "prior_acknowledgments": [null, "Sounds good."],
  "customer_style": "default"
}
```
*Constraint check: 91 chars. Single ?. "Got that." vary from "Got it." in prior set. Address echoed back verbatim. PASS. prior_acks rolling out: ["Sounds good.", "Got that."]*

---

### Turn 7 — customer

Yep that's right

### Turn 7 — classifier

```json
{
  "label": "address_confirmed",
  "confidence": 0.98,
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
  "customer_first_name": "Cassidy",
  "customer_last_message": "Yep that's right",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": ["Sounds good.", "Got that."],
  "customer_style": "default"
}
```
*Constraint check: 100 chars. Single ?. NO ack (rhythm rule; both prior acks recently used). No countdown phrasing. PASS. prior_acks rolling out: ["Got that.", null]*

---

### Turn 8 — customer

[sends photo of breaker box from basement — sub-panel that looks similar to main]

### Turn 8 — photo classifier

```json
{
  "subject": "subpanel",
  "subject_confidence": 0.88,
  "obvious_issues": ["smaller than typical main panel; appears to be a downstream sub-panel based on feed conductor size"],
  "amperage_visible": "unknown",
  "panel_brand_visible": null,
  "primary_recommendation": "accept_with_followup"
}
```

Reasoning: Photo IS electrical, breakers ARE visible, image IS clear. The subject is a panel — but the conductor feed size and panel dimensions read as a sub-panel rather than a main service panel. Per agents/photo-classifier-agent.md:

> "subpanel — a sub-panel (smaller, downstream of the main)"
> "accept_with_followup — accept the photo but Key may need clarification"

Recommendation = `accept_with_followup`: append photo to qualification_data.panel_photo_url, append obvious_issues to qualification_data.panel_photo_notes, emit `photo_received` event so state machine advances. Flag for Key's review (don't surface to customer).

### Turn 8 — synthetic event + state machine

`__photo_received__` event fires (driven by photo_classifier recommendation = accept_with_followup, per orchestrator-agent.md photo classifier integration spec).

AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE
onEnter: { complete: true } ← signals Key's "qualified lead" notification fires (provisional, since photo classifier flagged for follow-up but didn't reject)

**qualification_data after Event 1:**
```json
{
  "panel_photo_url": "mms_subpanel.jpg",
  "panel_photo_notes": ["subpanel — Key should clarify whether main panel is needed for interlock placement"],
  "extra_photos": []
}
```

### Turn 8 — bot (SCHEDULE_QUOTE) — register: default

Perfect, that's everything we need. Key will look over your panel photo and have your quote to you by tomorrow morning. Talk soon.

**Phraser input:**
```json
{
  "intent": "thank them and tell them Key will review the photo and have the quote ready by tomorrow morning. soft commitment — no specific time",
  "customer_first_name": "Cassidy",
  "customer_last_message": "[sends photo of breaker box from basement]",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": ["Got that.", null],
  "customer_style": "default"
}
```
*Constraint check: 130 chars. "by tomorrow morning" is the sanctioned SCHEDULE_QUOTE exception phrase. No weekday names. No "$". No "I'm Key" / "this is Key personally". No "Awesome". No countdown phrasing. No banned phrases. "Perfect." was last used on Turn 3 — outside the 2-turn rolling prior_acks window, so reuse is allowed by the rhythm rule. PASS. prior_acks rolling out: [null, "Perfect."]*

*Note that the bot does NOT surface the photo classifier's "accept_with_followup" flag to Cassidy. Per agents/photo-classifier-agent.md: "flag for Key's review (don't surface to customer)." The bot acts as if the photo was fully accepted; Key will see the panel_photo_notes when reviewing and can call Cassidy if he needs the actual main panel.*

---

### Turn 9 — customer (THE SELF-CORRECTION)

wait actually that was a sub-panel from my basement, not the main one — hold on lemme send the actual one

### Turn 9 — classifier (CRITICAL — photo_correction MUST fire)

```json
{
  "label": "photo_correction",
  "confidence": 0.95,
  "inferred_customer_style": "default"
}
```

**Classifier disambiguation reasoning (per classifier-agent.md rule 15 — PHOTO CORRECTION SIGNALS):**

The phrase "wait actually that was a sub-panel from my basement, not the main one — hold on lemme send the actual one" hits the `photo_correction` signature on multiple axes:

- "wait" + "actually" — self-correction lead-ins
- "that was a sub-panel ... not the main one" — explicit acknowledgment that the prior photo was the wrong subject
- "hold on lemme send the actual one" — explicit signal of incoming replacement
- Operational, not social → not friendly_chitchat
- No price/schedule/recommendation ask → not off_topic_question
- No slot-system slot to amend (photos aren't tracked in SLOT_TO_STATE) → not amending_prior_answer (rule explicitly cited in classifier prompt: "photo_correction (NOT amending_prior_answer with photo slot, since the slot system doesn't track photos that way)")
- Unambiguous self-correction per rule 15 → confidence ≥0.9 (set 0.95)

**Sticky style:** `default` (reaffirmed — self-correction is matter-of-fact, not anxious or terse).

### Turn 9 — state machine (THE REWIND)

SCHEDULE_QUOTE → AWAIT_PANEL_PHOTO

Per state-machine.js line 294:
```js
SCHEDULE_QUOTE: {
  transitions: {
    photo_correction: 'AWAIT_PANEL_PHOTO',  // customer wants to replace the photo — rewind
  }
}
```

**Important post-rewind cleanup the orchestrator performs:**
- The previously-stored `panel_photo_url` (mms_subpanel.jpg) is moved to `extra_photos[]` (Key still wants to see it for context — it's still electrical, still informative, just not the main panel).
- `panel_photo_url` is reset to `null` (will be repopulated when the corrected photo arrives).
- `panel_photo_notes` for the sub-panel are preserved alongside the URL in `extra_photos_notes[]`.
- The `onEnter: { complete: true }` flag on SCHEDULE_QUOTE was already triggered on Turn 8 — Key already got a "qualified lead" notification. The orchestrator does NOT fire a duplicate notification on the second SCHEDULE_QUOTE entry; instead, when the corrected photo arrives, it sends a "panel photo updated for already-qualified lead {id}" amendment.

**qualification_data after rewind:**
```json
{
  "panel_photo_url": null,
  "panel_photo_notes": [],
  "extra_photos": ["mms_subpanel.jpg"],
  "extra_photos_notes": ["originally submitted as panel — customer corrected: this is the basement sub-panel"]
}
```

### Turn 9 — bot (AWAIT_PANEL_PHOTO — photo_correction intent, NOT a fresh AWAIT_PANEL_PHOTO ask) — register: default

Got it — go ahead and send the right panel pic when you have it. Key'll use that one.

**Phraser input:**
```json
{
  "intent": "photo correction acknowledgment at SCHEDULE_QUOTE rewind — customer realized the prior photo was the wrong panel; acknowledge graciously, confirm the new one will be used, do NOT make them feel bad, do NOT re-ask for the photo from scratch (they're already sending it)",
  "customer_first_name": "Cassidy",
  "customer_last_message": "wait actually that was a sub-panel from my basement, not the main one — hold on lemme send the actual one",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": [null, "Perfect."],
  "customer_style": "default"
}
```

*Phraser self-check on photo_correction intent:*
- Per phraser-agent.md special intent handler "photo correction" — bot uses the EXACT example phrasing for SCHEDULE_QUOTE rewind: "Got it — go ahead and send the right panel pic when you have it. Key'll use that one." This is the canonical phrasing in the phraser spec; matching it verbatim is intentional (consistency across runs, easy to QA).
- Does NOT say "ok please re-send" (sounds annoyed; explicitly forbidden by the special-intent handler).
- Does NOT make Cassidy feel bad ("no worries — common mistake" would be condescending; "Got it — go ahead..." is matter-of-fact, no apology either way).
- Does NOT re-ask for the photo from scratch ("Could you snap a pic of your main panel..." would imply she hasn't started yet — but she said "hold on lemme send the actual one", which means it's incoming).
- Does NOT ask whether the sub-panel photo is "still useful" (over-engineered; the orchestrator handles the move-to-extras automatically).

*Constraint check: 84 chars. Single sentence. No ?. "Got it." not in last 2 prior_acks (last 2 = [null, "Perfect."]). No banned phrases. No countdown. No "$". No weekday names. No first-person electrician claims. PASS. prior_acks rolling out: ["Perfect.", "Got it."]*

---

### Turn 10 — customer

[sends photo of main panel with breaker door open, clear lighting]

### Turn 10 — photo classifier

```json
{
  "subject": "panel_open_clear",
  "subject_confidence": 0.96,
  "obvious_issues": [],
  "amperage_visible": "unknown",
  "panel_brand_visible": "Cutler-Hammer",
  "primary_recommendation": "accept"
}
```

Reasoning: Main service panel, breaker door open, all breakers visible, well-lit, panel brand readable. Per agents/photo-classifier-agent.md:

> "panel_open_clear — electrical panel, breaker door open, all breakers visible, well-lit"
> "accept — good enough; transition state machine on photo_received"

### Turn 10 — synthetic event + state machine

`__photo_received__` event fires (recommendation = accept).

AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (second entry)

**qualification_data after Event 2 (the corrected photo):**
```json
{
  "panel_photo_url": "mms_main_panel_open.jpg",
  "panel_photo_notes": [],
  "extra_photos": ["mms_subpanel.jpg"],
  "extra_photos_notes": ["originally submitted as panel — customer corrected: this is the basement sub-panel"]
}
```

**THE CORRECTED PHOTO IS NOW PRIMARY.** The sub-panel is preserved in extras for Key's reference (Cutler-Hammer brand visible on the main, no obvious issues — clean photo). Orchestrator emits "panel photo updated for already-qualified lead" amendment notification rather than re-firing the full "qualified lead" alert (the qualified-lead onEnter side effect from Turn 8 isn't undone; it's amended).

### Turn 10 — bot (SCHEDULE_QUOTE — second entry, varied wording) — register: default

Got the right one — Key will look it over and have your quote to you by tomorrow morning. Talk soon, Cassidy.

**Phraser input:**
```json
{
  "intent": "thank them and tell them Key will review the photo and have the quote ready by tomorrow morning. soft commitment — no specific time",
  "customer_first_name": "Cassidy",
  "customer_last_message": "[sends photo of main panel with breaker door open, clear lighting]",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": "customer's corrected (replacement) panel photo — primary now",
  "prior_acknowledgments": ["Perfect.", "Got it."],
  "customer_style": "default"
}
```

*Phraser self-check on second SCHEDULE_QUOTE entry:*
- Wording is varied from Turn 8's "Perfect, that's everything we need..." to avoid robotic repetition. The Turn 8 ack was "Perfect." which is now in prior_acks; Turn 9 ack was "Got it." which is also now in prior_acks. So Turn 10 needs a new opener — "Got the right one" satisfies this (specifically acknowledges the correction landed) AND is not a literal repeat of either prior ack. The acknowledgment phrase pulled for prior_acks tracking is "Got the right one —" (not in prior set).
- "by tomorrow morning" is the sanctioned exception phrase.
- "Talk soon, Cassidy" mirrors Persona 22's clean SCHEDULE_QUOTE close.
- The bot does NOT bring attention to the swap ("now we have the right one, sorry about that earlier confusion") — that would draw attention to a non-issue. The bot just moves forward as if the corrected photo was always the one in scope.

*Constraint check: 113 chars (in 60-130 default band). Single sentence comma-joined. No ?. "by tomorrow morning" sanctioned. No weekday names. No "$". No first-person Key. No "Awesome". No countdown. "Got the right one" not in prior_acks. PASS. prior_acks rolling out: ["Got it.", "Got the right one"]*

---

### Turn 11 — customer

Awesome thanks!

### Turn 11 — classifier

```json
{
  "label": "affirmative",
  "confidence": 0.97,
  "inferred_customer_style": "default"
}
```
Customer's gratitude / wrap-up — closes the loop on SCHEDULE_QUOTE for the second time.

**Sticky style:** `default` (final state).

### Turn 11 — state machine

SCHEDULE_QUOTE → COMPLETE (terminal — onEnter side effects already fired on Turn 8 + amendment fired on Turn 10).

### Turn 11 — bot

*[no further outbound — COMPLETE is terminal. Per state-machine.js: COMPLETE has `transitions: {}` and any post-COMPLETE inbound routes to NEEDS_CALLBACK so Key handles personally. None has arrived.]*

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Length (chars) | Voice 1-10 | Notes |
|---|---|---|---|---|---|
| 0 | GREETING | yes | 113 | 9 | clean opener, third-person Key, single ? |
| 1 | AWAIT_240V | yes | 119 | 9 | "Cool." ack, in default 60-130 band |
| 2 | AWAIT_OUTLET | yes | 60 | 9.5 | volunteered 50A acknowledged, asks 4-prong confirm |
| 3 | AWAIT_OWNERSHIP | yes | 76 | 9 | "Perfect." vary, owner-rationale parens read natural |
| 4 | AWAIT_RUN | yes | 89 | 9 | NO ack — rhythm rule applied |
| 5 | AWAIT_EMAIL | yes | 51 | 9 | clean email ask, sanctioned sub-floor length |
| 6 | AWAIT_ADDRESS_CONFIRM | yes | 91 | 9.5 | "Got that." vary, address echoed verbatim |
| 7 | AWAIT_PANEL_PHOTO | yes | 100 | 9 | NO ack (rhythm), no countdown phrasing |
| 8 | SCHEDULE_QUOTE (1st entry) | yes | 130 | 9 | clean SCHEDULE_QUOTE close, "by tomorrow morning" sanctioned, classifier-flagged subpanel handled silently per spec |
| 9 | AWAIT_PANEL_PHOTO (rewind, photo_correction intent) | yes | 84 | 9.5 | **canonical phrasing from phraser spec** — gracious, no annoyance, confirms new one will be used, no re-ask from scratch |
| 10 | SCHEDULE_QUOTE (2nd entry) | yes | 113 | 9.5 | varied wording from Turn 8 ("Got the right one" vs "Perfect, that's everything"), prior_acks rolling cleanly, no attention drawn to the swap |
| 11 | COMPLETE | yes (no outbound) | 0 | — | terminal, correct |

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **yes** (COMPLETE in 12 turns counting Turn 11 wrap-up)
- Did any phraser output violate a hard constraint? **no** (no fallback used)
- Did any classifier output have confidence <0.6 on a critical state? **no** (lowest was 0.95 on the photo_correction turn — high enough)
- Did the conversation exceed 15 turns? **no** (12 turns)
- Did any state self-loop more than 2x? **no** (AWAIT_PANEL_PHOTO entered twice — once direct, once via rewind; SCHEDULE_QUOTE entered twice for the same reason)
- Did the bot self-disclose AI status correctly when asking_if_human fired? **n/a — never fired for Cassidy**
- Did the bot disclose price or weekday? **no** (only sanctioned "by tomorrow morning" on SCHEDULE_QUOTE — twice)
- Did "Awesome" appear in BOT output? **no** (Cassidy used it on Turn 11, allowed per "the customer can use 'awesome', you cannot")
- Did countdown phrasing land in any final output? **no**
- Did emoji appear? **no**

---

## v6 photo_correction audit (THE CRITICAL TEST SURFACE)

This is the test surface that distinguishes Persona 25 from every other persona in the suite.

| Check | Result | Evidence |
|---|---|---|
| **photo_correction classifier label fires correctly on Turn 9** | **yes** | Turn 9 classifier emitted `{label: "photo_correction", confidence: 0.95}` — NOT amending_prior_answer, NOT off_topic_question, NOT friendly_chitchat. Disambiguation rule 15 (PHOTO CORRECTION SIGNALS) explicitly cited. |
| **State machine actually rewinds SCHEDULE_QUOTE → AWAIT_PANEL_PHOTO** | **yes** | state-machine.js line 294: `SCHEDULE_QUOTE.transitions.photo_correction = 'AWAIT_PANEL_PHOTO'`. Applied verbatim. State did NOT stick at SCHEDULE_QUOTE; did NOT route to NEEDS_CALLBACK. |
| **Phraser intent on rewind = "photo correction acknowledgment at SCHEDULE_QUOTE rewind"** | **yes** | Phraser used the canonical example phrasing from agents/phraser-agent.md ("Got it — go ahead and send the right panel pic when you have it. Key'll use that one."). |
| **Bot doesn't make Cassidy feel like she screwed up** | **yes** | "Got it — go ahead and send the right panel pic when you have it. Key'll use that one." is matter-of-fact. No "no worries — common mistake" (condescending), no "ok please re-send" (annoyed), no apology either way. Reads as "no big deal, here's the next step." |
| **Bot doesn't re-ask for the photo from scratch** | **yes** | Bot acknowledges incoming photo, doesn't repeat "Could you snap a pic of your main electrical panel..." (would imply she hasn't started). |
| **Final qualification_data.panel_photo_url is the CORRECTED main panel** | **yes** | Final value: mms_main_panel_open.jpg (Cutler-Hammer brand visible, panel_open_clear, accept). The sub-panel was demoted to extra_photos[] with a note explaining why. |
| **Sub-panel photo preserved (not deleted) for Key's reference** | **yes** | extra_photos = [mms_subpanel.jpg] with note "originally submitted as panel — customer corrected: this is the basement sub-panel". Key still sees both for context. |
| **No duplicate "qualified lead" notification fired** | **yes** | onEnter: { complete: true } fired once on Turn 8; second SCHEDULE_QUOTE entry on Turn 10 emitted an amendment notification ("panel photo updated for already-qualified lead") rather than re-firing the full alert. |
| **Photo classifier correctly distinguished subpanel from panel_open_clear across the two photos** | **yes** | Turn 8: subject="subpanel", confidence 0.88, recommendation accept_with_followup. Turn 10: subject="panel_open_clear", confidence 0.96, recommendation accept. Both correct per agents/photo-classifier-agent.md subject taxonomy. |
| **Voice on the rewind turn is gracious without being condescending** | **yes** | Turn 9 bot output ("Got it — go ahead and send the right panel pic when you have it. Key'll use that one.") matches the canonical example in phraser-agent.md verbatim. No "no worries", no "common mistake", no "happens all the time" — just a clean handoff. |
| **Customer voice score for the rewind turn ≥ 9** | **yes** | Voice 9.5/10 — canonical phrasing, conversational rhythm preserved, no awkwardness. |

**v6 verdict:** behaviour matches architecture spec end-to-end. The new `photo_correction` classifier label is functional, the SCHEDULE_QUOTE → AWAIT_PANEL_PHOTO rewind transition fires correctly, the phraser handles the rewind intent with the canonical gracious phrasing, the photo classifier distinguishes subpanel from main, and the qualification_data ends up with the corrected main panel as primary while preserving the sub-panel as a reference photo. No customer-shaming, no over-apologizing, no second "qualified lead" notification storm.

---

## Register-switching audit (v3-style carryover)

- **Turn 1 classifier emitted inferred_customer_style?** yes → "default"
- **Sticky persistence across turns?** yes; default reaffirmed Turns 1-11, no overrides triggered
- **Phraser applied default-register defaults?**
  - Length target 60-130 chars: 9 of 11 turns inside band (Turn 5 = 51 chars on a clean email ask, Turn 11 = 0 chars terminal — both sanctioned exceptions; Turn 9 = 84 chars in band; Turn 8 = 130 chars at upper edge)
  - **Average msg length (Turns 0-10): 93.3 chars** — hits default-register aim of ~90 cleanly
  - Ack rate: 8 of 11 outbound turns acknowledged (Turns 4, 7, 11 skipped/terminal) = **73%** — slightly above the 50-70% band but rhythm-driven, no repeats
  - Acknowledgment phrases used (no repeats inside any 2-turn window): Cool. / Got it. / Perfect. / [skip] / Sounds good. / Got that. / [skip] / Perfect. (reuse outside 2-turn window) / Got it. (reuse outside 2-turn window) / Got the right one → **8 unique acks across 11 outbound turns; rhythm rule never violated**
- **No corporate phrases?** confirmed (grepped output for "appreciate|rest assured|feel free|happy to help|circle back|thank you for your interest" → 0)
- **No countdown phrasing?** confirmed (grepped for "two more|three more|few more|last (?:quick )?(?:one|thing|couple)|one (?:more|last)|almost done|few more questions" → 0)
- **No banned weekday names?** confirmed (grepped for Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday → 0; only "tomorrow morning" on SCHEDULE_QUOTE which is sanctioned, used twice — once on Turn 8 and once on Turn 10, both within sanctioned context)
- **No first-person electrician claims?** confirmed (no "I install" / "I'll install" / "I'll be there" / "I'll quote" / "this is Key" anywhere; bot used "Key will look" / "Key'll use that one" / "our electrician Key" — all third-person)
- **Voice corpus alignment?** matches placeholder corpus on lowercase casual / contractions ("Key'll", "snap a pic", "Got the right one") / no first-person Key / "our electrician Key" first-mention reduce-to-"Key" thereafter.

---

## Scoring

- State machine score: **10 / 10** (clean linear path through full qualification flow PLUS correct rewind from SCHEDULE_QUOTE → AWAIT_PANEL_PHOTO via photo_correction transition; second SCHEDULE_QUOTE entry handled correctly with no duplicate side-effect firings; qualification_data ends with corrected photo as primary and sub-panel preserved as reference)
- Classifier score: **10 / 10** (style inference correct on Turn 1, all 11 conversational labels correct, lowest confidence 0.95, photo_correction label fired on the right turn with correct disambiguation reasoning per rule 15)
- Photo classifier score: **10 / 10** (subpanel vs panel_open_clear distinction correct on both photos with appropriate confidence; accept_with_followup vs accept recommendations applied correctly per agents/photo-classifier-agent.md taxonomy)
- Voice score: **9.5 / 10** (the rewind turn used the canonical phrase verbatim; second SCHEDULE_QUOTE entry varied cleanly from the first; no awkwardness anywhere)

## Reviewer notes

(Empty — Key fills this in)

---

## v6 batch summary line

[v6] Persona 25 (cassidy) — reached COMPLETE in 12 turns. photo_correction-fired: yes. State-rewound-from-SCHEDULE_QUOTE: yes. Final-photo-corrected: yes. Bot-tone-gracious: yes. Voice 9.5/10. Status: PASS.
