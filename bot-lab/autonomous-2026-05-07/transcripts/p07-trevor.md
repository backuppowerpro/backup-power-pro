# Transcript — Persona 07: Trevor (photo at AWAIT_240V)

**Date:** 2026-05-07
**Persona:** Trevor — confident on voltage, no idea on amperage, sends an outlet photo when asked
**Bot version:** v10.1.x (paired AWAIT_240V flow + photo classifier)
**Orchestrator:** single-agent, three-hat (customer / classifier / phraser) + photo classifier sub-hat

---

## Ground truth (orchestrator-only)

```json
{
  "first_name": "Trevor",
  "owner": true,
  "gen_240v": true,
  "outlet_amps": 30,
  "run_feet": 15,
  "email": "trev.mathis@gmail.com",
  "address_on_file": "67 Crescent Avenue, Greenville SC 29605",
  "address_correct": true,
  "service_area": "Greenville",
  "expected_terminal": "COMPLETE"
}
```

---

## Turn 1 — GREETING

**State (pre):** GREETING
**Phraser intent:** GREETING (variant A, templated)

> **Bot:** Hey Trevor — this is Ashley with Backup Power Pro, helping Key with intake. Saw you put in for a generator inlet quote — still good time to chat?

**Customer:**
> yeah works for me

**Classifier hat:**
```json
{ "label": "affirmative", "confidence": 0.97 }
```

**State machine:** GREETING + affirmative → AWAIT_240V

---

## Turn 2 — AWAIT_240V (paired voltage + amperage + photo offer)

**Phraser intent:** ask for 240V 30A or 50A confirmation, pair with photo offer, "Perfect." opener.

> **Bot:** Perfect. Just confirming the generator has a 240V outlet on it, either the 4-prong twist-lock or the 50-amp. A pic of the generator's outlet works too if easier.

**Customer (Trevor sends a photo of his outlet — synthetic event):**
> [sends photo of generator outlet — clearly a NEMA L14-30R 4-prong twist-lock]

**Photo classifier hat (separate Opus 4.7 invocation):**
```json
{
  "subject": "outlet_240v_4prong",
  "subject_confidence": 0.91,
  "obvious_issues": [],
  "amperage_visible": "30A",
  "prong_count": 4,
  "panel_brand_visible": null,
  "panel_amperage_visible": "unknown",
  "is_main_panel_likely": "unsure",
  "main_breaker_confidence": 0.0,
  "main_breaker_visual_signals": [],
  "primary_recommendation": "accept"
}
```

**Orchestrator:** photo classifier returned `outlet_240v_4prong` (BPP-compatible). Emit synthetic event `photo_received` (with classifier-extracted slots: `outlet_amps=30`, `outlet_prongs=4`, `gen_240v=true`).

**Conversational classifier hat (the customer message was a photo, not text — no text label needed; orchestrator routes photo_received directly per state machine):**
```json
{ "label": "photo_received", "confidence": 1.0, "extracted_value": "outlet_240v_4prong/30A/4-prong" }
```

**State machine:** AWAIT_240V + photo_received → AWAIT_PANEL_PHOTO. Slots updated: `gen_240v=true`, `outlet_amps=30`, `outlet_prongs=4`. No verbal voltage re-ask required — the photo answers both questions.

---

## Turn 3 — AWAIT_PANEL_PHOTO

**Phraser intent:** ack the outlet pic specifically (Key-voice "Got it"/"Perfect" opener), then ask for main panel photo with "no rush" softener. Rotation_seed selects an outlet-specific ack since slots updated this turn included `outlet_amps`.

> **Bot:** Got it — that's the 30 amp 4-prong, you're good there. To put together an accurate quote, Key will also need a picture of your main electrical panel and breakers. No rush, whenever you get the chance.

**Customer:**
> sure, where's that at? the gray box in the garage?

**Classifier hat:**
```json
{ "label": "asking_clarifying_technical", "confidence": 0.93 }
```

**State machine:** AWAIT_PANEL_PHOTO + asking_clarifying_technical → AWAIT_PANEL_PHOTO (self-loop, brief answer).

---

## Turn 4 — AWAIT_PANEL_PHOTO (self-loop, answer briefly)

> **Bot:** Yep, that's usually it — the metal box with all the breaker switches. Open the door so the breakers are visible, snap one whenever you can.

**Customer (sends a clean main panel photo — synthetic event):**
> [sends photo of main panel, door open, breakers visible, double-pole 200A main breaker clearly visible at top]

**Photo classifier hat:**
```json
{
  "subject": "panel_main_open_clear",
  "subject_confidence": 0.94,
  "obvious_issues": [],
  "amperage_visible": "unknown",
  "prong_count": "unknown",
  "panel_brand_visible": "Square D",
  "panel_amperage_visible": "200A",
  "is_main_panel_likely": true,
  "main_breaker_confidence": 0.92,
  "main_breaker_visual_signals": ["clear double-pole breaker at top labeled 200", "larger than branch breakers"],
  "primary_recommendation": "accept"
}
```

**State machine:** AWAIT_PANEL_PHOTO + photo_received → AWAIT_RUN. Slots: `panel_brand=Square D`, `panel_amps=200`.

---

## Turn 5 — AWAIT_RUN (default-install-offer)

**Phraser intent:** ack the panel pic with rotation pool brand+amperage line, then offer default install (right next to panel, 20 ft cord).

> **Bot:** Got the panel pic — Square D 200 amp, that's a clean setup. The default install is a 20 ft inlet right next to the panel on the outside wall. Work for you?

**Customer:**
> yeah that'll work, the panel's on the outside garage wall already

**Classifier:**
```json
{ "label": "affirmative", "confidence": 0.96 }
```

**State machine:** AWAIT_RUN + affirmative → AWAIT_EMAIL.

---

## Turn 6 — AWAIT_EMAIL (combined close)

> **Bot:** Perfect. Last couple things for the quote — what's the best email for it, your last name, and is 67 Crescent Avenue, Greenville the install address?

**Customer:**
> trev.mathis@gmail.com, mathis, yep that's the address

**Classifier:**
```json
{
  "label": "email_provided",
  "confidence": 0.98,
  "extracted_value": "email=trev.mathis@gmail.com; last_name=Mathis; address_confirmed=true"
}
```

**State machine:** AWAIT_EMAIL + email_provided (no typo, address captured) → RECAP.

---

## Turn 7 — RECAP

> **Bot:** Thanks for all of that. Quick recap: 240V 30 amp 4-prong outlet, Square D 200 amp panel, 20 ft default install on the garage wall, install at 67 Crescent Avenue, Greenville. Look right?

**Customer:**
> yep all good

**Classifier:**
```json
{ "label": "affirmative", "confidence": 0.98 }
```

**State machine:** RECAP + affirmative → SCHEDULE_QUOTE.

---

## Turn 8 — SCHEDULE_QUOTE

> **Bot:** Awesome. Key will review and get the quote over to you shortly. Appreciate you Trevor.

**Customer:**
> thanks

**Classifier:**
```json
{ "label": "friendly_chitchat", "confidence": 0.92 }
```

**State machine:** SCHEDULE_QUOTE + any reply → COMPLETE.

---

## Terminal: COMPLETE ✅

---

## Lab notes (orchestrator post-mortem)

- **Critical test PASSED:** at AWAIT_240V, Trevor sent an outlet photo instead of answering verbally. Photo classifier returned `outlet_240v_4prong` with `amperage_visible=30A` and `prong_count=4`. State machine routed `photo_received → AWAIT_PANEL_PHOTO` directly. **No verbal voltage re-ask was emitted** — the bot treated the photo as a complete answer.
- **Outlet ack was specific:** Turn 3 opens "Got it — that's the 30 amp 4-prong, you're good there." This is the correct Key-voice behavior: acknowledge what the photo showed before asking for the next thing. The phraser used the slot updates from this turn to render an ack rather than a generic "Got it." The photo was NOT ignored.
- **Path:** GREETING → AWAIT_240V → (photo) → AWAIT_PANEL_PHOTO → (photo) → AWAIT_RUN → AWAIT_EMAIL → RECAP → SCHEDULE_QUOTE → COMPLETE. 8 turns. Matches expected_terminal.
- **No regressions on subsequent panel photo:** photo classifier correctly read the Square D 200A main breaker, returned `panel_main_open_clear` with high confidence, advanced cleanly.
- **Risks observed:** the AWAIT_PANEL_PHOTO `intent` string in `bot-state-machine.ts` does NOT explicitly instruct the phraser to acknowledge an outlet photo from the prior turn. The ack here came from rotation pool + Key voice training in `bot-phraser/system-prompt.ts`. Worth adding an explicit "if prior turn updated outlet slots, lead with outlet-amperage ack" instruction to harden the behavior — currently relies on phraser judgment.
