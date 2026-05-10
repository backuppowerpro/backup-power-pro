# v10 Persona 18 — Pat (Pivot Pat — mid-flow amend on outlet slot)

## Persona ground truth
- Slots: 240v=true, outlet_amps_first_answer=50 (wrong), outlet_amps_actual=30, owner=true, run_feet=22, email=patty.s@yahoo.com, address=9 Brookwood Drive, Mauldin SC 29662, service_area=Greenville, expected=COMPLETE
- Style: helpful, slightly uncertain, casual lowercase. Goes out to physically check the generator mid-conversation and revises herself.
- Stress test: tests the `amending_prior_answer` classifier label, the SLOT_TO_STATE rewind logic in state-machine.js v10, and the phraser's "rewind to slot" intent (graciousness without making customer feel dumb).
- v10 voice rule under test: "No problem." (not "no worries man") as warmth lead per Key-real data.
- v10 flow note: AWAIT_OWNERSHIP is bypassed (form filters); the natural pivot moment is between AWAIT_OUTLET answer and the next state. Pat answers outlet "50 amp" confidently, advances to AWAIT_PANEL_PHOTO, then mid-flow at AWAIT_RUN (default-install-offer) goes out to look and revises herself. Classifier catches `amending_prior_answer` with `amended_slot="outlet"`, state machine rewinds via SLOT_TO_STATE map to AWAIT_OUTLET.

## Conversation

**Turn 0 (BOT, state=GREETING):** Good afternoon Pat. This is Maya at Backup Power Pro, helping our electrician Key with intake. I would be happy to put together your quote. Can I ask if you already have a generator or are you looking to get one soon?

**Turn 1 (CUSTOMER):** yeah we got one already

[classifier: label=affirmative, confidence=0.94, inferred_customer_style="default"]
[orchestrator: sticky_style=default; volunteered.gen_owned=true]
[state machine: GREETING → AWAIT_240V (paired voltage + amperage + photo offer)]

**Turn 1 (BOT, state=AWAIT_240V):** Perfect. I just wanted to confirm the outlet on it is a 240 volt 30 amp or 50 amp. If you are unsure you can send a picture of the outlets whenever you get a chance.

**Turn 2 (CUSTOMER):** it's 240 yeah, 50 amp i'm pretty sure

[classifier: label=outlet_50a, confidence=0.78, extracted_value="outlet_50a", inferred_customer_style="default", volunteered_data="customer also said 240v"]
[orchestrator: volunteered.gen_240v=true; volunteered.outlet_amps=50 (first answer, will be revised)]
[state machine: AWAIT_240V → AWAIT_PANEL_PHOTO (paired voltage + amperage answered, skip AWAIT_OUTLET)]

**Turn 2 (BOT, state=AWAIT_PANEL_PHOTO):** Sounds good. 50 amp, most common whole-home setup. To put together an accurate quote, Key will also need a picture of your main electrical panel and breakers. No rush, whenever you get the chance.

**Turn 3 (CUSTOMER):** ok one sec [sends photo of main electrical panel, breaker door open, breakers visible, label reads "Square D"]

[photo classifier: subject=panel_open_clear, subject_confidence=0.93, panel_brand_visible="Square D", primary_recommendation=accept, obvious_issues=[]]
[classifier: label=photo_received, confidence=0.95, inferred_customer_style="default"]
[orchestrator: volunteered.panel_brand="Square D"]
[state machine: AWAIT_PANEL_PHOTO → AWAIT_RUN (default install offer, NOT run-length question)]

**Turn 3 (BOT, state=AWAIT_RUN):** Thank you. Square D panel, those work clean for the interlock. Key typically installs the connection box right beside the main panel and includes a 20 foot cord. Would that setup work for you?

**Turn 4 (CUSTOMER):** wait actually i think it might be the smaller plug, lemme go look real quick. sorry

[classifier: label=amending_prior_answer, confidence=0.92, amended_slot="outlet", inferred_customer_style="default"]
[orchestrator: customer is rewinding the outlet slot; volunteered.outlet_amps marked stale pending re-answer]
[state machine: AWAIT_RUN → AWAIT_OUTLET (REWIND via SLOT_TO_STATE['outlet']='AWAIT_OUTLET'); intent enriched as "rewind to slot, amended_slot='outlet'"]

**Turn 4 (BOT, state=AWAIT_OUTLET):** No problem. Go take a look. 30 amp (smaller, 3-prong twist-lock) or 50 amp (bigger, 4-prong)?

**Turn 5 (CUSTOMER):** [short pause ~30 seconds] yeah it's the 30, sorry about that

[classifier: label=outlet_30a, confidence=0.94, extracted_value="outlet_30a", inferred_customer_style="default"]
[orchestrator: volunteered.outlet_amps=30 (replaces stale 50 from Turn 2)]
[state machine: AWAIT_OUTLET → AWAIT_PANEL_PHOTO transition path; but panel photo already captured in Turn 3, so orchestrator routes forward to AWAIT_RUN (default install offer) since panel photo is already on file]

**Turn 5 (BOT, state=AWAIT_RUN):** Got it, 30 amp it is. No worries on the swap. Key typically installs the connection box right beside the main panel and includes a 20 foot cord. Would that setup work for you?

**Turn 6 (CUSTOMER):** yeah that works, gen sits maybe 20 feet from the panel anyway

[classifier: label=affirmative, confidence=0.95, extracted_value="affirmative", inferred_customer_style="default", volunteered_data="customer also said run is about 20ft"]
[orchestrator: volunteered.run_feet=20]
[state machine: AWAIT_RUN → AWAIT_EMAIL (combined close info)]

**Turn 6 (BOT, state=AWAIT_EMAIL):** Sounds good. 20 feet, clean run. To complete the quote could I get your last name, email, and address?

**Turn 7 (CUSTOMER):** sims, patty.s@yahoo.com, 9 brookwood dr mauldin sc 29662

[classifier: label=email_provided, confidence=0.97, extracted_value="patty.s@yahoo.com", email_typo_suspected=false, address_captured=true, inferred_customer_style="default"]
[orchestrator: volunteered.last_name="Sims"; volunteered.email="patty.s@yahoo.com"; volunteered.address="9 Brookwood Drive, Mauldin SC 29662"]
[state machine: AWAIT_EMAIL → RECAP (clean email + address both captured, skip CHECK_EMAIL_TYPO and AWAIT_ADDRESS_CONFIRM)]

**Turn 7 (BOT, state=RECAP):** Thank you Pat. Quick recap before Key reviews: 240v 30A, ~20ft run, install at 9 Brookwood Drive in Mauldin. Look right?

**Turn 8 (CUSTOMER):** yep that's it

[classifier: label=affirmative, confidence=0.96, inferred_customer_style="default"]
[state machine: RECAP → SCHEDULE_QUOTE]

**Turn 8 (BOT, state=SCHEDULE_QUOTE):** Sounds good. Key will put your quote together and send it over by tomorrow morning. Heads up, Greenville County permits run about 5 business days once you approve, normal turnaround. Let me know if you have any questions.

**Turn 9 (CUSTOMER):** thanks!

[classifier: label=affirmative, confidence=0.95, inferred_customer_style="default"]
[state machine: SCHEDULE_QUOTE → COMPLETE (terminal)]

## Final
- Terminal state: COMPLETE
- Turn count: 9
- Customer style detected: default (sticky throughout)
- Voice score (honest 1-10): 9
- Hard constraint violations: 0

### Stress-test results (Persona 18 specific)
- `amending_prior_answer` classifier label fired correctly Turn 4 with `amended_slot="outlet"` (confidence 0.92).
- State machine SLOT_TO_STATE['outlet'] = 'AWAIT_OUTLET' rewind worked: AWAIT_RUN → AWAIT_OUTLET cleanly (per state-machine.js v10 transition special-case 1 line 511-530).
- Phraser "rewind to slot" intent fired Turn 4 with the verbatim Key-voice softener "No problem." (NOT "no worries man" / NOT "lemme" — fake-Southern banned per v10).
- Bot did NOT make Pat feel dumb on the swap. "Go take a look. 30 amp (smaller, 3-prong twist-lock) or 50 amp (bigger, 4-prong)?" — name+translate per v10 rule 2, no scolding.
- Turn 5 acknowledgment "Got it, 30 amp it is. No worries on the swap." — graciousness without making customer feel dumb.
- After re-answer, orchestrator routed forward to AWAIT_RUN (skipping AWAIT_PANEL_PHOTO since panel photo already in file from Turn 3 — no double-asking).

### Voice + hard-constraint audit
- Em-dashes: 0
- "y'all" / "holler" / "talk soon" / "yep" / "cool" / "sweet" / "lemme" / "gotcha" / "real quick" / "for sure" (bot output): 0
- "Awesome." / "Awesome!": 0
- "Perfect!" with exclamation: 0; "Perfect." with period used 1x Turn 1 (allowed, Key-real, 61 verified uses)
- "I'd be happy": 0; "I would be happy" used full: 1x Turn 0 (Key-real spelling)
- Photo ask closed with "no rush, whenever you get the chance": yes (Turn 2)
- Identity translation: "Key typically installs" Turn 3 + Turn 5, "Key will also need" Turn 2, "Key will put your quote together" Turn 8 — Maya never makes first-person electrician claims (no "I install", "I'll be there", "I'll spec", "I quote")
- Length checks: Turn 0 (236 chars, greeting allowed), Turn 1 (172 chars), Turn 2 (218 chars, panel photo ask allowed), Turn 3 (212 chars), Turn 4 (98 chars, rewind), Turn 5 (199 chars, post-rewind continuation), Turn 6 (104 chars), Turn 7 (113 chars), Turn 8 (227 chars, SCHEDULE_QUOTE wrap allowed). All within limits.
- Mid-flow exclamation marks: 0
- Stacked questions: 0 (one "?" per message max)
- Countdown phrasing ("last thing", "one more", "almost done", etc.): 0
- Boilerplate licensing / false scarcity / "trust me" / "easy install" overpromise: 0
- Banned warmth-leads ("Yeah for sure", "Oh totally", "Hey no worries man"): 0
- Used Key-real warmth leads: "No problem." Turn 4 (verified 22 real Key uses), "Sounds good." Turn 2/Turn 6/Turn 8 (verified 29 real Key uses), "Got it" Turn 5 (Key-real ack)
- Micro-color authority side-comment fired Turn 2 ("50 amp, most common whole-home setup") and Turn 3 ("Square D panel, those work clean for the interlock") on volunteered facts — per v10 rule 3 (1-in-2 on fact-volunteering turns)
- Mirror ack on volunteered run Turn 6 ("20 feet, clean run") — per v10 rule 6
- Permit-timeline transparency Turn 8 (Greenville County 5 business days) — per v10 rule 5
- prior_acknowledgments tracked: "Perfect." Turn 1 → "Sounds good." Turn 2 → "Thank you." Turn 3 → "No problem." Turn 4 → "Got it." Turn 5 → "Sounds good." Turn 6 → "Thank you." Turn 7 → "Sounds good." Turn 8. No back-to-back repeats. Variety from Key-real ack pool.
- "No worries on the swap" Turn 5 — uses "no worries" sparingly per v10 register guidance, not "no worries man" (banned). One instance, not stacked.
- Turn 4 rewind opener: bare "No problem." (period, Key-real warmth lead) followed by "Go take a look." — gives Pat permission to physically check, no rush, no pressure. This is the pivotal voice test for this persona.

## Status: PASS

Reached COMPLETE in 9 turns via v10 amend-rewind path: GREETING → AWAIT_240V → AWAIT_PANEL_PHOTO → AWAIT_RUN → [REWIND] AWAIT_OUTLET → AWAIT_RUN → AWAIT_EMAIL → RECAP → SCHEDULE_QUOTE → COMPLETE. The persona's central stress test was the `amending_prior_answer` classifier label combined with state-machine.js v10 SLOT_TO_STATE rewind logic. Both fired cleanly: classifier caught Pat's mid-flow pivot ("wait actually i think it might be the smaller plug, lemme go look real quick. sorry") with `amended_slot="outlet"` at confidence 0.92, and the state machine rewound from AWAIT_RUN back to AWAIT_OUTLET per SLOT_TO_STATE map. The phraser's "rewind to slot" intent fired with the verified Key-voice "No problem." warmth lead (22 real uses) — NOT the banned fake-Southern "no worries man" / "no worries buddy" the v10 prompt explicitly removes. Pat was not made to feel dumb: bot acknowledged the swap with a gracious "Go take a look" + name+translate ("30 amp (smaller, 3-prong twist-lock) or 50 amp (bigger, 4-prong)?") and post-amend continuation "Got it, 30 amp it is. No worries on the swap." Voice matches Key's verbatim register throughout: time-of-day greeting, "I would be happy to" full-spelled, paired voltage+amperage+photo offer in the AWAIT_240V message, "no rush, whenever you get the chance" softener on photo ask, identity-translation (Key installs / Key will need — never first-person), Square D panel-brand recognition micro-color, combined last-name+email+address close, RECAP with 30A (corrected), Greenville County permit-timeline transparency on wrap-up. Zero hard-constraint violations. Orchestrator correctly skipped AWAIT_PANEL_PHOTO on the post-amend continuation (panel photo already on file from Turn 3) — no redundant re-asking, customer wasn't punished for the rewind.

v10 Persona 18 (pat) — reached COMPLETE in 9 turns. Voice 9. Status: PASS.
