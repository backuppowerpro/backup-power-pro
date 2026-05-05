# Ashley Go-Live Runbook (v10.1.30)

Tonight's build status — read top to bottom when you're back.

## What's already done

✅ **5 of 7 edge functions DEPLOYED** to production:
- `bot-classifier` — Haiku 4.5, structured-output classifier
- `bot-phraser` — Haiku 4.5, voice-locked reply generator
- `bot-photo-classifier` — Opus 4.7 vision, panel/outlet photo grading
- `bot-handoff-notifier` — internal SMS to your cell on terminal states
- `bot-engine` — orchestrator (greeting + full inbound classifier→state-machine→phraser pipeline)

✅ **Code complete + committed (not yet deployed)**:
- `quo-ai-new-lead` — Ashley gated entry (kicks off greeting on form submit)
- `twilio-webhook` — Ashley gated routing (routes inbound SMS to bot-engine)
- `_shared/bot-state-machine.ts` (1,343 LOC ported from bot-lab/state-machine.js)
- `_shared/bot-idempotency.ts` (advisory-lock + bot_processed_messages)
- Migration: `supabase/migrations/20260504100000_ashley_bot.sql`

✅ **Gate is currently CLOSED** — `ASHLEY_ALLOWED_PHONES` is unset, so even the deployed functions take no action on real traffic until you set the env var.

---

## What you need to do (in order) when you're back

### 1. Apply the schema migration (~2 min)

Adds bot_state columns + bot_processed_messages + advisory-lock RPC. Additive, safe.

```bash
cd /Users/keygoodson/Desktop/CLAUDE
/Users/keygoodson/local/node-v22.15.0-darwin-arm64/bin/supabase db push --project-ref reowtzedjflwmlptupbk --include-all
```

If it fails, run the SQL from `supabase/migrations/20260504100000_ashley_bot.sql` manually via the Supabase dashboard SQL editor.

### 2. Verify ANTHROPIC_API_KEY is set (~30 sec)

```bash
/Users/keygoodson/local/node-v22.15.0-darwin-arm64/bin/supabase secrets list --project-ref reowtzedjflwmlptupbk | grep ANTHROPIC
```

If missing, set it (your Anthropic key is in `~/.claude/credentials.md`):

```bash
/Users/keygoodson/local/node-v22.15.0-darwin-arm64/bin/supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref reowtzedjflwmlptupbk
```

### 3. Set the test allowlist to your cell (~30 sec)

```bash
/Users/keygoodson/local/node-v22.15.0-darwin-arm64/bin/supabase secrets set ASHLEY_ALLOWED_PHONES=+19414417996 --project-ref reowtzedjflwmlptupbk
```

Until set, the gate is closed for everyone. Multiple test phones go comma-separated.

### 4. Deploy the two remaining edge functions (~2 min)

```bash
CLI=/Users/keygoodson/local/node-v22.15.0-darwin-arm64/bin/supabase
PROJ=reowtzedjflwmlptupbk
$CLI functions deploy quo-ai-new-lead --project-ref $PROJ
$CLI functions deploy twilio-webhook  --project-ref $PROJ
```

Both are purely additive — when the gate is closed they fall through to existing Quo/Alex flow unchanged. I deferred these deploys for your sign-off because they touch the path every real lead takes.

### 5. Insert EXP-008 row (greeting variant A/B/C/D experiment)

Optional — only needed if you want EXP-008 metrics. Run this in the Supabase SQL editor:

```sql
INSERT INTO public.bot_experiments (
  id, hypothesis, primary_metric, variants, status, sample_target, decision_rule, stopping_conditions, created_at
) VALUES (
  'exp-008-greeting-variants',
  'Pre-made GREETING variants test which warm + name-led + engaging-question opener lifts first_reply_rate',
  'first_reply_rate',
  '{"A":"flow expectation control","B":"human anchor","C":"form-fill warmth","D":"direct + make/model"}',
  'active',
  250,
  'Ship variant with highest first_reply_rate if lift >=5pp over A with p<0.15. Else keep A.',
  '{"cpl_spike_2x":"pause","reply_rate_drop_60pct":"pause","stop_rate_spike_1.5x":"pause"}',
  NOW()
);
```

---

## Smoke test (after steps 1–4)

From your cell, submit a fresh form on backuppowerpro.com (use a unique address so the contact-dedupe doesn't bypass).

Expected within ~5 seconds: GREETING SMS from (864) 863-7800 — one of variants A/B/C/D, opening with "Hi [name], I'm Ashley, the automated assistant at Backup Power Pro…".

Then text-walk through:

| You send | Expected Ashley reply |
|---|---|
| "yes" | Confirming generator is 240V (AWAIT_240V) |
| "50 amp" | Panel photo ask (AWAIT_PANEL_PHOTO) |
| (panel photo MMS) | Acks photo, asks where the panel is (AWAIT_RUN) |
| "garage exterior wall" | Email + last-name ask (AWAIT_EMAIL) |
| "test@example.com 22 Kimbell Ct Greenville SC 29615" | RECAP for confirmation |
| "yes" | COMPLETE — you get an internal SMS w/ lead-quality score |
| (anytime) "STOP" | Silent. Contact flagged DNC + bot_state=STOPPED |

Watch the rows during the test:

```sql
SELECT id, name, bot_state, gen_240v, outlet_amps, install_address, primary_panel_photo_path
FROM contacts WHERE phone='+19414417996' ORDER BY created_at DESC LIMIT 3;

SELECT message_sid, outcome, processed_at FROM bot_processed_messages
ORDER BY processed_at DESC LIMIT 10;

SELECT direction, body, created_at FROM messages WHERE contact_id='<id>' ORDER BY created_at;
```

---

## Kill switch (instant)

If anything goes wrong:

```bash
/Users/keygoodson/local/node-v22.15.0-darwin-arm64/bin/supabase secrets unset ASHLEY_ALLOWED_PHONES --project-ref reowtzedjflwmlptupbk
```

Closes the gate immediately. Webhook + form-submit fall back to existing Quo/Alex flow.

You can also disable per-contact:
```sql
UPDATE contacts SET bot_disabled=true WHERE id='<id>';
```

---

## A2P 10DLC reminder

Until carrier review approves the campaign, expect possible filtering on initial messages (especially AT&T → Twilio error 30007 / 30034). If you don't get the GREETING within 30 seconds of submitting the form, check Twilio Console → Logs → Error Codes for that MessageSid.

---

## Open the gate to all qualifying leads (later, after A2P clears)

```bash
/Users/keygoodson/local/node-v22.15.0-darwin-arm64/bin/supabase secrets set ASHLEY_ALLOWED_PHONES='*' --project-ref reowtzedjflwmlptupbk
```

The wildcard opens Ashley to every form submission AND every Twilio inbound for a contact with a non-null bot_state. Alex flow continues running for everyone NOT in bot_state — they coexist.

---

## Known gaps / things I'd watch

1. **System-prompt files via `Deno.readTextFile`** — bot-classifier / bot-phraser / bot-photo-classifier load their prompts from colocated `system-prompt.txt`. The deploy succeeded but I couldn't fully smoke-test the cold-start path without invoking with a real service-role key. If you see "ENOENT" errors in function logs on first call, drop me a note and I'll inline the prompts as TS strings.
2. **Migration not yet applied** — until step 1 above, `bot_processed_messages` and `pg_try_advisory_xact_lock_wrapped` don't exist. Idempotency will fail open (treats every message as duplicate-OK and falls through silently). Don't smoke-test before applying the migration.
3. **send-sms shape** — fixed three callsites that were using `{to, body, from_label, contact_id}` instead of `{contactId, body}`. The existing GREETING flow had this bug too — would have been a silent failure on first real test.
4. **Internal alerts to your cell** — bot-handoff-notifier sends direct via Twilio API to +19414417996 (not via send-sms). Matches the lead-volume-alert pattern.

---

## Files touched in this release

**New:**
- `supabase/functions/bot-classifier/{index.ts, system-prompt.txt}`
- `supabase/functions/bot-phraser/{index.ts, system-prompt.txt}`
- `supabase/functions/bot-photo-classifier/{index.ts, system-prompt.txt}`
- `supabase/functions/bot-handoff-notifier/index.ts`
- `supabase/functions/_shared/bot-state-machine.ts`
- `supabase/functions/_shared/bot-idempotency.ts`
- `supabase/migrations/20260504100000_ashley_bot.sql`

**Modified (purely additive — gate-closed = no behavior change):**
- `supabase/functions/bot-engine/index.ts` — added inbound handler, fixed send-sms shape on existing greeting
- `supabase/functions/quo-ai-new-lead/index.ts` — Ashley gated entry after consent log + analytics
- `supabase/functions/twilio-webhook/index.ts` — Ashley gated routing after message save
