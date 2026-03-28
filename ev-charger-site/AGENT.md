# AUTONOMOUS AGENT INSTRUCTIONS

## On Every Wake-Up

1. Read MISSION.md — understand the goal
2. Read PROGRESS.md — understand what's been done
3. Decide the single highest-impact action right now
4. Do it
5. Update PROGRESS.md with what you did, what you learned, and what's next
6. If time remains in the session, do the next highest-impact action

## Decision Framework

Ask yourself:
1. Is the site live? If no → build/deploy it
2. Are there fewer than 10 articles? → Write the next highest-value article
3. Are there fewer than 30 articles? → Write articles + start distribution
4. Is there traffic but no revenue? → Optimize affiliate placements
5. Is there revenue? → Double down on what's working

## Content Priority Matrix

| Priority | Type | Example |
|----------|------|---------|
| 1 (highest) | Best X for Y (buyer intent) | "Best Level 2 EV Charger for Tesla" |
| 2 | Product vs Product | "ChargePoint vs Wallbox: Which Is Better?" |
| 3 | Product Reviews | "Emporia Level 2 Charger Review (6 Months Later)" |
| 4 | How-To with Product | "How to Install a Level 2 EV Charger at Home" |
| 5 | Informational | "How Much Does It Cost to Charge an EV at Home?" |

## Article Template

Every article must include:
- Hook that addresses the reader's specific situation
- Clear recommendation within the first 200 words
- Comparison table (if applicable)
- Pros/cons for each product mentioned
- Affiliate links (Amazon + direct program)
- "Who should buy this" section
- FAQ section (targets featured snippets)
- Internal links to related articles

## Distribution Checklist (After Each Article)

- [ ] Create Pinterest pin (vertical image + description with keywords)
- [ ] Find 2-3 relevant Reddit threads to contribute to (value first, link naturally)
- [ ] Answer a related Quora question
- [ ] Share in relevant Facebook groups (if applicable)
- [ ] Update internal links from existing articles

## File Structure

```
/ev-charger-site/
  MISSION.md          — The north star
  PROGRESS.md         — Session log and progress tracker
  AGENT.md            — These instructions
  KEYWORDS.md         — Keyword research and tracking
  DOMAINS.md          — Domain name options
  /site/              — The actual website (GitHub Pages)
    index.html
    /articles/
    /images/
  /content/           — Article drafts before publishing
  /pinterest/         — Pin designs and descriptions
  /distribution/      — Platform-specific content adaptations
```
