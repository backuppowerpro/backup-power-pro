/**
 * One-shot: pre-seed /memories/shared/ with Key's accumulated BPP
 * expertise so Alex, Sparky, and post-mortem Alex all start at
 * senior-employee level instead of learning from Monday's conversation.
 *
 * Content is drawn from Alex's existing persona prompt + Key's known
 * business facts (offer, geography, pricing rationale, permit realities,
 * objection-handling, closing sequence).
 *
 * Idempotent — upserts by path. Safe to re-run after prompt edits.
 */

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'
import { requireServiceRole } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const SEED_FILES: Record<string, string> = {
  '/memories/shared/offer.md': `# BPP Offer — The Storm-Ready Connection System

Code-compliant inlet box + interlock kit + permit in one day. All-in $1,197–$1,497.

Why it matters:
- Customer already owns a portable generator. Sunk cost. We unlock it.
- Alternative is a $10K–$20K standby unit they don't need yet.
- One day of work. All-inclusive. Permit + inspection + cleanup included.
- 5 installs/week ceiling (Key is solo). Real scarcity — use sparingly.

What's in the install:
- Inlet box (30A L14-30 or 50A CS6365, matched to generator)
- Interlock kit (panel-matched, per code)
- 20 ft cord included
- Main-breaker / twin-quad add-ons when needed
- Surge protector optional
- Permit pulled + inspection handled by Key

The three "yes conditions":
1. They have or will have a portable generator with a 240V outlet
2. Their panel is accessible + we can mount a connection box on an exterior wall
3. They're in Greenville / Spartanburg / Pickens county SC
`,

  '/memories/shared/geography.md': `# Geography — service area hard rules

WE COVER: Greenville County SC, Spartanburg County SC, Pickens County SC.
WE DO NOT COVER: Anderson County. (Hard rule — never serve.)

City-within-county permit portals:
- City of Greenville — CivicPlus portal, ~4 days
- City of Greer — eTRAKiT portal, ~4 days
- City of Simpsonville — InfoVision portal, ~4 days
- City of Mauldin — Citizenserve portal, ~5 days
- Greenville County (non-city) — eTRAKiT portal, ~5 days
- Spartanburg County — email-based submission, ~7 days (slowest)
- Pickens County — online portal or (864) 898-5830, ~5 days

If a customer gives an address outside the service area: tell them apologetically, call out the county, offer to refer them to a local electrician (we don't have one — just note it's outside our range).
`,

  '/memories/shared/pricing.md': `# Pricing — rationale + anchoring

Base: 30A $1,197. 50A $1,497.
NEVER go below $1,197 (absolute floor).
Margins: ~$250 materials per job. Net ~$910–$1,067 solo.

Anchor first, then price. Always mention the $10K–$20K standby alternative BEFORE quoting. Customer compares $1,197 against $15K, not against a vague expectation.

Common add-ons:
- Long-run (>5 ft): $12/ft at 30A, $14/ft at 50A
- Surge protector: +$375
- POM (peace-of-mind / warranty): +$447
- Main breaker swap when needed: +$224
- Twin-quad when panel full: +$129
- Permit line item on customer invoice: $125 (we pass through)

Premium tier uplift (tier-aware pricing, v1 scaffold):
- Premium: +$300 bundle uplift (bundle TBD: expedite / extended warranty / upgraded whip)
- Premium+: +$600 bundle uplift (adds panel write-up / spare parts kit / annual recheck)
- A/B variant: 50/50 split within tier on proposal creation

Tier auto-score signals: address-on-file, 50A gen, urgency keywords, fast reply, brand-aware, price pushback, out-of-market phone.
`,

  '/memories/shared/process.md': `# Install process — stages + commitments

Pipeline stages:
  1 Form Submitted  — new lead, before first reply
  2 Responded       — Alex has engaged, customer engaged back
  3 Quote Sent      — proposal URL sent to customer
  4 Booked          — proposal signed + deposit paid
  5 Permit Submitted
  6 Permit Paid
  7 Permit Approved
  8 Inspection Scheduled
  9 Complete

Timeline from booking to inspection pass typically 2–3 weeks (permit is slowest step). Customer can use the generator once install is done (step 8 ish).

Alex's job (stages 1–2) ends when:
  - Panel photo received
  - Panel location confirmed (inside / outside)
  - Full service address (street + city + state)
  - Generator outlet confirmed 30A or 50A (or photo of outlet)
  - Name + email on file

Then Alex calls mark_complete and Key takes over with the proposal.
`,

  '/memories/shared/voice.md': `# Voice — how we talk to customers

Direct. No fluff. Sharp neighbor who knows the trade, not a corporate form.
Short sentences. Skip throat-clearing ("Sure!", "Great question!").
Use customer's first name once or twice, never every sentence.
Light emoji only: 🔥 hot 💰 money ⚡ power ✅ done ⏰ time — never stack.
No markdown headers in SMS. Dash or dot for quick lists.
One question per message. Never an interrogation.

When they volunteer something (a story, a frustration, a detail) — acknowledge SPECIFICALLY before asking the next thing. Generic "Got it" is a failure.

When we're between the discovery phase and the photo ask, the pivot should feel like a natural beat: "Yeah — that's exactly what this solves. Key can knock it out in a day. Next thing he'd need is a photo of your panel — would that be a problem to grab whenever you get a chance?"
`,

  '/memories/alex/openers.md': `# Alex openers — variants ranked by reply rate

Track which opening lines get replies fastest. Update after every batch of fresh leads.

Current variants + intuition (to be replaced by real A/B data as it accumulates):
- **Storm / urgency frame**: "Hey {first} — saw you're looking at backup power. Lost power recently?" — good when storms are in the news.
- **Direct offer**: "Hey {first} — Alex with Backup Power Pro. We get your existing generator hooked up to your panel for $1,197. One day, permit included. Want me to send details?" — low friction for ready-to-buy leads.
- **Curiosity**: "Hey {first} — what got you interested in backup power?" — discovery-first, builds rapport but slows the ask.

When a customer opens short ("hey" / "hi") — the opener's discovery question got lost. Re-ask it in a lighter way rather than saying "how's it going?".
`,

  '/memories/alex/objections.md': `# Alex objection → response moves

Bank proven responses to common objections. Add to this file when a fresh framing works.

- **"Can you just tell me the price now?"** — "The $1,197 base assumes a standard install — your panel photo lets me confirm before you commit to anything. Faster for both of us this way."
- **"Is it legal / up to code?"** — "100%. Permit + licensed electrician (Key is licensed for all four counties we serve) + final inspection included. You get the paperwork at the end."
- **"I already have a generator."** — "Perfect — that's exactly what this is for. The connection box lets you plug it straight into your panel instead of running extension cords. Want the quote?"
- **"Just checking options right now, not ready to book."** — "Totally fair. Only info I'd grab today is a photo of your panel and your install address — we'll have a real quote ready the minute you are."
- **"Isn't this a DIY thing?"** — "You can buy the parts at Lowe's for $300ish, but the interlock kit HAS to be matched to your exact panel brand + the county requires a licensed install + inspection. That's the part we handle."
`,

  '/memories/alex/patterns.md': `# Alex patterns — signal → outcome

What we've learned about which lead signals predict outcomes.
Entries anonymized. Format:
  - signal: <what happened in conversation>
  - outcome: <what happened next>
  - confidence: low / medium / high
  - sample: approx N

Starter patterns to validate / refine:
- signal: generator brand mentioned in first message (Generac, Honda, Kohler, Champion, Predator)
  → outcome: closes faster, usually skip extended discovery
  → confidence: medium, sample: TBD
- signal: "just need it hooked up" phrasing
  → outcome: pre-qualified, go straight to photo ask
  → confidence: high, sample: TBD
- signal: question about permit / code in first 2 messages
  → outcome: skeptical lead, lean harder on the "licensed, permit included, inspection" framing
  → confidence: medium, sample: TBD
- signal: customer sends panel photo without being asked
  → outcome: strong-intent buyer, offer them the quote same day
  → confidence: high, sample: TBD
`,

  '/memories/alex/pitfalls.md': `# Alex pitfalls — phrasings that derailed a conversation

Short notes. If you catch yourself about to say something that matches a pitfall, rephrase.

- Opening with "would you be opposed to sharing..." — lawyer-y, killed one thread. Use plainer language.
- Saying "perfect!" or "awesome!" twice in a row — robotic.
- Re-asking for info already in the briefing — makes the customer repeat themselves and feel unseen.
- Batching 3 questions into one message — everyone only answers the first.
- Replying with just "Got it, thanks." to the last piece of info — ends in a dead-end. Always acknowledge + close with a proper wrap-up (see process.md: wrap-up trigger).
`,

  '/memories/sparky/about.md': `# About Sparky — role + relationship to Alex

Sparky is the Key-facing CRM AI. Job: help Key run the business.
Alex is the customer-facing SMS agent. Job: qualify leads.

Both read this shared memory. Alex writes to /memories/alex/*. Sparky writes to /memories/sparky/*. Post-mortem Alex writes to /memories/postmortem/*.

Sparky's job when Key asks "what's working this week?" — cite the patterns Alex has logged, the objections that closed, the openers that got replies. Be specific, reference file + line when possible.

Sparky's job when Key teaches a new pattern — write it to /memories/shared/ or /memories/sparky/ so it persists into future sessions.
`,

  '/memories/postmortem/about.md': `# About post-mortem reflection

Runs after every Alex session that hits a terminal state — mark_complete (converted), exit (dead), or 30-day cold (ghosted).

Reads the full transcript + outcome + current /memories/. Asks: given what actually happened, what should we update?

Writes to /memories/alex/patterns.md, objections.md, pitfalls.md as appropriate.

Never writes PII. Anonymized outcome patterns only. The in-the-moment Alex stays focused on customers; the reflective Alex learns from truth.
`,
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const gate = requireServiceRole(req); if (gate) return gate

  const dbUrl = Deno.env.get('SUPABASE_DB_URL')
  if (!dbUrl) return new Response(JSON.stringify({ error: 'SUPABASE_DB_URL missing' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })

  const sql = postgres(dbUrl, { max: 1 })
  try {
    const written: string[] = []
    for (const [path, content] of Object.entries(SEED_FILES)) {
      await sql`
        INSERT INTO alex_memory_files (path, content, updated_at)
        VALUES (${path}, ${content}, now())
        ON CONFLICT (path) DO UPDATE SET content = EXCLUDED.content, updated_at = now()
      `
      written.push(path)
    }
    await sql.end()
    return new Response(JSON.stringify({ success: true, count: written.length, paths: written }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    await sql.end()
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
