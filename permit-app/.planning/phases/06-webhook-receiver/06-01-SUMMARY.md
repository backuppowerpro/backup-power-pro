# Phase 06-01 Summary: Webhook Route (Wave 1)

## Status: COMPLETE

## Files Created / Modified

### Created: server/routes/webhook.js
- Rate limiter: 50 req/min (separate from global 100/min in index.js)
- Auth middleware: `x-webhook-secret` header vs `WEBHOOK_SECRET` env var → 403 on mismatch or missing
- `findPerson(phone, email)`: normalizes phone (strip non-digits, LIKE `%digits`), falls back to email
- `upsertPersonAtStage(name, phone, email, targetStage, source)`: creates new person or advances existing — never regresses stage; re-fetches from DB after update to return current state
- `logWebhook(eventType, payloadSummary, personId)`: writes to `webhook_log` table, truncates at 500 chars
- 7 event_type cases:
  - `quote_form_submitted` → stage 1
  - `quo_sms_replied` → stage 2
  - `dubsado_project_status_updated` → stage 3
  - `dubsado_new_lead` → stage 2
  - `dubsado_new_job` → stage 4
  - `dubsado_contract_signed` → stage 4
  - `dubsado_payment_received` → stage 9 + `runAutoArchive()`
- Unknown/missing `event_type` → 400
- Errors caught → 500 + error logged to webhook_log

### Modified: server/index.js
- Added import: `import webhookRouter from './routes/webhook.js'`
- Added route: `app.use('/api/webhook', webhookRouter)`

## Commits
- `feat(06-01): server/routes/webhook.js — all 7 event types, auth, idempotent`
- `feat(06-01): register webhook route in server/index.js`
- `fix(06-01): re-fetch person after stage update to return current stage in response`

## Notes
- `webhook_log` table was already defined in `schema.sql` — no migration required
- `express-rate-limit` was already installed — no new deps required
- Server must be started from `/Users/keygoodson/Desktop/CLAUDE/permit-app/` root (not `server/` subdir) for dotenv to find `.env`
