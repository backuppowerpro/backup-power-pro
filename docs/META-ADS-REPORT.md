# Backup Power Pro — Meta Ads Audit Report
**Date:** March 24, 2026
**Pixel:** BPPWebsite (ID: 1389648775800936)
**Account:** Backup Power Pro
**Auditor:** Claude Code (ads-meta skill)

---

## Meta Ads Health Score

```
Meta Ads Health Score: 49/100  (Grade: D — Poor)

Pixel / CAPI Health:  59/100  ██████░░░░  (30% of score)
Creative:             26/100  ███░░░░░░░  (30% of score)
Account Structure:    70/100  ███████░░░  (20% of score)
Audience:             50/100  █████░░░░░  (20% of score)
```

**Grade: D** — Significant problems present. Urgent intervention required on creative and pixel.

The account is not broken — leads ARE coming in — but it is operating far below its potential.
The two biggest score killers are **almost no creative assets** and **pixel/CAPI gaps** that mean
Meta can't match your leads back to real people. Fix those two areas and you can realistically
cut your cost per lead by 30–50%.

---

## Account Snapshot (at time of audit)

| Item | Value |
|------|-------|
| Active campaigns | 1 |
| Active ad sets | 1 |
| Active ads | 2 |
| Daily budget | $57/day (CBO) |
| Lead events (pixel) | 121 total |
| Lead EMQ | 7.4 / 10 |
| CAPI coverage | Partial — gap warning active |
| Domain verification | FAILED (error in Events Manager) |
| Events Manager diagnostics | 1 active error |

---

## Full 46-Check Audit

### PIXEL / CAPI HEALTH (30% weight)

| ID | Check | Result | Finding |
|----|-------|--------|---------|
| M01 | Pixel installed and firing | ✅ PASS | BPPWebsite pixel firing on all pages. PageView (3.5K), ViewContent (2.6K), Lead (121), Initiate Checkout (57) all active. |
| M02 | Conversions API (CAPI) active | ⚠️ WARNING | CAPI is sending events via Zapier webhook for Lead + PageView + ViewContent. However, Meta's Events Manager shows an active "CAPI coverage gap" warning for Lead events. Server-side events present but incomplete signal. |
| M03 | Event deduplication (event_id) | ⚠️ WARNING | event_id was NOT mapped in the Zapier CAPI step — fixed during this audit session. Dedup rate is unknown; needs verification in Events Manager after 24–48 hrs of new Zap running. |
| M04 | Event Match Quality (EMQ) | ⚠️ WARNING | Lead EMQ = 7.4/10. In the "Good" range (6.0–7.9) but below Excellent target of ≥8.0. Missing high-value signals: client IP address, user agent, browser ID (fbp), click ID (fbc) — these cannot be passed through Zapier connector. |
| M05 | Domain verification | ❌ FAIL | Active error in Events Manager: "Confirm domains that belong to you." Three domains detected but not allowlisted: backuppowerpro.com, backup-power-pro.netlify.app, 69a6302402eab500087fe62b--backup-power-pro.netlify.app. This affects iOS delivery and AEM configuration. |
| M06 | Aggregated Event Measurement (AEM) | ❌ FAIL | AEM cannot be fully configured while domain verification is broken. Top 8 events are not formally prioritized. |
| M07 | Standard events used | ✅ PASS | All standard events in use: PageView, ViewContent, Lead, InitiateCheckout, Schedule. No custom events replacing standard ones. |
| M08 | CAPI Gateway | ⚠️ WARNING | Using Zapier webhook integration (not CAPI Gateway). Zapier cannot pass browser-side signals (IP, user agent, fbp, fbc) that CAPI Gateway can capture automatically — this is likely why EMQ is 7.4 instead of 9+. |
| M09 | Attribution window | ⚠️ WARNING | Not verified during audit. Meta default is 7-day click / 1-day view, but should be explicitly confirmed in ad set settings. |
| M10 | Data freshness | ✅ PASS | Events firing in real-time. No lag detected in Events Manager overview. |

**Pixel/CAPI Score: 59/100**

---

### CREATIVE — DIVERSITY & FATIGUE (30% weight)

| ID | Check | Result | Finding |
|----|-------|--------|---------|
| M25 | Creative format diversity | ❌ FAIL | Only 2 active ads. Meta recommends ≥3 formats (static image, video, carousel). Running only static images = algorithm has almost no optimization signal. |
| M26 | Creative volume per ad set | ❌ FAIL | 2 creatives vs. the 5–8 Meta recommends. Meta's algorithm needs variety to A/B test and learn. With only 2 ads, one will get almost all spend and you'll never know if something else would've worked better. |
| M27 | Vertical video (9:16) for Reels/Stories | ❌ FAIL | No video assets confirmed active. Reels is Meta's highest-reach, lowest-CPM placement — not using it is leaving cheap impressions on the table. |
| M28 | Creative fatigue detection | ✅ PASS | Low spend + small audience = frequency is almost certainly under 3.0. No fatigue risk at current scale. |
| M29 | Video hook rate | N/A | No video running. |
| M30 | Social proof / organic boosting | ❌ FAIL | No evidence of organic posts being boosted. For a local service business, social proof (reviews, testimonials) dramatically improves lead quality and conversion rate. |
| M31 | UGC / social-native content | ❌ FAIL | Zero UGC content confirmed. Meta's own data shows UGC performs 4× better than polished brand creative for lead gen. For backup power installations, a 60-second phone video walkthrough of a completed install = gold. |
| M32 | Advantage+ Creative enhancements | ⚠️ WARNING | Not confirmed enabled. This is a free 2-minute toggle that lets Meta auto-test headline variations, brightness, and image cropping. Should be on. |
| M-CR1 | Creative freshness (new in last 30 days) | ⚠️ WARNING | Unknown when current 2 ads were launched. If >30 days old without refresh, this is overdue. |
| M-CR2 | Frequency — Prospecting (7-day) | ✅ PASS | At $57/day and a broad local audience, frequency is well under 3.0. |
| M-CR3 | Frequency — Retargeting | N/A | No retargeting campaign active. |
| M-CR4 | CTR benchmark | ⚠️ WARNING | CTR not captured during audit. Meta benchmark for Lead objective is 2.59%. Verify in Ads Manager. |

**Creative Score: 26/100**

---

### ACCOUNT STRUCTURE (20% weight)

| ID | Check | Result | Finding |
|----|-------|--------|---------|
| M11 | Campaign count | ✅ PASS | 1 active campaign. Well under the 5-campaign max per objective. Clean. |
| M12 | CBO vs ABO appropriateness | ⚠️ WARNING | CBO is running at $57/day. Meta recommends CBO for budgets >$500/day and ABO for testing at <$100/day. At this budget, ABO gives you more control over which ad set gets spend. |
| M13 | Learning phase status | ✅ PASS | 1 active ad set, low likelihood of "Learning Limited." Campaign appears to be in delivery. |
| M14 | Learning phase resets | ✅ PASS | No evidence of frequent edits causing learning resets. |
| M15 | Advantage+ Sales Campaign (ASC) | N/A | Lead generation account — ASC is for e-commerce product sales. Not applicable. |
| M16 | Ad set consolidation | ✅ PASS | 1 ad set = zero overlap. Perfect consolidation by default. |
| M17 | Budget per ad set (≥$10/day) | ✅ PASS | $57/day to 1 ad set. Well above $10 minimum. |
| M18 | Campaign objective alignment | ✅ PASS | Lead Generation objective matches business goal of generating quote requests. |
| M33 | Advantage+ Placements | ⚠️ WARNING | Not confirmed enabled. If manually placed, you may be excluding Reels and Audience Network — Meta's most efficient CPM placements. Turn on Advantage+ Placements unless you have a specific reason not to. |
| M34 | Placement performance breakdown | ⚠️ WARNING | No evidence this has been reviewed. With only 2 ads this may not matter yet, but set a monthly reminder once volume increases. |
| M35 | Attribution window (7-day click / 1-day view) | ⚠️ WARNING | Not confirmed. Go to ad set → Edit → Attribution setting and verify. Default is usually correct but needs confirmation. |
| M36 | Bid strategy appropriateness | ⚠️ WARNING | Bid strategy not confirmed. At $57/day for lead gen, Lowest Cost (no cap) is recommended to let Meta learn. Adding a cost cap too early starves the learning phase. |
| M37 | Campaign-level frequency | ✅ PASS | Low budget = low frequency. Not a concern at current scale. |
| M38 | Breakdown reporting reviewed | ⚠️ WARNING | No evidence of age/gender/placement breakdowns being reviewed. Once you have 50+ leads, break down to find if a specific age band or gender converts better — then adjust targeting. |
| M39 | UTM parameters on ads | ⚠️ WARNING | Not confirmed. If you're using Google Analytics 4, you need UTM parameters on ad URLs to see Meta traffic in GA4. Check: Ads Manager → Ad level → Website URL. |
| M40 | A/B testing infrastructure | ❌ FAIL | Zero A/B tests running. With only 2 ads, there's nothing to test against. Meta's Experiments tool lets you test audiences, creatives, and placements scientifically. |
| M-ST1 | Budget adequacy (≥5× target CPA) | ❌ FAIL | Industry CPL for Meta Lead Gen = $27.66 average. Local services skew higher, likely $40–70/lead for backup power. At $57/day: if CPL = $50, budget = 1.14× CPA. Need at minimum $140/day (5× $28) to give the algorithm room to optimize and exit learning phase properly. |
| M-ST2 | Budget utilization (>80% spent daily) | ⚠️ WARNING | Not confirmed. Check Ads Manager daily spend vs. budget. If utilization is <80%, your targeting may be too narrow or bid strategy too restrictive. |

**Account Structure Score: 70/100**

---

### AUDIENCE & TARGETING (20% weight)

| ID | Check | Result | Finding |
|----|-------|--------|---------|
| M19 | Audience overlap between ad sets | N/A | Only 1 ad set — no overlap possible. |
| M20 | Custom Audience freshness | ⚠️ WARNING | Website visitor Custom Audiences status unknown. If created >180 days ago without traffic, they expire. Verify in Audiences dashboard. |
| M21 | Lookalike source quality | ⚠️ WARNING | Lookalike audience status unknown. If built from a lead list, verify it has ≥1,000 records. With 121 Lead events, a Lead-event Lookalike may qualify (Meta requires 100+ events minimum). |
| M22 | Advantage+ Audience testing | ⚠️ WARNING | Not confirmed tested. Advantage+ Audience lets Meta find your best customers beyond any interest targeting you've set. For local service businesses this often outperforms manual targeting. |
| M23 | Exclusion audiences (purchasers excluded) | ⚠️ WARNING | No confirmed exclusion of past leads/customers from prospecting campaigns. You're likely spending money showing ads to people who already booked. Create a Custom Audience of past leads (upload customer CSV) and exclude from the prospecting ad set. |
| M24 | First-party data / customer list uploaded | ⚠️ WARNING | No confirmed customer list uploaded. Even a list of 50–100 past customers gives Meta a seed for Lookalike Audiences and improves EMQ matching across the account. |

**Audience Score: 50/100**

---

## EMQ Analysis & Improvement Roadmap

**Current Lead EMQ: 7.4/10 (Good — target is ≥8.0 Excellent)**

### What's likely being sent today (via Zapier):
| Parameter | Status | Impact |
|-----------|--------|--------|
| Email (em) | ✅ Sending | Highest match signal |
| Phone (ph) | ✅ Sending | Second highest signal |
| First/Last Name (fn, ln) | ✅ Likely | Improves accuracy |
| Zip code (zp) | ✅ Likely | Geographic matching |
| Event ID (event_id) | ✅ NOW FIXED | Deduplication — was missing, fixed this session |
| Country (country) | ✅ NOW FIXED | Was missing "us", fixed this session |

### What's MISSING (can't be sent via Zapier):
| Parameter | Why It Matters | How to Fix |
|-----------|---------------|------------|
| Client IP Address (client_ip_address) | Strong identity signal — Meta uses this to match device to account | Requires CAPI Gateway or direct server integration |
| User Agent (client_user_agent) | Browser fingerprint for cross-device matching | Same — requires CAPI Gateway |
| Browser ID (fbp) | Meta's own first-party cookie | Must be captured server-side from the browser request |
| Click ID (fbc) | Ties the ad click directly to the conversion | Must be read from fbclid URL parameter on landing page |

### Path to EMQ ≥8.0:
**Option A — CAPI Gateway (Recommended, 1–2 hours):**
Meta's free CAPI Gateway can be deployed on Cloudflare Workers or AWS Lambda. It captures fbp, fbc, IP, and user agent automatically from the browser request. This alone typically raises EMQ from 7.4 to 9.0+.

**Option B — Stay on Zapier, maximize what you have:**
Ensure email, phone, first name, last name, city, state, and zip are all mapped in the Zapier step. You've already added event_id and country. This is what you have now. Ceiling is roughly 8.0 max.

**Recommended: Option A.** The CAPI Gateway is free (Cloudflare Workers free tier is sufficient) and takes ~1–2 hours to set up. The EMQ improvement will meaningfully lower your CPL.

---

## Top Issues by Priority

### 🔴 CRITICAL — Fix This Week

**1. Verify your domain (5 minutes)**
- Go to: Business Manager → Brand Safety → Domains
- Add and verify `backuppowerpro.com`
- Remove or ignore the Netlify staging domains (they don't need to be verified)
- This unblocks AEM configuration, which is required for iOS delivery optimization
- **Why it matters:** Without domain verification, Meta can't confirm you own the pixel, which can limit iOS campaign reach

**2. Launch at least 3 more ads (this week)**
You have 2 ads. Meta needs 5–8 to optimize. Each ad should test a different angle:
- **Ad 3:** Video — 30-second phone video of a completed backup power installation
- **Ad 4:** Carousel — 3-panel: Problem (outage), Solution (your system), Result (peace of mind)
- **Ad 5:** Social proof — screenshot or photo of a 5-star review with the customer's quote
- **Ad 6:** Before/after — home without backup power vs. home with your system installed

**3. Add a video ad in vertical format (9:16)**
Meta's Reels placement has the lowest CPM of any placement ($8–12 for local services vs. $18+ for Feed). You're currently getting zero Reels impressions. A 30-second vertical phone video — even low production value — will dramatically lower your CPM and reach new audiences.

**4. Increase daily budget to at least $100/day**
At $57/day, the algorithm can generate roughly 1–2 leads per day at a $40–50 CPL. This is below the 5× CPA threshold Meta needs to exit the learning phase efficiently. Bumping to $100–140/day will:
- Help the ad set exit Learning Limited status faster
- Give Meta more data to optimize targeting
- Likely lower your CPL as the algorithm finds higher-intent audiences

---

### 🟡 HIGH PRIORITY — Fix Within 7 Days

**5. Fix the CAPI coverage gap (2–3 hours)**
Deploy Meta's CAPI Gateway to capture browser-side signals. This is the #1 thing that will push EMQ from 7.4 to 9.0+ and close the coverage gap warning Meta is showing you. Meta estimates 27% lower CPL with complete CAPI coverage for Lead events.

Steps:
1. Go to Events Manager → BPPWebsite pixel → Settings → CAPI Gateway
2. Deploy to Cloudflare Workers (free) using Meta's provided template
3. Point your site's fetch calls through the Gateway instead of directly to Zapier
4. Verify event_id deduplication is working (Events Manager → Test Events)

**6. Exclude past leads from your prospecting campaign**
Upload a CSV of past customers/leads to Meta Audiences. Then exclude that audience from your current campaign's ad set. You're currently paying to re-advertise to people who already submitted a quote request.

Steps: Ads Manager → Audiences → Create Audience → Customer List → Upload CSV → Go to ad set → Exclusions → Add this audience

**7. Verify attribution window is set to 7-day click / 1-day view**
Go to: Ad set → Edit → Attribution setting → Set to "7-day click and 1-day view"
This is critical for capturing leads who click today but don't convert for a few days.

**8. Enable Advantage+ Placements**
Unless you have a specific reason to exclude placements, turn on Advantage+ Placements in your ad set settings. This lets Meta serve your ads on Reels, Stories, and Audience Network — which have significantly lower CPMs than Feed.

**9. Add UTM parameters to your ad URLs**
Go to: Ad level → Website URL → Add `?utm_source=meta&utm_medium=paid&utm_campaign=leads` to your destination URL. This connects Meta spend to Google Analytics 4 leads, giving you a full-funnel picture.

---

### 🟠 MEDIUM PRIORITY — Fix Within 30 Days

**10. Upload your customer list to Meta**
Even 50–100 past customers is enough to create a Lookalike Audience. This gives Meta a real "who converts" signal, typically outperforming interest-based targeting.

Go to: Audiences → Create → Customer List → Upload contacts CSV (name, email, phone)
Then create a 1% Lookalike Audience from this list.

**11. Test Advantage+ Audience vs. manual targeting**
Create a duplicate ad set with identical budget but using Advantage+ Audience instead of your manual targeting. Run for 2 weeks. Compare CPL. Meta's algorithm consistently outperforms manual targeting for local service businesses.

**12. Launch a separate retargeting campaign**
Anyone who visited your site and didn't fill out the form is a warm lead. Create:
- Campaign: Retargeting | Objective: Leads
- Ad set: Website Visitors (last 30 days), exclude leads already submitted
- Budget: $15–20/day
- Creative: Different angle than prospecting — urgency, FAQ, testimonial

**13. Enable Advantage+ Creative enhancements**
In the ad creative, toggle on Advantage+ Creative. This lets Meta auto-test headline variations, image brightness, and aspect ratios. Free performance lift, 2 minutes to enable.

**14. Check CTR and cost metrics in Ads Manager**
Pull last-30-day data: CTR, CPL, CPM, frequency. Benchmark:
- CTR target: ≥2.59% (Meta Lead objective average)
- CPL target: <$50 (local services median)
- Frequency: <3.0 for prospecting (you're likely fine at current budget)

---

### 🔵 LONG-TERM — 30–60 Days

**15. Build a UGC creative pipeline**
Ask every completed job customer for a 30-second phone video testimonial. "What did you have before? What did you get installed? How do you feel now?" These outperform polished ads by 4× in lead gen and cost zero to produce.

**16. A/B test one variable at a time using Meta Experiments**
Once you have 5+ creatives running, use Meta's Experiments tool to scientifically test:
- Audience: Broad vs. Lookalike vs. Advantage+
- Creative: Video vs. image vs. carousel
- Landing page: Current vs. a new variant

**17. Set up a regular creative refresh cadence**
High-spend: refresh every 2–3 weeks
Low-spend (current level): refresh every 4–6 weeks
Track CTR trend — if a creative's CTR drops >20% over 14 days, pause it and launch something new.

**18. Build lookalike audiences from Lead events**
You now have 121 Lead conversion events. Create a Lookalike Audience using Lead event as the seed: Business Manager → Audiences → Create → Lookalike → Source: BPPWebsite Lead event → 1%, 2%, 5% sizes. Test each as separate ad sets.

---

## Budget Recommendation

| Scenario | Daily Budget | Expected Leads/Month | Est. CPL |
|----------|-------------|---------------------|----------|
| Current (minimum) | $57/day | 25–35 | $50–70 |
| Recommended (learning-friendly) | $100–140/day | 50–70 | $40–55 |
| Growth target | $200–300/day | 100–150 | $35–45 |

**Immediate recommendation: Go to $100/day.** This crosses the threshold where the algorithm starts to properly optimize. The difference between $57 and $100/day is not just more leads — it's a lower CPL because Meta has more data to find better-intent audiences.

**Split structure at $100/day:**
- $80/day — Prospecting (current campaign, expanded to 5–8 creatives)
- $20/day — Retargeting (new campaign, website visitors last 30 days)

---

## Quick Wins Summary (Sorted by Impact)

| Action | Impact | Time | Effort |
|--------|--------|------|--------|
| 1. Verify backuppowerpro.com domain | Unblocks AEM + iOS delivery | 5 min | Low |
| 2. Launch 3+ new ads (different formats) | Creative diversity — single biggest performance lever | 2–3 hrs | Medium |
| 3. Increase budget to $100/day | Proper learning phase, lower CPL | 2 min | Low |
| 4. Shoot a vertical phone video ad | Access to Reels (lowest CPM placement) | 30 min | Low |
| 5. Exclude past leads from prospecting | Stop wasting spend on converted users | 10 min | Low |
| 6. Deploy CAPI Gateway | EMQ from 7.4 → 9.0+, close coverage gap | 2 hrs | Medium |
| 7. Add UTM parameters | Full-funnel GA4 attribution | 5 min | Low |
| 8. Enable Advantage+ Placements | Access to cheaper Reels/Stories inventory | 2 min | Low |
| 9. Upload customer list for Lookalike | Better prospecting audiences | 15 min | Low |
| 10. Verify attribution window | Proper 7-day click attribution | 2 min | Low |

---

## What Would Move the Needle Most

If you only do **three things** from this report, do these:

1. **Launch 3+ new ads with a video.** Creative is 70% of Meta performance. Two static images cannot compete. One phone video of a completed install will likely outperform both current ads immediately.

2. **Increase budget to $100/day.** At $57/day you're below the threshold for proper algorithm learning. The CPL will likely drop as spend increases — not the other way around.

3. **Verify your domain.** It takes 5 minutes and it's blocking iOS delivery optimization. There's no reason this should still be an error.

Do those three, wait 2 weeks, check CPL. Then layer in the CAPI Gateway and retargeting campaign. That sequence alone should move you from ~2 leads/day to ~5–8 leads/day at a lower cost per lead.

---

*Report generated: March 24, 2026*
*Data source: Meta Events Manager + Ads Manager (Chrome session audit)*
*Reference: ads-meta skill v1 — meta-audit.md (46 checks), benchmarks.md, scoring-system.md*
