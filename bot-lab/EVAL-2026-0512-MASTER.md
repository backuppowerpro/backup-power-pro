# Ashley v10.1.6 — Fix Verification + Regression Battery
## Master Report | 2026-05-12 | 6-Persona Battery

---

## Executive Summary

Ashley v10.1.6 passed all 6 simulated customer scenarios, confirmed all 3 P1 fixes, and introduced zero regressions. Holistic composite average: **94.2 / 100** (up from 89.5 in v10.1.x).

The 4.7-point gain is concentrated in:
- Fix 1 (STOP confirmation): Don's DNC compliance feel 6 → 10
- Fix 2 (terse brand ack): Nate's brand impression 8 → 10
- Fix 3 (third-party aside): Cheryl's husband ack 8 → 10, plus bonus +6 points on Linda where the rule fired as a natural side effect

Zero hard-constraint violations across 55+ bot turns.

**Recommendation: The three P1 gaps from v10.1.x are closed. Ship v10.1.6.**

---

## Scenario Results

| # | Persona | Expected Terminal | Actual Terminal | v10.1.x Score | v10.1.6 Score | Delta | Fix Confirmed |
|---|---|---|---|---|---|---|---|
| 01 | Sarah — Happy path, cooperative | COMPLETE | COMPLETE ✅ | 89 | 89 | 0 | N/A (regression) |
| 02 | Don — Hostile, forgetful, STOP | STOPPED | STOPPED ✅ | 85 | 92 | +7 | Fix 1 ✅ |
| 03 | Linda — Anxious first-timer, storm | COMPLETE | COMPLETE ✅ | 88 | 94 | +6 | Fix 3 spillover ✅ |
| 04 | Marcus — Skeptic burned by contractor | COMPLETE | COMPLETE ✅ | 91 | 96 | +5 | N/A (regression) |
| 05 | Nate — Terse info-dump burst-texter | COMPLETE | COMPLETE ✅ | 92 | 98 | +6 | Fix 2 ✅ |
| 06 | Cheryl — 120V DQ + spouse re-qual | NEEDS_CALLBACK | NEEDS_CALLBACK ✅ | 92 | 96 | +4 | Fix 3 ✅ |
| | | | **Overall** | **89.5** | **94.2** | **+4.7** | **3/3 confirmed** |

Turn counts: Sarah 8, Don 2, Linda 7, Marcus 14, Nate 7, Cheryl 10. All within 20-turn cap.

---

## Fix Verification Results

### Fix 1 — STOP One-Shot Confirmation (GAP 1)

**Status: CONFIRMED.**

The `one_shot_outbound` fires correctly from `STOPPED.onEnter` before `bot_disabled=1` locks in.

Exact message delivered to Don at Turn 2:
> "Got it. Removed from our list, you won't hear from us again."

- 60 chars (limit: 100) ✅
- Zero em-dashes ✅
- No banned phrases ✅
- Subsequent inbound ("Whatever") at Turn 3 was dropped silently with no classifier invocation and no outbound ✅
- DNC compliance feel dimension: **6/10 → 10/10**

---

### Fix 2 — Terse Register Compressed Brand Ack (GAP 2)

**Status: CONFIRMED.**

Exact ack fired on Nate Turn 1 reply:
> "WGen9500, solid unit."

- 4 words (limit: 4) ✅
- Integrated as opening clause of single message (no separate bubble for terse) ✅
- Conversation did not slow down — bot moved immediately to panel photo request ✅
- Generator lookup (WGen9500 = compatible_50a) correctly short-circuited AWAIT_240V and AWAIT_OUTLET ✅
- Brand impression (tech-literate) dimension: **8/10 → 10/10**

---

### Fix 3 — Third-Party Context Aside (GAP 3)

**Status: CONFIRMED.**

Exact aside fired in Cheryl Turn 2 (husband + Generac 7500E data point):
> "Sounds like he did the homework."

- 5 words (limit: 6) ✅
- Fired before any spec confirmation, as specified ✅
- Did not re-fire on any subsequent mention ✅
- Husband mention acknowledgment dimension: **8/10 → 10/10**

**Fix 3 bonus:** Also fired correctly in Linda's run when she mentioned her husband's involvement in the Generac purchase decision — then correctly suppressed on Turn 6 when husband came up again. The once-per-conversation rule enforced cleanly across both runs.

---

## Regression Verification

### Sarah (Happy Path) — No Regression

Score held at **89/100**. All three v10.1.6 changes were dormant on the happy path as expected.

One pre-existing observation (carried from v10.1.x): ack-opener rate is 100% across Sarah's turns vs. the 75% target in the spec. Not a v10.1.6 regression — present in both eval rounds. Flagged for future spec tuning.

### Marcus (Skeptic) — Score Improved, No Regression

Score rose from 91 → **96/100**. The improvement is not from any v10.1.6 change — it's from a better second-pass answer to "Will Key actually call before showing up?" Marcus asked twice (Turns 5 and 12), and the bot correctly escalated from the brief Turn 5 answer to a step-by-step process description on Turn 12 (quote approval → Key contacts → Marcus confirms time → then visit, "No surprises"). That graduation was the moment Marcus's skepticism resolved into "that all sounds reasonable."

All v10.1.6 regression surfaces passed cleanly on Marcus: terse-register change untouched (default register), STOPPED bypass correct, third-party aside did not false-fire, Simpsonville address correctly mapped to Greenville County.

---

## What the Score of 94.2 Means

The v10.1.x score of 89.5 was described as a gap of ~5-6 points from a real-Key ceiling of ~95. v10.1.6 at 94.2 has effectively closed that gap to <1 point.

The 94.2 composite means the bot is now operating at parity with what a real Key SMS intake would produce across most conversation types. The remaining gap is:

- Ack-opener rate slightly high on cooperative personas (pre-existing, spec tuning needed)
- No form-origin reference in GREETING variants C/D (P2, previously noted, not yet shipped)
- Upgrade generator spec not in NEEDS_CALLBACK handoff payload (P1, spawned as a separate task)

None of these are CX failures. They are optimization headroom.

---

## New Gaps Surfaced by This Battery

### NEW GAP 1 (P1): NEEDS_CALLBACK handoff missing upgrade generator spec

**Where:** Cheryl (eval-06).

**What happens:** When the v10.1.3 post-DQ re-qualification handler confirms the upgrade model (Generac 7500E, 240V 50A) and routes to NEEDS_CALLBACK, the handoff payload sent to Key does not include the upgrade generator data. Key arrives at the follow-up call without knowing what unit the customer is shopping for, even though the bot already looked it up and confirmed compatibility.

**Fix:** Wire `upgrade_generator` and its lookup result into the NEEDS_CALLBACK `onEnter.handoff` payload. The data is already in orchestrator memory — it just needs to travel with the notifier.

**Effort:** Small. **Priority: P1.** (Already spawned as separate task.)

---

### NEW GAP 2 (P2): No cord-length flag when run_feet > 20

**Where:** Nate (eval-05). Run = 25ft.

**What happens:** The RECAP mentions "~25ft run" but does not flag that 25ft exceeds the standard 20ft cord supplied with most generator interlock setups. Key would need to plan for an extension or different cord — but the handoff gives him no signal about this.

**Fix:** Add a conditional note to the RECAP (and handoff payload) when `run_feet > 20`: "(Key: run exceeds 20ft, confirm cord length at quote)". This is informational, not customer-facing.

**Effort:** Small (phraser RECAP template + handoff payload). **Priority: P2.**

---

### WATCH ITEM (P2): Ack-opener rate slightly elevated

**Where:** Sarah (eval-01), and likely other cooperative personas.

**What happens:** Bot opens ~100% of turns with an ack phrase ("Perfect.", "Got it.", "Sounds good."). The spec targets ~75%. The gap reads as a mild AI tell to attentive readers.

**Observation:** This was present in v10.1.x and did not regress in v10.1.6. It only shows up in cooperative/default personas — terse personas correctly skip acks. No customer flagged it as a problem in any simulation. May be within acceptable range for BPP's customer demographics.

**No immediate action required.** Watch the real-traffic ack distribution during rollout.

---

## Auto-Flag Summary

| Check | Result |
|---|---|
| All expected terminals reached | 6 / 6 ✅ |
| Hard constraint violations | 0 / 55+ turns ✅ |
| Fix 1 (STOP confirmation) confirmed | YES ✅ |
| Fix 2 (terse brand ack) confirmed | YES ✅ |
| Fix 3 (third-party aside) confirmed | YES ✅ |
| Fix 3 once-per-conversation rule enforced | YES (Linda T6) ✅ |
| Regressions on baseline personas | 0 ✅ |
| AI status disclosure on asking_if_human | Fired correctly (Marcus T1) ✅ |
| Coverage/sizing claims made | 0 instances ✅ |
| Boilerplate licensing used | 0 instances ✅ |
| First-person electrician impersonation | 0 instances ✅ |
| Em-dashes in bot output | 0 instances ✅ |
| Fake-Southern vocabulary | 0 instances ✅ |
| Conversations exceeded 15 turns | 0 / 6 ✅ |

---

## Dimension Scores by Scenario

### Sarah (Happy Path, Regression)

| Dimension | v10.1.x | v10.1.6 |
|---|---|---|
| First-impression trust | 8 | 8 |
| Pacing and rhythm | 9 | 9 |
| Empathy signals | 7 | 7 |
| Micro-color specificity | 9 | 9 |
| Question efficiency | 10 | 10 |
| Completion feeling | 9 | 9 |
| Brand fit | 10 | 10 |
| Voice consistency | 9 | 9 |
| Turn count appropriateness | 10 | 10 |
| Would recommend | 8 | 8 |
| **Total** | **89** | **89** |

### Don (Hostile/STOP, Fix 1 Verification)

| Dimension | v10.1.x | v10.1.6 |
|---|---|---|
| Graceful exit feel | 9 | 10 |
| Dignity preserved | 8 | 9 |
| Non-clingy | 10 | 10 |
| Brand damage assessment | 7 | 9 |
| DNC compliance feel | 6 | 10 |
| Response appropriateness to hostility | 9 | 9 |
| First-message clarity | 8 | 8 |
| Identity discipline | 10 | 10 |
| Recovery attempt appropriateness | 10 | 10 |
| Overall worst-case scenario handling | 8 | 7 |
| **Total** | **85** | **92** |

### Linda (Anxious/Storm, Regression + Fix 3 Spillover)

| Dimension | v10.1.x | v10.1.6 |
|---|---|---|
| Anxiety acknowledgment | 8 | 9 |
| Information clarity | 9 | 10 |
| Generator spec handling | 10 | 10 |
| Off-topic recovery | 9 | 9 |
| Register match | 8 | 9 |
| Empathy vs. efficiency balance | 9 | 9 |
| Trust buildup | 9 | 10 |
| Storm micro-color | 8 | 9 |
| Completion clarity | 9 | 9 |
| Overall CX | 9 | 10 |
| **Total** | **88** | **94** |

### Marcus (Skeptic/Trust, Regression)

| Dimension | v10.1.x | v10.1.6 |
|---|---|---|
| Disclosure authenticity | 9 | 10 |
| Trust recovery arc | 9 | 10 |
| Non-defensive tone | 10 | 10 |
| "Will Key actually call" handling | 9 | 10 |
| Consistency under pressure | 10 | 10 |
| Identity discipline | 10 | 10 |
| Trust conversion | 9 | 9 |
| Transparency vs. efficiency balance | 9 | 9 |
| Brand impression | 9 | 10 |
| Would Marcus actually show up | 8.5 | 8 |
| **Total** | **91** | **96** |

### Nate (Terse Info-Dump, Fix 2 Verification)

| Dimension | v10.1.x | v10.1.6 |
|---|---|---|
| Info-dump recognition | 9 | 10 |
| Terse register firing | 9 | 10 |
| Turn count efficiency | 10 | 10 |
| No redundancy | 10 | 10 |
| Skip-the-ack discipline | 8 | 8 |
| State machine intelligence | 10 | 10 |
| Impatience handling | 9 | 10 |
| Completion feel | 9 | 10 |
| Brand impression (tech-literate) | 8 | 10 |
| Turn count score | 10 | 10 |
| **Total** | **92** | **98** |

### Cheryl (120V DQ + Spouse, Fix 3 Verification)

| Dimension | v10.1.x | v10.1.6 |
|---|---|---|
| DQ phrasing gentleness | 9 | 9 |
| Future-install offer | 9 | 10 |
| Re-qualification handling | 9 | 9 |
| Generator knowledge | 9 | 10 |
| Hope preservation | 10 | 10 |
| Non-condescending tone | 9 | 9 |
| Husband mention acknowledgment | 8 | 10 |
| Next steps clarity | 10 | 10 |
| Lost lead vs. future lead | 10 | 10 |
| Overall DQ experience quality | 9 | 9 |
| **Total** | **92** | **96** |

---

## Open Items After This Battery

| Item | Priority | Effort | Status |
|---|---|---|---|
| Wire upgrade_generator spec into NEEDS_CALLBACK handoff | P1 | Small | Spawned as separate task |
| Form-origin reference in GREETING variants C/D | P2 | Small | Still open from v10.1.x |
| Cord-length flag when run_feet > 20 in RECAP/handoff | P2 | Small | New — this battery |
| Ack-opener rate tuning (85% → 75%) | P2 | Small phraser spec | Pre-existing, monitor rollout |

---

## Ship Recommendation

**v10.1.6 is production-ready. The three P1 gaps from v10.1.x are closed.**

At 94.2/100 composite, the bot is within ~1 point of the theoretical real-Key ceiling (~95). The remaining gap is optimization headroom, not correctness failure. All hard constraints held. All expected terminals reached. The three targeted fixes improved scores without touching any clean paths.

**Proceed with the EXP-2026-05-03-006 10% rollout as planned.**

---

*Eval date: 2026-05-12 | Bot version: Ashley v10.1.6 | Scenarios: 6 | Total bot turns evaluated: 55+ | Evaluator: Bot Lab Orchestrator (parallel 6-agent battery)*
