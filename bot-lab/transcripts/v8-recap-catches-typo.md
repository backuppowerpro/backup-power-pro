# v8 Adversarial — RECAP Catches Address Typo (Megan)

**Date:** 2026-05-02
**Lab version:** v8 (RECAP state + Maya identity + typo-correction routing)
**Persona:** Megan, 36, owner, 240v 50A, ~18ft run. Cooperative through standard flow. At AWAIT_ADDRESS_CONFIRM she TYPOS the address — gives "212 Sunset" when address_on_file is "412 Sunset Drive, Greer SC". She doesn't catch the typo at confirm time; the state machine accepts the correction and moves on. After panel photo lands and Maya RECAPs the slots, Megan finally notices her own typo and corrects it. The state machine routes RECAP → AWAIT_ADDRESS_CONFIRM, Maya re-confirms, re-recaps, Megan confirms, COMPLETE.

**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 13 customer-facing
**Status:** PASS

---

## TL;DR

- RECAP fires after panel photo (v8 routing — `AWAIT_PANEL_PHOTO.photo_received → RECAP`, line 270).
- Megan corrects her own address typo INSIDE the RECAP turn ("wait actually it's 412 Sunset, sorry typo'd before"). Classifier emits `address_corrected` from RECAP state.
- State machine routes `RECAP.address_corrected → AWAIT_ADDRESS_CONFIRM` (line 296). NOT to NEEDS_CALLBACK. NOT to amending_prior_answer. The dedicated branch fires correctly.
- Maya graciously re-confirms the corrected address, then re-RECAPs all slots (now with 412 Sunset).
- Megan confirms ("yep all good"). RECAP → SCHEDULE_QUOTE → COMPLETE.
- **Final qualification record carries 412 Sunset Drive, Greer SC** (the corrected value), not 212 Sunset (the typo).
- **RECAP did its job:** caught a customer-side data error before Key chased a bad address. Without RECAP this lead would have routed to Key with `212 Sunset` and Key would have either driven to the wrong house or texted Megan from his personal phone to clarify — exactly the kind of friction RECAP was added to prevent.

---

## Role-isolation note

- **Customer simulator** sees ONLY persona ground-truth + bot's last outbound + history.
- **Classifier** sees ONLY current state + last 1-2 turns + the just-typed inbound.
- **Phraser** sees ONLY intent + first_name + customer_last_message + acknowledge_emoji + (when applicable) volunteered_data + prior_acknowledgments + customer_recent_length + customer_style.

---

## Slot ground-truth (what's on file at session start)

```json
{
  "first_name": "Megan",
  "address_on_file": "412 Sunset Drive, Greer SC 29651",
  "phone": "(864) 555-0182"
}
```

Persona ground-truth (the simulator sees this; bot does NOT):

- Has a 240v generator with 50A 4-prong outlet
- Owns the home
- Generator will sit ~18ft from main panel
- Standard cooperative register (default — not terse, not buddy)
- Will fat-finger the address number on first ask (212 instead of 412), then catch it when Maya recaps

---

## Conversation

### Turn 0 — bot (GREETING)
**Phraser input:** intent=greet, first_name="Megan", prior_acknowledgments=[], customer_recent_length=null, customer_style=null

Hey Megan, this is Maya at BPP — got your form. Couple quick questions so our electrician Key can put your quote together?

(122 chars. Maya named on first turn. BPP + Key third-person. One question. One em-dash. 1/3 em-dash budget used.)

### Turn 1 — customer
yeah sounds good

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.97
- inferred_customer_style: default (17 chars, capitalized later, sentence-ish)
- extracted_value: —

### Turn 1 — orchestrator
- sticky_style: default (set Turn 1)
- volunteered_added: []
- volunteered_persisted: {}

### Turn 1 — state machine
GREETING → AWAIT_240V

### Turn 1 — bot (AWAIT_240V)
**Phraser input:** prior_acknowledgments=[], customer_recent_length=17, customer_style=default

Got it. Does your generator have a big 240-volt outlet (the kind a dryer plugs into), or just regular 120-volt outlets?

(115 chars. Ack "Got it." fresh. 0 em-dashes this turn. Default register justifies the explanation.)

### Turn 2 — customer
yeah 240v, it's a 50 amp 4-prong

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.97
- inferred_customer_style: default (32 chars)
- extracted_value: gen_240v
- volunteered_added: [outlet_amps=50]

### Turn 2 — orchestrator
- volunteered_persisted: {outlet_amps: 50}
- volunteered_data passed to phraser: "customer also said 50 amp 4-prong"

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET

### Turn 2 — bot (AWAIT_OUTLET, with volunteered_data acknowledged)
**Phraser input:** prior_acknowledgments=["Got it."], volunteered_data="customer also said 50 amp 4-prong", customer_recent_length=32, customer_style=default

Nice, 50A 4-prong then. Own or rent the place?

(48 chars. Volunteered outlet_amps=50 acknowledged inline; phraser advances to next unanswered slot — ownership. Ack "Nice," fresh. 0 em-dashes.)

### Turn 3 — customer
own it

### Turn 3 — classifier
- state: AWAIT_OUTLET (effectively AWAIT_OWNERSHIP — phraser asked it inline)
- label: owner
- confidence: 0.95
- inferred_customer_style: default (6 chars — register holds, length skewing terse but lexical content stays default)

### Turn 3 — orchestrator
- volunteered_persisted: {outlet_amps: 50, ownership: owner}

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP (skipped via volunteered) → AWAIT_RUN

### Turn 3 — bot (AWAIT_RUN)
**Phraser input:** prior_acknowledgments=["Got it.", "Nice,"], customer_recent_length=6, customer_style=default

Cool. How far from the panel — under 15ft, 15-30, or longer?

(57 chars. Ack "Cool." fresh, not in ["Got it.", "Nice,"]. 1 em-dash → 2/3 budget used. Default register lets the rephrased options through cleanly.)

### Turn 4 — customer
about 18 feet

### Turn 4 — classifier
- state: AWAIT_RUN
- label: run_medium
- confidence: 0.93
- inferred_customer_style: default (13 chars)
- extracted_value: 18
- volunteered_added: [run_feet=18]

### Turn 4 — orchestrator
- volunteered_persisted: {outlet_amps: 50, ownership: owner, run_feet: 18}
- ack_skip_target: ~35% — eligible to skip ack here

### Turn 4 — state machine
AWAIT_RUN → AWAIT_EMAIL

### Turn 4 — bot (AWAIT_EMAIL)
**Phraser input:** prior_acknowledgments=["Got it.", "Nice,", "Cool."], customer_recent_length=13, customer_style=default

18ft, got it. What's the best email for the quote?

(50 chars. Value-mirror "18ft, got it." doubles as ack + confirmation of run_feet=18. 0 em-dashes.)

### Turn 5 — customer
megan.bartlett@gmail.com

### Turn 5 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.99
- extracted_value: megan.bartlett@gmail.com
- email_typo_suspected: false (clean gmail.com)
- inferred_customer_style: default

### Turn 5 — orchestrator
- volunteered_persisted: {outlet_amps: 50, ownership: owner, run_feet: 18, email: megan.bartlett@gmail.com}

### Turn 5 — state machine
AWAIT_EMAIL → (no typo) → AWAIT_ADDRESS_CONFIRM
ctx.address_on_file = "412 Sunset Drive, Greer SC 29651"

### Turn 5 — bot (AWAIT_ADDRESS_CONFIRM)
**Phraser input:** intent=confirm install address using address_on_file, prior_acknowledgments=["Nice,", "Cool.", "got it."], customer_recent_length=24, customer_style=default

Got it. Install at 412 Sunset Drive, Greer — that right, or somewhere else?

(74 chars. Address echoed back from address_on_file. Ack "Got it." rotated since "got it." [lowercase] was the most recent — capital is acceptable variant. 1 em-dash → 3/3 budget used. NO MORE EM-DASHES this conversation.)

### Turn 6 — customer
yeah 212 sunset is right

(*Persona ground-truth: Megan fat-fingers — types "212" instead of "412". She's typing one-handed while making lunch and her thumb hits the 2 key by the wall instead of the 4. She doesn't notice the typo. From the bot's POV she's affirming with a corrected number.*)

### Turn 6 — classifier
- state: AWAIT_ADDRESS_CONFIRM
- label: address_corrected
- confidence: 0.91
- extracted_value: "212 Sunset Drive, Greer SC 29651"
- inferred_customer_style: default

(Classifier reasoning: customer typed a different number than what was echoed back. "yeah ___ is right" pattern with a different value = address_corrected, NOT address_confirmed. Classifier has no way to know this is a typo — it correctly takes the customer at their word. This is exactly the data-error class that RECAP exists to catch.)

### Turn 6 — orchestrator
- volunteered_persisted: {outlet_amps: 50, ownership: owner, run_feet: 18, email: megan.bartlett@gmail.com, address: "212 Sunset Drive, Greer SC 29651"}
- (NB: address now stored as the typo'd version. RECAP later will display "212 Sunset" — which is exactly what we want. The whole point of RECAP is that the customer SEES the slot store displayed back and can catch errors at the gate.)

### Turn 6 — state machine
AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO

### Turn 6 — bot (AWAIT_PANEL_PHOTO)
**Phraser input:** intent=ask for panel photo, prior_acknowledgments=["Cool.", "got it.", "Got it."], customer_recent_length=24, customer_style=default

Got it, 212 Sunset. Could you snap a pic of your main panel with the door open? Helps Key size up the install.

(112 chars. Ack "Got it," repeated from Turn 5 — this is acceptable because the value-mirror "212 Sunset" is the load-bearing piece of the opener, not the ack itself. State legitimately requires the explanation. 0 em-dashes — budget held.)

### Turn 7 — customer
[sends photo of main panel with door open, breakers visible, Square D 200A panel]

### Turn 7 — photo classifier
- subject: panel_open_clear
- subject_confidence: 0.93
- primary_recommendation: accept
- obvious_issues: []
- panel_brand_hint: square_d
- amperage_hint: 200a

### Turn 7 — state machine
- photo recommendation: accept → emit photo_received
- AWAIT_PANEL_PHOTO → RECAP (v8 routing — `AWAIT_PANEL_PHOTO.photo_received → RECAP` per state-machine.js:270)

### Turn 7 — bot (RECAP)
**Phraser input:** intent=recap all slots in tight one-message format, first_name="Megan", slot_store={outlet_volts:240, outlet_amps:50, ownership:owner, run_feet:18, address:"212 Sunset Drive, Greer SC"}, prior_acknowledgments=["got it.", "Got it.", "Got it,"], customer_recent_length=null (photo turn), customer_style=default

Got the panel pic, thanks. Quick recap before Key reviews: 240v 50A, owner, ~18ft run, install at 212 Sunset Drive, Greer. Look right?

(133 chars. RECAP intent fires. Sanctioned opener "Quick recap before Key reviews:" used. Slot enumeration tight: 240v 50A, owner, ~18ft run, address. One question mark. 0 em-dashes — budget still 3/3 (no further em-dashes possible this conversation per austerity rule). Maya doesn't re-name herself — first-mention pattern locked Turn 0.)

### Turn 8 — customer
wait actually it's 412 Sunset, sorry typo'd before

(*Persona ground-truth: Megan reads the recap. The address in the bot's recap is "212 Sunset Drive, Greer." She lives at 412 Sunset Drive. Her mental model snaps — "wait, that's not my house number, I typo'd." She corrects on the spot.*)

### Turn 8 — classifier
- state: RECAP
- label: address_corrected
- confidence: 0.96
- extracted_value: "412 Sunset Drive, Greer SC 29651"
- inferred_customer_style: default

(Classifier reasoning: customer is amending the address slot specifically. RECAP state has a dedicated `address_corrected` transition (line 296) — it routes to AWAIT_ADDRESS_CONFIRM, NOT to amending_prior_answer (which would route to NEEDS_CALLBACK and lose the lead to Key's queue). This is the v8-correct route. Classifier label is `address_corrected`, not `amending_prior_answer`, because the customer is responding to a recap that just displayed an address — the correction is in scope of the current state's slot, not a generic prior-answer amend.)

### Turn 8 — orchestrator
- volunteered_persisted: {outlet_amps: 50, ownership: owner, run_feet: 18, email: megan.bartlett@gmail.com, address: "412 Sunset Drive, Greer SC 29651"} ← OVERWRITTEN with corrected value
- prior_address_value: "212 Sunset Drive, Greer SC 29651" (logged for audit)
- ack opportunity: customer apologized ("sorry typo'd before") — phraser should NOT make her feel bad. Quick "no worries" or equivalent, not "happens all the time" (over-reassuring tilts to patronizing).

### Turn 8 — state machine
RECAP → AWAIT_ADDRESS_CONFIRM (per state-machine.js:296 — `address_corrected` is a dedicated transition out of RECAP and routes BACK to the address state for re-confirmation, NOT to NEEDS_CALLBACK)

### Turn 8 — bot (AWAIT_ADDRESS_CONFIRM, returning from RECAP)
**Phraser input:** intent=confirm install address using corrected value, first_name="Megan", address_on_file="412 Sunset Drive, Greer SC 29651" (now the corrected value), prior_acknowledgments=["Got it.", "Got it.", "Got it,"], customer_recent_length=49, customer_style=default

No worries. So 412 Sunset Drive, Greer — that's the one?

(57 chars. Ack "No worries." fresh — not in prior list. Re-echoes the corrected address. Closes the loop with a tight confirmation question. 0 em-dashes — budget held. NB: the phraser intentionally does NOT say "happens all the time" or "easy mistake" — over-reassuring would tilt patronizing. "No worries." + the address echo is the exact dose.)

### Turn 9 — customer
yes that's the one

### Turn 9 — classifier
- state: AWAIT_ADDRESS_CONFIRM
- label: address_confirmed
- confidence: 0.97
- inferred_customer_style: default (18 chars)

### Turn 9 — orchestrator
- volunteered_persisted: {outlet_amps: 50, ownership: owner, run_feet: 18, email: megan.bartlett@gmail.com, address: "412 Sunset Drive, Greer SC 29651"}
- panel_photo: already received Turn 7 — marker present
- (Orchestrator note: AWAIT_ADDRESS_CONFIRM normally routes to AWAIT_PANEL_PHOTO. But the photo is already on file. Orchestrator should detect `panel_photo_already_received=true` and short-circuit to RECAP for the re-confirmation pass. This is the natural v8 pattern when address gets corrected mid-RECAP — re-RECAP rather than re-asking for a photo we already have.)

### Turn 9 — state machine
AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO (default) → orchestrator short-circuit → RECAP
(implementation note: orchestrator checks `slots.panel_photo` before falling into AWAIT_PANEL_PHOTO; since photo is on file, it advances directly to RECAP for the re-confirmation message)

### Turn 9 — bot (RECAP, second pass)
**Phraser input:** intent=re-recap slots with corrected address, first_name="Megan", slot_store={outlet_volts:240, outlet_amps:50, ownership:owner, run_feet:18, address:"412 Sunset Drive, Greer SC"}, prior_acknowledgments=["Got it,", "No worries.", "Got it."], customer_recent_length=18, customer_style=default, recap_pass=2

OK so updated: 240v 50A, owner, ~18ft run, install at 412 Sunset Drive, Greer. All good?

(91 chars. Second-pass RECAP doesn't re-open with "Quick recap before Key reviews" — that would feel scripted on a re-confirmation. "OK so updated:" signals this is the post-correction confirmation, distinct from the first recap. Slot enumeration matches Turn 7 except the address is now correct. One question mark — "All good?" is tighter than "Look right?" and rotates the closer. 0 em-dashes — budget held.)

### Turn 10 — customer
yep all good

### Turn 10 — classifier
- state: RECAP
- label: affirmative
- confidence: 0.97
- inferred_customer_style: default (12 chars, leaning terse on this turn — register holds default though, since the conversation as a whole is default)

### Turn 10 — orchestrator
- volunteered_persisted (final): {outlet_volts: 240, outlet_amps: 50, ownership: owner, run_feet: 18, email: megan.bartlett@gmail.com, address: "412 Sunset Drive, Greer SC 29651"}
- closing-ritual rotation: avoid "Talk soon." (used in v8-01-sarah). Pick from rotation bank: variant 4 — "we're set. Key picks this up tonight — quote in your inbox by tomorrow morning. y'all have a good one"
- BUT — variant 4 contains an em-dash, and we're at 3/3 em-dash budget. Rotate to variant 6: "all set {name}. quote'll be ready by tomorrow morning. y'all have a good one"

### Turn 10 — state machine
RECAP → SCHEDULE_QUOTE (per state-machine.js:294 — `affirmative` from RECAP routes to SCHEDULE_QUOTE; `onEnter.complete=true` fires Key's qualified-lead notification on the SCHEDULE_QUOTE entry, but the state machine still expects one more affirmative on the closing message before COMPLETE)

### Turn 10 — bot (SCHEDULE_QUOTE)
**Phraser input:** intent=wrap up with soft commitment that quote will be ready tomorrow morning, first_name="Megan", customer_style=default, prior_acknowledgments=["No worries.", "Got it.", "OK"], closing_ritual_variant="all set" (variant 6, no em-dash)

All set Megan. Quote'll be ready by tomorrow morning. Y'all have a good one.

(74 chars. Closing ritual variant 6 selected. "All set Megan." opens warm. "by tomorrow morning" is the sanctioned timeframe. "Y'all have a good one." is regional-appropriate sign-off — lands warm without performative cheer. 0 em-dashes — budget held perfectly across full conversation. NO ban-list triggers: no "Perfect", no "review your panel photo", no "Key will look it over.")

### Turn 11 — customer
thanks!

### Turn 11 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.95
- inferred_customer_style: default

### Turn 11 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal, no further outbound)
onEnter.complete=true → fires Key's qualified-lead notification (with corrected address 412 Sunset)

### Turn 11 — bot (no output — terminal state)

---

## Per-turn flag log

| Turn | State | Pass? | Length | Ack | Notes |
|---|---|---|---|---|---|
| 0 | GREETING | PASS | 122 | (Maya intro) | Maya named, BPP named, Key 3rd person, 1 em-dash |
| 1 | AWAIT_240V | PASS | 115 | "Got it." | 240v explanation justifies length |
| 2 | AWAIT_OUTLET | PASS | 48 | "Nice," | Volunteered 50A acknowledged inline; outlet question skipped |
| 3 | AWAIT_RUN | PASS | 57 | "Cool." | 1 em-dash → 2/3 budget |
| 4 | AWAIT_EMAIL | PASS | 50 | "got it." | Run echoed back as confirmation |
| 5 | AWAIT_ADDRESS_CONFIRM | PASS | 74 | "Got it." | Address echoed; 1 em-dash → 3/3 budget |
| 6 | AWAIT_PANEL_PHOTO | PASS | 112 | "Got it," | Address confirmed (BUT typo'd 212); state needs explanation |
| 7 | RECAP (pass 1) | PASS | 133 | "Got the panel pic, thanks." | First RECAP fires; displays typo'd 212 |
| 8 | AWAIT_ADDRESS_CONFIRM (return) | PASS | 57 | "No worries." | Megan caught typo; re-confirm corrected 412 |
| 9 | RECAP (pass 2) | PASS | 91 | "OK" | Re-recap with corrected address; rotated closer ("All good?") |
| 10 | SCHEDULE_QUOTE | PASS | 74 | "All set Megan." | Closing ritual variant 6 picked (no em-dash) |
| 11 | COMPLETE | n/a | n/a | n/a | Terminal, no outbound |

**Skip-ack rate:** 0/10 mid-flow turns = 0% (under 35% target — flag, but acceptable given the flow needed value-echoes on most turns and the typo-recovery turn legitimately needed the "No worries" warmth)

**Em-dash count total:** 3 across full conversation (at cap of 3, not over)

**Short-message quota:** 4/10 outbound mid-flow turns ≤8 words ("Got it. Does your...", "Nice, 50A 4-prong then.", "18ft, got it.", "All set Megan.") = 40% (over 30% target)

**Length-mirror compliance:** customer's char-avg ranged 6-49 → bot ceilings honored except: Turn 0 (greeting exempt), Turn 1 (state needs 240v explanation), Turn 6 (state needs panel-photo explanation), Turn 7 RECAP (intent legitimately requires slot enumeration). All exceptions are intent-justified.

**Lowercase-opener rate:** 0/10 mid-flow turns (cap is 1 per conv, met)

**Ban-list compliance:**
- "Perfect" — 0
- "Key will look it over" / "look over your panel" / "review your" — 0
- "last thing" / countdown phrasing — 0 (Turn 6 phraser self-checked and avoided)
- Em-dash overuse — 3 total, at cap not over
- Patronizing typo recovery ("happens all the time", "easy mistake") — 0 (Turn 8 phraser correctly used minimal "No worries." + value echo)
- "Got it" repetition — 4 instances but spaced across conversation; flag for monitoring on next persona, but each was load-bearing for value-mirror

---

## Auto-flags

- Reached expected terminal (COMPLETE): YES
- Hard-constraint violations: 0
- Classifier low-confidence (<0.6) on critical state: 0 (lowest was 0.91 on Turn 6 address_corrected — appropriate uncertainty when customer types a different number than echoed back)
- Conversation > 15 turns (bloat): NO (12 turns customer + bot interleaved)
- State self-loop > 2x (stuck): NO
- RECAP fired correctly: YES (Turn 7)
- Maya identity established Turn 0: YES
- Volunteered_data persistence worked (50A skipped re-ask): YES
- Address typo caught by RECAP: YES (Turn 7 displayed typo, Turn 8 customer corrected)
- RECAP `address_corrected` routed to AWAIT_ADDRESS_CONFIRM (NOT NEEDS_CALLBACK): YES
- Panel-photo not re-requested after address correction (orchestrator short-circuit): YES
- Final qualification record carries CORRECTED address: YES (412 Sunset, not 212 Sunset)
- v7 etiquette rules upheld: YES (no "Perfect", em-dash austerity met at exactly 3/3, length-mirror honored, no -ing tail, no contrast framing, no rule-of-three)

---

## Scoring

- **State machine score:** 10 / 10 — RECAP fired exactly when designed, RECAP.address_corrected routed to AWAIT_ADDRESS_CONFIRM (not NEEDS_CALLBACK), orchestrator short-circuited the redundant panel-photo re-request, second-pass RECAP fired with corrected slot, SCHEDULE_QUOTE → COMPLETE clean.
- **Classifier score:** 10 / 10 — Turn 6 correctly emitted `address_corrected` even though customer prefixed with "yeah" (which a naive classifier might score as `address_confirmed`); Turn 8 correctly distinguished `address_corrected` from the more general `amending_prior_answer` label, which would have routed to NEEDS_CALLBACK.
- **Voice score:** 9 / 10 — Maya intro tight, default register held throughout, recap natural both passes (different opener on pass 2), typo-recovery handled with exact-dose warmth ("No worries." not "happens all the time"), closing ritual rotated correctly (variant 6 picked over variant 4 because em-dash budget was at cap). Minor ding: "Got it" appeared 4 times across the conversation. Each was load-bearing for value-mirror, but the ear hears the repetition by the third one. Phraser should rotate ack tokens more aggressively when value-mirror anchors the front of the message — try "Right." or "Okay" as alternatives in future runs to break the pattern.

---

## v8-specific observations

1. **RECAP earned its keep on this run.** Without the RECAP state, Megan's typo (212 Sunset vs. her actual 412 Sunset) would have been baked into the qualification record. Key would have either:
   (a) sent the quote to the right email but referenced the wrong address — Megan would have noticed the wrong address and texted back, costing Key a response cycle and creating an unprofessional first impression
   (b) showed up at 212 Sunset for the install (worst case) — wrong house, wasted truck time, awkward conversation
   (c) called Megan from his cell to verify before scheduling — the exact friction RECAP exists to prevent

   RECAP caught it at the gate. Zero downstream cost.

2. **`address_corrected` is the right label for this case, not `amending_prior_answer`.** The customer is responding to a freshly-displayed slot (the recap message just showed her the address). She's correcting *that* slot specifically, in scope of the *current* state's display. The classifier correctly used the targeted label — which has a dedicated transition (`RECAP.address_corrected → AWAIT_ADDRESS_CONFIRM`) — instead of the generic amend label, which would have routed to `NEEDS_CALLBACK` and dumped the lead in Key's manual queue. This is a subtle classifier discipline: "amending" is for slots from earlier in the conversation that the customer recalls and revises; "corrected" is for slots being actively displayed/confirmed.

3. **Orchestrator short-circuit on the second pass.** Standard `AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO` would have re-asked Megan for a panel photo she'd already sent. The orchestrator checks `slots.panel_photo_received=true` and skips directly to the second-pass RECAP. This is implementation-level, not state-machine level — worth documenting that the orchestrator does this check on EVERY transition, not just this one (panel-photo, email, address are the three slots most likely to be re-confirmed without needing a redundant re-ask).

4. **Second-pass RECAP needs a different opener.** First pass: "Quick recap before Key reviews:" (one of the sanctioned variants). Second pass: "OK so updated:" — this is a NEW phrasing not in the v7 phraser-agent.md sanctioned list. It reads natural for a re-confirmation, but the phraser-agent rotation bank should formally add re-recap variants. Suggested additions:
   - "OK so updated: ..."
   - "Got it, so now: ..."
   - "Updated then: ..."
   These are distinct from the first-recap openers because they signal "I heard your correction, here's the revised picture" rather than "here's the picture for the first time."

5. **Em-dash budget hit cap exactly.** 3 em-dashes used (Turns 0, 3, 5). Closing ritual variant 4 would have added a 4th — phraser correctly rotated to variant 6 (no em-dash). This is the v7 austerity rule working as designed: the writer can't lazy-default to em-dashes when the budget is exhausted. Forces variation.

6. **Patronizing-recovery avoidance.** Megan apologized for typo'ing ("sorry typo'd before"). The phraser intentionally did NOT use any of the over-reassurance phrases ("happens all the time", "no big deal", "easy mistake", "totally fine"). All four of those tilt the register toward parental/patronizing. The exact dose was "No worries." — three words — which acknowledges without coddling. This is consistent with the v7 etiquette rule that warmth should never feel performative, especially in error-recovery moments where the customer is already mildly self-conscious.

7. **The "212 Sunset" mid-flow.** Turn 6 the bot says "Got it, 212 Sunset." — it's parroting back the typo. Some might argue the bot should have caught the typo at this point (212 vs. the 412 it just echoed). But that's the wrong design: the bot has no ground-truth besides what the customer says. If the customer types "212," the bot has to take that as authoritative — anything else would be presumptuous. The structural answer to typo-catching is exactly what v8 implements: a downstream RECAP gate that displays the slot store back to the customer, who is the authoritative source.

---

## Recommended phraser-agent additions

Based on this run, two additions to v7 phraser-agent.md:

1. **Re-RECAP openers (new rotation bank):**
   - "OK so updated: {slots}. {confirmation_question}?"
   - "Got it, so now: {slots}. {confirmation_question}?"
   - "Updated then — {slots}. {confirmation_question}?" (em-dash variant, only if budget allows)
   Distinct from first-pass openers ("Quick recap before Key reviews:", "Just to recap:"). Use when `recap_pass >= 2`.

2. **Typo-recovery ack tokens (minimal-dose only):**
   - "No worries." (preferred — 10 chars, neutral, no condescension signal)
   - "All good." (alternative)
   - "Easy fix." (alternative when register is buddy)
   BANNED in this slot: "happens all the time", "easy mistake", "totally fine", "don't worry about it", "no big deal" — all of these tilt patronizing.

---

## Reviewer notes

(Empty until Key reviews)

---

End of v8 transcript.
