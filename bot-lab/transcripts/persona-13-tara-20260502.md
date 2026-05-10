# Persona 13 — Tara (Forgetful Form-Filler / "what is this for again")

**Date:** 2026-05-02
**Persona file:** customer-personas.md → Persona 13
**Expected terminal:** COMPLETE — bot must recognize the memory-jog as `asking_for_context` (NOT not_my_lead, NOT asking_if_human, NOT unclear), self-loop GREETING with a one-line reminder intent, then reach COMPLETE once Tara is re-oriented.
**Actual terminal:** COMPLETE
**Turns:** 11
**Status:** PASS

---

## Persona snapshot (orchestrator-private — bot does not see)

```json
{
  "first_name": "Tara",
  "owner": true,
  "gen_240v": true,
  "outlet_amps": 50,
  "run_feet": 12,
  "email": "tara.holcomb@gmail.com",
  "address_on_file": "82 Heritage Lakes Dr, Greenville SC 29615",
  "address_correct": true,
  "service_area": "Greenville",
  "expected_terminal": "COMPLETE"
}
```

**Stressors targeted by this persona:**
- New `asking_for_context` classifier label (must distinguish from `not_my_lead`, `asking_if_human`, `unclear`)
- New state-machine self-loop on GREETING with `remind_context: true` onEnter flag
- Phraser's "remind context one-liner + re-ask" intent — friendly, no offense, no "as I said before"
- New hard-constraint regex checks: no "Awesome.", no countdown phrasing ("almost done", "two more", "last quick one"), no acknowledgment-phrase repeats across consecutive bot turns

---

## Conversation

### Turn 0 — bot (GREETING)
Hey Tara, BPP here — got your form. Couple quick questions so our electrician Key can put your quote together?

> Hard-constraint pass: no "$", no weekday, no first-person Key, no "Awesome.", no countdown, length 116 chars (within 80-140 GREETING window). One question, ends in "?". Mentions BPP + Key + first name.

### Turn 1 — customer
wait what is this for again

### Turn 1 — classifier
- state: GREETING
- label: asking_for_context
- confidence: 0.92
- extracted_value: —
- off_topic_excerpt: —
- reasoning trace (orchestrator-internal, not emitted by classifier):
  - NOT `not_my_lead` (no hostility, no "wrong number", no "I never signed up")
  - NOT `asking_if_human` (not asking person-vs-bot)
  - NOT `unclear` (perfectly clear: she's asking what this conversation is about)
  - Matches the canonical example in classifier-agent.md: "wait what is this for again" → asking_for_context (test case #32, expected confidence > 0.85)
  - Disambiguation rule 5: low-stakes memory jog, no hostility → asking_for_context

### Turn 1 — state machine
GREETING -> GREETING (self-loop; intent: "customer is asking what this is for; give a one-line reminder it's their generator inlet quote, then re-ask: greet by first name as BPP intake, mention our electrician Key will quote, ask if it is a good time for a couple quick questions"; onEnter: remind_context=true)

### Turn 1 — phraser input
```json
{
  "intent": "remind context one-liner: it's their generator inlet quote — they came through the site earlier; couple quick questions so Key can put a number together. Cool?",
  "customer_first_name": "Tara",
  "customer_last_message": "wait what is this for again",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "chitchat_excerpt": null,
  "impatience_excerpt": null,
  "amended_slot": null,
  "prior_acknowledgments": [],
  "email_typo_suspected": false,
  "email_likely_meant": null
}
```

### Turn 1 — bot (GREETING, remind-context self-loop)
Oh — totally, no worries. It's for your generator inlet quote — y'all came through our site a few days back. Couple quick questions and Key can put a number together. Cool to run through 'em now?

> Hard-constraint pass: 188 chars (under 280 cap; slightly above the 60-130 mid-flow target but acceptable as a context-reminder + re-ask, which is functionally a second-pass greeting). No "$", no weekday, no first-person Key claim, no "Awesome.", no countdown phrasing ("two more", "last quick one", "almost done" — none present), no "as I said before" / "I already mentioned" (the explicitly-banned phrasing for this intent). Friendly recovery tone. Re-asks the original question. Acknowledgment phrase "Oh — totally, no worries." is fresh (prior_acknowledgments was empty).

### Turn 2 — customer
ohh right yeah ok go ahead

### Turn 2 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.95
- extracted_value: —

### Turn 2 — state machine
GREETING -> AWAIT_240V

### Turn 2 — phraser input
```json
{
  "intent": "ask whether their generator has a 240-volt outlet (the kind a clothes-dryer plugs into) or only 120-volt household outlets",
  "customer_first_name": "Tara",
  "customer_last_message": "ohh right yeah ok go ahead",
  "acknowledge_emoji": false,
  "address_on_file": null,
  "volunteered_data": null,
  "prior_acknowledgments": ["Oh — totally, no worries."]
}
```

### Turn 2 — bot (AWAIT_240V)
Cool. Quick one — does your generator have a big 240-volt outlet (the kind your dryer plugs into), or just regular 120-volt outlets?

> Hard-constraint pass: 134 chars. Acknowledgment phrase "Cool." — distinct from prior turn's "Oh — totally, no worries." (no rhythm-rule violation). One question, ends in "?". No "$", no weekday, no first-person Key, no "Awesome.", no countdown.

### Turn 3 — customer
yeah it's 240, 50 amp twist lock

### Turn 3 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.97
- extracted_value: —
- volunteered_data (orchestrator-detected per rescan rule in orchestrator-agent.md step 3g): "customer also said 50 amp twist lock"

### Turn 3 — state machine
AWAIT_240V -> AWAIT_OUTLET

### Turn 3 — phraser input
```json
{
  "intent": "ask if the 240v outlet is a 30-amp (smaller, looks like 3-prong twist-lock) or 50-amp (bigger, 4-prong)",
  "customer_first_name": "Tara",
  "customer_last_message": "yeah it's 240, 50 amp twist lock",
  "acknowledge_emoji": false,
  "volunteered_data": "customer also said 50 amp twist lock",
  "prior_acknowledgments": ["Oh — totally, no worries.", "Cool."]
}
```

### Turn 3 — bot (AWAIT_OUTLET, with volunteered-data acknowledgment)
Got it — sounds like 50-amp from what you said. Just to lock it in, that's the bigger 4-prong twist-lock right?

> Hard-constraint pass: 113 chars. Acknowledgment phrase "Got it." — distinct from "Oh — totally, no worries." and "Cool." (rhythm-rule clean). Acknowledges the volunteered 50A so customer doesn't feel re-asked. One question. No "$", no weekday, no first-person Key, no "Awesome.", no countdown ("two more"/"last one"/"almost done" — absent).

### Turn 4 — customer
yep 4 prong 50 amp

### Turn 4 — classifier
- state: AWAIT_OUTLET
- label: outlet_50a
- confidence: 0.98

### Turn 4 — state machine
AWAIT_OUTLET -> AWAIT_OWNERSHIP

### Turn 4 — phraser input
```json
{
  "intent": "ask if they own the home or rent (because owner approval is required for panel work)",
  "customer_first_name": "Tara",
  "customer_last_message": "yep 4 prong 50 amp",
  "acknowledge_emoji": false,
  "prior_acknowledgments": ["Cool.", "Got it."]
}
```

### Turn 4 — bot (AWAIT_OWNERSHIP)
Sounds good. Do you own the place or rent? (Owner has to sign off on panel work.)

> Hard-constraint pass: 84 chars. Acknowledgment phrase "Sounds good." — different from prior two turns' "Cool." and "Got it." (rhythm-rule clean). One question. No countdown ("two more"/"last one"/"almost done" — absent). No "Awesome.".

### Turn 5 — customer
we own it

### Turn 5 — classifier
- state: AWAIT_OWNERSHIP
- label: owner
- confidence: 0.97

### Turn 5 — state machine
AWAIT_OWNERSHIP -> AWAIT_RUN

### Turn 5 — phraser input
```json
{
  "intent": "ask roughly how far the generator will sit from the electrical panel — short under 15ft, medium 15-30ft, or longer than 30ft",
  "customer_first_name": "Tara",
  "customer_last_message": "we own it",
  "acknowledge_emoji": false,
  "prior_acknowledgments": ["Got it.", "Sounds good."]
}
```

### Turn 5 — bot (AWAIT_RUN)
How far is the generator gonna sit from your panel? Under 15ft, 15-30ft, or longer?

> Hard-constraint pass: 81 chars. NO acknowledgment phrase used (per phraser rule 17 in eval suite — sometimes the acknowledgment is dropped to avoid templating, especially when prior turns already used "Got it." and "Sounds good."). One question. No countdown.

### Turn 6 — customer
like 12 feet, real close

### Turn 6 — classifier
- state: AWAIT_RUN
- label: run_short
- confidence: 0.96
- extracted_value: "12ft"

### Turn 6 — state machine
AWAIT_RUN -> AWAIT_EMAIL

### Turn 6 — phraser input
```json
{
  "intent": "ask for the best email to send the quote to",
  "customer_first_name": "Tara",
  "customer_last_message": "like 12 feet, real close",
  "acknowledge_emoji": false,
  "volunteered_data": "customer said run is about 12ft",
  "prior_acknowledgments": ["Sounds good.", "(none)"]
}
```

### Turn 6 — bot (AWAIT_EMAIL)
Right on, short run keeps it clean. What's the best email for the quote?

> Hard-constraint pass: 71 chars. Acknowledgment phrase "Right on" — distinct from prior turns' "Sounds good." and "(none)" (rhythm-rule clean). One question. No "$", no weekday, no countdown.

### Turn 7 — customer
tara.holcomb@gmail.com

### Turn 7 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.99
- extracted_value: "tara.holcomb@gmail.com"
- email_typo_suspected: false (clean gmail.com domain)

### Turn 7 — state machine
AWAIT_EMAIL -> AWAIT_ADDRESS_CONFIRM (email_typo_suspected=false bypasses CHECK_EMAIL_TYPO per state-machine.js special-case 2; address_on_file = "82 Heritage Lakes Dr, Greenville SC 29615")

### Turn 7 — phraser input
```json
{
  "intent": "confirm the install address using the value already on file from the form — ask if it matches or if it should be different",
  "customer_first_name": "Tara",
  "customer_last_message": "tara.holcomb@gmail.com",
  "acknowledge_emoji": false,
  "address_on_file": "82 Heritage Lakes Dr, Greenville SC 29615",
  "prior_acknowledgments": ["(none)", "Right on"]
}
```

### Turn 7 — bot (AWAIT_ADDRESS_CONFIRM)
Got that. Install address — 82 Heritage Lakes Dr, Greenville SC 29615, or somewhere else?

> Hard-constraint pass: 89 chars. Acknowledgment phrase "Got that." — distinct from prior turns' "(none)" and "Right on" (rhythm-rule clean — note: not exactly the same as "Got it." used 3 turns earlier; allowed since rule only bans repeats from the *last 2* prior bot turns). Address repeated back verbatim. One question. No "$", no weekday, no countdown.

### Turn 8 — customer
yep that's the right address

### Turn 8 — classifier
- state: AWAIT_ADDRESS_CONFIRM
- label: address_confirmed
- confidence: 0.97

### Turn 8 — state machine
AWAIT_ADDRESS_CONFIRM -> AWAIT_PANEL_PHOTO

### Turn 8 — phraser input
```json
{
  "intent": "ask for a photo of their main electrical panel with the door open so Key can size up the install",
  "customer_first_name": "Tara",
  "customer_last_message": "yep that's the right address",
  "acknowledge_emoji": false,
  "prior_acknowledgments": ["Right on", "Got that."]
}
```

### Turn 8 — bot (AWAIT_PANEL_PHOTO)
One more — could you snap a pic of your main panel with the door open and send it over? Helps Key size up the install.

> Hard-constraint pass: 122 chars. Phrasing note: "One more" is *not* the banned countdown phrasing — the explicitly-banned items per phraser-agent.md are "two more quick", "last quick one", "almost done", "few more questions". "One more" mid-final-photo-ask is borderline but acceptable in context (the bot is genuinely on the last ask, not promising message counts mid-flow). Voice exemplar 11 in voice-corpus.md is the model: "Got the photo, that's a Cutler-Hammer panel — should be fine for the interlock." — same casual register. "snap a pic" matches voice exemplar 1/3/8 register. Third-person Key ("Helps Key size up..."). One question. No "$", no weekday, no first-person Key, no "Awesome.".
>
> ⚠️ Soft note for review: if Key reads this and feels "One more" tips into countdown territory, the safer alternative is `"Last bit — could you snap a pic of your main panel with the door open? Helps Key size up the install."` — but "Last bit" also flirts with "last quick one" pattern. Cleanest variant: `"Could you snap a pic of your main panel with the door open and send it over? Helps Key size up the install."` (no countdown opener at all). Flagging for prompt-tuning consideration; not auto-failing this turn since "One more" alone is not in the explicit banned-phrase list.

### Turn 9 — customer
[sends photo of panel]

### Turn 9 — synthetic event
- event: __photo_received__
- (not classified — direct synthetic transition into state machine, per orchestrator spec)

### Turn 9 — state machine
AWAIT_PANEL_PHOTO -> SCHEDULE_QUOTE (onEnter: complete=true — fires "qualified lead" notification to Key)

### Turn 9 — phraser input
```json
{
  "intent": "thank them and tell them Key will review the photo and have the quote ready by tomorrow morning. soft commitment — no specific time",
  "customer_first_name": "Tara",
  "customer_last_message": "[photo received]",
  "acknowledge_emoji": false,
  "prior_acknowledgments": ["Got that.", "(none — One more)"]
}
```

### Turn 9 — bot (SCHEDULE_QUOTE)
Got the photo, thanks. Key will look it over and have your quote to you by tomorrow morning. Holler if anything comes up.

> Hard-constraint pass: 122 chars. "by tomorrow morning" is the ONE sanctioned timeframe per phraser-agent.md (allowed only in SCHEDULE_QUOTE intent). No specific time, no weekday name, no "$". Third-person Key. "Holler" matches voice exemplar 6/7/12 register. Acknowledgment phrase "Got the photo, thanks." — distinct from prior bot turns' "Got that." and "One more" (rhythm-rule clean — note "Got the photo, thanks." is a longer phrase, not a repeat of bare "Got that.").

### Turn 10 — customer
sounds good thanks!

### Turn 10 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.96

### Turn 10 — state machine
SCHEDULE_QUOTE -> COMPLETE (terminal — no further outbound from bot)

---

## Per-turn flag log

| Turn | State | Hard-constraint pass? | Voice 1-10 | Notes |
|---|---|---|---|---|
| 0 | GREETING | PASS | — | First-name greeting; BPP + Key both mentioned; ends in question; 116 chars (within 80-140 GREETING window); no exclamation (allowed but not required); no emoji (correct — customer hasn't sent any) |
| 1 | GREETING (self-loop) | PASS | — | **Critical test turn.** Context reminder landed: "It's for your generator inlet quote — y'all came through our site a few days back." Re-asks original question. No offense taken, no "as I said before", no "I already mentioned". Friendly recovery. 188 chars (slightly above 60-130 target but justified for this intent — second-pass greeting after memory jog) |
| 2 | AWAIT_240V | PASS | — | Acknowledgment "Cool." different from turn-1's "Oh — totally, no worries." (rhythm-rule clean). One question. Canonical 240v phrasing |
| 3 | AWAIT_OUTLET | PASS | — | Volunteered 50A acknowledged ("sounds like 50-amp from what you said") so customer doesn't feel re-asked. Confirmation framing per phraser rule for volunteered_data. Acknowledgment "Got it." different from prior turn's "Cool." |
| 4 | AWAIT_OWNERSHIP | PASS | — | Acknowledgment "Sounds good." different from prior two turns ("Cool.", "Got it."). One question. No countdown phrasing |
| 5 | AWAIT_RUN | PASS | — | NO acknowledgment used (intentional variation — per phraser rule, not every turn needs an ack-phrase, especially when last 2 turns used them). Three-bucket question matches state-machine canonical phrasing |
| 6 | AWAIT_EMAIL | PASS | — | Acknowledgment "Right on" different from "Sounds good." and "(none)". Single short ask |
| 7 | AWAIT_ADDRESS_CONFIRM | PASS | — | Address repeated back verbatim. Acknowledgment "Got that." different from prior two ("(none)", "Right on") |
| 8 | AWAIT_PANEL_PHOTO | PASS-with-soft-flag | — | "One more" is borderline countdown phrasing — not in explicit banned list ("two more quick", "last quick one", "almost done", "few more questions") but adjacent. Soft flag for prompt-tuning consideration. Body of message ("snap a pic", "Helps Key size up the install") is clean and matches voice exemplars |
| 9 | SCHEDULE_QUOTE | PASS | — | "by tomorrow morning" used — the ONE sanctioned timeframe for this state. No weekday, no specific time, no "$", no "I'll be there" first-person leak. "Holler if anything comes up" matches voice exemplar register |

---

## Auto-flags

- **Did the bot reach the persona's expected terminal?** YES — COMPLETE reached in 11 turns (counting bot-greet at turn 0 + 10 customer-bot exchanges; the customer's final "thanks!" closes to COMPLETE).
- **Did the bot detect `asking_for_context` correctly (NOT `not_my_lead`, `asking_if_human`, or `unclear`)?** YES — classifier emitted `asking_for_context` with confidence 0.92 on "wait what is this for again" (matches test case #32 in classifier-agent.md, expected conf > 0.85).
- **Did any phraser output violate a hard constraint (regex check)?** NONE
  - `/\$\d/` — no dollar amounts emitted
  - `/\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/` — no weekday names anywhere
  - `/I'm Key|this is Key personally|I'll be there|I can install/i` — no first-person Key claims
  - `/thank you for your interest|I appreciate|rest assured|feel free to|happy to help|circle back/i` — none of these forbidden phrases
  - `/Awesome\.|Awesome!|Awesome,/` — **0 instances of "Awesome." anywhere** (new constraint pass)
  - `/two more quick|last quick one|almost done|few more questions/i` — **0 explicit countdown phrases** (new constraint pass; "One more" at turn 8 flagged as soft-borderline but not in explicit ban list)
  - All outputs ≤ 280 chars (longest = 188 chars at turn 1 disclosure)
  - No acknowledgment-phrase repeats across consecutive bot turns (rhythm-rule pass; confirmed turn-by-turn in flag log above)
- **Did any classifier output have confidence < 0.6 on a critical state?** NO — lowest confidence was 0.92 (turn 1, the new `asking_for_context` label, which is genuinely the freshest call in this conversation but still well above the retry threshold).
- **Did the conversation exceed 15 turns?** NO — 11 turns, within the 4-15 healthy range.
- **Did any state self-loop more than 2x?** NO — GREETING self-looped exactly once (intentional, for the context-reminder).
- **Did the bot self-disclose AI status when not asked?** NO — `asking_if_human` was NEVER fired; `asking_for_context` does NOT require AI disclosure. Bot correctly distinguished between the two intents and gave a context reminder, not an AI disclosure.
- **Did the bot acknowledge the volunteered 50A from turn 3?** YES — turn 3's bot output: "Got it — sounds like 50-amp from what you said. Just to lock it in, that's the bigger 4-prong twist-lock right?" — confirmation framing, not re-ask.

---

## Persona-13-specific findings (asking_for_context test)

This is the persona that exists specifically to test the new `asking_for_context` classifier label, the GREETING self-loop with `remind_context: true`, and the phraser's "remind context one-liner" intent. Findings:

1. **Classifier disambiguation rule 5 worked.** "wait what is this for again" was correctly labeled `asking_for_context` and NOT confused with:
   - `not_my_lead` (ruled out: no hostility, no "wrong number", no "I never signed up")
   - `asking_if_human` (ruled out: not asking person-vs-bot)
   - `unclear` (ruled out: perfectly clear what she's asking)
   The hostility-vs-memory-jog distinction (rule 5 in classifier-agent.md) held cleanly. Confidence 0.92, well above the 0.85 floor specified in test case #32.

2. **State machine self-looped GREETING with the correct intent.** Per state-machine.js line 41 (`asking_for_context: 'GREETING'`) and the special-case logic at lines 406-416, the transition produced:
   - `next: GREETING` (self-loop)
   - `intent: "customer is asking what this is for; give a one-line reminder it's their generator inlet quote, then re-ask: greet by first name as BPP intake, mention our electrician Key will quote, ask if it is a good time for a couple quick questions"`
   - `onEnter: { remind_context: true }`
   - `fallback: "It's for your generator inlet quote — y'all came through our site earlier. Couple quick questions and Key can put a number together. Cool?"`

3. **Phraser delivered the one-line reminder cleanly.** Output: "Oh — totally, no worries. It's for your generator inlet quote — y'all came through our site a few days back. Couple quick questions and Key can put a number together. Cool to run through 'em now?"
   - Gives a one-line reminder: YES ("It's for your generator inlet quote — y'all came through our site a few days back.")
   - Does NOT take offense: YES ("Oh — totally, no worries." opens warmly)
   - Does NOT say "as I said before" / "I already mentioned": YES (passes the explicit-banned-phrasing check)
   - Re-asks the original question: YES ("Cool to run through 'em now?")
   - Length under 280 chars: YES (188 chars)
   - Voice register matches Key's plainspoken-Southern style: YES ("y'all", "run through 'em")

4. **Tara cooperated for the rest of the conversation.** Per persona definition: after the one-line reminder, says "ohh right yeah ok go ahead" and continues to COMPLETE. Exactly what happened. No second memory-jog flare, no STOP, smooth qualification through to panel photo.

5. **No `asking_if_human` confusion.** The bot did NOT mistakenly disclose AI status (which is the correct intent for Tony's Persona 11, not for Tara). The two new GREETING self-loop labels (`asking_for_context` and `asking_if_human`) were kept distinct in both classifier output and state-machine handling.

---

## New-constraint compliance summary (added in this iteration)

- **No "Awesome." anywhere** — PASS (0 instances across all 10 bot outputs)
- **No countdown phrasing** — PASS for explicit list ("two more quick", "last quick one", "almost done", "few more questions" — 0 instances). SOFT FLAG on turn 8's "One more" — borderline but not in explicit ban list; flagged for Key's prompt-tuning review.
- **No acknowledgment-phrase repeats across consecutive turns** — PASS (verified turn-by-turn: "Oh — totally, no worries." → "Cool." → "Got it." → "Sounds good." → (none) → "Right on" → "Got that." → (none — turn 8 opens with "One more") → "Got the photo, thanks." — every consecutive pair is distinct).

---

## Scoring (filled at review time)

- State machine score: ___ / 10
- Classifier score: ___ / 10
- Voice score: ___ / 10

## Reviewer notes

(Empty until human review — Key fills this in)

Suggested review focus:
- Was the turn-1 context reminder length (188 chars) acceptable for a second-pass greeting, or should the phraser tighten further? (Compare to Tony's transparency disclosure at 233 chars in Persona 11 transcript — both intents are similar in scope.)
- Is "One more" at turn 8 acceptable as a final-ask opener, or should it be added to the explicit countdown ban list?

---

End of transcript.
