# BPP PDF Guides

Print-ready, customer-keepsake-quality PDFs for the BPP brand. All US Letter portrait, 0.75in margins, BPP design tokens (Navy `#0b1f3b`, Gold `#ffba00`, Outfit + Inter + JetBrains Mono).

## Asset index

| File | Pages | Purpose | Distribution |
|------|-------|---------|--------------|
| `buyers-guide-cover.html` | 2 (cover + ToC) | Lead magnet anchor — front of the 32-page Generator Hookup Buyer's Guide | Email after PDF download form fill, linked from website /guides, Meta lead magnet |
| `buyers-guide-chapter-3.html` | 4 | Highest-leverage chapter — "The 240V Outlet Trap" (the one teased in the download email) | Bundled into full Buyer's Guide PDF; standalone share-friendly excerpt |
| `storm-prep-checklist.html` | 4 | Seasonal asset — 7-day countdown + day-of + after-storm | June 1 + Nov 1 cron, post-install email follow-up, customer-share-friendly |
| `sizing-cheat-sheet.html` | 1 | One-page wallet card — running watts table + AC tonnage match + house-size match | Pre-purchase shoppers, email signature link, printable |
| `owners-manual.html` | 4 (sample of 12) | Customer keepsake — outage protocol + maintenance schedule + warranty | Linked from completion email; archive copy in CRM contact section |
| `service-guarantee-certificate.html` | 1 (US Letter LANDSCAPE) | Customer keepsake certificate — diploma-aesthetic warranty document | Issued post-permit-approval; PDF email attachment or printed hand-delivery |
| `quote-pdf.html` | 2 | Printable proposal | Attached to proposal email for customers who want to print or file with insurance |

## How to render to PDF

**Manual (one-off)**:
1. Open the .html file in Chrome
2. ⌘P (or File → Print)
3. Destination: Save as PDF
4. Paper: US Letter
5. Margins: Default
6. Options: uncheck "Headers and footers" + uncheck "Background graphics" should be CHECKED (so the gold rules and color blocks render)
7. Save

**Automated (in edge function or build pipeline)**:

```typescript
// Use Puppeteer or @sparticuz/chromium in a Supabase edge function
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setContent(htmlString, { waitUntil: 'networkidle0' });
const pdfBuffer = await page.pdf({
  format: 'Letter',
  printBackground: true,
  margin: { top: '0', bottom: '0', left: '0', right: '0' }, // @page CSS handles it
});
```

Or via `wkhtmltopdf` for batch jobs:

```bash
wkhtmltopdf --enable-local-file-access \
  --print-media-type \
  --page-size Letter \
  pdf-guides/storm-prep-checklist.html \
  out/storm-prep-checklist.pdf
```

## Hero images

Real BPP-branded photography lives at `pdf-guides/assets/`:

- `buyers-guide-hero.jpg` — golden-hour install, hands working, exterior brick (16:9)
- `storm-prep-hero.jpg` — pre-storm patio + generator + yellow cord (16:9)
- `cheat-sheet-outlet.jpg` — studio macro of NEMA L14-30R outlet (1:1)

All 4K, generated via nano-banana with the BPP brand context (`/Users/keygoodson/.claude/skills/nano-banana/bpp-brand.json`). Replace with real customer install photos as the BPP photo library grows.

## Distribution channels

1. **Email attachments** — completion email links to Owner's Manual; PDF download email delivers Buyer's Guide
2. **backuppowerpro.com/guides/** — public download page for SEO + organic
3. **Meta lead magnets** — Buyer's Guide as the form-fill reward (drives qualified leads via Ashley)
4. **Customer-share artifact** — these are forwarded to spouses, neighbors, screenshotted on Reddit. Brand atoms.
5. **Pre-storm activation** — Storm Prep Checklist sent to all closed installs every June 1 / Nov 1

## Brand quality bar

These are the public face of the company that lives on a customer's hard drive forever. The visual rules:

- Generous whitespace — never cram a page
- Gold rule on every page top edge (consistent landmark)
- One pull-quote per page in gold accent box (max — restraint matters)
- JetBrains Mono for numerics (page numbers, addresses, phone, edition stamps)
- Custom illustration > stock photography > AI-gen photography (use real install shots when available)
- No "lorem ipsum"-feeling filler — every paragraph earns its space

## Edition versioning

Each PDF carries an "Edition YYYY.MM" stamp (currently 2026.05). Update when:

- Pricing language changes (regulatory or strategic)
- Service area changes
- Permit jurisdictions change
- Photography library refreshes
- Brand language refresh

Bump the edition stamp + commit. Old editions stay in `pdf-guides/archive/{edition}/` for audit purposes.
