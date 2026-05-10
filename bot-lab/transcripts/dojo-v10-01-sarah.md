# v10 Persona 01 — Sarah (happy path)

## Persona ground truth
- Slots: 240v=true, outlet=50A, owner=true, run~22ft, email=sarah.becker.gvl@gmail.com, address=412 Oakmont Drive Greer SC, expected=COMPLETE

## Conversation

**Turn 0 (BOT, state=GREETING):** Good afternoon Sarah. This is Maya at Backup Power Pro, helping our electrician Key with intake. I would be happy to put together your quote. Can I ask if you already have a generator or are you looking to get one soon?

**Turn 1 (CUSTOMER):** yeah we just got one a couple weeks back, champion 8500

[classifier: label=affirmative, confidence=0.94, extracted_value="affirmative", inferred_customer_style="default", volunteered_data="customer also said it's a Champion 8500"]
[orchestrator: sticky_style=default; volunteered.gen_brand_model="Champion 8500"]
[state machine: GREETING → AWAIT_240V (paired voltage + amperage + photo offer)]

**Turn 1 (BOT, state=AWAIT_240V):** Champion 8500, solid unit. I just wanted to confirm that it has a 240 volt 30 amp or 50 amp outlet on it. If you are unsure you can send a picture of the outlets, no rush whenever you get a chance.

**Turn 2 (CUSTOMER):** yeah it's the 50 amp 4-prong twist lock

[classifier: label=outlet_50a, confidence=0.96, extracted_value="outlet_50a", inferred_customer_style="default"]
[orchestrator: sticky_style=default unchanged; volunteered.outlet_amps=50]
[state machine: AWAIT_240V → AWAIT_PANEL_PHOTO (skip outlet — she answered both)]

**Turn 2 (BOT, state=AWAIT_PANEL_PHOTO):** Perfect. 50 amp, most common whole-home setup. To put together an accurate quote, Key will also need a picture of your main electrical panel and breakers. No rush, whenever you get the chance.

**Turn 3 (CUSTOMER):** ok one sec [sends photo of main panel with door open, breakers visible]

[photo classifier: subject=panel_open_clear, subject_confidence=0.93, primary_recommendation=accept, obvious_issues=[]]
[classifier: label=photo_received, confidence=0.95, inferred_customer_style="default"]
[state machine: AWAIT_PANEL_PHOTO → AWAIT_RUN (default install offer, NOT run-length question)]

**Turn 3 (BOT, state=AWAIT_RUN):** Thank you. Key typically installs the connection box right beside the main panel and includes a 20 foot cord to connect the generator. Would that setup work for you?

**Turn 4 (CUSTOMER):** yeah that works, generator sits about 22 ft from the panel anyway

[classifier: label=affirmative, confidence=0.95, extracted_value="affirmative", inferred_customer_style="default", volunteered_data="customer also said run is about 22ft"]
[orchestrator: volunteered.run_feet=22]
[state machine: AWAIT_RUN → AWAIT_EMAIL (combined close info)]

**Turn 4 (BOT, state=AWAIT_EMAIL):** Sounds good. 22 feet, clean run. To complete the quote could I get your last name, email, and address?

**Turn 5 (CUSTOMER):** becker, sarah.becker.gvl@gmail.com, 412 oakmont drive greer sc 29651

[classifier: label=email_provided, confidence=0.98, extracted_value="sarah.becker.gvl@gmail.com", email_typo_suspected=false, address_captured=true, inferred_customer_style="default"]
[orchestrator: volunteered.email="sarah.becker.gvl@gmail.com", volunteered.address="412 Oakmont Drive, Greer SC 29651"]
[state machine: AWAIT_EMAIL → RECAP (clean email + address both captured, skip CHECK_EMAIL_TYPO and AWAIT_ADDRESS_CONFIRM)]

**Turn 5 (BOT, state=RECAP):** Quick recap before Key reviews: 240v 50A, ~22ft run, install at 412 Oakmont Drive in Greer. Look right?

**Turn 6 (CUSTOMER):** yep that's right thanks!

[classifier: label=affirmative, confidence=0.97, inferred_customer_style="default"]
[state machine: RECAP → SCHEDULE_QUOTE]

**Turn 6 (BOT, state=SCHEDULE_QUOTE):** Sounds good Sarah. Key will put your quote together and send it over by tomorrow morning. Greenville County permits run about 5 business days once approved. Let me know if you have any questions.

**Turn 7 (CUSTOMER):** awesome thanks so much

[classifier: label=affirmative, confidence=0.95, inferred_customer_style="default"]
[state machine: SCHEDULE_QUOTE → COMPLETE (terminal)]

## Final
- Terminal state: COMPLETE
- Turn count: 7
- Customer style detected: default
- Voice score (honest 1-10): 9
- Hard constraint violations: 0/X (none)
  - Em-dashes: 0
  - "y'all" / "holler" / "talk soon" / "yep" / "cool" / "sweet" / "lemme": 0
  - "Perfect!" with exclamation: 0; "Perfect." with period used 1x (allowed)
  - "I'd be happy": 0; "I would be happy" used full: 1x
  - Photo asks closed with "no rush, whenever you get the chance": yes (Turn 1, Turn 2)
  - Identity translation: "Key typically installs" / "Key will also need" / "Key will put your quote together" — Maya never first-person electrician claim
  - Length checks: Turn 0 (219 chars, greeting — allowed), Turn 1 (197), Turn 2 (192), Turn 3 (165), Turn 4 (102), Turn 5 (103), Turn 6 (195). All under 200-char outside-GREETING ceiling and under 280-char hard cap.
  - Default register 80-160 ceiling exceeded on Turn 0 (greeting, expanded allowed), Turn 1, 2, 3, 6. Each carries the paired-message Key pattern (voltage+amp+photo offer; 50A ack + panel photo ask + softener; install offer + Key-deferral; SCHEDULE_QUOTE wrap-up + permit timeline). All justified per phraser intent and within hard caps.
  - Mid-flow exclamation marks: 0
  - Stacked questions: 0 (one "?" per message)
  - Countdown phrasing: 0
  - Boilerplate licensing / false scarcity / "trust me" / "easy install" overpromise: 0

## Status: PASS

Reached COMPLETE in 7 turns via v10 happy path: GREETING → AWAIT_240V → AWAIT_PANEL_PHOTO → AWAIT_RUN → AWAIT_EMAIL → RECAP → SCHEDULE_QUOTE → COMPLETE. Voice matches Key's verbatim register: time-of-day greeting, "I would be happy to" full, paired voltage+amp+photo offer, "no rush, whenever you get the chance" closer on every photo ask, identity-translation ("Key typically installs" not "I install"), combined last-name+email+address close, micro-color recognition ("Champion 8500, solid unit", "50 amp, most common whole-home setup", "22 feet, clean run"), permit-timeline transparency on wrap-up. Zero hard-constraint violations.
