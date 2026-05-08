/**
 * scheduled-emails — hourly cron drainer for lifecycle/time-triggered emails.
 *
 * pg_cron calls this every hour. Function iterates a set of "templates"
 * each with their own eligibility query, sends through send-email, logs
 * to messages_email, and respects rate limits + opt-outs.
 *
 * Templates handled here (cron-fired, NOT manual or bot-engine):
 *   quote-followup-48h    — proposal sent 48h ago, no signature
 *   install-reminder      — install_date is tomorrow (24-26h out)
 *   review                — completion 48h-72h ago
 *   permit-approved       — pipeline_stage hit 7 in last 24h, not yet emailed
 *   referral-nudge        — completion 30-31 days ago
 *   anniversary           — install_date 365d ago (within 24h window)
 *   storm-prep-reminder   — June 1 + Nov 1, all closed installs (annual)
 *
 * Auth: brain-token only.
 *
 * Idempotency: uses the fn_recent_email_send DB helper to dedupe. Each
 * template has a "lookback hours" window — we won't re-send within that
 * window even if the eligibility query keeps returning the same contact.
 *
 * Rate limit: max 100 sends per cron run total. Pagination cursor lives
 * in scheduled_email_runs table (TBD — for now we just process the
 * first 100 of each query).
 *
 * Dry-run: ?dry_run=1 in URL or { "dry_run": true } in POST body.
 * Returns the eligible contact list per template WITHOUT sending.
 *
 * STATUS: deployable but no-op until secrets set:
 *   - BPP_BRAIN_TOKEN     (already set)
 *   - send-email already deployed but waits on RESEND_API_KEY
 *
 * pg_cron registration (apply via migration-drift-repair when ready):
 *   SELECT cron.schedule(
 *     'scheduled-emails-hourly',
 *     '5 * * * *',  -- 5 minutes past the hour, every hour
 *     $$SELECT net.http_post(
 *       url := 'https://reowtzedjflwmlptupbk.supabase.co/functions/v1/scheduled-emails',
 *       headers := jsonb_build_object('x-bpp-brain-token', vault_get('bpp_brain_token')),
 *       body := '{}'::jsonb
 *     )$$
 *   );
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { timingSafeEqual } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BPP_BRAIN_TOKEN = Deno.env.get('BPP_BRAIN_TOKEN') || ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-bpp-brain-token',
}
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

const MAX_SENDS_PER_RUN = 100
const PER_TEMPLATE_LIMIT = 30  // cap any single template at 30 per run for safety

// ── Template eligibility queries ────────────────────────────────────
//
// Each entry returns the SQL/Supabase query that finds contacts eligible
// for that template + the args passed to send-email per-contact. The
// dedup (via fn_recent_email_send) is enforced inside the loop, so each
// query just needs to identify CANDIDATES.

interface TemplateSpec {
  template: string
  lookbackHours: number  // dedup window
  marketingClass: boolean
  buildSubject: (c: any) => string
  buildVars: (c: any) => Record<string, string>
  // Returns Supabase filter chain. Caller adds .limit(PER_TEMPLATE_LIMIT)
  // We use raw SQL via .rpc('exec_sql', ...) for the more complex queries
  // because Supabase JS .filter() chains can't express "contacts where
  // qualification_data->>'handoff_terminal_state' = 'COMPLETE' AND
  // (qualification_data->>'handoff_fired_at')::timestamptz BETWEEN now()-72h AND now()-48h"
  query: (sb: ReturnType<typeof createClient>) => Promise<any[]>
}

function firstName(c: any): string { return String(c.name || '').split(/\s+/)[0] || 'there' }

function shortAddr(c: any): string {
  const a = String(c.install_address || c.address || '')
  return a.split(',')[0].trim() || 'your place'
}

const TEMPLATES: TemplateSpec[] = [
  // 1. quote-followup-48h: proposal sent 48-49h ago, no signature, not skipped
  {
    template: 'quote-followup-48h',
    lookbackHours: 24 * 7,  // don't re-nudge within a week
    marketingClass: false,  // transactional follow-up
    buildSubject: (c) => `About your quote, ${shortAddr(c)} · Backup Power Pro`,
    buildVars: (c) => ({ first_name: firstName(c) }),
    query: async (sb) => {
      // We rely on contacts.qualification_data.proposal_sent_at being set
      // by send-email when the proposal email fires. Until that happens
      // upstream, this returns []. (Send-email will start stamping that
      // marker once activated.)
      const cutoff48 = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
      const cutoff96 = new Date(Date.now() - 96 * 3600 * 1000).toISOString()
      const { data } = await sb.from('contacts')
        .select('id, name, email, install_address, address, qualification_data, do_not_contact, notes')
        .not('email', 'is', null)
        .eq('do_not_contact', false)
        .filter('qualification_data->>proposal_sent_at', 'gte', cutoff96)
        .filter('qualification_data->>proposal_sent_at', 'lte', cutoff48)
        .filter('qualification_data->>proposal_signed_at', 'is', null)
        .limit(PER_TEMPLATE_LIMIT)
      return data || []
    },
  },

  // 2. install-reminder: install_date is 24-26h from now
  {
    template: 'install-reminder',
    lookbackHours: 24,
    marketingClass: false,
    buildSubject: (c) => `Install day is tomorrow · Backup Power Pro`,
    buildVars: (c) => ({
      first_name: firstName(c),
      address_short: shortAddr(c),
      arrival_window: c.qualification_data?.arrival_window || '9 to 11 AM',
    }),
    query: async (sb) => {
      const now = Date.now()
      const start = new Date(now + 24 * 3600 * 1000).toISOString()
      const end = new Date(now + 26 * 3600 * 1000).toISOString()
      const { data } = await sb.from('contacts')
        .select('id, name, email, install_address, address, install_date, qualification_data, do_not_contact, notes')
        .not('email', 'is', null)
        .eq('do_not_contact', false)
        .gte('install_date', start)
        .lte('install_date', end)
        .limit(PER_TEMPLATE_LIMIT)
      return data || []
    },
  },

  // 3. review-request: 48-72h after completion
  {
    template: 'review',
    lookbackHours: 24 * 30,  // never re-ask within 30 days
    marketingClass: false,
    buildSubject: (c) => `Two days in, running clean? · Backup Power Pro`,
    buildVars: (c) => ({
      first_name: firstName(c),
      review_url: 'https://g.page/r/CXYZ',  // TWEAK: real Google review URL
    }),
    query: async (sb) => {
      const cutoff48 = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
      const cutoff72 = new Date(Date.now() - 72 * 3600 * 1000).toISOString()
      const { data } = await sb.from('contacts')
        .select('id, name, email, install_address, address, qualification_data, do_not_contact, notes')
        .not('email', 'is', null)
        .eq('do_not_contact', false)
        .filter('qualification_data->>handoff_terminal_state', 'eq', 'COMPLETE')
        .filter('qualification_data->>handoff_fired_at', 'gte', cutoff72)
        .filter('qualification_data->>handoff_fired_at', 'lte', cutoff48)
        .limit(PER_TEMPLATE_LIMIT)
      return data || []
    },
  },

  // 4. permit-approved: pipeline_stage flipped to 7 in last 24h
  {
    template: 'permit-approved',
    lookbackHours: 24 * 365,  // permit only happens once
    marketingClass: false,
    buildSubject: (c) => `Inspector signed off · Backup Power Pro`,
    buildVars: (c) => ({
      first_name: firstName(c),
      address_short: shortAddr(c),
    }),
    query: async (sb) => {
      const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
      // pipeline_stage 7 = permit approved per CRM stage scheme
      const { data } = await sb.from('contacts')
        .select('id, name, email, install_address, address, qualification_data, do_not_contact, notes, pipeline_stage')
        .not('email', 'is', null)
        .eq('do_not_contact', false)
        .eq('pipeline_stage', 7)
        // Approximation: contacts updated to stage 7 in last 24h. A more
        // robust implementation would join on stage_history. Good enough
        // because fn_recent_email_send dedupes.
        .gte('last_bot_outbound_at', cutoff)
        .limit(PER_TEMPLATE_LIMIT)
      return data || []
    },
  },

  // 5. referral-nudge: 30-31 days post-completion
  {
    template: 'referral-nudge',
    lookbackHours: 24 * 365,  // one ask per install
    marketingClass: true,
    buildSubject: (c) => `If a neighbor ever asks · Backup Power Pro`,
    buildVars: (c) => ({ first_name: firstName(c) }),
    query: async (sb) => {
      const cutoff30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
      const cutoff31 = new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString()
      const { data } = await sb.from('contacts')
        .select('id, name, email, install_address, address, qualification_data, do_not_contact, notes')
        .not('email', 'is', null)
        .eq('do_not_contact', false)
        .filter('qualification_data->>handoff_terminal_state', 'eq', 'COMPLETE')
        .filter('qualification_data->>handoff_fired_at', 'gte', cutoff31)
        .filter('qualification_data->>handoff_fired_at', 'lte', cutoff30)
        .limit(PER_TEMPLATE_LIMIT)
      return data || []
    },
  },

  // 6. anniversary: install_date exactly 1 year ago (24h window)
  {
    template: 'anniversary',
    lookbackHours: 24 * 365 + 12,  // never re-anniversary in same year
    marketingClass: true,
    buildSubject: (c) => `One year ago today · Backup Power Pro`,
    buildVars: (c) => ({ first_name: firstName(c) }),
    query: async (sb) => {
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
      const start = new Date(oneYearAgo.getTime() - 12 * 3600 * 1000).toISOString()
      const end = new Date(oneYearAgo.getTime() + 12 * 3600 * 1000).toISOString()
      const { data } = await sb.from('contacts')
        .select('id, name, email, install_address, address, install_date, qualification_data, do_not_contact, notes')
        .not('email', 'is', null)
        .eq('do_not_contact', false)
        .gte('install_date', start)
        .lte('install_date', end)
        .limit(PER_TEMPLATE_LIMIT)
      return data || []
    },
  },

  // 7. storm-prep-reminder: June 1 + Nov 1 each year, all closed installs
  {
    template: 'storm-prep-reminder',
    lookbackHours: 24 * 90,  // never re-storm-prep within 90 days
    marketingClass: true,
    buildSubject: (c) => `Storm season starts Sunday · 10-min test · Backup Power Pro`,
    buildVars: (c) => ({
      first_name: firstName(c),
      date: 'this Sunday',  // TODO: derive from current date relative to season
    }),
    query: async (sb) => {
      // Only fire on June 1 OR Nov 1 (within a 24h window), all closed installs
      const today = new Date()
      const m = today.getMonth() + 1
      const d = today.getDate()
      const isStormSeasonStart = (m === 6 && d === 1) || (m === 11 && d === 1)
      if (!isStormSeasonStart) return []
      const { data } = await sb.from('contacts')
        .select('id, name, email, install_address, address, qualification_data, do_not_contact, notes')
        .not('email', 'is', null)
        .eq('do_not_contact', false)
        .filter('qualification_data->>handoff_terminal_state', 'eq', 'COMPLETE')
        .limit(PER_TEMPLATE_LIMIT)
      return data || []
    },
  },
]

// ── Idempotency check via DB helper fn ──────────────────────────────
async function recentlySent(
  sb: ReturnType<typeof createClient>,
  contactId: string,
  template: string,
  withinHours: number,
): Promise<boolean> {
  const { data, error } = await sb.rpc('fn_recent_email_send', {
    p_contact_id: contactId,
    p_template: template,
    p_within_hours: withinHours,
  })
  if (error) {
    console.warn('[scheduled-emails] fn_recent_email_send error', error)
    return false  // fail open (better to potentially double-send than block lifecycle)
  }
  return !!data
}

function isMarketingOptedOut(notes: string, template: string): boolean {
  if (notes.includes('__email_marketing_off')) return true
  const tplMap: Record<string, string> = {
    'storm-prep-reminder': '__email_seasonal_off',
    'anniversary': '__email_anniversary_off',
    'referral-nudge': '__email_referrals_off',
  }
  const marker = tplMap[template]
  return marker ? notes.includes(marker) : false
}

// ── Send via send-email edge fn ─────────────────────────────────────
async function dispatchEmail(args: {
  contactId: string
  template: string
  subject: string
  variables: Record<string, string>
}): Promise<{ ok: boolean; err?: string }> {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SR}`,
        apikey: SR,
        'x-bpp-brain-token': BPP_BRAIN_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template: args.template,
        contact_id: args.contactId,
        subject: args.subject,
        variables: args.variables,
        trigger: 'cron',  // logged in messages_email
      }),
    })
    if (!r.ok) return { ok: false, err: `${r.status} ${(await r.text()).slice(0, 200)}` }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, err: String(e?.message || e).slice(0, 200) }
  }
}

// ── Server entry ────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const provided = req.headers.get('x-bpp-brain-token') || ''
  if (!BPP_BRAIN_TOKEN || !timingSafeEqual(provided, BPP_BRAIN_TOKEN)) {
    return json(401, { error: 'unauthorized' })
  }

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry_run') === '1' ||
    (req.method === 'POST' && req.headers.get('content-type')?.includes('json')
      ? await req.clone().json().then((b) => b?.dry_run === true).catch(() => false)
      : false)

  const sb = createClient(SUPABASE_URL, SR)

  const summary: Record<string, any> = { dry_run: dryRun, started_at: new Date().toISOString(), templates: {}, total_sent: 0, total_skipped: 0, total_errors: 0 }

  let totalSent = 0
  for (const tpl of TEMPLATES) {
    if (totalSent >= MAX_SENDS_PER_RUN) {
      summary.templates[tpl.template] = { skipped: 'global_rate_limit_reached' }
      continue
    }

    let candidates: any[]
    try {
      candidates = await tpl.query(sb)
    } catch (e: any) {
      summary.templates[tpl.template] = { error: 'query_failed', detail: String(e?.message || e).slice(0, 120) }
      continue
    }

    const tplSummary: Record<string, any> = { eligible: candidates.length, sent: 0, skipped_dedup: 0, skipped_optout: 0, errors: 0, contacts: [] }

    for (const c of candidates) {
      if (totalSent >= MAX_SENDS_PER_RUN) break

      // Marketing opt-out check
      const notes = String(c.notes || '')
      if (tpl.marketingClass && isMarketingOptedOut(notes, tpl.template)) {
        tplSummary.skipped_optout++
        continue
      }

      // Per-contact dedup via DB helper
      if (await recentlySent(sb, c.id, tpl.template, tpl.lookbackHours)) {
        tplSummary.skipped_dedup++
        continue
      }

      const subject = tpl.buildSubject(c)
      const vars = tpl.buildVars(c)

      if (dryRun) {
        tplSummary.contacts.push({ id: c.id, email: c.email, subject, vars })
        tplSummary.sent++  // logical "would send"
        totalSent++
        continue
      }

      const send = await dispatchEmail({
        contactId: c.id,
        template: tpl.template,
        subject,
        variables: vars,
      })
      if (send.ok) {
        tplSummary.sent++
        totalSent++
      } else {
        tplSummary.errors++
        tplSummary.last_err = send.err
      }
    }

    summary.templates[tpl.template] = tplSummary
    summary.total_sent += tplSummary.sent
    summary.total_skipped += tplSummary.skipped_dedup + tplSummary.skipped_optout
    summary.total_errors += tplSummary.errors
  }

  summary.finished_at = new Date().toISOString()
  return json(200, summary)
})
