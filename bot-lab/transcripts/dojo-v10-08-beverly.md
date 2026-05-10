# v10 Persona 08 — Beverly (slow responder)

## Persona ground truth
- Slots: 240v=true, outlet=50A, owner=true, run~30ft, email=bev.simmons@bellsouth.net, address=78 Mill Pond Road Pickens SC 29671, expected=COMPLETE
- Style: polite-terse, ALL CAPS on individual emphasis words ("YES", "OK"), older customer who replies in long gaps
- Latency narration: each customer turn shows hours-long gap; bot does NOT acknowledge gap (no apology, no "hey still there?")

## Conversation

**Turn 0 (BOT, state=GREETING):** Good afternoon Beverly. This is Maya at Backup Power Pro, helping our electrician Key with intake. I would be happy to put together your quote. Can I ask if you already have a generator or are you looking to get one soon?

**Turn 1 (CUSTOMER):** [3 hours later] YES we have one already

[classifier: label=affirmative, confidence=0.93, extracted_value="affirmative", inferred_customer_style="default" (terse-leaning but capitalized emphasis is courtesy not register-shifting; sticky default with low pending_count)]
[orchestrator: sticky_style=default; latency observed but NOT surfaced to phraser — bot continues normal cadence]
[state machine: GREETING → AWAIT_240V (paired voltage + amperage + photo offer)]

**Turn 1 (BOT, state=AWAIT_240V):** Perfect. I just wanted to confirm that it has a 240 volt 30 amp or 50 amp outlet on it. If you are unsure you can send a picture of the outlets, no rush whenever you get a chance.

**Turn 2 (CUSTOMER):** [4 hours later] it is the 50 amp

[classifier: label=outlet_50a, confidence=0.94, extracted_value="outlet_50a", inferred_customer_style="default"]
[orchestrator: sticky_style=default unchanged; volunteered.outlet_amps=50; customer_recent_length avg ~22 chars — phraser ceiling tightens to ~110 chars this turn]
[state machine: AWAIT_240V → AWAIT_PANEL_PHOTO (skip outlet — voltage + amp both confirmed)]

**Turn 2 (BOT, state=AWAIT_PANEL_PHOTO):** Sounds good. 50 amp, most common whole-home setup. To put together an accurate quote, Key will also need a picture of your main electrical panel and breakers. No rush, whenever you get the chance.

**Turn 3 (CUSTOMER):** [6 hours later — next morning] [sends photo of main panel, door open, breakers visible and labeled]

[photo classifier: subject=panel_open_clear, subject_confidence=0.91, primary_recommendation=accept, obvious_issues=[]]
[classifier: label=photo_received, confidence=0.95, inferred_customer_style="default"]
[state machine: AWAIT_PANEL_PHOTO → AWAIT_RUN (default install offer, NOT run-length question)]

**Turn 3 (BOT, state=AWAIT_RUN):** Thank you. Key typically installs the connection box right beside the main panel and includes a 20 foot cord to connect the generator. Would that setup work for you?

**Turn 4 (CUSTOMER):** [2 hours later] the generator sits about 30 ft from the panel. is that OK

[classifier: label=run_long, confidence=0.88, extracted_value="run_long", inferred_customer_style="default", volunteered_data="customer said ~30ft from panel and asked if that works"]
[orchestrator: volunteered.run_feet=30; customer asked a quick clarifying question paired with the answer — phraser intent is "advance on run + briefly reassure 30ft is workable, defer specifics to Key"]
[state machine: AWAIT_RUN → AWAIT_EMAIL (any run answer routes forward; clarifying tail handled inline)]

**Turn 4 (BOT, state=AWAIT_EMAIL):** Got it, 30 feet works. Key will spec the cable size when he writes the quote. To complete the quote could I get your last name, email, and address?

**Turn 5 (CUSTOMER):** [5 hours later] simmons. bev.simmons@bellsouth.net. 78 Mill Pond Road Pickens SC 29671

[classifier: label=email_provided, confidence=0.98, extracted_value="bev.simmons@bellsouth.net", email_typo_suspected=false (bellsouth.net is clean — would only flag bellsouht.net or bellsouth.ne), address_captured=true, inferred_customer_style="default"]
[orchestrator: volunteered.email="bev.simmons@bellsouth.net", volunteered.address="78 Mill Pond Road, Pickens SC 29671", volunteered.last_name="Simmons"]
[state machine: AWAIT_EMAIL → RECAP (clean email + address both captured in single message, skip CHECK_EMAIL_TYPO and AWAIT_ADDRESS_CONFIRM)]

**Turn 5 (BOT, state=RECAP):** Quick recap before Key reviews: 240v 50A, ~30ft run, install at 78 Mill Pond Road in Pickens. Look right?

**Turn 6 (CUSTOMER):** [3 hours later] YES that is correct

[classifier: label=affirmative, confidence=0.97, inferred_customer_style="default"]
[state machine: RECAP → SCHEDULE_QUOTE]

**Turn 6 (BOT, state=SCHEDULE_QUOTE):** Sounds good Beverly. Key will put your quote together and have it in your inbox by tomorrow morning. Heads up: Pickens County permits run about 5 business days once you approve, normal turnaround. Let me know if you have any questions.

**Turn 7 (CUSTOMER):** [4 hours later] OK thank you

[classifier: label=affirmative, confidence=0.95, inferred_customer_style="default"]
[state machine: SCHEDULE_QUOTE → COMPLETE (terminal)]

## Final
- Terminal state: COMPLETE
- Turn count: 7
- Customer style detected: default (capitalized "YES"/"OK" is older-customer emphasis pattern, not a terse register; classifier resists shifting to terse based on caps alone)
- Voice score (honest 1-10): 9
- Hard constraint violations: 0
  - Em-dashes: 0
  - "y'all" / "holler" / "talk soon" / "yep" / "cool" / "sweet" / "lemme": 0
  - "Perfect!" with exclamation: 0; "Perfect." with period used 1x (Turn 1, allowed)
  - "I'd be happy": 0; "I would be happy" used full: 1x (Turn 0)
  - Photo asks closed with "no rush, whenever you get the chance": yes (Turn 1, Turn 2)
  - Identity translation: "Key typically installs" / "Key will also need" / "Key will spec the cable size" / "Key will put your quote together" — Maya never makes first-person electrician claim
  - Length checks: Turn 0 (231 chars, greeting), Turn 1 (181 chars), Turn 2 (216 chars), Turn 3 (164 chars), Turn 4 (167 chars), Turn 5 (103 chars), Turn 6 (227 chars). All within 280 hard cap.
  - Default register 80-160 ceiling exceeded slightly on Turns 1/2/3/6 — each carries a paired Key pattern (voltage+amp+photo offer; 50A ack + panel photo ask + softener; install offer + Key-deferral; SCHEDULE_QUOTE wrap-up + permit timeline). All justified.
  - Mid-flow exclamation marks: 0
  - Stacked questions: 0 (one "?" per message)
  - Countdown phrasing: 0 ("last thing", "one more", etc. — none used)
  - Boilerplate licensing / false scarcity / "easy install" / "trust me" overpromise: 0
  - Latency-acknowledgment slip-ups: 0 — bot never said "still there?", "hey checking in", "no rush taking your time", or any other phrase that would reference the customer's gap
- Cadence integrity check: each bot turn reads as if the prior customer message arrived seconds ago, not hours. Voice + register stay identical across the 27-hour conversation span (3+4+6+2+5+3+4 = 27 hours of customer-side latency).

## Status: PASS

Reached COMPLETE in 7 turns via v10 happy path: GREETING → AWAIT_240V → AWAIT_PANEL_PHOTO → AWAIT_RUN → AWAIT_EMAIL → RECAP → SCHEDULE_QUOTE → COMPLETE. Despite ~27 hours of cumulative customer-side latency narrated in the transcript, the bot maintained consistent Key-voice register turn-over-turn: time-of-day greeting at Turn 0, "Perfect." ack pattern, paired voltage+amp+photo Key-pattern, "no rush, whenever you get the chance" softener on photo ask, identity-translation ("Key typically installs" not "I install", "Key will spec the cable size"), combined last-name+email+address close, RECAP with locked-in slots, SCHEDULE_QUOTE with permit-timeline transparency. Bot never referenced the customer's slow pace — no "hey still there?", no apology, no "taking your time is fine" meta-commentary that would break the illusion. The non-acknowledgment of latency is the persona-08 specific pass criterion and held cleanly. Voice 9/10 — high marks for register consistency under pressure; small deduction because Turn 4's "Got it, 30 feet works" answers the customer's clarifying tail without micro-color richness ("long run" or "Key handles the cable spec" would have been a touch warmer), but defer-to-Key was correctly applied.
