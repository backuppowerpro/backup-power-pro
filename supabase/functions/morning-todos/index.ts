/**
 * morning-todos — generates Key's daily todo list.
 *
 * Wired from pg_cron at 5am ET. Reads the current state of BPP (open
 * leads, hazardous panels flagged, stuck quotes, install calendar,
 * pending permits, expired re-engagements, voltage-deferred contacts,
 * ATS-scope-mismatch handoffs, etc.) and asks Claude to produce
 * 3-7 concrete actionable todos for the day. Inserts as source='ai'.
 *
 * Idempotency: checks bpp_todos for source='ai' AND
 * generated_for_date=today; bails if already populated. Cron firing
 * twice in a row won't duplicate.
 *
 * Auth: requireServiceRole — internal-only, called by pg_cron with
 * the service role key.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceRole } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const MODEL = 'claude-sonnet-4-6'

interface AITodo {
  title: string
  notes?: string
  priority?: number  // 1 (highest) – 5 (lowest)
  related_contact_id?: string
}

function todayET(): string {
  // YYYY-MM-DD in America/New_York
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  })
  return fmt.format(new Date())
}

async function gatherBusinessState(sb: ReturnType<typeof createClient>) {
  // Cheap parallel pulls — cap on each so a runaway lead surge doesn't blow
  // the prompt size.
  const today = new Date()
  const startOfToday = new Date(today); startOfToday.setHours(0, 0, 0, 0)
  const in7Days = new Date(startOfToday.getTime() + 7 * 86400000).toISOString()
  const twoDaysAgo = new Date(today.getTime() - 2 * 86400000).toISOString()
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000).toISOString()

  const [
    waitingOnKey,
    stuckQuotes,
    hazardousPanels,
    voltageDeferred,
    scopeMismatch,
    upcomingInstalls,
    pendingPermits,
    coldLeads,
  ] = await Promise.all([
    // Inbound messages last 7 days waiting on Key (unanswered)
    sb.from('contacts')
      .select('id, name, phone, address, stage, qualification_data')
      .neq('status', 'Archived')
      .lt('stage', 9)
      .order('created_at', { ascending: false })
      .limit(40),
    // Quotes created >2 days ago, status Created/Copied
    sb.from('proposals')
      .select('id, contact_id, total, status, created_at')
      .in('status', ['Created', 'Copied'])
      .lt('created_at', twoDaysAgo)
      .limit(20),
    // Bot-flagged hazardous panels
    sb.from('contacts')
      .select('id, name, qualification_data')
      .not('qualification_data->>hazardous_panel_brand', 'is', null)
      .limit(10),
    // Voltage-deferred (Maya didn't confirm 240V; Key needs to verify model spec)
    sb.from('contacts')
      .select('id, name, gen_brand_model, qualification_data')
      .eq('qualification_data->>voltage_deferred', 'true')
      .limit(10),
    // Out-of-scope ATS / standby asks
    sb.from('contacts')
      .select('id, name, qualification_data')
      .eq('qualification_data->>scope_mismatch_ats', 'true')
      .limit(10),
    // Installs scheduled in the next 7 days
    sb.from('contacts')
      .select('id, name, address, install_date')
      .gte('install_date', startOfToday.toISOString())
      .lt('install_date', in7Days)
      .limit(20),
    // Permits in flight (stage 3-8)
    sb.from('contacts')
      .select('id, name, stage, jurisdiction_id, created_at')
      .gte('stage', 3).lte('stage', 8)
      .lt('created_at', sevenDaysAgo)
      .limit(20),
    // Cold leads — created >7d ago, stage still 1
    sb.from('contacts')
      .select('id, name, created_at')
      .eq('stage', 1)
      .lt('created_at', sevenDaysAgo)
      .limit(10),
  ])

  return {
    counts: {
      open_contacts: waitingOnKey.data?.length || 0,
      stuck_quotes: stuckQuotes.data?.length || 0,
      hazardous_panels: hazardousPanels.data?.length || 0,
      voltage_deferred: voltageDeferred.data?.length || 0,
      scope_mismatch_ats: scopeMismatch.data?.length || 0,
      upcoming_installs_7d: upcomingInstalls.data?.length || 0,
      pending_permits_aged: pendingPermits.data?.length || 0,
      cold_leads_7d: coldLeads.data?.length || 0,
    },
    samples: {
      hazardous_panels: hazardousPanels.data?.map(c => ({ id: c.id, name: c.name, brand: c.qualification_data?.hazardous_panel_brand })) || [],
      voltage_deferred: voltageDeferred.data?.map(c => ({ id: c.id, name: c.name, model: c.gen_brand_model })) || [],
      scope_mismatch: scopeMismatch.data?.map(c => ({ id: c.id, name: c.name })) || [],
      upcoming_installs: upcomingInstalls.data?.map(c => ({ id: c.id, name: c.name, address: c.address, install_date: c.install_date })) || [],
      stuck_quotes: stuckQuotes.data?.slice(0, 5) || [],
      cold_leads: coldLeads.data?.slice(0, 5) || [],
    },
    today: todayET(),
  }
}

async function generateTodosWithClaude(state: ReturnType<typeof gatherBusinessState> extends Promise<infer T> ? T : never): Promise<AITodo[]> {
  const systemPrompt = `You are Key Goodson's morning briefing assistant. Key runs Backup Power Pro (BPP), a 1-person electrician business in Upstate SC that installs generator inlets / interlock kits.

Your job: produce 3-7 CONCRETE, ACTIONABLE todos for Key today based on the business state below. Each todo should be something Key can DO and CHECK OFF, not vague reminders.

RULES:
- Lead with the highest-leverage action (priority 1 = do first).
- Reference specific contact names when applicable.
- Keep each title under 90 characters.
- "notes" is optional; only include if it adds context Key wouldn't already know.
- Skip categories that have zero items in counts.
- DO NOT generate fluff like "review your day" or "check email." Only real actions.
- DO NOT include todos that don't have a clear next step.
- Output MUST be valid JSON: { "todos": [{ "title": "...", "notes": "...", "priority": 1, "related_contact_id": "uuid" }, ...] }`

  const userPrompt = `Today: ${state.today} (America/New_York)

Business state:
${JSON.stringify(state, null, 2)}

Generate the morning todos.`

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!r.ok) {
    const errText = await r.text()
    throw new Error(`Anthropic API ${r.status}: ${errText.slice(0, 200)}`)
  }

  const data = await r.json()
  const text = data.content?.[0]?.text || ''
  // Extract JSON block — Claude may wrap in markdown
  const jsonMatch = text.match(/\{[\s\S]*"todos"[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in Claude response')
  const parsed = JSON.parse(jsonMatch[0])
  return Array.isArray(parsed.todos) ? parsed.todos : []
}

Deno.serve(async (req: Request) => {
  // Auth gate
  const gate = requireServiceRole(req)
  if (gate) return gate

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const today = todayET()

  // Idempotency: bail if AI todos already generated for today
  const { count: existingCount } = await sb.from('bpp_todos')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'ai')
    .eq('generated_for_date', today)

  if ((existingCount || 0) > 0) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'already_generated_today', date: today }),
      { status: 200, headers: { 'content-type': 'application/json' } })
  }

  try {
    const state = await gatherBusinessState(sb)
    const todos = await generateTodosWithClaude(state)

    if (todos.length === 0) {
      return new Response(JSON.stringify({ ok: true, generated: 0, reason: 'empty_business_state' }),
        { status: 200, headers: { 'content-type': 'application/json' } })
    }

    // Insert all in one batch. Whitelist allowed columns; anything Claude
    // hallucinated won't make it through.
    const rows = todos.slice(0, 7).map(t => ({
      title: String(t.title || '').slice(0, 200),
      notes: t.notes ? String(t.notes).slice(0, 500) : null,
      priority: typeof t.priority === 'number' && t.priority >= 1 && t.priority <= 5 ? t.priority : 3,
      related_contact_id: typeof t.related_contact_id === 'string' && t.related_contact_id.length === 36 ? t.related_contact_id : null,
      source: 'ai',
      generated_for_date: today,
    })).filter(r => r.title.length > 0)

    const { error } = await sb.from('bpp_todos').insert(rows)
    if (error) throw error

    return new Response(JSON.stringify({ ok: true, generated: rows.length, date: today }),
      { status: 200, headers: { 'content-type': 'application/json' } })
  } catch (e) {
    console.error('morning-todos failed:', e)
    return new Response(JSON.stringify({ ok: false, error: String(e).slice(0, 500) }),
      { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
