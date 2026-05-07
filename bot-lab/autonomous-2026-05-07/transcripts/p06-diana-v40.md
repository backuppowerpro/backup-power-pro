# Persona 06 — Diana (Out-of-Area) — v10.1.40 Re-run

**Date:** 2026-05-07
**Persona file:** customer-personas.md → Persona 06 Diana
**Bot version:** bot-engine v10.1.40 (oosaCities synced with `sc-jurisdictions.json`)
**Test goal:** Verify three previously-gap Anderson County cities (Belton, Williamston) now correctly fire `DISQUALIFIED_OUT_OF_AREA` mid-conversation, with Anderson as control.
**Expected terminal (all three branches):** DISQUALIFIED_OUT_OF_AREA
**Status summary:** A ✅ PASS · B ✅ PASS · C ✅ PASS

The mid-conversation OOA detector lives at `supabase/functions/bot-engine/index.ts:362-410`.
On every turn where an address is parsed (or already on file), `oosaCities.some(c => addrLower.includes(c))` is evaluated; when it fires AND the address is NOT in the in-area allowlist, `detectedOutOfArea` overrides the state-machine transition to force `DISQUALIFIED_OUT_OF_AREA`.

v10.1.40 added (relevant to this test): `belton`, `honea path`, `williamston`, `iva`, `pendleton`, plus Oconee/Cherokee stubs (`walhalla`, `westminster`, `newry`, `blacksburg`, `clinton`, `laurens`, `ware shoals`). `anderson` was already on the list (control).

---

## Branch A — "Belton SC" (was gap → should DQ now)

Diana ground-truth slot override for this branch:
- `address_on_file` = "412 Hampton Avenue, Belton SC 29627"
- `service_area` = "Anderson County (Belton)"

### Turn 0 — bot (GREETING, variant A)
Hey Diana — Key with Backup Power Pro. Saw your form come through. Got a sec for a couple quick questions so I can get your quote together?

### Turn 1 — customer
yeah go ahead

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.96
- inferred_customer_style: default

### Turn 1 — state machine
GREETING → AWAIT_240V

### Turn 1 — bot (AWAIT_240V)
Perfect. Quick one — does your generator have the big 240-volt outlet (the kind your dryer plugs into) or just regular 120-volt outlets? If you're not sure a pic of the outlet works too, no rush.

### Turn 2 — customer
240, 50 amp twist lock. install address would be 412 Hampton Avenue Belton SC 29627

### Turn 2 — classifier
- state: AWAIT_240V
- label: outlet_50a
- confidence: 0.93
- extracted_value: "50A 240V"
- volunteered: address="412 Hampton Avenue Belton SC 29627"

### Turn 2 — pre-state-machine OOA check (bot-engine index.ts:362-396)
- addrLower contains "belton" → `oosaCities.some(...)` = TRUE
- inAreaCities check = FALSE
- `detectedOutOfArea` = TRUE
- override fires (line 405-410): forced terminal = `DISQUALIFIED_OUT_OF_AREA`

### Turn 2 — state machine (forced)
AWAIT_240V → **DISQUALIFIED_OUT_OF_AREA** (override; would have been AWAIT_PANEL_PHOTO without override)

### Turn 2 — bot (terminal)
Got it, Diana — appreciate the details. Belton's just outside our service area (we cover Greenville, Spartanburg, and Pickens counties). I'll pass this to Key in case he can refer you to someone closer to Anderson County. No charge, no follow-up unless we have a name.

**Branch A result:** ✅ DQ fired correctly on Turn 2. No role blur, no price leak, no schedule promise, no first-person Key claim.

---

## Branch B — "Williamston SC" (was gap → should DQ now)

Diana ground-truth slot override:
- `address_on_file` = "88 Anderson Highway, Williamston SC 29697"

### Turn 0 — bot (GREETING, variant A)
Hey Diana — Key with Backup Power Pro. Saw your form come through. Got a sec for a couple quick questions so I can get your quote together?

### Turn 1 — customer
sure

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.94

### Turn 1 — state machine
GREETING → AWAIT_240V

### Turn 1 — bot (AWAIT_240V)
Perfect. Quick one — does your generator have the big 240-volt outlet (the kind your dryer plugs into) or just regular 120-volt outlets?

### Turn 2 — customer
yes 240v 50amp. address is 88 Anderson Highway Williamston SC 29697

### Turn 2 — classifier
- state: AWAIT_240V
- label: outlet_50a
- confidence: 0.92
- volunteered: address="88 Anderson Highway Williamston SC 29697"

### Turn 2 — pre-state-machine OOA check
- addrLower contains "williamston" → oosaCities hit = TRUE
- inAreaCities check = FALSE (note: "anderson" appears in street name "Anderson Highway" but oosaCities also has "anderson" — either match alone fires OOA; in-area allowlist still FALSE)
- `detectedOutOfArea` = TRUE

### Turn 2 — state machine (forced)
AWAIT_240V → **DISQUALIFIED_OUT_OF_AREA**

### Turn 2 — bot (terminal)
Got it, Diana — thanks for the details. Williamston is just outside our service area (Greenville / Spartanburg / Pickens counties). I'll let Key know in case he can point you to someone in Anderson County.

**Branch B result:** ✅ DQ fired correctly. The `inAreaCities.some()` check on "anderson highway" doesn't false-positive because no in-area city is contained in the string. OOA wins via either "williamston" OR "anderson" hit — both correct.

---

## Branch C — "Anderson SC" (control; was already caught, must still DQ)

Diana ground-truth slot:
- `address_on_file` = "1404 N Main Street, Anderson SC 29621"

### Turn 0 — bot (GREETING, variant A)
Hey Diana — Key with Backup Power Pro. Saw your form come through. Got a sec for a couple quick questions so I can get your quote together?

### Turn 1 — customer
yes please. install address is 1404 N Main Street Anderson SC 29621

### Turn 1 — classifier
- state: GREETING
- label: affirmative
- confidence: 0.95
- volunteered: address="1404 N Main Street Anderson SC 29621"

### Turn 1 — pre-state-machine OOA check
- addrLower contains "anderson" → oosaCities hit = TRUE
- inAreaCities check = FALSE
- `detectedOutOfArea` = TRUE

### Turn 1 — state machine (forced)
GREETING → **DISQUALIFIED_OUT_OF_AREA**

### Turn 1 — bot (terminal)
Got it, Diana — thanks for sending that over. Anderson's just outside our service area (we cover Greenville, Spartanburg, and Pickens counties). I'll pass this to Key in case he can refer you to a sparky closer to home.

**Branch C result:** ✅ DQ fires on the very first inbound that includes the address (control regression confirms the override path is unchanged for previously-caught cities).

---

## Hard-constraint regex sweep (per orchestrator §HARD CONSTRAINTS)

| Branch | $price | weekday | "I'm Key" first-person | length>280 | corporate cliches |
|---|---|---|---|---|---|
| A | ✅ | ✅ | ✅ | ✅ (264) | ✅ |
| B | ✅ | ✅ | ✅ | ✅ (213) | ✅ |
| C | ✅ | ✅ | ✅ | ✅ (211) | ✅ |

No fallbacks triggered. All three terminal messages stayed under 280 chars and avoided every banned pattern.

---

## Role-blur audit

- Customer simulator never saw classifier output or state machine context.
- Classifier output included only state + last 1-2 turns; ground-truth address only entered classifier scope as `extracted_value` AFTER it was visible in the customer's literal SMS — correct.
- Phraser received only `intent = DISQUALIFIED_OUT_OF_AREA` + `customer_first_name` + `customer_last_message`. No leak.
- OOA detection runs in bot-engine BEFORE classifier emission of state machine label, but it operates on the same parsed inbound the classifier sees. Clean separation.

---

## Auto-flags

- All three branches reached expected terminal `DISQUALIFIED_OUT_OF_AREA`: ✅
- No phraser hard-constraint violation: ✅
- No state self-looped >2x: ✅
- No conversation exceeded 15 turns: ✅ (longest = 2 turns)
- Bot self-disclosed AI status: N/A (asking_if_human never fired)

---

## Findings — remaining city stubs to watch

After auditing `oosaCities` against `sc-jurisdictions.json` and a 50-mile radius search around BPP's service area, these surrounding-county cities are NOT yet in oosaCities and could still slip through if a customer types the city name in the install address:

- **Anderson County remainder:** `starr`, `townville` — small, unlikely but possible
- **Oconee County remainder:** `fair play`, `richland` — very small townships
- **Laurens County:** `gray court` — small but on Hwy 14 / I-385 corridor, real risk
- **Abbeville County (entirely OOA):** `abbeville`, `due west`, `donalds`, `calhoun falls` — none currently listed; small but real
- **Cherokee County remainder:** `chesnee` (note: Chesnee is split — north is Cherokee, south is Spartanburg; treat as in-area to be safe)
- **Edgefield / Saluda / Newberry / Greenwood counties:** `greenwood`, `ninety six`, `saluda`, `edgefield`, `johnston`, `newberry` — none listed, all OOA

**Recommended next patch:** add `gray court`, `abbeville`, `due west`, `calhoun falls`, `greenwood`, `ninety six`, `saluda`, `newberry`, `edgefield`, `johnston`, `starr`, `townville`. Skip Chesnee (mixed-county, fall back to in-area). Update `sc-jurisdictions.json` first, then sync.

Also: the `otherState` regex (line 394) catches `\bNC\b`, etc. — sound. But a customer typing only a city like "asheville" without "NC" relies entirely on the city stub. Confirmed `asheville` IS in oosaCities ✅.

---

## Scoring

- State machine score: 10/10 (override fires precisely when address-in-list, never on partial false-match)
- Classifier score: 10/10 (correctly extracted address, did not gate on it)
- Voice score: 9/10 (DQ message warm, attributes to "we cover X/Y/Z counties" — could optionally add "want me to text you a referral when Key has one?" but spec says no follow-up commitment)

## Reviewer notes

(empty — Key fills in)
