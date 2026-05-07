# Voice Judge Verdict — autonomous-2026-05-07

**Judge:** voice-judge-agent.md (7 dimensions, target ≥9.0/10 average per dim)
**Transcripts:** 18 (incl. 3 v40 re-tests)
**Date:** 2026-05-07

---

## Per-transcript scores

| Transcript | Nat | Warm | Pace | Read | Close | ID | Enjoy | Avg |
|---|---|---|---|---|---|---|---|---|
| p01-sarah | 8 | 8 | 8 | 8 | 9 | 10 | 8 | 8.4 |
| p01-sarah-v40 | 9 | 8 | 9 | 8 | 9 | 10 | 9 | 8.9 |
| p02-mike | 7 | 9 | 9 | 9 | 9 | 10 | 8 | 8.7 |
| p03-don | 9 | 9 | 10 | 10 | 10 | 10 | 9 | 9.6 |
| p03-don-v40 | 9 | 9 | 10 | 10 | 10 | 10 | 9 | 9.6 |
| p04-patricia | 8 | 8 | 8 | 9 | 8 | 10 | 8 | 8.4 |
| p06-diana | 8 | 8 | 9 | 9 | 8 | 10 | 8 | 8.6 |
| p06-diana-v40 | 7 | 7 | 8 | 8 | 8 | 10 | 7 | 7.9 |
| p09-brittney | 7 | 8 | 9 | 9 | 6 | 10 | 7 | 8.0 |
| p10-carl | 6 | 7 | 8 | 7 | 7 | 10 | 7 | 7.4 |
| p11-tony | 8 | 8 | 9 | 9 | 9 | 10 | 9 | 8.9 |
| p12-greg | 9 | 8 | 9 | 9 | 9 | 10 | 9 | 9.0 |
| p14-brad | 9 | 9 | 9 | 9 | 9 | 10 | 9 | 9.1 |
| p15-nate | 9 | 8 | 10 | 10 | 9 | 10 | 9 | 9.3 |
| p16-linda | 9 | 9 | 9 | 10 | 10 | 10 | 9 | 9.4 |
| p17-tom | 9 | 9 | 9 | 9 | 9 | 10 | 9 | 9.1 |
| p18-pat | 8 | 9 | 9 | 9 | 8 | 10 | 8 | 8.7 |
| p23-wendy | 9 | 10 | 9 | 10 | 9 | 10 | 9 | 9.4 |

## Per-dim averages (across 18)

| Dimension | Average | Clears 9.0? |
|---|---|---|
| Naturalness | 8.22 | NO |
| Warmth | 8.39 | NO |
| Pacing | 8.94 | NO (just barely) |
| Reading the room | 9.00 | YES |
| Closing rituals | 8.67 | NO |
| Identity discipline | 10.00 | YES |
| Customer enjoyment | 8.39 | NO |
| **Overall** | **8.80** | **NO** |

## Sub-7.0 flags (per-dim)

- **p10-carl Naturalness 6/10** — "I just wanted to confirm" (banned desperation tell), "I would be happy to" (SaaS phrasing), "I appreciate your patience" (ANTI-1).
- **p09-brittney Closing 6/10** — "Awesome." opener at SCHEDULE_QUOTE (ANTI-7) + 👍 emoji emission.

## Top 3 anti-pattern instances (verbatim)

1. **ANTI-1 "I appreciate" mid-flow** — p10-carl T5: *"I appreciate your patience Carl."* Also p04-patricia T0: *"thanks for filling out the form"* is fine, but p10 stacks it. Banned per `04-avoid-list.md` corporate-speak section.

2. **ANTI-15/desperation tell "I just wanted to"** — p10-carl T2: *"Perfect. I just wanted to confirm that it has a 240 volt 30 amp or 50 amp outlet on it. If you are unsure you can send a picture of the outlets whenever you get a chance."* Hits banned "I just wanted to" + "I would be happy to" + over-formal "If you are unsure" register. Worst offender of the batch.

3. **ANTI-7 "Awesome." + emoji** — p09-brittney T8: *"Awesome. Key will have the quote over to you by tomorrow morning. He'll text you back from this same number 👍"* Double violation — banned opener + bot-led emoji (CLAUDE.md "no emoji ever").

Honorable mentions: ANTI-2 mid-flow exclamation `!` in p14-brad T6 ("Awesome — Key will work it up..."), p06-diana-v40 ANTI-1 "appreciate the details" twice across branches, p17-tom T7 "Awesome —" RECAP opener.

## Top 3 prompt-engineering tunes

1. **`bot-phraser/system-prompt.ts` — harden REJECT_PATTERNS.** Add `\bI just want(ed)? to\b`, `\bI would be happy\b`, `\bI appreciate (your|the|you)\b`, and `\bAwesome\b(?!\s+question)` (allow only "Awesome question" if at all). p10-carl alone produced 3 violations the regex should have caught. **Before:** "Perfect. I just wanted to confirm…" **After:** "Perfect. Quick check — does it have a 240V 30A or 50A outlet?"

2. **`bot-phraser/system-prompt.ts` — emoji = hard zero, not "≤1 when mirrored".** Override the `acknowledge_emoji=true` mirror rule. Key's voice corpus contains zero bot-led emoji. Strip all emoji in post-processing, even when customer led with one. **Before:** "He'll text you back from this same number 👍" **After:** "He'll text you back from this same number."

3. **SCHEDULE_QUOTE / RECAP openers — kill "Awesome." entirely, rotate Key's real openers.** Three transcripts (p09, p14, p17) all opened the SCHEDULE_QUOTE turn with "Awesome." The phraser is over-rotating on it. Lock rotation to Key's documented set: "Perfect." / "Sounds good." / "Got it." / "Thank you." / "Ok." (per `03-my-voice.md`). **Before:** "Awesome. Key will have…" **After:** "Sounds good. Key will have…"

Bonus tune: **`detectedOutOfArea` DQ message in p06-diana-v40** softened too far — "appreciate the details" + "I'll pass this to Key in case he can refer you" reads slightly performative. Tighten to: "Belton's outside our area. We cover Greenville, Spartanburg, Pickens. Wishing you luck finding someone local."

---

## Verdict: DO NOT SHIP — three quick fixes away

Ashley clears 9.0 only on `Reading the room` (9.00) and `Identity discipline` (10.00). Five dims sit between 8.2–8.9. The pattern is consistent and fixable: a small set of recurring phrases ("I appreciate", "I just wanted to", "Awesome.", "I would be happy to", one stray emoji) drag every other dim down. Land the three regex tunes above and the next batch should clear 9.0 across all 7.

Worst single transcript: **p10-carl (7.4 avg)** — full of desperation tells under storm-urgency stress. Best: **p03-don (9.6)** — STOPPED state's null-outbound is unscoreable warmth, but the disclosure copy in branch B is excellent.
