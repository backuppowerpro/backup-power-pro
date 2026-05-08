/**
 * request-permit-mailing — fires when the customer clicks the "Mail it to me"
 * button in the permit-document email. Texts Key with the address + records
 * the request on the contact, then renders a plain "Got it" success page.
 *
 * Public endpoint, NOT brain-token gated, but every request requires a
 * signed token in the URL ?t= param (HMAC of contact_id with a server-only
 * MAIL_REQUEST_SECRET). Token has a 14-day TTL.
 *
 * URL pattern (rendered into the permit-document email at send time):
 *   https://reowtzedjflwmlptupbk.supabase.co/functions/v1/request-permit-mailing
 *     ?cid={contact_id}&t={token}
 *
 * Token generation (Node/Deno-compatible):
 *   const ts = Math.floor(Date.now() / 1000);
 *   const payload = `${contact_id}.${ts}`;
 *   const sig = hmacSha256(MAIL_REQUEST_SECRET, payload);
 *   const token = base64url(`${ts}.${sig}`);
 *
 * Validation:
 *   1. Decode token, split into [ts, sig].
 *   2. Verify ts is within 14 days.
 *   3. Recompute HMAC; timing-safe compare.
 *
 * Side effects:
 *   - Stamps contacts.qualification_data.permit_mailing_requested_at
 *   - Appends to contacts.notes: __permit_mail_requested: <ISO>
 *   - Texts Key (via OpenPhone for OP-allowed phones, else Twilio)
 *
 * Response: HTML page (200) confirming the request to the customer, or
 * plain-text error (400/410) if token invalid/expired.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SECRET = Deno.env.get('MAIL_REQUEST_SECRET') || ''
const KEY_CELL = Deno.env.get('KEY_PHONE') || '+19414417996'

// SMS providers
const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || ''
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || ''
const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER') || ''
const QUO_API_KEY = Deno.env.get('QUO_API_KEY') || ''
const QUO_INTERNAL_PHONE_ID = Deno.env.get('QUO_INTERNAL_PHONE_ID') || 'PNPhgKi0ua'
const OPENPHONE_TEST_PHONES = (Deno.env.get('ASHLEY_OPENPHONE_TEST_PHONES') || '')
  .split(',').map(s => s.trim()).filter(Boolean)

const MAX_TOKEN_AGE_SEC = 14 * 24 * 3600

const html = (status: number, body: string) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })

function base64UrlDecode(s: string): Uint8Array {
  const pad = s.length % 4
  if (pad) s += '='.repeat(4 - pad)
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(s)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf
}

async function hmacSha256(secret: string, msg: string): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg))
  return new Uint8Array(sig)
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i]
  return r === 0
}

async function verifyToken(contact_id: string, token: string): Promise<boolean> {
  if (!SECRET || !token) return false
  try {
    const decoded = new TextDecoder().decode(base64UrlDecode(token))
    const dot = decoded.indexOf('.')
    if (dot < 0) return false
    const ts = parseInt(decoded.slice(0, dot), 10)
    const sig = decoded.slice(dot + 1)
    if (!ts || !sig) return false
    const ageSec = Math.floor(Date.now() / 1000) - ts
    if (ageSec < 0 || ageSec > MAX_TOKEN_AGE_SEC) return false
    const expected = await hmacSha256(SECRET, `${contact_id}.${ts}`)
    const expectedHex = Array.from(expected).map(b => b.toString(16).padStart(2, '0')).join('')
    const sigBytes = new TextEncoder().encode(sig)
    const expectedBytes = new TextEncoder().encode(expectedHex)
    return timingSafeEqual(sigBytes, expectedBytes)
  } catch {
    return false
  }
}

async function notifyKey(message: string): Promise<void> {
  // Prefer OpenPhone if Key's phone is on the allowlist (matches Ashley's pattern).
  const useOpenPhone = OPENPHONE_TEST_PHONES.includes('*')
    || OPENPHONE_TEST_PHONES.includes(KEY_CELL)
  if (useOpenPhone && QUO_API_KEY) {
    try {
      await fetch('https://api.openphone.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: QUO_API_KEY },
        body: JSON.stringify({
          from: QUO_INTERNAL_PHONE_ID,
          to: [KEY_CELL],
          content: message,
        }),
      })
      return
    } catch (e) {
      console.warn('[request-permit-mailing] openphone failed', e)
    }
  }
  if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
    try {
      const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: KEY_CELL, From: TWILIO_FROM, Body: message }).toString(),
      })
    } catch (e) {
      console.warn('[request-permit-mailing] twilio failed', e)
    }
  }
}

const SUCCESS_HTML = (firstName: string, addressOnFile: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Got it · Backup Power Pro</title>
<style>
  body { margin: 0; min-height: 100vh; background: #f4f6fa; color: #14172a;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .card { width: 100%; max-width: 540px; background: #ffffff; border-radius: 12px;
    box-shadow: 0 8px 28px rgba(11,31,59,0.10); overflow: hidden; }
  .top { background: #0b1f3b; padding: 18px 28px; border-bottom: 3px solid #ffba00;
    color: #ffffff; font-family: 'Outfit', 'Inter', sans-serif; font-weight: 800; font-size: 18px;
    letter-spacing: -0.02em; }
  .top .pro { color: #ffba00; }
  .body { padding: 36px 32px; }
  .pill { display: inline-block; background: #fff8e0; border: 1.5px solid #ffba00; border-radius: 100px;
    padding: 6px 16px; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 11px;
    letter-spacing: 0.18em; text-transform: uppercase; color: #8a5a00; margin-bottom: 18px; }
  h1 { font-family: 'Outfit', 'Inter', sans-serif; font-weight: 800; font-size: 30px; line-height: 1.15;
    letter-spacing: -0.02em; color: #0b1f3b; margin: 0 0 16px 0; }
  p { font-size: 16px; line-height: 1.55; color: #14172a; margin: 0 0 14px 0; }
  .meta { background: #f4f6fa; border: 1px solid rgba(11,31,59,0.07); border-radius: 10px;
    padding: 18px 20px; font-size: 14px; color: #14172a; margin-top: 18px; }
  .meta strong { color: #0b1f3b; font-weight: 600; }
  .foot { padding: 14px 28px; background: #fafbfc; border-top: 1px solid rgba(11,31,59,0.06);
    font-size: 12px; color: #6b7280; }
</style></head>
<body>
<div class="card">
  <div class="top">Backup Power <span class="pro">Pro</span></div>
  <div class="body">
    <span class="pill">★ Got it</span>
    <h1>Coming your way${firstName ? ', ' + firstName : ''}.</h1>
    <p>I'll drop your permit application in the mail today, with a pre-stamped envelope back to me. Should land in 2 to 4 business days.</p>
    <p>Sign the bottom in black or blue pen, drop it in the return envelope, that's it.</p>
    <div class="meta">
      <strong>Mailing to:</strong><br />
      ${addressOnFile || '(address on file)'}
    </div>
    <p style="margin-top: 18px; font-size: 13px; color: #6b7280;">If something looks wrong with that address, just reply to the email I sent or text me at (864) 863-7800.</p>
  </div>
  <div class="foot">Backup Power Pro · SC Licensed Electrician · Greenville, SC</div>
</div>
</body></html>`

const ERROR_HTML = (msg: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>Hmm · Backup Power Pro</title>
<style>body { font-family: -apple-system, sans-serif; padding: 48px 24px; max-width: 540px; margin: 0 auto; color: #14172a; }
h1 { color: #0b1f3b; font-size: 24px; margin: 0 0 12px 0; }
p { line-height: 1.55; color: #4a4a5a; }
a { color: #0b1f3b; }</style></head>
<body><h1>That link didn't work</h1><p>${msg}</p>
<p>Just text me at <a href="tel:+18648637800">(864) 863-7800</a> and I'll handle it directly.</p>
<p style="margin-top: 32px; font-size: 12px; color: #6b7280;">Backup Power Pro</p>
</body></html>`

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const cid = url.searchParams.get('cid') || ''
  const token = url.searchParams.get('t') || ''

  if (!cid || !token) return html(400, ERROR_HTML('Looks like part of the link is missing.'))

  const ok = await verifyToken(cid, token)
  if (!ok) return html(410, ERROR_HTML('That link expired (links work for 14 days). Send a fresh one and try again.'))

  const sb = createClient(SUPABASE_URL, SR)
  const { data: contact, error } = await sb.from('contacts')
    .select('id, name, phone, install_address, address, qualification_data, notes')
    .eq('id', cid)
    .maybeSingle()
  if (error || !contact) return html(404, ERROR_HTML('We could not find your record.'))

  // Idempotent: if already requested in the last 24h, just show the success page again
  // without firing another Key alert (so duplicate clicks don't spam).
  const qd = (contact.qualification_data || {}) as Record<string, unknown>
  const lastReq = String(qd.permit_mailing_requested_at || '')
  const recentlyRequested = lastReq
    ? (Date.now() - new Date(lastReq).getTime()) < 24 * 3600 * 1000
    : false

  const firstName = String(contact.name || '').split(/\s+/)[0] || ''
  const addr = String(contact.install_address || contact.address || '')

  if (!recentlyRequested) {
    // Stamp request + alert Key
    const newQd = { ...qd, permit_mailing_requested_at: new Date().toISOString() }
    const newNotes = (contact.notes ? contact.notes + '\n' : '')
      + `__permit_mail_requested: ${new Date().toISOString()}`
    try {
      await sb.from('contacts')
        .update({ qualification_data: newQd, notes: newNotes })
        .eq('id', cid)
    } catch (e) {
      console.warn('[request-permit-mailing] stamp failed', e)
    }
    const message = `📬 PERMIT MAIL REQUEST · ${firstName || 'Customer'}` +
      ` (${(contact.phone || '').slice(-4)})` +
      `\n${addr || '(no address on file)'}\n\nDrop in mail today.`
    await notifyKey(message)
  }

  return html(200, SUCCESS_HTML(firstName, addr))
})
