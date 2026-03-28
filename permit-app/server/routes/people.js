import { Router } from 'express'
import { db } from '../db.js'

const router = Router()

// GET /api/people — all people with days_in_stage computed
router.get('/', (req, res) => {
  const people = db.prepare(`
    SELECT *,
      CAST((julianday('now') - julianday(stage_updated_at)) AS INTEGER) as days_in_stage
    FROM people
    ORDER BY created_at DESC
  `).all()
  res.json(people)
})

// GET /api/people/:id
router.get('/:id', (req, res) => {
  const person = db.prepare(`
    SELECT *,
      CAST((julianday('now') - julianday(stage_updated_at)) AS INTEGER) as days_in_stage
    FROM people WHERE id = ?
  `).get(req.params.id)
  if (!person) return res.status(404).json({ error: 'Person not found' })
  res.json(person)
})

// POST /api/people — create
router.post('/', (req, res) => {
  const { name, phone, email, notes, stage = 1 } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })

  const result = db.prepare(
    "INSERT INTO people (name, phone, email, notes, stage, stage_updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
  ).run(name, phone || null, email || null, notes || null, stage)

  // Log initial stage event
  db.prepare(
    "INSERT INTO stage_events (person_id, from_stage, to_stage, source) VALUES (?, NULL, ?, 'manual')"
  ).run(result.lastInsertRowid, stage)

  const person = db.prepare('SELECT * FROM people WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(person)
})

// PATCH /api/people/:id — update (stage, details, archive)
router.patch('/:id', (req, res) => {
  const person = db.prepare('SELECT * FROM people WHERE id = ?').get(req.params.id)
  if (!person) return res.status(404).json({ error: 'Person not found' })

  const { name, phone, email, notes, stage, is_archived, archive_reason } = req.body
  const updates = {}

  if (name !== undefined) updates.name = name
  if (phone !== undefined) updates.phone = phone
  if (email !== undefined) updates.email = email
  if (notes !== undefined) updates.notes = notes
  if (is_archived !== undefined) updates.is_archived = is_archived ? 1 : 0
  if (archive_reason !== undefined) updates.archive_reason = archive_reason

  // Stage change — update timestamp and log event
  if (stage !== undefined && stage !== person.stage) {
    updates.stage = stage
    updates.stage_updated_at = new Date().toISOString().replace('T', ' ').split('.')[0]

    db.prepare(
      "INSERT INTO stage_events (person_id, from_stage, to_stage, source) VALUES (?, ?, ?, 'manual')"
    ).run(person.id, person.stage, stage)
  }

  if (Object.keys(updates).length === 0) return res.json(person)

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ')
  db.prepare(`UPDATE people SET ${setClauses} WHERE id = ?`)
    .run(...Object.values(updates), person.id)

  const updated = db.prepare('SELECT * FROM people WHERE id = ?').get(person.id)
  res.json(updated)
})

// DELETE /api/people/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM people WHERE id = ?').run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'Person not found' })
  res.json({ deleted: true })
})

export default router
