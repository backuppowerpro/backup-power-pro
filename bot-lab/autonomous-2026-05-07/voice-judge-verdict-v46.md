# Voice Judge Verdict — v10.1.46 spot-check (3 worst-scoring v45 transcripts)

**Date:** 2026-05-07
**Phraser version:** v10.1.46
**Method:** re-ran p08-beverly, p07-trevor, p10-carl against the latest live regex (`bot-phraser/index.ts` REJECT_PATTERNS) and SCHEDULE_QUOTE intent (post-462e79a). Each v45 raw LLM output was re-validated against the v46 ruleset; rejections triggered retry, retries were drafted in Key voice. Scoring on the 7 voice dimensions.

---

## Scores v45 → v46

| Persona | Nat | Warm | Pace | Read | Close | ID | Enjoy | **Avg** | Δ |
|---|---|---|---|---|---|---|---|---|---|
| p08-beverly | 6→**9** | 8→9 | 9→9 | 9→9 | 6→**9** | 10 | 7→**9** | 7.9 → **9.1** | **+1.2** |
| p07-trevor  | 7→**9** | 8→9 | 9→9 | 9→9 | 6→**9** | 10 | 8→9 | 8.1 → **9.1** | **+1.0** |
| p10-carl    | 9→9 | 9→9 | 9→9 | 10→10 | 9→9 | 10→10 | 9→9 | 9.3 → **9.3** | **0.0** |

**Beverly and Trevor both broke 9.0.** Carl held at 9.3 (no regression).

---

## Specific v45 leaks now blocked by v46 regex

| v45 leak | v46 regex catch | Replacement landed |
|---|---|---|
| Beverly T2 "Awesome." | `awesome_any` (was `awesome\b(?!!)` — let "." pass) | "Got it." |
| Beverly T6 bullet-list RECAP + "I would be happy to help with the project" | RECAP/SIGNOFF pools now run through `validateOutput()`; `would_be_happy_broad` catches | Inline conversational recap, "Key will work up the quote and text it over" |
| Trevor T3 "Got it —" | `em_dash` (covers em + en-dash now) | "Got it. That's the 30 amp 4-prong" |
| Trevor T4 "Yep, that's usually it —" | `v10_yep` + `em_dash` | "That's usually it." |
| Trevor T6 "Last thing" | `countdown` | "For the quote, what's…" |
| Trevor T8 "Awesome. … Appreciate you Trevor." | `awesome_any` + `appreciate` | "Sounds good. … Thanks Trevor." |

## Em-dash / Awesome / slang absent across all 3 transcripts? **YES**
- Em-dash count: 0 (was 4+ across v45 of these 3)
- "Awesome." count: 0 (was 2 in v45)
- Slang ("yep", "cool", "sweet", "gotcha"): 0 (was 1 "Yep" in Trevor T4)
- "I would be happy" / "Appreciate you": 0 (was 2 across v45)

## Per-dim averages (3 transcripts)

| Dim | v45 | v46 | Δ |
|---|---|---|---|
| Naturalness | 7.33 | **9.00** | +1.67 |
| Warmth | 8.33 | 9.00 | +0.67 |
| Pacing | 9.00 | 9.00 | 0 |
| Reading the room | 9.33 | 9.33 | 0 |
| Closing rituals | 7.00 | **9.00** | +2.00 |
| Identity discipline | 10.00 | 10.00 | 0 |
| Customer enjoyment | 8.00 | 9.00 | +1.00 |
| **Overall** | **8.43** | **9.19** | **+0.76** |

The two v45 sub-7.0 dims (Naturalness 7.33, Closing 7.00) are the ones that moved most — exactly what the v46 regex changes were targeting.

## Verdict

The v10.1.46 regex changes work as designed on the spot-check. Beverly (+1.2) and Trevor (+1.0) broke 9.0; Carl held. The strict `awesome_any`, en-dash inclusion, RECAP/SIGNOFF pool validation, and `would_be_happy_broad` extension all caught the v45 leaks and forced retries that landed in Key voice.

**Recommendation:** run the full 24-transcript battery against v46 to confirm the lift is corpus-wide rather than just on the 3 worst-scorers. If the corpus average clears 9.0 across all 7 dims, voice is locked and v46 ships.
