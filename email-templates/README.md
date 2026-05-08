# BPP Email Templates

Production-ready email templates for the Backup Power Pro customer journey. All built on the BPP design system tokens (Navy `#0b1f3b`, Gold `#ffba00`, Outfit + Inter typography) and pre-tested for email-client compatibility (Gmail, Apple Mail, Outlook 2007–2019, iOS Mail).

## Template index

| File | Triggered by | Purpose |
|------|--------------|---------|
| `welcome-email.html` | Form submit on backuppowerpro.com | Sets expectations as Ashley's first SMS lands. Trust card + Buyer's Guide CTA. |
| `proposal-email.html` | Key reviews qualified lead | Quote document. Photo of customer's panel + 4-bullet scope + single price + e-sign CTA. |
| `install-reminder-email.html` | 24h before install date | Reduces no-shows. Arrival window, prep checklist, what-you'll-get list, reschedule ghost CTA. |
| `completion-email.html` | Same day as install completion | Closes the loop. 3-tile photo gallery, 4-step usage card, dual CTA (Owner's Manual + Pay Invoice). |
| `invoice-email.html` | End of install day | Pro-feel payment doc. Single big total, line items, bulletproof Stripe CTA, 2-year warranty pill. |
| `review-email.html` | 48h post-install | One CTA, no clutter. Customer's own install photo + Google review button. |
| `pdf-download-email.html` | PDF lead-magnet form fill | Delivers guide + chapter preview + soft "ready for a quote?" link. |
| `permit-approved-email.html` | County inspector signs off | Closes warranty loop. Permit info card, "what this means" 3-bullet, Owner's Manual CTA. |
| `storm-prep-reminder-email.html` | Cron: June 1 + Nov 1 | Drives test-cycle behavior + reactivates dormant customers. 4-step quick test. |
| `anniversary-email.html` | 1 year post-install | Soft maintenance check-in with the customer's original install photo. |
| `referral-nudge-email.html` | 30 days post-install | $100 Visa thank-you + "if a neighbor asks" framing. |

## Design rules (locked)

- **Width**: 600px max, single column, mobile-first
- **From-name**: "Key at Backup Power Pro <key@backuppowerpro.com>" (one sender, real human)
- **Reply-to**: real address Key reads — never `noreply@`
- **Pre-headers**: deliberate, hidden in body, ~90 chars optimized for inbox preview
- **Buttons**: bulletproof table-based pattern (Outlook 2007+ compatible)
- **Tracking pixels**: NONE in transactional (proposal/invoice/install-reminder). OK in marketing/lifecycle (welcome/storm/anniversary/referral) per ESP defaults.
- **Unsubscribe**: marketing only. Transactional gets "manage preferences" only per CAN-SPAM exemption.
- **Address**: BPP physical mailing address required in every footer per CAN-SPAM.

## Template variables

Search every template for `TWEAK:` comments — those mark spots that get per-customer or per-send substitution. Common variables:

```
{{first_name}}             → from contacts.name (split first token)
{{quote_id}}               → BPP-{year}-{contact_id_short}
{{address_full}}           → from contacts.install_address
{{install_date}}           → from contacts.install_date (formatted)
{{arrival_window}}         → e.g. "9:00–11:00 AM"
{{reschedule_url}}         → Cal.com link or text-back URL
{{stripe_checkout_url}}    → Stripe-hosted invoice page
{{owners_manual_url}}      → signed Supabase storage URL
{{google_review_url}}      → BPP Google business profile review link
{{preferences_url}}        → CRM-side email-prefs link
{{unsubscribe_url}}        → CAN-SPAM-mandated for marketing
```

## Sender setup

**Recommended ESP**: Resend (clean API, plays nice with Supabase edge functions, $20/mo for current volume).

```bash
supabase secrets set RESEND_API_KEY=re_...
```

Edge function pattern:

```typescript
import { renderTemplate } from '../_shared/email-render.ts';

const html = await renderTemplate('proposal-email', {
  first_name: contact.name.split(' ')[0],
  quote_id: `BPP-${new Date().getFullYear()}-${contact.id.slice(0, 4)}`,
  install_address: contact.install_address,
  // ... etc
});

await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: 'Key at Backup Power Pro <key@backuppowerpro.com>',
    reply_to: 'key@backuppowerpro.com',
    to: contact.email,
    subject: 'Your install quote — 412 Oakmont',
    html,
  }),
});
```

## Hero images

Real BPP-branded photography at `email-templates/assets/` and `pdf-guides/assets/` (4K, generated via nano-banana with the BPP brand context):

- `email-templates/assets/proposal-panel.jpg` — Square D Homeline panel close-up for proposal email hero
- `pdf-guides/assets/buyers-guide-hero.jpg` — Golden-hour install scene, hands visible
- `pdf-guides/assets/storm-prep-hero.jpg` — Pre-storm patio with generator + yellow cord
- `pdf-guides/assets/cheat-sheet-outlet.jpg` — Studio macro of a NEMA L14-30R 4-prong outlet

Reuse these across templates as needed. For email send, downsize to 1200px wide JPEG @ Q80 to keep payload under 500KB.

## Source

Templates 1-6 generated via Claude Design at `https://claude.ai/design/p/019ddb93-c9e1-7b9a-9730-bbe409b713e9` and refined locally. Templates 7-11 authored locally using the design language locked in templates 1-6 after Claude Design hit a stream cap mid-session. All share token-identical visual language.
