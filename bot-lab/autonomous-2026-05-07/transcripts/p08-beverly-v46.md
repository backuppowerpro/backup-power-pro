# Persona 08 — Beverly (Slow Responder) — v10.1.46 phraser

**Date:** 2026-05-07
**Phraser version:** v10.1.46 (em-dash + en-dash, `awesome` strict ban any-occurrence, `would_be_happy_broad` extended, slang regex bans `cool|ha|sweet|gotcha|yep|right on|talk soon|lemme|real quick|for sure`, RECAP & SIGNOFF pools now run through validateOutput)
**State machine:** current
**Goal:** verify v45 leaks (bullet-list RECAP, "Awesome." opener at AWAIT_240V, "I would be happy to help with the project" closer) are now blocked.

**Ground truth slots:**
- first_name: Beverly
- owner: true
- gen_240v: true
- outlet_amps: 50
- run_feet: 30
- email: bev.simmons@bellsouth.net
- address_on_file: 78 Mill Pond Road, Pickens SC 29671
- expected_terminal: COMPLETE

---

## Turn 1 — GREETING (variant B, templated)

**Bot →** Hi Beverly, this is Ashley with Backup Power Pro. Thanks for the request on the generator inlet. I just need a few quick details so Key can put together an accurate quote. Mind if I run through them?

**Beverly (Tue 12:51 PM, ~4hr gap):** YES go ahead

Classifier: `affirmative`. State: GREETING → AWAIT_240V.

---

## Turn 2 — AWAIT_240V

### Phraser attempt 1 (raw):
> "Awesome. To start, does the generator put out 240V, and do you happen to know if the outlet on it is the round 4-prong twist-lock or the bigger straight-blade 50A? Pic works too if it's easier."

**Validation:** REJECTED — `awesome_any` matches `\bawesome\b` regardless of trailing punctuation. (v45 used `awesome\b(?!!)` which let "Awesome." pass.) Logged: `[bot-phraser] output rejected awesome_any, attempt 1`.

### Phraser attempt 2:
> "Got it. Does the generator put out 240V, and do you know if the outlet on it is the round 4-prong twist-lock or the bigger straight-blade 50A? Pic works too if easier."

**Validation:** PASSES. 169 chars. Single question. No bans.

**Bot →** Got it. Does the generator put out 240V, and do you know if the outlet on it is the round 4-prong twist-lock or the bigger straight-blade 50A? Pic works too if easier.

**Beverly (Tue 5:14 PM, ~4hr gap):** 240v YES. it's the bigger one i think. 50

Classifier: `outlet_50a` with `gen_240v=true`, `outlet_amps=50`, `outlet_type="14-50R"`. State → AWAIT_PANEL_PHOTO (collapsed).

---

## Turn 3 — AWAIT_PANEL_PHOTO

> **Bot:** Got it. 50 amp, you've got the bigger setup. Could you snap a pic of your main electrical panel with the door open? Just want Key to see the breakers. No rush, whenever you get a chance.

**Validation:** PASSES (same as v45 — no leaks here).

**Beverly (Wed 8:03 AM, ~15hr gap):** [image: panel.jpg — 200A Square D, main breaker top, ~28 breakers]

Photo classifier: `panel_main_open_clear, 200A, Square D, accept`. State → AWAIT_RUN.

---

## Turn 4 — AWAIT_RUN

> **Bot:** Got the photo, that's a Square D, clean for the interlock. Most main panels around here are mounted in the garage on an exterior wall, the one that backs up to the outside of the house. Is that your setup, or somewhere else?

**Validation:** PASSES.

**Beverly (Wed 1:22 PM):** garage exterior wall YES. about 30 ft from where i keep the generator

Classifier: `run_length_provided`, `run_feet=30`, `panel_location=garage_exterior`. State → AWAIT_ADDRESS_CONFIRM.

---

## Turn 5 — AWAIT_ADDRESS_CONFIRM

> **Bot:** 30ft, clean run. Address on file is 78 Mill Pond Road, Pickens 29671. That the install address?

**Validation:** PASSES.

**Beverly (Wed 7:45 PM):** YES that's correct

State: AWAIT_ADDRESS_CONFIRM → AWAIT_EMAIL (collapsed via form data) → SCHEDULE_QUOTE.

---

## Turn 6 — SCHEDULE_QUOTE / RECAP + closer

### Phraser attempt 1 (raw — same v45 output):
> "Perfect. Just to confirm:
> - 240V generator, 50A outlet
> - Square D 200A panel, garage exterior wall
> - 30ft run to where you store the generator
> - Install at 78 Mill Pond Road, Pickens
>
> I'll pass this to Key and he'll text you back with the quote. I would be happy to help with the project."

**Validation:** REJECTED — TWO hits:
1. `would_be_happy_broad` matches "I would be happy to". (v45 had this regex but it bypassed because RECAP/SIGNOFF pools didn't run through validateOutput; v46 forces all pools through `validateOutput()`.)
2. Bullet-list `\n-` formatting also flagged by length + structure, but main reject is the closer phrase.

Logged: `[bot-phraser] output rejected would_be_happy_broad, attempt 1`.

### Phraser attempt 2:
> "Got it. 240V 50A, Square D 200A panel, garage exterior wall, 30ft run, install at 78 Mill Pond Road. Look right? If so, Key will work up the quote and text it over."

**Validation:** PASSES. 165 chars. No bullet list. No "would be happy". No "Awesome". No em-dash. Single question. Conversational SMS recap as Key would write it.

**Bot →** Got it. 240V 50A, Square D 200A panel, garage exterior wall, 30ft run, install at 78 Mill Pond Road. Look right? If so, Key will work up the quote and text it over.

**Beverly (Thu 7:12 AM):** THANK YOU

State: COMPLETE.

---

## v46 vs v45 diff

| Issue (v45) | v46 outcome |
|---|---|
| Turn 2 "Awesome." opener | Caught by `awesome_any`, retry → "Got it." |
| Turn 6 bullet-list RECAP | Pool now runs through `validateOutput()`; retry collapses to inline conversational recap |
| Turn 6 "I would be happy to help with the project" closer | Caught by `would_be_happy_broad`, retry → "Key will work up the quote and text it over" |

## v46 voice-judge scores

| Dim | v45 | v46 | Note |
|---|---|---|---|
| Naturalness | 6 | 9 | "Awesome." gone; bullet list gone; reads conversational |
| Warmth | 8 | 9 | Genuine "no rush" preserved (Turn 3) |
| Pacing | 9 | 9 | Same |
| Reading the room | 9 | 9 | Same |
| Closing rituals | 6 | 9 | Closer is now Key-voice ("Key will work up the quote and text it over"), not "I would be happy" |
| Identity discipline | 10 | 10 | Locked |
| Customer enjoyment | 7 | 9 | No bullet list, no AI-tell closer |
| **Avg** | **7.9** | **9.1** | **+1.2** |

**Em-dash / Awesome / slang count:** 0 / 0 / 0.
