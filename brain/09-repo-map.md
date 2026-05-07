> This file is auto-synced from `wiki/Key/<name>.md` via `scripts/brain/sync-from-wiki.sh`.
> Edit the wiki source, not this file. Sanitization strips specific dollar figures, account balances, and phone numbers.

# Repo Map (how to find anything)

> The "where does X live" sitemap. Tracked + sanitized into `brain/09-repo-map.md` so fresh clones and cloud agents can navigate without exploring blind.

When a session needs to **find something specific** (not "what's Key's voice?" but "where do edge functions go?"), this is the map.

---

## Code

| What | Path | Notes |
|---|---|---|
| Edge functions (Deno + Supabase) | `supabase/functions/<name>/index.ts` | One folder per function. Shared helpers in `supabase/functions/_shared/`. Deploy: `supabase functions deploy <name> --project-ref reowtzedjflwmlptupbk` |
| Database migrations | `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql` | Apply via `supabase db push --linked` (needs DB password) or paste into dashboard SQL editor |
| CRM single-page app | `crm/crm.html` | ~14k lines, vanilla JS + Supabase. Live at `/crm/crm.html`. Minesweeper Brutalist style (see `wiki/CRM/Style Guide.md`) |
| Customer-facing pages | `index.html`, `proposal.html`, `invoice.html`, `quote-calculator.html`, `get-quote.html` (stub), website/* (drafts) | Polished modern marketing. NEVER receive CRM Brutalist styling. See `PRODUCTION-SURFACE-MAP.md` for live-vs-draft truth. |
| Ad creative | `ads/creative/` | Never upload to Meta without Key's explicit approval |
| Permit mailing inserts | `permits/mailing-inserts/` + `permits/gen-envelopes.js` | 8.5×11 folds to #10 window envelope |
| Bot lab (Ashley dev sandbox) | `bot-lab/` | Personas, eval batches, voice corpus, jurisdictions JSON |

## Wiki (per-machine, gitignored, present only on Key's machine + worktrees)

| What | Path |
|---|---|
| Master business overview | `wiki/00 Home.md` |
| Workshop captures (Key's voice, decisions, identity) | `wiki/Key/*.md` (mirrors → brain/) |
| CRM design system (full) | `wiki/CRM/Style Guide.md` |
| Experiments | `wiki/Experiments/Experiment Registry.md` + `wiki/Experiments/Active Roadmap.md` + `wiki/Experiments/Experiments Overview.md` |
| Site analytics (PostHog dump) | `wiki/Website/Site Analytics.md` |
| Permit jurisdictions | `wiki/Operations/Permit Jurisdictions.md` |
| Hormozi scaling roadmap | `wiki/BPP/Hormozi Scaling Roadmap.md` |
| Core offer / Three Conditions to Close | `wiki/BPP/Core Offer.md` |

## Scripts

| Script | Purpose |
|---|---|
| `scripts/brain/sync-from-wiki.sh` | Mirror wiki/Key/ → brain/ with sanitization. `--force` to override drift protection. |
| `scripts/brain/validate.sh` | Hard-rule guard (em-dashes, $ leaks, phone leaks, file presence) on brain/ + CLAUDE.md |
| `scripts/brain/status.sh` | At-a-glance: last sync, drift, file census, open-Q count, validation |
| `scripts/brain/fetch-posthog.sh` | Refresh `wiki/Website/Site Analytics.md` from PostHog |
| `scripts/brain/fetch-meta.sh` | Refresh ad metrics |
| `scripts/brain/fetch-permits.sh` | Refresh permit state |
| `scripts/brain/refresh-brain.sh` | Run all the above, then synthesize CEO brief |

## Credentials + secrets

| What | Where |
|---|---|
| All API keys, tokens, passwords | `/Users/keygoodson/.claude/credentials.md` (gitignored, per-machine) |
| Supabase edge-function secrets | Set via `supabase secrets set NAME=value`, read via `Deno.env.get('NAME')` |
| Supabase publishable key (frontend-safe) | `sb_publishable_4tYd9eFAYCTjnoKl1hbBBg_yyO9-vMB` |
| Supabase service-role | Edge functions only, never hardcoded; read via env |
| Brain token (internal endpoints) | `BPP_BRAIN_TOKEN` env var |

## Deploy

| Action | Command |
|---|---|
| Push site | `git add <files> && git commit -m "..." && git push` (auto-deploys via GitHub Pages) |
| Deploy edge function | `supabase functions deploy <name> --project-ref reowtzedjflwmlptupbk` |
| Apply migration (CLI) | `supabase db push --linked` (needs DB password) |
| Apply migration (manual) | Supabase dashboard → SQL Editor → paste file → run |

## Conventions (so a session recognizes patterns it sees)

| Pattern | Where used | Meaning |
|---|---|---|
| `__pm_<key>:<value>` lines in `contacts.install_notes` | permit-morning-check, CRM permit section | Permit-tracking key-value (jurisdiction, submitted_at, paid_at, etc.) |
| `__orch_<trigger>:<iso>` lines in `contacts.notes` | comm-orchestrator | One-time fire markers for stage-aware nudges |
| `__review_asked:<iso>` in `contacts.notes` | auto-review-ask | One-time GBP review ask marker |
| `__install_at:<iso>`, `__insp_*` | CRM | Install + inspection scheduling |
| `messages.sender = 'key' \| 'bot' \| 'ashley' \| 'system'` | send-sms, bot-engine | Authorship attribution; key-takeover detection uses 'key' |
| `bot_disabled = true` on contacts | bot-engine | Permanent AI silence (Key took over manually) |
| `do_not_contact = true` | TCPA gate everywhere | Outbound SMS/voice MUST check before send |

## Decisions + history

| What | Where |
|---|---|
| Operating-context decisions (voice, identity, autonomy) | `brain/07-decisions-log.md` (sanitized) + `wiki/Key/Decisions Log.md` (full) |
| Daily session log (what shipped) | `wiki/00 Log.md` |
| Memory feedback (per-machine) | `/Users/keygoodson/.claude/projects/-Users-keygoodson-Desktop-CLAUDE/memory/` |
| Open questions Key hasn't answered | `brain/08-open-questions.md` + `wiki/Key/Open Questions.md` |

## Hard rules (find them)

| Rule | Source |
|---|---|
| No em-dashes anywhere | `brain/03-my-voice.md`, `brain/04-avoid-list.md`, enforced by `scripts/brain/validate.sh` |
| Geography: GVL/Spart/Pickens only, NO Anderson | `brain/04-avoid-list.md`, `bot-lab/sc-jurisdictions.json` |
| No outsourcing customer-facing functions | `brain/04-avoid-list.md` |
| No Generac whole-home | `brain/04-avoid-list.md` |
| Stage 4+ no AI customer comms (carve-out: permit pipeline) | `crm/crm.html` (gated in `pass2`), `comm-orchestrator/index.ts` |
| Reversibility test as autonomy boundary | `brain/02-how-i-decide.md` + top of `CLAUDE.md` |

## When something isn't in this map

- If it's a code-level detail (function signature, table column), grep the repo: `grep -rn 'pattern' supabase/ crm/`.
- If it's an operating-context question (Key's preference, voice rule), it's in brain/01-08.
- If it's a business-state question (current campaigns, open quotes, this week's leads), pull the morning brief or check `wiki/00 Home.md` if available.
- If none of those have it, it's an open question. Add it to `wiki/Key/Open Questions.md` and surface to Key.
