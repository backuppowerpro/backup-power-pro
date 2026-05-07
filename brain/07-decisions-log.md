> This file is auto-synced from `wiki/Key/<name>.md` via `scripts/brain/sync-from-wiki.sh`.
> Edit the wiki source, not this file. Sanitization strips specific dollar figures, account balances, and phone numbers.

---
title: Decisions Log
branch: Key
type: ledger
updated: 2026-05-05
tags: [key, decisions, ledger, append-only]
---

# Decisions Log

> Append-only ledger of every judgment call. Newest at the top. Each entry: what + why + scope + reversibility. When a decision later flips, leave the original and add a new entry citing the flip.

This is the single most important file in [[00 Key Index|Key/]] for Claude. Before re-proposing any approach in any session, scan here for precedent.

---

## Format

```
### YYYY-MM-DD: Short title
**Context:** what triggered the decision
**Decision:** what Key chose
**Why:** rationale
**Scope:** where this applies (specific surface? all of BPP?)
**Reversibility:** flip-condition (what evidence would change this)
**Refs:** related files
```

---

## Decisions

### 2026-05-07: Build 1 (comm-orchestrator) shipped + brain auto-sync wired
**Context:** Key said "do everything now, dont wait for later sessions." Two tracks closed in one push.
**Decision (Build 1):** Shipped `comm-orchestrator` edge function. Hourly cron pattern (quiet-hours-aware), stage 5/7/8 customer triggers, weekly Mon-9am Key digest of contacts stalled 14d+. Stage 4+ "Key handles personally" rule preserved (only permit-pipeline status sends auto-fire). Markers stored as `__orch_<trigger>:<iso>` on contacts.notes. Cron migration staged but waits on one manual db push (Supabase dashboard SQL editor) due to 20260505* migration drift.
**Decision (brain auto-sync):** `scripts/brain/sync-from-wiki.sh` mirrors wiki/Key/ → brain/ with sanitization (strips dollar specifics, account balances, phone numbers). PORTABLE-BRAIN.md auto-regenerated as concatenation of the seven sanitized files. MEMORY.md footer updated to point at brain/ as canonical, wiki/00 Home.md as business knowledge, wiki/Key/ as per-machine workshop.
**Decision (cloud-agent fetch):** Public github raw URL is the fetch path. `curl https://raw.githubusercontent.com/backuppowerpro/backup-power-pro/main/brain/PORTABLE-BRAIN.md` gets a fresh agent the full operating context with no auth. Documented in CLAUDE.md.
**Reversibility:** All three changes are file-shaped + tracked. `git revert` undoes any of them. Comm-orchestrator carve-out (no customer SMS to stage 4+ except permit pipeline) is the one client-perception edge, but the function won't fire customer SMS without an explicit __orch trigger condition met, and DNC + ai_disabled gates run first.
**Refs:** [[Active Priorities#Top 3 in flight]], `supabase/functions/comm-orchestrator/index.ts`, `scripts/brain/sync-from-wiki.sh`, [[BPP/CLAUDE]].

### 2026-05-06: The hidden cost of inaction (spontaneous, mid-interview)
**Context:** Key surfaced this mid-interview, outside the question stack. Captured immediately so it doesn't die in chat history.
**Principle (verbatim):** "There is a price to trying something new but there is also a price to not trying something new."
**Why it matters:** Most decision frameworks weight option A against a free zero. That's wrong. The "do nothing" default carries its own bill (opportunity cost, competitor advancement, skill atrophy, status-quo decay, waste of accumulated context) and that bill compounds. Captured before captured by Bezos in regret-minimization, but Key's framing is sharper because it's bilateral: BOTH options have a price; pick the cheaper one, including the inaction one.
**Operational implications for Claude:**
1. Bias toward proposing experiments and changes. The cost of not proposing is real.
2. When evaluating any proposed move, name the cost of NOT doing it alongside the cost of doing it. Make the inaction price visible.
3. Status-quo recommendations need a cost-of-status-quo argument; "things are fine" is never free.
4. The 12-month destination bet sits on top of this principle: staying solo + hourly had a real (rising) cost; the pivot has a real cost; doing neither would have been the largest cost of all.
**Refs:** [[How I Decide#The hidden cost of inaction]], aligns with [[How I Decide#Experiments]] (path tests are how we pay the smaller "trying" price), [[Decisions Log]] entry on the pivot (canonical proof of the principle in action).

### 2026-05-06: Reversibility test = the autonomy boundary (Q13)
**Context:** Interview Round 3 Q13 ("When do you want to be asked vs told?").
**Answer captured (verbatim):** "The less it can be undone the more I want in on the loop before it gets done. The big things that can't be undone are money and client perception."
**The principle:** apply reversibility as the FIRST filter on every action. Mental shortcut: picture the rollback. `git revert` or "edit a file" = proceed. "Draft an apology to a customer" / "explain why the bill is higher" / "delete a public post" = ask first.
**The two named irreversibles:**
1. Money (purchases, payments, refunds, ad spend, pricing changes, discount activation).
2. Client perception (real customer SMS, email, public posts, GBP, ad creative going live, public-facing copy, proposal text to real leads).
**Promoted to CLAUDE.md** as "The autonomy boundary" section, top of file before the hard rules. Subsumes most older "ask vs proceed" guidance under this single test. Existing hard rules (em-dashes, geography, brand) become second-line guardrails.
**Refs:** [[How I Decide#Reversibility test]], CLAUDE.md "The autonomy boundary."

### 2026-05-06: Lifestyle preferences add quality + toys tier; Path E becomes more central
**Context:** Asked Key for the third gap; he answered career + skills, then volunteered lifestyle preferences as a follow-on.
**Lifestyle captured:** Loves nice things (premium aesthetic). Wants small but nice home (quality > volume / showiness). Loves toys: Porsche (owns 987 already), RZR, Teslas.
**Recalibration of the freedom thesis:**
- Prior estimate: $10-15K/month household income = comfortable family support
- Updated: $10-15K/month is the FLOOR (time-agency + family-support tier). Toys + property tier needs $20-25K/month income OR meaningful capital accumulation funding the upgrades.
- Year-2 BPP destination is no longer the finish line; it's the comfort floor. Lifestyle goals require Path E (capital allocation) compounding to fund toys/property purchases without straining BPP cash flow.
**Why this matters:** Path E moves from "interesting parallel option" to "essential lever." Without it, the lifestyle goals (Porsche GT3 someday, small-but-nice home, Teslas) are out of reach even after BPP hits its destination. The hidden-cost-of-inaction principle applies directly: skipping capital allocation = skipping the toys/property tier.
**Brand-stance consistency:** "Small but nice" is coherent with BPP's premium-not-cringe + never-bigger-than-it-is brand. Quality over showiness is the same instinct on personal-life and on customer-facing-brand sides.
**Refs:** [[Identity#What "financial freedom" actually means]] (updated with lifestyle additions and the floor-vs-finish-line framing).

### 2026-05-06: Career arc + hidden skills captured, surfaces Path E (capital allocation)
**Context:** Last of the three sharpening questions Claude flagged as gaps after the millionaire response.
**Captured:**
- Trade career: apprentice (commercial + residential new construction + service) → self-employed general residential electrician → BPP specialty inlets (mid-pivot)
- Hidden skills: art + graphic design, selling (called out twice as a real strength + something he likes), high-school streetwear reselling business, stocks + options trading with Tesla success
**Strategic implications (this is the meaningful part):**
1. **Sales is a primary skill, not auxiliary.** Combined with Q16's vendor burn history, this DOUBLE-bans outsourced sales from BPP regardless of scale. Key drives every selling surface; Ashley/CRM/proposal flow is designed FROM his selling instinct, not toward it.
2. **Visual / brand design stays in-house.** Don't propose external agency or design hire. Key + Claude Design + brand tokens are the production stack.
3. **Tesla success is the real capital-markets validation.** Confirms asymmetric-bet execution track record. Munger/Buffett analogy from Q19 is no longer aspirational; Key has actually traded with conviction and won. Capital allocation is a real lever.
4. **Streetwear teen-business** = "I've shipped a real business before" muscle already present. Path B (productize) still overshoots on time-grind grounds, but the founder-skill objection is gone.
5. **New path surfaced (Path E):** BPP as cash-flow machine + capital allocation as the wealth lever. Lowest time-cost, highest fit with Q19 dream job, leverages real Key edge (trading instinct + Tesla track record + capital-markets literacy). Risks: single-stock concentration, past performance not guaranteed, lottery-shaped on 2-year horizon. Position as parallel stream, not primary.
**Refs:** [[Identity#Career arc + skills inventory]], [[Identity#Capital position]], [[Identity#What "financial freedom" actually means]] for the destination test.

### 2026-05-06: Financial freedom redefined + capital position captured (post-millionaire question)
**Context:** Asked about hidden gaps after the millionaire-question response. Key answered with the real definition of his goal and his capital snapshot.
**Goal redefinition:** "Not being totally dependent on working every day and making enough to support a family in the future comfortably." This is far short of "$1M net worth in 24 months." It's time-agency + comfortable-future-family-support. ~$10-15K/month household income at current cost-of-living is sufficient at scale, not 7-figure income.
**Capital snapshot:** $30K business bank, $2-5K personal, $25K Roth/investments, paid-off 1987 Porsche 987, paid-off electrical van, mortgage on condo (paid down $20K). Net liquid ~$57K, deployable for moves ~$15-20K without strangling ops.
**The recalibration:**
- BPP at hands-off scale ($5K/month personal at 12 months, $10-15K at 24 months) IS the answer. Don't need to overshoot.
- Path B SaaS productize: overshoots the goal, demands grind Key doesn't want per Q19.
- Path C real estate: tight on capital but possible with one small deal in year 2.
- Asymmetric "swing for fences" plays: wrong target. Right-size to the actual destination.
- The boring answer (BPP scale + dollar-cost-average + maybe one small real estate deal year 2) is highest-fit.
**Captured both in [[Identity#What "financial freedom" actually means]] and [[Identity#Capital position]].**
**Key insight:** The brain previously held "financial freedom" as an abstract aspiration (Q4) and the millionaire question revealed it could mean wildly different things. Without this clarification I would have continued advising toward asymmetric bets that overshoot what Key actually wants. Goal precision is upstream of strategy.
**Refs:** [[Identity#What "financial freedom" actually means]], [[Identity#Capital position]], [[Active Priorities]] (12-month destination still aligned), millionaire-question paths above.

### 2026-05-06: Round 5 (vault meta) Q20 + Q21
**Q20 ("What's missing from the brain?"):** "I feel like I'm explaining UX/UI elements a ton."
**The gap:** UX/UI preferences were scattered across the auto-memory file (`~/.claude/projects/.../memory/MEMORY.md`) and `wiki/CRM/Style Guide.md` but never consolidated into the wiki/Key/ brain. Future sessions had to re-learn from fragments.
**Fix shipped:** Created `wiki/Key/Design Language.md`, canonical UX/UI reference. Consolidates: two surface families (customer-facing polished marketing vs internal Minesweeper Brutalist + 8-bit), one app two layouts, Claude Design first, design every feature affordance, iOS safe-area, smart-versions-of-basic-things, brand tokens, CRM bevel/transition/typography rules, customer-facing rules, anti-patterns, decision tree for ambiguous cases. Cross-links to `wiki/CRM/Style Guide.md` for the deeper CRM dive.

**Q21 ("Anything you don't want me to capture?"):** "No you are all good, the more the better."
**Translation:** No privacy ceiling. Capture freely. Continue expanding the brain. (Common-sense filters still apply: don't volunteer specific financial numbers Key hasn't shared, don't speculate about family, don't fabricate.)

**Round 5 complete. Interview complete.** All 21 questions captured plus the spontaneously-surfaced hidden-cost-of-inaction principle. Brain is rich enough to predict Key's reaction to most proposals.

### 2026-05-06: Q19 (dream-job framing), the unifying pattern of the whole interview
**Context:** Interview Round 4 Q19 ("What gives you energy that you want more of?").
**Answer captured (verbatim):** "I like orchestrating things, the person that makes high level decisions. My dream job would be self-learning all day to sharpen my mind to a point I could make 1 decision every so often that changes a trajectory in a large positive direction."
**Why this is the most operationally-actionable answer in the interview:** It is the unifying frame for every other answer. Munger/Buffett/Thiel pattern: compound knowledge slowly, make rare high-leverage decisions. Q2 (captain), Q5 (fast pivot), Q11 (gut is data internalized), Q12 (destination bets), Q4 (long horizon), Q18 (drainage) are all instances of the same operating preference.
**Recalibrations for Claude:**
1. **Surface fewer decisions, make each matter.** Don't bury Key in small calls. Save his decision-budget for trajectory-changers.
2. **Synthesis over data.** Morning brief is insight-shaped, not metric-dump.
3. **Curate learning material** for Key (industry data, frameworks, case studies). Not just dashboards.
4. **Protect 8pm-12am for learning** (per Q17). Don't fill it with admin.
5. **Bandwidth-weight proposals:** "trajectory-changer" vs "small path-finding." Different decision-budget asks.
6. **Audit and cut operational noise** in everything currently surfaced to Key. Three buckets: learning, trajectory question, noise. Route accordingly.
7. **Labor split:** Claude does more operational thinking + small-path execution; Key does more learning + trajectory-deciding.
**Audit candidates (where am I currently surfacing noise?):** CEO morning brief content (some items might be tactical, should auto-handle), experiment-monitor alerts (low-severity ones might not need to reach Key), permit-status updates (status changes themselves can fire automatically with no Key surface). Pass through these and re-categorize.
**Refs:** [[Identity#What energizes Key]], all Round 1-4 interview entries (this answer is the synthesis).

### 2026-05-06: Permit-limbo customer nudges added to orchestrator spec
**Context:** Q18 follow-up. Key flagged a specific pain: "quick updates for people while they are waiting for their permits so they don't think I just ghosted them."
**The pattern:** Customer is in permit-pending state. Nothing's actually changed (jurisdictions run on their own timelines). Without proactive nudges, customer assumes Key forgot about them. Trust erosion in the silence.
**Cadence added to orchestrator spec:**
- T+3 days from submission: "Permit's in with [jurisdiction], typically [N] business days, I'll text once approved."
- T+7 days: "Still waiting on [jurisdiction]. They run their own timeline, nothing for you to do, just keeping you in the loop."
- Past typical+3d: internal Key SMS warning + customer SMS "Permit's running past their usual window. I'll follow up with them and let you know."
**Why this matters operationally:** This isn't customer service polish, it's trust preservation in a state where Key has no actionable update but the customer experiences silence as abandonment. The cost of silence is real (Q-hidden-cost-of-inaction principle directly applies).
**Refs:** [[Active Priorities#Drainage map]], permit state machine in Build 2.

### 2026-05-06: Q18 clarified, drainers are orchestration problems, not copy problems
**Context:** Q18 follow-up. Asked Key which layer of client communication drained.
**Answer captured:** "Pretty much all communication and reminders and follow ups. Not hard but tricky when you have so many moving parts and so many contacts at different stages." Plus permits: "all different jurisdictions with different websites and processes."
**Reframe:** Both drainers are not copy or process problems, they're **orchestration problems**. The friction is context-switching across many contacts at different stages and many jurisdictions with different rules. The mental tax of "who needs what next" is what burns, not the messages themselves.
**Implications for builds:**
1. Client-comm fix is a **stage-aware orchestrator** with per-stage triggers (timers + events) firing the right outbound automatically. Existing pieces: bot-reengagement (pre-quote), quote-due-watcher (Key-side), proposal-nudge, auto-review-ask. Missing piece: the post-quote-to-install middle layer.
2. Permits fix is a **per-jurisdiction playbook + state machine + status tracker**. Existing pieces: mailing-inserts paperwork, sc-jurisdictions.json data. Missing pieces: portal-per-jurisdiction playbooks, permit state machine, status-change-triggered customer notifications.
3. Both feed the same orchestrator: permit state changes fire customer SMS through the same cadence engine.
**Filed in [[Active Priorities#Drainage map]] with concrete trigger tables.**
**Refs:** [[Active Priorities#Drainage map]], existing edge functions (`bot-reengagement`, `quote-due-watcher`, `proposal-nudge`, `auto-review-ask`), `permits/`, `bot-lab/sc-jurisdictions.json`.

### 2026-05-06: Drainers to automate next: client communication + permits (Q18)
**Context:** Interview Round 4 Q18 ("What drains you that you wish you could automate next?").
**Answer captured:** "Client communication. Permits."
**Why this matters:** These are direct PATH workstreams toward the 12-month destination bet (hands-off ops). Hands-off requires both layers automated because Key can't run them while not running installs. Big leverage.
**Layers within each:**
- Client communication: pre-quote intake (Ashley handles); post-quote follow-up, scheduling, permit-status updates, install-day prep, post-install review request (mostly NOT automated yet). Need to clarify with Key which layer specifically drains.
- Permits: per-jurisdiction paperwork (partial), submission, status tracking + reminders (none), inspection scheduling, customer notifications. Mailing-insert pattern is one prior wedge; the rest is open territory.
**Filed in [[Active Priorities#Drainage map]] as a top priority workstream.** Open question: which client-comm layer drains most.
**Refs:** [[Active Priorities#Drainage map]], `permits/` directory, [[Operations/Permit Jurisdictions]].

### 2026-05-06: Best hours = 8pm-12am (Q17, corrects prior wrong inference)
**Context:** Interview Round 4 Q17 ("When are your best hours?").
**Answer captured:** "Best hours are surprisingly at night, 8pm-12am."
**Correction made:** Earlier in [[Identity]] Claude had inferred "mornings best for execution; afternoons for installs; evenings for thinking. Don't schedule deep decisions at 9pm." That last bit was the OPPOSITE of true. Corrected.
**Implications for Claude:**
1. Surface major decisions and nuanced briefs in the 8pm-12am window. That's when Key has leverage attention.
2. CEO morning brief stays tight + action-oriented (consumption, not deep work).
3. Schedule big-thinking proposals for late-evening firing, not 6am.
4. Customer-side quiet hours (Ashley nudges, bot-reengagement) STAY 8am-9pm ET, that's the customer's window, not Key's. Separate concern.
5. ScheduleWakeup cadence in autonomous mode: when waiting for Key engagement on a decision, late-evening is the optimal fire time.
**Refs:** [[Identity#Current life context]], `bot-reengagement` quiet-hours logic (unchanged for customer side).

### 2026-05-06: Vendor outsourcing of customer-facing functions = structural rule (Q16)
**Context:** Interview Round 4 Q16 ("Things you've tried that didn't work").
**Answer captured:** Lead companies, marketing companies, sales companies, receptionist companies. Four vendor categories, all burned.
**The unifying pattern:** outsourcing customer-facing functions to vendors. Promises don't match Key's quality bar; customer perception (the irreversible from Q13) gets damaged.
**Structural rule promoted to [[Avoid List]]:** **BPP does not outsource customer-facing functions.** Lead gen, marketing copy, sales, reception, customer conversations, all in-house (Key + Claude + tuned tooling). What CAN be outsourced: bookkeeping, taxes, infrastructure, install labor (with Q6 structure-on-Key's-terms).
**Refs:** [[Avoid List#Outsourcing customer-facing functions to vendor services]], connects to Q6 (vendor pitches), Q13 (client perception irreversible), Q9 (the slick / pander archetype is what these vendors ship).

### 2026-05-06: No additional explicit rejections (Q15)
**Context:** Interview Round 4 Q15 ("Things you've considered and decided against").
**Answer captured:** "Nothing concrete."
**Implication:** [[Avoid List]] as currently populated reflects the full set of explicit rejections Key has top-of-mind. Anderson County, whole-home Generac/ATS, Angie's List + lead-gen aggregators, off-the-shelf CRMs, Zapier, Quo for primary CRM, video assessments, sales/discounts, "tomorrow morning" promises, em-dashes, fake-Southern voice, slick/cheesy/pander archetype, manufactured urgency. New rejections get added as Key encounters and articulates them, not preemptively.

### 2026-05-06: No additional rules surfaced (Q14)
**Context:** Interview Round 3 Q14 ("A rule you have that I probably haven't picked up").
**Answer captured:** "Not that I can think of off the top of my head."
**Implication:** the brain we've built (Identity, How I Decide, My Voice, Avoid List, Active Priorities, Decisions Log) is now the operating rule set. No hidden rules withheld. If Claude encounters a decision that the brain doesn't cover, that's a real gap to surface as an [[Open Questions]] entry, not a "Key's-secret-rule" guess.
**Refs:** [[Open Questions]] is the single home for unresolved questions; brain is otherwise canonical.

### 2026-05-06: Experiments framing locked (Q12): destination bets vs path experiments
**Context:** Interview Round 3 Q12 ("What's your relationship with experiments?").
**Answer captured:** "Both. Mostly small parallel tests but the big bet on occasion. Think of it like betting on the destination and experimenting with the best ways to get there."
**The framework:**
- **Destination = big bet.** High conviction, committed, not up for re-litigation. (Specialty inlets, 12-month hands-off picture, premium positioning, Anderson exclusion.)
- **Path = experiment surface.** Many small parallel tests for the best route. (Greeting variants, nudge copy, channel mix, ad creative, handoff format.)
**Decision rule:** "is this destination or path?" If it changes WHERE we're going, it's a destination bet (locked once decided, treated like Q11 gut-and-data conviction). If it changes HOW we get to the same destination, it's an experiment (sample target, decision rule, postmortem).
**Default cadence:** many small parallel tests. Big bets on occasion. Don't experiment on destinations; don't make big bets on path-finding.
**Operational implication for Claude as head of experiments:**
1. Before designing any test, ask: is this destination-shaped or path-shaped? Don't run an A/B on the destination.
2. Default to many small simultaneous tests with cheap-to-fail variants.
3. When Key proposes (or Claude needs to propose) a destination bet, treat it as a deliberate convocation, not a routine experiment row.
**Refs:** [[How I Decide#Experiments]], [[Active Priorities]], `bot_experiments` table.

### 2026-05-06: Gut-vs-data relationship captured (Q11): gut IS data internalized
**Context:** Interview Round 3 Q11 ("When do you trust your gut over data?").
**Answer captured:** "I trust my gut and intuition a lot. Usually though it's because I ingested all the data and believe the data."
**Why this matters:** Key's gut is not the *alternative* to data; it's the data compressed into pattern-recognition. Treating his gut as a hunch (and trying to argue past it with surface metrics) misses what's actually happening: years of customer reads, market feedback, install patterns, ad performance, all collapsed into fast intuition.
**Recalibrations for Claude:**
1. "This feels right" / "I'm not sure" from Key = serious signal, not hunch.
2. Gut-data divergence is the rare-and-meaningful case. Investigate either-side: misleading data OR missing context for gut.
3. Always present analysis + data read, then defer to Key's gut for the call. Don't pre-conclude.
4. When Key pushes back, the response is "what are you seeing that I'm not?" not "but the data says..."
**Refs:** [[How I Decide#Gut vs data]].

### 2026-05-06: Real voice corpus extracted (Q10) and the 12 exemplars locked
**Context:** Interview Round 2 Q10 ("Real text exemplars"). Key authorized Claude to pull directly from his Quo / Supabase messages instead of him pasting examples.
**How it was done:**
1. Built `voice-corpus-pull` edge function (brain-token gated, read-only) that queries `messages` table for `direction='outbound', sender='key'`, length 30-280, excluding Ashley/template/transactional patterns.
2. Returned 186 candidates after filter from 200 most-recent outbound. Reviewed all in two passes; second pass also stripped Ashley template patterns that slipped through (the pre-2026-05-05 era when send-sms hardcoded sender='key' for all outbound including bot output).
3. Ended with 73 real Key-authored SMS. Selected 12 most-representative for register diversity (greeting, spec answer, value education, technical caveat, photo ack, install ask, permit timing, scope check, scope decline, closing offer, recap, teaching parenthetical).
**Replaced placeholder corpus** at `bot-lab/voice-corpus.md` (was flagged "PLACEHOLDER" since 2026-05-02; voice-corpus.md said real Key SMS would lift voice score 1-2 points). Status now "REAL."
**Cross-cutting voice patterns extracted:** first-person ownership, tight-when-customer-tight, parenthetical teaching, recap closer ("Just to lock it in: ... Look right?"), specific numbers never vague, trade vocab natural, casual no-period sentence ends, "I would be happy to help out with the project!" as canonical warm closer, honest hedges ("I can't guarantee," "typically"), "Thank you" + concrete action.
**Key linguistic distinction captured:** "just to lock it in" / "just behind the panel" (action modifier, keep) is opposite register from "I just wanted to check in" (apologetic minimizer, banned per Q8). Same word, two registers.
**Refs:** [[My Voice#Real voice patterns]], `bot-lab/voice-corpus.md`, `supabase/functions/voice-corpus-pull/index.ts`.

### 2026-05-05: Anti-archetype captured (Q9): slick / cheesy / pretends-bigger / pander
**Context:** Interview Round 2 Q9 ("The customer voice you're trying to NOT sound like"). Specific archetype Key gave: slick talker with big commitments and little execution, cheesy, disorganized but pretends he's put together, "feels bigger and more competent than he is," "get down on your level type people."
**Captured archetype to filter against:**
1. **Slick talker:** big verbal commitments, no execution. "We'll take care of you" with nothing concrete.
2. **Cheesy infomercial:** hyperbole + manufactured warmth + exclamation overload.
3. **Disorganized-pretending-put-together:** smooth presentation, sloppy execution.
4. **"Feels bigger than he is":** over-claims experience / team / install count / certifications.
5. **"Get down on your level" panderer:** fake-buddy register ("hey buddy," "my man," etc.) as a sales tactic.
**Unifying tell:** performance gap between presentation and reality. BPP runs the inverse: **competence shown through behavior; words narrower than the work; never bigger than it.**
**Phraser regex bans added:**
- "we'll take care of you" / "leave it to us" / "in great hands"
- "industry-leading" / "top-rated" / "world-class" / "thousands of satisfied customers" / "expert technicians" / "highly skilled team"
- "we pride ourselves" / "go above and beyond" / "go the extra mile" / "treat your home like it's our own" / "no job too big or too small"
- Buddy-register opener bans: "hey buddy," "hello buddy," "hi buddy," etc, plus "champ," "boss," "my man," "partner," "big guy," "chief," "brother," "bud," "big dog"
**Rule for future copy:** never write a phrase whose claim outsizes Key's actual demonstrated record. If we can't back it with behavior, it doesn't appear.
**Refs:** [[My Voice#The anti-archetype]], [[Avoid List#The slick / cheesy / pander contractor archetype]], `supabase/functions/bot-phraser/index.ts` REJECT_PATTERNS.

### 2026-05-05: Cringe + desperation bans locked in (Q8 + emphasis)
**Context:** Interview Round 2 Q8 ("Words that make you cringe"). Key gave a principle ("don't be cringe, be authentic") and four specific cringe-phrases, then immediately followed up with a hard rule: **"don't ever ever ever sound desperate."**
**Captured principles (now top of [[My Voice]]):**
1. **NEVER sound desperate.** Premium service is held by the seller, not begged for. Confident-and-low-pressure beats eager-and-warm.
2. **Authentic over clever.** Don't add sales hooks, urgency lines, "trust me" attempts to short-circuit credibility.
3. **Premium posture, no race to the bottom.** No sales, discounts, or "competitive pricing" framing.
**Phrase bans added to phraser regex:**
- Cringe-set: "act now," "best in the business," "trust me on this," "competitive pricing"
- Desperation-set: "I just wanted to," "sorry to bother," "hate to bother," "any chance you could/can/might," "don't want to be a pain/annoying/pushy," "hoping you'll/will," "pretty please," "if it's not too much trouble," "we really need"
**Audit-and-fix:** Bot-reengagement nudges I shipped earlier had 8 instances of "just" as the apologetic minimizer + 4 apologetic frames ("didn't want to leave you hanging," "if it's not the right time totally fine"). All 14 nudge variants rewritten to confident-and-low-pressure: "Circling back on..." / "Quote is still open on your end..." / "Holding the quote for you..." / "Stepping back on this for now." Zero apologetic frames, zero "just" minimizers, premium posture preserved.
**Refs:** [[My Voice]], [[Avoid List]], `supabase/functions/bot-phraser/index.ts`, `supabase/functions/bot-reengagement/index.ts`.

### 2026-05-05: Voice corpus captured + phraser regex over-correction reversed
**Context:** Interview Round 2 Q7 ("Words you use a lot without thinking").
**Captured:**
- **Acks:** "Perfect." / "Sounds good." / "Got it." / "Thank you." / "Ok." / "Definitely." / "Yes."
- **Sign-offs:** "I'm so glad I could help." / "Happy to help." / "Happy I could help."
- **Greetings:** "Good morning." / "Good afternoon." / "Hello!"
- **Product naming:** "portable generator home connection box" / "safety power transfer system."
**Product changes shipped:**
1. **Removed `happy_to_help` regex ban** in `bot-phraser/index.ts` REJECT_PATTERNS. Key uses the phrase naturally; the ban was over-corrected against generic SaaS-bro overuse. Discipline now lives in the system prompt (use sparingly when warmth is warranted), not a hard regex reject. Kept `happy_to_assist` banned (that one is genuinely SaaS-bro, never Key).
2. **Added "PRODUCT NAMING" section** to phraser system prompt directing customer-facing copy to use Key's plain-English names ("portable generator home connection box" / "safety power transfer system") over tradesperson-internal terms ("inlet box," "interlock kit," "hookup").
3. **Added "KEY ACKS / CLOSERS / GREETINGS" section** to phraser system prompt with the verbatim list, instructing the LLM to mirror these rather than invent new ones.
**Why it matters:** This is the first set of product changes that came from interview content rather than code review. The voice-corpus.md placeholder problem (per `bot-lab/voice-corpus.md`, voice score lifts 1-2 points with real Key SMS) is being directly solved as we go.
**Refs:** [[My Voice]], `supabase/functions/bot-phraser/index.ts`, `supabase/functions/bot-phraser/system-prompt.ts`.

### 2026-05-05: Burn-shaped instincts captured (Angie's List, off-the-shelf CRMs, house flippers)
**Context:** Interview Round 1 Q6 ("A decision you'd take back").
**Burns captured:**
- Angie's List promised quality leads, didn't deliver.
- Multiple CRMs promised XYZ, didn't deliver.
- House-flipper relationship ended over quality vs profit mismatch.
**Lessons internalized:**
1. Skeptical of "solution-in-a-bottle" vendor pitches. Bias toward built-by-us over bought-from-vendor.
2. "If you want something done right, do it yourself." DIY default; will delegate but on Key's terms.
3. Quality > profit when forced to choose. Won't compromise on quality for someone else's margin.
4. Scar tissue is data: pattern-match new vendor pitches to past burns before getting excited.
**Operational implications added to brain:**
- [[Avoid List]] entries for lead-gen aggregators (Angie's List + family), off-the-shelf CRMs (Salesforce et al), "solution in a bottle" pitches, partners with misaligned quality vs profit values.
- [[How I Decide]] new section "Burn-shaped instincts" with translation rules for Claude (never use vendor-marketing language; bias to build over buy; delegation must include structure Key controls; quality wins quality-vs-profit conflicts).
**Refs:** [[How I Decide#Burn-shaped instincts]], [[Avoid List]], [[Identity]].

### 2026-05-05: The canonical good-Key-call captured (hourly general → flat-rate specialty pivot)
**Context:** Interview Round 1 Q5 ("A decision in the last 6 months you're proud of").
**Answer captured:** Pivoted from hourly general residential service electrical work to flat-rate specialized portable generator inlet installations. Pivot in progress, not fully done. Already seeing revenue up, profit up, overhead down. Frames it as a calculated risk + long game + delayed gratification.
**Decision shape Claude extracts:**
1. Decides quickly when conviction is high (not a months-long ruminator).
2. Narrows the lane rather than broadens.
3. Prefers flat-rate / clean-unit economics over hourly / messy.
4. Reads early signals (revenue / profit / overhead) without waiting for full validation.
5. Calculated-risk + long-game + delayed-gratification as a triad. Patience by analysis, not by default.
**Operational implication:** When Claude proposes a move, the implicit ask is now: is this **narrowing**, on **clean** economics, with a clear **early signal**, on a **calculated** risk? Yes-to-all-four = expect fast green light. Any "no" needs a stronger pitch.
**Pivot status:** Currently mid-transition. The pivot completing is itself an active priority that ladders into the [[Identity#What winning looks like|12-month winning picture]] (full sub-driven, multi-state ops require the specialty + flat-rate model to be fully embedded first).
**Refs:** [[How I Decide#Decision shape]], [[Identity]], [[Active Priorities]].

### 2026-05-05: Personal stakes / risk posture captured (24, single, low overhead, "fast and durable")
**Context:** Interview Round 1 Q4 ("What's at stake personally?").
**Answer captured:** 24, single, no kids, two cats, only debt is condo mortgage, low bills, family independent. Motivated by financial freedom and the freedom that money brings; wants velocity AND a stable foundation.
**Recalibration this triggers in Claude's defaults:**
1. Risk tolerance is higher than the average operator-with-kids profile. Don't soften bold proposals pre-emptively.
2. Long time horizon (decades). Decisions that compound over 6 to 18 months are fine even if they don't pay back next month.
3. The frame is **fast AND durable**, not fast-vs-durable. "Fast learning loops with durable bets" is the disposition.
4. BPP is a vehicle, not necessarily the terminal vision. Financial freedom is the bigger goal. Evaluate moves on "moves toward financial freedom?" not just "makes BPP marginally better?"
**Privacy note:** Specific financial details, family details, and personal life specifics are NOT captured beyond the shape Key gave. Don't expand.
**Refs:** [[Identity#Personal context]], [[How I Decide]] (risk-tolerance default).

### 2026-05-05: Losing picture + $3K/month survival floor captured
**Context:** Interview Round 1 Q3 ("What does losing look like in 12 months?").
**Answer captured:**
- Demand exhaustion (no more premium-willing customers)
- Sub model breaks financially (unit economics fail)
- Inconsistent earnings
- Inconsistent leads / conversions
- **Hard survival floor: < $X / month profit = losing.** Bare minimum.
**Key positioning detail:** "premium service" framing for the offer. BPP is not commodity-positioned; the bot, the site, the conversation, the proposal should all reinforce premium. (Aligns with the "feeling of power" emotional product framing from Q1.)
**Operational consequences:**
1. Need a $3K-floor tripwire. Trailing 30-day profit should be in the morning brief; trend toward $3K = code-red, not FYI.
2. Lead consistency + conversion consistency are first-class metrics, not vanity. PostHog already watches these (per CLAUDE.md PostHog protocol); reinforces priority.
3. Sub-economics is a top risk Claude should pressure-test before recommending sub recruitment. "Will subbing this out actually leave Key with $X profit?" is the question to answer before each handoff.
4. Demand exhaustion is monitored via TAM-saturation early warning. Today: CPL rising + close rate dropping simultaneously is the saturation signal. Add this to experiment-monitor checks.
**Refs:** [[Identity#What losing looks like]], [[BPP/Q2 Operating Goal]], CLAUDE.md PostHog protocol.

### 2026-05-05: 12-month winning picture captured (multi-state, hands-off, $5K/mo personal profit)
**Context:** Interview Round 1 Q2 ("What does winning look like in 12 months?"). Until this point Claude only knew the Hormozi Stage 3 trigger ("installs exceed solo capacity") which is fuzzy.
**Answer captured:**
- Zero personal tools / van by mid-2027. 100% sub labor.
- Operating in several cities between SC and NC.
- $X / month personal profit (working-backward anchor for install count).
- Operational feel: "captain of the ship, not scrubbing the deck." Brainstorming next chapter, not hustling next install.
**Why it matters:** This is the north star. Every operational decision should ladder up to it. Specifically:
1. NC expansion is on the table (changes the geography stance; Anderson SC still out for separate reasons).
2. Sub-recruitment + sub-quality is now a first-class workstream, not an afterthought.
3. CPL optimization matters because lower CPL × higher close rate = the per-install profit math that hits $5K/month with sane volume.
4. Anything that re-attaches Key to the wrenching side of the work (custom installs, complex one-offs) is a step backward unless it teaches a sub.
**Open math:** "Work backwards" requires a per-install owner-profit number Claude doesn't have yet. See [[Open Questions]].
**Refs:** [[Identity#What winning looks like]], [[Active Priorities]], [[BPP/Hormozi Scaling Roadmap]], [[BPP/Financial Roadmap]].

### 2026-05-05: Captured Key's origin story and the "feeling of power" framing
**Context:** Interview Round 1 Q1 ("Why this business?"). Until this point Claude had only inferred the motivation from observed work patterns.
**Answer captured:** Florida origin, moved to SC, lived through hurricanes both places. Watching storm damage and feeling powerless without electricity is the origin emotion. Other electrical work pays the bills hourly; this work lets Key help somebody regain their **feeling of power during a crisis**. Operationally also values the per-project scope (defined, consistent) over hourly.
**Why it matters for the brand:** The product is not the inlet box; the product is the feeling-of-power restored. Copy, ads, and conversation should meet customers in the "I don't want to feel powerless again" emotional state, not the "I need electrical work" transactional state.
**Scope:** Identity, brand voice, ad creative direction, customer-facing copy across all surfaces. Adjusted [[Identity]] with the real story; this also reinforces the [[Avoid List]] rejection of whole-home / ATS / commercial scope (those break the "defined and consistent" appeal that makes the work feel right to Key).
**Refs:** [[Identity#Why this business]], [[Avoid List]], [[BPP/Brand DNA Essay Apr 28]] (worth re-reading and possibly tuning to lean harder on this framing).

### 2026-05-05: Greeting copy locked at "Ashley, auto-text intake for Key" pattern (v3)
**Context:** v2 greeting led with warm context and disclosed mid-message ("auto-text from me"). Key worried customers would feel tricked when the warmth turned out to be a bot.
**Decision:** Lead with disclosure in word 5-6 ("Ashley, auto-text intake for Key Goodson at Backup Power Pro"), warmth right after.
**Why:** Honesty filter (see [[How I Decide]]). Customer-perceived snap-back from late disclosure costs more than an upfront-clinical opener saves.
**Scope:** all four EXP-009 greeting variants in `supabase/functions/_shared/exp008-variant.ts` and the `greeting_variants` table.
**Reversibility:** if EXP-009 data shows v3 first-reply rate <50% of v2 baseline, revisit wording. Disclosure-first principle does not flip.
**Refs:** [[My Voice]], [[Avoid List]] (entry: "Automated assistant" as opening label).

### 2026-05-05: No specific time-of-day promises ("tomorrow morning" etc) anywhere customer-facing
**Context:** SCHEDULE_QUOTE wrap-up promised "Key will send the quote by tomorrow morning." Real installs sometimes run long; the promise was breaking.
**Decision:** Soft commitment only. Canonical phrasing: "Key will put the quote together and send it your way."
**Why:** Honesty filter, plus trust capital is the actual asset. A promise broken once costs more than a promise made looser.
**Scope:** SCHEDULE_QUOTE intent + fallback (5 sign-off variants), bot-engine asking_about_price answer, bot-handoff-notifier promise line, bot-phraser system-prompt examples + new hard constraint, quote-due-watcher messaging.
**Reversibility:** does not flip. Soft commitment is the correct stance regardless of operational improvements.
**Refs:** [[My Voice]], [[Avoid List]] (entry: "By tomorrow morning"), `quote-due-watcher` function.

### 2026-05-05: Em-dashes (`, `) banned everywhere Key writes or Claude writes for him
**Context:** Em-dashes appeared in greeting variants, handoff SMS lines, code comments, and Claude's chat replies repeatedly across 2026-05-05.
**Decision:** Hard ban. Anywhere. Use comma, period, semicolon, or restructure.
**Why:** Brand voice rule. Em-dashes read as a writerly tic foreign to Key's small-shop tradesperson register.
**Scope:** all customer-facing copy, all internal SMS to Key, all commit messages, all code comments, all chat replies.
**Reversibility:** does not flip.
**Refs:** [[My Voice]], CLAUDE.md hard-rules section.

### 2026-05-05: Claude operates autonomously by recognizing task patterns (no `/work` command)
**Context:** Initial autonomous-mode setup required `/work <task>` invocation. Key wanted to drop tasks in natural language and have Claude self-start.
**Decision:** Recognize-and-go. CLAUDE.md "Autonomous Mode" section defines trigger heuristics (backlogs, "audit X," "improve Y," etc) and the loop protocol (implement → deploy → verify → commit → ScheduleWakeup).
**Scope:** how Claude responds to multi-iteration directives.
**Reversibility:** stays.
**Refs:** CLAUDE.md "Autonomous Mode," `.claude/settings.local.json` (338 pre-approved tools), `.halt` file convention.

### 2026-05-05: Claude scope expanded to head of experiments
**Context:** Key delegated full ownership of the experimentation loop (design → ship → watch → decide → propagate) to Claude.
**Decision:** Claude owns the loop within guardrails (no pricing/brand/geography/hiring without Key). Per-session scan for one experimentable question; check active experiments at top of every Ashley work; postmortem every decided experiment.
**Scope:** all experiment design + monitoring across BPP.
**Refs:** CLAUDE.md "Experiments" section, `bot_experiments` table, `experiment-stats` + `experiment-monitor` functions.

### 2026-04-07: CRM is Twilio-only; Quo continues for legacy until 5302 ports
**Context:** Migration off Quo for primary CRM messaging.
**Decision:** Twilio for all new CRM outbound; Quo (OpenPhone) keeps running auto-lead-response on (864) 400-5302 until that line ports to Twilio.
**Scope:** outbound SMS path.
**Refs:** memory file `twilio_integration.md`.

---

## Older decisions worth knowing

(Pre-this-log entries, Claude has knowledge of these from existing wiki + memory but should add formal entries above as they become relevant in autonomous decisions.)

- Bot lab pattern: build agents via sub-agent dojo before porting to production (per memory `bot_lab_pattern.md`)
- Hormozi Stage 2 (Advertise) currently; trigger to Stage 3 is "installs exceed solo capacity" (per memory `hormozi_roadmap.md`)
- Sales is text-only; no video assessments (per memory `key_preferences`)
- Form filling does not auto-submit on stale fields per security audit ([[Website/Form Friction Incident 2026-04-16]])

---

## See also

- [[How I Decide]], heuristics behind these decisions
- [[Avoid List]], decisions that hit the "promote to permanent rule" threshold
- [[Active Priorities]], what's in flight that may produce more decisions
