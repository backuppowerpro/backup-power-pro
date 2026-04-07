/**
 * ai-taskmaster
 *
 * Chat endpoint for the BPP CRM "AI Taskmaster" assistant.
 *
 * POST /ai-taskmaster
 * Body: { question: string, contextSummary?: string, history?: {role, content}[] }
 *
 * Behavior:
 *   - If ANTHROPIC_API_KEY is set, calls Claude (claude-haiku-4-5 by default)
 *     with a BPP-specific system prompt + the compact contextSummary the CRM
 *     client already computed from in-memory data.
 *   - If ANTHROPIC_API_KEY is NOT set, returns { fallback: true, answer: "..." }
 *     and lets the client's rule-based interpreter take over. The client handles
 *     the fallback path too, but we echo a graceful message so the chat never
 *     just dies.
 *   - CORS is wide-open (matches the other BPP edge functions).
 *   - No Supabase client / DB access — everything the assistant needs is
 *     packaged up in contextSummary by the CRM client. This keeps the edge
 *     function fast and stateless.
 *
 * To activate Claude chat:
 *   supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref reowtzedjflwmlptupbk
 *   supabase functions deploy ai-taskmaster --project-ref reowtzedjflwmlptupbk
 *
 * Until the key is set, this function still responds 200 OK with fallback:true.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const SYSTEM_PROMPT = `You are "Taskmaster", the personal AI assistant inside Key Goodson's Backup Power Pro (BPP) CRM. BPP installs generator inlet boxes for homeowners in Upstate South Carolina (Greenville, Spartanburg, Pickens counties — NEVER Anderson).

WHO YOU TALK TO
You talk to Key. He is the owner, licensed SC electrician, solo operator. He prefers short bullet-point answers over long paragraphs. He wants clear, prioritized actions — never generic advice.

HOW THE CRM WORKS
The pipeline has 9 stages:
  1. Form Submitted (brand new lead)
  2. Responded (conversation started)
  3. Quote Sent (waiting to close)
  4. Booked (customer paid deposit)
  5. Permit Submitted
  6. Permit Paid
  7. Permit Approved
  8. Inspection Scheduled
  9. Complete

BPP's offer ("The Storm-Ready Connection System"):
  - $1,197-$1,497 for a code-compliant inlet box + interlock install in 1 day
  - Customer already owns a portable generator
  - Anchor against $15K standby cost
  - Loss framing + sunk cost leverage

BUSINESS STATE
Key is working toward $150K spendable profit in the Found business account. The three bottlenecks, in order, are:
  1. Marketing — 3 leads/day at CPL < $30
  2. Sales — 35-40% close rate, respond within 15 min
  3. Production — hire first electrical subcontractor to break the 5/week solo ceiling

HOW TO ANSWER
- You receive a compact JSON contextSummary with counts, urgent items, stale leads, permits, materials status, recent messages, and financial stats. Use it. Do not fabricate numbers.
- Reference contacts by their first name + last initial when you have names. If the contextSummary includes contact IDs, include them in a parenthetical so the CRM can link them — format exactly as "(id:abc123)". The CRM strips these to render clickable cards.
- Lead with the most urgent thing. Key does NOT want a wall of text.
- When you suggest an action, make it concrete: which contact, which channel, what to say.
- If the question is ambiguous, answer the most useful interpretation and briefly note what you assumed.
- If you don't have data for something, say so plainly — do not guess.
- Never invent dollar amounts, phone numbers, addresses, or permit statuses.
- Keep responses under ~180 words unless Key explicitly asks for a deep-dive.
- Use plain text (no markdown headers). Use emoji sparingly for section markers when listing multiple categories (fire for urgent, calendar for today, sparkle for good news).

RULES
- NEVER suggest contacting Anderson County customers — BPP does not serve them.
- NEVER suggest bypassing permits. BPP always permits.
- NEVER recommend lowering the price below $1,197.
- NEVER suggest emailing when SMS is the primary channel.
- When unsure, ask a short clarifying question instead of guessing.`

interface ChatMessage { role: 'user' | 'assistant'; content: string }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  let body: { question?: string; contextSummary?: string; history?: ChatMessage[] } = {}
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const question = (body.question || '').toString().trim()
  const contextSummary = (body.contextSummary || '').toString()
  const history = Array.isArray(body.history) ? body.history.slice(-8) : []

  if (!question) {
    return new Response(JSON.stringify({ error: 'question required' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') || ''
  if (!apiKey) {
    // Graceful fallback — the CRM client has a rule-based interpreter that will
    // handle the question locally. We echo a short message so anything listening
    // just for the server response still sees something.
    return new Response(JSON.stringify({
      fallback: true,
      answer: "Claude API is not configured on the server yet, so I am answering this one with the built-in rules. To upgrade: add ANTHROPIC_API_KEY to the Supabase edge function secrets and re-deploy ai-taskmaster.",
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // Build the user message: the question + the compact context summary the
  // CRM client already generated. We keep the context OUT of the system
  // prompt so we can cache the system prompt aggressively on the Anthropic
  // side.
  const userContent = contextSummary
    ? `Current CRM snapshot:\n${contextSummary}\n\nKey's question:\n${question}`
    : question

  const messages: ChatMessage[] = [
    ...history.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content),
    { role: 'user', content: userContent },
  ]

  try {
    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages,
      }),
    })

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text()
      return new Response(JSON.stringify({
        fallback: true,
        answer: "The Claude API returned an error. Falling back to built-in rules for this question.",
        debug: { status: anthropicResp.status, body: errText.slice(0, 400) },
      }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const data = await anthropicResp.json()
    const answer = Array.isArray(data?.content)
      ? data.content.map((p: any) => (p && p.type === 'text' ? p.text : '')).join('').trim()
      : ''

    if (!answer) {
      return new Response(JSON.stringify({
        fallback: true,
        answer: "Claude returned an empty response. Falling back to built-in rules for this question.",
      }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ fallback: false, answer, model: data?.model || 'claude-haiku-4-5' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({
      fallback: true,
      answer: "Could not reach the Claude API. Falling back to built-in rules for this question.",
      debug: { error: String(err) },
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
