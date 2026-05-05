// Edge function: bot-phraser
// Writes the bot's outbound SMS given an intent + context. Uses Anthropic
// Haiku 4.5 with the proven tool-call pattern for structured outputs. The
// produced text is validated against the v10 hard-constraint regex; on
// rejection we fall back to the state machine's hardcoded fallback.
//
// Auth: requireServiceRole — internal-only.

import { requireServiceRole, allowRate } from '../_shared/auth.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

// Locked phraser system prompt. Loaded at module init.
const SYSTEM_PROMPT_TEMPLATE = await Deno.readTextFile(
  new URL('./system-prompt.txt', import.meta.url),
)

// Hard-constraint regex per the locked v10 phraser spec. Output that fails
// ANY of these is rejected — caller falls back to deterministic state-machine
// fallback text.
const REJECT_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'price_dollar', re: /\$\d/ },
  { name: 'weekday_name', re: /\b(saturday|sunday|monday|tuesday|wednesday|thursday|friday)\b/i },
  { name: 'first_person_key', re: /\b(I'm Key|this is Key personally|I'll be there|I can install|I install)\b/i },
  { name: 'first_person_electrician', re: /\b(I'll install|I'll spec|I'll wire|I'll hook up|I'll quote|I'll come (out|by))\b/i },
  { name: 'ashley_claims_quote', re: /\bI(?:'ll| will| would be happy to)? (?:put together|write|send|prepare|create) (?:your |the )?quote\b/i },
  { name: 'ashley_claims_install', re: /\bI(?:'ll| will| would)? (?:set up|install|do) the (?:install|hook ?up|connection)\b/i },
  { name: 'awesome_no_bang', re: /\bawesome\b(?!!)/i },
  { name: 'perfect_exclamation', re: /\bperfect!/i },
  { name: 'perfect_comma_midclause', re: /\bperfect,\s+(?!that's|i)/i },
  { name: 'appreciate', re: /\b(I appreciate|appreciate (you|it))\b/i },
  { name: 'hope_this_helps', re: /\b(I hope this helps|hope that helps)\b/i },
  { name: 'happy_to_help', re: /\b(happy to (help|assist))\b/i },
  { name: 'have_a_great_day', re: /\bhave a (great|wonderful|good) day\b/i },
  { name: 'is_there_anything_else', re: /\b(is there anything else|anything else I can help|what else can I help)\b/i },
  { name: 'feel_free_to_reach', re: /\bfeel free to reach\b/i },
  { name: 'reach_out_anytime', re: /\breach out anytime\b/i },
  { name: 'rest_assured', re: /\brest assured\b/i },
  { name: 'sincerely_apologize', re: /\bsincerely apologize\b/i },
  { name: 'absolutely_opener', re: /^(Absolutely|Certainly|Of course)[!,]/i },
  { name: 'contrast_framing', re: /\bnot (just|only) [^.?!]+ but\b/i },
  { name: 'ing_tail', re: /\b(ensuring|making sure|keeping|getting) (you|y'all|everything) [a-z]+\b/i },
  { name: 'countdown', re: /\b(two more|three more|few more|last (quick )?(one|thing|couple|piece|bit)|one (more|last)|just one more|almost done|few more questions)\b/i },
  { name: 'em_dash', re: /—/ },
  { name: 'multiple_questions', re: /\?[^?]*\?/ },
  { name: 'too_long', re: /^.{281,}$/s },
  { name: 'emoji_count', re: /([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}].*){2,}/u },
  // v10 fake-Southern bans
  { name: 'v10_yall', re: /\by'all\b/i },
  { name: 'v10_yallll', re: /\by'all'll\b/i },
  { name: 'v10_holler', re: /\bholler\b/i },
  { name: 'v10_talk_soon', re: /\btalk soon\b/i },
  { name: 'v10_yep', re: /\byep\b/i },
  { name: 'v10_cool_lowercase', re: /\bcool\b/i },
  { name: 'v10_sweet', re: /\bsweet\b/i },
  { name: 'v10_lemme', re: /\blemme\b/i },
  { name: 'v10_gotcha', re: /\bgotcha\b/i },
  { name: 'v10_real_quick', re: /\breal quick\b/i },
  { name: 'v10_for_sure', re: /\bfor sure\b/i },
  { name: 'v10_right_on', re: /\bright on\b/i },
  { name: 'v10_id_be_happy', re: /\bI'd be happy\b/i },
  { name: 'v10_thx', re: /\bthx\b/i },
  { name: 'v10_ya_typo', re: /\bya\b/i },
  // v10 trust guardrails
  { name: 'v10_overpromise_easy', re: /\b(quick and easy|easy peasy|no problem at all|won't take any time|easy install)\b/i },
  { name: 'v10_overpromise_guaranteed', re: /\b(100%? guaranteed|fully guaranteed|guaranteed to)\b/i },
  { name: 'v10_false_scarcity_slot', re: /\bonly \d+ (slot|opening|spot)/i },
  { name: 'v10_false_scarcity_filling', re: /\bfilling up fast\b/i },
  { name: 'v10_false_scarcity_limited', re: /\b(limited time|won't last|first come first served|gotta act quick|before someone else grabs)\b/i },
  { name: 'v10_boilerplate_licensed', re: /\b(we're licensed and insured|fully licensed|industry-leading|trusted by \d+)/i },
  { name: 'v10_trust_me', re: /\btrust (me|us)\b/i },
]

interface PhraserInput {
  intent: string
  customer_first_name: string | null
  customer_last_message: string | null
  acknowledge_emoji?: boolean
  address_on_file?: string | null
  volunteered_data?: string | null
  chitchat_excerpt?: string | null
  impatience_excerpt?: string | null
  amended_slot?: string | null
  prior_acknowledgments?: string[]
  email_typo_suspected?: boolean
  email_likely_meant?: string | null
  clarifying_question?: string | null
  requested_time?: string | null
  referral_source?: string | null
  customer_style?: 'terse' | 'educational' | 'buddy' | 'default'
  customer_recent_length?: number
  anxiety_marker_detected?: boolean
  time_of_day_bucket?: 'morning' | 'midday' | 'evening' | 'late' | null
  qualification_slots?: Record<string, unknown> | null
  fallback_text: string
}

interface PhraserOutput {
  text: string
  used_fallback: boolean
  rejection_reason?: string
}

const TOOL_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string', description: 'The outbound SMS message to send. Plain text only.' },
  },
  required: ['text'],
  additionalProperties: false,
}

function validateOutput(text: string): { ok: boolean; reason?: string } {
  if (!text || text.length === 0) return { ok: false, reason: 'empty' }
  if (text.startsWith('"') || text.startsWith("'") || text.startsWith('```')) {
    return { ok: false, reason: 'wrapped_in_quotes_or_markdown' }
  }
  for (const { name, re } of REJECT_PATTERNS) {
    if (re.test(text)) return { ok: false, reason: name }
  }
  return { ok: true }
}

async function phrase(input: PhraserInput): Promise<PhraserOutput> {
  const voiceCorpus = Deno.env.get('BPP_VOICE_CORPUS') || ''
  const renderedSystem = SYSTEM_PROMPT_TEMPLATE.replaceAll('{{voice_corpus}}', voiceCorpus)

  const userMessage = JSON.stringify(input, null, 2)

  let lastReason = 'max_retries'
  for (let attempt = 0; attempt < 2; attempt++) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: renderedSystem,
        messages: [{ role: 'user', content: userMessage }],
        tools: [
          {
            name: 'send_sms',
            description: 'Emit the SMS message text to send to the customer. Plain text only.',
            input_schema: TOOL_SCHEMA,
          },
        ],
        tool_choice: { type: 'tool', name: 'send_sms' },
      }),
    })

    if (!resp.ok) {
      console.error('[bot-phraser] anthropic error', resp.status, (await resp.text()).slice(0, 300))
      return { text: input.fallback_text, used_fallback: true, rejection_reason: 'api_error' }
    }

    const data = await resp.json()
    const toolUse = data.content?.find((b: any) => b.type === 'tool_use')
    const text = String(toolUse?.input?.text || '').trim()

    const validation = validateOutput(text)
    if (validation.ok) {
      return { text, used_fallback: false }
    }
    lastReason = validation.reason || 'invalid'
    console.warn('[bot-phraser] output rejected', lastReason, '— attempt', attempt + 1)
  }

  return { text: input.fallback_text, used_fallback: true, rejection_reason: lastReason }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const gate = requireServiceRole(req)
  if (gate) return gate

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowRate(`bot-phraser:${ip}`, 120)) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 })
  }

  let input: PhraserInput
  try {
    input = (await req.json()) as PhraserInput
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 })
  }

  if (!input?.intent || !input?.fallback_text) {
    return new Response(JSON.stringify({ error: 'missing_intent_or_fallback' }), { status: 400 })
  }

  try {
    const output = await phrase(input)
    return new Response(JSON.stringify(output), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (e) {
    console.error('[bot-phraser] handler error', e)
    return new Response(
      JSON.stringify({
        text: input.fallback_text,
        used_fallback: true,
        rejection_reason: 'handler_error',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }
})
