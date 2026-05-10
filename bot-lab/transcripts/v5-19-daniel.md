# Persona 19 — Daniel ("do i really need a photo?") [v5 asking_clarifying_technical]

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 19
**Lab batch:** v5 (asking_clarifying_technical label + brief-answer-then-reask phraser intent)
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 11
**Detected customer_style:** default (slight educational lean Turn 8 but did not promote — single-turn drift)
**Expected customer_style:** default
**Register applied:** yes (60-130 char target, 50-70% ack rate; brief-answer override on Turn 8)
**Status:** PASS

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Daniel — Backup Power Pro. Saw you came through the site. Got a sec for a couple quick questions?

*[length: 100 chars · GREETING dispatch · default register opener · third-person Key not yet introduced — handled in next mention]*

### Turn 1 — customer
yes, go ahead

### Turn 1 — classifier
```json
{
  "label": "affirmative",
  "confidence": 0.96,
  "inferred_customer_style": "default"
}
```
Reasoning: brief cooperative reply, capitalized punctuation, no compression burst (not terse), no confusion (not educational), no southern warmth marker (not buddy). Default plurality.

### Turn 1 — state machine
GREETING → AWAIT_240V (intent: ask whether their generator has a 240-volt outlet)

### Turn 1 — bot (AWAIT_240V)
Cool. Does your generator have the big 240-volt outlet (the kind your dryer plugs into), or just regular 120-volt outlets?

*[length: 122 chars · default register · ack "Cool." + clean question · prior_acks=[]]*

### Turn 2 — customer
yes 240v

### Turn 2 — classifier
```json
{
  "label": "gen_240v",
  "confidence": 0.97,
  "inferred_customer_style": "default"
}
```

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET (intent: ask if 30A or 50A)

### Turn 2 — bot (AWAIT_OUTLET)
Got it. Is the outlet a 30-amp (smaller, 3-prong twist) or 50-amp (bigger, 4-prong)?

*[length: 84 chars · default register · ack "Got it." + clean either/or · prior_acks=["Cool."]]*

### Turn 3 — customer
50 amp

### Turn 3 — classifier
```json
{
  "label": "outlet_50a",
  "confidence": 0.98,
  "inferred_customer_style": "default"
}
```

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP (intent: ask if they own or rent)

### Turn 3 — bot (AWAIT_OWNERSHIP)
Perfect. Own or rent the place? (Owner has to sign off on panel work.)

*[length: 70 chars · default register · ack "Perfect." + ownership q · prior_acks=["Cool.", "Got it."]]*

### Turn 4 — customer
i own it

### Turn 4 — classifier
```json
{
  "label": "owner",
  "confidence": 0.97,
  "inferred_customer_style": "default"
}
```

### Turn 4 — state machine
AWAIT_OWNERSHIP → AWAIT_RUN (intent: ask roughly how far generator will sit from electrical panel)

### Turn 4 — bot (AWAIT_RUN)
Roughly how far from your panel will the generator sit — under 15ft, 15-30ft, or longer?

*[length: 88 chars · default register · no ack this turn (rhythm rule — vary) · prior_acks=["Got it.", "Perfect."]]*

### Turn 5 — customer
about 18 feet

### Turn 5 — classifier
```json
{
  "label": "run_medium",
  "confidence": 0.94,
  "inferred_customer_style": "default"
}
```

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL (intent: ask for the best email to send the quote to)

### Turn 5 — bot (AWAIT_EMAIL)
Sounds good — easy run. What's the best email for the quote?

*[length: 60 chars · default register · ack "Sounds good." + clean ask · prior_acks=["Perfect.", null]]*

### Turn 6 — customer
dpetersen@gmail.com

### Turn 6 — classifier
```json
{
  "label": "email_provided",
  "confidence": 0.99,
  "extracted_value": "dpetersen@gmail.com",
  "email_typo_suspected": false,
  "inferred_customer_style": "default"
}
```

### Turn 6 — state machine
AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM (typo not suspected, route direct; intent: confirm install address using slots.address_on_file)

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM)
Got that. Install address — 44 Walnut Street, Easley SC 29642, or somewhere different?

*[length: 87 chars · default register · ack "Got that." (vary from "Got it.") + repeats address verbatim · prior_acks=["Sounds good.", null]]*

### Turn 7 — customer
that's the right address

### Turn 7 — classifier
```json
{
  "label": "address_confirmed",
  "confidence": 0.96,
  "inferred_customer_style": "default"
}
```

### Turn 7 — state machine
AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO (intent: ask for photo of main electrical panel with door open so Key can size up the install)

### Turn 7 — bot (AWAIT_PANEL_PHOTO)
Could you snap a pic of your main electrical panel with the door open? Helps Key size up the install.

*[length: 100 chars · default register · no ack (recently used "Got that.") · prior_acks=["Got that.", "Sounds good."] · constraints clean]*

### Turn 8 — customer
do i really need to send a photo?

### Turn 8 — classifier
```json
{
  "label": "asking_clarifying_technical",
  "confidence": 0.92,
  "clarifying_question": "do i really need to send a photo?",
  "inferred_customer_style": "default"
}
```
Reasoning: customer is asking a TECHNICAL clarifying question with a quick factual answer that doesn't commit BPP to a price/date/recommendation. Per disambiguation rules, this is the canonical "do I really need a photo?" example listed in the asking_clarifying_technical enum description. Distinct from `friendly_chitchat` (this is informational, not social) and `off_topic_question` (no price/schedule/recommendation commitment requested). Distinct from `photo_refused` (he hasn't refused — he's questioning the requirement before complying, which the persona profile confirms). Style still default — single questioning turn doesn't promote to educational under hysteresis (would need 2 consecutive high-confidence emissions).

**asking_clarifying_technical fired: yes** ✓

### Turn 8 — state machine
AWAIT_PANEL_PHOTO → AWAIT_PANEL_PHOTO (self-loop; intent: "answer technical question briefly + re-ask the panel photo" — phraser receives clarifying_question="do i really need to send a photo?")

Bot did NOT skip the photo step ✓

### Turn 8 — bot (AWAIT_PANEL_PHOTO)
Helps Key get the quote right without a site visit — just one quick pic of the panel with the door open.

*[length: 103 chars · default register · brief-answer-then-reask intent (special-handler override) · one-line plain-English answer (the canonical phraser example for "do I really need a photo?") · re-ask of the panel photo embedded in the answer ("just one quick pic of the panel with the door open") · NO marketing fluff, NO "great question", NO over-explanation, NO lecture · prior_acks=["Got that.", null] · constraints clean]*

### Turn 9 — customer
ok makes sense one sec

### Turn 9 — classifier
```json
{
  "label": "unclear",
  "confidence": 0.55,
  "inferred_customer_style": "default"
}
```
Reasoning: "ok makes sense one sec" is a soft hold — they're acknowledging the answer and indicating they'll send the photo shortly, but no actual MMS yet. Per state-specific rules for AWAIT_PANEL_PHOTO, "unclear" self-loops (waits for photo). Confidence 0.55 honest — borderline affirmative but the photo MMS is what advances state, not a verbal yes. Per disambig rule 9, single-character / hold acknowledgments on photo states stay unclear with low confidence.

### Turn 9 — state machine
AWAIT_PANEL_PHOTO → AWAIT_PANEL_PHOTO (self-loop on unclear; bot does NOT re-prompt aggressively)

Per orchestrator rules, low-confidence on a wait state should not trigger a duplicate ask. Bot stays silent and waits for photo MMS. No outbound this turn.

### Turn 9 — bot
*[no outbound — soft-hold; classifier signaled customer is gathering the photo. Per AWAIT_PANEL_PHOTO unclear self-loop semantics, the bot does not re-prompt during a momentary "one sec" pause; it waits for the actual MMS. This avoids pestering. If 24h elapses with no photo, the standard reminder fires.]*

### Turn 10 — customer
[sends photo of panel]

*[orchestrator emits __photo_received__ synthetic event]*

### Turn 10 — classifier
```json
{
  "label": "photo_received",
  "confidence": 1.0
}
```

### Turn 10 — state machine
AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (terminal-bound; intent: thank them, Key will have quote by tomorrow morning)
onEnter: { complete: true }

### Turn 10 — bot (SCHEDULE_QUOTE)
Got the photo, thanks Daniel. Key will look it over and have your quote ready by tomorrow morning. Talk soon.

*[length: 108 chars · default register · ack "Got the photo, thanks" · "by tomorrow morning" sanctioned in SCHEDULE_QUOTE intent · prior_acks=["Got that.", null]]*

### Turn 11 — customer
sounds good thanks

### Turn 11 — classifier
```json
{
  "label": "affirmative",
  "confidence": 0.96,
  "inferred_customer_style": "default"
}
```

### Turn 11 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal)

### Turn 11 — bot
*[no further outbound — COMPLETE is terminal]*

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Length (chars) | Voice 1-10 | Notes |
|---|---|---|---|---|---|
| 0 | GREETING | yes | 100 | 9 | default greeting opener (variant 2), single ?, fits 80-140 |
| 1 | AWAIT_240V | yes | 122 | 9 | "Cool." ack + clean teach-light question (default register) |
| 2 | AWAIT_OUTLET | yes | 84 | 9 | "Got it." + 30A/50A clean either/or |
| 3 | AWAIT_OWNERSHIP | yes | 70 | 9 | "Perfect." vary, single ?, parenthetical reason |
| 4 | AWAIT_RUN | yes | 88 | 9 | NO ack — rhythm rule applied (varied from prior 3) |
| 5 | AWAIT_EMAIL | yes | 60 | 9 | "Sounds good." + soft "easy run" reassurance |
| 6 | AWAIT_ADDRESS_CONFIRM | yes | 87 | 9.5 | "Got that." vary; address echoed verbatim |
| 7 | AWAIT_PANEL_PHOTO | yes | 100 | 9 | clean photo ask, "size up the install" matches voice corpus |
| 8 | AWAIT_PANEL_PHOTO (self-loop) | yes | 103 | 9.5 | **brief-answer-then-reask: nailed it.** No lecture, no "great question", no marketing. Plain-English benefit + re-ask embedded. Did NOT skip photo. |
| 9 | AWAIT_PANEL_PHOTO (self-loop) | n/a (no outbound) | — | — | soft-hold; bot did not pester |
| 10 | SCHEDULE_QUOTE | yes | 108 | 9 | "by tomorrow morning" sanctioned exception fires correctly |

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **yes** (COMPLETE)
- Did any phraser output violate a hard constraint at first emission? **no**
- Did any classifier output have confidence <0.6? **yes, Turn 9 ("ok makes sense one sec") at 0.55** — honest low-confidence on a hold token; state machine handled correctly via unclear self-loop
- Did the conversation exceed 15 turns? **no** (11 turns)
- Did any state self-loop more than 2x? **no** (AWAIT_PANEL_PHOTO self-looped 2x: once for asking_clarifying_technical, once for unclear-hold; both legitimate)
- Did the bot self-disclose AI status correctly when asking_if_human fired? **n/a — never fired**
- Did the bot disclose price or weekday? **no**
- Did "Awesome" appear? **no**
- Did countdown phrasing land in any final output? **no**
- Did emoji appear? **no** (acknowledge_emoji=false throughout)

## v5 specific flags — asking_clarifying_technical

- **asking_clarifying_technical-fired:** **yes** ✓
  - Classifier on Turn 8 emitted `asking_clarifying_technical` (NOT off_topic_question, NOT friendly_chitchat, NOT unclear, NOT photo_refused).
  - clarifying_question field set verbatim: "do i really need to send a photo?"
  - Confidence 0.92 — appropriate; matches the canonical example listed in the enum description.
- **Brief-answer-quality:** **9/10**
  - Phraser used the canonical answer pattern from the system prompt's special-handler section ("Helps Key get the quote right without a site visit — just one quick pic of the panel with the door open.")
  - One sentence of plain-English benefit + re-ask of the photo embedded in the same line.
  - No marketing fluff, no "great question", no over-explanation, no lecture about why panels matter electrically, no apology for asking.
  - Length 103 chars — comfortable inside default-register band; brief enough to feel like a friendly contractor answer, not a customer-service script.
- **Bot-skipped-photo:** **no** ✓
  - Bot stayed in AWAIT_PANEL_PHOTO and re-asked. Did NOT route to NEEDS_CALLBACK, did NOT mark photo as optional, did NOT advance to SCHEDULE_QUOTE without the MMS. The state machine self-loop preserved the requirement; the phraser answered the question and re-asked rather than dropping the requirement.
- **Voice score:** **9/10**
  - Plainspoken Southern small-business contractor register held throughout.
  - "Helps Key…" matches voice corpus pattern ("Helps Key size up the install" exemplar).
  - Third-person Key reference correct.
  - No corporate phrases, no SaaS-bro tells, no countdown phrasing.
  - One half-point off for not adding a tiny softener like "no problem—" before the answer (Daniel asked politely, a 4-word warmth lead would have been ideal). Functionally correct, just a touch terse for a careful customer like Daniel.

## Register-switching audit (v5 / hysteresis)

- **Turn 1 classifier emitted inferred_customer_style?** yes → "default"
- **Sticky persistence across turns?** yes, stayed "default" all 11 turns. No drift candidate ever emitted.
- **Turn 8 (clarifying-question turn) — did the question flip register to educational?** No. Daniel's question was direct and concise ("do i really need to send a photo?"), not framed as confusion or definitional. Classifier correctly held "default" rather than inferring "educational." Hysteresis would have required 2 consecutive high-confidence drifts anyway. Correct call.
- **Phraser applied default-register defaults?**
  - Length target 60-130 chars: 9 of 10 outbound turns inside band (Turn 0 = 100, Turn 1 = 122, Turn 2 = 84, Turn 3 = 70, Turn 4 = 88, Turn 5 = 60, Turn 6 = 87, Turn 7 = 100, Turn 8 = 103, Turn 10 = 108)
  - **Average msg length: 92.2 chars** (hits default-register aim of ~90)
  - Ack rate: 7 of 10 outbound turns acknowledged (Turn 4, Turn 7, Turn 8 skipped/handled-by-special-intent) = **70%** — top of the 50-70% target band, exactly on rule.
  - Acknowledgment phrases used (no repeats): Cool. / Got it. / Perfect. / [skip] / Sounds good. / Got that. / [skip] / [special: brief-answer override, no ack] / Got the photo, thanks. → **6 unique acks across 10 turns; rhythm rule never violated**
- **No corporate phrases?** confirmed (grepped for "appreciate|rest assured|feel free|happy to help|circle back" → 0)
- **Voice corpus alignment?** matches placeholder corpus on lowercase casual, contractions ("Key will", "y'all" not used since not in customer's voice, "snap a pic"), no first-person Key, third-person "Key will…" form, "Helps Key…" pattern echoed from corpus exemplar 6.

---

## Scoring

- State machine score: **10 / 10** (clean linear path; AWAIT_PANEL_PHOTO self-loop handled correctly for clarifying-question; advanced on photo MMS as expected)
- Classifier score: **10 / 10** (correctly emitted `asking_clarifying_technical` on the canonical-example turn; honest low-confidence on the hold token; style inference held default through the test)
- Voice score: **9 / 10** (clean register, brief-answer-then-reask landed cleanly per the special-handler spec; one minor softener could have lifted to 9.5)

## Reviewer notes

(Empty — Key fills this in)

---

## v5 batch summary line

[v5] Persona 19 (daniel) — reached COMPLETE in 11 turns. asking_clarifying_technical-fired: yes. Brief-answer-quality 9. Bot-skipped-photo: no. Voice 9/10. Status: PASS.
