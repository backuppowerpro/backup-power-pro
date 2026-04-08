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

After completing any substantial build — new feature, page redesign, ad copy, edge function, or anything a user would interact with — spin up a background critic agent before closing out. The critic's only job is to find problems: bugs, UX friction, confusing copy, missed edge cases, dark mode gaps, mobile issues, or anything that would make a real user struggle.

**How to run it:**
Use `Agent` with `subagent_type: "general-purpose"` in the background. Give it the file(s) just built and this exact brief:
> "You are a harsh critic reviewing this output. Find real problems only — bugs, confusing UX, weak copy, missed edge cases. Do NOT suggest speculative improvements or style preferences. Return a short numbered list of actual issues, prioritized by impact. Be brutal but fair."

**After it finishes:**
- Filter out anything trivial or stylistic
- Present Key a short punch list: "Critic flagged X things — [list]. Fix now or skip?"
- Fix the ones Key approves

**Skip the critic pass when:**
- The change is a one-line fix or purely internal (no user-facing output)
- The session was exploratory/conversational with no concrete output

---

## End of Session

If you made meaningful changes:
1. Update the relevant wiki pages
2. Append to `wiki/00 Log.md` with date + what changed
3. `git add CLAUDE.md && git commit -m "message" && git push` for any committed file changes
