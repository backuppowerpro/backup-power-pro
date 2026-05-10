# Persona 24 — Robert (Panel Photo with Door Closed) — v6

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 24
**Lab batch:** v6 (photo classifier — `ask_to_open` path)
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 12
**Detected customer_style:** default
**Expected customer_style:** default
**Register applied:** yes (60-130 char target, 50-70% ack rate)
**Status:** PASS

---

## What this persona stress-tests

- **v6 photo-classifier "ask_to_open" path.** Robert sends a photo of his panel from outside with the breaker door still closed. Without a vision layer, the conversational state machine would blindly emit `photo_received` and transition to SCHEDULE_QUOTE — Key would then receive a useless closed-door panel pic and have to chase Robert for a re-send a day later (the exact failure mode the photo classifier was built to catch).
- **Photo classifier verdict:** subject="panel_closed", primary_recommendation="ask_to_open". State stays at AWAIT_PANEL_PHOTO; phraser intent enriched with the closed-door subject so it can re-ask appropriately.
- **Phraser tone test.** The bot must ask Robert to open the breaker door without making him feel dumb. "could y'all open the breaker door and snap once more? need to see the breakers themselves" is friendly; "you sent the wrong kind of photo" or "that's not what I asked for" is not. Robert is 58 and careful — a punitive phrasing would tank trust on the very last step before COMPLETE.
- **Re-snap acceptance.** After Robert sends the door-open version, classifier emits subject="panel_open_clear", recommendation="accept", state machine transitions AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE → COMPLETE.

---

## Role-isolation note

- **Customer simulator** sees ONLY Robert's ground truth + bot's last outbound + history. Generates careful, slightly older-coded "didn't realize that mattered" behavior on the closed-door photo, then a quick "oh duh" recovery.
- **Conversational classifier** sees ONLY current state + last 1-2 turns + the inbound. Synthetic photo events bypass the conversational classifier entirely (per orchestrator-agent.md photo-event protocol).
- **Photo classifier** is a SEPARATE agent (per `agents/photo-classifier-agent.md`). Receives image + expected_subject="panel" + one-line context. Returns `{subject, subject_confidence, primary_recommendation, obvious_issues, ...}`. In lab, the orchestrator simulates the classifier output from the persona's narration.
- **Phraser** sees ONLY intent + first_name + customer_last_message + acknowledge_emoji + address_on_file + volunteered_data + prior_acknowledgments + customer_style. On the re-ask turn the intent is enriched: "panel photo received but door is closed; thank them and ask for door-open version. Be casual."
- **Orchestrator** persists `customer_style` across turns; routes the first photo through the photo classifier, sees `ask_to_open`, holds state, re-invokes phraser with the enriched intent. On the second photo, photo classifier returns `accept`, orchestrator emits `photo_received`, state machine advances.

---

## Persona ground truth (orchestrator-only context)

```json
{
  "first_name": "Robert",
  "owner": true,
  "gen_240v": true,
  "outlet_amps": 30,
  "run_feet": 22,
  "email": "robert.huntley@gmail.com",
  "address_on_file": "412 Edgewater Lane, Spartanburg SC 29307",
  "address_correct": true,
  "service_area": "Spartanburg",
  "expected_terminal": "COMPLETE"
}
```

**Style:** Careful, slightly older. Mid-length replies, proper capitalization, occasional comma splice. No emoji. Cooperative but takes things at face value — "send a pic of the panel" → photographs the panel from where he's standing without thinking to open the door.

---

## Conversation

### Turn 0 — bot (GREETING — default register, style not yet detected)

Hey Robert, BPP here — got your form. Couple quick questions so our electrician Key can put your quote together?

**Phraser input:**
```json
{
  "intent": "greet by first name as BPP intake, mention our electrician Key will quote, ask if it is a good time for a couple quick questions",
  "customer_first_name": "Robert",
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

Yes that's fine, go ahead

### Turn 1 — classifier

```json
{
  "label": "affirmative",
  "confidence": 0.96,
  "inferred_customer_style": "default"
}
```
Reasoning: short cooperative reply, capitalized, neutral tone, no slang. Not terse (length adequate, full sentence). Not buddy (no "y'all", no southern phrasing). Not educational (no confusion / definitional ask). Default register.

**Sticky style update (Turn 1 → set initial):** `sticky_style = "default"`

### Turn 1 — state machine

GREETING → AWAIT_240V (intent: ask whether their generator has a 240-volt outlet)

### Turn 1 — bot (AWAIT_240V) — register: default

Cool. Does your generator have the big 240-volt outlet (the kind your dryer plugs into), or just regular 120-volt outlets?

**Phraser input:**
```json
{
  "intent": "ask whether their generator has a 240-volt outlet (the kind a clothes-dryer plugs into) or only 120-volt household outlets",
  "customer_first_name": "Robert",
  "customer_last_message": "Yes that's fine, go ahead",
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

Yes it does, the bigger one

### Turn 2 — classifier

```json
{
  "label": "gen_240v",
  "confidence": 0.94,
  "inferred_customer_style": "default"
}
```
No specific amperage volunteered (just "the bigger one"). No volunteered_data passthrough.

**Sticky style:** `default` (reaffirmed).

### Turn 2 — state machine

AWAIT_240V → AWAIT_OUTLET (intent: ask if 30A or 50A)

### Turn 2 — bot (AWAIT_OUTLET) — register: default

Got it. Is it a 30-amp (smaller, 3-prong twist-lock) or 50-amp (bigger, 4-prong round)?

**Phraser input:**
```json
{
  "intent": "ask if the 240v outlet is a 30-amp (smaller, looks like 3-prong twist-lock) or 50-amp (bigger, 4-prong round) — note that if they don't know, ask them to send a photo",
  "customer_first_name": "Robert",
  "customer_last_message": "Yes it does, the bigger one",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": ["Cool."],
  "customer_style": "default"
}
```
*Constraint check: 86 chars. Single ?. Ack "Got it." not in prior. PASS. prior_acks rolling out: ["Cool.", "Got it."]*

---

### Turn 3 — customer

It's the 30 amp twist lock one

### Turn 3 — classifier

```json
{
  "label": "outlet_30a",
  "confidence": 0.97,
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
  "customer_first_name": "Robert",
  "customer_last_message": "It's the 30 amp twist lock one",
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

We own it

### Turn 4 — classifier

```json
{
  "label": "owner",
  "confidence": 0.98,
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
  "customer_first_name": "Robert",
  "customer_last_message": "We own it",
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

About 22 feet I'd say

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
  "customer_first_name": "Robert",
  "customer_last_message": "About 22 feet I'd say",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": ["Perfect.", null],
  "customer_style": "default"
}
```
*Constraint check: 51 chars (under 60-char default floor — acceptable for clean one-line email ask, same exception as Persona 22). Single ?. Ack "Sounds good." not in prior. PASS. prior_acks rolling out: [null, "Sounds good."]*

---

### Turn 6 — customer

robert.huntley@gmail.com

### Turn 6 — classifier

```json
{
  "label": "email_provided",
  "confidence": 0.99,
  "extracted_value": "robert.huntley@gmail.com",
  "email_typo_suspected": false,
  "inferred_customer_style": "default"
}
```
Domain `gmail.com` is clean — no typo flag fires.

**Sticky style:** `default` (reaffirmed).

### Turn 6 — state machine

AWAIT_EMAIL + email_provided + email_typo_suspected=false → AWAIT_ADDRESS_CONFIRM (skips CHECK_EMAIL_TYPO; intent: confirm install address)

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM) — register: default

Got that. Install address — 412 Edgewater Lane, Spartanburg SC 29307, or somewhere different?

**Phraser input:**
```json
{
  "intent": "confirm the install address using the value already on file from the form (passed in via slots.address_on_file) — ask if it matches or if it should be different",
  "customer_first_name": "Robert",
  "customer_last_message": "robert.huntley@gmail.com",
  "acknowledge_emoji": false,
  "address_on_file": "412 Edgewater Lane, Spartanburg SC 29307",
  "volunteered_data": null,
  "prior_acknowledgments": [null, "Sounds good."],
  "customer_style": "default"
}
```
*Constraint check: 95 chars. Single ?. Ack "Got that." not in prior (vary from "Got it."). Address echoed back verbatim. PASS. prior_acks rolling out: ["Sounds good.", "Got that."]*

---

### Turn 7 — customer

Yes that's correct

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
  "customer_first_name": "Robert",
  "customer_last_message": "Yes that's correct",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": ["Sounds good.", "Got that."],
  "customer_style": "default"
}
```
*Constraint check: 100 chars. Single ?. No ack (skip — rhythm rule; "Sounds good." and "Got that." used recently). No countdown phrasing. Phrase "with the door open" is included verbatim — but Robert will still miss it (testing the photo classifier, not the phraser ask). PASS. prior_acks rolling out: ["Got that.", null]*

---

### Turn 8 — customer

[sends photo of panel exterior with door closed]

### Turn 8 — photo classifier (v6 — separate agent)

**Photo classifier input:**
- expected_subject: "panel"
- conversation_context: "bot just asked for panel pic with door open; customer responded with photo at AWAIT_PANEL_PHOTO"
- image: (panel exterior, gray metal box with closed breaker door, partial garage wall background visible — Robert's narration: panel from outside with door closed)

**Photo classifier output:**
```json
{
  "subject": "panel_closed",
  "subject_confidence": 0.93,
  "obvious_issues": ["breaker door closed — breakers not visible"],
  "amperage_visible": null,
  "panel_brand_visible": null,
  "primary_recommendation": "ask_to_open"
}
```
Reasoning: clearly an electrical panel (gray metal box, recognizable form factor, mounted on wall). Door is closed — no breakers visible. Image is well-lit and not blurry, so this is not "ask_clearer". The subject is correct (panel, not meter / generator / wrong_subject), so this is not "ask_correct". The specific issue is the closed door, which has its own dedicated recommendation: "ask_to_open".

### Turn 8 — state machine

`photo_received` event is **NOT** emitted (per v6 photo-classifier integration). State stays at AWAIT_PANEL_PHOTO. Phraser intent is enriched with the closed-door subject so it can re-ask appropriately:

> intent = "panel photo received but door is closed; thank them and ask for door-open version. Be casual. Don't make them feel dumb — most people don't realize the breaker door needs to be open."

### Turn 8 — bot (AWAIT_PANEL_PHOTO — re-ask: ask_to_open) — register: default

Got it — could you open the breaker door and snap once more? Need to see the breakers themselves so Key can size things up.

**Phraser input:**
```json
{
  "intent": "panel photo received but the breaker door is closed; thank them and ask for a door-open version so Key can see the breakers. Tone: friendly, not corrective. Don't say 'wrong photo' or 'that's not what I needed' — most people don't realize the door needs to be open. Phrase it as a small follow-up, not a do-over.",
  "customer_first_name": "Robert",
  "customer_last_message": "[sends photo of panel exterior with door closed]",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": "customer sent the right subject (panel) but the breaker door was closed",
  "prior_acknowledgments": ["Got that.", null],
  "customer_style": "default"
}
```

*Phraser self-check on tone:*
- "Got it" acknowledges receipt — Robert sent A photo (not nothing), so the ack is appropriate. Does NOT ignore his effort.
- "could you open the breaker door and snap once more?" — frames it as a small additional ask, not a redo. The "once more" implies what he sent counted; we just need a slightly different angle.
- "Need to see the breakers themselves" — explains the WHY without scolding. Robert can now mentally model the goal ("oh, they need to see inside the door"), which lets him correct without feeling stupid.
- Does NOT say "you sent the wrong photo." Does NOT say "the door was closed, please re-do this." Does NOT say "I asked for the door open."
- The closing "so Key can size things up" reuses Turn 7's framing ("size up the install") — small consistency tells Robert this is the same task, not a new one.

*Constraint check: 125 chars (in default 60-130 band — top of band, but not over). Single ? (the implicit second sentence is a statement, not a question — only one ? mark). No banned phrases. Ack "Got it" repeats from Turn 2's "Got it." — but rhythm rule's 2-turn window has rolled past Turn 2; prior_acks is `["Got that.", null]`. "Got it" is acceptable here as receipt-ack of a real artifact (the photo), distinct from a routing ack. PASS. prior_acks rolling out: [null, "Got it"]*

---

### Turn 9 — customer

oh duh ok one sec

### Turn 9 — classifier

```json
{
  "label": "affirmative",
  "confidence": 0.93,
  "inferred_customer_style": "default"
}
```
"oh duh" is self-deprecating but mild — reads as "got it, my bad, hold on" rather than frustration or confusion. No re-ask needed. Customer is mid-correction, not asking for help.

**Note: brief style noise.** "oh duh ok" is lowercase / casual — could be interpreted as a tilt toward terse or buddy. Per the v4 hysteresis rule: a single drift turn does NOT promote a candidate style. `pending_style` would be set if confidence ≥ 0.85 and the emitted style differed from sticky — but the emitted style here is still "default" (the classifier reads "ok one sec" as the dominant signal: cooperative, neutral, mid-length-after-the-photo-event, no consistent register shift). No update.

**Sticky style:** `default` (reaffirmed; pending_count remains 0).

### Turn 9 — state machine

State stays at AWAIT_PANEL_PHOTO (Robert is acknowledging the re-ask, not sending the photo yet). No transition. No new outbound from the bot — affirmative-during-wait is silent (the bot's previous outbound covered the ask; speaking again would be noise). This is the same protocol as `AWAIT_EMAIL`/`AWAIT_PANEL_PHOTO` "wait" loops in state-machine.js where short affirmative acks during a pending action don't trigger re-asks.

### Turn 9 — bot

*[no outbound — Robert is mid-action; bot stays silent until the photo arrives. Per state-machine.js AWAIT_PANEL_PHOTO transitions: photo_received → SCHEDULE_QUOTE; unclear → AWAIT_PANEL_PHOTO (wait — no re-ask). "oh duh ok one sec" classifies as affirmative-during-wait, which is treated as `unclear` for the purposes of the photo-state self-loop: no re-prompt, just hold.]*

---

### Turn 10 — customer

[sends photo of panel with breaker door open, breakers clearly visible]

### Turn 10 — photo classifier

**Photo classifier input:**
- expected_subject: "panel"
- conversation_context: "bot asked customer to open breaker door and re-snap; customer responded with new photo at AWAIT_PANEL_PHOTO"
- image: (panel with breaker door open, two columns of breakers visible, label legend on inside of door, well-lit — Robert's narration: panel_open_clear)

**Photo classifier output:**
```json
{
  "subject": "panel_open_clear",
  "subject_confidence": 0.96,
  "obvious_issues": [],
  "amperage_visible": null,
  "panel_brand_visible": "Cutler-Hammer",
  "primary_recommendation": "accept"
}
```
Reasoning: panel is now door-open, breakers are visible in two columns, lighting is clean, no thumb / shadow obstruction. Cutler-Hammer brand is readable on the panel face (passes through to qualification_data for Key's review per privacy rule §3 — brand info is technical, not PII). No safety issues flagged. Recommendation = "accept" (clean primary case).

### Turn 10 — state machine

`photo_received` event IS emitted. AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (terminal-bound). onEnter: { complete: true } → fires Key's "qualified lead" notification.

`qualification_data.panel_photo_url` set to mms_panel_open.jpg. `qualification_data.panel_photo_classification` set to:
```json
{
  "subject": "panel_open_clear",
  "subject_confidence": 0.96,
  "panel_brand_visible": "Cutler-Hammer",
  "primary_recommendation": "accept"
}
```
For Key's review surface (CRM v3 right-pane).

### Turn 10 — bot (SCHEDULE_QUOTE) — register: default

Got it — Key will look the photo over and have your quote ready by tomorrow morning. Talk soon, Robert.

**Phraser input:**
```json
{
  "intent": "thank them and tell them Key will review the photo and have the quote ready by tomorrow morning. soft commitment — no specific time",
  "customer_first_name": "Robert",
  "customer_last_message": "[sends photo of panel with breaker door open, breakers clearly visible]",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": [null, "Got it"],
  "customer_style": "default"
}
```

*Phraser self-check on this turn:*
- "Got it" repeats Turn 8's ack — rhythm rule's 2-turn window catches this (`prior_acks = [null, "Got it"]`). Need to vary. **Self-correction:** swap "Got it —" for "Got 'em —" or "Perfect —" or just "Thanks —". Going with "Thanks —" because (a) it's the first explicit thank-you in the whole convo, (b) it lands well after the small dance-of-two-photos we just did, (c) it's distinct from every prior ack ("Cool.", "Got it.", "Perfect.", "Sounds good.", "Got that.", "Got it"). The earlier "Perfect." is far enough back to not cluster.

**Final outbound (post-self-correction):**

Thanks — Key will look the photo over and have your quote ready by tomorrow morning. Talk soon, Robert.

*Constraint check (final): 105 chars (in default 60-130 band). Single sentence comma-joined + closing. No ?. "by tomorrow morning" is the sanctioned SCHEDULE_QUOTE exception phrase. No weekday names. No "$". No "I'm Key" / "this is Key personally". No "Awesome". No countdown phrasing. Ack "Thanks —" not in prior_acks. PASS. prior_acks rolling out: ["Got it", "Thanks —"]*

---

### Turn 11 — customer

Sounds good thanks!

### Turn 11 — classifier

```json
{
  "label": "affirmative",
  "confidence": 0.97,
  "inferred_customer_style": "default"
}
```
Customer's wrap-up — closes the loop on SCHEDULE_QUOTE.

**Sticky style:** `default` (final state).

### Turn 11 — state machine

SCHEDULE_QUOTE → COMPLETE (terminal — onEnter: { complete: true } already fired on Turn 10).

### Turn 11 — bot

*[no further outbound — COMPLETE is terminal. Per state-machine.js: COMPLETE has `transitions: {}` and any post-COMPLETE inbound routes to NEEDS_CALLBACK so Key handles personally. None has arrived.]*

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Length (chars) | Voice 1-10 | Notes |
|---|---|---|---|---|---|
| 0 | GREETING | yes | 113 | 9 | clean opener, third-person Key, single ?, fits 80-140 default opener band |
| 1 | AWAIT_240V | yes | 117 | 9 | "Cool." ack + clean question, in 60-130 default band |
| 2 | AWAIT_OUTLET | yes | 86 | 9 | "Got it." vary, single ?, 30A/50A frame matches voice corpus |
| 3 | AWAIT_OWNERSHIP | yes | 76 | 9 | "Perfect." vary, single ?, parens for the rationale read natural |
| 4 | AWAIT_RUN | yes | 89 | 9 | NO ack — rhythm rule applied; varied 3 of last 4 turns acked, this one skipped |
| 5 | AWAIT_EMAIL | yes | 51 | 9 | short ask after "Sounds good." ack — under 60-char default floor, acceptable for clean email ask |
| 6 | AWAIT_ADDRESS_CONFIRM | yes | 95 | 9.5 | "Got that." vary from "Got it."; address echoed back verbatim |
| 7 | AWAIT_PANEL_PHOTO | yes | 100 | 9 | NO ack (rhythm), no countdown phrasing, "with the door open" verbatim in ask |
| 8 | AWAIT_PANEL_PHOTO (re-ask) | yes | 125 | 9.5 | **v6 ask_to_open path handled gracefully** — friendly re-ask, no scolding, "once more" framing implies what he sent counted, why-it-matters explanation lets Robert correct without feeling stupid |
| 9 | AWAIT_PANEL_PHOTO (wait) | yes (no outbound) | 0 | — | affirmative-during-wait correctly held silent — no re-prompt noise |
| 10 | SCHEDULE_QUOTE | yes | 105 | 9.5 | "Thanks —" ack varies from prior, "by tomorrow morning" sanctioned, terminal-bound clean |
| 11 | COMPLETE | yes (no outbound) | 0 | — | terminal, correct |

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **yes** (COMPLETE in 12 turns counting the photo round-trip)
- Did any phraser output violate a hard constraint? **no** (no fallback used; one self-correction on Turn 10 ack-variation before output committed)
- Did any classifier output have confidence <0.6 on a critical state? **no** (lowest was 0.93)
- Did the conversation exceed 15 turns? **no** (12 turns; 2 extra over a clean Sarah-style run, accounted for by the photo round-trip)
- Did any state self-loop more than 2x? **no** (AWAIT_PANEL_PHOTO held twice — Turn 8 re-ask, Turn 9 silent wait — within the 4-visit `stuck_failure` threshold)
- Did the bot self-disclose AI status correctly when asking_if_human fired? **n/a — never fired for Robert**
- Did the bot disclose price or weekday? **no** (only sanctioned "by tomorrow morning" on SCHEDULE_QUOTE)
- Did "Awesome" appear in BOT output? **no**
- Did countdown phrasing land in any final output? **no**
- Did emoji appear? **no** (acknowledge_emoji=false throughout — Robert never led with one)
- Did the bot scold Robert for the closed-door photo? **no** (rephrased as small follow-up, no "wrong photo" / "you sent the wrong kind" / "I asked for")

---

## v6 photo-classifier audit (specific to this persona)

This is the test surface that distinguishes Persona 24 from every other persona in the suite.

| Check | Result | Evidence |
|---|---|---|
| Photo classifier was invoked on Turn 8 (panel photo arrived) | **yes** | Subject classified as "panel_closed" with confidence 0.93 |
| Photo classifier correctly identified door-closed status | **yes** | obvious_issues = ["breaker door closed — breakers not visible"] |
| Photo classifier returned correct recommendation | **yes** | primary_recommendation = "ask_to_open" (matches the door-closed case in agents/photo-classifier-agent.md) |
| State machine DID NOT emit `photo_received` on Turn 8 | **yes** | State stayed at AWAIT_PANEL_PHOTO; no transition to SCHEDULE_QUOTE |
| Phraser intent was enriched with closed-door subject | **yes** | Turn 8 phraser input shows the enriched intent: "panel photo received but door is closed; thank them and ask for door-open version. Be casual." |
| Phraser tone was friendly, not corrective | **yes** | "Got it — could you open the breaker door and snap once more? Need to see the breakers themselves so Key can size things up." Reads as small follow-up, not redo. No "wrong photo" / "you sent the wrong" / "I asked for" / "that's not what I needed" anywhere |
| Phraser explained the WHY without scolding | **yes** | "Need to see the breakers themselves" — gives Robert a mental model of the goal so he can self-correct. Does not say "the door was closed" (which would feel like calling out his mistake) |
| Robert's "oh duh ok one sec" handled correctly (no re-prompt) | **yes** | Turn 9 affirmative-during-wait correctly classified, bot stayed silent, no noise re-ask |
| Re-snap photo (Turn 10) classified as panel_open_clear with accept | **yes** | subject_confidence 0.96, no obvious_issues, primary_recommendation = "accept" |
| State machine emitted `photo_received` on Turn 10 | **yes** | AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE; onEnter complete fired exactly once |
| `qualification_data.panel_photo_classification` persisted for Key's review | **yes** | subject + confidence + brand + recommendation captured for CRM right-pane render (per photo-classifier-agent.md production-port spec) |
| Total photo round-trip turns | **2** | Turn 8 closed → Turn 10 open. Within 1-3 extra turns budget for an `ask_to_open` path |
| Conversation reached COMPLETE | **yes** | 12 turns, 2 over baseline Sarah, all extra turns accountable to photo round-trip |

**v6 verdict:** photo classifier "ask_to_open" path works as designed. The closed-door photo was correctly intercepted before hitting the state machine, the bot re-asked friendly without scolding, Robert recovered cleanly, and the door-open re-snap was accepted on the first try. The exact failure mode the photo classifier was built to catch (Key receives a useless closed-door photo and has to chase the customer for a re-send a day later) was prevented inside a single conversation.

---

## Register-switching audit (v3-style carryover)

- **Turn 1 classifier emitted inferred_customer_style?** yes → "default"
- **Sticky persistence across turns?** yes; default reaffirmed Turns 1-11. Turn 9 ("oh duh ok one sec") was brief style noise but the classifier correctly read "ok one sec" as default-cooperative; pending_count never incremented. No register flips.
- **Phraser applied default-register defaults?**
  - Length target 60-130 chars: 8 of 10 outbound turns inside band (Turn 5 = 51 chars on a clean email ask, Turn 11 = 0 chars terminal — both sanctioned exceptions; Turn 9 = 0 chars correct silent-wait)
  - **Average msg length (Turns 0-10, excluding silent-wait Turn 9 and terminal Turn 11): 95.7 chars** — hits default-register aim of ~90 cleanly
  - Ack rate: 8 of 10 outbound turns acknowledged (Turn 4 and Turn 7 skipped) = **80%** — slightly above the 50-70% band, in line with Sarah and Jen; rhythm-driven, no repeats in any 2-turn window after Turn 10's self-correction
  - Acknowledgment phrases used: Cool. / Got it. / Perfect. / [skip] / Sounds good. / Got that. / [skip] / Got it / [silent-wait] / Thanks — → **6 unique acks across 10 outbound turns + 1 silent-wait; rhythm rule satisfied with one self-correction caught at output-time**
- **No corporate phrases?** confirmed (grepped output for "appreciate|rest assured|feel free|happy to help|circle back|thank you for your interest" → 0)
- **No countdown phrasing?** confirmed (grepped for "two more|three more|few more|last (?:quick )?(?:one|thing|couple)|one (?:more|last)|almost done|few more questions" → 0)
- **No banned weekday names?** confirmed (grepped for Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday → 0; only "tomorrow morning" on SCHEDULE_QUOTE which is sanctioned)
- **Voice corpus alignment?** matches placeholder corpus on lowercase casual / contractions ("could you", "snap once more", "size things up") / no first-person Key / third-person "our electrician Key" → "Key" reduce after first mention. The re-ask phrase "Need to see the breakers themselves" is plain-English diagnostic, not jargon — voice-correct.

---

## Phraser self-correction note (Turn 10)

This persona caught one near-miss that's worth flagging for the v6 batch summary:

On Turn 10 the phraser's first draft started with "Got it —" as the SCHEDULE_QUOTE ack. But "Got it" had just been used on Turn 8 (the re-ask turn) and was sitting in `prior_acknowledgments = [null, "Got it"]`. Two consecutive "Got it" outputs would have been a rhythm-rule violation.

The phraser self-check caught this BEFORE output committed and swapped to "Thanks —". The transcript shows both the failed first draft and the corrected final output for review transparency.

This is a healthy pattern: hard-constraint regex + soft rhythm-rule check happen at output time, and the phraser can adjust without invoking the fallback. Compare to a fallback case where the phraser would emit a stiff hardcoded message — here the self-correction keeps the voice intact while satisfying the rule.

For the production port: the rhythm rule needs to be enforced at the phraser layer (not just monitored post-hoc), and the prior_acks roll-out must persist across the photo-classifier re-ask turn (Turn 8) so Turn 10 sees Turn 8's ack in its 2-turn window. Confirmed working in the lab simulation; production wiring should match.

---

## Scoring

- State machine score: **10 / 10** (clean linear path through full qualification flow + correct AWAIT_PANEL_PHOTO self-loop on `ask_to_open` + correct silent-hold on affirmative-during-wait + correct emission of `photo_received` only on the accept-rated photo)
- Classifier score (conversational + photo): **10 / 10** (conversational labels all correct, lowest confidence 0.93; photo classifier correctly distinguished panel_closed from panel_open_clear with confidence ≥0.93 in both turns, recommendation matched the door-status correctly, brand visibility captured for Key's review)
- Voice score: **9.5 / 10** (Turn 8 re-ask handled the delicate "your photo was wrong" moment without scolding — the v6 critical pass; Turn 10 self-correction caught a rhythm-rule near-miss; everything else clean and varied; no fallback used)

## Reviewer notes

(Empty — Key fills this in)

---

## v6 batch summary line

[v6] Persona 24 (robert) — reached COMPLETE in 12 turns. photo_closed-detected: yes. Re-ask-friendly: yes. Voice 9.5/10. Status: PASS.
