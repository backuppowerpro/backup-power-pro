# SMS Companions to Email Templates

Not every email gets an SMS. Use these only when the SMS adds something email can't, a real-time ping, an action link, a "I'm 15 min out" signal. SMS is the conversation channel; email is the artifact channel. Don't duplicate.

**Send rules:**
- Every customer is opt-in (consented at form submit) so the legal gate is open
- Honor `contacts.do_not_contact` always
- Single segment (≤160 chars) unless noted; longer texts get billed as multiple segments and feel less personal
- Voice: Key first-person, no corporate fluff, no em dashes
- One CTA max per text; if a link is included it's the primary CTA
- Variables in `{{var}}` syntax for the dispatcher to substitute

---

## ✅ Send SMS · 11 templates

### 1. Welcome / form submit
**Skip.** Ashley already texts within ~30 seconds. The welcome email is the artifact; the SMS is Ashley's qualification opener. Don't duplicate.

---

### 2. Proposal sent
**Pairs with:** `proposal-email.html`, `proposal-personalized-30a.html`, `proposal-personalized-50a.html`
**When:** Fire ~30 seconds after the proposal email lands.
**Why:** Most customers don't check email immediately. SMS drives them to look.

> Hey {{first_name}}, Key here. Just sent your install quote to your email. Gave {{address_short}} a thorough look. Take a sec when you can.

**Char count:** ~140
**Variables:**
- `{{first_name}}` — from contacts.name (split first token)
- `{{address_short}}` — street + number only (e.g. "412 Oakmont"), not full city/state

---

### 3. Quote follow-up (48h soft nudge)
**Pairs with:** `quote-followup-48h-email.html`
**When:** Fire 48h after proposal email if not yet signed AND no negative reply.
**Why:** Less inbox noise than a 2nd email; closes faster.

> {{first_name}}, no rush on the quote, just checking in. Anything I can clear up before you decide? Or one-word "pass" and I'll close the file.

**Char count:** ~145

---

### 4. Install day reminder (24h before)
**Pairs with:** `install-reminder-email.html`
**When:** ~10am the day before install.
**Why:** Reduces no-shows + confirms arrival window. Customer can text-back-to-confirm.

> {{first_name}}, install day is tomorrow at {{address_short}}. I'll be there between {{arrival_window}}. Reply YES to confirm or text if anything changed.

**Char count:** ~155

---

### 5. Install day arrival ("I'm on my way")
**Pairs with:** `install-day-arrival-email.html`
**When:** ~30 min before ETA on install morning.
**Why:** This is the most-critical SMS of the journey. Replaces the "where are they?" anxiety.

> On my way, {{first_name}}. Black GMC with BPP decal. ETA {{eta_time}} at {{address_short}}. Knock once when I get there. Text if anything's off.

**Char count:** ~150

---

### 6. Completion (same-day)
**Pairs with:** `completion-email.html`
**When:** Right after Key leaves the customer's house.
**Why:** Customer wants closure. Email has photos + Owner's Manual; SMS just says "done."

> All wrapped up, {{first_name}}. Tested clean. Sent the photos + your owner's manual to your email. Permit closeout goes to the county Monday.

**Char count:** ~140

---

### 7. Invoice / pay link
**Pairs with:** `invoice-email.html`
**When:** Same time as invoice email (post-completion).
**Why:** Stripe checkouts convert better when the link is text-tappable, not buried in inbox.

> Invoice for your install: ${{total}}. Pay securely: {{stripe_url}} . Receipt arrives instantly. Questions, just text back.

**Char count:** ~120 (depends on URL length)

---

### 8. Permit document (sign + return)
**Pairs with:** `permit-document-email.html`
**When:** Same time as permit email (~3-5 days before install).
**Why:** Action-required emails get ignored if not flagged. SMS surfaces the urgency.

> {{first_name}}, just emailed your county permit doc, needs your signature before install day. Print at home or tap "Mail it to me" in the email.

**Char count:** ~155

---

### 9. Permit mail-it confirmation
**Pairs with:** customer clicked "Mail it to me" button (the success page they see)
**When:** Immediately after the customer clicks the button.
**Why:** Confirms the mailer is on the way; sets expectation.

> Got it, {{first_name}}. Dropping your permit doc in the mail today. Should land in 2 to 4 business days. Sign + drop in the return envelope.

**Char count:** ~145

---

### 10. Permit approved (inspector signed off)
**Pairs with:** `permit-approved-email.html`
**When:** Same morning the inspector clears the install.
**Why:** Customer-facing milestone. Real news beats a marketing email tone.

> {{first_name}}, inspector signed off this morning, your install is officially closed-out. 2-year workmanship warranty starts today.

**Char count:** ~140

---

### 11. Review request (48h post-install)
**Pairs with:** `review-email.html`
**When:** 48h after install; same time as review email.
**Why:** SMS converts higher than email for review asks. One CTA, zero clutter.

> {{first_name}}, hope it's running clean. If you've got 30 sec, a Google review really helps: {{review_url}} . Anything off? Text me first.

**Char count:** ~140

---

### 12. Storm prep reminder (June 1 + Nov 1, ANNUAL)
**Pairs with:** `storm-prep-reminder-email.html`
**When:** Twice a year only. SMS is intrusive at this scale, so use it sparingly.
**Why:** Drives test-cycle behavior. Most customers won't run the test from an email alone.

> Hurricane season starts {{date}}, {{first_name}}. 10 min test cycle this weekend = no surprises in October. Full checklist in your email.

**Char count:** ~140
**Note:** Marketing-class. Honor the `__email_marketing_off` notes marker (apply same gate to SMS).

---

## ❌ DON'T send SMS · 4 templates

| Email | Why not |
|-------|---------|
| `welcome-email.html` | Ashley already SMS-texts within 30s of form submit. Adding another text = spam. |
| `pdf-download-email.html` | Customer-initiated; the email IS the deliverable. SMS feels like a chase. |
| `anniversary-email.html` | Too marketing-feeling for SMS. Email is the right tone. |
| `referral-nudge-email.html` | Same. The $100 thank-you ask is best in email where the customer can sit with it. |

---

## How to dispatch

The companion edge function `send-sms-companion` accepts:

```typescript
{
  contact_id: "uuid",
  template: "proposal-sent" | "quote-followup-48h" | "install-reminder-24h" |
            "install-arrival" | "completion" | "invoice" |
            "permit-document" | "permit-mail-confirm" | "permit-approved" |
            "review-request" | "storm-prep-reminder",
  variables: {
    address_short?: "412 Oakmont",
    arrival_window?: "9 to 11 AM",
    eta_time?: "9:15",
    total?: "1247",
    stripe_url?: "https://...",
    review_url?: "https://...",
    date?: "Sunday"
  }
}
```

It pulls `first_name` automatically from `contacts.name`. Honors DNC + marketing-opt-out. Routes via OpenPhone if customer's phone is on `ASHLEY_OPENPHONE_TEST_PHONES`, else Twilio.

Pattern: usually fire SMS-companion 30-60 seconds AFTER the email so customers don't see both notifications hit their phone in the same vibration.

---

## Char count discipline

Aim for ≤160 characters per SMS (single Twilio segment). Two-segment texts cost double and feel impersonal. If a template exceeds 160, the dispatcher logs a warning so you can re-tighten the copy.

The `{{first_name}}` placeholder reserves ~8 chars on average. Keep the static body of every template ≤145 chars to leave room.
