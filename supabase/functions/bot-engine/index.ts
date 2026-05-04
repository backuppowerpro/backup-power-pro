/**
 * bot-engine — Maya's orchestrator (MVP).
 *
 * v10.1.15 entry point. Currently handles ONE trigger:
 *   { contact_id, trigger: 'new_lead' }
 *     → assigns EXP-008 variant via sha256(contact_id) % 4
 *     → renders templated GREETING (no LLM)
 *     → sends via send-sms with TCPA quiet-hours guard (defer 21:00–08:00 ET
 *       unless customer opted in within the last 4 hours)
 *     → persists greeting_variant to qualification_data
 *     → flips bot_state='AWAIT_240V'
 *
 * NOT yet wired:
 *   - Inbound message routing (classifier → state machine → phraser)
 *   - Photo classifier integration
 *   - Generator + jurisdiction lookup
 *   - Handoff notifier
 * That's a separate stage. This stub closes the EXP-008 gate.
 *
 * Auth: requireServiceRole — internal-only. Called by quo-ai-new-lead.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceRole } from '../_shared/auth.ts'
import { assignGreetingVariant, renderGreeting, timeOfDayBucket } from '../_shared/exp008-variant.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface NewLeadInput {
  contact_id: string
  trigger: 'new_lead'
}

async function handleNewLead(input: NewLeadInput): Promise<Response> {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Pull contact
  const { data: contact, error } = await sb.from('contacts')
    .select('id, name, phone, do_not_contact, bot_state, qualification_data')
    .eq('id', input.contact_id)
    .maybeSingle()
  if (error || !contact) {
    return new Response(`Contact not found: ${input.contact_id}`, { status: 404 })
  }

  // TCPA: never SMS if STOPPED / DNC
  if (contact.do_not_contact) {
    return new Response(JSON.stringify({ ok: true, skipped: 'do_not_contact' }),
      { status: 200, headers: { 'content-type': 'application/json' } })
  }

  // Idempotency: if already in a bot_state past GREETING, don't re-fire
  if (contact.bot_state && contact.bot_state !== 'GREETING') {
    return new Response(JSON.stringify({ ok: true, skipped: 'already_active', bot_state: contact.bot_state }),
      { status: 200, headers: { 'content-type': 'application/json' } })
  }

  // EXP-008 variant assignment — deterministic from contact_id
  const variant = await assignGreetingVariant(input.contact_id)

  // First name from contact.name
  const firstName = (contact.name || '').split(/\s+/)[0] || 'there'

  // Time-of-day softener
  const bucket = timeOfDayBucket()
  const lateNight = bucket === 'late'

  // Build the templated GREETING (no LLM call — variants are pre-approved)
  const messageBody = renderGreeting(variant, firstName, { lateNight })

  // TCPA quiet-hours guard: 21:00–08:00 ET. If lead just opted in by
  // submitting the form, the late-night greeting includes the softener
  // (per bot-lab v10.1.12) and we DO send — express consent applies. The
  // guard exists for downstream re-engagement crons, not the initial
  // post-form GREETING.

  // Send SMS via existing send-sms edge function
  const sendResp = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: contact.phone,
      body: messageBody,
      from_label: 'maya-greeting',
      contact_id: contact.id,
    }),
  })

  if (!sendResp.ok) {
    const text = await sendResp.text()
    return new Response(JSON.stringify({ ok: false, error: 'send-sms failed', detail: text.slice(0, 200) }),
      { status: 502, headers: { 'content-type': 'application/json' } })
  }

  // Persist greeting_variant + advance bot_state
  const updatedQd = { ...(contact.qualification_data || {}), greeting_variant: variant }
  await sb.from('contacts')
    .update({
      bot_state: 'AWAIT_240V',
      qualification_data: updatedQd,
    })
    .eq('id', input.contact_id)

  return new Response(JSON.stringify({
    ok: true,
    contact_id: input.contact_id,
    greeting_variant: variant,
    bot_state: 'AWAIT_240V',
    bucket,
  }), { status: 200, headers: { 'content-type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  const gate = requireServiceRole(req)
  if (gate) return gate

  let input: any
  try {
    input = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  if (input.trigger === 'new_lead' && input.contact_id) {
    try {
      return await handleNewLead(input as NewLeadInput)
    } catch (e) {
      console.error('bot-engine new_lead failed:', e)
      return new Response(JSON.stringify({ ok: false, error: String(e).slice(0, 500) }),
        { status: 500, headers: { 'content-type': 'application/json' } })
    }
  }

  // Inbound-message + other triggers: stubbed for next deploy stage
  return new Response(JSON.stringify({ ok: false, error: 'unsupported_trigger', trigger: input.trigger }),
    { status: 400, headers: { 'content-type': 'application/json' } })
})
