# Backup Power Pro — Master Brain
**Last updated**: April 6, 2026
**Maintained by**: Claude (AI agent) — updated every session when something changes
**Purpose**: This file is the single source of truth for any AI agent working on BPP. Read this first. Always update this last.

---

## 📥 PENDING UPDATES — Process on next Claude Code session

*This section is the handoff zone. Claude.ai and other AI tools drop updates here. Claude Code reads this on startup, applies all changes to the relevant sections, commits, pushes, then clears this section.*

**How Claude.ai should format updates:**
```
### UPDATE — [date] — [brief title]
**Changed**: [what was built, decided, or changed]
**Section to update**: [which section of BPP_BRAIN.md needs updating]
**New content**: [exact text to add or replace]
**Files affected**: [any files that were discussed or changed]
```

*— No pending updates —*

---

## ⚠️ CRITICAL RULES FOR ANY AI READING THIS

### DO NOT TOUCH — EVER
- `CNAME` — controls the domain. Touch this and the site goes down.
- `.gitignore` — only add exceptions (like `!ads/creative/*.jpg`). Never remove existing rules.
- `supabase/functions/.env` — contains live API keys. Never commit this to git.
- `/Users/keygoodson/.claude/credentials.md` — master credentials file. Never expose, log, or transmit its contents.
- `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — never hardcode in any frontend file.
- Any file in `daily/` — these are auto-generated reports with random tokens. Never modify manually.
- `meta-customer-list.csv` / `meta-customer-list.xlsx` — contains real customer PII. Never commit, never transmit.

### DO NOT MOVE — EVER
- `ads/creative/` — image files here have public URLs (backuppowerpro.com/ads/creative/[filename]). Moving breaks links.
- `img/`, `assets/` — referenced throughout HTML files by relative path.
- `supabase/functions/` — each subfolder is a deployed Supabase edge function. Moving breaks deployment.
- `.agents/` — all reference paths are hardcoded in scheduled tasks and SKILL.md files.

### HOW TO UPDATE THIS BRAIN
**Every time you make a meaningful change, add an entry to the "Change Log" section at the bottom.**
Format: `- [DATE] [WHAT YOU CHANGED] — [WHY]`
Also update the relevant section in this file if the change affects ongoing operations.
Never delete old log entries. The log builds over time.

---

## WHO IS KEY

**Key Goodson** — owner, licensed SC electrician, solo operator transitioning to CEO.
- Does all installs himself currently (~5/week ceiling solo)
- Goal: hire licensed electrical subcontractors to break past that ceiling
- Handles: marketing approvals, customer-facing roles, final decisions
- Does NOT handle: daily ad management, report generation, follow-up automation, code — that's Claude
- Personal cell: +19414417996
- Business phone (Quo): (864) 400-5302 → sends/receives all customer SMS

**Key's working style:**
- Prefers bullet points and clear actions over long explanations
- When Claude needs Key to do something in a UI: open Chrome to the exact page first, THEN tell him what to click
- Approves new ad creative and GBP posts before they go live
- Reviews morning HTML briefing daily
- Replies to briefing SMS with commands (e.g. "post gbp", "pause ad X")

---

## THE `.claude` FOLDER — HOW TO USE IT

The `.claude` folder lives at `/Users/keygoodson/.claude/` on Key's Mac. It is the Claude Code system folder — it controls how Claude Code behaves, what skills it has, what tasks run automatically, and where conversation memory lives. **This folder is NOT part of the repo and is never pushed to GitHub.**

### ⚠️ What NOT to touch in `.claude`
- **`credentials.md`** — master API keys file. Read it, never modify it, never expose its contents in logs or output.
- **`settings.json` / `settings.local.json`** — Claude Code configuration. Don't modify unless you know exactly what you're doing.
- **`projects/`** — conversation history and auto-memory. Never delete anything here.
- **`backups/`** — auto-generated config backups. Leave alone.
- **`agents/`** — sub-agent definitions used by GSD and audit skills. Leave alone unless you're specifically updating an agent.

---

### `credentials.md` — The Keys to Everything
**Path**: `/Users/keygoodson/.claude/credentials.md`
**What's in it**: Every API token, secret key, and password used across the entire BPP system.

| Service | What's stored |
|---------|--------------|
| Gemini API (Nano Banana) | API key for image generation |
| Quo (OpenPhone) | API key, phone number IDs, user ID |
| PostHog | Personal API key, project ID |
| Found Bank | Accountant login email + password (read-only) |
| Meta Marketing API | System User token (never-expiring) |
| Google Maps / Places | API key (restricted to backuppowerpro.com) |
| Google Street View | API key (CRM avatars) |
| Stripe | Secret key (live mode) |

**Rule**: Read this file at the start of any session that involves API calls. Never copy its contents into any file that gets committed to git.

---

### `skills/` — Specialized Capabilities
**Path**: `/Users/keygoodson/.claude/skills/`
Skills are callable modules that give Claude specific capabilities. Invoke them with `/skill-name` in the chat.

**BPP-relevant skills:**

| Skill folder | How to invoke | What it does |
|-------------|--------------|-------------|
| `nano-banana/` | `/nano-banana` | Image generation via Gemini API. **ALWAYS read `SKILL.md` and `bpp-brand.json` before generating any BPP image.** Strict rules on model name, resolution, aspect ratio, prompt format. |
| `ads-meta/` | `/ads-meta` | Full 46-check Meta Ads audit. Run monthly or after major account changes. |
| `ads/` | `/ads` | Multi-platform ad audit. |
| `ads-plan/` | `/ads-plan` | Strategic ad planning. |

**How skills work**: Each skill has a `SKILL.md` file with exact instructions. When invoked, Claude reads that file and follows the process. Never skip reading the SKILL.md — the instructions are specific and missing them produces bad output.

**Key rule for nano-banana specifically**: The model name is `gemini-3.1-flash-image-preview`. Not 2.0, not 2.5. The imageConfig must include `imageSize: "4K"` and `aspectRatio`. Use `responseModalities: ["TEXT", "IMAGE"]`. Draft at 1K ($0.04), upscale to 4K ($0.15) when ready.

---

### `scheduled-tasks/` — Automated Jobs
**Path**: `/Users/keygoodson/.claude/scheduled-tasks/`
Each subfolder is an automated task with its own `SKILL.md` containing full instructions.

| Task | Schedule | Purpose |
|------|----------|---------|
| `bpp-daily-morning-report/` | 8:30 AM daily | Pulls Meta Ads, PostHog, Supabase data → generates HTML briefing → pushes to GitHub → texts Key the link |
| `bpp-gbp-post-writer/` | Tuesdays 7:00 AM | Writes next Google Business Profile post draft → saves to `.agents/gbp-posts/pending.md` → shown in morning brief for approval |
| `bpp-sms-command-handler/` | On trigger | Handles SMS commands from Key |
| `bpp-4k-image-upscale/` | One-time Apr 6 2 AM | Upscales 3 ad creative images from 1K to 4K |

**How to update a scheduled task**: Edit its `SKILL.md` file. Changes take effect on the next run. Always read the current SKILL.md before modifying so you don't break existing logic.

**How to create a new scheduled task**: Use `mcp__scheduled-tasks__create_scheduled_task` tool with a `taskId`, `prompt`, `description`, and either `cronExpression` (recurring) or `fireAt` (one-time).

---

### `projects/` — Conversation Memory
**Path**: `/Users/keygoodson/.claude/projects/-Users-keygoodson-Desktop-CLAUDE/`

| What | Where |
|------|-------|
| **Auto-memory** (persists across sessions) | `memory/MEMORY.md` — Claude Code reads this automatically every session. Update it when account state changes (new CPL numbers, new campaigns, resolved blockers, etc.) |
| **Conversation history** | `.jsonl` files — one per conversation. Don't touch. |
| **Tool outputs** | `tool-results/` — cached outputs from large bash commands. Don't touch. |

**MEMORY.md vs BPP_BRAIN.md**:
- `MEMORY.md` = Claude Code's internal session notes. Terse, technical, credential-adjacent. Auto-loaded by Claude Code.
- `BPP_BRAIN.md` = The shareable master brain. Full context, human-readable, safe to share with other AIs. Lives in the repo.
- When something important changes, update BOTH.

---

### How a new AI should orient itself using `.claude`

1. **Read** `/Users/keygoodson/Desktop/CLAUDE/CLAUDE.md` — entry point with startup checklist
2. **Read** `/Users/keygoodson/Desktop/CLAUDE/BPP_BRAIN.md` — full business context + change log
3. **Read** `/Users/keygoodson/.claude/projects/-Users-keygoodson-Desktop-CLAUDE/memory/MEMORY.md` — current session state
4. **Read** `/Users/keygoodson/.claude/credentials.md` — when you need to make API calls
5. **Before generating images** → read `/Users/keygoodson/.claude/skills/nano-banana/SKILL.md` and `bpp-brand.json`
6. **Before Meta Ads audit** → invoke `/ads-meta` skill
7. **Before touching a scheduled task** → read its `SKILL.md` first

---

## THE BUSINESS

**Company**: Backup Power Pro (legal entity: Key Electric LLC)
**License**: SC electrical contractor license (SC LLR)
**Service area**: Greenville, Spartanburg, Pickens counties — NO Anderson County
**Website**: backuppowerpro.com (GitHub Pages, domain on IONOS)
**Repo**: `/Users/keygoodson/Desktop/CLAUDE` → pushed to GitHub → auto-served by GitHub Pages

### The Offer
**Name**: "The Storm-Ready Connection System"
**One sentence**: We help Upstate SC homeowners who already own a portable generator get code-compliant, panel-powered backup electricity in one day — without spending $15,000 on a standby generator.

**Price**: $1,197–$1,497 all in (cord + inlet box + permit + inspection + labor + cleanup)
**Price anchor**: Always mention $15,000 standby cost BEFORE BPP's price
**Sunk cost angle**: Customer already owns the generator. We UNLOCK their investment, not sell something new.
**Scarcity**: 5 installs/week max (real, not manufactured)
**Guarantee**: Price-lock + satisfaction + workmanship. No surprises.
**Afterpay**: Available on Dubsado invoice. Use as a CLOSER, not in ads.

### The North Star Number
**Goal**: $150,000 accumulated spendable profit in Found business bank account
**Purpose**: Lump-sum payoff of Key's home mortgage
**Draw**: $3,000/month ongoing personal draw (separate from the $150k)
**Timeline**: September–October 2026 (aggressive/conservative)
**Monthly net targets**:
- Solo phase: $21,600/mo after draw
- +1 sub: $42,200/mo after draw
- +2 subs: $67,500/mo after draw

### Financial Baseline (Found Bank, April 2026)
| Month | Revenue | Found Net | After $3k Draw |
|-------|---------|-----------|----------------|
| Jan 2026 | $1,972 | -$529 | -$3,529 |
| Feb 2026 | $2,246 | +$1,395 | -$1,605 |
| Mar 2026 | $5,795 | -$2,125* | -$5,125 |
| Apr 2026 | Partial | — | — |
*March includes one-time $5,000 van repair. Normalized = ~+$2,865 before draw.

---

## THE TECH STACK

### Website
- **Framework**: Plain HTML/CSS/JS — no build tools, no frameworks
- **Hosting**: GitHub Pages (auto-deploys on `git push` to main)
- **Domain**: backuppowerpro.com (managed on IONOS, pointed at GitHub Pages via CNAME)
- **Deploy command**: `git add [files] && git commit -m "message" && git push`
- **Never use Netlify** — site is on GitHub Pages

**Key pages:**
| File | URL | Purpose |
|------|-----|---------|
| `index.html` | backuppowerpro.com | Main landing page |
| `get-quote.html` | /get-quote | Lead capture form (3-step) |
| `guide.html` | /guide | PDF download page |
| `invoice.html` | /invoice.html?token=X | Customer invoice + Stripe payment |
| `proposal.html` | /proposal.html?token=X&preview=1 | Sales proposal |

### Database — Supabase
- **Project URL**: https://reowtzedjflwmlptupbk.supabase.co
- **Anon key** (safe for frontend): `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlb3d0emVkamZsd21scHR1cGJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NzExMDYsImV4cCI6MjA5MDI0NzEwNn0.srmz3lm08HW7MRGIRA8zAgglTcSrjBwxJ7LDYsEwveE`
- **Service role key**: In `/Users/keygoodson/.claude/credentials.md` — NEVER in frontend

**Tables:**
| Table | Purpose |
|-------|---------|
| `contacts` | All leads/customers. Statuses: New Lead → Contacted → Quote Sent → Booked → Installed → Lost |
| `messages` | Full SMS history (inbound + outbound) |
| `follow_up_queue` | Scheduled follow-up texts |
| `bpp_commands` | Command queue for SMS-triggered actions from Key |
| `invoices` | Stripe invoices with payment status and tokens |

### Edge Functions (Supabase)
All live at `https://reowtzedjflwmlptupbk.supabase.co/functions/v1/`

| Function | Trigger | Purpose |
|----------|---------|---------|
| `quo-ai-new-lead` | Quote form submit | Creates CRM contact, fires Meta CAPI, sends AI first text, notifies Key, queues follow-up |
| `quo-ai-webhook` | Quo inbound SMS | Handles all incoming customer texts via AI |
| `quo-ai-followup` | Scheduled | Sends follow-up sequence texts |
| `quo-ai-review` | Manual (CRM button) | AI reviews conversation and suggests next step |
| `quo-ai-storm` | Manual | Storm-triggered outreach |
| `create-checkout-session` | Invoice page | Creates Stripe checkout session (ACH + card) |
| `stripe-webhook` | Stripe | Marks invoice paid in Supabase on payment |

### Messaging — Quo (formerly OpenPhone)
- **Customer-facing number**: (864) 400-5302 → phoneNumberId: `PNTZHfvSsh`
- **Key's notification number**: (864) 863-7155 → phoneNumberId: `PNPhgKi0ua`
- **API key**: In `/Users/keygoodson/.claude/credentials.md`
- **Auth header**: `Authorization: [api_key]` (no "Bearer" prefix)

### Payments — Stripe
- **Mode**: Live
- **Invoice flow**: `invoice.html` → `create-checkout-session` edge function → Stripe embedded checkout
- **Payment methods**: ACH bank transfer (primary, shown first, no fee cap) + card (secondary)
- **ACH saves**: ~$34/job vs card at current volume
- **Public key**: `pk_live_51TGXWMGRrrWRVQEdk3Huz3nEHfTx0Kr9nj2gLfpEVjaDsKL5dQbFg7f92qac6ylXsmCxaEGJLWwWMIajFL3yLDqA00FCvkgGNI`
- **Secret key**: In `/Users/keygoodson/.claude/credentials.md`

### Meta Ads
- **Ad Account**: act_923542753352966
- **Pixel ID**: 1389648775800936
- **API**: Graph API v21.0 — `https://graph.facebook.com/v21.0/`
- **System User Token**: In `/Users/keygoodson/.claude/credentials.md` (never-expiring)
- **CAPI**: Live — fires server-side on every quote form submission via `quo-ai-new-lead`

**Active campaigns (April 2026):**
| Campaign | ID | Budget | Status | Notes |
|----------|----|--------|--------|-------|
| BPP — Prospecting — Advantage+ | 120244404792360067 | $40/day | ACTIVE | Main campaign. Blue Shirt Siding + Claude Ad Image 1 |
| BPP — Manual Targeting — Legacy | 120245210019950067 | ~$20/day | ACTIVE | Blue Shirt Siding only. Carousels paused. |
| BPP — Retargeting | 120245860575140067 | $15/day | PAUSED | Activate when website visitors audience > 500 |
| Prospecting (old) | 120243505974580067 | — | PAUSED | Superseded |

**CPL baselines**: Blue Shirt Siding $11.20 | Claude Ad Image 1 $13.58 | Target < $30
**Geography**: Greenville + Spartanburg + Pickens counties. NO Anderson County.

### Image Generation — Nano Banana 2
- **Model**: `gemini-3.1-flash-image-preview` (NOT 2.0, NOT 2.5)
- **API**: Direct REST to `generativelanguage.googleapis.com`
- **Cost**: 1K draft ~$0.04 | 4K final ~$0.15
- **Aspect ratio**: Always specify. Default square is wrong for ads. 4:5 for feed ads.
- **SKILL file**: `/Users/keygoodson/.claude/skills/nano-banana/SKILL.md` — READ BEFORE GENERATING
- **Brand colors**: Navy #0b1f3b | Gold #ffba00 (flat, never metallic) | Red #dc2626
- **Credentials**: In `/Users/keygoodson/.claude/credentials.md`

### Analytics — PostHog
- **Project ID**: 356571
- **Personal API key**: In `/Users/keygoodson/.claude/credentials.md`
- **Used for**: Daily brief website stats (pageviews, CVR, traffic source)

### Found Bank
- **Purpose**: Business bank account — source of truth for P&L
- **Access**: Accountant login via `claudeagentbpp@gmail.com` (read-only)
- **Credentials**: In `/Users/keygoodson/.claude/credentials.md`

---

## AUTOMATED SYSTEMS

### Daily Morning Report
- **Task**: `bpp-daily-morning-report`
- **Schedule**: 8:30 AM daily
- **SKILL file**: `/Users/keygoodson/.claude/scheduled-tasks/bpp-daily-morning-report/SKILL.md`
- **Output**: HTML report pushed to `daily/[random-token].html` on GitHub Pages → private URL texted to Key
- **Sections**: Meta Ads snapshot | Website stats | Leads pipeline | Quo inbox | Key must-do UI actions | Pending ad creative approval | Pending GBP post approval | Claude's action list | Week goal tracker | $150k financial pulse

### GBP Post Writer
- **Task**: `bpp-gbp-post-writer`
- **Schedule**: Every Tuesday 7:00 AM (before the 8:30 brief)
- **SKILL file**: `/Users/keygoodson/.claude/scheduled-tasks/bpp-gbp-post-writer/SKILL.md`
- **Output**: Draft post saved to `.agents/gbp-posts/pending.md`
- **Approval flow**: Draft shown in morning brief → Key replies "post gbp" → Claude opens Google Business Profile in Chrome → Key pastes and clicks

### 4K Image Upscaler
- **Task**: `bpp-4k-image-upscale` (one-time, April 6 2:00 AM)
- **Purpose**: Upscale 3 ad creatives from 1K draft to 4K final
- **Output**: `ads/creative/storm-4k.jpg`, `inlet-box-4k.jpg`, `before-after-4k.jpg`

### SMS Command Handler
- **Task**: `bpp-sms-command-handler`
- **Purpose**: Handles commands Key texts to trigger Claude actions

### Lead Flow (Quote Form → CRM)
1. Customer submits `get-quote.html`
2. Browser fires Meta Pixel `Lead` event (with eventId)
3. Form POSTs to `quo-ai-new-lead` edge function
4. Edge function: creates Supabase contact → fires CAPI (server-side Lead event, same eventId for dedup) → creates Quo contact → sends AI first text → notifies Key → queues 24hr follow-up
5. Zapier is a silent fallback only (edge function handles everything now)

---

## PENDING ITEMS / KNOWN STATE

### New Ad Creative (April 2026)
Three images in `ads/creative/` awaiting Key's approval before uploading to Ads Manager:
- `storm-neighborhood-1k.jpg` — dark SC neighborhood, one lit house (4K being generated)
- `inlet-box-brick-1k.jpg` — clean professional inlet box on brick (4K being generated)
- `before-after-cord-1k.jpg` — extension cord chaos left, clean setup right (4K being generated)
Ad copy for all 3 is in `.agents/ad-copy-apr2026.md`
**DO NOT upload to Meta without Key's explicit approval.**

### Retargeting Campaign
- Geography fixed (was North Dakota, now SC counties)
- PAUSED — activate when `BPP — Website Visitors 30d` audience exceeds 500 people (currently ~20)
- Check via API: `GET /v21.0/120245860571530067?fields=approximate_count_lower_bound`

### GBP Post
- First draft in `.agents/gbp-posts/pending.md` — awaiting Key's approval
- Post via: open business.google.com in Chrome, navigate to "Add update"

---

## KEY REFERENCE FILES

| File | What it contains |
|------|-----------------|
| `.agents/core-offer.md` | THE definitive offer document. Read before any customer-facing content. |
| `.agents/financial-roadmap.md` | Phase-by-phase plan to $150k with unit economics |
| `.agents/hormozi-playbook.md` | $100M Offers/Leads applied to BPP. Read before writing copy. |
| `.agents/customer-psychology.md` | 10 behavioral frameworks (loss aversion, price anchor, etc.) |
| `.agents/three-conditions-to-close.md` | Sales framework — understand outcome, path, safety |
| `.agents/META-ADS-REPORT.md` | Full Meta account audit (April 2026) |
| `.agents/ad-copy-apr2026.md` | Copy for 4 new ad creatives |
| `.agents/financial-roadmap.md` | Monthly targets toward $150k |
| `.agents/alex-knowledge-base.md` | Deep SC permit/electrical knowledge base |
| `.agents/gbp-posts/pending.md` | Current GBP post draft awaiting approval |
| `/Users/keygoodson/.claude/projects/-Users-keygoodson-Desktop-CLAUDE/memory/MEMORY.md` | Claude Code auto-memory — updated every session |

---

## WHAT CLAUDE OWNS vs WHAT KEY DOES

### Claude owns (handles automatically):
- Daily morning report generation and delivery
- Meta Ads monitoring, budget management, pausing/activating ads via API
- Lead follow-up sequence (AI texts via Quo)
- GBP post drafting (weekly)
- CAPI event firing
- CRM contact creation and status tracking
- Code changes, git commits, deployments

### Key does (UI-only actions):
- Uploading new ad creative images to Meta Ads Manager
- Approving/rejecting ad creative and GBP posts (replies to morning brief)
- Clicking "Replace secret" in Supabase when tokens are updated
- Any action requiring physical presence (installs, assessments)
- Financial transactions

### When an AI needs Key to do a UI action:
1. Open Chrome to the EXACT page (never just give a URL and instructions)
2. Navigate as far as possible
3. Tell Key the minimum required action (one click, one paste)
4. Never just list steps without opening the browser first

---

## CUSTOMER PSYCHOLOGY — ALWAYS APPLY

**Core principle**: People buy emotionally, justify logically.

- **Loss framing**: "What you LOSE by not acting" is 2x more motivating than gain framing
- **Price anchor**: ALWAYS mention $15,000 standby cost BEFORE BPP's $1,197 price
- **Sunk cost**: "You already own the generator" — we unlock their investment
- **Scarcity**: "5 installs per week" — real, honest
- **Local social proof**: "Upstate SC homeowner" beats generic testimonials
- **3 conditions to close**: Outcome ("One cord. Full power. Done in a day.") → Path (3 steps max) → Safety (permit, inspection, price-lock, cleanup)

---

## SCALING VISION

**Current**: Key does all installs, solo, ~5/week ceiling
**Future**: Key handles only marketing + customer-facing roles. Licensed/insured electrical subs do all installations.
**Materials flow**: Key ships interlock kit + inlet box to sub. Sub brings commodity materials.
**Geographic expansion**: SC first → NC license → each new market = new sub + new ad campaigns
**Everything built should work for 1 market OR 10 markets.**

---

## CHANGE LOG
*Every AI agent must add an entry here when making meaningful changes. Newest entries at top.*

- [2026-04-06] Added ACH bank transfer as primary payment option in invoice.html + create-checkout-session edge function. Saves ~$34/job vs card. — Key requested
- [2026-04-06] Routed quote form from Zapier to Supabase edge function (quo-ai-new-lead). CAPI now fires server-side on every lead. Zapier is silent fallback only. Fixed API version v19→v21.
- [2026-04-06] Removed Anderson County from all ad set targeting. Key doesn't service that area.
- [2026-04-05] Created bpp-gbp-post-writer scheduled task (Tuesdays 7 AM). First draft post written. GBP post approval flow wired into morning brief.
- [2026-04-05] Fixed retargeting + lookalike ad set geography (was targeting North Dakota). Both now target Greenville/Spartanburg/Pickens.
- [2026-04-05] Activated Claude Ad Image 1 in Advantage+ campaign. Created Blue Shirt Siding — Advantage+ ad. Both top performers now in CBO Advantage+ campaign. Carousels paused in Legacy campaign.
- [2026-04-05] Renamed campaigns: Campaign 2 → "BPP — Prospecting — Advantage+" | Campaign 1 → "BPP — Manual Targeting — Legacy"
- [2026-04-05] Generated 3 new ad creatives (storm, inlet box, before-after). Committed to ads/creative/. 4K upscales scheduled for 2 AM April 6. Awaiting Key approval before uploading to Meta.
- [2026-04-05] Wrote ad copy for 4 creative concepts in .agents/ad-copy-apr2026.md
- [2026-04-05] Added new creative approval section to daily morning brief HTML
- [2026-04-05] Fixed geography on BPP — Prospecting — Advantage+ ad set (was missing Anderson — now removed from all campaigns)
- [2026-04-05] Meta non-discrimination policy blocker resolved. Key clicked Add button in Business Settings → System Users. All API calls now functional.
- [2026-04-05] Created META-ADS-REPORT.md — full 30-day account audit, health score 58/100
- [2026-04-05] Added financial baseline from Found P&L (Jan–Apr 2026) to financial-roadmap.md
- [2026-04-05] Created software-stack-research.md — build vs buy analysis for BPP tools
