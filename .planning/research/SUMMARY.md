# Research Summary: Generator Recommendation Affiliate Site

**Domain:** Portable generator review and recommendation site with affiliate monetization and installation service cross-sell
**Researched:** 2026-04-06
**Overall confidence:** MEDIUM — affiliate rates confirmed via multiple sources; generator prices are approximate (Amazon prices change daily; verify before publishing)

---

## Executive Summary

The portable generator affiliate site has two distinct revenue streams that must be engineered together from the start: affiliate commissions on product sales, and installation service leads funneled to BPP. These two goals are NOT in conflict — they're sequential. The visitor journey is: discover generators via search → trust the site's recommendations → click affiliate link → at the moment of purchase intent, get served a "now get it connected" CTA that sends them to BPP.

The affiliate commission landscape for generators is lower than most people expect. Amazon categorizes generators under "Lawn & Garden" at 3% — not the 8% "Home Improvement" rate some sources cite. A $1,000 generator sale on Amazon earns roughly $30. Home Depot's rate on generators is disputed in the wild: the program officially pays 1% on most products, with 8% reserved for home decor. This means a $1,000 generator at Home Depot generates $10-$30 depending on category assignment. The commission math only works at volume — but it doesn't need to carry the business alone. Each installation lead is worth $1,197 minimum to BPP, dwarfing any affiliate commission.

The real play here is using the affiliate site as a top-of-funnel lead magnet for BPP installations. A homeowner who finds this site searching "best generator for power outage Greenville SC" is already close to buying. Getting them to BPP's installation page is worth more than the $30-$60 affiliate commission by an order of magnitude.

The recommended stack is purpose-built for a solo operator: static site (Astro or plain HTML with Tailwind), Amazon Associates as primary affiliate program, Jackery/Bluetti direct programs for solar/battery category, and a hardwired "Now Get It Connected" CTA block on every generator product page that links to BPP's quote form.

---

## Key Findings

**Stack:** Static site (Astro or plain HTML/Tailwind) + Amazon Associates primary + Jackery direct (5-8%) + Bluetti direct (5-10%) for solar category.

**Architecture:** Content-first affiliate site with hard-coded BPP funnel. Every product page ends with a two-panel CTA: "Buy on Amazon" + "Get It Professionally Connected — $1,197 Installed."

**Critical pitfall:** Amazon generators live under "Lawn & Garden" at 3%, NOT "Home Improvement" at 8%. Do not project 8% commissions into revenue estimates — they are wrong.

---

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase 1 — Foundation + Amazon Associates Setup**
   - Apply for Amazon Associates, get approved
   - Build site structure: homepage, category pages (5 generator categories), individual product review pages
   - Avoids: Building pages before affiliate links exist (Amazon requires active links within 180 days)

2. **Phase 2 — Generator Content + Affiliate Links**
   - Write 6-8 curated generator reviews (see FEATURES.md for full list)
   - Embed Amazon Associates links + comparison tables
   - Add Jackery affiliate links (apply to Jackery US program via Impact or Awin)
   - Add Bluetti affiliate links (apply at bluettipower.com/pages/affiliate-program)
   - Avoids: Over-rotating on commission rates; treat Amazon links as baseline, Jackery/Bluetti as upside

3. **Phase 3 — BPP Cross-Sell Integration**
   - Add "Get It Connected" CTA block to every gas/dual-fuel generator page
   - Link CTAs directly to BPP quote form (backuppowerpro.com get-quote.html)
   - Wire up contact form or click-to-call for installation inquiries
   - Avoids: Generic CTAs; every CTA should be sunk-cost framed ("You already have the generator — now unlock it")

4. **Phase 4 — SEO + Local Targeting**
   - Add Upstate SC geo-targeted content (Greenville, Spartanburg, Pickens)
   - Create city-specific "Generator + Installation" landing pages
   - Schema markup (Product, Review, LocalBusiness)

**Phase ordering rationale:**
- Amazon Associates approval takes up to 1-3 days; start this immediately
- Content cannot earn without affiliate links, so those ship together in Phase 2
- The BPP cross-sell is Phase 3 because it requires live product pages to embed into
- SEO is Phase 4 because it compounds on top of existing content

**Research flags for phases:**
- Phase 1: Amazon approval is CONDITIONAL — they require at least 3 qualifying sales within 180 days or the account is closed. Need traffic before the clock starts. Consider whether to soft-launch with minimal content first.
- Phase 3: Jackery and Bluetti direct programs may require follower/traffic minimums. Verify before applying.
- Phase 4: Local generator installation SEO may have low search volume in Upstate SC — validate with Google Search Console or Ahrefs before investing heavily.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Amazon commission rate (3% lawn/garden) | HIGH | Verified against Amazon Associates official rate table |
| Home Depot rate (1% most products, 8% decor only) | MEDIUM | Multiple sources confirm 1% for general products; generators almost certainly NOT in the 8% decor category |
| Lowe's rate (2%, 1-day cookie) | MEDIUM | Multiple sources agree; low rate makes Lowe's a poor primary choice |
| Walmart rate (up to 4%, 72hr cookie) | MEDIUM | May beat Amazon on commission but worse brand association for premium generators |
| Jackery direct (5-8%, 15-30 day cookie) | HIGH | Official program page + multiple affiliate directories confirm |
| Bluetti direct (5-10%, variable) | HIGH | Official program page confirms; 10% for high performers |
| Generator prices | LOW-MEDIUM | Prices change daily on Amazon; all prices in this research are approximate as of April 2026 |
| BPP cross-sell strategy | MEDIUM | No exact comparator found; reasoning is sound based on customer journey analysis |

---

## Gaps to Address

- Amazon Associates minimum traffic/sales requirement: unclear if there is a minimum traffic threshold to apply. Need to verify at affiliate-program.amazon.com before applying.
- Home Depot exact category rate for "Outdoor Power Equipment / Generators": the 1% vs 8% split is poorly documented. Could verify by applying and checking the rate card inside the affiliate dashboard.
- Lowe's Creator Program (may offer higher rates than standard 2%): worth investigating at apply stage.
- Whether a dedicated generator affiliate network exists with better economics than Amazon/HD — research found no strong options beyond the manufacturer-direct programs.
