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

// Templates are bundled into _shared/email-templates/ at deploy time.
// Supabase deploys those alongside the function. Read at startup, cache
// in-process for the lifetime of the worker.
//
// Naming: the {template} input matches the filename without extension.
// e.g. template="proposal" -> _shared/email-templates/proposal-email.html
// (we add the "-email.html" suffix automatically; PDFs are not loaded here).
const TEMPLATE_CACHE = new Map<string, string>()
const TEMPLATE_DIR = new URL('../_shared/email-templates/', import.meta.url)

const TEMPLATE_MAP: Record<string, string> = {
  // Email name → filename
  'welcome': 'welcome-email.html',
  'proposal': 'proposal-email.html',
  'proposal-30a': 'proposal-personalized-30a.html',
  'proposal-50a': 'proposal-personalized-50a.html',
  'quote-followup-48h': 'quote-followup-48h-email.html',
  'install-reminder': 'install-reminder-email.html',
  'install-arrival': 'install-day-arrival-email.html',
  'completion': 'completion-email.html',
  'invoice': 'invoice-email.html',
  'review': 'review-email.html',
  'pdf-download': 'pdf-download-email.html',
  'permit-document': 'permit-document-email.html',
  'permit-approved': 'permit-approved-email.html',
  'storm-prep-reminder': 'storm-prep-reminder-email.html',
  'anniversary': 'anniversary-email.html',
  'referral-nudge': 'referral-nudge-email.html',
}

async function loadTemplate(name: string): Promise<string | null> {
  if (TEMPLATE_CACHE.has(name)) return TEMPLATE_CACHE.get(name)!
  const filename = TEMPLATE_MAP[name]
  if (!filename) return null
  try {
    const path = new URL(filename, TEMPLATE_DIR)
    const html = await Deno.readTextFile(path)
    TEMPLATE_CACHE.set(name, html)
    return html
  } catch (e) {
    console.warn(`[send-email] template load failed: ${name}`, e)
    return null
  }
}

// Plaintext fallback generator. Strips HTML for clients that ask for text/plain
// (Gmail's mobile preview, accessibility tools). Best-effort, not pretty,
// but better than no plaintext at all (deliverability score).
function htmlToPlain(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?(p|div|tr|td|h[1-6]|li|br)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim()
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
  const text = htmlToPlain(html)

  // Dry-run mode for testing without firing real Resend send.
  // Returns the rendered HTML + plaintext so we can validate vars
  // without spending sends or queuing customer mail.
  if ((body as any).dry_run === true) {
    return json(200, { ok: true, dry_run: true, template: body.template, html_length: html.length, text_length: text.length, html_head: html.slice(0, 300), to: contact.email })
  }

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
      text,  // plaintext fallback for accessibility + deliverability
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

  // Log to messages_email table (migration 20260508140000)
  try {
    await sb.from('messages_email').insert({
      contact_id: body.contact_id,
      template: body.template,
      subject: body.subject,
      to_email: contact.email,
      provider_id: sent?.id || null,
      status: 'sent',
      vars: vars,
      trigger: (body as any).trigger || 'manual',
      sent_at: new Date().toISOString(),
    })
  } catch (e) { console.warn('[send-email] log to messages_email failed:', e) }

  return json(200, { ok: true, sent: sent?.id })
})
