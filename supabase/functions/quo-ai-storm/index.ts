/**
 * quo-ai-storm
 * Storm mode blast — hit this URL before a weather event to text all warm leads.
 * Targets contacts with status: Quote Sent, Engaged, Photo Pending, On Hold, No Response
 * who have been active in the last 60 days and haven't booked.
 *
 * Trigger: GET /quo-ai-storm?token=bpp-storm-2026
 * Optional: &dry_run=true to preview without sending
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceRole, timingSafeEqual } from '../_shared/auth.ts'

const QUO_API_KEY        = Deno.env.get('QUO_API_KEY')!
const QUO_PHONE_ID       = Deno.env.get('QUO_PHONE_NUMBER_ID')!
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')!

function stripEmDashes(text: string): string {
  return text
    .replace(/ — /g, ', ').replace(/— /g, ', ')
    .replace(/ —/g, ',').replace(/—/g, ', ')
    .replace(/  +/g, ' ').trim()
}

Deno.serve(async (req) => {
  // Auth: accept either Bearer <SUPABASE_SERVICE_ROLE_KEY> (preferred,
  // lets the CRM hit this when Key is signed in) or a rotated token
  // stored in the STORM_TOKEN secret. The previous hardcoded
  // `'bpp-storm-2026'` literal has been removed; if you need the
  // query-param path, set STORM_TOKEN in Supabase secrets and pass
  // `?token=...`.
  const url     = new URL(req.url)
  const token   = url.searchParams.get('token') || ''
  const dryRun  = url.searchParams.get('dry_run') === 'true'
  const preview = url.searchParams.get('preview') === 'true'

  const stormTokenSecret = Deno.env.get('STORM_TOKEN') || ''
  const tokenOk = stormTokenSecret.length > 0 && timingSafeEqual(token, stormTokenSecret)
  if (!tokenOk) {
    const gate = requireServiceRole(req); if (gate) return gate
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Find warm leads active in the last 60 days who haven't booked
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
  const warmStatuses = ['Quote Sent', 'Engaged', 'Photo Pending', 'On Hold', 'No Response']

  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, name, phone, status, updated_at')
    .in('status', warmStatuses)
    .eq('ai_enabled', true)
    .gte('updated_at', cutoff)
    .order('updated_at', { ascending: false })

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  if (!contacts || contacts.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'No warm leads found' }))
  }

  // If just previewing, return the list without sending
  if (preview) {
    return new Response(JSON.stringify({
      would_text: contacts.map(c => ({ name: c.name, phone: c.phone, status: c.status })),
      count: contacts.length,
    }), { headers: { 'Content-Type': 'application/json' } })
  }

  let sent = 0
  const results: any[] = []

  for (const contact of contacts) {
    const firstName = (contact.name || '').split(' ')[0] || ''

    // Generate personalized storm message
    const systemPrompt = `You are Alex from Backup Power Pro. Write a SHORT, warm storm urgency text to a lead who previously inquired but hasn't booked. There is a storm or severe weather event coming to Upstate SC. This is a genuine, timely reason to reach out.

Rules:
- 1-2 sentences MAX. SMS only.
- Warm, not pushy. Real urgency, not manufactured.
- Reference the storm naturally as a timely reason to reach out.
- ONE soft call to action — "still interested?", "want to get on the schedule?", etc.
- Never say "just following up". Never use em-dashes.
- Use their first name if available.
- Do NOT introduce yourself again — they know who this is.
- Examples of good tone: "Hey [name], storms are in the forecast for this week — wanted to check if you still wanted to get on the schedule." or "Hey [name], looks like we've got some weather coming. Still thinking about getting the generator hooked up?"`

    let message = `Hey${firstName ? ' ' + firstName : ''}, looks like we've got some weather coming to the area this week. Still thinking about getting the generator connected?`

    try {
      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://backuppowerpro.com',
          'X-Title': 'BPP Storm Mode',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4-5',
          max_tokens: 100,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Contact first name: ${firstName || 'not known'}. Previous status: ${contact.status}.` },
          ],
        }),
      })
      const aiData = await aiRes.json()
      const generated = aiData.choices?.[0]?.message?.content?.trim()
      if (generated) message = stripEmDashes(generated)
    } catch (_) { /* use fallback */ }

    if (dryRun) {
      results.push({ name: contact.name, phone: contact.phone, message })
      continue
    }

    // Small delay between sends to avoid rate limits
    if (sent > 0) await new Promise(r => setTimeout(r, 1500))

    try {
      const quoRes = await fetch('https://api.openphone.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': QUO_API_KEY },
        body: JSON.stringify({ from: QUO_PHONE_ID, to: [contact.phone], content: message }),
      })
      const quoData = await quoRes.json()

      await supabase.from('messages').insert({
        contact_id: contact.id,
        direction: 'outbound',
        body: message,
        sender: 'ai',
        quo_message_id: quoData.data?.id || null,
      })

      // Queue a follow-up in 24hrs if no reply — only if one isn't already pending
      const { data: existingQueue } = await supabase
        .from('follow_up_queue')
        .select('id')
        .eq('contact_id', contact.id)
        .is('sent_at', null)
        .limit(1)

      if (!existingQueue || existingQueue.length === 0) {
        await supabase.from('follow_up_queue').insert({
          contact_id: contact.id,
          stage: 1,
          send_after: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
      }

      results.push({ name: contact.name, phone: contact.phone, status: 'sent', message })
      sent++
    } catch (err) {
      results.push({ name: contact.name, phone: contact.phone, status: 'failed' })
    }
  }

  return new Response(JSON.stringify({
    sent,
    dry_run: dryRun,
    results,
  }), { headers: { 'Content-Type': 'application/json' } })
})
