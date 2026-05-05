// Edge function: bot-photo-classifier
// Reads a photo URL + expected subject, returns a vision-classifier result.
// Uses Anthropic Opus 4.7 (vision) with the proven tool-call pattern.
//
// Auth: requireServiceRole — internal-only.

import { requireServiceRole, allowRate } from '../_shared/auth.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

import { SYSTEM_PROMPT_TEMPLATE as SYSTEM_PROMPT } from './system-prompt.ts'

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    subject: {
      type: 'string',
      enum: [
        // v10.1.5 panel split
        'panel_main_open_clear', 'panel_main_open_partial', 'panel_main_closed',
        'panel_subpanel', 'panel_meter_main_combo', 'panel_mlo',
        'panel_hazardous_zinsco', 'panel_hazardous_fpe',
        // legacy panel labels (still emitted by some prompt paths)
        'panel_open_clear', 'panel_open_partial', 'panel_closed', 'subpanel',
        // outlets
        'outlet_240v_4prong', 'outlet_120v_3prong_30a',
        'outlet_240v_clear', 'outlet_120v_clear', 'outlet_unclear',
        // other
        'generator', 'meter',
        'wrong_subject', 'blurry', 'multiple_photos', 'unsure',
      ],
    },
    subject_confidence: { type: 'number', minimum: 0, maximum: 1 },
    obvious_issues: { type: 'array', items: { type: 'string' } },
    amperage_visible: { type: 'string', enum: ['30A', '50A', 'unknown'] },
    prong_count: { type: 'string' },
    panel_brand_visible: { type: 'string' },
    panel_amperage_visible: {
      type: 'string',
      enum: ['100A', '125A', '150A', '200A', '400A', 'unknown'],
    },
    is_main_panel_likely: { type: 'string' },
    main_breaker_confidence: { type: 'number', minimum: 0, maximum: 1 },
    main_breaker_visual_signals: { type: 'array', items: { type: 'string' } },
    primary_recommendation: {
      type: 'string',
      enum: [
        'accept', 'ask_to_open', 'ask_clearer', 'ask_correct',
        'ask_main_panel', 'accept_with_followup', 'accept_flag_hazardous',
      ],
    },
  },
  required: ['subject', 'subject_confidence', 'primary_recommendation'],
  additionalProperties: false,
}

interface PhotoClassifierInput {
  photo_url?: string             // public/signed URL OR https URL — preferred
  storage_path?: string          // path within mms-inbound bucket — fallback
  expected_subject: 'panel' | 'outlet' | 'either'
  conversation_context?: string
}

async function fetchSignedUrl(path: string): Promise<string | null> {
  const resp = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/mms-inbound/${path}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SR}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 600 }),
    },
  )
  if (!resp.ok) return null
  const data = await resp.json()
  return `${SUPABASE_URL}/storage/v1${data.signedURL}`
}

async function fetchAsBase64(url: string): Promise<{ b64: string; contentType: string } | null> {
  const r = await fetch(url)
  if (!r.ok) return null
  const bytes = new Uint8Array(await r.arrayBuffer())
  // Avoid btoa-on-large-string OOM; chunk-encode.
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return {
    b64: btoa(bin),
    contentType: r.headers.get('content-type') || 'image/jpeg',
  }
}

async function classify(input: PhotoClassifierInput) {
  // Resolve URL
  let imageUrl = input.photo_url || ''
  if (!imageUrl && input.storage_path) {
    const signed = await fetchSignedUrl(input.storage_path)
    if (!signed) return null
    imageUrl = signed
  }
  if (!imageUrl) return null

  // Anthropic supports image-by-URL on some endpoints, but base64 is the
  // universally safe path. Fetch + base64 here.
  const img = await fetchAsBase64(imageUrl)
  if (!img) return null

  const userContext =
    `expected_subject: ${input.expected_subject}\n` +
    `conversation_context: ${input.conversation_context || ''}`

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: userContext },
            {
              type: 'image',
              source: { type: 'base64', media_type: img.contentType, data: img.b64 },
            },
          ],
        },
      ],
      tools: [
        {
          name: 'classify',
          description: 'Return the structured photo classification.',
          input_schema: OUTPUT_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'classify' },
    }),
  })

  if (!resp.ok) {
    console.error('[bot-photo-classifier] anthropic error', resp.status, (await resp.text()).slice(0, 300))
    return null
  }

  const data = await resp.json()
  const toolUse = data.content?.find((b: any) => b.type === 'tool_use')
  return toolUse?.input || null
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const gate = requireServiceRole(req)
  if (gate) return gate

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowRate(`bot-photo-classifier:${ip}`, 120)) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 })
  }

  let input: PhotoClassifierInput
  try {
    input = (await req.json()) as PhotoClassifierInput
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 })
  }

  if (!input?.expected_subject || (!input.photo_url && !input.storage_path)) {
    return new Response(JSON.stringify({ error: 'missing_fields' }), { status: 400 })
  }

  try {
    const output = await classify(input)
    if (!output) {
      // Soft-fail to keep flow moving; Key reviews via CRM.
      return new Response(
        JSON.stringify({
          subject: 'unsure',
          subject_confidence: 0.0,
          primary_recommendation: 'accept_with_followup',
          obvious_issues: ['classifier_failed'],
        }),
        { headers: { 'content-type': 'application/json' } },
      )
    }
    return new Response(JSON.stringify(output), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (e) {
    console.error('[bot-photo-classifier] handler error', e)
    return new Response(
      JSON.stringify({
        subject: 'unsure',
        subject_confidence: 0.0,
        primary_recommendation: 'accept_with_followup',
        obvious_issues: ['handler_error'],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }
})
