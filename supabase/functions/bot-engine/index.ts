/**
 * bot-engine, Ashley's orchestrator.
 *
 * v10.1.30 entry point. Two triggers:
 *
 *   { trigger: 'new_lead', contact_id }
 *     - Assigns EXP-008 variant via sha256(contact_id) % 4
 *     - Renders templated GREETING (no LLM)
 *     - Sends via send-sms
 *     - Persists greeting_variant
 *     - Flips bot_state='AWAIT_240V'
 *
 *   { trigger: 'inbound_message', contact_id, message_sid, message_body, media_urls? }
 *     - Idempotency dedupe via bot_processed_messages + advisory lock
 *     - Hard guards: bot_disabled / DNC / null bot_state / STOP keyword
 *     - Optional photo classification (when media_urls present)
 *     - Classifier → state-machine transition → phraser
 *     - send-sms with the produced text (or fallback)
 *     - Terminal-state handoff to bot-handoff-notifier
 *
 * Auth: requireServiceRole, internal-only.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceRole } from '../_shared/auth.ts'
import { assignGreetingVariant, renderGreeting, timeOfDayBucket } from '../_shared/exp008-variant.ts'
import { transition as smTransition, INITIAL_STATE, STATES as SM_STATES } from '../_shared/bot-state-machine.ts'
import { tryAcquireMessageLock, recordProcessed } from '../_shared/bot-idempotency.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const TERMINAL_STATES = new Set([
  'COMPLETE',
  'NEEDS_CALLBACK',
  'DISQUALIFIED_120V',
  'DISQUALIFIED_RENTER',
  'DISQUALIFIED_OUT_OF_AREA',
  'POSTPONED',
  'STOPPED',
])

const STOP_RE = /^\s*(stop|stopall|unsubscribe|cancel|end|quit)\s*$/i

interface NewLeadInput {
  trigger: 'new_lead'
  contact_id: string
}
interface InboundInput {
  trigger: 'inbound_message'
  contact_id: string
  message_sid: string
  message_body: string
  media_urls?: string[]
  media_types?: string[]  // v10.1.60: parallel to media_urls; e.g. 'image/jpeg', 'audio/amr'
}

// ──────────────────────────────────────────────────────────────────────────
//  GREETING flow (preserved verbatim from prior stub)
// ──────────────────────────────────────────────────────────────────────────
async function handleNewLead(input: NewLeadInput): Promise<Response> {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: contact, error } = await sb.from('contacts')
    .select('id, name, phone, do_not_contact, bot_state, qualification_data')
    .eq('id', input.contact_id)
    .maybeSingle()
  if (error || !contact) {
    return new Response(`Contact not found: ${input.contact_id}`, { status: 404 })
  }

  if (contact.do_not_contact) {
    return new Response(JSON.stringify({ ok: true, skipped: 'do_not_contact' }),
      { status: 200, headers: { 'content-type': 'application/json' } })
  }

  if (contact.bot_state && contact.bot_state !== 'GREETING') {
    return new Response(JSON.stringify({ ok: true, skipped: 'already_active', bot_state: contact.bot_state }),
      { status: 200, headers: { 'content-type': 'application/json' } })
  }

  const variant = await assignGreetingVariant(input.contact_id)
  const firstName = (contact.name || '').split(/\s+/)[0] || 'there'
  const bucket = timeOfDayBucket()
  const lateNight = bucket === 'late'
  const messageBody = renderGreeting(variant, firstName, { lateNight })

  // v10.1.61: human-typing delay before GREETING. Even the opener should
  // feel like a person typed it, not a bot that fired the instant the form
  // hit the server. Customer just got Quo's "thanks for filling out" auto-
  // reply; a brief pause before Ashley's first message reads as "she saw
  // the form, took a sec, and is replying."
  const sendResp = await sendCustomerReply(contact.id, messageBody)

  if (!sendResp.ok) {
    const text = await sendResp.text()
    return new Response(JSON.stringify({ ok: false, error: 'send-sms failed', detail: text.slice(0, 200) }),
      { status: 502, headers: { 'content-type': 'application/json' } })
  }

  const updatedQd = { ...(contact.qualification_data || {}), greeting_variant: variant }
  await sb.from('contacts')
    .update({
      bot_state: 'AWAIT_240V',
      qualification_data: updatedQd,
      last_bot_outbound_at: new Date().toISOString(),
    })
    .eq('id', input.contact_id)

  return new Response(JSON.stringify({
    ok: true,
    contact_id: input.contact_id,
    greeting_variant: variant,
    bot_state: 'AWAIT_240V',
    bucket,
  }), { status: 200, headers: { 'content-type': 'application/json' } })
}

// ──────────────────────────────────────────────────────────────────────────
//  Human-typing delay — v10.1.61
//  Makes Ashley feel like a real person typing, not an instant-fire bot.
//  Length-dependent: longer replies take longer to "type" (per Key directive
//  2026-05-08 "humans take time to type and respond"). Includes ±15% jitter
//  so the cadence isn't metronomic across a full conversation.
//
//  Budget: cap at 5500ms so total flow (3s burst debounce + ~3s LLM + this)
//  stays comfortably inside Twilio's 15s webhook window.
//
//  Tuned: 1.2s read+pause base + 35ms/char typing speed (~30 wpm sustained,
//  realistic for casual SMS where you don't proofread).
// ──────────────────────────────────────────────────────────────────────────
function humanTypingDelayMs(textLength: number): number {
  const base = 1200
  const perChar = 35
  const jitter = 0.85 + Math.random() * 0.3  // 0.85-1.15
  const raw = (base + textLength * perChar) * jitter
  return Math.max(800, Math.min(5500, Math.round(raw)))
}

async function sendCustomerReply(
  contactId: string,
  body: string,
  opts: { skipDelay?: boolean } = {},
): Promise<Response> {
  if (!opts.skipDelay) {
    const delay = humanTypingDelayMs(body.length)
    console.log(`[bot-engine] human-typing delay ${delay}ms for ${body.length}-char reply`)
    await new Promise(r => setTimeout(r, delay))
  }
  return await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'apikey': SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contactId, body }),
  })
}

// ──────────────────────────────────────────────────────────────────────────
//  INBOUND flow
// ──────────────────────────────────────────────────────────────────────────

async function callInternal(path: string, body: unknown, timeoutMs: number = 12000): Promise<any> {
  // v10.1.45: timeout guard. Without this, a hung classifier or phraser
  // call holds the whole edge function until Supabase's 150s default
  // timeout, by which time Twilio has retried + customer has waited
  // forever. 12s leaves headroom for the 5s photo-burst debounce + DB
  // queries + send-sms within Twilio's 15s webhook window.
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        // v10.1.48: send apikey too. Supabase gateway requires it on
        // some edge-to-edge call paths even when Authorization is present.
        'apikey': SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!r.ok) {
      const text = await r.text()
      throw new Error(`${path} ${r.status}: ${text.slice(0, 200)}`)
    }
    return await r.json()
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error(`${path} timeout after ${timeoutMs}ms`)
    }
    throw e
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchRecentTurns(sb: any, contactId: string, limit = 4): Promise<Array<{ role: 'customer' | 'bot'; text: string }>> {
  const { data } = await sb.from('messages')
    .select('direction, body, created_at')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!data) return []
  return data.reverse().map((m: any) => ({
    role: (m.direction === 'inbound' ? 'customer' : 'bot') as 'customer' | 'bot',
    text: String(m.body || '').slice(0, 600),
  }))
}

function applySlotUpdates(qd: Record<string, any>, classifier: any, photoResult: any | null) {
  const out = { ...(qd || {}) }
  // Persist whatever orchestrator-relevant signals the classifier surfaced.
  if (classifier?.referral_source) out.referral_source = classifier.referral_source
  if (classifier?.requested_time) out.requested_time = classifier.requested_time
  if (classifier?.coverage_excerpt) out.coverage_excerpt = classifier.coverage_excerpt
  if (classifier?.email_likely_meant) out.email_likely_meant = classifier.email_likely_meant
  if (Array.isArray(classifier?.load_mentions) && classifier.load_mentions.length) {
    const prev = Array.isArray(out.load_mentions) ? out.load_mentions : []
    out.load_mentions = Array.from(new Set([...prev, ...classifier.load_mentions]))
  }
  if (photoResult?.subject) {
    out.last_photo_classification = {
      subject: photoResult.subject,
      confidence: photoResult.subject_confidence,
      recommendation: photoResult.primary_recommendation,
      panel_brand: photoResult.panel_brand_visible || null,
      issues: photoResult.obvious_issues || null,
    }
    if (photoResult.subject === 'panel_hazardous_zinsco') out.hazardous_panel_brand = 'Zinsco'
    if (photoResult.subject === 'panel_hazardous_fpe') out.hazardous_panel_brand = 'Federal Pacific'
  }
  return out
}

// Map the classifier label → state-machine label and ctx adjustments.
function buildSmCtx(contact: any, classifier: any): any {
  const firstName = contact.name ? String(contact.name).split(/\s+/)[0] : null
  return {
    first_name: firstName,
    address_on_file: contact.install_address || contact.address || null,
    extracted_value: classifier?.extracted_value || null,
    customer_last_message: classifier?.extracted_value || null,
    amended_slot: classifier?.amended_slot || null,
    email_typo_suspected: classifier?.email_typo_suspected || false,
    email_likely_meant: classifier?.email_likely_meant || null,
    requested_time: classifier?.requested_time || null,
    referral_source: classifier?.referral_source || null,
    coverage_excerpt: classifier?.coverage_excerpt || null,
    address_captured: false,
    time_of_day_bucket: timeOfDayBucket(),
    greeting_variant: contact.qualification_data?.greeting_variant || 'A',
    generator_lookup_result: contact.qualification_data?.generator_lookup_result || null,
  }
}

async function handleInbound(input: InboundInput): Promise<Response> {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // 1. Idempotency
  const acquired = await tryAcquireMessageLock(input.message_sid)
  if (!acquired) {
    return new Response(JSON.stringify({ ok: true, skipped: 'duplicate_message_sid' }),
      { status: 200, headers: { 'content-type': 'application/json' } })
  }

  let outcome: 'replied' | 'silent' | 'error' = 'silent'
  let errorMsg: string | undefined
  try {
    // v10.1.37, per-contact advisory lock at handler entry. When 3 rapid-fire
    // messages arrive within seconds, the message_sid lock on each is unique
    // so they all bypass idempotency, then all check handoff_fired_at before
    // any can write it (race), all fire handoff. Per-contact lock serializes
    // them: only one inbound at a time per contact. Subsequent ones drop.
    // Lock auto-releases at transaction end (Supabase wraps each .rpc call).
    try {
      const lockKey = parseInt(
        // Hash contact UUID to a 64-bit BigInt fitting Postgres bigint
        Array.from(input.contact_id).reduce((acc: bigint, c: string) => {
          return (acc * 31n + BigInt(c.charCodeAt(0))) % 9223372036854775807n
        }, 0n).toString(),
      )
      const { data: gotLock } = await sb.rpc('pg_try_advisory_xact_lock_wrapped', { lock_key: lockKey })
      if (gotLock === false) {
        outcome = 'silent'
        return new Response(JSON.stringify({ ok: true, skipped: 'concurrent_processing' }),
          { status: 200, headers: { 'content-type': 'application/json' } })
      }
    } catch (_) { /* lock function may not exist; fall through */ }

    // 1b. v10.1.44 PHOTO-BURST COALESCING (P-PhotoSpammer sim 2026-05-07)
    //
    // When a customer sends N photos in rapid succession (each its own MMS
    // and webhook), each used to fire its own classifier + phraser + reply.
    // Result: phone-flooding UX hit + N x LLM cost. Per-contact lock
    // serializes but doesn't coalesce.
    //
    // Strategy: when an inbound has media AND we have any photo-expecting
    // states active, wait a short debounce, then check if a newer inbound
    // has arrived from the same contact. If yes, this one yields (returns
    // silent_burst_yielded). Net effect: the LAST photo in a burst is the
    // only one that runs the classifier + replies. Earlier photos in the
    // burst get marked silent and are not visible to the LLM pipeline.
    //
    // This is a 5-second wall clock cost only on photo turns. Twilio
    // webhook timeout default is 15s so this fits comfortably.
    if (input.media_urls && input.media_urls.length > 0) {
      // Pull current bot_state to confirm we're in a photo-expecting state.
      // Skip the debounce on non-photo states (would waste compute).
      const { data: stateCheck } = await sb.from('contacts')
        .select('bot_state')
        .eq('id', input.contact_id)
        .maybeSingle()
      const botStateNow = stateCheck?.bot_state || ''
      const PHOTO_STATES = new Set([
        'AWAIT_PANEL_PHOTO',
        'AWAIT_240V',          // customer may send outlet pic instead of verbal
        'AWAIT_OUTLET',         // outlet photo path
        'CONFIRM_MAIN_BREAKER', // re-photo after sub-panel detection
      ])
      if (PHOTO_STATES.has(botStateNow)) {
        // Stamp the current message's arrival time. We use the earliest
        // arrival of THIS message (now) as our reference.
        const myArrivalMs = Date.now()
        const DEBOUNCE_MS = 5000  // 5s window. Bursts typically span 1-30s.

        // Sleep the debounce window
        await new Promise(resolve => setTimeout(resolve, DEBOUNCE_MS))

        // Check for newer inbound media messages from this contact since
        // my arrival. If any exist, yield to them.
        const sinceISO = new Date(myArrivalMs).toISOString()
        const { data: newerInbounds } = await sb.from('messages')
          .select('id, body, created_at, twilio_sid')
          .eq('contact_id', input.contact_id)
          .eq('direction', 'inbound')
          .gt('created_at', sinceISO)
          .neq('twilio_sid', input.message_sid)
          .order('created_at', { ascending: false })
          .limit(5)

        const hasNewerPhoto = (newerInbounds || []).some(m =>
          /\[media:/i.test(String(m.body || '')) || /^\[media:/i.test(String(m.body || ''))
        )

        if (hasNewerPhoto) {
          // A newer photo arrived during our debounce window. Yield: mark
          // this message silent and exit. The newest photo's invocation
          // will handle the full burst.
          outcome = 'silent'
          return new Response(JSON.stringify({
            ok: true,
            skipped: 'photo_burst_yielded_to_newer',
            newer_count: (newerInbounds || []).length,
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        // We are the latest photo in this burst window. Continue to
        // normal processing. The classifier will see whatever single
        // photo URL was on this webhook. Earlier photos in the burst
        // already exited silent above, so no double-reply.
      }
    }

    // 1b2. v10.1.60 AUDIO MMS detection. If any incoming media is audio
    // (voice memo / amr / m4a / wav), short-circuit: we don't transcribe.
    // Tag the message_body with [audio_mms] so the classifier emits the
    // audio_received label, and skip the photo classifier entirely.
    if (input.media_types && input.media_types.length > 0) {
      const hasAudio = input.media_types.some(t =>
        typeof t === 'string' && t.toLowerCase().startsWith('audio/'))
      if (hasAudio) {
        // v10.1.60: keep non-audio media (photos can ride alongside a
        // voice memo). Filter out only audio URLs from media_urls, and
        // mark the body with [audio_mms] so the classifier knows.
        const audioIdxs = input.media_types
          .map((t, i) => (typeof t === 'string' && t.toLowerCase().startsWith('audio/')) ? i : -1)
          .filter(i => i >= 0)
        const photoUrls = (input.media_urls || []).filter((_, i) => !audioIdxs.includes(i))
        // Strip media markers + audio mentions from body
        const cleanedBody = String(input.message_body || '')
          .replace(/\[media:[^\]]+\]\s*/g, '')
          .trim()
        input.message_body = `[audio_mms] ${cleanedBody}`.trim()
        input.media_urls = photoUrls
        console.log('[bot-engine] audio MMS detected; suppressing audio URLs, kept', photoUrls.length, 'photo URLs')
      }
    }

    // 1c. v10.1.60 TEXT-BURST COALESCING.
    //
    // Same problem as photo bursts but for text: customer fires "yeah",
    // "wait", "actually it's a 7500w" in 10 seconds. Each used to trigger
    // its own classifier+phraser+reply, so Ashley would answer "yeah"
    // and miss the correction. Strategy mirrors the photo path with a
    // shorter window (3s; texts arrive faster) AND we pull the burst
    // together so the latest invocation sees the whole thought.
    //
    // SKIP debounce on:
    //  - STOP keywords (must fire instantly for TCPA compliance)
    //  - Empty body (nothing to coalesce)
    //  - Very short single-word affirmatives that look terminal ("yes",
    //    "no", "ok") — fine to process immediately, even if customer
    //    follows up they'll just route through the next state cleanly.
    //    Actually we WANT debounce on these too because "yes" then
    //    "actually wait" is the exact bug we're fixing. So no skip there.
    const isStopKeyword = STOP_RE.test(input.message_body || '')
    if (!isStopKeyword && (!input.media_urls || input.media_urls.length === 0)) {
      const myArrivalMs = Date.now()
      const TEXT_DEBOUNCE_MS = 3000
      await new Promise(resolve => setTimeout(resolve, TEXT_DEBOUNCE_MS))

      const sinceISO = new Date(myArrivalMs).toISOString()
      const { data: newerInbounds } = await sb.from('messages')
        .select('id, body, created_at, twilio_sid')
        .eq('contact_id', input.contact_id)
        .eq('direction', 'inbound')
        .gt('created_at', sinceISO)
        .neq('twilio_sid', input.message_sid)
        .order('created_at', { ascending: true })
        .limit(10)

      const newerText = (newerInbounds || []).filter(m =>
        m.body && !/\[media:/i.test(String(m.body))
      )

      if (newerText.length > 0) {
        // Newer text exists. Yield silent - the latest will handle the burst.
        outcome = 'silent'
        return new Response(JSON.stringify({
          ok: true,
          skipped: 'text_burst_yielded_to_newer',
          newer_count: newerText.length,
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }

      // We are the latest text in this burst. Pull recent bursts (within
      // the last 15s, before our arrival) and concatenate them into the
      // message body so the LLM sees the full thought, not just our line.
      const burstStartISO = new Date(myArrivalMs - 15000).toISOString()
      const { data: priorBurst } = await sb.from('messages')
        .select('id, body, created_at, twilio_sid')
        .eq('contact_id', input.contact_id)
        .eq('direction', 'inbound')
        .gte('created_at', burstStartISO)
        .lte('created_at', sinceISO)
        .neq('twilio_sid', input.message_sid)
        .order('created_at', { ascending: true })
        .limit(10)

      const burstBodies = (priorBurst || [])
        .map(m => String(m.body || '').trim())
        .filter(b => b && !/\[media:/i.test(b))

      if (burstBodies.length > 0) {
        // Combine: prior burst lines + this message, joined with " / "
        // so the classifier reads them as one continuous thought.
        const combined = [...burstBodies, input.message_body].join(' / ')
        console.log('[bot-engine] coalesced text burst:', burstBodies.length, 'prior + current; combined:', combined.slice(0, 200))
        input.message_body = combined
      }
    }

    // 2. Pull contact
    const { data: contact, error } = await sb.from('contacts')
      .select('id, name, phone, bot_state, bot_disabled, do_not_contact, qualification_data, paused_at_state, last_bot_inbound_at, install_address, address')
      .eq('id', input.contact_id)
      .maybeSingle()
    if (error || !contact) {
      throw new Error(`contact not found: ${input.contact_id}`)
    }

    // 3. Hard guards
    if (contact.bot_disabled || contact.do_not_contact || !contact.bot_state) {
      outcome = 'silent'
      return new Response(JSON.stringify({ ok: true, skipped: 'gated_off',
        bot_disabled: !!contact.bot_disabled, dnc: !!contact.do_not_contact, bot_state: contact.bot_state || null }),
        { status: 200, headers: { 'content-type': 'application/json' } })
    }

    // v10.1.36, race-condition guard: if conversation already terminal AND
    // handoff already fired, drop subsequent rapid-fire messages so we don't
    // send 3 duplicate "Key will follow up" texts. Customer can still
    // re-engage via a fresh form submit; mid-flow at terminal is done.
    if (TERMINAL_STATES.has(contact.bot_state) && contact.qualification_data?.handoff_fired_at) {
      outcome = 'silent'
      return new Response(JSON.stringify({ ok: true, skipped: 'already_terminal',
        bot_state: contact.bot_state, handoff_fired_at: contact.qualification_data.handoff_fired_at }),
        { status: 200, headers: { 'content-type': 'application/json' } })
    }

    // 4. STOP keyword fast path
    if (STOP_RE.test(input.message_body || '')) {
      await sb.from('contacts').update({
        do_not_contact: true,
        bot_state: 'STOPPED',
        last_bot_inbound_at: new Date().toISOString(),
      }).eq('id', contact.id)
      outcome = 'silent'
      return new Response(JSON.stringify({ ok: true, stopped: true }),
        { status: 200, headers: { 'content-type': 'application/json' } })
    }

    // 4b. v10.1.38, auto-advance Stage 1 → 2 on first customer reply.
    // v10.1.59 (Tyler audit 2026-05-07): switched to atomic UPDATE-WHERE
    // because the prior SELECT-then-UPDATE pattern was somehow not
    // landing the change in production (verified: stage stayed 1 after
    // first inbound). Atomic conditional UPDATE returns the row if
    // stage was 1 + got set to 2; nothing if not.
    try {
      const { data: updated, error: stageErr } = await sb.from('contacts')
        .update({ stage: 2 })
        .eq('id', contact.id)
        .eq('stage', 1)
        .select('id, stage')
      if (stageErr) {
        console.warn('[bot-engine] stage 1→2 advance returned error:', stageErr)
      } else if (updated && updated.length > 0) {
        // v10.1.62: removed manual stage_history insert. The
        // contacts_stage_change_record AFTER UPDATE trigger now records
        // the transition automatically (fixed in 20260508 migration).
        // Doing both produced duplicate stage_history rows.
        console.log('[bot-engine] auto-advanced stage 1→2 on first customer reply', contact.id)
      }
    } catch (e) {
      console.warn('[bot-engine] stage 1→2 advance failed (non-blocking):', e)
    }

    // 5. Recent turns
    const recentTurns = await fetchRecentTurns(sb, contact.id, 4)

    // 6. Optional photo classifier
    let photoResult: any = null
    if (input.media_urls && input.media_urls.length > 0) {
      try {
        const expected: 'panel' | 'outlet' | 'either' =
          contact.bot_state === 'AWAIT_PANEL_PHOTO' ? 'panel'
            : contact.bot_state === 'AWAIT_OUTLET_PHOTO' ? 'outlet'
              : 'either'
        photoResult = await callInternal('bot-photo-classifier', {
          photo_url: input.media_urls[0],
          expected_subject: expected,
          conversation_context: `state=${contact.bot_state}`,
        })
      } catch (e) {
        console.warn('[bot-engine] photo-classifier failed', e)
      }
    }

    // 7. Classifier
    const classifier = await callInternal('bot-classifier', {
      inbound_message: input.message_body || '',
      state: contact.bot_state,
      recent_turns: recentTurns,
    })

    // v10.1.32, suppress email_typo_suspected false-positives for legit
    // custom domains. The classifier is over-eager: any long domain that
    // isn't gmail/yahoo/etc gets flagged. Only TRUST the typo flag when the
    // domain looks like a misspelling of a known provider (gmial, yahooo,
    // hotnail, outlok, icoud, etc).
    if (classifier?.email_typo_suspected) {
      const inboundLower = String(input.message_body || '').toLowerCase()
      const realTypoPatterns = /\b(gmial|gmal|gnail|gmaill|yahooo|yaho|hotnail|hotmial|outlok|outluk|icoud|iclod|aol\.cm|comcasr)\b/
      if (!realTypoPatterns.test(inboundLower)) {
        classifier.email_typo_suspected = false
      }
    }

    // v10.1.33, regex pre-extraction BEFORE state machine, so the SM can
    // see whether email/address/last_name were captured this turn and route
    // accordingly. Without this, customer dumping "Goodson, x@y.com, 22 Main
    // St" at AWAIT_EMAIL routes to AWAIT_ADDRESS_CONFIRM (state machine only
    // saw email_provided, didn't know address was already in the body).
    const inboundText = String(input.message_body || '')
    const preExtracted: { email?: string; address?: string; last_name?: string } = {}
    if (inboundText) {
      const emailMatch = inboundText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/i)
      if (emailMatch) preExtracted.email = emailMatch[0]

      const addrMatch = inboundText.match(
        /\b\d{1,6}\s+\w[\w\s.,'-]{3,80}?\b(?:st|street|rd|road|ave|avenue|blvd|dr|drive|ln|lane|trl|trail|way|ct|court|pl|place|hwy|highway|pkwy|parkway|cir|circle)\b[^.\n]{0,120}/i
      )
      if (addrMatch) preExtracted.address = addrMatch[0].trim().replace(/[,;]+\s*$/, '')

      if (contact.bot_state === 'AWAIT_EMAIL') {
        const lnMatch = inboundText.match(/^\s*([A-Z][a-z'-]{1,24})(?:\s*[,]|\s*$)/)
        if (lnMatch) preExtracted.last_name = lnMatch[1]
      }
    }

    // v10.1.37, out-of-scope + out-of-service-area detection. Compute
    // flags here (BEFORE state machine) so we can override the transition.
    // Persisted to qd later in step 9 so they survive into handoff-notifier.
    const emailSeen = preExtracted.email || contact.email
    const addressSeen = preExtracted.address || contact.install_address
    const outOfScopeRe = /\b(whole.?home|whole.?house|standby\s*generator|generac.{0,15}(install|standby|stand-by|whole)|kohler.{0,15}(install|standby|stand-by|whole)|automatic\s*transfer\s*switch|\bats\b|permanent\s*generator|natural\s*gas\s*generator|propane\s*generator)\b/i
    const detectedOutOfScope = outOfScopeRe.test(inboundText)
    let detectedOutOfArea = false
    if (preExtracted.address || addressSeen) {
      const fullAddr = String(preExtracted.address || addressSeen || '')
      const addrLower = fullAddr.toLowerCase()
      const inAreaCities = [
        'travelers rest','taylors','greer','greenville','easley','mauldin',
        'pickens','simpsonville','fountain inn','spartanburg','piedmont',
        'liberty','central','powdersville','duncan','wellford','lyman','inman',
        'six mile','dacusville','salem','sunset','marietta','tigerville',
      ]
      const oosaCities = [
        'charleston','columbia','charlotte','asheville','atlanta','raleigh',
        'augusta','savannah','rock hill','myrtle beach','hilton head',
        'florence','sumter','gaffney','rutherfordton','hendersonville',
        'brevard','tryon','clemson','seneca','anderson','aiken',
        // v10.1.40: synced with bot-lab/sc-jurisdictions.json. Anderson
        // County cities surfaced in P06 Diana sim 2026-05-07 as gaps;
        // a customer typing "Belton, SC" would slip past mid-conversation
        // OOA detection. Same for the other Anderson + Oconee city stubs.
        'belton','honea path','williamston','iva','pendleton',
        'walhalla','westminster','newry','salem',
        'blacksburg','clinton','laurens','ware shoals',
      ]
      const isInArea = inAreaCities.some(c => addrLower.includes(c))
      const isOutOfArea = !isInArea && oosaCities.some(c => addrLower.includes(c))
      const otherState = /\b(NC|GA|TN|FL|TX|CA|NY|VA|AL|MS|LA|OH|PA|NJ|MA|MI|IL|WI|MN|OR|WA|CO|AZ|NV|UT|ID|MT|WY|MO|KS|NE|OK|AR|KY|IN|IA|MD|DE|CT|RI|VT|NH|ME|HI|AK|ND|SD)\b/.test(fullAddr)
      detectedOutOfArea = isOutOfArea || otherState
    }

    // 8. State machine transition
    const ctx = buildSmCtx(contact, classifier)

    // v10.1.60 EMOJI-ONLY GUARD. If the message is just an emoji or a
    // single character with low classifier confidence, treat as
    // engagement-without-content: ack briefly + re-ask current question
    // instead of forcing a state transition off a guess. Avoids the case
    // where "👍" gets stamped as affirmative on a NO/YES state when
    // the customer was just acknowledging the bot.
    const trimmedBody = String(input.message_body || '').trim()
    const isEmojiOnly = trimmedBody.length > 0 && trimmedBody.length <= 8 &&
      /^[\p{Emoji}\p{Punctuation}\p{Symbol}\s]+$/u.test(trimmedBody) &&
      !/^[a-z0-9]/i.test(trimmedBody)
    if (isEmojiOnly && (classifier.confidence ?? 1) < 0.7) {
      console.log('[bot-engine] emoji-only inbound, low confidence; ack + re-ask self-loop')
      // Override classifier label to friendly_chitchat self-loop with re-ask
      classifier.label = 'friendly_chitchat'
      classifier.chitchat_excerpt = trimmedBody
    }

    let transitionResult = smTransition(contact.bot_state, classifier.label, ctx)

    // v10.1.37, when scope-mismatch flags fire, force terminal so we
    // hand off to Key with clear out-of-scope context. Don't keep
    // grinding through qualification when the answer is "we don't do that".
    if (detectedOutOfScope || detectedOutOfArea) {
      const targetState = detectedOutOfArea
        ? 'DISQUALIFIED_OUT_OF_AREA'
        : 'NEEDS_CALLBACK'
      transitionResult = { ...transitionResult, next: targetState, intent: undefined }
    }

    // v10.1.45 STUCK-STATE ESCALATION CAP (Patricia sim 2026-05-07)
    //
    // When off_topic_question self-loops repeatedly at the same state,
    // the customer is deflecting and the conversation is going nowhere.
    // Without a cap, this loops forever. Cap at 3 consecutive off-topic
    // self-loops on a given state, then auto-escalate to NEEDS_CALLBACK.
    // Counter is per-state, stored in qualification_data, increments only
    // when the SAME state self-loops on off_topic_question, resets on any
    // forward progress.
    {
      const qdNow: any = contact.qualification_data || {}
      const stuckKey = `stuck_offtopic_at_${contact.bot_state}`
      const isOffTopicSelfLoop =
        classifier?.label === 'off_topic_question' &&
        transitionResult.next === contact.bot_state &&
        !TERMINAL_STATES.has(transitionResult.next)
      if (isOffTopicSelfLoop) {
        const next = (qdNow[stuckKey] || 0) + 1
        qdNow[stuckKey] = next
        // Carry forward into newQd writes downstream by mutating ctx,
        // we apply via applySlotUpdates which preserves prior qd. The
        // cap kicks in when this would be the THIRD reply on the same
        // off_topic_question loop.
        if (next >= 3) {
          transitionResult = {
            ...transitionResult,
            next: 'NEEDS_CALLBACK',
            intent: `customer has deflected with off_topic_question 3+ times at ${contact.bot_state}; escalate to Key warmly. Do NOT shame the customer or list their questions back. Use the standard NEEDS_CALLBACK fallback.`,
            fallback: SM_STATES.NEEDS_CALLBACK?.fallback?.(ctx) || 'No problem. I will have Key follow up with you personally on this one. He will reach out shortly.',
          }
        }
        // Stash on contact.qualification_data so applySlotUpdates merges it.
        contact.qualification_data = qdNow
      } else if (transitionResult.next !== contact.bot_state) {
        // Forward progress, reset all stuck counters
        for (const k of Object.keys(qdNow)) {
          if (k.startsWith('stuck_offtopic_at_')) delete qdNow[k]
        }
        contact.qualification_data = qdNow
      }
    }

    // v10.1.33, at AWAIT_EMAIL, if customer provided email + address in
    // the same message AND email isn't a real typo, skip both
    // CHECK_EMAIL_TYPO and AWAIT_ADDRESS_CONFIRM and go straight to RECAP.
    // The state machine doesn't know about regex extraction or our typo
    // suppression; we override here. (emailSeen/addressSeen hoisted above.)
    const skipToRecap =
      contact.bot_state === 'AWAIT_EMAIL' &&
      emailSeen && addressSeen &&
      !classifier?.email_typo_suspected &&
      (transitionResult.next === 'CHECK_EMAIL_TYPO' || transitionResult.next === 'AWAIT_ADDRESS_CONFIRM')
    if (skipToRecap) {
      const recapMeta = SM_STATES?.RECAP
      transitionResult = {
        ...transitionResult,
        next: 'RECAP',
        intent: recapMeta?.intent,
        fallback: typeof recapMeta?.fallback === 'function' ? recapMeta.fallback(ctx) : (recapMeta?.fallback || ''),
      }
    }

    // v10.1.34, auto-advance through AWAIT_RUN when customer already gave
    // panel location at AWAIT_PANEL_PHOTO (eg "in the garage on the outside
    // wall"). Don't make them answer the same question twice. Detect via
    // panel_location in qualification_data OR by panel keywords in inbound.
    const panelLocPrior = !!(contact.qualification_data?.panel_location)
    const panelLocInBody = /\b(garage|basement|utility|exterior|interior|outside|outdoor|crawl|attic)\b/i.test(inboundText)
    const panelLocFromClassifier = !!(classifier?.label && /^panel_/.test(classifier.label))
    const panelLocAny = panelLocPrior || panelLocInBody || panelLocFromClassifier
    if (
      transitionResult.next === 'AWAIT_RUN' &&
      panelLocAny
    ) {
      // If we're heading to AWAIT_RUN purely to ask panel location, but
      // the customer ALREADY told us, jump to AWAIT_EMAIL (close-info ask).
      // Swap intent + fallback to AWAIT_EMAIL's so the phraser renders
      // the close-info ask (not the original transition's text).
      const aeMeta = SM_STATES?.AWAIT_EMAIL
      transitionResult = {
        ...transitionResult,
        next: 'AWAIT_EMAIL',
        intent: aeMeta?.intent,
        fallback: typeof aeMeta?.fallback === 'function' ? aeMeta.fallback(ctx) : (aeMeta?.fallback || ''),
      }
    }

    // v10.1.34b, guard against false-positive NEEDS_CALLBACK at
    // AWAIT_PANEL_PHOTO. Multi-clause messages like "panels in basement,
    // ill grab pic tomorrow" sometimes classify as off_topic_question →
    // NEEDS_CALLBACK terminal. If panel location is mentioned, treat as
    // photo_will_send_later (soft pause) instead of going terminal. This
    // also catches "no garage" / "actually it's basement" corrections.
    if (
      contact.bot_state === 'AWAIT_PANEL_PHOTO' &&
      transitionResult.next === 'NEEDS_CALLBACK' &&
      panelLocAny
    ) {
      // Swap intent + fallback to AWAIT_EMAIL's so the phraser renders
      // the close-info ask (not the original transition's text).
      const aeMeta = SM_STATES?.AWAIT_EMAIL
      transitionResult = {
        ...transitionResult,
        next: 'AWAIT_EMAIL',
        intent: aeMeta?.intent,
        fallback: typeof aeMeta?.fallback === 'function' ? aeMeta.fallback(ctx) : (aeMeta?.fallback || ''),
      }
    }

    // 9. Persist slot updates + new state
    const newQd = applySlotUpdates(contact.qualification_data || {}, classifier, photoResult)
    if (transitionResult.onEnter) Object.assign(newQd, transitionResult.onEnter)
    // v10.1.37, apply scope-mismatch flags computed earlier
    if (detectedOutOfScope) newQd.scope_mismatch_ats = true
    if (detectedOutOfArea) newQd.scope_mismatch_oosa = true
    // v10.1.45 SEND-FAIL STATE-ROLLBACK PREP. Capture prior state so we
    // can roll back bot_state if send-sms fails after the DB write.
    // Without this, a transient send failure leaves the contact stuck at
    // the next state but having never received the prompt for it. Their
    // next inbound would be processed from the wrong state.
    const priorBotState = contact.bot_state
    const stateUpdate: Record<string, unknown> = {
      bot_state: transitionResult.next,
      qualification_data: newQd,
      last_bot_inbound_at: new Date().toISOString(),
    }
    // Classifier-label-based slot writes
    // v10.1.62: outlet labels also imply voltage. 50A residential is
    // always 240V. 30A 4-prong (L14-30) is 240V. 30A 3-prong (TT-30R)
    // is 120V (handled at DISQUALIFIED_120V state already). gen_240v
    // mirrors that so the CRM has correct voltage on every qualified lead.
    if (classifier?.label === 'gen_240v') stateUpdate.gen_240v = true
    if (classifier?.label === 'gen_120v') stateUpdate.gen_240v = false
    if (classifier?.label === 'outlet_50a') {
      stateUpdate.outlet_amps = 50
      stateUpdate.outlet_type = '14-50R'  // NEMA 14-50R
      stateUpdate.gen_240v = true
    }
    if (classifier?.label === 'outlet_30a_4prong' || classifier?.label === 'outlet_30a') {
      stateUpdate.outlet_amps = 30
      stateUpdate.outlet_type = 'L14-30R'  // NEMA L14-30R
      stateUpdate.gen_240v = true
    }
    if (classifier?.label === 'outlet_30a_3prong') {
      stateUpdate.outlet_amps = 30
      stateUpdate.outlet_type = 'TT-30R-or-L5-30R'  // 120V variants
      stateUpdate.gen_240v = false
    }
    // v10.1.62: ownership writes (was missing entirely - is_owner was
    // never persisted even when classifier returned 'owner' or 'renter').
    if (classifier?.label === 'owner') stateUpdate.is_owner = true
    if (classifier?.label === 'renter') stateUpdate.is_owner = false
    // v10.1.62: volunteered ownership detection. Classifier prioritizes
    // routing labels (panel_*, outlet_*) over secondary signals, so a
    // message like "we own. panel is on the outside wall" returns
    // panel_garage_exterior and is_owner never gets stamped. Sniff the
    // raw inbound for explicit ownership language as a fallback.
    if (stateUpdate.is_owner === undefined) {
      const inboundLower = String(input.message_body || '').toLowerCase()
      const ownerSignal = /\b(we own|i own|we're the owner|i'm the owner|owner here|own the (place|home|house)|we bought|i bought|just bought)\b/.test(inboundLower)
      const renterSignal = /\b(we rent|i rent|renting|landlord|property manager|tenant|rental property)\b/.test(inboundLower)
      if (ownerSignal && !renterSignal) stateUpdate.is_owner = true
      if (renterSignal && !ownerSignal) stateUpdate.is_owner = false
    }
    if (classifier?.label === 'email_provided' && classifier.extracted_value) stateUpdate.email = classifier.extracted_value

    // Apply pre-extracted slots (only fill blanks; don't overwrite existing)
    if (preExtracted.email && !stateUpdate.email && !contact.qualification_data?.email_locked) {
      stateUpdate.email = preExtracted.email
    }
    if (preExtracted.address && !contact.install_address) {
      stateUpdate.install_address = preExtracted.address
    }
    if (preExtracted.last_name && !contact.qualification_data?.last_name) {
      newQd.last_name = preExtracted.last_name
      stateUpdate.qualification_data = newQd
      if (contact.name && !contact.name.includes(' ')) {
        stateUpdate.name = `${contact.name} ${preExtracted.last_name}`.trim()
      } else if (!contact.name) {
        stateUpdate.name = preExtracted.last_name
      }
    }
    // Capture install_path from explicit panel-location classifier labels
    // for richer handoff context (e.g., panel_garage_exterior).
    if (classifier?.label && /^panel_/.test(classifier.label)) {
      newQd.panel_location = classifier.label.replace(/^panel_/, '').replace(/_/g, ' ')
      stateUpdate.qualification_data = newQd
    }
    await sb.from('contacts').update(stateUpdate).eq('id', contact.id)

    // 10. Append turn to bot_state_history (best-effort; column may not exist)
    try {
      const history = Array.isArray(newQd.bot_state_history) ? newQd.bot_state_history : []
      history.push({
        ts: new Date().toISOString(),
        prev_state: contact.bot_state,
        next_state: transitionResult.next,
        classifier_label: classifier.label,
        classifier_confidence: classifier.confidence,
        message_sid: input.message_sid,
      })
      // Cap at last 50
      const trimmed = history.slice(-50)
      await sb.from('contacts').update({
        qualification_data: { ...newQd, bot_state_history: trimmed },
      }).eq('id', contact.id)
    } catch (_) { /* ignore */ }

    // 11. Terminal handoff? (idempotent, only fire once per contact)
    // v10.1.33, was firing on every subsequent inbound when state stayed
    // terminal, sending Key 2-3 duplicate handoff alerts. Track via
    // qualification_data.handoff_fired_at.
    if (TERMINAL_STATES.has(transitionResult.next)) {
      const alreadyFired = !!(contact.qualification_data?.handoff_fired_at)
      if (!alreadyFired) {
        // v10.1.49 (real-LLM voice-judge 2026-05-07): ALWAYS stamp
        // handoff_fired_at, even if handoff-notifier itself fails. Was:
        // notifier throws → handoff_fired_at never set → subsequent
        // inbounds re-fire notifier + terminal-reply path → customer
        // gets the same callback message 3-4x in a row. The conversation
        // gating must be hard-stamped locally; the alert to Key is
        // best-effort and can fail without breaking flow control.
        newQd.handoff_fired_at = new Date().toISOString()
        newQd.handoff_terminal_state = transitionResult.next
        await sb.from('contacts').update({
          qualification_data: newQd,
        }).eq('id', contact.id)
        try {
          await callInternal('bot-handoff-notifier', {
            contact_id: contact.id,
            terminal_state: transitionResult.next,
            callback_excerpt: classifier?.off_topic_excerpt || classifier?.coverage_excerpt
              || classifier?.impatience_excerpt || classifier?.chitchat_excerpt
              || (input.message_body || '').slice(0, 140),
          })
        } catch (e) {
          console.warn('[bot-engine] handoff-notifier failed (handoff_fired_at already stamped)', e)
        }
      } else {
        console.log('[bot-engine] handoff already fired, skipping duplicate')
      }
      // v10.1.35, send a polite customer-facing reply on terminal states
      // so the customer doesn't get crickets. Silent on STOPPED only (TCPA).
      // Vary the wording to feel less robotic.
      let terminalReply: string | null = null
      const fname = (contact.name ? String(contact.name).split(/\s+/)[0] : '').trim()
      // v10.1.36, don't prefix with first name if it matches the electrician's
      // name (creates "Key, let me have Key..." double-Key). Also skip generic
      // placeholders like "there" / "Lead".
      // v10.1.58 (Tyler iMessage feedback 2026-05-08): Key flagged that
      // repeating the customer's name on every terminal reads robotic.
      // Real humans don't text "Sarah, no rush" -> just "no rush." The
      // name-prefix-on-every-turn pattern signals "CRM trying to
      // personalize" not "person texting you." Drop the namePrefix
      // entirely on terminal replies. Greeting still uses the name once
      // (correct: introducing the relationship). Final SCHEDULE_QUOTE
      // close-out keeps the name once for warmth ("Thanks, Sarah." -
      // that's a normal sign-off). Mid-flow terminals (NEEDS_CALLBACK
      // / DQ / POSTPONED): no name opener.
      const skipName = !fname || /^(there|lead|customer|unknown|key)$/i.test(fname)
      const _legacyNamePrefix = skipName ? '' : `${fname}, `  // kept for reference
      const namePrefix = ''  // v10.1.58: ALWAYS empty for terminal openers
      switch (transitionResult.next) {
        case 'NEEDS_CALLBACK':
          // v10.1.37, scope-mismatch (whole-home) gets its OWN reply
          // explaining BPP only does inlet boxes for portable generators.
          if (newQd.scope_mismatch_ats) {
            terminalReply = `${namePrefix}we only do inlet box installs for portable generators (the kind you wheel out and plug in). Whole-home standby systems like Generac/Kohler with auto-transfer switches are a different scope, Key handles those personally so he'll reach out.`
          } else if (newQd.priority === 'urgent' || classifier?.label === 'urgent_callback_demand') {
            // v10.1.50 (real-LLM voice-judge 2026-05-07): label-aware
            // terminal reply for urgent_callback_demand. Was using generic
            // "Key will follow up" which read cold to a panicked customer.
            // Now: acknowledge urgency briefly, set realistic permit
            // expectation, reassure Key sees it immediately. Premium
            // posture (no over-promise on speed).
            terminalReply = `${namePrefix}understood, sending Key your details now so he can reach out as soon as he's free. Heads up: even rush installs need a permit (typically 1-2 weeks per jurisdiction), so he'll talk through realistic timing with you when he calls.`
          } else if (classifier?.label === 'asking_for_human') {
            // v10.1.50: explicit-request-for-human gets a tighter ack.
            terminalReply = `${namePrefix}got it, having Key reach out directly. He'll text you shortly.`
          } else {
            // Vary by simple hash of contact_id for natural variation.
            const greet = skipName ? 'Hey, ' : `Hey ${fname}, `
            const variants = [
              `${namePrefix}I'll have Key follow up with you on this one personally. He'll reach out shortly.`,
              `${greet}going to pass this to Key directly so he can answer. He'll be in touch soon.`,
              `Got it. I'll loop in Key on this one and he'll text you back personally.`,
              `${namePrefix}Key handles this kind of thing himself. He'll follow up with you shortly.`,
              `Sounds good. Letting Key take it from here, he'll reach out to you directly.`,
            ]
            const idx = (input.contact_id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % variants.length
            terminalReply = variants[idx]
          }
          break
        case 'POSTPONED':
          // v10.1.62: respect transitionResult.fallback when the universal
          // escape supplied a context-specific one (wrong_person_polite,
          // customer_changed_mind, spouse_approval_needed). Falling back
          // to the generic "no rush" only when no specific fallback is set.
          if (transitionResult.fallback && typeof transitionResult.fallback === 'string') {
            terminalReply = transitionResult.fallback
          } else {
            terminalReply = `${namePrefix}no rush, text me back whenever you're ready and we'll pick up where we left off.`
          }
          break
        case 'DISQUALIFIED_120V':
          terminalReply = `${namePrefix}sounds like the generator is a 120V model, which won't work for a whole-home connection. If you ever upgrade to a 240V unit we'd be happy to help.`
          break
        case 'DISQUALIFIED_RENTER':
          terminalReply = `${namePrefix}we can only install for property owners, since the work is permanent and needs permits. If you own a home elsewhere or end up buying, reach back out.`
          break
        case 'DISQUALIFIED_OUT_OF_AREA':
          terminalReply = `${namePrefix}looks like that's outside our service area, we only cover Greenville, Spartanburg, and Pickens counties in Upstate SC. Wishing you luck finding someone local.`
          break
        // STOPPED stays silent per TCPA. COMPLETE has its own SCHEDULE_QUOTE
        // close-out handled by phraser before reaching this point.
      }

      let sentTerminal = false
      if (terminalReply) {
        try {
          // v10.1.61: human-typing delay
          const sendResp = await sendCustomerReply(contact.id, terminalReply)
          sentTerminal = sendResp.ok
          if (sendResp.ok) {
            await sb.from('contacts').update({
              last_bot_outbound_at: new Date().toISOString(),
            }).eq('id', contact.id)
          }
        } catch (e) {
          console.warn('[bot-engine] terminal reply send failed', e)
        }
      }
      outcome = sentTerminal ? 'replied' : 'silent'
      return new Response(JSON.stringify({
        ok: true,
        prev_state: contact.bot_state,
        next_state: transitionResult.next,
        classifier_label: classifier.label,
        intent: transitionResult.intent,
        sent: sentTerminal,
        terminal: true,
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }

    // 12. Phraser
    let outboundText = transitionResult.fallback || ''
    if (transitionResult.intent) {
      try {
        const phraserInput = {
          intent: transitionResult.intent,
          customer_first_name: ctx.first_name,
          customer_last_message: input.message_body || null,
          address_on_file: ctx.address_on_file,
          chitchat_excerpt: classifier?.chitchat_excerpt || null,
          impatience_excerpt: classifier?.impatience_excerpt || null,
          amended_slot: classifier?.amended_slot || null,
          email_typo_suspected: !!classifier?.email_typo_suspected,
          email_likely_meant: classifier?.email_likely_meant || null,
          clarifying_question: classifier?.clarifying_question || null,
          requested_time: classifier?.requested_time || null,
          referral_source: classifier?.referral_source || null,
          customer_style: classifier?.inferred_customer_style || 'default',
          customer_recent_length: (input.message_body || '').length,
          time_of_day_bucket: timeOfDayBucket(),
          qualification_slots: newQd || null,
          fallback_text: transitionResult.fallback || '',
        }
        const phraserResp = await callInternal('bot-phraser', phraserInput)
        if (phraserResp?.text) outboundText = phraserResp.text
      } catch (e) {
        console.warn('[bot-engine] phraser failed, using fallback', e)
      }
    }

    // 13. send-sms (v10.1.61: with human-typing delay)
    if (outboundText) {
      const sendResp = await sendCustomerReply(contact.id, outboundText)
      if (!sendResp.ok) {
        const t = await sendResp.text()
        // v10.1.45 SEND-FAIL ROLLBACK. The state was already advanced
        // earlier (line ~620) before send-sms fired. If the customer
        // never receives the bot's reply, their next inbound would be
        // processed from the wrong state. Roll bot_state back to prior
        // so the customer's next message resumes from where they were.
        // qualification_data stays forward (we did learn things from
        // the inbound). Best-effort: if rollback itself fails, log and
        // throw the original send error.
        try {
          await sb.from('contacts').update({
            bot_state: priorBotState,
          }).eq('id', contact.id)
          console.warn('[bot-engine] send failed, rolled bot_state back', {
            contact_id: contact.id, from: transitionResult.next, to: priorBotState,
          })
        } catch (rbErr) {
          console.error('[bot-engine] send-fail rollback ALSO failed', rbErr)
        }
        throw new Error(`send-sms failed: ${sendResp.status} ${t.slice(0, 200)}`)
      }
      outcome = 'replied'
      await sb.from('contacts').update({
        last_bot_outbound_at: new Date().toISOString(),
      }).eq('id', contact.id)
    }

    return new Response(JSON.stringify({
      ok: true,
      prev_state: contact.bot_state,
      next_state: transitionResult.next,
      classifier_label: classifier.label,
      intent: transitionResult.intent,
      sent: !!outboundText,
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch (e) {
    outcome = 'error'
    errorMsg = String(e).slice(0, 200)
    console.error('[bot-engine] inbound failed', e)
    return new Response(JSON.stringify({ ok: false, error: errorMsg }),
      { status: 500, headers: { 'content-type': 'application/json' } })
  } finally {
    try {
      await recordProcessed(input.message_sid, outcome, input.contact_id, errorMsg)
    } catch (_) { /* ignore */ }
  }
}

// ──────────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const gate = requireServiceRole(req)
  if (gate) return gate

  let input: any
  try {
    input = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  if (input?.trigger === 'new_lead' && input?.contact_id) {
    try {
      return await handleNewLead(input as NewLeadInput)
    } catch (e) {
      console.error('bot-engine new_lead failed:', e)
      return new Response(JSON.stringify({ ok: false, error: String(e).slice(0, 500) }),
        { status: 500, headers: { 'content-type': 'application/json' } })
    }
  }

  if (input?.trigger === 'inbound_message' && input?.contact_id && input?.message_sid) {
    return await handleInbound(input as InboundInput)
  }

  // Reference INITIAL_STATE so the import is retained even when GREETING
  // takes a templated path through assignGreetingVariant. (Ashley's
  // INITIAL_STATE === 'GREETING'.)
  void INITIAL_STATE

  return new Response(JSON.stringify({ ok: false, error: 'unsupported_trigger', trigger: input?.trigger }),
    { status: 400, headers: { 'content-type': 'application/json' } })
})
