# Ashley Bot Lab Dojo — One-Command Iteration Runbook

A standardized loop for future prompt iterations. No more 18 manual
Agent calls + manual scoring. Drops every iteration to a single command
+ a single review pass.

---

## When to dojo

Any time you want to test a prompt change. Trigger: anyone (Key, Claude,
voice-judge feedback, real customer complaint) flags something that
needs prompt iteration.

---

## How to run a full iteration cycle

### Step 1: Make the prompt change

Edit one of:
- `bot-lab/agents/classifier-agent.md`
- `bot-lab/agents/phraser-agent.md`
- `bot-lab/state-machine.js`
- `bot-lab/agents/orchestrator-agent.md`
- `bot-lab/agents/photo-classifier-agent.md`

Document the change in a `bot-lab/eval/iteration-{date}-{slug}.md` file
with:
- Hypothesis (what the change should improve)
- Specific edit (before/after diff)
- Expected metric impact (which voice-judge dimensions should rise)

### Step 2: Run the persona batch

In the main session, send THIS exact message to Claude Code (this is
the dojo command):

> Dojo run: spawn 18 orchestrator agents in parallel, one per persona
> from bot-lab/agents/customer-personas.md (personas 1-18). Each runs
> a full conversation per the v8.1 prompts and writes a transcript to
> bot-lab/transcripts/dojo-{date}-{NN}-{slug}.md. After all complete,
> spawn one voice-judge agent that scores all 18 transcripts on the
> 7 dimensions per bot-lab/agents/voice-judge-agent.md and writes the
> verdict to bot-lab/eval/dojo-judge-{date}.md. Surface the per-dim
> averages + top 3 fixes in your reply.

Claude Code spawns 19 agents (18 orchestrators + 1 voice-judge), all
in parallel, all in the background. Total wall time: ~5-10 minutes
depending on rate limits.

Alternative for FAST iteration (small batch):
> Dojo quick: spawn 6 personas covering register diversity (Sarah,
> Brad, Linda, Tony, Lisa, Frank). Score with voice-judge. Surface
> in reply.

### Step 3: Review the verdict

Voice-judge output gives:
- Per-dim averages (target ≥9.0 across all 7 dims)
- Anti-pattern instances with verbatim quotes
- Top 3 prompt-engineering fixes for next iteration

If avg ≥9.0 → prompts hold, ship.
If avg <9.0 → apply top 3 fixes, run dojo again.

### Step 4: Personal cold-read (mandatory before declaring done)

Per Key's 2026-05-03 directive: don't fully trust metric scores. Always
do a personal cold-read on the SARAH transcript (happy-path baseline)
before declaring locked. If anything reads stilted, robotic, or
templated, iterate.

---

## Persona suite (current as of v8.1)

| # | Name | Tests |
|---|---|---|
| 01 | Sarah | Happy path baseline, default register |
| 02 | Mike | Confused 120v owner, educational dispatch + DQ |
| 03 | Don | Hostile STOP |
| 04 | Patricia | Off-script price ask mid-flow |
| 05 | Jason | Renter DQ |
| 06 | Diana | Geocode-blind happy path |
| 07 | Trevor | Outlet photo flow |
| 08 | Beverly | Slow responder (latency) |
| 09 | Brittney | Emoji-heavy, buddy register |
| 10 | Carl | Storm urgency / weekday-leak test |
| 11 | Tony | asking_if_human transparency disclosure |
| 12 | Greg | Folksy price negotiator, buddy |
| 13 | Tara | Memory-jog asking_for_context |
| 14 | Brad | Burst texter, terse register, volunteered_data |
| 15 | Nate | Impatient cooperator, terse |
| 16 | Linda | Friendly chitchat, buddy |
| 17 | Tom | Email typo |
| 18 | Pat | Mid-flow amend |
| 19 | Daniel | "Do I really need a photo?" |
| 20 | Amy | Photo deferred to tonight |
| 21 | Frank | Photo refused, polite-formal |
| 22 | Jen | Multi-photo burst |
| 23 | Wendy | Wrong-photo (meter) recovery |
| 24 | Robert | Panel-door-closed photo |
| 25 | Cassidy | Photo correction post-SCHEDULE_QUOTE |
| 26 | Marshall | Friction language at panel-photo step |
| 27 | Lisa | Anxiety + storm-recovery, two-message empathy split |
| 28 | Marcus | Multi-volunteer (5 facts in one msg) |
| 29 | Tony v2 | Educational→default downshift after disclosure |

Each persona definition lives in `bot-lab/agents/customer-personas.md`.

---

## What "lock" means

The prompts are LOCKED when:
1. Voice-judge avg ≥9.0 across all 7 dimensions on the full 18-29 persona batch
2. Personal cold-read on Sarah passes ("I'd be proud to ship this")
3. Zero hard-constraint violations across the batch
4. All special-intent handlers (warmth lead, RECAP, two-message split,
   amend, photo classifier) verified working

If any of those 4 fail, NOT locked — iterate.

---

## Agent spawn templates (copy-paste-ready)

### Persona run template

```
BPP Bot Lab — Persona NN ({slug}). Read in order:
1. /Users/keygoodson/Desktop/CLAUDE/bot-lab/agents/orchestrator-agent.md
2. /Users/keygoodson/Desktop/CLAUDE/bot-lab/agents/classifier-agent.md
3. /Users/keygoodson/Desktop/CLAUDE/bot-lab/agents/phraser-agent.md
4. /Users/keygoodson/Desktop/CLAUDE/bot-lab/voice-corpus.md
5. /Users/keygoodson/Desktop/CLAUDE/bot-lab/agents/customer-personas.md (Persona NN)
6. /Users/keygoodson/Desktop/CLAUDE/bot-lab/state-machine.js
7. /Users/keygoodson/Desktop/CLAUDE/bot-lab/agents/photo-classifier-agent.md (if persona involves photos)

Run ONE complete conversation as Persona NN. Apply all v8.1 hard
constraints (zero em-dashes, banned phrases, register dispatch, length
mirror, warmth leads on special intents, micro-color rule).

Write transcript: /Users/keygoodson/Desktop/CLAUDE/bot-lab/transcripts/{run-name}-NN-{slug}.md

Output: "[run-name] Persona NN ({slug}) — reached {actual} in {N} turns. detected_style: {style}. Voice {1-10}. Status: {PASS|FAIL|FLAG}."
```

### Voice-judge template

```
You are the BPP Bot Lab Voice Judge — brutal mode.

Read /Users/keygoodson/Desktop/CLAUDE/bot-lab/agents/voice-judge-agent.md
fully — that's your operating manual.

Read these transcripts and score each on the 7 dimensions:
{list of transcript paths}

Be HARSH. The bar is 9+/10. Per-dim averages, top anti-patterns, top 3
fixes. Write report to bot-lab/eval/dojo-judge-{date}.md and 200-word
summary in your reply.
```

---

## Common iteration patterns

### "X is too templated"

When voice-judge or cold-read flags a phrase as templated:
1. Find the intent string in `state-machine.js` that produces it
2. Add explicit "rotation bank" to the intent string (5+ variants)
3. Run dojo, verify variety
4. Lock

### "Bot still saying [banned phrase]"

When a banned phrase keeps leaking through despite regex:
1. Add prompt-internalization layer (explain WHY it's banned, not just
   that it is — see countdown phrasing as example)
2. Add the phrase to the auto-fail regex list in `phraser-agent.md`
3. Add to `bot-phraser-index.ts` REJECT_PATTERNS
4. Run dojo, verify zero leaks

### "Voice score plateaued, can't break 9.0"

When iteration isn't moving the needle:
1. Run voice-judge with explicit "be HARSH, find the smallest tells" framing
2. Look for cross-transcript patterns (e.g. same SCHEDULE_QUOTE template)
3. Personal cold-read multiple personas — gut-check what feels off
4. Apply targeted fixes, NOT prompt rewrites

---

End of dojo runbook.
