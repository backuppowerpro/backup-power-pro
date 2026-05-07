# Key's Brain (portable, tracked)

> Single navigation page for any AI session that needs to operate as Key's collaborator on Backup Power Pro.

This `brain/` directory is the **published, sanitized** version of Key's operating context. Specific financial numbers and anything truly private stay in `wiki/Key/` (per-machine Obsidian vault, gitignored). Everything else lives here so it travels with the repo and any new session can hit the ground running.

## Read order on session start

For any business / strategy / voice / design question, read in this order:

1. **`brain/01-identity.md`**, who Key is, why this business exists, what winning + losing look like, lifestyle aspirations, capital posture (sanitized), career arc, hidden skills.
2. **`brain/02-how-i-decide.md`**, full decision-making operating system. Risk posture, decision shape filter, gut-vs-data, experiments framework, reversibility test, hidden-cost-of-inaction, burn-shaped instincts.
3. **`brain/03-my-voice.md`**, the three principles in priority order (don't sound desperate, authentic over clever, premium posture), voice corpus patterns, hard bans, anti-archetype, real Key acks/closers/greetings.
4. **`brain/04-avoid-list.md`**, what we don't do and why. Geography, vendor outsourcing of customer-facing functions, sales/discounts, slick-cheesy-pander archetype, em-dashes, time-of-day promises.
5. **`brain/05-active-priorities.md`**, current 12-month destination, the pivot in progress, drainage map (orchestrator + permits as path workstreams), tripwires.
6. **`brain/06-design-language.md`**, UX/UI canon. Two surface families (customer-facing polished vs. internal Minesweeper Brutalist), one-app-two-layouts rule, brand tokens, decision tree.
7. **`brain/07-decisions-log.md`**, chronological record of captured decisions and their rationale. Useful for understanding WHY rules exist.
8. **`brain/08-open-questions.md`**, gaps Key hasn't answered yet. Don't autonomously decide things on this list, surface them.
9. **`brain/09-repo-map.md`**, "how to find anything" sitemap. Code locations, wiki branches, scripts, credentials, deploy commands, file naming conventions, where each kind of decision is logged. Use this when you need to find a SPECIFIC thing rather than learn operating context.

## For a session that has no file access (Claude.ai chat, fresh project)

Read **`brain/PORTABLE-BRAIN.md`**, single-file self-contained dump that compresses the nine files above into a paste-once context.

## For a cloud agent / fresh checkout (no clone needed)

```
curl -s https://raw.githubusercontent.com/backuppowerpro/backup-power-pro/main/brain/PORTABLE-BRAIN.md
```

No auth needed (public repo). Returns the full operating context as one paste.

## Maintenance

- `wiki/Key/` is the workshop where Key + Claude capture freely (per-machine, Obsidian).
- `brain/` is the published version (tracked, redacted of specific financials, what travels).
- **Auto-sync:** run `scripts/brain/sync-from-wiki.sh` after any `wiki/Key/` edit. The script copies wiki/Key/*.md → brain/*.md with sanitization (strips dollar figures, account balances, phone numbers, em-dashes) and refreshes PORTABLE-BRAIN.md as the concatenation. Then `git add brain/ && git commit && git push`. Don't edit brain/*.md directly, the next sync will overwrite.
- **Validate:** run `scripts/brain/validate.sh` to enforce hard rules (no em-dashes, no dollar/phone leaks, all files present). Wired into the pre-commit hook so bad changes can't ship.
- **Freshness:** see `brain/.last-synced` for the most recent sync timestamp.

## What's intentionally NOT in here

- Specific dollar amounts in bank/investments (private, in `wiki/Key/Identity.md` only)
- Family details, health, mentor relationships, Key hasn't shared and Claude doesn't speculate
- Customer-specific PII

If a new session encounters a question the brain doesn't cover, treat it as an [[Open Questions]] gap and surface it to Key, not as a guess.
