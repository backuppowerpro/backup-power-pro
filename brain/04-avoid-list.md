# Avoid List

> Things BPP does NOT do, with reasons. Pre-decided no-action items. New sessions inherit these as ground truth, no need to re-litigate.

## Geography

### Anderson County, SC
**Permanent.** Outside the service area. Greenville, Spartanburg, and Pickens counties only in SC. (City of Greenville is INSIDE Greenville County and DOES get serviced; don't confuse with Anderson SC.) North Carolina expansion is on the table for the 12-month destination, but Anderson stays out for separate market reasons.

## Scope / product

### Whole-home Generac / Kohler standby systems with auto-transfer switches
**Permanent.** Out of scope. BPP does inlet boxes for portable generators only. When customers ask, the canonical reply is: "We only do inlet box installs for portable generators (the kind you wheel out and plug in). Whole-home standby systems like Generac/Kohler with auto-transfer switches are a different scope, Key handles those personally so he'll reach out."

### Commercial / industrial generator work
**Permanent.** Residential portable inlets only. Adding commercial breaks the "narrowing" instinct (per Q5 decision shape) and the "scope defined and consistent" appeal that makes the work feel right.

## Tools / Stack

### Lead-gen aggregator services (Angie's List, HomeAdvisor, Thumbtack, Nextdoor lead programs)
**Direct burn.** Promised quality leads, was awful. Same shape applies to all "we'll send you qualified leads for $X each" services. Owned channels (Meta, Google direct, GBP, organic) only.

### Off-the-shelf CRMs (Salesforce, HubSpot, Pipedrive, Jobber, Housecall Pro, ServiceTitan)
**Direct burn.** Multiple CRMs tried, all failed to deliver. The custom Supabase + vanilla JS CRM at `crm/crm.html` exists because nothing off-the-shelf fit. Don't propose migrating.

### "Solution in a bottle" pitches in general
Any tool / service / agency pitching itself as a turnkey fix triggers the burned-by-Angie's-List reflex. Right framing: "this is the specific job it would do, here's the integration cost, here's how we'd evaluate." Never "this will solve X for you."

### Quo / OpenPhone for primary CRM messaging
**Permanent.** Apr 7 2026 architecture decision: CRM is Twilio-only. Quo continues for legacy auto-lead-response until 5302 is ported.

### Outsourcing customer-facing functions to vendor services (the unifying rule)
**Direct burn x4 (lead, marketing, sales, receptionist companies).** BPP does not outsource customer-facing functions. Lead gen, marketing copy, sales, reception, customer conversations all stay in-house (Key + Claude + tuned tooling).

What CAN be outsourced (internal, non-customer-facing): bookkeeping, taxes, infrastructure, install labor IF the sub operates on Key's structure (briefs, checklists, quality gates).

What CANNOT be outsourced (customer-facing, where perception lives):
- Lead generation
- Marketing copy / ad creative
- Sales / closing
- Reception / first-customer-touch
- Customer conversations

This rule is doubly enforced: per Q16 burn history AND per the discovery (Q19 follow-up) that **selling is a primary Key skill that he likes**. Removing it would burn a strength.

## Pricing / sales

### Sales / discounts / race-to-the-bottom pricing
**Permanent.** "We are premium, no sales, or discounts or race to the bottom tactics." (Key 2026-05-05.) Don't propose discount codes, "limited-time pricing," sales, "competitive" framing, or anything that positions BPP as a price-shopper option. Premium positioning held in voice, copy, ad creative, proposal, and quote.

### "Tomorrow morning" or any specific time-of-day promise
**Permanent.** (Key 2026-05-05.) Don't promise specific times to customers; installs sometimes block honoring those. Soft-commitment only: "Key will send the quote over once he has it put together."

## Voice / copy

### Em-dashes anywhere
**Permanent hard rule.** No em-dashes in customer copy, handoff SMS, commit messages, code comments, chat replies, or wiki pages. Use a comma, period, semicolon, or restructure.

### Manufactured urgency / scarcity
**Permanent.** "Only 3 spots left," "filling up fast," countdown timers. Violates honesty.

### Specific cringe phrases
- "Act now" (gimmicky)
- "Best in the business" (cheesy)
- "Trust me on this" (build trust through behavior, don't ask for it)
- "Competitive pricing" (race to the bottom violation)

All four are in the phraser regex bans.

### Desperation tells
"I just wanted to," "sorry to bother," "any chance you could," "don't want to be a pain," "hoping you'll," "pretty please," "if it's not too much trouble," "we really need." All in regex.

### The slick / cheesy / pander contractor archetype
- Bigger-than-real claims ("industry-leading," "top-rated," "world-class," "thousands of satisfied customers," "expert technicians," "highly skilled team")
- Verbal commitments without execution ("we'll take care of you," "leave it to us," "you're in great hands")
- Self-aggrandizing ("we pride ourselves," "go above and beyond," "we treat your home like our own," "no job too big or too small")
- Pandering buddy register ("hey buddy," "champ," "boss," "my man," "partner," "big guy," "chief," "brother," "bud")

The unifying rule: **never write a phrase whose claim outsizes Key's actual demonstrated record.** If we can't back it with behavior, it doesn't appear.

## Operations

### Working for partners whose values misalign on quality vs profit
**Direct burn.** House-flipper relationship ended over this. When evaluating subs, vendors, or referrals, screen for "do they share the quality-first instinct?" before screening for price.

### Video assessments / video calls in the sales process
**Permanent.** Sales process is text-only. Key does NOT do video assessments.

### Real customer contact during walkthroughs
**Permanent.** Never send real SMS / dial / archive / DNC real contacts when acting-as-Key in the CRM during testing or walkthroughs.

## Hiring / partnerships

### Hiring before installs exceed solo capacity
Per Hormozi roadmap. Sub recruitment becomes first-class once 12-month destination requires it; not earlier.

### Partners with quality-vs-profit misalignment
See Operations above.
