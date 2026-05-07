# Active Priorities

## North star (12 months, mid-2027)

Hands-off operationally, multi-city SC + NC, $5K/month personal profit, captain-of-the-ship feel. See `01-identity.md` for the full destination picture. Every priority below should ladder up to this.

## Pivot in progress (the canonical good-Key-call)

Hourly general residential service electrical → flat-rate specialty portable-generator inlet installs. Started, revenue + profit + overhead all moving the right direction, **not yet complete**. Completing it is implicit in the 12-month picture; the multi-state hands-off model only works on top of a fully embedded specialty + flat-rate base.

## The wealth-lever framing (the picture beyond the destination)

> Captured 2026-05-06 after the millionaire-question + lifestyle preferences sweep.

BPP year-2 destination ($10-15K/month) buys the **floor** (time agency + comfortable family support). The **lifestyle tier** (small-but-nice home, Porsche, Tesla, RZR) comes from capital accumulation on top of BPP cash flow, not from grinding BPP harder.

**Right shape:**
- BPP year 1-2 = cash-flow machine. Hit 12-month destination.
- Capital allocation = wealth lever. Profit deployment, layered:
  - 60-70% into broad index DCA (boring floor)
  - 20-30% into asymmetric conviction plays in the 8pm-12am learning window (Key has a Tesla-success track record on this)
  - 10% liquid for opportunistic small real estate deal (Key's electrical labor cuts the renovation budget)
- **Path B (productize as SaaS) deferred to year 3-5** if at all. Right answer for $5-10M exit; overshoots time-agency goal and demands grind that violates Q19 dream-job preference.
- **Sales + brand stay yours.** Don't outsource as BPP grows.

## Top workstreams in flight

### 1. Stage-aware comm orchestrator (per Q18 drainage map)
Client communication is the #1 named drainer. The friction is **context-switching** across many contacts at different stages, not copywriting. Existing pieces: bot-reengagement (pre-quote), quote-due-watcher (Key-side), proposal-nudge (some), auto-review-ask (post-install). Missing: the post-quote-to-install middle layer.

Trigger table to build:
| Trigger | Action |
|---|---|
| Quote sent, no view 24h | Customer SMS: "did you get a chance to look?" |
| Quote sent, viewed but no approve in 48h | Customer SMS: "anything to clarify?" |
| Quote approved | Customer SMS: "permit submitted to [jurisdiction], ~N days" |
| Permit pending T+3d | Customer SMS: trust-preservation nudge |
| Permit pending T+7d | Customer SMS: "still waiting on jurisdiction, just keeping you in the loop" |
| Permit pending past typical+3d | Internal Key SMS + customer notification |
| Permit approved | Customer SMS: "permit approved, ready to schedule install" |
| Install scheduled, T-24h | Customer SMS reminder |
| Install done, T+24h | Customer SMS: "everything good?" |
| Install done, T+7d | Auto-review-ask |
| Any stage, contact stalled X days | Internal Key SMS surfaced list |

### 2. Per-jurisdiction permit playbook + state tracker (Build 2)
Permits drain because every jurisdiction has different portal, paperwork, format, contact path, status mechanism. Existing: `permits/mailing-inserts/`, `bot-lab/sc-jurisdictions.json`. Missing: per-jurisdiction playbook table, permit state machine, status tracking + reminders, status-change-triggered customer notifications (which feed Build 1).

### 3. Sub recruitment + sub onboarding structure
Required to hit the hands-off year-2 picture. Per Q6 delegation rule, structure must be **on Key's terms** (briefs, checklists, quality gates, review cadence). Not a vendor or agency, not "hire and let them figure it out." Stays open until first sub onboarded.

### 4. EXP-009 greeting v2 vs v1
Active. Sample target 40 greetings. Decision rule: highest first-reply rate within 60min, must beat lowest variant by ≥8pp. Experiment-monitor watches it daily.

## Drainage map (what to automate next)

> Per Key Q18 2026-05-06: client communication + permits.

Both are orchestration problems, not copy/process problems. The mental tax of "who needs what next, across N contacts at different stages, across M jurisdictions with different rules" is what burns Key out.

**Build 1 (orchestrator)** and **Build 2 (permit state tracker)** above are the responses. They are PATH workstreams to the 12-month destination. Hands-off ops requires Key not running these. Subbed install labor doesn't help if Key is still tracking communication and permits manually.

## Tripwires (defensive monitoring)

Per the [losing picture in `01-identity.md`], watch for:

1. **Trailing 30-day personal profit trending toward $3K/month** = code-red. Add to morning brief.
2. **CPL rising + close rate dropping simultaneously** for 7+ days = TAM-saturation early warning. Add to experiment-monitor.
3. **Lead-day count below 1/day for 3+ days** = pipeline alert. Already covered by PostHog zero-day cron alerts.
4. **Sub install owner-profit < $X** (X TBD) = sub model is breaking. Add once first sub installs accumulate data.

## What's NOT in flight (deliberate)

- Path B (SaaS productize): deferred to year 3-5.
- M&A roll-up of competitor electrical contractors: blocked by capital position, deferred 12-18+ months.
- Anderson SC market entry: permanent no.
- Whole-home Generac: permanent no.
- Off-the-shelf CRM migration: permanent no.
- Lead-gen aggregator services: permanent no.
- Marketing / sales / receptionist agencies: permanent no.
