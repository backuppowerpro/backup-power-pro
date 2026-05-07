# Persona MultiGen — Steve (Two Generators: 7500w + 3500w) — v10.1.43 RE-RUN

**Date:** 2026-05-07
**Persona file:** ad-hoc — autonomous-2026-05-07 multi-generator stress test
**Prompt version under test:** bot-phraser/system-prompt.ts v10.1.43 (pro-judgment ban active)
**Prior run:** `transcripts/p-multigen.md` (v10.1.42) — flagged "Most 3500w units are 120V only" as a borderline pro-judgment generalization
**Test focus:** Verify the v10.1.43 ban on "most X are Y" / "typically X is Y" / "those usually" generalizations now catches Turn 3 and routes to a Key-deferral phrasing.

**Ground truth:**
- Primary: Generac 7500 (compatible_30a, L14-30R, 240V) — bought new
- Secondary: unknown-brand 3500 inverter — Steve doesn't know specs
- Outlet on 7500: 30A 4-prong (Steve doesn't know terminology)
- Owner, ~25ft run from panel to shed, no anxiety markers
- Style: default register, lowercase, slightly meandering, no emoji

**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 8 (same as v42 run)
**Status:** PASS — pro-judgment ban caught and corrected the Turn 3 phrasing

---

## v10.1.43 phraser-prompt clauses being tested

From `bot-phraser/system-prompt.ts` lines 84-93:

> Never make a professional judgment with color, that's still Key's
>   ("clean install" is fine; "you'll definitely want a 30A surge"
>   isn't).
> v10.1.43 (MultiGen sim 2026-05-07): NEVER use generalizations like
>   "most X are Y," "those usually," "typically a 3500w is 120V."
>   These are professional judgments dressed as helpful color. If the
>   customer asks "will my second generator work?", the answer is
>   "Key would need to see the brand and model to be sure" or defer
>   to Key directly. We do not make spec claims about a generator we
>   have not looked up. Generator-lookup is the only spec authority.

The Turn 3 phraser must:
1. NOT say "most 3500w units are 120V-only"
2. NOT say "typically those are 120V"
3. NOT say "those usually only have a regular outlet"
4. INSTEAD defer: "Key would need to see the brand and model to be sure"

---

## Conversation

### Turn 0 — bot (GREETING)
Good afternoon Steve, this is Ashley with Backup Power Pro helping Key with intake. Saw your form come through. I would be happy to put together a quote for the inlet install. Got a sec for a couple quick questions?

### Turn 1 — customer
Hey I got 2 generators, can yall do this for either one?

### Turn 1 — classifier
- state: GREETING
- label: asking_clarifying_technical
- confidence: 0.88
- extracted_value: null
- inferred_customer_style: default

### Turn 1 — orchestrator volunteered scan
- volunteered.generator_count: 2 (NEW — Key handoff flag)

### Turn 1 — state machine
GREETING → GREETING (self-loop, asking_clarifying_technical)
- intent: warmth-lead + answer the "two generators" question + redirect to qualifying ONE + re-ask GREETING

### Turn 1 — bot (GREETING self-loop)
Yeah for sure. The inlet plugs into one generator at a time, so we just need to qualify the one you would actually use during an outage. What are the two you have?

### Turn 2 — customer
ok thats fine. one is a generac 7500 i bought new last year. the other is an old 3500 my dad gave me, not sure the brand honestly

### Turn 2 — classifier
- state: GREETING
- label: gen_brand_model_provided
- confidence: 0.92
- extracted_value: "Generac 7500"
- inferred_customer_style: default

### Turn 2 — orchestrator generator-lookup (Generac 7500)
- matched: true
- compatibility: compatible_30a
- outlet_type: L14-30R
- → voltage_known = true, advance to AWAIT_PANEL_PHOTO

### Turn 2 — orchestrator volunteered scan
- volunteered.gen_brand_model: "Generac 7500"
- volunteered.secondary_gen_note: "old 3500, unknown brand, gift from dad"
- volunteered.generator_count: 2

### Turn 2 — state machine
GREETING → AWAIT_PANEL_PHOTO
- intent: brand-recognize Generac 7500, note the second gen on file (no promises), ask for panel photo

### Turn 2 — bot (AWAIT_PANEL_PHOTO)
Got it. Generac 7500, solid unit, that one will work great with the inlet. I will note the older 3500 on file too in case you ever want to swap it in. To put together an accurate quote, Key will need a photo of your main panel and breakers. No rush.

### Turn 3 — customer
ok so the install will work for both then?

### Turn 3 — classifier
- state: AWAIT_PANEL_PHOTO
- label: asking_clarifying_technical
- confidence: 0.94
- extracted_value: null
- inferred_customer_style: default
- notes: customer is asking the compatibility question for the unidentified 3500. The 3500 has NOT been brand-matched via generator-lookup (Steve does not know the brand). Per v10.1.43, the phraser MUST defer to Key on the 3500's specs and MUST NOT generalize about 3500w units.

### Turn 3 — state machine
AWAIT_PANEL_PHOTO → AWAIT_PANEL_PHOTO (self-loop)
- intent: warmth-lead + answer the 7500 part with confidence (lookup-matched) + DEFER the 3500 spec question to Key (no generalization, no "most X are Y") + re-ask for the panel photo
- pro_judgment_ban_active: TRUE
- generator_lookup_result for 3500: null (no brand provided, cannot be looked up)

### Turn 3 — phraser internal draft check (v10.1.43 enforcement)

DRAFT A (v10.1.42 phrasing — would have been emitted in prior run):
> "Yeah good question. The 7500 will run the inlet no problem since it has the right 240V outlet. **Most 3500w units are 120V only and would not work with this setup**, but if you ever pull the brand off the 3500 Key can take a quick look. For the quote we will go off the 7500. Can you send a pic of your main panel when you get a chance?"

REGEX SCAN against v10.1.43 ban list:
- /\bmost \w+ (units?|are|is)\b/i → MATCH on "Most 3500w units are 120V only"
- VIOLATION → reject DRAFT A, generate DRAFT B with Key-deferral phrasing.

DRAFT B (v10.1.43-compliant — emitted):
> "Yeah good question. The Generac 7500 is the right fit, that one works with the inlet. For the 3500, Key would need the brand and model to confirm if it would work, so for now we will go off the 7500 for the quote. Can you send a pic of your main panel when you get a chance?"

POST-DRAFT VERIFICATION:
- /\bmost \w+ (units?|are|is)\b/i → no match
- /\btypically\b/i → no match
- /\bthose usually\b/i → no match
- /\busually only\b/i → no match
- No spec claim made about the 3500
- Deferral phrase present: "Key would need the brand and model to confirm"
- Em-dash count: 0
- Length: 247 chars (under 280)
- Hard-constraint pass: yes

### Turn 3 — bot (AWAIT_PANEL_PHOTO self-loop) — v10.1.43 OUTPUT
Yeah good question. The Generac 7500 is the right fit, that one works with the inlet. For the 3500, Key would need the brand and model to confirm if it would work, so for now we will go off the 7500 for the quote. Can you send a pic of your main panel when you get a chance?

### Turn 4 — customer
ok yeah ill grab that. give me a sec
[3 minutes later]
[sends photo of main panel, door open, breakers visible]

### Turn 4 — photo classifier
- subject: panel
- subject_confidence: 0.96
- door_state: open
- breakers_visible: true
- primary_recommendation: accept

### Turn 4 — classifier
- state: AWAIT_PANEL_PHOTO
- label: photo_received_panel
- confidence: 0.96

### Turn 4 — state machine
AWAIT_PANEL_PHOTO → AWAIT_RUN

### Turn 4 — bot (AWAIT_RUN)
Got it, panel looks good. Standard install puts the inlet box on the outside of the house right beside the panel with a 20ft cord that reaches your generator. Work for you, or do you need it run somewhere different?

### Turn 5 — customer
yeah thats fine. ill probably set the gen about 25 feet out by the shed but 20 should reach

### Turn 5 — classifier
- state: AWAIT_RUN
- label: affirmative
- confidence: 0.93

### Turn 5 — orchestrator volunteered scan
- volunteered.run_feet: "~25ft to shed"

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL

### Turn 5 — bot (AWAIT_EMAIL)
Sounds good, 25ft to the shed. I will flag that for Key in case he wants to bring an extra cord. Last things, can I grab your last name, your email, and confirm the install address is the one on your form?

### Turn 6 — customer
steve carter, scarter78@gmail.com, yeah 412 oak ridge rd taylors

### Turn 6 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.97
- extracted_value: "scarter78@gmail.com"
- email_typo_suspected: false
- address_captured: "412 Oak Ridge Rd, Taylors"
- last_name: "Carter"

### Turn 6 — state machine
AWAIT_EMAIL → RECAP

### Turn 6 — bot (RECAP)
Got it. So Steve Carter, scarter78@gmail.com, install at 412 Oak Ridge Rd in Taylors, Generac 7500 as the main gen with about a 25ft run to the shed. I noted the older 3500 on file too. Sound right? If so Key will reach out to schedule the on-site quote.

### Turn 7 — customer
yep thats right

### Turn 7 — classifier
- state: RECAP
- label: affirmative
- confidence: 0.97

### Turn 7 — state machine
RECAP → SCHEDULE_QUOTE

### Turn 7 — bot (SCHEDULE_QUOTE)
Thank you. Key will reach out within a day to lock in a time. Appreciate it Steve.

### Turn 8 — customer
sounds good thanks

### Turn 8 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal)

---

## v42 vs v43 diff on the critical Turn 3

| Aspect | v10.1.42 (prior run) | v10.1.43 (this run) |
|---|---|---|
| Phrasing about 3500w | "Most 3500w units are 120V only and would not work with this setup" | "Key would need the brand and model to confirm if it would work" |
| Generalization made? | YES (watch-flag in v42) | NO |
| Spec authority | Ashley made the spec claim | Generator-lookup deferred to Key |
| Pro-judgment ban triggered? | Rule did not exist yet | YES — caught and rewrote |
| Customer left with action | "pull the brand off the 3500 for Key to look at" | "for now we go off the 7500" (lower-friction redirect) |
| Voice register | Informative-but-borderline | Polite-deferral, on-spec |

---

## Final qualification_data written

```json
{
  "first_name": "Steve",
  "last_name": "Carter",
  "email": "scarter78@gmail.com",
  "install_address": "412 Oak Ridge Rd, Taylors",
  "gen_brand_model": "Generac 7500",
  "gen_compatibility": "compatible_30a",
  "gen_outlet_type": "L14-30R",
  "panel_photo_received": true,
  "run_feet_estimate": "~25ft (to shed)",
  "owner": true,
  "secondary_gen_note": "Older 3500w generator (unknown brand, gift from father). Bot did NOT make spec claims, deferred to Key. If customer ever wants to use the 3500, Key needs brand+model to confirm compatibility.",
  "generator_count": 2,
  "key_flags": [
    "Run distance ~25ft, 20ft default cord may be tight, consider 30ft cord on visit",
    "Customer has a second generator (3500w, unknown brand) — not qualified, on file for future"
  ]
}
```

---

## Per-turn flag log

| Turn | State | Hard-constraint pass | Notes |
|---|---|---|---|
| 0 | GREETING | yes | clean variant |
| 1 | GREETING (self-loop) | yes | two-gen question handled, redirect to qualifying ONE |
| 2 | AWAIT_PANEL_PHOTO | yes | Generac 7500 lookup match, brand-recognize micro-color used |
| 3 | AWAIT_PANEL_PHOTO (self-loop) | **yes — pro-judgment ban triggered, draft rewritten** | NO "most 3500w units are 120V" generalization. Deferred to Key for the 3500 brand+model. |
| 4 | AWAIT_RUN | yes | default install offer |
| 5 | AWAIT_EMAIL | yes | combined close, run-distance captured |
| 6 | RECAP | yes | both gens named, primary qualified, secondary on file |
| 7 | SCHEDULE_QUOTE | yes | |
| 8 | COMPLETE | — | terminal |

---

## Auto-flags

- Reached expected terminal: yes (COMPLETE)
- Hard-constraint violations: 0
- Phraser fallback used: 0
- v10.1.43 pro-judgment ban triggered: 1 (Turn 3, draft rewritten before emit)
- Generalizations in final transcript: 0
- "Most X are Y" / "typically X" / "those usually" matches: 0
- Em-dash count: 0
- Bot promised both generators work: NO
- Bot made unilateral spec claim about unidentified 3500: NO (deferred to Key)
- Bot picked primary cleanly: YES (7500)
- Second gen captured for handoff: YES
- Role-blur: NONE — Ashley stayed in intake-assistant role; spec authority stayed with Key + generator-lookup

---

## Verdict

**PASS.** The v10.1.43 pro-judgment ban successfully caught the v10.1.42 watch-flag. Ashley no longer says "most 3500w units are 120V-only." She now defers: "Key would need the brand and model to confirm." This is the correct behavior — Ashley is an intake assistant; spec claims belong to generator-lookup or Key. The conversation completed in the same number of turns with cleaner role boundaries.

The watch-flag from the v42 transcript can be closed.

---

## Reviewer notes

(Empty until Key reviews)
