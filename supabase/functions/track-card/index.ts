/**
 * track-card
 *
 * QR code landing handler for BPP neighbor postcards.
 * Records the scan and redirects to backuppowerpro.com.
 *
 * GET /track-card?id=SCAN_ID
 *
 * - Increments scan_count on neighbor_cards row
 * - Sets scanned_at on first scan
 * - Returns 302 → backuppowerpro.com
 *
 * No auth required — this is hit by anyone who scans the postcard QR code.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { allowRate } from '../_shared/auth.ts'

const REDIRECT_URL = 'https://backuppowerpro.com'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  const url    = new URL(req.url)
  const scanId = url.searchParams.get('id') || ''

  if (!scanId) {
    // No ID — still redirect, just don't log
    return Response.redirect(REDIRECT_URL, 302)
  }

  // Reject malformed scan IDs before touching the DB. Postcards generate
  // base64-url style IDs; cap length and charset to defeat injection
  // attempts that would otherwise hit `.eq('scan_id', …)` with garbage.
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(scanId)) {
    return Response.redirect(REDIRECT_URL, 302)
  }

  // Two-tier rate limit: per IP (a single attacker) and per scan_id
  // (one card hammered from a botnet). Either trip skips the DB write
  // but still serves the redirect — postcard UX is preserved.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip') || 'unknown'
  const ipOk = allowRate(`track-card:ip:${ip}`, 60)
  const idOk = allowRate(`track-card:id:${scanId}`, 5)
  if (!ipOk || !idOk) {
    return Response.redirect(REDIRECT_URL + '?ref=postcard', 302)
  }

  // Update in background (don't block the redirect)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Fire-and-forget: increment scan count + set first-scan timestamp
  EdgeRuntime.waitUntil(
    (async () => {
      const { data: card } = await supabase
        .from('neighbor_cards')
        .select('id, scanned_at, scan_count')
        .eq('scan_id', scanId)
        .single()

      if (!card) return

      const updates: any = { scan_count: (card.scan_count || 0) + 1 }
      if (!card.scanned_at) updates.scanned_at = new Date().toISOString()

      await supabase
        .from('neighbor_cards')
        .update(updates)
        .eq('scan_id', scanId)
    })()
  )

  // Immediate redirect — user doesn't wait for DB write
  return Response.redirect(REDIRECT_URL + '?ref=postcard', 302)
})
