import { Router } from 'express'
import { db } from '../db.js'

const router = Router()

// GET /api/analytics?from=2026-01-01&to=2026-12-31
router.get('/', (req, res) => {
  const { from, to } = req.query
  const fromDate = from || '2000-01-01'
  const toDate = to || '2099-12-31'

  // Stage counts — all people ever, partitioned
  const stageCounts = db.prepare(`
    SELECT
      stage,
      COUNT(*) as count,
      SUM(CASE WHEN is_archived = 0 THEN 1 ELSE 0 END) as active_count
    FROM people
    GROUP BY stage
    ORDER BY stage
  `).all()

  // Total people who ever reached each stage (via stage_events)
  // This gives us the "funnel" numbers
  const funnelCounts = db.prepare(`
    SELECT to_stage as stage, COUNT(DISTINCT person_id) as reached
    FROM stage_events
    WHERE timestamp >= ? AND timestamp <= ?
    GROUP BY to_stage
    ORDER BY to_stage
  `).all(fromDate + ' 00:00:00', toDate + ' 23:59:59')

  // Conversion rates between adjacent stages
  const funnelMap = {}
  funnelCounts.forEach(r => { funnelMap[r.stage] = r.reached })

  const conversionRates = []
  for (let i = 1; i <= 8; i++) {
    const from_count = funnelMap[i] || 0
    const to_count = funnelMap[i + 1] || 0
    const rate = from_count > 0 ? Math.round((to_count / from_count) * 100) : null
    conversionRates.push({ from_stage: i, to_stage: i + 1, from_count, to_count, rate })
  }

  // Events over time — entries at stage 1 and exits at stage 9, grouped by week
  const eventsOverTime = db.prepare(`
    SELECT
      strftime('%Y-%W', timestamp) as week,
      SUM(CASE WHEN to_stage = 1 AND from_stage IS NULL THEN 1 ELSE 0 END) as new_leads,
      SUM(CASE WHEN to_stage = 9 THEN 1 ELSE 0 END) as completed
    FROM stage_events
    WHERE timestamp >= ? AND timestamp <= ?
    GROUP BY week
    ORDER BY week
  `).all(fromDate + ' 00:00:00', toDate + ' 23:59:59')

  // Summary stats
  const totalPeople = db.prepare('SELECT COUNT(*) as count FROM people').get().count
  const totalActive = db.prepare('SELECT COUNT(*) as count FROM people WHERE is_archived = 0').get().count
  const totalCompleted = db.prepare("SELECT COUNT(*) as count FROM people WHERE archive_reason = 'completed'").get().count

  res.json({
    summary: { totalPeople, totalActive, totalCompleted },
    stageCounts,
    funnelCounts,
    conversionRates,
    eventsOverTime,
  })
})

export default router
