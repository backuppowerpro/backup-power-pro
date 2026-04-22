/**
 * ai-taskmaster v2 — Sparky, the BPP CRM Agent
 *
 * Major upgrades from v1:
 *  - Full agentic loop: read-only tools run server-side (no round-trips to client)
 *  - 15 tools (10 new): edit_contact, get_contact_history, search_all_contacts,
 *    search_conversations, get_permit_status, schedule_install, flag_for_followup,
 *    update_materials, read_sparky_memory, write_sparky_memory + stubs for
 *    submit_permit_application and draft_customer_response_as_alex
 *  - Prompt caching on PERSONA_BLOCK (~90% cost reduction on persona tokens)
 *  - Persistent memory: sparky_memory Supabase table
 *  - Auto-extract contact info from SMS threads (address, panel brand, generator size)
 *  - Conversation + call transcription search across all contacts
 *  - Prepared for Alex/Sparky merger (context_source field)
 *  - Prepared for permit automation (submit_permit_application stub)
 *  - All modes unified on claude-sonnet-4-6; haiku for simple one-liners
 *
 * POST /ai-taskmaster
 * Body: {
 *   mode, question, contextSummary, history, contact, thread,
 *   context_source?  // "sparky" (default) | "alex" (future merger)
 * }
 *
 * sparky_memory table required (see schema below):
 *   CREATE TABLE IF NOT EXISTS sparky_memory (
 *     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     key text UNIQUE NOT NULL,
 *     value text NOT NULL,
 *     category text NOT NULL DEFAULT 'business',
 *     importance int NOT NULL DEFAULT 3,
 *     created_at timestamptz DEFAULT now(),
 *     updated_at timestamptz DEFAULT now()
 *   );
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

// Tools that execute server-side — no client confirmation needed
const SERVER_SIDE_TOOLS = new Set([
  'lookup_contact',
  'get_contact_history',
  'search_all_contacts',
  'search_conversations',
  'get_permit_status',
  'read_sparky_memory',
  'write_sparky_memory',
  'edit_contact',
  'start_permit_agent',
])

const MAX_AGENTIC_LOOPS = 8

// ──────────────────────────────────────────────────────────────────────
// AGENT PERSONA — cached via anthropic-beta: prompt-caching-2024-07-31
// ──────────────────────────────────────────────────────────────────────
const PERSONA_BLOCK = `You are Sparky — Key Goodson's sharp AI assistant employee at Backup Power Pro (BPP), a generator inlet installation business in Upstate South Carolina owned by Key Goodson.

You are NOT a generic AI assistant. You are an expert on BPP, Key's pipeline, and every customer in the CRM. You think ahead, take initiative, and get things done — like a great employee who knows the business cold.

VOICE
- Direct, no fluff, action-forward. Sharp colleague, not a robot.
- Use Key's name once or twice naturally. Never every sentence.
- Light emoji sparingly: 🔥 hot leads, ✅ done, ⏰ aging, 💰 big quotes, ✨ good news. Never stack them.
- Plain text. No markdown headers, no asterisks. Use dash or dot for lists.
- Short sentences. Skip throat-clearing ("Sure!", "Great question!"). Get to the point.

YOUR CAPABILITIES (use them proactively)
You have real tools. Use them. Don't ask Key for info you can look up yourself.
- Read any contact's full message history, permit status, materials, and details.
- Search all contacts by name, stage, jurisdiction, days quiet, or any criteria.
- Search across ALL conversations for keywords — SMS threads and call transcripts.
- Auto-update contacts when customers share their info over SMS.
- Draft SMS replies, advance pipeline stages, add notes, schedule installs, flag follow-ups.
- Remember Key's preferences and business context across sessions (persistent memory).
- When Key asks about someone: look them up first, then answer with real data.

AUTO-UPDATE RULE — CRITICAL
When a customer SMS thread contains new factual info about their setup (street address, panel brand, generator wattage or amperage, corrected name, zip code, jurisdiction) — call edit_contact immediately. Do NOT ask Key — just update and mention it in one line: "Updated [name]: address + panel brand."

MEMORY RULE
When you learn something about Key's preferences, patterns, or important business context — call write_sparky_memory. Examples: install day preferences, pricing decisions, subcontractor notes, business goals. Keep memories concise and categorized.

YOU KNOW BPP COLD
- Offer: "The Storm-Ready Connection System." Code-compliant inlet box + interlock kit + permit in one day, $1,197–$1,497 all-in.
- Customer already owns a portable generator. We unlock that sunk-cost investment instead of selling a $15K standby.
- Geography: Greenville, Spartanburg, Pickens counties ONLY. NEVER Anderson County.
- Primary channel: SMS. Response within 15 minutes is the make-or-break.
- Permits: always required. Greenville Co (~5d submit→pay), Spartanburg Co (~7d), Pickens Co (~5d).
- Service types: 30A (L14-30, most homes) and 50A (CS6365, 10kW+ generators).
- Materials per job: ~$250 (inlet box + interlock + cord + breaker + misc). Net ~$910–$1,067/job solo.
- Pipeline (9 stages): 1 Form Submitted → 2 Responded → 3 Quote Sent → 4 Booked → 5 Permit Submitted → 6 Permit Paid → 7 Permit Approved → 8 Inspection Scheduled → 9 Complete.

CUSTOMER PSYCHOLOGY (apply to all customer-facing copy)
- Sunk cost: "you already own the generator" — we unlock it.
- Loss framing beats gain framing. Storm urgency works. "Don't get caught in the dark again."
- Always anchor $15K standby BEFORE quoting our price.
- One day, all-inclusive, no surprises. Permit, inspection, cleanup — all included.
- "5 installs per week" is real scarcity — use sparingly.

NORTH STAR
Key's goal: $150K spendable profit in the Found business account by August–September 2026.
Bottlenecks in order:
1. Marketing — 3 leads/day at CPL < $30
2. Sales — 35–40% close rate, respond within 15 min
3. Production — hire first electrical sub to break the 5/week solo ceiling

ABSOLUTE RULES
- NEVER serve Anderson County.
- NEVER suggest skipping permits.
- NEVER price below $1,197.
- NEVER use email when SMS is available.
- NEVER fabricate data — if you don't know, look it up or say so.
- NEVER make a multi-step action without telling Key what you did.
- NEVER send an SMS without queuing it for Key's confirmation first.
- NEVER use send_sms_to_contact for a contact at stage 4 (Booked) or higher. Once a quote is approved and the job is booked, Key handles ALL client communication personally. No AI-drafted customer messages, no suggest_reply drafts intended to send, no draft_followup SMS. You can still look up their info, update notes, advance permit steps — just no outbound communication to the customer.
- NEVER skip a permit form field. Government reviewers are strict. Fill Project Name, Notes, Description of Work, and every applicable field. Put the scope of work in all text fields available — copy it into Project Name, Notes, and Description of Work. Incomplete forms get rejected or kicked back.
- NEVER identify yourself as "Sparky" in any message that goes to a customer. Sparky is your internal name — customers don't know it exists. All customer-facing AI communication uses the name "Alex." If a customer asks who they're talking to, the answer is Alex.

ALEX CONTEXT (future merger — prepare now)
Alex is BPP's customer-facing SMS agent currently running in Quo on (864) 400-5302.
When that number ports to Twilio, Alex and Sparky will share the same system.
When context_source is "alex": you are responding AS Alex to a real customer. Use warm, professional tone. Focus on qualifying (do they own a generator? what brand? where are they located?) and moving toward a booked install. Follow the sales sequence.
When context_source is "sparky" (default): you are talking directly to Key.

PERMIT AUTOMATION (LIVE — use start_permit_agent)
When Key asks to pull a permit or clicks "Pull Permit" on a contact, call start_permit_agent(contactId).
It returns the full application packet, jurisdiction portal, step-by-step instructions, and recommended next actions.
After briefing Key, always chain:
- update_permit_step(step: "submitted") once Key confirms they submitted
- flag_for_followup with the payment notification expected date
- change_contact_stage to stage 5 (Permit Submitted)

As the permit progresses, use update_permit_step for each milestone:
submitted → ready_to_pay → paid → ready_to_print → printed → inspect_scheduled → inspect_passed

Use save_permit_document when the permit number or document URL is confirmed.

Permit portal knowledge:
- Greenville County: eTRAKiT portal, ~5 days submit→payment notification
- City of Greenville: CivicPlus portal, ~4 days (city limits only)
- City of Greer: eTRAKiT portal, ~4 days
- Spartanburg County: email-based submission, ~7 days (slowest)
- Pickens County: online portal or call (864) 898-5830, ~5 days
- City of Simpsonville: InfoVision portal, ~4 days
- City of Mauldin: Citizenserve portal, ~5 days
- Always capture permit number via save_permit_document when county issues it.

PERMIT TYPE RULE — NEVER BREAK THIS:
Always use "RESIDENTIAL ELECTRICAL STANDALONE" — NEVER "Residential Generator" or any generator-type permit.
Using a generator permit type causes county reviewers to reject the application as the wrong type.
BPP installs inlet boxes and interlock kits only — no generator is installed.

SCOPE OF WORK — EXACT LANGUAGE (use every time, no paraphrasing):
"[AMP] amp generator inlet and interlock installation. This is not a generator install, just the box to plug a portable one in."
Add if surge protector was in the quote: "Includes whole-home surge protection device installation."
Add any other approved add-ons from the quote.
The amp comes from the contact's inlet type (30A or 50A). Default 30A if unknown.

CONTRACTOR INFO (Greenville County eTRAKiT):
Company: Key Electric LLC · License: 2942 · AEC: AEC001822`

// ──────────────────────────────────────────────────────────────────────
// MODE INSTRUCTIONS
// ──────────────────────────────────────────────────────────────────────

const MODE_CHAT = `MODE: CHAT — Key's action-forward CRM partner.

When Key asks about a contact: use lookup_contact or get_contact_history FIRST, then answer with real data. Never say "I don't know" when you can look it up.
When Key asks "what needs attention?" / "who should I text?" / "what's urgent?": call search_all_contacts with min_days_quiet filter, identify top 2–3 most urgent, immediately draft SMS for each with send_sms_to_contact. Key confirms before each sends.
When you learn Key's preferences: write_sparky_memory.
When you start a substantive chat: call read_sparky_memory first to load Key's context.

NEVER report a problem without executing the solution:
- Stalled lead → draft the SMS with send_sms_to_contact. Key confirms.
- Wrong stage → call change_contact_stage right after noting it.
- Missing info you can look up → look it up, don't ask Key.
- Contact shared info in thread → edit_contact immediately.

Keep spoken text under ~120 words. Tool calls ARE the answer — they show the work. Never pad with explanation.
Tone: "Found Ryan — 4 days quiet. Drafted a storm-angle text. Confirm to send." That's the voice.`

const MODE_SUGGEST_REPLY = `MODE: SUGGEST REPLY — Draft the next SMS to a customer AND auto-update contact if they shared info.

Step 1 (always first): Scan the message thread for any new factual info the customer shared:
- Street address or zip code → update address and jurisdiction fields
- Panel brand (Square D, Eaton, Siemens, Leviton, Murray, etc.) → update panel_brand
- Generator wattage or amperage (7500W, 30A, 50A, etc.) → update generator_amp
- Their name correction → update name
If found: call edit_contact immediately.

Step 2: Write ONE complete reply Key can send as-is.

Constraints:
- 1–3 sentences. Conversational. Use customer's first name.
- Match the tone of the most recent inbound message.
- Price question: anchor $15K standby, quote $1,197–$1,497.
- Timing question: "one-day install — got a couple openings this week."
- Permit question: "we handle the permit and inspection — it's included in the price."
- New lead with no question: "Thanks for reaching out — do you already own the generator, and what size is it?"
- Address question: ask for full street address and zip so we can confirm jurisdiction.
- Under 320 characters when possible.
- Stage-aware: Booked (4+) = confirmation tone. Quote Sent (3) = soft close. New (1–2) = warm intro.
- NEVER promise something you don't know. NEVER invent dates.

Output format:
[the message body]

RULES (CRITICAL — the CRM pastes your output directly into the SMS compose
bar and Key hits send):
- Output ONLY the drafted message body. No preamble, no analysis, no stage
  labels, no "this lead is at…", no "based on the conversation", no
  reasoning. Just the text Key would actually send.
- If you literally cannot draft a useful reply (totally empty thread,
  corrupted context), output one short ask: "Hey — mind sharing a bit more
  about what you're looking for?"
- If you called edit_contact, add ONE line after the message: "Updated:
  [what changed]" — the CRM strips this line before paste.`

const MODE_BRIEFING = `MODE: BRIEFING — Key's morning action brief.

First: check read_sparky_memory for any relevant context about Key's priorities or schedule.

Structure:
1. One opener: "Morning, Key. [most urgent situation in one clause]."
2. For each urgent item (max 3): one line naming person + situation, then:
   › [suggested SMS text]
   (CRM renders a Send button next to this › format)
3. One closing line: good news, or "pipeline is quiet — good problem to have."

Rules:
- Under 200 words total.
- Use (id:xxx) markers on all person names so the CRM renders clickable links.
- Suggested messages under 160 chars each, stage-aware.
- No generic advice. Every item ends with a specific action.
- If pipeline is genuinely empty, say so in one line.`

const MODE_CONTACT_INSIGHT = `MODE: CONTACT INSIGHT — ONE punchy line about this contact, under 110 characters.

Examples:
- "🔥 Quote sent 4d ago, no reply — nudge today."
- "⏰ Permit submitted 6d ago in Greenville Co, likely ready to pay."
- "✅ Booked but no install date — lock a day this week."
- "✨ New lead this morning — reply within 15 min for best close."
- "Materials picked but not ordered — add to next bulk run."
- "💰 50A job — check panel before quoting, could be $1,497."

Output ONE line. No preamble. Use one emoji or none. Never mention BPP or give generic advice.`

const MODE_DRAFT_FOLLOWUP = `MODE: DRAFT FOLLOWUP — A short check-in SMS for a quiet lead.

1–2 sentences. Friendly, low-pressure. Reference days quiet only if > 5 days. Open the door gently. Stage-aware: Quote Sent leads get a soft nudge, Responded leads get a qualifier.
Output the message body only. Nothing else.`

// ──────────────────────────────────────────────────────────────────────
// TOOLS
// ──────────────────────────────────────────────────────────────────────
const ALL_TOOLS = [
  // ── READ-ONLY: server-side execution ─────────────────────────────
  {
    name: 'lookup_contact',
    description: 'Search the CRM for a contact by name fragment, last name, or phone number. Returns up to 5 matches. Use before answering any question about a specific person.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name fragment, last name, or phone number to search.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_contact_history',
    description: 'Fetch the full message thread for a contact — SMS sent and received, plus any call transcripts. Use before answering questions about conversations with a specific person. Returns messages oldest-first.',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Contact UUID.' },
        limit: { type: 'integer', description: 'Number of messages to fetch (default 25, max 60).', default: 25 },
      },
      required: ['contactId'],
    },
  },
  {
    name: 'search_all_contacts',
    description: 'Search all CRM contacts with optional filters. Use when Key asks group questions like "who is overdue?", "any Greenville leads?", "who\'s at quote stage?", "who hasn\'t responded?".',
    input_schema: {
      type: 'object',
      properties: {
        stage: { type: 'integer', description: 'Filter by pipeline stage 1–9.', minimum: 1, maximum: 9 },
        jurisdiction: { type: 'string', description: 'Filter by jurisdiction name fragment (e.g. "Greenville").' },
        min_days_quiet: { type: 'integer', description: 'Only contacts with no outbound contact in at least this many days.' },
        query: { type: 'string', description: 'Text search in name or address.' },
        limit: { type: 'integer', description: 'Max results (default 15, max 30).', default: 15 },
      },
      required: [],
    },
  },
  {
    name: 'search_conversations',
    description: 'Search across ALL contact message threads and call transcripts for a keyword or phrase. Use when Key asks "has anyone mentioned X?", "find the person who said Y", "search for panel brand Z", or wants to query conversation history. Returns matching snippets with contact info.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword or phrase to search for in all conversations.' },
        limit: { type: 'integer', description: 'Max results (default 10, max 25).', default: 10 },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_permit_status',
    description: 'Get the full permit timeline for a contact — submitted date, payment status, printed, inspection scheduled and passed. Use when Key asks about a permit or when a contact is in stages 5–8.',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Contact UUID.' },
      },
      required: ['contactId'],
    },
  },
  {
    name: 'read_sparky_memory',
    description: "Read Key's persistent memory — his preferences, patterns, business context, and notes that carry across sessions. Call at the start of any substantive chat to load relevant context. Also call when Key asks 'what do you remember?' or 'do you know my...?'",
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional filter: "preference", "business", "contact", "schedule". Omit to get all top memories.' },
      },
      required: [],
    },
  },
  // ── WRITE: auto-execute server-side (no client confirmation) ─────
  {
    name: 'write_sparky_memory',
    description: "Save something to Key's persistent memory that should last across sessions. Use when Key states a preference, makes a policy decision, or when you observe a consistent pattern. Keep value concise (under 200 chars).",
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Unique snake_case key (e.g. "install_day_preference", "bank_goal_amount", "subcontractor_status").' },
        value: { type: 'string', description: 'The memory value, concise and specific.' },
        category: { type: 'string', enum: ['preference', 'business', 'contact', 'schedule'], description: '"preference" = Key\'s working preferences | "business" = BPP business context | "contact" = specific contact notes | "schedule" = timing/availability' },
        importance: { type: 'integer', description: '1–5. 5 = load every session, 1 = low priority.', minimum: 1, maximum: 5, default: 3 },
      },
      required: ['key', 'value', 'category'],
    },
  },
  {
    name: 'edit_contact',
    description: 'Update contact fields in the CRM. Auto-execute when a customer shares info over SMS (address, panel brand, generator size, name). Also use when Key asks you to update something specific.',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Contact UUID.' },
        fields: {
          type: 'object',
          description: 'Fields to update. Allowed: name, phone, address, jurisdiction, panel_brand, generator_amp, notes, email.',
          properties: {
            name: { type: 'string' },
            phone: { type: 'string' },
            address: { type: 'string' },
            jurisdiction: { type: 'string' },
            panel_brand: { type: 'string' },
            generator_amp: { type: 'string' },
            notes: { type: 'string' },
            email: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
      required: ['contactId', 'fields'],
    },
  },
  {
    name: 'start_permit_agent',
    description: "Read a contact's full info, resolve their jurisdiction, and generate a complete permit application packet. Call when Key asks to pull a permit or says 'pull permit for [name]'. Returns: portal URL, jurisdiction-specific step-by-step application instructions, pre-filled application data (homeowner name, address, scope, contractor info), typical timeline, and recommended next actions. After briefing Key, propose: update_permit_step(submitted) + flag_for_followup for payment notification date + change_contact_stage to 5.",
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Contact UUID.' },
      },
      required: ['contactId'],
    },
  },
  // ── WRITE: client-side (Key confirms before execution) ───────────
  {
    name: 'change_contact_stage',
    description: 'Move a contact to a new pipeline stage. Always tell Key what stage you\'re moving them to and why. Stage IDs: 1=Form Submitted, 2=Responded, 3=Quote Sent, 4=Booked, 5=Permit Submitted, 6=Permit Paid, 7=Permit Approved, 8=Inspection Scheduled, 9=Complete.',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Contact UUID.' },
        newStage: { type: 'integer', description: 'New stage 1–9.', minimum: 1, maximum: 9 },
      },
      required: ['contactId', 'newStage'],
    },
  },
  {
    name: 'send_sms_to_contact',
    description: 'Queue an SMS to a contact. Client shows Key the message for confirmation before sending. NEVER abbreviate — always include the complete message body ready to send. NEVER call this for contacts at stage 4 (Booked) or higher — Key handles all post-booking client communication personally.',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Contact UUID.' },
        message: { type: 'string', description: 'Complete SMS body, ready to send as-is.' },
      },
      required: ['contactId', 'message'],
    },
  },
  {
    name: 'add_note_to_contact',
    description: 'Append a timestamped internal note to a contact. Use for call outcomes, access notes, conversation summaries, material confirmations, or anything Key should remember. Client confirms before saving.',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Contact UUID.' },
        noteText: { type: 'string', description: 'Note body. Will be prefixed with today\'s date automatically.' },
      },
      required: ['contactId', 'noteText'],
    },
  },
  {
    name: 'schedule_install',
    description: 'Set an install date and optional time slot for a contact. Client confirms. If contact is not yet Booked (stage 4), also propose advancing the stage.',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Contact UUID.' },
        scheduledDate: { type: 'string', description: 'Install date in YYYY-MM-DD format.' },
        timeSlot: { type: 'string', description: 'Optional time slot (e.g. "8am", "afternoon", "9am–noon").' },
      },
      required: ['contactId', 'scheduledDate'],
    },
  },
  {
    name: 'flag_for_followup',
    description: 'Add a contact to the follow-up queue with a specific date and reason. Use when Key says "remind me", or when you identify a lead that needs attention in X days.',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Contact UUID.' },
        followupDate: { type: 'string', description: 'Follow-up date in YYYY-MM-DD format.' },
        reason: { type: 'string', description: 'Brief reason for the follow-up (e.g. "check if permit is ready to pay", "see if storm convinced them").' },
      },
      required: ['contactId', 'followupDate', 'reason'],
    },
  },
  {
    name: 'update_materials',
    description: 'Update the material notes for a contact — inlet type, panel brand, interlock, cord, and any material notes. Client confirms.',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Contact UUID.' },
        materials: {
          type: 'object',
          description: 'Material fields to update.',
          properties: {
            inlet_type: { type: 'string', description: 'e.g. "30A L14-30" or "50A CS6365"' },
            panel_brand: { type: 'string', description: 'e.g. "Square D", "Eaton", "Siemens", "Murray"' },
            interlock_brand: { type: 'string', description: 'e.g. "Reliance", "Siemens"' },
            cord_type: { type: 'string', description: 'e.g. "30A 25ft L14-30"' },
            notes: { type: 'string', description: 'Any other material-specific notes.' },
          },
        },
      },
      required: ['contactId', 'materials'],
    },
  },
  {
    name: 'update_permit_step',
    description: "Advance the permit tracker for a contact to a completed step. Key confirms in the CRM before the tracker updates. Always propose this after Key confirms a permit milestone happened. Steps in order: submitted → ready_to_pay → paid → ready_to_print → printed → inspect_scheduled → inspect_passed.",
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Contact UUID.' },
        step: {
          type: 'string',
          description: 'The step to mark as complete.',
          enum: ['submitted', 'ready_to_pay', 'paid', 'ready_to_print', 'printed', 'inspect_scheduled', 'inspect_passed'],
        },
        date: { type: 'string', description: 'Date for this step in YYYY-MM-DD format. Defaults to today if omitted.' },
      },
      required: ['contactId', 'step'],
    },
  },
  {
    name: 'save_permit_document',
    description: 'Save a permit document URL and/or permit number to a contact record. Call when Key provides the permit number or document URL from the county portal. Client confirms before saving.',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Contact UUID.' },
        documentUrl: { type: 'string', description: 'URL to the permit document on the county portal.' },
        permitNumber: { type: 'string', description: 'Permit number issued by the county (e.g. "GC-2026-12345").' },
      },
      required: ['contactId'],
    },
  },
  // ── FUTURE STUBS: documented and ready for activation ────────────
  {
    name: 'submit_permit_application',
    description: '[FUTURE — NOT YET ACTIVE] Will submit a permit application to the appropriate county portal automatically. Currently disabled. When called, explain the manual steps Key needs to take for that jurisdiction and flag the contact with a note.',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Contact UUID.' },
        jurisdiction: { type: 'string', description: 'County jurisdiction (e.g. "Greenville County", "Spartanburg County", "Pickens County").' },
        applicantName: { type: 'string', description: 'Property owner name for the permit.' },
        propertyAddress: { type: 'string', description: 'Full property address.' },
      },
      required: ['contactId', 'jurisdiction'],
    },
  },
  {
    name: 'draft_customer_response_as_alex',
    description: '[FUTURE — Alex/Sparky merger] Draft a customer-facing SMS in Alex\'s voice: warm, professional, qualification-focused. Currently handled by suggest_reply mode. This tool will be activated when the Quo number (864-400-5302) ports to Twilio and Alex/Sparky merge into one system.',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Contact UUID.' },
        context: { type: 'string', description: 'Brief context about what the customer asked or said.' },
        goal: { type: 'string', description: 'What we want from this interaction (qualify, book, close, handle objection).', enum: ['qualify', 'book', 'close', 'handle_objection', 'confirm'] },
      },
      required: ['contactId', 'context'],
    },
  },
]

// ──────────────────────────────────────────────────────────────────────
// SUPABASE CLIENT
// ──────────────────────────────────────────────────────────────────────
function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
}

// ──────────────────────────────────────────────────────────────────────
// SPARKY ACTIVITY LOG WRITER
// Appends a __sk_log_<timestamp> line to install_notes for audit trail.
// Key can see every action Sparky took on a contact, with timestamp.
// ──────────────────────────────────────────────────────────────────────
async function writeSparkLog(supabase: any, contactId: string, action: string, detail: string): Promise<void> {
  try {
    const { data: cur } = await supabase
      .from('contacts')
      .select('install_notes')
      .eq('id', contactId)
      .single()
    const existing = (cur?.install_notes || '').trimEnd()
    const ts = new Date().toISOString()
    const key = `__sk_log_${Date.now()}`
    // Truncate detail to 300 chars to keep notes manageable
    const safeDetail = detail.replace(/\|/g, '·').slice(0, 300)
    const logLine = `${key}: ${ts}|${action}|${safeDetail}`
    const updated = existing ? `${existing}\n${logLine}` : logLine
    await supabase
      .from('contacts')
      .update({ install_notes: updated })
      .eq('id', contactId)
  } catch (_) {
    // Log failures are non-fatal — never block the main tool from returning
  }
}

// ──────────────────────────────────────────────────────────────────────
// SERVER-SIDE TOOL EXECUTORS
// ──────────────────────────────────────────────────────────────────────
async function executeTool(name: string, input: any, supabase: any): Promise<any> {
  try {
    switch (name) {

      case 'lookup_contact': {
        const q = (input.query || '').toString().trim()
        // contacts table: id, name, phone, email, address, stage, status, notes, install_notes, jurisdiction_id, quote_amount, created_at
        const { data, error } = await supabase
          .from('contacts')
          .select('id, name, phone, stage, status, address, quote_amount, created_at')
          .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
          .limit(5)
        if (error) return { error: error.message }
        return { contacts: data || [], count: (data || []).length }
      }

      case 'get_contact_history': {
        const limit = Math.min(Number(input.limit) || 30, 60)
        // messages table: id, contact_id, direction, body, created_at, status, duration_seconds
        const { data, error } = await supabase
          .from('messages')
          .select('direction, body, created_at, status, duration_seconds')
          .eq('contact_id', input.contactId)
          .order('created_at', { ascending: true })
          .limit(limit)
        if (error) return { error: error.message }
        return { messages: data || [], count: (data || []).length }
      }

      case 'search_all_contacts': {
        const limit = Math.min(Number(input.limit) || 15, 30)
        // Only real columns: id, name, phone, email, address, stage, status, notes, install_notes, jurisdiction_id, quote_amount, created_at
        let q = supabase
          .from('contacts')
          .select('id, name, phone, stage, status, address, notes, quote_amount, created_at')
          .order('created_at', { ascending: false })
          .limit(limit)
        if (input.stage) q = q.eq('stage', Number(input.stage))
        if (input.status) q = q.eq('status', input.status)
        if (input.query) q = q.or(`name.ilike.%${input.query}%,address.ilike.%${input.query}%,phone.ilike.%${input.query}%`)
        // min_days_quiet: filter by created_at as proxy (messages table not joined here)
        if (input.min_days_quiet) {
          const cutoff = new Date()
          cutoff.setDate(cutoff.getDate() - Number(input.min_days_quiet))
          q = q.lt('created_at', cutoff.toISOString())
        }
        const { data, error } = await q
        if (error) return { error: error.message }
        return { contacts: data || [], count: (data || []).length }
      }

      case 'search_conversations': {
        const query = (input.query || '').toString().trim()
        const limit = Math.min(Number(input.limit) || 10, 25)
        if (!query) return { error: 'query is required' }
        // Search messages body, then enrich with contact name via separate query
        const { data: msgs, error } = await supabase
          .from('messages')
          .select('id, contact_id, direction, body, created_at')
          .ilike('body', `%${query}%`)
          .order('created_at', { ascending: false })
          .limit(limit)
        if (error) return { error: error.message }
        if (!msgs || msgs.length === 0) return { results: [], count: 0, query }
        // Get unique contact IDs to fetch names
        const contactIds = [...new Set(msgs.map((m: any) => m.contact_id))]
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, name, stage')
          .in('id', contactIds)
        const contactMap: Record<string, any> = {}
        for (const c of (contacts || [])) contactMap[c.id] = c
        return {
          results: msgs.map((m: any) => ({
            contact_id: m.contact_id,
            contact_name: contactMap[m.contact_id]?.name || 'Unknown',
            contact_stage: contactMap[m.contact_id]?.stage,
            direction: m.direction,
            snippet: m.body?.slice(0, 300),
            created_at: m.created_at,
          })),
          count: msgs.length,
          query,
        }
      }

      case 'get_permit_status': {
        // contacts table has: stage, jurisdiction_id, notes. Permit status = pipeline stage.
        // Stage 5=Permit Submitted, 6=Permit Paid, 7=Permit Approved, 8=Inspection Scheduled, 9=Complete
        const { data: contact, error } = await supabase
          .from('contacts')
          .select('id, name, stage, status, notes, install_notes, jurisdiction_id')
          .eq('id', input.contactId)
          .single()
        if (error) return { error: error.message }
        // Also pull recent stage history for timeline
        const { data: history } = await supabase
          .from('stage_history')
          .select('from_stage, to_stage, changed_at')
          .eq('contact_id', input.contactId)
          .order('changed_at', { ascending: true })
        const stageNames: Record<number,string> = {
          1:'Form Submitted',2:'Responded',3:'Quote Sent',4:'Booked',
          5:'Permit Submitted',6:'Permit Paid',7:'Permit Approved',8:'Inspection Scheduled',9:'Complete'
        }
        const permitHistory = (history || [])
          .filter((h: any) => h.to_stage >= 5)
          .map((h: any) => ({ stage: stageNames[h.to_stage] || `Stage ${h.to_stage}`, date: h.changed_at }))
        return {
          contact_id: contact.id,
          name: contact.name,
          current_stage: contact.stage,
          current_stage_name: stageNames[contact.stage] || `Stage ${contact.stage}`,
          permit_history: permitHistory,
          notes: contact.notes,
          install_notes: contact.install_notes,
        }
      }

      case 'read_sparky_memory': {
        let q = supabase
          .from('sparky_memory')
          .select('key, value, category, importance, updated_at')
          .gte('importance', 2)
          .order('importance', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(25)
        if (input.category) q = q.eq('category', input.category)
        const { data, error } = await q
        if (error) {
          // Table likely doesn't exist yet
          return { memories: [], note: 'sparky_memory table not yet created — run the schema migration. See edge function header for SQL.' }
        }
        return { memories: data || [], count: (data || []).length }
      }

      case 'write_sparky_memory': {
        const { error } = await supabase
          .from('sparky_memory')
          .upsert(
            {
              key: input.key,
              value: input.value,
              category: input.category || 'business',
              importance: input.importance || 3,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'key' },
          )
        if (error) return { error: error.message, note: 'Memory not saved — sparky_memory table may not exist.' }
        return { saved: true, key: input.key, category: input.category }
      }

      case 'edit_contact': {
        // Real contacts columns: name, phone, email, address, stage, status, notes, install_notes, jurisdiction_id, quote_amount
        // panel_brand/generator info goes into notes since there's no dedicated column yet
        const allowed = new Set(['name', 'phone', 'address', 'notes', 'install_notes', 'email', 'stage', 'status'])
        const updateFields: Record<string, any> = {}
        for (const [k, v] of Object.entries(input.fields || {})) {
          if (allowed.has(k) && v !== undefined && v !== null && v !== '') {
            updateFields[k] = v
          }
        }
        // Auto-append panel/generator info to notes if provided (no dedicated column)
        const extras: string[] = []
        if ((input.fields as any)?.panel_brand) extras.push(`Panel: ${(input.fields as any).panel_brand}`)
        if ((input.fields as any)?.generator_amp) extras.push(`Generator: ${(input.fields as any).generator_amp}`)
        if (extras.length && !updateFields.notes) {
          // Fetch current notes to append
          const { data: cur } = await supabase.from('contacts').select('notes').eq('id', input.contactId).single()
          updateFields.notes = [(cur?.notes || '').trim(), ...extras].filter(Boolean).join('\n')
        }
        if (!Object.keys(updateFields).length) return { error: 'No valid fields provided to update.' }
        const { error } = await supabase
          .from('contacts')
          .update(updateFields)
          .eq('id', input.contactId)
        if (error) return { error: error.message }
        // Log the edit for audit trail
        const editSummary = Object.entries(updateFields)
          .map(([k, v]) => `${k}: "${String(v).slice(0, 50)}"`)
          .join(', ')
        await writeSparkLog(supabase, input.contactId, 'edit_contact', `Fields updated: ${editSummary}`)
        return { updated: true, fields: Object.keys(updateFields), contactId: input.contactId }
      }

      case 'start_permit_agent': {
        if (!input.contactId) return { error: 'contactId required' }

        // Fetch contact
        const { data: contact, error: cErr } = await supabase
          .from('contacts')
          .select('id, name, phone, address, stage, notes, install_notes, jurisdiction_id, quote_amount')
          .eq('id', input.contactId)
          .single()
        if (cErr || !contact) return { error: cErr?.message || 'Contact not found' }

        // Fetch jurisdiction record
        let jurRecord: any = null
        if (contact.jurisdiction_id) {
          const { data: jd } = await supabase
            .from('permit_jurisdictions')
            .select('id, name, link1_url, portal_url, notes')
            .eq('id', contact.jurisdiction_id)
            .single()
          jurRecord = jd
        }

        const jurName: string = jurRecord?.name || ''
        const portalUrl: string = jurRecord?.link1_url || jurRecord?.portal_url || ''

        // Parse existing permit data from install_notes
        const installNotes = contact.install_notes || ''
        const rdPm = (key: string): string => {
          const m = installNotes.match(new RegExp('^__pm_' + key + ':\\s*(.*)$', 'm'))
          return m ? (m[1] || '').trim() : ''
        }
        const existingPermitNum = rdPm('pnum')
        const existingSubmitted = rdPm('psub')
        const existingDoc = rdPm('pdoc')

        // Parse panel/generator info appended to notes by edit_contact
        const panelMatch = (contact.notes || '').match(/^Panel:\s*(.+)$/m)
        const panelBrand = panelMatch ? panelMatch[1].trim() : ''
        const genMatch = (contact.notes || '').match(/^Generator:\s*(.+)$/m)
        const generatorInfo = genMatch ? genMatch[1].trim() : ''

        // Build scope of work — use Key's exact approved language.
        // CRITICAL: permit type is RESIDENTIAL ELECTRICAL STANDALONE, NOT "Residential Generator".
        // Using "generator installation" language causes county reviewers to reject as wrong permit type.
        const inletStr = rdPm('minlet') || generatorInfo || ''
        const ampMatch = inletStr.match(/(\d+)A/i)
        const amp = ampMatch ? ampMatch[1] : '30'
        const hasSurge = rdPm('msurge') === '1'
        const scopeParts: string[] = [
          `${amp} amp generator inlet and interlock installation. This is not a generator install, just the box to plug a portable one in.`,
        ]
        if (hasSurge) scopeParts.push('Includes whole-home surge protection device installation.')
        // Additional work from materials notes or contact notes — Key sometimes quotes extra items
        const matNotes = rdPm('mnotes') || ''
        if (matNotes) scopeParts.push(matNotes.trim())
        const scopeOfWork = scopeParts.join(' ')
        // Surface raw notes so Sparky can spot any additional quoted work not captured above
        const additionalWorkCheck = (contact.notes || '').trim()

        // Jurisdiction-specific portal + process knowledge
        const jurKnowledge: Record<string, any> = {
          'Greenville County': {
            portal_label: 'eTRAKiT',
            portal_hint: portalUrl || 'grvlc-trk.aspgov.com/eTRAKiT/',
            days_to_pay: 5,
            fee: '$50–$100',
            steps: [
              'Log into eTRAKiT (grvlc-trk.aspgov.com/eTRAKiT/) with AEC001822',
              'Click "Apply / New Permit" → agree to confirmation → Continue',
              'Permit Type: select "RESIDENTIAL ELECTRICAL STANDALONE" — NOT "Residential Generator"',
              'Search address by street address, select the matching parcel',
              'Paste scope of work from the packet below into the Notes field',
              'Step 2: Fill owner info (name, address, phone, email)',
              'Step 3: Contractor info auto-fills from AEC login — verify license 2942',
              'Step 4: Review everything, then Submit',
              'Expect payment notification email in ~5 business days',
            ],
          },
          'City of Greenville': {
            portal_label: 'CivicPlus',
            portal_hint: portalUrl || 'CivicPlus portal (city limits only)',
            days_to_pay: 4,
            fee: '$50–$100',
            steps: [
              'Log into City of Greenville CivicPlus portal (city limits only)',
              'Apply → Electrical Permit — use "RESIDENTIAL ELECTRICAL STANDALONE" type',
              'Do NOT select Generator permit type — causes rejection',
              'Fill homeowner info + scope of work from packet below',
              'Expect payment notice in ~4 business days',
            ],
          },
          'City of Greer': {
            portal_label: 'eTRAKiT',
            portal_hint: portalUrl || 'City of Greer eTRAKiT portal',
            days_to_pay: 4,
            fee: '$50–$100',
            steps: [
              'Log into City of Greer eTRAKiT portal',
              'Apply → Electrical Permit → select "RESIDENTIAL ELECTRICAL STANDALONE"',
              'Fill homeowner info + scope of work from packet below',
              'Expect payment notification in ~4 business days',
            ],
          },
          'City of Mauldin': {
            portal_label: 'Citizenserve',
            portal_hint: portalUrl || 'Citizenserve portal',
            days_to_pay: 5,
            fee: '$50–$100',
            steps: [
              'Log into the Citizenserve portal — City of Mauldin',
              'Apply → Electrical Permit → fill homeowner info + scope of work',
              'Expect ~5 business days for payment notification',
            ],
          },
          'City of Simpsonville': {
            portal_label: 'InfoVision',
            portal_hint: portalUrl || 'InfoVision portal',
            days_to_pay: 4,
            fee: '$50–$100',
            steps: [
              'Log into the InfoVision portal — City of Simpsonville',
              'Apply → Electrical Permit → fill homeowner info + scope of work',
              'Expect ~4 business days for payment notification',
            ],
          },
          'Fountain Inn': {
            portal_label: 'iWorq',
            portal_hint: portalUrl || 'iWorq portal',
            days_to_pay: 5,
            fee: '$50–$100',
            steps: [
              'Go to iWorq portal — City of Fountain Inn',
              'Call to confirm current process if needed',
              'Apply for Electrical Permit — scope of work from packet below',
              'Expect ~5 business days for payment notification',
            ],
          },
          'Spartanburg County': {
            portal_label: 'Online portal or email',
            portal_hint: portalUrl || 'onlineservices.spartanburgcounty.org',
            days_to_pay: 7,
            fee: '$60–$120',
            steps: [
              'Go to onlineservices.spartanburgcounty.org → Building & Codes → New Permit',
              'Select Electrical → Generator Inlet Installation',
              'Fill in homeowner info + scope of work from packet below',
              'Note: this is the slowest jurisdiction — expect ~7 business days for payment notification',
              'Follow up by phone if no notice in 5 days: Spartanburg County Building & Codes',
            ],
          },
          'Pickens County': {
            portal_label: 'Online portal or phone',
            portal_hint: portalUrl || 'Pickens County Building & Codes portal',
            days_to_pay: 5,
            fee: '$50–$100',
            steps: [
              'Visit the Pickens County Building & Codes online portal',
              'Alternative: call (864) 898-5830 to submit by phone',
              'Apply for Electrical Permit — scope of work from packet below',
              'Expect ~5 business days for payment notification',
            ],
          },
        }

        const jInfo = jurKnowledge[jurName] || {
          portal_label: portalUrl ? 'County Portal' : 'County Building & Codes dept',
          portal_hint: portalUrl || 'Contact the county/city building & codes department',
          days_to_pay: 5,
          fee: '$50–$150',
          steps: [
            'Contact the county/city building & codes department',
            'Request an Electrical permit for generator inlet and interlock kit installation',
            'Provide homeowner name, property address, and BPP contractor license number',
            'Ask about timeline for payment notification',
          ],
        }

        // Pre-filled application packet
        // PERMIT TYPE: always "RESIDENTIAL ELECTRICAL STANDALONE" — never "Residential Generator"
        // SCOPE: use Key's exact approved language — avoids rejection by reviewers who misread intent
        // FILL EVERY FIELD: government reviewers reject incomplete forms. Put scope in Project Name,
        // Notes, AND Description of Work. Cross every T. Dot every I.
        const packet = {
          applicant_name: contact.name || '(name required)',
          property_address: contact.address || '(address required — update contact first)',
          owner_phone: contact.phone || '(phone required)',
          permit_type: 'RESIDENTIAL ELECTRICAL STANDALONE',
          permit_type_warning: 'Do NOT select "Residential Generator" — county reviewers will reject it as the wrong permit type',
          project_name: contact.name || '(name required)',
          // project_name = customer's name. Fills the "Project Name" field on eTRAKiT.
          scope_of_work: scopeOfWork,
          // scope_of_work goes into exactly 2 fields that explicitly ask for a work description:
          //   1. Notes (Step 1 general notes box)
          //   2. Description of Work (ELECTRIC STNDALN section)
          // Do NOT put it in Project Name, Bid Amount, amp fields, dropdowns, or anything not asking for a work description.
          estimated_value: contact.quote_amount ? `$${contact.quote_amount}` : '$1,197–$1,497',
          panel_brand: panelBrand || '(check contact notes / ask homeowner)',
          inlet_type: rdPm('minlet') || `${amp}A inlet`,
          surge_protector: hasSurge ? 'Yes — included in scope' : 'No',
          additional_work_notes: additionalWorkCheck || null,
          scope_review_note: 'Always check additional_work_notes and materials notes for any extra quoted items not captured above. Add them to scope if relevant.',
          contractor: 'Key Electric LLC',
          contractor_license: '2942',
          aec_number: 'AEC001822',
        }

        // Flags that block submission
        const flags: string[] = []
        if (!contact.address) flags.push('No address on file — update contact address before submitting')
        if (!contact.jurisdiction_id) flags.push('No jurisdiction selected — set it in the permit section first')
        if (!jurName) flags.push('Jurisdiction name missing — verify the permit_jurisdictions record')

        const result = {
          contact_name: contact.name,
          contact_id: contact.id,
          contact_stage: contact.stage,
          jurisdiction: jurName || '(not set)',
          portal_label: jInfo.portal_label,
          portal_url: jInfo.portal_hint || null,
          status: existingSubmitted
            ? 'already_submitted'
            : flags.length
            ? 'blocked_by_flags'
            : 'ready_to_submit',
          existing_permit_number: existingPermitNum || null,
          existing_submitted_date: existingSubmitted || null,
          existing_document_url: existingDoc || null,
          application_packet: packet,
          process_steps: jInfo.steps,
          typical_days_to_payment_notification: jInfo.days_to_pay,
          permit_fee_estimate: jInfo.fee,
          flags: flags.length ? flags : null,
          recommended_next_actions: flags.length
            ? ['Resolve the flags above, then call start_permit_agent again']
            : [
                `Open ${jInfo.portal_label} and submit the application using the packet above`,
                'After submitting: call update_permit_step(step: "submitted") to start the permit tracker',
                `Set a reminder: flag_for_followup ${jInfo.days_to_pay} business days out — "Check for permit payment notification"`,
                'Advance the pipeline: change_contact_stage to stage 5 (Permit Submitted)',
              ],
        }

        // Auto-log permit agent run for audit trail
        const logDetail = [
          `${amp}A inlet`,
          jurName || 'jurisdiction unknown',
          `bid: ${packet.estimated_value}`,
          hasSurge ? '+surge' : null,
          flags.length ? `FLAGS: ${flags.join('; ')}` : null,
        ].filter(Boolean).join(' · ')
        await writeSparkLog(supabase, input.contactId, 'start_permit_agent', `Permit packet generated · ${logDetail}`)
        return result
      }

      case 'submit_permit_application': {
        // Legacy stub — superseded by start_permit_agent
        const jur = (input.jurisdiction || 'your county').toString()
        return {
          status: 'not_yet_active',
          message: `Permit automation for ${jur} is not yet enabled. Here are the manual steps Key needs to take.`,
          manual_steps: {
            'Greenville County': 'Go to permits.greenvillecounty.org → Contractor Login → New Application → Electrical/Generator Inlet → fill homeowner info + contractor license.',
            'Spartanburg County': 'Go to onlineservices.spartanburgcounty.org → Building & Codes → New Permit → Electrical → Generator Inlet Installation.',
            'Pickens County': 'Call Pickens County Building & Codes at (864) 898-5830 or visit pickens.sc online portal → Electrical permit application.',
          }[jur] || 'Contact the county building & codes department for permit application instructions.',
        }
      }

      case 'draft_customer_response_as_alex': {
        return {
          status: 'stub',
          message: 'Alex/Sparky merger pending Quo port to Twilio. Use suggest_reply mode for now — it already handles customer-facing SMS drafting.',
        }
      }

      default:
        return { error: `Unknown server-side tool: ${name}` }
    }
  } catch (e) {
    return { error: `Tool execution error: ${String(e)}` }
  }
}

// ──────────────────────────────────────────────────────────────────────
// CLAUDE API CALL (with prompt caching)
// ──────────────────────────────────────────────────────────────────────
async function callClaude(
  apiKey: string,
  model: string,
  maxTokens: number,
  system: any[],
  messages: any[],
  tools?: any[],
): Promise<any> {
  const body: any = { model, max_tokens: maxTokens, system, messages }
  if (tools && tools.length) body.tools = tools

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`Claude API ${resp.status}: ${errText.slice(0, 500)}`)
  }

  return await resp.json()
}

// ──────────────────────────────────────────────────────────────────────
// AGENTIC LOOP
// ──────────────────────────────────────────────────────────────────────
async function runAgenticLoop(
  apiKey: string,
  model: string,
  maxTokens: number,
  system: any[],
  initialMessages: any[],
  tools: any[],
  supabase: any,
): Promise<{ answer: string; tool_calls: any[]; stop_reason: string; model: string }> {
  let messages = [...initialMessages]
  let answer = ''
  const clientToolCalls: any[] = []
  let lastModel = model

  for (let loop = 0; loop < MAX_AGENTIC_LOOPS; loop++) {
    const data = await callClaude(apiKey, model, maxTokens, system, messages, tools)
    lastModel = data.model || model

    const blocks: any[] = Array.isArray(data.content) ? data.content : []

    // Accumulate text
    for (const b of blocks) {
      if (b.type === 'text' && typeof b.text === 'string') {
        answer = answer ? answer + '\n' + b.text : b.text
      }
    }

    const toolUseBlocks = blocks.filter((b) => b.type === 'tool_use')

    // Done — no more tool calls
    if (data.stop_reason === 'end_turn' || !toolUseBlocks.length) {
      break
    }

    // Partition: server-side vs client-side
    const serverTools = toolUseBlocks.filter((b) => SERVER_SIDE_TOOLS.has(b.name))
    const clientTools = toolUseBlocks.filter((b) => !SERVER_SIDE_TOOLS.has(b.name))

    // Queue client tools for confirmation
    if (clientTools.length) {
      for (const b of clientTools) {
        clientToolCalls.push({
          id: b.id || ('tu_' + Math.random().toString(36).slice(2, 10)),
          name: b.name,
          input: b.input || {},
        })
      }
    }

    // Execute server-side tools
    const toolResults: any[] = []
    for (const b of serverTools) {
      const result = await executeTool(b.name, b.input || {}, supabase)
      toolResults.push({
        type: 'tool_result',
        tool_use_id: b.id,
        content: JSON.stringify(result),
      })
    }

    // Placeholder results for client tools (Claude needs a result for every tool_use)
    for (const b of clientTools) {
      toolResults.push({
        type: 'tool_result',
        tool_use_id: b.id,
        content: JSON.stringify({ queued: true, message: "Queued for Key's confirmation in the CRM." }),
      })
    }

    // Extend conversation
    messages = [
      ...messages,
      { role: 'assistant', content: blocks },
      { role: 'user', content: toolResults },
    ]

    // If client tools are pending, break and let the client handle them
    if (clientTools.length) {
      break
    }
  }

  return {
    answer: answer.trim(),
    tool_calls: clientToolCalls,
    stop_reason: 'done',
    model: lastModel,
  }
}

// ──────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────
function describeContact(c: any): string {
  if (!c) return '(no contact provided)'
  const lines: string[] = []
  if (c.id) lines.push(`id: ${c.id}`)
  if (c.name) lines.push(`name: ${c.name}`)
  if (c.phone) lines.push(`phone: ${c.phone}`)
  if (c.stageLabel || c.stage !== undefined) lines.push(`stage: ${c.stageLabel ?? c.stage}`)
  if (c.daysInSystem != null) lines.push(`days in system: ${c.daysInSystem}`)
  if (c.daysSinceTouch != null) lines.push(`days since last touch: ${c.daysSinceTouch}`)
  if (c.jurisdiction) lines.push(`jurisdiction: ${c.jurisdiction}`)
  if (c.address) lines.push(`address: ${c.address}`)
  if (c.scheduled) lines.push(`scheduled install: ${c.scheduled}`)
  if (c.permit && typeof c.permit === 'object') {
    const p = c.permit
    const bits: string[] = []
    if (p.submitted_at) bits.push(`submitted ${p.submitted_at}`)
    if (p.ready_to_pay_at) bits.push(`ready-to-pay ${p.ready_to_pay_at}`)
    if (p.paid_at) bits.push(`paid ${p.paid_at}`)
    if (p.printed_at) bits.push(`printed ${p.printed_at}`)
    if (p.inspect_sched_at) bits.push(`inspection ${p.inspect_sched_at}`)
    if (bits.length) lines.push('permit: ' + bits.join(' · '))
  }
  if (c.materials && typeof c.materials === 'object') {
    const m = c.materials
    const bits: string[] = []
    if (m.inlet) bits.push(m.inlet)
    if (m.panel_brand) bits.push(m.panel_brand)
    if (m.interlock) bits.push(m.interlock)
    if (m.ordered_at) bits.push('ordered ' + m.ordered_at)
    if (bits.length) lines.push('materials: ' + bits.join(' · '))
  }
  if (c.notes) lines.push('notes: ' + String(c.notes).slice(0, 500))
  return lines.join('\n')
}

function jsonResp(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// ──────────────────────────────────────────────────────────────────────
// REQUEST HANDLER
// ──────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405)

  let body: any = {}
  try { body = await req.json() } catch {
    return jsonResp({ error: 'invalid json' }, 400)
  }

  const mode = (body.mode || 'chat').toString()
  const question = (body.question || '').toString().trim()
  const contextSummary = (body.contextSummary || '').toString()
  const history: any[] = Array.isArray(body.history) ? body.history.slice(-14) : []
  const contact = body.contact && typeof body.contact === 'object' ? body.contact : null
  const thread = Array.isArray(body.thread) ? body.thread.slice(-35) : []
  const contextSource = (body.context_source || 'sparky').toString() // "sparky" | "alex"

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') || ''
  if (!apiKey) {
    return jsonResp({
      fallback: true, mode,
      answer: 'ANTHROPIC_API_KEY not configured on this edge function. Falling back to local rules.',
    })
  }

  const supabase = getSupabase()

  // ── System prompt: persona (cached) + mode instructions ────────
  const modeMap: Record<string, string> = {
    chat: MODE_CHAT,
    suggest_reply: MODE_SUGGEST_REPLY,
    briefing: MODE_BRIEFING,
    contact_insight: MODE_CONTACT_INSIGHT,
    draft_followup: MODE_DRAFT_FOLLOWUP,
  }

  const modeInstructions = modeMap[mode]
  if (!modeInstructions) {
    return jsonResp({ error: `Unknown mode: ${mode}` }, 400)
  }

  // Context source affects the persona tail
  const contextTail = contextSource === 'alex'
    ? '\n\nACTIVE CONTEXT: You are currently operating as Alex, responding to a real customer via SMS. Follow the ALEX CONTEXT rules in your persona.'
    : ''

  const system = [
    {
      type: 'text',
      text: PERSONA_BLOCK + contextTail,
      cache_control: { type: 'ephemeral' }, // cache the ~1,400-token persona block
    },
    {
      type: 'text',
      text: modeInstructions,
    },
  ]

  // ── Build messages + choose model + tools ───────────────────────
  let messages: any[] = []
  let maxTokens = 1200
  let tools: any[] | undefined

  if (mode === 'chat') {
    tools = ALL_TOOLS
    maxTokens = 2400
    if (!question) return jsonResp({ error: 'question required for chat mode' }, 400)

    // Load persistent memory at start of chat
    let memoryContext = ''
    try {
      const memResult = await executeTool('read_sparky_memory', {}, supabase)
      if (memResult.memories && memResult.memories.length > 0) {
        memoryContext = "Key's saved memory:\n" +
          memResult.memories
            .map((m: any) => `- [${m.category}/${m.importance}] ${m.key}: ${m.value}`)
            .join('\n') +
          '\n\n'
      }
    } catch (_) { /* graceful — memory may not exist */ }

    const userContent = contextSummary
      ? `${memoryContext}Current CRM snapshot:\n${contextSummary}\n\nKey's question:\n${question}`
      : `${memoryContext}${question}`

    messages = [
      ...history.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content),
      { role: 'user', content: userContent },
    ]

  } else if (mode === 'suggest_reply') {
    // Only enable edit_contact in suggest_reply — auto-extract contact info from SMS
    tools = ALL_TOOLS.filter((t) => t.name === 'edit_contact')
    maxTokens = 600
    if (!contact) return jsonResp({ error: 'contact required for suggest_reply mode' }, 400)
    const threadText = thread.length
      ? thread.map((m: any) => {
          const dir = m?.direction === 'inbound' ? 'CUSTOMER' : 'KEY'
          const body = (m?.body || '').toString().slice(0, 600)
          return `${dir}: ${body}`
        }).join('\n')
      : '(no prior messages — this is the first contact)'
    messages = [{
      role: 'user',
      content: `Contact:\n${describeContact(contact)}\n\nMessage thread (oldest → newest):\n${threadText}\n\nFirst check for extractable contact info, then write the reply.`,
    }]

  } else if (mode === 'briefing') {
    tools = ALL_TOOLS.filter((t) =>
      ['lookup_contact', 'get_contact_history', 'search_all_contacts', 'send_sms_to_contact', 'read_sparky_memory'].includes(t.name)
    )
    maxTokens = 600
    messages = [{
      role: 'user',
      content: contextSummary
        ? `CRM snapshot for morning brief:\n${contextSummary}`
        : 'No snapshot available. Check memory and pipeline directly.',
    }]

  } else if (mode === 'contact_insight') {
    tools = undefined
    maxTokens = 100
    if (!contact) return jsonResp({ error: 'contact required for contact_insight mode' }, 400)
    messages = [{ role: 'user', content: `Contact:\n${describeContact(contact)}\n\nWrite the one-line insight.` }]

  } else if (mode === 'draft_followup') {
    tools = undefined
    maxTokens = 280
    if (!contact) return jsonResp({ error: 'contact required for draft_followup mode' }, 400)
    messages = [{ role: 'user', content: `Contact:\n${describeContact(contact)}\n\nWrite the check-in message.` }]
  }

  // Model: haiku for simple one-liners (contact_insight, draft_followup),
  // opus for everything that uses tools or multi-step reasoning (Sparky is the boss — used less often, high stakes)
  const model = (mode === 'contact_insight' || mode === 'draft_followup')
    ? 'claude-haiku-4-5-20251001'
    : 'claude-opus-4-6'

  try {
    if (tools && tools.length) {
      // Full agentic loop
      const result = await runAgenticLoop(apiKey, model, maxTokens, system, messages, tools, supabase)
      return jsonResp({
        fallback: false,
        mode,
        answer: result.answer,
        tool_calls: result.tool_calls,
        stop_reason: result.stop_reason,
        model: result.model,
      })
    } else {
      // Single-turn (no tools)
      const data = await callClaude(apiKey, model, maxTokens, system, messages)
      const blocks: any[] = Array.isArray(data.content) ? data.content : []
      const answer = blocks
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim()
      return jsonResp({
        fallback: !answer,
        mode,
        answer: answer || 'No response generated.',
        tool_calls: [],
        stop_reason: data.stop_reason,
        model: data.model || model,
      })
    }
  } catch (err) {
    return jsonResp({
      fallback: true,
      mode,
      answer: 'Could not reach Claude API. Falling back to local rules.',
      debug: { error: String(err) },
    })
  }
})
