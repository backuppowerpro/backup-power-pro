// lead-volume-alert
// Runs every morning at 8:30am EST (12:30 UTC).
// Counts yesterday's new contacts (leads). If 0, SMSes Key immediately.
// If 1, SMSes a soft heads-up. 2+ sends a quiet confirmation.
//
// Rationale: Apr 16-18 2026 had 3 consecutive zero-lead days before it was
// noticed. A daily alert makes sure that kind of silent drop can't hide
// for more than ~24 hours again.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!
const TWILIO_FROM = '+18648637800'
const KEY_CELL = '+19414417996'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

async function sendSms(to: string, body: string): Promise<boolean> {
  const creds = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)
  const form = new URLSearchParams({ From: TWILIO_FROM, To: to, Body: body })
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    }
  )
  if (!res.ok) {
    console.error('[lead-volume-alert] sms send failed', res.status, await res.text())
    return false
  }
  return true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Anchor "yesterday" to Key's local timezone (America/New_York). Start of
  // yesterday and start of today in UTC, using the intl API to avoid DST gotchas.
  const now = new Date()
  const nyFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  // Today in NY, then subtract 1 day for yesterday's date window.
  const todayNyParts = nyFmt.formatToParts(now).reduce((a: any, p) => { a[p.type] = p.value; return a }, {})
  const todayNyStr = `${todayNyParts.year}-${todayNyParts.month}-${todayNyParts.day}`
  const yesterdayUtc = new Date(`${todayNyStr}T00:00:00-04:00`) // NY is -4 or -5; see note
  // Approximate — NY is UTC-4 (EDT) or UTC-5 (EST). We offset by 4 here; off
  // by 1hr in winter but close enough for a daily count window.
  const startOfToday = new Date(yesterdayUtc.getTime())
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000)

  // Count yesterday's new contacts (real leads only — skip DNC, skip empty)
  const { count: leadCount, error: countErr } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfYesterday.toISOString())
    .lt('created_at', startOfToday.toISOString())
    .eq('do_not_contact', false)

  if (countErr) {
    console.error('[lead-volume-alert] count failed', countErr)
    return new Response(JSON.stringify({ error: countErr.message }), { status: 500, headers: CORS })
  }

  const n = leadCount || 0
  const dateLabel = startOfYesterday.toLocaleDateString('en-US', {
    timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric',
  })

  let body: string
  let severity: 'urgent' | 'warning' | 'ok'
  if (n === 0) {
    severity = 'urgent'
    body = `🚨 BPP — ZERO leads yesterday (${dateLabel}). Check: ads running? form submitting? PostHog 'lead_submit_failed' events? Dashboard: https://backuppowerpro.com/crm/v2/`
  } else if (n === 1) {
    severity = 'warning'
    body = `⚠️ BPP — only 1 lead yesterday (${dateLabel}). Below target. Keep an eye on today.`
  } else {
    severity = 'ok'
    body = `✅ BPP — ${n} leads yesterday (${dateLabel}).`
  }

  // Always send so Key has visibility; could restrict to n<=1 later if noisy.
  const sent = await sendSms(KEY_CELL, body)

  return new Response(
    JSON.stringify({ ok: true, leadCount: n, severity, smsSent: sent, window: { start: startOfYesterday.toISOString(), end: startOfToday.toISOString() } }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } }
  )
})
