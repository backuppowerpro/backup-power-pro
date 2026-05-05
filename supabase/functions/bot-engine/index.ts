/**
 * bot-engine — Ashley's orchestrator.
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
 * Auth: requireServiceRole — internal-only.
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

  const sendResp = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contactId: contact.id,
      body: messageBody,
    }),
  })

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
//  INBOUND flow
// ──────────────────────────────────────────────────────────────────────────

async function callInternal(path: string, body: unknown): Promise<any> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`${path} ${r.status}: ${text.slice(0, 200)}`)
  }
  return await r.json()
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

    // v10.1.32 — suppress email_typo_suspected false-positives for legit
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

    // v10.1.33 — regex pre-extraction BEFORE state machine, so the SM can
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

    // 8. State machine transition
    const ctx = buildSmCtx(contact, classifier)
    let transitionResult = smTransition(contact.bot_state, classifier.label, ctx)

    // v10.1.33 — at AWAIT_EMAIL, if customer provided email + address in
    // the same message AND email isn't a real typo, skip both
    // CHECK_EMAIL_TYPO and AWAIT_ADDRESS_CONFIRM and go straight to RECAP.
    // The state machine doesn't know about regex extraction or our typo
    // suppression; we override here.
    const emailSeen = preExtracted.email || contact.email
    const addressSeen = preExtracted.address || contact.install_address
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

    // v10.1.34 — auto-advance through AWAIT_RUN when customer already gave
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

    // v10.1.34b — guard against false-positive NEEDS_CALLBACK at
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
    const stateUpdate: Record<string, unknown> = {
      bot_state: transitionResult.next,
      qualification_data: newQd,
      last_bot_inbound_at: new Date().toISOString(),
    }
    // Classifier-label-based slot writes
    if (classifier?.label === 'gen_240v') stateUpdate.gen_240v = true
    if (classifier?.label === 'gen_120v') stateUpdate.gen_240v = false
    if (classifier?.label === 'outlet_50a') stateUpdate.outlet_amps = 50
    if (classifier?.label === 'outlet_30a_4prong' || classifier?.label === 'outlet_30a') stateUpdate.outlet_amps = 30
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

    // 11. Terminal handoff? (idempotent — only fire once per contact)
    // v10.1.33 — was firing on every subsequent inbound when state stayed
    // terminal, sending Key 2-3 duplicate handoff alerts. Track via
    // qualification_data.handoff_fired_at.
    if (TERMINAL_STATES.has(transitionResult.next)) {
      const alreadyFired = !!(contact.qualification_data?.handoff_fired_at)
      if (!alreadyFired) {
        try {
          await callInternal('bot-handoff-notifier', {
            contact_id: contact.id,
            terminal_state: transitionResult.next,
            callback_excerpt: classifier?.off_topic_excerpt || classifier?.coverage_excerpt
              || classifier?.impatience_excerpt || classifier?.chitchat_excerpt
              || (input.message_body || '').slice(0, 140),
          })
          // Mark handoff as fired so subsequent inbounds don't re-trigger
          newQd.handoff_fired_at = new Date().toISOString()
          newQd.handoff_terminal_state = transitionResult.next
          await sb.from('contacts').update({
            qualification_data: newQd,
          }).eq('id', contact.id)
        } catch (e) {
          console.warn('[bot-engine] handoff-notifier failed', e)
        }
      } else {
        console.log('[bot-engine] handoff already fired, skipping duplicate')
      }
      outcome = 'silent'
      return new Response(JSON.stringify({
        ok: true,
        prev_state: contact.bot_state,
        next_state: transitionResult.next,
        classifier_label: classifier.label,
        intent: transitionResult.intent,
        sent: false,
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

    // 13. send-sms
    if (outboundText) {
      const sendResp = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactId: contact.id,
          body: outboundText,
        }),
      })
      if (!sendResp.ok) {
        const t = await sendResp.text()
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
