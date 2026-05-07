# Ashley Autonomous Tuning Session, 2026-05-07

> Key left for a while and asked: "make Ashley the best bot she can be" via real-world simulations (not metrics).
> Returns to read this verdict before flipping the gate to clients.

---

## TL;DR

- 18 LLM-driven persona simulations ran end-to-end against live production prompts.
- **All 18 reached correct terminal state.** No structural failures.
- 7 production bugs surfaced and were fixed in three deploy waves (v10.1.40 + v10.1.41).
- Voice-judge across all transcripts: **overall 8.80/10**, 2 of 7 dims cleared 9.0 target. Five dims at 8.2-8.9. Need one more iteration to fully clear 9.0.
- Regression battery: 59/59 brutal scenarios PASS after every change wave.
- **NOT YET ready to flip ASHLEY_ALLOWED_PHONES = "*".** One more iteration round needed.

---

## What was tested (real-world, not metrics)

18 distinct personas, each running a multi-turn LLM-driven conversation against the live production bot-classifier + bot-phraser + bot-state-machine prompts:

| # | Persona | Terminal | Notes |
|---|---|---|---|
| 01 | Sarah, happy 240v owner | COMPLETE | Surfaced warmth-stacking + salesy-adjective bugs (FIXED, re-test PASS) |
| 02 | Mike, confused 120v | DISQUALIFIED_120V | Surfaced em-dash in prompt examples (ROOT-CAUSE FIXED) |
| 03 | Don, hostile | STOPPED | Bare "who is this" classifier bias (FIXED, re-test PASS) |
| 04 | Patricia, price-only | NEEDS_CALLBACK | Clean. Stuck-state cap deferred. |
| 06 | Diana, out-of-area | DISQUALIFIED_OUT_OF_AREA | oosaCities incomplete (FIXED, re-test PASS, 3 branches) |
| 09 | Brittney, emoji-heavy | COMPLETE | One emoji slip (FIXED via zero-emoji regex) |
| 10 | Carl, storm urgency | NEEDS_CALLBACK | Urgency handled cleanly, surfaced desperation-tells (FIXED) |
| 11 | Tony, bot-skeptic | COMPLETE | Both AI disclosures clean, conversation continued |
| 12 | Greg, price haggler | NEEDS_CALLBACK | Never quoted, varied redirects, composed |
| 14 | Brad, burst texter | COMPLETE | Burst handling worked, no info loss |
| 15 | Nate, impatient cooperator | COMPLETE | 6 turns, terse register matched cleanly |
| 16 | Linda, friendly chatter | COMPLETE | Warm-acked chitchat without losing thread |
| 17 | Tom, typo-heavy | COMPLETE | Email typo caught + corrected gracefully |
| 18 | Pat, mid-flow pivot | DISQUALIFIED_120V | Amendment path worked (classifier + state machine + phraser) |
| 23 | Wendy, wrong photo | COMPLETE | Meter-vs-panel correction graceful |

---

## Bugs fixed this session

### 1. Em-dashes embedded in production prompts (ROOT-CAUSE)
**The big one.** 483 em-dashes were embedded in production bot prompts:
- bot-phraser system-prompt.ts: 195
- bot-phraser system-prompt.txt: 194
- bot-classifier system-prompt.ts: 96
- bot-classifier system-prompt.txt: 95
- bot-photo-classifier prompts: 71
- bot-state-machine.ts: 98
- bot-engine + handoff + others: 44

The prompts were TEACHING the bot to use em-dashes via examples ("Cutler-Hammer panel — should be fine"), while REJECT_PATTERNS was rejecting outputs that contained them, causing constant fallback to deterministic state-machine text. Net effect: LLM-driven warmth was largely unavailable, conversations relied on baked-in fallback strings.

All stripped. LLM-driven warmth is now actually accessible.

### 2. Banned "Quote due by tomorrow morning." in handoff
Per your brain rule against time-of-day promises. Was still in `bot-handoff-notifier`. Replaced with "Quote pending. Send when ready."

### 3. Zero-emoji hard rule
Phraser regex was `{2,}` permitting one emoji. Brittney sim caught 👍. Tightened to any-occurrence. Key's voice rule is no bot-led emoji.

### 4. New desperation-tell bans
Voice-judge caught Carl under storm urgency producing:
- "I just wanted to confirm..."
- "I would be happy to get you in line"
- "I appreciate your patience"

All now hard-rejected via expanded REJECT_PATTERNS.

### 5. oosaCities incomplete
bot-engine's mid-conversation out-of-area detector was missing Belton, Williamston, Honea Path, Iva, Pendleton (Anderson County) plus Oconee/Cherokee/Laurens/Greenwood city stubs. A customer typing those mid-conversation would slip past detection. Synced with sc-jurisdictions.json.

### 6. Classifier bias for bare "who is this"
Was routing to `asking_for_context` (sending one wasted memory-jog reply before STOP). Now defaults to `not_my_lead` when no context markers present. Conservative bias = better TCPA posture.

### 7. Phraser warmth-stacking + AWAIT_INLET_LOCATION evaluative ban
- Multi-slot inbounds (brand+model + outlet) no longer fire micro-color on both. Stacking reads warmer than Key.
- AWAIT_INLET_LOCATION no longer uses "perfect", "ideal", "great" describing customer choice. Was reading salesy.

### 8. (My own bug, caught + fixed) Mangled em-dash regex
The em-dash strip script collapsed the literal em-dash regex `/—/` into `/, /` which would have rejected EVERY message containing comma+space. Caught in audit, restored. Brutal regression confirms intact.

---

## Voice-judge per-dimension averages (n=18)

| Dimension | Score | Status |
|---|---|---|
| Reading the room | 9.00 | ✓ at target |
| Identity discipline | 10.00 | ✓ above target |
| Pacing | 8.94 | needs +0.06 |
| Closing rituals | 8.67 | needs +0.33 |
| Customer enjoyment | 8.39 | needs +0.61 |
| Warmth | 8.39 | needs +0.61 |
| Naturalness | 8.22 | needs +0.78 |
| **Overall** | **8.80** | needs +0.20 |

**Worst transcript:** p10-carl (7.4) — storm urgency unmasked desperation tells, now patched.
**Best transcript:** p03-don (9.6).

---

## What's still needed before flipping the gate to clients

1. **Round 4 sim** to verify v10.1.41 patches push averages over 9.0 across all 7 dims. Re-run Carl + Brittney + Sarah + 3 new personas (suggest: Beverly slow-responder, Trevor photo-sender, Pivot Pat amendment).

2. **Stuck-state escalation cap**. Patricia's sim showed AWAIT_PANEL_PHOTO has off_topic self-loop (good), but no max-self-loop counter. A customer who keeps deflecting forever would loop indefinitely. Add `repeated_offtopic_count >= 3 → NEEDS_CALLBACK` auto-escalation. Deferred this session.

3. **OOA DQ message tightening** (voice-judge bonus finding). Diana v40's DQ said "appreciate the details, I'll pass this to Key in case he can refer you" — softened too far for a hard DQ. Should be cleaner: "outside our area, wishing you luck."

4. **Live test by Key (Tyler-style)** as the final smoke test. The simulator pattern surfaces structural and voice issues; live-customer testing surfaces the things you only notice when YOU read the bot's reply on YOUR phone. Past Tyler rounds each surfaced 4-5 things the dojo missed.

5. **Photo classifier dedicated test pass** (`v10.1.14-photo-classifier-test-plan.md` was never fully run). Real panel photos are the most failure-prone surface.

6. **Once 1-5 clear, flip ASHLEY_ALLOWED_PHONES from "+19414417996" to "*"** + monitor first 10 real conversations closely.

---

## Files to review

- `bot-lab/autonomous-2026-05-07/transcripts/` — all 18 conversation transcripts
- `bot-lab/autonomous-2026-05-07/voice-judge-verdict.md` — per-dimension grading
- `bot-lab/eval/v10.1.39-verdict.md` — brutal-battery verdict (59/59)
- Commits: `6cab5db` (v10.1.40 simulation tunes), `267c47f` (v10.1.41 voice-judge tunes)

---

## Production state right now

- ASHLEY_ALLOWED_PHONES: `+19414417996` (your cell only, unchanged)
- All bot functions deployed at v10.1.41
- 59/59 brutal regression scenarios passing
- Stage 1 → 2 auto-advance shipped
- OpenPhone wildcard active (no Twilio 10DLC blocking)
- Comm-orchestrator deployed but cron not scheduled (waits on one DB push)
