/**
 * ashley-v2 — unified single-model qualification engine.
 *
 * One Claude call per inbound with full conversation history. State machine
 * embedded as knowledge in the system prompt; transitions validated in code
 * as a guardrail. Replaces the 3-microservice pipeline (bot-classifier +
 * bot-state-machine + bot-phraser).
 *
 * Production features included:
 *   - Photo classification (bot-photo-classifier) for MMS
 *   - Handoff/callback notifier (bot-handoff-notifier)
 *   - ai_paused_until + bot_disabled guards
 *   - send-sms dispatch (skipped in dojo_mode)
 *
 * Auth: requireServiceRole, internal-only.
 *
 * Input:
 *   { contact_id, message_body?, media_urls?, dojo_mode? }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceRole } from '../_shared/auth.ts'
import { ASHLEY_V2_SYSTEM_PROMPT } from './system-prompt.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

const VALID_STATES = new Set([
  'AWAIT_240V', 'AWAIT_OUTLET', 'AWAIT_OUTLET_PHOTO',
  'AWAIT_PANEL_PHOTO', 'AWAIT_RUN', 'RECAP',
  'AWAIT_EMAIL', 'AWAIT_ADDRESS', 'HANDOFF',
  'NEEDS_CALLBACK', 'DO_NOT_CONTACT',
])

const VALID_TRANSITIONS: Record<string, string[]> = {
  // AWAIT_240V can skip to AWAIT_PANEL_PHOTO when customer confirms 240V + outlet type in one message
  AWAIT_240V:         ['AWAIT_240V', 'AWAIT_OUTLET', 'AWAIT_OUTLET_PHOTO', 'AWAIT_PANEL_PHOTO', 'NEEDS_CALLBACK'],
  AWAIT_OUTLET:       ['AWAIT_OUTLET', 'AWAIT_OUTLET_PHOTO', 'AWAIT_PANEL_PHOTO', 'NEEDS_CALLBACK'],
  AWAIT_OUTLET_PHOTO: ['AWAIT_OUTLET_PHOTO', 'AWAIT_PANEL_PHOTO', 'NEEDS_CALLBACK'],
  AWAIT_PANEL_PHOTO:  ['AWAIT_PANEL_PHOTO', 'AWAIT_RUN', 'NEEDS_CALLBACK'],
  AWAIT_RUN:          ['AWAIT_RUN', 'RECAP', 'NEEDS_CALLBACK'],
  RECAP:              ['RECAP', 'AWAIT_EMAIL', 'AWAIT_ADDRESS', 'HANDOFF', 'NEEDS_CALLBACK'],
  AWAIT_EMAIL:        ['AWAIT_EMAIL', 'AWAIT_ADDRESS', 'NEEDS_CALLBACK'],
  AWAIT_ADDRESS:      ['AWAIT_ADDRESS', 'HANDOFF', 'NEEDS_CALLBACK'],
  HANDOFF:            ['HANDOFF'],
  NEEDS_CALLBACK:     ['NEEDS_CALLBACK'],
  DO_NOT_CONTACT:     ['DO_NOT_CONTACT'],
}

// States that trigger a notification to Key when first entered
const NOTIFY_ON_ENTER = new Set(['HANDOFF', 'NEEDS_CALLBACK'])

const DECIDE_TOOL = {
  name: 'decide',
  description: "Output Ashley's qualification decision and the SMS reply.",
  input_schema: {
    type: 'object',
    properties: {
      reasoning: {
        type: 'string',
        description: 'Internal reasoning (1-2 sentences). Not shown to customer.',
      },
      next_state: {
        type: 'string',
        description: 'State to transition to. Must be a valid state name.',
      },
      outbound_text: {
        type: 'string',
        description: 'The SMS message to send. Plain text only, no markdown, ≤280 chars.',
      },
      slots: {
        type: 'object',
        description: 'Newly learned slot values from this turn. Omit fields not newly learned.',
        properties: {
          has_240v_outlet:      { type: 'boolean' },
          outlet_type:          { type: 'string' },
          panel_brand:          { type: 'string' },
          panel_amps:           { type: 'number' },
          run_feet:             { type: 'number' },
          email:                { type: 'string' },
          address:              { type: 'string' },
          ownership_confirmed:  { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
    required: ['reasoning', 'next_state', 'outbound_text'],
  },
}

interface InboundInput {
  contact_id: string
  message_body?: string
  media_urls?: string[]
  dojo_mode?: boolean
}

async function callInternal(
  supabaseUrl: string,
  srKey: string,
  fn: string,
  body: unknown,
): Promise<any> {
  const r = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${srKey}`,
      apikey: srKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    console.warn(`[ashley-v2] ${fn} returned ${r.status}`)
    return null
  }
  return r.json().catch(() => null)
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const gate = requireServiceRole(req)
  if (gate) return gate

  let input: InboundInput
  try {
    input = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 })
  }

  if (!input?.contact_id) {
    return new Response(JSON.stringify({ error: 'contact_id required' }), { status: 400 })
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SR_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const sb = createClient(SUPABASE_URL, SR_KEY)

  const { data: contact } = await sb.from('contacts')
    .select('id, name, phone, bot_state, qualification_data, bot_disabled, do_not_contact, ai_enabled, ai_paused_until')
    .eq('id', input.contact_id)
    .single()

  if (!contact) {
    return new Response(JSON.stringify({ error: 'contact not found' }), { status: 404 })
  }

  // Guards
  if (contact.bot_disabled || contact.do_not_contact || contact.ai_enabled === false) {
    return new Response(JSON.stringify({ ok: true, skipped: 'bot_off' }))
  }
  if (contact.ai_paused_until && new Date(contact.ai_paused_until) > new Date()) {
    return new Response(JSON.stringify({ ok: true, skipped: 'paused' }))
  }

  const currentState: string = contact.bot_state || 'AWAIT_240V'

  // ── PHOTO CLASSIFICATION ─────────────────────────────────────────────────
  // If media present, classify the first image and inject the result into the
  // conversation as structured context so Ashley can acknowledge specifics.
  let photoContext = ''
  if ((input.media_urls?.length ?? 0) > 0 && !input.dojo_mode) {
    try {
      const photoResult = await callInternal(SUPABASE_URL, SR_KEY, 'bot-photo-classifier', {
        image_url: input.media_urls![0],
        contact_id: input.contact_id,
      })
      if (photoResult?.subject) {
        const brand = photoResult.panel_brand_visible || ''
        const amps  = photoResult.panel_amperage_visible || photoResult.amperage_visible || ''
        const subj  = photoResult.subject
        // Build a terse annotation the LLM can use for specific acks
        const parts = [`subject=${subj}`]
        if (brand && brand !== 'unknown') parts.push(`brand=${brand}`)
        if (amps  && amps  !== 'unknown') parts.push(`amps=${amps}`)
        if (photoResult.obvious_issues?.length) parts.push(`issues=${photoResult.obvious_issues.join(',')}`)
        photoContext = `[Photo classification: ${parts.join(', ')}]`
        console.log(`[ashley-v2] photo classified: ${photoContext}`)
      }
    } catch (e) {
      console.warn('[ashley-v2] photo classifier failed:', e)
    }
  }

  // ── CONVERSATION HISTORY ─────────────────────────────────────────────────
  const { data: history } = await sb.from('messages')
    .select('direction, body, created_at')
    .eq('contact_id', contact.id)
    .order('created_at', { ascending: true })
    .limit(20)

  const raw: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const msg of (history || [])) {
    const role = msg.direction === 'inbound' ? 'user' : 'assistant'
    if (msg.body) raw.push({ role, content: msg.body })
  }

  // Merge consecutive same-role messages (burst texters, multi-photo MMS)
  const merged: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const m of raw) {
    const last = merged[merged.length - 1]
    if (last && last.role === m.role) {
      last.content += '\n' + m.content
    } else {
      merged.push({ ...m })
    }
  }

  // twilio-webhook and dojo-helper both save the inbound to DB before calling
  // us, so it should already be in `merged`. But as a safety net: if merged
  // has no user messages (race condition, failed insert, etc.), push the
  // current inbound so Claude always gets at least one user turn.
  const hasUserMsg = merged.some(m => m.role === 'user')
  if (!hasUserMsg) {
    const inboundText = String(input.message_body || '').trim()
    const fallbackContent = inboundText || (input.media_urls?.length ? '[Photo]' : '[message]')
    merged.push({ role: 'user', content: fallbackContent })
    console.warn('[ashley-v2] merged had no user msgs from DB — used fallback. history len:', history?.length ?? 0)
  }

  // For MMS: annotate the last user turn with photo classification so the
  // LLM can acknowledge specifics even though the stored body is a [media:URL].
  if (photoContext) {
    const lastUser = merged.slice().reverse().find(m => m.role === 'user')
    if (lastUser) lastUser.content += '\n' + photoContext
  }

  console.log(`[ashley-v2] state=${currentState} merged_turns=${merged.length}`)

  // ── SYSTEM PROMPT ────────────────────────────────────────────────────────
  const qdSummary   = JSON.stringify(contact.qualification_data || {})
  const systemPrompt = ASHLEY_V2_SYSTEM_PROMPT
    .replaceAll('{{customer_name}}',      contact.name || 'unknown')
    .replaceAll('{{current_state}}',      currentState)
    .replaceAll('{{qualification_data}}', qdSummary)

  // ── CLAUDE CALL ──────────────────────────────────────────────────────────
  const apiResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemPrompt,
      messages: merged,
      tools: [DECIDE_TOOL],
      tool_choice: { type: 'tool', name: 'decide' },
    }),
  })

  if (!apiResp.ok) {
    const errText = await apiResp.text()
    console.error('[ashley-v2] claude error', apiResp.status, errText.slice(0, 300))
    return new Response(JSON.stringify({ error: 'claude_api_error', status: apiResp.status }), { status: 502 })
  }

  const apiData = await apiResp.json()
  const toolUse = apiData.content?.find((b: any) => b.type === 'tool_use')

  if (!toolUse?.input) {
    console.error('[ashley-v2] no tool_use in response', JSON.stringify(apiData).slice(0, 400))
    return new Response(JSON.stringify({ error: 'no_tool_use' }), { status: 502 })
  }

  const { reasoning, next_state, outbound_text, slots } = toolUse.input as {
    reasoning: string
    next_state: string
    outbound_text: string
    slots?: Record<string, unknown>
  }

  // ── STATE VALIDATION ─────────────────────────────────────────────────────
  const allowedNext = VALID_TRANSITIONS[currentState] ?? [currentState]
  const finalState  = (VALID_STATES.has(next_state) && allowedNext.includes(next_state))
    ? next_state
    : currentState
  const stateOverridden = finalState !== next_state

  if (stateOverridden) {
    console.warn('[ashley-v2] blocked transition', currentState, '->', next_state, '-> held at', finalState)
  }

  // ── DB WRITES ────────────────────────────────────────────────────────────
  const newQd = slots
    ? { ...(contact.qualification_data || {}), ...slots }
    : (contact.qualification_data || {})

  await sb.from('contacts').update({
    bot_state:            finalState,
    qualification_data:   newQd,
    last_bot_inbound_at:  new Date().toISOString(),
  }).eq('id', contact.id)

  let outboundId: string | null = null
  if (outbound_text) {
    const { data: inserted } = await sb.from('messages').insert({
      contact_id: contact.id,
      direction:  'outbound',
      body:       outbound_text,
      sender:     'ashley-v2',
      status:     'queued',
    }).select('id').single()
    outboundId = inserted?.id ?? null

    if (!input.dojo_mode && contact.phone) {
      try {
        const smsResp = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SR_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ to: contact.phone, body: outbound_text }),
        })
        if (!smsResp.ok) console.error('[ashley-v2] send-sms error', smsResp.status)
      } catch (e) {
        console.error('[ashley-v2] send-sms exception', e)
      }
    }
  }

  // ── HANDOFF / CALLBACK NOTIFICATION ─────────────────────────────────────
  // Fire when entering a notify state for the first time (prev != final).
  if (!input.dojo_mode && NOTIFY_ON_ENTER.has(finalState) && finalState !== currentState) {
    const terminalState = finalState === 'HANDOFF' ? 'COMPLETE' : 'NEEDS_CALLBACK'
    callInternal(SUPABASE_URL, SR_KEY, 'bot-handoff-notifier', {
      contact_id:     contact.id,
      terminal_state: terminalState,
    }).catch(e => console.error('[ashley-v2] handoff-notifier failed:', e))
  }

  return new Response(JSON.stringify({
    ok: true,
    prev_state:           currentState,
    next_state:           finalState,
    state_overridden:     stateOverridden,
    outbound_text,
    reasoning,
    slots:                slots ?? null,
    outbound_message_id:  outboundId,
  }), { headers: { 'content-type': 'application/json' } })
})
