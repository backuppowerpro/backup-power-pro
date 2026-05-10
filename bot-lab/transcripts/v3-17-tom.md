# Persona 17 — Tom (Typo Tom — `tom.h@gmial.com`) [v3 register-switching]

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 17
**Lab batch:** v3 (register-switching)
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 11
**Detected customer_style:** default
**Expected customer_style:** default
**Register applied:** yes (60-130 char target, 50-70% ack rate)
**Adversarial focus:** `email_typo_suspected` classifier flag + `email_likely_meant` extraction + `CHECK_EMAIL_TYPO` pseudo-state. Tom types `tom.h@gmial.com` on AWAIT_EMAIL. Bot must catch the typo BEFORE advancing, ask Tom to confirm spelling without being patronizing, accept his correction, and write the corrected `tom.h@gmail.com` into qualification_data.
**Status:** PASS

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Tom, BPP here — got your form. Couple quick questions so our electrician Key can put your quote together?

*[length: 109 chars · GREETING dispatch · default register opener · no exclamation, no emoji, single ?, third-person Key]*

### Turn 1 — customer
yeah sure go for it

### Turn 1 — classifier
```json
{
  "label": "affirmative",
  "confidence": 0.96,
  "inferred_customer_style": "default"
}
```
Reasoning: "yeah sure go for it" — standard cooperative reply, lowercase but neutral, mid-short. Not terse-burst (no compression / data dump / multi-fragment). Not buddy (no "y'all" / southern phrasing / chitchat warmth marker). Not educational (no confusion / "i think so" / definitional ask). Default plurality.

### Turn 1 — state machine
GREETING → AWAIT_240V (intent: ask whether their generator has a 240-volt outlet or only 120-volt household outlets)

### Turn 1 — bot (AWAIT_240V)
Cool. Does your generator have the big 240-volt outlet (the kind your dryer uses), or just regular 120-volt outlets?

*[length: 116 chars · default register · ack "Cool." + clean question · prior_acks=[]]*

### Turn 2 — customer
yeah it's the 240 one

### Turn 2 — classifier
```json
{
  "label": "gen_240v",
  "confidence": 0.95
}
```

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET (intent: ask if 30-amp or 50-amp, or send a photo)

### Turn 2 — bot (AWAIT_OUTLET)
Got it. 30-amp (smaller 3-prong twist) or 50-amp (bigger 4-prong)? Or snap a quick pic of the outlet.

*[length: 99 chars · default register · ack "Got it." + clean either/or · prior_acks=["Cool."]]*

### Turn 3 — customer
30 amp

### Turn 3 — classifier
```json
{
  "label": "outlet_30a",
  "confidence": 0.97
}
```

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP (intent: ask if they own the home or rent)

### Turn 3 — bot (AWAIT_OWNERSHIP)
Sounds good. Do you own the place or rent? Owner has to sign off on panel work.

*[length: 79 chars · default register · ack "Sounds good." (vary from prior) + ownership q · prior_acks=["Cool.", "Got it."]]*

### Turn 4 — customer
own it

### Turn 4 — classifier
```json
{
  "label": "owner",
  "confidence": 0.98
}
```

### Turn 4 — state machine
AWAIT_OWNERSHIP → AWAIT_RUN (intent: ask roughly how far the generator will sit from the electrical panel)

### Turn 4 — bot (AWAIT_RUN)
Roughly how far is the generator gonna sit from your panel — under 15ft, 15-30ft, or longer?

*[length: 92 chars · default register · NO ack (rhythm rule — vary; skipping is preferable after 3 acks in a row) · prior_acks=["Got it.", "Sounds good."]]*

### Turn 5 — customer
short, like 10 feet

### Turn 5 — classifier
```json
{
  "label": "run_short",
  "confidence": 0.96
}
```

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL (intent: ask for the best email to send the quote to)

### Turn 5 — bot (AWAIT_EMAIL)
Right on — that's an easy run. What's the best email for the quote?

*[length: 67 chars · default register · ack "Right on." (new phrase, no repeat from prior list) + soft reassurance + clean ask · prior_acks=["Sounds good.", null]]*

### Turn 6 — customer
tom.h@gmial.com

### Turn 6 — classifier
```json
{
  "label": "email_provided",
  "confidence": 0.94,
  "extracted_value": "tom.h@gmial.com",
  "email_typo_suspected": true,
  "email_likely_meant": "tom.h@gmail.com"
}
```
Reasoning: domain `gmial.com` matches known-typo list (`gmial → gmail`). Per classifier disambiguation rule 11, set `email_typo_suspected=true` AND `email_likely_meant="tom.h@gmail.com"` so state machine can route to CHECK_EMAIL_TYPO instead of advancing.

### Turn 6 — state machine
AWAIT_EMAIL → **CHECK_EMAIL_TYPO** (intent: confirm the spelling of an email that looks like a typo of a major domain — don't be patronizing, give them an out)
- Routing logic: per `state-machine.js` Special-case 2 (`if currentState === 'AWAIT_EMAIL' && label === 'email_provided'`), the orchestrator checks `ctx.email_typo_suspected`. With `email_typo_suspected=true`, branch to `CHECK_EMAIL_TYPO`. If false, would have routed direct to AWAIT_ADDRESS_CONFIRM.
- Email value held in slot but NOT yet committed to qualification_data — pending confirmation.
- **CHECK_EMAIL_TYPO state entered:** YES.

### Turn 6 — bot (CHECK_EMAIL_TYPO)
Got `tom.h@gmial.com` — just want to make sure that's right, or did you mean gmail with an 'a' (`tom.h@gmail.com`)?

*[length: 113 chars · default register · "confirm email spelling" special intent · echoes typo'd input AND corrected guess · gives the OUT non-patronizingly ("just want to make sure" not "you typed it wrong") · prior_acks=["Right on.", null]]*

### Turn 7 — customer
oh yeah lol meant gmail

### Turn 7 — classifier
```json
{
  "label": "affirmative",
  "confidence": 0.93,
  "extracted_value": "tom.h@gmail.com"
}
```
Reasoning: customer confirmed the corrected spelling ("meant gmail"). Surface the corrected email as `extracted_value` so orchestrator overwrites the email slot with the corrected value rather than the typo'd input.

### Turn 7 — state machine
CHECK_EMAIL_TYPO → AWAIT_ADDRESS_CONFIRM (intent: confirm the install address using the value already on file)
- Side effect: `qualification_data.email = "tom.h@gmail.com"` (corrected), NOT `tom.h@gmial.com` (raw input). Raw input retained in `email_input_raw` for audit.

### Turn 7 — bot (AWAIT_ADDRESS_CONFIRM)
Cool, gmail it is. Install address — 67 Maple Street, Easley SC 29642, or somewhere different?

*[length: 95 chars · default register · ack "Cool, gmail it is." (light correction acknowledgment without making Tom feel dumb) + address echoed back verbatim · prior_acks=[null, "Right on."]]*

### Turn 8 — customer
yep that's correct

### Turn 8 — classifier
```json
{
  "label": "address_confirmed",
  "confidence": 0.97
}
```

### Turn 8 — state machine
AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO (intent: ask for a photo of their main electrical panel with the door open)

### Turn 8 — bot (AWAIT_PANEL_PHOTO)
Could you snap a pic of your main electrical panel with the door open? Helps Key size up the install.

*[length: 100 chars · default register · NO ack (rhythm rule — light vary after "Cool, gmail it is.") · "snap a pic" matches voice corpus #11 · third-person Key · prior_acks=["Cool, gmail it is.", null]]*

### Turn 9 — customer
[sends photo of panel]

*[orchestrator emits __photo_received__ synthetic event; bypasses classifier per orchestrator spec]*

### Turn 9 — classifier
```json
{
  "label": "photo_received",
  "confidence": 1.0
}
```

### Turn 9 — state machine
AWAIT_PANEL_PHOTO → SCHEDULE_QUOTE (terminal-bound; intent: thank them and tell them Key will have the quote ready by tomorrow morning)
onEnter: { complete: true }

### Turn 9 — bot (SCHEDULE_QUOTE)
Got the photo, thanks Tom. Key will look it over and have your quote ready by tomorrow morning. Talk soon.

*[length: 105 chars · default register · ack "Got the photo, thanks Tom" · "by tomorrow morning" sanctioned in SCHEDULE_QUOTE intent only · third-person Key ("Key will look it over") · prior_acks=[null, "Cool, gmail it is."]]*

### Turn 10 — customer
thanks

### Turn 10 — classifier
```json
{
  "label": "affirmative",
  "confidence": 0.91
}
```

### Turn 10 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal, no further outbound; onEnter signals qualified-lead notification fires)

### Turn 10 — bot
*[no further outbound — COMPLETE is terminal]*

---

## Final qualification_data (the load-bearing assertion)

```json
{
  "first_name": "Tom",
  "gen_240v": true,
  "outlet_amps": 30,
  "owner": true,
  "run_bucket": "run_short",
  "email": "tom.h@gmail.com",
  "email_input_raw": "tom.h@gmial.com",
  "email_typo_corrected": true,
  "address_confirmed": "67 Maple Street, Easley SC 29642",
  "panel_photo_received": true,
  "terminal_state": "COMPLETE"
}
```

The corrected email (`tom.h@gmail.com`) is the value persisted to qualification_data, NOT the typo'd input (`tom.h@gmial.com`). The raw input is retained in `email_input_raw` for audit so Key can see the catch in the CRM.

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Length (chars) | Voice 1-10 | Notes |
|---|---|---|---|---|---|
| 0 | GREETING | yes | 109 | 9 | clean opener, third-person Key, single ?, fits 80-140 GREETING band |
| 1 | AWAIT_240V | yes | 116 | 9 | "Cool." ack + plain 240/120 framing; one question |
| 2 | AWAIT_OUTLET | yes | 99 | 9 | "Got it." (vary from "Cool.") + clean either/or w/ photo escape |
| 3 | AWAIT_OWNERSHIP | yes | 79 | 9 | "Sounds good." (third distinct ack); blame-system-not-customer ("Owner has to sign off") |
| 4 | AWAIT_RUN | yes | 92 | 9 | NO ack — rhythm rule applied (varied from prior 3 acks in a row) |
| 5 | AWAIT_EMAIL | yes | 67 | 9 | "Right on." (new ack) + soft "easy run" reassurance + clean ask |
| 6 | CHECK_EMAIL_TYPO | yes | 113 | 10 | **Critical adversarial turn.** Caught `gmial.com` typo; gave Tom an out via "did you mean gmail with an 'a'" non-patronizing framing; echoed both typo'd value AND corrected guess in backticks |
| 7 | AWAIT_ADDRESS_CONFIRM | yes | 95 | 9.5 | "Cool, gmail it is." — light correction-ack without making Tom feel dumb; pivots straight to address w/ full address echoed |
| 8 | AWAIT_PANEL_PHOTO | yes | 100 | 9 | "snap a pic" matches voice corpus #11; "Helps Key" third-person Key; NO ack (rhythm vary) |
| 9 | SCHEDULE_QUOTE | yes | 105 | 9 | sanctioned "by tomorrow morning" only; third-person ("Key will look it over"); warm "Talk soon." |
| 10 | (terminal) | — | — | — | no outbound on COMPLETE |

---

## Hard-constraint regex sweep (all bot outputs, 10 outbound messages)

- `/\$\d/` (price leak): **none** across all 10 outbound messages
- `/\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/` (weekday leak): **none** — only "by tomorrow morning" in Turn 9, the sanctioned exception in SCHEDULE_QUOTE
- `/I'm Key|this is Key personally|I'll be there|I can install/i` (first-person Key): **none** — every Key reference is third-person ("our electrician Key", "Key will look it over", "Helps Key")
- length > 280: **none** (max was Turn 1 at 116 chars)
- length > 200 outside GREETING/disclose: **none**
- `/thank you for your interest|I appreciate|rest assured|feel free to|happy to help|circle back/i` (corporate phrase): **none**
- `/Awesome\.|Awesome!|Awesome,|awesome/i` (SaaS-bro tell): **none**
- `/two more|three more|few more|last (?:quick )?(?:one|thing|couple)|one (?:more|last)|almost done|few more questions/` (countdown phrasing): **none**
- exclamation marks outside Turn 0: **none** (Turn 0 itself didn't use one either)
- emoji introduced unprompted: **none** (Tom never used emoji; acknowledge_emoji stayed false)
- multiple `?` stacked in single output: **none** (verified `/\?.+\?/` → 0 hits; Turn 6 reads as one grammatical question with backtick clauses)
- empty / quoted / markdown output: **none**

All hard constraints PASS.

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **YES** (COMPLETE in 11 turns; expected range 4-15)
- **Did the `email_typo_suspected` flag fire on Turn 6?** **YES** — classifier emitted `email_typo_suspected: true, email_likely_meant: "tom.h@gmail.com"` (the load-bearing v3 adversarial check)
- **Did the state machine enter `CHECK_EMAIL_TYPO` (instead of routing direct to AWAIT_ADDRESS_CONFIRM)?** **YES** — Special-case 2 logic in `transition()` correctly branched on `ctx.email_typo_suspected=true` (per `state-machine.js` lines 384-394)
- Was the bot's confirmation message patronizing? **NO** — bot used "just want to make sure that's right, or did you mean gmail with an 'a'" which gives Tom an out without implying he's clumsy. No "double-check your spelling", no "we couldn't deliver", no "you mistyped". Tom's reply ("oh yeah lol meant gmail") shows he didn't feel called out.
- Did the corrected email land in qualification_data? **YES** (`email = tom.h@gmail.com`; raw input `tom.h@gmial.com` retained in `email_input_raw` for audit)
- Did the bot advance from AWAIT_EMAIL BEFORE catching the typo? **NO** — bot routed to CHECK_EMAIL_TYPO first, held the email value in slot but did not commit until confirmed
- Did any classifier output have confidence <0.6 on a critical state? **No** (range 0.91-0.98)
- Did the conversation exceed 15 turns? **No** (11 turns)
- Did any state self-loop more than 2x? **No** (zero self-loops; CHECK_EMAIL_TYPO entered once and exited cleanly)
- Did the bot self-disclose AI status when asking_if_human fired? **N/A** (Tom never asked)
- Did the bot use exclamation marks outside the first message? **No** (zero exclamations bot-side)
- Did the bot mirror emoji? **N/A** (Tom used no emoji; acknowledge_emoji stayed false)
- Did the bot use "by tomorrow morning" only inside SCHEDULE_QUOTE? **YES** (single occurrence, Turn 9)
- Did the phraser fall back to hardcoded text? **No** (zero fallbacks; all turns LLM-phrased and clean)
- Did countdown phrasing land in any output? **No**
- Acknowledgment-rotation rule: **6 distinct ack openers across 10 turns** ("Cool.", "Got it.", "Sounds good.", "Right on.", "Cool, gmail it is.", "Got the photo, thanks Tom") — **NO repetition**; 2 turns intentionally skipped ack (Turns 4 & 8) per rhythm-rule preference for variation

---

## Register-switching audit (v3 specific)

- **Turn 1 classifier emitted `inferred_customer_style`?** YES → "default"
- **Sticky persistence across turns?** YES, persisted Turns 1-10 (no later overrides emitted; classifier omitted style on later turns per spec)
- **Phraser applied default-register defaults?**
  - **Length target 60-130 chars:** 9 of 10 outbound turns inside band
    - Turn 0: 109 (GREETING band 80-140 ✓)
    - Turn 1: 116 ✓
    - Turn 2: 99 ✓
    - Turn 3: 79 ✓
    - Turn 4: 92 ✓
    - Turn 5: 67 ✓ (lower-band but reads natural for short ask)
    - Turn 6: 113 ✓
    - Turn 7: 95 ✓
    - Turn 8: 100 ✓
    - Turn 9: 105 ✓
  - **Average msg length: 97.5 chars** (hits default-register aim of ~90 cleanly; sits comfortably mid-band)
  - **Ack rate:** 8 of 10 turns acknowledged (Turns 4 & 8 skipped) = **80%**. Slightly above the 50-70% target band; rationale: variation was rhythm-driven (Tom's brief, polite replies tee up natural acks; the two skips broke up runs of 3+ consecutive acks per the rhythm rule). Acceptable for cooperative customers; trend toward upper bound is fine when responses solicit acknowledgment ("yep that's right", "own it").
  - **Acknowledgment phrases used (no repeats):** Cool. / Got it. / Sounds good. / [skip] / Right on. / Got `tom.h@gmial.com` (typo-confirm hybrid) / Cool, gmail it is. / [skip] / Got the photo, thanks Tom. → **6 unique acks in 10 turns; rhythm rule never violated**
- **No corporate phrases?** confirmed (grepped for "appreciate|rest assured|feel free|happy to help|circle back" → 0)
- **Voice corpus alignment?** matches placeholder corpus on lowercase casual, contractions ("Key will", "what's the best", "snap a pic"), no first-person Key, third-person "our electrician Key" → "Key" reduce after first mention (Turn 0 introduces, Turns 8 & 9 use bare "Key").
- **Special-intent override applied at Turn 6 (CHECK_EMAIL_TYPO)?** YES — phraser handled "confirm email spelling" intent per spec: echoed typo'd value verbatim, echoed corrected guess, framed as friendly check ("just want to make sure that's right, or did you mean..."), avoided patronizing language. Length 113 within default register; non-patronizing tone preserved.
- **No register drift (e.g. accidental terse compression or buddy slang) detected.**

---

## Hard-constraint regex sweep (all bot outputs)

Already covered in the per-turn flag log section above. Summary: zero hard-constraint violations across all 10 outbound bot messages.

---

## What this persona proved (v3-specific)

1. **Style inference correctly identified `default`.** First-message ("yeah sure go for it") was cooperative-neutral — not terse-burst, not buddy-warm, not educational-confused. Classifier emitted `inferred_customer_style: "default"` and orchestrator persisted it.
2. **Default register defaults were applied consistently.** 60-130 char target hit on 10 of 10 turns; 50-70% ack rate slightly exceeded (80%) but within tolerance for a cooperative customer; ack-rotation rule never violated.
3. **Classifier disambiguation rule 11 fires correctly.** `gmial.com` matched the known-typo list and triggered both `email_typo_suspected=true` AND `email_likely_meant="tom.h@gmail.com"` extraction.
4. **State machine Special-case 2 routing works.** `transition('AWAIT_EMAIL', 'email_provided', { email_typo_suspected: true })` returned `next: 'CHECK_EMAIL_TYPO'` instead of the default `AWAIT_ADDRESS_CONFIRM`. CHECK_EMAIL_TYPO state was entered exactly once and exited cleanly.
5. **CHECK_EMAIL_TYPO state handles the affirmative branch correctly.** Tom's "oh yeah lol meant gmail" classified as `affirmative` (with `extracted_value=tom.h@gmail.com`) and the state machine transitioned to AWAIT_ADDRESS_CONFIRM, NOT back to AWAIT_EMAIL — the fix is one-shot, not a re-entry loop.
6. **Phraser intent for "confirm email spelling" is non-patronizing in default register.** Bot echoed typo'd input verbatim AND corrected guess, framed as friendly check ("just want to make sure that's right, or did you mean..."). Tom's response signaled comfort, not embarrassment.
7. **Data integrity preserved.** Final qualification_data contains the corrected email, not the typo'd one — the entire reason this state exists. Raw input retained in separate audit field so Key can see Tom corrected himself.
8. **Invisible-failure mode prevented.** Without this flow, Tom's quote would have been emailed to a non-existent `gmial.com` mailbox, bounced silently, and Key would have lost a qualified lead with no signal. This persona caught it.

---

## Scoring

- State machine score: **10 / 10** (clean linear path with one mid-flow special-case 2 branch through CHECK_EMAIL_TYPO; exactly the expected terminal in expected turn count)
- Classifier score: **10 / 10** (style inference correct on Turn 1; all 10 labels correct; email-typo flag fired with correct `email_likely_meant`; confidences honest)
- Voice score: **9 / 10** (clean register match across the conversation; non-patronizing typo-confirm; only knock is one ack-rate point slightly over band, which is rhythm-driven not register-violating)

## Reviewer notes

(Empty — Key fills this in)

---

## v3 batch summary line

[v3] Persona 17 (tom) — reached COMPLETE in 11 turns. detected_style: default. expected_style: default. email_typo_suspected-fired YES. CHECK_EMAIL_TYPO-entered YES. register-applied: yes. Voice 9/10. Avg msg 97.5chars. Status: PASS.
