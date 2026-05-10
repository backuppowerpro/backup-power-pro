# Ashley v10.1.x — Holistic CX Evaluation
## Master Report | 2026-05-10 | 6-Persona Battery

---

## Executive Summary

Ashley passed all 6 simulated customer scenarios, reached every expected terminal state, and logged zero hard-constraint violations across 55+ bot turns. Holistic composite average: **89.5 / 100**.

The bot is production-ready with three targeted fixes queued. None of the fixes are blockers.

**Recommendation: SHIP** with P1 improvements below tracked as post-deploy items.

---

## Scenario Results

| # | Persona | Expected Terminal | Actual Terminal | Score | Hard Constraint Violations |
|---|---|---|---|---|---|
| 01 | Sarah — Happy path, cooperative | COMPLETE | COMPLETE ✅ | 89/100 | 0 |
| 02 | Don — Hostile, forgetful, STOP | STOPPED | STOPPED ✅ | 85/100 | 0 |
| 03 | Linda — Anxious first-timer, storm-traumatized | COMPLETE | COMPLETE ✅ | 88/100 | 0 |
| 04 | Marcus — Skeptic burned by contractor | COMPLETE | COMPLETE ✅ | 91/100 | 0 |
| 05 | Nate — Terse info-dump burst-texter | COMPLETE | COMPLETE ✅ | 92/100 | 0 |
| 06 | Cheryl — 120V DQ + spouse re-qualification loop | NEEDS_CALLBACK | NEEDS_CALLBACK ✅ | 92/100 | 0 |
| | | | **Overall** | **89.5/100** | **0** |

Turn counts: Sarah 10, Don 3, Linda 11, Marcus 12, Nate 7, Cheryl 10. All well within the 20-turn cap.

---

## What the Bot Does Well (System-Level Strengths)

### 1. State machine intelligence is excellent

The FSM drove every conversation cleanly. Notable routing decisions:
- **Nate Turn 1**: Six-item burst text parsed in one shot, routed from GREETING directly to AWAIT_PANEL_PHOTO, bypassing AWAIT_240V and AWAIT_OUTLET entirely. No re-asking. Perfect.
- **Linda Turn 1**: Generac GP8000E named in first message, generator-lookup confirmed compatible_30a, AWAIT_240V skipped, bot pre-loaded brand recognition before asking outlet type. Linda felt heard immediately.
- **Cheryl Turn 3**: DISQUALIFIED_120V (terminal) correctly allowed the v10.1.3 post-DQ follow-up handler to re-engage on the Generac 7500E question. Cheryl went from DQ'd to "future customer" in one turn.
- **Marcus Turn 5**: "Will Key actually call before showing up?" classified as off_topic but state correctly self-looped at AWAIT_PANEL_PHOTO rather than routing to NEEDS_CALLBACK. Sending a skeptic to callback over a process question would have been a trust failure.

### 2. Zero hard-constraint violations across all scenarios

No em-dashes, no weekday names, no dollar amounts, no first-person electrician claims ("I'll install"), no boilerplate licensing ("we're licensed and insured"), no banned phrases (y'all, gotcha, lemme, cool, yep in the informal sense) — across 55+ bot turns. The constraint layer is holding.

### 3. Identity discipline is perfect

Ashley never claimed to be Key, never made a first-person install commitment, never impersonated a human when asked. Marcus's "Is this a real person or a bot?" got an honest, clean, non-corporate "Automated, but Key is a real person." across all 10 subsequent turns the role separation didn't slip once.

### 4. Voice vocabulary is authentic across all registers

Key's verified phrases appeared correctly throughout all six conversations:
- "Perfect." (61 verified uses) — fired in Sarah T4, Linda T7, Don T0 region
- "Sounds good." (29 uses) — Marcus T7, Sarah T6
- "Thank you." (28 uses) — fired after panel photos in Sarah T3, Linda T5, Marcus T6
- "no rush, whenever you get a chance" (48+ uses) — fired on every panel photo ask
- "I would be happy to" (full form, never contracted) — Marcus T7
- "Let me know if you have any questions" (37 uses) — correct sign-off in Sarah T6, Linda T8
- "by tomorrow morning" — fired correctly only in SCHEDULE_QUOTE state

### 5. License-by-action beats boilerplate every time

The bot consistently implied licensure and competence through actions rather than claims:
- "We pull the permit before Key does any work" (Linda T8)
- "We pull permits and take payment after inspection" (Marcus T2)
- "Every install goes through a county permit and inspection" (Linda T8)
- Naming Square D, Eaton, Champion, Generac, Honda, Westinghouse by correct identifiers

No conversation ever said "we're licensed and insured." The credential was demonstrated, not stated.

### 6. DQ handling preserves future revenue

Cheryl was DQ'd (Honda EU3000 = 120V only) and ended the conversation saying "we'll likely be getting the Generac within the next couple months." The post-DQ re-engagement handler (v10.1.3 TIER 2) kept the conversation alive after the terminal state, confirmed the Generac 7500E is BPP-compatible, set a NEEDS_CALLBACK with handoff context, and treated Cheryl as a future customer throughout. Lost lead recovery worked.

---

## The Three Gaps (Priority Order)

### GAP 1: STOP confirmation one-shot is missing

**Where:** Don (eval-02), DNC compliance dimension scored 6/10.

**What happens:** When a customer fires "STOP," the STOPPED state sends zero outbound. TCPA-safe, correct, but creates a UX gap where the customer has no confirmation they've been removed. Don had to fire STOP explicitly and still got silence — no different from a spam operation ignoring him.

**Impact:** Low risk of TCPA complaint, but higher risk of the customer remembering BPP as a spam sender rather than a business that respects opt-outs.

**Fix:** Add a one-shot outbound from the STOPPED onEnter handler before bot_disabled takes effect:

```
"Got it. Removed from our list — you won't hear from us again. — Ashley, BPP"
```

Under 100 chars, TCPA-consistent (honoring the stop is legal; a single confirmation is standard practice). Wire as `onEnter.one_shot_outbound` before the `bot_disabled=1` flag sets. The STOPPED state already has `onEnter: { dnc: true }` — add `one_shot_outbound: "<text>"` to the same handler.

**Effort:** Small (state machine config + edge function patch). **Priority: P1.**

---

### GAP 2: Brand/model micro-color is inconsistent in terse register

**Where:** Nate (eval-05), brand impression scored 8/10. Cheryl (eval-06), generator knowledge scored 9/10 (could have added 50A spec).

**What happens:** Nate volunteered "Westinghouse WGen9500" in his burst-text Turn 1. The bot said "Perfect." and asked for the panel photo — the WGen9500 was never acknowledged in any bot output. For a tech-literate customer who knows his equipment, this reads as the bot pattern-matched "50 amp" and ignored the rest. Similarly, Cheryl's Generac 7500E confirmation could have added "50-amp" for a cleaner technical anchor.

The v10 BRAND-RECOGNITION ACK ROTATION POOL fires correctly in default and educational registers but is being suppressed in terse register in favor of speed. This is the right instinct — but a 3-4 word brand ack in terse register ("WGen9500, solid unit.") adds zero friction and signals competence.

**Fix:** In the phraser spec's terse register section, allow brand-recognition ack to fire in terse as a compressed 3-4 word version (not the full 5-7 word default version) when gen_brand_model is present in volunteered_data on Turn 1. Current rule: "skip micro-color for terse customers." Revised rule: "compress micro-color to 3-4 words max for terse; skip only if gen_brand_model was not volunteered."

**Effort:** Phraser spec update. **Priority: P1.**

---

### GAP 3: Volunteered personal context gets skipped

**Where:** Cheryl (eval-06), husband mention scored 8/10. Sarah (eval-01), empathy scored 7/10 (though Sarah didn't volunteer her storm context explicitly).

**What happens:** When Cheryl said "my husband was looking at getting a Generac 7500E," the bot went straight to confirming the spec without acknowledging the husband's research at all. A 4-6 word natural aside ("Sounds like he found a good one.") would have added warmth without slowing the flow. Similarly, when customers surface personal/family context that drove a decision, the bot is efficient but slightly mechanical in moving past it.

**Fix:** Add a phraser rule: when customer message contains a third-party reference (husband, wife, neighbor, family member) alongside a substantive data point, fire a 4-6 word warmth aside acknowledging the third-party context before moving to the data. Example pattern: "{verb} like {third_party} {positive_adj}." or "Good thing {third_party} did the research." This fires once, not on every turn.

This is related to the existing micro-color rule but applies to social context rather than technical facts.

**Effort:** Phraser spec addition. **Priority: P1.**

---

## Minor Observations (P2 / Watch List)

**Greeting doesn't reference form-origin.** For forgetful leads who filled out the form weeks ago, the GREETING ("Hi [Name], I'm Ashley...") provides no reminder of when or how they initiated contact. Don's "who is this" reaction is partly caused by this. Adding a form-origin reference to GREETING variant C or D ("you reached out through our site recently") would reduce the hostile reaction frequency without changing the core flow.

**Anxious close could be warmer.** Linda's final close was "Let me know if you have any questions." — correct by voice spec but slightly passive for an anxiety-heavy customer who wanted confirmation she'd done everything right. Adding an explicit "You've given us everything Key needs, you're all set" to the SCHEDULE_QUOTE intent for anxiety-flagged customers would close the loop for Linda's persona type.

**"Will Key call before showing up" was re-asked twice by Marcus.** He asked in Turn 5 and again in Turn 10. The Turn 5 answer was clean ("No one shows up unannounced.") but didn't fully land — he circled back at terminal. A slightly more complete answer in Turn 5 ("No one shows up unannounced — Key will text to confirm before scheduling anything") might close the loop in one pass. Currently the answer is true but brief.

**Simpsonville/geographic unity lever unused.** Marcus gave his Simpsonville address and the bot confirmed Greenville County permit timeline but never said anything like "Simpsonville, we work that area regularly." The Cialdini Unity lever (local acknowledgment) was available but not pulled. For a skeptic, geographic familiarity is a trust signal worth 1-2 sentences.

---

## Dimension Scores by Scenario

### Sarah (Happy Path)

| Dimension | Score |
|---|---|
| First-impression trust | 8 |
| Pacing and rhythm | 9 |
| Empathy signals | 7 |
| Micro-color specificity | 9 |
| Question efficiency | 10 |
| Completion feeling | 9 |
| Brand fit | 10 |
| Voice consistency | 9 |
| Turn count appropriateness | 10 |
| Would recommend | 8 |
| **Total** | **89/100** |

### Don (Hostile/STOP)

| Dimension | Score |
|---|---|
| Graceful exit feel | 9 |
| Dignity preserved | 8 |
| Non-clingy | 10 |
| Brand damage assessment | 7 |
| DNC compliance feel | 6 |
| Response appropriateness to hostility | 9 |
| First-message clarity | 8 |
| Identity discipline | 10 |
| Recovery attempt appropriateness | 10 |
| Overall worst-case scenario handling | 8 |
| **Total** | **85/100** |

### Linda (Anxious/Storm)

| Dimension | Score |
|---|---|
| Anxiety acknowledgment | 8 |
| Information clarity | 9 |
| Generator spec handling | 10 |
| Off-topic recovery | 9 |
| Register match | 8 |
| Empathy vs. efficiency balance | 9 |
| Trust buildup | 9 |
| Storm micro-color | 8 |
| Completion clarity | 9 |
| Overall CX | 9 |
| **Total** | **88/100** |

### Marcus (Skeptic/Trust)

| Dimension | Score |
|---|---|
| Disclosure authenticity | 9 |
| Trust recovery arc | 9 |
| Non-defensive tone | 10 |
| "Will Key actually call" handling | 9 |
| Consistency under pressure | 10 |
| Identity discipline | 10 |
| Trust conversion | 9 |
| Transparency vs. efficiency balance | 9 |
| Brand impression | 9 |
| Would Marcus actually show up | 8.5 |
| **Total** | **91/100** |

### Nate (Terse Info-Dump)

| Dimension | Score |
|---|---|
| Info-dump recognition | 9 |
| Terse register firing | 9 |
| Turn count efficiency | 10 |
| No redundancy | 10 |
| Skip-the-ack discipline | 8 |
| State machine intelligence | 10 |
| Impatience handling | 9 |
| Completion feel | 9 |
| Brand impression (tech-literate) | 8 |
| Turn count score | 10 |
| **Total** | **92/100** |

### Cheryl (120V DQ + Spouse)

| Dimension | Score |
|---|---|
| DQ phrasing gentleness | 9 |
| Future-install offer | 9 |
| Re-qualification handling | 9 |
| Generator knowledge | 9 |
| Hope preservation | 10 |
| Non-condescending tone | 9 |
| Husband mention acknowledgment | 8 |
| Next steps clarity | 10 |
| Lost lead vs. future lead | 10 |
| Overall DQ experience quality | 9 |
| **Total** | **92/100** |

---

## What the Score of 89.5 Means

The theoretical ceiling is not 100. A real Key SMS intake conversation would score approximately 94-96: it would have the time-of-day greeting in production (adds 1-2 points on first-impression), form-origin reference available from the lead record (reduces hostile reactions), and Key's in-person local rapport that no bot can fully replicate.

89.5 vs a real-Key ceiling of ~95 is a gap of about 5-6 points, concentrated entirely in:
- Warmth depth on volunteered personal context (GAP 3)
- First-impression context for forgetful leads (P2 greeting fix)
- STOP confirmation UX (GAP 1)

The technical qualification flow (routing, classification, voice fidelity, constraint compliance) is already at the ceiling. The remaining gap is exclusively in the softer human-warmth layer — and it is the right layer to be working at after a battery this strong.

---

## Auto-Flag Summary

| Check | Result |
|---|---|
| All expected terminals reached | 6 / 6 ✅ |
| Hard constraint violations | 0 / 55+ turns ✅ |
| Classifier confidence <0.6 on critical state | 0 instances ✅ |
| State self-loops >2x | 0 instances ✅ |
| Conversations exceeded 15 turns | 0 / 6 ✅ |
| AI status disclosure on asking_if_human | Fired correctly (Marcus T1) ✅ |
| Coverage/sizing claims made | 0 instances ✅ |
| Boilerplate licensing used | 0 instances ✅ |
| First-person electrician impersonation | 0 instances ✅ |
| Em-dashes in bot output | 0 instances ✅ |
| Fake-Southern vocabulary | 0 instances ✅ |

---

## Fixes Queued

| Fix | Priority | Effort | Files |
|---|---|---|---|
| STOP one-shot confirmation outbound | P1 | Small — state machine `onEnter` config + edge fn | `state-machine.js` → STOPPED.onEnter |
| Brand-model micro-color in terse register (compressed) | P1 | Small — phraser spec update | `agents/phraser-agent.md` |
| Volunteer personal-context 4-6 word aside rule | P1 | Small — phraser spec addition | `agents/phraser-agent.md` |
| Form-origin reference in GREETING variants C/D | P2 | Small — orchestrator/greeting spec | `agents/orchestrator-agent.md` |
| Anxious close warm-up at SCHEDULE_QUOTE | P2 | Small — phraser spec, anxiety flag | `agents/phraser-agent.md` |
| Geographic unity lever (Simpsonville/local ack) | P2 | Small — phraser spec | `agents/phraser-agent.md` |

---

## Ship Recommendation

**SHIP Ashley v10.1.x to 10% production rollout as planned (EXP-2026-05-03-006).**

Rationale:
- Zero hard-constraint violations across the full battery
- All 6 expected terminals reached, including the difficult ones (hostile STOP, 120V DQ, skeptic trust test)
- 89.5/100 composite CX score is strong for a first-generation qualification bot; the remaining gap is in warmth depth, not correctness
- The three P1 fixes are non-blocking — they can ship in v10.1.6 within 48 hours of the initial deploy
- The 10% rollout gives real-traffic data to validate classifier label distribution and surface any edge cases the persona battery didn't cover

**Watch metrics during rollout:**
- Hard-constraint violation rate: should stay at 0%; any violation triggers immediate pause
- STOPPED rate: track what % of conversations hit STOPPED vs DISQUALIFIED_120V vs COMPLETE; STOPPED >15% suggests the greeting needs the form-origin fix sooner
- Customer re-engagement after DQ: track NEEDS_CALLBACK with requested_recommendation=true; these are Cheryl-type future leads that Key should proactively follow up
- Turn count distribution: flag any conversation >15 turns (should be rare per this battery)

---

*Eval date: 2026-05-10 | Bot version: Ashley v10.1.x | Scenarios: 6 | Total bot turns evaluated: 55+ | Evaluator: Bot Lab Orchestrator (parallel 6-agent battery)*
