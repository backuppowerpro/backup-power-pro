/**
 * stage1-diagnostic — answers: "of the 62 Stage 1 leads, how many is Alex
 * actually working, and which ones are dark?"
 *
 * The brief says 62 frozen leads at $29 CPL = $1,800 of stuck spend. Before
 * shipping any new feature today, Key needs to know which specific leads
 * have NEVER had outbound contact (or had it >7d ago) so he can call them
 * himself this morning.
 *
 * Cross-checks two tables:
 *   contacts (where stage=1, not archived, not DNC)
 *   alex_sessions (where phone matches contact.phone)
 *
 * Buckets each lead:
 *   green  — alex_active session with outbound in last 72h
 *   yellow — alex_active session, outbound 72h–7d ago, < MAX_FOLLOWUPS
 *   red    — no session at all, OR session deactivated, OR no outbound > 7d
 *
 * Returns counts + the top 10 oldest red leads with phone, name, age,
 * last-outbound, ready for Key to call.
 *
 * Auth: requires SR key OR x-bpp-brain-token (same gate as crm-stats).
 * Read-only — no writes.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { timingSafeEqual, allowRate } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-bpp-brain-token',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const url = Deno.env.get('SUPABASE_URL')!
  const sr  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const BRAIN_TOKEN = Deno.env.get('BPP_BRAIN_TOKEN') || ''

  // ── Auth gate (same shape as crm-stats) ─────────────────────────────────
  const authHdr = req.headers.get('authorization') || ''
  const apiKey  = req.headers.get('apikey') || ''
  const bearer  = authHdr.toLowerCase().startsWith('bearer ') ? authHdr.slice(7).trim() : ''
  const sentToken = req.headers.get('x-bpp-brain-token') || ''

  const srMatches    = !!sr && (timingSafeEqual(bearer, sr) || timingSafeEqual(apiKey, sr))
  const tokenMatches = !!BRAIN_TOKEN && timingSafeEqual(sentToken, BRAIN_TOKEN)

  if (!srMatches && !tokenMatches) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowRate(`stage1-diag:${ip}`, 30)) {
    return new Response(JSON.stringify({ error: 'rate limited' }), {
      status: 429, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const sb = createClient(url, sr)
  const now = Date.now()
  const seventyTwoHoursAgo = now - 72 * 3600000
  const sevenDaysAgo       = now - 7  * 86400000

  // ── Stage 1 contacts (active, non-DNC) ──────────────────────────────────
  const { data: contacts, error: cErr } = await sb
    .from('contacts')
    .select('id, name, phone, stage, status, do_not_contact, ai_enabled, ai_paused_until, created_at')
    .eq('stage', 1)
    .neq('status', 'Archived')
    .order('created_at', { ascending: true })
    .limit(200)

  if (cErr) {
    return new Response(JSON.stringify({ error: 'contacts query failed', detail: cErr.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const stage1 = (contacts || []).filter((c: any) => !c.do_not_contact)

  if (stage1.length === 0) {
    return new Response(JSON.stringify({
      ok: true, stage1_count: 0, message: 'no Stage 1 contacts',
    }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // ── Pull all alex_sessions for these phones in one shot ─────────────────
  const phones = [...new Set(stage1.map((c: any) => c.phone).filter(Boolean))]
  const { data: sessions } = await sb
    .from('alex_sessions')
    .select('phone, status, alex_active, key_active, opted_out, followup_count, last_outbound_at, customer_last_msg_at, created_at, photo_received')
    .in('phone', phones)

  // Index by phone — pick the most recently active/recent session per phone
  const sessByPhone: Record<string, any> = {}
  for (const s of sessions || []) {
    const prev = sessByPhone[s.phone]
    if (!prev) { sessByPhone[s.phone] = s; continue }
    const sTime = new Date(s.last_outbound_at || s.created_at || 0).getTime()
    const pTime = new Date(prev.last_outbound_at || prev.created_at || 0).getTime()
    if (sTime > pTime) sessByPhone[s.phone] = s
  }

  // ── Bucket each Stage 1 contact ─────────────────────────────────────────
  const buckets = { green: 0, yellow: 0, red: 0 }
  type Lead = {
    name: string; phone: string;
    age_days: number; last_outbound: string | null;
    bucket: 'green' | 'yellow' | 'red';
    reason: string;
    ai_enabled: boolean; ai_paused: boolean;
    has_session: boolean; session_active: boolean;
    photo_received: boolean;
    followup_count: number;
    customer_replied: boolean;
  }
  const leads: Lead[] = []

  for (const c of stage1) {
    const sess = sessByPhone[c.phone]
    const ageDays = Math.floor((now - new Date(c.created_at).getTime()) / 86400000)
    const aiPaused = !!c.ai_paused_until && new Date(c.ai_paused_until).getTime() > now

    let bucket: 'green' | 'yellow' | 'red'
    let reason: string

    if (!sess) {
      bucket = 'red'
      reason = 'no Alex session created'
    } else if (sess.opted_out || sess.do_not_contact || sess.status === 'opted_out') {
      bucket = 'red'
      reason = 'opted out'
    } else if (sess.status === 'undeliverable') {
      bucket = 'red'
      reason = 'SMS delivery failed'
    } else if (sess.status === 'expired') {
      bucket = 'red'
      reason = 'session expired (>30d)'
    } else if (!sess.alex_active) {
      bucket = 'red'
      reason = sess.key_active ? 'key took over (manual)' : 'alex deactivated'
    } else if (sess.followup_count >= 4) {
      bucket = 'red'
      reason = 'max follow-ups reached, no reply'
    } else {
      const lastOut = new Date(sess.last_outbound_at || sess.created_at || 0).getTime()
      if (lastOut >= seventyTwoHoursAgo) {
        bucket = 'green'
        reason = 'active, recent outbound'
      } else if (lastOut >= sevenDaysAgo) {
        bucket = 'yellow'
        reason = 'active, last outbound 3-7d ago'
      } else {
        bucket = 'red'
        reason = 'active session but no outbound in 7+ days'
      }
    }

    buckets[bucket]++
    leads.push({
      name: c.name || '(no name)',
      phone: c.phone || '',
      age_days: ageDays,
      last_outbound: sess?.last_outbound_at || null,
      bucket,
      reason,
      ai_enabled: !!c.ai_enabled,
      ai_paused: aiPaused,
      has_session: !!sess,
      session_active: !!(sess?.alex_active && !sess?.opted_out && sess?.status === 'active'),
      photo_received: !!sess?.photo_received,
      followup_count: sess?.followup_count || 0,
      customer_replied: !!sess?.customer_last_msg_at,
    })
  }

  // ── Top 10 red leads (oldest first), and 5 yellow (oldest first) ────────
  const redLeads = leads
    .filter(l => l.bucket === 'red')
    .sort((a, b) => b.age_days - a.age_days)
    .slice(0, 10)
  const yellowLeads = leads
    .filter(l => l.bucket === 'yellow')
    .sort((a, b) => b.age_days - a.age_days)
    .slice(0, 5)

  // ── Reason histogram for the red bucket ─────────────────────────────────
  const redReasons: Record<string, number> = {}
  for (const l of leads) {
    if (l.bucket !== 'red') continue
    redReasons[l.reason] = (redReasons[l.reason] || 0) + 1
  }

  return new Response(JSON.stringify({
    ok: true,
    stage1_count: stage1.length,
    buckets,
    red_reasons: redReasons,
    red_leads: redLeads,
    yellow_leads: yellowLeads,
    generated_at: new Date().toISOString(),
  }, null, 2), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
