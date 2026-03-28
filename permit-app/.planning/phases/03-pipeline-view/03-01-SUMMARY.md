# Summary: 03-01 — Stage Config + StageSection + PersonCard

## Status: COMPLETE (2026-03-17)

## What was built

### client/src/lib/stages.js
- STAGES array with all 9 stages: id, label, color name, Tailwind classes (bg/border/text), Lucide icon name
- `getStage(id)` helper function

### client/src/components/PersonCard.jsx
- Left border colored by current stage via `stage.border` Tailwind class
- Displays: name (truncated), phone, "X days in stage" (or "today")
- Advance button (ChevronRight) — hidden at stage 9 or when archived
- Move dropdown (↕ button) — 3-column grid of colored stage buttons, current stage ringed
- Archive button (Archive) — swaps to Restore (RotateCcw) when `isArchived=true`
- All mutations: `useMutation` + `queryClient.invalidateQueries(['people'])` on success

### client/src/components/StageSection.jsx
- Named import map for icons (avoids wildcard `import *` bundler issues)
- Stamp icon confirmed present in lucide-react v0.469.0
- Renders nothing when `people.length === 0`
- Header: colored circle + icon + label + count

## Commits
- `feat(03-01): stages.js — stage config with colors and icons` (cf28f29)
- `feat(03-01): PersonCard — stage badge, advance, move, archive buttons` (5d0c367)
- `feat(03-01): StageSection — header with icon/color, card list` (20948c0)

## Key decisions
- Used named import map in StageSection instead of `import * as LucideIcons` — more reliable with Vite tree-shaking
- `days_in_stage` comes from server SQL (julianday diff), displayed as "today" / "1 day" / "N days"
- Move menu closes after selection via `setShowMoveMenu(false)` in onClick
