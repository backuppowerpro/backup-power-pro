---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-03-17T21:04:23.295Z"
progress:
  total_phases: 10
  completed_phases: 10
  total_plans: 21
  completed_plans: 21
---

# State

_Current position in the build. Updated at the start and end of each phase._

---

## Current Status

**Phase:** 0 (not started)
**Last updated:** 2026-03-17
**Active phase:** None

---

## Phase Progress

| Phase | Name | Status | Completed |
|-------|------|--------|-----------|
| 1 | Project Scaffold | `[ ] not started` | — |
| 2 | Data Layer | `[ ] not started` | — |
| 3 | Pipeline View | `[ ] not started` | — |
| 4 | Archive System | `[ ] not started` | — |
| 5 | Add / Edit UI | `[ ] not started` | — |
| 6 | Webhook Receiver | `[ ] not started` | — |
| 7 | Analytics Tab | `[ ] not started` | — |
| 8 | Jurisdictions Tab Polish | `[ ] not started` | — |
| 9 | Responsive Polish | `[ ] not started` | — |
| 10 | Integration Testing + Zapier Setup Guide | `[ ] not started` | — |

---

## Decisions Made

| Decision | Rationale | Date |
|----------|-----------|------|
| React 19 + Vite 6 | Vite is the standard; CRA deprecated | 2026-03-17 |
| Express 5 | Async error propagation fix over v4 | 2026-03-17 |
| better-sqlite3 | ACID transactions, sync API, single file | 2026-03-17 |
| Tailwind CSS v4 | Current version; v4 Vite plugin, CSS-first config | 2026-03-17 |
| react-router-dom v7 | Smaller bundle than TanStack Router; overkill avoided | 2026-03-17 |
| TanStack Query v5 | Eliminates manual loading/error state, cache deduplication | 2026-03-17 |
| cloudflared | Free persistent tunnel URLs; Zapier webhook URL stability | 2026-03-17 |
| concurrently | Single `npm start` for server + client + tunnel | 2026-03-17 |
| nodemon | Plain JS server; tsx/ts-node unnecessary | 2026-03-17 |
| Lucide React | Icon library for stage indicators and actions | 2026-03-17 |
| Recharts | Chart library for Analytics tab (preferred over Chart.js) | 2026-03-17 |
| No TypeScript initially | Rapid prototyping; add later once domain model is stable | 2026-03-17 |
| No Prisma | Direct better-sqlite3 SQL; ORM abstraction not warranted | 2026-03-17 |
| Passwords stored as plaintext | Local-first, single-user, no cloud — acceptable risk | 2026-03-17 |
| Cold lead threshold: 7 days | Default; configurable via `COLD_LEAD_DAYS` env var | 2026-03-17 |
| Auto-archive on: startup + interval + webhook | Covers all entry points without a separate cron daemon | 2026-03-17 |

---

## Key Context

### Repo location
`/Users/keygoodson/Desktop/CLAUDE/permit-app`

### Webhook sources
- Zap 353340616 (BPP quote form) — already exists and active
- Quo SMS reply — needs new Zap
- Dubsado triggers (5 types) — need new Zaps pointing to this app's webhook URL

### Webhook URL pattern
- Dev (quick tunnel): random URL from cloudflared, changes on restart — acceptable during development
- Production: named cloudflared tunnel with stable URL — configure once in all Zapier Zaps

### DB file location (when created)
`server/permit-manager.db` — gitignored, never committed

### Environment variables needed
```
WEBHOOK_SECRET=           # shared secret for all incoming Zapier webhooks
COLD_LEAD_DAYS=7          # days at stage 1 before auto-archiving as cold lead
PORT=3001                 # Express server port
```

### Zapier triggers to configure (Phase 10)
1. BPP quote form (Zap 353340616) — add webhook action pointing to this app
2. Quo SMS first reply — new Zap
3. Dubsado Project Status Updated — new Zap
4. Dubsado New Project as Lead — new Zap
5. Dubsado New Project as Job — new Zap
6. Dubsado Contract Signed — new Zap
7. Dubsado New Payment Received — new Zap

### Out of scope (v1)
- Cloud sync / multi-device
- Two-way Dubsado sync (read-only)
- PDF export
- Search / filter
- Light mode

---

## Notes for Next Session

When starting Phase 1, the agent should:
1. Read this file first to confirm current phase
2. Read ROADMAP.md Phase 1 task list
3. Check if any files already exist in the repo before creating them
4. Update this file: set Phase 1 status to `[~] in progress` before starting work
5. Update this file: set Phase 1 status to `[x] complete` and record date when done
