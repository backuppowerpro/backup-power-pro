#!/usr/bin/env node
// Generate a city-specific landing page from a config block.
//
// Each city HAS to carry unique content for SEO (Google demotes thin /
// near-duplicate pages hard). This script is a template that fills in
// just the stable bits (schema markup, form, tracking, layout) so the
// editable content (hero copy, city-specific paragraphs, FAQ) stays
// short and unique per city.
//
// Usage:
//   node scripts/build-city-pages.js greenville
//   node scripts/build-city-pages.js --all
//
// Adds a city to CITIES and run; the script writes /city/<slug>/index.html.

const fs = require('node:fs');
const path = require('node:path');

const CITIES = {
  greenville: {
    name: 'Greenville',
    state: 'SC',
    countyContext: 'Greenville County',
    permitOffice: "Greenville County's eTRAKiT portal (separate from the City of Greenville portal)",
    driveContext: "5–20 minutes from our base depending on your neighborhood — faster turnaround than most out-of-county work",
    neighborhoodMentions: 'North Main, Augusta Road, downtown, Five Forks, or out toward Cleveland Park',
    localColor: "When the power goes out on the West End it usually means the whole downtown is down. Simpsonville and Mauldin customers see flicker-outages, but Greenville proper tends to lose circuits block by block on the older grid.",
    turnaroundDays: '2–7',
    heroTagline: "Storm-ready backup for Greenville homes.",
    uniqueFAQ: [
      { q: "What about historic homes downtown?", a: "Older panels (think 1960s-era) sometimes have fused connections or undersized bus bars. We'll flag that on the quote — the inlet install can still happen, but you may need a panel upgrade before the interlock is code-safe." },
      { q: "Do you service downtown condos?", a: "Only stand-alone homes with their own electrical panel. If you're in a shared-service condo, the building owner has to sign off on exterior work." },
    ],
  },
  simpsonville: {
    name: 'Simpsonville',
    state: 'SC',
    countyContext: 'Greenville County',
    permitOffice: "City of Simpsonville's permit portal (evolve-public.infovisionsoftware.com)",
    driveContext: "20–30 minutes from our base — we schedule Simpsonville work in batches so we get two or three installs in a single day",
    neighborhoodMentions: 'Holly Tree, Five Forks, Woodruff Road, or the newer subdivisions out past Fairview',
    localColor: "Simpsonville's newer housing stock (Five Forks, Holly Tree) means cleaner panels and faster installs. Older Fairview homes sometimes need a main breaker upgrade first — we'll spot it on the quote visit.",
    turnaroundDays: '3–10',
    heroTagline: "Generator inlet installation for Simpsonville, SC.",
    uniqueFAQ: [
      { q: "Do you cover the unincorporated areas around Simpsonville?", a: "Yes — if your address is Simpsonville 29680 or 29681 and you're technically in Greenville County (not city limits), we pull the county permit instead of the city. Same price either way." },
      { q: "How busy is the Simpsonville permit office?", a: "Turnaround is usually 1–3 business days. Faster than Greenville County, slower than the City of Greenville." },
    ],
  },
  mauldin: {
    name: 'Mauldin',
    state: 'SC',
    countyContext: 'Greenville County',
    permitOffice: "City of Mauldin's citizenserve portal",
    driveContext: "15–25 minutes from our base",
    neighborhoodMentions: 'the Butler Road corridor, off Miller Road, or out toward Mauldin Commons',
    localColor: "Mauldin's central location and mixed housing stock (70s ranches + newer infill) makes it our bread-and-butter install. Most panels we see here are standard 200A Square D or Eaton — clean interlock work.",
    turnaroundDays: '3–7',
    heroTagline: "Generator inlet installation in Mauldin, SC.",
    uniqueFAQ: [
      { q: "Any issues with older Mauldin panels?", a: "Occasionally we see Federal Pacific or Zinsco panels from the 70s — those have known safety issues and we'll recommend a panel swap before the inlet install. Adds cost but eliminates a real fire risk." },
      { q: "Do you coordinate with HOAs?", a: "The inlet box is exterior-mounted, usually painted to match siding. Most Mauldin HOAs approve without a fuss; if yours requires paperwork we'll send you a spec sheet to submit." },
    ],
  },
  spartanburg: {
    name: 'Spartanburg',
    state: 'SC',
    countyContext: 'Spartanburg County',
    permitOffice: "the City of Spartanburg or Spartanburg County permit office depending on your address (both are manual / reCAPTCHA-gated so we handle the submission)",
    driveContext: "30–45 minutes from our base — we batch Spartanburg work to minimize drive time",
    neighborhoodMentions: 'Converse Heights, Duncan Park, Boiling Springs, or closer to the university',
    localColor: "Spartanburg's older core (Converse Heights, Duncan Park) has beautiful homes with occasionally iffy 60A service panels that need a main breaker swap before the interlock is code-legal. Newer Boiling Springs and Inman builds are straightforward 200A work.",
    turnaroundDays: '5–14',
    heroTagline: "Generator inlet installation for Spartanburg, SC homeowners.",
    uniqueFAQ: [
      { q: "Does the permit turnaround differ in Spartanburg?", a: "Yes — Spartanburg permits take a few days longer than Greenville County because the portals require manual submission (they have reCAPTCHA). We pull the permit same-day we quote; inspection gets scheduled as soon as the permit is issued." },
      { q: "Do you service Boiling Springs + Inman?", a: "Yes — both fall under Spartanburg County jurisdiction. Same $1,197–$1,497 price, same process." },
    ],
  },
  greer: null, // already hand-written; don't overwrite
  easley: {
    name: 'Easley',
    state: 'SC',
    countyContext: 'Pickens County',
    permitOffice: "Pickens County's EnerGov portal (energovweb.pickenscountysc.us)",
    driveContext: "25–35 minutes from our base — we batch Pickens County work to minimize drive time",
    neighborhoodMentions: 'Alice Street, near Easley High, or the newer builds along Rice Road',
    localColor: "Easley sits on the Pickens/Greenville county line but most of the city is Pickens County for permit purposes. Older core homes (the Alice Street / Pendleton Street area) often have 100A panels that need a breaker-box upgrade before the interlock is code-safe — we flag that on the quote. Newer builds along Rice Road + 153 are mostly clean 200A Square D or Eaton work.",
    turnaroundDays: '5–12',
    heroTagline: "Generator inlet installation in Easley, SC.",
    uniqueFAQ: [
      { q: "Why does Easley take longer than Greenville?", a: "Pickens County EnerGov portal requires manual submission (Google SSO gates automation). We pull the permit same-day we quote, but the jurisdiction's processing adds a few days." },
      { q: "Do you service Powdersville and Liberty too?", a: "Yes, same Pickens County jurisdiction, same $1,197–$1,497 price." },
    ],
  },
  taylors: {
    name: 'Taylors',
    state: 'SC',
    countyContext: 'Greenville County',
    permitOffice: "Greenville County's eTRAKiT portal",
    driveContext: "15–20 minutes from our base",
    neighborhoodMentions: 'the Wade Hampton corridor, Paris Mountain area, or Taylors First Baptist neighborhood',
    localColor: "Taylors is technically unincorporated Greenville County — means we pull the county permit rather than a city permit. Same price, same process, usually faster turnaround than Greenville proper because the county eTRAKiT portal moves quicker than city hall.",
    turnaroundDays: '2–6',
    heroTagline: "Storm-ready inlet + interlock for Taylors homes.",
    uniqueFAQ: [
      { q: "What about homes up on Paris Mountain?", a: "We serve Paris Mountain addresses. Drive time adds ~10 minutes but the install is the same price. Most Paris Mountain homes have modern 200A panels." },
      { q: "Do Taylors homes have any quirks?", a: "The older ranches along Wade Hampton sometimes have sub-panels in the garage. We'll check whether the interlock goes in the main or the sub during the quote — affects wiring route, not price." },
    ],
  },
  'fountain-inn': {
    name: 'Fountain Inn',
    state: 'SC',
    countyContext: 'Greenville County',
    permitOffice: "City of Fountain Inn's portal (fountaininnsc.portal.iworq.net)",
    driveContext: "30–40 minutes from our base",
    neighborhoodMentions: 'near downtown Fountain Inn, out toward Laurens Road, or the newer subdivisions off 14',
    localColor: "Fountain Inn sits on the southern edge of Greenville County right up against Laurens County. Most of our Fountain Inn installs are on newer builds — well under 20 years old — which means clean 200A panels and same-day interlock fits. Older in-town homes near Main Street sometimes need a service upgrade first.",
    turnaroundDays: '4–10',
    heroTagline: "Generator inlet installation for Fountain Inn, SC.",
    uniqueFAQ: [
      { q: "Do you also serve Gray Court / Simpsonville border?", a: "Yes — if your address is Fountain Inn 29644, you're in Greenville County and we handle it the same way." },
      { q: "Does Fountain Inn have a permit fee?", a: "Yes, usually $50–$100 depending on scope. Included in the all-in $1,197–$1,497 price — you don't pay the city separately." },
    ],
  },
  'boiling-springs': {
    name: 'Boiling Springs',
    state: 'SC',
    countyContext: 'Spartanburg County',
    permitOffice: "Spartanburg County's EnerGov portal",
    driveContext: "40–50 minutes from our base",
    neighborhoodMentions: 'the 9 / Parris Bridge area, near North Spartanburg High, or the newer subdivisions off Boiling Springs Road',
    localColor: "Boiling Springs has exploded with new builds over the last decade — mostly clean 200A Square D panels, ideal for interlock work. Older homes closer to Downtown Spartanburg sometimes need a service upgrade. We've done enough of these to know which neighborhoods are straightforward vs. which need a panel evaluation first.",
    turnaroundDays: '7–14',
    heroTagline: "Generator inlet installation for Boiling Springs, SC.",
    uniqueFAQ: [
      { q: "How's the growth in Boiling Springs affecting permit times?", a: "Spartanburg County's permit office is busier than it was a few years ago. We pull permits same-day we quote; issuance usually takes 5–7 business days." },
      { q: "Do you do jobs north of Boiling Springs, toward Campobello?", a: "Yes — anywhere in Spartanburg County. Drive time adds a bit but same-price install." },
    ],
  },
  inman: {
    name: 'Inman',
    state: 'SC',
    countyContext: 'Spartanburg County',
    permitOffice: "Spartanburg County's EnerGov portal",
    driveContext: "45–55 minutes from our base — we try to pair Inman work with Boiling Springs or Campobello the same day",
    neighborhoodMentions: 'the Asheville Highway corridor, Inman Mills, or the rural addresses north of 9',
    localColor: "Inman is the kind of rural Spartanburg County town where most customers run 10–12kW portable generators with 50A outlets because they need to run well pumps and workshop tools during outages, not just the fridge. The 50A inlet is the most common spec we install up here.",
    turnaroundDays: '7–14',
    heroTagline: "Generator inlet installation for Inman, SC.",
    uniqueFAQ: [
      { q: "Are 50A installs more expensive than 30A?", a: "Slightly — the inlet box and breaker are both larger. Base install stays $1,197; 50A bumps to $1,397–$1,497 depending on run length to your panel." },
      { q: "Do you service Campobello, Chesnee, and Landrum?", a: "Yes, all Spartanburg County. Same process, same price (minus any extra-long-run surcharge if your panel is 75+ feet from the inlet)." },
    ],
  },
  pickens: {
    name: 'Pickens',
    state: 'SC',
    countyContext: 'Pickens County',
    permitOffice: "Pickens County's EnerGov portal",
    driveContext: "40–50 minutes from our base",
    neighborhoodMentions: 'downtown Pickens, near the county courthouse, or out toward Table Rock',
    localColor: "Pickens proper is a mix of older core homes with 100A service (often need a panel upgrade first) and newer builds on the outskirts with standard 200A Square D or Eaton panels. We see a lot of well-pump-dependent households up here — 50A inlets are more common than in suburban Greenville.",
    turnaroundDays: '7–14',
    heroTagline: "Generator inlet installation in Pickens, SC.",
    uniqueFAQ: [
      { q: "Do you also serve Liberty and Central?", a: "Yes — same Pickens County jurisdiction. We batch the Pickens / Liberty / Central run on the same day when possible." },
      { q: "Does the elevation up near Table Rock affect installs?", a: "No — the install itself is identical. Drive time can add 10–15 minutes compared to in-town Pickens, but same price." },
    ],
  },
  clemson: {
    name: 'Clemson',
    state: 'SC',
    countyContext: 'Pickens County',
    permitOffice: "Pickens County's EnerGov portal",
    driveContext: "45–55 minutes from our base",
    neighborhoodMentions: 'off 76 Highway, near Lake Hartwell, or the university-adjacent neighborhoods',
    localColor: "Clemson is a town that lives and dies by football weekends and lake activity. Most of the owner-occupied homes we install for are on the rural fringe — larger lots, well pumps, longer runs from panel to inlet. Student-rental properties rarely ask for this service (landlords don't invest in backup power).",
    turnaroundDays: '7–14',
    heroTagline: "Generator inlet installation for Clemson, SC.",
    uniqueFAQ: [
      { q: "What about lake houses on Hartwell?", a: "Yes, we install at lake addresses in the Clemson / Seneca area. Drive time can run 60 minutes; the install price stays the same. We'll confirm your address is in Pickens County (some Hartwell addresses are Oconee)." },
      { q: "Do you pull permits in Oconee County?", a: "Not currently. Our service area is Greenville, Spartanburg, and Pickens counties. If your address is technically Oconee, we'd decline the job and recommend a local electrician." },
    ],
  },
  duncan: {
    name: 'Duncan',
    state: 'SC',
    countyContext: 'Spartanburg County',
    permitOffice: "Spartanburg County's EnerGov portal (civicaccess.spartanburgcounty.gov)",
    driveContext: "35–45 minutes from our base — we batch Duncan + Greer runs",
    neighborhoodMentions: 'near Tyger River, the 290 corridor, or the Startex area',
    localColor: "Duncan is mostly Spartanburg County jurisdiction (occasionally City of Duncan for in-city addresses). Mix of newer builds along 290 and older farmhouses with original 100A service. Spartanburg County permits take longer than Greenville County — 5–10 days is typical — so we pull the permit same-day we quote.",
    turnaroundDays: '6–14',
    heroTagline: "Generator inlet installation for Duncan, SC.",
    uniqueFAQ: [
      { q: "Why does Spartanburg County take so long?", a: "The permit portal is Google-SSO gated and reviewers work M–F 9–5. A permit filed Monday usually gets issued by end of week. We schedule your install right after the permit lands." },
      { q: "Are there any 50A generators common out here?", a: "Yes — larger 10–12kW portable generators are common on rural Duncan properties for well pumps + shop tools. The 50A inlet handles those cleanly." },
    ],
  },
};

const TEMPLATE = ({
  slug, name, state, countyContext, permitOffice, driveContext,
  neighborhoodMentions, localColor, turnaroundDays, heroTagline, uniqueFAQ,
}) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Generator Inlet Installation in ${name}, ${state} | Backup Power Pro</title>
<meta name="description" content="Licensed generator inlet + interlock installation in ${name}, ${state}. One-day install, permit and inspection included, $1,197–$1,497. SC License 2942.">
<link rel="canonical" href="https://backuppowerpro.com/city/${slug}/">
<meta property="og:title" content="Generator Inlet Installation in ${name}, ${state} | Backup Power Pro">
<meta property="og:description" content="Storm-ready generator inlet + interlock installation in ${name}. Done in a day. Permit and inspection included.">
<meta property="og:image" content="https://backuppowerpro.com/assets/images/bpp-og-v2.jpg">
<meta property="og:url" content="https://backuppowerpro.com/city/${slug}/">
<meta name="theme-color" content="#0b1f3b">

<script type="application/ld+json">
${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "ElectricalContractor",
  "name": "Backup Power Pro",
  "url": `https://backuppowerpro.com/city/${slug}/`,
  "telephone": "+1-864-400-5302",
  "image": "https://backuppowerpro.com/assets/images/bpp-og-v2.jpg",
  "priceRange": "$1,197–$1,497",
  "areaServed": [{ "@type": "City", "name": name, "containedInPlace": state }],
  "serviceType": "Generator Inlet Installation",
  "makesOffer": {
    "@type": "Offer",
    "name": "Storm-Ready Connection System",
    "description": "Generator inlet box + interlock kit installation. One-day install. Permit and inspection included.",
    "priceCurrency": "USD",
    "priceSpecification": { "@type": "PriceSpecification", "minPrice": 1197, "maxPrice": 1497, "priceCurrency": "USD" },
  },
  "hasCredential": { "@type": "EducationalOccupationalCredential", "name": "South Carolina Electrical Contractor License #2942" },
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.9", "reviewCount": "100" },
}, null, 2)}
</script>

<style>
  :root { --navy: #0b1f3b; --gold: #ffba00; --red: #dc2626; --bg: #f4f4f2; --card: #ffffff; --text: #1a1a1a; --text-muted: #5a5a5a; --text-faint: #8a8a8a; }
  * { box-sizing: border-box; } html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Outfit', sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; -webkit-font-smoothing: antialiased; }
  .hero { background: var(--navy); color: #fff; padding: 48px 20px 56px; padding-top: calc(48px + env(safe-area-inset-top)); }
  .hero-inner { max-width: 720px; margin: 0 auto; }
  .hero-label { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gold); margin-bottom: 16px; }
  .hero h1 { font-size: clamp(30px, 5vw, 46px); font-weight: 800; letter-spacing: -1px; line-height: 1.1; margin: 0 0 20px; }
  .hero h1 .accent { color: var(--gold); }
  .hero .lead { font-size: 17px; line-height: 1.6; color: rgba(255,255,255,.82); margin: 0 0 28px; }
  .hero .trust-row { display: flex; gap: 16px; flex-wrap: wrap; font-size: 13px; color: rgba(255,255,255,.7); margin-top: 20px; }
  .form-card { max-width: 480px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: 14px; padding: 18px; margin-top: 24px; }
  .form-card .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .form-card label { display: block; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,.5); margin-bottom: 4px; }
  .form-card input { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1.5px solid rgba(255,255,255,.15); background: rgba(255,255,255,.08); color: #fff; font-family: inherit; font-size: 15px; outline: none; }
  .form-card input:focus { border-color: var(--gold); }
  .form-card button { width: 100%; padding: 14px 20px; margin-top: 6px; border-radius: 100px; border: none; background: var(--gold); color: var(--navy); font-family: inherit; font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
  .form-card button:disabled { opacity: 0.6; cursor: wait; }
  .form-err { display: none; color: #f87171; font-size: 12px; margin-top: 4px; }
  .form-privacy { font-size: 11px; color: rgba(255,255,255,.4); text-align: center; margin-top: 10px; }
  .form-privacy a { color: rgba(255,255,255,.6); }
  .section { padding: 56px 20px; max-width: 760px; margin: 0 auto; }
  .section h2 { font-size: 28px; letter-spacing: -0.5px; margin: 0 0 16px; }
  .section p { font-size: 16px; color: var(--text); margin: 0 0 14px; }
  .section ul { padding-left: 20px; }
  .section li { margin-bottom: 8px; font-size: 15px; }
  .callout { background: var(--card); border-left: 4px solid var(--gold); padding: 16px 18px; border-radius: 4px; margin: 20px 0; font-size: 15px; color: var(--text-muted); }
  .callout strong { color: var(--text); }
  .cta-band { background: var(--navy); color: #fff; padding: 40px 20px; text-align: center; }
  .cta-band h2 { font-size: 26px; margin: 0 0 12px; }
  .cta-band a { display: inline-block; background: var(--gold); color: var(--navy); padding: 14px 24px; border-radius: 100px; font-weight: 700; text-decoration: none; font-size: 16px; margin-top: 10px; }
  .sub-links { background: #eee; padding: 20px; font-size: 13px; color: var(--text-muted); text-align: center; }
  .sub-links a { color: var(--navy); text-decoration: none; margin: 0 8px; border-bottom: 1px solid rgba(0,0,0,.1); }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media(max-width: 540px) { .form-card .row { grid-template-columns: 1fr; } }
</style>
</head>
<body>

<section class="hero" id="top">
  <div class="hero-inner">
    <div class="hero-label">${name}, ${state} · SC Electrical License #2942</div>
    <h1>Generator Inlet Installation<br>in <span class="accent">${name}, ${state}</span></h1>
    <p class="lead">${heroTagline} Permit pulled, inlet mounted, interlock installed, inspection passed. <strong>One day on-site. $1,197–$1,497 all-in.</strong> No extension cord spaghetti, no standby-generator price tag.</p>

    <div class="form-card">
      <div id="qfFormWrap">
        <div class="row">
          <div>
            <label for="qfName">First Name</label>
            <input type="text" id="qfName" autocomplete="given-name" autocapitalize="words" placeholder="Mike">
            <div id="qfNameErr" class="form-err" role="alert" aria-live="polite">Required</div>
          </div>
          <div>
            <label for="qfPhone">Phone</label>
            <input type="tel" id="qfPhone" autocomplete="tel" inputmode="tel" placeholder="(864) 555-0100">
            <div id="qfPhoneErr" class="form-err" role="alert" aria-live="polite">Valid phone required</div>
          </div>
        </div>
        <button id="qfSubmitBtn" type="button">Get my ${name} quote
          <svg fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="width:16px;height:16px"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </button>
        <p class="form-privacy">By submitting you agree to receive texts from us. <a href="/privacy.html" target="_blank">Privacy</a></p>
      </div>
      <div id="qfSuccess" style="display:none;text-align:center;padding:16px">
        <div id="qfSuccessSending" style="display:none">
          <div style="width:36px;height:36px;margin:0 auto 12px;border:3px solid rgba(255,255,255,.15);border-top-color:var(--gold);border-radius:50%;animation:spin .8s linear infinite"></div>
          <p style="color:rgba(255,255,255,.6);font-size:14px;margin:0">Sending…</p>
        </div>
        <div id="qfSuccessDone" style="display:none">
          <div style="font-size:42px;margin-bottom:12px">✅</div>
          <h3 style="font-size:20px;margin:0 0 8px">You're all set, <span id="qfSuccessName"></span>!</h3>
          <p style="color:rgba(255,255,255,.7);font-size:14px;margin:0">We'll text you within minutes from <strong style="color:#fff">(864) 400-5302</strong>.</p>
        </div>
      </div>
    </div>

    <div class="trust-row">
      <span>⭐⭐⭐⭐⭐ 4.9 (100+ reviews)</span>
      <span>🔒 Price-lock guarantee</span>
      <span>⚡ 5 slots per week</span>
    </div>
  </div>
</section>

<section class="section">
  <h2>Why ${name} homeowners pick BPP</h2>
  <p>${localColor}</p>

  <div class="callout">
    <strong>What we actually install:</strong> An inlet box mounted on the exterior wall, weatherproof conductors into your panel, and a mechanical interlock that physically prevents backfeeding the grid. You plug your generator into the inlet, flip the interlock, and select breakers for what you want powered.
  </div>

  <h2>The ${name}-specific process</h2>
  <p>${name} permits run through ${permitOffice}. We pull under SC Electrical License 2942, stand for the inspection, close the job out. You don't visit city hall. You don't take a day off. We handle the entire paperwork cycle.</p>

  <p>${driveContext}. If you're over by ${neighborhoodMentions}, same-week install is typically available. Older homes sometimes need a panel upgrade first — we'll flag that in the quote, no surprises.</p>

  <h2>What's included in the $1,197–$1,497</h2>
  <ul>
    <li>Inlet box (30A or 50A — matches your generator)</li>
    <li>Interlock kit (code-compliant mechanical lock for your panel brand)</li>
    <li>All wiring, conduit, and weatherproofing</li>
    <li>Permit pull + permit fee</li>
    <li>Inspection stand-up</li>
    <li>Labor (one day on-site, usually 3–5 hours)</li>
    <li>Walkthrough of how to safely power up during an outage</li>
    <li>Price-lock guarantee: the price we text is what you pay</li>
  </ul>

  <h2>Why not a standby generator?</h2>
  <p>A standby whole-home generator (Generac, Kohler, Briggs) runs $12,000–$18,000 installed. It's automatic, it's wonderful, and it's overkill if you just want the lights, fridge, WiFi, and well pump through a storm. You've already got the portable generator. The inlet + interlock unlocks its full usefulness for a tenth the cost of a standby install.</p>

  <h2>FAQ — ${name} homeowners</h2>
  <p><strong>Does my generator need a 240V outlet?</strong> Yes — either a 30A (three-prong twist lock) or 50A (four-prong). If yours is 120V-only, it's not compatible with this install.</p>
  <p><strong>How long until I'm scheduled?</strong> Typical turnaround in ${name} is ${turnaroundDays} days from quote to install.</p>
  <p><strong>Do I need permission from Duke Energy?</strong> No. The interlock mechanically prevents backfeeding so the install is code-compliant and doesn't require utility approval.</p>
  ${uniqueFAQ.map(f => `<p><strong>${f.q}</strong> ${f.a}</p>`).join('\n  ')}
</section>

<section class="cta-band">
  <h2>Storm season doesn't wait.</h2>
  <p style="margin:0 0 6px;color:rgba(255,255,255,.8);font-size:15px">Text us for your ${name} quote — most customers hear back within 10 minutes.</p>
  <a href="#top">Get my quote</a>
</section>

<div class="sub-links">
  Also serving:
  ${Object.keys(CITIES).filter(k => k !== slug && CITIES[k] !== null).slice(0, 4).map(k => `<a href="/city/${k}/">${CITIES[k]?.name || k}</a>`).join('\n  ')}
  <a href="/">More cities</a>
</div>

<!-- PostHog -->
<script>!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+" (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init('phc_qoA51lePZqXYtPJYkrIpdA4U8iMDJ79L1kje7r4pD4O',{api_host:'https://us.i.posthog.com',person_profiles:'identified_only',session_recording:{recordCrossOriginIframes:false,maskAllInputs:true},capture_pageview:true,capture_pageleave:true,enable_heatmaps:true})</script>
<script>
  if (typeof posthog !== 'undefined') {
    posthog.register({ channel: 'organic', landing_page: '/city/${slug}/', city: '${slug}' });
  }
</script>

<script>
(function(){
  var BPP_NEW_LEAD_URL = 'https://reowtzedjflwmlptupbk.supabase.co/functions/v1/quo-ai-new-lead';
  var META_PIXEL_ID = '1389648775800936';
  var nameInput  = document.getElementById('qfName');
  var phoneInput = document.getElementById('qfPhone');
  var formStartedFired = false;
  function fireFormStarted(field) {
    if (formStartedFired) return; formStartedFired = true;
    if (typeof posthog !== 'undefined') posthog.capture('lead_form_started', { field: field, channel: 'organic', city: '${slug}' });
  }
  var scrollMilestones = { 25: false, 50: false, 75: false, 100: false };
  window.addEventListener('scroll', function() {
    var h = document.documentElement;
    var scrolled = (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) * 100;
    [25,50,75,100].forEach(function(mark) {
      if (!scrollMilestones[mark] && scrolled >= mark) {
        scrollMilestones[mark] = true;
        if (typeof posthog !== 'undefined') posthog.capture('lead_scroll_depth', { depth: mark, channel: 'organic', city: '${slug}' });
      }
    });
  }, { passive: true });

  nameInput.addEventListener('input', function(){
    fireFormStarted('name');
    this.value = this.value.replace(/\\s/g, '');
    if (this.value.length) this.value = this.value.charAt(0).toUpperCase() + this.value.slice(1);
  });
  phoneInput.addEventListener('input', function(e) {
    fireFormStarted('phone');
    var v = e.target.value.replace(/\\D/g, '');
    if (v.startsWith('1') && v.length > 10) v = v.slice(1);
    if (v.length > 10) v = v.slice(0, 10);
    if (v.length >= 7) v = '('+v.slice(0,3)+') '+v.slice(3,6)+'-'+v.slice(6);
    else if (v.length >= 4) v = '('+v.slice(0,3)+') '+v.slice(3);
    else if (v.length >= 1) v = '('+v;
    e.target.value = v;
  });

  async function sha256(str){
    if (!str) return '';
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str.trim().toLowerCase()));
    return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0')}).join('');
  }

  document.getElementById('qfSubmitBtn').addEventListener('click', async function(){
    var ok = true;
    var name = nameInput.value.trim();
    var phone = phoneInput.value.replace(/\\D/g, '');
    if (!name) { document.getElementById('qfNameErr').style.display = 'block'; ok = false; }
    else { document.getElementById('qfNameErr').style.display = 'none'; }
    if (phone.length !== 10) { document.getElementById('qfPhoneErr').style.display = 'block'; ok = false; }
    else { document.getElementById('qfPhoneErr').style.display = 'none'; }
    if (!ok) return;

    var btn = this;
    btn.disabled = true;
    btn.innerHTML = '<div style="width:18px;height:18px;border:2.5px solid rgba(11,31,59,.2);border-top-color:var(--navy);border-radius:50%;animation:spin .6s linear infinite"></div> Sending...';

    var eventId = 'bpp_${slug}_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    var rawPhone = phoneInput.value.trim();
    var [phH, fnH, countryH] = await Promise.all([sha256(rawPhone.replace(/\\D/g,'')), sha256(name), sha256('us')]);

    var payload = {
      firstName: name, lastName: '', phone: rawPhone, email: '',
      address: '', addressStreet: '', addressCity: '${name}', addressCounty: '', addressState: '${state}', addressZip: '', addressCountry: 'US',
      hasCompatibleGenerator: 'Yes - 240V 30A/50A confirmed',
      submittedAt: new Date().toISOString(), eventTimestamp: Math.floor(Date.now()/1000),
      source: 'city_${slug}_organic', actionSource: 'website',
      eventName: 'Lead', eventId: eventId,
      clientUserAgent: navigator.userAgent || '',
      fbp: (document.cookie.match(/(?:^|;\\s*)_fbp=([^;]*)/)||[])[1] || '',
      fbc: (function(){var c=(document.cookie.match(/(?:^|;\\s*)_fbc=([^;]*)/)||[])[1]||'';if(c)return c;var p=new URLSearchParams(window.location.search).get('fbclid')||'';return p?'fb.1.'+Date.now()+'.'+p:''})(),
      fbclid: new URLSearchParams(window.location.search).get('fbclid') || '',
      pageUrl: window.location.href, referrer: document.referrer || '',
      hashedPhone: phH, hashedFirstName: fnH, hashedCountry: countryH,
    };

    document.getElementById('qfFormWrap').style.display = 'none';
    document.getElementById('qfSuccessName').textContent = name;
    document.getElementById('qfSuccess').style.display = 'block';
    document.getElementById('qfSuccessSending').style.display = 'block';

    var submitBody = JSON.stringify(payload);
    var delivered = false;
    var deliveryMethod = 'none';
    var createdContactId = null;
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([submitBody], { type: 'application/json' });
        if (navigator.sendBeacon(BPP_NEW_LEAD_URL, blob)) { delivered = true; deliveryMethod = 'beacon'; }
      }
    } catch (e) {}
    if (!delivered) {
      try {
        var resp = await fetch(BPP_NEW_LEAD_URL, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: submitBody });
        delivered = resp.ok; deliveryMethod = 'fetch';
        if (resp.ok) { try { var j = await resp.json(); createdContactId = j?.contactId || null; } catch(_) {} }
        if (!resp.ok && typeof posthog !== 'undefined') posthog.capture('lead_submit_failed', { status: resp.status, method: 'fetch', channel: 'organic', city: '${slug}' });
      } catch (fetchErr) {
        try {
          var xhr = new XMLHttpRequest();
          xhr.open('POST', BPP_NEW_LEAD_URL, false);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.send(submitBody);
          delivered = xhr.status >= 200 && xhr.status < 300;
          deliveryMethod = 'xhr';
        } catch (xhrErr) {
          if (typeof posthog !== 'undefined') posthog.capture('lead_submit_failed', { err: String(xhrErr).slice(0,200), channel: 'organic', city: '${slug}' });
        }
      }
    }

    if (typeof fbq === 'function') {
      fbq('init', META_PIXEL_ID, { ph: phH, fn: fnH, country: countryH });
      fbq('track', 'Lead', { content_name: 'generator-inlet-quote', content_category: 'generator-installation', value: 1197, currency: 'USD', city: '${name}' }, { eventID: eventId });
    }
    if (typeof posthog !== 'undefined') {
      posthog.capture('lead_captured', { source: 'city_${slug}_organic', channel: 'organic', city: '${slug}', page: window.location.pathname, delivery: deliveryMethod, delivered: delivered });
      if (createdContactId) {
        try { posthog.identify(createdContactId, { first_name: name, phone: rawPhone, channel: 'organic', landed_via: '/city/${slug}/', city: '${slug}' }); } catch(_) {}
      }
    }
    document.getElementById('qfSuccessSending').style.display = 'none';
    document.getElementById('qfSuccessDone').style.display = 'block';
  });
})();
</script>

</body>
</html>
`;

// CLI
const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node build-city-pages.js <slug> | --all');
  process.exit(1);
}

const targets = arg === '--all' ? Object.keys(CITIES).filter(k => CITIES[k] !== null) : [arg];

for (const slug of targets) {
  const cfg = CITIES[slug];
  if (!cfg) {
    console.error(`Skip ${slug} (no config or null)`);
    continue;
  }
  const html = TEMPLATE({ slug, ...cfg });
  const dir = path.join(__dirname, '..', 'city', slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log('wrote', path.join(dir, 'index.html'));
}
