/**
 * alex-postmortem — reflective learning loop.
 *
 * Trigger: fired after every Alex session that hits a terminal state.
 *   - outcome='booked'    when contact.stage transitions to 4+
 *   - outcome='installed' when contact.stage transitions to 9
 *   - outcome='cold'      when a scheduled sweep detects a 30-day silent lead
 *   - outcome='exit'      when a customer opts out / session deactivates
 *   - outcome='takeover'  when Key manually takes over mid-conversation
 *                         (highest-signal: Key's manual reply = correct answer)
 *
 * Reads the full chat transcript + existing /memories/ + outcome, calls
 * Claude Sonnet (not Opus — this is a cheap reflective pass), then writes
 * updates to /memories/alex/* or /memories/postmortem/*.
 *
 * The in-the-moment Alex focuses on the customer. This separate process
 * focuses on learning from truth — did the conversation actually work?
 *
 * POST /alex-postmortem
 * Body: { sessionId: string, outcome: 'booked'|'installed'|'cold'|'exit', note?: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceRole } from '../_shared/auth.ts'
import { handleMemoryTool, MEMORY_TOOL_DEF } from '../_shared/memory.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const MODEL = 'claude-sonnet-4-5' // reflective, cheap

const SYSTEM_PROMPT = `You are the post-mortem reflection step for BPP's Alex (customer-facing SMS agent).
Your job: read a completed conversation + its outcome + the current /memories/ playbook, and update the playbook with what actually worked or failed.

You have the "memory" tool. Use it to:
1. view /memories to see what's there
2. read the existing /memories/alex/patterns.md, objections.md, pitfalls.md, openers.md
3. str_replace / insert the ONE or TWO most durable learnings this conversation produced

Quality bar: only write if there is a genuinely durable pattern. Not "this one chat went well" — something that will apply to a FUTURE different customer. Overwrite, don't accumulate — merge into existing lines when possible.

HARD RULES:
- NEVER write customer names, phone numbers, street addresses, or exact prices (the scrubber will blank them out, but don't even try).
- Anonymized patterns only. "Customer with Generac generator + morning-hours responses" not "Jane at 42 Oakmont".
- If the conversation was unremarkable / nothing new to learn, write NOTHING and say so in your reply.
- Keep writes short. 1-3 lines per learning, max.

Outcome semantics:
- booked          = customer signed the proposal + deposit paid
- installed       = install completed (stage 9)
- cold            = 30-day silent, lead gave up on us
- exit            = customer explicitly declined / opted out / went with a competitor
- takeover        = Key manually stepped in and sent a message to the customer that Alex should learn from
                    — for takeovers, Key's actual message IS the correct response. Compare what Alex last said (or would have said) to what Key actually said, then write a learning: "Alex said X, Key corrected to Y. Pattern: when <situation>, prefer <Key's framing>."
- turn_reflection = session is STILL ACTIVE. This fires after every substantive customer turn. Expected default: "no update" — most turns are not teaching moments. Only write when THIS one exchange revealed a genuinely new durable pattern that is NOT already captured in /memories/alex/patterns.md / objections.md / pitfalls.md. Quality bar is higher here than at terminal outcomes because we fire much more often; a noisy write pollutes the file. Before writing, read the target file first and verify the learning is not already there.

Example good learning:
  "Signal: first inbound mentions a specific generator wattage → outcome booked at ~2x baseline rate. Skip the 'do you own a generator' qualifier."

Example bad learning (too specific / PII):
  "Jennifer closed in 3 hours on Tuesday." — contains a name and a specific time; not durable.`

async function runPostmortem(supabase: any, sessionId: string, outcome: string, note: string): Promise<{ result: string; toolCalls: number }> {
  // Fetch the session + messages + contact context (minus PII in prompt)
  const { data: session } = await supabase
    .from('alex_sessions')
    .select('session_id, phone, messages, summary, customer_last_msg_at, last_outbound_at, followup_count, photo_received')
    .eq('session_id', sessionId)
    .maybeSingle()
  if (!session) {
    return { result: 'session not found', toolCalls: 0 }
  }

  // Format transcript with minimal PII (we already strip in the scrubber
  // but do a pre-pass for the model to reduce distraction).
  const msgs = Array.isArray(session.messages) ? session.messages : []
  const transcript = msgs.slice(-40).map((m: any) => {
    const role = m.role === 'user' ? 'CUSTOMER' : 'ALEX'
    let text = typeof m.content === 'string' ? m.content
      : Array.isArray(m.content) ? m.content.filter((b: any) => b?.type === 'text').map((b: any) => b.text).join(' ')
      : ''
    text = text.slice(0, 600)
    return `${role}: ${text}`
  }).join('\n')

  const userMsg = `OUTCOME: ${outcome}
${note ? `EXTERNAL NOTE: ${note}\n` : ''}
TRANSCRIPT (last 40 turns):
${transcript}

PHOTO RECEIVED: ${session.photo_received ? 'yes' : 'no'}
FOLLOWUPS FIRED: ${session.followup_count || 0}

Task: read the current /memories/ and update what should change. If nothing durable was learned, reply exactly "no update" and do not call memory.`

  // Run Claude with the memory tool. Loop until stop_reason=end_turn.
  const messages: any[] = [{ role: 'user', content: userMsg }]
  let toolCalls = 0
  const MAX_LOOPS = 5
  for (let i = 0; i < MAX_LOOPS; i++) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        tools: [MEMORY_TOOL_DEF],
        messages,
      }),
    })
    const data = await resp.json()
    if (!resp.ok) {
      console.error('[postmortem] claude error:', data)
      return { result: `claude error: ${JSON.stringify(data).slice(0, 300)}`, toolCalls }
    }
    const blocks: any[] = Array.isArray(data.content) ? data.content : []
    messages.push({ role: 'assistant', content: blocks })

    if (data.stop_reason !== 'tool_use') {
      const text = blocks.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim()
      return { result: text || 'no update', toolCalls }
    }

    // Handle tool calls (memory tool only).
    const toolResults: any[] = []
    for (const b of blocks) {
      if (b.type !== 'tool_use') continue
      if (b.name === 'memory') {
        toolCalls++
        // IMPORTANT: the postmortem caller uses caller='postmortem' so it can
        // write to /memories/alex/* and /memories/postmortem/* and /memories/shared/*.
        const out = await handleMemoryTool(supabase, b.input, 'postmortem')
        toolResults.push({ type: 'tool_result', tool_use_id: b.id, content: out })
      } else {
        toolResults.push({ type: 'tool_result', tool_use_id: b.id, content: `tool ${b.name} not available in postmortem` })
      }
    }
    messages.push({ role: 'user', content: toolResults })
  }
  return { result: 'hit max loop', toolCalls }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const gate = requireServiceRole(req); if (gate) return gate
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: CORS })

  let body: any = {}
  try { body = await req.json() } catch { return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers: CORS }) }

  const sessionId = (body?.sessionId || '').toString()
  const outcome   = (body?.outcome || '').toString()
  const note      = (body?.note || '').toString()
  if (!sessionId || !['booked', 'installed', 'cold', 'exit', 'takeover', 'turn_reflection'].includes(outcome)) {
    return new Response(JSON.stringify({ error: 'sessionId + outcome in {booked,installed,cold,exit,takeover,turn_reflection} required' }), { status: 400, headers: CORS })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  try {
    const result = await runPostmortem(supabase, sessionId, outcome, note)
    return new Response(JSON.stringify({ success: true, ...result }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('[postmortem] error:', e)
    return new Response(JSON.stringify({ error: String(e).slice(0, 300) }), { status: 500, headers: CORS })
  }
})
