/**
 * quo-ai-new-lead
 * Called by get-quote.html when a form is submitted.
 * Creates contact in Supabase, sends AI-crafted first text via Quo, queues follow-up.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const QUO_API_KEY        = Deno.env.get('QUO_API_KEY')!
const QUO_PHONE_ID       = Deno.env.get('QUO_PHONE_NUMBER_ID')!
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS_HEADERS })

  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400, headers: CORS_HEADERS })
  }

  const {
    firstName, lastName, phone, email,
    address, addressCity, addressState, addressCounty,
    panelLocation, genVoltage,
  } = body || {}

  if (!phone) {
    return new Response(JSON.stringify({ error: 'phone required' }), { status: 400, headers: CORS_HEADERS })
  }

  // Normalize phone
  const digits = phone.replace(/\D/g, '')
  const normalizedPhone = digits.length === 10 ? `+1${digits}` : digits.startsWith('1') ? `+${digits}` : `+${digits}`
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'there'
  const fullAddress = address || [addressCity, addressState].filter(Boolean).join(', ') || ''

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // ── CHECK IF CONTACT ALREADY EXISTS ──────────────────────────────────────
  const last10 = normalizedPhone.slice(-10)
  const { data: existing } = await supabase
    .from('contacts')
    .select('*')
    .ilike('phone', `%${last10}%`)
    .limit(1)

  let contact: any = existing?.[0] ?? null

  if (!contact) {
    const { data: c } = await supabase
      .from('contacts')
      .insert({
        name: fullName,
        phone: normalizedPhone,
        email: email || null,
        address: fullAddress,
        ai_enabled: true,
        status: 'New Lead',
        notes: [
          panelLocation ? `Panel location: ${panelLocation}` : null,
          genVoltage     ? `Generator voltage: ${genVoltage}` : null,
          addressCounty  ? `County: ${addressCounty}` : null,
        ].filter(Boolean).join(' | ') || null,
      })
      .select()
      .single()
    contact = c
  }

  if (!contact) {
    return new Response(JSON.stringify({ error: 'failed to create contact' }), { status: 500, headers: CORS_HEADERS })
  }

  // ── GENERATE FIRST MESSAGE WITH AI ───────────────────────────────────────
  const systemPrompt = `Your name is Alex. You are writing the very first text message from Alex at Backup Power Pro to a new lead who filled out an online form.

Rules:
- Introduce yourself as Alex from Backup Power Pro and thank them warmly for reaching out.
- Do NOT sign with any name at the end.
- Warm, conversational, real — not robotic, not a cold Q&A
- 2-3 sentences max
- You may mention "Backup Power Pro" once in the intro, but don't repeat it
- Do NOT mention the form or website explicitly
- Reference their first name if available
- We ONLY service residential homes. NEVER ask if it is for a home or business — always assume it is a home.
- End with ONE soft, natural question: ask whether they already have a generator or are still looking to get one. This opens the conversation without feeling abrupt.
- Do NOT ask for their address (we already have it from the form)
- Tone example: "Hey [name], this is Alex with Backup Power Pro. Thanks so much for reaching out! Are you already working with a generator, or are you still in the process of getting one?"`

  const userMessage = `New lead details:
Name: ${fullName}
Address: ${fullAddress}
Panel location: ${panelLocation || 'not provided'}
Generator voltage answer: ${genVoltage || 'not provided'}`

  let firstMessage = `Hey${firstName ? ' ' + firstName : ''}, this is Alex with Backup Power Pro. Thanks so much for reaching out! Are you already working with a generator, or are you still in the process of getting one?`

  try {
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://backuppowerpro.com',
        'X-Title': 'BPP Sales Agent',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-5',
        max_tokens: 200,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    })
    const aiData = await aiRes.json()
    const generated = aiData.choices?.[0]?.message?.content?.trim()
    if (generated) firstMessage = generated
  } catch (err) {
    console.error('[AI] Failed to generate first message:', err)
  }

  // ── TYPING DELAY ─────────────────────────────────────────────────────────
  const typingMs = Math.min(11000, 1500 + firstMessage.length * 45 + Math.random() * 1500)
  await new Promise(resolve => setTimeout(resolve, typingMs))

  // ── SEND VIA QUO ──────────────────────────────────────────────────────────
  let quoMsgId: string | null = null
  try {
    const quoRes = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': QUO_API_KEY },
      body: JSON.stringify({ from: QUO_PHONE_ID, to: [normalizedPhone], content: firstMessage }),
    })
    const quoData = await quoRes.json()
    quoMsgId = quoData.data?.id || null
  } catch (err) {
    console.error('[QUO] Send failed:', err)
  }

  // ── SAVE OUTBOUND MESSAGE ─────────────────────────────────────────────────
  await supabase.from('messages').insert({
    contact_id: contact.id,
    direction: 'outbound',
    body: firstMessage,
    sender: 'ai',
    quo_message_id: quoMsgId,
  })

  // ── QUEUE FOLLOW-UP (24hrs if no reply) ───────────────────────────────────
  await supabase.from('follow_up_queue').insert({
    contact_id: contact.id,
    stage: 1,
    send_after: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  })

  return new Response(JSON.stringify({ success: true, contactId: contact.id }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
})
