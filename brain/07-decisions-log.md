# Decisions Log

> Chronological record of captured decisions and their rationale. Useful for understanding WHY rules exist.
>
> Sanitized version (specific dollar figures live in `wiki/Key/Decisions Log.md`, per-machine private). Most entries are operating principles + product decisions, which are safe to track here.

## 2026-05-07

### Build 1 shipped: stage-aware comm orchestrator
Edge function `comm-orchestrator` deployed. Hourly cron pattern, quiet-hours-aware. Owns the post-quote-to-install middle layer Q18 named as a drainer. Trigger table from `05-active-priorities.md` implemented as: stage 5 +3d / +7d customer reassurance, stage 7 fresh approval ack, stage 8 install reminder, weekly Mon-9am Key digest of contacts stalled 14d+. Stage 4+ no-AI-customer-comm rule preserved (only permit-pipeline status sends). Markers stored as `__orch_<trigger>:<iso>` in contacts.notes, matching existing `__pm_*` / `__review_asked` convention. Cron schedule migration staged at `20260507100000_schedule_comm_orchestrator_cron.sql` but needs `vault.create_secret` precondition + db-push reconciliation with the 20260505* migration drift before activation. Function is deployed and callable now; cron is the last mile.

## 2026-05-06 (Round 5 + post-interview captures)

### Brain made portable
Published `brain/` directory at repo root with sanitized versions of the wiki/Key/ workshop files. New AI sessions on any machine, fresh worktree, or cloud agent now hit the ground running by reading `brain/00-INDEX.md`. Specific financial details remain in `wiki/Key/Identity.md` (per-machine, private). CLAUDE.md updated to direct sessions to brain/ as the entry point.

### Voice cross-cutting patterns wired into phraser
Previously only `bot-lab/voice-corpus.md` (12 exemplars) was embedded in the phraser. The cross-cutting voice patterns from Q10 (first-person ownership, parenthetical teaching, recap closer, specific numbers, no-period casual, etc.) now also live in the phraser system prompt as explicit guidance, not just exemplars-by-osmosis.

### Q21: lifestyle preferences = quality + toys tier
Captured: "I also love nice things. I would like nice property, a small but nice home. And I love toys. Porsche, RZR, Teslas, etc." Recalibrated freedom thesis: year-2 BPP destination is the FLOOR, lifestyle tier comes from capital accumulation (Path E), not grinding BPP harder.

### Career arc + hidden skills surface Path E
Captured: apprentice → general residential → BPP specialty pivot. Hidden skills: selling (called out twice as a real strength + something he likes), art/graphic design, stocks/options trading with Tesla success, high-school streetwear reselling. Strategic implications:
- Sales DOUBLE-banned from outsourcing (burn history + real Key strength).
- Visual/brand design stays in-house indefinitely.
- Path E (BPP cash-flow machine + capital allocation as wealth lever) emerges as highest-fit strategy. Munger/Buffett pattern matches Q19 dream-job preference exactly.

### Financial freedom redefined
"Not being totally dependent on working every day and making enough to support a family in the future comfortably." Floor ~$10-15K/month income. NOT $1M net worth. NOT FU exit money.

### Q20: Brain-connectivity audit found design-language gap
Created `wiki/Key/Design Language.md` (now in brain/06-design-language.md) consolidating UX/UI rules previously scattered across auto-memory + CRM Style Guide. Key was repeatedly re-explaining; that re-explanation tax now goes away.

### Q19 (dream-job framing): the unifying pattern of the whole interview
"I like orchestrating things, the person that makes high level decisions. My dream job would be self-learning all day to sharpen my mind to a point I could make 1 decision every so often that changes a trajectory in a large positive direction." Munger/Buffett/Thiel pattern. Implications: surface fewer decisions, synthesis over data, curate learning material, protect 8pm-12am, bandwidth-weight proposals, cut operational noise.

### Q18: drainers are orchestration problems, not copy
"Pretty much all communication and reminders and follow ups. Not hard but tricky when you have so many moving parts and so many contacts at different stages." Permits: "all different jurisdictions with different websites and processes." Both are context-switching problems. Builds named: stage-aware comm orchestrator + per-jurisdiction permit playbook with state tracker.

### Permit-limbo customer nudges added to orchestrator spec
Customer in permit-pending state needs trust-preservation nudges even when nothing's actually changed. T+3d, T+7d, past-typical+3d triggers added to Build 1 spec.

### Q17: Best hours = 8pm-12am
Corrected prior wrong inference (Claude had assumed mornings). Surface major decisions late-evening. Customer-side quiet hours (8am-9pm) stay as-is, separate concern.

### Q16: Outsourcing customer-facing functions = structural rule
Lead, marketing, sales, receptionist companies all burned. Unifying rule: BPP does NOT outsource customer-facing functions. What CAN be outsourced: bookkeeping, taxes, infrastructure, install labor (with Key's structure).

### Q15: No additional explicit rejections beyond Avoid List
Captured "nothing concrete." Avoid List as currently populated reflects the full set of explicit rejections.

### The hidden cost of inaction (spontaneous mid-interview)
"There is a price to trying something new but there is also a price to not trying something new." Captured immediately. Bilateral framing of decision cost; both options have a price, pick the cheaper including the inaction one. Operational impact: bias toward proposing experiments, name the cost of NOT doing it explicitly.

### Q14: No hidden rules
Brain we've built is the rule set. No secret-Key-rule guesses; gaps go to Open Questions.

### Q13: Reversibility test = canonical autonomy boundary
"The less it can be undone the more I want in on the loop before it gets done. The big things that can't be undone are money and client perception." Promoted to top of CLAUDE.md. Subsumes most older "ask vs proceed" guidance.

### Q12: Bet on destination, experiment on path
"Both. Mostly small parallel tests but the big bet on occasion. Think of it like betting on the destination and experimenting with the best ways to get there." Decision rule: destination-shaped vs path-shaped. Don't experiment on destinations.

### Q11: Gut IS data internalized
Key's gut is not the alternative to data; it's the data compressed. When Claude pushes back, "what are you seeing that I'm not?" is the right response. When gut and data diverge, that's the rare-and-meaningful case.

## 2026-05-05 (Round 1, 2, 3 + product changes)

### Q10: Real voice corpus extracted
Pulled 200 outbound key-sender messages, filtered to 73 real Key SMS, locked 12 most-representative as new voice corpus. Replaced placeholder.

### Q9: Anti-archetype captured (slick / cheesy / pander)
14 phraser regex bans added against the contractor-caricature voice (industry-leading, top-rated, world-class, expert technicians, "we'll take care of you," "leave it to us," buddy-pander register).

### Q8: Cringe + desperation bans locked in
12 phraser bans (4 cringe phrases + 8 desperation tells). All cold-lead nudges rewritten to remove "just" minimizers and apologetic frames. Three voice principles in priority order: NEVER sound desperate, authentic over clever, premium posture.

### Q7: Voice corpus captured + phraser regex over-correction reversed
"Happy to help" was banned but Key uses it naturally. Removed from regex. Added product naming preferences and Key's actual ack/closer/greeting list to phraser system prompt.

### Q6: Burn-shaped instincts (Angie's List, off-the-shelf CRMs, house flippers)
Avoid List entries created. "If you want it done right, do it yourself" → bias toward build over buy.

### Q5: The canonical good-Key-call (hourly → flat-rate specialty pivot)
Decision shape filter extracted: narrowing, clean economics, early signal, calculated. Now applied to every Claude proposal.

### Q4: Personal stakes / risk posture
24, single, low overhead, long horizon. Default to bold. Compound over fast. "Fast learning loops with durable bets."

### Q3: Losing picture + $3K survival floor
Tripwire: trailing 30-day profit trending toward $3K = code-red. Demand exhaustion + sub-economics-fail + inconsistent leads/conversions are the failure modes.

### Q2: 12-month winning picture (multi-state, hands-off, $5K/mo)
North star. Every operational decision should ladder to it.

### Q1: Origin story + "feeling of power" framing
Florida + SC hurricane experience → BPP serves the customer's feeling-of-power-restored. Product is emotional, not transactional. Premium-not-bigger-than-it-is brand stance fits this.

### Pre-interview: framework establishment
Autonomous mode (recognize-and-go), thinking style (broaden before narrowing), ground-truth verification + Production Surface Map, experiments-owner protocol, all locked into CLAUDE.md as session-inherited context.
