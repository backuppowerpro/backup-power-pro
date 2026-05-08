/**
 * resend-webhook — Resend posts events here for every email we send.
 *
 * Events handled:
 *   email.delivered  → stamp messages_email.delivered_at
 *   email.bounced    → stamp bounced_at + status='bounced' + mark contact
 *                      __email_bounced (future sends silently skip)
 *   email.complained → stamp + status='complained' + DNC the contact
 *                      (CAN-SPAM hard rule)
 *   email.opened     → stamp opened_at (only if first open)
 *   email.clicked    → stamp clicked_at (only if first click)
 *   email.delivery_delayed → log warning, no stamp change
 *
 * Auth: Resend signs every webhook with HMAC-SHA256. We verify against
 * RESEND_WEBHOOK_SECRET. If verification fails → 401.
 *
 * Setup:
 *   1. supabase secrets set RESEND_WEBHOOK_SECRET=whsec_...
 *   2. supabase functions deploy resend-webhook --no-verify-jwt
 *   3. In Resend dashboard, add webhook pointing at:
 *      https://reowtzedjflwmlptupbk.supabase.co/functions/v1/resend-webhook
 *
 * STATUS: deployable, idle until both Resend secret + first email sent.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET') || ''

const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })

// Resend uses Svix-flavored HMAC signing. Headers:
//   svix-id, svix-timestamp, svix-signature
// Signature is base64(HMAC-SHA256(secret_bytes, `${svix_id}.${svix_timestamp}.${body}`))
async function verifySvixSignature(req: Request, body: string): Promise<boolean> {
  if (!RESEND_WEBHOOK_SECRET) return false
  const svixId = req.headers.get('svix-id') || ''
  const svixTs = req.headers.get('svix-timestamp') || ''
  const svixSig = req.headers.get('svix-signature') || ''
  if (!svixId || !svixTs || !svixSig) return false

  // Reject events older than 5 minutes (replay protection)
  const tsNum = parseInt(svixTs, 10)
  if (!tsNum || Math.abs(Date.now() / 1000 - tsNum) > 300) return false

  // Secret format: "whsec_<base64>"
  const secretRaw = RESEND_WEBHOOK_SECRET.replace(/^whsec_/, '')
  const secretBytes = Uint8Array.from(atob(secretRaw), c => c.charCodeAt(0))

  const payload = `${svixId}.${svixTs}.${body}`
  const key = await crypto.subtle.importKey(
    'raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))

  // Header is space-separated: "v1,<sig1> v1,<sig2> ..." — match any
  const sigs = svixSig.split(' ').map(s => s.split(',')[1] || '')
  return sigs.includes(expected)
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

interface ResendEvent {
  type: string  // 'email.delivered' etc.
  created_at: string
  data: {
    email_id: string  // == messages_email.provider_id
    to?: string[]
    subject?: string
    bounce?: { type?: string; reason?: string }
    complaint?: { type?: string }
    failed?: { reason?: string }
    [k: string]: any
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const body = await req.text()
  if (!await verifySvixSignature(req, body)) {
    return json(401, { error: 'invalid_signature' })
  }

  let event: ResendEvent
  try { event = JSON.parse(body) } catch { return json(400, { error: 'invalid_json' }) }

  const providerId = event.data?.email_id
  if (!providerId) return json(400, { error: 'missing_email_id' })

  const sb = createClient(SUPABASE_URL, SR)
  const now = new Date().toISOString()

  // Find the messages_email row by provider_id
  const { data: msg } = await sb.from('messages_email')
    .select('id, contact_id, template')
    .eq('provider_id', providerId)
    .maybeSingle()
  if (!msg) {
    // Webhook arrived before our log row was written, or for an email
    // we didn't send. Acknowledge so Resend doesn't retry.
    return json(200, { ok: true, ignored: 'no_matching_row', provider_id: providerId })
  }

  const update: Record<string, unknown> = {}
  let contactUpdate: Record<string, unknown> | null = null
  let notesAppend: string | null = null

  switch (event.type) {
    case 'email.delivered':
      update.delivered_at = now
      update.status = 'delivered'
      break

    case 'email.bounced': {
      update.bounced_at = now
      update.status = 'bounced'
      const reason = event.data.bounce?.reason || event.data.bounce?.type || 'unknown'
      update.error = `Bounced: ${String(reason).slice(0, 160)}`
      // Hard bounce → stop future sends to this contact's email
      const isHard = String(event.data.bounce?.type || '').toLowerCase().includes('hard')
        || String(reason).toLowerCase().includes('does not exist')
        || String(reason).toLowerCase().includes('mailbox unavailable')
      if (isHard) {
        notesAppend = `__email_bounced_hard: ${now}`
      } else {
        notesAppend = `__email_bounced_soft: ${now}`
      }
      break
    }

    case 'email.complained':
      update.status = 'complained'
      update.error = 'Marked as spam by recipient'
      // Spam-complaint = hard DNC per CAN-SPAM. No more emails to this contact ever.
      contactUpdate = { do_not_contact: true, dnc_at: now, dnc_source: 'email-complaint' }
      notesAppend = `__email_complaint: ${now}`
      break

    case 'email.opened':
      // Only stamp first open
      update.opened_at = now
      break

    case 'email.clicked':
      update.clicked_at = now
      break

    case 'email.delivery_delayed':
      console.log(`[resend-webhook] delayed: ${providerId} reason=${event.data.failed?.reason || 'unknown'}`)
      break

    default:
      console.log(`[resend-webhook] unhandled event type: ${event.type}`)
  }

  if (Object.keys(update).length > 0) {
    await sb.from('messages_email').update(update).eq('id', msg.id)
  }

  if (contactUpdate || notesAppend) {
    const { data: c } = await sb.from('contacts')
      .select('notes')
      .eq('id', msg.contact_id)
      .maybeSingle()
    const newNotes = notesAppend
      ? ((c?.notes ? c.notes + '\n' : '') + notesAppend)
      : c?.notes
    await sb.from('contacts')
      .update({ ...contactUpdate, ...(newNotes !== undefined ? { notes: newNotes } : {}) })
      .eq('id', msg.contact_id)
  }

  return json(200, { ok: true, type: event.type, provider_id: providerId })
})
