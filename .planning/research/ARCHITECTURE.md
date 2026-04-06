# Architecture Patterns

**Domain:** Generator recommendation affiliate site with BPP installation cross-sell
**Researched:** 2026-04-06

---

## Recommended Architecture

A static HTML site with no backend, no CMS, no database. All pages are pre-written HTML files deployed via GitHub Pages — the same workflow Key already uses for backuppowerpro.com. The site is fast, free, and zero-maintenance.

```
generator-site/ (subdirectory in CLAUDE repo OR separate repo)
├── index.html                          Homepage — category nav + hero + trust signals
├── best-budget-generator.html          Category page: Champion 4250W + DuroMax runner-up
├── best-mid-range-generator.html       Category page: Westinghouse iGen4500DF + Honda EU2200i
├── best-premium-generator.html         Category page: Honda EU3000iS + Generac iQ3500
├── best-solar-battery-generator.html   Category page: Jackery Explorer 2000 v2 + Bluetti AC200Max
├── best-high-output-generator.html     Category page: Westinghouse WGen9500DF + Champion 9000W
├── about.html                          Who wrote this, Key's credentials (licensed SC electrician)
├── assets/
│   ├── style.css (or Tailwind output)
│   └── img/ (product images — link to Amazon CDN or use webp screenshots)
└── CNAME (if on custom domain) or publish under /generators/ subpath
```

**Hosting option A:** Subdirectory of the existing repo at `backuppowerpro.com/generators/` — zero additional setup. Pages link back to BPP homepage naturally.

**Hosting option B:** Separate repo at a custom domain (e.g., `upstategeneratorguide.com`) — cleaner brand separation but adds a $12/yr domain cost and a separate deploy setup.

Recommendation: Start with Option A (subdirectory) to validate the concept before buying a domain.

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Homepage (index.html) | Category navigation, site trust signal, Key's credentials intro | All 5 category pages |
| Category page | Product comparison table, affiliate buy buttons, BPP CTA block | Amazon (affiliate link), Jackery/Bluetti (affiliate link), BPP quote form |
| BPP CTA Block | Cross-sell the installation service; captures leads for BPP | BPP get-quote.html (direct link) |
| About page | Establishes Key's authority as licensed SC electrician | BPP homepage (link) |

---

## Data Flow

```
Visitor lands on category page (from Google search)
    ↓
Reads comparison table → clicks "Check Price on Amazon" (affiliate link)
    → Amazon pays 3% commission on completed purchase (24hr cookie)
    ↓  [OR]
Reads "Now Get It Professionally Connected" CTA block
    → Clicks through to BPP get-quote.html
    → Becomes BPP installation lead worth $1,197
```

---

## The BPP CTA Block — Core Architecture Decision

This is the most important architectural element. Every gas/dual-fuel generator page (NOT solar/battery) ends with a hard-coded two-panel CTA section:

```html
<!-- BPP Cross-Sell CTA Block — include on all gas/dual-fuel generator pages -->
<section class="bpp-cta-block">
  <div class="panel left">
    <h3>Ready to buy this generator?</h3>
    <a href="[amazon affiliate link]" class="btn-primary">Check Current Price on Amazon</a>
  </div>
  <div class="panel right">
    <h3>Already have a generator?</h3>
    <p>Get it legally connected to your home's panel — one cord, full power, done in a day.</p>
    <ul>
      <li>Licensed SC electrician</li>
      <li>Permit pulled, inspection handled</li>
      <li>$1,197 installed — no surprises</li>
    </ul>
    <a href="https://backuppowerpro.com/get-quote.html" class="btn-secondary">Get a Free Quote</a>
  </div>
</section>
```

**This block should NOT appear on solar/battery power station pages** — those products do not connect to home panels and the CTA would confuse visitors.

---

## Patterns to Follow

### Pattern 1: Affiliate Link Disclosure (Legal Requirement)

**What:** Every page must disclose Amazon Associates participation per FTC and Amazon ToS.
**When:** On every page, above the fold.
**Example:**
```html
<p class="disclosure">
  This site contains affiliate links. If you purchase through our links,
  we may earn a commission at no extra cost to you. As an Amazon Associate
  I earn from qualifying purchases.
</p>
```

### Pattern 2: Price Freshness Disclaimer

**What:** Prices are displayed with a "last checked" date, not as a guarantee.
**When:** On every product listing that shows a price.
**Example:**
```html
<p class="price-note">Price as of <span class="price-date">April 2026</span>.
Check Amazon for current pricing.</p>
```

### Pattern 3: Category Authority Header

**What:** Each category page opens with a 2-3 sentence statement of who should read this and why Key is qualified to recommend.
**When:** Top of every category page.
**Example:**
```
"As a licensed SC electrician who connects portable generators to home panels for a living,
I see which generators actually work in the field — and which ones cause problems.
Here's what I'd tell a neighbor."
```

This turns a generic affiliate listicle into a credible expert recommendation.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Linking All Generators Through Amazon

**What:** Using Amazon links even for Jackery/Bluetti products.
**Why bad:** Amazon pays 3% on solar/battery products in Lawn & Garden. Jackery direct pays 5-8%. On a $999 Jackery 2000 v2, that's $30 (Amazon) vs $50-80 (Jackery direct). Over 10 sales/month, the difference is $200-500/month.
**Instead:** Use Jackery and Bluetti direct affiliate links for all products from those brands.

### Anti-Pattern 2: Stale Prices Without Disclaimers

**What:** Showing "This generator costs $749" with no caveat.
**Why bad:** Amazon prices change daily. A price shown as $749 today may be $999 next month. Visitors feel deceived. Amazon ToS also prohibits claiming specific prices without live API data.
**Instead:** Always use "Check current price" buttons, never hardcode a specific dollar amount as current fact.

### Anti-Pattern 3: Reviewing Products You Have No Context On

**What:** Adding a generator to the list because it has good specs without real-world frame of reference.
**Why bad:** Destroys credibility. The entire value prop of this site is "licensed SC electrician who actually connects these things."
**Instead:** Only list generators Key has seen in the field, can verify specs for, or has done hands-on research on.

### Anti-Pattern 4: Putting the BPP CTA on Solar/Battery Pages

**What:** Showing "Get It Professionally Connected" CTA on Jackery/Bluetti pages.
**Why bad:** Solar/battery power stations run appliances directly from their internal battery — they do NOT connect to a home panel. The CTA is irrelevant and misleading.
**Instead:** On solar/battery pages, replace the BPP CTA with a soft handoff: "Already have a portable generator? See how to connect it to your home panel."

---

## Scalability Considerations

| Concern | At 5 pages | At 20 pages | At 50+ pages |
|---------|------------|-------------|--------------|
| Managing affiliate links | Manual HTML links are fine | Consider Lasso ($29/mo) for dead-link alerts and price syncing | Lasso becomes required |
| Updating prices | Manual date stamps work | Semi-annual manual review works | Amazon PA API becomes worth the complexity |
| SEO content | 5 category pages cover primary keywords | Add city-specific pages (Greenville generator guide, etc.) | Full blog with seasonal content (hurricane prep, winter outages) |
| BPP lead volume | Low but highly qualified | Geo-specific CTAs per page | Consider dedicated BPP landing pages per city with dedicated forms |

---

## Sources

- Amazon Associates program terms: affiliate-program.amazon.com
- FTC affiliate disclosure requirements: ftc.gov/tips-advice/business-center/guidance/ftcs-endorsement-guides
- Amazon ToS on price display: affiliate-program.amazon.com operating agreement (price accuracy requirements)
