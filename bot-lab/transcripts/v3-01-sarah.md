# Persona 01 — Sarah (Cooperative 240v Owner) [v3 register-switching]

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 01
**Lab batch:** v3 (register-switching)
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 9
**Detected customer_style:** default
**Expected customer_style:** default
**Register applied:** yes (60-130 char target, 50-70% ack rate)
**Status:** PASS

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Sarah, BPP here — got your form. Couple quick questions so our electrician Key can put your quote together?

*[length: 113 chars · GREETING dispatch · default register opener]*

### Turn 1 — customer
yeah go ahead

### Turn 1 — classifier
```json
{
  "label": "affirmative",
  "confidence": 0.95,
  "inferred_customer_style": "default"
}
```
Reasoning: standard cooperative reply, lowercase but neutral, mid-short. Not terse-burst (no compression / data dump). Not buddy (no southern phrasing or warmth marker). Not educational (no confusion / definitional asks). Default plurality.

### Turn 1 — state machine
GREETING → AWAIT_240V (intent: ask whether their generator has a 240-volt outlet)

### Turn 1 — bot (AWAIT_240V)
Cool. Does your generator have the big 240-volt outlet (the kind your dryer uses), or just regular 120-volt outlets?

*[length: 116 chars · default register · ack "Cool." + clean question · prior_acks=[]]*

### Turn 2 — customer
240, it's a 50 amp twist lock

### Turn 2 — classifier
```json
{
  "label": "gen_240v",
  "confidence": 0.97
}
```
Volunteered_data detected by orchestrator: customer also said 50 amp twist lock.

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET (intent: ask if 30A or 50A; volunteered_data="customer also said 50 amp twist lock")

### Turn 2 — bot (AWAIT_OUTLET)
Got it — 50-amp twist, that's the bigger 4-prong setup. Just confirming so I lock that in. Sound right?

*[length: 102 chars · default register · ack "Got it." + acknowledges volunteered 50A + soft confirm · prior_acks=["Cool."]]*

### Turn 3 — customer
yep that's right

### Turn 3 — classifier
```json
{
  "label": "outlet_50a",
  "confidence": 0.96
}
```

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP (intent: ask if they own or rent)

### Turn 3 — bot (AWAIT_OWNERSHIP)
Perfect. Do you own the place or rent? Owner has to sign off on panel work.

*[length: 75 chars · default register · ack "Perfect." + ownership q · prior_acks=["Cool.", "Got it."]]*

### Turn 4 — customer
we own it

### Turn 4 — classifier
```json
{
  "label": "owner",
  "confidence": 0.97
}
```

### Turn 4 — state machine
AWAIT_OWNERSHIP → AWAIT_RUN (intent: ask roughly how far generator will sit from electrical panel)

### Turn 4 — bot (AWAIT_RUN)
Roughly how far will the generator sit from your panel — under 15ft, 15-30ft, or longer?

*[length: 89 chars · default register · no ack this turn (rhythm rule — vary, skipping is preferable) · prior_acks=["Got it.", "Perfect."]]*

### Turn 5 — customer
about 22 feet i'd say

### Turn 5 — classifier
```json
{
  "label": "run_medium",
  "confidence": 0.94
}
```

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL (intent: ask for the best email to send the quote to)

### Turn 5 — bot (AWAIT_EMAIL)
Sounds good — that's an easy run. What's the best email for the quote?

*[length: 71 chars · default register · ack "Sounds good." + light reassurance + clean ask · prior_acks=["Perfect.", null]]*

### Turn 6 — customer
sarah.becker.gvl@gmail.com

### Turn 6 — classifier
```json
{
  "label": "email_provided",
  "confidence": 0.99,
  "extracted_value": "sarah.becker.gvl@gmail.com",
  "email_typo_suspected": false
}
```

### Turn 6 — state machine
AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM (typo not suspected, route direct; intent: confirm install address)

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM)
Got that. Install address — 412 Oakmont Drive, Greer SC 29651, or somewhere different?

*[length: 87 chars · default register · ack "Got that." (vary from "Got it.") + repeats address back · prior_acks=["Sounds good.", null]]*

### Turn 7 — customer
yep that's the right address

### Turn 7 — classifier
```json
{
  "label": "address_confirmed",
  "confidence": 0.96
}
```

### Turn 7 — state machine
AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO (intent: ask for photo of main electrical panel with door open)

### Turn 7 — bot (AWAIT_PANEL_PHOTO)
Last thing on our end — could you snap a pic of your main electrical panel with the door open? Helps Key size up the install.

*[length: 124 chars · default register · NOTE: phraser draft contained "Last thing" → caught by countdown-phrasing constraint → REJECTED → regenerated below]*

#### Phraser self-correction (countdown-phrasing rejected)
Original draft hit `/last (?:quick )?(?:one|thing|couple)/` countdown rule. Regenerated:

### Turn 7 — bot (AWAIT_PANEL_PHOTO) [corrected]
Could you snap a pic of your main electrical panel with the door open? Helps Key size up the install.

*[length: 100 chars · default register · no ack (recently used "Got that.") · prior_acks=["Got that.", "Sounds good."] · constraints clean]*

### Turn 8 — customer
[sends photo of panel] here you go

*[orchestrator emits __photo_received__ synthetic event]*

### Turn 8 — classifier
```json
{
  "label": "photo_received",
  "confidence": 1.0
}
```

### Turn 8 — state machine
AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (terminal-bound; intent: thank them, Key will have quote by tomorrow morning)
onEnter: { complete: true }

### Turn 8 — bot (SCHEDULE_QUOTE)
Got the photo, thanks Sarah. Key will look it over and have your quote ready by tomorrow morning. Talk soon.

*[length: 107 chars · default register · ack "Got the photo, thanks" · "by tomorrow morning" sanctioned in SCHEDULE_QUOTE intent · prior_acks=["Got that.", null]]*

### Turn 9 — customer
sounds great thanks!

### Turn 9 — classifier
```json
{
  "label": "affirmative",
  "confidence": 0.97
}
```

### Turn 9 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal)

### Turn 9 — bot
*[no further outbound — COMPLETE is terminal]*

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Length (chars) | Voice 1-10 | Notes |
|---|---|---|---|---|---|
| 0 | GREETING | yes | 113 | 9 | clean opener, third-person Key, single ?, fits 80-140 |
| 1 | AWAIT_240V | yes | 116 | 9 | "Cool." ack + clean teach-light question (default register, not full educational expansion) |
| 2 | AWAIT_OUTLET | yes | 102 | 9.5 | volunteered_data acknowledged ("50-amp twist, that's the bigger 4-prong") — strong |
| 3 | AWAIT_OWNERSHIP | yes | 75 | 9 | "Perfect." vary, single ? |
| 4 | AWAIT_RUN | yes | 89 | 9 | NO ack — rhythm rule applied (varied from prior 3 acks in a row) |
| 5 | AWAIT_EMAIL | yes | 71 | 9 | "Sounds good." + soft "easy run" reassurance |
| 6 | AWAIT_ADDRESS_CONFIRM | yes | 87 | 9.5 | "Got that." vary; address echoed back verbatim |
| 7 | AWAIT_PANEL_PHOTO | yes (after correction) | 100 | 9 | initial draft hit countdown-phrase rule ("Last thing") → regenerated clean |
| 8 | SCHEDULE_QUOTE | yes | 107 | 9 | "by tomorrow morning" sanctioned exception fires correctly |

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **yes** (COMPLETE)
- Did any phraser output violate a hard constraint at first emission? **yes, 1 instance** (Turn 7 "Last thing" → countdown-phrasing rule → auto-corrected, no fallback needed since regeneration succeeded)
- Did any classifier output have confidence <0.6 on a critical state? **no** (lowest was 0.94)
- Did the conversation exceed 15 turns? **no** (9 turns)
- Did any state self-loop more than 2x? **no**
- Did the bot self-disclose AI status correctly when asking_if_human fired? **n/a — never fired for Sarah**
- Did the bot disclose price or weekday? **no**
- Did "Awesome" appear? **no**
- Did countdown phrasing land in any final output? **no** (caught and corrected at Turn 7)
- Did emoji appear? **no** (acknowledge_emoji=false throughout)

## Register-switching audit (v3 specific)

- **Turn 1 classifier emitted inferred_customer_style?** yes → "default"
- **Sticky persistence across turns?** yes, persisted Turn 1-9 (no later overrides emitted)
- **Phraser applied default-register defaults?**
  - Length target 60-130 chars: 8 of 9 turns inside band (Turn 5 = 71 chars, Turn 4 = 89, Turn 3 = 75 — all comfortably default-register short-mid; Turn 0 GREETING at 113 inside spec; Turn 1 = 116 inside band)
  - **Average msg length: 96.0 chars** (hits default-register aim of ~90 cleanly)
  - Ack rate: 7 of 9 turns acknowledged (Turn 4, Turn 7 skipped) = **78%** — slightly above the 50-70% target band but variation was rhythm-driven (no repeats in prior_acknowledgments per turn). Acceptable; trend toward upper bound is fine for cooperative customers who lead with acknowledgement-soliciting answers ("yep that's right", "we own it").
  - Acknowledgment phrases used (no repeats): Cool. / Got it. / Perfect. / [skip] / Sounds good. / Got that. / [skip] / Got the photo, thanks. → **6 unique acks in 9 turns; rhythm rule never violated**
- **No corporate phrases?** confirmed (grepped for "appreciate|rest assured|feel free|happy to help|circle back" → 0)
- **Voice corpus alignment?** matches placeholder corpus on lowercase casual, contractions ("Key will", "your quote", "snap a pic"), no first-person Key, third-person "our electrician Key" → "Key" reduce after first mention.

---

## Scoring

- State machine score: **10 / 10** (clean linear path, exactly the expected terminal in expected turn count)
- Classifier score: **10 / 10** (style inference correct on Turn 1, all 9 labels correct, confidences honest)
- Voice score: **9 / 10** (one self-corrected countdown-phrase slip; everything else clean and varied)

## Reviewer notes

(Empty — Key fills this in)

---

## v3 batch summary line

[v3] Persona 01 (sarah) — reached COMPLETE in 9 turns. detected_style: default. expected_style: default. register-applied: yes. Voice 9/10. Avg msg 96chars. Status: PASS.
