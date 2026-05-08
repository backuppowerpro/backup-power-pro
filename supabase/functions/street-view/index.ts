/**
 * street-view, fetch + cache a Google Street View image for a contact's
 * install address. Used by personalized email templates so the customer
 * sees their own house at the top of the proposal/install/follow-up email.
 *
 * Flow:
 *   1. Caller POSTs { contact_id }.
 *   2. We pull contacts.install_address (or fallback contacts.address).
 *   3. Geocode via Google Maps Geocoding API.
 *   4. Render Street View Static API URL with the geocoded lat/lng.
 *   5. Fetch the image bytes.
 *   6. Upload to Supabase storage at `street-views/{contact_id}.jpg`.
 *   7. Return signed URL valid 24h, OR public URL if bucket is public.
 *
 * Cache: if street-views/{contact_id}.jpg exists and is < 30 days old,
 *        skip the Google round-trip and return the existing signed URL.
 *        Free Google quota is 28K views/month with $200 credit, so we
 *        want to amortize across all email sends to the same customer.
 *
 * Auth: brain-token only (internal call from send-email edge function).
 *
 * STATUS: scaffold. Activate by:
 *   1. supabase secrets set GOOGLE_MAPS_API_KEY=AIza...
 *      (Same key currently used for the website Maps JS bundle.)
 *   2. Create `street-views` storage bucket via migration-drift-repair
 *      ensure_street_views_bucket action.
 *   3. Wire send-email edge function to call this for personalized
 *      templates.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { timingSafeEqual } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MAPS_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY') || ''
const BPP_BRAIN_TOKEN = Deno.env.get('BPP_BRAIN_TOKEN') || ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-bpp-brain-token',
}
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

const CACHE_DAYS = 30
const SV_WIDTH = 640
const SV_HEIGHT = 320
const SV_FOV = 80   // wide-ish, captures the home + curb context
const SV_PITCH = 0  // level

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!MAPS_KEY) return null
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_KEY}`
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const d = await r.json()
    const loc = d?.results?.[0]?.geometry?.location
    if (loc?.lat && loc?.lng) return { lat: loc.lat, lng: loc.lng }
  } catch (_) { /* fall through */ }
  return null
}

async function fetchStreetView(lat: number, lng: number): Promise<Uint8Array | null> {
  if (!MAPS_KEY) return null
  const url = `https://maps.googleapis.com/maps/api/streetview` +
    `?size=${SV_WIDTH}x${SV_HEIGHT}` +
    `&location=${lat},${lng}` +
    `&fov=${SV_FOV}&pitch=${SV_PITCH}` +
    `&source=outdoor` +  // skip indoor panoramas
    `&key=${MAPS_KEY}`
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const buf = new Uint8Array(await r.arrayBuffer())
    // Google returns a "no imagery" placeholder if no street view is
    // available at this address. Detect by size, the placeholder is
    // typically under 5KB. Real imagery is 30KB+.
    if (buf.length < 5000) return null
    return buf
  } catch (_) { /* fall through */ }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const provided = req.headers.get('x-bpp-brain-token') || ''
  if (!BPP_BRAIN_TOKEN || !timingSafeEqual(provided, BPP_BRAIN_TOKEN)) {
    return json(401, { error: 'unauthorized' })
  }

  let body: { contact_id?: string; address_override?: string } = {}
  try { body = await req.json() } catch { return json(400, { error: 'invalid_json' }) }
  if (!body.contact_id) return json(400, { error: 'contact_id required' })

  const sb = createClient(SUPABASE_URL, SR)

  // Resolve address
  let address = body.address_override || ''
  if (!address) {
    const { data: c } = await sb.from('contacts')
      .select('install_address, address')
      .eq('id', body.contact_id)
      .maybeSingle()
    address = String(c?.install_address || c?.address || '').trim()
  }
  if (!address) return json(404, { error: 'no_install_address_on_file' })

  const path = `${body.contact_id}.jpg`

  // Check cache: list the bucket entry, see if it's recent enough.
  try {
    const headResp = await fetch(
      `${SUPABASE_URL}/storage/v1/object/info/authenticated/street-views/${path}`,
      { headers: { Authorization: `Bearer ${SR}`, apikey: SR } },
    )
    if (headResp.ok) {
      const meta = await headResp.json()
      const ageDays = meta?.updated_at
        ? (Date.now() - new Date(meta.updated_at).getTime()) / (24 * 3600 * 1000)
        : Infinity
      if (ageDays < CACHE_DAYS) {
        // Cached. Sign + return.
        const signResp = await fetch(
          `${SUPABASE_URL}/storage/v1/object/sign/street-views/${path}`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${SR}`, apikey: SR, 'Content-Type': 'application/json' },
            body: JSON.stringify({ expiresIn: 86400 }),
          },
        )
        if (signResp.ok) {
          const sd = await signResp.json()
          return json(200, {
            ok: true,
            cached: true,
            signed_url: `${SUPABASE_URL}/storage/v1${sd.signedURL}`,
            address,
          })
        }
      }
    }
  } catch (_) { /* miss, continue */ }

  if (!MAPS_KEY) {
    return json(503, { error: 'GOOGLE_MAPS_API_KEY not configured' })
  }

  // Geocode + Street View fetch
  const loc = await geocode(address)
  if (!loc) return json(422, { error: 'geocode_failed', address })

  const bytes = await fetchStreetView(loc.lat, loc.lng)
  if (!bytes) return json(422, { error: 'no_street_view_imagery', address, ...loc })

  // Upload to bucket
  const upResp = await fetch(
    `${SUPABASE_URL}/storage/v1/object/street-views/${path}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SR}`,
        apikey: SR,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
      body: bytes,
    },
  )
  if (!upResp.ok) {
    return json(500, {
      error: 'upload_failed',
      detail: (await upResp.text()).slice(0, 200),
    })
  }

  // Sign + return
  const signResp = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/street-views/${path}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${SR}`, apikey: SR, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 86400 }),
    },
  )
  if (!signResp.ok) return json(500, { error: 'sign_failed' })
  const sd = await signResp.json()

  return json(200, {
    ok: true,
    cached: false,
    signed_url: `${SUPABASE_URL}/storage/v1${sd.signedURL}`,
    address,
    location: loc,
  })
})
