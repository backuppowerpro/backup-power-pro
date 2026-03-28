# Summary: 03-02 — Pipeline Page + Accordions

## Status: COMPLETE (2026-03-17)

## What was built

### client/src/components/ArchivedAccordion.jsx
- Collapsed by default (`open=false`)
- Toggle button shows ChevronDown/ChevronUp + title + count (right-aligned)
- Renders PersonCard with `isArchived=true` for each person
- Shows "None" text when open but empty
- Accepts `colorClass` prop for title color (slate for cold leads, amber for completed)

### client/src/pages/Pipeline.jsx (replaced stub)
- `useQuery(['people'])` fetching `/api/people`
- People partitioned into 4 buckets:
  - `active`: `!is_archived`
  - `coldLeads`: `is_archived && archive_reason === 'cold_lead'`
  - `completed`: `is_archived && archive_reason === 'completed'`
  - `manualArchived`: `is_archived && archive_reason === 'manual'`
- Layout: Cold Leads accordion (top) → 9 StageSections → empty state → Completed accordion (bottom)
- Cold Leads accordion merges coldLeads + manualArchived, title adapts
- Empty state only shown when `active.length === 0`
- Loading/error states handled

## Commits
- `feat(03-02): ArchivedAccordion — collapsed by default, shows count` (deeb2ef)
- `feat(03-02): Pipeline page — 9 stages, accordions, React Query` (4f9891d)

## Notes
- `is_archived` from SQLite is integer 0/1 — truthy/falsy check works correctly in JS
- QueryClientProvider was already configured in main.jsx (no changes needed)
- Cold Leads accordion only renders when coldLeads.length > 0 OR manualArchived.length > 0
- Completed accordion only renders when completed.length > 0
