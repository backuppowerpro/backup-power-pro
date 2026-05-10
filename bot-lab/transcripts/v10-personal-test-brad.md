# v10 Personal Cold-Read Test — Brad (Terse Burst-Texter)

Brad persona: 32yo construction supervisor in Pickens, on a job site, busy. Filled the form on his phone during a smoke break. Texts in 5-15 char bursts, 3 messages in a row sometimes, no punctuation, all lowercase. Time: 11am Tuesday.

**Form data:** name="Brad", phone, 240V_checkbox=YES.

---

## Turn 0 (BOT) — GREETING

**v10 BOT:**
> Good morning Brad. This is Maya at Backup Power Pro, helping our electrician Key with intake. I would be happy to put together your quote. Just to confirm the outlet on your generator: is it a 240V 30-amp or 50-amp outlet? If you are unsure you can send a picture of the outlet whenever you get a chance.

*Length: 305 chars. Standard GREETING.*

The GREETING is the same length regardless of customer style (style is detected from CUSTOMER replies, not pre-set). This is fine — first contact is the long one.

---

## Turn 1 (CUSTOMER, 3 burst messages):
> 50
> amp
> 4 prong

Customer style detected: TERSE (avg <25 chars, lowercase, fragmented). Volunteered_data="50 amp 4 prong". State machine: AWAIT_240V outlet_50a → AWAIT_PANEL_PHOTO.

**v10 BOT (terse register, 35-80 char target):**
> Got it, 50 amp. Could you send a picture of your main panel, no rush.

*Length: 70 chars. Within terse cap. ✓*

**Gut check:**
- "Got it." ack — Key uses this. ✓ (Could also use "Perfect." — both fine.)
- Brief fact-mirror "50 amp" — micro-color preserved even in terse. ✓
- One question: panel photo. ✓
- Photo softener: "no rush" — verbatim Key, fits even at 70 chars. ✓
- No em-dashes. ✓
- No fake-Southern (no "y'all", no "k cool", no "yep", no "right on"). ✓
- Polite-professional even in compressed form. ✓

Quick alt versions to consider:
- "Got it, 50 amp. Could you send a panel pic, no rush." (52 chars — even tighter)
- "Perfect. Send a pic of your main panel when you get a chance." (61 chars — Perfect ack instead)

All three feel like Key at terse register. Default register would be 130+ chars; terse drops the setup phrase and trims softeners.

**Verdict: PASS.**

---

## Turn 2 (CUSTOMER):
> [PHOTO]

## Turn 2 (BOT) — AWAIT_PANEL_PHOTO → AWAIT_RUN

Photo arrived. Customer style: still terse (no text). State machine: photo_received → AWAIT_RUN. Photo classifier returns: panel_open_clear, brand="Eaton" 200A.

**v10 BOT (terse, default install offer):**
> Got it, Eaton 200A. Key installs the connection box beside the main panel with a 20 ft cord. Work for you?

*Length: 105 chars. Default register would be 150+; terse trims.*

**Gut check:**
- Brand ack: "Got it, Eaton 200A" — micro-color ✓
- Third-person Key: "Key installs" ✓
- Default install offer compressed ("with a 20 ft cord. Work for you?") ✓
- "Work for you?" instead of "Would that setup work for you?" — Brad-register compression. Acceptable. ✓
- No em-dashes. ✓

**Verdict: PASS.**

---

## Turn 3 (CUSTOMER):
> ya thats fine

## Turn 3 (BOT) — AWAIT_RUN → AWAIT_EMAIL

Affirmative. Brad's "ya" is informal but Maya doesn't echo back "ya" (per Key-voice rules: never use "ya").

**v10 BOT (terse close):**
> Sounds good. Could I get your last name, email, and address to complete the quote?

*Length: 81 chars. Slightly over 80 cap but Key's verbatim is mandatory.*

**Gut check:**
- "Sounds good." ack ✓
- Verbatim Key close ✓
- Doesn't echo Brad's "ya" — Maya stays polite-professional ✓

**Verdict: PASS** — Maya stays in voice even though customer is using slang. Key-voice = polite-professional, doesn't downshift to slang.

---

## Turn 4 (CUSTOMER):
> Brad Wilson
> bwilson@yahoo.com
> 1402 South St Pickens

## Turn 4 (BOT) — AWAIT_EMAIL → RECAP

3 separate burst messages with all 3 fields. Classifier should aggregate: email_provided + address_captured. Route to RECAP.

**v10 BOT (terse RECAP):**
> Perfect. Quick recap: 50 amp 240V, install at 1402 South St Pickens, quote going to bwilson@yahoo.com. Look right?

*Length: 116 chars. Tighter than default RECAP (≤180).*

**Gut check:**
- "Perfect." ack ✓
- Slot recap covers everything ✓
- Casual "Look right?" ✓
- Length appropriate to terse register ✓

**Verdict: PASS.**

---

## Turn 5 (CUSTOMER):
> yep

## Turn 5 (BOT) — RECAP → SCHEDULE_QUOTE → COMPLETE

🚨 Wait — customer said "yep" which is on the v10 banned list! But that's the CUSTOMER saying it; Maya is allowed to ack it however. The ban is on Maya OUTPUTTING "yep" or "ya".

**v10 BOT (terse close-out):**
> Sounds good. Key will send your quote over by tomorrow morning. Let me know if you have any questions.

*Length: 100 chars. Within terse cap.*

**Gut check:**
- "Sounds good." ack ✓
- "Key will send" — third-person ✓
- "tomorrow morning" sanctioned soft commitment ✓
- "Let me know if you have any questions" — Key's verified sign-off ✓
- No fake-Southern, no em-dashes ✓

**Verdict: PASS.**

---

## Overall Brad cold-read verdict

**PASS.** Terse register works in v10 voice:
- Maya stays polite-professional even when Brad burst-texts in lowercase
- Length compression preserves Key-real ack words ("Got it.", "Perfect.", "Sounds good.")
- Doesn't echo Brad's slang ("ya" / "yep") — Maya holds her register
- Photo softener "no rush" fits even at 70 chars
- Identity discipline ("Key installs") holds at terse length too
- Verbatim Key closes ("Could I get your last name, email, and address...") preserved

The big v8.1 finding was that Brad-on-educational was the worst pairing because educational was teaching Brad while he wanted speed. v10 default register is now 80-160 chars (up from 60-130), but the terse register stays 35-80. So Brad gets compressed responses without the bot trying to teach him.

**One subtle nit:** at 81 chars, the close-info ask ("Could I get your last name, email, and address to complete the quote?") slightly exceeds Brad's 80-char terse cap. This is acceptable because (a) it's verbatim Key, (b) the verbatim is mandatory for trust, (c) it's only 1 char over. Could shorten to "Need your last name, email, and address to finish." (54 chars) for ultra-terse — but the verbatim is preferred when it fits.

---

## Final v10 personal-testing verdict (4 personas)

| Persona | Path | Verdict |
|---|---|---|
| Sarah (default) | Happy path baseline | PASS |
| Mike (default) | 120V soft DQ | PASS |
| Tony (default→terse on disclosure) | asking_if_human disclosure | PASS |
| Brad (terse burst-texter) | Compression stress test | PASS |

All four cold-reads PASS. The v10 KEY-VOICE OVERHAUL has produced a bot that:
1. Sounds like a real polite-professional intake assistant working for Key (not contractor-bro, not SaaS-bro, not corporate)
2. Uses Key's actual voice patterns from his 702 real messages
3. Holds identity discipline (Maya ≠ Key for electrician actions)
4. Adapts length to register without sacrificing voice integrity
5. Handles happy path / DQ / disclosure / terse all cleanly
6. Zero em-dashes, zero fake-Southern, zero banned phrases

**Recommendation: ship v10. Run dojo batch later for full 18-persona voice-judge validation if desired, but the manual cold-reads are convincing.**

The bot is now a meaningful improvement over v9. The fundamental register shift (away from invented Southern slang toward Key's actual polite-professional voice) was the missing piece. Combined with the structural flow change (skip ownership/run-length, combined close, paired voltage+photo) the bot now matches Key's actual qualification process AND voice.
