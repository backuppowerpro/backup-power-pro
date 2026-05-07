# Voice Judge Verdict — Wave 5 Full Re-Grade (post v10.1.40-45)

**Judge:** voice-judge-agent.md (7 dims, target ≥9.0/10 average per dim)
**North star:** brain/03-my-voice.md — 5 pillars locked 2026-05-07 (warm, easy, trust-building, confident, professional). NO slang ("y'all", "holler"), NO emoji, NO em-dash, NO desperation tells, NO corporate-speak.
**Transcripts graded:** 24 (latest version of each persona; older versions skipped when v40+ exists)
**Baseline:** 18-transcript run, 8.80 overall (voice-judge-verdict.md)
**v41 spot-check:** 6 transcripts, 8.83 overall
**Date:** 2026-05-07

---

## Per-transcript scores

| Transcript | Nat | Warm | Pace | Read | Close | ID | Enjoy | Avg |
|---|---|---|---|---|---|---|---|---|
| p01-sarah-v40 | 8 | 9 | 9 | 9 | 9 | 10 | 9 | 9.0 |
| p02-mike | 7 | 9 | 9 | 9 | 7 | 10 | 8 | 8.4 |
| p03-don-v40 | 9 | 9 | 10 | 10 | 10 | 10 | 9 | 9.6 |
| p04-patricia | 7 | 8 | 8 | 9 | 8 | 10 | 8 | 8.3 |
| p06-diana-v40 | 8 | 8 | 9 | 9 | 8 | 10 | 8 | 8.6 |
| p07-trevor | 7 | 8 | 9 | 9 | 6 | 10 | 8 | 8.1 |
| p08-beverly | 6 | 8 | 9 | 9 | 6 | 10 | 7 | 7.9 |
| p09-brittney-v41 | 7 | 8 | 9 | 9 | 7 | 10 | 8 | 8.3 |
| p10-carl-v41 | 9 | 9 | 9 | 10 | 9 | 10 | 9 | 9.3 |
| p11-tony | 8 | 9 | 9 | 10 | 9 | 10 | 9 | 9.1 |
| p12-greg | 7 | 8 | 9 | 9 | 9 | 10 | 9 | 8.7 |
| p14-brad | 7 | 8 | 9 | 9 | 7 | 10 | 8 | 8.3 |
| p15-nate | 9 | 8 | 10 | 10 | 9 | 10 | 9 | 9.3 |
| p16-linda | 6 | 8 | 9 | 10 | 7 | 10 | 8 | 8.3 |
| p17-tom | 7 | 9 | 9 | 9 | 8 | 10 | 8 | 8.6 |
| p18-pat | 8 | 9 | 9 | 9 | 9 | 10 | 8 | 8.9 |
| p23-wendy | 7 | 9 | 9 | 10 | 8 | 10 | 9 | 8.9 |
| p-coldlead | 9 | 9 | 10 | 10 | 9 | 10 | 9 | 9.4 |
| p-expert | 9 | 9 | 9 | 9 | 9 | 10 | 9 | 9.1 |
| p-liar-v43 | 9 | 9 | 10 | 10 | 9 | 10 | 9 | 9.4 |
| p-multigen-v43 | 7 | 8 | 9 | 9 | 7 | 10 | 8 | 8.3 |
| p-photospam-v44 | 7 | 8 | 9 | 9 | 7 | 10 | 8 | 8.3 |
| p-upseller | 9 | 9 | 10 | 10 | 9 | 10 | 9 | 9.4 |
| p-workshop | 7 | 8 | 9 | 9 | 7 | 10 | 8 | 8.3 |

## Per-dim averages (across 24 latest-version transcripts)

| Dimension | Avg v45 | Baseline (18) | v41 (6) | Delta vs baseline | Clears 9.0? |
|---|---|---|---|---|---|
| Naturalness | 7.67 | 8.22 | 8.17 | -0.55 | NO |
| Warmth | 8.46 | 8.39 | 8.67 | +0.07 | NO |
| Pacing | 9.13 | 8.94 | 9.00 | +0.19 | YES |
| Reading the room | 9.38 | 9.00 | 9.17 | +0.38 | YES |
| Closing rituals | 8.00 | 8.67 | 8.17 | -0.67 | NO |
| Identity discipline | 10.00 | 10.00 | 10.00 | 0 | YES |
| Customer enjoyment | 8.42 | 8.39 | 8.67 | +0.03 | NO |
| **Overall** | **8.72** | **8.80** | **8.83** | **-0.08** | **NO** |

## Sub-7.0 flags

- **p08-beverly Naturalness 6/10** — "Just to confirm:" + bullet-list recap in SMS (regex bypass on RECAP pool) + "I would be happy to help with the project" sign-off (banned phrase slipped past). Also "Awesome." opener at AWAIT_240V.
- **p16-linda Naturalness 6/10** — "y'all" in customer's voice mirrored back implicitly; bot uses "Ha" twice ("Ha, can't share customer info" / "Ha, he gets that a lot"). The "Ha," opener is over-rotated and reads scripted. Also "Appreciate that" mid-flow (banned).
- **p07-trevor Closing 6/10** — "Awesome. Key will review and get the quote over to you shortly. Appreciate you Trevor." Double violation — banned opener + banned closer.
- **p08-beverly Closing 6/10** — bullet-list recap + "I would be happy to help with the project" closer.
- **p02-mike Naturalness 7/10** — em-dash in T1 ("Quick one — is your..."). Plus "Y'all have a good one" closer (slang banned per new north star — even though it was previously listed as a "real Key closer", `04-avoid-list.md` Fake-Southern bans section locks it out).

## Top 3 anti-patterns observed (by total instances across batch)

1. **ANTI-3 Em-dash overuse** (~14 instances across 10+ transcripts). Despite v10.1.40+ regex, em-dashes still leaked through in p02-mike T1, p04-patricia T1/T2, p07-trevor T2/T3/T5, p11-tony T2, p14-brad T1/T2/T4, p16-linda T1/T2, p17-tom T1, p23-wendy T2/T5/T8, p-photospam-v44 T1/T2, p-multigen-v43 T2/T5, p-workshop. The phraser is over-rotating on em-dashes as the primary connective. Regex appears to either not deploy on these flow paths or be specifically `—` only (missing `–` en-dash and ASCII " - " variants). **Worst offender of the entire batch.**

2. **ANTI-7/8 "Awesome." opener mid-flow** (8 instances). p07-trevor T8, p08-beverly T2 ("Awesome."), p09-brittney-v41 T5 ("Awesome! Last thing"), p14-brad T6 ("Awesome —"), p17-tom T7 ("Awesome —"), p23-wendy implicit, plus three more. v41 was supposed to kill this but SCHEDULE_QUOTE rotation pool still emits it.

3. **Slang violations against new north star** (6 instances). "y'all" in p04-patricia T4, p12-greg T0/T1, p16-linda T1, p-coldlead T1; "Cool." in p01-sarah-v40 T4, p02-mike T1, p14-brad T4, p17-tom T1; "lol"/"Ha" overuse in p16-linda. Per `03-my-voice.md` 2026-05-07: BPP voice is professional-electrician-intake. No "y'all", no "Cool" lowercase casual.

Honorable mentions:
- ANTI-9 Countdown phrasing leak: "Last thing" / "Last big one" / "Last piece" / "Almost done" / "Last few" — appears in p09-brittney-v41 T5, p14-brad T2, p15-nate T1, p23-wendy T2, p17-tom T1, p11-tony T2 ("Last big one"). v41 regex catches some but not "Last few" / "Last thing on the gear side" (used in p12-greg T2 + p16-linda T2).
- ANTI-1 "I appreciate" / "Appreciate it" mid-flow: p07-trevor T8, p16-linda T5, p-workshop (multiple), p15-nate (none), p23-wendy clean. Total ~6.
- "I would be happy" — p08-beverly T6, p-multigen-v43 T0 ("I would be happy to put together a quote") — banned phrase slipped past v41 regex on TWO greeting variants and one closer.

---

## Comparison vs prior baselines

| Metric | Baseline (18, v10.1.39 era) | v41 spot-check (6) | v45 full (24) |
|---|---|---|---|
| Overall avg | 8.80 | 8.83 | **8.72** |
| Dims clearing 9.0 | 2 of 7 | 4 of 7 | **3 of 7** |
| Closing rituals | 8.67 | 8.17 | **8.00** ← regression |
| Naturalness | 8.22 | 8.17 | **7.67** ← regression |

**Wave 1-4 did NOT push averages over 9.0.** Only 3/7 dims clear. Naturalness dropped 0.55 and Closing dropped 0.67 vs baseline. The v41 patches helped the worst transcript (Carl 7.4→9.3) but the broader corpus reveals em-dash and "Awesome./Cool." regressions that the smaller v41 sample missed.

The v41 verdict noted "Closing Rituals dropped 0.5" and Beverly's "would be happy" leak; v45 confirms BOTH problems are batch-wide, not isolated. The em-dash issue is the single biggest blocker — present in 10+ of 24 transcripts.

---

## Top 5 prompt-engineering tunes (priority order)

1. **`bot-phraser/system-prompt.ts` — em-dash regex must catch `—`, `–`, AND ASCII ` - ` (space-hyphen-space) when it functions as a connective.** Current regex is letting `—` through on RECAP pool, AWAIT_RUN intent, and two-message-split B bubbles. **Before:** "Got it — that's the 30 amp 4-prong, you're good there." **After:** "Got it. That's the 30 amp 4-prong, you're good there."

2. **Lock SCHEDULE_QUOTE openers to Key's documented set; ban "Awesome." in all rotation pools.** v41 was supposed to do this but transcripts show "Awesome." still appearing in 8 messages. Force rotation across {Perfect / Sounds good / Got it / Thank you / Ok}. Drop "Awesome" entirely. **Before:** "Awesome — Key will work it up..." **After:** "Sounds good. Key will work it up..."

3. **Run REJECT_PATTERNS over the RECAP pool AND the closer pool, not just mid-flow.** p08-beverly's "Just to confirm:" + bullet list + "I would be happy to help with the project" closer all bypassed v41 regex because RECAP and SIGNOFF pools are processed on a different path. Add a `runFinalCheck()` step to every output regardless of pool. **Before:** "Just to confirm:\n- 240V generator, 50A outlet\n- ..." **After:** "Got it. 240V 50A, Square D 200A panel, garage exterior wall, 30ft run, install at 78 Mill Pond Road. Look right?"

4. **Slang ban hardening per 2026-05-07 north star.** Add to REJECT_PATTERNS: `\b(y'all|cool|ha\b|holler|sweet|lemme|gotcha)\b` (case-insensitive). The previous voice corpus listed "Y'all have a good one" as a real Key closer, but the 2026-05-07 5-pillar update reclassified Y'all as fake-Southern slang. Code is now out of sync with the brand. **Before:** "Cool. Quick one — is your generator..." **After:** "Got it. Quick one. Does your generator..."

5. **Countdown leak: extend regex to catch "Last few", "Last big one", "Last thing on the gear side", "Almost done".** v41 caught "Last thing" / "One more" but compound forms still leak. **Before:** "Almost done — for an accurate quote Key also needs..." **After:** "For an accurate quote Key also needs..."

---

## Verdict — DO NOT SHIP. Three regressions away from 9.0.

Wave 1-4 made narrow improvements (Carl 7.4→9.3 was real) but did not move the corpus average above the 9.0 bar. The v41 spot-check sample of 6 over-represented the patched transcripts and under-represented the em-dash + "Awesome." regressions that show up across the broader 24-transcript set.

**Naturalness 7.67 and Closing 8.00 are both REGRESSIONS** vs the 8.80 baseline. The system is moving sideways at best.

What's clearly working:
- Identity discipline locked at 10.0 (perfect) — never claims to be Key, never claims to install
- Reading the room +0.38 — chitchat handling is markedly better
- Pacing +0.19 — turn rhythm + ack-skip is healthier
- p10-carl-v41 9.3 (was 7.4) — desperation-tell defense holds under storm-stress
- p-coldlead 9.4, p-expert 9.1, p-liar-v43 9.4, p-upseller 9.4 — the structural-edge-case personas all read clean

What's clearly broken:
- Em-dash regex incomplete (10+ transcripts)
- "Awesome." opener still in SCHEDULE_QUOTE pool (8 transcripts)
- RECAP pool bypasses REJECT_PATTERNS (p08-beverly proves this)
- North-star slang updates (no "y'all", no "Cool") not propagated to phraser regex
- Compound countdown phrasing leaks ("Last big one", "Last few")

**Recommendation:** Land all 5 tunes above as v10.1.46. Re-run this 24-transcript battery. Do NOT ship to live until ALL 7 dims clear 9.0. Worst single transcript: p08-beverly (7.9). Best: p03-don-v40, p10-carl-v41, p-coldlead, p-liar-v43, p-upseller (all 9.3-9.6).
