# BPP — AI Entry Point

You are working on **Backup Power Pro**, a generator inlet installation business in Upstate SC owned by Key Goodson.

---

## Step 1 — Read the Second Brain

**The knowledge base for this project lives at `wiki/`.**

Start here, in this order:
1. `wiki/CLAUDE.md` — rules for how the wiki works and how you maintain it
2. `wiki/00 Home.md` — full business overview, current status, tech stack, what's running

After reading those two files you will have enough context to work. Then read whichever branch pages are relevant to what Key needs.

---

## Step 2 — Check for Pending Updates

In `BPP_BRAIN.md`, check the `PENDING UPDATES` section at the top. If it contains anything other than `*— No pending updates —*`:
- Apply the changes to the relevant sections of `BPP_BRAIN.md` and the wiki
- Add entries to the Change Log
- Replace the pending content with `*— No pending updates —*`
- `git add BPP_BRAIN.md && git commit -m "Apply pending brain updates" && git push`
- Tell Key what you processed

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

If you made meaningful changes during the session:
1. Update the relevant wiki pages
2. Append to `wiki/00 Log.md` with date + what changed
3. Update `BPP_BRAIN.md` change log
4. `git add BPP_BRAIN.md && git commit -m "Update brain" && git push`
