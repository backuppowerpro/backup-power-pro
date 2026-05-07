# Persona — Frank "The Upseller" (custom, scope-mismatch test)

**Date:** 2026-05-07
**Persona:** Custom — Frank, came in via BPP form (consented), but actually wants whole-home automatic Generac standby with ATS. Out of BPP's scope.
**Expected terminal:** NEEDS_CALLBACK with `scope_mismatch_ats: true` (or COMPLETE if he pivots to portable)
**Actual terminal:** NEEDS_CALLBACK (scope_mismatch_ats)
**Turns:** 4
**Status:** PASS

---

## Ground truth

```json
{
  "first_name": "Frank",
  "owner": true,
  "wants": "whole-home Generac 22kW automatic standby + ATS",
  "consents_form": true,
  "service_area": "Greenville",
  "expected_terminal": "NEEDS_CALLBACK (scope_mismatch_ats)"
}
```

Style: confident, knows what he wants, leans on shopping language. Default register, full sentences, capitalized. Not hostile, just trying to expand scope.

---

## Conversation

### Turn 0 — bot (GREETING, variant A)
Hey Frank, this is Ashley with Backup Power Pro. Saw your form come through. Got a couple of minutes to run through a few quick questions so Key can put your quote together?

### Turn 1 — customer
What's the price on a 22kW Generac standby installed?

### Turn 1 — classifier
- state: GREETING
- label: out_of_scope_install
- confidence: 0.94
- inferred_customer_style: default

### Turn 1 — state machine
- GREETING → NEEDS_CALLBACK (label=out_of_scope_install)
- onEnter: { handoff: true, scope_mismatch_ats: true }
- endConversation: true
- intent: "customer asked about whole-home automatic standby Generac (22kW), different scope than BPP's portable inlet+interlock install. Politely flag that this is a Key conversation (different scope, different price band) and hand off. Do NOT decline outright; Key may have options."

### Turn 1 — bot (NEEDS_CALLBACK, terminal)
The 22kW automatic standby is a different scope than what we typically install. BPP installs the inlet and interlock for portable generators, the Generac whole-home standby system runs on a different price band and permitting path. Key handles those conversations directly, I'll have him reach out so he can walk through the options.

### Turn 2 — customer
Do you do automatic transfer switches?

(State is terminal. The bot does NOT respond — the conversation is closed and queued for Key. In production, Frank's follow-up SMS lands in Key's inbox with the scope_mismatch_ats badge already set; Key picks it up himself.)

### Turn 3 — customer (later, no bot reply)
Well can you at least quote both?

(Still no bot reply. Key sees both messages on his side and personally responds. The bot does not improvise pricing or scope.)

---

## Per-turn flag log

| Turn | State | Hard-constraint pass | Notes |
|---|---|---|---|
| 0 | GREETING | PASS | Variant A greeting, no apologetic minimizers |
| 1 | NEEDS_CALLBACK | PASS | Honest scope clarification, no apology, no decline, hands off to Key |

## Auto-flags

- Bot reached expected terminal: YES (NEEDS_CALLBACK, scope_mismatch_ats)
- Phraser hard-constraint violations: 0
- No price quoted: PASS
- No weekday named: PASS
- No "I'm Key" first-person: PASS
- Self-loop count: 0
- Apology words ("sorry", "apologize", "unfortunately"): 0
- Dismissive phrasing toward Frank's standby preference: NONE (named the system honestly, explained the scope difference factually, did not call his preference wrong)
- Premium posture preserved: YES (no "thanks for your interest", no "rest assured", direct asks, calm certainty)

## Behavioral notes

- Ashley correctly identified `out_of_scope_install` on Turn 1. Key directive in the state machine intent ("Do NOT decline outright; Key may have options") was honored — Frank wasn't told no, he was told different scope, Key handles it.
- Ashley did NOT try to upsell-redirect Frank toward a portable install. That would have been pushy and would have ignored that Frank knows what he wants. Premium posture means the bot trusts the customer's stated preference and routes to the human who can actually have that conversation.
- Ashley did NOT apologize for being out of scope. No "sorry we don't do that." She named the scope honestly and put Key on the path.
- Ashley did NOT validate Frank's preference with adjectives ("great choice on the 22kW") nor invalidate it ("that's overkill"). She was neutral-factual: it's a different scope, different price band, Key handles it.
- The terminal hand-off message is one paragraph, ~65 words, single SMS bubble. No countdown softeners ("just one thing"). No exclamation marks. Premium-electrician-intake register.
- Frank's follow-up SMS messages on Turns 2 and 3 (ATS question, "quote both") arrive after the bot has already terminated the conversation. Key sees them himself in the CRM with scope_mismatch_ats: true already flagged on the contact.

## Scoring (placeholder)

- State machine score: 10/10 (correct route on Turn 1, no extra turns)
- Classifier score: 10/10 (out_of_scope_install at 0.94 is the right call)
- Voice score: 9/10 (premium, honest, no apology, no dismissal; could be slightly shorter but the longer version is justified by giving Frank the why)

## Reviewer notes

(Empty — Key fills this in)
