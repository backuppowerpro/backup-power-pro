# Persona 09 — Brittney (Emoji-Heavy) — v10.1.41 zero-emoji rule

**Date:** 2026-05-07
**Phraser version:** v10.1.41 (REJECT_PATTERNS includes `emoji_present` — any single emoji rejects)
**Persona file:** customer-personas.md → Persona 09
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 10
**Status:** PASS — zero emoji emitted by bot across full conversation

---

## Conversation

### Turn 0 — bot (GREETING, variant B)
Hey Brittney, this is Backup Power Pro. Saw your form come in. Got a sec for a few quick questions so Key can put together a quote?

### Turn 1 — customer
yeahhh i got a generac 7500 ready to go 🙌

### Turn 1 — classifier
- label: affirmative
- confidence: 0.93
- inferred_customer_style: buddy (lowercase + emoji + casual)
- volunteered: gen_brand_model = "Generac 7500"

### Turn 1 — generator-lookup
- matched: true, brand: Generac, model: GP7500E, compatibility: compatible_30a (240V L14-30 outlet)
- voltage_known = true → next_state = AWAIT_PANEL_PHOTO (skip voltage + outlet questions)

### Turn 1 — state machine
GREETING → AWAIT_PANEL_PHOTO. acknowledge_emoji = true (sticky). volunteered.outlet_amps = 30 (from spec).

### Turn 1 — bot (AWAIT_PANEL_PHOTO) [two-message split, default register]
Got it, Generac 7500.

That one is a 30 amp 240V, so we are good there. To put together an accurate quote, Key will also need a photo of your main panel and breakers. No rush whenever you get a chance.

*(phraser attempt 1 included a "👍" trailing the first bubble — REJECTED on `emoji_present`. Retry attempt 2 returned clean. Logged: phraser_retry_used=1, fallback_used=false.)*

### Turn 2 — customer
lol no clue what voltage 🤷‍♀️ panel? in the garage prob 🤔

### Turn 2 — classifier
- label: unclear (panel ask still pending; voltage chitchat)
- friendly_chitchat = true, chitchat_excerpt = "lol no clue what voltage"
- state stays AWAIT_PANEL_PHOTO

### Turn 2 — bot (AWAIT_PANEL_PHOTO self-loop, intent: ack chitchat + re-ask)
No worries on the voltage, the spec sheet has it. Garage panel works perfect. Snap a pic of it open with the breakers visible whenever you can.

### Turn 3 — customer
k can do that 📸 brb

### Turn 3 — classifier
- label: affirmative, confidence: 0.88
- state stays AWAIT_PANEL_PHOTO (waiting on photo)

### Turn 3 — bot (AWAIT_PANEL_PHOTO, brief ack)
Sounds good.

### Turn 4 — customer
[sends photo: clear panel open, breakers labeled, 200A main]

### Turn 4 — photo classifier
- subject: panel, subject_confidence: 0.96
- primary_recommendation: accept
- emit photo_received

### Turn 4 — state machine
AWAIT_PANEL_PHOTO → AWAIT_RUN

### Turn 4 — bot (AWAIT_RUN, default-install-offer)
Perfect. Key's default install puts the inlet right beside your panel with about a 20 ft cord. That work for you?

### Turn 5 — customer
yes!! beside panel works great 🙏

### Turn 5 — classifier
- label: affirmative, confidence: 0.97

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL

### Turn 5 — bot (AWAIT_EMAIL)
Awesome! Last thing, can I grab your last name, email, and confirm the install address is 245 Augusta Road, Greenville?

### Turn 6 — customer
parker, brittneyparker@icloud.com, yep that address ✅

### Turn 6 — classifier
- label: email_provided + address_confirmed
- email_typo_suspected = false

### Turn 6 — state machine
AWAIT_EMAIL → RECAP

### Turn 6 — bot (RECAP)
Got it, Brittney Parker. So Generac 7500, 30 amp 240V, install beside the panel at 245 Augusta Road. Key will pull together a quote and send it over. Sound right?

### Turn 7 — customer
yesss perfect 🎉

### Turn 7 — classifier
- label: affirmative, confidence: 0.98

### Turn 7 — state machine
RECAP → SCHEDULE_QUOTE

### Turn 7 — bot (SCHEDULE_QUOTE)
You will have the quote by tomorrow morning. Reply with any questions in the meantime.

*(phraser attempt 1 trailed with "👍" — REJECTED on `emoji_present`. Retry returned clean. fallback_used=false, phraser_retry_used=1.)*

### Turn 8 — customer
ty!! 🙏🙏

### Turn 8 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal)

### Turn 8 — bot (final)
Talk soon.

*(REJECT — `v10_talk_soon`. Retry returned: "You bet.")*

### Turn 8 — bot (final, retry)
You bet.

---

## Per-turn flag log

| Turn | State | Hard-constraint pass | Emoji check | Notes |
|---|---|---|---|---|
| 0 | GREETING | yes | clean | templated variant B |
| 1 | AWAIT_PANEL_PHOTO | yes (after retry) | rejected attempt 1 (👍), clean attempt 2 | 2-msg split |
| 2 | AWAIT_PANEL_PHOTO | yes | clean | chitchat ack |
| 3 | AWAIT_PANEL_PHOTO | yes | clean | brief ack only |
| 4 | AWAIT_RUN | yes | clean | default install offer |
| 5 | AWAIT_EMAIL | yes | clean | combined ask |
| 6 | RECAP | yes | clean | full recap |
| 7 | SCHEDULE_QUOTE | yes (after retry) | rejected attempt 1 (👍), clean attempt 2 | tomorrow-morning promise |
| 8 | COMPLETE | yes (after retry) | clean | "talk soon" caught + replaced |

---

## Auto-flags

- Reached expected terminal (COMPLETE): yes
- Phraser fallback used: 0 times (retries succeeded)
- Phraser retries triggered: 3 (2 emoji rejects, 1 talk-soon reject)
- Bot emoji emitted across full conversation: 0
- Customer emoji count: 8 (🙌 🤷‍♀️ 🤔 📸 🙏 ✅ 🎉 🙏🙏)
- Asymmetry achieved: warm but no mirroring

---

## Verdict

**PASS — zero emoji.** New `emoji_present` regex catches the model's instinct to mirror Brittney's 🙌/🙏 with a 👍. Caught twice (Turn 1, Turn 7) and replaced via retry, never reached the customer.

Conversation still felt warm: "Got it, Generac 7500." / "No worries on the voltage." / "Sounds good." / "Awesome!" / "You bet." Warmth carried by short acks, lowercase mirroring on Turn 3, and the chitchat acknowledgment on Turn 2 — not emoji.

Terminal: COMPLETE. 10 turns. No role-blur. No price leak. No weekday names. No first-person Key claims.
