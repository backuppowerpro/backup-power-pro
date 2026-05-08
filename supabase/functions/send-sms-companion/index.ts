/**
 * send-sms-companion — fires the SMS counterpart to a customer-facing
 * email. Hardcoded template registry mirrors email-templates/sms-companions.md.
 *
 * Pattern: dispatch this 30-60s AFTER the corresponding email so the
 * customer doesn't see two notifications buzz at once.
 *
 * Auth: brain-token only (internal trigger from send-email or cron).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { timingSafeEqual } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BPP_BRAIN_TOKEN = Deno.env.get('BPP_BRAIN_TOKEN') || ''

// SMS providers
const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || ''
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || ''
const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER') || ''
const QUO_API_KEY = Deno.env.get('QUO_API_KEY') || ''
const QUO_PHONE_ID = Deno.env.get('QUO_PHONE_ID') || ''
const OPENPHONE_TEST_PHONES = (Deno.env.get('ASHLEY_OPENPHONE_TEST_PHONES') || '')
  .split(',').map(s => s.trim()).filter(Boolean)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-bpp-brain-token',
}
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

// ── Template registry ───────────────────────────────────────────────
//
// Each entry returns the SMS body, given the substituted vars. Keep
// every template <= 160 chars at typical inputs (Key voice; we leave
// ~12-15 chars of room for variable expansion).
//
// IMPORTANT: keep these in sync with email-templates/sms-companions.md.
// If you edit copy here, edit the doc too (Key reads the doc, not this
// file, when deciding whether the tone is right).

type TemplateKey =
  | 'proposal-sent'
  | 'quote-followup-48h'
  | 'install-reminder-24h'
  | 'install-arrival'
  | 'completion'
  | 'invoice'
  | 'permit-document'
  | 'permit-mail-confirm'
  | 'permit-approved'
  | 'review-request'
  | 'storm-prep-reminder'

interface Vars {
  first_name?: string
  address_short?: string
  arrival_window?: string
  eta_time?: string
  total?: string
  stripe_url?: string
  review_url?: string
  date?: string
}

const TEMPLATES: Record<TemplateKey, (v: Vars) => string> = {
  'proposal-sent': (v) =>
    `Hey ${v.first_name || 'there'}, Key here. Just sent your install quote to your email. Gave ${v.address_short || 'the install'} a thorough look. Take a sec when you can.`,

  'quote-followup-48h': (v) =>
    `${v.first_name || 'Hey'}, no rush on the quote, just checking in. Anything I can clear up before you decide? Or one-word "pass" and I'll close the file.`,

  'install-reminder-24h': (v) =>
    `${v.first_name || 'Hey'}, install day is tomorrow at ${v.address_short || 'your place'}. I'll be there between ${v.arrival_window || 'morning'}. Reply YES to confirm or text if anything changed.`,

  'install-arrival': (v) =>
    `On my way, ${v.first_name || 'there'}. Black GMC with BPP decal. ETA ${v.eta_time || 'shortly'} at ${v.address_short || 'your place'}. Knock once when I get there. Text if anything's off.`,

  'completion': (v) =>
    `All wrapped up, ${v.first_name || 'there'}. Tested clean. Sent the photos + your owner's manual to your email. Permit closeout goes to the county Monday.`,

  'invoice': (v) =>
    `Invoice for your install: $${v.total || '1,247'}. Pay securely: ${v.stripe_url || ''} Receipt arrives instantly. Questions, just text back.`,

  'permit-document': (v) =>
    `${v.first_name || 'Hey'}, just emailed your county permit doc, needs your signature before install day. Print at home or tap "Mail it to me" in the email.`,

  'permit-mail-confirm': (v) =>
    `Got it, ${v.first_name || 'thanks'}. Dropping your permit doc in the mail today. Should land in 2 to 4 business days. Sign + drop in the return envelope.`,

  'permit-approved': (v) =>
    `${v.first_name || 'Hey'}, inspector signed off this morning, your install is officially closed-out. 2-year workmanship warranty starts today.`,

  'review-request': (v) =>
    `${v.first_name || 'Hey'}, hope it's running clean. If you've got 30 sec, a Google review really helps: ${v.review_url || ''} Anything off? Text me first.`,

  'storm-prep-reminder': (v) =>
    `Hurricane season starts ${v.date || 'soon'}, ${v.first_name || 'there'}. 10 min test cycle this weekend = no surprises in October. Full checklist in your email.`,
}

const MARKETING_TEMPLATES: Set<TemplateKey> = new Set(['storm-prep-reminder'])

// ── SMS send helpers ────────────────────────────────────────────────
async function sendOpenPhone(to: string, body: string): Promise<{ ok: boolean; err?: string }> {
  if (!QUO_API_KEY || !QUO_PHONE_ID) return { ok: false, err: 'openphone creds missing' }
  try {
    const r = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: QUO_API_KEY },
      body: JSON.stringify({ from: QUO_PHONE_ID, to: [to], content: body }),
    })
    if (!r.ok) return { ok: false, err: `openphone ${r.status} ${(await r.text()).slice(0, 200)}` }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, err: String(e?.message || e).slice(0, 200) }
  }
}

async function sendTwilio(to: string, body: string): Promise<{ ok: boolean; err?: string }> {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) return { ok: false, err: 'twilio creds missing' }
  try {
    const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }).toString(),
    })
    if (!r.ok) return { ok: false, err: `twilio ${r.status} ${(await r.text()).slice(0, 200)}` }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, err: String(e?.message || e).slice(0, 200) }
  }
}

// ── Server entry ────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const provided = req.headers.get('x-bpp-brain-token') || ''
  if (!BPP_BRAIN_TOKEN || !timingSafeEqual(provided, BPP_BRAIN_TOKEN)) {
    return json(401, { error: 'unauthorized' })
  }

  let body: { contact_id?: string; template?: TemplateKey; variables?: Vars; dry_run?: boolean }
  try { body = await req.json() } catch { return json(400, { error: 'invalid_json' }) }

  if (!body.contact_id || !body.template) {
    return json(400, { error: 'missing_fields', need: ['contact_id', 'template'] })
  }
  const tpl = TEMPLATES[body.template]
  if (!tpl) return json(400, { error: 'unknown_template', template: body.template })

  const sb = createClient(SUPABASE_URL, SR)
  const { data: contact, error } = await sb.from('contacts')
    .select('id, name, phone, do_not_contact, notes')
    .eq('id', body.contact_id)
    .maybeSingle()
  if (error || !contact) return json(404, { error: 'contact_not_found' })

  // DNC gate (TCPA)
  if (contact.do_not_contact) return json(200, { ok: true, skipped: 'dnc' })
  if (!contact.phone) return json(200, { ok: true, skipped: 'no_phone' })

  // Marketing opt-out gate (only applies to marketing-class templates)
  if (MARKETING_TEMPLATES.has(body.template)) {
    const notes = String(contact.notes || '')
    if (notes.includes('__sms_marketing_off') || notes.includes('__email_marketing_off')) {
      return json(200, { ok: true, skipped: 'marketing_opt_out' })
    }
  }

  // Auto-derive first_name
  const firstName = String(contact.name || '').split(/\s+/)[0]
  const vars: Vars = { first_name: firstName, ...(body.variables || {}) }
  const text = tpl(vars).trim()

  // Char count guard rail
  const segments = Math.ceil(text.length / 160)
  if (segments > 1) {
    console.warn(`[send-sms-companion] template ${body.template} expanded to ${text.length} chars (${segments} segments). Consider tightening copy.`)
  }

  if (body.dry_run) {
    return json(200, { ok: true, dry_run: true, body: text, length: text.length, segments })
  }

  // Route: OpenPhone if customer phone is on the allowlist (matches Ashley's
  // routing pattern). Otherwise Twilio direct.
  const useOpenPhone = OPENPHONE_TEST_PHONES.includes('*')
    || OPENPHONE_TEST_PHONES.includes(contact.phone)
  const provider = useOpenPhone ? 'openphone' : 'twilio'
  const send = useOpenPhone
    ? await sendOpenPhone(contact.phone, text)
    : await sendTwilio(contact.phone, text)

  // Log to messages table for CRM thread continuity. Best-effort.
  try {
    await sb.from('messages').insert({
      contact_id: contact.id,
      direction: 'outbound',
      body: text,
      sender: 'key',
      sender_phone: useOpenPhone ? (Deno.env.get('QUO_PHONE_NUMBER') || '+18644005302') : TWILIO_FROM,
      status: send.ok ? 'sent' : 'failed',
      quo_message_id: `companion-${body.template}-${Date.now()}`,
    })
  } catch (_) { /* non-blocking */ }

  if (!send.ok) {
    return json(502, { error: 'send_failed', provider, detail: send.err, body: text })
  }

  return json(200, { ok: true, provider, body: text, length: text.length, segments, template: body.template })
})
