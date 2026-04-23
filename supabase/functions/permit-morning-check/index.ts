// permit-morning-check
// Runs every morning at 8am EST.
// 1. Finds all contacts with a submitted permit (psub set, prtp not set)
// 2. Logs into eTRAKiT portal and reads the active permits dashboard
// 3. Auto-updates CRM if any permit is now "Ready to Pay"
// 4. Texts Key a summary at (941) 441-7996

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceRole } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!
const TWILIO_FROM = '+18648637800'
const KEY_CELL = '+19414417996'
const FIRECRAWL_KEY = Deno.env.get('FIRECRAWL_API_KEY')!

// Report a permit event to Sparky inbox (shows in CRM + pings Key via SMS)
async function reportToSparky(
  contactId: string,
  priority: 'urgent' | 'normal' | 'fyi',
  summary: string,
  suggestedAction?: string,
): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/sparky-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ agent: 'permit', contact_id: contactId, priority, summary, suggested_action: suggestedAction }),
    })
  } catch (err) {
    console.error('[permit] reportToSparky failed:', err)
  }
}
const GVL_USER = Deno.env.get('PERMIT_GVL_USER')!  // AEC001822
const GVL_PASS = Deno.env.get('PERMIT_GVL_PASS')!  // stored in Supabase secrets
const ETRAKIT_URL = 'https://grvlc-trk.aspgov.com/eTRAKiT/'

// ── Permit field helpers (same format as CRM: __pm_<key>:<value> in install_notes) ──

function pmRead(notes: string, key: string): string {
  const m = notes.match(new RegExp(`^__pm_${key}:\\s*(.*)$`, 'm'))
  return m ? m[1].trim() : ''
}

function pmWrite(notes: string, key: string, value: string): string {
  const re = new RegExp(`^__pm_${key}:.*\\n?`, 'gm')
  let txt = notes.replace(re, '').replace(/\n{2,}/g, '\n').replace(/^\n+|\n+$/g, '')
  return value ? `__pm_${key}:${value}${txt ? '\n' + txt : ''}`.trim() : txt
}

// ── Twilio SMS ──

async function sendSms(to: string, body: string): Promise<void> {
  const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)
  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }).toString(),
    }
  )
  if (!resp.ok) console.error('SMS send failed:', await resp.text())
}

// ── Firecrawl agent → eTRAKiT dashboard ──
// Returns list of active permits from the portal dashboard.
// Note: GVL_PASS is passed to Firecrawl's API in the task string.
// This is acceptable because Firecrawl already controls the browser
// session and can see everything in it anyway.

interface PortalPermit {
  permitNum: string
  address: string
  status: string
}

async function scrapeETRAKitDashboard(): Promise<PortalPermit[]> {
  // Launch Firecrawl agent
  const startResp = await fetch('https://api.firecrawl.dev/v1/agent', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FIRECRAWL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'FIRE-1',
      startUrl: ETRAKIT_URL,
      maxSteps: 20,
      task: `Log into the eTRAKiT permit portal and return the list of active permits.

Steps:
1. Click the MyTRAKiT Login button (or similar login link)
2. Enter username: ${GVL_USER}
3. Enter password: ${GVL_PASS}
4. Submit the login form
5. Navigate to "My Permits" or the permits dashboard page
6. Find all permits listed in the table/list
7. For each permit, extract: permit number, property address, and current status

Return ONLY a JSON array in this exact format (no extra text):
[{"permitNum":"ECON_xxx","address":"123 Main St","status":"Ready to Pay"}]

If you cannot log in or find any permits, return an empty array: []`,
    }),
  })

  if (!startResp.ok) {
    console.error('Firecrawl agent failed to start:', await startResp.text())
    return []
  }

  const { id } = await startResp.json()
  if (!id) return []

  // Poll up to 2 minutes (24 × 5s)
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 5000))

    const pollResp = await fetch(`https://api.firecrawl.dev/v1/agent/${id}`, {
      headers: { Authorization: `Bearer ${FIRECRAWL_KEY}` },
    })
    if (!pollResp.ok) continue

    const data = await pollResp.json()

    if (data.status === 'completed') {
      const text: string = data.result || data.answer || ''
      const match = text.match(/\[[\s\S]*?\]/)
      if (!match) return []
      try { return JSON.parse(match[0]) as PortalPermit[] } catch { return [] }
    }

    if (data.status === 'failed') {
      console.error('Agent failed:', data.error)
      return []
    }
  }

  console.error('Agent timed out after 2 min')
  return []
}

// ── Address match helper ──
// Compares short street address from CRM contact to portal address.
// e.g. "22 Kimbell Ct, Greenville SC" vs "22 KIMBELL CT"

function addressMatch(contactAddr: string, portalAddr: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
  // Extract just the street part (before first comma)
  const street = normalize(contactAddr.split(',')[0])
  const portal = normalize(portalAddr)
  // Match if either contains the other's street number + first word of street name
  const parts = street.split(' ').filter(Boolean)
  if (parts.length < 2) return false
  const key = parts.slice(0, 2).join(' ') // e.g. "22 kimbell"
  return portal.includes(key) || street.includes(normalize(portalAddr.split(',')[0]))
}

// ── Main handler ──

Deno.serve(async (req) => {
  // Gate: service-role only — this function burns Firecrawl credits and
  // authenticates into county portals with stored credentials. Without
  // the gate, repeated unauth calls trigger lockout upstream.
  const gate = requireServiceRole(req); if (gate) return gate
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // 1. Find contacts with permit submitted but not yet ready to pay
  const { data: pending, error } = await supabase
    .from('contacts')
    .select('id, name, address, install_notes, jurisdiction_id')
    .like('install_notes', '%__pm_psub:%')

  if (error) {
    console.error('DB query error:', error)
    return new Response('DB error', { status: 500 })
  }

  // Filter out any that already have prtp set
  const waiting = (pending || []).filter(
    c => !pmRead(c.install_notes || '', 'prtp')
  )

  if (waiting.length === 0) {
    console.log('No permits waiting for approval — no text sent')
    return new Response('No active permits', { status: 200 })
  }

  // 2. Load jurisdiction records to determine portal vs manual
  const { data: jurisdictions } = await supabase.from('permit_jurisdictions').select('*')
  const jurMap: Record<string, any> = Object.fromEntries(
    (jurisdictions || []).map((j: any) => [j.id, j])
  )

  const eTraKitQueue: typeof waiting = []
  const manualQueue: typeof waiting = []

  for (const c of waiting) {
    const jur = jurMap[c.jurisdiction_id] || {}
    const allUrls = [jur.link1_url, jur.link2_url, jur.link3_url]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (allUrls.includes('etrakit') || allUrls.includes('grvlc-trk') || allUrls.includes('aca.greenville')) {
      eTraKitQueue.push(c)
    } else {
      manualQueue.push(c)
    }
  }

  const autoUpdated: string[] = []
  const stillPending: string[] = []

  // 3. Check eTRAKiT portal
  if (eTraKitQueue.length > 0) {
    const portalPermits = await scrapeETRAKitDashboard()
    console.log(`Portal returned ${portalPermits.length} permits`)

    for (const c of eTraKitQueue) {
      const subDate = pmRead(c.install_notes || '', 'psub')
      const daysSub = subDate
        ? Math.floor((Date.now() - new Date(subDate).getTime()) / 86400000)
        : 0

      const match = portalPermits.find(p => addressMatch(c.address || '', p.address))

      if (match) {
        const st = match.status.toLowerCase()
        const isReadyToPay =
          (st.includes('ready') && st.includes('pay')) ||
          st.includes('payment due') ||
          st.includes('fee due')

        if (isReadyToPay) {
          // Auto-update CRM permit step to ready_to_pay
          const today = new Date().toISOString().split('T')[0]
          let notes = pmWrite(c.install_notes || '', 'prtp', today)
          if (match.permitNum) notes = pmWrite(notes, 'pnum', match.permitNum)
          const { error: updateErr } = await supabase
            .from('contacts')
            .update({ install_notes: notes })
            .eq('id', c.id)
          if (!updateErr) {
            autoUpdated.push(c.name || c.address || 'Unknown')
            console.log(`Auto-updated ${c.name}: ready_to_pay`)
            // Urgent inbox item — needs payment today
            reportToSparky(
              c.id,
              'urgent',
              `${c.name || c.address} permit is Ready to Pay${match.permitNum ? ' (' + match.permitNum + ')' : ''}.`,
              'Go to contact → Permit tab → mark Ready to Pay, then pay the fee.'
            ).catch(() => {})
          }
        } else {
          stillPending.push(`${c.name || c.address} (Day ${daysSub}, ${match.status})`)
          // Only surface to inbox if it's been pending a while (5+ days)
          if (daysSub >= 5) {
            reportToSparky(
              c.id,
              'fyi',
              `${c.name || c.address} permit still pending — Day ${daysSub}. Portal status: ${match.status}.`,
              'No action needed yet unless days keep climbing.'
            ).catch(() => {})
          }
        }
      } else {
        // Not found on dashboard — still in review
        stillPending.push(`${c.name || c.address} (Day ${daysSub})`)
        if (daysSub >= 5) {
          reportToSparky(
            c.id,
            'fyi',
            `${c.name || c.address} permit not found on portal — Day ${daysSub} since submitted.`,
            'May still be in review. No action unless it hits Day 7+'
          ).catch(() => {})
        }
      }
    }
  }

  // 4. Build summary text
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const lines: string[] = [`BPP Permits ${date}`]

  if (autoUpdated.length) {
    lines.push(`✅ Ready to pay: ${autoUpdated.join(', ')}`)
  }
  if (stillPending.length) {
    lines.push(`⏳ Pending: ${stillPending.join(', ')}`)
  }
  if (manualQueue.length) {
    const names = manualQueue.map(c => {
      const d = pmRead(c.install_notes || '', 'psub')
      const days = d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 0
      // Only surface to inbox on Day 3 and Day 7 to avoid daily noise
      if (days === 3 || days >= 7) {
        reportToSparky(
          c.id,
          days >= 7 ? 'normal' : 'fyi',
          `${c.name || c.address} permit needs a manual status call — Day ${days}. Jurisdiction doesn't have an online portal.`,
          'Call the jurisdiction to check permit status.'
        ).catch(() => {})
      }
      return `${c.name || c.address} (Day ${days})`
    })
    lines.push(`📞 Call to check: ${names.join(', ')}`)
  }

  const smsBody = lines.join('\n')
  console.log('Sending permit summary:\n' + smsBody)
  await sendSms(KEY_CELL, smsBody)

  return new Response(JSON.stringify({ ok: true, checked: waiting.length, summary: smsBody }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
