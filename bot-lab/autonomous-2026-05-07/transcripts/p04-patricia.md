# Persona 04 — Patricia (Off-Script Price Asker)

**Date:** 2026-05-07
**Persona file:** customer-personas.md → Persona 04
**Expected terminal:** NEEDS_CALLBACK
**Actual terminal:** NEEDS_CALLBACK
**Turns:** 8
**Status:** PASS

Ground truth: 50A 240V, owner, 18ft run, Greer SC. But she only cares about price.
Stress test: how many price-redirects can Ashley sustain before she breaks character, quotes a number, or escalates?

---

## Conversation

### Turn 0 — bot (GREETING, variant A)
Hey Patricia — Ashley w/ Backup Power Pro, thanks for filling out the form. Got a sec to run through a few quick questions so Key (our electrician) can get you a quote put together?

### Turn 1 — customer
yeah it's a 50 amp 240, just tell me what this is gonna cost

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.88
- inferred_customer_style: "terse"
- volunteered_data: "customer also said 50 amp 240V outlet"
- off_topic_excerpt (secondary): "just tell me what this is gonna cost"

> Note: Per disambiguation rule 3 (PRICE always wins even mid-sentence), this could route as off_topic_question. But she ALSO answered the routing question (affirmative + volunteered 240V/50A) — orchestrator captures volunteered slots and the off_topic_excerpt as a secondary signal. State machine routes on affirmative → AWAIT_240V; phraser receives volunteered_data AND knows price was just asked, so it deflects price + acks the volunteered specs + skips the 240V/outlet question entirely (already answered).

### Turn 1 — state machine
GREETING → AWAIT_240V → (volunteered slots resolve) → skip to AWAIT_PANEL_PHOTO

### Turn 1 — bot (AWAIT_PANEL_PHOTO, with price deflection prelude)
Got it — 50A on a 240V outlet, that's the most common whole-home setup. On price: Key sets the final number after he sees your panel and the run, every job's a little different. Quickest way there is a photo of your main breaker panel with the door open — want to grab that real quick?

---

### Turn 2 — customer
i'm not sending a photo until i know roughly what this costs

### Turn 2 — classifier
- state: AWAIT_PANEL_PHOTO
- label: off_topic_question
- confidence: 0.94
- off_topic_excerpt: "not sending a photo until i know roughly what this costs"
- inferred_customer_style: "terse" (sticky)

### Turn 2 — state machine
AWAIT_PANEL_PHOTO → AWAIT_PANEL_PHOTO (self-loop on off_topic_question, photo states have no off_topic_question key — falls to unclear-style wait, but enriched intent: "deflect price politely + re-ask panel photo")

> Orchestrator note: AWAIT_PANEL_PHOTO transitions don't list off_topic_question explicitly — falls through to NEEDS_CALLBACK by default. Per phraser intent enrichment, the orchestrator overrides: redirect #1 still pending, give one more deflect-and-ask before escalation.

### Turn 2 — bot (AWAIT_PANEL_PHOTO, redirect #2)
Totally fair to ask. Honest answer — most installs in your county land in a similar range, but Key won't put a real number on it without seeing the panel photo + your address, otherwise it's a guess and that's not how he works. Send the panel pic and he'll have a real quote back to you fast.

---

### Turn 3 — customer
ballpark. just give me a ballpark

### Turn 3 — classifier
- state: AWAIT_PANEL_PHOTO
- label: off_topic_question
- confidence: 0.97
- off_topic_excerpt: "ballpark. just give me a ballpark"
- inferred_customer_style: "terse"

### Turn 3 — state machine
AWAIT_PANEL_PHOTO → AWAIT_PANEL_PHOTO (second consecutive off_topic at same state — orchestrator flags repeated_offtopic_count=2, escalation pending)

### Turn 3 — bot (AWAIT_PANEL_PHOTO, redirect #3 — varied phrasing, last try before escalation)
Promise I'm not dodging — Key's the one with the license to quote it and he won't ballpark blind, he'd rather call you and walk through it than pull a number out of the air. Want me to have him give you a quick call instead?

> Phraser intent: deflect + offer the human-handoff exit ramp. Variation: redirect 1 leaned on "every job's different", redirect 2 on "won't guess without panel photo", redirect 3 reframes as "Key would rather call than ballpark". No verbatim repetition.

---

### Turn 4 — customer
fine yeah have him call

### Turn 4 — classifier
- state: AWAIT_PANEL_PHOTO
- label: asking_for_human
- confidence: 0.95
- inferred_customer_style: "terse"

### Turn 4 — state machine
AWAIT_PANEL_PHOTO → NEEDS_CALLBACK (universal escape)
- onEnter: notify Key with off_topic_excerpt history ("just tell me what this is gonna cost" / "not sending a photo until i know roughly what this costs" / "ballpark. just give me a ballpark")
- callback context: 50A 240V confirmed, address on file = 33 Devenger Rd Greer 29650, panel photo NOT collected, customer wants price ballpark before committing further

### Turn 4 — bot (NEEDS_CALLBACK terminal)
Sounds good — Key'll give you a call shortly so y'all can talk it through directly. Address on file is 33 Devenger Rd in Greer, that still the spot? He'll text you a quote after.

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Notes |
|---|---|---|---|
| 0 | GREETING | PASS | variant A, name + thanks + setup, 0 weekday names, no $ |
| 1 | AWAIT_PANEL_PHOTO | PASS | volunteered_data ack ("50A on 240V… most common whole-home setup") proves recognition; deflection clause uses confidence-with-hedge ("Key sets the final number after he sees your panel"); 0 $, 0 weekday |
| 2 | AWAIT_PANEL_PHOTO | PASS | redirect varies — "won't put a real number on it without seeing"; no $ leak; under 280 char |
| 3 | AWAIT_PANEL_PHOTO | PASS | redirect #3 varies again — "rather call you than pull a number out of the air"; offers callback exit; under 280 char |
| 4 | NEEDS_CALLBACK | PASS | terminal handoff, address re-confirm; 0 $, 0 weekday |

---

## Auto-flags

- Reached expected terminal (NEEDS_CALLBACK): YES
- Any phraser hard-constraint violation: NO
- Any classifier confidence <0.6 on a critical state: NO
- Conversation exceeded 15 turns: NO (4 customer turns + greeting)
- Any state self-loop >2x: AWAIT_PANEL_PHOTO self-looped 3x (within tolerance — bot escalated to NEEDS_CALLBACK on turn 4 via asking_for_human, not via stuck flag)
- Did bot ever quote a number / weekday / "I'm Key" / $: NO

---

## Critical-test scoring (Key's stated stress goals)

1. **Did Ashley quote a number?** No. Three redirects all dodged price cleanly.
2. **Did she vary language across redirects?**
   - Redirect #1 (T1): "every job's a little different" + bridge to photo ask
   - Redirect #2 (T2): "won't put a real number without seeing the panel + address, otherwise it's a guess and that's not how he works"
   - Redirect #3 (T3): "Key won't ballpark blind, he'd rather call you than pull a number out of the air"
   - Three distinct framings, no verbatim repeats. Pass.
3. **Did she escalate at the right moment?** Yes — redirect #3 included the human-handoff offer, which Patricia accepted. Cleanly routed to NEEDS_CALLBACK with full off_topic_excerpt history captured for Key.
4. **Did she sound robotic?** No. Each redirect read as a different real-person reframe rather than a canned deflection. The "honest answer — most installs in your county land in a similar range" phrasing in redirect #2 acknowledges the customer's frustration rather than stonewalling.

---

## Scoring

- State machine score: 9 / 10 (clean path; minor: AWAIT_PANEL_PHOTO doesn't list off_topic_question explicitly — relies on orchestrator override. Worth adding explicit transition.)
- Classifier score: 10 / 10 (caught off_topic_question at high confidence on T2 + T3, picked up volunteered specs on T1, caught asking_for_human on T4)
- Voice score: 9 / 10 (varied redirects, confidence-with-hedge, no boilerplate)

## Reviewer notes

Open question for Key: do we want the bot to escalate to NEEDS_CALLBACK *automatically* after 2 consecutive off_topic_question labels at the same photo state, or wait for the customer to accept the human-handoff offer (current behavior)? The current pattern lets Patricia self-select into the callback, which feels less pushy. But there's a failure mode where a customer keeps demanding price 5+ times without ever accepting the offer — at that point the orchestrator would auto-route via stuck_failure (4+ visits to same state). Worth tightening: after 3 off_topic at the same state, force NEEDS_CALLBACK without waiting for asking_for_human.
