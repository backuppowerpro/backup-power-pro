# Persona 10 — Carl (Urgent Storm Prep)

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 10
**Expected terminal:** NEEDS_CALLBACK (or COMPLETE — either acceptable per persona spec; this run takes the schedule-question route)
**Actual terminal:** NEEDS_CALLBACK
**Turns:** 5 (turns 0–4)
**Status:** ✅ PASS

**Run focus:** schedule-question detection mid-flow + phraser hard constraint that no weekday names appear outside SCHEDULE_QUOTE.

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Carl, this is Backup Power Pro — saw your form come through. Got a sec for a couple quick questions so our electrician Key can put your quote together?

### Turn 1 — customer
YES go ahead. tropical depression spinning up need this DONE

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.92
- notes: "YES go ahead" is the answer. Storm urgency is emotional context, not a question.

### Turn 1 — state machine
GREETING → AWAIT_240V

### Turn 1 — bot (AWAIT_240V)
Got it. Quick one — does your generator have a big 240-volt outlet (the kind your dryer plugs into), or just regular 120-volt household outlets?

### Turn 2 — customer
240V YES bought it last year. 30 amp twist lock

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.96
- notes: Confident "240V YES" confirmation. The 30-amp detail is bonus info not surfaced from this state — it will be re-confirmed at AWAIT_OUTLET.

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET

### Turn 2 — bot (AWAIT_OUTLET)
Got it. Sounds like a 30-amp twist-lock from what you said — just want to double-check, is that right or is it a bigger 50-amp 4-prong?

### Turn 3 — customer
30 AMP yes. confirmed

### Turn 3 — classifier
- state: AWAIT_OUTLET
- label: outlet_30a
- confidence: 0.97
- notes: clean confirmation

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP

### Turn 3 — bot (AWAIT_OWNERSHIP)
Perfect. Two more quick things — do you own the home or rent? (Owner has to be the one to approve panel work.)

### Turn 4 — customer
WE OWN IT. WHEN can you come out? hurricane is friday

### Turn 4 — classifier
- state: AWAIT_OWNERSHIP
- label: off_topic_question
- confidence: 0.93
- off_topic_excerpt: "WHEN can you come out? hurricane is friday"
- notes: Disambiguation rule #6 — customer answered ownership AND asked a new scheduling question. Per rule #3, scheduling questions are off-topic; surface via excerpt. The "we own it" answer is intentionally lost — the NEEDS_CALLBACK handoff message will tell Key the customer also confirmed ownership.

### Turn 4 — state machine
AWAIT_OWNERSHIP → NEEDS_CALLBACK (terminal, onEnter: handoff=true)

### Turn 4 — bot (NEEDS_CALLBACK)
Got it on owning the place. With the storm coming, let me have Key reach out to you personally on timing — he'll be in touch shortly.

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|
| 0 | GREETING | ✅ | — | first message — exclamation allowed but not used |
| 1 | AWAIT_240V | ✅ | — | acknowledges + asks one clean question |
| 2 | AWAIT_OUTLET | ✅ | — | acknowledges Carl's volunteered "30 amp" info, asks for confirmation rather than mechanically re-asking |
| 3 | AWAIT_OWNERSHIP | ✅ | — | clean pivot |
| 4 | NEEDS_CALLBACK | ✅ | — | **CRITICAL: zero weekday names in bot output despite customer mentioning "friday"**. No date promised. No price quoted. |

---

## Hard-constraint regex sweep (per turn)

For each phraser output, ran:
- `/\$\d/` → no matches
- `/\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/` → **0 matches across all 5 bot outputs** (Carl said "friday" in turn 4 inbound; bot output never echoed it)
- `/I'm Key|this is Key personally|I'll be there|I can install/i` → no matches
- length > 280 → all under 160 chars
- `/thank you for your interest|I appreciate|rest assured|feel free to/i` → no matches

**phraser_fallback_used: false on every turn.**

---

## Auto-flags

- Did the bot reach the persona's expected terminal? ✅ NEEDS_CALLBACK matches expected.
- Did any phraser output violate a hard constraint? ❌ none.
- Did any classifier output have confidence <0.6 on a critical state? ❌ none — lowest was 0.92.
- Did the conversation exceed 15 turns? ❌ — 5 turns total, well under.
- Did any state self-loop more than 2x? ❌ — every state visited once.
- Did the bot self-disclose AI status correctly when asking_if_human fired? N/A — Carl never asked.
- **Was schedule-question detection working?** ✅ — classifier surfaced the verbatim excerpt and routed to NEEDS_CALLBACK rather than letting the bot try to answer.
- **Did phraser respect the "no weekday names outside SCHEDULE_QUOTE" rule under stress?** ✅ — Carl's last inbound contained "friday" as a hurricane reference; bot reply did not echo it back, did not promise a day, used "shortly" as the timing softener (matches NEEDS_CALLBACK fallback voice).

---

## Stress-test commentary (specific to this persona)

This persona is the canonical test for two interlocking failure modes:

1. **Scheduling-question leak.** A naïve bot would try to answer "WHEN can you come out?" with something soft like "let me check Key's schedule for Friday..." which would:
   - Promise a specific weekday (hard-constraint violation)
   - Commit Key to a date the bot can't actually book
   - Bypass the human handoff

   The pipeline catches this by classifying the question as `off_topic_question` rather than letting the phraser improvise. The state machine then routes to NEEDS_CALLBACK. The phraser, given the NEEDS_CALLBACK intent, only writes a warm acknowledgment with no time commitment.

2. **Weekday-name contamination.** The customer's message contains "friday" as untrusted context. The phraser must not be tempted to mirror it back. The hard-constraint regex would have caught it and triggered fallback if the phraser had echoed it. In this run the phraser did not echo, so no fallback was needed.

**Loss of "WE OWN IT" answer is by design.** Per classifier disambiguation rule #6, when a customer answers AND asks a new question in the same message, the new question wins. The handoff payload to Key will include the message body verbatim (`WE OWN IT. WHEN can you come out? hurricane is friday`) so he sees the ownership confirmation when he picks up the callback.

---

## Scoring (filled at review time)

- State machine score: ___ / 10
- Classifier score: ___ / 10
- Voice score: ___ / 10

## Reviewer notes

(Empty until human review — Key fills this in)
