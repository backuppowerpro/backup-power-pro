# Persona 01: Sarah (cooperative 240v happy path) — v10.1.40 re-run
Final state: COMPLETE
Total turns: 8
Prompt version under test: bot-phraser v10.1.40 (deployed 2026-05-07)
Audit hits:
- T2: SINGLE micro-color fired (brand+model). Outlet amperage bare-acked (no second color tag). Stacking fix verified.
- T4: NO evaluative adjective ("perfect/ideal/great") describing inlet-location choice. Bare confirmation + factual color used. Salesy-lead fix verified.
- No em-dashes. No weekday names. No price leaks. No first-person Key claims.
Broke at: n/a

## Transcript

[T0] BOT(GREETING, variant A): Hi Sarah, I'm Ashley, the automated assistant at Backup Power Pro. I'm helping our electrician Key gather a few details for the home connection quote for your generator. Got a couple of minutes to walk through them?

[T1] CUST: yeah sure, go ahead

[T1] CLS: state=GREETING; label=affirmative; confidence=0.97; inferred_customer_style=default
[T1] SM: GREETING -> AWAIT_240V; sticky_style=default; customer_recent_length=22 chars

[T1] BOT(AWAIT_240V): Perfect. Just confirming the generator has a 240V outlet on it, either the 4-prong twist-lock or the 50-amp. A pic of the generator's outlet works too if easier.

[T2] CUST: yep it's a champion 8500, 50 amp twist lock

[T2] CLS: state=AWAIT_240V; label=outlet_50a; confidence=0.94; extracted_value="50A"; volunteered: gen_brand_model="Champion 8500"; inferred_customer_style=default
[T2] SM: AWAIT_240V -> AWAIT_PANEL_PHOTO; generator_lookup_result: matched=true, brand="Champion", model="8500", compatibility="compatible_50a"

[T2] BOT(AWAIT_PANEL_PHOTO): Champion 8500, solid unit. Got the 50 amp noted. To put together an accurate quote, Key will also need a picture of your main electrical panel and breakers. No rush, whenever you get the chance.

> v10.1.40 verification: prior run stacked "Champion 8500, solid unit." + "50 amp, most common whole-home setup." (TWO color tags). New run fires color on brand+model only, bare-acks amperage with "Got the 50 amp noted." PASS.

[T3] CUST: ok one sec [sends photo of panel, door open, breakers visible, main breaker labeled 200A at top]

[T3] PHOTO_CLS: subject=panel_main_open; primary_recommendation=accept; main_breaker_visible=true; subject_confidence=0.93
[T3] CLS: label=photo_received; confidence=0.99
[T3] SM: AWAIT_PANEL_PHOTO -> AWAIT_RUN

[T3] BOT(AWAIT_RUN): Got the photo, looks clean. Most main panels around here are mounted in the garage on an exterior wall (a wall that backs up to the outside of the house, where you could mount something on the other side). Is that your setup, or is it somewhere else?

[T4] CUST: yeah it's in the garage on the outside wall

[T4] CLS: state=AWAIT_RUN; label=panel_garage_exterior; confidence=0.93; inferred_customer_style=default
[T4] SM: AWAIT_RUN -> AWAIT_INLET_LOCATION

[T4] BOT(AWAIT_INLET_LOCATION): Cool, garage exterior, clean install. Where would you want the inlet box mounted on the outside? Standard install puts it right behind your panel with a 20ft cord. Or if you'd want it elsewhere, roughly how far from the panel?

> v10.1.40 verification: prior run was "Perfect, that's the ideal setup." NEW run uses "Cool, garage exterior, clean install." — no evaluative adjective ("perfect/ideal/great") describing the choice. Factual color only. PASS.

[T5] CUST: behind the panel is fine, the generator sits right outside on the slab, maybe 22 feet

[T5] CLS: state=AWAIT_INLET_LOCATION; label=inlet_default; confidence=0.91; volunteered: run_feet=22; inferred_customer_style=default
[T5] SM: AWAIT_INLET_LOCATION -> AWAIT_EMAIL

[T5] BOT(AWAIT_EMAIL): 22 feet, clean run. Thank you. To complete the quote could I get your last name, email, and address?

[T6] CUST: sarah becker, sarah.becker.gvl@gmail.com, 412 oakmont drive greer sc 29651

[T6] CLS: state=AWAIT_EMAIL; label=email_provided; confidence=0.97; extracted_value="sarah.becker.gvl@gmail.com"; email_typo_suspected=false; volunteered: address="412 Oakmont Drive, Greer SC 29651", last_name="Becker"
[T6] SM: AWAIT_EMAIL -> RECAP

[T6] BOT(RECAP): Got it. Quick rundown for Key: Champion 8500, 50 amp, panel in garage on exterior wall, inlet behind the panel, install at 412 Oakmont Drive in Greer. Look right?

[T7] CUST: yep that's right

[T7] CLS: state=RECAP; label=affirmative; confidence=0.96
[T7] SM: RECAP -> SCHEDULE_QUOTE

[T7] BOT(SCHEDULE_QUOTE): Thank you, Sarah. Key will put the quote together and send it over by tomorrow morning. Let me know if you have any questions.

[T8] CUST: thanks!

[T8] CLS: state=SCHEDULE_QUOTE; label=friendly_chitchat; confidence=0.88
[T8] SM: SCHEDULE_QUOTE -> COMPLETE

---

## Per-turn flag log

| Turn | State | Hard-constraint pass | Voice (informal) | Notes |
|---|---|---|---|---|
| 0 | GREETING | pass | 8 | Variant A |
| 1 | AWAIT_240V | pass | 8 | "Perfect." opener (Key's #1 real ack) |
| 2 | AWAIT_PANEL_PHOTO | pass | 9 | SINGLE color tag — brand only. Amp bare-acked. v10.1.40 stacking-fix VERIFIED |
| 3 | AWAIT_RUN | pass | 8 | photo accepted; panel-location framing |
| 4 | AWAIT_INLET_LOCATION | pass | 9 | "Cool, garage exterior, clean install." — no evaluative adjective. v10.1.40 fix VERIFIED |
| 5 | AWAIT_EMAIL | pass | 9 | clean run-length ack |
| 6 | RECAP | pass | 8 | "Quick rundown" rotation-pool alternate (avoiding over-used "Quick recap before Key reviews") |
| 7 | SCHEDULE_QUOTE | pass | 9 | clean wrap-up |

---

## Auto-flags

- Reached expected terminal (COMPLETE): yes
- Hard-constraint violations: 0
- Turn count within 4-15 band: yes (8 turns)
- State self-loops >2x: none
- Em-dashes: 0
- Banned slang: 0
- v10.1.40 multi-slot warmth-stacking fix: PASS (1 color tag at T2, not 2)
- v10.1.40 AWAIT_INLET_LOCATION evaluative-adjective ban: PASS (no "perfect/ideal/great" describing the choice)

---

## Observations

Both targeted v10.1.40 tunes held under the same input scenario that previously failed:

1. **T2 stacking fix** — Sarah volunteered brand+model AND outlet amperage in one inbound. Prior run fired micro-color on both. New run fires color on brand+model only ("Champion 8500, solid unit.") and bare-acks the amperage ("Got the 50 amp noted."). No "two compliments in a row" feel.

2. **T4 evaluative-adjective fix** — At AWAIT_INLET_LOCATION, prior run opened with "Perfect, that's the ideal setup." New run opens with "Cool, garage exterior, clean install." — factual color, no marketing adjective qualifying the customer's choice.

Conversation reached COMPLETE in 8 turns, identical to baseline. No regressions on any other voice rule.
