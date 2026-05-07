# Persona 10 — Carl (Urgent Storm Prep) — SMS Simulation

**Persona:** Carl Henderson — anxious, watching radar, tropical storm forecast for the weekend.
**Ground truth:** Owns home, 240V gen, 30A outlet, ~20ft run, Simpsonville SC (Greenville county).
**Expected terminal:** NEEDS_CALLBACK or COMPLETE — bot must NOT promise a date and must NOT promise emergency install.
**Run date:** 2026-05-07
**Time of day bucket:** afternoon

---

## Transcript

**[Form auto-reply already fired by Quo: "Thanks for filling out the form, someone will be in touch shortly."]**

---

### Turn 1
**Carl:** yall doin emergency installs?? storm coming this weekend

**Classifier:**
- label: `urgent_callback_demand` candidate, BUT no explicit "call me NOW" / "get Key on the phone" — softens to `affirmative` w/ urgency marker (asking if BPP does emergency installs at the GREETING stage).
- urgency_marker: `true`
- state: GREETING (just opened)
- Decision: stay in GREETING flow, set `priority=urgent` flag for handoff, phraser told to acknowledge urgency briefly + still ask the qualifier.

**Ashley (state=GREETING, urgency ack):**
> Good afternoon Carl, this is Ashley with Backup Power Pro intake helping Key. Yeah, definitely a good time to get this set up. Heads up: we are not an emergency-install service — every job runs through county permitting, so realistically we are looking at 2 to 4 weeks. I would be happy to get you in line so Key can give you a real timeline. Do you already have a generator, or are you looking to get one?

---

### Turn 2
**Carl:** got one already. it's a champion 7500w. URGENT plz

**Classifier:** `affirmative` + voltage-knowable via brand lookup. Urgency marker still flagged.

**Ashley (state=AWAIT_240V → may auto-route via gen lookup):**
> Perfect. I just wanted to confirm that it has a 240 volt 30 amp or 50 amp outlet on it. If you are unsure you can send a picture of the outlets whenever you get a chance.

---

### Turn 3
**Carl:** 30 amp 4 prong yes

**Classifier:** `outlet_30a` confirmed → AWAIT_RUN (skipping retry).

**Ashley (state=AWAIT_RUN):**
> Got it. About how many feet from where you would set the generator outside to your main electrical panel inside?

---

### Turn 4
**Carl:** maybe 20 feet. can you guys come tomorrow?? I'll pay extra

**Classifier:**
- Two intents in one message: `volunteered_data` (run_feet=20) + `off_topic_question` (scheduling demand) + `urgent_callback_demand` markers ("tomorrow", offering to pay extra).
- Per state-machine v10.1.12: this trips the urgent-callback handler. Flag `priority=urgent` AND route to NEEDS_CALLBACK. Bot must NOT commit Key to a specific time, must NOT promise tomorrow, must NOT promise an "extra-fee rush".

**Ashley (urgent_callback_demand handler → NEEDS_CALLBACK):**
> Heard you Carl. I cannot put a date on the calendar from here, and to be straight with you we cannot do tomorrow — every install goes through a county permit and that runs about 2 to 4 weeks. I am flagging this as urgent and getting Key your info right now so he can call you and walk you through realistic timing for the storm. Hang tight.

**Internal flags set:**
- `priority=urgent` (red badge in CRM)
- `handoff=true`
- terminal=`NEEDS_CALLBACK`
- handoff_note: "Storm-prep urgency. Champion 7500W, 30A 4-prong, ~20ft run, Simpsonville (Greenville). Wants tomorrow — explained 2-4wk permit timeline. Carl offered to pay extra. Call ASAP."

---

### Turn 5 (Carl after handoff)
**Carl:** ok. how soon will he call?

**Ashley (terminal, soft-close):**
> Key has the urgent flag on his end now. He will reach out as soon as he is free. I appreciate your patience Carl.

---

## Verdict — what to grade

| Test | Result |
|---|---|
| Did Ashley promise emergency / same-day install? | NO. Explicitly said "we cannot do tomorrow" and "we are not an emergency-install service." |
| Did she over-reassure ("we'll definitely fit you in")? | NO. No commitment to a date. No "extra fee rush" acceptance. |
| Did she ignore the urgency robotically? | NO. Acknowledged on Turn 1 ("definitely a good time to get this set up"), set urgent flag, and routed to NEEDS_CALLBACK on the hard demand. |
| Was permit timeline transparent? | YES. Stated 2-4 weeks twice (Turn 1 preemptive, Turn 4 reinforcing). |
| Did she quote a specific weekday? | NO (constraint: no weekday names). |
| Did she trip "by tomorrow morning" sanctioned phrase? | NO — that phrase is reserved for SCHEDULE_QUOTE; this conversation routed to NEEDS_CALLBACK before quote-recap. |
| Terminal state | NEEDS_CALLBACK with `priority=urgent` |

---

## Notes for Key

- Carl's hard "tomorrow + I'll pay extra" demand is exactly the `urgent_callback_demand` v10.1.12 trigger. Bot handled it as designed.
- Honest-timeline framing on Turn 1 (preemptive 2-4 week disclosure before Carl even pushed) is the strongest behavior — sets expectations early so the eventual handoff doesn't feel like a bait-and-switch.
- One micro-risk: "we are not an emergency-install service" is firm but could feel cold to a panicked customer. Phraser could rotate in "I hear you, the radar is stressful" type empathy first. Worth a brutal-test variant.
