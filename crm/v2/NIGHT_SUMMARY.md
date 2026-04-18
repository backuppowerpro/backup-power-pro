# CRM v2 — Overnight Marathon Summary

**Status as of Sat Apr 18 2026 early morning:** 19 sessions, 17 feature commits, CRM v2 live at `backuppowerpro.com/crm/v2/` and functionally complete.

When you wake up, read this first, then follow `crm/v2/CUTOVER.md` to shakedown-test before deciding on cut-over.

---

## What works — test checklist in order of Key's daily workflow

### 1. Open app + sign in
- [ ] Navigate to `backuppowerpro.com/crm/v2/` (laptop + iPhone).
- [ ] Sign in with Supabase email/password.
- [ ] On iPhone: tap Share → Add to Home Screen → "BPP" icon lands on home screen.

### 2. Morning workflow (the command center view)
- [ ] Once-per-day morning briefing modal appears with Overdue / Today / Materials / Good News sections. Dismiss or Open CRM.
- [ ] Title bar shows "BPP CRM v2" — and will show "(N)" prefix if unread SMS arrived while tab was hidden.

### 3. Triaging leads (the most common action)
- [ ] Pipeline view renders 9-column kanban with real contacts bucketed by stage.
- [ ] Drag a lead card from one column to another → stage updates, toast confirms, stage_history row inserts.
- [ ] Switch to LIST / PERMITS / MATERIALS sub-views via top toggle.

### 4. Handling a reply (the most frequent minute-to-minute action)
- [ ] Click any contact → slide-over panel opens with live message thread.
- [ ] Type a reply in the bottom compose bar → Send. Message lands in Twilio via send-sms edge function + appears instantly in thread.
- [ ] Green call button top-right of panel → Twilio Voice SDK dials. Mic permission asked first time.
- [ ] Click stage pill at top of detail panel → stage picker opens → pick a new stage → toast confirms + stage_history records.

### 5. Six detail tabs
- [ ] **MESSAGES** (default): live thread + compose bar.
- [ ] **TIMELINE**: audit feed of stage_history events.
- [ ] **QUOTE**: proposals for this contact with LCD green totals.
- [ ] **PERMITS**: 7-step tiled board showing this contact's permit progression.
- [ ] **NOTES**: editable textarea, UPDATEs contacts.install_notes, toast confirms.
- [ ] **EDIT**: name/phone/email/address form, persists to contacts row.

### 6. Sparky AI
- [ ] Switch to Sparky tab.
- [ ] Pick a mode (CHAT / BRIEFING / INSIGHT / REPLY / DRAFT).
- [ ] Ask a real question ("who hasn't replied in 3 days?") → replies arrive from ai-taskmaster edge function with the Claude-generated answer.

### 7. Finance
- [ ] Switch to Finance tab.
- [ ] 4 LCD KPI cards show: Outstanding / Paid This Week / Deposits Pending / Overdue — computed from invoices table.
- [ ] Switch sub-tabs: PROPOSALS / INVOICES / PAYMENTS show live tables with MS-palette status pills.

### 8. Global actions
- [ ] Press **⌘K** → command palette opens. Type a contact name → Enter opens them. Type "export" → Enter downloads CSV. Type "help" → opens shortcut modal.
- [ ] Press **?** → keyboard shortcut modal.
- [ ] Press **G** then **L/C/F/M/S** → jumps to that tab (Leads/Calendar/Finance/Messages/Sparky).
- [ ] Click the **+** button top-right → new lead modal. Fill phone + name → saves + opens detail panel.
- [ ] Click the **sun icon** top-right → dark mode toggles, persists across refresh.

### 9. Alex integration (should already be seamless)
- [ ] When a contact fills out the web form, quo-ai-new-lead creates the contact row → pipeline realtime subscription adds a new card to NEW LEAD column → toast notifies.
- [ ] Alex sends opener SMS → appears in contact's thread.
- [ ] Customer replies → toast appears with preview + tab title shows "(1) BPP CRM".

---

## The 19 commits (in order)

| # | Commit | Session focus |
|---|---|---|
| 1 | `e510c32` | S1-2: foundation walking skeleton (shell + auth + list + detail + compose) |
| 2 | `289b638` | S3: pipeline + drag-to-change-stage |
| 3 | `393335c` | S4: Sparky AI + ⌘K command palette |
| 4 | `ea2d3a5` | S5: messages inbox + morning briefing |
| 5 | `38f597d` | S6: finance + calendar |
| 6 | `1be8d2f` | S7: permits + materials + dark mode + PWA manifest |
| 7 | `687a2f5` | S8: Twilio Voice SDK |
| 8 | `9b52580` | S9: detail tab strip + stage picker + SIGN IN bevel |
| 9 | `90ebc38` | S10: "+" action → new lead modal |
| 10 | `bb49459` | S11: service worker + offline shell |
| 11 | `7f274ba` | S12: accessibility (focus rings, ARIA, skip link, reduced motion) |
| 12 | `21c2831` | S13: shakedown + cut-over playbook |
| 13 | `09067ea` | S14-15: edit contact tab + keyboard shortcuts (g+L, g+C, etc.) |
| 14 | `42e328c` | S16: CSV export + keyboard help (?) + palette actions |
| 15 | `ced4c0d` | S17: toast notification system |
| 16 | `12d3343` | S18: global inbound-SMS toast |
| 17 | `bde5e17` | S19: dynamic page title with unread count |

Total additions across v2: ~5,400 lines (JSX app logic + CSS tokens + service worker + PWA manifest + 14 design canvases).

---

## What's genuinely NOT in v2 yet

**Defer — nice to have but not blocking daily work:**
- Focus trap inside modals (tab can escape — not security-critical, just polish).
- Fuzzy rank in command palette (uses simple ilike — works fine for short contact lists).
- Real weekly calendar grid (needs an `events` table — current tab shows stage 3-8 leads).
- Bulk selection + bulk stage change.
- Customer attachment upload from compose bar (Alex inbound media still works).
- Photo render for Street View house avatars (currently shows colored initials only).
- Full Alex session replay (shows messages table only, not alex_sessions per-turn history).
- Stripe invoice creation / proposal send-link flow from detail panel (still happens via existing crm.html flow).
- Permit portal automation trigger.

**Monitor — may need adjustment after real use:**
- Pagination at 1000+ contacts — current limit is 500 on pipeline / 100 on list / 20 on finance. If your contact count crosses these thresholds, load-more buttons need wiring.
- Dark mode contrast — tokens.css has dark overrides but only a handful of screens were eyeball-tested in dark. If anything looks wrong, flag it.
- Service worker cache invalidation — bumping `CACHE_VERSION` in `sw.js` will force clients to refresh. If you change anything in the shell, bump the version.

---

## Cut-over recommendation

Follow `crm/v2/CUTOVER.md`. Start with **Option A (soft cut-over)** — just update your bookmark + iPhone home-screen icon to `/crm/v2/`. Use it for 3-7 days. If green the whole time, do Option B (redirect the old URL). Only consider Option C (burn legacy) after 2 more weeks.

DO NOT delete `/crm/crm.html` during initial shakedown. If something catastrophic happens in v2, the legacy CRM is your safety net.

---

## Architecture — how to think about what got built

```
┌─ backuppowerpro.com/crm/v2/index.html
│  ├─ React 18 + Babel standalone (no build step, matches static deploy)
│  ├─ supabase-js v2.45 (auth + realtime + storage)
│  ├─ Twilio Voice SDK v2.18.1 (lazy-loaded after auth)
│  ├─ PWA manifest + service worker
│  └─ Skip link + focus rings
│
├─ tokens.css (183 lines)          LOCKED design system
│   ├─ colors + MS palette + bevels
│   ├─ fonts (Inter/VT323/Rajdhani/JetBrains Mono)
│   ├─ LCD screen utility
│   └─ :focus-visible + @prefers-reduced-motion
│
├─ 14 design component .jsx files   Claude-Design-generated, patched
│   ├─ shell.jsx        TopBar/TabBar/BottomBar
│   ├─ leads-*.jsx      Pipeline, List, Permits, Materials
│   ├─ contact-detail.jsx
│   ├─ messages-inbox.jsx
│   ├─ finance.jsx, calendar.jsx, sparky.jsx
│   ├─ briefing.jsx, command-palette.jsx, voice-call.jsx
│   └─ compressed-list.jsx, design-canvas.jsx
│
├─ app.jsx (~1,900 lines)           Live data orchestrator
│   ├─ Supabase client + auth
│   ├─ Live* wrappers around each design component
│   ├─ useVoiceDevice hook (Twilio lifecycle)
│   ├─ Command palette + toast + help + new-lead modals
│   ├─ Keyboard shortcuts
│   └─ Page-title + unread count
│
└─ sw.js                            Offline shell + CDN caching
```

---

## The golden rule for any future work

The design system in `tokens.css` is **locked**. Any new UI must use:
- Tokens from tokens.css (colors, fonts, spacing, bevels).
- Utilities: `.raised`, `.pressed`, `.tactile-raised`, `.tactile-flat`, `.lcd`, `.chrome-label`, `.mono`, `.pixel`.
- Never: rounded corners, gradients, blurred shadows, ease transitions, Arial.

The whole point of the Claude Design export was to establish this lock. Honor it and the aesthetic stays consistent forever.

---

## Known known-issues

- **Duplicate `Avatar` function** in both leads-list.jsx and messages-inbox.jsx. Second one (messages-inbox) wins in window scope but each file uses its own local. Non-breaking, just noise.
- **Babel in-browser warning** prints 20+ times on every load. Expected; Babel standalone is dev-mode. Does not affect behavior.
- **`t.tint` undefined errors** may still appear in console from some edge cases in messages-inbox Avatar. Guarded with early return — renders correctly.

None of these block daily use.

---

## Test in the morning, report any issues, and I'll continue from there.
