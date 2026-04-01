/**
 * quo-ai-followup
 * Runs on a cron schedule (every hour via pg_cron).
 * Sends follow-up texts to contacts who haven't responded.
 * Only sends during appropriate hours (9am–7pm Eastern).
 * Stops automatically once a proposal is approved.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const QUO_API_KEY        = Deno.env.get('QUO_API_KEY')!
const QUO_PHONE_ID       = Deno.env.get('QUO_PHONE_NUMBER_ID')!
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')!

function isAppropriateTime(): boolean {
  const now = new Date()
  // Get Eastern hour (handles EST/EDT automatically)
  const etHour = parseInt(
    now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false })
  )
  const etDay = now.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short' })
  // 9am–7pm, Mon–Sat (no Sunday texts)
  return etHour >= 9 && etHour < 19 && etDay !== 'Sun'
}

Deno.serve(async (_req) => {
  if (!isAppropriateTime()) {
    return new Response(JSON.stringify({ skipped: 'outside appropriate hours' }))
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Load any bot notes for context
  const { data: botNotes } = await supabase
    .from('bot_notes')
    .select('content')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(20)

  // Find pending follow-ups that are due
  const { data: pending } = await supabase
    .from('follow_up_queue')
    .select('*, contacts(*)')
    .lte('send_after', new Date().toISOString())
    .is('sent_at', null)
    .is('cancelled_at', null)
    .order('send_after', { ascending: true })
    .limit(20)

  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ processed: 0, message: 'nothing due' }))
  }

  let sent = 0
  let skipped = 0

  for (const item of pending) {
    const contact = item.contacts
    if (!contact) { skipped++; continue }

    // ── STOP if proposal is already approved ─────────────────────────────
    const { data: approvedProposal } = await supabase
      .from('proposals')
      .select('id')
      .eq('contact_id', contact.id)
      .eq('status', 'Approved')
      .limit(1)

    if (approvedProposal && approvedProposal.length > 0) {
      // Cancel all pending follow-ups for this contact — job is done
      await supabase.from('follow_up_queue')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('contact_id', contact.id)
        .is('sent_at', null)
        .is('cancelled_at', null)
      skipped++
      continue
    }

    // ── CHECK IF CUSTOMER HAS REPLIED SINCE THIS WAS QUEUED ──────────────
    const { data: recentInbound } = await supabase
      .from('messages')
      .select('id, created_at')
      .eq('contact_id', contact.id)
      .eq('direction', 'inbound')
      .gte('created_at', item.created_at)
      .limit(1)

    if (recentInbound && recentInbound.length > 0) {
      // Customer replied — cancel follow-up
      await supabase.from('follow_up_queue')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('id', item.id)
      skipped++
      continue
    }

    // ── LOAD CONVERSATION HISTORY FOR CONTEXT ────────────────────────────
    const { data: history } = await supabase
      .from('messages')
      .select('direction, body, created_at')
      .eq('contact_id', contact.id)
      .order('created_at', { ascending: true })
      .limit(20)

    const conversationSummary = (history || [])
      .map(m => `${m.direction === 'inbound' ? 'Customer' : 'Us'}: ${m.body}`)
      .join('\n')

    const botNotesText = botNotes && botNotes.length > 0
      ? '\nKey\'s notes: ' + botNotes.map((n: any) => n.content).join(' | ')
      : ''

    // ── GENERATE FOLLOW-UP MESSAGE WITH AI ───────────────────────────────
    const systemPrompt = `Your name is Alex. You work for Backup Power Pro. You are writing a follow-up SMS to a customer who has not responded to the last message. This is a real text message to a real person — it must sound human.

VOICE — same as always:
- Warm, direct, real. You sound like a person texting back, not a company.
- SHORT. 1-2 sentences max.
- ONE soft question or nudge max.
- Never say "just following up" — it's overused and sounds automated.
- Do not repeat the exact wording of the previous message.
- Always use contractions. "you're" not "you are". "it's" not "it is".
- No bullet points. No headers. No numbered lists. Sentence fragments are fine.
- NEVER use em-dashes (—). Use a comma or period instead.

BANNED WORDS — never use these:
- Openers: "Certainly!", "Absolutely!", "Of course!", "Great question!"
- Closers: "Let me know if you have any other questions!", "Feel free to reach out!", "I hope this helps!"
- Filler: delve, leverage, utilize, seamlessly, robust, synergy, furthermore, indeed

STAGE BEHAVIOR:
- Stage 1: Gentle check-in. Reference something specific from the conversation if you can — a generator model they mentioned, a question that was left open. "Just making sure this came through" energy but personalized.
- Stage 2: Natural scarcity mention. We only take about 5 installs a week so spots do fill up. Low-key, honest, not pushy. Never combine "no pressure" and scarcity in the same breath.
- Stage 3+: Final short check-in. "Still here when you're ready" energy. No sales pitch.

USE THE CONVERSATION — this is critical:
Read the conversation history carefully. Reference where things actually left off. If they were waiting to get a panel photo, mention it. If they had a question that wasn't resolved, reference it. A generic follow-up that ignores the conversation feels robotic and gets ignored. A follow-up that says "Hey, did you ever get a chance to grab that panel photo?" feels human and gets responses.

Do NOT sign with any name. Do NOT re-introduce yourself.
${botNotesText}`

    const userMessage = `Contact name: ${contact.name || 'Unknown'}
Follow-up stage: ${item.stage}
Conversation so far:
${conversationSummary || '(no prior messages)'}

Write a follow-up message that picks up naturally from where this conversation left off.`

    let followUpText = item.stage === 1
      ? `Hey, just wanted to make sure that last message came through okay. Let me know if you have any questions.`
      : item.stage === 2
      ? `Hey, wanted to check back in. We only take about 5 jobs a week so spots do fill up, but no rush at all. Just let me know if you're still interested.`
      : `Still here if you need anything. Just reach out whenever you're ready.`

    try {
      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://backuppowerpro.com',
          'X-Title': 'BPP Follow-up Agent',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4-5',
          max_tokens: 150,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
        }),
      })
      const aiData = await aiRes.json()
      const generated = aiData.choices?.[0]?.message?.content?.trim()
      if (generated) followUpText = generated
    } catch (err) {
      console.error('[AI] Follow-up generation failed:', err)
    }

    // ── STRIP EM-DASHES ───────────────────────────────────────────────────
    followUpText = followUpText
      .replace(/ — /g, ', ')
      .replace(/— /g, ', ')
      .replace(/ —/g, ',')
      .replace(/—/g, ', ')
      .replace(/  +/g, ' ')
      .trim()

    // ── TYPING DELAY ─────────────────────────────────────────────────────
    const typingMs = Math.min(11000, 1500 + followUpText.length * 45 + Math.random() * 1500)
    await new Promise(resolve => setTimeout(resolve, typingMs))

    // ── SEND VIA QUO ─────────────────────────────────────────────────────
    let quoMsgId: string | null = null
    try {
      const quoRes = await fetch('https://api.openphone.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': QUO_API_KEY },
        body: JSON.stringify({
          from: QUO_PHONE_ID,
          to: [contact.phone],
          content: followUpText,
        }),
      })
      const quoData = await quoRes.json()
      quoMsgId = quoData.data?.id || null
    } catch (err) {
      console.error('[QUO] Follow-up send failed:', err)
      skipped++
      continue
    }

    // ── SAVE OUTBOUND MESSAGE ─────────────────────────────────────────────
    await supabase.from('messages').insert({
      contact_id: contact.id,
      direction: 'outbound',
      body: followUpText,
      sender: 'ai',
      quo_message_id: quoMsgId,
    })

    // ── MARK THIS FOLLOW-UP AS SENT ───────────────────────────────────────
    await supabase.from('follow_up_queue')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', item.id)

    // ── QUEUE NEXT STAGE (max 3 follow-ups) ──────────────────────────────
    if (item.stage < 3) {
      const nextDelay = item.stage === 1
        ? 48 * 60 * 60 * 1000   // 48hrs after stage 1
        : 72 * 60 * 60 * 1000   // 72hrs after stage 2
      await supabase.from('follow_up_queue').insert({
        contact_id: contact.id,
        stage: item.stage + 1,
        send_after: new Date(Date.now() + nextDelay).toISOString(),
      })
    }

    sent++
    console.log(`[FOLLOWUP] Sent stage ${item.stage} to ${contact.name} (${contact.phone})`)
  }

  return new Response(JSON.stringify({ processed: pending.length, sent, skipped }))
})
