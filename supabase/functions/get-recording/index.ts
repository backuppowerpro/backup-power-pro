/**
 * get-recording
 *
 * Proxy that fetches a Twilio call recording MP3 server-side (with Basic auth)
 * and streams it back to the browser. Needed because Twilio recording URLs
 * require HTTP Basic auth (AccountSid:AuthToken) which browser Audio can't send.
 *
 * GET /get-recording?sid=RECORDING_SID
 *
 * Auth: requireAnonOrServiceRole (timing-safe). Apr 27 — replaced the banned
 *   `authHeader.includes(ANON_KEY.slice(-20))` pattern, which (a) fails open
 *   when ANON_KEY is empty in env (`''.includes('') === true`) and (b) leaks
 *   acceptance criteria into every public landing page that ships the anon
 *   key in plaintext. CLAUDE.md hard rule.
 */

import { requireAnonOrServiceRole, allowRate } from '../_shared/auth.ts'

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || ''
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN') || ''

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
  }

  // Validate caller — must send the anon key (or service role)
  const gate = requireAnonOrServiceRole(req)
  if (gate) return gate

  // Per-IP rate limit so a leaked anon key can't be turned into a recording
  // scraper. 30/min is plenty for Key replaying recent calls in the CRM.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowRate(`get-recording:${ip}`, 30)) {
    return new Response(JSON.stringify({ error: 'rate limited' }), {
      status: 429,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(req.url)
  const sid = (url.searchParams.get('sid') || '').trim()

  if (!sid || !/^RE[a-f0-9]{32}$/i.test(sid)) {
    return new Response(JSON.stringify({ error: 'invalid recording sid' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return new Response(JSON.stringify({ error: 'twilio credentials not configured' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${sid}.mp3`
  const basicAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)

  let twilioRes: Response
  try {
    twilioRes = await fetch(twilioUrl, {
      headers: { Authorization: `Basic ${basicAuth}` },
    })
  } catch (err) {
    console.error('[get-recording] fetch failed:', err)
    return new Response(JSON.stringify({ error: 'failed to fetch recording' }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  if (!twilioRes.ok) {
    return new Response(JSON.stringify({ error: `twilio returned ${twilioRes.status}` }), {
      status: twilioRes.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // Stream the audio back — pass through content-type and content-length
  const responseHeaders: Record<string, string> = {
    ...CORS_HEADERS,
    'Content-Type': twilioRes.headers.get('Content-Type') || 'audio/mpeg',
    'Cache-Control': 'private, max-age=3600',
  }
  const contentLength = twilioRes.headers.get('Content-Length')
  if (contentLength) responseHeaders['Content-Length'] = contentLength

  return new Response(twilioRes.body, {
    status: 200,
    headers: responseHeaders,
  })
})
