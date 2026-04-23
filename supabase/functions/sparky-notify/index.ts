/**
 * sparky-notify
 *
 * Called by any agent (alex, permit, pipeline, brief) when something needs Key's attention.
 *
 * What it does:
 * 1. Writes the report to sparky_inbox (Key reviews in CRM — nothing auto-sends to customers)
 * 2. Sends Key a short Twilio SMS: "Sparky: [summary]. Open CRM → Sparky."
 *
 * TESTING MODE: Only pings Key. Zero customer-facing actions.
 *
 * POST body:
 * {
 *   agent: 'alex' | 'permit' | 'pipeline' | 'brief',
 *   contact_id?: string,     // UUID if lead-related
 *   priority?: 'urgent' | 'normal' | 'fyi',
 *   summary: string,         // plain English: what happened
 *   draft_reply?: string,    // suggested SMS to customer (Key approves before sending)
 *   suggested_action?: string
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceRole } from '../_shared/auth.ts'

const TWILIO_SID   = Deno.env.get('TWILIO_ACCOUNT_SID')!
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!
const TWILIO_FROM  = '+18648637800'   // BPP main Twilio number
const KEY_CELL     = '+19414417996'   // Key's personal cell

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
}

async function pingKeyViaSms(summary: string, priority: string, smsBodyOverride?: string): Promise<void> {
  let body: string
  if (smsBodyOverride) {
    // Full-text mode (morning brief) — send as-is, no truncation
    body = smsBodyOverride
  } else {
    // Short ping mode (all other agents) — truncate to 120 chars
    const prefix = priority === 'urgent' ? '🚨 Sparky' : 'Sparky'
    const short = summary.length > 120 ? summary.slice(0, 117) + '...' : summary
    body = `${prefix}: ${short}\n\nOpen CRM → Sparky tab.`
  }

  const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)
  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: KEY_CELL, From: TWILIO_FROM, Body: body }).toString(),
    }
  )
  if (!resp.ok) {
    const err = await resp.text()
    console.error('[sparky-notify] Twilio SMS failed:', err)
  } else {
    console.log('[sparky-notify] Pinged Key:', body.slice(0, 60))
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const gate = requireServiceRole(req); if (gate) return gate
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS })

  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400, headers: CORS })
  }

  const { agent, contact_id, priority = 'normal', summary, draft_reply, suggested_action, sms_body } = body || {}

  if (!agent || !summary) {
    return new Response(JSON.stringify({ error: 'agent and summary required' }), { status: 400, headers: CORS })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. Write to sparky_inbox
  const { data: item, error } = await supabase
    .from('sparky_inbox')
    .insert({
      agent,
      contact_id: contact_id || null,
      priority,
      summary,
      draft_reply: draft_reply || null,
      suggested_action: suggested_action || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[sparky-notify] DB insert failed:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS })
  }

  // 2. Ping Key via Twilio SMS (fire-and-forget — don't delay response)
  pingKeyViaSms(summary, priority, sms_body || undefined).catch(err => console.error('[sparky-notify] SMS unhandled:', err))

  return new Response(JSON.stringify({ ok: true, inbox_id: item.id }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
