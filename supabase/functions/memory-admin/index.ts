/**
 * memory-admin — service-role CRUD surface for the CRM Playbook tab.
 *
 * Key is the only human who should edit /memories/ directly. This
 * endpoint backs the Playbook tab so Key can review what Alex +
 * Sparky + post-mortem wrote, prune bad patterns, and add his own
 * insights from the field.
 *
 * All writes route through the same PII scrubber as the AI writes.
 *
 * GET    /memory-admin              — list all files (path, size, updated_at)
 * GET    /memory-admin?path=<path>  — read one file's content
 * PUT    /memory-admin              — upsert { path, content }
 * DELETE /memory-admin?path=<path>  — remove one file
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceRole, timingSafeEqual } from '../_shared/auth.ts'
import { scrubPiiForMemory } from '../_shared/memory.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info, x-user-token',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  })

// Verify the caller is EITHER the service role (for server-to-server)
// OR a signed-in Supabase user (CRM). The CRM passes the user's
// access_token in the `x-user-token` header (its Authorization header
// is overridden to the publishable key by the invokeFn wrapper).
async function authorize(req: Request, supabase: any): Promise<Response | null> {
  // Path 1 — service role match
  const expected = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const auth = req.headers.get('authorization') || ''
  const apikey = req.headers.get('apikey') || ''
  const bearer = auth.replace(/^Bearer\s+/i, '').trim()
  if (expected && (timingSafeEqual(bearer, expected) || timingSafeEqual(apikey, expected))) return null

  // Path 2 — valid Supabase user session
  const userToken = req.headers.get('x-user-token') || ''
  if (userToken) {
    const { data, error } = await supabase.auth.getUser(userToken)
    if (!error && data?.user) return null
  }
  return json(401, { error: 'unauthorized' })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const gate = await authorize(req, supabase); if (gate) return gate
  const url = new URL(req.url)
  const path = url.searchParams.get('path') || ''

  try {
    if (req.method === 'GET') {
      if (path) {
        if (!path.startsWith('/memories') || path.includes('..')) return json(400, { error: 'bad path' })
        const { data } = await supabase.from('alex_memory_files').select('path, content, updated_at, size_bytes').eq('path', path).maybeSingle()
        if (!data) return json(404, { error: 'not found' })
        return json(200, data)
      }
      const { data } = await supabase.from('alex_memory_files').select('path, size_bytes, updated_at').order('path', { ascending: true })
      return json(200, { files: data || [] })
    }

    if (req.method === 'PUT') {
      let body: any = {}
      try { body = await req.json() } catch { return json(400, { error: 'bad json' }) }
      const p = (body?.path || '').toString()
      const raw = (body?.content || '').toString()
      if (!p.startsWith('/memories') || p.includes('..')) return json(400, { error: 'bad path' })
      if (raw.length > 200_000) return json(413, { error: 'file too large (cap 200KB)' })
      // Apply the SAME PII scrubber the AI writes go through so Key can't
      // accidentally paste a customer phone into a memory file.
      const content = scrubPiiForMemory(raw)
      await supabase.from('alex_memory_files').upsert({ path: p, content, updated_at: new Date().toISOString() })
      return json(200, { success: true, path: p, scrubbed: content !== raw })
    }

    if (req.method === 'DELETE') {
      if (!path.startsWith('/memories') || path.includes('..')) return json(400, { error: 'bad path' })
      // Hard-block deletion of the seed about/layout files so Key can't
      // accidentally nuke Alex's directory structure.
      const SEED_LOCKED = new Set([
        '/memories/postmortem/about.md',
        '/memories/sparky/about.md',
      ])
      if (SEED_LOCKED.has(path)) return json(400, { error: 'locked seed file' })
      const { error } = await supabase.from('alex_memory_files').delete().eq('path', path)
      if (error) return json(500, { error: error.message })
      return json(200, { success: true, deleted: path })
    }

    return json(405, { error: 'method not allowed' })
  } catch (e) {
    return json(500, { error: String(e).slice(0, 300) })
  }
})
