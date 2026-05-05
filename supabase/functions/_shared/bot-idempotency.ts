// Production helper: webhook idempotency for the bot pipeline
// Path: supabase/functions/_shared/bot-idempotency.ts
//
// Twilio retries webhooks on 5xx + occasional duplicate sends. Without
// idempotency, the bot would process the same inbound SMS twice and
// generate two outbound replies. This module provides:
//   1. tryAcquireMessageLock(message_sid) — acquires a Postgres advisory
//      lock keyed on the message SID. Returns false if already held
//      (= duplicate webhook firing for the same message).
//   2. recordProcessed(message_sid, outcome) — records the message has
//      been processed. Idempotent.
//
// Pattern: bot-engine wraps its handle-inbound logic in:
//
//   const acquired = await tryAcquireMessageLock(sid);
//   if (!acquired) return 200 OK (silent dedupe);
//   try {
//     ... do bot processing ...
//   } finally {
//     await recordProcessed(sid, outcome);
//   }
//
// Twilio retries within 11s (default). PG advisory locks are session-scoped
// and we explicitly release at end. Duplicate webhooks within that window
// hit the lock and get silently dropped. Outside that window, the
// recordProcessed table is the ground truth.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

/**
 * Try to acquire a process-lock for this message SID. Returns true if
 * acquired (we are the first to process it), false if already held or
 * already-processed.
 *
 * Strategy: hash the SID to a bigint and use pg_try_advisory_xact_lock
 * (transaction-scoped — auto-released on tx end). Combined with a
 * `bot_processed_messages` table that records final disposition.
 */
export async function tryAcquireMessageLock(messageSid: string): Promise<boolean> {
  // Check if already processed (idempotency window: 7 days)
  const { data: existing } = await sb.from('bot_processed_messages')
    .select('message_sid, processed_at')
    .eq('message_sid', messageSid)
    .gte('processed_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
    .maybeSingle()

  if (existing) {
    return false  // already processed — duplicate webhook
  }

  // Try advisory lock (transaction-scoped; auto-released)
  const lockKey = hashStringToBigint(messageSid)
  const { data, error } = await sb.rpc('pg_try_advisory_xact_lock_wrapped', { lock_key: lockKey })

  if (error || !data) {
    return false  // lock held by another concurrent request
  }

  return true
}

export async function recordProcessed(
  messageSid: string,
  outcome: 'replied' | 'silent' | 'error',
  contactId?: string,
  errorMsg?: string,
): Promise<void> {
  await sb.from('bot_processed_messages').upsert({
    message_sid: messageSid,
    contact_id: contactId,
    outcome,
    error_message: errorMsg,
    processed_at: new Date().toISOString(),
  }, { onConflict: 'message_sid' })
}

// Stable 64-bit hash of message_sid for advisory lock key
function hashStringToBigint(s: string): bigint {
  // FNV-1a 64-bit hash
  let h = 0xcbf29ce484222325n
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i))
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn
  }
  // Cast to signed bigint for Postgres bigint compatibility
  return h > 0x7fffffffffffffffn ? h - 0x10000000000000000n : h
}

// ──────────────────────────────────────────────────────────────────────
// Required schema additions (append to migration):
//
// CREATE TABLE IF NOT EXISTS public.bot_processed_messages (
//   message_sid TEXT PRIMARY KEY,
//   contact_id UUID REFERENCES public.contacts(id),
//   outcome TEXT NOT NULL CHECK (outcome IN ('replied', 'silent', 'error')),
//   error_message TEXT,
//   processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );
//
// CREATE INDEX idx_bot_processed_messages_processed_at
//   ON public.bot_processed_messages (processed_at DESC);
//
// ALTER TABLE public.bot_processed_messages ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "service_role_only" ON public.bot_processed_messages
//   FOR ALL TO service_role USING (true) WITH CHECK (true);
//
// CREATE OR REPLACE FUNCTION public.pg_try_advisory_xact_lock_wrapped(lock_key BIGINT)
//   RETURNS BOOLEAN AS $$
//     SELECT pg_try_advisory_xact_lock(lock_key);
//   $$ LANGUAGE SQL VOLATILE SECURITY DEFINER;
//
// GRANT EXECUTE ON FUNCTION public.pg_try_advisory_xact_lock_wrapped(BIGINT) TO service_role;
//
// -- Cron: clean processed_messages older than 30 days
// SELECT cron.schedule('bot-cleanup-processed-messages', '0 3 * * *',
//   $$DELETE FROM public.bot_processed_messages WHERE processed_at < NOW() - INTERVAL '30 days'$$);
// ──────────────────────────────────────────────────────────────────────
