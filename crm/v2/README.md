# BPP CRM v2 — walking skeleton

Design rebuilt in Claude Design, exported, and wired to live Supabase data. Runs in parallel to `/crm/crm.html` (untouched).

**Live URL (once deployed):** `backuppowerpro.com/crm/v2/`
**Local preview:** `http://localhost:8092/crm/v2/` (run `npx http-server . -p 8092` from repo root)

---

## What's WIRED (works with real data)

- **Auth gate** — Supabase Auth email/password. Renders the locked operator-terminal aesthetic.
- **Leads list** — live Supabase contacts feed with realtime subscriptions. Sort by `created_at DESC`, limit 100.
- **Contact detail panel** — slide-over on desktop, full-screen on mobile. Pulls messages table filtered by contact_id, live-subscribed to inserts.
- **SMS compose** — morphing bottom bar (SMS COMPOSE mode). Send button hits the existing `send-sms` edge function with the typed body.
- **Tab bar navigation** — LEADS/CALENDAR/FINANCE/MESSAGES/SPARKY switches. All except LEADS are placeholder "WIRING IN NEXT SESSION" panels.
- **Responsive** — desktop (>= 768px) renders 3-col grid list + fixed slide-over panel; mobile renders single-column list + full-screen panel.
- **Safe-area padding** — `env(safe-area-inset-*)` respected throughout (top notch + bottom home indicator).

## What's STUBBED (placeholder screens)

Calendar / Finance / Messages / Sparky tabs show a "WIRING IN NEXT SESSION" placeholder. The design components exist (`calendar.jsx`, `finance.jsx`, `messages-inbox.jsx`, `sparky.jsx`) but they render mock data. Next session: wire each to live queries.

## What's NOT YET built

- Pipeline drag-and-drop (stage transitions via drag). Pipeline-view itself isn't even mounted yet — only List view. Wire next.
- Command palette ⌘K keyboard shortcut + fuzzy search.
- Twilio Voice SDK integration (Voice Call UI exists but not wired).
- Morning briefing modal trigger (once-per-day).
- Sparky AI chat → `ai-taskmaster` edge function.
- Stripe checkout flow for proposal approval (existing edge function already fires CAPI — just need UI hook).
- Materials / Permits / Finance / Calendar live data binding.
- Dark mode toggle persistence.
- PWA manifest (`manifest.json`) for home-screen install.

## File structure

```
crm/v2/
├── index.html            # entry point, loads CDNs + all .jsx via Babel standalone
├── app.jsx               # live app orchestrator — auth, routing, data layer
├── tokens.css            # locked design system (183 lines)
├── shell.jsx             # TopBar / TabBar / BottomBar (morphing) — patched for onChange
├── leads-list.jsx        # LeadRow / LeadsListDesktop / LeadsListMobile — patched for rows prop
├── leads-pipeline.jsx    # 9-column kanban (mock data)
├── contact-detail.jsx    # SMS thread / timeline / quote / permits / notes
├── leads-permits.jsx     # 7-step tiled board (mock data)
├── leads-materials.jsx   # Amp toggle + checkbox grid (mock data)
├── calendar.jsx          # Weekly view + mobile agenda (mock data)
├── finance.jsx           # KPI strip + proposals/invoices/payments (mock data)
├── messages-inbox.jsx    # Full-width inbox (mock data)
├── sparky.jsx            # Sparky AI panel + floating trigger (mock data)
├── briefing.jsx          # Morning briefing modal (mock data)
├── command-palette.jsx   # ⌘K palette (mock data)
├── voice-call.jsx        # 3-state voice call modal (mock data)
├── compressed-list.jsx   # Helper for detail-panel-open state
└── design-canvas.jsx     # Design-preview wrapper (used by original Claude Design exports)
```

## Running locally

```bash
cd /Users/keygoodson/Desktop/CLAUDE
npx http-server . -p 8092 -c-1
# open http://localhost:8092/crm/v2/
```

## Deploying

Push to GitHub. GitHub Pages serves `backuppowerpro.com/crm/v2/` automatically. The existing `backuppowerpro.com/crm/crm.html` stays live and untouched.

## Design system lock

Every value in `tokens.css` is the locked design language from the Minesweeper-brutalist + Cybertruck + 8-bit spec. When polishing or adding screens:

- NEVER use `border-radius` other than 0 (except `.avatar-clip` polygon).
- NEVER use `linear-gradient`, `backdrop-filter`, blurred shadows/text-shadows.
- NEVER use ease/cubic-bezier transitions — always `steps(4, end)`.
- Body text: Inter. Headlines/LCD: VT323. Tactical chrome: Rajdhani. Numbers/code: JetBrains Mono.

See `wiki/CRM/Style Guide.md` for the full reference.

## Next session checklist

1. Log in to verify live contacts render with correct aesthetic.
2. Click a contact → verify messages thread loads + realtime update on new inbound.
3. Send a test SMS → verify it lands in Twilio + appears in thread instantly.
4. Wire pipeline view with real stage buckets.
5. Wire Sparky AI to `ai-taskmaster`.
6. Wire command palette ⌘K.
7. Wire Twilio Voice SDK.
8. Wire morning briefing modal trigger.
9. Once all live: swap `crm.html` → `crm-legacy.html`, rename `v2/` to the current directory.

## Known polish items

- Auth gate SIGN IN button bevel subtle (explicit inset shadow doesn't show well on navy). Swap for `--raised` token.
- Morphing bottom bar not visible on current layout (LiveContactDetail has its own ComposeBar at the bottom of the panel — which overrides the shell's bottom bar inside the panel). Fine for the MVP; next pass can unify.
- TabBar needs click-to-navigate route update (uses hash routing pattern eventually; currently state-only).
