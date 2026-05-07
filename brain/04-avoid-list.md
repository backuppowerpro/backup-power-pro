> This file is auto-synced from `wiki/Key/<name>.md` via `scripts/brain/sync-from-wiki.sh`.
> Edit the wiki source, not this file. Sanitization strips specific dollar figures, account balances, and phone numbers.

---
title: Avoid List
branch: Key
type: precedent
updated: 2026-05-05
tags: [key, decisions, no, anti-patterns]
---

# Avoid List

> Things Key has tried, considered, or rejected, with the reason. **Don't propose these again unless evidence has clearly changed.** Append-only; if a stance flips, leave the original entry and add a flip note.

---

## Geography

### Anderson County is out of service area
Hard rule. Customer-facing reply when their address detects in-Anderson: *"looks like that's outside our service area, we only cover Greenville, Spartanburg, and Pickens counties in Upstate SC. Wishing you luck finding someone local."* Every variant of "expanding into Anderson" should be filed here, not proposed.

## Scope

### Whole-home Generac standby installs
Out of scope intentionally. Different product, different operation, different sales cycle. BPP does **portable-generator inlet boxes** only. Customer-facing reply: *"we only do inlet box installs for portable generators (the kind you wheel out and plug in). Whole-home standby systems like Generac/Kohler with auto-transfer switches are a different scope, Key handles those personally so he'll reach out."* Don't propose pivoting BPP's offer to standby.

### Automatic Transfer Switches (ATS)
Same bucket as standby Generac. Out of scope.

## Promises

### "By tomorrow morning"
Removed 2026-05-05. Specific time-of-day promises Key can't always honor (installs run long, parts delay) cost trust when reality varies. **Don't reintroduce specific time promises** in any form (Ashley copy, handoff SMS to Key, ad copy, proposal copy). Soft commitment only.

## Voice / Copy

### Em-dashes (`—`)
Permanent ban. See [[My Voice]]. Don't propose "but this one place a dash would read better." Use a comma or restructure.

### "Automated assistant" as the opening label
Replaced 2026-05-05 with "auto-text intake for Key" pattern in greeting v3. The word "automated" first thing capped warmth. **Don't revert** unless EXP-009 data clearly shows v3 underperforms v1.

### Manufactured urgency / scarcity
Permanent. "Only 3 spots left," "filling up fast," countdown timers. Violates honesty filter.

### Specific cringe-phrases banned (per Key 2026-05-05)
- **"Act now"** — gimmicky.
- **"Best in the business"** — cheesy.
- **"Trust me on this"** — build trust through behavior, don't ask for it.
- **"Competitive pricing"** — premium positioning, no race to the bottom.
All four are now in the phraser REJECT_PATTERNS regex.

### Desperation tells (NEVER sound desperate)
Per Key 2026-05-05 (with multiple exclamation points). Premium service is held by the seller. Anything that begs, minimizes, apologizes for asking, or chases harder than makes sense is wrong. Banned phrases now in regex:
- "I just wanted to" (apologetic minimizer)
- "Sorry to bother" / "Hate to bother"
- "Any chance you could/can/might"
- "Don't want to be a pain/annoying/pushy"
- "Hoping you'll"
- "Pretty please"
- "If it's not too much trouble"
- "We really need"
Also re-audit: existing copy that uses "just" as a minimizer ("just checking back," "just confirming") falls in the same family. The cold-lead nudges in `bot-reengagement` were rewritten 2026-05-05 to remove all "just" minimizers and apologetic frames; future copy follows the same standard.

### Sales / discounts / race-to-the-bottom pricing
Per Key 2026-05-05: "we are premium, no sales, or discounts or race to the bottom tactics." Don't propose discount codes, "limited-time pricing," sales, "competitive" framing, or anything that positions BPP as a price-shopper option. Premium positioning is held in voice, copy, ad creative, proposal, and quote.

### The slick / cheesy / pander contractor archetype
Per Key 2026-05-05 (Q9): the voice we are NOT. Bans for the family of phrasings that make a contractor sound bigger than they are or fake-buddy-pander to the customer. All now in phraser regex:
- **Bigger-than-real claims:** "industry-leading," "top-rated," "world-class," "thousands of satisfied customers," "expert technicians," "highly skilled team."
- **Verbal commitments without execution:** "we'll take care of you," "leave it to us," "you're in great hands."
- **Self-aggrandizing:** "we pride ourselves," "we go above and beyond," "we go the extra mile," "no job too big or too small," "we treat your home like it's our own."
- **Pandering buddy register:** "hey buddy," "champ," "boss," "my man," "partner," "big guy," "chief," "brother," "bud," "big dog." Don't write to customers as if you've known them for years.

The unifying rule: **never write a phrase whose claim outsizes Key's actual demonstrated record.** If we can't back it with behavior, it doesn't appear.

### Fake-Southern voice
Permanent. The bot is not from a movie. Full ban list in [[My Voice]].

## Tools / Stack

### Outsourcing customer-facing functions to vendor services (the unifying rule)
Per Key 2026-05-06 (Q16): Key has been burned by **lead companies, marketing companies, sales companies, and receptionist companies** — the four families of vendor services that promise to handle a customer-facing layer of the business.

The structural pattern: any vendor that interfaces with Key's customers on Key's behalf will not match his quality bar, and customer perception is the most expensive thing to repair (per Q13: client perception is one of the two irreversibles). The four burns are not coincidences; they are instances of the same wrong shape.

**The rule:** **BPP does not outsource customer-facing functions.** Lead gen, marketing copy, sales, reception, conversation, intake. All stay in-house, either Key himself or systems Key built and tunes (the custom CRM, Ashley/Alex bots, edge functions, owned ad accounts).

**What CAN be outsourced (internal, non-customer-facing):**
- Bookkeeping / accounting
- Tax prep
- Server / infrastructure (Supabase, Vercel-equivalents)
- Install labor IF the sub operates on Key's structure (briefs, checklists, quality gates, review cadence per Q6 delegation rule)

**What CANNOT be outsourced (customer-facing, where perception lives):**
- Lead generation (no Angie's List, HomeAdvisor, Thumbtack, Nextdoor lead programs)
- Marketing copy / ad creative (no marketing agencies)
- Sales / closing (no outsourced closers, no sales-as-a-service)
- Reception / first-customer-touch (no virtual receptionist services)
- Customer conversations (the bot is owned + tuned, not bought)

### Lead-gen aggregator services (Angie's List, HomeAdvisor, Thumbtack, Nextdoor lead programs)
Direct burn: Angie's List promised quality leads, was awful. Specific instance of the broader rule above. They sell the same dream to every contractor in the area; lead quality is mediocre, attribution is opaque, lock-in is bad. Owned channels (Meta, Google direct, GBP, organic) only.

### Marketing agencies / outsourced marketing companies
Direct burn per Q16. Same pattern: vendor promises customer-facing copy + creative + strategy; quality doesn't match Key's bar; brand voice gets diluted. **All marketing copy stays in-house** (Key + Claude + tuned tooling, not agencies).

### Sales-as-a-service / outsourced closers
Direct burn per Q16. Same pattern: outsourced sales process invariably violates honesty filter (Q1), pushes manufactured urgency (Q8), and creates customer perception risks Key can't unsee. Sales stays Key, full stop.

### Receptionist services / virtual receptionists / call answering services
Direct burn per Q16. Same pattern: a third-party answering Key's customers introduces voice-dilution, missed context, and customer-perception risk. Owned tooling (Ashley intake bot, custom CRM messaging) is the right answer.

### Off-the-shelf CRMs (Salesforce, HubSpot, Pipedrive, Jobber, Housecall Pro, ServiceTitan)
Direct burn: multiple CRMs tried, all failed to deliver on what they promised. The custom Supabase + vanilla JS CRM at `crm/crm.html` exists because nothing off-the-shelf fit. **Don't propose migrating to any off-the-shelf CRM.** Custom is the right answer here, even when complexity grows. If a piece of functionality needs adding, build it into the custom CRM.

### "Solution in a bottle" pitches in general
Any tool/service/agency that pitches itself as a turnkey fix triggers Key's burned-by-Angie's-List reflex. The right framing for any tool consideration is "this is the specific job it would do, here's the integration cost, here's how we'd evaluate." Never "this will solve X for you."

### Quo / OpenPhone for primary CRM messaging
Migrated to Twilio 2026-04-07. Quo continues for legacy auto-lead-response on (864) 400-5302 until that line ports to Twilio. Don't propose moving back.

### Zapier
Removed. All routing via Supabase edge functions. Don't propose Zapier flows.

### Single-LLM full conversational AI for the bot
Walked back per Path 1 of [[Experiments/Autonomy Architecture]]. The deterministic state machine handles flow; the LLM only writes the words inside each turn. Don't propose "let the LLM drive the whole conversation."

## Ad / Marketing

### Meta Advantage+ campaigns
Currently paused; Legacy is active. Per EXP-2026-04-29-002. Don't propose un-pausing without checking the experiment row first.

### Spending more to fix conversion problems
If a channel has `captures > delivered` or CPL > $50 sustained, the answer isn't more spend, it's diagnose + fix. Per CLAUDE.md PostHog protocol.

## Operations

### Working for partners whose values misalign on quality vs profit
Direct burn: house-flipper relationship ended because Key prioritized quality, they prioritized profit. **The lesson generalizes:** any partnership, sub arrangement, or client engagement where the other party's economics push them to cut corners is a relationship Key should not enter or should exit. When evaluating sub candidates, vendor partnerships, or referral arrangements, screen for "do they share the quality-first instinct?" before screening for price.

### Video assessments / video calls in the sales process
Key does NOT do video assessments. Sales process is text-only. Don't propose Zoom-based intake.

### Door-knocking / cold-calling outreach
Not Key's style and inconsistent with [[Philosophy/Key's Philosophy]] (honesty over manufactured anything). Don't propose.

---

## How to add to this list

Two paths:
1. **Key explicitly rejects something in conversation**, Claude captures it here in the same session.
2. **A decision in [[Decisions Log]] crosses a threshold of "I keep having to re-explain this"**, promote to this list.

Format per entry: `### Short name`, then 2-3 sentences explaining what + why + boundary condition (when would this flip).

---

## See also

- [[Decisions Log]], full chronological decision history
- [[How I Decide]], heuristics that produce these rejections
- [[BPP/Core Offer]], what BPP DOES do
