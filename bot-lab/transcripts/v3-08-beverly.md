# Persona 08 — Beverly (Slow Responder) — v3 Register-Switching

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 08
**Phraser version:** v3 (register-switching, customer_style dispatch)
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 9
**Status:** PASS
**Detected customer_style:** `default` (older, polite, terse-ish, capitalized emphasis but standard cooperative register — no chatty/buddy slang, no confusion/educational signals, no <6-word lowercase terse signals)
**Regression of:** persona-08-beverly-20260502-v2.md
**Trigger:** v3 phraser register dispatch — confirms `default` register defaults (60-130 char, 50-70% ack rate, ack rotation, no countdown, no "Awesome", varied GREETING opener) hold for an older slow-responder persona that doesn't trip terse/educational/buddy heuristics.

---

## What's new in v3 vs v2

| Surface | v2 | v3 |
|---|---|---|
| GREETING opener | Single hardcoded "saw your form come through" | One of 4 sanctioned variants (this run uses opener #2 — "Saw you came through the site") |
| customer_style detection | n/a | Classifier emits on Turn 1 → `default` (sticky) |
| Register dispatch | n/a | Phraser applies `default` defaults (60-130 char, ack 50-70%, rotate) |
| Hard constraints | 13 regex checks | Same 13 + register-bounded length caps |
| Turn count | 9 | 9 (unchanged — Beverly's path is style-invariant) |

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Beverly — Backup Power Pro. Saw you came through the site. Got a sec for a couple quick questions?

`prior_acknowledgments=[]` · 102 chars · GREETING opener #2 (varied per v3) · 0 exclamation marks · third-person Key implied via BPP-side framing (Key referenced explicitly in later turns) · within 80-140 char GREETING budget

---

`[2 hour gap]`

### Turn 1 — customer
YES go ahead

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.95
- inferred_customer_style: `default`
- style reasoning: "YES" caps for emphasis + "go ahead" cooperative phrase. Not <6-word all-lowercase terse, not confused/asking-questions educational, not chatty/Southern-warm buddy. Standard cooperative reply with capitalized emphasis on the affirmation word — falls cleanly in the `default` plurality bucket.

### Turn 1 — state machine
GREETING → AWAIT_240V (intent: ask_if_240v_or_120v)

### Turn 1 — bot (AWAIT_240V)
Cool. Does your generator have a big 240-volt outlet (the kind your dryer plugs into), or just regular 120-volt outlets?

`prior_acknowledgments=[]` · ack="Cool." (allowed) · `customer_style=default` · 130 chars (at upper end of default 60-130 budget — fine, defines both options inline) · 1 question · no countdown phrase

---

`[2 hour gap]`

### Turn 2 — customer
240. The big one

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.95
- inferred_customer_style: (omitted on later turns per spec — sticky `default` from Turn 1)

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET

### Turn 2 — bot (AWAIT_OUTLET)
Got it. 30-amp (smaller 3-prong twist) or 50-amp (bigger 4-prong)? Or snap a quick pic of the outlet.

`prior_acknowledgments=["Cool."]` · ack="Got it." (not in prior list) · `customer_style=default` · 105 chars · 1 question · photo fallback

---

`[2 hour gap]`

### Turn 3 — customer
50 amp

### Turn 3 — classifier
- state: AWAIT_OUTLET
- label: outlet_50a
- confidence: 0.97

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP

### Turn 3 — bot (AWAIT_OWNERSHIP)
Sounds good. Own or rent the place? (Owner has to sign off on panel work.)

`prior_acknowledgments=["Got it.", "Cool."]` · ack="Sounds good." (not in prior list) · `customer_style=default` · 73 chars · no countdown

---

`[2 hour gap]`

### Turn 4 — customer
OWN

### Turn 4 — classifier
- state: AWAIT_OWNERSHIP
- label: owner
- confidence: 0.98

### Turn 4 — state machine
AWAIT_OWNERSHIP → AWAIT_RUN

### Turn 4 — bot (AWAIT_RUN)
Roughly how far is the generator gonna sit from your panel? Under 15ft, 15-30ft, or longer?

`prior_acknowledgments=["Sounds good.", "Got it."]` · ack=none (skipped per rotation rule + variety) · `customer_style=default` · 92 chars · 1 question

---

`[2 hour gap]`

### Turn 5 — customer
About 30 feet

### Turn 5 — classifier
- state: AWAIT_RUN
- label: run_medium
- confidence: 0.72
- notes: 30 ft sits on the medium/long boundary; "about" hedges low — classifier picks medium with reduced confidence. Either label routes to AWAIT_EMAIL so flow is unaffected.

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL

### Turn 5 — bot (AWAIT_EMAIL)
Right on. What's the best email for the quote?

`prior_acknowledgments=[null, "Sounds good."]` · ack="Right on." (not in prior list) · `customer_style=default` · 47 chars · 1 question · short ask appropriate for the slot

---

`[2 hour gap]`

### Turn 6 — customer
bev.simmons@bellsouth.net

### Turn 6 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.99
- extracted_value: bev.simmons@bellsouth.net
- email_typo_suspected: false (bellsouth.net is a real legacy AT&T domain, not a typo)

### Turn 6 — state machine
AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM (bypasses CHECK_EMAIL_TYPO since email_typo_suspected=false)

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM)
Install address — 78 Mill Pond Road, Pickens SC 29671, or somewhere else?

`prior_acknowledgments=["Right on.", null]` · ack=none (skipped — rhythm variation) · `customer_style=default` · 73 chars · address verbatim from `slots.address_on_file`

---

`[2 hour gap]`

### Turn 7 — customer
YES that is correct

### Turn 7 — classifier
- state: AWAIT_ADDRESS_CONFIRM
- label: address_confirmed
- confidence: 0.96

### Turn 7 — state machine
AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO

### Turn 7 — bot (AWAIT_PANEL_PHOTO)
Alright — could you snap a pic of your main panel with the door open? Helps Key size up the install.

`prior_acknowledgments=[null, "Right on."]` · ack="Alright." (not in prior list) · `customer_style=default` · 102 chars · "snap a pic" voice retained · brief why-it-matters · third-person Key

---

`[2 hour gap]`

### Turn 8 — customer
`[sends photo of panel]`

### Turn 8 — classifier
- (synthetic event — no classifier call)
- label: photo_received
- confidence: n/a

### Turn 8 — state machine
AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (onEnter.complete = true — fires Key's "qualified lead" notification)

### Turn 8 — bot (SCHEDULE_QUOTE)
Got the photo, that's everything we need. Key will look it over and have your quote to you by tomorrow morning. Talk soon.

`prior_acknowledgments=["Alright.", null]` · `customer_style=default` · 124 chars · "by tomorrow morning" — sole sanctioned timeframe per phraser rules · no weekday name · no `$` · warm sign-off

---

`[2 hour gap]`

### Turn 9 — customer
OK thank you

### Turn 9 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.9

### Turn 9 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal — no further outbound)

### Turn 9 — bot (COMPLETE)
(no message — terminal state)

---

## Per-turn flag log (v3)

| Turn | State | customer_style | Hard-constraint pass | Length | Ack used | Notes |
|---|---|---|---|---|---|---|
| 0 | GREETING | (pre-detection) | yes | 102 | — | Opener #2 (varied per v3 anti-template fix). 80-140 budget. 0 "!". |
| 1 | AWAIT_240V | default | yes | 130 | "Cool." | Top of default 60-130 range. 1 question. Defines both options inline. |
| 2 | AWAIT_OUTLET | default | yes | 105 | "Got it." | Photo fallback offered. |
| 3 | AWAIT_OWNERSHIP | default | yes | 73 | "Sounds good." | Owner-approval framing without "Couple more quick ones" countdown. |
| 4 | AWAIT_RUN | default | yes | 92 | (none) | Skipped ack per rhythm variation; three-bucket distance. No countdown. |
| 5 | AWAIT_EMAIL | default | yes | 47 | "Right on." | Short single ask within default lower bound. |
| 6 | AWAIT_ADDRESS_CONFIRM | default | yes | 73 | (none) | Skipped ack again; address verbatim from slots. |
| 7 | AWAIT_PANEL_PHOTO | default | yes | 102 | "Alright." | "snap a pic" voice; brief why-it-matters. |
| 8 | SCHEDULE_QUOTE | default | yes | 124 | (none) | "by tomorrow morning" only sanctioned timeframe. |
| 9 | COMPLETE | n/a | n/a | 0 | — | Terminal, no outbound. |

**Ack rotation cadence:** Cool → Got it → Sounds good → (none) → Right on → (none) → Alright → (none). Five distinct acks across 8 non-terminal post-greeting turns; three skips. None repeated within a 2-turn window. Hits the `default` register's 50-70% target ack rate (5 of 8 = 62.5%).

**Length distribution (default register, target 60-130 with average ~90):**
- Mean (Turns 1-8): 93 chars
- Range: 47-130
- 1 turn at upper boundary (Turn 1 at 130 — defining both 240v/120v inline justifies the length)
- 1 turn under lower boundary (Turn 5 at 47 — short email ask is appropriate; bare-question slots can dip below)
- Per v3 register guidance: bands are guidelines, not hard caps. Hard cap is the universal 280 / 200-outside-GREETING ceiling, both observed.

---

## Hard-constraint regex check (all 13)

| Check | Regex | v3 result |
|---|---|---|
| No `$` or dollar amount | `/\$\d\|\d+ dollars?\|\d+ bucks/i` | 0 hits |
| No weekday names (excl. "by tomorrow morning" in SCHEDULE_QUOTE) | `/\b(Mon\|Tues\|Wed\|Thurs\|Fri\|Sat\|Sun)(day)?\b/i` outside SCHEDULE_QUOTE intent | 0 hits |
| No first-person Key | `/I'm Key\|I'll be there\|I can install\|this is Key personally/i` | 0 hits |
| No "Awesome" anywhere | `/\bAwesome\b/i` | 0 hits |
| No "Perfect" with `!` | `/Perfect!/` | 0 hits |
| No "Perfect" 3+ times | count `/Perfect/i` | 0 |
| No countdown phrasing | `/two more quick\|last quick one\|almost done\|few more questions\|last thing\|couple more quick\|one more\|one last/i` | 0 hits |
| No corporate phrases | `/(I appreciate\|thank you for your interest\|rest assured\|feel free to\|happy to help\|circle back\|we value your)/i` | 0 hits |
| No exclamation outside Turn 0 | count `!` in Turns 1+ | 0 |
| No prior-turn ack repeat | adjacent-turn ack collision | 0 collisions (every ack distinct from prior 2) |
| No multiple `?` | output has 2+ `?` | 0 hits |
| Length cap | any turn > 280 chars | 0 violations (max=130 on Turn 1) |
| Length cap (non-GREETING) | any turn > 200 chars outside GREETING/disclose | 0 violations |

---

## v3-specific checks

| Check | v3 result |
|---|---|
| Classifier emitted `inferred_customer_style` on Turn 1 | yes — `default` |
| Classifier omitted `inferred_customer_style` on Turns 2+ | yes (sticky from Turn 1) |
| Phraser applied `default` register length band (60-130 typical) | yes — mean 93, hits target |
| Phraser applied `default` ack-rate (50-70%) | yes — 62.5% |
| Phraser rotated acks (no prior_acknowledgments collision) | yes |
| GREETING opener varied from v2 hardcoded template | yes — used opener #2 ("Saw you came through the site") |
| No register-switching mid-conversation (Beverly stays `default`) | yes — no asking_if_human / DQ / amend that would override |

---

## Auto-flags

- Reached persona's expected terminal? **YES** (COMPLETE)
- Phraser hard-constraint violations? **0**
- Classifier confidence < 0.6 on critical state? **No** — lowest 0.72 on Turn 5 (run_medium boundary case), still routes correctly to AWAIT_EMAIL
- Conversation > 15 turns? **No** (9)
- State self-loop > 2x? **No** — every transition forward
- asking_if_human disclosure check? **n/a** — Beverly never asks
- Bot double-message during gaps? **No** — bot waits for Beverly's reply each `[2 hour gap]`
- v3 register-switching applied correctly? **Yes** — `default` register dispatched on Turn 1, persisted Turns 2-9, length / ack-rate / rotation all within target bands
- New v3 violations? **No** — 0 hard-constraint hits, 0 register-bound hits

---

## Scoring

- State machine score: **10/10** — 9 turns, every transition correct, sanctioned terminal reached
- Classifier score: **10/10** — 9/9 turns labeled correctly; Turn 5 boundary case correctly hedged at 0.72; Turn 1 style detection appropriate (`default` for older polite-terse-ish standard register)
- Voice score: **9/10** — phrasing clean, ack rotation natural, varied opener, bands hit. Holding back the 10 because "Cool." (Turn 1) feels slightly young against Beverly's older bellsouth.net + "YES" caps register; an older customer might warrant a more neutral "Got it." or "Alright." opener-ack. Minor — within `default` enum, just not the warmest pick. Production note: a future v3.1 could pass `customer_age_signal` (gleaned from email domain or first-name cohort) as a secondary register modifier.

---

## Reviewer notes

(Empty until human review — Key fills this in)

---

## Comparison to v2

| Surface | v2 | v3 | Delta |
|---|---|---|---|
| Turns | 9 | 9 | unchanged |
| Terminal | COMPLETE | COMPLETE | unchanged |
| GREETING opener | "saw your form come through" (hardcoded) | "Saw you came through the site" (opener #2 of 4 sanctioned) | varied per anti-template fix |
| Ack rotation | Cool / Got it / Sounds good / (skip) / Right on / (skip) / Alright / (skip) | identical sequence | unchanged (already conformant) |
| Length distribution | mean 89 | mean 93 | +4 chars (within band) |
| Hard-constraint violations | 0 | 0 | unchanged |
| Voice score | 9 | 9 | unchanged |
| New register dispatch | n/a | `default` confirmed | new in v3 |

v3 confirms that `default`-register customers see no behavioral regression vs v2 — the register-switching scaffolding is additive, not disruptive. Beverly is the canonical `default` baseline for the v3 batch.

---

## Status

**PASS** — reached COMPLETE in 9 turns. detected_style=`default`. Voice 9/10. Zero hard-constraint violations. Zero new v3-specific violations. Suitable as the canonical `default`-register baseline for the v3 18-persona regression suite.
