import { Router } from 'express'
import { db } from '../db.js'

const router = Router()

// GET /api/events?person_id=X — events for one person
router.get('/', (req, res) => {
  const { person_id } = req.query
  if (person_id) {
    const events = db.prepare(
      'SELECT * FROM stage_events WHERE person_id = ? ORDER BY timestamp DESC'
    ).all(person_id)
    return res.json(events)
  }
  // All events (for analytics)
  const events = db.prepare(
    'SELECT * FROM stage_events ORDER BY timestamp DESC LIMIT 1000'
  ).all()
  res.json(events)
})

export default router
