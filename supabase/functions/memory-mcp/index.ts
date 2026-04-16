/**
 * memory-mcp
 *
 * MCP server for BPP agents (Alex, Sparky) — hosted on Supabase, always online.
 * Implements MCP Streamable HTTP transport (JSON-RPC 2.0, spec 2024-11-05).
 *
 * Add to agent environments in Anthropic console:
 *   URL: https://reowtzedjflwmlptupbk.supabase.co/functions/v1/memory-mcp
 *   Header: Authorization: Bearer <service_role_key>
 *
 * Tools exposed:
 *   get_contact      — look up a CRM contact by phone
 *   read_memory      — read a memory entry by key
 *   write_memory     — write / update a memory entry
 *   search_memory    — find entries by key prefix
 *   list_recent_leads — recent contacts + their stage
 *
 * Memory key conventions:
 *   contact:<phone>:notes        — notes about a specific lead
 *   contact:<phone>:objections   — objections they raised
 *   global:patterns:<topic>      — cross-lead patterns Alex observes
 *   global:pricing:<topic>       — pricing / objection intelligence
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SVC_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, mcp-session-id',
}

// ── Tool schema definitions ───────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'get_contact',
    description:
      'Look up a BPP CRM contact by phone number. Returns name, stage, address, install notes, and timestamps. Call this at the start of any lead conversation so you know their history.',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Phone in E.164 format or any digit string' },
      },
      required: ['phone'],
    },
  },
  {
    name: 'read_memory',
    description:
      'Read a stored memory entry by exact key. Keys are namespaced — e.g. "contact:+19414417996:notes" or "global:patterns:price_shoppers".',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Exact memory key to retrieve' },
      },
      required: ['key'],
    },
  },
  {
    name: 'write_memory',
    description:
      'Write or update a memory entry. Use this to persist important facts you learn during a conversation — lead preferences, objections raised, commitments made, patterns you notice across leads.',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description:
            'Memory key. Convention: "contact:<phone>:<topic>" for lead-specific, "global:<category>:<topic>" for cross-lead patterns.',
        },
        value: { type: 'string', description: 'Value to store. Plain text or JSON string.' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'search_memory',
    description:
      'Search stored memories by key prefix. Useful for pulling all notes on a contact or all entries under a topic.',
    inputSchema: {
      type: 'object',
      properties: {
        prefix: {
          type: 'string',
          description: 'Key prefix to search — e.g. "contact:+19414417996" or "global:patterns"',
        },
      },
      required: ['prefix'],
    },
  },
  {
    name: 'list_recent_leads',
    description:
      'List recent CRM contacts with their stage and address. Useful for business context or when you want to see active pipeline.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Max contacts to return (default 10, max 25)',
        },
      },
      required: [],
    },
  },
]

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  // GET /  — health check so the console can verify the URL
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ ok: true, server: 'bpp-memory-mcp', version: '1.0.0' }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return jsonRpcError(null, -32700, 'Parse error')
  }

  // Handle batch or single request
  const isBatch = Array.isArray(body)
  const requests: any[] = isBatch ? body : [body]

  const responses = await Promise.all(
    requests.map((r) => handleRpc(r)),
  )
  // Filter out null (notifications have no response)
  const results = responses.filter((r) => r !== null)

  const payload = isBatch ? results : results[0] ?? null
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})

// ── JSON-RPC dispatcher ───────────────────────────────────────────────────────

async function handleRpc(req: any): Promise<any> {
  const { jsonrpc, id, method, params } = req ?? {}

  if (jsonrpc !== '2.0') {
    return { jsonrpc: '2.0', id: id ?? null, error: { code: -32600, message: 'Invalid Request' } }
  }

  // Notifications (no id) — acknowledge with no response
  if (id === undefined) return null

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'bpp-memory', version: '1.0.0' },
          },
        }

      case 'tools/list':
        return { jsonrpc: '2.0', id, result: { tools: TOOLS } }

      case 'tools/call': {
        const toolResult = await callTool(params?.name, params?.arguments ?? {})
        return { jsonrpc: '2.0', id, result: toolResult }
      }

      case 'ping':
        return { jsonrpc: '2.0', id, result: {} }

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        }
    }
  } catch (err) {
    console.error('[memory-mcp] Unhandled error:', err)
    return { jsonrpc: '2.0', id, error: { code: -32603, message: String(err) } }
  }
}

// ── Tool implementations ──────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, any>): Promise<any> {
  const db = createClient(SUPABASE_URL, SUPABASE_SVC_KEY)

  switch (name) {
    case 'get_contact': {
      const digits = String(args.phone ?? '').replace(/\D/g, '').slice(-10)
      const { data, error } = await db
        .from('contacts')
        .select('id, name, phone, address, stage, install_notes, created_at, updated_at')
        .ilike('phone', `%${digits}`)
        .limit(1)
        .maybeSingle()

      if (error) throw new Error(error.message)
      if (!data) return text(`No contact found matching ${args.phone}`)

      // Also pull any stored memory for this contact
      const phone = data.phone || args.phone
      const { data: mems } = await db
        .from('sparky_memory')
        .select('key, value')
        .like('key', `contact:${phone}:%`)
        .order('key')

      const memSection = mems?.length
        ? '\n\nStored memory:\n' + mems.map((m: any) => `  ${m.key}: ${m.value}`).join('\n')
        : ''

      return text(JSON.stringify(data, null, 2) + memSection)
    }

    case 'read_memory': {
      const { data, error } = await db
        .from('sparky_memory')
        .select('value, updated_at')
        .eq('key', args.key)
        .maybeSingle()

      if (error) throw new Error(error.message)
      if (!data) return text(`No memory found for key: ${args.key}`)
      return text(`[${args.key}] (updated ${data.updated_at?.split('T')[0] ?? 'unknown'})\n${data.value}`)
    }

    case 'write_memory': {
      const { error } = await db
        .from('sparky_memory')
        .upsert(
          { key: args.key, value: String(args.value) },
          { onConflict: 'key' },
        )

      if (error) throw new Error(error.message)
      return text(`Saved: ${args.key}`)
    }

    case 'search_memory': {
      const { data, error } = await db
        .from('sparky_memory')
        .select('key, value, updated_at')
        .like('key', `${args.prefix}%`)
        .order('updated_at', { ascending: false })
        .limit(25)

      if (error) throw new Error(error.message)
      if (!data?.length) return text(`No memories found with prefix: ${args.prefix}`)

      const lines = data.map((d: any) => `[${d.key}]\n${d.value}`).join('\n\n---\n\n')
      return text(`Found ${data.length} entries:\n\n${lines}`)
    }

    case 'list_recent_leads': {
      const limit = Math.min(Number(args.limit) || 10, 25)
      const { data, error } = await db
        .from('contacts')
        .select('name, phone, stage, address, updated_at')
        .order('updated_at', { ascending: false })
        .limit(limit)

      if (error) throw new Error(error.message)
      if (!data?.length) return text('No contacts found')

      const lines = data.map((d: any) => {
        const updated = d.updated_at?.split('T')[0] ?? '?'
        return `${d.name || 'Unknown'} | ${d.phone} | Stage: ${d.stage} | ${d.address || 'no address'} | updated ${updated}`
      }).join('\n')

      return text(`${data.length} recent contacts:\n\n${lines}`)
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function text(content: string) {
  return { content: [{ type: 'text', text: content }] }
}

function jsonRpcError(id: any, code: number, message: string) {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
}
