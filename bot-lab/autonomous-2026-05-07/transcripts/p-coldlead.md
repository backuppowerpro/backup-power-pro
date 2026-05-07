# Persona — Jen ColdLead (5-day silent return)

**Date:** 2026-05-07
**Persona base:** Persona 22 (Jen) — repurposed as "cold-return" scenario
**Scenario:** Form submitted 5 days ago. Bot greeted (form-confirmed-240V opener
that ended with the voltage/amperage question + photo offer). State left at
AWAIT_240V. Customer never replied. No bot-reengagement nudge had fired yet
(or fired and was ignored). Jen now sends an unprompted cold inbound.

**Pre-state at inbound:**
- bot_state: `AWAIT_240V`
- last_bot_outbound_at: 5 days ago (greeting v3, 240V variant)
- last_bot_inbound_at: null
- qualification_data.form_240v_confirmed: true
- name: "Jen"

**Expected terminal:** advance to AWAIT_PANEL_PHOTO (with photo) or stay
AWAIT_240V (with affirmative-only) — for this single-inbound test we score
ONLY the bot's resume reply.

---

## Conversation

### Turn 0 — bot (GREETING / AWAIT_240V — 5 days ago)
Good afternoon. This is Ashley at Backup Power Pro, helping Key with intake on the home connection for your generator. I just want to confirm the outlet on your generator: is it a 240V 30-amp or 50-amp outlet? If you are unsure you can send a picture of the outlet whenever you get a chance.

### [5 day gap — no inbound]

### Turn 1 — customer (Jen, cold return)
still want to do this if yall still around

### Turn 1 — classifier
- state: AWAIT_240V
- label: affirmative
- confidence: 0.78
- extracted_value: null
- inferred_customer_style: terse (lowercase, no punctuation, 8 words)
- notes: "still want to do this" = affirmative intent to proceed; "if yall
  still around" = light availability check, NOT off_topic_question (no
  pricing/scheduling/load ask). Voltage question NOT answered — she's
  re-engaging, not answering. Classifier label routes to affirmative
  (re-affirms intent), state machine self-loops on AWAIT_240V because
  no voltage extracted, but phraser intent is enriched with
  `cold_return=true` so the resume copy is right.

### Turn 1 — state machine
- AWAIT_240V → AWAIT_240V (self-loop; no voltage extracted; intent enriched)
- phraser intent: "cold-return resume — confirm we're here, do not dwell on
  the gap, do not say 'thanks for getting back to us', do not make her
  apologize. Re-pose the AWAIT_240V paired ask in shortened form (default
  register, terse mirror). No 'circling back' (that's a bot-reengagement
  cron phrase). Light reassurance of availability since she asked. Pivot
  immediately back to voltage/amp + photo offer."

### Turn 1 — phraser inputs
- intent: "cold-return resume from AWAIT_240V; affirm availability without
  dwelling; re-ask voltage/amp + photo offer in mirrored terse register"
- customer_first_name: "Jen"
- customer_last_message: "still want to do this if yall still around"
- acknowledge_emoji: false
- customer_style (sticky): terse
- customer_recent_length: ~32 chars
- two_message_split: true (cold-return + state machine moving forward)
- prior_acknowledgments: []
- ack_skip_target: 35%
- cold_return: true
- gap_days: 5

### Turn 1 — bot (AWAIT_240V, two-message split)

**Bubble A** (no question, just landing):
Yep, still here.

**[3-5s pause]**

**Bubble B** (re-pose paired ask, shortened, mirror her terseness):
Quick one to pick it up — is the outlet on the generator 240V 30-amp or 50-amp? Pic of it works too if easier.

---

## Auto-flags

- Did the bot reach a terminal? N/A — single-inbound test.
- Did phraser violate hard constraints? ✅ no
  - No "$", no weekday names, no "I'm Key", under 280 chars per bubble,
    no banned phrases ("thanks for getting back to us", "I appreciate",
    "rest assured", "feel free to").
- Did the bot dwell on the 5-day gap? ❌ no — single 3-word landing
  ("Yep, still here.") then pivot.
- Did the bot make Jen apologize for the gap? ❌ no — no "no worries"
  / "no problem" framing, which would imply she'd done something
  needing forgiveness.
- Did the bot use stale-customer-service phrasing? ❌ no — no "thanks
  for getting back to us", no "great to hear from you", no "we're glad
  you reached out".
- Did the bot use the bot-reengagement cron's phrasing? ❌ no — avoided
  "Circling back" / "Quote is still open" / "Holding the quote" (those
  are Ashley's outbound-nudge voice, wrong register for the customer
  initiating the return).
- Did the bot resume from AWAIT_240V correctly? ✅ yes — paired ask
  (voltage + amperage + photo escape hatch) in shortened form per the
  v10.1 default-register two-message split rule.
- Did the bot mirror her terse register? ✅ yes — Bubble A is 3 words,
  Bubble B is ~110 chars (down from greeting's ~220 chars).

---

## Why this works (voice notes)

1. **"Yep, still here."** acknowledges her availability check directly
   in her register (lowercase casual + 3 words) without making the gap
   a topic. It answers her actual sub-question ("if yall still around")
   in 3 words and moves on.

2. **No gap apology, no "thanks for getting back".** Treating the
   5-day silence as a non-event is itself the warmth move. Bringing
   it up — "no worries about the delay!", "thanks for circling back!" —
   would force her to feel like she'd been rude. She wasn't. Life
   happened. Premium service holds its posture.

3. **Pivot back to AWAIT_240V naturally.** "Quick one to pick it up"
   signals she's back in flow without re-explaining who Ashley is or
   what BPP does (the greeting did that 5 days ago; she remembered
   enough to text back, she doesn't need it again).

4. **Photo escape hatch preserved.** "Pic of it works too if easier"
   is the same low-friction offer the original greeting had, just
   compressed. A cold-return customer is more skittish than a fresh
   one — keeping the easy out matters extra here.

5. **Two-bubble split** mimics how Key actually texts on cold returns
   (per OpenPhone corpus): a quick presence-confirm, then the next
   ask 3-5s later. Reads like a human typing two thoughts, not a bot
   firing one composed paragraph.

---

## Scoring (lab estimate, pending voice judge)

- State machine: 10/10 — correct self-loop, correct intent enrichment.
- Classifier: 9/10 — affirmative is right; confidence 0.78 reflects
  the soft availability-check that could pull a less-tuned classifier
  toward off_topic_question.
- Voice: 9/10 — terse mirror, no stale-CS, no dwell. Could arguably
  drop to single bubble for a true terse customer, but the split
  models Key's real cold-return pattern.

## Reviewer notes

(empty until Key fills in)
