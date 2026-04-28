/**
 * One-shot: applies messages.sender_phone migration so orphan inbound
 * messages can be grouped + surfaced in the CRM. Brain-token-gated.
 *
 * Delete this function after the migration runs successfully.
 */

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'
import { timingSafeEqual, allowRate } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': 'https://backuppowerpro.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-bpp-brain-token',
  'Vary': 'Origin',
}

const MIGRATION_SQL = `
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sender_phone text;

CREATE INDEX IF NOT EXISTS messages_sender_phone_orphan_idx
  ON public.messages (sender_phone, created_at DESC)
  WHERE contact_id IS NULL AND direction = 'inbound';

COMMENT ON COLUMN public.messages.sender_phone IS 'Original sender phone (E.164) — populated on inbound for orphan-thread grouping when contact_id is NULL.';
`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS })

  const BRAIN = Deno.env.get('BPP_BRAIN_TOKEN') || ''
  const sent = req.headers.get('x-bpp-brain-token') || ''
  if (!BRAIN || !timingSafeEqual(sent, BRAIN)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowRate(`apply-messages-sender-phone:${ip}`, 1)) {
    return new Response(JSON.stringify({ error: 'rate limited' }), {
      status: 429, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const dbUrl = Deno.env.get('SUPABASE_DB_URL')
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: 'no db url' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const sql = postgres(dbUrl, { max: 1 })
  try {
    await sql.unsafe(MIGRATION_SQL)
    await sql.end()
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    try { await sql.end() } catch (_) {}
    return new Response(JSON.stringify({
      error: 'migration failed',
      detail: String(err?.message || err).slice(0, 400),
    }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
