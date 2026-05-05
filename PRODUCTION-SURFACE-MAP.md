# Production Surface Map

**Purpose:** canonical mapping of customer-facing surfaces → repo file paths → what they actually capture/do in production. Built 2026-05-05 after a confused-draft-for-prod incident.

**Update rule:** when you change a customer-facing surface (form, page, button, edge function URL), update the matching row here in the same commit. When you read this doc, also `curl` the live URL to confirm — drift is the enemy.

---

## Customer-facing surfaces (deployed via GitHub Pages → backuppowerpro.com)

### `/` (homepage) — primary lead-capture form
- **Repo file:** `index.html`
- **Live URL:** https://backuppowerpro.com/
- **Form fields captured (verified live 2026-05-05):**
  - `qfName` → text, customer's name (parsed into firstName)
  - `qfPhone` → tel, customer's phone
  - `varGenCheck` → checkbox, "I have a generator", required
- **NOT captured by this form:** `genVoltage`, `panelLocation`, email, address, county, zip
- **Submits to:** `POST https://reowtzedjflwmlptupbk.supabase.co/functions/v1/quo-ai-new-lead`
- **Payload shape sent:** `{ firstName, phone, pageUrl, fbp?, fbc?, eventId? }` plus Meta CAPI hashed-PII fields if available
- **Triggers:** contact create → Meta CAPI Lead → notify Key SMS → bot-engine new_lead → Ashley greeting

### `/get-quote.html` — redirect stub
- **Repo file:** `get-quote.html` (24 lines, meta-refresh + `window.location.replace`)
- **Live behavior:** redirects to `/#getStarted` (the homepage form)
- **NOT a real form** — do not reason about its contents as production data capture

### `website/get-quote.html` — DRAFT, not deployed
- **Status:** unmounted draft with richer fields (panelLocation, genVoltage radios). Safe to reference for future ideas; never assume it represents live capture.

### `/proposal.html`, `/invoice.html`, `/sub/*` — customer-facing post-form surfaces
- Token-gated. Update this section when their fields change.

---

## Internal surfaces

### Ashley conversation pipeline
- **Inbound:** OpenPhone webhook → `alex-agent` (with brain-token + signature verification) → `bot-engine` if `bot_state` set + phone in `ASHLEY_ALLOWED_PHONES`
- **Outbound:** `bot-engine` → `send-sms` → Twilio (or OpenPhone for `ASHLEY_OPENPHONE_TEST_PHONES`)
- **Handoff:** `bot-engine` (terminal state) → `bot-handoff-notifier` → Key's cell at `+19414417996`
- **Cold-lead nudge:** `bot-reengagement` (cron `bot-reengagement-hourly`) → `send-sms`

### CRM
- **Live URL:** https://backuppowerpro.com/crm/crm.html
- **Repo file:** `crm/crm.html` (~14k lines vanilla JS + Supabase)
- **Reads:** `contacts`, `messages`, `proposals`, `invoices`, `installer_tokens` from Supabase via PostgREST + RLS
- **Writes:** mutations via PostgREST + edge functions (`proposal-mutate`, `send-sms`)

### Edge functions (deployed list at https://supabase.com/dashboard/project/reowtzedjflwmlptupbk/functions)
- See `supabase/functions/` for source. All are auth-gated; see CLAUDE.md "Security" section.

---

## Verification checklist before assuming a surface

When you find yourself reasoning about a customer-facing surface:

1. Find the row in this doc.
2. If the row exists, you're grounded — proceed.
3. If the row doesn't exist OR the doc looks stale, `curl` the live URL and verify before continuing.
4. After verifying, update this doc in the same commit so the next session starts grounded.

If a `find` returns 2+ files with the same name (`get-quote.html` x3, `crm.html` x2, etc.), this doc is the tiebreaker. The most-detailed-looking file is NOT necessarily the live one.
