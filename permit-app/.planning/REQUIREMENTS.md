# Requirements

_Generated: 2026-03-17. Derived from PROJECT.md and STACK.md._

---

## PIPE — Pipeline View

| ID | Requirement | Priority |
|----|-------------|----------|
| PIPE-01 | Display all 9 stages as distinct sections, each with its assigned color and Lucide icon | P0 |
| PIPE-02 | Each person card shows: full name, current stage indicator, time-in-stage (e.g. "3 days") | P0 |
| PIPE-03 | Stage color system: Gray (Form Submitted), Blue (Responded), Purple (Quote Sent), Green (Booked), Yellow (Permit Submitted), Orange (Permit Paid), Teal (Permit Approved), Pink (Inspection Scheduled), Gold (Complete) | P0 |
| PIPE-04 | "Cold Leads" collapsed accordion at the top of the pipeline (auto-populated by archive rules) | P0 |
| PIPE-05 | "Completed" collapsed accordion at the bottom of the pipeline (auto-populated by archive rules) | P0 |
| PIPE-06 | Tap/click a collapsed accordion to expand it and see all cards inside | P0 |
| PIPE-07 | Tap any card in an archive accordion to restore it to active pipeline | P0 |
| PIPE-08 | Advance a person to the next stage via a single tap/click action on the card | P0 |
| PIPE-09 | Move a person to any arbitrary stage (not just next) via a stage selector | P0 |
| PIPE-10 | Manually archive any person at any time via a button or swipe gesture | P0 |
| PIPE-11 | Pipeline view shows only active (non-archived) people by default | P0 |
| PIPE-12 | Stage sections with zero active people are visually indicated as empty (not hidden entirely) | P1 |
| PIPE-13 | Cards display a visual stage badge using the stage color | P1 |
| PIPE-14 | Time-in-stage timestamp is stored on every stage transition and computed accurately | P0 |

---

## AUTO — Automation / Webhook

| ID | Requirement | Priority |
|----|-------------|----------|
| AUTO-01 | Express POST endpoint at `/webhook` that receives all Zapier payloads | P0 |
| AUTO-02 | Shared-secret header validation on all incoming webhook requests (`x-webhook-secret`) | P0 |
| AUTO-03 | Webhook secret stored in `.env`, never hardcoded, `.env.example` provided | P0 |
| AUTO-04 | Rate limiting on the webhook endpoint (express-rate-limit, 50 req/min) | P0 |
| AUTO-05 | BPP quote form webhook (Zap 353340616) → creates new person at "Form Submitted" stage | P0 |
| AUTO-06 | Quo SMS first reply → moves person to "Responded" (matched by phone number) | P0 |
| AUTO-07 | Dubsado "Contract Signed" → moves person to "Booked" | P0 |
| AUTO-08 | Dubsado "New Payment Received" → moves person to "Complete" + triggers auto-archive | P0 |
| AUTO-09 | Dubsado "Project Status Updated" → flexible mapping, defaults to "Quote Sent" | P0 |
| AUTO-10 | Dubsado "New Project as Lead" → creates/moves person to "Responded" (fallback) | P1 |
| AUTO-11 | Dubsado "New Project as Job" → creates/moves person to "Booked" (fallback) | P1 |
| AUTO-12 | Webhook handler is idempotent: if person already exists at target stage or later, no-op or log | P0 |
| AUTO-13 | All webhook events are logged to the database with timestamp, event type, and payload summary | P1 |
| AUTO-14 | cloudflared tunnel starts automatically with `npm start` via concurrently | P0 |
| AUTO-15 | Quick tunnel (no account) supported for development; named persistent tunnel documented for production | P1 |
| AUTO-16 | morgan request logging active in dev so every webhook hit is visible in terminal | P1 |

---

## ANAL — Analytics / KPI

| ID | Requirement | Priority |
|----|-------------|----------|
| ANAL-01 | Analytics tab shows count of people at each stage (current snapshot) | P0 |
| ANAL-02 | Analytics tab shows percentage of total at each stage (funnel view) | P0 |
| ANAL-03 | Stage-to-stage conversion rates (e.g., "Form Submitted → Responded: 68%") | P0 |
| ANAL-04 | Charts over time showing pipeline activity (entries, completions, movement) | P1 |
| ANAL-05 | Date range picker: This Week / This Month / This Year / Custom | P1 |
| ANAL-06 | KPI counts include archived people (Cold Leads and Completed) — data is never excluded | P0 |
| ANAL-07 | Drop-off analysis: identify which stage has highest fall-through rate | P1 |
| ANAL-08 | All analytics derived from the same `people` and `stage_events` tables — no separate KPI storage | P0 |
| ANAL-09 | Charts library: Recharts (preferred) or Chart.js — decision made at Phase 7 | P1 |
| ANAL-10 | Average time-in-stage shown per stage across all historical records | P2 |

---

## JURI — Jurisdictions

| ID | Requirement | Priority |
|----|-------------|----------|
| JURI-01 | Jurisdictions tab shows cards for all stored jurisdictions | P0 |
| JURI-02 | Each card displays: name, portal URL, username, password (hidden by default), phone number(s), notes | P0 |
| JURI-03 | Portal URL is one-click to open in a new browser tab | P0 |
| JURI-04 | Username is one-click to copy to clipboard | P0 |
| JURI-05 | Password stored locally, show/hide toggle, one-click copy to clipboard | P0 |
| JURI-06 | Add a new jurisdiction entirely from UI — no code or DB access needed | P0 |
| JURI-07 | Edit any jurisdiction field inline or via edit modal — no code needed | P0 |
| JURI-08 | Delete a jurisdiction from UI with confirmation | P0 |
| JURI-09 | 7 jurisdictions pre-loaded at first run: Greenville County, City of Greer, City of Greenville, City of Simpsonville, City of Mauldin, Fountain Inn, Spartanburg County | P0 |
| JURI-10 | Pre-load is idempotent — running DB seed again does not duplicate jurisdictions | P0 |
| JURI-11 | Passwords are stored as plaintext in SQLite (local-first, no cloud, single user — acceptable) | P0 |

---

## UI — UI/UX

| ID | Requirement | Priority |
|----|-------------|----------|
| UI-01 | Dark mode only — forced via Tailwind `darkMode: 'class'` with `dark` class on `<html>`. No light mode. No toggle. | P0 |
| UI-02 | Three-tab navigation: Pipeline / Analytics / Jurisdictions | P0 |
| UI-03 | Tab bar is persistent and accessible from any view | P0 |
| UI-04 | Icons from Lucide React used consistently for all actions and stage indicators | P0 |
| UI-05 | Stage color is the primary visual identifier — used on card border, badge, and section header | P0 |
| UI-06 | Mobile layout: single-column vertical stack, touch-friendly tap targets (min 44px) | P0 |
| UI-07 | Desktop layout: wider card grid or multi-column view showing more pipeline at once | P1 |
| UI-08 | Add person form: accessible from pipeline view, can set any stage at creation time | P0 |
| UI-09 | Edit person details inline or via modal — name, phone, email, notes | P0 |
| UI-10 | Stage advance action is a single tap — not buried in a menu | P0 |
| UI-11 | Archive action available per card (button or swipe) | P0 |
| UI-12 | Swipe-to-archive gesture on mobile (horizontal swipe on card) | P2 |
| UI-13 | Loading states shown on data fetches (React Query isLoading) | P1 |
| UI-14 | Toast or inline feedback for all mutations (stage change, archive, add, edit) | P1 |
| UI-15 | Confirm dialog before destructive actions (delete jurisdiction, archive person) | P1 |
| UI-16 | App title / header shows "Permit Manager" branding | P2 |

---

## ARCH — Archive System

| ID | Requirement | Priority |
|----|-------------|----------|
| ARCH-01 | Auto-archive to "Cold Leads" when a person has been at "Form Submitted" with no movement for X days (configurable, default: 7) | P0 |
| ARCH-02 | Auto-archive to "Completed" when a person reaches the "Complete" stage (immediate) | P0 |
| ARCH-03 | Auto-archive check runs: on server start, on every webhook event, and on a periodic interval | P1 |
| ARCH-04 | Archived people are flagged in the DB (`is_archived`, `archive_reason`) — never deleted | P0 |
| ARCH-05 | Archived people remain included in all analytics/KPI counts | P0 |
| ARCH-06 | Manual archive available for any person at any stage from the UI | P0 |
| ARCH-07 | Restore from archive available for any person in any archive section from the UI | P0 |
| ARCH-08 | Restoring a person from archive returns them to their current stage (not stage 1) | P0 |
| ARCH-09 | Cold Leads accordion shows person count in collapsed header (e.g. "Cold Leads (4)") | P1 |
| ARCH-10 | Completed accordion shows person count in collapsed header (e.g. "Completed (12)") | P1 |
| ARCH-11 | DB column `archive_reason` stores: `'cold_lead'`, `'completed'`, or `'manual'` | P0 |
