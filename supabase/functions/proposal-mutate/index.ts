/**
 * proposal-mutate — all customer-facing write paths on a proposal, token-gated.
 *
 * Replaces three previous anon-key `.update()` calls in proposal.html:
 *   - track_view    (on-load view-count bump)
 *   - save_selections (debounced amp + POM toggles)
 *   - sign          (final approve with signer_name + terms snapshot)
 *
 * Each action uses a strict field whitelist so a compromised caller
 * can only touch approved columns — no flipping `status=Paid`, no
 * nuking `price_base`, no forging `total`. The token is the only
 * gatekeeper; it lives in the URL of the email/SMS Key sent to the
 * real customer, so anyone with the link can take these actions (same
 * trust model as the prior design — but without giving them full
 * anon CRUD on the table).
 *
 * POST /proposal-mutate
 * Body: {
 *   token: string,
 *   action: 'track_view' | 'save_selections' | 'sign',
 *   ...action-specific fields
 * }
 *
 * Security notes:
 *   - Rejects unknown actions
 *   - Rejects unknown fields per action (extra keys silently dropped)
 *   - Rejects if proposal is Approved / Cancelled for destructive actions
 *   - Records the caller's real IP (X-Forwarded-For) for `sign` so the
 *     legal signing record is authoritative (vs. the old client-side
 *     ipify fetch which was trivially spoofable)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { allowRate } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const jsonResp = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  })

function clientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return jsonResp({ error: 'POST only' }, 405)

  let body: any
  try { body = await req.json() } catch { return jsonResp({ error: 'bad json' }, 400) }

  // Rate-limit per IP to defeat token-grinding / DoS. 60/min is generous
  // for a real customer (track_view + save_selections + sign × 3 retries).
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip') || 'unknown'
  if (!allowRate(`proposal-mutate:${ip}`, 60)) return jsonResp({ error: 'rate limited' }, 429)

  const token = (body?.token || '').toString()
  const action = (body?.action || '').toString()
  // Tokens are UUIDs — hex + dashes only. Reject anything else before DB.
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(token)) return jsonResp({ error: 'missing token' }, 400)
  if (!['track_view', 'save_selections', 'sign'].includes(action)) {
    return jsonResp({ error: 'unknown action' }, 400)
  }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Look up first so we can (a) verify the token exists and (b) apply
  // guard rails based on current status (signed proposals shouldn't be
  // mutated except by the CRM).
  const { data: existing, error: lookupErr } = await sb
    .from('proposals')
    .select('id, token, status, view_count')
    .eq('token', token)
    .maybeSingle()
  if (lookupErr || !existing) return jsonResp({ error: 'not found' }, 404)

  const status = (existing.status || '').toLowerCase()
  const alreadyFinal = status === 'approved' || status === 'cancelled' || status === 'declined'

  try {
    if (action === 'track_view') {
      // Whitelist: no fields needed from body. Just bump view_count +
      // viewed_at and nudge status Draft → Viewed.
      const patch: Record<string, unknown> = {
        viewed_at: new Date().toISOString(),
        view_count: (existing.view_count || 0) + 1,
      }
      if (status === 'draft') patch.status = 'Viewed'
      const { error } = await sb.from('proposals').update(patch).eq('id', existing.id)
      if (error) return jsonResp({ error: error.message }, 500)
      return jsonResp({ ok: true })
    }

    if (action === 'save_selections') {
      if (alreadyFinal) return jsonResp({ error: 'proposal finalized' }, 409)
      // Whitelist — only the customer-facing toggles.
      const allowed = ['selected_amp', 'selected_surge', 'selected_pom']
      const patch: Record<string, unknown> = {}
      for (const k of allowed) {
        if (k in body) patch[k] = body[k]
      }
      if (Object.keys(patch).length === 0) return jsonResp({ error: 'no fields' }, 400)
      // Coerce selected_amp to 30/50 only
      if ('selected_amp' in patch) {
        const v = String(patch.selected_amp)
        if (v !== '30' && v !== '50') return jsonResp({ error: 'bad amp' }, 400)
      }
      // Booleans only
      for (const k of ['selected_surge', 'selected_pom']) {
        if (k in patch && typeof patch[k] !== 'boolean') {
          return jsonResp({ error: `${k} must be boolean` }, 400)
        }
      }
      const { error } = await sb.from('proposals').update(patch).eq('id', existing.id)
      if (error) return jsonResp({ error: error.message }, 500)
      return jsonResp({ ok: true })
    }

    if (action === 'sign') {
      if (alreadyFinal) return jsonResp({ error: 'already finalized' }, 409)
      const name = (body.signer_name || '').toString().trim()
      if (name.length < 2 || name.length > 120) return jsonResp({ error: 'bad signer_name' }, 400)
      const termsSnapshot = (body.approved_terms_snapshot || '').toString()
      if (termsSnapshot.length > 20000) return jsonResp({ error: 'terms too long' }, 400)
      const selected_amp = String(body.selected_amp || '')
      if (selected_amp !== '30' && selected_amp !== '50') return jsonResp({ error: 'bad amp' }, 400)
      const selected_surge = typeof body.selected_surge === 'boolean' ? body.selected_surge : false
      const selected_pom   = typeof body.selected_pom === 'boolean' ? body.selected_pom : false
      const safety_ack     = typeof body.safety_ack === 'boolean' ? body.safety_ack : false
      if (!safety_ack) return jsonResp({ error: 'safety ack required' }, 400)

      const ip = clientIp(req)
      const ua = req.headers.get('user-agent') || ''

      const patch = {
        status: 'Approved',
        signed_at: new Date().toISOString(),
        signer_name: name,
        safety_ack: true,
        selected_amp,
        selected_surge,
        selected_pom,
        is_locked: true,
        approved_ip: ip,
        approved_user_agent: ua.slice(0, 1024),
        approved_terms_snapshot: termsSnapshot,
      }
      const { error } = await sb.from('proposals').update(patch).eq('id', existing.id)
      if (error) return jsonResp({ error: error.message }, 500)
      return jsonResp({ ok: true })
    }

    return jsonResp({ error: 'unreachable' }, 500)
  } catch (e) {
    return jsonResp({ error: 'server error' }, 500)
  }
})
