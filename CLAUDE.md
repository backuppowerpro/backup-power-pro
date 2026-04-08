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

## End of Session

If you made meaningful changes:
1. Update the relevant wiki pages
2. Append to `wiki/00 Log.md` with date + what changed
3. `git add CLAUDE.md && git commit -m "message" && git push` for any committed file changes
