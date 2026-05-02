// gbp-review-monitor
//
// Daily cron pulls the BPP Google Business Profile's 5 most-recent
// reviews via the Google Places Details API, diffs against the
// `gbp_reviews` table, and SMSes Key on each new one.
//
// Why Places API and not Business Profile API?
//   - Places API is a single API key (no OAuth flow / refresh tokens).
//   - It returns up to 5 most recent reviews per place — plenty for a
//     "did anyone leave a review since yesterday?" check.
//   - Business Profile API requires OAuth + ownership verification,
//     which is a manual setup step we can swap to later if we want
//     more than 5 reviews back.
//
// Required Supabase secrets:
//   - GBP_PLACE_ID         (BPP's Google Maps place_id)
//   - GBP_API_KEY          (server-side Places API key — separate from
//                          the referrer-restricted browser key)
//
// Auth: requireServiceRole. Triggered by pg_cron daily.

import { requireServiceRole } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GBP_PLACE_ID = Deno.env.get('GBP_PLACE_ID') || ''
const GBP_API_KEY = Deno.env.get('GBP_API_KEY') || ''
const ALERT_NUMBER = Deno.env.get('KEY_PHONE_NUMBER') || '+18648637800'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

async function dbFetch(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
}

interface PlacesReview {
  author_name: string
  author_url?: string
  profile_photo_url?: string
  rating: number
  relative_time_description: string
  text: string
  time: number  // unix seconds
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const gate = requireServiceRole(req)
  if (gate) return gate

  if (!GBP_PLACE_ID || !GBP_API_KEY) {
    return json({
      error: 'config missing',
      hint: 'Set GBP_PLACE_ID and GBP_API_KEY supabase secrets. PLACE_ID is the BPP Google Maps place identifier; API_KEY should be a server-side (no-referrer) Places API key.',
    }, 503)
  }

  // ── Fetch latest reviews from Google Places ─────────────────────
  const placeUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(GBP_PLACE_ID)}&fields=reviews,rating,user_ratings_total&reviews_sort=newest&key=${GBP_API_KEY}`
  let reviews: PlacesReview[] = []
  let totalReviews = 0
  let avgRating = 0
  try {
    const resp = await fetch(placeUrl)
    if (!resp.ok) {
      const t = await resp.text()
      return json({ error: `places api ${resp.status}: ${t.slice(0, 200)}` }, 500)
    }
    const data = await resp.json()
    if (data.status !== 'OK') {
      return json({ error: `places api status: ${data.status}`, message: data.error_message }, 500)
    }
    reviews = (data.result?.reviews || []) as PlacesReview[]
    totalReviews = data.result?.user_ratings_total || 0
    avgRating = data.result?.rating || 0
  } catch (e) {
    return json({ error: `fetch failed: ${(e as Error).message}` }, 500)
  }

  // ── Diff against stored reviews ─────────────────────────────────
  // Identity: (author_name + time). Two people leaving on the same
  // second is essentially impossible; this avoids needing a stable
  // review_id (Places doesn't return one).
  const existingRes = await dbFetch(
    `/gbp_reviews?select=author_name,review_time&limit=200`
  )
  const existing = existingRes.ok
    ? (await existingRes.json() as { author_name: string; review_time: number }[])
    : []
  const seen = new Set(existing.map(r => `${r.author_name}|${r.review_time}`))

  const fresh = reviews.filter(r => !seen.has(`${r.author_name}|${r.time}`))

  // ── Insert new reviews + alert ──────────────────────────────────
  const inserts: any[] = []
  for (const r of fresh) {
    inserts.push({
      author_name: r.author_name,
      author_url: r.author_url || null,
      profile_photo_url: r.profile_photo_url || null,
      rating: r.rating,
      relative_time: r.relative_time_description,
      text: r.text,
      review_time: r.time,
      created_at: new Date().toISOString(),
    })
  }
  if (inserts.length > 0) {
    const ins = await dbFetch('/gbp_reviews', {
      method: 'POST',
      body: JSON.stringify(inserts),
      headers: { 'Prefer': 'return=minimal' },
    })
    if (!ins.ok) {
      const t = await ins.text()
      return json({ error: `db insert failed: ${t.slice(0, 200)}` }, 500)
    }
  }

  // ── SMS alert per new review ────────────────────────────────────
  // F8 — author_name + text are attacker-controlled (anyone can leave a
  // Google review). Sanitise both before they:
  //   1. Get interpolated into the SMS body (carrier-side delivery)
  //   2. Become part of the idempotency key (could break send-sms's
  //      rate-limit / dedup keying with colon-laden inputs)
  //   3. Get rendered in the CRM's gbp_reviews view (XSS surface, even
  //      though the renderer escapes today)
  const smsRequests: Promise<unknown>[] = []
  for (const r of fresh) {
    const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)
    const safeAuthor = (r.author_name || 'Reviewer').replace(/[^A-Za-z0-9 .'-]/g, '').slice(0, 40).trim() || 'Reviewer'
    const safeText = (r.text || '').replace(/[^\w\s.,!?'"\-—]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120)
    const truncated = (r.text || '').length > 120
    const body = `${stars} review from ${safeAuthor}${safeText ? `: "${safeText}${truncated ? '…' : ''}"` : ''} — reply on GBP for rank lift.`
    // Idempotency key uses time (unique per second) + sanitised author —
    // colons / special chars stripped so they can't poison the rate-limit
    // hash key inside send-sms.
    const idemAuthor = safeAuthor.replace(/\s+/g, '_')
    smsRequests.push(
      fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: ALERT_NUMBER,
          body,
          idempotencyKey: `gbp-review-${r.time}-${idemAuthor}`,
          internal: true,
        }),
      }).catch(() => null)
    )
  }
  await Promise.allSettled(smsRequests)

  return json({
    ok: true,
    total_reviews_on_gbp: totalReviews,
    avg_rating: avgRating,
    fetched: reviews.length,
    new: fresh.length,
    new_reviews: fresh.map(r => ({ author: r.author_name, rating: r.rating, when: r.relative_time_description })),
  })
})
