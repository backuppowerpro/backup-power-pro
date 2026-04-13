-- sparky_memory: Sparky's persistent memory of Key's preferences, business context,
-- and important facts that carry across sessions.
--
-- Run this in your Supabase SQL editor:
-- Dashboard → SQL Editor → paste and run

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

-- Index for fast category + importance queries
CREATE INDEX IF NOT EXISTS sparky_memory_category_importance
  ON sparky_memory (category, importance DESC);

-- Index for key lookups (upserts)
CREATE INDEX IF NOT EXISTS sparky_memory_key
  ON sparky_memory (key);

-- Seed with known BPP context so Sparky starts informed
INSERT INTO sparky_memory (key, value, category, importance) VALUES
  ('bank_goal', '$150K spendable profit in the Found business account by August–September 2026', 'business', 5),
  ('geography', 'Greenville, Spartanburg, Pickens counties SC only. NEVER Anderson County.', 'business', 5),
  ('pricing_floor', 'Minimum price is $1,197. Never go below this.', 'business', 5),
  ('current_cpl', 'Meta Ads CPL currently ~$50. Target is <$30.', 'business', 4),
  ('jobs_per_week', 'Currently doing 2–3 installs/week solo. Max solo capacity is 5/week.', 'business', 4),
  ('quo_port_status', 'Porting (864) 400-5302 from Quo to Twilio. Alex auto-responder stays on Quo until port completes.', 'business', 4),
  ('alex_status', 'Alex is BPP customer-facing SMS agent in Quo on (864) 400-5302. Will merge with Sparky when number ports to Twilio.', 'business', 4),
  ('permit_automation_status', 'Permit automation not yet active. Sparky has the submit_permit_application stub ready for when it becomes available.', 'business', 3),
  ('materials_cost', 'Materials cost ~$250/job (inlet box + interlock + cord + breaker + misc). Net is ~$910–$1,067/job solo.', 'business', 3),
  ('scaling_next_step', 'Next scale step: hire first licensed/insured electrical sub. Sub gets ~$450/job, Key keeps ~$450 margin.', 'business', 3)
ON CONFLICT (key) DO NOTHING;

-- Enable RLS (Sparky edge function uses service role key, so bypass is fine)
ALTER TABLE sparky_memory ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (edge function uses service role key)
CREATE POLICY "service_role_all" ON sparky_memory
  FOR ALL USING (true) WITH CHECK (true);
