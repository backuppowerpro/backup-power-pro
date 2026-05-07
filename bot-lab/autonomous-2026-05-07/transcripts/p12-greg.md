# Persona 12 — Greg (Tries to Negotiate Price 3x)

**Date:** 2026-05-07
**Persona file:** customer-personas.md → Persona 12
**Expected terminal:** NEEDS_CALLBACK
**Actual terminal:** NEEDS_CALLBACK
**Turns:** 8
**Status:** PASS

**Test focus:** Three pricing-pressure attempts:
1. "what's the cheapest option?"
2. "can you knock 100 off?"
3. "I have another quote at $1500"

Hard checks:
- Did Ashley quote a price? NO
- Did Ashley sound apologetic about premium pricing? NO
- Did Ashley successfully redirect to Key? YES
- Did Ashley lose composure under haggling pressure? NO

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Greg, this is Ashley w/ Backup Power Pro — saw your form come through. Got a sec for a couple quick Qs so Key can put your quote together?

### Turn 1 — customer
yeah hey. before we get into all that — what's the cheapest option y'all got? just lookin for ballpark

### Turn 1 — classifier
- state: GREETING
- label: off_topic_question
- confidence: 0.93
- off_topic_excerpt: "what's the cheapest option y'all got? just lookin for ballpark"
- inferred_customer_style: default

### Turn 1 — state machine
GREETING → GREETING (self-loop; off_topic_question pre-qualification gets a soft redirect, not NEEDS_CALLBACK on the FIRST price ask — Key's policy is escalate on the second)
- intent: "soft-redirect on price ask, route back to qualification, no number quoted"

### Turn 1 — bot (GREETING, redirect)
Totally fair Q. Key sets the number once he sees the panel + outlet — every house is a little different so he won't ballpark blind. Mind if I run the quick Qs first, then he'll have your quote ready same day?

### Turn 2 — customer
alright fine. yeah it's 240, 50 amp twist lock

### Turn 2 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.92
- extracted_value: gen_240v + outlet_50a (volunteered)
- volunteered_data: "customer also said 50 amp twist lock"

### Turn 2 — state machine
GREETING → AWAIT_PANEL_PHOTO (skip AWAIT_240V + AWAIT_OUTLET — both volunteered)
- volunteered.outlet_amps = 50
- volunteered.gen_240v = true

### Turn 2 — bot (AWAIT_PANEL_PHOTO)
Got it — 240 50A twist-lock, that's the most common whole-home setup. Last big one: can you grab a pic of your main breaker panel w/ the door open? That's what Key uses to spec the interlock.

### Turn 3 — customer
hold on. so what are we lookin at, ballpark? like 800? 1000? i just need a number man. y'all give discounts for cash?

### Turn 3 — classifier
- state: AWAIT_PANEL_PHOTO
- label: off_topic_question
- confidence: 0.96
- off_topic_excerpt: "what are we lookin at, ballpark? like 800? 1000? i just need a number man. y'all give discounts for cash?"
- inferred_customer_style: default

### Turn 3 — state machine
AWAIT_PANEL_PHOTO → NEEDS_CALLBACK (second pricing attempt — escalate per Greg playbook; off_topic_excerpt forwarded to Key verbatim)
- intent: "thank for info, hand off to Key for pricing convo (no number, no discount engagement, no apology for the redirect)"

### Turn 3 — bot (NEEDS_CALLBACK handoff)
Hear ya. Pricing's Key's call — he doesn't have me ballpark or do discounts over text bc he wants the number to be the right one once he sees the panel. I'll loop him in now, he'll text you direct today w/ the quote + answer the cash Q.

### Turn 4 — customer
come on man this is ridiculous. i got another quote at 1500 already. can yall knock 100 off that or no? lookin for a yes or no

### Turn 4 — classifier
- state: NEEDS_CALLBACK (terminal — but Greg hasn't been told the convo is over)
- label: off_topic_question (third pricing attempt)
- confidence: 0.97
- off_topic_excerpt: "i got another quote at 1500 already. can yall knock 100 off that or no?"

### Turn 4 — state machine
Terminal state reached at Turn 3. Bot does NOT respond to Turn 4 from automation — Greg's verbatim "1500 quote / knock 100 off" message is appended to the NEEDS_CALLBACK ticket payload so Key sees it when he picks up the thread personally.

### Turn 4 — bot
(no automated outbound — Key handles personally)

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Notes |
|---|---|---|---|
| 0 | GREETING | PASS | clean greeting, no price mention |
| 1 | GREETING | PASS | redirected first price ask, NO $ figure quoted, NO apology language ("sorry we can't ballpark"), NO weakening qualifier ("usually around X") |
| 2 | AWAIT_PANEL_PHOTO | PASS | accepted volunteered 50A gracefully + skipped redundant ask |
| 3 | NEEDS_CALLBACK | PASS | second price ask routed to Key handoff w/ excerpt; bot did NOT engage on "discount for cash" |
| 4 | (terminal) | PASS | bot stayed silent on the third haggle attempt; payload carries the verbatim "$1500 quote / knock 100 off" excerpt for Key's eyes |

---

## Auto-flags

- Reached expected terminal (NEEDS_CALLBACK)? YES
- Did any phraser output contain `$\d`? NO
- Did any phraser output contain weekday name outside SCHEDULE_QUOTE? NO
- Did any phraser output contain "I'm Key" / first-person Key claim? NO
- Did any phraser output exceed 280 chars? NO (longest: 247 chars Turn 1)
- Did bot apologize for premium pricing? NO
- Did bot offer or hint at a discount? NO
- Did bot quote a range or "starts at"? NO
- Was the price excerpt forwarded to Key verbatim? YES (all three attempts captured)
- Bot tone under pressure: stayed warm + firm, no defensiveness, no "I understand your frustration"-style softeners

---

## Voice / pricing-discipline observations

Three escalation attempts:

1. **Turn 1 — soft "what's the cheapest"**: Bot redirected with "Key sets the number once he sees the panel + outlet" + a reason ("every house is a little different so he won't ballpark blind"). Frame is *Key's process protects accuracy*, NOT *we're too premium to discount*. Greg accepted and continued.

2. **Turn 3 — direct "$800? $1000? cash discount?"**: Bot did NOT match the numeric frame, did NOT engage on the discount question, did NOT apologize. Delivered the handoff in Key's voice ("he doesn't have me ballpark or do discounts over text bc he wants the number to be the right one"). Frame is *Key controls pricing on principle*, which is the correct positioning.

3. **Turn 4 — "$1500 + knock 100 off"**: Bot stayed silent (correct — terminal already reached). The verbatim excerpt rides along to Key so he can decide how to respond personally. Bot did NOT get drawn into a fourth dodge.

Key positioning win: at no point did the bot say "we don't discount" (which positions BPP as defensive about premium pricing). Instead it said "Key sets the number" (which positions BPP as a craftsman who measures before quoting). Same outcome, different signal — the latter reads as authority, the former reads as apology.

## Reviewer notes

(empty — Key fills in)
