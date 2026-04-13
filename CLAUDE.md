# BPP — AI Entry Point

You are working on **Backup Power Pro**, a generator inlet installation business in Upstate SC owned by Key Goodson.

---

## Step 1 — Read the Second Brain

Read these two files before doing anything else:
1. `wiki/00 Home.md` — full business overview, current status, tech stack, what's running
2. Read whichever branch pages are relevant to what Key needs

> If you're unfamiliar with how the wiki works, also read `wiki/CLAUDE.md` first.

---

## Credentials

All API keys, tokens, and passwords:
`/Users/keygoodson/.claude/credentials.md`

Gitignored. Never pushed. Never hardcoded in frontend files.

---

## Deployment

Repo at `/Users/keygoodson/Desktop/CLAUDE` → auto-deploys to backuppowerpro.com via GitHub Pages.
`git add [files] && git commit -m "message" && git push`

---

## Hard Rules

- Never touch `CNAME`, never modify `.gitignore` rules (only add)
- Never move `ads/creative/`, `img/`, `assets/`, `supabase/functions/`
- Never upload ad creative to Meta without Key's explicit approval
- Never post to GBP without Key's explicit approval
- When Key needs to do a UI action: open Chrome first, navigate to exact page, THEN tell him what to click
- Geography: Greenville, Spartanburg, Pickens counties only — NO Anderson County

---

## Critic Pass (Auto — runs during active build sessions)

After any substantial build, pick the right critic(s) from the table below, run them as background agents, fix what's real, and report briefly. Key trusts your judgment — fix without asking.

**Skip when:** one-line fix, purely internal change, or conversational session with no concrete output.

**After critics finish:** fix real bugs and clear UX failures autonomously. Tell Key one line: "Critic caught X, fixed Y." Only surface details if something was surprising or unfixable.

---

### Routing — which critic(s) to run

| What was built | Critics |
|---|---|
| CRM feature / UI change | UX Standard + Security Quick |
| Edge function / server route | Backend Standard + Security Standard |
| Ad creative / marketing copy | Copy Brutal + Sales Standard |
| Website page or landing page | UX Standard + Design Standard + Copy Standard |
| Major overhaul (3+ files changed) | UX Brutal + relevant specialist(s) |
| Auth / payments / data handling | Security Brutal |

Run multiple critics in parallel as separate background agents when needed.

**Full critic prompts:** Read `.claude/critics.md` when running any critic or agent. Do not load it otherwise.

---

## Auto-Skills (Mandatory — fires without being asked)

Skills invoke automatically based on what's being built. No command needed. Just do the work — the right skills run in the background.

**Rule:** Before starting any task, scan this table. If your task matches, invoke the listed skills. Do not wait to be asked. Do not mention you're doing it unless something surprising comes up.

---

### Skill Routing Table

| Task type | Skills to invoke — automatically |
|---|---|
| Any HTML/CSS/JS UI work | `web-design-guidelines` + `ui-ux-pro-max` |
| CRM feature / neumorphic component | `liquid-glass-design` + `web-design-guidelines` + `ui-ux-pro-max` |
| New web page (public-facing) | `frontend-design:frontend-design` + `seo` + `web-design-guidelines` |
| After finishing any HTML page | `webapp-testing` (Final Eyes — screenshot the page) |
| Customer-facing copy (any) | `brand-voice` + `content-engine` |
| Ad creative / landing page copy | `brand-voice` + `content-engine` + `seo` |
| Image generation | `nano-banana` (ALWAYS — non-negotiable) |
| PDF creation or export | `anthropic-skills:pdf` |
| Edge function / Supabase function | `security-review` |
| Auth / data / payments | `security-review` + `security-scan` |
| Research task | `deep-research` |
| Substantial code change (3+ files) | `simplify` (after build) |
| Styling / color / typography | `ui-styling` + `design-system` |
| Design system decisions | `design-system` + `design` |
| Brand / voice / identity | `brand` + `brand-voice` |

---

### How to invoke

Use the `Skill` tool silently in the background. Read the skill output and apply what's relevant. Don't narrate every skill invocation — just do the work better because of it.

**Exception:** If a skill surfaces something surprising or unfixable, surface it in one line: "Skill flagged X, applied Y."

---

## End of Session

If you made meaningful changes:
1. Update the relevant wiki pages
2. Append to `wiki/00 Log.md` with date + what changed
3. `git add CLAUDE.md && git commit -m "message" && git push` for any committed file changes
