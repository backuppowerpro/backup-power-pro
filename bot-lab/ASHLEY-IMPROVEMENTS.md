# Ashley Production Smoke-Test Improvements

Live test 2026-05-05 on Key's phone via OpenPhone bypass. Full pipeline verified end-to-end. Bugs + improvements below, organized by severity.

## Result: **PIPELINE WORKS** ✅
Form → GREETING → 9 conversation turns → COMPLETE → handoff alert from 7155 to Key's cell. All edge functions firing.

---

## Critical (block conversation)

### 1. State machine: AWAIT_240V missing `affirmative` ✅ FIXED
- Bare "yes" to 240V Q fell through to NEEDS_CALLBACK.
- Fix: added `affirmative: 'AWAIT_OUTLET'` mapping.

### 2. JWT toggle resets on every deploy ⚠️ ARCHITECTURAL
- `Verify JWT with legacy secret` toggle flips back to ON every time `supabase functions deploy` runs.
- Affects every internal-call surface (bot-engine→bot-classifier, bot-engine→handoff-notifier, alex-agent→bot-engine).
- Symptom: 401 `UNAUTHORIZED_INVALID_JWT_FORMAT` on internal fetch.
- Workaround so far: manually re-toggle after every deploy.
- **Permanent fix:** add `[functions.<name>] verify_jwt = false` to `supabase/config.toml` for every internal-only fn so deploys preserve the setting.

### 3. system-prompt.txt not bundled ✅ FIXED
- `Deno.readTextFile('./system-prompt.txt')` failed at runtime; .txt assets weren't in deploy bundle.
- Fix: converted to .ts modules with `export const SYSTEM_PROMPT_TEMPLATE = \`...\`` and static import.

### 4. bot-engine schema mismatch (first_name/last_name) ✅ FIXED
- contacts table only has `name` column; bot-engine SELECT included nonexistent first_name/last_name.
- Fix: dropped those from SELECT + buildSmCtx.

### 5. handoff-notifier schema mismatch ✅ FIXED
- Same first_name/last_name issue.
- Fix: stripped via sed; lname now empty string.

---

## High (degrades quality but conversation completes)

### 6. Slot extraction missing for AWAIT_EMAIL multi-field response
- Customer sent: `Goodson, key@backuppowerpro.com, 22 Kimbell Ct Greenville SC 29615`
- All three slots (last_name, email, install_address) were NOT extracted to contact row.
- Result: handoff text shows `Unknown` for name, missing address.
- **Fix:** classifier needs to extract email + address from a single combined response, AND bot-engine needs to write those slots when the classifier emits them. Currently bot-engine only writes a hardcoded set (gen_240v, outlet_amps, email when label=email_provided). Need to generalize.

### 7. Email typo detector flags real custom domains
- `key@backuppowerpro.com` triggered `email_typo_suspected=true`.
- Pattern matching probably checks against major-domain typos (gmial→gmail) but treats long custom domains as suspicious.
- **Fix:** classifier prompt — only flag typos for KNOWN major email providers (gmail/yahoo/hotmail/outlook/icloud). Custom domains pass through.

### 8. Photo MMS not detected by alex-agent
- Sent panel photo MMS via iMessage to OpenPhone 5302.
- alex-agent fired but no `[alex] Incoming` log → returned via `if (!messageText && !hasMedia)` skip.
- OpenPhone webhook payload uses different field name than `messageData.media[]`.
- **Fix:** inspect a real OpenPhone MMS webhook payload via debug log and update `hasMedia` detection. Likely it's `messageData.attachments` or nested `data.object.media`.

### 9. Inbound messages don't appear in CRM thread
- Ashley gate routes BEFORE alex-agent's messages-table insert.
- Result: customer's "yes", "50 amp", etc. invisible in CRM; only Ashley's outbound shows.
- **Fix:** bot-engine should insert an `inbound` row when handling inbound_message, OR alex-agent gate should insert before short-circuiting.

### 10. Contact `name` not populated from form firstName
- Form posts firstName="Key", but contacts.name ends up NULL.
- Result: GREETING says "Hi there" instead of "Hi Key".
- **Fix:** quo-ai-new-lead — set `name` column from firstName + lastName on contact insert.

---

## Medium (functional but ugly)

### 11. RECAP missing email + address in confirmation
- After all close-info given, RECAP said only "240v 50A, garage exterior" — no email or address.
- Slot extraction (#6) is upstream cause.

### 12. SCHEDULE_QUOTE → terminal needs explicit affirmative
- Customer's "thanks" was classified as something other than affirmative/unclear → routed to NEEDS_CALLBACK.
- Specific classifier label was probably `friendly_chitchat` which isn't in SCHEDULE_QUOTE's transition map.
- **Fix:** add `friendly_chitchat: 'COMPLETE'` to SCHEDULE_QUOTE transitions.

### 13. RECAP transitions need richer mapping
- "yes confirmed" took two cycles to reach COMPLETE — RECAP → SCHEDULE_QUOTE → (separate yes) → COMPLETE.
- Could SCHEDULE_QUOTE be auto-onEnter-terminal when slots are filled? Would skip an extra round-trip per conversation.

### 14. Multi-turn lag ~25–35s
- Each Ashley reply: classifier + state machine + phraser + send-sms + OpenPhone delivery.
- Acceptable for SMS context (humans expect this) but track.

### 15. Sweep all states for missing common transitions
- Pattern: every state asking yes/no needs `affirmative` AND `negative` mapped explicitly.
- Apply audit to all 30+ states post-test.

---

## Production cleanup (post A2P 10DLC)

### 16. Remove OpenPhone bypass
- Once A2P clears: `supabase secrets unset ASHLEY_OPENPHONE_TEST_PHONES`.
- Outbound returns to Twilio 7800.

### 17. handoff-notifier OpenPhone path
- Currently routes via 7155 OpenPhone when test-phones var set.
- After A2P: hand-coded fallback to direct Twilio (already there) takes over.

### 18. Open ASHLEY_ALLOWED_PHONES to '*'
- Currently +19414417996 only.
- After A2P + ~20 successful test conversations from various test phones: open to all qualifying leads.

---

## Documentation/observability

### 19. Add classifier output + intent to log lines
- Currently bot-engine logs only at error level.
- Add INFO logs: `[bot-engine] classifier={label, conf}, transition={prev}→{next}, intent={...}`
- Lets us debug state-machine routing without DB queries.

### 20. Photo classifier integration not tested
- Photo MMS never reached alex-agent (issue #8).
- Once #8 fixed, validate photo classifier with real panel/sub-panel/non-panel images.

---

*Final state of test contact ed36d39f-91cb-4cdd-922c-586b094c7ad5: bot_state=COMPLETE, handoff fired with score 1.5/5 BORDERLINE.*
