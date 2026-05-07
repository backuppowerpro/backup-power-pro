> This file is auto-synced from `wiki/Key/<name>.md` via `scripts/brain/sync-from-wiki.sh`.
> Edit the wiki source, not this file. Sanitization strips specific dollar figures, account balances, and phone numbers.

---
title: Open Questions
branch: Key
type: state
updated: 2026-05-05
tags: [key, questions, unresolved]
---

# Open Questions

> Things Key hasn't decided yet. **Claude should not autonomously answer these**, surface them in the brief and wait. As Key answers, the question moves to [[Decisions Log]] with rationale.

---

## Questions waiting for Key's answer

### What's the per-install owner profit (so we can work backward to volume)?
Key's mid-2027 target is $X / month personal profit. Working backward to required installs/month requires the average per-install owner-profit number after sub labor + parts + permit + ad cost + misc. Claude doesn't know this number yet. Need: (a) typical install price, (b) sub cost, (c) parts/permit cost, (d) avg ad cost per closed install, (e) whether the $5K is pre-tax or take-home. Once known, Claude computes installs/month target and reverse-engineers leads/month and CPL ceiling.

### What's the ramp from solo to 100% sub by mid-2027?
Key wants zero hands-on by 12 months. The path: which install gets handed off first, which next, what training/checklist makes a sub install hit Key's quality bar, when does the first sub get retained vs ad-hoc. The trigger is no longer fuzzy ("exceed capacity") since the destination is clear (zero hands-on); the open question is the curve.

### What's North Carolina expansion look like?
Mid-2027 picture includes "several cities between SC and NC." Which NC city first? What's the install-density pattern (one sub per metro? roving sub network?)? Permit jurisdiction lookups are SC-only today; NC adds another regulatory layer.

### Is the customer's email actually used post-quote, or just collected?
The proposal flow needs it for the PDF link. But once the customer becomes a real install, does the email matter or is SMS the entire channel? Affects whether we should validate / re-confirm emails in the conversation.

### Should Ashley ever offer to schedule a call directly with Key?
Currently Ashley only does intake; if a customer says "I want to talk to a human" we route to NEEDS_CALLBACK. Could Ashley offer specific time slots from Key's calendar? Higher conversion potential, but adds calendar-integration complexity and trust risk if a slot fills incorrectly.

### What's the right policy for a customer who texts STOP and later submits a fresh form?
TCPA conservative answer: honor the prior STOP forever. UX answer: a fresh form fill is a new opt-in. Currently the form-submit handler silently drops them. Should we surface this as a "do you want to re-engage?" decision for Key, or stay conservative?

### When should we pull the real Key voice corpus?
The bot-lab voice-corpus.md is still placeholder. Real Key SMS would lift voice scores 1-2 points per the doc. Need a session where Key opens Supabase SQL editor and picks the 12 best from a query result. Lowest-priority high-value ask.

---

## Questions Claude has and is going to ask via [[Interview Questions]]

The interview questionnaire batches the soft/identity questions into one structured doc Key can fill in at his pace. As he answers, the relevant Key/ files get updated and the question moves to [[Decisions Log]].

---

## Format for adding new questions

```
### Short question
1-2 sentences of context: why does this matter, what does it block?
Where the answer goes once received: which Key/ file gets updated.
```

---

## See also

- [[Interview Questions]], structured interview Key fills in
- [[Decisions Log]], answered questions become entries here
- [[Active Priorities]], questions that block priorities float higher
