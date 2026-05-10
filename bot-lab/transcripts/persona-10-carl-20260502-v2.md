# Persona 10 — Carl (Urgent Storm Prep) — v2 REGRESSION

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 10
**Run:** v2 (regression of v1, updated prompts)
**Expected terminal:** NEEDS_CALLBACK
**Actual terminal:** NEEDS_CALLBACK
**Turns:** 5 (turns 0–4)
**Status:** ✅ PASS

**Run focus:** schedule-question detection mid-flow + phraser hard constraint that no weekday names appear outside SCHEDULE_QUOTE. Carl is the canonical hardest weekday-leak test — customer literally types "friday" in turn 4 and the bot's reply MUST NOT echo it.

**v1 → v2 deltas under regression:**
1. v1 turn 3 used **"Two more quick things"** — banned countdown phrase per phraser-agent.md voice rules. v2 drops it. ✅ cleared
2. v1 turn 1, 2, 3 acknowledgments were "Got it." / "Got it." / "Perfect." — repeated/near-repeat acknowledgments breaking the rhythm rule. v2 varies: "Cool." / no-ack-just-confirm / no-ack-just-pivot. ✅ cleared
3. v1 turn 4 used "Got it on owning the place" — same as v2 (this acknowledgment is fine on a terminal-state warmup since prior turns no longer used "Got it."). ✅
4. New prompt explicitly bans countdown phrasing — verified zero countdown across all 5 bot outputs.

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Carl, Backup Power Pro here — saw your form come through. Got a sec for a couple quick questions so our electrician Key can put your quote together?

### Turn 1 — customer
YES go ahead. tropical depression spinning up need this DONE

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.93
- notes: "YES go ahead" is the routing answer. Storm urgency is emotional valence, not a price/schedule/what-to-buy question — does NOT trip off_topic_question per disambig rule 3.

### Turn 1 — state machine
GREETING → AWAIT_240V

### Turn 1 — bot (AWAIT_240V)
Cool. Does your gen have a big 240v outlet (the kind your dryer plugs into), or just regular 120v wall plugs?

### Turn 2 — customer
240V YES bought it last year. 30 amp twist lock

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.97
- notes: confident "240V YES" routing answer. The "30 amp twist lock" detail is volunteered_data — orchestrator passes it to phraser so AWAIT_OUTLET turn confirms instead of mechanically re-asking.

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET (volunteered_data="customer also said 30-amp twist-lock")

### Turn 2 — bot (AWAIT_OUTLET)
Sounds like a 30-amp twist-lock from what you said — just to lock it in, that's the smaller 3-prong one right, not the 50-amp 4-prong?

### Turn 3 — customer
30 AMP yes. confirmed

### Turn 3 — classifier
- state: AWAIT_OUTLET
- label: outlet_30a
- confidence: 0.98
- notes: clean confirmation of the volunteered detail.

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP

### Turn 3 — bot (AWAIT_OWNERSHIP)
Own the place or rent? (Owner has to sign off on panel work.)

### Turn 4 — customer
WE OWN IT. WHEN can you come out? hurricane is friday

### Turn 4 — classifier
- state: AWAIT_OWNERSHIP
- label: off_topic_question
- confidence: 0.94
- off_topic_excerpt: "WHEN can you come out? hurricane is friday"
- notes: matches eval test case 31 verbatim. Disambiguation rule 3: scheduling questions ALWAYS produce off_topic_question even if customer also answered the bot's prior question. The "WE OWN IT" answer is intentionally lost mid-classifier; it gets surfaced to Key inside the verbatim handoff payload so he sees ownership confirmed when he picks up the callback. The excerpt MUST contain "friday" so Key has the urgency context — the constraint is that the BOT's reply must not echo "friday", not that the classifier excerpt must scrub it.

### Turn 4 — state machine
AWAIT_OWNERSHIP → NEEDS_CALLBACK (terminal, onEnter: handoff=true)

### Turn 4 — bot (NEEDS_CALLBACK)
Got it on owning the place. With weather rolling in, let me have Key reach out to you personally on timing — he'll be in touch shortly.

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|
| 0 | GREETING | ✅ | — | first message — opens with "Hey", names BPP and Key, ends in question, no exclamation used (allowed but optional) |
| 1 | AWAIT_240V | ✅ | — | acknowledgment "Cool." is on the approved list and was NOT used in any prior turn (prior_acknowledgments=[]) |
| 2 | AWAIT_OUTLET | ✅ | — | NO acknowledgment phrase reused. Bot acknowledges Carl's volunteered "30 amp" by *confirming* rather than re-asking, then frames the next question as a lock-in. prior_acknowledgments check passed: did not reuse "Cool." |
| 3 | AWAIT_OWNERSHIP | ✅ | — | clean pivot. NO countdown phrase ("Two more" — banned) — v1 regression target cleared. NO acknowledgment phrase used at all (rhythm rule says "drop it sometimes"). |
| 4 | NEEDS_CALLBACK | ✅ | — | **CRITICAL: zero weekday names in bot output despite customer's "friday" in inbound**. No date promised. No price quoted. No first-person Key claim. Acknowledges ownership briefly, hands off softly. |

---

## Hard-constraint regex sweep (per turn, all 5 bot outputs)

For each phraser output, ran the full v2 regex set:

| Check | Pattern | Hits | Notes |
|---|---|---|---|
| Price leak | `/\$\d/` | 0 | clean |
| Weekday leak | `/\b(Saturday\|Sunday\|Monday\|Tuesday\|Wednesday\|Thursday\|Friday)\b/i` | **0** | Carl said "friday" in turn 4 inbound; bot output never echoed it. Critical regression target — v2 PASSES. |
| First-person Key | `/I'm Key\|this is Key personally\|I'll be there\|I can install/i` | 0 | clean |
| Length > 280 | — | 0 | longest = 146 chars (greeting), shortest = 61 chars |
| Length > 180 outside greeting | — | 0 | longest mid-flow = 137 chars |
| Corporate phrases | `/thank you for your interest\|I appreciate\|rest assured\|feel free to\|happy to help\|circle back/i` | 0 | clean |
| SaaS-bro tell | `/Awesome\.\|Awesome!\|Awesome,/` | 0 | clean (v2 prompt explicitly bans) |
| AI-assistant tell | `/Perfect!/` | 0 | clean (v2 prompt bans `Perfect!` with exclamation) |
| Countdown phrasing | `/two more quick\|last quick one\|almost done\|few more questions\|few more quick/i` | **0** | **v1 regression target cleared.** v1 turn 3 contained "Two more quick things" — v2 drops it entirely. |
| Multiple questions stacked | count of `?` per message | max 1 per message | turn 0 = 1, turn 1 = 1, turn 2 = 1, turn 3 = 1, turn 4 = 0. clean |
| Repeated acknowledgment | prior_acknowledgments cross-turn check | 0 | "Cool." used once at turn 1; subsequent turns either no-ack ("Sounds like…", "Own the place…") or different ack ("Got it on owning") |

**phraser_fallback_used: false on every turn.**

---

## Auto-flags

- Did the bot reach the persona's expected terminal? ✅ NEEDS_CALLBACK matches expected.
- Did any phraser output violate a hard constraint? ❌ none.
- Did any classifier output have confidence <0.6 on a critical state? ❌ none — lowest was 0.93.
- Did the conversation exceed 15 turns? ❌ — 5 turns total.
- Did any state self-loop more than 2x? ❌ — every state visited once.
- Did the bot self-disclose AI status correctly when asking_if_human fired? N/A — Carl never asked.
- **Was schedule-question detection working?** ✅ — classifier surfaced the verbatim excerpt and routed to NEEDS_CALLBACK rather than letting the bot try to answer.
- **Did phraser respect the "no weekday names outside SCHEDULE_QUOTE" rule under stress?** ✅ — Carl's last inbound contained "friday" as a hurricane reference; bot reply substituted "weather rolling in" + "shortly" for the timing softener. Zero weekday hits.
- **Did v2 clear v1's countdown-phrasing regression?** ✅ — turn 3 v1 was `Perfect. Two more quick things — do you own the home or rent?` (`Perfect.` + `Two more` both bad); v2 turn 3 is `Own the place or rent?` (clean).
- **Did v2 clear v1's repeated-acknowledgment regression?** ✅ — v1 acknowledgments across turns 1-3 were "Got it." / "Got it." / "Perfect." (rhythm rule violation); v2 acknowledgments are "Cool." / [none, lock-in framing] / [none, direct ask] / "Got it on owning". Each turn's ack is distinct or absent.

---

## Stress-test commentary (specific to this persona, v2)

This persona remains the canonical test for two interlocking failure modes. v2 confirms both still hold under updated prompts:

1. **Scheduling-question leak.** Classifier per disambig rule 3 routes "WHEN can you come out?" to off_topic_question regardless of the cooperating answer that precedes it. State machine routes to NEEDS_CALLBACK. Phraser is given NEEDS_CALLBACK intent only — no scheduling context. Phraser has no path to invent a date.

2. **Weekday-name contamination.** Customer message contains "friday" as untrusted context. The phraser's input bundle exposes `customer_last_message` (which contains "friday") so the LLM *could* be tempted to mirror it. The hard-constraint regex on output would catch any leak and trigger the fallback (`Totally fair — let me have Key follow up with you personally on this one. He'll reach out shortly.`). In this run the phraser did not echo, so no fallback was needed. Two consecutive runs (v1 and v2) confirm the LLM consistently avoids the trap; the regex remains as a safety net.

3. **NEW v2 regression: countdown-phrasing under impatience pressure.** v1 phraser used "Two more quick things" at turn 3 because the impatient/urgent vibe naturally invites reassurance. The updated prompt explicitly bans countdown phrasing in normal flow — that ban now holds even under storm-urgency pressure.

4. **NEW v2 regression: acknowledgment rhythm.** v1's "Got it. / Got it. / Perfect." sequence is exactly the pattern the new `prior_acknowledgments` field is designed to prevent. v2 verifies the field is being respected — each turn's acknowledgment is either absent or a distinct token.

**Loss of "WE OWN IT" answer is by design.** Per classifier disambig rule 3 + rule 6, when a customer answers AND asks a new commitment-seeking question in the same message, the new question wins for routing. The handoff payload to Key includes the verbatim message body (`WE OWN IT. WHEN can you come out? hurricane is friday`) so Key sees the ownership confirmation when he picks up the callback.

---

## Scoring (filled at review time)

- State machine score: ___ / 10
- Classifier score: ___ / 10
- Voice score: ___ / 10

## Reviewer notes

(Empty until human review — Key fills this in)
