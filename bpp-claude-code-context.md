# Backup Power Pro — Claude Code Master Context Guide

Use this document at the start of every Claude Code session. It contains everything needed to understand the business, tech stack, files, pricing, customers, marketing, and pending work without asking clarifying questions.

---

## BUSINESS OVERVIEW

**Company:** Backup Power Pro
**Parent company:** Key Electric
**Owner:** Key Goodson — licensed electrical contractor, State of South Carolina
**Phone:** (864) 863-8009
**Website:** backuppowerpro.com
**Booking URL:** https://network.backuppowerpro.com/public/appointment-scheduler/69a24fd5076c500a205ec116/schedule
**Client portal:** network.backuppowerpro.com
**Google reviews:** 100+ reviews, 4.9 stars

**What it is:** A focused, specialized generator inlet installation service operating as a division of Key Electric in upstate South Carolina. We install code-compliant generator inlet boxes and interlock kits that allow homeowners to safely connect their portable generator directly to their home's electrical panel.

**What we do NOT do:** We do not sell generators. We do not do general electrical work under this brand. We do not install standby generators. This is a single-service, specialized business.

**Service area:** Pickens County, Greenville County, Spartanburg County — upstate South Carolina

**Price range:** $1,400–$2,000+ depending on panel complexity

**Typical job:** One-day installation with permit and inspection included

---

## THE SERVICE

### What Gets Installed
- Generator inlet box mounted on exterior of home
- Interlock kit installed on the electrical panel
- Wire run from panel to inlet
- Permit pulled on every job — included in price
- Inspection scheduled and completed — included in price
- All work is code-compliant — no back-feeding the grid

### Value Proposition
- Free 10-minute video assessment — homeowner points phone at their breaker panel, no in-home visit required
- Exact same-day quote on the call — no estimates, no surprises
- One-day installation
- Fully permitted and inspected
- Licensed SC electrical contractor
- Works with any portable generator the customer already owns

### How the Job Works for the Customer
1. Watch Meta ad → visit landing page → book free video assessment
2. Get on 10-minute video call with Key → show panel → receive exact quote on the call
3. Sign quote and pay through Dubsado client portal
4. Installation scheduled — sub completes the job in one day
5. Permit pulled and inspection completed by Key
6. Done

---

## PRICING STRUCTURE

### Base Prices
| Service | Base Price |
|---|---|
| 30A installation | $1,417 (incl. $17 specificity offset) |
| 50A installation | $1,823 (incl. $23 specificity offset) |

### Adders
| Item | Price |
|---|---|
| Long run 30A | +$14/ft over 20ft |
| Long run 50A | +$15/ft over 20ft |
| Main breaker | +$250 |
| Twin/quad breaker | +$150 |
| Whole home surge protector | +$450 |

### Add-On Products
| Item | Sell Price |
|---|---|
| 30A generator cord | $150 |
| 50A generator cord | $250 |
| 30→50A adapter | $175 |
| 30A cord + adapter bundle | $300 |

### Permit
- Customer-facing price: $150
- Actual cost: $75
- Delta is margin baked into every job

### Profit Protection
- Minimum profit floor: $700 per job (enforced silently in quote calculator)
- Specificity offset: +$17 on 30A, +$23 on 50A — ensures final prices never land on round numbers, signals custom pricing not menu pricing

### Cost Structure (Per Job)
- 30A inlet: $55 · 50A inlet: $85
- Interlock: $25
- Permit actual cost: $75
- License amortized: $25
- Main breaker cost: $125
- Twin/quad cost: $35
- Surge protector cost: $85
- 30A cord cost: $60 · 50A cord cost: $125
- Adapter cost: $65
- Sub payout 30A base: $375 · 50A base: $425
- Sub long run increment 30A: $100/30ft · 50A: $120/30ft
- Exterior adder to sub: $25 per 5ft over first 5ft
- Ad cost allocation: $185 per job

---

## SUB LABOR MODEL

Key manages the business and customer relationship. A licensed sub does the physical installation. The sub brings their own materials and labor. Key pays sub directly. The pricing model accounts for sub payout as a cost. Key is responsible for permit, inspection, and all customer communication.

---

## QUOTE CALCULATOR

A standalone HTML tool (index.html / bpp-quote.html) used live during video assessment calls.

### Inputs
- Amperage (30A or 50A)
- Total run length (slider, 1–120ft)
- Exterior portion (slider, 0–run length)
- Panel complications (main breaker toggle, twin/quad toggle)
- Upsells (surge protector toggle)
- Cord/adapter selection (chips)

### Outputs
- Total sell price
- Profit and margin
- Sub payout
- Estimated job time
- Inlet line item for Dubsado quote template
- Full itemized breakdown for verbal delivery to customer on call

### Key Features
- Profit floor enforced silently — no banner, no layout jump
- Specificity offset applied to all final prices
- Light/dark mode toggle (🌙/☀️ button in header)
- Reset button returns to defaults (30A, 5ft, 5ft ext, no add-ons)
- Real-time slider notes show adder calculations
- Works offline after initial load
- Mobile-first design

### Design Tokens
- Gold accent: #F5A623
- Dark background: #0c0c0f
- Fonts: Syne (headings, 800 weight), DM Sans (body)

---

## THE CUSTOMER

**Primary demographic:** Male homeowners, age 55–65+
**Situation:** Already owns a portable generator. Has experienced at least one significant power outage. Currently running extension cords through windows or not using the generator at all because there's no safe connection method.
**Mindset:** Practical, skeptical of contractors, responds to straight talk and credibility. Not price shopping — doesn't know this service exists until they see the ad. Not tech savvy.
**What converts them:** Plain English, exact pricing, licensed contractor credibility, no salesperson visit, quick process, real person they can see and trust.
**What loses them:** Vague estimates, marketing fluff, complicated process, feeling like they're being sold to.

---

## MARKETING

### Meta Ads
- Platform: Facebook and Instagram
- Format: Key talking directly to camera, outdoor setting, vertical 9:16, 30–45 seconds
- Campaign objective: Leads
- Optimization event: Lead (BPPWebsite dataset, Meta Conversions API via Zapier)
- Audience: Broad, South Carolina
- Current CPL: ~$40 (best achieved: $30)
- Hook rate on best ads: 47–50% (industry average is 25–30%)
- Primary converting demographic: Males 55–65+
- Frequency issue: At 2.26 frequency on SC audience — creative fatigue is primary CPL driver

### Three Proven Hook Angles
1. **Extension cord problem:** "If you own a generator and you're still running extension cords through your house, we need to talk"
2. **Education/curiosity:** "You don't need a $15,000 standby generator if you already own a portable one"
3. **Consequence/story:** "Last time the power went out, how long were you without it?"

### UTM / Traffic Detection
- Meta traffic arrives with `?source=meta` or `?utm_source=meta` parameter
- Landing page detects Meta traffic — hides free guide CTA, shows single booking CTA only
- This gives Meta a clean, singular conversion signal
- Organic traffic sees both CTAs (booking + free guide)

### Meta Pixel
- Pixel ID: 1389648775800936 (dataset name: BPPWebsite)
- Base pixel code stays on website — tracks page views and audience behavior
- No button click events — those have been removed
- Lead event fires via Zapier when assessment is booked in Dubsado
- Zapier → Meta Conversions API → BPPWebsite dataset → Lead event

### Lead Magnet Funnel
- "Generator Power Guide" — 8-page PDF
- Covers: safety, wattage planning, appliance chart, extension cords vs inlet, worksheet
- Gated behind guide landing page (generator-guide-landing-page.html)
- Intended for cold traffic not yet ready to book
- Email nurture sequence needed: minimum 3 emails over 7–10 days via Dubsado

---

## TECH STACK

| Tool | Purpose |
|---|---|
| Webflow | Main website (backuppowerpro.com) |
| Dubsado | CRM, quotes, invoices, client portal, scheduling |
| Zapier | Automation — connects Dubsado to Meta and SMS |
| Meta Conversions API | Conversion tracking via Zapier |
| Meta Pixel | Website audience tracking |
| Twilio / SMS | Text message communication via Zapier |
| index.html | Quote calculator used on video calls |

---

## FILES

| File | Description |
|---|---|
| `index.html` / `bpp-quote.html` | Quote calculator — standalone HTML, works offline |
| `backup-power-pro-landing-page.html` | Main landing page v8, Guy Roofing-inspired, bento grid, interactive calculator, review carousel, sticky CTA bar, surge protection pitch, Meta-optimized |
| `generator-guide-landing-page.html` | Guide download landing page for cold traffic |
| `generator-guide-source.html` | HTML source for the PDF lead magnet — KNOWN ISSUE: font spacing bugs |
| `generator-power-guide-backup-power-pro.pdf` | Current PDF output — has character spacing issues |
| `logo.png` | BPP logo, 240x55px |
| `fonts/` | Outfit TTF + Inter WOFF2 font files |

---

## CUSTOMER COMMUNICATION SEQUENCE

| Timing | Channel | Content |
|---|---|---|
| Immediately after booking | Email (Dubsado) | Confirmation — what to have ready, meeting link coming via text |
| 2 minutes after booking | SMS (Zapier) | Personal-feeling confirmation text, asks them to confirm number is good |
| 24 hours before | Email (Dubsado) | Reminder — be near panel and meter, link coming via text |
| 1 hour before | Email (Dubsado) | Final reminder — watch for text with link |
| Just before call | SMS | Video call link |
| 10 min after no-show | SMS | Non-judgmental reschedule offer |
| 2–3 days after job complete | Dubsado automated | Review request |

**Note:** SMS delay is set to 2 minutes via Zapier to feel personal. No time window filter currently — 2am bookings will receive text immediately (accepted tradeoff).

---

## SALES PROCESS DETAILS

### Video Assessment Call
- Key uses the quote calculator live during the call
- Customer shows panel on video
- Key assesses: run length, exterior footage, panel complications
- Key gives verbal price anchor before hanging up — every time, no exceptions
- Quote sent within the hour via Dubsado

### Verbal Price Anchor Script
"Okay, based on everything you've shown me, I have a really good idea of what this job looks like. You're looking at right around [total] for everything — that covers the inlet, the permit, and the interlock. [If complications: the panel needs a main breaker for the interlock to work so that's included too.] I'll get the exact number written up and send it over within the hour. Does that range work for you?"

### If Customer Hesitates on Price
"Is that in the range you were expecting?" — then listen. Never fill the silence.

### Cord Recommendation (if customer declines cord purchase)
For 30A: "Search '30A generator extension cord L14-30' on Amazon — PowerFit and Conntek are solid brands, usually $60–80."
For 50A: "Search '50A generator cord L14-50' on Amazon — Conntek makes a good one, usually $100–120."

---

## INVOICE TERMS

- Quote valid: 30 days from date of issue
- Payment: Due upon receipt
- Permit: Pulled after payment received, included in price, Key handles
- Scope: Inlet and interlock as outlined in proposal — anything additional quoted separately
- Cancellation: Full refund if cancelled 48+ hours before install. Non-refundable within 48 hours.
- Warranty: 1 year workmanship from date of installation
- Limitation of liability: Limited to value of original invoice
- Jurisdiction: South Carolina

---

## BRAND

### Visual Identity
- Primary color: Gold #F5A623
- Background: Dark #0c0c0f
- Surface: rgba(255,255,255,0.035)
- Heading font: Syne, 800 weight
- Body font: DM Sans
- Mobile-first on all builds

### Tone of Voice
Plain English. Confident. Straight talk. Like a trusted local contractor, not a marketing agency. No jargon, no hype, no vague promises. Write like you're talking to a 60-year-old homeowner who has been burned by contractors before and wants a straight answer.

### Trust Signals to Always Include
- Licensed SC electrical contractor
- Permit pulled on every job
- Code-compliant installation
- 100+ five-star Google reviews, 4.9 stars
- One-day installation
- Free video assessment, no in-home visit required
- Exact upfront pricing, no estimates

---

## PENDING TASKS

- [ ] Fix PDF font spacing bug in generator-guide-source.html (characters rendering with gaps like "Ph on e Ch arger") — try different fonts or different PDF generation approach
- [ ] Replace YOUR_PIXEL_ID placeholder with actual Meta pixel ID (1389648775800936) in landing page
- [ ] Replace 3 placeholder reviews (Jason M., Sarah T., David R.) with real customer reviews
- [ ] Verify Elizabeth S. and Mihai B. review text matches actual Google reviews exactly
- [ ] Set up email nurture sequence in Dubsado for guide downloads (min 3 emails over 7–10 days)
- [ ] Create fresh Meta ad video creative — 3 new scripts ready, filming planned
- [ ] Set up Google Business Profile for Backup Power Pro
- [ ] Set up Meta retargeting audiences
- [ ] Deploy to hosting with CDN (replace base64-encoded images for performance)
- [ ] Verify Dubsado booking fires Lead event to Meta via Zapier end-to-end
- [ ] Create Meta instant lead form for guide downloads
- [ ] Connect lead form to Dubsado/Zapier for PDF auto-delivery
- [ ] Replace guide download button href="#" with actual delivery link
- [ ] Set up missed call text-back for Google calls
- [ ] Set up Google Business Profile

---

## IMPORTANT CONTEXT FOR BUILDING

- The quote calculator is used live on video calls — it must be fast, readable, and work offline after first load
- The landing page has a single conversion goal: book the free assessment — no secondary CTAs for Meta traffic
- All customer-facing content should be written for a 60-year-old male homeowner who is not tech savvy
- Key has strong technical aptitude and prefers clean, focused builds with no unnecessary complexity
- Mobile-first on everything — significant portion of Meta traffic lands on mobile
- The business is a one-person operation at this stage — automations should reduce manual work wherever possible
- Dubsado is the hub for all client-facing activity — quotes, invoices, contracts, scheduling, review requests
- Zapier is the connective tissue between Dubsado and Meta — keep that data flow clean and simple
