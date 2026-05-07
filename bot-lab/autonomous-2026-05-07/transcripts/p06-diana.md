# Persona 06: Diana (out-of-area — Anderson SC)

Final state: DISQUALIFIED_OUT_OF_AREA
Total turns: 8
Conversation duration (sim): ~7 minutes
Expected terminal: DISQUALIFIED_OUT_OF_AREA (testing live in-conversation OOA detection per bot-engine v10.1.37 + state-machine v10.1.9)
Actual terminal: DISQUALIFIED_OUT_OF_AREA — PASS

Audit hits:
- Bot did NOT promise service before address was captured. Throughout T0–T5 Ashley's language stayed neutral ("for the quote", "Key will look it over") — no "we'll get this set up" or "we'll be out there".
- Diana's first city volunteer ("Easley") at T2 did NOT trigger anything: it appeared inside conversational text, not in an address-shaped string. Engine OOA scan only runs against `preExtracted.address` (street-shaped). Correctly inert.
- At T6, full address "1404 N Main Street, Anderson SC 29621" was extracted via regex. addrLower included "anderson" → bot-engine `oosaCities` match → `detectedOutOfArea=true` → transition forced to DISQUALIFIED_OUT_OF_AREA, overriding the SM's would-be next state (RECAP).
- DQ message: pulled state-machine fallback for DISQUALIFIED_OUT_OF_AREA. Said "outside our normal service area" without naming Anderson. Mentioned Greenville/Spartanburg/Pickens. Single brief apology ("Sorry we cannot help with this one"). No grovel-spiral. Premium tone preserved.
- No em-dashes. No weekday names. No price leaks. No first-person "I'm Key" claims. Length 152 chars (under 280).
- Diana's conversational mention of Easley was NOT used to falsely qualify her — bot did not say "great, Pickens County" because no address-shaped string had been captured yet. Correct.

Broke at: n/a

## Transcript

[T0] BOT(GREETING, variant A): Hi Diana, I'm Ashley, the automated assistant at Backup Power Pro. I'm helping our electrician Key gather a few details for the home connection quote for your generator. Got a couple of minutes to walk through them?

[T1] CUST: yes that works

[T1] CLS: state=GREETING; label=affirmative; confidence=0.95; inferred_customer_style=default
[T1] SM: GREETING -> AWAIT_240V; sticky_style=default

[T1] BOT(AWAIT_240V): Perfect. Just confirming the generator has a 240V outlet on it, either the 4-prong twist-lock or the 50-amp. A pic of the generator's outlet works too if easier.

[T2] CUST: yeah it's a 50 amp 240. we drove over to easley last weekend to pick it up actually

[T2] CLS: state=AWAIT_240V; label=outlet_50a; confidence=0.93; extracted_value="50A"; volunteered: chitchat_excerpt="drove over to easley to pick it up"; inferred_customer_style=default
[T2] SM: AWAIT_240V -> AWAIT_PANEL_PHOTO (outlet_50a)
[T2] ENGINE: NO address regex match in customer message (no street + city + state shape). preExtracted.address=null. OOA scan SKIPPED. "easley" mention is conversational, ignored. Correct behavior — engine does not infer service-area from chitchat.

[T2] BOT(AWAIT_PANEL_PHOTO): 50 amp, most common whole-home setup. To put the quote together, Key will also need a picture of your main electrical panel and breakers. No rush, whenever you get the chance.

[T3] CUST: [sends photo of panel, door open, breakers clearly visible, main breaker labeled 200A]

[T3] PHOTO_CLS: subject=panel_main_open; primary_recommendation=accept; main_breaker_visible=true; subject_confidence=0.94
[T3] CLS: label=photo_received; confidence=0.99
[T3] SM: AWAIT_PANEL_PHOTO -> AWAIT_RUN

[T3] BOT(AWAIT_RUN): Got it, looks clean. Most main panels around here are mounted in the garage on an exterior wall (a wall that backs up to the outside of the house, where you could mount something on the other side). Is that your setup, or somewhere else?

[T4] CUST: yes garage exterior wall

[T4] CLS: state=AWAIT_RUN; label=panel_garage_exterior; confidence=0.94; inferred_customer_style=default
[T4] SM: AWAIT_RUN -> AWAIT_INLET_LOCATION

[T4] BOT(AWAIT_INLET_LOCATION): Perfect, that's the ideal setup. Where would you want the inlet box mounted on the outside? Standard install puts it right behind your panel with a 20ft cord. Or if you'd want it elsewhere, roughly how far from the panel?

[T5] CUST: right behind the panel is fine, generator sits about 25 feet away on a pad

[T5] CLS: state=AWAIT_INLET_LOCATION; label=inlet_default; confidence=0.92; volunteered: run_feet=25; inferred_customer_style=default
[T5] SM: AWAIT_INLET_LOCATION -> AWAIT_EMAIL

[T5] BOT(AWAIT_EMAIL): 25 feet, clean run. To complete the quote could I get your last name, email, and address?

[T6] CUST: diana raines, diana.r@gmail.com, 1404 n main street anderson sc 29621

[T6] CLS: state=AWAIT_EMAIL; label=email_provided; confidence=0.97; extracted_value="diana.r@gmail.com"; email_typo_suspected=false; volunteered: address="1404 N Main Street, Anderson SC 29621", last_name="Raines"; inferred_customer_style=default
[T6] ENGINE: preExtracted.address="1404 N Main Street, Anderson SC 29621". addrLower includes "anderson". inAreaCities match=false. oosaCities match=true (anderson). detectedOutOfArea=TRUE.
[T6] SM (pre-override): AWAIT_EMAIL -> RECAP (would have been, since email+address present)
[T6] ENGINE OVERRIDE (v10.1.37): detectedOutOfArea=true → forces transitionResult.next = DISQUALIFIED_OUT_OF_AREA. onEnter: { out_of_area: true }. Conversation marked terminal.

[T6] BOT(DISQUALIFIED_OUT_OF_AREA, fallback): Looks like you are a little outside our normal service area. We cover Greenville, Spartanburg, and Pickens counties. Sorry we cannot help with this one.

[T7] CUST: oh ok no worries. thanks for letting me know

[T7] CLS: state=DISQUALIFIED_OUT_OF_AREA; terminal — no further outbound. Conversation ended.

## Verification of test goals

- Out-of-area detection: PASS — fired exactly when address was captured, not before.
- Premium positioning preserved: PASS — DQ message says "outside our normal service area" without naming Anderson by name. Lists service area positively (the three counties we DO serve), not negatively.
- No over-promising before discovery: PASS — Ashley used neutral framing throughout T0–T5 ("for the quote", "Key will need", "Key will also need"). Never said "we'll get this set up", "we'll be out there", "looking forward to having you", or any phrase that promises service.
- Apology tone: PASS — single brief "Sorry we cannot help with this one" at the end. No grovel, no "we are SO sorry", no "thank you for your interest". Premium contractor energy: kind but not subordinate.
- Easley red herring: PASS — Diana volunteered "easley" conversationally at T2; bot did not falsely use it as a service-area marker. Engine correctly only scans address-shaped strings.

## Reviewer notes

The live state-machine + bot-engine path produces the correct DQ in 1 turn after address capture. Two layers caught it:
1. bot-engine `oosaCities` regex (line 379–388 of bot-engine/index.ts) flags `anderson` substring in the captured address.
2. State-machine `out_of_area_address` universal escape (line 1091) provides the proper terminal target.

If for some reason the engine-side scan missed it (e.g., misspelling like "andersen"), the SM-side label `out_of_area_address` would not be emitted by the classifier (it's orchestrator-emitted), so the engine regex is currently the SOLE detection mechanism mid-conversation. Worth noting: any city in the OOA list that's missing from `oosaCities` (e.g., "belton", "honea path", "williamston", "iva", "pendleton" — all Anderson County per sc-jurisdictions.json) would slip through. Recommend syncing `oosaCities` in bot-engine/index.ts with `out_of_area` cities in sc-jurisdictions.json. Filed as a follow-up consideration.
