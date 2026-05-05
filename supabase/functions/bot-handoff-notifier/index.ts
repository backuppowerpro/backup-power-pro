// Edge function: bot-handoff-notifier
// Fires when the bot reaches a terminal state. Notifies Key via internal
// SMS with a qualified-lead summary or a callback-needed heads-up.
//
// Triggers:
//   - COMPLETE                 → "qualified lead" SMS w/ lead-quality score
//   - NEEDS_CALLBACK           → "callback needed" SMS w/ flags + excerpt
//   - POSTPONED (warm pause)   → soft heads-up to Key
//   - DISQUALIFIED_120V        → silent UNLESS recommendation requested
//   - DISQUALIFIED_RENTER      → silent
//   - DISQUALIFIED_OUT_OF_AREA → silent
//   - STOPPED                  → silent (TCPA — no further outbound)
//
// Auth: requireServiceRole — internal-only callable from bot-engine.

import { requireServiceRole } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!
const TWILIO_FROM = '+18648637800' // BPP business line
const KEY_CELL = '+19414417996'    // Key's personal cell — internal alerts go here

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface HandoffInput {
  contact_id: string
  terminal_state:
    | 'COMPLETE'
    | 'NEEDS_CALLBACK'
    | 'DISQUALIFIED_120V'
    | 'DISQUALIFIED_RENTER'
    | 'DISQUALIFIED_OUT_OF_AREA'
    | 'POSTPONED'
    | 'STOPPED'
  callback_excerpt?: string
}

function formatPhone(e164: string | null): string {
  if (!e164) return '???'
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164
}

function scoreLead(c: any): { score: number; scoreLabel: string } {
  let score = 1.0
  if (c.gen_240v === true) score += 1.0
  if (c.outlet_amps === 50) score += 0.5
  else if (c.outlet_amps === 30) score += 0.25
  if (c.primary_panel_photo_path) score += 1.0
  if (c.install_address) score += 0.5
  if (c.email && !/gmial|yahooo|hotnail|outlok/i.test(String(c.email))) score += 0.25
  if (c.gen_brand_model) score += 0.25
  if (c.panel_brand) score += 0.25
  if (c.bot_referral_source) score += 0.5
  score = Math.min(5.0, score)
  const rounded = Math.round(score * 2) / 2
  let label: string
  if (rounded >= 4.5) label = `${rounded}/5 HIGH`
  else if (rounded >= 3.5) label = `${rounded}/5`
  else if (rounded >= 2.5) label = `${rounded}/5 STANDARD`
  else label = `${rounded}/5 BORDERLINE`
  return { score: rounded, scoreLabel: label }
}

async function sendInternalSms(body: string, _contactId: string, _fromLabel: string) {
  // v10.1.32 — OpenPhone bypass while Twilio A2P 10DLC is in carrier review.
  // If KEY_CELL is on ASHLEY_OPENPHONE_TEST_PHONES, send via OpenPhone (5302).
  // When A2P clears, unset that env var and this falls back to direct Twilio.
  const OP_TEST_PHONES = (Deno.env.get('ASHLEY_OPENPHONE_TEST_PHONES') || '')
    .split(',').map(s => s.trim()).filter(Boolean)
  const useOpenPhone = OP_TEST_PHONES.includes('*') || OP_TEST_PHONES.includes(KEY_CELL)

  if (useOpenPhone) {
    const QUO_API_KEY = Deno.env.get('QUO_API_KEY')!
    // v10.1.32 — use the INTERNAL OpenPhone line (864) 863-7155 for
    // handoff alerts to Key, not the customer-facing 5302 line. Per
    // Key 2026-05-04: handoff texts come from 7155 to keep customer
    // and internal threads separate in his iMessage.
    const QUO_INTERNAL_PHONE_ID = Deno.env.get('QUO_INTERNAL_PHONE_ID') || 'PNPhgKi0ua'
    const res = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': QUO_API_KEY },
      body: JSON.stringify({ from: QUO_INTERNAL_PHONE_ID, to: [KEY_CELL], content: body }),
    })
    if (!res.ok) {
      console.error('[bot-handoff-notifier] openphone send failed', res.status, await res.text())
    }
    return res
  }

  // Direct Twilio API — default path (post-A2P).
  const creds = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)
  const form = new URLSearchParams({ From: TWILIO_FROM, To: KEY_CELL, Body: body })
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
    console.error('[bot-handoff-notifier] twilio send failed', res.status, await res.text())
  }
  return res
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const gate = requireServiceRole(req)
  if (gate) return gate

  let input: HandoffInput
  try {
    input = (await req.json()) as HandoffInput
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 })
  }

  if (!input?.contact_id || !input?.terminal_state) {
    return new Response(JSON.stringify({ error: 'missing_fields' }), { status: 400 })
  }

  // Fully-silent terminals
  if (
    input.terminal_state === 'STOPPED' ||
    input.terminal_state === 'DISQUALIFIED_RENTER' ||
    input.terminal_state === 'DISQUALIFIED_OUT_OF_AREA'
  ) {
    return new Response(
      JSON.stringify({ notified: false, reason: 'silent_terminal' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }

  // DQ_120V: silent unless customer asked for a recommendation.
  if (input.terminal_state === 'DISQUALIFIED_120V') {
    const { data: c } = await sb
      .from('contacts')
      .select('name, phone, gen_brand_model, qualification_data')
      .eq('id', input.contact_id)
      .maybeSingle()

    if (!c?.qualification_data?.requested_recommendation) {
      return new Response(
        JSON.stringify({ notified: false, reason: 'silent_dq_120v' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    const fname = (c.name ? String(c.name).split(/\s+/)[0] : 'Unknown')
    const recBody = `120V DQ + recommendation request: ${fname} (${formatPhone(c.phone)}) had ${c.gen_brand_model || 'a 120V generator'} and asked for upgrade picks.`
    await sendInternalSms(recBody, input.contact_id, 'bot-dq-recommendation')
    return new Response(
      JSON.stringify({ notified: true, reason: 'dq_120v_recommendation' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }

  // POSTPONED warm pause
  if (input.terminal_state === 'POSTPONED') {
    const { data: c } = await sb
      .from('contacts')
      .select('name, phone, pause_reason, paused_at_state')
      .eq('id', input.contact_id)
      .maybeSingle()
    if (!c) return new Response('not found', { status: 404 })

    const reason =
      c.pause_reason === 'spouse_approval_needed' ? 'awaiting spouse approval' :
      c.pause_reason === 'callback_time_requested' ? 'requested a callback time' :
      'paused'
    const fname = (c.name ? String(c.name).split(/\s+/)[0] : 'Unknown')
    const warmBody = `Warm pause: ${fname} (${formatPhone(c.phone)}) ${reason} at ${c.paused_at_state || 'unknown state'}. See CRM. No action needed unless you want to follow up in a week.`
    await sendInternalSms(warmBody, input.contact_id, 'bot-warm-pause')
    return new Response(
      JSON.stringify({ notified: true, reason: 'warm_pause' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }

  // COMPLETE / NEEDS_CALLBACK — full handoff
  const { data: contact, error: cErr } = await sb
    .from('contacts')
    .select('name, phone, email, install_address, gen_240v, outlet_amps, gen_brand_model, panel_brand, primary_panel_photo_path, primary_outlet_photo_path, extra_photos, bot_referral_source, qualification_data')
    .eq('id', input.contact_id)
    .maybeSingle()

  if (cErr || !contact) {
    return new Response(`Contact not found: ${input.contact_id}`, { status: 404 })
  }

  const fname = (contact.name ? String(contact.name).split(/\s+/)[0] : 'Unknown')
  const lname = ''

  let smsBody: string
  if (input.terminal_state === 'COMPLETE') {
    const { score, scoreLabel } = scoreLead(contact)
    const parts = [`New qualified lead: ${fname}${lname} [${scoreLabel}]`]
    if (contact.install_address) parts.push(`Address: ${contact.install_address}`)
    if (contact.outlet_amps) parts.push(`${contact.outlet_amps}A 240V`)
    const qd: any = contact.qualification_data || {}
    if (qd.voltage_deferred) parts.push(`Voltage UNCONFIRMED — verify ${contact.gen_brand_model || 'model'} specs`)
    else if (qd.voltage_pending) parts.push(`Voltage selector check needed (${contact.gen_brand_model})`)
    if (qd.county) {
      const permit = qd.permit_authority
      parts.push(permit ? `${qd.county} County (permit: ${permit})` : `${qd.county} County`)
    }
    const loads = qd.load_mentions
    if (Array.isArray(loads) && loads.length) {
      parts.push(`Loads: ${loads.join(', ')}`)
    }
    if (qd.surge_protector_question) parts.push('Asked about surge protector')
    if (qd.mentions_hoa) parts.push('HOA approval needed')
    if (qd.prefers_email_channel) parts.push('Prefers email')
    if (qd.hazardous_panel_brand) parts.push(`HAZARDOUS PANEL: ${qd.hazardous_panel_brand}`)
    if (qd.defer_coverage_to_key && qd.coverage_excerpt) {
      parts.push(`Coverage Q: "${String(qd.coverage_excerpt).slice(0, 120)}"`)
    }
    if (qd.handoff_recommendation_question) parts.push('Asked recommendation on a generator')
    if (contact.gen_brand_model) parts.push(`Gen: ${contact.gen_brand_model}`)
    if (contact.panel_brand) parts.push(`Panel: ${contact.panel_brand}`)
    if (contact.email) parts.push(`Email: ${contact.email}`)
    if (contact.bot_referral_source) parts.push(`Referral: ${contact.bot_referral_source}`)
    parts.push('Photos in CRM. Quote due tomorrow morning.')
    smsBody = parts.join('. ')
    await sb.from('contacts').update({ lead_quality_score: score }).eq('id', input.contact_id)
  } else {
    // NEEDS_CALLBACK
    const qd: any = contact.qualification_data || {}
    const parts = [`Callback needed: ${fname}${lname} (${formatPhone(contact.phone)})`]
    if (qd.non_english_lead) parts.push('Non-English inbound (English-only support)')
    if (qd.scope_mismatch_ats) parts.push('Wants ATS / whole-home setup (scope clarification)')
    if (qd.hazardous_panel_brand) parts.push(`HAZARDOUS PANEL: ${qd.hazardous_panel_brand}`)
    if (qd.defer_coverage_to_key && qd.coverage_excerpt) {
      parts.push(`Coverage Q: "${String(qd.coverage_excerpt).slice(0, 100)}"`)
    }
    if (qd.handoff_recommendation_question) parts.push('Asked recommendation on a generator')
    if (qd.surge_protector_question) parts.push('Asked about surge protector')
    if (qd.priority === 'urgent') parts.push('URGENT — customer demanded immediate callback')
    if (qd.prefers_email_channel) parts.push('Prefers email over text')
    if (qd.mentions_hoa) parts.push('HOA approval needed')
    if (qd.off_topic_clarifying) parts.push('Asked off-topic technical question')
    if (qd.county) {
      const permit = qd.permit_authority
      parts.push(permit ? `${qd.county} County (permit: ${permit})` : `${qd.county} County`)
    }
    if (Array.isArray(qd.load_mentions) && qd.load_mentions.length) {
      parts.push(`Loads mentioned: ${qd.load_mentions.length}`)
    }
    if (input.callback_excerpt) {
      parts.push(`They said: "${input.callback_excerpt.slice(0, 140)}"`)
    }
    parts.push('See CRM for full thread.')
    smsBody = parts.join('. ')
  }

  if (smsBody.length > 480) smsBody = smsBody.slice(0, 477) + '...'

  const sendResp = await sendInternalSms(smsBody, input.contact_id, 'bot-handoff')
  if (!sendResp.ok) {
    return new Response(`Failed to notify Key: ${sendResp.status}`, { status: 500 })
  }

  // Log outcome (best-effort; table may or may not exist depending on migration state)
  try {
    await sb.from('bot_outcomes').upsert(
      {
        contact_id: input.contact_id,
        [input.terminal_state === 'COMPLETE' ? 'reached_complete_at' : 'needs_callback']:
          input.terminal_state === 'COMPLETE' ? new Date().toISOString() : true,
        exit_state: input.terminal_state,
      },
      { onConflict: 'contact_id' },
    )
  } catch (_) { /* ignore */ }

  return new Response(
    JSON.stringify({ notified: true, sms_length: smsBody.length, key_phone: KEY_PHONE }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
})
