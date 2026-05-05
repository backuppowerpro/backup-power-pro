# BOT LAB — RESUME DOC (read this first after /compact)

If you're a fresh Claude Code session picking this up cold, **read this entire
file before doing anything else.** Then read the four siblings: `ARCHITECTURE.md`,
`RESEARCH.md`, `agents/classifier-agent.md`, `agents/phraser-agent.md`. Then
proceed with the build.

---

## What this is

A local lab for designing + testing the BPP SMS Qualification Bot **entirely
inside Claude Code's Agent system, with zero per-call API costs**. The bot
itself will eventually run in production as Supabase edge functions calling
the Anthropic API — but during prompt iteration, we use Claude Code's flat-rate
subscription as the inference layer instead. Every system prompt written in
`agents/` is **portable verbatim** to the production edge function.

---

## The thesis (locked, do not re-litigate)

**Deterministic state machine owns the conversation. The LLM is rented out as
two narrow contractors — classifier and phraser — neither allowed to drive.**

Five principles:
1. State machine is the brain. Plain object FSM, one row per phone in Postgres.
   Pure-function transitions. Drawable on a napkin.
2. Two LLM jobs, both Haiku 4.5 with native structured outputs. Classifier
   reads, phraser writes. Schema-locked at the model level.
3. Filter cheap before you spend tokens. Geocoding, DNC, quiet hours, STOP
   keywords, regex extractors all run before any LLM call.
4. Voice = 12 real Key SMS exemplars + 4 hard tone rules. No corporate openers.
5. Compliance is a middleware layer. Every outbound goes through
   `enforceCompliance(phone, message)` — DNC, quiet hours by recipient
   timezone, brand prefix on session-start, no shortened URLs.

Lineage in `RESEARCH.md` — Anthropic "Building Effective Agents," Klaviyo,
Postscript, Stripe, Twilio, Haptik, etc.

---

## Locked design decisions (don't reopen)

| Decision | Choice |
|---|---|
| Production stack | Supabase edge functions + existing Twilio webhook + existing send-sms (NOT a parallel Node/SQLite stack) |
| LLM models in prod | Claude Haiku 4.5 for both classifier + phraser via native structured outputs |
| LLM models during lab | Whatever Claude Code's Agent tool runs (Sonnet/Opus family); prompts port verbatim |
| Bot identity framing | BPP intake — refers to "our electrician Key" in third person, never first-person Key |
| Transparency | Doesn't volunteer "I'm AI" but answers honestly if asked. Hardcoded answer in classifier handles this. |
| Voice corpus size | 12 real Key SMS exemplars |
| Quiet hours | 8am–9pm by recipient local time (hardcoded — not relying on consent defense) |
| 10DLC | Required, ~$50 setup. Pre-launch checklist item, not a code item. |
| MMS handling | Fetch-and-store on inbound webhook → upload to Supabase Storage → delete from Twilio |
| URL shorteners | Forbidden. Use `backuppowerpro.com/...` only (AT&T blocks bit.ly entirely) |
| Voice rule for "I" | Phraser NEVER uses first-person "I" claiming to be Key. "We" for BPP-side, "Key" third-person. |

---

## What's already built

### Files on disk in `bot-lab/`

| File | Status | Notes |
|---|---|---|
| `state-machine.js` | ✅ Complete | Pure JS FSM. 13 states + 4 retry states + 6 terminal. Unit-testable. |
| `agents/classifier-agent.md` | ✅ Complete | System prompt + 30-case eval suite + acceptance criteria. |
| `agents/phraser-agent.md` | ✅ Complete | System prompt + voice rules + 12 placeholder exemplars + 10-case eval. |
| `ARCHITECTURE.md` | ✅ Reference | Full architecture spec. 35 pitfalls mapped to defenses. |
| `RESEARCH.md` | ✅ Reference | Research findings with primary-source URLs. |

### Files NOT yet built (this is the build queue)

| File | Purpose | Priority |
|---|---|---|
| `agents/customer-personas.md` | 12 customer archetypes for the simulator (cooperative 240v owner, confused 120v owner, hostile, off-script asker, renter, out-of-area, etc.) | P0 |
| `agents/orchestrator-agent.md` | Meta-prompt for the agent that runs full conversations end-to-end. Internally simulates customer + invokes classifier + applies state machine + invokes phraser + logs transcript. | P0 |
| `voice-corpus.md` | Replace the 12 placeholder voice exemplars in `phraser-agent.md` with REAL Key SMS pulled from production `messages` table. SQL is in the phraser doc. | P0 |
| `harness/run-conversation.md` | Manual runbook: how to spawn the orchestrator agent for one persona and review the transcript | P1 |
| `harness/run-batch.md` | How to run all 12 personas in parallel (Agent tool batch) and write transcripts | P1 |
| `eval/scoring-rubric.md` | The 10-point voice score rubric + classifier accuracy rubric | P1 |
| `transcripts/` | Output dir — every test conversation lands here as a `.md` file | (auto-populated) |

---

## How the lab works (mental model)

```
┌──────────────────────────────────────────────────────────────────┐
│   Claude Code main session (you, after compact)                  │
│                                                                  │
│   Tools you'll use:                                              │
│     - Agent tool: spawn sub-agents with custom system prompts    │
│     - Bash: run state-machine.js as Node, log transcripts        │
│     - Read/Write: load prompts, save transcripts, score outputs  │
└─────────────────────┬────────────────────────────────────────────┘
                      │ spawns (subscription cost, no per-call)
                      ▼
┌──────────────────────────────────────────────────────────────────┐
│   Orchestrator Agent (one per conversation)                      │
│   - Reads: persona + classifier prompt + phraser prompt + state  │
│              machine description                                 │
│   - Loops: simulate customer turn → classify → transition →      │
│             phrase → log → repeat until COMPLETE / NEEDS_CALLBACK│
│             / STOPPED                                            │
│   - Writes: full transcript + per-turn metadata to               │
│              transcripts/{persona}-{date}.md                     │
└──────────────────────────────────────────────────────────────────┘
```

For batch testing: spawn 12 orchestrator agents in parallel, one per persona,
each writes its own transcript. Then a single review pass scores everything.

---

## Iteration loop

1. **Run a batch.** Spawn 12 orchestrator agents (one per persona) in parallel
   via the Agent tool. Each runs one full conversation and writes a transcript
   to `transcripts/`.
2. **Score.** For each transcript, evaluate three things:
   - Did the state machine reach a sensible terminal state?
   - Did the classifier label the customer's messages correctly?
   - Did the phraser sound like Key (judged against voice corpus)?
3. **Identify the worst failure.** Pick ONE thing to fix, not five.
4. **Edit the relevant prompt** (`classifier-agent.md` or `phraser-agent.md`).
   Note the change in the eval log.
5. **Re-run that persona only.** Confirm fix.
6. **Re-run the full batch.** Confirm no regression.
7. Repeat until all 12 personas hit ≥9/10 voice + ≥28/30 classifier accuracy.

When that bar is hit, the prompts are locked and ready for production port.

---

## Resume prompt for the next session

After /compact, send this exact message to the new session:

> Resume the BPP bot lab. Read `bot-lab/RESUME.md` first, then `bot-lab/ARCHITECTURE.md`, `bot-lab/RESEARCH.md`, `bot-lab/agents/classifier-agent.md`, and `bot-lab/agents/phraser-agent.md`. Then build the remaining P0 files: `agents/customer-personas.md` (12 archetypes), `agents/orchestrator-agent.md` (the meta-prompt), and pull the real voice corpus from the production messages table. Then run the first batch of 12 conversations via parallel Agent tool calls. Save transcripts to `transcripts/`. Score them. Surface the top 3 prompt-engineering fixes. Auto mode is active — execute autonomously, don't re-litigate locked decisions.

---

## Production port checklist (later, not now)

When prompts are locked:
1. Copy `state-machine.js` → `supabase/functions/_shared/bot-state-machine.ts`
   (rename to `.ts`, add type annotations).
2. Copy classifier system prompt verbatim → `supabase/functions/bot-classifier/index.ts`
   wrapped in an Anthropic API call with `output_config.format: { type: 'json_schema', schema: <classifier schema> }`.
3. Copy phraser system prompt verbatim → `supabase/functions/bot-phraser/index.ts`.
4. Add the schema migration: `supabase/migrations/20260503000000_bot_state_machine_columns.sql`
   per `ARCHITECTURE.md` §8.
5. Wire `twilio-webhook` to route to bot-engine when `contacts.bot_state` is set.
6. Wire `quo-ai-new-lead` to set `bot_state='GREETING'` after geocode/service-area filter.
7. Wire COMPLETE-state notifier to send-sms with internal=true to Key's phone.
8. Set up 10DLC campaign (one-time, ~$50 + monthly).

None of these happen in lab. Lab work is just prompt engineering against agent
sub-sessions.

---

## Hard rules for the build phase

- **Do not call any external API during lab work.** Anthropic API, Twilio API,
  Supabase REST, all forbidden in lab. Sub-agents only.
- **Do not write production code during lab work.** Edge functions stay
  untouched. Supabase migrations not applied. Lab is pure prompt + state-machine
  iteration.
- **Do not relitigate locked decisions** (table above). If a decision feels
  wrong, flag it for end-of-batch review, don't unilaterally change it.
- **Score every batch.** No "looks good to me" — write the score in
  `eval/batch-{date}.md` so we can see drift across iterations.
- **Voice eval is the bar.** Even if classifier accuracy is 30/30 and state
  machine is bulletproof, if voice score < 9/10 we keep iterating.

---

## End of resume doc.

---

## SESSION 2 STATE (2026-05-03, post-compact pickup)

**Where we are:** v9 prompts in place after Key's live test feedback (he played customer "Ryan" 2026-05-03 and flagged: too casual / "gen" slang / no thanks for filling form / cold pivots / form-passes-only-name+phone / 240v checkbox unreliable). v9 fixes applied across `state-machine.js` and `phraser-agent.md`.

**Background research streams launched (some pending at compact):**
1. ✅ DONE — `/tmp/sms-professionalism-research.md` — 5-element first-message structure, 15 deltas with before/after, validated Key's casual-too-far feedback
2. ⏳ RUNNING — Key's actual OpenPhone conversations from 864-400-5302 (phoneNumberId PNTZHfvSsh) being read + analyzed for his real qualification process. Will write to `bot-lab/research/key-actual-process.md` + raw JSON to `/tmp/key-openphone-conversations.json`. Read-only, no outbound texts.
3. ⏳ RUNNING — Trust + authority building research. Will write to `/tmp/sms-trust-authority-research.md`.

**Plan after research returns:**
1. Synthesize all 3 streams into v10 prompt updates (the most impactful: matching Key's actual style from his real conversations, integrating professionalism deltas, adding trust signals)
2. Run v10 batch through dojo (per `bot-lab/dojo.md`)
3. Voice-judge the v10 batch
4. **Personal testing** by Claude — simulate 3-4 full conversations as different customer types: confused first-timer, experienced electrician's neighbor, anxious storm-recovery, skeptical-burned-before. Be the customer cold, run pipeline mentally, gut-check every bot reply.
5. Lock if proud, iterate if not

**Files key-locations:**
- v9 prompt updates: `bot-lab/agents/phraser-agent.md` (v9 PROFESSIONALISM DIAL section), `bot-lab/state-machine.js` (intent rewrites + fallback rewrites)
- v9 demo conversation: `bot-lab/transcripts/v9-ryan-rerun.md` (side-by-side v8.1 vs v9 of Key's exact test)
- Production-ready artifacts: `bot-lab/production/` (schema migration SQL, 3 edge fn scaffolds, re-engagement bank)
- Operational specs: `bot-lab/operations/handoff-and-photos.md`, `bot-lab/operations/crm-integration.md`
- A/B framework: `bot-lab/experimentation/framework.md` + `registry.md` (7 experiments designed)
- Dojo runbook: `bot-lab/dojo.md` (one-command iteration)

**Key directives still active:**
- ZERO em-dashes (Key's hard rule)
- Ashley is the bot's name (female-identified intake assistant, not Key)
- "We" is OK for BPP-the-company, NOT for first-person electrician claims
- Don't over-rely on metrics — personal cold-read mandatory before declaring done
- Form passes ONLY name + phone (gathered everything else via SMS)
- 240v checkbox on form is hint not confirmation — always verify

---

## SESSION 3 RESULT (2026-05-03, v10.1.5 LOCKED + improvements)

**Final state:** v10.1 LOCKED by voice-judge brutal-mode (9.31 overall, all 7 dims ≥9.0). Subsequent point releases (v10.1.1-v10.1.5) added real-world architecture fixes from Key's testing.

**v10.1.x point releases shipped:**
- **v10.1.1:** POSTPONED soft-resumable (warm-pause spouse-approval) + paused_at_state column + warm-pause notification to Key
- **v10.1.2:** Generator-spec lookup (Alex's electrical-reference.md → bot-lab/generator-specs.json + generator-lookup.js). Predator 3500 → 1-turn DQ instead of 4-turn dead-end. Park-and-continue pattern: photo_refused/unclear no longer terminate to NEEDS_CALLBACK; route to AWAIT_PANEL_PHOTO with voltage_deferred=true.
- **v10.1.3:** 120V DQ improvements per Key feedback — hedge ("Looks like..."), explicit future-install offer, TIER 1/TIER 2 recommendation handlers (general spec ≥240V/5,000W min; specific defer to Key + ping). Lookup-correction paths (gen_240v / outlet_30a / outlet_50a / photo_received from DQ_120V reopen flow). Universal-escape override pattern. 5,000W floor.
- **v10.1.4:** 30A 3-prong vs 4-prong disambiguation — outlet_30a alone routes to retry; outlet_30a_3prong (TT-30R/L5-30R) → soft DQ; outlet_30a_4prong (L14-30R) → advance. Catches the "120V 30A" trap.
- **v10.1.5:** Panel location + install-path detection. AWAIT_RUN now asks "where is the panel?" with location-specific labels (panel_garage_exterior best case → AWAIT_EMAIL direct; panel_basement / panel_interior_wall → AWAIT_INSTALL_PATH for attic/crawlspace follow-up). Photo classifier expanded for sub-panel detection (panel_subpanel + ask_main_panel rec) + hazardous panels (Zinsco / FPE Stab-Lok flagged as accept_flag_hazardous) + MLO + meter-main combo. Pulled Alex's panel research into bot-lab/panel-specs.json.

**Production scaffolds built:**
- `production/bot-handoff-notifier.ts` — terminal-state SMS to Key with lead_quality_score (1-5), warm-pause, DQ-with-recommendation-request paths
- `production/bot-webhook-idempotency.ts` — Postgres advisory lock + processed-messages dedup
- `production/bot-monitoring.sql` — daily health, EXP-008 dashboard, stuck-conversations view, auto-decision check
- `production/bot-reengagement-cron.sql` — 24h/72h tiered re-engage with TCPA quiet hours
- `production/20260503000000_ashley_bot.sql` — full schema migration including all v10.1.x columns
- `production/DEPLOY-RUNBOOK.md` — 10-stage step-by-step deploy

**Knowledge bases pulled from Alex:**
- `bot-lab/electrical-reference.md` — Alex's 868-line reference (12 generator brands, panel brands, MLO/meter-main, interlock kits)
- `bot-lab/generator-specs.json` — structured lookup for generator brand+model → 240V compatibility (75+ models, used by generator-lookup.js)
- `bot-lab/panel-specs.json` — structured lookup for panel brands → install compatibility + hazardous flagging (Zinsco/FPE)

**Resume command for next session (after /compact):**
> Resume the BPP bot lab. v10.1.5 is the current state. Read `bot-lab/eval/v10-ship-readiness.md` for LOCKED verdict + production deploy path. v10.1.x point releases documented in RESUME.md SESSION 3 RESULT. Open work: production deploy per `bot-lab/production/DEPLOY-RUNBOOK.md`. Knowledge bases (generator-specs.json, panel-specs.json) ready for orchestrator integration.

---

## SESSION 2 RESULT (2026-05-03, end of post-compact session)

**v10 KEY-VOICE OVERHAUL DEPLOYED.** All 3 research streams synthesized + Key's actual OpenPhone data analyzed. Major register and flow changes applied.

**Big finding from OpenPhone analysis (702 real Key messages):** the bot was performing FICTIONAL Southern slang ("y'all", "holler", "talk soon", "yep") that Key himself NEVER uses (zero hits across 702 messages). And the bot had BANNED "Perfect." which is Key's actual #1 ack word (61 uses).

**v10 changes (full summary at `bot-lab/eval/v10-summary.md`):**

PHRASER (`agents/phraser-agent.md`):
- Added v10 KEY-VOICE OVERHAUL section (highest priority)
- Lifted "Perfect." ban (Key uses it 61x)
- Banned fake-Southern: y'all, holler, talk soon, yep, cool, sweet, lemme, real quick, for sure
- Added v10 trust guardrails: overpromise ban, false scarcity ban, boilerplate licensing ban, "trust me" ban
- New voice corpus: 12 verbatim Key SMS from real OpenPhone data
- New warmth-leads: "No problem.", "Definitely.", "Sure." (Key-real)
- Buddy register collapsed: no slang shift, just shorter sentences
- Identity-translation rule: Key's first-person ("I install") → Ashley's third-person ("Key installs")

STATE MACHINE (`state-machine.js`):
- v10 FLOW: GREETING → AWAIT_240V (paired voltage+amp+photo) → AWAIT_PANEL_PHOTO → AWAIT_RUN (default install offer, NOT run-length) → AWAIT_EMAIL (combined last name + email + address close) → RECAP → SCHEDULE_QUOTE
- Removed AWAIT_OWNERSHIP from default flow (Key never asks; form filters)
- Removed AWAIT_RUN as run-length question (replaced with verbatim Key default-install-offer pattern)
- Removed AWAIT_ADDRESS_CONFIRM as separate state (folded into AWAIT_EMAIL combined ask)
- All intents updated to use Key's verbatim patterns
- All sign-offs use Key's verified rotation ("Sounds good. Key will put the quote together...")

ORCHESTRATOR (`agents/orchestrator-agent.md`):
- Updated transition table for v10 flow

**Personal cold-reads completed (4 personas, all PASS):**
- Sarah (default, happy path) — `transcripts/v10-personal-test-sarah.md`
- Mike (default, 120V DQ) — `transcripts/v10-personal-test-mike.md`
- Tony (asking_if_human disclosure) — `transcripts/v10-personal-test-tony.md`
- Brad (terse burst-texter) — `transcripts/v10-personal-test-brad.md`

**Bug caught and fixed during cold-reads:** identity discipline gap — Key's verbatim "I will install" was being echoed by Ashley. Fixed with explicit IDENTITY-TRANSLATION RULE in all intent strings.

**Comfort level: would ship v10.** Voice now matches Key's real polite-professional intake-assistant register. Customer cold-reads on 4 personas all PASS. Identity discipline holds. Trust signals fire correctly. Flow matches Key's actual qualification process.

**What's not done:**
- Full 18-persona dojo batch + voice-judge (optional validation)
- Production port (still pending Key's signoff to deploy)
- 10% rollout experiment (when ready)

**Resume command for next session (after /compact):**
> Resume the BPP bot lab. v10 deployed. Read `bot-lab/eval/v10-summary.md` for what changed. v10 voice and flow validated via 4 personal cold-reads in `bot-lab/transcripts/v10-personal-test-*.md`. To run full dojo batch + voice-judge, follow `bot-lab/dojo.md`. To port to production, follow checklist in this RESUME.md (Production port section). v10 is ship-ready pending Key's signoff.
