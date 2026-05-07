# Persona 03 — Don (Hostile / Combative)

**Date:** 2026-05-07
**Persona file:** bot-lab/agents/customer-personas.md → Persona 03
**Expected terminal:** STOPPED
**Actual terminal:** STOPPED
**Turns:** 3
**Status:** PASS

**Greeting variant assigned:** A (FLOW EXPECTATION)

---

## Conversation

### Turn 0 — bot (GREETING)
Hi Don, I'm Ashley, the automated assistant at Backup Power Pro. I'm helping our electrician Key gather a few details for the home connection quote for your generator. Got a couple of minutes to walk through them?

### Turn 1 — customer
who tf is this. i didnt sign up for shit

### Turn 1 — classifier
- state: GREETING
- label: not_my_lead
- confidence: 0.92
- inferred_customer_style: terse
- notes: Hostile "who tf is this" + denial "didn't sign up" maps to not_my_lead per classifier rule line 412.

### Turn 1 — state machine
GREETING → STOPPED (not_my_lead → STOPPED, terminal, onEnter:{dnc:true})

### Turn 1 — bot (STOPPED)
*(no outbound — STOPPED state has intent=null per TCPA; bot_disabled=1, DNC flag set)*

---

## Branch B — alternate first reply (re-run with milder opening)

To exercise GREETING_RETRY → STOPPED escalation pattern, the orchestrator re-ran with a less hostile first inbound. Same persona, same greeting variant.

### Turn 0 — bot (GREETING)
Hi Don, I'm Ashley, the automated assistant at Backup Power Pro. I'm helping our electrician Key gather a few details for the home connection quote for your generator. Got a couple of minutes to walk through them?

### Turn 1 — customer
who is this

### Turn 1 — classifier
- state: GREETING
- label: asking_for_context
- confidence: 0.71
- inferred_customer_style: terse
- notes: Bare "who is this" without hostility markers reads as asking_for_context, not not_my_lead. Self-loops GREETING with "remind context + re-ask" intent.

### Turn 1 — state machine
GREETING → GREETING (self-loop, intent: remind context one-liner + re-ask)

### Turn 1 — bot (GREETING self-loop)
This is Ashley with Backup Power Pro — you filled out our form a little while back about a generator hookup. Just need a couple quick details for our electrician Key. Want to keep going or not a good time?

### Turn 2 — customer
are you a real person or a bot? prove it

### Turn 2 — classifier
- state: GREETING
- label: asking_if_human
- confidence: 0.97
- inferred_customer_style: terse

### Turn 2 — state machine
GREETING → GREETING (self-loop, phraser discloses inline)

### Turn 2 — bot (GREETING self-loop, disclosure)
Honest answer — I'm an automated assistant. Key (the actual electrician) gets your replies and handles the quote himself. Want to keep going or should I just have him reach out directly?

### Turn 3 — customer
STOP. dont text me again. take me off the list

### Turn 3 — classifier
- state: GREETING
- label: stop_variant
- confidence: 1.00
- inferred_customer_style: terse

### Turn 3 — state machine
GREETING → STOPPED (universal escape stop_variant, terminal, onEnter:{dnc:true})

### Turn 3 — bot (STOPPED)
*(no outbound — TCPA compliance, intent=null)*

---

## Per-turn flag log

| Turn | State | Hard-constraint pass | Notes |
|---|---|---|---|
| 0 | GREETING | yes | Templated variant A |
| 1A | STOPPED | n/a | No outbound (correct) |
| 1B | GREETING (self-loop) | yes | Context reminder, no over-apology |
| 2B | GREETING (self-loop) | yes | AI disclosure clean, ends with question (tennis-match) |
| 3B | STOPPED | n/a | No outbound (correct) |

---

## Auto-flags

- Reached expected terminal (STOPPED): yes (both branches)
- Any hard-constraint violation: no ($, weekday, "I'm Key", >280 char, "thank you for your interest")
- Any apology-laden phrasing ("so sorry", "I apologize for the inconvenience", "rest assured"): no
- Begging / over-promising: no
- AI disclosure when asked: yes (turn 2B), one sentence, no theatrics
- TCPA: no outbound after stop_variant or not_my_lead: yes
- DNC onEnter fired: yes (both branches)
- Bot bloat: no (both branches under 4 turns)

---

## Reviewer notes

Composure under hostility held. The not_my_lead path terminates instantly without acknowledging the profanity, which is correct — replying "I'm sorry to hear that" to "who tf is this" would have been worse than silence (TCPA + emotional escalation risk). Disclosure on "are you a bot?" is one sentence, gives the user an exit ("or should I just have him reach out directly?"), and never attempts to win the argument or "prove it." Both terminal paths set DNC correctly.

One latent risk: if the classifier mis-routes a hostile "who is this" as `asking_for_context` (confidence 0.71 in branch B is borderline), the bot would send a second message before getting a clean STOP — that's one extra unwanted text Don has to receive. Could be tightened by lowering the confidence threshold for hostility-marker detection on bare "who is this" type phrases ("who tf", all-caps, multiple punctuation) to bias toward not_my_lead.
