# Domain Pitfalls

**Domain:** Generator affiliate site + BPP cross-sell
**Researched:** 2026-04-06

---

## Critical Pitfalls

Mistakes that cause wasted effort, FTC issues, or Amazon account termination.

### Pitfall 1: Assuming Generators Fall Under the 8% "Home Improvement" Amazon Category

**What goes wrong:** You calculate revenue projections using 8% commission and build a business case on that. Actual rate is 3%. Revenue is 62.5% lower than modeled.

**Why it happens:** Multiple affiliate marketing articles use "home improvement" loosely. Some list 8% as the Home Improvement rate, which IS correct — but generators are categorized under "Lawn & Garden" (also 3%) or "Patio, Lawn & Garden," not "Home Improvement." Amazon's official rate table groups Lawn & Garden, Tools, and Home Improvement together in the same 3% tier — the 8% rate applies to a small subset of decor-only products.

**Consequences:** Gross revenue projections wrong by 2.5x. Business case falls apart unless you also factor the BPP cross-sell lead value.

**Prevention:** Verify category assignment on any product's actual Amazon listing page before assuming rate. The rate is shown in the Associates dashboard for each product.

**Detection:** If revenue projections show 8% commissions on generator sales, they are wrong.

---

### Pitfall 2: Amazon Associates Account Closure for No Sales Within 180 Days

**What goes wrong:** You build the site, add all the affiliate links, publish — then don't get meaningful traffic for 6 months. Amazon closes the account with no qualifying sales, and all your tracking IDs stop working.

**Why it happens:** Amazon requires at least 3 qualifying sales within 180 days of account approval. This is a hard rule, not a soft guideline.

**Consequences:** All affiliate links become dead links. Must reapply and re-add new tracking IDs to every page.

**Prevention:** Do not apply for Amazon Associates until the site has at least some content published and a traffic plan. Either launch a soft promotion to BPP's existing audience first, or wait until 2-3 pages are published and you have a plan to drive at least 3 sales within 6 months.

**Detection:** Amazon sends warning emails before closure. Monitor the Associates dashboard monthly.

---

### Pitfall 3: Missing FTC Affiliate Disclosure — FTC Fine Risk

**What goes wrong:** The site publishes affiliate links without clear, conspicuous disclosure. A complaint or FTC review finds undisclosed affiliate compensation.

**Why it happens:** Most affiliate site builders focus on content and links, and add disclosures as an afterthought in the footer — which is NOT sufficient.

**Consequences:** FTC can issue fines. Amazon can terminate the Associates account for ToS violations. Both are real risks.

**Prevention:** The disclosure must be "clear and conspicuous" — meaning visible without scrolling on every page that contains affiliate links. Put it at the top of each page, above the first affiliate link, in plain language.

**Detection:** Review every page: Is the disclosure visible above the fold on mobile?

---

### Pitfall 4: Hardcoding Amazon Prices (Violates Amazon ToS)

**What goes wrong:** You write "This generator costs $749" in your page copy. Three weeks later Amazon raises the price to $899. The page now shows a false price. Additionally, Amazon's ToS explicitly prohibit displaying specific prices unless pulled from the live Product Advertising API.

**Why it happens:** Writers naturally want to give readers a concrete number.

**Consequences:** Visitor trust damage when prices don't match. Amazon ToS violation. Amazon can terminate Associates account for systematic price misrepresentation.

**Prevention:** NEVER hardcode a specific price. Always use "Check current price on Amazon" buttons. If you must show a price range, use language like "typically $700-900 as of our last check" with a date stamp.

**Detection:** Search all pages for dollar signs ($) in text copy. Every one is a potential ToS issue unless it's "from our last check on [date]."

---

## Moderate Pitfalls

### Pitfall 5: Linking Solar/Battery Products Through Amazon Instead of Direct Programs

**What goes wrong:** You link Jackery and Bluetti products through Amazon because it's easier (one affiliate program to manage). You earn 3% instead of 5-8%.

**Prevention:** Apply for Jackery and Bluetti direct programs from day one. They are free, fast to approve, and pay 2-3x more per solar/battery sale. The link management overhead is minimal.

---

### Pitfall 6: Putting the BPP Installation CTA on Solar/Battery Pages

**What goes wrong:** A visitor reading about the Jackery Explorer 2000 v2 sees "Get It Professionally Connected to Your Home Panel." They are confused — the Jackery doesn't connect to a home panel. It loses trust.

**Prevention:** The BPP installation CTA belongs ONLY on gas and dual-fuel generator pages (Champion, Westinghouse, Honda, DuroMax, Generac). On solar/battery pages, replace with a soft handoff line: "If you also have a portable gas generator, here's how to connect it to your home panel."

---

### Pitfall 7: Home Depot Links for Generators — Low Commission, Short Cookie

**What goes wrong:** You route all generator links through Home Depot because "they're the hardware store." Home Depot pays ~1% on most products (confirmed by multiple sources). A $1,000 generator earns $10. Amazon pays 3x more ($30).

**Prevention:** Use Amazon as default for all gas generators. Use manufacturer-direct programs (Jackery, Bluetti) for solar/battery. Use Home Depot only if Amazon has no listing for a specific model.

---

### Pitfall 8: Recommending Generators Outside Key's Installation Coverage Area

**What goes wrong:** The site recommends generators to buyers in Atlanta, Charlotte, or Columbia. Those buyers see the BPP installation CTA, click through, fill out the quote form — and Key has to turn them down because they're outside Greenville/Spartanburg/Pickens counties. Wasted leads, bad conversion rate.

**Prevention:** Add geographic scope to the BPP CTA: "Serving Greenville, Spartanburg, and Pickens County, SC." Optionally add a softened CTA for out-of-area visitors: "Not in Upstate SC? Use our guide to find a licensed electrician near you." (This keeps them on the site without creating false lead expectations.)

---

## Minor Pitfalls

### Pitfall 9: Including too many generators per category

**What goes wrong:** You list 6 budget generators "for completeness." Visitors face decision paralysis and leave without clicking anything.

**Prevention:** Maximum 2 per category: one clear winner + one runner-up for a specific alternative use case. The site is curated, not comprehensive.

---

### Pitfall 10: Ignoring the Amazon 24-Hour Cookie Window

**What goes wrong:** You invest heavily in content and traffic, but many buyers research for days or weeks before purchasing. A visitor who reads your page, leaves, and buys 3 days later generates $0 commission.

**Prevention:** Accept this limitation as a feature of Amazon's program. Counterbalance by capturing BPP leads (which have no cookie expiry — they go into the CRM). Also consider that Amazon's 24-hour window resets on any click — so adding multiple CTA clicks within the review helps keep the cookie fresh for comparison shoppers.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Amazon Associates application | Account closed if no sales in 180 days | Launch with a plan to drive at least 3 qualifying sales before the clock expires; consider using BPP's existing audience/email list to seed first sales |
| Jackery/Bluetti application | Programs may require minimum audience size or web traffic | Apply early; if rejected, route through Amazon initially and reapply at 1K monthly visits |
| Writing generator price copy | Amazon ToS violation on hardcoded prices | Never write "$X" as a current price; always use "Check current price" link |
| BPP CTA placement | Wrong CTA on solar/battery pages | Maintain a clear rule: BPP CTA = gas generators only |
| Geographic scope | Out-of-area BPP leads created, wasted | Disclose SC service area clearly in the installation CTA block |
| Amazon commission rate assumptions | Projecting 8% instead of 3% | Model all Amazon generator revenue at 3% maximum |

---

## Sources

- Amazon Associates commission rates (official): affiliate-program.amazon.com/help/node/topic/GRXPHT8U84RAYDXZ
- Amazon Associates operating agreement (price restrictions, 180-day rule): affiliate-program.amazon.com
- FTC endorsement guidance: ftc.gov/tips-advice/business-center/guidance/ftcs-endorsement-guides
- Home Depot 1% rate: affiliatebesttools.com/home-depot-affiliate-program-join, highpayingaffiliateprograms.com
- Lowe's 2% / 24hr cookie: nichepursuits.com/lowes-affiliate-program, getlasso.co/affiliate/lowes
