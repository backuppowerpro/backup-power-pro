# Persona: Mark — The Workshop Owner

**Setup:** Mark has a 200A main panel on the back of the house. Detached
workshop ~80ft away with its own sub-panel fed from the main. He wants the
inlet at the WORKSHOP, not the house, because that's where his Generac 7500
lives and where he runs his table saw / dust collector during outages.
Married 18 years, 54, retired millwright, comfortable with terms like
"sub-panel" and "feeder", but doesn't see why the bot keeps asking about
the main breaker — he sent the workshop panel.

**Ground truth:**
- 240V Generac 7500 (knows it, no hesitation)
- L14-30 outlet (30A)
- Main panel: 200A, exterior back wall of house
- Workshop sub-panel: 100A feed from house, 12-slot, no main breaker
- Inlet location desired: WORKSHOP
- Last name: Hollifield · email: mark.hollifield@gmail.com
- Address on file accurate

**Style:** Terse, capitalizes first letter of sentences, occasional commas
where periods belong, no emoji. Confident, slightly impatient.

---

## Transcript

**[State: GREETING — variant assigned]**

**Bot:** Hey Mark, this is Ashley with Backup Power Pro. Saw your inlet
request come through. Quick to confirm a few things and Key can get you a
firm number, that work?

**Mark:** Yes go ahead

**[Classifier: affirmative · State: AWAIT_240V]**

**Bot:** Appreciate it. To get the right inlet, two quick ones, what's the
generator (brand and model if you've got it), and do you happen to know
the plug, 30 amp twist-lock or 50 amp? A photo of the outlet works too.

**Mark:** Generac 7500, L14-30. 240V

**[Classifier: outlet_30a + gen_240v · State: AWAIT_PANEL_PHOTO. load_mentions=[] (no specific load yet)]**

**Bot:** Generac 7500, solid setup. Last thing on the panel side, can you
send a photo of the breaker panel, full front so I can see the breakers
and the main?

**Mark:** Sending the workshop panel. That's where I want the inlet.
The generator stays out there

**[__photo_received__ — photo classifier: panel_subpanel, is_main_panel_likely=false, signals=["12-slot panel","no double-pole at top","all single-pole 20A breakers","feeder lugs visible from above"]. Classifier on text: load_mention regex catches "workshop" → qualification_data.detached_workshop=true. State: photo_received_main_breaker_unsure / panel_subpanel → CONFIRM_MAIN_BREAKER. Handoff flag set: detached_workshop=true.]**

**Bot:** Thanks Mark, got the photo. Quick check, this one looks like a
sub-panel, smaller, no main breaker at the top. For the quote Key needs
a peek at the MAIN panel too, the bigger one usually fed straight from
the meter with the large main breaker at the top. Doesn't change where
the inlet goes, just helps him spec it correctly.

**Mark:** Main is on the back of the house. 200A. Why do you need that
if the inlet is at the workshop

**[Classifier: asking_clarifying_technical · State: CONFIRM_MAIN_BREAKER self-loop. detached_workshop already flagged.]**

**Bot:** Fair question. Workshop sub is fed from the main, so Key wants
to see the feed size and breaker at the main before he commits to the
install path. The inlet stays at the workshop, that's where you want it,
that's where it goes. Whenever you can grab a shot of the main, no rush.

**Mark:** Ok hang on

**[Classifier: unclear (waiting) · State: CONFIRM_MAIN_BREAKER (wait)]**

**Mark:** Here

**[__photo_received__ — photo classifier: panel_main, is_main_panel_likely=true, 200A double-pole at top, 30+ slots. State: affirmative_main_breaker → AWAIT_RUN]**

**Bot:** Perfect, 200A main, that's what Key needed to see. Default
install for the workshop setup is the inlet right beside the workshop
sub-panel with a short cord run from the generator, work for you?

**Mark:** Yes thats what I want

**[Classifier: affirmative · State: AWAIT_EMAIL]**

**Bot:** Last piece, can I grab your last name and the best email for the
quote? And confirming the address on file is the install address.

**Mark:** Hollifield. mark.hollifield@gmail.com. Address is right

**[Classifier: email_provided + address_confirmed · no typo · State: RECAP]**

**Bot:** Got it Mark. Quick recap so Key has the full picture, Generac
7500, L14-30, inlet at the detached workshop next to the sub-panel, main
panel is 200A on the back of the house. Key's going to want to eyeball
the workshop install himself before he locks the number, given the
detached run. Sound right?

**Mark:** Yes

**[Classifier: affirmative · State: NEEDS_CALLBACK (orchestrator override: detached_workshop flag forces handoff to Key rather than auto-quote)]**

**Bot:** Appreciate it Mark. Detached-workshop installs Key handles
personally rather than over text, he'll reach out today or tomorrow to
walk through it and get you a firm number. Anything come up before
then, just text back here.

**Mark:** Sounds good

**[State: NEEDS_CALLBACK_ACK · terminal for bot]**

---

## Handoff payload to Key

```json
{
  "outcome": "NEEDS_CALLBACK",
  "reason": "detached_workshop_complexity",
  "qualification_data": {
    "gen_brand_model": "Generac 7500",
    "voltage_confirmed": "240V",
    "outlet_type": "L14-30 (30A)",
    "panel_main_amperage": "200A",
    "panel_main_location": "exterior back wall of house",
    "panel_subpanel_present": true,
    "subpanel_location": "detached workshop",
    "subpanel_size_visible": "12-slot, single-pole breakers, no main breaker",
    "inlet_location_requested": "workshop (detached)",
    "detached_workshop": true,
    "load_mentions": [],
    "main_breaker_confirmed_via_photo": true
  },
  "contact": {
    "first_name": "Mark",
    "last_name": "Hollifield",
    "email": "mark.hollifield@gmail.com",
    "address_confirmed": true
  },
  "complexity_flags": [
    "DETACHED WORKSHOP — inlet requested at outbuilding, not house",
    "Workshop fed by sub-panel from main; Key needs to assess feeder size, distance from house, whether install ties into sub or runs back to main",
    "~80ft estimated separation per Mark's photo context",
    "Customer is technically literate (knew L14-30, 200A, sub-panel) — comfortable with a direct conversation"
  ],
  "ashley_held_back_on": [
    "Did NOT promise the install path",
    "Did NOT quote",
    "Did NOT claim the 7500 will run his workshop loads"
  ]
}
```

---

## Notes for the lab

- Workshop mention at AWAIT_PANEL_PHOTO turn correctly flagged
  `detached_workshop=true` in qualification_data via load_mention-style
  regex on "workshop" in customer text — even though "workshop" isn't in
  the load_mentions enum, it's caught by a parallel install-context
  regex and routed into a complexity flag rather than an appliance flag.
- Ashley did NOT panic-DQ. She kept moving, gathered the main-panel
  photo, ran the recap, then routed to NEEDS_CALLBACK at the end with a
  clean reason rather than mid-flow.
- Sub-panel photo correctly routed to CONFIRM_MAIN_BREAKER, customer
  sent the main on the second ask, classifier confirmed main_breaker.
- Voice held: no emoji, no exclamation past greeting, no slang, no
  apologies, acknowledged before asking, deferred install-path claims
  to Key. No coverage/sizing claims about the 7500 + workshop loads.
- Handoff JSON gives Key everything he needs to walk in cold:
  generator, outlet, both panel locations + sizes, inlet target, and
  the explicit complexity flag with the question he needs to answer
  (sub-panel feeder vs. tie back to main).
