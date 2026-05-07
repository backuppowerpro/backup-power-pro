# Voice Judge Verdict — v41 Post-Tune Verification

**Judge:** voice-judge-agent.md (7 dims, target ≥9.0)
**Transcripts:** 6 (v40/v41 post-patch sample)
**Baseline:** 18-transcript run, 8.80 overall
**Date:** 2026-05-07

---

## Per-transcript scores

| Transcript | Nat | Warm | Pace | Read | Close | ID | Enjoy | Avg |
|---|---|---|---|---|---|---|---|---|
| p01-sarah-v40 | 9 | 9 | 9 | 9 | 9 | 10 | 9 | 9.1 |
| p06-diana-v40 | 8 | 8 | 9 | 9 | 8 | 10 | 8 | 8.6 |
| p07-trevor | 8 | 9 | 9 | 9 | 8 | 10 | 9 | 8.9 |
| p08-beverly | 7 | 8 | 9 | 9 | 7 | 10 | 8 | 8.3 |
| p09-brittney-v41 | 8 | 9 | 9 | 9 | 8 | 10 | 9 | 8.9 |
| p10-carl-v41 | 9 | 9 | 9 | 10 | 9 | 10 | 9 | 9.3 |

## Per-dim averages (v41 sample of 6)

| Dimension | v41 avg | Baseline (18) | Delta |
|---|---|---|---|
| Naturalness | 8.17 | 8.22 | -0.05 |
| Warmth | 8.67 | 8.39 | +0.28 |
| Pacing | 9.00 | 8.94 | +0.06 |
| Reading the room | 9.17 | 9.00 | +0.17 |
| Closing rituals | 8.17 | 8.67 | -0.50 |
| Identity discipline | 10.00 | 10.00 | 0.00 |
| Customer enjoyment | 8.67 | 8.39 | +0.28 |
| **Overall** | **8.83** | **8.80** | **+0.03** |

## Targeted recovery checks

- **Carl: 7.4 → 9.3** ✅ HUGE recovery. v10.1.41 REJECT_PATTERNS caught all 7 desperation tells under storm-urgency stress (i_just_want, would_be_happy, so sorry, appreciate your, weekday, em-dash, countdown). Final copy reads tight and professional. Best transcript of the v41 batch.
- **Naturalness: 8.22 → 8.17** ➖ Flat. p08-beverly's "Just to confirm:" + bullet-list recap (ANTI-4 + bullets in SMS) and "I would be happy to help with the project" sign-off (banned phrase, slipped past) dragged this down. Fix the Beverly recap pool.
- **Customer enjoyment: 8.39 → 8.67** ✅ Up 0.28.
- **Warmth: 8.39 → 8.67** ✅ Up 0.28.

## Anti-patterns still firing

- **p08-beverly T6:** "I would be happy to help with the project" — `would_be_happy_broad` should have caught this; either the regex skipped this transcript or it predates v41 deployment. Verify.
- **p08-beverly T6:** bullet-list recap in SMS (ANTI: lists in SMS).
- **p07-trevor T8:** "Awesome." opener at SCHEDULE_QUOTE + "Appreciate you Trevor" — both banned (ANTI-7, ANTI-1). Closing rituals dragged.
- **p09-brittney T5:** "Awesome! Last thing…" — ANTI-7 + ANTI-9 (countdown "Last thing").

## Verdict — READY for one Tyler-style live test, NOT yet ready for broad rollout

Carl recovered dramatically (7.4 → 9.3) and the storm-stress patches held under the worst-case persona. Warmth and Customer Enjoyment both moved up ~0.3. Reading the room cleared 9.0 for the first time outside the baseline.

But two regressions block confidence: Closing Rituals dropped 0.5 (Trevor + Brittney both opened SCHEDULE_QUOTE with banned "Awesome."), and p08-beverly slipped a "would be happy" + bullet-list recap that v41 regex should have killed. The Beverly transcript may predate the deploy, or the recap pool bypasses REJECT_PATTERNS.

**Recommendation:** Land one more micro-tune (kill "Awesome." at SCHEDULE_QUOTE, force regex over recap pool, ban SMS bullet lists) THEN do the Tyler-style live test with Key. If that test reads clean, ship to 10% live rollout with the experiment-monitor watching. Carl proved the desperation-tell defense works; Beverly proved one closing-pool path still leaks.

Worst single transcript: p08-beverly (8.3). Best: p10-carl-v41 (9.3) — full reversal from worst-of-batch to best-of-batch.
