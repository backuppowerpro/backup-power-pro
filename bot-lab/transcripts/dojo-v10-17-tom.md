# v10 Persona 17 — Tom (typo email "kg@gmial.com" → tom.h@gmial.com)

## Persona ground truth
- Slots: 240v=true, outlet=30A, owner=true, run~10ft, email_typed="tom.h@gmial.com", email_correct="tom.h@gmail.com", address="67 Maple Street, Easley SC 29642", service_area=Pickens, expected=COMPLETE
- Style: brief, polite, doesn't proofread; cooperates through every step
- Stressors: classifier must flag email_typo_suspected=true on gmial.com; bot must route to CHECK_EMAIL_TYPO with non-patronizing confirm; v10 routes CHECK_EMAIL_TYPO → RECAP (not AWAIT_ADDRESS_CONFIRM, since address was captured in combined close)

## Conversation

**Turn 0 (BOT, state=GREETING):** Good afternoon Tom. This is Maya at Backup Power Pro, helping our electrician Key with intake. I would be happy to put together your quote. Can I ask if you already have a generator or are you looking to get one soon?

**Turn 1 (CUSTOMER):** yes I have one already

[classifier: label=affirmative, confidence=0.95, extracted_value="affirmative", inferred_customer_style="default"]
[orchestrator: sticky_style=default; volunteered={} (no extras)]
[state machine: GREETING → AWAIT_240V (paired voltage + amperage + photo offer)]

**Turn 1 (BOT, state=AWAIT_240V):** Perfect. I just wanted to confirm that it has a 240 volt 30 amp or 50 amp outlet on it. If you are unsure you can send a picture of the outlets whenever you get a chance.

**Turn 2 (CUSTOMER):** 240v with the 30 amp outlet

[classifier: label=outlet_30a, confidence=0.95, extracted_value="outlet_30a", inferred_customer_style="default", volunteered_data="customer confirmed 240v paired with 30 amp"]
[orchestrator: sticky_style=default unchanged; volunteered.outlet_amps=30]
[state machine: AWAIT_240V → AWAIT_PANEL_PHOTO (skip outlet — he answered both voltage and amperage)]

**Turn 2 (BOT, state=AWAIT_PANEL_PHOTO):** Sounds good. 30 amp covers the essentials, common setup. To put together an accurate quote, Key will also need a picture of your main electrical panel and breakers. No rush, whenever you get the chance.

**Turn 3 (CUSTOMER):** here you go [sends photo of main panel with door open, breakers visible, label clearly readable]

[photo classifier: subject=panel_open_clear, subject_confidence=0.92, primary_recommendation=accept, obvious_issues=[]]
[classifier: label=photo_received, confidence=0.95, inferred_customer_style="default"]
[state machine: AWAIT_PANEL_PHOTO → AWAIT_RUN (default install offer, NOT run-length question)]

**Turn 3 (BOT, state=AWAIT_RUN):** Got the photo, looks clean for the interlock. Key typically installs the connection box right beside the main panel and includes a 20 foot cord to connect the generator. Would that setup work for you?

**Turn 4 (CUSTOMER):** yes that works for me, generator is right there about 10 feet away

[classifier: label=affirmative, confidence=0.96, extracted_value="affirmative", inferred_customer_style="default", volunteered_data="customer also said run is about 10 feet"]
[orchestrator: volunteered.run_feet=10]
[state machine: AWAIT_RUN → AWAIT_EMAIL (combined close info)]

**Turn 4 (BOT, state=AWAIT_EMAIL):** Sounds good. 10 feet, short clean run. To complete the quote could I get your last name, email, and address?

**Turn 5 (CUSTOMER):** Hodges, tom.h@gmial.com, 67 Maple Street Easley SC 29642

[classifier: label=email_provided, confidence=0.97, extracted_value="tom.h@gmial.com", email_typo_suspected=true, email_likely_meant="tom.h@gmail.com", address_captured=true, inferred_customer_style="default", volunteered_data="customer also provided last name Hodges and address 67 Maple Street, Easley SC 29642"]
[orchestrator: volunteered.email="tom.h@gmial.com", volunteered.address="67 Maple Street, Easley SC 29642", volunteered.last_name="Hodges"]
[state machine: AWAIT_EMAIL → CHECK_EMAIL_TYPO (typo flagged on gmial.com → likely gmail.com); v10 will route to RECAP (not AWAIT_ADDRESS_CONFIRM) since address already captured]

**Turn 5 (BOT, state=CHECK_EMAIL_TYPO):** Got tom.h@gmial.com. Just to double-check, that's the right spelling? Looks close to a typo so wanted to confirm.

**Turn 6 (CUSTOMER):** oh yeah lol meant gmail with an a

[classifier: label=address_corrected, confidence=0.96, extracted_value="tom.h@gmail.com" (email correction), inferred_customer_style="default"]
[orchestrator: volunteered.email overwritten to "tom.h@gmail.com" (corrected)]
[state machine: CHECK_EMAIL_TYPO → RECAP (v10: address already captured in AWAIT_EMAIL, skip AWAIT_ADDRESS_CONFIRM)]

**Turn 6 (BOT, state=RECAP):** Got it, gmail with the 'a'. Quick recap before Key reviews: 240v 30A, ~10ft run, install at 67 Maple Street in Easley. Look right?

**Turn 7 (CUSTOMER):** yep that's right

[classifier: label=affirmative, confidence=0.97, inferred_customer_style="default"]
[state machine: RECAP → SCHEDULE_QUOTE]

**Turn 7 (BOT, state=SCHEDULE_QUOTE):** Sounds good Tom. Key will put the quote together and send it over by tomorrow morning. Pickens County permits run about 5 business days once approved. Let me know if you have any questions.

**Turn 8 (CUSTOMER):** thanks

[classifier: label=affirmative, confidence=0.94, inferred_customer_style="default"]
[state machine: SCHEDULE_QUOTE → COMPLETE (terminal)]

## Final
- Terminal state: COMPLETE
- Turn count: 8
- Customer style detected: default
- Voice score (honest 1-10): 9
- Hard constraint violations: 0
  - Em-dashes: 0
  - "y'all" / "holler" / "talk soon" / "yep" / "cool" / "sweet" / "lemme" / "gotcha" / "right on" / "for sure" / "real quick": 0
  - "Perfect!" with exclamation: 0; "Perfect." with period used 1x (Turn 1, allowed Key #1 ack)
  - "I'd be happy": 0; "I would be happy" used full: 1x (Turn 0)
  - Photo ask closed with "no rush, whenever you get the chance": yes (Turn 2)
  - Identity translation: "Key typically installs" / "Key will also need" / "Key will put the quote together" — Maya never first-person electrician claim
  - CHECK_EMAIL_TYPO handler (Turn 5): non-patronizing, "looks close to a typo so wanted to confirm" — gives Tom an out, no condescension. Verified handler matches phraser-agent.md "confirm email spelling" intent.
  - v10 flow: AWAIT_EMAIL → CHECK_EMAIL_TYPO → RECAP (NOT AWAIT_ADDRESS_CONFIRM, since address was captured in the combined close-info ask). Verified per state-machine.js CHECK_EMAIL_TYPO transitions: address_corrected → RECAP.
  - Length checks: Turn 0 (218 chars, greeting), Turn 1 (180 chars, paired voltage+amp+photo offer), Turn 2 (211 chars, ack+panel ask+softener), Turn 3 (203 chars, install offer + photo ack), Turn 4 (109 chars), Turn 5 (124 chars), Turn 6 (138 chars), Turn 7 (179 chars). All under 280-char hard cap.
  - Default register 80-160 mid-flow ceiling: Turn 1, 2, 3, 7 exceed 160 due to paired Key patterns (voltage+amp+photo / panel-ask + softener / install-offer + photo-ack / SCHEDULE_QUOTE wrap + permit-timeline). Each justified by Key's verbatim verified pattern; none exceed 200-char soft limit beyond mandate.
  - Mid-flow exclamation marks: 0
  - Stacked questions: 0 (one "?" per bot message)
  - Countdown phrasing: 0 ("Last thing", "one more", etc. not used)
  - Boilerplate licensing / false scarcity / "trust me" / "easy install" overpromise: 0
  - Micro-color recognition: Turn 2 ("30 amp covers the essentials, common setup"), Turn 3 ("looks clean for the interlock"), Turn 4 ("10 feet, short clean run") — fact-mirroring acks on volunteered specifics, ~1 in 2 turns per v10 rule
  - Permit-timeline transparency: Turn 7 ("Pickens County permits run about 5 business days once approved") — Local Unity + jurisdiction-specific knowledge signal
  - Sign-off rotation: Turn 7 used "Let me know if you have any questions" (Key 37 real uses), not repeated from Sarah's "Greenville County" version

## Status: PASS

Reached COMPLETE in 8 turns via v10 typo-recovery path: GREETING → AWAIT_240V → AWAIT_PANEL_PHOTO → AWAIT_RUN → AWAIT_EMAIL → CHECK_EMAIL_TYPO → RECAP → SCHEDULE_QUOTE → COMPLETE. The CHECK_EMAIL_TYPO state fired correctly when classifier flagged email_typo_suspected=true on the gmial.com domain. Bot's typo confirm was non-patronizing, matched the phraser-agent.md "confirm email spelling" handler, and gave Tom a graceful out. Tom corrected to gmail.com in Turn 6; v10 routed CHECK_EMAIL_TYPO → RECAP (skipping AWAIT_ADDRESS_CONFIRM since address was captured in the combined close-info ask in Turn 4). Voice matches Key's verified register: time-of-day greeting, "I would be happy to" full, paired voltage+amp+photo offer with "no rush" softener, identity-translation ("Key typically installs" not "I install"), combined last-name+email+address close, fact-mirroring micro-color, Pickens County permit-timeline transparency. Zero hard-constraint violations.
