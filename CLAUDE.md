# BPP — AI Agent Entry Point

You are working on **Backup Power Pro**, a generator inlet installation business in Upstate SC owned by Key Goodson.

## Start here — every session

1. **Read `BPP_BRAIN.md`** — this is the master context file. It contains the full business, tech stack, what's running, what's pending, and the change log. Read it before doing anything.

2. **Read `/Users/keygoodson/.claude/projects/-Users-keygoodson-Desktop-CLAUDE/memory/MEMORY.md`** — Claude Code's auto-memory. Contains current account state, credentials locations, and session-specific notes.

3. **Check the change log** at the bottom of `BPP_BRAIN.md` to understand what other AI sessions have done since you last worked on this.

## Before you finish any session

**If you made meaningful changes**, add an entry to the Change Log in `BPP_BRAIN.md`:
```
- [YYYY-MM-DD] What you changed — why you changed it
```
And update the relevant section of `BPP_BRAIN.md` to reflect the new state.

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
