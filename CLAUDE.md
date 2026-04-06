# BPP — AI Agent Entry Point

You are working on **Backup Power Pro**, a generator inlet installation business in Upstate SC owned by Key Goodson.

## Start here — every session

1. **Read `BPP_BRAIN.md`** — master context file. Full business, tech stack, what's running, what's pending, and the change log.

2. **Read `/Users/keygoodson/.claude/projects/-Users-keygoodson-Desktop-CLAUDE/memory/MEMORY.md`** — Claude Code auto-memory. Current account state, credentials locations, session notes.

3. **Check `PENDING UPDATES` section at the top of `BPP_BRAIN.md`**. If it contains anything other than `*— No pending updates —*`:
   - Read each update entry carefully
   - Apply the changes to the relevant sections of `BPP_BRAIN.md`
   - Add entries to the Change Log for each one
   - Replace the pending content with `*— No pending updates —*`
   - `git add BPP_BRAIN.md && git commit -m "Apply pending brain updates from other AI sessions" && git push`
   - Tell Key what you processed so he knows it landed

## Before you finish any session

**If you made meaningful changes**, add an entry to the Change Log in `BPP_BRAIN.md`:
```
- [YYYY-MM-DD] What you changed — why you changed it
```
Update the relevant section too. Then `git add BPP_BRAIN.md && git commit -m "Update brain" && git push`.

This is how the brain grows. Every AI builds on what the last one figured out.

## Credentials

All API keys, tokens, and passwords are in:
`/Users/keygoodson/.claude/credentials.md`

This file is gitignored and never pushed to GitHub. Read it when you need a key. Never hardcode secrets in frontend files.

## Deployment

The repo at `/Users/keygoodson/Desktop/CLAUDE` deploys automatically to backuppowerpro.com via GitHub Pages.
Deploy: `git add [files] && git commit -m "message" && git push`

## Key rules

- Never touch `CNAME`, never modify `.gitignore` rules (only add)
- Never move `ads/creative/`, `img/`, `assets/`, `supabase/functions/`
- Never upload ad creative to Meta without Key's explicit approval
- Never post to GBP without Key's explicit approval
- When Key needs to do a UI action: open Chrome first, navigate to exact page, THEN tell him what to click
- Geography: Greenville, Spartanburg, Pickens counties only — NO Anderson County
