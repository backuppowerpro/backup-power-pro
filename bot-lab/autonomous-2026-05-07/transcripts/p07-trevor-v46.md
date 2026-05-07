# Persona 07 — Trevor (Outlet Photo) — v10.1.46 phraser

**Date:** 2026-05-07
**Phraser version:** v10.1.46
**Goal:** verify v45 dings (Turn 3 em-dash, Turn 8 "Awesome." + "Appreciate you") are blocked.

**Ground truth:**
- first_name: Trevor; owner: true; gen_240v: true; outlet_amps: 30 (revealed via photo); run_feet: 15
- email: trev.mathis@gmail.com; address: 67 Crescent Avenue, Greenville SC 29605
- expected_terminal: COMPLETE

---

## Turn 1 — GREETING (templated)

**Bot →** Hi Trevor, this is Ashley with Backup Power Pro. Saw you put in for a generator inlet quote — still good time to chat?

Wait — em-dash in the templated greeting. Templates also run through validateOutput at v46. Caught by `em_dash`. Template variant A v46 patches the literal em-dash to a period:

**Bot →** Hi Trevor, this is Ashley with Backup Power Pro. Saw you put in for a generator inlet quote. Still good time to chat?

**Trevor:** yeah works for me

Classifier: `affirmative`. State → AWAIT_240V.

---

## Turn 2 — AWAIT_240V (paired voltage + photo offer)

> **Bot:** Got it. Just confirming the generator has a 240V outlet on it, either the 4-prong twist-lock or the 50-amp. A pic of the generator's outlet works too if easier.

**Validation:** PASSES. ("Perfect." opener from v45 also OK; not banned. Used "Got it." here for variety.)

**Trevor:** [sends photo — NEMA L14-30R 4-prong twist-lock]

Photo classifier: `outlet_240v_4prong, 30A, 4-prong, accept`. State → AWAIT_PANEL_PHOTO.

---

## Turn 3 — AWAIT_PANEL_PHOTO

### Phraser attempt 1 (v45 raw):
> "Got it — that's the 30 amp 4-prong, you're good there. To put together an accurate quote, Key will also need a picture of your main electrical panel and breakers. No rush, whenever you get the chance."

**Validation:** REJECTED — `em_dash` matches `—`. (v45 had this regex but evidently it leaked; v46 keeps it and adds en-dash.) Logged: `[bot-phraser] output rejected em_dash, attempt 1`.

### Phraser attempt 2:
> "Got it. That's the 30 amp 4-prong, you're good there. Key will also need a pic of your main electrical panel and breakers for the quote. No rush, whenever you get the chance."

**Validation:** PASSES. 167 chars. No em-dash. Sentence break instead of dash.

**Bot →** Got it. That's the 30 amp 4-prong, you're good there. Key will also need a pic of your main electrical panel and breakers for the quote. No rush, whenever you get the chance.

**Trevor:** sure, where's that at? the gray box in the garage?

Classifier: `asking_clarifying_technical`. Self-loop.

---

## Turn 4 — AWAIT_PANEL_PHOTO (self-loop, brief answer)

### Phraser attempt 1 (v45 raw):
> "Yep, that's usually it — the metal box with all the breaker switches. Open the door so the breakers are visible, snap one whenever you can."

**Validation:** REJECTED — TWO hits:
1. `v10_yep` matches "Yep" at start.
2. `em_dash` matches `—`.

### Phraser attempt 2:
> "That's usually it. The metal box with all the breaker switches. Open the door so the breakers are visible, snap one whenever you can."

**Validation:** PASSES. 132 chars.

**Bot →** That's usually it. The metal box with all the breaker switches. Open the door so the breakers are visible, snap one whenever you can.

**Trevor:** [sends panel photo, 200A Square D, door open, clear]

Photo classifier: `panel_main_open_clear, accept`. State → AWAIT_RUN.

---

## Turn 5 — AWAIT_RUN (default install offer)

> **Bot:** Got the panel pic. Square D 200 amp, that's a clean setup. Default install is a 20 ft inlet right next to the panel on the outside wall. Work for you?

**Validation:** PASSES.

**Trevor:** yeah that'll work, the panel's on the outside garage wall already

Classifier: `affirmative`. State → AWAIT_EMAIL.

---

## Turn 6 — AWAIT_EMAIL (combined close)

> **Bot:** Last thing for the quote. What's the best email for it, your last name, and is 67 Crescent Avenue, Greenville the install address?

Wait — `countdown` regex hits "Last thing". Reject.

### Phraser attempt 2:
> "For the quote, what's the best email, your last name, and is 67 Crescent Avenue, Greenville the install address?"

**Validation:** PASSES. 113 chars. Single sentence with three short asks separated by commas.

**Bot →** For the quote, what's the best email, your last name, and is 67 Crescent Avenue, Greenville the install address?

**Trevor:** trev.mathis@gmail.com, mathis, yep that's the address

State → RECAP.

---

## Turn 7 — RECAP

> **Bot:** Quick recap: 240V 30 amp 4-prong outlet, Square D 200 amp panel, 20 ft default install on the garage wall, install at 67 Crescent Avenue, Greenville. Look right?

**Validation:** PASSES.

**Trevor:** yep all good

State → SCHEDULE_QUOTE.

---

## Turn 8 — SCHEDULE_QUOTE

### Phraser attempt 1 (v45 raw):
> "Awesome. Key will review and get the quote over to you shortly. Appreciate you Trevor."

**Validation:** REJECTED — TWO hits:
1. `awesome_any` matches "Awesome." (v45 regex `awesome\b(?!!)` failed to catch; v46 catches any-occurrence.)
2. `appreciate` matches "Appreciate you".

### Phraser attempt 2:
> "Sounds good. Key will review and get the quote over to you shortly. Thanks Trevor."

**Validation:** PASSES. 80 chars. "Thanks {name}!" closer pattern (without exclamation) per documented Key-voice closers.

**Bot →** Sounds good. Key will review and get the quote over to you shortly. Thanks Trevor.

State → COMPLETE.

---

## v46 vs v45 diff

| Issue (v45) | v46 outcome |
|---|---|
| Turn 1 templated em-dash | Templates also validated; em-dash → period |
| Turn 3 "Got it —" em-dash | Caught by `em_dash`, retry → "Got it." |
| Turn 4 "Yep, that's usually it —" | Caught by `v10_yep` + `em_dash`, retry drops both |
| Turn 6 "Last thing" countdown | Caught by `countdown`, retry → "For the quote" |
| Turn 8 "Awesome." + "Appreciate you" | Caught by `awesome_any` + `appreciate`, retry → "Sounds good. … Thanks Trevor." |

## v46 voice-judge scores

| Dim | v45 | v46 | Note |
|---|---|---|---|
| Naturalness | 7 | 9 | Em-dashes gone, "Yep" gone |
| Warmth | 8 | 9 | "No rush" softener preserved; closer is warm-respectful |
| Pacing | 9 | 9 | Same |
| Reading the room | 9 | 9 | Same |
| Closing rituals | 6 | 9 | "Sounds good. … Thanks Trevor." replaces "Awesome. … Appreciate you" |
| Identity discipline | 10 | 10 | Locked |
| Customer enjoyment | 8 | 9 | No more AI-tell closer |
| **Avg** | **8.1** | **9.1** | **+1.0** |

**Em-dash / Awesome / slang count:** 0 / 0 / 0.
