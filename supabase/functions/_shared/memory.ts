/**
 * Shared memory tool (Anthropic memory_20250818) backend.
 *
 * All BPP AI surfaces — Alex (customer-facing), Sparky (Key-facing),
 * alex-postmortem (reflective), future AI fns — use this same handler
 * so the `/memories/` filesystem is ONE pool they all read and write.
 *
 * Layout convention (enforced by `allowWrite`):
 *   /memories/shared/*        — business facts + rules any AI can use
 *   /memories/alex/*          — customer-facing Alex learnings
 *   /memories/sparky/*        — Key-facing Sparky learnings
 *   /memories/postmortem/*    — outcome-tied reflection notes
 *   /memories/contacts/*      — RESERVED for future per-contact memory
 *                               (currently disabled — use sparky_memory)
 *
 * All writes pass through scrubPiiForMemory() which strips phones, emails,
 * addresses, prices, and likely-PII name patterns. PII belongs in
 * sparky_memory (scoped by phone). /memories/ is for anonymized patterns.
 */

export function scrubPiiForMemory(text: string): string {
  let out = String(text || '')
  // E.164 compact (+1XXXXXXXXXX) first — no boundary breaks between digits
  out = out.replace(/\+1\d{10}/g, '[phone]')
  // Phone numbers — any format: 10-digit US, parens/dashes/dots/spaces,
  // with optional leading 1 or (1) prefix.
  out = out.replace(/(?:\b1[\s().-]+)?\(?\d{3}\)?[\s().-]{0,2}\d{3}[\s().-]{0,2}\d{4}\b/g, '[phone]')
  // Dollar amounts with optional thousands separators (catches $1,497)
  out = out.replace(/\$\s?\d{1,3}(?:,\d{3})+(?:\.\d{2})?/g, '[price]')
  // Email
  out = out.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
  // Dollar amounts $100+
  out = out.replace(/\$\s?\d{3,}(?:,\d{3})*(?:\.\d{2})?/g, '[price]')
  // US street addresses (1+ number, then 1-5 capitalized words, then street suffix)
  out = out.replace(/\b\d{1,6}\s+(?:[A-Z][a-z]+\s?){1,5}(?:St|Street|Rd|Road|Ave|Avenue|Blvd|Dr|Drive|Ln|Lane|Trl|Trail|Way|Ct|Court|Pl|Place|Pkwy|Parkway|Cir|Circle|Hwy|Highway)\b\.?/g, '[address]')
  // ALL-CAPS adjacent pairs (likely proper names from CRM / signing ceremonies)
  out = out.replace(/\b[A-Z]{2,}\s+[A-Z]{2,}\b/g, '[name]')
  // Full-name pattern — two adjacent Capitalized words of likely-name shape,
  // AFTER stripping common sentence-starting words and well-known phrases.
  // This catches most "Jane Doe"-style names without destroying legit phrases
  // like "Backup Power" or "Generator Brand". Allow-list the tokens we know
  // are safe to preserve.
  const NAME_SAFELIST = new Set([
    // Brand + product names
    'Backup','Power','Pro','Generac','Honda','Kohler','Champion','Predator','Westinghouse','Briggs','Stratton','DeWalt','Craftsman','Firman','Duromax','Wen',
    // Panel brands
    'Square','Eaton','Siemens','Leviton','Murray','General','Electric','Cutler','Hammer','Challenger','Federal','Pacific',
    // Geography (counties, cities)
    'Greenville','Spartanburg','Pickens','Mauldin','Simpsonville','Greer','Fountain','Inn','Upstate','South','Carolina','North',
    // Permit terminology
    'Residential','Electrical','Standalone','Permit','Key','Electric','LLC',
    // Common connectors
    'When','This','That','They','There','Their','Then','What','Which','Where','Who','Why','How','After','Before','During','From','With','Within','Without','The','And','But','Or','So','If','Unless','Until','While',
    // AI / system terms
    'Alex','Sparky','Key','Claude','Anthropic','OpenPhone','Twilio','Stripe','Supabase','Postgres',
    // Months / days
    'January','February','March','April','May','June','July','August','September','October','November','December','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday',
    // Technical
    'NEMA','L14','AEC','eTRAKiT','CivicPlus','InfoVision','Citizenserve','TCPA','ESIGN',
  ])
  out = out.replace(/\b([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})\b/g, (match, first, last) => {
    if (NAME_SAFELIST.has(first) || NAME_SAFELIST.has(last)) return match
    return '[name]'
  })
  return out
}

// Which path prefixes is this AI surface allowed to write to?
// Reads are always permitted (any AI can read any /memories/ file).
const WRITE_WHITELIST: Record<string, RegExp[]> = {
  alex:       [/^\/memories\/(alex|shared)\//, /^\/memories\/alex\/[^/]+\.md$/],
  sparky:     [/^\/memories\/(sparky|shared)\//, /^\/memories\/sparky\/[^/]+\.md$/],
  postmortem: [/^\/memories\/(postmortem|shared|alex)\//],
  // When we add more AI surfaces, add their write-scopes here.
}

export function allowWrite(caller: string, path: string): boolean {
  const rules = WRITE_WHITELIST[caller]
  if (!rules) return false
  return rules.some((rx) => rx.test(path))
}

export async function handleMemoryTool(
  supabase: any,
  input: any,
  caller: string = 'alex',
): Promise<string> {
  const cmd = (input?.command || '').toString()
  const path = (input?.path || '').toString()

  // Hard-scope every op inside /memories/* and reject traversal.
  if (!path.startsWith('/memories')) return `Error: path must start with /memories (got ${path})`
  if (path.includes('..')) return 'Error: path traversal not allowed'

  // Write-guard: reject writes outside the caller's whitelist.
  const isWrite = ['create', 'str_replace', 'insert', 'delete', 'rename'].includes(cmd)
  if (isWrite && !allowWrite(caller, path)) {
    return `Error: ${caller} is not allowed to write to ${path}`
  }

  try {
    if (cmd === 'view') {
      // Directory view: prefix ends with / OR matches a known dir.
      const isDir = path === '/memories' || path === '/memories/' || path.endsWith('/')
      if (isDir) {
        const prefix = path.endsWith('/') ? path : path + '/'
        const { data } = await supabase
          .from('alex_memory_files')
          .select('path, size_bytes, updated_at')
          .like('path', `${prefix}%`)
          .order('path', { ascending: true })
        const lines = (data || []).map((r: any) => `${r.path} (${r.size_bytes} bytes, updated ${r.updated_at})`).join('\n')
        return lines ? `Contents of ${path}:\n${lines}` : `${path} is empty`
      }
      const { data } = await supabase.from('alex_memory_files').select('content').eq('path', path).maybeSingle()
      if (!data) return `Path ${path} does not exist`
      return `Here's the content of ${path}:\n${data.content}`
    }

    if (cmd === 'create') {
      const content = scrubPiiForMemory(input?.file_text || '')
      await supabase.from('alex_memory_files').upsert({ path, content, updated_at: new Date().toISOString() })
      return `File created successfully at: ${path}`
    }

    if (cmd === 'str_replace') {
      const { data } = await supabase.from('alex_memory_files').select('content').eq('path', path).maybeSingle()
      if (!data) return `Error: The path ${path} does not exist`
      const oldStr = (input?.old_str || '').toString()
      const newStr = scrubPiiForMemory((input?.new_str || '').toString())
      if (!data.content.includes(oldStr)) return `No replacement found for old_str`
      const updated = data.content.replace(oldStr, newStr)
      await supabase.from('alex_memory_files').update({ content: updated, updated_at: new Date().toISOString() }).eq('path', path)
      return 'The memory file has been edited.'
    }

    if (cmd === 'insert') {
      const { data } = await supabase.from('alex_memory_files').select('content').eq('path', path).maybeSingle()
      if (!data) return `Error: The path ${path} does not exist`
      const insertLine = Math.max(0, Number(input?.insert_line) || 0)
      const insertText = scrubPiiForMemory((input?.insert_text || '').toString())
      const lines = data.content.split('\n')
      lines.splice(insertLine, 0, insertText)
      const updated = lines.join('\n')
      await supabase.from('alex_memory_files').update({ content: updated, updated_at: new Date().toISOString() }).eq('path', path)
      return 'Inserted.'
    }

    if (cmd === 'delete') {
      const { error } = await supabase.from('alex_memory_files').delete().eq('path', path)
      if (error) return `Error: ${error.message}`
      return `Deleted ${path}`
    }

    if (cmd === 'rename') {
      const newPath = (input?.new_path || '').toString()
      if (!newPath.startsWith('/memories')) return 'Error: new_path must start with /memories'
      if (!allowWrite(caller, newPath)) return `Error: ${caller} is not allowed to write to ${newPath}`
      const { data } = await supabase.from('alex_memory_files').select('content').eq('path', path).maybeSingle()
      if (!data) return `Error: source ${path} does not exist`
      await supabase.from('alex_memory_files').insert({ path: newPath, content: data.content })
      await supabase.from('alex_memory_files').delete().eq('path', path)
      return `Renamed ${path} to ${newPath}`
    }

    return `Error: unknown command ${cmd}`
  } catch (e) {
    console.error('[memory] handler error:', e)
    return `Error: ${String(e).slice(0, 200)}`
  }
}

// Tool definition used by Messages API callers.
export const MEMORY_TOOL_DEF = { type: 'memory_20250818', name: 'memory' }
