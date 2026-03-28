# Roadmap: Permit Manager

## Overview

A local-first pipeline app for Key Electric / Backup Power Pro. Tracks every person from first form submission through job completion — automatically via Zapier/Dubsado webhooks where possible, manually where needed. Dark mode only. Responsive (phone + desktop). Built in 10 phases from bare scaffold to fully integrated.

## Phases

- [x] **Phase 1: Project Scaffold** - npm start launches Express + Vite + cloudflared, dark background, 3 empty tab routes (completed 2026-03-17)
- [x] **Phase 2: Data Layer** - Complete SQLite schema and all CRUD REST endpoints testable via curl (completed 2026-03-17)
- [x] **Phase 3: Pipeline View** - Full pipeline UI with all 9 stages, color system, icons, cards, stage advancement (completed 2026-03-17)
- [x] **Phase 4: Archive System** - Auto-archive cold leads and completed jobs, server-side timers (completed 2026-03-17)
- [x] **Phase 5: Add/Edit UI** - Add people at any stage, edit details, full jurisdiction CRUD from UI (completed 2026-03-17)
- [x] **Phase 6: Webhook Receiver** - All 7 Zapier triggers mapped, auth enforced, end-to-end Zapier → UI (completed 2026-03-17)
- [x] **Phase 7: Analytics Tab** - Funnel view, conversion rates, charts, date range picker (completed 2026-03-17)
- [x] **Phase 8: Jurisdictions Tab Polish** - Copy credentials, password toggle, URL open, all 7 pre-loaded (completed 2026-03-17)
- [x] **Phase 9: Responsive Polish** - Mobile layout, touch targets, loading states, toast system (completed 2026-03-17)
- [x] **Phase 10: Integration Testing + Zapier Setup Guide** - End-to-end test all webhook flows, documentation (completed 2026-03-17)

## Phase Details

### Phase 1: Project Scaffold
**Goal**: One `npm start` command that runs Express + Vite + cloudflared together. Dark mode forced. Three empty tab routes reachable. No data, no real UI — just the skeleton.
**Depends on**: Nothing (first phase)
**Requirements**: UI-01, UI-02, UI-03, AUTO-14
**Success Criteria** (what must be TRUE):
  1. `npm start` starts server + Vite + cloudflared in one command with colored output
  2. Browser shows dark background (no white flash, no light mode)
  3. Three tabs (Pipeline, Analytics, Jurisdictions) navigate without crashing
  4. All three processes stop together when one crashes (--kill-others)
**Plans**: TBD

Plans:
- [ ] 01-01: Project structure, root package.json, concurrently scripts
- [ ] 01-02: Express server setup, Vite + React scaffold, Tailwind dark mode
- [ ] 01-03: React Router tabs, bottom tab bar, cloudflared tunnel

### Phase 2: Data Layer
**Goal**: Complete SQLite schema and all CRUD REST endpoints. No UI beyond what exists. Endpoints testable via curl or Postman.
**Depends on**: Phase 1
**Requirements**: ARCH-04, ARCH-05, ARCH-08, ARCH-11, JURI-09, JURI-10, JURI-11, AUTO-13, PIPE-14, ANAL-06, ANAL-08
**Success Criteria** (what must be TRUE):
  1. DB file created on disk with all 4 tables (people, stage_events, jurisdictions, webhook_log)
  2. All CRUD endpoints respond correctly to curl
  3. 7 jurisdictions pre-seeded on first run
  4. Stage changes write rows to stage_events table
**Plans**: TBD

Plans:
- [ ] 02-01: better-sqlite3 install, schema.sql, db.js singleton, seed jurisdictions
- [ ] 02-02: People routes (GET/POST/PATCH/DELETE), stage_events logic
- [ ] 02-03: Jurisdictions routes, events routes, register all in index.js

### Phase 3: Pipeline View
**Goal**: Full pipeline UI with all 9 stages, color system, icons, cards with real data, stage advancement. No webhooks yet — manual only.
**Depends on**: Phase 2
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, PIPE-07, PIPE-08, PIPE-09, PIPE-10, PIPE-11, PIPE-12, PIPE-13, PIPE-14, ARCH-06, ARCH-07, ARCH-08, ARCH-09, ARCH-10
**Success Criteria** (what must be TRUE):
  1. All 9 stages render with correct colors and Lucide icons
  2. Cards appear in correct stage sections with time-in-stage display
  3. Advance to next stage button works (PATCH to server, UI updates)
  4. Move to any stage dropdown works
  5. Manual archive and restore buttons work
  6. Cold Leads and Completed accordions collapse/expand at top/bottom
**Plans**: TBD

Plans:
- [x] 03-01: Stage config, StageSection component, PersonCard component
- [x] 03-02: Pipeline page with React Query, advance/move stage mutations
- [x] 03-03: ColdLeadsAccordion, CompletedAccordion, archive/restore buttons

### Phase 4: Archive System
**Goal**: Auto-archive logic wired up in Express. Cold lead timer runs on server start and periodically. Complete stage triggers immediate auto-archive.
**Depends on**: Phase 3
**Requirements**: ARCH-01, ARCH-02, ARCH-03, ARCH-04, ARCH-11
**Success Criteria** (what must be TRUE):
  1. Server-start auto-archive runs and flags stale stage-1 people as cold leads
  2. Stage-9 people are auto-archived immediately
  3. Auto-archive re-runs every 60 minutes
  4. Each auto-archive action logged to stage_events with source='auto-archive'
  5. Restoring archived people from UI works
**Plans**: TBD

Plans:
- [ ] 04-01: server/archive.js with runAutoArchive(), server-start + interval calls

### Phase 5: Add/Edit UI
**Goal**: Full UI for adding people at any stage, editing all person details, and full jurisdiction CRUD. No code or DB access ever needed.
**Depends on**: Phase 4
**Requirements**: JURI-01, JURI-02, JURI-03, JURI-04, JURI-05, JURI-06, JURI-07, JURI-08, UI-08, UI-09, UI-10, UI-14, UI-15
**Success Criteria** (what must be TRUE):
  1. Add Person button opens modal, person appears in correct stage after submit
  2. Edit Person (pencil icon) allows editing name/phone/email/notes inline or via modal
  3. Jurisdictions tab shows all cards with name/URL/username/password/phone/notes
  4. Copy-to-clipboard works for username and password with toast feedback
  5. Add/Edit/Delete jurisdiction all work without touching code
**Plans**: TBD

Plans:
- [ ] 05-01: Add Person modal, Edit Person modal, PATCH/POST mutations
- [ ] 05-02: Jurisdictions tab page, jurisdiction cards with copy/toggle/open
- [ ] 05-03: Add/Edit/Delete jurisdiction modals, confirm dialog

### Phase 6: Webhook Receiver
**Goal**: Express webhook endpoint fully wired. All 7 Zapier triggers mapped to correct pipeline actions. Shared-secret auth enforced. End-to-end: Zapier fires → person moves in UI.
**Depends on**: Phase 5
**Requirements**: AUTO-01, AUTO-02, AUTO-03, AUTO-04, AUTO-05, AUTO-06, AUTO-07, AUTO-08, AUTO-09, AUTO-10, AUTO-11, AUTO-12, AUTO-13, AUTO-15, AUTO-16
**Success Criteria** (what must be TRUE):
  1. POST /api/webhook with correct secret creates/moves person correctly for all 7 event types
  2. Missing or wrong secret returns 403
  3. Every incoming webhook logged to webhook_log table
  4. Duplicate webhook does not regress person's stage or create duplicates
  5. Auto-archive runs after payment-received events
**Plans**: TBD

Plans:
- [ ] 06-01: server/routes/webhook.js, secret middleware, rate limit, all 7 event type handlers
- [ ] 06-02: Idempotency logic, webhook_log writes, runAutoArchive() hook, curl verification

### Phase 7: Analytics Tab
**Goal**: Analytics tab fully functional. Funnel view, conversion rates, charts over time, date range picker. All data from existing DB tables.
**Depends on**: Phase 6
**Requirements**: ANAL-01, ANAL-02, ANAL-03, ANAL-04, ANAL-05, ANAL-06, ANAL-07, ANAL-08, ANAL-09
**Success Criteria** (what must be TRUE):
  1. Analytics endpoint returns stage counts, conversion rates, events-over-time
  2. Funnel section shows count + % at each stage
  3. Conversion rates section highlights biggest drop-off
  4. Chart renders pipeline activity over time (Recharts)
  5. Date range picker (This Week / This Month / This Year + custom) filters data
**Plans**: TBD

Plans:
- [ ] 07-01: GET /api/analytics endpoint with stage counts, conversion rates, events-over-time queries
- [ ] 07-02: Analytics page component, funnel section, conversion rates section
- [ ] 07-03: Recharts chart, date range picker, React Query integration

### Phase 8: Jurisdictions Tab Polish
**Goal**: Jurisdictions tab fully polished. All CRUD works. UX details: copy feedback, password toggle, URL open. Pre-loaded data verified.
**Depends on**: Phase 7
**Requirements**: JURI-01, JURI-02, JURI-03, JURI-04, JURI-05, JURI-06, JURI-07, JURI-08
**Success Criteria** (what must be TRUE):
  1. All 7 pre-loaded jurisdictions display correctly
  2. Copy toast appears for 2 seconds after username or password copy
  3. Password show/hide toggle works (default hidden)
  4. Portal URL opens in new tab with external-link icon
  5. Confirm dialog appears before delete
**Plans**: TBD

Plans:
- [ ] 08-01: Copy toast, password toggle, URL link, phone tap-to-call, notes multiline display
- [ ] 08-02: Card visual polish, empty state, confirm dialog on delete, full cycle verification

### Phase 9: Responsive Polish
**Goal**: App fully usable on iPhone and desktop. Mobile: single column, large tap targets. Desktop: wider layout. Loading states and feedback on all actions.
**Depends on**: Phase 8
**Requirements**: UI-04, UI-06, UI-07, UI-12, UI-13, UI-14, UI-16
**Success Criteria** (what must be TRUE):
  1. App navigable on 390px wide iPhone screen (no horizontal overflow)
  2. All buttons minimum 44x44px touch targets
  3. Desktop layout uses wider viewport effectively
  4. All data fetches show loading states
  5. All mutations show toast feedback
  6. No accidental light-mode colors anywhere
**Plans**: TBD

Plans:
- [ ] 09-01: Mobile layout audit, touch targets, tab bar positioning
- [ ] 09-02: Desktop layout optimizations, loading skeletons, error states
- [ ] 09-03: Toast system, stage advance animation, accordion animation, dark mode audit

### Phase 10: Integration Testing + Zapier Setup Guide
**Goal**: End-to-end test of all webhook flows with real Zapier Zaps. Document the exact setup so Zapier can be configured without revisiting code.
**Depends on**: Phase 9
**Requirements**: AUTO-15
**Success Criteria** (what must be TRUE):
  1. All 7 Zap event types tested end-to-end (form → stage 1, reply → stage 2, etc.)
  2. Idempotency verified (duplicate sends don't regress or duplicate)
  3. Auto-archive timer verified (stale stage-1 person archives on server restart)
  4. docs/ZAPIER-SETUP.md created with webhook URL, headers, and per-Zap field mapping
  5. All P0 requirements verified complete
**Plans**: TBD

Plans:
- [ ] 10-01: End-to-end webhook testing for all 7 event types
- [ ] 10-02: docs/ZAPIER-SETUP.md, P1 requirement gap review

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Scaffold | 0/3 | Complete    | 2026-03-17 |
| 2. Data Layer | 0/3 | Complete    | 2026-03-17 |
| 3. Pipeline View | 3/3 | Complete    | 2026-03-17 |
| 4. Archive System | 0/1 | Complete    | 2026-03-17 |
| 5. Add/Edit UI | 0/3 | Complete    | 2026-03-17 |
| 6. Webhook Receiver | 0/2 | Complete    | 2026-03-17 |
| 7. Analytics Tab | 0/3 | Complete    | 2026-03-17 |
| 8. Jurisdictions Polish | 0/2 | Complete    | 2026-03-17 |
| 9. Responsive Polish | 0/3 | Complete    | 2026-03-17 |
| 10. Integration Testing | 0/2 | Complete    | 2026-03-17 |
