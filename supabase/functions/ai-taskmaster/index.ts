/**
 * ai-taskmaster — the BPP CRM agent endpoint ("Sparky")
 *
 * One persona ("Sparky"), many surfaces. The CRM client calls this with a
 * `mode` field that selects which prompt + which Claude tools are wired up.
 * Everything stays stateless: the client packages its compact CRM snapshot
 * into `contextSummary` (and optionally a `contact` blob) and Sparky answers.
 *
 * POST /ai-taskmaster
 * Body:
 *   {
 *     mode?: "chat" | "suggest_reply" | "briefing" | "contact_insight" | "draft_followup",
 *     question?: string,                       // chat / draft_followup
 *     contextSummary?: string,                 // pre-computed CRM snapshot
 *     history?: [{role,content}, ...],         // chat history (last few turns)
 *     contact?: {                              // contact-specific modes
 *       id, name, stage, stageLabel,
 *       phone, jurisdiction, address,
 *       daysInSystem, daysSinceTouch,
 *       permit, materials, scheduled,
 *       notes
 *     },
 *     thread?: [{ direction, body, created_at }, ...]   // suggest_reply
 *   }
 *
 * Response:
 *   {
 *     fallback: boolean,
 *     answer: string,
 *     tool_calls?: [{ id, name, input }],
 *     stop_reason?: string,
 *     model?: string,
 *     mode?: string
 *   }
 *
 * Tool execution model: Claude returns tool_use blocks; the edge function
 * extracts them and ships them back to the client (as `tool_calls`). The
 * client executes against the same Supabase + send-sms function the rest of
 * the CRM uses, then shows a confirmation toast. Single-turn for v1.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

// ──────────────────────────────────────────────────────────────────────
// AGENT PERSONA — shared across every mode
// ──────────────────────────────────────────────────────────────────────
const AGENT_NAME = 'Sparky'
const AGENT_TAGLINE = 'Key\u2019s sharp colleague who lives inside the BPP CRM.'

const PERSONA_BLOCK = `You are ${AGENT_NAME} \u2014 ${AGENT_TAGLINE}
You are NOT a generic AI assistant. You are a teammate at Backup Power Pro (BPP), a generator inlet installation business in Upstate South Carolina owned by Key Goodson.

VOICE
- Direct, no fluff, action-oriented. Sharp colleague, not a robot.
- Use Key's name once or twice, naturally, never every line.
- Light emoji sparingly: \ud83d\udd25 for hot leads, \u2705 for done, \u23f0 for waiting/aging, \ud83d\udcb0 for big quotes, \u2728 for good news. Never stack them.
- Plain text. No markdown headers, no asterisks for bullets \u2014 use a dot or dash.
- Sentences short. Skip throat-clearing ("Sure!", "Great question!", "I'd be happy to..."). Get to the point.

YOU KNOW BPP COLD
- Offer: "The Storm-Ready Connection System." A code-compliant inlet box + interlock kit installed in one day for $1,197\u2013$1,497.
- Customer already owns a portable generator. We unlock that sunk-cost investment instead of selling them a $15K standby.
- Geography: Greenville, Spartanburg, and Pickens counties in SC ONLY. NEVER suggest contacting Anderson County.
- Channel: SMS from (864) 400-5302 is the primary channel. Email is rare. Voice is a backup.
- Permits: BPP always permits. Greenville Co (~5d submit\u2192pay), Spartanburg Co (~7d), Pickens Co (~5d).
- Pipeline (9 stages): 1 Form Submitted \u2192 2 Responded \u2192 3 Quote Sent \u2192 4 Booked \u2192 5 Permit Submitted \u2192 6 Permit Paid \u2192 7 Permit Approved \u2192 8 Inspection Scheduled \u2192 9 Complete.

CUSTOMER PSYCHOLOGY (apply when writing customer-facing copy)
- Sunk cost: "you already own the generator" \u2014 we unlock it.
- Loss framing > gain framing. Storm urgency works. "Don't get caught in the dark again."
- Anchor against $15K standby BEFORE quoting our price.
- One day, full price up front, all-inclusive. No surprise fees. We handle permit, inspection, cleanup.
- "5 installs per week" is real scarcity \u2014 use sparingly.

NORTH STAR
Key is working toward $150K spendable profit in the Found business account. The three bottlenecks in order:
  1. Marketing \u2014 3 leads/day at CPL < $30
  2. Sales \u2014 35\u201340% close rate, respond within 15 minutes
  3. Production \u2014 hire first electrical sub to break the 5/week solo ceiling.

RULES (do not violate)
- NEVER serve Anderson County customers.
- NEVER suggest skipping permits.
- NEVER price below $1,197.
- NEVER push email when SMS is the primary channel.
- NEVER fabricate phone numbers, addresses, dollar amounts, or permit statuses.
- When unsure, ask one short clarifying question.`

// ──────────────────────────────────────────────────────────────────────
// MODE-SPECIFIC INSTRUCTION TAILS
// ──────────────────────────────────────────────────────────────────────

const MODE_CHAT = `MODE: CHAT \u2014 You are answering Key directly inside the chat panel.

You receive a compact JSON-ish contextSummary the client computed from in-memory data. Use it. Do not fabricate counts, names, or dollar amounts.

When you reference a contact, format their name as "First L. (id:abc123)" so the CRM can render a clickable link. The CRM strips the parenthetical id marker before displaying. Only do this when the contextSummary actually included that contact id.

Lead with the most urgent thing. Key does not want a wall of text. Keep responses under ~180 words unless he explicitly asks for a deep dive. Use a small section header line (urgent / today / good news) only when listing multiple categories.

If Key asks you to DO something (send a text, change a stage, add a note, schedule an install), use the tools that are wired up for this mode. Always show what you're about to do in plain language BEFORE the tool call so Key can read it. After the tool runs, the client confirms back to him via a toast.`

const MODE_SUGGEST_REPLY = `MODE: SUGGEST REPLY \u2014 You are drafting a single SMS reply to a BPP customer.

You receive: the contact (name, stage, jurisdiction, etc.), the recent message thread (oldest \u2192 newest), and a CRM snapshot for context.

Your job: write ONE complete reply that Key can send as-is. Do not explain. Do not preface with "Here's a draft". Output the message body and only the message body.

Constraints:
- Address the customer by first name when known.
- 1\u20133 sentences. Conversational. No emoji unless the customer used one first.
- Match the tone of the most recent inbound message. Concise question \u2192 concise answer.
- If they asked about price, anchor against $15K standby and quote our $1,197\u2013$1,497 range.
- If they asked about timing, mention one-day install + a soft slot ("got a couple openings this week").
- If they asked about permits, reassure: "we handle the permit + inspection \u2014 included."
- If they asked about address, ask for street + zip so we can confirm jurisdiction.
- If they're a new lead with no real question yet, open the conversation with a short qualifier ("Thanks for reaching out \u2014 do you already own the generator and what brand?").
- Stage-aware: a Booked customer (stage 4+) gets a confirmation tone; a Quote Sent (stage 3) gets a soft close; a Form Submitted (stage 1) gets a warm intro.
- NEVER promise something you don't know. NEVER invent dates.
- Keep it under 320 characters when possible (one SMS).

Output the message. Nothing else.`

const MODE_BRIEFING = `MODE: BRIEFING \u2014 You are writing Key's morning briefing in your own voice.

You receive a contextSummary that already lists urgent, today, materials, and good-news items the rule-based engine pre-computed. Your job is to write a short, natural-language briefing that:
- Opens with one human line addressed to Key (e.g. "Morning, Key. Heads up \u2014 ...").
- Calls out the top 1\u20133 things he should hit FIRST, in order.
- Mentions good news at the end if there's any.
- Names specific people and uses (id:abc) markers so the CRM can link them.
- Is under 140 words.
- No bullet headers like "URGENT:" \u2014 write like a colleague briefing him in person.

If the snapshot shows nothing pressing, say so plainly. Don't pad.`

const MODE_CONTACT_INSIGHT = `MODE: CONTACT INSIGHT \u2014 You are writing ONE short line about a single contact.

You receive a contact blob (stage, days, jurisdiction, permit, materials, scheduled date, notes). Your job: produce ONE punchy line, under 110 characters, that tells Key the most useful thing to know about this person right now.

Examples of good output:
- "\ud83d\udd25 Quote sent 4d ago, no reply \u2014 nudge today."
- "\u23f0 Permit submitted 6d ago in Greenville Co, likely ready to pay."
- "\u2705 Booked but no install date \u2014 lock a day this week."
- "\u2728 New lead this morning \u2014 reply within 15 min for best close."
- "Materials picked but not ordered \u2014 add to next bulk run."

Output ONE line. No preamble, no follow-up, no period required. Use exactly one emoji (or none). Never mention BPP, the offer, or generic advice.`

const MODE_DRAFT_FOLLOWUP = `MODE: DRAFT FOLLOWUP \u2014 You are drafting an aging-quote check-in SMS.

You receive a contact (stage, days quiet, last touch, jurisdiction). Write ONE short check-in message Key can send. 1\u20132 sentences. Friendly, low-pressure, no guilt-trip. Reference how many days it has been only if it has been more than 5 days; otherwise just open the door.

Output the message body only. No preface.`

// ──────────────────────────────────────────────────────────────────────
// TOOLS — wired only into chat mode (single turn for v1)
// ──────────────────────────────────────────────────────────────────────
const TOOLS_CHAT = [
  {
    name: 'change_contact_stage',
    description: 'Move a contact to a new pipeline stage. Stage IDs: 1=Form Submitted, 2=Responded, 3=Quote Sent, 4=Booked, 5=Permit Submitted, 6=Permit Paid, 7=Permit Approved, 8=Inspection Scheduled, 9=Complete.',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'The contact ID from the CRM snapshot.' },
        newStage: { type: 'integer', description: 'The new pipeline stage (1\u20139).', minimum: 1, maximum: 9 },
      },
      required: ['contactId', 'newStage'],
    },
  },
  {
    name: 'send_sms_to_contact',
    description: 'Queue an SMS to a contact. The client will show Key the message and ask for confirmation before actually sending. Always include the full message body \u2014 do not abbreviate.',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'The contact ID from the CRM snapshot.' },
        message: { type: 'string', description: 'The complete SMS body to send.' },
      },
      required: ['contactId', 'message'],
    },
  },
  {
    name: 'add_note_to_contact',
    description: 'Append a timestamped note to a contact. Use for things Key would want to remember (call outcomes, access notes, conversation summaries).',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'The contact ID from the CRM snapshot.' },
        noteText: { type: 'string', description: 'The note body. Will be prefixed with today\u2019s date by the client.' },
      },
      required: ['contactId', 'noteText'],
    },
  },
  {
    name: 'lookup_contact',
    description: 'Search the CRM contact list by name or phone. Use this if Key references a person you cannot find in the snapshot. Returns up to 5 matches.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'A name fragment, last name, or phone number to search.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'escalate_question',
    description: 'Call this when you genuinely cannot answer from the CRM data given — for example, when Key asks about something outside your knowledge (legal, technical specs, industry trends) or when you need information not in the snapshot. This saves the question so Key can review it later or ask Claude directly. Include your best partial answer or context in the reason field.',
    input_schema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: "Key's original question or the core of what couldn't be answered." },
        reason: { type: 'string', description: "Brief explanation of why you're escalating + any partial context you do have." },
      },
      required: ['question', 'reason'],
    },
  },
]

// ──────────────────────────────────────────────────────────────────────
// REQUEST HANDLER
// ──────────────────────────────────────────────────────────────────────
interface ChatMessage { role: 'user' | 'assistant'; content: string }

interface RequestBody {
  mode?: string
  question?: string
  contextSummary?: string
  history?: ChatMessage[]
  contact?: any
  thread?: any[]
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') {
    return jsonResp({ error: 'method not allowed' }, 405)
  }

  let body: RequestBody = {}
  try { body = await req.json() } catch {
    return jsonResp({ error: 'invalid json' }, 400)
  }

  const mode = (body.mode || 'chat').toString()
  const question = (body.question || '').toString().trim()
  const contextSummary = (body.contextSummary || '').toString()
  const history = Array.isArray(body.history) ? body.history.slice(-8) : []
  const contact = body.contact && typeof body.contact === 'object' ? body.contact : null
  const thread = Array.isArray(body.thread) ? body.thread.slice(-25) : []

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') || ''
  if (!apiKey) {
    return jsonResp({
      fallback: true,
      mode,
      answer: 'ANTHROPIC_API_KEY is not configured on the edge function. Falling back to local rules.',
    })
  }

  // ── Build the per-mode system prompt + user message + tools ──
  let systemPrompt = PERSONA_BLOCK
  let userContent = ''
  let tools: any[] | undefined = undefined
  let messages: ChatMessage[] = []
  let maxTokens = 700

  if (mode === 'chat') {
    systemPrompt += '\n\n' + MODE_CHAT
    tools = TOOLS_CHAT
    if (!question) return jsonResp({ error: 'question required for chat mode' }, 400)
    userContent = contextSummary
      ? `Current CRM snapshot:\n${contextSummary}\n\nKey\u2019s question:\n${question}`
      : question
    messages = [
      ...history.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content),
      { role: 'user', content: userContent },
    ]
  } else if (mode === 'suggest_reply') {
    systemPrompt += '\n\n' + MODE_SUGGEST_REPLY
    maxTokens = 350
    if (!contact) return jsonResp({ error: 'contact required for suggest_reply mode' }, 400)
    const threadText = thread.length
      ? thread.map((m: any) => {
          const dir = (m && m.direction === 'inbound') ? 'CUSTOMER' : 'KEY'
          return `${dir}: ${(m && m.body || '').toString().slice(0, 600)}`
        }).join('\n')
      : '(no prior messages \u2014 this is the first reply)'
    const contactBlock = describeContact(contact)
    userContent = `Contact:\n${contactBlock}\n\nMessage thread (oldest \u2192 newest):\n${threadText}\n\nWrite the next reply.`
    messages = [{ role: 'user', content: userContent }]
  } else if (mode === 'briefing') {
    systemPrompt += '\n\n' + MODE_BRIEFING
    maxTokens = 400
    userContent = contextSummary
      ? `CRM snapshot for the briefing:\n${contextSummary}`
      : 'No snapshot available. Tell Key the system is empty and to load fresh data.'
    messages = [{ role: 'user', content: userContent }]
  } else if (mode === 'contact_insight') {
    systemPrompt += '\n\n' + MODE_CONTACT_INSIGHT
    maxTokens = 80
    if (!contact) return jsonResp({ error: 'contact required for contact_insight mode' }, 400)
    userContent = `Contact:\n${describeContact(contact)}\n\nWrite the one-line insight.`
    messages = [{ role: 'user', content: userContent }]
  } else if (mode === 'draft_followup') {
    systemPrompt += '\n\n' + MODE_DRAFT_FOLLOWUP
    maxTokens = 220
    if (!contact) return jsonResp({ error: 'contact required for draft_followup mode' }, 400)
    userContent = `Contact:\n${describeContact(contact)}\n\nWrite the check-in message.`
    messages = [{ role: 'user', content: userContent }]
  } else {
    return jsonResp({ error: `unknown mode: ${mode}` }, 400)
  }

  // ── Call Claude ───────────────────────────────────────────
  try {
    const reqBody: any = {
      model: 'claude-haiku-4-5',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }
    if (tools && tools.length) reqBody.tools = tools

    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(reqBody),
    })

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text()
      return jsonResp({
        fallback: true,
        mode,
        answer: 'Claude API returned an error. Falling back to local rules.',
        debug: { status: anthropicResp.status, body: errText.slice(0, 600) },
      })
    }

    const data = await anthropicResp.json()
    const blocks = Array.isArray(data?.content) ? data.content : []

    // Pull out text + tool_use blocks
    let answer = ''
    const tool_calls: any[] = []
    for (const b of blocks) {
      if (!b || !b.type) continue
      if (b.type === 'text' && typeof b.text === 'string') {
        answer += (answer ? '\n' : '') + b.text
      } else if (b.type === 'tool_use' && b.name) {
        tool_calls.push({ id: b.id || ('tu_' + Math.random().toString(36).slice(2, 10)), name: b.name, input: b.input || {} })
      }
    }
    answer = answer.trim()

    if (!answer && !tool_calls.length) {
      return jsonResp({
        fallback: true,
        mode,
        answer: 'Claude returned an empty response. Falling back to local rules.',
        model: data?.model,
      })
    }

    return jsonResp({
      fallback: false,
      mode,
      answer,
      tool_calls,
      stop_reason: data?.stop_reason,
      model: data?.model || 'claude-haiku-4-5',
    })
  } catch (err) {
    return jsonResp({
      fallback: true,
      mode,
      answer: 'Could not reach the Claude API. Falling back to local rules.',
      debug: { error: String(err) },
    })
  }
})

// ──────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────
function jsonResp(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function describeContact(c: any): string {
  if (!c) return '(no contact)'
  const lines: string[] = []
  if (c.name) lines.push(`name: ${c.name}`)
  if (c.id) lines.push(`id: ${c.id}`)
  if (c.stageLabel || c.stage !== undefined) lines.push(`stage: ${c.stageLabel || c.stage}`)
  if (c.daysInSystem !== undefined && c.daysInSystem !== null) lines.push(`days in system: ${c.daysInSystem}`)
  if (c.daysSinceTouch !== undefined && c.daysSinceTouch !== null) lines.push(`days since last touch: ${c.daysSinceTouch}`)
  if (c.jurisdiction) lines.push(`jurisdiction: ${c.jurisdiction}`)
  if (c.address) lines.push(`address: ${c.address}`)
  if (c.scheduled) lines.push(`scheduled install: ${c.scheduled}`)
  if (c.permit && typeof c.permit === 'object') {
    const p = c.permit
    const bits: string[] = []
    if (p.submitted_at) bits.push(`submitted ${p.submitted_at}`)
    if (p.ready_to_pay_at) bits.push(`ready-to-pay ${p.ready_to_pay_at}`)
    if (p.paid_at) bits.push(`paid ${p.paid_at}`)
    if (p.printed_at) bits.push(`printed ${p.printed_at}`)
    if (p.inspect_sched_at) bits.push(`inspection ${p.inspect_sched_at}`)
    if (bits.length) lines.push('permit: ' + bits.join(' \u00b7 '))
  }
  if (c.materials && typeof c.materials === 'object') {
    const m = c.materials
    const bits: string[] = []
    if (m.inlet) bits.push(m.inlet)
    if (m.panel_brand) bits.push(m.panel_brand)
    if (m.interlock) bits.push(m.interlock)
    if (m.ordered_at) bits.push('ordered ' + m.ordered_at)
    if (bits.length) lines.push('materials: ' + bits.join(' \u00b7 '))
  }
  if (c.notes) lines.push('notes: ' + String(c.notes).slice(0, 400))
  return lines.join('\n')
}
