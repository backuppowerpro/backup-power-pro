/**
 * Migration runner — idempotent. Creates sparky_memory + sparky_inbox tables.
 * Safe to call multiple times.
 */

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS sparky_memory (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  key         text        UNIQUE NOT NULL,
  value       text        NOT NULL,
  category    text        NOT NULL DEFAULT 'business'
                          CHECK (category IN ('preference', 'business', 'contact', 'schedule')),
  importance  int         NOT NULL DEFAULT 3
                          CHECK (importance BETWEEN 1 AND 5),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sparky_memory_category_importance
  ON sparky_memory (category, importance DESC);

ALTER TABLE sparky_memory ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sparky_memory' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON sparky_memory FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO sparky_memory (key, value, category, importance) VALUES
  ('bank_goal', '$150K spendable profit in the Found business account by August–September 2026', 'business', 5),
  ('geography', 'Greenville, Spartanburg, Pickens counties SC only. NEVER Anderson County.', 'business', 5),
  ('pricing_floor', 'Minimum price is $1,197. Never go below this.', 'business', 5),
  ('current_cpl', 'Meta Ads CPL currently ~$50. Target is <$30.', 'business', 4),
  ('jobs_per_week', 'Currently doing 2–3 installs/week solo. Max solo capacity is 5/week.', 'business', 4),
  ('quo_port_status', 'Porting (864) 400-5302 from Quo to Twilio. Alex auto-responder stays on Quo until port completes.', 'business', 4),
  ('alex_status', 'Alex is BPP customer-facing SMS agent in Quo on (864) 400-5302. Will merge with Sparky when number ports to Twilio.', 'business', 4),
  ('permit_automation_status', 'Permit automation not yet active. submit_permit_application stub ready for future activation.', 'business', 3),
  ('materials_cost', 'Materials cost ~$250/job. Net ~$910–$1,067/job solo.', 'business', 3),
  ('scaling_next_step', 'Next scale step: hire first licensed electrical sub. Sub gets ~$450/job, Key keeps ~$450 margin.', 'business', 3)
ON CONFLICT (key) DO NOTHING;

-- ── sparky_inbox: agent reports → Sparky → Key reviews in CRM ──────────────
-- Nothing here auto-sends to customers. Key approves all actions.
CREATE TABLE IF NOT EXISTS sparky_inbox (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent            text        NOT NULL,
  contact_id       uuid        REFERENCES contacts(id) ON DELETE SET NULL,
  priority         text        NOT NULL DEFAULT 'normal',
  summary          text        NOT NULL,
  draft_reply      text,
  suggested_action text,
  read             boolean     NOT NULL DEFAULT false,
  actioned         boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sparky_inbox_unread
  ON sparky_inbox (read, created_at DESC);

ALTER TABLE sparky_inbox ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sparky_inbox' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON sparky_inbox FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- alex_sessions: add messages (conversation history) + summary columns
ALTER TABLE alex_sessions ADD COLUMN IF NOT EXISTS messages jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE alex_sessions ADD COLUMN IF NOT EXISTS summary text;

-- alex_sessions: follow-up engine columns
ALTER TABLE alex_sessions ADD COLUMN IF NOT EXISTS alex_active        boolean     NOT NULL DEFAULT true;
ALTER TABLE alex_sessions ADD COLUMN IF NOT EXISTS key_active         boolean     NOT NULL DEFAULT false;
ALTER TABLE alex_sessions ADD COLUMN IF NOT EXISTS key_last_active_at timestamptz;
ALTER TABLE alex_sessions ADD COLUMN IF NOT EXISTS followup_count     int         NOT NULL DEFAULT 0;
ALTER TABLE alex_sessions ADD COLUMN IF NOT EXISTS last_followup_at   timestamptz;
ALTER TABLE alex_sessions ADD COLUMN IF NOT EXISTS customer_last_msg_at timestamptz;
ALTER TABLE alex_sessions ADD COLUMN IF NOT EXISTS opted_out          boolean     NOT NULL DEFAULT false;
ALTER TABLE alex_sessions ADD COLUMN IF NOT EXISTS photo_received     boolean     NOT NULL DEFAULT false;
-- Security audit #5: per-session notify_key SMS counter (cap abuse)
ALTER TABLE alex_sessions ADD COLUMN IF NOT EXISTS notify_key_count   int         NOT NULL DEFAULT 0;

-- alex_dedup: prune entries older than 7 days (message IDs don't need to live forever)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alex_dedup') THEN
    DELETE FROM alex_dedup WHERE created_at < NOW() - INTERVAL '7 days';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── TCPA DNC + consent audit log (added 2026-04-17 from legal audit) ───────
-- Legal audit finding C3: STOP must propagate cross-sender. H6: durable consent
-- record to survive TCPA claims. Every outbound SMS sender (alex-agent,
-- alex-followup, alex-ghost, quo-ai-new-lead, stripe-webhook) must check
-- contacts.do_not_contact before sending.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS do_not_contact boolean NOT NULL DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS dnc_at timestamptz;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS dnc_source text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS consent_at timestamptz;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS consent_ip text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS consent_ua text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS consent_page text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS consent_version text;

CREATE INDEX IF NOT EXISTS contacts_do_not_contact ON contacts (do_not_contact);
CREATE INDEX IF NOT EXISTS contacts_phone_dnc ON contacts (phone, do_not_contact);

-- Consent log is immutable (insert-only). Survives contact deletion via SET NULL.
CREATE TABLE IF NOT EXISTS sms_consent_log (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id      uuid        REFERENCES contacts(id) ON DELETE SET NULL,
  phone           text,
  event           text        NOT NULL DEFAULT 'submit', -- submit | stop | help
  consent_at      timestamptz NOT NULL DEFAULT now(),
  consent_ip      text,
  consent_ua      text,
  consent_page    text,
  consent_version text,
  raw             jsonb
);
CREATE INDEX IF NOT EXISTS sms_consent_log_phone ON sms_consent_log (phone);
CREATE INDEX IF NOT EXISTS sms_consent_log_event ON sms_consent_log (event, consent_at DESC);

-- pg_cron: schedule alex-followup to run every hour
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('alex-followup-hourly');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('alex-dedup-prune');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alex_dedup') THEN
    PERFORM cron.schedule(
      'alex-dedup-prune',
      '0 3 * * 0',
      'DELETE FROM alex_dedup WHERE created_at < NOW() - INTERVAL ''7 days'''
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- alex-followup-hourly cron was formerly scheduled here with an embedded
-- service_role JWT in the headers string. That leaked the JWT into the
-- public repo (run-migration source is committed). The cron is now
-- scheduled separately using a vault-stored secret so the key never
-- enters source control.
-- If you need to re-schedule this cron after a service-role rotation,
-- run the SQL in supabase/migrations/20260423_schedule_alex_followup_cron.sql
-- directly via the SQL editor (DO NOT paste the new key here).
`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const dbUrl = Deno.env.get('SUPABASE_DB_URL')
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: 'SUPABASE_DB_URL not available' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const sql = postgres(dbUrl, { max: 1 })
    await sql.unsafe(MIGRATION_SQL)
    await sql.end()

    return new Response(JSON.stringify({ success: true, message: 'sparky_memory + sparky_inbox + alex_sessions columns ready.' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
