/**
 * proposal-context — renders a safe-to-display profile context for a
 * proposal page. Called by proposal.html?token=... on load so the page
 * can pick between hand-written copy variants based on what we know
 * about the lead (amp size, panel location, urgency/skepticism signals,
 * mentioned concerns).
 *
 * CRITICAL: the returned payload NEVER includes free-text profile
 * values (pain_point quotes, motivation notes, labels, etc.). Only
 * booleans and already-structured values that are safe to render or
 * to use as branching flags. Any free-text the customer or Alex typed
 * stays server-side.
 *
 * Request:  GET /proposal-context?token=<proposal_token>
 * Response: { firstName, addressLine, ampSize, panelLocation,
 *             urgencyFlag, skepticismFlag, mentionedFridge,
 *             mentionedWellPump, mentionedCords, storedGenerator }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const url = new URL(req.url)
  const token = url.searchParams.get('token') || ''
  if (!token) {
    return new Response(JSON.stringify({ error: 'missing token' }), { status: 400, headers: CORS })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Look up proposal → contact (phone, name, address) → profile memory
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, contact_id, contact_name, selected_amp, include_surge, include_permit')
    .eq('token', token)
    .maybeSingle()
  if (!proposal) {
    return new Response(JSON.stringify({ error: 'proposal not found' }), { status: 404, headers: CORS })
  }

  const { data: contact } = proposal.contact_id
    ? await supabase.from('contacts').select('name, phone, address, install_notes').eq('id', proposal.contact_id).maybeSingle()
    : { data: null }

  // Load all profile memory rows for this contact's phone
  const phone = contact?.phone || ''
  let memory: Array<{ key: string; value: string; category: string | null }> = []
  if (phone) {
    const { data: memRows } = await supabase
      .from('sparky_memory')
      .select('key, value, category')
      .like('key', `contact:${phone}:%`)
      .limit(100)
    memory = memRows || []
  }
  const kv: Record<string, string> = {}
  for (const m of memory) {
    const field = m.key.split(':').slice(2).join(':')
    kv[field] = (m.value || '').toString()
  }

  // ── Derive rendering flags. All logic is defensive — we inspect
  // values for keyword hits but never surface the free text itself.
  const lower = (v: string) => (v || '').toLowerCase()
  const pain = lower(kv.pain_point || '')
  const state = lower(kv.current_state || '')
  const motivation = lower(kv.motivation || '')
  const allText = `${pain} ${state} ${motivation}`

  const firstName = (contact?.name || proposal.contact_name || '').split(' ')[0] || ''
  // Address: first line only ("42 Oakmont Trail, Greenville SC 29601" → "42 Oakmont Trail")
  const addressLine = (contact?.address || '').split(',')[0].trim()

  // Amp size — prefer proposal's own selected_amp; fall back to what
  // the form captured in generator_voltage / current_state.
  let ampSize: '30' | '50' | null = null
  if (proposal.selected_amp) ampSize = String(proposal.selected_amp) === '50' ? '50' : '30'
  else if (/50\s?a|50\s?amp|l14-?50|14-?50/.test(allText)) ampSize = '50'
  else if (/30\s?a|30\s?amp|l14-?30/.test(allText)) ampSize = '30'

  // Panel location — "inside" / "outside" only. Anything else → null.
  const panelLocRaw = lower(kv.panel_location || '')
  let panelLocation: 'inside' | 'outside' | null = null
  if (/\boutside\b|\bexterior\b|\bgarage.*(wall|outside)/.test(panelLocRaw)) panelLocation = 'outside'
  else if (/\binside\b|\binterior\b|\bbasement\b|\bcloset\b|\bhall/.test(panelLocRaw)) panelLocation = 'inside'

  // Urgency flag — motivation mentions storm/hurricane/outage-imminent, OR
  // customer has indicated urgent timing.
  const urgencyFlag = /storm|hurricane|tornado|imminent|tonight|tomorrow|this week|urgent|asap/.test(allText)

  // Skepticism flag — customer asked permit/licensing/DIY/credential questions.
  const skepticismFlag = /\bpermit\b|\blicense\b|\bnec\b|\bcode\b|\bdiy\b|\bmyself\b|\bhandyman\b/.test(allText)

  // Concern flags — did specific worries come up during discovery?
  // These only control which add-ons default to checked, never rendered as text.
  const mentionedFridge = /fridge|freezer|food|grocer|spoil/.test(allText)
  const mentionedWellPump = /well pump|well.?water|pump/.test(allText)
  const mentionedCords = /cord|extension|cable.*window/.test(allText)

  // Stored generator flag — does the customer already own one?
  const storedGenerator = /\b(honda|generac|champion|predator|westing|dewalt|craftsman|firman|duromax|wen|kohler)\b/.test(allText) || /\b\d+\s?(?:k?w|kw|watt)\b/.test(allText)

  return new Response(JSON.stringify({
    firstName: firstName || null,
    addressLine: addressLine || null,
    ampSize,
    panelLocation,
    urgencyFlag,
    skepticismFlag,
    mentionedFridge,
    mentionedWellPump,
    mentionedCords,
    storedGenerator,
  }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
