# Permit Manager

## Overview

A local-first business operations app for Key Electric / Backup Power Pro. One unified pipeline that tracks every person from their first form submission through job completion — automatically where possible, manually where needed. The KPI view is just the same pipeline data looked at differently. Dark mode only. Responsive (phone + desktop). Replaces Glide.

## Core Value

**The pipeline stays clean and shows only what needs action right now. Everything that enters auto-sorts itself. Everything that finishes auto-archives itself. The numbers reflect reality without any extra work.**

---

## The Pipeline (single source of truth)

Every person moves through one unified pipeline. Stages are color-coded and icon-driven — you know the stage before you read a word.

### Stages

| # | Stage | Color | How they get here |
|---|-------|-------|-------------------|
| 1 | Form Submitted | Gray | Auto — BPP quote form webhook (Zap 353340616) |
| 2 | Responded | Blue | Auto — Quo SMS reply, OR manual |
| 3 | Quote Sent | Purple | Manual, or Dubsado "Project Status Updated" |
| 4 | Booked | Green | Auto — Dubsado "Contract Signed" |
| 5 | Permit Submitted | Yellow | Manual |
| 6 | Permit Paid | Orange | Manual |
| 7 | Permit Approved | Teal | Manual |
| 8 | Inspection Scheduled | Pink | Manual |
| 9 | Complete | Gold | Auto — Dubsado "New Payment Received" → auto-archives |

### Auto-archive rules
- **Top of pipeline:** No movement after X days at "Form Submitted" → auto-folds into collapsed "Cold Leads" section. Still counted in KPIs. Tap to expand, tap any card to restore to active.
- **Bottom of pipeline:** Reaching "Complete" → auto-archives into collapsed "Completed" section. Tap to expand, tap to restore.
- **Manual archive:** Swipe or button to archive anyone at any time from the UI — no code needed.
- **Unarchive:** Always available from UI — no code access ever needed.

### Manual control
- Add any person manually at any stage
- Move anyone to any stage at any time — not locked into the flow
- Edit any person's details inline
- Full override of automation at all times

---

## Automation Sources

| Trigger | Source | Maps to stage |
|---------|--------|---------------|
| Quote form submitted | BPP webhook (Zap 353340616) | Form Submitted |
| Quo SMS first reply | Zapier | Responded |
| Project Status Updated | Dubsado → Zapier | Flexible — map to Quote Sent or other mid-stages |
| New Project as Lead | Dubsado → Zapier | Responded (fallback if no form webhook) |
| New Project as Job | Dubsado → Zapier | Booked (fallback) |
| Contract Signed | Dubsado → Zapier | Booked |
| New Payment Received | Dubsado → Zapier | Complete → auto-archive |

All automations POST to a local webhook endpoint. App receives, stores, moves person to correct stage automatically.

---

## Views

### Tab 1: Pipeline
Active pipeline grouped by stage. Each stage is a section with its color and icon. Cards show name, stage indicator, time in stage. Cold and Completed are collapsed accordions at top/bottom.

### Tab 2: Analytics
Same data, funnel lens. Shows count and % at each stage. Charts over time. Date range picker (this week / this month / this year / custom). Conversion rates between stages. Tells you where people drop off.

### Tab 3: Jurisdictions
Directory of permit jurisdictions. Each card has:
- Name
- Portal URL — one-click opens
- Username — one-click copies
- Password — stored locally, show/hide toggle, one-click copies
- Phone number(s)
- Notes
- Add/edit/delete entirely from UI — no code

**Pre-loaded jurisdictions:**
- Greenville County (Non-City Permitting)
- City of Greer
- City of Greenville
- City of Simpsonville
- City of Mauldin
- Fountain Inn
- Spartanburg County

---

## UI Design Principles

- **Dark mode only** — no light mode, no toggle
- **Color = stage** — each stage has a unique color used consistently everywhere
- **Icons = action** — you know what to do before reading
- **Deceptively simple** — buttons do multiple things silently (advance stage + log KPI + timestamp)
- **Glide aesthetic** — clean cards, dark background, colored stage icons — but actually powerful
- **Responsive** — mobile: stacks vertically, swipe gestures; desktop: wider layout, more visible at once
- **No clutter** — pipeline only shows active people, archives are tucked away

---

## Tech Stack

- **Frontend:** React 19 + Vite 6
- **Backend:** Node.js + Express 5 (local server — receives webhooks, serves app)
- **Storage:** better-sqlite3 — ACID transactions, no corruption on crash
- **Styling:** Tailwind CSS (dark mode forced)
- **Charts:** Recharts or Chart.js
- **Tunnel:** cloudflared (free, persistent named tunnel for Zapier webhook URL stability)
- **Dev:** concurrently — one `npm start` runs Express + Vite + cloudflared together
- **Icons:** Lucide React

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| One pipeline, not separate tabs for permits + KPIs | It's the same data — splitting it creates duplication |
| Auto-archive at both ends | Keeps active view clean without deleting KPI data |
| Dark mode only | Matches Glide aesthetic, no toggle complexity |
| better-sqlite3 over JSON files | ACID transactions — won't corrupt on crash |
| cloudflared over ngrok | Free persistent tunnel URLs — Zapier webhook URL stays stable |
| Project Status Updated used flexibly | Fills gaps between Dubsado's fixed triggers |
| Full manual override always available | Automation helps but you're always in control |
| No code access ever needed for data management | Add people, jurisdictions, archive, restore — all in UI |

---

## Out of Scope (v1)

- Cloud sync / multi-device
- Two-way Dubsado sync (read-only from Dubsado)
- PDF export
- Search/filter
- Light mode

---
*Last updated: 2026-03-17 — full vision captured after deep questioning*
