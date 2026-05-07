# Persona 01: Sarah (cooperative 240v happy path)
Final state: COMPLETE
Total turns: 10
Conversation duration (sim): ~6 minutes (instant-replier persona)
Audit hits:
- Bot reply at T2 included the phrase "I just want to confirm" which is fine, but the two-message split (Bubble 1 "Perfect." + Bubble 2 ask) was triggered correctly per v10.1 default-register rule.
- No em-dashes detected. No weekday names. No price leaks. No first-person Key claims.
- One minor voice flag at T7: "Thanks for that." used twice within 3 turns (T6 and T7). Not banned, but trends toward repetition; rotation pool should bias away.
Broke at: n/a

## Transcript

[T0] BOT(GREETING, variant A): Hi Sarah, I'm Ashley, the automated assistant at Backup Power Pro. I'm helping our electrician Key gather a few details for the home connection quote for your generator. Got a couple of minutes to walk through them?

[T1] CUST: yeah sure, go ahead

[T1] CLS: state=GREETING; label=affirmative; confidence=0.97; inferred_customer_style=default
[T1] SM: GREETING -> AWAIT_240V; sticky_style=default; customer_recent_length=22 chars

[T1] BOT(AWAIT_240V, two-message split — default register, ≥30 not met but customer was cooperative; orchestrator opted for paired single message instead):
"Perfect. Just confirming the generator has a 240V outlet on it, either the 4-prong twist-lock or the 50-amp. A pic of the generator's outlet works too if easier."

[T2] CUST: yep it's a champion 8500, 50 amp twist lock

[T2] CLS: state=AWAIT_240V; label=outlet_50a; confidence=0.94; extracted_value="50A"; volunteered: gen_brand_model="Champion 8500"; inferred_customer_style=default
[T2] SM: AWAIT_240V -> AWAIT_PANEL_PHOTO (outlet_50a transition); generator_lookup_result: matched=true, brand="Champion", model="8500", compatibility="compatible_50a"

[T2] BOT(AWAIT_PANEL_PHOTO): Champion 8500, solid unit. 50 amp, most common whole-home setup. To put together an accurate quote, Key will also need a picture of your main electrical panel and breakers. No rush, whenever you get the chance.

[T3] CUST: ok one sec [sends photo of panel, door open, breakers visible, main breaker labeled 200A at top]

[T3] PHOTO_CLS: subject=panel_main_open; primary_recommendation=accept; main_breaker_visible=true; subject_confidence=0.93
[T3] CLS: label=photo_received; confidence=0.99
[T3] SM: AWAIT_PANEL_PHOTO -> AWAIT_RUN

[T3] BOT(AWAIT_RUN): Got the photo, looks clean. Most main panels around here are mounted in the garage on an exterior wall (a wall that backs up to the outside of the house, where you could mount something on the other side). Is that your setup, or is it somewhere else?

[T4] CUST: yeah it's in the garage on the outside wall

[T4] CLS: state=AWAIT_RUN; label=panel_garage_exterior; confidence=0.93; inferred_customer_style=default
[T4] SM: AWAIT_RUN -> AWAIT_INLET_LOCATION

[T4] BOT(AWAIT_INLET_LOCATION): Perfect, that's the ideal setup. Where would you want the inlet box mounted on the outside? Standard install puts it right behind your panel with a 20ft cord. Or if you'd want it elsewhere (closer to the generator), roughly how far from the panel?

[T5] CUST: behind the panel is fine, the generator sits right outside on the slab, maybe 22 feet

[T5] CLS: state=AWAIT_INLET_LOCATION; label=inlet_default; confidence=0.91; volunteered: run_feet=22; inferred_customer_style=default
[T5] SM: AWAIT_INLET_LOCATION -> AWAIT_EMAIL

[T5] BOT(AWAIT_EMAIL): 22 feet, clean run. Thank you. To complete the quote could I get your last name, email, and address?

[T6] CUST: sarah becker, sarah.becker.gvl@gmail.com, 412 oakmont drive greer sc 29651

[T6] CLS: state=AWAIT_EMAIL; label=email_provided; confidence=0.97; extracted_value="sarah.becker.gvl@gmail.com"; email_typo_suspected=false; volunteered: address="412 Oakmont Drive, Greer SC 29651", last_name="Becker"; inferred_customer_style=default
[T6] SM: AWAIT_EMAIL -> RECAP (no typo, address captured in same message — skip CHECK_EMAIL_TYPO)

[T6] BOT(RECAP): Thanks for that. Quick recap before Key reviews: Champion 8500, 50 amp, panel in garage on exterior wall, inlet behind the panel, install at 412 Oakmont Drive in Greer. Look right?

[T7] CUST: yep that's right

[T7] CLS: state=RECAP; label=affirmative; confidence=0.96
[T7] SM: RECAP -> SCHEDULE_QUOTE

[T7] BOT(SCHEDULE_QUOTE, variant 1): Thank you, Sarah. Key will put the quote together and send it over by tomorrow morning. Let me know if you have any questions.

[T8] CUST: thanks!

[T8] CLS: state=SCHEDULE_QUOTE; label=friendly_chitchat; confidence=0.88
[T8] SM: SCHEDULE_QUOTE -> COMPLETE (friendly_chitchat at SCHEDULE_QUOTE resolves as close-out per v10.1.32)

[T8] BOT: (no further outbound — terminal)

---

## Per-turn flag log

| Turn | State | Hard-constraint pass | Voice (informal) | Notes |
|---|---|---|---|---|
| 0 | GREETING | pass | 8 | Variant A; no name issue |
| 1 | AWAIT_240V | pass | 8 | "Perfect." opener correct (v10 #1 ack) |
| 2 | AWAIT_PANEL_PHOTO | pass | 9 | brand-color "Champion 8500, solid unit" + amp pool entry — good rotation, but two color tags in one message borders on layered |
| 3 | AWAIT_RUN | pass | 8 | photo accepted; clear panel-location framing |
| 4 | AWAIT_INLET_LOCATION | pass | 8 | "Perfect, that's the ideal setup" reads slightly performative; "ideal" is borderline-marketing |
| 5 | AWAIT_EMAIL | pass | 9 | clean run-length ack from rotation pool |
| 6 | RECAP | pass | 8 | RECAP opener "Quick recap before Key reviews:" used — flagged in v10.2 as over-rotated; should pick alternate |
| 7 | SCHEDULE_QUOTE | pass | 9 | clean wrap-up, sign-off pool entry "Let me know if you have any questions." |

---

## Auto-flags

- Reached expected terminal (COMPLETE): yes
- Hard-constraint violations: 0
- Low-confidence classifier emissions on critical states: 0
- Turn count within 4-15 band: yes (8 conversational turns)
- State self-loops >2x: none
- Ack rate: ~62% of bot turns started with an ack ("Perfect.", "Got it", "Thanks for that.", "Thank you"). Within v10.1 35-65% target band but at the upper edge.
- Two-message split fired: no (orchestrator opted single-message at T1 since customer's first inbound was 22 chars, below the ≥30 threshold for split)
- Micro-color fired: 2x (T2 brand-color, T5 run-length). On-target ratio (~1 in 3 acks).
- Em-dashes: 0
- Banned slang: 0 ("y'all", "holler", "catch ya", "Cool.", "Sweet." all absent)

---

## Observations

**What Ashley did well:**
- T2 was a standout — generator-lookup correctly identified Champion 8500 as compatible_50a and skipped voltage clarification, advancing directly to AWAIT_PANEL_PHOTO. Brand-color tag landed naturally.
- The whole conversation finished in 8 turns, comfortably inside the 4-15 band, with no retries or self-loops.
- Sign-off rotation chose "Let me know if you have any questions." — Key's #1 real sign-off, fits the cooperative-default register.
- Friendly_chitchat at SCHEDULE_QUOTE correctly resolved to COMPLETE rather than NEEDS_CALLBACK (the v10.1.32 patch is working).

**What a real customer would notice:**
- T4 "Perfect, that's the ideal setup" reads slightly salesy. A real Key would more likely say "Got it, garage exterior — clean install" or skip the editorial entirely. Recommend tightening AWAIT_INLET_LOCATION intent to forbid evaluative adjectives ("ideal", "perfect setup", "great").
- T6 RECAP opener "Quick recap before Key reviews:" — per v10.2 this is one of the over-rotated entries (12x in audit). Sarah's run picked it; rotation seed should bias away. Tuner action: enforce frequency-cap selection rather than letting rotation_seed roll uniformly.
- T2 stacked TWO color tags ("Champion 8500, solid unit" + "50 amp, most common whole-home setup") in one message. Each is fine alone; together they read like a checklist of compliments. Phraser should pick ONE color tag per turn, not both.

**Most important observation for the tuner:**
Two distinct micro-color tags (brand-recognition + amperage) fired in the same single message at T2. Both are individually authentic Key-voice, but stacking them in one bubble produces a "two compliments in a row" feel that reads warmer-than-Key. Update phraser rule: when both gen_brand_model and outlet_amps are volunteered in the same customer turn, fire micro-color on ONE of them (prefer the more specific — brand+model over amp), and bare-ack the other. This single change would push T2 from voice-8 to voice-9.

**Confusion risk for a real customer:** none. Sarah's path is the regression baseline and the bot handled it cleanly.
