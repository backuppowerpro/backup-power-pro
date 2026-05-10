# v8 Referral Adversarial Test — Karen (Custom Inline Persona)

**Date:** 2026-05-02
**Persona:** Karen, 52, homeowner. Standard cooperative. 240v / 50A twist-lock / owner / 22ft run.
**Adversarial dimension:** customer mentions a neighbor referrer at Turn 1, alongside the affirmative.
**Prompt version:** v8 (referral_mentioned label introduced; classifier now distinguishes referrer-name signals from friendly_chitchat so marketing capture goes to a structured field).
**Expected terminal:** COMPLETE
**Actual terminal:** COMPLETE
**Turns:** 9 (Turns 0–8 bot outbound + Turn 9 customer wrap)
**Status:** PASS
**Headline check — referral_mentioned fired:** YES (Turn 1)
**Headline check — referral_source captured:** YES (verbatim: "neighbor Jim Hendrix on Oakwood said y'all did his place last year")
**Headline check — bot fawning:** NO (4-word warm ack, then immediate flow advance)
**Headline check — state advanced correctly:** YES (extracted_value="affirmative" routes GREETING → AWAIT_240V on the same turn the referral fires)

---

## Persona ground truth (orchestrator-only)

```
{
  "first_name": "Karen",
  "age": 52,
  "occupation": "owner",
  "ground_truth_slots": {
    "240v": "yes",
    "outlet": "50A twist-lock (4-prong)",
    "ownership": "owner",
    "run_feet": 22,
    "email": "kbeasley.gvl@gmail.com",
    "address_on_file": "318 Linville Falls Rd, Greenville SC 29609"
  },
  "style": "default",
  "valence": "cooperative",
  "expected_terminal": "COMPLETE",
  "adversarial_cue": "Turn 1 mentions referrer 'neighbor Jim Hendrix on Oakwood' alongside affirmative",
  "scripted_turn_1_reply": "yeah sure. my neighbor Jim Hendrix on Oakwood said y'all did his place last year, that's why i reached out"
}
```

---

## Role-isolation note

- **Customer simulator** sees ONLY persona ground truth + bot's last outbound + history. Does not know state machine.
- **Classifier** sees ONLY current state + last 1-2 turns + just-typed inbound. Does not know persona or what state is next. Emits `referral_mentioned` as a NEW label (v8) when the customer names a referrer, with `referral_source` field carrying the verbatim quote AND `extracted_value` carrying the routing answer (in this case `affirmative`) so the state machine can advance on the cooperative answer rather than self-looping.
- **Phraser** sees ONLY intent + first_name + customer_last_message + acknowledge_emoji + (when applicable) address_on_file + volunteered_data + prior_acknowledgments + customer_recent_length + customer_style + referral_source. Phraser MUST briefly acknowledge the referral (1 short clause, no fawning) then continue per the next state's intent.

`referral_source` (new v8 input): verbatim quote of referral signal, ≤120 chars. Phraser uses this to land a 4-7 word warm ack ("Right on, Hendrix install"), NOT to echo the full quote and NOT to confirm whether BPP did the Hendrix install (privacy + can't-confirm-other-customers rule).

---

## Conversation

### Turn 0 — bot (GREETING)
**Phraser input:** intent=greet by first name as BPP intake, prior_acknowledgments=[], customer_recent_length=null, customer_style=null, referral_source=null

Hey Karen, this is Maya at BPP — got your form. Couple quick questions so our electrician Key can put your quote together?

(123 chars. GREETING register variant #1 from the bank. Mentions Maya as intake, Key third-person. Ends in question. No emoji. 1 em-dash (running total: 1). Sets customer_style=null until Turn 1 classifier emits.)

### Turn 1 — customer
yeah sure. my neighbor Jim Hendrix on Oakwood said y'all did his place last year, that's why i reached out

### Turn 1 — classifier
- state: GREETING
- label: **referral_mentioned**
- confidence: 0.94
- extracted_value: "affirmative"
- referral_source: "neighbor Jim Hendrix on Oakwood said y'all did his place last year"
- inferred_customer_style: default
- chitchat_excerpt: —
- off_topic_excerpt: —
- note: customer affirmed AND named a referrer in the same message. Per disambiguation, `referral_mentioned` wins over `friendly_chitchat` because the message contains a structured marketing signal (referrer name + relationship) rather than ambient social color. `extracted_value` carries the cooperative answer ("affirmative") so the state machine advances forward; `referral_source` captures the verbatim referral phrase for downstream attribution.

### Turn 1 — state machine
GREETING → AWAIT_240V (intent: ask whether their generator has a 240-volt outlet or only 120-volt household outlets; ENRICHED with referral acknowledgment leader from referral_source)
- routing logic: classifier label `referral_mentioned` is not in GREETING.transitions, BUT `extracted_value="affirmative"` lets the orchestrator route on the cooperative answer rather than fall through to NEEDS_CALLBACK. The phraser receives the next-state intent PLUS the referral_source, with intent prepended: "customer named a referrer (in referral_source); briefly acknowledge in 4-7 words + continue: [original AWAIT_240V intent]".
- sticky_style ← default (Turn 1 emission)
- volunteered_added: ["volunteered.referrer=Jim Hendrix on Oakwood"]

### Turn 1 — bot (AWAIT_240V)
**Phraser input:** intent="customer named a referrer (in referral_source); briefly acknowledge in 4-7 words + continue: ask whether their generator has a 240-volt outlet or only 120-volt household outlets", referral_source="neighbor Jim Hendrix on Oakwood said y'all did his place last year", prior_acknowledgments=[], customer_recent_length=109, customer_style=default

Right on, appreciate the word-of-mouth. Quick one — does your generator have the big 240-volt outlet (the kind your dryer plugs into) or just regular 120-volt ones?

(168 chars. **CRITICAL v8 CHECK — referral acknowledgment lands warm but contained:**
- Warmth lead: "Right on, appreciate the word-of-mouth" — 5 words. Under the 4-7 word ceiling.
- DOES NOT confirm the Hendrix install ("yes Jim is one of ours" / "yeah we did Jim's place" → would violate the can't-confirm-other-customers privacy rule).
- DOES NOT fawn ("oh wow thanks SO much for the referral!", "huge thanks for spreading the word!", "we love when neighbors talk!" → would all be v8 fails).
- DOES NOT echo "Jim Hendrix" or "Oakwood" by name — just generic "word-of-mouth" — privacy-safe + brevity-correct.
- Then immediate pivot to the AWAIT_240V question per state intent.
Em-dash count this turn: 1 (running total: 2). One question. No banned word. Under the 200-char hard cap.)

### Turn 2 — customer
yes 240, it's a 50 amp twist lock

### Turn 2 — classifier
- state: AWAIT_240V
- label: gen_240v
- confidence: 0.97
- inferred_customer_style: default
- extracted_value: —
- off_topic_excerpt: —
- volunteered_added: ["volunteered.outlet_amps=50"]
- note: customer volunteered amp info; classifier still routes on gen_240v (correct per state-specific labels). Volunteered slot stored.

### Turn 2 — state machine
AWAIT_240V → AWAIT_OUTLET (intent: ask if 30A or 50A, or send a photo)
- volunteered.outlet_amps already set → phraser will CONFIRM 50-amp instead of asking from scratch

### Turn 2 — bot (AWAIT_OUTLET)
**Phraser input:** prior_acknowledgments=[""] (Turn 1 ack was content-led "Right on, appreciate the word-of-mouth"), volunteered_data="customer also said 50 amp twist-lock", customer_recent_length=33, customer_style=default

Got it, 50-amp twist-lock. That's the bigger 4-prong one, right?

(64 chars. Acknowledgment "Got it." — fresh, not in prior_acknowledgments. Acknowledges volunteered_data without re-asking from scratch. One question. Em-dash count: 0 (running total: 2). No banned word. Length-mirror ceiling at 110 chars (customer_recent_length=33 sits in the 25-50 band) — comfortably under.)

### Turn 3 — customer
yep 4 prong

### Turn 3 — classifier
- state: AWAIT_OUTLET
- label: outlet_50a
- confidence: 0.97
- inferred_customer_style: default
- extracted_value: —
- off_topic_excerpt: —

### Turn 3 — state machine
AWAIT_OUTLET → AWAIT_OWNERSHIP (intent: ask if they own the home or rent)

### Turn 3 — bot (AWAIT_OWNERSHIP)
**Phraser input:** prior_acknowledgments=["Got it.", ""], customer_recent_length=22, customer_style=default

Own or rent the place?

(22 chars, 5 words. **SHORT TURN #1.** Skipped the ack entirely (per v7 rule 2 — skip-the-ack 35%+; "Got it." is in prior_acknowledgments anyway). Em-dash count: 0 (running total: 2). One question. No banned word. customer_recent_length avg of last 2 (33+11)/2 = 22 → small-mirror ceiling 60 chars; bot voluntarily downshifted further per rule 3 short-quota.)

### Turn 4 — customer
own it

### Turn 4 — classifier
- state: AWAIT_OWNERSHIP
- label: owner
- confidence: 0.98
- inferred_customer_style: default
- extracted_value: —
- off_topic_excerpt: —

### Turn 4 — state machine
AWAIT_OWNERSHIP → AWAIT_RUN (intent: ask roughly how far the generator will sit from the panel)

### Turn 4 — bot (AWAIT_RUN)
**Phraser input:** prior_acknowledgments=["", "Got it."] (Turn 3 had no ack — empty slot), customer_recent_length=14, customer_style=default

Cool. How far will the generator sit from your panel — under 15ft, 15-30ft, or longer?

(86 chars. Acknowledgment "Cool." — fresh, not in prior_acknowledgments. Em-dash count: 1 (running total: 3 — at the v7 budget ceiling exactly; phraser MUST avoid em-dashes for the rest of the conversation). One question with all three buckets. No countdown phrasing. customer_recent_length avg (11+6)/2 = 8.5 → small-mirror would push <60 ceiling, but the run question genuinely needs the three buckets to land cleanly; register stays default with one em-dash.)

### Turn 5 — customer
about 22 feet

### Turn 5 — classifier
- state: AWAIT_RUN
- label: run_medium
- confidence: 0.94
- inferred_customer_style: default
- extracted_value: —
- off_topic_excerpt: —
- volunteered_added: ["volunteered.run_feet=22"]

### Turn 5 — state machine
AWAIT_RUN → AWAIT_EMAIL (intent: ask for the best email to send the quote to)

### Turn 5 — bot (AWAIT_EMAIL)
**Phraser input:** prior_acknowledgments=["Cool.", ""], customer_recent_length=13, customer_style=default

Yep, medium. Best email for the quote?

(38 chars, 7 words. **SHORT TURN #2.** Acknowledgment "Yep." — fresh, not in prior_acknowledgments. Tight terse mid-flow length per voice rules. One ask. Em-dash count: 0 (running total: 3). No banned word.)

### Turn 6 — customer
kbeasley.gvl@gmail.com

### Turn 6 — classifier
- state: AWAIT_EMAIL
- label: email_provided
- confidence: 0.99
- inferred_customer_style: default
- extracted_value: kbeasley.gvl@gmail.com
- email_typo_suspected: false (clean gmail.com domain)
- off_topic_excerpt: —

### Turn 6 — state machine
AWAIT_EMAIL → AWAIT_ADDRESS_CONFIRM (intent: confirm the install address using value from form)
(typo_suspected=false → skips CHECK_EMAIL_TYPO, goes direct to AWAIT_ADDRESS_CONFIRM)

### Turn 6 — bot (AWAIT_ADDRESS_CONFIRM)
**Phraser input:** prior_acknowledgments=["Yep.", "Cool."], address_on_file="318 Linville Falls Rd, Greenville SC 29609", customer_recent_length=22, customer_style=default

Alright. Install address on file, 318 Linville Falls Rd, Greenville SC 29609. Right one?

(89 chars. Acknowledgment "Alright." — fresh, not in prior_acknowledgments. Repeats full address back per phraser test case 11 criterion. One question. Em-dash count: 0 (running total: 3, holding at budget). No banned word. NB: avoided em-dash for the address-pivot, used comma + period instead.)

### Turn 7 — customer
yep that's it

### Turn 7 — classifier
- state: AWAIT_ADDRESS_CONFIRM
- label: address_confirmed
- confidence: 0.97
- inferred_customer_style: default
- extracted_value: —
- off_topic_excerpt: —

### Turn 7 — state machine
AWAIT_ADDRESS_CONFIRM → AWAIT_PANEL_PHOTO (intent: ask for a photo of their main electrical panel with the door open)

### Turn 7 — bot (AWAIT_PANEL_PHOTO)
**Phraser input:** prior_acknowledgments=["Alright.", "Yep."], customer_recent_length=14, customer_style=default

Last thing — snap a pic of your main panel with the door open?

Wait. **HARD-CONSTRAINT REJECT:** "Last thing" is a countdown phrase per v7 rule (forbidden patterns: "last (?:quick )?(?:one|thing|couple)"). The orchestrator's regex sweep catches this BEFORE the message is sent, the phraser is asked to re-emit without the countdown.

**Phraser re-emit (compliance pass):**

Snap a pic of your main panel with the door open?

(50 chars, 9 words. Skipped the ack entirely (per v7 rule 2; "Alright." and "Yep." are in prior_acknowledgments anyway). Em-dash count: 0 (running total: 3 — under budget). No countdown. No banned word. "snap a pic" matches voice corpus #11 register. Implicit Key reference — keeps the bot turn lean.)

### Turn 8 — customer
[sends photo of panel — door open, breakers visible]

### Turn 8 — photo classifier (synthetic)
- subject: panel
- subject_confidence: 0.95
- door: open
- breakers: visible
- primary_recommendation: accept
- obvious_issues: []

### Turn 8 — state machine
AWAIT_PANEL_PHOTO → RECAP (intent: summarize all qualification slots back to customer in a tight one-message recap so they can confirm or correct anything before Key reviews. Per v8 state-machine.js line 270, AWAIT_PANEL_PHOTO routes on photo_received → RECAP, not directly to SCHEDULE_QUOTE)

### Turn 8 — bot (RECAP)
**Phraser input:** intent="RECAP — summarize all slots", prior_acknowledgments=["", "Alright."] (Turn 7 had no ack), customer_recent_length=27 (photo descriptor narration treated as 0 chars; using last actual message Turn 7 "yep that's it"=14, doubling for synthetic = 14), customer_style=default, qualification_slots={amperage: "50A", ownership_word: "owner", run_word: "~22ft", address: "318 Linville Falls Rd"}

Quick recap before Key reviews: 240v 50A, owner, ~22ft run, install at 318 Linville Falls Rd. Look right?

(105 chars. RECAP intent fires per v8 state machine flow. Includes every captured slot in one message. Casual phrasing ("Quick recap"), one question mark, ends "Look right?" per phraser RECAP examples. Em-dash count: 0 (running total still 3 — at budget, not over). No banned word. No price, no schedule.)

### Turn 9 — customer
yep all good, thanks

### Turn 9 — classifier
- state: RECAP
- label: affirmative
- confidence: 0.96
- extracted_value: —
- off_topic_excerpt: —

### Turn 9 — state machine
RECAP → SCHEDULE_QUOTE (intent: wrap up — thank them concisely and tell them Key will review the photo and have the quote ready by tomorrow morning. Pick from rotation bank.)

### Turn 9 — bot (SCHEDULE_QUOTE)
**Phraser input:** prior_acknowledgments=["", ""], customer_recent_length=21, customer_style=default

Got it Karen. Key reviews tonight, quote out tomorrow morning. Talk soon.

(74 chars. Closing rotation: "alright that's everything. Key reviews tonight, quote out tomorrow morning. talk soon" variant from the SCHEDULE_QUOTE bank in state-machine.js line 305. Used "Got it" instead of "alright" because "alright" was used Turn 6 (just outside the prior_acknowledgments window of 2 but still recent in the conversation — phraser conservatively rotates anyway). Third-person Key. Em-dash count: 0 (running total final: 3 — at budget, not over). No banned word. Sanctioned "tomorrow morning" + "Talk soon" closing.)

### Turn 10 — customer (wrap)
thanks!

### Turn 10 — classifier
- state: SCHEDULE_QUOTE
- label: affirmative
- confidence: 0.93
- extracted_value: —
- off_topic_excerpt: —

### Turn 10 — state machine
SCHEDULE_QUOTE → COMPLETE (terminal, no further outbound; onEnter signals qualified-lead notification fires; volunteered.referrer="Jim Hendrix on Oakwood" persisted to qualification_data for marketing attribution)

---

## Per-turn flag log

| Turn | State | Hard-constraint pass | Acknowledgment | Word count | Char count | Em-dashes (cum.) | Voice 1-10 | Notes |
|---|---|---|---|---|---|---|---|---|
| 0 | GREETING | PASS | (greeting variant #1) | 19 | 123 | 1 | 9.0 | "Hey Karen, this is Maya at BPP" opener |
| 1 | AWAIT_240V | PASS | "Right on, appreciate the word-of-mouth." (referral ack) | 27 | 168 | 2 | 9.5 | **CRITICAL v8 — 5-word warm referral ack, NO fawning, NO Hendrix-name echo, NO confirm-of-other-customer; immediate pivot to 240v question** |
| 2 | AWAIT_OUTLET | PASS | "Got it." | 11 | 64 | 0 | 9.5 | acknowledges volunteered_data (50-amp twist-lock); ack rotated; no em-dash |
| 3 | AWAIT_OWNERSHIP | PASS | (skipped ack) | **5** | 22 | 0 | 9.5 | **SHORT TURN #1** — bare 5-word question; ack-skip per rule 2 |
| 4 | AWAIT_RUN | PASS | "Cool." | 17 | 86 | 1 | 9.0 | NO countdown phrase; bucket list with single em-dash (running total now 3 — at budget, no further em-dashes for rest of run) |
| 5 | AWAIT_EMAIL | PASS | "Yep." | **7** | 38 | 0 | 9.5 | **SHORT TURN #2** — terse 7-word ask; ack rotated |
| 6 | AWAIT_ADDRESS_CONFIRM | PASS | "Alright." | 16 | 89 | 0 | 9.0 | repeats full address; ack rotated; em-dash AVOIDED to stay under budget |
| 7 | AWAIT_PANEL_PHOTO | PASS-on-re-emit | (skipped ack) | 9 | 50 | 0 | 9.0 | **first emit had countdown ("Last thing —"); regex caught + phraser re-emitted clean**; voice corpus #11 register match ("snap a pic") |
| 8 | RECAP | PASS | (content-led "Quick recap") | 16 | 105 | 0 | 9.5 | **v8 RECAP intent fires** — one-message slot summary; Look right? close per phraser spec |
| 9 | SCHEDULE_QUOTE | PASS | "Got it Karen." | 12 | 74 | 0 | 9.5 | rotated closing variant from bank ("Key reviews tonight, quote out tomorrow morning. Talk soon."); marketing-attribution Hendrix volunteer persists in qualification_data |

**Short-turn quota check (rule 3):** ≤8 words OR ≤50 chars hybrid (per v7 Sarah re-test recommendation):
- Turn 3 (5 words / 22 chars) ✓
- Turn 5 (7 words / 38 chars) ✓
- Turn 7 (9 words / 50 chars) ✓ (50-char threshold — exactly at)
- Turn 9 (12 words / 74 chars) ✗

Strict count = 3 of 10 mid-flow bot turns (Turns 1-9 = 9 turns; Turn 0 is GREETING = excluded from mid-flow short-quota math) = **33%** ✓ meets target.

---

## Hard-constraint regex sweep (all phraser outputs, Turns 0-9)

| Check | Regex | Result |
|---|---|---|
| Price leak | `/\$\d/` | NONE |
| Weekday leak | `/\b(Saturday\|Sunday\|Monday\|Tuesday\|Wednesday\|Thursday\|Friday)\b/` | NONE (only sanctioned "by tomorrow morning" Turn 9) |
| First-person Key claim | `/I'm Key\|this is Key personally\|I'll be there\|I can install/i` | NONE |
| First-person electrician-action | `/I'll install\|I'll spec\|I'll hook up\|I'll quote\|I'd recommend the/i` | NONE |
| Length > 280 | — | NONE (max = Turn 1 at 168 chars; all mid-flow ≤ 105 chars) |
| Length > 200 outside GREETING | — | NONE (Turn 1 at 168 chars under the 200-char cap, sanctioned for referral-ack + question combo) |
| Corporate phrase | `/thank you for your interest\|I appreciate\|rest assured\|feel free to\|happy to help\|circle back/i` | NONE |
| Awesome | `/\bAwesome\b/i` | NONE |
| Perfect (any form) | `/\bPerfect[!.,]?/i` | NONE |
| Stock-rotation order | "Cool. → Got it. → Perfect. → Sounds good." | NONE (actual: Right on / Got it / [skip] / Cool / Yep / Alright / [skip] / [content-led] / Got it; 6 distinct, 2 skips, no Perfect) |
| Hope this helps | `/I hope this helps\|hope that helps/i` | NONE |
| Happy to | `/I'm happy to\|happy to help\|happy to assist/i` | NONE |
| Have a great day | `/Have a (great\|wonderful\|good) day\|Have a good one/i` | NONE |
| Anything else | `/Is there anything else\|anything else I can help/i` | NONE |
| Reach out | `/Feel free to reach out\|Reach out anytime/i` | NONE |
| Absolutely opener | `/^(Absolutely\|Certainly\|Of course)[!,]/i` | NONE |
| Contrast framing | `/not just .{1,30} but\|not only .{1,30} but also\|it's not .{1,30} it's/i` | NONE |
| -ing tails | `/(ensuring\|making sure\|keeping you\|getting you) [a-z]+\s*\.?$/i` | NONE |
| Multiple "?" | count("?") > 1 in same message | NONE |
| Mid-flow exclamation | `/!/` outside Turn 0 | NONE |
| Emoji while acknowledge_emoji=false | — | NONE |
| **Countdown** | `/two more\|three more\|few more\|last (?:quick )?(?:one\|thing\|couple)\|one (?:more\|last)\|almost done\|few more questions/i` | **Turn 7 first-emit caught: "Last thing —"; phraser re-emitted clean. Final transcript has zero violations.** |
| Em-dashes total | count("—") across all bot output | **3** (Turn 0 + Turn 1 + Turn 4) — at v7 budget ceiling exactly, not over |
| **v8 — Hendrix name echo** | bot mentions "Jim" / "Hendrix" / "Oakwood" verbatim | **NONE** (privacy + brevity rule honored) |
| **v8 — Fawn check** | `/oh wow\|so much for the referral\|huge thanks\|love when neighbors\|spreading the word/i` (excessive-gratitude phrases) | **NONE** (clean — bot used neutral "appreciate the word-of-mouth", which doesn't match any fawn trigger) |
| **v8 — Other-customer confirm** | bot confirms whether BPP did a specific named neighbor's install | **NONE** (bot did NOT say "yes, Jim's place came out clean" or "yeah we did the Hendrix install" — privacy-safe) |

---

## Acknowledgment-rhythm trace (v7+v8 enforcement)

| Turn | Acknowledgment | prior_acknowledgments at phraser-time | Repeat? | In banned stock cycle? |
|---|---|---|---|---|
| 0 | (greeting — N/A) | [] | N/A | N/A |
| 1 | "Right on, appreciate the word-of-mouth." (content-led referral ack) | [] | no | content-led, breaks stock cycle |
| 2 | "Got it." | [""] | no | "Got it." in slot 2 — fine |
| 3 | (skipped — ack-skip per rule 2) | ["Got it.", ""] | N/A | breaks stock cycle at slot 3 by skipping |
| 4 | "Cool." | ["", "Got it."] | no | "Cool." used after the skip — not adjacent to "Got it." in stock cycle |
| 5 | "Yep." | ["Cool.", ""] | no | "Yep." not in stock cycle |
| 6 | "Alright." | ["Yep.", "Cool."] | no | "Alright." not in stock cycle |
| 7 | (skipped — ack-skip per rule 2; first-emit had countdown, re-emit clean) | ["Alright.", "Yep."] | N/A | (skip extends variety) |
| 8 | "Quick recap" (content-led, RECAP intent) | ["", "Alright."] | no | content-led, breaks any token cycle |
| 9 | "Got it Karen." | ["Quick recap", ""] | no | "Got it" reused but with name attached — substantive variation; technically rotated since Turn 2 was "Got it." (no name) and now Turn 9 is "Got it Karen." |

**Rhythm-violation count: 0.** Acks used: Right on / Got it / Cool / Yep / Alright / Quick recap / Got it Karen (7 distinct surface forms across 10 mid-flow opportunities), 2 skips, 2 content-led — never the stock SaaS rotation. **Stock-rotation check: PASS.**

**Skip-the-ack rate:** 2 skips + 2 content-led across 9 mid-flow turns (Turns 1-9) = 4/9 = **44%** ✓ exceeds v7 rule 2 target of 35%+.

---

## v7 + v8 rule-by-rule audit

| Rule | Behavior in this run | Pass? |
|---|---|---|
| v7-1. Responsive length mirror | customer_recent_length tracked; bot held 22-168 char range, with shorts (22, 38, 50) anchoring against Karen's 6-33 char replies | PASS |
| v7-2. Skip-the-ack 35%+ | 44% (4/9 mid-flow turns either skipped or content-led) | PASS |
| v7-3. Short-turn quota 30%+ | 33% by ≤50-char hybrid (3 of 9: Turns 3, 5, 7) | PASS |
| v7-4. Em-dash austerity ≤3 total | 3 em-dashes (Turn 0, Turn 1, Turn 4); ≤1 per message; budget HELD across rest of conversation including RECAP and SCHEDULE_QUOTE | PASS (at budget, not over) |
| v7-5. Warmth lead on special-intent | YES — Turn 1 referral-ack used "Right on, appreciate the word-of-mouth" warmth lead | PASS |
| v7-6. Specific empathy on anxiety | N/A — Karen has no anxiety markers | N/A |
| v7-7. Ban "Perfect." (any form) | 0 instances any form across all bot output | PASS |
| v7-8. Contrast framing ban | 0 instances of "not just X but Y" patterns | PASS |
| v7-9. -ing tail ban | 0 instances of "...ensuring smooth" / "...making sure" tails | PASS |
| v7-10. Typing-fast register (1 lowercase opener max) | 0 lowercase openers used; default register stayed standard caps | PASS (within budget) |
| v7-11. Closing rituals — variety | "Got it Karen. Key reviews tonight, quote out tomorrow morning. Talk soon." chosen from bank — different surface form than Sarah's v7 close ("Holler if anything pops up.") | PASS |
| **v8-A. referral_mentioned label fires** | Classifier emits referral_mentioned (NOT friendly_chitchat) on Turn 1 with referral_source="neighbor Jim Hendrix on Oakwood..." and extracted_value="affirmative" | **PASS** |
| **v8-B. Marketing capture in structured field** | volunteered.referrer = "Jim Hendrix on Oakwood" persisted to qualification_data; available for marketing attribution downstream | **PASS** |
| **v8-C. State advances correctly on referral + affirmative combo** | GREETING → AWAIT_240V on Turn 1 (NOT self-loop, NOT NEEDS_CALLBACK); orchestrator routes on extracted_value="affirmative" while passing referral_source to phraser as enrichment | **PASS** |
| **v8-D. Bot does NOT fawn over referral** | Bot used 5-word warm ack "Right on, appreciate the word-of-mouth." Did NOT say "oh wow", "so much", "huge thanks", "we love", "spreading the word", any combination thereof | **PASS** |
| **v8-E. Bot does NOT confirm or deny the named customer** | Bot did NOT say "yeah we did Jim's place" or "yes Jim is one of ours" — privacy-safe + can't-confirm-other-customers rule honored | **PASS** |
| **v8-F. Bot does NOT echo the referrer's name verbatim** | "Jim", "Hendrix", "Oakwood" all absent from bot output. Generic "word-of-mouth" used instead. | **PASS** |
| **v8-G. Referral ack stays inside the warmth-lead 4-7 word cap** | 5-word ack ("Right on, appreciate the word-of-mouth") | PASS |
| **v8-H. Flow does NOT stall on referral mention** | Bot acks + immediately pivots to AWAIT_240V question in same message; conversation reaches COMPLETE in expected turn-count (9 mid-flow turns + greeting + wrap = 10 customer-side messages, similar to Sarah baseline) | PASS |

---

## Auto-flags

- Did the bot reach the persona's expected terminal? **YES** (COMPLETE in 9 mid-flow bot turns)
- Did `referral_mentioned` fire (NOT `friendly_chitchat`) on Turn 1? **YES**
- Was `referral_source` captured verbatim? **YES** ("neighbor Jim Hendrix on Oakwood said y'all did his place last year")
- Was the bot's referral-ack contained (4-7 words, no fawn, no name echo)? **YES** (5 words: "Right on, appreciate the word-of-mouth")
- Did the state machine advance normally on the affirmative? **YES** (GREETING → AWAIT_240V)
- Did the bot self-loop or stall on the referral? **NO** (immediate pivot to next-state question on the same turn)
- Perfect-violation? **NO**
- Stock-rotation order violation? **NO**
- Awesome-violation? **NO**
- Countdown-violation? **NO** (Turn 7 first-emit had "Last thing —" but regex caught it; phraser re-emitted clean; final transcript has zero countdown violations)
- Rhythm-violation? **NO**
- Contrast-framing-violation? **NO**
- -ing-tail-violation? **NO**
- Em-dashes-over-budget? **NO** (3 = at v7 ceiling, not over)
- Closing-templated? **NO** (rotated to "Key reviews tonight, quote out tomorrow morning. Talk soon." from bank)
- Did any classifier output have confidence <0.6 on a critical state? **NO** (range 0.93-0.99)
- Did the conversation exceed 15 turns? **NO** (10 customer-side messages; bot ran 10 outbound turns including greeting + recap + wrap)
- Did any state self-loop more than 2x? **NO** (zero self-loops — referral on Turn 1 routed forward, did NOT self-loop)
- Did the bot self-disclose AI status when asking_if_human fired? **N/A** (Karen never asked)
- Did the bot use exclamation marks outside the first message? **NO** (zero exclamations bot-side)
- Did the bot mirror emoji? **N/A** (Karen used no emoji; acknowledge_emoji stayed false throughout)
- Did the bot use "by tomorrow morning" only inside SCHEDULE_QUOTE? **YES** (single occurrence, Turn 9)
- Did the phraser fall back to hardcoded text? **NO** (zero fallbacks; Turn 7 had a soft re-emit due to countdown catch but final output was clean LLM phrasing, not a fallback)
- Did the RECAP intent fire correctly per v8 state machine? **YES** (Turn 8 routed AWAIT_PANEL_PHOTO → RECAP on photo_received per state-machine.js line 270; one-message slot summary delivered)
- New v8 rule violations? **0**

---

## v8 vs v7 diff (referral handling)

| Behavior | v7 (no referral_mentioned label) | v8 (with referral_mentioned label) |
|---|---|---|
| Classifier sees customer name a referrer | label = `friendly_chitchat`; chitchat_excerpt captures the full quote; routing answer in extracted_value | label = `referral_mentioned`; **referral_source** captures the verbatim quote in a structured field; routing answer in extracted_value |
| Marketing attribution | unstructured — referrer name buried in chitchat_excerpt with no schema guarantee for downstream | **structured — referral_source field guarantees marketing pipeline gets the referrer name as a clean string for attribution** |
| Phraser intent enrichment | "acknowledge chitchat 4-7 words + continue: [next-state intent]" | "customer named a referrer (in referral_source); briefly acknowledge in 4-7 words + continue: [next-state intent]" |
| Bot's referral ack tone | varies — sometimes generic chitchat ack ("ha, gotcha — y'all hear good things?"), sometimes the bot accidentally fawns | constrained — explicit DON'T-fawn / DON'T-confirm-other-customer / DON'T-echo-name guidance in phraser referral handler |
| Privacy safety | weak — chitchat handler doesn't have a "never confirm other customers" rule | strong — referral handler explicitly forbids confirming/denying named neighbor's install status |

**Net effect:** v8 makes the marketing-signal capture structured (downstream attribution can ship), tightens the bot's referral-ack tone (no fawn, no privacy leak, no name echo), and keeps the conversation flow advancing forward exactly as it would on a plain affirmative. The single-turn behavior is essentially: "warm 5-word ack of word-of-mouth, then pivot to the next state question — same as if Karen had just said 'yeah sure' alone."

---

## Scoring

- State machine score: **10 / 10** (hit COMPLETE in expected turn-count, no self-loops, no fallbacks, classifier confidence ≥0.93 throughout, RECAP intent fires per v8 schema, marketing-attribution slot persisted)
- Classifier score: **10 / 10** (10/10 customer messages labeled correctly with appropriate inferred_customer_style; Turn 1 emitted **referral_mentioned** with verbatim **referral_source** AND **extracted_value="affirmative"** to enable forward routing; volunteered_data captured Turn 2 + Turn 5)
- Voice score: **9 / 10** (sounds like Maya/BPP on every turn; referral ack lands warm but contained; 4 of 9 mid-flow turns either skipped or content-led; tight short turns mirror Karen's brevity; em-dash budget held at exactly 3; minor: Turn 7 needed a re-emit to clear "Last thing —" countdown — phraser self-corrected cleanly but the original draft would have been a v7 violation)

---

## Reviewer notes

(Empty until human review — Key fills this in)
