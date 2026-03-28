# Zapier Setup Guide for Permit Manager

## Webhook URL

Your permit app exposes a webhook endpoint at:
```
https://<your-cloudflared-url>/api/webhook
```

To get your URL:
1. Run `npm start` from the permit-app directory
2. Look for the line containing `trycloudflare.com` in the TUNNEL output
3. Your webhook URL is: `https://xxxx-yyyy-zzzz.trycloudflare.com/api/webhook`

**For a stable URL (recommended for production):** Set up a named Cloudflare Tunnel (see Cloudflare docs). The URL will never change.

## Authentication

Every Zapier webhook POST must include this header:
```
x-webhook-secret: <your WEBHOOK_SECRET value from .env>
```

In Zapier: When configuring a "Webhooks by Zapier" action, add a Custom Header in the "Headers" section.

## Event Type Mapping

### Zap: BPP Quote Form → Stage 1 (Form Submitted)
**Trigger:** Catch Hook (your existing Zap 353340616)
**Webhook by Zapier action:**
- URL: `https://<tunnel-url>/api/webhook`
- Payload Type: JSON
- Data:
  ```json
  {
    "event_type": "quote_form_submitted",
    "name": "{{your_name_field}}",
    "phone": "{{your_phone_field}}",
    "email": "{{your_email_field}}"
  }
  ```

### Zap: Quo SMS First Reply → Stage 2 (Responded)
**Trigger:** Quo "New Inbound Message" or similar
**Data:**
  ```json
  {
    "event_type": "quo_sms_replied",
    "phone": "{{contact_phone}}"
  }
  ```

### Zap: Dubsado Contract Signed → Stage 4 (Booked)
**Trigger:** Dubsado "Contract Signed"
**Data:**
  ```json
  {
    "event_type": "dubsado_contract_signed",
    "name": "{{client_name}}",
    "email": "{{client_email}}",
    "phone": "{{client_phone}}"
  }
  ```

### Zap: Dubsado Payment Received → Stage 9 + Auto-Archive
**Trigger:** Dubsado "New Payment Received"
**Data:**
  ```json
  {
    "event_type": "dubsado_payment_received",
    "name": "{{client_name}}",
    "email": "{{client_email}}",
    "phone": "{{client_phone}}"
  }
  ```

### Zap: Dubsado Project Status Updated → Stage 3 (Quote Sent)
**Trigger:** Dubsado "Project Status Updated"
**Data:**
  ```json
  {
    "event_type": "dubsado_project_status_updated",
    "name": "{{client_name}}",
    "email": "{{client_email}}"
  }
  ```

### Zap: Dubsado New Lead → Stage 2 (Responded)
**Trigger:** Dubsado "New Project as Lead"
**Data:**
  ```json
  {
    "event_type": "dubsado_new_lead",
    "name": "{{client_name}}",
    "email": "{{client_email}}",
    "phone": "{{client_phone}}"
  }
  ```

### Zap: Dubsado New Job → Stage 4 (Booked)
**Trigger:** Dubsado "New Project as Job"
**Data:**
  ```json
  {
    "event_type": "dubsado_new_job",
    "name": "{{client_name}}",
    "email": "{{client_email}}",
    "phone": "{{client_phone}}"
  }
  ```

## Stage Reference

| Stage | Label | Trigger |
|-------|-------|---------|
| 1 | Form Submitted | quote_form_submitted |
| 2 | Responded | quo_sms_replied, dubsado_new_lead |
| 3 | Quote Sent | dubsado_project_status_updated |
| 4 | Booked | dubsado_contract_signed, dubsado_new_job |
| 5 | Permit Submitted | Manual only |
| 6 | Permit Paid | Manual only |
| 7 | Permit Approved | Manual only |
| 8 | Inspection Scheduled | Manual only |
| 9 | Complete | dubsado_payment_received (auto-archives) |

## Testing Your Webhooks

Use curl to test before configuring Zapier:

```bash
curl -X POST https://<tunnel-url>/api/webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_SECRET" \
  -d '{
    "event_type": "quote_form_submitted",
    "name": "Test Person",
    "phone": "864-555-0000",
    "email": "test@example.com"
  }'
```

Expected response: `{"success":true,"event_type":"quote_form_submitted","action":"created_or_found_at_stage_1",...}`

## Idempotency

The webhook handler will NOT regress a person's stage. If a `quote_form_submitted` event arrives for a person already at stage 3, they stay at stage 3. Safe to replay events.

## Troubleshooting

- **403 Forbidden**: Wrong or missing `x-webhook-secret` header
- **400 Unknown event_type**: Check the `event_type` value matches exactly (lowercase, underscores)
- **Person not found for phone match**: Verify phone format — the system normalizes by stripping non-digits and matching last 10 digits
- **Person not moving**: Check `webhook_log` table via `GET /api/analytics` or DB viewer
