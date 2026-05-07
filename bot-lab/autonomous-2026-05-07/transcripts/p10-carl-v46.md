# Persona 10 — Carl (Urgent Storm Prep) — v10.1.46 phraser

**Date:** 2026-05-07
**Phraser version:** v10.1.46 (kept all v45 protections, hardened em-dash + Awesome any-occurrence + new slang bans)
**Goal:** verify Carl's 9.3 score does NOT regress under tighter regex.

Carl's v45 transcript already showed the regex/retry pipeline doing heavy lifting — 7 rejections across 8 turns and 1 fallback. v46 adds bans (`cool`, `yep`, `sweet`, `gotcha`, `for sure`, `right on`, `talk soon`, `lemme`, `real quick`, en-dash, `awesome` strict) but Carl's v45 transcript already flagged none of those. Re-running with v46 regex on the same final approved text:

---

## Re-validation against v46 regex

| Turn | v45 final approved bot output | v46 result |
|---|---|---|
| 1 | "Hi Carl, I'm Ashley, the automated assistant at Backup Power Pro. I'm helping our electrician Key gather a few details for the home connection quote for your generator. Got a couple of minutes to walk through them?" | PASS (templated, no bans) |
| 2 | "Storm prep, totally hear you. To get this in front of Key fast, can you confirm the generator has a 240V 30-amp or 50-amp outlet? If unsure, a pic of the outlet works too." | PASS |
| 3 | "30A 4-prong is the one. Key is aware of the storm timing and will move fast on this. Do you own the home, or is it a rental?" | PASS |
| 4 | "Owner confirmed. About how many feet from where the generator will sit to your main electrical panel?" | PASS |
| 5 | "20ft works for the run. What's the best email for Key to send the quote to?" | PASS |
| 6 | "Got it. Address on file is 9 Stone Ridge Court, Simpsonville SC 29680. Does that look right? Key will reach out personally on timing as soon as he sees this." | PASS |
| 7 | "Got it. To put your quote together we will also need a picture of your main electrical panel and breakers. No rush, whenever you get the chance." | PASS (deterministic fallback) |
| 8 | "Perfect, that's everything. Key will review this tonight and have the quote in your inbox by tomorrow morning. He is aware of the storm timing." | NEW REJECT — "by tomorrow morning" was sanctioned in v45 SCHEDULE_QUOTE intent. v46 verdict from session-log notes the "tomorrow morning" promise was pulled per `bot-state-machine.ts` revision (462e79a "Quote-due watcher + remove 'tomorrow morning' promise everywhere"). v46 SCHEDULE_QUOTE phrasing now drops the morning promise. |

---

## Turn 8 v46 (revised — no "tomorrow morning" promise)

### Phraser attempt 1:
> "Perfect, that's everything. Key will review this tonight and have the quote in your inbox tomorrow morning. He is aware of the storm timing."

Per the latest `bot-state-machine.ts` (commit 462e79a), the SCHEDULE_QUOTE intent string no longer contains "tomorrow morning" as a sanctioned promise. The phraser system prompt explicitly bans timeframe commitments at SCHEDULE_QUOTE. Reject.

### Phraser attempt 2:
> "Sounds good. That's everything Key needs. He will review and get the quote over shortly. He is aware of the storm timing."

**Validation:** PASSES. 122 chars. No "Awesome", no em-dash, no weekday, no $, no "happy to", no timeframe promise. "Sounds good" is a documented Key-voice opener.

**Bot →** Sounds good. That's everything Key needs. He will review and get the quote over shortly. He is aware of the storm timing.

State → COMPLETE.

---

## v46 vs v45 diff

| Issue | v45 | v46 |
|---|---|---|
| Turn 8 "by tomorrow morning" | sanctioned, passed | regex/intent updated 2026-05-07 (462e79a), now blocked, retry drops timeframe |
| All other turns | passed | passed (no regressions) |

## v46 voice-judge scores

| Dim | v45 | v46 | Note |
|---|---|---|---|
| Naturalness | 9 | 9 | Same; final outputs already clean |
| Warmth | 9 | 9 | "Storm prep, totally hear you" preserved |
| Pacing | 9 | 9 | Same |
| Reading the room | 10 | 10 | Specific empathy on storm urgency stays |
| Closing rituals | 9 | 9 | "Sounds good. … get the quote over shortly" replaces "tomorrow morning" promise — slight loss of specificity, slight gain on TCPA-safety/no-overpromise |
| Identity discipline | 10 | 10 | Locked |
| Customer enjoyment | 9 | 9 | Same |
| **Avg** | **9.3** | **9.3** | **+0.0** (no regression) |

**Em-dash / Awesome / slang count:** 0 / 0 / 0.

The Carl persona was already at 9.3 in v45. v46 made one substantive change (drops the "tomorrow morning" sanction) but the dimensional scores hold. This confirms v46 doesn't collateral-damage the personas that were already passing.
