# Persona MultiGen — Steve (Two Generators: 7500w + 3500w)

**Date:** 2026-05-07
**Persona file:** ad-hoc — autonomous-2026-05-07 multi-generator stress test
**Ground truth:**
- Primary generator: Generac 7500 (compatible_30a, L14-30R, 240V) — bought new
- Secondary generator: unknown brand 3500 inverter (likely 120V-only, possibly Generac 3500 inverter / Honda EU3000 / Champion 3500 — Steve doesn't know specs)
- Outlet: 30A 4-prong on the 7500 (Steve doesn't know terminology yet)
- Owns home, ~25ft run from panel to where he keeps the gen, no anxiety markers
- Style: default register, slightly meandering, types in lowercase, no emoji
- Wants to know if the install can run "either" or "both" generators
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 11
**Status:** PASS (with one watch-flag — see Notes)

---

## Critical test focus

How does Ashley handle a customer who volunteers TWO generators in the first reply? She must:
1. Pick the BEST one for qualification (the 7500w is the obvious primary)
2. Note in qualification_data that there's a second generator (volunteered.secondary_gen)
3. NOT promise the install supports BOTH (the inlet box has ONE outlet — only one gen plugs in at a time, which is fine and normal, but she shouldn't oversell it)
4. Surface to Key in handoff so he knows about the second one

---

## Conversation

### Turn 0 — bot (GREETING)
Good afternoon Steve, this is Ashley with Backup Power Pro helping Key with intake. Saw your form come through. I would be happy to put together a quote for the inlet install. Got a sec for a couple quick questions?

### Turn 1 — customer
Hey I got 2 generators, can yall do this for either one?

### Turn 1 — classifier
- state: GREETING
- label: asking_clarifying_technical
- confidence: 0.88
- extracted_value: null
- inferred_customer_style: default
- notes: customer is asking a setup question (compatibility with two generators) before answering the GREETING affirmative. Self-loop with answer-briefly + re-ask. No brand/model mentioned yet so generator-lookup not run.

### Turn 1 — orchestrator volunteered scan
- volunteered.generator_count: 2 (NEW — flagged for Key handoff)
- volunteered.gen_brand_model: null (no brand yet)

### Turn 1 — state machine
GREETING → GREETING (self-loop, asking_clarifying_technical)
- intent: warmth-lead + answer the "two generators" question honestly + redirect to qualifying ONE (the better one) + re-ask the GREETING

### Turn 1 — bot (GREETING self-loop)
Yeah for sure. The inlet plugs into one generator at a time, so we just need to qualify the one you would actually use during an outage. What are the two you have?

### Turn 2 — customer
ok thats fine. one is a generac 7500 i bought new last year. the other is an old 3500 my dad gave me, not sure the brand honestly

### Turn 2 — classifier
- state: GREETING
- label: gen_brand_model_provided (extracted from free-text; treat as affirmative + advance with brand context)
- confidence: 0.92
- extracted_value: "Generac 7500"
- inferred_customer_style: default
- notes: customer answered the re-asked question. Primary gen is clearly the Generac 7500. Secondary is "old 3500 unknown brand" — store as volunteered.secondary_gen_note for handoff.

### Turn 2 — orchestrator generator-lookup (Generac 7500)
- matched: true
- brand: Generac
- model: 7500
- compatibility: compatible_30a
- outlet_type: L14-30R
- running_watts: 6000
- → voltage_known = true, skip AWAIT_240V, advance to AWAIT_PANEL_PHOTO (compatible_30a goes to panel directly)

### Turn 2 — orchestrator volunteered scan
- volunteered.gen_brand_model: "Generac 7500" (primary)
- volunteered.secondary_gen_note: "old 3500, unknown brand, gift from dad" (NEW — flagged)
- volunteered.generator_count: 2 (preserved)

### Turn 2 — state machine
GREETING → AWAIT_PANEL_PHOTO (skipped AWAIT_240V via lookup match, compatible_30a)
- intent: brand-recognize the Generac 7500 with micro-color, NOTE the second gen for the file without promising anything, ask for panel photo

### Turn 2 — bot (AWAIT_PANEL_PHOTO)
Got it. Generac 7500, solid unit, that one will work great with the inlet. I will note the older 3500 on file too in case you ever want to swap it in. To put together an accurate quote, Key will need a photo of your main panel and breakers. No rush.

### Turn 3 — customer
ok so the install will work for both then?

### Turn 3 — classifier
- state: AWAIT_PANEL_PHOTO
- label: asking_clarifying_technical
- confidence: 0.94
- extracted_value: null
- inferred_customer_style: default
- notes: customer is checking compatibility for the second generator before sending photo. Critical answer: the inlet supports any 240V 30A or 50A generator, so the 7500 is the primary. The 3500 may or may not be 240V-capable — most 3500w units are 120V-only inverters. Must NOT promise both work without knowing the 3500's specs.

### Turn 3 — state machine
AWAIT_PANEL_PHOTO → AWAIT_PANEL_PHOTO (self-loop)
- intent: warmth-lead + answer truthfully (the inlet works for any 240V 30A/50A gen, but most 3500w units are 120V-only and would not qualify), set expectation that Key will confirm if Steve ever wants to use the 3500, then re-ask for the panel photo

### Turn 3 — bot (AWAIT_PANEL_PHOTO self-loop)
Yeah good question. The 7500 will run the inlet no problem since it has the right 240V outlet. Most 3500w units are 120V only and would not work with this setup, but if you ever pull the brand off the 3500 Key can take a quick look. For the quote we will go off the 7500. Can you send a pic of your main panel when you get a chance?

### Turn 4 — customer
ok yeah ill grab that. give me a sec
[3 minutes later]
[sends photo of main panel, door open, breakers visible]

### Turn 4 — photo classifier
- subject: panel
- subject_confidence: 0.96
- door_state: open
- breakers_visible: true
- primary_recommendation: accept
- obvious_issues: []

### Turn 4 — classifier (text + photo combined)
- state: AWAIT_PANEL_PHOTO
- label: photo_received_panel
- confidence: 0.96
- extracted_value: null
- inferred_customer_style: default

### Turn 4 — state machine
AWAIT_PANEL_PHOTO → AWAIT_RUN (default-install-offer)
- intent: ack panel + propose default install (inlet on exterior wall right beside the panel, 20ft cord), ask if that works

### Turn 4 — bot (AWAIT_RUN)
Got it, panel looks good. Standard install puts the inlet box on the outside of the house right beside the panel with a 20ft cord that reaches your generator. Work for you, or do you need it run somewhere different?

### Turn 5 — customer
yeah thats fine. ill probably set the gen about 25 feet out by the shed but 20 should reach

### Turn 5 — classifier
- state: AWAIT_RUN
- label: affirmative
- confidence: 0.93
- extracted_value: null
- inferred_customer_style: default
- notes: customer accepts default but volunteered run distance ~25ft. Capture as volunteered.run_feet for Key handoff (20ft default cord MAY be tight if gen sits at 25ft — flag for Key, but do not over-engineer in the message).

### Turn 5 — orchestrator volunteered scan
- volunteered.run_feet: "~25ft to shed" (NEW — Key-flag: cord may be tight, Key may want to bring 30ft)

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL (combined close — last name, email, address)
- intent: ack the 25ft (note for Key) + ask for last name, email, and confirm install address from form

### Turn 5 — bot (AWAIT_EMAIL)
Sounds good, 25ft to the shed. I will flag that for Key in case he wants to bring an extra cord. Last things, can I grab your last name, your email, and confirm the install address is the one on your form?

### Turn 6 — customer
steve carter, scarter78@gmail.com, yeah 412 oak ridge rd taylors

### Turn 6 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.97
- extracted_value: "scarter78@gmail.com"
- email_typo_suspected: false
- address_captured: "412 Oak Ridge Rd, Taylors"
- last_name: "Carter"
- inferred_customer_style: default

### Turn 6 — state machine
AWAIT_EMAIL → RECAP
- intent: confirm full name + email + address + summarize (Generac 7500, panel received, 25ft run, install address) + ask if ready to schedule

### Turn 6 — bot (RECAP)
Got it. So Steve Carter, scarter78@gmail.com, install at 412 Oak Ridge Rd in Taylors, Generac 7500 as the main gen with about a 25ft run to the shed. I noted the older 3500 on file too. Sound right? If so Key will reach out to schedule the on-site quote.

### Turn 7 — customer
yep thats right

### Turn 7 — classifier
- state: RECAP
- label: affirmative
- confidence: 0.97

### Turn 7 — state machine
RECAP → SCHEDULE_QUOTE
- intent: thank Steve, set expectation Key will reach out within a day to schedule

### Turn 7 — bot (SCHEDULE_QUOTE)
Thank you. Key will reach out within a day to lock in a time. Appreciate it Steve.

### Turn 8 — customer
sounds good thanks

### Turn 8 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.96

### Turn 8 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal)

---

## Final qualification_data written

```json
{
  "first_name": "Steve",
  "last_name": "Carter",
  "email": "scarter78@gmail.com",
  "install_address": "412 Oak Ridge Rd, Taylors",
  "gen_brand_model": "Generac 7500",
  "gen_compatibility": "compatible_30a",
  "gen_outlet_type": "L14-30R",
  "panel_photo_received": true,
  "run_feet_estimate": "~25ft (to shed)",
  "owner": true,
  "secondary_gen_note": "Older 3500w (unknown brand, gift from father). Likely 120V-only inverter, did not qualify, customer agreed to use 7500 as primary. If customer ever wants to swap, Key should confirm 3500 brand+model.",
  "generator_count": 2,
  "key_flags": [
    "Run distance ~25ft, 20ft default cord may be tight, consider 30ft cord on visit",
    "Customer has a second generator (3500w) — not used for qualification but on file"
  ]
}
```

---

## Per-turn flag log

| Turn | State | Hard-constraint pass | Voice 1-10 | Notes |
|---|---|---|---|---|
| 0 | GREETING | yes | — | clean variant |
| 1 | GREETING (self-loop) | yes | — | Two-gen question handled honestly. No promise of "both work". Pivots to "qualify the one you would actually use" — correct. |
| 2 | AWAIT_PANEL_PHOTO | yes | — | Generac 7500 lookup match → skipped AWAIT_240V. Brand-recognize micro-color used ("solid unit"). Second gen acknowledged on-file without promise. |
| 3 | AWAIT_PANEL_PHOTO (self-loop) | yes | — | Critical turn. Honestly told Steve most 3500w units are 120V-only. Did NOT promise both work. Re-asked for panel photo cleanly. |
| 4 | AWAIT_RUN | yes | — | Default install offer per v10. |
| 5 | AWAIT_EMAIL | yes | — | Combined close. Volunteered run-distance captured + flagged for Key (good handoff). |
| 6 | RECAP | yes | — | Recap names BOTH gens — primary qualified, secondary on file. Excellent handoff transparency. |
| 7 | SCHEDULE_QUOTE | yes | — | |
| 8 | COMPLETE | — | — | Terminal. |

---

## Auto-flags

- Reached expected terminal: yes (COMPLETE)
- Hard-constraint violations: 0
- Phraser fallback used: 0
- State self-loops: 2 (GREETING x1, AWAIT_PANEL_PHOTO x1) — both legitimate clarifying-question handling
- Bot self-disclosed AI: not triggered (Steve never asked)
- Em-dash count: 0
- "y'all" / "holler" count: 0 (correctly avoided)
- Bot promised both generators work: NO (correctly hedged on the 3500)
- Bot picked a primary cleanly: YES (7500, named explicitly)
- Bot captured the second on file: YES (mentioned in turn 2, 3, and recap)
- Bot surfaced second gen to Key: YES (qualification_data.secondary_gen_note + key_flags)

---

## Watch-flag (one)

Turn 3's answer "Most 3500w units are 120V only and would not work with this setup" is a professional electrical judgment that's borderline for Ashley to make unilaterally. Strict reading of the phraser rules says professional judgments belong to Key. However, this is a factual statement about the broad category of 3500w inverter generators (true for Generac, Honda, Champion small-3500 inverters) and pivots Steve back to the qualifying gen rather than over-promising. Acceptable, but flag for review: should this be softened to "Key would need to confirm the brand and model on the 3500 to know if it would work"? That phrasing might be safer voice-wise, even if slightly less helpful.

---

## Reviewer notes

(Empty until human review — Key fills this in)
