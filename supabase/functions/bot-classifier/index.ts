// Edge function: bot-classifier
// Reads one inbound customer SMS, returns one structured classifier output.
// Uses Anthropic Haiku 4.5 with the proven tool-call pattern for structured outputs.
//
// Auth: requireServiceRole — internal-only, callable from bot-engine / twilio-webhook.

import { requireServiceRole, allowRate } from '../_shared/auth.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

// Locked classifier system prompt (Ashley voice). Imported from the .ts
// module sibling so the prompt is bundled with the deployed function
// (Supabase edge runtime can't load .txt assets at runtime).
import { SYSTEM_PROMPT_TEMPLATE } from './system-prompt.ts'

// JSON schema for structured output (anchored to enum on `label`).
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    label: {
      type: 'string',
      enum: [
        // Generic
        'affirmative', 'negative', 'asking_for_human', 'asking_if_human',
        'asking_for_context', 'asking_clarifying_technical', 'friendly_chitchat',
        'answered_with_impatience', 'amending_prior_answer', 'stop_variant',
        'not_my_lead', 'off_topic_question', 'unclear',
        // v8 additions
        'callback_time_requested', 'spouse_approval_needed', 'referral_mentioned',
        'dont_own_generator_yet',
        // v10.1.7+
        'coverage_question', 'non_english_inbound', 'out_of_scope_install',
        'asking_about_credentials', 'asking_about_surge_protector',
        'urgent_callback_demand', 'prefers_email_channel', 'mentions_hoa',
        // 240V
        'gen_240v', 'gen_120v', 'gen_unsure',
        // Outlet (legacy + v10.1.4 split)
        'outlet_30a', 'outlet_30a_4prong', 'outlet_30a_3prong', 'outlet_30a_unspecified',
        'outlet_50a', 'outlet_unknown',
        // Ownership
        'owner', 'renter',
        // Run / panel location (legacy + v10.1.5 panel-location labels)
        'run_short', 'run_medium', 'run_long', 'run_unsure',
        'panel_garage_exterior', 'panel_garage_interior',
        'panel_basement', 'panel_interior_wall', 'panel_outdoor', 'panel_other',
        // Install path (v10.1.5)
        'attic_access', 'crawlspace_access', 'both_access', 'no_access',
        // Email
        'email_provided',
        // Address
        'address_confirmed', 'address_corrected',
        // Photos
        'photo_received', 'photo_will_send_later', 'photo_refused', 'photo_correction',
        // Out-of-area (orchestrator-emitted via jurisdiction lookup)
        'out_of_area_address',
      ],
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    extracted_value: { type: 'string' },
    off_topic_excerpt: { type: 'string' },
    coverage_excerpt: { type: 'string' },
    chitchat_excerpt: { type: 'string' },
    impatience_excerpt: { type: 'string' },
    amended_slot: {
      type: 'string',
      enum: ['240v', 'outlet', 'ownership', 'run', 'email', 'address'],
    },
    email_typo_suspected: { type: 'boolean' },
    email_likely_meant: { type: 'string' },
    clarifying_question: { type: 'string' },
    requested_time: { type: 'string' },
    referral_source: { type: 'string' },
    load_mentions: { type: 'array', items: { type: 'string' } },
    inferred_customer_style: {
      type: 'string',
      enum: ['terse', 'educational', 'buddy', 'default'],
    },
  },
  required: ['label', 'confidence'],
  additionalProperties: false,
}

interface ClassifierInput {
  inbound_message: string
  state: string
  recent_turns: Array<{ role: 'customer' | 'bot'; text: string }>
}

interface ClassifierOutput {
  label: string
  confidence: number
  [k: string]: unknown
}

async function classify(input: ClassifierInput): Promise<ClassifierOutput> {
  const recentTurnsText = (input.recent_turns || [])
    .map((t) => `${t.role}: ${t.text}`)
    .join('\n')

  const renderedSystem = SYSTEM_PROMPT_TEMPLATE
    .replaceAll('{{state}}', input.state)
    .replaceAll('{{recent_turns}}', recentTurnsText)
    .replaceAll('{{inbound_message}}', input.inbound_message)

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: renderedSystem,
      messages: [{ role: 'user', content: input.inbound_message }],
      tools: [
        {
          name: 'classify',
          description: 'Return the structured classification of the inbound customer SMS.',
          input_schema: OUTPUT_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'classify' },
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    console.error('[bot-classifier] anthropic error', resp.status, errText.slice(0, 300))
    return { label: 'unclear', confidence: 0.4 }
  }

  const data = await resp.json()
  const toolUse = data.content?.find((b: any) => b.type === 'tool_use')
  if (!toolUse?.input) {
    console.error('[bot-classifier] no tool_use in response')
    return { label: 'unclear', confidence: 0.3 }
  }
  return toolUse.input as ClassifierOutput
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const gate = requireServiceRole(req)
  if (gate) return gate

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowRate(`bot-classifier:${ip}`, 120)) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 })
  }

  let input: ClassifierInput
  try {
    input = (await req.json()) as ClassifierInput
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 })
  }

  if (!input?.inbound_message || !input?.state) {
    return new Response(JSON.stringify({ error: 'missing_fields' }), { status: 400 })
  }

  try {
    const output = await classify(input)
    return new Response(JSON.stringify(output), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (e) {
    console.error('[bot-classifier] handler error', e)
    return new Response(
      JSON.stringify({ label: 'unclear', confidence: 0.3, error: String(e).slice(0, 200) }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }
})
