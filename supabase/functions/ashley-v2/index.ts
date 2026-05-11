/**
 * ashley-v2 — unified single-model qualification engine.
 *
 * Replaces the 3-microservice pipeline (bot-classifier + bot-state-machine +
 * bot-phraser) with one Claude call that has the full conversation history.
 * Claude sees everything: prior turns, current state, collected slots. It
 * decides what the customer means, what state to advance to, and what to say.
 *
 * Auth: requireServiceRole (internal-only, called by dojo-helper or a future
 * inbound webhook route).
 *
 * Input:
 *   { contact_id, message_body, media_urls?, dojo_mode? }
 *
 * dojo_mode: when true, skips the send-sms call (for dojo testing).
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

// Only these forward/self transitions are allowed per state. Prevents the LLM
// from jumping backwards or skipping required collection steps.
const VALID_TRANSITIONS: Record<string, string[]> = {
  AWAIT_240V:        ['AWAIT_240V', 'AWAIT_OUTLET', 'NEEDS_CALLBACK'],
  AWAIT_OUTLET:      ['AWAIT_OUTLET', 'AWAIT_OUTLET_PHOTO', 'AWAIT_PANEL_PHOTO', 'NEEDS_CALLBACK'],
  AWAIT_OUTLET_PHOTO:['AWAIT_OUTLET_PHOTO', 'AWAIT_PANEL_PHOTO', 'NEEDS_CALLBACK'],
  AWAIT_PANEL_PHOTO: ['AWAIT_PANEL_PHOTO', 'AWAIT_RUN', 'NEEDS_CALLBACK'],
  AWAIT_RUN:         ['AWAIT_RUN', 'RECAP', 'NEEDS_CALLBACK'],
  RECAP:             ['RECAP', 'AWAIT_EMAIL', 'NEEDS_CALLBACK'],
  AWAIT_EMAIL:       ['AWAIT_EMAIL', 'AWAIT_ADDRESS', 'NEEDS_CALLBACK'],
  AWAIT_ADDRESS:     ['AWAIT_ADDRESS', 'HANDOFF', 'NEEDS_CALLBACK'],
  HANDOFF:           ['HANDOFF'],
  NEEDS_CALLBACK:    ['NEEDS_CALLBACK'],
  DO_NOT_CONTACT:    ['DO_NOT_CONTACT'],
}

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
          has_240v_outlet:   { type: 'boolean' },
          outlet_type:       { type: 'string' },
          panel_brand:       { type: 'string' },
          panel_amps:        { type: 'number' },
          run_feet:          { type: 'number' },
          email:             { type: 'string' },
          address:           { type: 'string' },
          ownership_confirmed: { type: 'boolean' },
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

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: contact } = await sb.from('contacts')
    .select('id, name, phone, bot_state, qualification_data, bot_disabled, do_not_contact, ai_enabled')
    .eq('id', input.contact_id)
    .single()

  if (!contact) {
    return new Response(JSON.stringify({ error: 'contact not found' }), { status: 404 })
  }

  if (contact.bot_disabled || contact.do_not_contact || contact.ai_enabled === false) {
    return new Response(JSON.stringify({ ok: true, skipped: 'bot_off' }))
  }

  const currentState: string = contact.bot_state || 'AWAIT_240V'

  // Load last 20 messages (conversation history for context)
  const { data: history } = await sb.from('messages')
    .select('direction, body, created_at')
    .eq('contact_id', contact.id)
    .order('created_at', { ascending: true })
    .limit(20)

  // Build Claude messages array. Merge consecutive same-direction messages
  // so the array alternates user/assistant as the API requires.
  const raw: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const msg of (history || [])) {
    const role = msg.direction === 'inbound' ? 'user' : 'assistant'
    if (msg.body) raw.push({ role, content: msg.body })
  }

  // Merge consecutive same-role messages (burst texters, etc.)
  const merged: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const m of raw) {
    const last = merged[merged.length - 1]
    if (last && last.role === m.role) {
      last.content += '\n' + m.content
    } else {
      merged.push({ ...m })
    }
  }

  // Append the current inbound (if not already the last message)
  const inboundText = String(input.message_body || '').trim()
  const mediaNote = (input.media_urls?.length ?? 0) > 0
    ? ` [Photo attached: ${input.media_urls![0]}]`
    : ''
  const currentContent = (inboundText + mediaNote) || '[No text — photo only]'

  const lastMsg = merged[merged.length - 1]
  if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== currentContent) {
    if (lastMsg?.role === 'user') {
      lastMsg.content += '\n' + currentContent
    } else {
      merged.push({ role: 'user', content: currentContent })
    }
  }

  // Render system prompt with runtime context
  const qdSummary = JSON.stringify(contact.qualification_data || {})
  const systemPrompt = ASHLEY_V2_SYSTEM_PROMPT
    .replaceAll('{{customer_name}}', contact.name || 'unknown')
    .replaceAll('{{current_state}}', currentState)
    .replaceAll('{{qualification_data}}', qdSummary)

  // Call Claude (Haiku for cost during dojo testing; swap to Sonnet for production)
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

  // Validate state transition. If LLM picks an illegal jump, clamp to current.
  const allowedNext = VALID_TRANSITIONS[currentState] ?? [currentState]
  const finalState = (VALID_STATES.has(next_state) && allowedNext.includes(next_state))
    ? next_state
    : currentState
  const stateOverridden = finalState !== next_state

  if (stateOverridden) {
    console.warn('[ashley-v2] blocked transition', currentState, '->', next_state, '-> held at', finalState)
  }

  // Merge new slot values into qualification_data
  const newQd = slots
    ? { ...(contact.qualification_data || {}), ...slots }
    : (contact.qualification_data || {})

  // Update contact
  await sb.from('contacts').update({
    bot_state: finalState,
    qualification_data: newQd,
    last_bot_inbound_at: new Date().toISOString(),
  }).eq('id', contact.id)

  // Write outbound message to DB
  let outboundId: string | null = null
  if (outbound_text) {
    const { data: inserted } = await sb.from('messages').insert({
      contact_id: contact.id,
      direction: 'outbound',
      body: outbound_text,
      sender: 'ashley-v2',
      status: 'queued',
    }).select('id').single()
    outboundId = inserted?.id ?? null

    // Send SMS unless dojo mode
    if (!input.dojo_mode && contact.phone) {
      try {
        const smsResp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-sms`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ to: contact.phone, body: outbound_text }),
        })
        if (!smsResp.ok) {
          console.error('[ashley-v2] send-sms error', smsResp.status)
        }
      } catch (e) {
        console.error('[ashley-v2] send-sms exception', e)
      }
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    prev_state: currentState,
    next_state: finalState,
    state_overridden: stateOverridden,
    outbound_text,
    reasoning,
    slots: slots ?? null,
    outbound_message_id: outboundId,
  }), { headers: { 'content-type': 'application/json' } })
})
