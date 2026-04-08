/**
 * quo-ai-review
 * Sends a personalized post-install review + referral request.
 * Called by the CRM when a job is marked Complete (stage 9 / payment recorded).
 *
 * POST /quo-ai-review
 * Body: { contactId: string }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const QUO_API_KEY        = Deno.env.get('QUO_API_KEY')!
const QUO_PHONE_ID       = Deno.env.get('QUO_PHONE_NUMBER_ID')!
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')!
// TODO: Replace with your real Google review short link (get it from Google Business Profile → Ask for reviews → Get more reviews)
const GOOGLE_REVIEW_URL  = 'https://g.page/r/CVxLI9ZsiZS_EAE/review'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function stripEmDashes(text: string): string {
  return text
    .replace(/ — /g, ', ').replace(/— /g, ', ')
    .replace(/ —/g, ',').replace(/—/g, ', ')
    .replace(/  +/g, ' ').trim()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS })

  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400, headers: CORS })
  }

  const { contactId } = body || {}
  if (!contactId) return new Response(JSON.stringify({ error: 'contactId required' }), { status: 400, headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, name, phone, install_notes')
    .eq('id', contactId)
    .single()

  if (!contact?.phone) {
    return new Response(JSON.stringify({ error: 'contact not found' }), { status: 404, headers: CORS })
  }

  const firstName = (contact.name || '').split(' ')[0] || ''

  // Check if we already sent a review request for this contact
  const { data: alreadySent } = await supabase
    .from('messages')
    .select('id')
    .eq('contact_id', contactId)
    .ilike('body', '%g.page%')
    .limit(1)

  if (alreadySent && alreadySent.length > 0) {
    return new Response(JSON.stringify({ skipped: 'review already sent' }), { headers: CORS })
  }

  // Generate personalized review message
  const systemPrompt = `Your name is Alex from Backup Power Pro. Write a short, warm post-install review request SMS. The install just finished and the customer is happy. You want a Google review and a referral mention.

Rules:
- 2-3 sentences max. SMS only.
- Warm and genuine, not salesy or corporate.
- Thank them for choosing Backup Power Pro.
- Ask for a Google review naturally — something like "If you've got 2 minutes, a review would mean the world to us."
- Mention the referral naturally — "And if you know anyone else who could use this, we'd love the intro."
- Include the review link on its own line at the end.
- Never use em-dashes. Use their first name.
- Do NOT introduce yourself — they know who this is from the number.`

  let reviewMessage = `Hey${firstName ? ' ' + firstName : ''}, really glad everything went smoothly today. If you've got 2 minutes, a Google review would mean a lot to us. And if you know anyone else who could use this, we'd love the intro.\n${GOOGLE_REVIEW_URL}`

  try {
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://backuppowerpro.com',
        'X-Title': 'BPP Review Request',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-5',
        max_tokens: 150,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Customer first name: ${firstName || 'not known'}. Install notes: ${contact.install_notes || 'standard install'}. Review link: ${GOOGLE_REVIEW_URL}` },
        ],
      }),
    })
    const aiData = await aiRes.json()
    const generated = aiData.choices?.[0]?.message?.content?.trim()
    if (generated) {
      reviewMessage = stripEmDashes(generated)
      // Ensure the review link is present
      if (!reviewMessage.includes('g.page')) {
        reviewMessage = reviewMessage + '\n' + GOOGLE_REVIEW_URL
      }
    }
  } catch (_) { /* use fallback */ }

  // Typing delay
  const typingMs = Math.min(8000, 1500 + reviewMessage.length * 35)
  await new Promise(r => setTimeout(r, typingMs))

  // Send via Quo
  let quoMsgId: string | null = null
  try {
    const quoRes = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': QUO_API_KEY },
      body: JSON.stringify({ from: QUO_PHONE_ID, to: [contact.phone], content: reviewMessage }),
    })
    const quoData = await quoRes.json()
    quoMsgId = quoData.data?.id || null
  } catch (_) { /* failed to send */ }

  // Save message
  await supabase.from('messages').insert({
    contact_id: contactId,
    direction: 'outbound',
    body: reviewMessage,
    sender: 'ai',
    quo_message_id: quoMsgId,
  })

  // Update contact status to Complete (they paid and review was sent)
  await supabase.from('contacts').update({ status: 'Complete' }).eq('id', contactId)

  return new Response(JSON.stringify({ sent: true, message: reviewMessage }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
