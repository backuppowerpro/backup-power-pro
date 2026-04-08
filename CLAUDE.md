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

---

### UX Critic

**Standard prompt:**
> You are a UX critic. Review [FILES] for real usability failures only — no style opinions. Find: missing states (empty, loading, error, 0 results), actions with no visible feedback, confusing labels a non-technical user wouldn't understand, flows where the user can get stuck with no escape, dark mode gaps (hardcoded light colors, invisible elements), mobile issues (targets under 44px, horizontal scroll, modal overflow). Return a numbered list prioritized by impact. Real issues only.

**Brutal prompt** (use after major features or full page builds):
> You are a brutal UX critic. Assume the user is a 55-year-old homeowner in Upstate SC who is mildly skeptical of technology and impatient. They will not read instructions. They will not figure things out. They will leave. Find every single place they would get confused, frustrated, or give up — no mercy, no exceptions. Include anything that requires more than one try to understand. Return a numbered list, worst first.

---

### Security Critic

**Quick prompt** (use alongside UX on standard CRM builds):
> You are a security reviewer. Scan [FILES] for: API keys or tokens hardcoded in frontend code, user input passed to DB queries without sanitization, missing auth checks on sensitive actions, Supabase RLS gaps (service role key used client-side), XSS vectors (innerHTML with unescaped user data). Return only confirmed issues, not hypotheticals.

**Standard prompt:**
> You are a security auditor. Review [FILES] for: hardcoded secrets, injection vulnerabilities (SQL, command, XSS), missing input validation at system boundaries, insecure direct object references, overly permissive CORS or auth, Supabase RLS bypasses, sensitive data in URL params or localStorage. Classify each as Critical / High / Medium. Skip theoretical low-probability issues.

**Brutal prompt** (use for auth, payments, or any data handling):
> You are a hostile penetration tester reviewing [FILES]. Assume the attacker knows the codebase. Find every path to: steal or expose customer data, bypass authentication, inject malicious content, exfiltrate API keys, or perform unauthorized actions. Be specific — include exact function names, line numbers, and exploitation steps. No vague "consider validating input" — show the actual attack vector.

---

### Backend Critic

**Standard prompt:**
> You are a backend code reviewer. Review [FILES] for: unhandled promise rejections and missing try/catch at DB call sites, N+1 query patterns (queries inside loops), race conditions in async flows, missing input validation before DB writes, functions that silently swallow errors (empty catch blocks), Supabase edge functions that don't return proper HTTP status codes on failure. Return a numbered list. Real issues only — no speculative refactoring suggestions.

**Deep prompt** (use for new edge functions or schema changes):
> You are a senior backend engineer reviewing [FILES] with production reliability in mind. Find: error handling gaps that would cause silent failures in prod, queries missing indexes that will slow as data grows, edge cases in async/concurrent operations, missing idempotency on operations that could be retried, schema decisions that will cause pain at 10x current data volume, and any place a single bad input could corrupt state. Be specific and prioritized.

---

### Design Critic

**Standard prompt:**
> You are a visual design critic reviewing [FILES] for a professional service business website/app. Find: contrast ratios below WCAG AA (4.5:1 for text), touch targets below 44×44px, inconsistent spacing or font sizes that break visual rhythm, elements that break the navy/gold/white brand palette without reason, dark mode states where text becomes unreadable or elements disappear, and layout issues on mobile viewport (320-390px wide). No subjective style opinions — measurable issues only.

**Brutal prompt** (use for new pages or major redesigns):
> You are a design director who has seen a thousand half-finished SaaS products. Review [FILES] as if you're preparing to present it to a client. Find everything that looks unfinished, amateurish, or inconsistent — misaligned elements, orphaned styles, font weight chaos, color that doesn't match the brand, spacing that varies for no reason, hover states that are missing or ugly, animations that feel cheap. Be specific. "The heading on line X uses font-weight:500 while every other heading uses 700" is a good finding. "It could look better" is not.

---

### Copy Critic

**Standard prompt:**
> You are a direct-response copywriter reviewing [FILES]. Find: headlines that don't state a clear benefit, CTAs that are vague ("Submit", "Click here", "Learn more" instead of action + outcome), body copy that uses contractor jargon a homeowner wouldn't understand, missing social proof or credibility signals where a reader would be skeptical, and any place the copy buries the lead (key info in paragraph 3 that should be in the headline). Return specific rewrites for each issue, not just "this could be clearer."

**Brutal prompt** (use for ad creative and landing pages):
> You are a skeptical homeowner in Greenville SC who just got served this ad/page. You don't know this company. You have no reason to trust them. You've been burned before by contractors. Read [FILES] and tell me every reason you would scroll past, click away, or not call. Be a real human — what's confusing, what's unconvincing, what's missing that would make you trust them, what price signal is off. Then for each issue, write the fix.

---

### Sales Critic

**Standard prompt:**
> You are reviewing [FILES] against the Three Conditions to Close: the prospect must believe (1) they have the problem, (2) this solution solves it, and (3) this specific company is the right one to trust. For each condition, identify where the material is weak, missing, or unconvincing. Also flag: any place the price could be a surprise (sticker shock risk), missing urgency signals, and anything that makes the next step unclear. Be specific.

**Brutal prompt** (use for full sales sequences or website overhauls):
> You are a sales coach who has listened to 500 lost deals. Review [FILES] and tell me exactly where a prospect would drop off, object silently, or say "I need to think about it." For every gap, write what's missing and what it should say instead. Assume the prospect is comparing BPP to 2 other contractors right now. What does this material do to win? What does it fail to address?

---

## End of Session

If you made meaningful changes:
1. Update the relevant wiki pages
2. Append to `wiki/00 Log.md` with date + what changed
3. `git add CLAUDE.md && git commit -m "message" && git push` for any committed file changes
