/**
 * alex-agent — Supabase-native SMS agent for BPP lead qualification
 *
 * Rebuilt from Anthropic Managed Agent → direct Anthropic API (same pattern as ai-taskmaster).
 * Benefits: full tool control, native memory, contact injection, no console dependency.
 *
 * TEST MODE: Only accepts messages from KEY_PHONE (+19414417996)
 * To test: text (864) 400-5302 from your cell.
 * To reset: text RETEST — clears session history and Alex starts fresh.
 *
 * Flow:
 * 1. Quo webhook → this function
 * 2. Idempotency check (alex_dedup)
 * 3. TEST MODE gate
 * 4. Load or create session + conversation history
 * 5. Inject CRM contact context (on new session)
 * 6. Send to Claude Opus with tools
 * 7. Handle tool calls: write_memory, mark_complete
 * 8. Save updated history to DB
 * 9. Relay response via Quo SMS
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── CONFIG ────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY     = Deno.env.get('ANTHROPIC_API_KEY')!
const QUO_API_KEY           = Deno.env.get('QUO_API_KEY')!
const QUO_PHONE_ID          = Deno.env.get('QUO_PHONE_NUMBER_ID')!    // (864) 400-5302
const KEY_PHONE             = '+19414417996'
const QUO_INTERNAL_PHONE_ID = Deno.env.get('QUO_INTERNAL_PHONE_ID') || 'PNPhgKi0ua'

const TEST_MODE = true   // Set false when going live

const MODEL = 'claude-opus-4-6'
const MAX_TOKENS = 500

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// ── SYSTEM PROMPT ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `RULES:
- NEVER give electrical advice or assessments. You are not an electrician.
- NEVER say a dollar amount.
- NEVER use em dashes.
- NEVER use emoji.
- NEVER use bold, italic, or markdown.
- NEVER say: Great question, Absolutely, Thank you for reaching out, Id be happy to, I appreciate, I understand, Fair question, Awesome, Dont hesitate
- NEVER sound desperate.
- Max one exclamation mark per conversation.
- KEEP IT SHORT. Say what needs to be said and stop. Do not over-explain.
- Do NOT volunteer that you are AI.
- Do NOT describe the installation in technical detail. Just say we hook the generator up to the panel.

You are Alex. You work for Backup Power Pro. Your job is to collect photos and contact info so our electrician can put together a quote.

Tone: friendly and professional. Warm but not your best friend, not a robot.

INTRO (first message only):
Hi, this is Alex with Backup Power Pro. I saw your interest in getting a generator connected to your panel. Do you have a portable generator?

== ELECTRICIAN REFERENCES ==
First mention: "Key, our electrician"
After that: "Key" or "he"

== COLLECT (one item at a time, in order) ==
1. Confirm they have a portable generator.
2. Photo of the generator outlet. Key needs to see the plug type.
3. Photo of the main electrical panel with the door open. Key needs to see the breakers.
4. Full name.
5. Email address.
6. Street address.
7. Best time to reach them.
When all collected → call mark_complete tool.

== WHAT WE DO ==
If they ask: "We connect your generator to your home's panel so you can power your house during outages. Key reviews your photos and handles all the details."

== PRICE ==
"That is up to Key, our electrician. He will have a number once he reviews your photos."
Then continue collecting.

== AI QUESTION ==
If asked directly: "Yes, I am. The company set me up to get the process started faster."
Do not bring this up unprompted.

== TECHNICAL QUESTION ==
Any electrical or wiring question: "Key will answer that when he reviews your setup."

== WANTS TO SPEAK WITH SOMEONE ==
"Of course. What is the best time to reach you?"

== COVERAGE ==
Greenville, Spartanburg, Pickens counties. If outside: "We do not cover that area currently."

== LATE NIGHT / NO RUSH ==
"No rush on the photos. Send them whenever."

== KEY TAKES OVER ==
Stop responding.

== GHOST FOLLOW-UP ==
Day 1 (sent if no reply after ~24h):
"Hi [name], just checking in. Whenever you get those photos to Key, he can get your quote started."

Day 3 (sent if still no reply):
"Still want us to take a look?"

Day 7 (final follow-up):
"No pressure at all. We are here whenever you are ready."
After Day 7: stop.

== DONE ==
When you have both photos AND name, email, and address — call the mark_complete tool with a summary.
Do not output [LEAD_COMPLETE] as text. Use the tool.

== MEMORY ==
Use the write_memory tool whenever you learn something worth keeping:
- Generator type or size
- Panel location or quirks
- Objections or concerns raised
- Scheduling preferences
- Anything that would help Key or a future conversation`

// ── TOOLS ────────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'write_memory',
    description: 'Save an important fact about this lead for future reference. Use for generator details, objections, scheduling preferences, or anything Key should know.',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Short label, e.g. "generator_type", "panel_location", "objection"' },
        value: { type: 'string', description: 'What to remember' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'mark_complete',
    description: 'Call this when you have collected all required info: generator confirmed, both photos received, name, email, address, and best time. This notifies Key to create the quote.',
    input_schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Brief summary: Name, address, generator type, what photos were received.',
        },
      },
      required: ['summary'],
    },
  },
]

// ── DB HELPERS ────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

async function claimMessage(supabase: any, msgId: string): Promise<boolean> {
  const { error } = await supabase.from('alex_dedup').insert({ message_id: msgId })
  return error?.code !== '23505'
}

async function getSession(supabase: any, phone: string): Promise<{ id: string; messages: any[] } | null> {
  const { data } = await supabase
    .from('alex_sessions')
    .select('session_id, messages')
    .eq('phone', phone)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
  if (!data?.[0]) return null
  return { id: data[0].session_id, messages: data[0].messages || [] }
}

async function createSession(supabase: any, phone: string): Promise<{ id: string; messages: any[] }> {
  const id = crypto.randomUUID()
  await supabase.from('alex_sessions').insert({
    phone,
    session_id: id,
    status: 'active',
    messages: [],
  })
  console.log('[alex] Created session:', id)
  return { id, messages: [] }
}

async function saveMessages(supabase: any, sessionId: string, messages: any[]): Promise<void> {
  await supabase
    .from('alex_sessions')
    .update({ messages, last_outbound_at: new Date().toISOString() })
    .eq('session_id', sessionId)
}

async function clearSessions(supabase: any, phone: string): Promise<void> {
  await supabase.from('alex_sessions').update({ status: 'reset' }).eq('phone', phone).eq('status', 'active')
  console.log('[alex] Cleared sessions for', phone)
}

// ── CONTEXT INJECTION ─────────────────────────────────────────────────────────

async function buildContactContext(supabase: any, phone: string): Promise<string> {
  const digits = phone.replace(/\D/g, '').slice(-10)

  const [{ data: contact }, { data: memories }] = await Promise.all([
    supabase
      .from('contacts')
      .select('name, address, stage, install_notes, created_at')
      .ilike('phone', `%${digits}`)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('sparky_memory')
      .select('key, value')
      .like('key', `contact:${phone}:%`)
      .order('key'),
  ])

  if (!contact && (!memories || memories.length === 0)) return ''

  const lines = ['[INTERNAL BRIEFING — not visible to customer]']

  if (contact) {
    lines.push(`CRM record:`)
    if (contact.name)    lines.push(`  Name: ${contact.name}`)
    if (contact.address) lines.push(`  Address: ${contact.address}`)
    if (contact.stage)   lines.push(`  Stage: ${contact.stage}`)
    if (contact.install_notes) {
      const notes = contact.install_notes.replace(/^__pm_[^:]+:[^\n]*\n?/gm, '').trim()
      if (notes) lines.push(`  Notes: ${notes.slice(0, 400)}`)
    }
  }

  if (memories?.length) {
    lines.push(`Memory from prior conversations:`)
    for (const m of memories) {
      lines.push(`  ${m.key.replace(`contact:${phone}:`, '')}: ${m.value}`)
    }
  }

  lines.push(`Use this naturally. If returning lead, briefly acknowledge.`)
  lines.push('[END BRIEFING]')
  return lines.join('\n')
}

// ── ANTHROPIC CALL ────────────────────────────────────────────────────────────

async function callClaude(messages: any[]): Promise<any> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    }),
  })
  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Claude API error ${resp.status}: ${err}`)
  }
  return resp.json()
}

// ── TOOL EXECUTION ────────────────────────────────────────────────────────────

async function executeTool(
  supabase: any,
  phone: string,
  sessionId: string,
  toolName: string,
  toolInput: any,
): Promise<{ result: string; complete: boolean; summary?: string }> {
  if (toolName === 'write_memory') {
    const key = `contact:${phone}:${toolInput.key}`
    await supabase
      .from('sparky_memory')
      .upsert({ key, value: String(toolInput.value) }, { onConflict: 'key' })
    console.log('[alex] Memory saved:', key)
    return { result: `Saved: ${toolInput.key}`, complete: false }
  }

  if (toolName === 'mark_complete') {
    await supabase
      .from('alex_sessions')
      .update({ status: 'complete', summary: toolInput.summary })
      .eq('session_id', sessionId)
    return { result: 'Marked complete', complete: true, summary: toolInput.summary }
  }

  return { result: `Unknown tool: ${toolName}`, complete: false }
}

// ── AGENTIC LOOP ──────────────────────────────────────────────────────────────
// Handles tool calls in a loop until Claude stops or mark_complete fires.

async function runAlex(
  supabase: any,
  phone: string,
  sessionId: string,
  messages: any[],
): Promise<{ response: string; updatedMessages: any[]; complete: boolean; summary?: string }> {
  let complete = false
  let completeSummary: string | undefined

  while (true) {
    const data = await callClaude(messages)
    const assistantContent = data.content || []

    // Append assistant turn to history
    messages = [...messages, { role: 'assistant', content: assistantContent }]

    if (data.stop_reason === 'end_turn') {
      const text = assistantContent.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
      return { response: text, updatedMessages: messages, complete, summary: completeSummary }
    }

    if (data.stop_reason === 'tool_use') {
      const toolResults: any[] = []

      for (const block of assistantContent) {
        if (block.type !== 'tool_use') continue

        const { result, complete: isComplete, summary } = await executeTool(
          supabase, phone, sessionId, block.name, block.input,
        )

        if (isComplete) { complete = true; completeSummary = summary }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        })
      }

      // Continue loop with tool results
      messages = [...messages, { role: 'user', content: toolResults }]
      continue
    }

    // Unexpected stop reason — extract whatever text exists and return
    const text = assistantContent.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
    return { response: text || 'Give me just a moment.', updatedMessages: messages, complete, summary: completeSummary }
  }
}

// ── OUTBOUND HELPERS ──────────────────────────────────────────────────────────

function cleanSms(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\u2014/g, ',')
    .replace(/\u2013/g, '-')
    .trim()
}

async function sendQuoMessage(to: string, content: string): Promise<void> {
  try {
    await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: QUO_API_KEY },
      body: JSON.stringify({ from: QUO_PHONE_ID, to: [to], content }),
    })
    console.log('[quo] Sent to', to, ':', content.slice(0, 60))
  } catch (err) {
    console.error('[quo] Send failed:', err)
  }
}

async function notifyKeyQuo(phone: string, summary: string): Promise<void> {
  const msg = `LEAD READY FOR QUOTE\n\n${summary}\n\nPhone: ${phone}\nAlex collected all info. Review photos and create quote.`
  try {
    await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: QUO_API_KEY },
      body: JSON.stringify({ from: QUO_INTERNAL_PHONE_ID, to: [KEY_PHONE], content: msg }),
    })
  } catch (err) {
    console.error('[notify] Failed:', err)
  }
}

async function reportToSparky(
  supabase: any,
  contactId: string | null,
  phone: string,
  priority: 'urgent' | 'normal' | 'fyi',
  summary: string,
  suggestedAction?: string,
): Promise<void> {
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')!}/functions/v1/sparky-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
      },
      body: JSON.stringify({ agent: 'alex', contact_id: contactId || undefined, priority, summary, suggested_action: suggestedAction }),
    })
  } catch (err) {
    console.error('[alex] reportToSparky failed:', err)
  }
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS })

  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400, headers: CORS })
  }

  const eventType   = body?.type
  const messageData = body?.data?.object

  if (eventType !== 'message.received' || !messageData) {
    return new Response(JSON.stringify({ skipped: true }), { status: 200, headers: CORS })
  }
  if (messageData.direction === 'outgoing') {
    return new Response(JSON.stringify({ skipped: true, reason: 'outbound' }), { status: 200, headers: CORS })
  }

  const fromPhone   = messageData.from || ''
  const messageText = (messageData.body || messageData.text || '').trim()
  const hasMedia    = !!(messageData.media?.length)
  const quoMsgId   = messageData.id || `${fromPhone}-${messageData.createdAt || Date.now()}`

  if (TEST_MODE && fromPhone !== KEY_PHONE) {
    console.log('[alex] TEST MODE: ignoring', fromPhone)
    return new Response(JSON.stringify({ skipped: true, reason: 'test_mode' }), { status: 200, headers: CORS })
  }

  if (!messageText && !hasMedia) {
    return new Response(JSON.stringify({ skipped: true, reason: 'empty' }), { status: 200, headers: CORS })
  }

  console.log('[alex] Incoming from', fromPhone, ':', messageText.slice(0, 60))

  const supabase = db()

  // Idempotency
  if (!await claimMessage(supabase, quoMsgId)) {
    console.log('[alex] Duplicate, skipping:', quoMsgId)
    return new Response(JSON.stringify({ skipped: true, reason: 'duplicate' }), { status: 200, headers: CORS })
  }

  // RETEST: wipe history and start fresh
  if (messageText.toUpperCase() === 'RETEST') {
    await clearSessions(supabase, fromPhone)
    const session = await createSession(supabase, fromPhone)

    const context = await buildContactContext(supabase, fromPhone)
    const messages: any[] = []
    if (context) messages.push({ role: 'user', content: context })

    messages.push({ role: 'user', content: 'Send your opening message now.' })

    const { response, updatedMessages } = await runAlex(supabase, fromPhone, session.id, messages)
    await saveMessages(supabase, session.id, updatedMessages)
    await sendQuoMessage(fromPhone, cleanSms(response))

    return new Response(JSON.stringify({ success: true, action: 'retest' }), { status: 200, headers: CORS })
  }

  // Load or create session
  let session = await getSession(supabase, fromPhone)
  const isNew = !session

  if (!session) {
    session = await createSession(supabase, fromPhone)
  }

  let messages = session.messages

  // New session: inject context + send opener first
  if (isNew) {
    const context = await buildContactContext(supabase, fromPhone)
    if (context) messages.push({ role: 'user', content: context })

    messages.push({ role: 'user', content: 'Send your opening message now.' })
    const { response: opener, updatedMessages: afterOpener } = await runAlex(supabase, fromPhone, session.id, messages)
    messages = afterOpener

    await sendQuoMessage(fromPhone, cleanSms(opener))

    // If it was just a greeting, opener is enough for this webhook
    const isGreeting = /^(hi|hey|hello|yo|sup|test|testing)[\s!.?]*$/i.test(messageText)
    if (isGreeting) {
      await saveMessages(supabase, session.id, messages)
      return new Response(JSON.stringify({ success: true, action: 'opener_sent' }), { status: 200, headers: CORS })
    }
  }

  // Build user message
  let userText = messageText
  if (hasMedia) userText = userText ? `${userText}\n\n[Customer sent a photo]` : '[Customer sent a photo]'
  messages.push({ role: 'user', content: userText })

  // Typing delay
  await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000))

  // Run Alex
  let response: string
  let complete = false
  let summary: string | undefined

  try {
    const result = await runAlex(supabase, fromPhone, session.id, messages)
    response = result.response
    messages = result.updatedMessages
    complete = result.complete
    summary = result.summary
  } catch (err) {
    console.error('[alex] Agent error:', err)
    response = 'I am having a little trouble right now. Key will follow up with you shortly.'
  }

  // Save history
  await saveMessages(supabase, session.id, messages)

  // Handle completion
  if (complete && summary) {
    const digits = fromPhone.replace(/\D/g, '').slice(-10)
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name')
      .ilike('phone', `%${digits}%`)
      .limit(1)
    const contactId = contacts?.[0]?.id || null
    const contactName = contacts?.[0]?.name || fromPhone

    reportToSparky(supabase, contactId, fromPhone, 'urgent',
      `${contactName} is ready for a quote. Alex collected panel info and photos.`,
      'Open contact, review photos, send proposal.',
    ).catch(() => {})
    notifyKeyQuo(fromPhone, summary).catch(() => {})
  }

  if (response) await sendQuoMessage(fromPhone, cleanSms(response))

  return new Response(JSON.stringify({ success: true, sessionId: session.id }), { status: 200, headers: CORS })
})
