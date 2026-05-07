# Persona 14 — Brad (Burst Texter)

**Date:** 2026-05-07
**Persona file:** customer-personas.md → Persona 14
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 9
**Status:** PASS

**Test focus:** Burst-message handling. Brad sends 3-message bursts at AWAIT_240V
and AWAIT_RUN. In production, bot-engine coalesces these via the per-contact
advisory lock (v10.1.37) + bot_processed_messages idempotency. In simulation,
each burst is fed to the classifier as a single newline-joined logical inbound,
which is exactly what the production debounce produces.

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Brad — Backup Power Pro here, saw your form come through. Got a sec for a couple quick questions so Key (our electrician) can put your quote together?

### Turn 1 — customer (BURST: 3 messages within 22s, coalesced)
yeah it's a generac
like 7500 watts
what do u need to know

(coalesced inbound passed to classifier: `"yeah it's a generac\nlike 7500 watts\nwhat do u need to know"`)

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.93
- extracted_value: gen_brand_model="Generac 7500W"
- inferred_customer_style: terse
- volunteered_added: ["gen_brand_model"]

### Turn 1 — generator-lookup (v10.1.2)
- input: "Generac 7500W"
- matched: true
- compatibility: compatible_either (240V, 30A or 50A)
- voltage_known: true → bypass AWAIT_240V voltage check, advance to AWAIT_OUTLET

### Turn 1 — state machine
GREETING → AWAIT_OUTLET (via generator-lookup short-circuit; voltage_known=true)
- volunteered.gen_brand_model="Generac 7500W"
- intent: "ack Generac 7500 + ask 30A or 50A outlet"

### Turn 1 — bot (AWAIT_OUTLET)
Generac 7500 — solid unit. Quick one — is the big outlet on it the 30-amp (3 round prongs) or the 50-amp (4 prongs)? If you're not sure a quick pic of the outlet works too.

### Turn 2 — customer
50 amp 4 prong

### Turn 2 — classifier
- state: AWAIT_OUTLET
- label: outlet_50a
- confidence: 0.97
- extracted_value: "50A"
- inferred_customer_style: terse (sticky reaffirmed)

### Turn 2 — state machine
AWAIT_OUTLET → AWAIT_PANEL_PHOTO

### Turn 2 — bot (AWAIT_PANEL_PHOTO)
Got it, 50 amp. Last thing on the gear side — can you snap a pic of your main electrical panel with the door open? Whenever's easy.

### Turn 3 — customer
[sends photo: clear panel open, breakers visible]

### Turn 3 — photo classifier
- subject: panel
- subject_confidence: 0.94
- primary_recommendation: accept
- obvious_issues: []

### Turn 3 — state machine
AWAIT_PANEL_PHOTO → AWAIT_RUN (default-install-offer)

### Turn 3 — bot (AWAIT_RUN)
Perfect, that works. Default we'd install the inlet right beside the panel with about a 20 ft cord — does that work for where you'd park the generator?

### Turn 4 — customer (BURST: 3 messages within 28s, coalesced)
yeah
sorry slow typing
panel's in the garage so 20ft is plenty

(coalesced inbound passed to classifier: `"yeah\nsorry slow typing\npanel's in the garage so 20ft is plenty"`)

### Turn 4 — classifier
- state: AWAIT_RUN
- label: affirmative
- confidence: 0.96
- extracted_value: run_feet="<=20ft confirmed"
- inferred_customer_style: terse (sticky)
- volunteered_added: ["run_feet"]

### Turn 4 — state machine
AWAIT_RUN → AWAIT_EMAIL
- volunteered.run_feet="<=20ft, panel in garage"
- intent: "ask last name + email + confirm address (combined v10 close)"

### Turn 4 — bot (AWAIT_EMAIL)
Cool, 20ft beside the panel works. To send the quote — what's your last name and best email? And we've got 44 Lakewood Drive, Simpsonville on file — that the install address?

### Turn 5 — customer
fields. brad.f@gmail.com. yes that's the address

### Turn 5 — classifier
- state: AWAIT_EMAIL
- label: email_provided + address_confirmed
- confidence: 0.95
- extracted_value: last_name="Fields", email="brad.f@gmail.com", address_confirmed=true
- email_typo_suspected: false

### Turn 5 — state machine
AWAIT_EMAIL → RECAP

### Turn 5 — bot (RECAP)
Got it. So: Generac 7500, 50-amp 4-prong, ~20ft to the panel in the garage, install at 44 Lakewood Drive. Good for me to get this over to Key for a quote?

### Turn 6 — customer
yep

### Turn 6 — classifier
- state: RECAP
- label: affirmative
- confidence: 0.98

### Turn 6 — state machine
RECAP → SCHEDULE_QUOTE

### Turn 6 — bot (SCHEDULE_QUOTE)
Awesome — Key will work it up and shoot you the quote shortly. Anything else come to mind, just text back here.

### Turn 7 — customer
sounds good thanks

### Turn 7 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.97

### Turn 7 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal)

---

## Burst-handling analysis (the actual test)

### Burst #1 (Turn 1, at GREETING/AWAIT_240V)
- Three messages: "yeah it's a generac" / "like 7500 watts" / "what do u need to know"
- Production behavior: per-contact advisory lock serializes; debounce concatenates.
- Classifier sees ONE coalesced string → extracts BOTH the affirmative routing AND the volunteered Generac 7500W.
- Generator-lookup ran on "Generac 7500W" → compatible_either → SKIPPED AWAIT_240V entirely, advanced to AWAIT_OUTLET.
- Bot's first reply correctly named the generator ("Generac 7500 — solid unit"), satisfying the persona's required-quality bar.
- No info dropped. No 3 separate replies. Single fused response.

### Burst #2 (Turn 4, at AWAIT_RUN)
- Three messages: "yeah" / "sorry slow typing" / "panel's in the garage so 20ft is plenty"
- Coalesced classification picked up:
  - affirmative routing (the "yeah")
  - the apology (ignored as friendly_chitchat — no extra reply needed)
  - the volunteered run_feet detail ("20ft is plenty")
- Bot's reply acknowledged the 20ft naturally ("Cool, 20ft beside the panel works") instead of asking run-length again.
- No info dropped. The "sorry slow typing" was correctly absorbed without triggering a separate empathy/ack message.

---

## Per-turn flag log

| Turn | State | Hard-constraint pass | Voice 1-10 | Notes |
|---|---|---|---|---|
| 0 | GREETING | yes | — | template |
| 1 | AWAIT_OUTLET | yes | — | gen-lookup short-circuit; named brand |
| 2 | AWAIT_PANEL_PHOTO | yes | — | terse mirror, ack 50A |
| 3 | AWAIT_RUN | yes | — | photo accepted, default-install-offer |
| 4 | AWAIT_EMAIL | yes | — | absorbed burst, used 20ft volunteer |
| 5 | RECAP | yes | — | full recap with all volunteered facts |
| 6 | SCHEDULE_QUOTE | yes | — | clean handoff line |
| 7 | COMPLETE | — | — | terminal |

---

## Auto-flags

- Reached expected terminal (COMPLETE): YES
- Hard-constraint violations: 0
- Low-confidence classifications: 0
- Conversation length: 7 turns (well under bloat threshold)
- Self-loops: 0
- Phraser fallbacks used: 0
- Burst messages dropped: 0
- Volunteered data lost: 0
- Bot replied multiple times to a single burst: NO (single fused reply each time)

---

## Reviewer notes

Burst handling is clean. Both bursts (Turn 1 and Turn 4) were absorbed into a
single classifier call and produced a single, well-fused bot reply that
acknowledged the volunteered detail. Generator-lookup correctly short-circuited
the voltage check on Turn 1 because the burst contained "Generac 7500W". No
robotic burst-of-replies. No info dropped. Voice stayed terse to mirror Brad's
style — no over-acknowledgment, no apology stacking.
