/**
 * send-neighbor-cards
 *
 * Sends Lob postcards to the ~10 nearest neighbors of a completed BPP install.
 * Two variations (A / B) are alternated for A/B tracking via unique QR codes.
 *
 * NOT LIVE — LOB_API_KEY must be set in Supabase secrets before this fires.
 * Call manually from CRM "Send Neighbor Cards" button; auto-trigger added later.
 *
 * POST { contactId: string }
 *
 * Response:
 * {
 *   sent: number,
 *   skipped: number,         // candidates that failed Lob verification
 *   cards: [{ id, variation, address, lob_id, scan_id }],
 *   dry_run: boolean         // true if LOB_API_KEY not set
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceRole } from '../_shared/auth.ts'

// ── Config ────────────────────────────────────────────────────────────────────
const LOB_API_KEY  = Deno.env.get('LOB_API_KEY') || ''
const LOB_BASE     = 'https://api.lob.com/v1'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const TRACK_BASE   = SUPABASE_URL + '/functions/v1/track-card'

const FROM_ADDRESS = {
  name:          'Backup Power Pro',
  address_line1: '22 Kimbell CT',
  address_city:  'Greenville',
  address_state: 'SC',
  address_zip:   '29617',
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

// ── Address generation ─────────────────────────────────────────────────────────
// Given a customer address like "123 Main St", generates neighbors by incrementing
// the house number in steps of 2 (preserving odd/even side of street).
function generateCandidates(address: string, city: string, state: string, zip: string) {
  const match = address.trim().match(/^(\d+)\s+(.+)$/)
  if (!match) return []

  const houseNum = parseInt(match[1])
  const street   = match[2].trim()
  const step     = 2  // houses on same side are always 2 apart

  const candidates = []
  for (let i = step; i <= 10; i += step) {
    if (houseNum - i > 0) {
      candidates.push({ address_line1: `${houseNum - i} ${street}`, city, state, zip_code: zip })
    }
    candidates.push({ address_line1: `${houseNum + i} ${street}`, city, state, zip_code: zip })
  }
  return candidates.slice(0, 20) // cap at 20 candidates → expect ~10 valid
}

// ── Lob address verification ───────────────────────────────────────────────────
async function verifyAddresses(candidates: any[]): Promise<any[]> {
  const auth = 'Basic ' + btoa(LOB_API_KEY + ':')
  const resp = await fetch(`${LOB_BASE}/bulk/us_verifications`, {
    method: 'POST',
    headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ addresses: candidates }),
  })
  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Lob verification failed: ${resp.status} ${err.slice(0, 200)}`)
  }
  const data = await resp.json()
  // Only keep deliverable addresses
  return (data.addresses || []).filter((a: any) =>
    a.deliverability === 'deliverable' || a.deliverability === 'deliverable_incorrect_unit'
  )
}

// ── Lob postcard send ──────────────────────────────────────────────────────────
async function sendPostcard(
  toAddress: any,
  variation: 'A' | 'B',
  mergeVars: Record<string, string>,
  frontHtml: string,
  backHtml: string,
  description: string,
): Promise<string> {
  const auth = 'Basic ' + btoa(LOB_API_KEY + ':')
  const body: any = {
    description,
    to:    toAddress,
    from:  FROM_ADDRESS,
    front: frontHtml,
    back:  backHtml,
    size:  '4x6',
    merge_variables: mergeVars,
  }

  const resp = await fetch(`${LOB_BASE}/postcards`, {
    method: 'POST',
    headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Lob postcard failed: ${resp.status} ${err.slice(0, 200)}`)
  }
  const data = await resp.json()
  return data.id  // e.g. "psc_..."
}

// ── Postcard HTML templates (inlined from postcards/ directory) ────────────────
// NOTE: These are read from the edge function bundle. The full HTML lives in
// postcards/neighbor-a-front.html etc. — copy the contents here on deploy.
// For the initial build, placeholders are used; replace with real HTML before going live.
const FRONT_A = Deno.env.get('POSTCARD_FRONT_A') || '<!-- neighbor-a-front.html contents here -->'
const FRONT_B = Deno.env.get('POSTCARD_FRONT_B') || '<!-- neighbor-b-front.html contents here -->'
const BACK    = Deno.env.get('POSTCARD_BACK')    || '<!-- neighbor-back.html contents here -->'

// ── HANDLER ────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const gate = requireServiceRole(req); if (gate) return gate
  if (req.method !== 'POST')   return json(405, { error: 'method not allowed' })

  let body: { contactId?: string } = {}
  try { body = await req.json() } catch { /* ignore */ }

  const contactId = (body.contactId || '').trim()
  if (!contactId) return json(400, { error: 'contactId required' })

  const dryRun = !LOB_API_KEY
  if (dryRun) {
    console.log('[send-neighbor-cards] LOB_API_KEY not set — dry run only')
  }

  const supabase = createClient(
    SUPABASE_URL,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── 1. Look up contact ────────────────────────────────────────────────────
  const { data: contact, error: cErr } = await supabase
    .from('contacts')
    .select('id, name, address, phone, stage')
    .eq('id', contactId)
    .single()

  if (cErr || !contact) return json(404, { error: 'contact not found' })
  if (!contact.address)  return json(400, { error: 'contact has no address — add one first' })

  // Parse address: "123 Main St, Greenville, SC 29601"
  const addrParts = contact.address.split(',').map((s: string) => s.trim())
  const line1  = addrParts[0] || ''
  const city   = addrParts[1] || 'Greenville'
  // "SC 29601" → state + zip
  const stateZip = (addrParts[2] || 'SC 29601').trim().split(/\s+/)
  const state  = stateZip[0] || 'SC'
  const zip    = stateZip[1] || ''

  // Parse street name for merge variable (e.g. "Main St" from "123 Main St")
  const streetNameMatch = line1.match(/^\d+\s+(.+)$/)
  const streetName = streetNameMatch ? streetNameMatch[1] : line1

  // ── 2. Generate + verify neighbor addresses ───────────────────────────────
  const candidates = generateCandidates(line1, city, state, zip)
  if (!candidates.length) {
    return json(400, { error: `Could not parse address: ${contact.address}` })
  }

  let verified: any[] = []
  if (!dryRun) {
    try {
      verified = await verifyAddresses(candidates)
    } catch (e) {
      return json(502, { error: String(e) })
    }
  } else {
    // Dry run: treat first 10 candidates as "verified"
    verified = candidates.slice(0, 10).map((c, i) => ({
      ...c,
      primary_line:       c.address_line1,
      city:               c.city,
      state:              c.state,
      zip_code:           c.zip_code,
      deliverability:     'deliverable',
      components: { zip_code: c.zip_code }
    }))
  }

  // Cap at 10 cards
  const toSend = verified.slice(0, 10)
  if (!toSend.length) {
    return json(200, { sent: 0, skipped: candidates.length, cards: [], dry_run: dryRun })
  }

  // ── 3. Send cards, alternating A/B ───────────────────────────────────────
  const results = []
  let sentCount = 0
  let skipCount = candidates.length - toSend.length

  for (let i = 0; i < toSend.length; i++) {
    const addr      = toSend[i]
    const variation = (i % 2 === 0 ? 'A' : 'B') as 'A' | 'B'
    const scanId    = crypto.randomUUID()
    const qrUrl     = `${TRACK_BASE}?id=${scanId}`

    const recipientLine1 = addr.primary_line || addr.address_line1
    const recipientCity  = addr.city
    const recipientState = addr.state
    const recipientZip   = addr.components?.zip_code || addr.zip_code || zip

    const toAddress = {
      name:          'Current Resident',
      address_line1: recipientLine1,
      address_city:  recipientCity,
      address_state: recipientState,
      address_zip:   recipientZip,
    }

    const mergeVars = {
      qr_scan_url:       qrUrl,
      street_name:       streetName,
      recipient_address: recipientLine1,
      recipient_city:    recipientCity,
      recipient_state:   recipientState,
      recipient_zip:     recipientZip,
    }

    const frontHtml = variation === 'A' ? FRONT_A : FRONT_B

    let lobId: string | null = null

    if (!dryRun) {
      try {
        lobId = await sendPostcard(
          toAddress,
          variation,
          mergeVars,
          frontHtml,
          BACK,
          `BPP Neighbor ${variation} — ${contact.name || contactId} — ${recipientLine1}`,
        )
        sentCount++
      } catch (e) {
        console.error('[send-neighbor-cards] Lob send failed:', e)
        skipCount++
        continue
      }
    } else {
      lobId = `dry_run_${scanId.slice(0, 8)}`
      sentCount++
    }

    // ── 4. Save to DB ─────────────────────────────────────────────────────
    const { error: dbErr } = await supabase.from('neighbor_cards').insert({
      contact_id:      contactId,
      source_address:  contact.address,
      recipient_line1: recipientLine1,
      recipient_city:  recipientCity,
      recipient_state: recipientState,
      recipient_zip:   recipientZip,
      variation,
      lob_id:          lobId,
      scan_id:         scanId,
    })

    if (dbErr) {
      console.error('[send-neighbor-cards] DB insert failed:', dbErr)
    }

    results.push({
      id:        scanId,
      variation,
      address:   `${recipientLine1}, ${recipientCity}, ${recipientState} ${recipientZip}`,
      lob_id:    lobId,
      scan_id:   scanId,
      qr_url:    qrUrl,
      dry_run:   dryRun,
    })
  }

  return json(200, {
    sent:    sentCount,
    skipped: skipCount,
    cards:   results,
    dry_run: dryRun,
    message: dryRun
      ? `Dry run complete (${sentCount} would be sent). Set LOB_API_KEY secret to go live.`
      : `${sentCount} postcards queued with Lob.`,
  })
})
