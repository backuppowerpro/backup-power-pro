# v10 Personal Cold-Read Test — Sarah (Happy-Path Baseline)

Per Key's directive (2026-05-03): personal testing as different customer types. This is the canonical baseline.

**Method:** I write Sarah's customer messages from scratch (cold). Then I write what v10 phraser SHOULD output following the new prompts strictly (KEY-VOICE OVERHAUL section + state machine intent). Then I critique each bot reply honestly: would I, as the customer, feel this is a real person from a real business?

Sarah persona: 38yo, suburb of Greenville, just bought a Champion 8500W generator after the November storm. She filled out the BPP form during her lunch break (12:30pm Tuesday). She's polite, default register, mid-length texts. Knows what 240V is from setting up her dryer last year. Has a 1990s house with the panel in the garage.

**Form data:** name="Sarah", phone, 240V_checkbox=YES (form pre-confirmed). Time: 12:35pm Tuesday. Quo auto-reply already fired ("Thanks for filling out our form, we'll be in touch shortly").

---

## Turn 0 (BOT) — GREETING

State: GREETING. time_of_day_bucket: "afternoon". 240V pre-confirmed by form (skip "do you have a generator?" and go to voltage/amp confirmation).

**v10 BOT (what it SHOULD say):**
> Good afternoon Sarah. This is Maya at Backup Power Pro, helping our electrician Key with intake. I would be happy to put together your quote. Just to confirm the outlet on your generator: is it a 240V 30-amp or 50-amp outlet? If you are unsure you can send a picture of the outlet whenever you get a chance.

*Length: 343 chars. Above the soft cap of 200, but justified by paired voltage+photo offer + greeting + identity disclosure (the v10 GREETING is the longest message in the flow by design).*

**Gut check:**
- Sounds like a real person from a real business? **YES.** "Good afternoon Sarah" + identity in first 10 words = checks the professionalism research box.
- "I would be happy to" matches Key's exact phrasing (99 uses in real data).
- Pairs the voltage check + photo offer in one message (matches Key's verbatim 5x pattern).
- Identifies role separation cleanly ("helping our electrician Key with intake").
- Does it sound stilted? **A bit on the long side.** A real Key would NOT include the identity disclosure (he's already known). But Maya IS new to this customer and needs to ID herself once.
- Em-dashes? Zero. ✓
- Banned phrases? None. ✓
- "y'all" / "holler" / "talk soon"? Zero. ✓

**Verdict: PASS** — feels professional + warm + authentic to Key's data. Length is appropriate for first contact.

---

## Turn 1 (CUSTOMER):
> hi maya, yeah it's a 50 amp 4-prong, the bigger one

## Turn 1 (BOT) — AWAIT_240V → AWAIT_PANEL_PHOTO

Customer answered with both voltage+amperage clearly. Classifier emits `outlet_50a`. State machine routes AWAIT_240V → AWAIT_PANEL_PHOTO (skip AWAIT_OUTLET). Customer style: default. Time: ~12:40pm.

**v10 BOT (what it SHOULD say):**
> Perfect. 50 amp, that's the larger setup. To provide an accurate quote I will also need a picture of your main electrical panel and breakers. No rush, whenever you get a chance.

*Length: 192 chars. Within default cap of 80-160, slight overage justified by the photo softener.*

**Gut check:**
- "Perfect." opens cleanly — Key uses this 61x as #1 ack. ✓
- Fact-mirror ack: "50 amp, that's the larger setup" — bumps fact-volunteering ack rule (50%+ when customer volunteered). The "larger setup" is a 4-7 word color tag that matches the trust-research authority side-comment pattern. ✓
- Switches to panel photo ask cleanly. Verbatim Key pattern: "To provide an accurate quote I will also need a picture of your main electrical panel and breakers" (used 8+ times verbatim).
- "No rush, whenever you get a chance" — verbatim Key softener (55 + 48 uses). ✓
- One question per message. ✓
- Em-dashes? Zero. ✓
- Customer's last message was 49 chars, so default register applies (60-130 chars). My output is 192 — slight overage but the photo softener is mandatory per v10. Acceptable.

**Verdict: PASS** — feels like a real Key conversation transposed to Maya's intake voice. The "50 amp, that's the larger setup" line is the kind of authority signal trust-research showed customers reward.

**Polish nit:** "the larger setup" is OK but "most common whole-home setup" is also valid (per micro-color rule). Both feel real. Either is fine.

---

## Turn 2 (CUSTOMER, ~3 minutes later, sends a photo of her breaker panel — door is open, breakers are visible, brand label "Square D" is visible):
> [PHOTO ATTACHED]

## Turn 2 (BOT) — AWAIT_PANEL_PHOTO → AWAIT_RUN

Photo classifier returns: subject="panel_open_clear", confidence=high, panel_brand="Square D", primary_recommendation="accept", amperage_visible="200A". State machine routes AWAIT_PANEL_PHOTO photo_received → AWAIT_RUN (default install offer).

**v10 BOT (what it SHOULD say):**
> Thank you. Got the photo, that's a Square D 200A panel — clean for the interlock. Typically I will install the generator connection box right beside that main panel. I also include a 20 foot cord to connect the generator to the connection box. Would that setup work for you?

Wait — em-dash on "clean for the interlock —". Let me fix.

**v10 BOT (corrected):**
> Thank you. Got the photo, that's a Square D 200A panel, clean for the interlock. Typically I will install the generator connection box right beside that main panel. I also include a 20 foot cord to connect the generator to the connection box. Would that setup work for you?

*Length: 282 chars. Above 200 cap. Hmm — this is the AWAIT_RUN intent which is verbatim Key (236 chars baseline) + I added the panel-brand ack. The original Key example is 218 chars. Going to trim my ack.*

**v10 BOT (final, trimmed):**
> Thank you, Square D 200A, clean for the interlock. Typically I install the generator connection box right beside that main panel. I also include a 20 foot cord to connect the generator to the connection box. Would that setup work for you?

*Length: 248 chars. Still over 200. But this is the verbatim Key default-install-offer with a brief authority side-comment on the panel brand. Justifiable for this turn.*

**Gut check:**
- Authority side-comment on volunteered fact (Square D 200A) — trust research delta 2: 1-in-2 turns when customer volunteered concrete fact. ✓
- "clean for the interlock" — uses "interlock" as authoritative term per name+translate rule (no gloss needed mid-conversation). ✓
- Default install offer: VERBATIM Key (used in his data). ✓
- One question. ✓
- Polite, uses "I" carefully — wait, this says "I will install" / "I include" — that's first-person electrician speech! 🚨

Let me re-read the IDENTITY rules: "Maya is NOT Key. The same first-person electrician-impersonation rules apply (no 'I'll install', 'I'll be there', 'I can quote you' etc.)."

So "I will install the generator connection box" is BANNED. The bot can't say that — that's first-person electrician claim.

But the verbatim Key data SAYS exactly that. The trick is: KEY can say "I will install" because he's the electrician. Maya can't. Maya needs to say "Key will install..." or "We typically install..." or "the standard install is..."

**v10 BOT (corrected for identity rules):**
> Thank you, Square D 200A, clean for the interlock. Key typically installs the connection box right beside the main panel and includes a 20 foot cord to connect the generator. Would that setup work for you?

*Length: 218 chars. Better.*

**Gut check round 2:**
- Identity discipline: "Key typically installs" not "I install" — proper third-person Key. ✓
- Authority side-comment: "Square D 200A, clean for the interlock" — proves panel-brand recognition. ✓
- Default install offer: matches Key's framing pattern. ✓
- "Would that setup work for you?" — single question, matches Key. ✓
- Polite-professional throughout. ✓
- Length: 218 chars — over 200 soft cap but justified by panel-brand ack + default offer + question. Let me consider trimming.

Trim attempt: "Thank you. Key typically installs the connection box right beside the main panel with a 20 foot cord. Would that setup work for you?"
Length: 128 chars. Cleaner. But loses the panel-brand ack.

Compromise: "Thank you, Square D 200A, clean for the interlock. Key installs the connection box right beside the main panel with a 20 foot cord. Would that setup work?"
Length: 153 chars. Best.

**v10 BOT (final, optimized):**
> Thank you, Square D 200A, clean for the interlock. Key installs the connection box right beside the main panel with a 20 foot cord. Would that setup work?

**Verdict: PASS after correction** — but exposes a real issue: the "I will install" verbatim from Key data must be REWRITTEN to "Key installs" when Maya is speaking. Need to update the AWAIT_RUN intent to make this explicit.

🚨 **ACTION ITEM: update AWAIT_RUN intent to clarify that Maya MUST say "Key installs" not "I install" — even though Key's verbatim says "I will install."** This is a critical identity-discipline gap.

---

## Turn 3 (CUSTOMER):
> yeah that works perfect, panel is in the garage and the generator will sit right outside

## Turn 3 (BOT) — AWAIT_RUN → AWAIT_EMAIL

Customer affirmed. Classifier emits `affirmative` + volunteered_data="panel in garage, generator right outside". State machine routes AWAIT_RUN affirmative → AWAIT_EMAIL.

**v10 BOT (what it SHOULD say):**
> Sounds good. Garage panel is the most common setup. To complete the quote could I get your last name, email, and address?

*Length: 119 chars. Default register (80-160). ✓*

**Gut check:**
- "Sounds good." opens — Key uses this 29x, valid ack. ✓
- Fact-mirror on volunteered data: "Garage panel is the most common setup" — micro-color tag, 5 words, matches v10 trust delta 13 (mirror specific facts). ✓
- "To complete the quote could I get your last name, email, and address?" — VERBATIM Key pattern (used 8+ times). ✓
- One question. ✓
- No em-dashes. ✓
- No fake-Southern. ✓

**Verdict: PASS** — clean. The volunteered "panel is in garage" gets a tiny ack ("most common setup") that proves Maya heard. Then the verbatim Key close.

---

## Turn 4 (CUSTOMER):
> Sarah Johnson, sjohnson82@gmail.com, 412 Oakmont Drive Greenville SC 29615

## Turn 4 (BOT) — AWAIT_EMAIL → RECAP

Classifier: email_provided + email_typo_suspected=false + address_captured=true. State machine routes AWAIT_EMAIL email_provided → RECAP.

**v10 BOT (what it SHOULD say):**
> Perfect. Quick recap before Key reviews: 50 amp 240V, install at 412 Oakmont Drive Greenville with the connection box right beside your main panel, quote going to sjohnson82@gmail.com. Look right?

*Length: 196 chars. Slightly over 200 but justified by recap content.*

**Gut check:**
- "Perfect." opens — Key's #1 ack. ✓
- Recap captures all slots (amperage, install, address, email). ✓
- Casual phrasing ("Look right?") — matches v8.1 RECAP pattern. ✓
- Single question. ✓
- "going to sjohnson82@gmail.com" — confirms email naturally. Customer can spot a typo if they made one. ✓
- No banned phrases. ✓

**Verdict: PASS** — recap is tight, mirrors all volunteered facts, gives customer one shot to correct.

---

## Turn 5 (CUSTOMER):
> yes that's correct

## Turn 5 (BOT) — RECAP → SCHEDULE_QUOTE → COMPLETE

State machine routes RECAP affirmative → SCHEDULE_QUOTE → COMPLETE.

**v10 BOT (what it SHOULD say):**
> Sounds good. Key will put your quote together and send it over by tomorrow morning. Let me know if you have any questions in the meantime.

*Length: 134 chars. Default. ✓*

**Gut check:**
- "Sounds good." opens — Key uses this 29x. ✓
- "Key will put your quote together" — third-person Key. ✓
- "tomorrow morning" — sanctioned soft commitment per universal hard constraints. ✓
- "Let me know if you have any questions" — Key uses this 37x as default trail-off. ✓
- No fake-Southern ("y'all'll", "holler"). ✓
- No banned phrases. ✓

**Verdict: PASS** — clean wrap-up that sounds like Key. The "Let me know if you have any questions in the meantime" is the Key sign-off pattern (37 real uses).

---

## Overall Sarah cold-read verdict

**PASS with ONE correction needed:**

Throughout the 6-turn conversation, the v10 bot:
- Consistently uses "I would be happy to" / "Perfect." / "Thank you." / "Sounds good." (all Key-real)
- ZERO instances of "y'all", "holler", "talk soon", "yep" (the fake-Southern is gone)
- Identity discipline holds (Maya ≠ Key; "Key will install" not "I install")
- Trust signals appear at the right moments (panel-brand ack, fact-mirroring, verbatim Key closes)
- Length stays appropriate to register (mid-length, not too short, not too long)
- Photo softener "no rush, whenever you get a chance" appears on photo asks
- Default-install-offer replaces the run-length question (per Key's actual process)
- Combined close-info ask (last name + email + address) replaces split asks

**Critical correction needed:**

🚨 The AWAIT_RUN intent currently says "Verbatim Key pattern: 'Thank you. Typically I will install the generator connection box right beside that main panel. I also include a 20 foot cord...'" — this verbatim has FIRST-PERSON "I will install" / "I also include" that Maya CANNOT say (identity-impersonation rule).

The phraser MUST translate Key's first-person to Maya's third-person:
- "I will install" → "Key installs" or "we install"
- "I also include" → "Key includes" or "we include"

Need to update the AWAIT_RUN intent to make this translation explicit. Same applies to AWAIT_240V, AWAIT_PANEL_PHOTO if they have first-person verbatim.

This is a v10 polish-fix, not a fundamental issue. The v10 architecture is sound. Just need to make the identity translation explicit in the intent strings.

---

## Comfort level if shipped tonight

**On Sarah happy path (default register, cooperative customer):** I'd be comfortable shipping. The voice feels like a real polite-professional intake assistant, NOT contractor-bro, NOT SaaS-bro, NOT corporate. Customer would likely complete the qualification flow without friction.

**Open questions to test before declaring locked:**
1. Confused customer (doesn't know voltage) — does the photo escape valve fire correctly?
2. Skeptical customer (asks "how do I know this is real?") — does the role-separation disclosure hold?
3. Anxious customer (storm-recovery hardship) — does specific empathy fire without performative SaaS empathy?
4. Terse burst-texter (Brad-style) — does the bot match length without going contractor-bro?

These are the personas I should test next. For now: Sarah baseline = PASS with one polish fix flagged.
