/**
 * photo-followup
 *
 * Hourly cron: scans follow_up_queue for stage-1 leads who got the panel
 * photo text but haven't replied in 48h. Sends one soft nudge via Twilio.
 * Cancels the queue entry if the lead already responded.
 *
 * Called by pg_cron: POST https://<ref>.supabase.co/functions/v1/photo-followup
 * with Authorization: Bearer <service_role_key>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceRole } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const gate = requireServiceRole(req); if (gate) return gate
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // 1. Find queue entries ready to send
  const { data: queue, error: qErr } = await supabase
    .from('follow_up_queue')
    .select('id, contact_id, stage, send_after')
    .is('sent_at', null)
    .is('cancelled_at', null)
    .lte('send_after', new Date().toISOString())
    .limit(20)

  if (qErr) return json(500, { error: 'queue query failed: ' + qErr.message })
  if (!queue || queue.length === 0) {
    return json(200, { processed: 0, sent: 0, cancelled: 0 })
  }

  console.log(`[photo-followup] ${queue.length} queue entries ready`)

  let sent = 0
  let cancelled = 0

  for (const entry of queue) {
    // 2. Check if contact already sent an inbound message
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('contact_id', entry.contact_id)
      .eq('direction', 'inbound')

    if ((count ?? 0) > 0) {
      // They replied — cancel the nudge
      await supabase
        .from('follow_up_queue')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('id', entry.id)
      cancelled++
      console.log(`[photo-followup] cancelled (has inbound): contact ${entry.contact_id}`)
      continue
    }

    // 3. Fetch contact for name + DNC check
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, name, phone, do_not_contact')
      .eq('id', entry.contact_id)
      .single()

    if (!contact || contact.do_not_contact || !contact.phone) {
      await supabase
        .from('follow_up_queue')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('id', entry.id)
      cancelled++
      continue
    }

    // Skip dojo test phones
    if (contact.phone.startsWith('+1800555')) {
      await supabase
        .from('follow_up_queue')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('id', entry.id)
      cancelled++
      continue
    }

    // 4. Build nudge text
    const firstName = (contact.name || '').split(' ')[0] || ''
    const hi = firstName ? `Hey ${firstName}` : 'Hey'
    const nudge = `${hi}, just checking in. Did you get a chance to send over a photo of your electrical panel? That's all Key needs to put your quote together. No rush at all.`

    // 5. Send via Twilio
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const smsRes = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ contactId: contact.id, body: nudge }),
    })

    if (smsRes.ok) {
      await supabase
        .from('follow_up_queue')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', entry.id)
      sent++
      console.log(`[photo-followup] sent nudge to contact ${contact.id} (***${contact.phone.slice(-4)})`)
    } else {
      const err = await smsRes.text()
      console.error(`[photo-followup] send-sms failed for ${contact.id}: ${smsRes.status} ${err}`)
    }
  }

  return json(200, {
    processed: queue.length,
    sent,
    cancelled,
  })
})
