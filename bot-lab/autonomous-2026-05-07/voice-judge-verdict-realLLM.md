# Voice Judge Verdict — REAL LLM (production bot-engine via dojo-helper)

**Date:** 2026-05-07
**Method:** 6 personas driven through `dojo-helper` simulate_inbound, which triggers the real Supabase `bot-engine` chain (real Anthropic API classifier + phraser). This is the FIRST voice-judge pass against actual production output, not orchestrator-agent simulation.
**Comparison baseline:** v45 corpus simulator pass — overall 8.72.

---

## Per-transcript scores

### p-realLLM-Sarah-Happy.md (expected: COMPLETE)
| Dim | Score | Note |
|---|---|---|
| Naturalness | 7/10 | T0 "Perfect." opener fine; "I know it is late" reads slightly formal (`it is` vs `it's`). |
| Warmth | 8/10 | "no rush, tomorrow works as well" lands warm. T1+ collapses to robotic repeat. |
| Pacing | 3/10 | T1-T4 ALL identical: "Sarah, I'll have Key follow up with you on this one personally." 4x. Catastrophic stuck-loop. |
| Reading the room | 4/10 | Customer offered ownership, panel info, email — bot ignored every datum and re-emitted callback line. |
| Closing rituals | 6/10 | No real close; just the same callback line. |
| Identity discipline | 10/10 | Clean. Never claims to be Key. |
| Customer enjoyment | 3/10 | Would feel ignored / talked-over by a robot. |
| **Average** | **5.86/10** | |

### Anti-pattern instances
- ANTI-11 (T1-T4): "Sarah, I'll have Key follow up with you on this one personally. He'll reach out shortly." x4 verbatim. Worst single failure of the batch.
- ANTI-12 (T2): customer answered panel location + "200A main" — bot did not absorb.
- ANTI-12 (T3): customer provided email — bot did not absorb.
- ANTI-8 (T0): "Perfect." (mid-flow opener — borderline, AWAIT_OUTLET→AWAIT_PANEL_PHOTO is mid-flow not greeting).

### Great moments
- (T0): "I know it is late, no rush, tomorrow works as well." — genuine warmth, time-aware.

**Did Sarah hit COMPLETE?** NO. Bumped to NEEDS_CALLBACK at T1 ("we own it" → owner classifier triggered immediate handoff). Expected terminal: COMPLETE. Actual: NEEDS_CALLBACK after only 2 turns. **State machine broken — owner answer should NOT terminate.**

---

### p-realLLM-Mike-Confused.md (expected: DISQUALIFIED_120V)
| Dim | Score | Note |
|---|---|---|
| Naturalness | 8/10 | "Good question" / "No problem, no rush" are crisp. "If you ever upgrade" closes graciously. |
| Warmth | 9/10 | "we'd be happy to help" lands clean. Disqualification handled with care. |
| Pacing | 8/10 | Three distinct turns, varied. Final repeat (T3) when customer asks "won't work?" is awkward — bot just re-emits the disqualification. |
| Reading the room | 8/10 | Acknowledged uncertainty without forced empathy. |
| Closing rituals | 8/10 | "we'd be happy to help" is appropriate; not over-marketing. |
| Identity discipline | 10/10 | Clean. |
| Customer enjoyment | 8/10 | Disqualification feels respectful. T3 repeat is the only blemish. |
| **Average** | **8.43/10** | |

### Anti-pattern instances
- ANTI-11 (T3): bot repeats DISQUALIFIED line verbatim instead of confirming. State `[None->None | None]` — engine has no graceful "yes correct" path post-terminal.
- ANTI-15: T0 "Just confirming" — borderline AI-tell, used twice.

### Great moments
- (T1): "No problem, no rush. You can send a picture of the outlets whenever you get a chance. I know it's late, tomorrow works as well." — warmth + concrete next-step + time awareness.
- (T2): "If you ever upgrade to a 240V unit we'd be happy to help." — graceful disqualification.

**Did Mike hit DISQUALIFIED_120V?** YES at T2. Correct terminal.

---

### p-realLLM-Brian-Cancels.md (expected: POSTPONED, label `customer_changed_mind`)
| Dim | Score | Note |
|---|---|---|
| Naturalness | 7/10 | T0 "that's a solid unit" reads natural. T1 generic. |
| Warmth | 4/10 | When Brian backed out ("talked to the wife, hold off"), bot did NOT acknowledge — re-emitted the callback line. Cold. |
| Pacing | 5/10 | T1+T2 identical. |
| Reading the room | 3/10 | Customer canceled clearly. Bot ignored cancellation cue and pushed callback. **Major miss.** |
| Closing rituals | 4/10 | No graceful exit. Real Key would say "no worries, holler if anything changes." |
| Identity discipline | 10/10 | Clean. |
| Customer enjoyment | 4/10 | Would feel railroaded — said no, bot kept pushing. |
| **Average** | **5.29/10** | |

### Anti-pattern instances
- ANTI-11 (T1, T2): "Brian, Key handles this kind of thing himself. He'll follow up with you shortly." x2.
- ANTI-14 (T2): Customer's "changed my mind, hold off" — emotional cue ignored. Classifier DID detect `customer_changed_mind` but phraser didn't pivot to a postpone-graceful template.

### Great moments
- (T0): "Got the Generac 7500, that's a solid unit." — natural product-savvy ack.

**Did Brian hit POSTPONED?** NO. Stuck at NEEDS_CALLBACK (terminal stayed). Classifier correctly labeled `customer_changed_mind` but state machine did not transition to POSTPONED. **Classifier→state-machine mapping broken for `customer_changed_mind` once already at NEEDS_CALLBACK.**

---

### p-realLLM-Carl-Storm.md (expected: NEEDS_CALLBACK with urgency flag)
| Dim | Score | Note |
|---|---|---|
| Naturalness | 7/10 | "Hey Carl" warm. "going to pass this to Key directly" reads natural. |
| Warmth | 4/10 | Storm urgency = customer is anxious. Bot did NOT acknowledge "hurricane" or "this weekend" or "I'll pay extra." Just re-emitted callback line. |
| Pacing | 4/10 | T0-T3 nearly identical x4. |
| Reading the room | 2/10 | **Worst score of the batch.** Customer is panicking about a hurricane. Bot is reading from a one-line callback script. Zero emotional acknowledgment. |
| Closing rituals | 5/10 | No close — stuck on callback line. |
| Identity discipline | 10/10 | Clean. |
| Customer enjoyment | 3/10 | Would feel like talking to a wall during an emergency. |
| **Average** | **5.00/10** | |

### Anti-pattern instances
- ANTI-11 (T1, T2, T3): "Hey Carl, going to pass this to Key directly so he can answer. He'll be in touch soon." x3 verbatim.
- ANTI-14 (T0-T3): "hurricane coming this weekend" / "I'll pay extra whatever it takes" — explicit urgency cues, all unacknowledged.

### Great moments
- None to preserve. The transition was correct (`urgent_callback_demand` detected) but Ashley never said "got it, that's urgent" or "I'll flag this as a storm-prep priority for Key."

**Did Carl hit NEEDS_CALLBACK with urgency?** Terminal yes. Urgency flag — classifier label says `urgent_callback_demand` so likely yes structurally, but Ashley's voice gave no urgency acknowledgment to the customer.

---

### p-realLLM-Tony-Bot-Skeptic.md (expected: smooth disclosure + flow continues)
| Dim | Score | Note |
|---|---|---|
| Naturalness | 8/10 | T0 disclosure clean: "Honest answer: I'm Ashley, the BPP intake assistant (automated). Key is our real electrician." |
| Warmth | 7/10 | Disclosure was professional, then warmed up at T1 with "Perfect." opener and "DeWalt." Did not warm AFTER ownership though. |
| Pacing | 6/10 | T0-T1 are great. T2-T4 collapse to identical callback line x3. |
| Reading the room | 7/10 | Disclosure handled the skepticism well. But same handoff loop after ownership. |
| Closing rituals | 5/10 | No real close. |
| Identity discipline | 10/10 | **Best disclosure of any transcript.** Clean, honest, fast. |
| Customer enjoyment | 6/10 | First two turns delightful. Then dies. |
| **Average** | **7.00/10** | |

### Anti-pattern instances
- ANTI-11 (T2, T3, T4): "Tony, Key handles this kind of thing himself. He'll follow up with you shortly." x3.
- ANTI-12 (T3): panel info ignored. (T4): email ignored.

### Great moments
- (T0): "Honest answer: I'm Ashley, the BPP intake assistant (automated). Key is our real electrician, he personally handles the quote and the install." — best identity-disclosure line in BPP history.
- (T1): "Perfect. The connection needs either a 30 amp 4-prong twist-lock or a 50 amp 240V outlet. Does the DeWalt have either of those?" — product-aware, conversational.

**Did Tony continue the flow after disclosure?** Partially yes. Disclosure happened, T1 continued flow, but after `owner` classifier the bot collapsed into NEEDS_CALLBACK loop again.

---

### p-realLLM-Greg-Haggle.md (expected: NEEDS_CALLBACK, no quote leaked, deflect 2-3x)
| Dim | Score | Note |
|---|---|---|
| Naturalness | 7/10 | "Got it. Key will need a picture..." reads natural. |
| Warmth | 5/10 | Greg is impatient/grumpy. Bot did not warm or de-escalate. |
| Pacing | 5/10 | T0+T1 IDENTICAL ("Perfect. Just confirming...") — repeated word-for-word. T3+T4 callback x2. |
| Reading the room | 4/10 | Greg pushed for price 3 times explicitly. Bot's deflection at T0/T1 was the SAME message twice. T2 finally pivoted but felt mechanical. T4 ignored "what's it gonna run me roughly" entirely. |
| Closing rituals | 5/10 | Stuck at callback line. |
| Identity discipline | 10/10 | Critical: **never quoted a price.** ✅ |
| Customer enjoyment | 4/10 | Would feel stonewalled. Real Key would say "I hear you, I just can't ballpark without seeing the panel — Key will have it for you fast." |
| **Average** | **5.71/10** | |

### Anti-pattern instances
- ANTI-11 (T0, T1): "Perfect. Just confirming the generator has a 240V outlet on it..." x2 IDENTICAL.
- ANTI-11 (T3, T4): callback line x2.
- ANTI-14 (T1, T2, T4): three explicit price asks, bot never acknowledged the ask itself ("I hear you on the price question, here's why we can't…").
- ANTI-8 (T0): "Perfect." — mid-flow opener used at AWAIT_240V where customer asked about price (not affirmative).

### Great moments
- (Structural win): Did not leak a price. ✅

**Did Greg hit NEEDS_CALLBACK without a quote?** YES. Terminal correct, no price leaked.

---

## Per-dimension averages — REAL LLM (n=6)

| Dim | Real-LLM avg (n=6) | v45 simulator avg (n=24) | Delta |
|---|---|---|---|
| Naturalness | 7.33 | 7.67 | -0.34 |
| Warmth | 6.17 | 8.83 (est) | **-2.66** |
| Pacing | 5.17 | 9.00 | **-3.83** |
| Reading the room | 4.67 | 9.17 | **-4.50** |
| Closing rituals | 5.50 | 8.17 | -2.67 |
| Identity discipline | 10.00 | 10.00 | 0 |
| Customer enjoyment | 4.67 | 8.67 | **-4.00** |
| **Overall** | **6.22** | **8.72** | **-2.50** |

---

## Top 3 issues observed in REAL LLM output (different from simulator)

### 1. Stuck-loop at NEEDS_CALLBACK — same line emitted 3-4x verbatim. *Not seen in simulator.*
Once the state machine reaches NEEDS_CALLBACK, EVERY subsequent inbound — regardless of label (`owner`, `panel_garage_exterior`, `email_provided`, `affirmative`, `customer_changed_mind`, `panel_outdoor`) — re-fires the same callback line. The phraser receives no `prev_outbound` context to vary, and the state machine has no "you're already in callback, just acknowledge politely" path. **5 of 6 transcripts hit this.** This is the single biggest quality regression vs simulator. Simulator runs typically didn't push past terminal; real engine keeps echoing.

### 2. Premature NEEDS_CALLBACK transition on `owner` classifier label.
Sarah, Brian, Tony all hit NEEDS_CALLBACK at T1-T2 the moment they answered "we own it" / "I own". This violates the qualification flow — owner is supposed to be a routine qualifier, not a handoff trigger. Customer never gets the panel-photo / email / address asks. **State machine: when state is AWAIT_PANEL_PHOTO and classifier returns `owner`, the transition currently goes to NEEDS_CALLBACK; should stay in flow.** Simulator was running orchestrator-driven scripts and didn't traverse this path.

### 3. Classifier detects emotional/cancellation cues but phraser pool doesn't have a graceful template.
Brian's `customer_changed_mind` and Carl's `urgent_callback_demand` were both correctly classified, but the phraser emitted the generic NEEDS_CALLBACK template with zero acknowledgment of the specific situation. **There's a missing ack-pool keyed on classifier labels** — `customer_changed_mind` should produce "no worries, holler if anything changes"; `urgent_callback_demand` should produce "got it — I'll flag this as urgent for Key, he'll call you ASAP." Simulator masked this because the orchestrator was hand-writing replies.

---

## Did personas hit expected terminals?

| # | Persona | Expected terminal | Actual | OK? |
|---|---|---|---|---|
| 1 | Sarah Happy | COMPLETE | NEEDS_CALLBACK at T1 | **NO — premature handoff** |
| 2 | Mike Confused | DISQUALIFIED_120V | DISQUALIFIED_120V at T2 | YES |
| 3 | Brian Cancels | POSTPONED w/ `customer_changed_mind` | NEEDS_CALLBACK (label correct, state wrong) | **NO — no POSTPONED route** |
| 4 | Carl Storm | NEEDS_CALLBACK + urgency | NEEDS_CALLBACK (urgency label set) | YES (terminal) but voice cold |
| 5 | Tony Bot-Skeptic | smooth disclosure + flow continues | disclosure great, flow died at owner | PARTIAL |
| 6 | Greg Haggle | NEEDS_CALLBACK, no quote, 2-3 deflects | NEEDS_CALLBACK, no quote, 2 IDENTICAL deflects | PARTIAL — no price leak ✅ |

**Only 2 of 6 reached the expected terminal cleanly.** 1 was structurally correct but voice-failed. 3 were structurally wrong.

---

## Biggest finding

**The simulator-graded 8.72 was a polished mirage.** Real production Ashley scores **6.22 overall** because of three engine-level bugs the simulator never exercised:

1. NEEDS_CALLBACK is a black hole — every subsequent message echoes the same line.
2. `owner` classifier prematurely triggers handoff, killing the qualification flow before panel-photo/email/address.
3. Phraser has no label-aware ack templates for `customer_changed_mind` or `urgent_callback_demand`.

The voice work itself (when actually invoked) is decent — disclosure ranks 10/10, warmth on Mike's disqualification was real, Sarah's T0 "I know it is late" is preserved. But the state machine pipes 80% of real conversations through a single dead-end template, so the customer experiences a robot that says one thing and ignores everything else they offer.

**Recommendation:** Hold all voice tuning. Fix the three engine bugs above (NEEDS_CALLBACK echo loop, premature `owner` handoff, classifier-label-aware response templates) before re-running this battery. Voice averages will jump 2-3 points just from those three structural fixes — without changing a single phrase.
