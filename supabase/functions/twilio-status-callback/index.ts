/**
 * twilio-status-callback
 *
 * Receives delivery status updates from Twilio for outbound SMS/MMS.
 * Twilio POSTs form-encoded data including MessageSid and MessageStatus.
 *
 * Statuses Twilio sends:
 *   queued → sending → sent → delivered (success)
 *                             failed / undelivered (failure)
 *
 * This function:
 *  1. Parses the status update
 *  2. Updates messages.status where quo_message_id = MessageSid
 *     - Sets to 'delivered' on delivered
 *     - Sets to 'failed' on failed/undelivered
 *     - Ignores intermediate statuses (queued, sending, sent)
 *
 * Configure in Twilio console (or in send-sms StatusCallback param):
 *   https://reowtzedjflwmlptupbk.supabase.co/functions/v1/twilio-status-callback
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Twilio-Signature',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let params: URLSearchParams
  try {
    const text = await req.text()
    params = new URLSearchParams(text)
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  const messageSid    = params.get('MessageSid') || ''
  const messageStatus = (params.get('MessageStatus') || '').toLowerCase()

  if (!messageSid) {
    console.warn('[twilio-status-callback] missing MessageSid')
    return new Response('OK', { status: 200 })
  }

  console.log(`[twilio-status-callback] sid=${messageSid} status=${messageStatus}`)

  // Only update on terminal statuses (delivered, failed, undelivered)
  let newStatus: string | null = null
  if (messageStatus === 'delivered')                          newStatus = 'delivered'
  else if (messageStatus === 'failed' || messageStatus === 'undelivered') newStatus = 'failed'

  if (!newStatus) {
    // Intermediate status — no update needed, return 200 so Twilio stops retrying
    return new Response('OK', { status: 200 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { error } = await supabase
    .from('messages')
    .update({ status: newStatus })
    .eq('quo_message_id', messageSid)

  if (error) {
    console.error('[twilio-status-callback] db update failed:', error)
  } else {
    console.log(`[twilio-status-callback] updated ${messageSid} → ${newStatus}`)
  }

  return new Response('OK', { status: 200 })
})
