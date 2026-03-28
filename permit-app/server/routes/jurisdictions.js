import { Router } from 'express'
import { db } from '../db.js'

const router = Router()

// GET /api/jurisdictions
router.get('/', (req, res) => {
  const jurisdictions = db.prepare('SELECT * FROM jurisdictions ORDER BY id ASC').all()
  res.json(jurisdictions)
})

// GET /api/jurisdictions/:id
router.get('/:id', (req, res) => {
  const j = db.prepare('SELECT * FROM jurisdictions WHERE id = ?').get(req.params.id)
  if (!j) return res.status(404).json({ error: 'Jurisdiction not found' })
  res.json(j)
})

// POST /api/jurisdictions
router.post('/', (req, res) => {
  const { name, portal_url, username, password, phone, notes, logo_url, background_url } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })

  const result = db.prepare(
    'INSERT INTO jurisdictions (name, portal_url, username, password, phone, notes, logo_url, background_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(name, portal_url || null, username || null, password || null, phone || null, notes || null, logo_url || null, background_url || null)

  const j = db.prepare('SELECT * FROM jurisdictions WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(j)
})

// PATCH /api/jurisdictions/:id
router.patch('/:id', (req, res) => {
  const j = db.prepare('SELECT * FROM jurisdictions WHERE id = ?').get(req.params.id)
  if (!j) return res.status(404).json({ error: 'Jurisdiction not found' })

  const allowed = ['name', 'portal_url', 'username', 'password', 'phone', 'notes', 'logo_url', 'background_url']
  const updates = {}
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key]
  }

  if (Object.keys(updates).length === 0) return res.json(j)

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ')
  db.prepare(`UPDATE jurisdictions SET ${setClauses} WHERE id = ?`)
    .run(...Object.values(updates), j.id)

  const updated = db.prepare('SELECT * FROM jurisdictions WHERE id = ?').get(j.id)
  res.json(updated)
})

// DELETE /api/jurisdictions/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM jurisdictions WHERE id = ?').run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'Jurisdiction not found' })
  res.json({ deleted: true })
})

export default router
