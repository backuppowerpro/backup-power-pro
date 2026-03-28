import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { db } from '../db.js'
import { runAutoArchive } from '../archive.js'

const router = Router()

// Rate limit: 50 req/min on webhook endpoint
const webhookLimiter = rateLimit({
  windowMs: 60_000,
  max: 50,
  message: { error: 'Too many webhook requests' },
  standardHeaders: true,
})
router.use(webhookLimiter)

// Shared secret auth
router.use((req, res, next) => {
  const secret = process.env.WEBHOOK_SECRET
  const provided = req.headers['x-webhook-secret']
  if (!secret || !provided || provided !== secret) {
    return res.status(403).json({ error: 'Forbidden — invalid webhook secret' })
  }
  next()
})

// Helper: find person by phone or email (for matching incoming webhooks)
function findPerson(phone, email) {
  if (phone) {
    const normalized = phone.replace(/\D/g, '')
    // Try exact, then last 10 digits
    const byPhone = db.prepare(
      "SELECT * FROM people WHERE replace(replace(replace(phone, '-', ''), '(', ''), ')', '') LIKE ?"
    ).get(`%${normalized}`)
    if (byPhone) return byPhone
  }
  if (email) {
    const byEmail = db.prepare('SELECT * FROM people WHERE lower(email) = lower(?)').get(email)
    if (byEmail) return byEmail
  }
  return null
}

// Helper: upsert person at a given stage (won't regress stage)
function upsertPersonAtStage(name, phone, email, targetStage, source) {
  const existing = findPerson(phone, email)

  if (existing) {
    // Don't regress stage — only advance
    if (existing.stage < targetStage) {
      const prevStage = existing.stage
      db.prepare(
        "UPDATE people SET stage = ?, stage_updated_at = datetime('now'), is_archived = 0, archive_reason = NULL WHERE id = ?"
      ).run(targetStage, existing.id)
      db.prepare(
        'INSERT INTO stage_events (person_id, from_stage, to_stage, source) VALUES (?, ?, ?, ?)'
      ).run(existing.id, prevStage, targetStage, source)
    }
    // Re-fetch to return current state (including updated stage)
    return db.prepare('SELECT * FROM people WHERE id = ?').get(existing.id)
  }

  // Create new person
  const result = db.prepare(
    "INSERT INTO people (name, phone, email, stage, stage_updated_at) VALUES (?, ?, ?, ?, datetime('now'))"
  ).run(name || 'Unknown', phone || null, email || null, targetStage)

  db.prepare(
    'INSERT INTO stage_events (person_id, from_stage, to_stage, source) VALUES (?, NULL, ?, ?)'
  ).run(result.lastInsertRowid, targetStage, source)

  return db.prepare('SELECT * FROM people WHERE id = ?').get(result.lastInsertRowid)
}

// Helper: log webhook to webhook_log table
function logWebhook(eventType, payloadSummary, personId) {
  db.prepare(
    'INSERT INTO webhook_log (event_type, payload_summary, person_id) VALUES (?, ?, ?)'
  ).run(eventType, JSON.stringify(payloadSummary).slice(0, 500), personId || null)
}

// POST /api/webhook
router.post('/', (req, res) => {
  const { event_type, name, phone, email } = req.body

  if (!event_type) {
    return res.status(400).json({ error: 'event_type is required' })
  }

  let person = null
  let action = 'unknown'

  try {
    switch (event_type) {
      case 'quote_form_submitted':
        // BPP quote form → stage 1 (Form Submitted)
        person = upsertPersonAtStage(name, phone, email, 1, 'webhook')
        action = 'created_or_found_at_stage_1'
        break

      case 'quo_sms_replied':
        // Quo SMS first reply → stage 2 (Responded)
        person = upsertPersonAtStage(name, phone, email, 2, 'webhook')
        action = 'advanced_to_stage_2'
        break

      case 'dubsado_project_status_updated':
        // Flexible → stage 3 (Quote Sent) by default
        person = upsertPersonAtStage(name, phone, email, 3, 'webhook')
        action = 'advanced_to_stage_3'
        break

      case 'dubsado_new_lead':
        // Dubsado new lead → stage 2 (fallback)
        person = upsertPersonAtStage(name, phone, email, 2, 'webhook')
        action = 'upserted_at_stage_2'
        break

      case 'dubsado_new_job':
        // Dubsado new job → stage 4 (Booked)
        person = upsertPersonAtStage(name, phone, email, 4, 'webhook')
        action = 'upserted_at_stage_4'
        break

      case 'dubsado_contract_signed':
        // Contract signed → stage 4 (Booked)
        person = upsertPersonAtStage(name, phone, email, 4, 'webhook')
        action = 'advanced_to_stage_4_booked'
        break

      case 'dubsado_payment_received':
        // Payment received → stage 9 (Complete) → auto-archive
        person = upsertPersonAtStage(name, phone, email, 9, 'webhook')
        action = 'completed_and_archiving'
        runAutoArchive()
        break

      default:
        logWebhook(event_type, req.body, null)
        return res.status(400).json({ error: `Unknown event_type: ${event_type}` })
    }

    logWebhook(event_type, { name, phone, email, action }, person?.id)

    res.json({
      success: true,
      event_type,
      action,
      person_id: person?.id,
      person_name: person?.name,
      person_stage: person?.stage,
    })
  } catch (err) {
    console.error('[WEBHOOK ERROR]', err)
    logWebhook(event_type, { error: err.message }, null)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
