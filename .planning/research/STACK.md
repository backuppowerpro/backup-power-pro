# Technology Stack

**Project:** Generator Recommendation Affiliate Site
**Researched:** 2026-04-06

---

## Recommended Stack

### Core Site Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Astro (or plain HTML/Tailwind) | Latest | Site framework | Static output = free GitHub Pages hosting (Key already has this setup). Astro enables component-based authoring without React overhead. Plain HTML works fine if content volume stays under 20 pages. |
| Tailwind CSS | v3/v4 | Styling | Already familiar from BPP projects. Utility classes = fast to build review tables and CTA blocks. |
| GitHub Pages | — | Hosting | Already deployed via Key's existing repo workflow. Zero additional cost. |

### Affiliate Infrastructure

| Technology | Purpose | Notes |
|------------|---------|-------|
| Amazon Associates | Primary affiliate program | Apply at affiliate-program.amazon.com. Generates standard text/image links. No SDK needed — just standard href links with tracking IDs. |
| Jackery US Affiliate (Impact or Awin) | Solar/battery category affiliate | Apply at Jackery.com/pages/affiliate-program or via Impact platform. 5-8% commission, 15-30 day cookie. |
| Bluetti Affiliate (direct) | Solar/battery category affiliate | Apply at bluettipower.com/pages/affiliate-program. 5% standard, up to 10% for volume. |

### Optional Enhancements (Phase 2+)

| Library | Purpose | When to Use |
|---------|---------|-------------|
| Lasso (getlasso.co) | Affiliate link management, auto price display, comparison tables | Add if site grows beyond 20 pages. ~$29/mo. Handles dead links, price syncing, and branded product boxes. Worth it at scale. |
| Amazon PA API (Product Advertising API) | Pull live prices programmatically | Requires qualifying sales first. Use only after 3+ sales qualify the account. Without it, prices go stale — add manual "prices last checked [date]" disclaimers. |
| Fathom or Plausible Analytics | Privacy-friendly traffic analytics | $9-14/mo. Tells you which product pages drive the most clicks. Informs what content to write more of. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Hosting | GitHub Pages (free) | Netlify, Vercel | Already on GitHub Pages; no reason to add another platform for a simple affiliate site |
| Framework | Astro / Plain HTML | WordPress | WordPress overkill for a ~10-20 page review site. Adds plugin bloat, security updates, hosting cost. Plain HTML on GitHub Pages is faster and free. |
| Primary affiliate | Amazon Associates | Home Depot Impact, Lowe's CJ | Amazon has better product coverage, higher consumer trust, stronger conversion rate. Home Depot is 1% on generators. Lowe's is 2% with 1-day cookie — too short. |
| Solar/battery affiliate | Jackery/Bluetti direct | Amazon for solar | Jackery direct pays 5-8% vs Amazon's 3%. On a $1,000 Jackery, that's $50-80 vs $30. Always link solar/battery products through their direct programs, not Amazon. |
| Link management | Manual HTML links (start) | Lasso from day one | Add Lasso only once site has content and traffic. Too early adds cost before revenue. |

---

## Installation

No npm install required for a plain HTML implementation. If using Astro:

```bash
npm create astro@latest generator-site
cd generator-site
npx astro add tailwind
```

For Amazon Associates: sign up at affiliate-program.amazon.com — no code installation, just embed generated href links.

For Jackery: apply at jackery.com/pages/affiliate-program → generates links via Impact or Awin dashboard.

For Bluetti: apply at bluettipower.com/pages/affiliate-program → generates links directly.

---

## Sources

- Amazon Associates rate table: affiliate-program.amazon.com/help/node/topic/GRXPHT8U84RAYDXZ (verified 2026-04-06)
- Jackery affiliate: jackery.com/pages/affiliate-program + creator-hero.com review
- Bluetti affiliate: bluettipower.com/pages/affiliate-program confirmed 5-10%
- Home Depot affiliate: creator-hero.com/blog/the-home-depot-affiliate-program-in-depth-review-pros-and-cons
