// EXP-008 GREETING variant assignment.
//
// Per bot-lab/experimentation/greeting-variants.md, every new lead is
// assigned one of 4 GREETING variants (A/B/C/D) deterministically via
// sha256(contact_id) % 4. The same contact always gets the same variant
// (idempotent), enabling cohort tracking against first_reply_rate.
//
// CALLED FROM: bot-engine before firing the initial GREETING SMS for a
// new lead. The variant is persisted to contacts.qualification_data so
// it can be queried later for experiment analysis.

/**
 * Deterministic A/B/C/D assignment for a contact.
 * Uses Web Crypto SHA-256 (built into Deno).
 */
export async function assignGreetingVariant(contactId: string): Promise<'A' | 'B' | 'C' | 'D'> {
  const buf = new TextEncoder().encode(contactId)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  // Take first 4 bytes as uint32, mod 4.
  const view = new DataView(hash)
  const idx = view.getUint32(0, false) % 4
  return ['A', 'B', 'C', 'D'][idx] as 'A' | 'B' | 'C' | 'D'
}

/**
 * Render the templated GREETING for a given variant + name.
 * Mirrors bot-lab/state-machine.js GREETING fallback. Updated 2026-05-04
 * to match v10.1.14 wording (variant A: "home connection quote for your
 * generator" not "your generator install quote").
 */
export function renderGreeting(
  variant: 'A' | 'B' | 'C' | 'D',
  firstName: string,
  opts: { lateNight?: boolean } = {}
): string {
  const name = firstName || 'there'
  const lateNightSuffix = opts.lateNight
    ? ` I know it's late, no rush, tomorrow works as well if easier.`
    : ''
  switch (variant) {
    case 'B':
      // v10.1.59 (Tyler iMessage 2026-05-08): variant B had factual
      // error "handles your quote and install personally" - fixed.
      return `Hi ${name}, this is Ashley with Backup Power Pro. Key (our electrician) texts the quote over himself once he's seen the panel, and he does the install in person. I just grab a few details up front to set him up. Mind if I run through them?${lateNightSuffix}`
    case 'C':
      return `Hi ${name}, this is Ashley with Backup Power Pro. Thanks for reaching out about a generator hookup. Got a few minutes for me to walk through what Key needs to get a quote together?${lateNightSuffix}`
    case 'D':
      return `Hi ${name}, this is Ashley with Backup Power Pro. Happy to help get a generator hookup quoted out. Quick start, what's the make and model of your generator?${lateNightSuffix}`
    case 'A':
    default:
      return `Hi ${name}, this is Ashley with Backup Power Pro. Key got your form and asked me to grab a few details so he can put a quote together for the generator hookup. Got a couple minutes?${lateNightSuffix}`
  }
}

/**
 * Helper: time-of-day bucket from a Date (defaults to now in America/New_York).
 * Matches state-machine.js late-night threshold.
 */
export function timeOfDayBucket(now: Date = new Date()): 'morning' | 'afternoon' | 'evening' | 'late' {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', hour12: false,
  })
  const hour = parseInt(fmt.format(now), 10)
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'late'  // 21:00–04:59 ET
}
