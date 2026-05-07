> This file is auto-synced from `wiki/Key/<name>.md` via `scripts/brain/sync-from-wiki.sh`.
> Edit the wiki source, not this file. Sanitization strips specific dollar figures, account balances, and phone numbers.

---
title: Active Priorities
branch: Key
type: state
updated: 2026-05-05
tags: [key, priorities, current, weekly]
---

# Active Priorities

> What Key is focused on **right now**. Updated by Claude every session that surfaces a priority shift; should be re-read at every session start. Stale entries get archived to [[Decisions Log]] with an outcome note.

---

## Last updated: 2026-05-05

## North star (12 months)

Hands-off operationally, multi-city SC + NC, $5K/month personal profit, captain-of-the-ship feel. See [[Identity#What winning looks like]]. Every priority below should ladder up to this.

## Pivot in progress

Hourly general residential service electrical → flat-rate specialty portable-generator inlet installs. The canonical good-Key-call (per [[Decisions Log]]). Pivot started, revenue + profit + overhead all moving the right direction, **not yet complete**. Completing it is implicit in the 12-month picture; the multi-state hands-off model only works on top of a fully embedded specialty + flat-rate base.

## Top 3 in flight

### 1. Ashley spotlight ready
Goal: Ashley qualifies real customers reliably with no two-voice collisions, no false-terminals on benign deferrals, and a brand-faithful voice. Status: production-ready as of 2026-05-05; greeting v3 active under EXP-009; smart re-engagement live; quote-due watcher live. Next signal: 40 greetings completed → EXP-009 decision.

### 2. CPL down, lead-quality up
Quarterly thread per [[BPP/Q2 Operating Goal]]. Daily PostHog check, channel-attribution-based optimization. Meta CAPI CompleteRegistration just shipped (2026-05-05) so Meta's optimizer now sees which form-fills actually qualified. Watching for CPL drift over the next 2-4 weeks.

### 3. Build the Key/ brain layer (this branch)
Goal: capture Key-as-a-person at the same fidelity the rest of the brain captures BPP-as-a-business. Status: scaffold shipped 2026-05-05; interview questions pending Key answers in [[Interview Questions]].

## Open questions Key hasn't answered yet

See [[Open Questions]]. Don't autonomously decide things on that list.

## Recent shifts (last 7 days)

- 2026-05-07: Build 1 (stage-aware comm orchestrator) **shipped** as `comm-orchestrator` edge function. Q18 drainer #1 structurally addressed. Cron schedule staged at `20260507100000_schedule_comm_orchestrator_cron.sql` pending one db push.
- 2026-05-07: brain/ now auto-syncs from `wiki/Key/` via `scripts/brain/sync-from-wiki.sh` (sanitizes specifics). Edit wiki source, run script, commit.
- 2026-05-05: removed "tomorrow morning" customer-facing promise; replaced with soft commitment.
- 2026-05-05: locked greeting copy at "Ashley, auto-text intake for Key" pattern (v3).
- 2026-05-05: reframed Claude as autonomous-mode operator (recognize-and-go, no /work command).
- 2026-05-05: Claude declared head of experiments + voice + decision capture.

## Drainage map (what to automate next, per Key Q18 2026-05-06)

The two drainers Key wants automated next:

### 1. Client communication
**Clarified Q18 follow-up 2026-05-06:** "Pretty much all communication and reminders and follow ups. Not hard but tricky when you have so many moving parts and so many contacts at different stages."

The drain is NOT copywriting. It's **context-switching across many contacts at different stages simultaneously**. The mental tax of "who needs what next" is the friction, not the actual messages.

**What this maps to as a build:**
A stage-aware orchestrator that maintains the per-contact cadence map and fires the right outbound at the right time without Key tracking it. Per-stage triggers (rough draft):

| Stage transition | Trigger | Action |
|---|---|---|
| Quote sent, no view in 24h | timer | Customer SMS: "Did you get a chance to look?" |
| Quote sent, viewed but no approve in 48h | timer | Customer SMS: "Anything to clarify?" |
| Quote approved | event | Customer SMS: "Permit submitted to [jurisdiction]. ~[N] days for approval." |
| Permit pending, T+3d | timer | Customer SMS: "Permit's in with [jurisdiction]. Typically takes [N] business days, I'll text once it's approved." |
| Permit pending, T+7d | timer | Customer SMS: "Still waiting on [jurisdiction]. They run their own timeline, nothing for you to do, just keeping you in the loop." |
| Permit pending past typical+3d | timer | Internal Key SMS: "[Name] permit overdue at [jurisdiction]." Customer SMS: "Permit's running past their usual window. I'll follow up with them and let you know." |
| Permit approved | event | Customer SMS: "Permit approved, ready to schedule install." |
| Install scheduled, T-24h | timer | Customer SMS: "See you tomorrow at [time]." |
| Install done, T+24h | timer | Customer SMS: "Everything good? Questions?" |
| Install done, T+7d | timer | Customer SMS: "Review ask via auto-review-ask cron." |
| Any stage, contact stalled X days | timer | Internal Key SMS: "[Name] stalled at [stage] [X] days." |

Existing pieces: `bot-reengagement` (pre-quote), `quote-due-watcher` (Key-side reminder), `proposal-nudge` (some), `auto-review-ask` (post-install). What's missing: the post-quote-to-install middle layer. That's the highest-leverage build.

### 2. Permits
**Clarified Q18 follow-up 2026-05-06:** "Permits are in all different jurisdictions with different websites and processes."

Same orchestration shape: not a copy problem, a **directory + state-tracking** problem. Each jurisdiction has its own portal, paperwork, format, contact path, status mechanism.

**What this maps to as a build:**
- Per-jurisdiction playbook table: `jurisdictions { id, name, portal_url, submission_method, status_check_method, typical_approval_days, contact_email, paperwork_template_id }`
- Per-permit state machine: `submitted → under_review → approved → inspected → closed`
- Auto-generated paperwork by jurisdiction (mailing-insert pattern is half of this; the digital portal version is the other half)
- Status-change events trigger customer notifications via the orchestrator above

Existing pieces: `permits/mailing-inserts/` (paperwork half), `bot-lab/sc-jurisdictions.json` (data has 4 jurisdictions). What's missing: the state machine + portal-per-jurisdiction playbooks + status tracking.

**Both drainers are PATH workstreams to the 12-month destination.** Hands-off ops requires Key not running these. Subbed install labor doesn't help if Key is still tracking communication and permits.

### 2. Permits
Per [[Operations/Permit Jurisdictions]] there are 4 jurisdictions (Greenville County, Spartanburg County, Pickens County, City of Greenville). Permit drainage layers:
- Per-jurisdiction paperwork generation (the mailing-insert pattern in memory already partly automates this)
- Submission to the right portal/email per jurisdiction
- Status tracking + reminders
- Inspection scheduling
- Customer status updates as permit moves

Some of this is automatable (paperwork, status tracking, customer notifications). Some isn't (manual portal submissions, in-person inspections, jurisdiction-relationship friction). The automation surface is real.

**This connects directly to the 12-month destination bet** (hands-off ops). Hands-off requires both layers automated because Key can't be doing them if he's not doing installs. These are PATH workstreams (per Q12) toward the destination.

## Tripwires (defensive monitoring)

Per the [[Identity#What losing looks like]] floor, watch for:

1. **Trailing 30-day personal profit trending toward $3K/month** = code-red. Not built yet; add to morning brief.
2. **CPL rising + close rate dropping simultaneously** for 7+ days = TAM-saturation early warning. Add to experiment-monitor.
3. **Lead-day count below 1/day for 3+ days** = pipeline alert. Already covered by PostHog zero-day cron alerts.
4. **Sub install owner-profit < $X** (X TBD) = sub model is breaking. Add once first sub installs accumulate data.

## What's NOT in flight (deliberate)

- Anderson County expansion (see [[Avoid List]])
- Whole-home Generac standby pivot (see [[Avoid List]])
- Hiring full-time employee (Hormozi Stage 3 trigger; not yet)
- Video assessments in sales process

---

## How to update this file

Append a one-liner to "Recent shifts" each time something material changes. Quarterly: rotate top-3 if a goal completes or a new top-3 candidate beats the lowest current entry. Annually: archive into [[Decisions Log]] with outcomes.

---

## See also

- [[Open Questions]], unresolved questions Claude should not autonomously answer
- [[Decisions Log]], historical decisions
- [[BPP/Q2 Operating Goal]], quarterly metric
- [[BPP/Hormozi Scaling Roadmap]], broader stage map
