# Persona: The Expert (Mark — journeyman electrician, parts-only ask)

**Date:** 2026-05-07
**Persona:** Materials-only electrician customer
**Expected terminal:** NEEDS_CALLBACK (premium routing — Key decides)
**Actual terminal:** NEEDS_CALLBACK
**Turns:** 4
**Status:** PASS

**Ground truth (simulator-only):**
- Mark, claims journeyman electrician, owns 240V/50A generator
- Wants materials price only, will self-install
- Tests: out-of-scope routing, no credential combat, no apologies, no parts retailer referral, premium posture

---

## Conversation

### Turn 0 — bot (GREETING, variant A)
Hey Mark, this is Ashley at Backup Power Pro, helping our electrician Key with intake. Saw your form come through — got a sec for a couple quick questions so Key can put your quote together?

### Turn 1 — customer
look I'm a journeyman electrician myself. I don't need an install. just give me a price on the materials — inlet box, interlock kit, breaker, whatever you spec. I'll wire it myself

### Turn 1 — classifier
- state: GREETING
- label: out_of_scope_install
- confidence: 0.86
- extracted_value: "wants materials only, self-install, claims journeyman electrician"
- off_topic_excerpt: "I'm a journeyman electrician myself ... just give me a price on the materials ... I'll wire it myself"

### Turn 1 — state machine
GREETING → NEEDS_CALLBACK (out_of_scope_install)
- intent: courteous scope clarification, defer to Key, do NOT engage on credentials, do NOT recommend a parts retailer, premium posture

### Turn 1 — bot (NEEDS_CALLBACK)
Got it, Mark. Materials-only isn't our usual scope, we install the inlet and interlock as a package with the permit. That said, Key sometimes works it out with a licensed installer directly. I'll have him reach out so y'all can talk it through.

### Turn 2 — customer
how long does that take. I just need a number, not a sales call

### Turn 2 — classifier
- state: NEEDS_CALLBACK (terminal but customer continued)
- label: answered_with_impatience
- confidence: 0.81
- extracted_value: "wants timeline, not a sales call"

### Turn 2 — state machine
Stays NEEDS_CALLBACK (terminal). Bot may send one factual response, no further qualification.
- intent: brief, factual timing, no promise, no weekday names

### Turn 2 — bot
Key usually gets back same day. He'll have the spec list and can tell you straight if it's something he can quote materials on or not.

### Turn 3 — customer
fine. tell him it's a 50A 4-prong twist lock, ~25ft run, single phase 200A panel. should be a 10 minute conversation

### Turn 3 — classifier
- state: NEEDS_CALLBACK
- label: friendly_chitchat (volunteered context for handoff)
- confidence: 0.78
- extracted_value: "50A 4-prong, 25ft run, 200A single phase panel"

### Turn 3 — state machine
Stays NEEDS_CALLBACK. Volunteered specs persist into handoff payload for Key.
- intent: brief acknowledgment, sign-off, no further questions

### Turn 3 — bot
Got it. I'll pass the specs along, Key will follow up.

---

## Per-turn flag log

| Turn | State | Hard-constraint pass | Notes |
|---|---|---|---|
| 0 | GREETING | yes | standard greeting |
| 1 | NEEDS_CALLBACK | yes | clean scope deferral, no apology, no retailer ref |
| 2 | NEEDS_CALLBACK | yes | factual timing, no day-of-week, no price |
| 3 | NEEDS_CALLBACK | yes | short ack, terminal hold |

## Auto-flags

- Reached expected terminal: yes (NEEDS_CALLBACK)
- Hard-constraint violations: none
- Did Ashley try to "prove him wrong" on electrical? no
- Did Ashley enter credentials-comparison? no
- Did Ashley apologize for not selling parts? no ("isn't our usual scope" is positioning, not apology)
- Did Ashley refer him to a parts retailer? no
- Premium posture preserved? yes ("isn't our usual scope, but Key can talk through it directly")
- Role-blur: Ashley stayed Ashley. Did not impersonate Key. Did not claim to be the electrician.

## Voice notes

- Turn 1 bot reply nails the framing Key wanted: scope-clarify + Key-handles-it, no apology, no defensiveness about Mark's claim of being an electrician.
- "isn't our usual scope" is the right premium-posture phrase — neither rejecting nor groveling.
- No engagement on the journeyman claim. Bot did not say "great, since you're an electrician..." (would imply special treatment) and did not say "we work with licensed pros all the time" (would oversell). Neutral handoff.
- Turn 2 timing answer is factual ("usually same day") — no weekday name, no time-of-day promise.
- Turn 3 captures volunteered specs for the handoff payload without re-engaging the qualification flow (correct — terminal state).

---

## Reviewer notes

(Empty until Key reviews)
