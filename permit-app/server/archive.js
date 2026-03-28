import { db } from './db.js'

export function runAutoArchive() {
  const coldLeadDays = parseInt(process.env.COLD_LEAD_DAYS || '7', 10)

  // Archive cold leads: stage 1, not archived, older than COLD_LEAD_DAYS
  const coldLeads = db.prepare(`
    SELECT id, stage FROM people
    WHERE stage = 1
      AND is_archived = 0
      AND julianday('now') - julianday(stage_updated_at) >= ?
  `).all(coldLeadDays)

  const archiveColdLead = db.prepare(`
    UPDATE people SET is_archived = 1, archive_reason = 'cold_lead'
    WHERE id = ?
  `)
  const logEvent = db.prepare(`
    INSERT INTO stage_events (person_id, from_stage, to_stage, source)
    VALUES (?, ?, ?, 'auto-archive')
  `)

  const archiveColdLeads = db.transaction((people) => {
    for (const p of people) {
      archiveColdLead.run(p.id)
      logEvent.run(p.id, p.stage, p.stage)
    }
  })
  archiveColdLeads(coldLeads)

  // Archive completed: stage 9, not archived
  const completed = db.prepare(`
    SELECT id, stage FROM people
    WHERE stage = 9 AND is_archived = 0
  `).all()

  const archiveCompleted = db.prepare(`
    UPDATE people SET is_archived = 1, archive_reason = 'completed'
    WHERE id = ?
  `)

  const archiveAllCompleted = db.transaction((people) => {
    for (const p of completed) {
      archiveCompleted.run(p.id)
      logEvent.run(p.id, p.stage, p.stage)
    }
  })
  archiveAllCompleted(completed)

  if (coldLeads.length > 0 || completed.length > 0) {
    console.log(`[ARCHIVE] Cold leads: ${coldLeads.length}, Completed: ${completed.length}`)
  }
}
