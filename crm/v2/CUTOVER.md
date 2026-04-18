# CRM v2 Cut-Over Playbook

Walk through this when you're ready to retire the old `crm.html` and make v2 the default.

## Pre-flight shakedown (15 minutes)

Run through this checklist on your laptop + iPhone before cutting over.

### Laptop — desktop at 1440×900+

- [ ] Open `backuppowerpro.com/crm/v2/` and sign in with your Supabase credentials.
- [ ] LEADS tab loads. Live contacts visible in pipeline view.
- [ ] Drag a card between columns — stage updates, page doesn't reload, stage_history row inserts.
- [ ] Switch to LIST sub-view. Same contacts visible. Click one → detail panel slides in.
- [ ] Switch to PERMITS sub-view. 7-step tiled board renders.
- [ ] Switch to MATERIALS sub-view. Amp toggle + checkboxes render.
- [ ] Click a contact's stage pill in detail panel → stage picker opens → pick a new stage → update persists.
- [ ] Click each detail tab: MESSAGES / TIMELINE / QUOTE / PERMITS / NOTES. All load.
- [ ] On NOTES tab, type a note + click SAVE. "SAVED" LCD green confirmation flashes.
- [ ] Click green call button on contact detail → Twilio Voice SDK dials (make sure mic is allowed). Hang up.
- [ ] CALENDAR tab loads.
- [ ] FINANCE tab loads with KPI LCDs + 3 sub-tabs (Proposals / Invoices / Payments).
- [ ] MESSAGES tab loads inbox. Click a thread → opens detail panel.
- [ ] SPARKY tab loads. Ask it a question ("who hasn't replied in 3 days?"). Verify it responds.
- [ ] Press ⌘K. Command palette opens. Type a contact name → results appear → enter selects.
- [ ] Click "+" button (navy square, top right). New Lead modal opens. Fill name + phone + address → CREATE → detail panel opens for the new contact.
- [ ] Click sun icon (top right, small square). Dark mode activates. Refresh — stays dark.
- [ ] Press Tab key — focus ring visible as gold outline. Skip link works on first Tab.

### iPhone — PWA install

- [ ] Open `backuppowerpro.com/crm/v2/` in Safari.
- [ ] Tap Share → Add to Home Screen. Icon lands on home screen as "BPP".
- [ ] Open the PWA. No browser chrome. Full-screen.
- [ ] Top bar sits below the notch. Morphing input + tab bar above the home indicator line.
- [ ] Scroll through list. No jitter. Pull-to-refresh disabled.
- [ ] Tap a contact. Detail panel takes the full screen. Back chevron returns to list.
- [ ] Tap green call button. Twilio dials. (First time asks for mic permission.)
- [ ] Turn off WiFi. Reopen the PWA. Shell still loads (service worker cache). UI renders empty states. Turn WiFi back on — data flows.

## Cut-over (if shakedown passes)

### Option A — soft cut-over (recommended)

Keep both live for 7 days while you live-test v2.

1. No file changes. Just update your bookmarks + iPhone home-screen icon to point to `/crm/v2/`.
2. Use v2 for daily work.
3. Revert instantly by using the old URL `/crm/crm.html` if anything breaks.
4. After 7 days of green usage: proceed to Option B.

### Option B — hard cut-over

1. Rename current `crm.html` to `crm-legacy.html`:
   ```bash
   cd /Users/keygoodson/Desktop/CLAUDE
   git mv crm/crm.html crm/crm-legacy.html
   ```
2. Create a small redirect `crm/crm.html` that bounces to v2:
   ```html
   <!doctype html>
   <html><head>
   <meta http-equiv="refresh" content="0;url=/crm/v2/">
   <link rel="canonical" href="/crm/v2/">
   <title>BPP CRM</title>
   </head><body>
   <p>Redirecting to <a href="/crm/v2/">/crm/v2/</a>…</p>
   </body></html>
   ```
3. Commit + push. GitHub Pages auto-deploys within 1-2 min.
4. Any bookmark / home-screen icon pointing to `/crm/crm.html` now lands on v2.

### Option C — full replace

After Option B has been stable for another 2 weeks:

1. `git rm crm/crm-legacy.html` — burn the legacy codebase.
2. Move v2 files up one level (or keep `/crm/v2/` URL — either works).
3. This is the point of no return. Only do this after you're 100% on v2.

## Rollback

If anything breaks mid-cut-over:

1. **Soft cut-over rollback**: just go back to `/crm/crm.html` in your bookmark.
2. **Hard cut-over rollback** (Option B):
   ```bash
   git log --oneline crm/  # find commit before cut-over
   git revert <commit-hash>
   git push
   ```
3. **Full replace rollback** (Option C): restore from git history.

## Known v2 gaps (won't-block-cutover, future polish)

- Full Alex SMS session history doesn't show in detail panel yet (only messages table — alex_sessions merge is a future enhancement).
- Calendar is a stub — no weekly grid yet, shows booked+ leads as a list. Real calendar requires adding an `events` table.
- Command palette doesn't fuzzy-rank — uses simple `ilike` OR-match.
- Focus trap not implemented on modals (can tab out — not dangerous).
- No image/attachment upload from compose bar (inbound media from Alex still shows).
- Performance untested beyond 500 contacts. Should add pagination before BPP grows past 1k.

## Questions / issues

Log them in `wiki/CRM/Technical Debt.md` or flag me in the next session.
