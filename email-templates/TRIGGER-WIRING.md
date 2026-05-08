# Email Trigger Wiring Plan

The `send-email` edge function is the dispatcher. Every template fires from a specific trigger point. This is the runbook for activating the email program one email at a time.

## Activation order (lowest risk first)

Each row is a switch. Flip them in order. Watch deliverability + reply quality after each before flipping the next.

| Order | Template | Trigger | Risk if it misfires |
|-------|----------|---------|---------------------|
| 1 | `welcome` | `quo-ai-new-lead` after Ashley dispatch | Low — confirms an action customer just took |
| 2 | `pdf-download` | New `download-form` edge fn (form-fill on /guides/*) | Low — customer asked for it |
| 3 | `proposal` (or `proposal-30a`/`50a`) | `bot-engine` SCHEDULE_QUOTE → COMPLETE transition, OR Key clicks "Send Quote" in CRM | Medium — first paid-leverage email |
| 4 | `quote-followup-48h` | Cron: contacts with `bot_state=COMPLETE` AND `qualification_data.proposal_sent_at < now() - 48h` AND `signed_at IS NULL` | Medium — could feel chasey |
| 5 | `permit-document` | Key triggers from CRM permit section after generating permit PDF | Medium — action-required |
| 6 | `install-reminder` | Cron: 24h before `contacts.install_date` | High — confirms a scheduled event |
| 7 | `install-arrival` | Key clicks "On my way" in CRM mobile UI | High — real-time |
| 8 | `completion` | Key clicks "Install Complete" in CRM | High — closure email |
| 9 | `invoice` | Triggered alongside `completion` | High — money |
| 10 | `permit-approved` | Cron: when `pipeline_stage=7` (permit approved) is detected | Medium |
| 11 | `review` | Cron: 48h after `completion` (gates on `qualification_data.handoff_terminal_state = COMPLETE`) | Low — soft ask |
| 12 | `referral-nudge` | Cron: 30d after `completion` | Low — opt-out-able |
| 13 | `anniversary` | Cron: 365d after `install_date` | Low — nice-to-have |
| 14 | `storm-prep-reminder` | Cron: June 1 + Nov 1 each year, all closed installs | Low — opt-out-able |

## How each trigger calls send-email

Every trigger looks like this. The contact_id is the source of truth; everything else flows from it.

```typescript
const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
  method: 'POST',
  headers: {
    'x-bpp-brain-token': BPP_BRAIN_TOKEN,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    template: 'proposal-50a',  // or whichever
    contact_id: contact.id,
    subject: `Your install quote, ${contact.install_address?.split(',')[0] || 'BPP'}`,
    variables: {
      // Any per-send vars beyond auto-derived first_name + install_address
      quote_id: `BPP-${new Date().getFullYear()}-${contact.id.slice(0, 4)}`,
      esign_url: `https://backuppowerpro.com/sign/${contact.id}`,
      mail_request_url: '...',  // for permit-document only, see below
    },
    // For permit-document: signed PDF as attachment
    attachments: [
      { filename: 'permit-application.pdf', url: signedPermitPdfUrl }
    ],
  }),
})
```

The function auto-derives:
- `{{first_name}}` from `contacts.name`
- `{{install_address}}` from `contacts.install_address`
- `{{preferences_url}}` to backuppowerpro.com/preferences?cid={id}
- `{{unsubscribe_url}}` to backuppowerpro.com/unsubscribe?cid={id}&t={template}

Plus auto-gates:
- `do_not_contact` → silent skip
- No email on file → silent skip
- Marketing template + `__email_marketing_off` notes marker → silent skip
- Per-template marker (e.g. `__email_seasonal_off`) → silent skip for that template only

## Special cases

### `proposal` (sized variant)
Pick the variant per `contacts.outlet_amps`:
```typescript
const tpl = contact.outlet_amps === 50 ? 'proposal-50a'
  : contact.outlet_amps === 30 ? 'proposal-30a'
  : 'proposal'  // generic fallback
```

### `permit-document`
Mail-request URL must be a signed token (HMAC of contact_id + ts) with 14-day expiry. Generated in send-email (or upstream caller) and passed as `mail_request_url` variable. Reference: `supabase/functions/request-permit-mailing/index.ts` for verification pattern.

### `install-arrival`
The street view image src in the rendered email pulls from `street-view` edge fn. Either:
- Pre-fetch + cache before sending: call street-view edge fn, get signed URL, pass as `street_view_url` variable
- OR render template with placeholder, swap at send-time

Cleanest: send-email calls street-view internally when template needs it.

### `quote-followup-48h`, `review`, `anniversary`, etc. (cron-triggered)
Hosted in a single `email-cron` edge function called hourly by pg_cron. Loops through eligible contacts, fires send-email per each. Per-contact rate limit: at most one email per 24h regardless of template (prevents bug-storm).

## SMS companion pairing

After firing send-email, schedule the SMS companion 30-60s later:
```typescript
// Note: send-sms-companion is brain-token gated, called server-side only
setTimeout(async () => {
  await fetch(`${SUPABASE_URL}/functions/v1/send-sms-companion`, {
    method: 'POST',
    headers: { 'x-bpp-brain-token': BRAIN_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contact_id: contact.id,
      template: 'proposal-sent',  // mapped name from sms-companions.md
      variables: { address_short: '412 Oakmont' },
    }),
  })
}, 45_000)
```

But Deno edge functions don't survive `setTimeout` past response. Instead use:
- `EdgeRuntime.waitUntil(promise)` for fire-and-forget after response
- OR insert a queued job via `pg_cron` / a `scheduled_messages` table
- OR a separate "delayed-sms" edge function called by upstream with a 60s delay arg

Recommended: implement a `scheduled-sms` table + cron drainer. Cleaner than waitUntil hacks.

## DB tables needed

| Table | Status | Why |
|-------|--------|-----|
| `messages_email` | NOT yet created | Logs every send-email send for CRM thread + bounce tracking |
| `scheduled_sms` | NOT yet created | Queue for delayed companion SMS |

Migration sketch:
```sql
CREATE TABLE messages_email (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  template    text NOT NULL,
  subject     text NOT NULL,
  to_email    text NOT NULL,
  provider_id text,
  status      text DEFAULT 'sent',
  error       text,
  sent_at     timestamptz DEFAULT now()
);
CREATE INDEX ON messages_email (contact_id, sent_at DESC);
ALTER TABLE messages_email ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_full ON messages_email FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY service_full ON messages_email FOR ALL TO service_role USING (true) WITH CHECK (true);
```

## Activation checklist (when ready to flip on)

- [ ] `supabase secrets set RESEND_API_KEY=re_...`
- [ ] `supabase secrets set MAIL_REQUEST_SECRET=$(openssl rand -hex 32)` (already noted above)
- [ ] `supabase secrets set GOOGLE_MAPS_API_KEY=...` (street-view personalization)
- [ ] Apply `messages_email` migration
- [ ] Deploy `send-email` (`supabase functions deploy send-email`)
- [ ] Send a test email to your own address with `dry_run: true` first to confirm rendering
- [ ] Flip on order #1 (welcome). Watch for 24h.
- [ ] Flip on order #2 (pdf-download). Watch for 24h.
- [ ] Continue down the list

## Failure modes + fallbacks

- **Resend API down** → 502 returned. Cron retries on next run. No customer impact beyond delay.
- **Template missing in TEMPLATE_MAP** → 404. Caller logs + skips.
- **Customer email bounces** → Resend webhook (TBD: build) fires bounce notification + sets `__email_bounced` notes marker. Future sends silently skip.
- **Rate limit on cron** → max 100 sends per cron run, paginate with cursor.
