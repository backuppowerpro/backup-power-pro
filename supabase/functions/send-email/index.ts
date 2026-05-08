/**
 * send-email — BPP transactional + lifecycle email dispatcher.
 *
 * Reads HTML templates from email-templates/, performs simple {{variable}}
 * substitution, sends via Resend. Honors contacts.do_not_contact + email
 * preferences markers in notes.
 *
 * STATUS: SCAFFOLD. Not deployed yet. To activate:
 *   1. supabase secrets set RESEND_API_KEY=re_...
 *   2. Deploy templates to Supabase storage bucket `email-templates` OR
 *      bundle them into _shared/templates/ (smaller volume, simpler).
 *   3. Wire trigger: bot-engine on COMPLETE -> POST send-email
 *      with template=proposal, contact_id=...
 *   4. Test against a known-allowlisted email before opening to real customers.
 *
 * Templates expected (from /email-templates/):
 *   welcome, proposal, install-reminder, completion, invoice, review,
 *   pdf-download, permit-approved, storm-prep-reminder, anniversary,
 *   referral-nudge
 *
 * Auth: brain-token only (internal); customer-facing trigger via bot-engine.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { timingSafeEqual } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const BPP_BRAIN_TOKEN = Deno.env.get('BPP_BRAIN_TOKEN') || ''

const FROM_NAME = 'Key at Backup Power Pro'
const FROM_EMAIL = 'key@backuppowerpro.com'

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

interface SendInput {
  template:
    | 'welcome'
    | 'proposal'
    | 'install-reminder'
    | 'completion'
    | 'invoice'
    | 'review'
    | 'pdf-download'
    | 'permit-approved'
    | 'storm-prep-reminder'
    | 'anniversary'
    | 'referral-nudge'
  contact_id: string
  subject: string  // per-send; overrides template <title>
  variables?: Record<string, string>  // map of {{var}} -> string
  attachments?: Array<{ filename: string; url: string }>  // signed URLs
  reply_to?: string
}

// Templates are bundled at deploy. In production point this at a Supabase
// storage bucket OR bundle directly via _shared/templates/{name}.html.
async function loadTemplate(name: string): Promise<string | null> {
  // SCAFFOLD: replace with actual template loading.
  // Option A: storage bucket fetch
  // Option B: bundled-at-deploy file read (simpler, recommended)
  // Option C: hardcoded dispatch (fast, but loses TWEAK-comment edits)
  return null
}

function renderVars(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key]
    return typeof v === 'string' ? v : `{{${key}}}`  // leave un-set keys visible
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  // Brain-token auth
  const provided = req.headers.get('x-bpp-brain-token') || ''
  if (!BPP_BRAIN_TOKEN || !timingSafeEqual(provided, BPP_BRAIN_TOKEN)) {
    return json(401, { error: 'unauthorized' })
  }

  if (!RESEND_API_KEY) {
    return json(503, { error: 'RESEND_API_KEY not configured (this function is a scaffold)' })
  }

  let body: SendInput
  try { body = await req.json() } catch { return json(400, { error: 'invalid_json' }) }
  if (!body.template || !body.contact_id || !body.subject) {
    return json(400, { error: 'missing_fields', need: ['template', 'contact_id', 'subject'] })
  }

  const sb = createClient(SUPABASE_URL, SR)

  // Pull contact + DNC + email gate
  const { data: contact, error } = await sb.from('contacts')
    .select('id, name, email, do_not_contact, install_address, qualification_data, notes')
    .eq('id', body.contact_id)
    .maybeSingle()
  if (error || !contact) return json(404, { error: 'contact_not_found' })
  if (contact.do_not_contact) return json(200, { ok: true, skipped: 'dnc' })
  if (!contact.email) return json(200, { ok: true, skipped: 'no_email_on_file' })

  // Marketing-class templates honor "manage preferences" opt-out via notes marker
  const MARKETING = new Set(['storm-prep-reminder', 'anniversary', 'referral-nudge', 'pdf-download'])
  if (MARKETING.has(body.template)) {
    const notes = String(contact.notes || '')
    if (notes.includes('__email_marketing_off')) {
      return json(200, { ok: true, skipped: 'marketing_opt_out' })
    }
  }

  // Load + render template
  const raw = await loadTemplate(body.template)
  if (!raw) return json(503, { error: 'template_loader_not_implemented' })

  // Standard auto-derived variables
  const firstName = (contact.name || '').split(/\s+/)[0] || 'there'
  const vars: Record<string, string> = {
    first_name: firstName,
    install_address: String(contact.install_address || ''),
    preferences_url: `https://backuppowerpro.com/preferences?cid=${contact.id}`,
    unsubscribe_url: `https://backuppowerpro.com/unsubscribe?cid=${contact.id}&t=${body.template}`,
    ...(body.variables || {}),
  }
  const html = renderVars(raw, vars)

  // Send via Resend
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      reply_to: body.reply_to || FROM_EMAIL,
      to: contact.email,
      subject: body.subject,
      html,
      attachments: body.attachments || undefined,
      tags: [
        { name: 'template', value: body.template },
        { name: 'contact_id', value: body.contact_id },
      ],
    }),
  })
  if (!resp.ok) {
    return json(resp.status, { error: 'resend_failed', detail: (await resp.text()).slice(0, 400) })
  }
  const sent = await resp.json()

  // Log to messages_email table (TODO: create the table)
  try {
    await sb.from('messages_email').insert({
      contact_id: body.contact_id,
      template: body.template,
      subject: body.subject,
      provider_id: sent?.id || null,
      sent_at: new Date().toISOString(),
    })
  } catch { /* table may not exist yet */ }

  return json(200, { ok: true, sent: sent?.id })
})
