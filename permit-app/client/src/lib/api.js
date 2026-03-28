import { supabase } from './supabase'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysInStage(stage_updated_at) {
  return Math.floor((Date.now() - new Date(stage_updated_at).getTime()) / (1000 * 60 * 60 * 24))
}

function hydratePerson(p) {
  return { ...p, days_in_stage: daysInStage(p.stage_updated_at) }
}

// ─── People ───────────────────────────────────────────────────────────────────

export async function fetchPeople() {
  const { data, error } = await supabase
    .from('permit_people')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map(hydratePerson)
}

export async function addPerson({ name, phone, email, notes, stage = 1 }) {
  if (!name) throw new Error('name is required')
  const { data, error } = await supabase
    .from('permit_people')
    .insert({ name, phone: phone || null, email: email || null, notes: notes || null, stage })
    .select()
    .single()
  if (error) throw new Error(error.message)

  // Log initial stage event
  await supabase.from('permit_stage_events').insert({
    person_id: data.id, from_stage: null, to_stage: stage, source: 'manual'
  })

  return hydratePerson(data)
}

export async function patchPerson(id, updates) {
  // First get current person to compare stage
  const { data: current } = await supabase
    .from('permit_people')
    .select('stage')
    .eq('id', id)
    .single()

  const payload = { ...updates }

  // If stage is changing, update stage_updated_at and log event
  if (updates.stage !== undefined && current && updates.stage !== current.stage) {
    payload.stage_updated_at = new Date().toISOString()

    await supabase.from('permit_stage_events').insert({
      person_id: id,
      from_stage: current.stage,
      to_stage: updates.stage,
      source: 'manual'
    })
  }

  const { data, error } = await supabase
    .from('permit_people')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return hydratePerson(data)
}

// ─── Jurisdictions ────────────────────────────────────────────────────────────

export async function fetchJurisdictions() {
  const { data, error } = await supabase
    .from('permit_jurisdictions')
    .select('*')
    .order('id', { ascending: true })
  if (error) throw new Error(error.message)
  return data
}

export async function addJurisdiction(fields) {
  if (!fields.name) throw new Error('name is required')
  const { data, error } = await supabase
    .from('permit_jurisdictions')
    .insert(fields)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateJurisdiction(id, fields) {
  const { data, error } = await supabase
    .from('permit_jurisdictions')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteJurisdiction(id) {
  const { error } = await supabase
    .from('permit_jurisdictions')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
  return { deleted: true }
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function fetchAnalytics(from, to) {
  const fromTs = from + 'T00:00:00.000Z'
  const toTs = to + 'T23:59:59.999Z'

  // Fetch all people and stage events in parallel
  const [{ data: people, error: pErr }, { data: events, error: eErr }] = await Promise.all([
    supabase.from('permit_people').select('*'),
    supabase.from('permit_stage_events')
      .select('*')
      .gte('timestamp', fromTs)
      .lte('timestamp', toTs),
  ])
  if (pErr) throw new Error(pErr.message)
  if (eErr) throw new Error(eErr.message)

  // Summary
  const totalPeople = people.length
  const totalActive = people.filter(p => !p.is_archived).length
  const totalCompleted = people.filter(p => p.archive_reason === 'completed').length

  // Stage counts
  const stageCountMap = {}
  people.forEach(p => {
    if (!stageCountMap[p.stage]) stageCountMap[p.stage] = { stage: p.stage, count: 0, active_count: 0 }
    stageCountMap[p.stage].count++
    if (!p.is_archived) stageCountMap[p.stage].active_count++
  })
  const stageCounts = Object.values(stageCountMap).sort((a, b) => a.stage - b.stage)

  // Funnel — distinct people who ever reached each stage
  const funnelMap = {}
  events.forEach(e => {
    if (!funnelMap[e.to_stage]) funnelMap[e.to_stage] = new Set()
    funnelMap[e.to_stage].add(e.person_id)
  })
  const funnelCounts = Object.entries(funnelMap).map(([stage, set]) => ({
    stage: parseInt(stage), reached: set.size
  })).sort((a, b) => a.stage - b.stage)

  // Conversion rates
  const funnelReached = {}
  funnelCounts.forEach(r => { funnelReached[r.stage] = r.reached })
  const conversionRates = []
  for (let i = 1; i <= 8; i++) {
    const from_count = funnelReached[i] || 0
    const to_count = funnelReached[i + 1] || 0
    const rate = from_count > 0 ? Math.round((to_count / from_count) * 100) : null
    conversionRates.push({ from_stage: i, to_stage: i + 1, from_count, to_count, rate })
  }

  // Events over time by ISO week
  const weekMap = {}
  events.forEach(e => {
    const d = new Date(e.timestamp)
    const year = d.getUTCFullYear()
    const startOfYear = new Date(Date.UTC(year, 0, 1))
    const week = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getUTCDay() + 1) / 7)
    const key = `${year}-W${String(week).padStart(2, '0')}`
    if (!weekMap[key]) weekMap[key] = { week: key, new_leads: 0, completed: 0 }
    if (e.to_stage === 1 && e.from_stage === null) weekMap[key].new_leads++
    if (e.to_stage === 9) weekMap[key].completed++
  })
  const eventsOverTime = Object.values(weekMap).sort((a, b) => a.week.localeCompare(b.week))

  return {
    summary: { totalPeople, totalActive, totalCompleted },
    stageCounts,
    funnelCounts,
    conversionRates,
    eventsOverTime,
  }
}
