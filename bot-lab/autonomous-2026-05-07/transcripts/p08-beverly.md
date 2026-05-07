# Persona 08 — Slow Responder Beverly (multi-hour-gap variant)

**Date:** 2026-05-07
**Test goal:** Verify the bot does NOT reference time gaps awkwardly,
does NOT apologize for delay (the customer is the one delayed, not
the bot), and does NOT repeat questions or re-prompt impatiently
within the same conversation. The 24h re-engagement cron is the only
mechanism allowed to nudge after long silence; mid-conversation, the
bot simply continues the next turn whenever the customer replies.

**Persona:** Beverly, older homeowner, polite but terse. Replies in
4–12 hour bursts because she doesn't keep her phone close. ALL CAPS
on individual words for emphasis. Strict role-blur prevention —
Beverly NEVER speaks as Ashley; Ashley NEVER speaks as Beverly.

**Ground truth:**
```json
{
  "first_name": "Beverly",
  "owner": true,
  "gen_240v": true,
  "outlet_amps": 50,
  "run_feet": 30,
  "address_correct": true,
  "service_area": "Pickens",
  "expected_terminal": "COMPLETE"
}
```

---

## Pre-conversation state

- Form submitted Tuesday 8:42 AM. Form pre-confirms 240V checkbox.
- contact_id assigns greeting_variant via sha256 → variant `B` for Beverly.
- time_of_day_bucket: `morning`
- bot-reengagement cron: armed, 24h-after-no-reply. NEVER fires
  mid-conversation; Beverly always replies before 24h elapses, so
  the cron stays dormant the whole way through.

---

## Turn 1 — GREETING (Tuesday 8:42 AM)

**Ashley (templated, variant B):**
> Hi Beverly, this is Ashley with Backup Power Pro. Thanks for the
> request on the generator inlet. I just need a few quick details so
> Key can put together an accurate quote. Mind if I run through them?

**Beverly (Tuesday 12:51 PM — ~4hr gap):**
> YES go ahead

**Classifier:**
```json
{ "label": "affirmative", "confidence": 0.96 }
```

**State:** GREETING → AWAIT_240V
**Bot-side note:** orchestrator sees 4hr inbound gap. No special
handling — gap is between greeting and first reply, treated as a
normal first response. No "thanks for getting back" opener.

---

## Turn 2 — AWAIT_240V (Tuesday 12:52 PM)

**Ashley (phraser, default register, no time-gap reference):**
> Awesome. To start, does the generator put out 240V, and do you
> happen to know if the outlet on it is the round 4-prong twist-lock
> or the bigger straight-blade 50A? Pic works too if it's easier.

**Beverly (Tuesday 5:14 PM — ~4hr gap, after work):**
> 240v YES. it's the bigger one i think. 50

**Classifier:**
```json
{
  "label": "outlet_50a",
  "confidence": 0.93,
  "extracted_slots": {
    "gen_240v": true,
    "outlet_amps": 50,
    "outlet_type": "14-50R"
  }
}
```

**State:** AWAIT_240V → AWAIT_PANEL_PHOTO (gen_240v + outlet
captured in same inbound; orchestrator collapses AWAIT_OUTLET)
**Slot store:** `{ gen_240v: true, outlet: "50a_240v" }`

---

## Turn 3 — AWAIT_PANEL_PHOTO (Tuesday 5:15 PM)

**Ashley (phraser; rotation: brand-color skip; bare ack; 50A
rotation pool entry "50 amp, you've got the bigger setup."):**
> Got it. 50 amp, you've got the bigger setup. Could you snap a pic
> of your main electrical panel with the door open? Just want Key
> to see the breakers. No rush, whenever you get a chance.

*Note: phraser intentionally does NOT say "great, sorry for the
delay" or "thanks for getting back" — Beverly's the one with the
gap, not Ashley. Continuing the conversation as if no time passed
is the correct behavior. Also includes "no rush" softener (matches
v10 photo-request pool, doubly appropriate for a slow responder).*

**Beverly (Wednesday 8:03 AM — ~15hr gap, slept through evening
window, replied with morning coffee):**
> [image: panel.jpg — 200A panel, main breaker top, ~28 breakers,
> Square D QO]

**Photo classifier:**
```json
{
  "is_panel": true,
  "main_breaker_present": true,
  "amps": 200,
  "brand": "Square D"
}
```

**Orchestrator emits:** `photo_received`
**State:** AWAIT_PANEL_PHOTO → AWAIT_RUN
**Slot store:** `{ ..., panel_photo: ok, panel_amps: 200,
panel_brand: "Square D" }`

**CRITICAL CHECK:** the bot-reengagement cron is armed for 24h
after Tuesday 5:15 PM. Beverly replied at Wednesday 8:03 AM (~15h),
which is INSIDE the 24h window, so the cron never fires. No "hey
just checking in" message goes out. This is the correct behavior
even though the gap felt long.

---

## Turn 4 — AWAIT_RUN (Wednesday 8:04 AM)

**Ashley (phraser; brand-recognition rotation pool entry: panel-photo
specific):**
> Got the photo, that's a Square D, clean for the interlock. Most
> main panels around here are mounted in the garage on an exterior
> wall, the one that backs up to the outside of the house. Is that
> your setup, or somewhere else?

**Beverly (Wednesday 1:22 PM — ~5hr gap, lunch break):**
> garage exterior wall YES. about 30 ft from where i keep the generator

**Classifier:**
```json
{
  "label": "run_length_provided",
  "confidence": 0.95,
  "extracted_slots": {
    "panel_location": "garage_exterior",
    "run_feet": 30
  }
}
```

**State:** AWAIT_RUN → AWAIT_ADDRESS_CONFIRM
**Slot store:** `{ ..., panel_location: "garage_exterior",
run_feet: 30 }`

---

## Turn 5 — AWAIT_ADDRESS_CONFIRM (Wednesday 1:23 PM)

**Ashley (phraser; run-length rotation pool entry "X feet, clean
run."; SKIP-THE-ACK rule fires here — push direct):**
> 30ft, clean run. Address on file is 78 Mill Pond Road, Pickens
> 29671. That the install address?

**Beverly (Wednesday 7:45 PM — ~6hr gap):**
> YES that's correct

**Classifier:**
```json
{
  "label": "address_confirmed",
  "confidence": 0.98,
  "extracted_slots": { "address_correct": true }
}
```

**State:** AWAIT_ADDRESS_CONFIRM → AWAIT_EMAIL (email already on
file from form submission: bev.simmons@bellsouth.net) →
collapses → SCHEDULE_QUOTE → COMPLETE

---

## Turn 6 — SCHEDULE_QUOTE / COMPLETE (Wednesday 7:46 PM)

**Ashley (phraser; recap rotation pool entry "Just to confirm:";
sign-off rotation pool entry "I would be happy to help with the
project."; permit-timeline OMITTED per ~50% skip rule):**
> Perfect. Just to confirm:
> - 240V generator, 50A outlet
> - Square D 200A panel, garage exterior wall
> - 30ft run to where you store the generator
> - Install at 78 Mill Pond Road, Pickens
>
> I'll pass this to Key and he'll text you back with the quote. I
> would be happy to help with the project.

**Beverly (Thursday 7:12 AM — ~12hr gap, morning):**
> THANK YOU

**Classifier:**
```json
{ "label": "thanks_terminal", "confidence": 0.99 }
```

**State:** COMPLETE (terminal). No further outbound. No
re-engagement cron arms (terminal states don't get the 24h nudge).

---

## Verdict

| Check | Result |
|---|---|
| Bot referenced time gaps in copy | NO — zero "thanks for getting back", zero "sorry for the delay", zero "no worries about the wait" |
| Bot apologized for the customer's pause | NO |
| Bot re-prompted impatiently mid-conversation | NO — never sent a follow-up before Beverly replied |
| 24h cron fired mid-conversation | NO — every Beverly gap was <24h, cron stayed dormant |
| Conversation felt cohesive across hour-gaps | YES — each turn reads as a natural continuation; if you stripped the timestamps, it would read as a single sitting |
| Phraser used rotation pools | YES — 50A pool ("you've got the bigger setup"), Square D brand pool, run-length pool ("clean run"), recap pool ("Just to confirm:"), sign-off pool ("I would be happy to help") |
| Em-dashes | ZERO |
| Role blur | NONE — Beverly's ALL-CAPS register stayed hers; Ashley's default register stayed hers |
| Customer count of bot turns | 6 (greeting + 5 mid-flow), matches the qualification arc with no padding |

**Final terminal:** COMPLETE
**Total real-time elapsed:** ~46 hours (Tue 8:42 AM → Thu 7:12 AM)
**Total bot outbound:** 6 messages
**Total customer inbound:** 6 messages
**Average gap between Beverly's reply and her prior bot message:**
~7.5 hours
**Worst gap (panel photo):** ~15 hours — still inside cron window,
no nudge fired

**Critical path tested:** the bot's conversation-state has no
notion of wall-clock time between turns; it just continues from
wherever the slot machine left off when the next inbound arrives.
The 24h re-engagement cron is the ONLY time-aware mechanism, and
it's correctly gated to states that have gone genuinely cold
(>24h with no reply), not states that are simply mid-flight with
a slow respondent. Beverly never tripped that gate.
