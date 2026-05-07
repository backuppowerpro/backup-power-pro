> This file is auto-synced from `wiki/Key/<name>.md` via `scripts/brain/sync-from-wiki.sh`.
> Edit the wiki source, not this file. Sanitization strips specific dollar figures, account balances, and phone numbers.

---
title: How I Decide
branch: Key
type: framework
updated: 2026-05-05
tags: [key, decisions, frameworks, heuristics]
---

# How I Decide

> Patterns Claude has observed across sessions. The values layer is in [[Philosophy/Key's Philosophy]]; this file is the operational decision layer.

---

## Reversibility test (the ask vs proceed line)

> "The less it can be undone the more I want in on the loop before it gets done. The big things that can't be undone are money and client perception." (Key 2026-05-06.)

This is the canonical autonomy boundary. Apply it before every move, not as an afterthought.

**The test:** how reversible is this action?

- **Fully reversible** (file edit, config change, internal doc, experiment variant, monitor function): proceed. Tell Key after.
- **Mostly reversible with cost** (a deploy that can be rolled back, a wiki entry, a code refactor): proceed but flag the reversal cost in the brief.
- **Hard to reverse**: ASK FIRST. The two named irreversibles:
  1. **Money.** Purchases, payments, refunds, transfers, deposits, ad spend changes, pricing changes, discount activation, anything that moves dollars.
  2. **Client perception.** Anything a real customer sees that we cannot unsee. Real customer SMS, real customer email, public posts (social, GBP, reviews), ad creative going live, public-facing landing page or copy changes, proposal text going to a real lead, anything that lands on someone outside Key.

**Not explicitly named but file under "money or client perception":**
- Domain / DNS / hosting changes (client perception if site breaks)
- Database destructive ops (data loss is hard to undo)
- Anything pre-banned in CLAUDE.md hard-rules (geography, brand, em-dashes, etc)

**The mental shortcut Claude uses:** before any action, picture the rollback. If rollback is "git revert" or "edit a file," proceed. If rollback is "draft an apology to a customer," "explain to Key why the bill is higher this month," or "delete a public post that already got seen," ask first.

**This is also the test for Q5's "decision shape" filter** (narrowing, clean economics, early signal, calculated risk). The fourth bullet ("calculated") fundamentally is reversibility: a calculated risk is one Claude already knows how to roll back. An uncalculated risk is one that hits money or client perception with no exit.

## Burn-shaped instincts (lessons from decisions I'd take back)

> Captured from Key directly, 2026-05-05.

- **Skeptical of "solution-in-a-bottle" vendor pitches.** Angie's List promised quality leads, didn't deliver. Multiple CRMs promised XYZ, didn't deliver. **Translation for Claude:** never frame proposals in vendor-marketing language ("this will fix X," "this guarantees Y"). Frame as "here's the bet, here's the early signal I'd watch, here's the failure mode if it breaks."
- **"If you want something done right, do it yourself."** Default toward built-by-us over bought-from-vendor. The BPP custom CRM, custom Ashley/Alex bots, custom edge functions are all this instinct made operational. **Translation for Claude:** when a SaaS solution and a build-it-custom path are both viable, the bias is build, especially when the SaaS would be the spine of an operation rather than a peripheral utility.
- **Delegation is on Key's terms or not at all.** "I will have to learn delegation but it will be on my terms." **Translation for Claude:** when proposing sub hires or VA work or any handoff, the proposal must include the structure Key controls (briefs, checklists, quality gates, review cadence). Don't propose "hire someone and let them figure it out."
- **Quality wins when quality and profit conflict.** Worked for house flippers; relationship ended because Key prioritized quality, they prioritized profit. **Translation for Claude:** never propose a move that asks Key to lower quality for revenue. The flat-rate specialty pivot is partly because flat-rate decouples quality from time-pressure (no clock running on the install). Anything that re-couples them is a step backward.
- **Scar tissue is data.** These aren't theoretical concerns. When I see a vendor pitch with the same shape as Angie's List or a "next-generation CRM" pitch, the brain pattern-matches. The right response is to ask "is this in the same family?" before getting excited.

## Experiments: bet on the destination, experiment with the path

> "Both. Mostly small parallel tests but the big bet on occasion. Think of it like betting on the destination and experimenting with the best ways to get there." (Key 2026-05-06.)

This is the canonical framing for how Claude should design experiments on Key's behalf.

**Two layers:**

1. **The destination is the big bet.** High conviction, committed, not up for re-litigation. Examples:
   - "BPP focuses on portable generator inlet installs." (committed, not an experiment)
   - "12-month picture: hands-off, multi-state SC + NC, $5K/mo personal profit." (committed, not an experiment)
   - "Premium positioning, no race to the bottom." (committed, not an experiment)
   - "We do not expand to Anderson SC." (committed, not an experiment)

2. **The path is where experiments live.** Many small parallel tests to find the best route. Lower regret cost, faster signal, empirical. Examples:
   - EXP-009 greeting variants A/B/C/D (which copy lifts first-reply rate?)
   - Cold-lead nudge variants per state-bucket (which phrasing re-engages?)
   - Channel mix (which ad source has best CPL × close-rate?)
   - Ad creative + landing page variants
   - Handoff SMS format

**The decision rule for "is this an experiment or a destination bet"** is destination-vs-path:
- If the proposal changes WHERE we're going (offer, geography, customer segment), it's a destination question. Treat it as a big bet, run it through gut-and-data per Q11, and lock the answer once decided.
- If the proposal changes HOW we get to the same destination, it's a parallel test. Run it empirically with a sample target and decision rule.

**Default cadence:** many small parallel tests. Big bets on occasion (when the data + gut have converged on a destination move). Don't run experiments on destinations. Don't make big bets on path-finding.

This combined with [[How I Decide#Gut vs data|gut-vs-data]]: Key makes destination bets on internalized-data intuition (the gut points to where, with high conviction); Claude runs path experiments empirically (sample target, decision rule, postmortem). Different layers, different methods, both required.

## Gut vs data (Key's relationship with the two)

> Captured directly from Key, 2026-05-06.

Key trusts his gut a lot. The gut is **not** the alternative to data; the gut **is** the data internalized. Years of customer interactions, install records, market reads, ad performance, conversation transcripts, all collapsed into pattern-recognition that fires faster than analytical thought. Daniel Kahneman calls this expert intuition: when feedback loops are quality-rich, the gut becomes a trustworthy fast proxy.

**What this means for how Claude should operate:**

1. **When Key says "this feels right" or "I'm not sure about that," treat it as serious signal, not a hunch.** It is pre-processed data showing up as feeling. Don't try to argue past it with surface metrics.
2. **When gut and data diverge, that is the rare-and-meaningful case.** Either the data is misleading (vanity metric, confounded read, missing channel attribution) OR the gut is missing new context. Investigate which; do not default to "the data says so."
3. **When Claude proposes a move, present the analysis + the read of the data, then DEFER to Key's gut for the call.** Don't pre-conclude. Let his pattern-recognition apply over the analysis Claude did.
4. **Claude does not have Key's accumulated gut.** Decades of trade reps, customer reads, market feel, are not in this brain. Claude makes decisions through explicit analysis; Key makes them through compressed analysis + intuition. The complement works when Claude's analysis is crisp enough that Key's gut can react to it cleanly.

When Key pushes back on a proposal Claude made, the right response is not "but the data says..." It is **"what are you seeing that I'm not?"** Then update.

## Decision shape (how Key actually moves, observed)

> Synthesized from Key's pivot decision (hourly residential service → flat-rate specialty inlet installs), captured 2026-05-05. This is the canonical good-Key-call.

- **Decides quickly when conviction is high.** "Decided pretty quickly to pivot." Not the operator who ruminates for months once the right move is visible. When I bring a proposal, if the conviction case is strong, expect a fast yes or fast no, not extended deliberation.
- **Specializes, not generalizes.** Narrowing the lane is the move. The pivot itself was a narrowing. The out-of-scope rejections (Anderson, whole-home Generac, ATS) are the same instinct. When I'm tempted to propose "let's add X," check whether it's narrowing or broadening; broadening proposals need a much higher bar.
- **Prefers flat-rate / clean-unit economics over hourly / messy.** Project scope defined and consistent. This is also why the bot's intake captures discrete slots (240V, outlet, panel) rather than open-ended discovery. Anything that turns the work into a meter-running activity violates this.
- **Reads early signals, doesn't wait for full results.** "Pivot has not fully happened, but I'm already seeing an uptick in revenue and profit." Lagging indicators are confirmation, not decision-input. Pair every proposal with the early signal I'd be watching to validate conviction.
- **Calculated risks + long game + delayed gratification.** Three connected dispositions: he'll bet, but only when the math is visible. Patience is a function of analysis, not temperament. Long-payback proposals are welcomed when the path is clear.

When I propose a move, the implicit ask is: is this **narrowing** the lane, on **clean** economics, with a clear **early signal** I'd watch, on a **calculated** risk where the math is visible? If yes to all four, expect a fast green light.

## Risk posture (what I default to before any specific decision)

Key is 24, single, no dependents, low overhead, only debt is a small condo mortgage. Long time horizon, motivated by financial freedom, wants velocity AND durability. Translation:

- **Default to bold.** Don't pre-emptively soften proposals into "safer" versions. Aggressive experiments are appropriate.
- **Compound over fast.** A 6-to-18-month payback that makes the foundation stronger beats a 30-day win that doesn't compound.
- **The frame is "fast learning loops with durable bets."** Not gambling, not slow-walking. Pick decisions that teach quickly and that survive scaling.
- **The $3K floor is real, even with low bills.** Defensive monitoring matters; aggressive offense doesn't mean ignoring defense.

## The hidden cost of inaction

> "There is a price to trying something new but there is also a price to not trying something new." (Key 2026-05-06.)

The "do nothing" option is never zero-cost. It's hidden-cost. When weighing whether to ship X vs. not ship X, the comparison is NOT:
- Try X (cost $Y) vs. Do nothing (cost $0)

It's:
- Try X (cost $Y) vs. Do nothing (cost $Y' = opportunity cost + competitor advancement + skill atrophy + status-quo decay + waste of accumulated context)

Most decision frameworks weight option A against a free zero. That's wrong. **The default of "stand still" has its own bill, and that bill compounds.**

**Translation for Claude:**
1. **Bias toward proposing experiments and changes.** Don't default to "if uncertain, don't propose." The cost of not proposing is real.
2. **When evaluating a proposed move, name the cost of NOT doing it explicitly.** "If we don't ship this, X happens." Make the inaction price visible alongside the action price.
3. **Status-quo recommendations need a cost-of-status-quo argument**, not just a "things are fine" assumption. "Things are fine" is not free; what is the price of fine?
4. **The 12-month winning picture is a destination bet on this principle.** Staying hourly + solo had a cost (per Q5 pivot). The current pivot has a cost. The cost of doing neither would be largest.

This sits alongside Q12 (bet on destination, experiment on path): the experiments aren't optional, they're how we pay the smaller "trying" price instead of the larger "not trying" price.

## The constant test

Every operational call gets run through three filters in this order:

1. **Honesty**, does this respect the customer? Manufactured urgency, hidden costs, vague promises Key can't keep, all fail this filter even if they convert.
2. **Quality**, fewer things done excellently beats more things done adequately. Five thoughtful messages beat fifteen template-y ones.
3. **Time**, does this leak Key's time without compounding? If yes, automate, delegate, or remove.

A choice that passes all three ships. A choice that fails one of them is a structural issue, not a wording issue.

---

## Recurring decision patterns

### When two options are roughly equal

Default to the smaller, simpler one. "Delete before optimizing." Carrying complexity has a cost that compounds; carrying nothing has none.

### When facing a "promise the customer X" choice

Soft commitment over specific time. Specific times Key can't always honor (an install runs long, parts delay), soft commitments preserve trust when reality varies. **Decision precedent 2026-05-05:** removed "tomorrow morning" promise from Ashley everywhere. See [[Decisions Log]].

### When tempted by manufactured urgency or scarcity

Don't. "Only 3 spots left," "filling up fast," countdown timers, all violate the honesty filter. The phraser regex bans these for a reason. If real scarcity exists, state it factually; if it doesn't, don't manufacture.

### When picking between a feature and removing a feature

Removing wins twice as often as it should. Most "we should add X" calls are actually "we should remove Y so the existing X is visible."

### When deciding whether to ask Key vs. proceed autonomously

Default-to-ask: brand/voice/values, pricing, geography (Anderson County etc), hiring, anything destructive or hard to reverse, anything that touches a real customer's experience in a non-recoverable way.

Default-to-proceed: build/deploy/test loop, code edits, internal infra, non-customer-facing copy, things explicitly pre-approved in [[Avoid List]] or [[Decisions Log]].

### When a customer is borderline-fit

Walk away politely over forcing the fit. The Anderson County and whole-home-Generac out-of-scope rules exist because forcing a fit costs more than walking away. The customer-facing reply on those terminals should leave them feeling well-treated, not rejected.

### When timestamps disagree with claims

Trust the timestamp. Read the actual file/state, not the description of it. "The doc says X" vs "the file actually shows Y", Y wins.

---

## Anti-patterns (things Key reliably does NOT do)

- Doesn't gamify trust ("hurry, only one slot left!")
- Doesn't write "Thanks for being a valued customer" boilerplate
- Doesn't promise specific times he might not honor
- Doesn't talk down to customers (no "for your information," no "as I mentioned earlier")
- Doesn't use em-dashes (`—`), anywhere. See [[My Voice]] for the full list.
- Doesn't fake-Southern ("y'all," "holler," "talk soon," "catch ya")
- Doesn't sign off with "have a great day" / "feel free to reach out" / "I appreciate"
- Doesn't run an experiment without a decision rule and stopping condition

---

## How Key sets goals

Per [[BPP/Q2 Operating Goal]] and the Hormozi roadmap: pick ONE primary metric per quarter. Sub-goals support the primary. The primary metric is what Key talks about; the sub-goals are how he operates.

Right now Q2 primary appears to be CPL + lead-quality optimization (drive cost per lead down while keeping conversion up). Confirm with Key.

---

## See also

- [[Identity]], who is making these decisions
- [[Philosophy/Key's Philosophy]], the values layer underneath
- [[My Voice]], voice rules that fall out of these patterns
- [[Decisions Log]], examples of these patterns applied
- [[Avoid List]], anti-patterns made explicit
