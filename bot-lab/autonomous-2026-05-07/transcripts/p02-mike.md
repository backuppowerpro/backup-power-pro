# Persona 02 — Mike (Confused 120v Owner)

**Date:** 2026-05-07
**Persona file:** `bot-lab/agents/customer-personas.md` § Persona 02
**Expected terminal:** DISQUALIFIED_120V
**Actual terminal:** DISQUALIFIED_120V ✅

**Ground truth:**
- name: Mike
- owner: true
- gen_240v: **false** (small inverter generator for tailgating)
- service_area: Spartanburg
- emotional valence: calm, doesn't escalate, slightly fragmented texter

---

## Turn-by-turn

### Turn 0 — GREETING (bot opens)

**State (entry):** GREETING
**Bot → Customer:**
> Hey Mike, this is BPP intake. Key got your form about the inlet install. Mind if I run through a couple quick questions to get you a quote?

---

### Turn 1 — Customer first inbound

**Customer → Bot:**
> yeah ok

**Classifier (sees: customer's last message + state=GREETING):**
- label: `affirmative`
- confidence: 0.94
- volunteered_data: null

**State machine:** GREETING → AWAIT_240V

**Phraser (sees: classifier output + intent=ask_240v):**
> Cool. Quick one — is your generator 240 volt (the bigger 4-prong twist-lock plug on the side) or just the regular household 120 outlets?

*[note: em-dash present — flagged in critic notes below]*

---

### Turn 2 — Mike unsure

**Customer → Bot:**
> uhh i think so?

**Classifier:**
- label: `gen_unsure`
- confidence: 0.87
- reason: "i think so" with hedge marker, no specific outlet mentioned

**State machine:** AWAIT_240V → CLARIFY_240V

**Phraser (intent: ask for outlet photo with no-rush softener):**
> No worries. If it's easier, snap a quick pic of the outlet on the side of the generator and I can tell from there. No rush.

---

### Turn 3 — Mike clarifies verbally instead of photo

**Customer → Bot:**
> no it's just the regular plugs
> like the kind you plug a lamp into

**(orchestrator joins the burst — production debounce ~5s)**

**Classifier:**
- label: `gen_120v`
- confidence: 0.96
- reason: "regular plugs" + "kind you plug a lamp into" = 120V household receptacle

**State machine:** CLARIFY_240V → DISQUALIFIED_120V
**onEnter:** `dq_120v: true`, `allow_recommendation_followup: true`

**Phraser (intent: hedged soft DQ + future-install offer; no brand_model in ctx → second fallback path):**
> Ok. Looks like that one outputs 120 volts only, which won't power the inlet setup we install. If you upgrade to a 240V generator down the road we would be happy to help with the install then.

---

### Turn 4 — Mike accepts politely

**Customer → Bot:**
> ok no problem
> thanks for checking

**Classifier:**
- label: `affirmative`
- confidence: 0.91
- reason: acceptance, no question, conversation winding down

**State machine:** DISQUALIFIED_120V → DISQUALIFIED_120V (self-loop, parked)

**Phraser (intent: brief warm sign-off, no more outbound after this):**
> Sounds good Mike. Y'all have a good one.

---

### Terminal

- **State:** DISQUALIFIED_120V (parked, soft-terminal per v10.1.3)
- **24h re-engagement:** DOES NOT fire (DQ states excluded)
- **Customer feels:** door left open, not pushed
- **Total turns:** 4 (within 4-15 expected range)

---

## Critic notes

### Did Ashley DQ correctly?
**Yes.** State path matches expected exactly:
GREETING → AWAIT_240V (gen_unsure) → CLARIFY_240V → gen_120v → DISQUALIFIED_120V.
The CLARIFY_240V detour fired correctly — bot didn't immediately DQ on "i think so" without giving Mike a second chance.

### Was the rejection humane?
**Mostly yes.** Strengths:
- Hedged with "Looks like" rather than absolute statement (per v10.1.3)
- Explicit future-install door open ("we would be happy to help with the install then")
- No pushy "what's your budget" follow-up
- Short, no lecture, no over-apologizing
- Sign-off mirrors Mike's calm energy

### Things that would feel awful to a real person
1. **Em-dash in Turn 1** ("Quick one — is your...") — violates the v7 ZERO em-dash hard rule. This is a real production bug if it shipped. Should be: "Quick one. Is your generator..."
2. **"won't power the inlet setup we install"** in the DQ message is slightly clinical. Acceptable but a real Key would maybe say "won't work with what we install" — softer. Borderline OK.
3. The bot did NOT volunteer a generator recommendation, which is correct per v10.1.3 ("DO NOT proactively offer generator recommendations — wait for customer to ask"). If Mike had asked "what should I get?" the TIER 1 response would have fired with "at least 240V, around 5,000W minimum."

### Anti-patterns avoided
- No "I'm so sorry to hear that" performative empathy
- No "Have a great day!" banned closing
- No "unfortunately we can't help" cold language
- Did not ask for outlet amperage / ownership / panel photo after DQ (would have been jarring)

### Net
Mike walks away with: clear reason for DQ, knowledge of what to buy if upgrading, no shame, door open. That's the right outcome. One em-dash to fix and this conversation is production-clean.
