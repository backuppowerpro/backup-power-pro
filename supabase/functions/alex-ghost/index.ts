/**
 * alex-ghost
 *
 * Runs daily (via Supabase cron or external scheduler).
 * Finds alex_sessions that have gone silent and sends Alex's ghost follow-ups.
 *
 * Ghost schedule:
 *   Day 1  (24h no reply): check-in
 *   Day 3  (72h no reply): short nudge
 *   Day 7 (168h no reply): final, then mark ghosted
 *
 * Also handles the schema migration for ghost columns on first run.
 *
 * Invoke: POST /functions/v1/alex-ghost (no body required)
 */

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'

const QUO_API_KEY = Deno.env.get('QUO_API_KEY')!
const QUO_PHONE_ID = Deno.env.get('QUO_PHONE_NUMBER_ID')!  // (864) 400-5302

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const GHOST_MESSAGES: Record<number, (name: string) => string> = {
  1: (name) => name && name !== 'there'
    ? `Hi ${name}, just checking in. Whenever you get those photos to Key, he can get your quote started.`
    : `Just checking in. Whenever you get those photos over, Key can get your quote started.`,
  3: (_) => `Still want us to take a look?`,
  7: (_) => `No pressure at all. We are here whenever you are ready.`,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS })

  const dbUrl = Deno.env.get('SUPABASE_DB_URL')
  if (!dbUrl) {
    console.error('[alex-ghost] SUPABASE_DB_URL not set')
    return new Response(JSON.stringify({ error: 'db not configured' }), { status: 500, headers: CORS })
  }

  const sql = postgres(dbUrl, { max: 1 })

  try {
    // ── SCHEMA SETUP (idempotent) ────────────────────────────────────────────
    await sql`ALTER TABLE alex_sessions ADD COLUMN IF NOT EXISTS ghost_sent INTEGER DEFAULT 0`
    await sql`ALTER TABLE alex_sessions ADD COLUMN IF NOT EXISTS last_outbound_at TIMESTAMPTZ`
    await sql`ALTER TABLE alex_sessions ADD COLUMN IF NOT EXISTS contact_name TEXT`
    console.log('[alex-ghost] schema ready')

    // ── FIND STALE ACTIVE SESSIONS ───────────────────────────────────────────
    const sessions = await sql`
      SELECT id, phone, session_id, contact_name, ghost_sent,
             COALESCE(last_outbound_at, created_at) AS last_touch
      FROM alex_sessions
      WHERE status = 'active'
        AND ghost_sent < 7
    `

    const now = Date.now()
    const sent: string[] = []
    const skipped: string[] = []

    for (const session of sessions) {
      const lastTouch = new Date(session.last_touch).getTime()
      const hoursGone = (now - lastTouch) / 3_600_000
      const currentGhost = session.ghost_sent ?? 0
      const name = session.contact_name || ''

      // Determine which ghost to send
      let ghostDay = 0
      if (currentGhost < 1 && hoursGone >= 24)  ghostDay = 1
      else if (currentGhost < 3 && hoursGone >= 72) ghostDay = 3
      else if (currentGhost < 7 && hoursGone >= 168) ghostDay = 7

      if (!ghostDay) {
        skipped.push(`${session.phone} (${Math.round(hoursGone)}h, ghost=${currentGhost})`)
        continue
      }

      const msg = GHOST_MESSAGES[ghostDay](name)

      // Send via Quo
      const sendRes = await fetch('https://api.openphone.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: QUO_API_KEY },
        body: JSON.stringify({ from: QUO_PHONE_ID, to: [session.phone], content: msg }),
      })

      if (!sendRes.ok) {
        console.error(`[alex-ghost] Quo send failed for ${session.phone}:`, await sendRes.text())
        continue
      }

      // Update session
      const newStatus = ghostDay === 7 ? 'ghosted' : 'active'
      await sql`
        UPDATE alex_sessions
        SET ghost_sent = ${ghostDay},
            last_outbound_at = now(),
            status = ${newStatus}
        WHERE session_id = ${session.session_id}
      `

      console.log(`[alex-ghost] Day ${ghostDay} ghost sent to ${session.phone}, status→${newStatus}`)
      sent.push(`${session.phone} day${ghostDay}`)
    }

    await sql.end()

    return new Response(JSON.stringify({
      success: true,
      checked: sessions.length,
      sent,
      skipped,
    }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('[alex-ghost] error:', err)
    await sql.end().catch(() => {})
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS })
  }
})
