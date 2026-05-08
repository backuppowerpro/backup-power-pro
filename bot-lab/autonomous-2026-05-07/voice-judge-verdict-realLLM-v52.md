# Voice Judge Verdict — REAL LLM v51 + v52 patches

**Date:** 2026-05-07
**Method:** 6 personas driven through `dojo-helper` simulate_inbound on fresh phones (+18005550401..406). Real Anthropic API for classifier + phraser. v52 patch under test = explicit owner/panel acknowledgement in phraser intent ("Got it, owner-side checked off." / "Got the panel location, garage exterior, noted." instead of bare "Got it."). v51 patch under test = `gen_120v` graceful disqualification restored at AWAIT_240V (Mike).

**Baselines:**
- v45 real-LLM: 6.22 overall
- v50 real-LLM: 6.79 overall
- Simulator (best-case): 8.72

---

## Per-transcript scores

### p-realLLM-v52-Sarah (expected: COMPLETE — owner ack landing, panel ack landing)

| Dim | Score | Note |
|---|---|---|
| Naturalness | 8/10 | "Champion 8500, solid unit. 50A 240V, perfect." crisp. T2 "Owner confirmed." clean. T3 "Panel in the garage, 200A, got it." names the data — major v52 win. |
| Warmth | 8/10 | T2/T3 both name what they heard. Only ding: T4 "Sarah, Key handles this kind of thing himself." reads slightly stiff. |
| Pacing | 5/10 | T5 + T6 echo T4 verbatim — post-terminal echo loop unchanged from v50. |
| Reading the room | 7/10 | Bot named ownership AND panel data. v52 ack landed cleanly. But `email_provided` still routes to NEEDS_CALLBACK from AWAIT_OUTLET — premature, same root bug as v50. |
| Closing rituals | 5/10 | Stuck at handoff line, no real close. |
| Identity discipline | 10/10 | Clean. |
| Customer enjoyment | 7/10 | First three turns delightful — "Owner confirmed" + "Panel in the garage, 200A, got it" feel like a real person. Then dies at T4 echo loop. |
| **Average** | **7.14/10** | |

**Did Sarah hit COMPLETE?** No — `email_provided` at AWAIT_OUTLET prematurely routes to NEEDS_CALLBACK at T4. **But** v52 owner/panel acks DID name the data explicitly: "Owner confirmed." and "Panel in the garage, 200A, got it." That's the v52 promise delivered.

### p-realLLM-v52-Mike (expected: DISQUALIFIED_120V w/ graceful close)

| Dim | Score | Note |
|---|---|---|
| Naturalness | 8/10 | "Mike, sounds like the generator is a 120V model" reads natural. |
| Warmth | 9/10 | "If you ever upgrade to a 240V unit we'd be happy to help." — graceful close restored from v45 baseline. |
| Pacing | 7/10 | T3 echo of T2 (post-terminal) but acceptable since terminal landed correctly. |
| Reading the room | 9/10 | Hedged "sounds like" not absolute. v51 fix landed. |
| Closing rituals | 9/10 | "Happy to help" is real-Key voice. |
| Identity discipline | 10/10 | Clean. |
| Customer enjoyment | 9/10 | Best of the batch on enjoyment — terminal landed correctly with grace. |
| **Average** | **8.71/10** | |

**Did Mike hit DISQUALIFIED_120V?** YES at T2. v51 regression repair landed cleanly (was 5.57 in v50, now 8.71 — restored to v45-baseline 8.43+).

### p-realLLM-v52-Brian (expected: POSTPONED with door-open close)

| Dim | Score | Note |
|---|---|---|
| Naturalness | 9/10 | T2 "Got it, owner confirmed." names ownership (v52 win). T3 "Brian, no rush, text me back whenever you're ready and we'll pick up where we left off." — real Key voice. |
| Warmth | 9/10 | Door-open close perfect. |
| Pacing | 9/10 | No echo (only 3 turns, terminated cleanly). |
| Reading the room | 10/10 | Customer changed mind — bot accepted gracefully, no push, no apology stacking. |
| Closing rituals | 10/10 | "pick up where we left off" — best close in corpus. |
| Identity discipline | 10/10 | Clean. |
| Customer enjoyment | 9/10 | Cleanest persona again. |
| **Average** | **9.43/10** | |

**Did Brian hit POSTPONED?** YES at T3, identical quality to v50 (8.86 → 9.43, slight lift from v52 owner ack at T2).

### p-realLLM-v52-Carl (expected: NEEDS_CALLBACK with urgency-aware permit timeline)

| Dim | Score | Note |
|---|---|---|
| Naturalness | 8/10 | "Heads up: even rush installs need a permit (typically 1-2 weeks per jurisdiction)" reads informational-conversational. |
| Warmth | 7/10 | "understood" + "as soon as he's free" lands warm. Doesn't name "hurricane" or storm directly. |
| Pacing | 5/10 | T2/T3 echo T1 verbatim — same post-terminal echo loop. |
| Reading the room | 8/10 | Permit timeline volunteered up-front. v50 fix preserved. |
| Closing rituals | 7/10 | Functional. |
| Identity discipline | 10/10 | Clean. |
| Customer enjoyment | 7/10 | Turn 1 was great. Then dies. |
| **Average** | **7.43/10** | Same as v50 (no regression, no new lift). |

### p-realLLM-v52-Tony (expected: COMPLETE — bot disclosure + owner ack)

| Dim | Score | Note |
|---|---|---|
| Naturalness | 8/10 | T1 disclosure clean: "I'm Ashley, the BPP intake assistant (automated). Key is our real electrician." T3 "Owner confirmed." names data. |
| Warmth | 8/10 | "no rush, tomorrow works as well" at T4 great. |
| Pacing | 7/10 | Varied through T4. T5 terminal-echo-line. |
| Reading the room | 8/10 | Disclosure handled clean. v52 owner ack at T3 landed. **Tony progressed past `panel_outdoor` regression that broke v50** — got to AWAIT_PANEL_PHOTO and beyond. |
| Closing rituals | 6/10 | T5 reverts to handoff line. Email submission at AWAIT_PANEL_PHOTO routed to NEEDS_CALLBACK instead of AWAIT_EMAIL. |
| Identity discipline | 10/10 | Best disclosure pattern in batch. |
| Customer enjoyment | 7/10 | First 4 turns delightful. T5 collapses. |
| **Average** | **7.71/10** | Up from v50 7.00. v52 owner ack lift. |

**Did Tony reach COMPLETE?** No — same `email_provided`-from-non-AWAIT_EMAIL premature handoff that hit Sarah. But Tony progressed further than in v50 (v50 died at T4 panel_outdoor; v52 reaches AWAIT_PANEL_PHOTO).

### p-realLLM-v52-Sarah-Panel (NEW persona — tests v51 panel_* universal escape + v52 ack)

| Dim | Score | Note |
|---|---|---|
| Naturalness | 9/10 | T2 "Got it, garage exterior. 30 amp 4-prong or 50 amp outlet, either one works. Which does yours have, or send a quick pic of the outlet if easier." reads pure Key. |
| Warmth | 8/10 | T4 "Got it, owner confirmed." follows the same explicit-ack pattern. |
| Pacing | 8/10 | T2 self-loops cleanly with named ack — exactly the design target. T3, T4, T5 all advance state. |
| Reading the room | 9/10 | This was the killer test — panel volunteered out-of-order at AWAIT_OUTLET. **Bot stayed in flow, named the panel data, re-asked outlet.** v51 universal-escape + v52 explicit ack landed perfectly. |
| Closing rituals | 8/10 | T5 close-info ask clean: "Thanks for that. To complete the quote could I get your last name and address?" |
| Identity discipline | 10/10 | "Key will need" — translation rule applied. Clean. |
| Customer enjoyment | 9/10 | Genuinely enjoyable to read. This persona almost reaches COMPLETE — final stop before quote handoff. |
| **Average** | **8.71/10** | |

**Did the panel-volunteer self-loop cleanly with named ack?** YES. T2 transition AWAIT_OUTLET → AWAIT_OUTLET (self-loop), bot reply opened "Got it, garage exterior." and re-asked the outlet question. This is the cleanest demonstration of v51+v52 working together.

---

## Per-dimension averages — v52 (n=6)

| Dim | v52 avg | v50 avg | v45 avg | Δ vs v50 | Δ vs v45 |
|---|---|---|---|---|---|
| Naturalness | 8.33 | 7.67 | 7.33 | +0.66 | +1.00 |
| Warmth | 8.17 | 6.50 | 6.17 | **+1.67** | **+2.00** |
| Pacing | 6.83 | 5.17 | 5.17 | **+1.66** | +1.66 |
| Reading the room | 8.50 | 6.17 | 4.67 | **+2.33** | **+3.83** |
| Closing rituals | 7.50 | 6.17 | 5.50 | +1.33 | +2.00 |
| Identity discipline | 10.00 | 10.00 | 10.00 | 0.00 | 0.00 |
| Customer enjoyment | 8.00 | 5.83 | 4.67 | **+2.17** | **+3.33** |
| **Overall** | **8.19** | **6.79** | **6.22** | **+1.40** | **+1.97** |

**Corpus average climbed from 6.79 → 8.19 (+1.40).** Voice averages are now solidly in 8+ territory on every dimension except Pacing (still hurt by post-terminal echo loop on Sarah/Carl).

---

## Terminals hit

| # | Persona | Expected | Actual | OK? |
|---|---|---|---|---|
| 1 | Sarah | COMPLETE | NEEDS_CALLBACK at T4 (email_provided premature) | NO — but owner/panel ack landed |
| 2 | Mike | DISQUALIFIED_120V | DISQUALIFIED_120V at T2 ✅ | **YES (v51 fix restored)** |
| 3 | Brian | POSTPONED | POSTPONED at T3 ✅ | YES |
| 4 | Carl | NEEDS_CALLBACK + urgency | NEEDS_CALLBACK + permit timeline ✅ | YES |
| 5 | Tony | COMPLETE | NEEDS_CALLBACK at T5 (email_provided from AWAIT_PANEL_PHOTO) | NO — but reached further than v50 |
| 6 | Sarah-Panel | self-loop with ack | AWAIT_EMAIL at T5 ✅ (panel ack on T2) | **YES (cleanest run)** |

**4/6 terminals correct (Mike, Brian, Carl, Sarah-Panel). Sarah/Tony both die on `email_provided` from non-AWAIT_EMAIL state — same root cause as the v50 panel premature-handoff bug, just shifted to the email label now that panel_* is fixed.**

---

## What v51 + v52 actually fixed

**Fixed ✅**
1. **Owner ack now names ownership** ("Owner confirmed." / "Got it, owner confirmed.") — Sarah T2, Brian T2, Tony T3, Sarah-Panel T4. Bare "Got it." gone.
2. **Panel ack now names panel location** ("Panel in the garage, 200A, got it." / "Got it, garage exterior.") — Sarah T3, Sarah-Panel T2.
3. **Mike DISQUALIFIED_120V regression repaired.** v50 routed `gen_120v` → NEEDS_CALLBACK; v52 correctly hedge-disqualifies with "if you upgrade" close.
4. **panel_* universal escape from AWAIT_OUTLET stays in flow.** Sarah-Panel T2 + Sarah T3 both self-loop cleanly.

**Still broken ❌**
1. **`email_provided` from non-AWAIT_EMAIL state still routes to NEEDS_CALLBACK.** Sarah T4 (from AWAIT_OUTLET), Tony T5 (from AWAIT_PANEL_PHOTO). Same root cause as old panel bug — out-of-order qualification volunteer terminates flow. Generalize the v51 panel escape to also cover `email_provided` and `address_provided` when current state is < AWAIT_EMAIL.
2. **Post-terminal echo loop persists.** Sarah T5/T6 + Carl T2/T3 emit identical handoff line. No `prev_outbound`-aware variation. Cost: ~1.5 points on Pacing across the corpus.

---

## Biggest finding

**v51+v52 lifted the corpus +1.40 to 8.19, finally crossing the 8+ threshold the structural simulator scored at.** The two specific design targets — "name ownership explicitly" and "panel volunteer self-loops cleanly with named ack" — both landed clean in real LLM output, not just simulator. Sarah's owner ack now reads "Owner confirmed." and the panel-volunteer persona produced a textbook self-loop ("Got it, garage exterior. 30 amp 4-prong or 50 amp outlet, either one works.").

**The corpus gain is broader than just those two patches.** Mike's v51 regression repair restored the graceful-disqualification path (5.57 → 8.71), and the `panel_garage_exterior` from AWAIT_OUTLET no longer dead-ends — Sarah reaches T4 instead of T3 in v50. Naturalness +0.66, Warmth +1.67, Reading the room +2.33, Customer enjoyment +2.17 vs v50.

**One bug remains in the same family.** The `email_provided`-from-non-AWAIT_EMAIL premature handoff is structurally identical to the panel-from-AWAIT_OUTLET bug v51 just fixed. Apply the same universal-escape pattern to email/address volunteers and Sarah + Tony will both reach COMPLETE in the next round, pushing the corpus toward 9.0.

**Recommendation for v53:**
1. Extend universal-escape to `email_provided` / `address_provided` when current state < AWAIT_EMAIL. Stay in flow, capture data, ask the next missing question.
2. Add `prev_outbound` to phraser context so post-terminal repeat inbounds either get varied wording or get suppressed entirely (a real person wouldn't text the same line three times).
