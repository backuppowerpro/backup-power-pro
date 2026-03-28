# Summary 07-01: Analytics API Endpoint

## Status: COMPLETE

## What was built
- `server/routes/analytics.js` — new Express router handling `GET /api/analytics?from=&to=`
- Registered in `server/index.js` as `app.use('/api/analytics', analyticsRouter)`

## Queries implemented
1. `stageCounts` — current count per stage from `people` table, split by active vs archived
2. `funnelCounts` — distinct people who reached each stage via `stage_events` within date range
3. `conversionRates` — 8 entries (stages 1→2 through 8→9), computed from funnelMap
4. `eventsOverTime` — weekly new leads + completions from `stage_events`, grouped by `strftime('%Y-%W')`
5. `summary` — totalPeople, totalActive, totalCompleted

## Test result (live data)
- 200 OK, 886 bytes
- Summary: `{ totalPeople: 2, totalActive: 2, totalCompleted: 0 }`
- stageCounts: 2 entries
- funnelCounts: 3 entries
- conversionRates: 8 entries (correct — all 8 stage transitions)
- eventsOverTime: 1 entry (week bucket)

## Commits
- `feat(07-01): server/routes/analytics.js — stage counts, funnel, conversion rates`
- `feat(07-01): register analytics route`
