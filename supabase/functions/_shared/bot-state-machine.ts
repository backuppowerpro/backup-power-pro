// supabase/functions/_shared/bot-state-machine.ts
// Pure deterministic state machine for the BPP qualification bot.
// Ported verbatim from bot-lab/state-machine.js (v10.1.x). No LLM dependency.
//
// Public API:
//   transition(currentState, classifierLabel, ctx) => { next, intent, fallback, endConversation, onEnter? }
//   getStateMeta(state)
//   listStates()
//   INITIAL_STATE
//   STATES   (for advanced inspection)
//
// Note: types use loose `any` for the ctx-shaped objects to match the lab
// JS implementation 1:1. Tightening these is safe-but-out-of-scope.

// deno-lint-ignore-file no-explicit-any

export const INITIAL_STATE: string = 'GREETING';

// Tiny string helpers used by special-case fallback rewrites.
function capFirst(s: any): any { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function lcFirst(s: any): any { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

// Map of which slot each state is asking about. Used by amending_prior_answer
// to rewind to the right state.
const SLOT_TO_STATE: Record<string, string> = {
  '240v': 'AWAIT_240V',
  'outlet': 'AWAIT_OUTLET',
  'ownership': 'AWAIT_OWNERSHIP',
  'run': 'AWAIT_RUN',
  'email': 'AWAIT_EMAIL',
  'address': 'AWAIT_ADDRESS_CONFIRM',
};

// Every state's transition table + intent + hardcoded fallback message.
// The fallback message is what the bot sends if the LLM phraser fails.
// The intent string is what's passed to the phraser to write the LLM
// version. The phraser NEVER sees prices, schedules, or commitments.
const STATES: Record<string, any> = {
  GREETING: {
    // v10 KEY-VOICE PATTERN: time-of-day greeting + "I would be happy to..."
    // + ask if they have a generator. Verbatim Key opener (8+ near-identical):
    // "Good [time]. I would be happy to get you a quote for a generator
    // connection. Can I ask if you already have a generator or are you looking
    // to get one soon? - Key G."
    //
    // EXP-008 GREETING VARIANTS (added 2026-05-03 per Key's directive): when
    // ctx.greeting_variant is set ('A'|'B'|'C'|'D'), fallback returns the
    // pre-made variant message. When unset (lab/test mode without experiment
    // wiring), defaults to variant A. Bot-engine assigns the variant via
    // sha256(contact_id) before calling this state. Full spec at
    // bot-lab/experimentation/greeting-variants.md.
    intent: 'KEY-VOICE: time-of-day greeting (Good morning/afternoon/evening per time_of_day_bucket), identify as Ashley at Backup Power Pro intake helping Key, use "I would be happy to" as the offer phrase. If form already pre-confirmed they have a generator, skip "do you have a generator" and go straight to voltage/amp confirmation paired with photo offer. Otherwise, ask if they already have a generator or are looking to get one. NEVER use "Hey [name]!" alone (too casual). NEVER duplicate the Quo auto-reply\'s "thanks for filling out the form" — that already fired. NOTE: in production, the GREETING is templated (not LLM-generated) and selected via ctx.greeting_variant per EXP-008. The phraser is not normally called for GREETING in v10.1.',
    fallback: ({ first_name, greeting_variant, time_of_day_bucket }) => {
      const name = first_name || 'there';
      const variant = greeting_variant || 'A';
      // v10.1.12 — time-of-day awareness. When the form fires after 9pm
      // local, the bot opens with "I know it's late, no rush, tomorrow
      // morning works as well" instead of pushing the customer to engage
      // immediately. Verbatim Key pattern from real corpus.
      const lateNight = time_of_day_bucket === 'late' || time_of_day_bucket === 'evening_late';
      const lateNightSuffix = lateNight ? ` I know it's late, no rush, tomorrow works as well if easier.` : '';

      // EXP-008 GREETING VARIANTS v3 (per Key feedback 2026-05-03 round 2).
      // The lead form REQUIRES the 240V checkbox to be checked to submit
      // (Key confirmed). So every incoming lead has form_240v_confirmed=true.
      // No need for a pre-form branch.
      //
      // ALL variants meet Key's three criteria:
      //   1. Ashley named prominently as the speaker (first ~16 chars)
      //   2. Warm and inviting (not robotic, not transactional)
      //   3. Ends with an EASY but ENGAGING question
      // Plus:
      //   - Ashley never claims to give the quote (Key's role)
      //   - Never promises "one quick question" (there are several)
      //   - "generator install" framing avoided (we install home connections,
      //     not generators) — except in variant A which Key approved as-is
      //   - Whenever Key is mentioned, his role as electrician is clarified
      //     ("our electrician Key" not just "Key")
      switch (variant) {
        case 'B':
          // HUMAN-ANCHOR — Key named explicitly as the electrician handling
          // the quote and install personally. (Phone number removed per Key
          // feedback — phone in greeting can read as cold-call selling.)
          return `Hi ${name}, I'm Ashley, the automated assistant at Backup Power Pro intake. Our electrician Key handles your quote and install personally. I'll just gather a few details for him. Mind if I ask a couple things?`;

        case 'C':
          // FORM-FILL WARMTH — gratitude lead with "home connection for your
          // portable generator" framing per Key (we install the home-side
          // connection, not the generator itself). Clarifies Key as "our
          // electrician Key" so customer knows his role. Adds "to provide
          // an accurate quote" so the WHY of the questions is upfront — per
          // trust-research delta on stating the why before asking.
          return `Hi ${name}, I'm Ashley, the automated assistant at Backup Power Pro. Thanks for reaching out about a home connection for your portable generator. Happy to help get this rolling. Got a few minutes to walk through what our electrician Key needs to provide an accurate quote?`;

        case 'D':
          // DIRECT CONVERSATIONAL — fixed: "home connection set up for your
          // portable generator" framing + asks for make and model (useful
          // for Key, who looks up specs online — verified pattern in his
          // 702-message OpenPhone corpus). Size isn't what we care about
          // (per Key 2026-05-03); make/model is.
          return `Hi ${name}, I'm Ashley, the automated assistant at Backup Power Pro. Happy to help get a home connection set up for your portable generator. To get our electrician Key started: do you happen to have the make and model handy?`;

        case 'A':
        default:
          // FLOW EXPECTATION. v10.1.11 (2026-05-03): "your generator install
          // quote" was misleading — BPP does NOT install generators; we install
          // the home-side connection (inlet + interlock) that lets the
          // customer's portable generator power their home during outages.
          // Corrected to "home connection quote for your generator" matching
          // the same framing as variants C and D.
          return `Hi ${name}, I'm Ashley, the automated assistant at Backup Power Pro. I'm helping our electrician Key gather a few details for the home connection quote for your generator. Got a couple of minutes to walk through them?${lateNightSuffix}`;
      }
    },
    transitions: {
      affirmative: 'AWAIT_240V',
      answered_with_impatience: 'AWAIT_240V',  // they said yes + are in a hurry
      negative: 'POSTPONED',
      asking_for_human: 'NEEDS_CALLBACK',
      asking_if_human: 'GREETING',  // self-loop, phraser handles disclosure inline
      asking_for_context: 'GREETING',  // self-loop with intent "remind context + re-ask"
      asking_clarifying_technical: 'GREETING',  // self-loop, answer briefly + re-ask
      friendly_chitchat: 'GREETING',  // self-loop with intent "acknowledge chitchat + re-ask"
      // v10.1.6 (2026-05-03 brutal-test fix): GREETING variant D explicitly
      // asks "do you have the make and model handy?" — customer answers
      // with a brand+model. Orchestrator runs generator-lookup, then
      // emits the lookup-aware label below. Without these transitions
      // the bot dumped to NEEDS_CALLBACK on every variant-D answer.
      gen_240v: 'AWAIT_PANEL_PHOTO',  // lookup matched compatible; voltage_known=true (orchestrator), skip voltage check
      gen_120v: 'DISQUALIFIED_120V',  // lookup matched 120V-only → soft DQ with brand named
      gen_unsure: 'AWAIT_240V',       // lookup voltage_selector_check or no_match → fall through to voltage check
      outlet_30a_4prong: 'AWAIT_PANEL_PHOTO',  // customer volunteered amp on first turn
      outlet_50a: 'AWAIT_PANEL_PHOTO',
      outlet_unknown: 'AWAIT_OUTLET',  // v10.1.10: lookup compatible_either → customer picks 30 vs 50
      outlet_30a_unspecified: 'AWAIT_240V_RETRY',
      outlet_30a: 'AWAIT_240V_RETRY',
      photo_received: 'AWAIT_PANEL_PHOTO',
      stop_variant: 'STOPPED',
      not_my_lead: 'STOPPED',
      // Renter volunteered at greeting → DQ
      renter: 'DISQUALIFIED_RENTER',
      unclear: 'GREETING_RETRY',
    },
  },

  GREETING_RETRY: {
    intent: 'KEY-VOICE: gently re-ask the original GREETING question (do you already have a generator or looking to get one) with a softer framing. No "y\'all" / "holler" / casual slang. Polite-professional tone.',
    fallback: () => `No problem. Just to confirm, do you already have a generator or are you looking to get one soon?`,
    transitions: {
      affirmative: 'AWAIT_240V',
      negative: 'POSTPONED',
      asking_for_human: 'NEEDS_CALLBACK',
      stop_variant: 'STOPPED',
      unclear: 'NEEDS_CALLBACK',
    },
  },

  AWAIT_240V: {
    // v10 KEY-PATTERN: pair voltage check + amperage + photo offer in ONE
    // message (verified verbatim Key 8+ times). Don't split voltage and
    // amperage into separate states; ask for both with photo escape valve.
    //
    // v10.1.4 (2026-05-03): 30A AMBIGUITY FIX. Some generators have a 30A
    // outlet that is 120V-only (NEMA TT-30R RV-style or NEMA L5-30R
    // 120V locking) — NOT compatible with BPP install. The phrase "30 amp"
    // alone does NOT confirm BPP-compatible. Voltage AND prong count
    // matter:
    //   - L14-30R = 30A 240V 4-prong locking → COMPATIBLE
    //   - TT-30R  = 30A 120V 3-prong RV outlet → NOT compatible (120V only)
    //   - L5-30R  = 30A 120V 3-prong locking → NOT compatible (120V only)
    // The phraser asks "240V 30 amp or 50 amp" explicitly per Key's
    // verbatim corpus, but if customer answers "30 amp" without volume
    // qualifier, classifier emits outlet_30a_unspecified and the bot
    // re-confirms voltage/prong count. Photo path remains the cleanest
    // resolution.
    //
    // v10.1.2 (2026-05-03): GENERATOR-SPEC LOOKUP integration.
    // If customer's previous message captured brand+model (e.g., variant D
    // GREETING asks "make and model" and customer answered), the
    // orchestrator runs generator-lookup.js BEFORE this state fires:
    //   - lookup → known 120V_only → route to DISQUALIFIED_120V immediately
    //     (skip the voltage check; bot already knows the answer)
    //   - lookup → known 240V_compatible → flag voltage_known=true,
    //     route to AWAIT_OUTLET or AWAIT_PANEL_PHOTO directly (skip CLARIFY)
    //   - lookup → voltage_selector_check (Honda EU7000iS) → flag
    //     voltage_pending=true, fire normal voltage check but Key alerts
    //   - lookup → unknown / brand-only → fire normal voltage check
    intent: 'KEY-VOICE PATTERN: ask for confirmation that the generator has a 240V 30-amp or 50-amp outlet, AND offer the photo path in the SAME message. Verbatim Key example: "Perfect. I just wanted to confirm that it has a 240 volt 30 amp or 50 amp outlet on it. If you are unsure you can send a picture of the outlets whenever you get a chance." Use "Perfect." as the opener since the customer just said "yes" or similar to the GREETING. Add brief context if needed but DO NOT split off the photo offer into a separate turn — Key always pairs them. NOTE: orchestrator may have already done generator-spec lookup; if voltage_known=true via lookup, this state is skipped entirely (bot advances to AWAIT_OUTLET or AWAIT_PANEL_PHOTO). v10.1.9: when generator_lookup_result.matched===false && reason==="brand_only", phraser should ack the brand and ask for the model number BEFORE asking voltage — improves handoff data and gives Ashley a chance to lookup again.',
    fallback: ({ generator_lookup_result } = {}) => {
      // v10.1.9 (2026-05-03): brand-only lookup result — customer named a
      // brand but no model. Ack the brand + ask for model alongside voltage.
      if (generator_lookup_result && generator_lookup_result.matched === false && generator_lookup_result.reason === 'brand_only' && generator_lookup_result.brand) {
        const brand = generator_lookup_result.brand;
        const brandCap = brand.replace(/\b\w/g, c => c.toUpperCase());
        return `Got it, a ${brandCap}. Do you happen to know the model too? Either way, just need to confirm it has a 240V 30 amp or 50 amp outlet. A picture of the outlet works too if easier.`;
      }
      // v10.1.14 (Tyler-test fix): "it has a 240V outlet on it" was ambiguous.
      // Tyler answered "my home?" because he read "it" as referring to his
      // house. Explicit subject "the generator" removes the ambiguity.
      // v10.1.14 trim: shortened to keep concat with defer prefixes under 280.
      return `Perfect. Just confirming the generator has a 240V outlet on it, either the 4-prong twist-lock or the 50-amp. A pic of the generator's outlet works too if easier.`;
    },
    transitions: {
      gen_240v: 'AWAIT_OUTLET',  // they said 240V, need to clarify amperage
      affirmative: 'AWAIT_OUTLET',  // v10.1.32: bare "yes" to 240V Q = same as gen_240v
      // v10.1.4 — 30A NOW DISAMBIGUATED:
      outlet_30a_4prong: 'AWAIT_PANEL_PHOTO',  // confirmed 240V 30A → BPP-compatible
      outlet_30a_3prong: 'DISQUALIFIED_120V',  // 30A but it's TT-30/L5-30 120V → soft DQ
      outlet_30a_unspecified: 'AWAIT_240V_RETRY',  // ambiguous, re-ask 4-prong vs 3-prong
      // Backwards-compat: legacy outlet_30a label routes to the
      // unspecified path so the bot verifies voltage before advancing.
      outlet_30a: 'AWAIT_240V_RETRY',
      outlet_50a: 'AWAIT_PANEL_PHOTO',  // 50A is reliably 240V — no ambiguity
      outlet_unknown: 'AWAIT_OUTLET',  // v10.1.10: lookup compatible_either → customer picks 30 vs 50
      photo_received: 'AWAIT_PANEL_PHOTO',  // they sent outlet photo, voltage+amp confirmed offline
      // v10.1.10 (R2 fix): customer says "let me go look" / "I'll check" → soft-pause to CLARIFY_240V
      photo_will_send_later: 'CLARIFY_240V',
      gen_120v: 'DISQUALIFIED_120V',
      gen_unsure: 'CLARIFY_240V',
      asking_for_human: 'NEEDS_CALLBACK',
      asking_if_human: 'AWAIT_240V',
      asking_for_context: 'AWAIT_240V',  // self-loop with context-reminder intent
      asking_clarifying_technical: 'AWAIT_240V',  // self-loop with answer-briefly intent
      friendly_chitchat: 'AWAIT_240V',  // self-loop with chitchat-ack intent
      answered_with_impatience: 'AWAIT_PANEL_PHOTO',  // skip ahead since voltage was paired
      off_topic_question: 'NEEDS_CALLBACK',
      stop_variant: 'STOPPED',
      unclear: 'AWAIT_240V_RETRY',
    },
  },

  AWAIT_240V_RETRY: {
    // v10.1.4: also handles 30A-prong-disambiguation. When customer says
    // "30 amp" without specifying 4-prong vs 3-prong, this state asks
    // for the prong count. 4-prong = L14-30 (240V, compatible); 3-prong
    // = TT-30 or L5-30 (120V, not compatible). Photo path always works.
    intent: 'KEY-VOICE: distinguish 30A 4-prong (L14-30, 240V, compatible) from 30A 3-prong (TT-30 or L5-30, 120V RV outlet, not compatible). Brief, neutral, photo-friendly. Pattern: "Got it, 30 amp. Just to nail down which one — is it the 4-prong twist-lock (the bigger one with 4 holes) or the 3-prong RV-style? A quick pic of the outlet works too if easier."',
    fallback: () =>
      `Got it, 30 amp. Just to nail down which one: is it the 4-prong twist-lock (the bigger one with 4 holes) or the 3-prong RV-style? A quick pic of the outlet works too if easier.`,
    transitions: {
      outlet_30a_4prong: 'AWAIT_PANEL_PHOTO',
      outlet_30a_3prong: 'DISQUALIFIED_120V',
      gen_240v: 'AWAIT_OUTLET',
      gen_120v: 'DISQUALIFIED_120V',
      gen_unsure: 'CLARIFY_240V',
      photo_received: 'AWAIT_PANEL_PHOTO',  // outlet photo resolves it
      asking_for_human: 'NEEDS_CALLBACK',
      stop_variant: 'STOPPED',
      unclear: 'CLARIFY_240V',  // route to photo path on continued ambiguity
    },
  },

  CLARIFY_240V: {
    // v10: Key-voice update — "no problem, no rush" softener mandatory
    // v10.1.2 (2026-05-03 Justin test): added park-and-continue path.
    // When customer can't or won't send the outlet photo (e.g., generator
    // is in the box), the bot used to terminate to NEEDS_CALLBACK leaving
    // the conversation cold. Now: defer voltage to Key (he can look up
    // the model from `gen_brand_model`), and CONTINUE the qualification
    // flow with the rest of the slots (panel photo, address, email).
    // Handoff notifier surfaces voltage_deferred=true so Key knows to
    // verify the model spec before quoting.
    intent: 'KEY-VOICE: ask for an outlet photo with no-rush softener. Verbatim Key pattern: "No problem, no rush. You can send a picture of the outlets whenever you get a chance." If evening, add "I know it\'s late, tomorrow works as well." If customer responds with a brand+model (text or box photo), the orchestrator looks up the generator-specs.json and may auto-route based on compatibility (skip to DISQUALIFIED_120V if known incompatible, or to AWAIT_PANEL_PHOTO if known compatible).',
    fallback: () =>
      `No problem, no rush. You can send a picture of the outlets whenever you get a chance.`,
    transitions: {
      photo_received: 'AWAIT_PANEL_PHOTO',  // outlet photo confirms voltage+amp
      // v10.1.10: customer sent a PANEL photo when we asked for an outlet
      // pic. Photo classifier identifies it as panel; harness emits
      // photo_received_panel. We accept the panel pic AND skip
      // AWAIT_PANEL_PHOTO since they already sent it.
      photo_received_panel: 'AWAIT_RUN',
      gen_240v: 'AWAIT_OUTLET',
      gen_120v: 'DISQUALIFIED_120V',
      // v10.1.9 — when orchestrator runs lookup on a brand+model volunteered
      // at CLARIFY_240V (e.g., customer said "Westinghouse WGen7500" because
      // unboxing wasn't an option), the lookup-and-route override sets
      // label=outlet_30a_4prong / outlet_50a / outlet_30a_3prong. CLARIFY_240V
      // didn't previously have these transitions; without them the label
      // dumps to NEEDS_CALLBACK. Wire them now.
      outlet_30a_4prong: 'AWAIT_PANEL_PHOTO',
      outlet_30a_3prong: 'DISQUALIFIED_120V',
      outlet_50a: 'AWAIT_PANEL_PHOTO',
      // v10.1.2 PARK-AND-CONTINUE: customer can't/won't unbox to confirm voltage.
      // Bot acknowledges, defers to Key (who will look up the model), and
      // continues to panel photo. voltage_deferred=true gets set in
      // qualification_data; handoff notifier surfaces it.
      photo_refused: 'AWAIT_PANEL_PHOTO',
      photo_will_send_later: 'CLARIFY_240V',  // soft-pause; 24h reengage cron handles
      asking_for_human: 'NEEDS_CALLBACK',
      stop_variant: 'STOPPED',
      // v10.1.2: unclear after 1-2 attempts now also routes to park-and-continue,
      // not NEEDS_CALLBACK. Customer might just be bad at typing or photos;
      // give them the chance to complete the rest of the qualification.
      unclear: 'AWAIT_PANEL_PHOTO',
    },
    onEnter: { check_generator_lookup: true },  // signal orchestrator to run generator-lookup.js if gen_brand_model is set
  },

  AWAIT_OUTLET: {
    // v10: this state now fires only as fallback — most cases skip via paired AWAIT_240V message.
    // Skip AWAIT_OWNERSHIP entirely (form filters); go straight to AWAIT_PANEL_PHOTO.
    //
    // v10.1.4: KEY name-correction. The verbatim Key pattern incorrectly
    // associated "30 amp" with "3-prong twist-lock" (which is the L14-30
    // 4-prong 240V outlet — Key meant "the smaller round one" but mis-
    // described prong count). Updated intent to be accurate:
    //   - L14-30R (30A 240V): 4-prong twist-lock — BPP compatible
    //   - 14-50R (50A 240V):  4-prong straight-blade — BPP compatible
    //   - TT-30R / L5-30R (30A 120V): 3-prong — NOT compatible
    intent: 'KEY-VOICE: ask if the outlet is 30 amp 4-prong (L14-30, 240V, compatible) or 50 amp (14-50R, 240V, compatible), with photo offer paired in same message. Verbatim Key pattern: "The connection requires either a 30 amp 240V outlet or a 50 amp outlet on your generator. Does your generator have either of those? If you are unsure you can send a picture of your generator outlets." If customer answers "30 amp" without confirming 4-prong, route to AWAIT_240V_RETRY for prong-count clarification — some 30A outlets are 120V-only (TT-30R RV-style) and would NOT qualify.',
    fallback: () =>
      `The connection needs either a 30 amp 4-prong twist-lock or a 50 amp 240V outlet. Does the generator have either? A pic of the outlet works too if easier.`,
    transitions: {
      // v10.1.4 — 30A disambiguation
      outlet_30a_4prong: 'AWAIT_PANEL_PHOTO',
      outlet_30a_3prong: 'DISQUALIFIED_120V',
      outlet_30a_unspecified: 'AWAIT_240V_RETRY',
      outlet_30a: 'AWAIT_240V_RETRY',  // legacy label → re-confirm
      outlet_50a: 'AWAIT_PANEL_PHOTO',
      outlet_unknown: 'AWAIT_OUTLET_PHOTO',
      photo_received: 'AWAIT_PANEL_PHOTO',
      asking_for_human: 'NEEDS_CALLBACK',
      asking_if_human: 'AWAIT_OUTLET',
      asking_for_context: 'AWAIT_OUTLET',
      asking_clarifying_technical: 'AWAIT_OUTLET',
      friendly_chitchat: 'AWAIT_OUTLET',
      answered_with_impatience: 'AWAIT_PANEL_PHOTO',
      off_topic_question: 'NEEDS_CALLBACK',
      stop_variant: 'STOPPED',
      unclear: 'NEEDS_CALLBACK',
    },
  },

  AWAIT_OUTLET_PHOTO: {
    // v10: route to AWAIT_PANEL_PHOTO directly (skip ownership)
    intent: 'KEY-VOICE: thank them and ask for the outlet photo with the verified Key softener "no rush, whenever you get the chance" or evening variant.',
    fallback: () => `No rush, you can send a picture of the outlet on the generator whenever you get a chance.`,
    transitions: {
      photo_received: 'AWAIT_PANEL_PHOTO',  // v10: skip ownership
      // v10.1.10: customer sent a panel pic when we asked for outlet pic.
      // Accept it and skip AWAIT_PANEL_PHOTO since they already sent it.
      photo_received_panel: 'AWAIT_RUN',
      photo_will_send_later: 'AWAIT_OUTLET_PHOTO',  // soft-pause, 24h reminder will fire
      photo_refused: 'AWAIT_PANEL_PHOTO',  // v10: accept defeat, continue
      photo_correction: 'AWAIT_OUTLET_PHOTO',  // self-loop, ack & wait for replacement
      outlet_30a: 'AWAIT_PANEL_PHOTO',
      outlet_50a: 'AWAIT_PANEL_PHOTO',
      asking_for_human: 'NEEDS_CALLBACK',
      asking_if_human: 'AWAIT_OUTLET_PHOTO',
      asking_for_context: 'AWAIT_OUTLET_PHOTO',
      asking_clarifying_technical: 'AWAIT_OUTLET_PHOTO',
      friendly_chitchat: 'AWAIT_OUTLET_PHOTO',
      stop_variant: 'STOPPED',
      unclear: 'AWAIT_OUTLET_PHOTO',  // wait
    },
  },

  AWAIT_OWNERSHIP: {
    // v10 BYPASSED IN DEFAULT FLOW — Key never asks ownership across 702 real
    // messages. The lead form already filters to homeowners. This state only
    // fires if the customer VOLUNTEERS that they rent / mentions a landlord.
    // Then DQ_RENTER kicks in.
    intent: 'KEY-VOICE: this state should not fire in default flow. Only used if customer volunteered renter status. Acknowledge and ask politely if they own. Polite-professional only.',
    fallback: () =>
      `Just to confirm: do you own the home? The install involves panel work so we need the property owner to sign off.`,
    transitions: {
      owner: 'AWAIT_PANEL_PHOTO',  // v10: skip AWAIT_RUN, go to panel photo (run-length not asked anymore)
      renter: 'DISQUALIFIED_RENTER',
      asking_for_human: 'NEEDS_CALLBACK',
      asking_if_human: 'AWAIT_OWNERSHIP',
      asking_for_context: 'AWAIT_OWNERSHIP',
      asking_clarifying_technical: 'AWAIT_OWNERSHIP',
      friendly_chitchat: 'AWAIT_OWNERSHIP',
      answered_with_impatience: 'AWAIT_PANEL_PHOTO',
      off_topic_question: 'NEEDS_CALLBACK',
      stop_variant: 'STOPPED',
      unclear: 'AWAIT_OWNERSHIP_RETRY',
    },
  },

  AWAIT_OWNERSHIP_RETRY: {
    intent: 'KEY-VOICE: gently ask again if they own. Polite-professional.',
    fallback: () => `Just to confirm: do you own the home, or is it a rental?`,
    transitions: {
      owner: 'AWAIT_PANEL_PHOTO',
      renter: 'DISQUALIFIED_RENTER',
      asking_for_human: 'NEEDS_CALLBACK',
      stop_variant: 'STOPPED',
      unclear: 'NEEDS_CALLBACK',
    },
  },

  AWAIT_RUN: {
    // v10.1.5 (2026-05-03 Key feedback): EXPANDED to ask BOTH panel
    // location AND distance, per Key's actual qualification process.
    // Verbatim Key Q from corpus: "Most main panels are located in the
    // garage on an exterior wall, is that the case in your home?"
    //
    // Best case for install: panel in GARAGE on EXTERIOR WALL → inlet
    // goes directly behind panel, minimal cable run, default 20ft cord
    // works clean.
    //
    // If panel is on an INTERIOR WALL (interior of garage, basement,
    // utility closet, etc.) → need to know attic/crawlspace access
    // for cable routing. Routes to AWAIT_INSTALL_PATH for follow-up.
    intent: 'KEY-VOICE: ask where the main panel is located AND clarify what "exterior wall" means upfront so customer doesn\'t get confused (homeowners often think "interior wall" because panel is inside the house, when actually the panel is on a wall that backs to the outside). v10.1.14 — verbose-but-clear question that defines exterior wall inline. NEVER claim Ashley does the install ("I install" banned — Ashley is intake).',
    fallback: () =>
      `Thank you. Most main panels around here are mounted in the garage on an exterior wall (a wall that backs up to the outside of the house, where you could mount something on the other side). Is that your setup, or is it somewhere else?`,
    transitions: {
      // v10.1.10 — customer volunteers contact info before answering panel
      // location (multi-intent message). Route to AWAIT_EMAIL's email_provided
      // handler which then advances to RECAP / CHECK_EMAIL_TYPO normally.
      email_provided: 'AWAIT_EMAIL',
      address_confirmed: 'AWAIT_EMAIL',
      address_corrected: 'AWAIT_EMAIL',
      // v10.1.5 panel-location specific labels
      // v10.1.14 — customer-facing clarification before continuing. Garage-exterior
      // skips straight to inlet-location (best case). Interior/basement/etc.
      // routes through CONFIRM_PANEL_WALL_TYPE first to catch the common
      // "interior wall (because it's inside the house)" misclassification.
      panel_garage_exterior: 'AWAIT_INLET_LOCATION',  // ideal case — confirm inlet placement
      panel_garage_interior: 'CONFIRM_PANEL_WALL_TYPE',  // could be either; verify
      panel_basement: 'CONFIRM_PANEL_WALL_TYPE',
      panel_interior_wall: 'CONFIRM_PANEL_WALL_TYPE',
      panel_outdoor: 'AWAIT_INLET_LOCATION',  // sometimes panels are on the outside (especially in southern homes) — install is straightforward
      panel_other: 'AWAIT_INSTALL_PATH',  // detached garage, unusual location — Key needs details
      // Backwards-compat: old labels
      affirmative: 'AWAIT_INLET_LOCATION',  // "yes garage exterior" → ideal, ask inlet
      run_short: 'AWAIT_INLET_LOCATION',
      run_medium: 'AWAIT_INLET_LOCATION',
      run_long: 'AWAIT_INSTALL_PATH',  // long run typically means panel is interior
      run_unsure: 'AWAIT_INLET_LOCATION',
      negative: 'CONFIRM_PANEL_WALL_TYPE',  // "no, somewhere else" → clarify wall type before routing
      asking_for_human: 'NEEDS_CALLBACK',
      asking_if_human: 'AWAIT_RUN',
      asking_for_context: 'AWAIT_RUN',
      asking_clarifying_technical: 'AWAIT_RUN',
      friendly_chitchat: 'AWAIT_RUN',
      answered_with_impatience: 'AWAIT_EMAIL',
      off_topic_question: 'NEEDS_CALLBACK',
      stop_variant: 'STOPPED',
      unclear: 'AWAIT_RUN_RETRY',
    },
  },

  CONFIRM_MAIN_BREAKER: {
    // v10.1.14 (Tyler-test feedback): photo classifier returned moderate
    // confidence on main breaker presence. Bot asks customer to verify
    // before advancing rather than silently committing to a wrong path.
    // Ashley is NOT an electrician — when uncertain, ask, don't guess.
    intent: 'KEY-VOICE: politely ask customer to confirm a main breaker is present in the panel. The interlock kit needs a main breaker to work. Frame the question in everyday terms (no jargon). Examples: "Just to double-check, on the panel you sent, is there a big switch at the top labeled MAIN, or one larger breaker that controls everything? Sometimes those are the easiest way to spot a main panel."',
    fallback: () =>
      `Quick double-check on the panel. Is there a larger breaker at the top labeled MAIN or rated higher than the others (100A, 150A, 200A)? The install needs that to work.`,
    transitions: {
      affirmative: 'AWAIT_RUN',  // "yes there's a 200A main at the top" → continue
      negative: 'NEEDS_CALLBACK',  // "no nothing like that" → likely sub-panel, Key follows up
      photo_received: 'AWAIT_RUN',  // they sent a clearer photo
      photo_received_main_breaker_unsure: 'CONFIRM_MAIN_BREAKER',  // self-loop, still unclear
      photo_correction: 'AWAIT_PANEL_PHOTO',  // they want to send a different one
      asking_clarifying_technical: 'CONFIRM_MAIN_BREAKER',  // self-loop with explanation
      asking_for_human: 'NEEDS_CALLBACK',
      stop_variant: 'STOPPED',
      unclear: 'NEEDS_CALLBACK',  // rather have Key sort it out than assume
    },
  },

  CONFIRM_PANEL_WALL_TYPE: {
    // v10.1.14 (Tyler-test fix): homeowners often say "interior wall" when
    // they actually mean "the panel is inside the house" — the wall itself
    // is still an exterior wall (one side faces inside, the other side
    // faces the outside of the house). Bot explicitly clarifies before
    // committing to attic/crawlspace cable routing path.
    intent: 'KEY-VOICE: customer indicated panel is inside on an "interior wall." Explicitly clarify the difference: an EXTERIOR wall is one that backs to the outside of the house even though you see it from inside (e.g., back wall of garage facing the yard). An INTERIOR wall is one between two indoor rooms with house on both sides. Ask which is theirs. Customer may need to physically check.',
    fallback: () =>
      `Quick clarification: an EXTERIOR wall backs up to the outside of your house (something mountable on the other side). An INTERIOR wall is between two indoor rooms (house on both sides). Which is your panel on?`,
    transitions: {
      // Customer confirms it's actually exterior (panel just appears interior because it's inside the house) → ideal install
      panel_outdoor: 'AWAIT_INLET_LOCATION',
      panel_garage_exterior: 'AWAIT_INLET_LOCATION',
      affirmative: 'AWAIT_INLET_LOCATION',  // "yes exterior" / "oh exterior then" → ideal
      // Customer confirms truly interior wall → need attic/crawlspace
      panel_interior_wall: 'AWAIT_INSTALL_PATH',
      panel_garage_interior: 'AWAIT_INSTALL_PATH',
      panel_basement: 'AWAIT_INSTALL_PATH',
      negative: 'AWAIT_INSTALL_PATH',  // "no it's truly interior between rooms" → install path
      // v10.1.14 — customer skips past wall-confirm by giving install path
      // directly ("we have a crawlspace" implies interior wall already).
      // Skip AWAIT_INSTALL_PATH and route to AWAIT_INLET_LOCATION since
      // the install path is now known.
      attic_access: 'AWAIT_INLET_LOCATION',
      crawlspace_access: 'AWAIT_INLET_LOCATION',
      both_access: 'AWAIT_INLET_LOCATION',
      no_access: 'NEEDS_CALLBACK',
      // Asking-for-help paths
      asking_clarifying_technical: 'CONFIRM_PANEL_WALL_TYPE',  // self-loop with deeper explanation
      asking_for_human: 'NEEDS_CALLBACK',
      stop_variant: 'STOPPED',
      unclear: 'AWAIT_INSTALL_PATH',  // err on the side of asking install path; Key sorts on call
    },
  },

  AWAIT_INLET_LOCATION: {
    // v10.1.14 (Tyler-test fix): NEW STATE. Capture where the customer wants
    // the inlet box mounted on the outside of the house, plus approximate
    // distance from panel to inlet. Default install: inlet right outside
    // behind/near panel, 20ft cord standard. Custom: customer wants it
    // elsewhere (closer to where they store generator, around a corner).
    // This is critical info Key needs for the quote — affects cord length,
    // labor, and conduit run.
    intent: 'KEY-VOICE: ask where the customer wants the inlet box mounted on the outside of the house, plus rough distance from the panel. Standard install puts it on the exterior right behind/near the panel with a 20ft cord. Some customers prefer it closer to where they keep the generator. Capture preference + distance for handoff.',
    fallback: () =>
      `Where would you want the inlet box mounted on the outside? Standard install puts it right behind your panel with a 20ft cord. Or if you'd want it elsewhere (closer to the generator), roughly how far from the panel?`,
    transitions: {
      affirmative: 'AWAIT_EMAIL',  // "yes default works" → continue close info
      inlet_default: 'AWAIT_EMAIL',
      inlet_custom: 'AWAIT_EMAIL',  // captured location preference, continue
      inlet_far: 'NEEDS_CALLBACK',  // distance > 20ft, Key needs to spec longer cord/conduit run
      negative: 'AWAIT_INLET_LOCATION',  // "no not behind panel" — wait for them to specify
      asking_clarifying_technical: 'AWAIT_INLET_LOCATION',
      asking_for_human: 'NEEDS_CALLBACK',
      stop_variant: 'STOPPED',
      unclear: 'AWAIT_EMAIL',  // accept and let Key clarify
    },
  },

  AWAIT_INSTALL_PATH: {
    // v10.1.5 NEW STATE: when panel is on an interior wall, basement, or
    // unusual location, Key needs to know how the cable can reach the
    // exterior. Two main paths: through the attic (if accessible from
    // above) or through a crawlspace (if accessible from below). Both
    // are common in SC homes; Key can run conduit through either.
    intent: 'KEY-VOICE: lead with thanks (customer just gave panel location), then ask if there is attic access (to run cable up + over to exterior) or crawlspace access (to run cable down + under to exterior). Verbatim Key pattern from corpus: "For safety and to meet code I need to install the connection box on the exterior, what is the easiest way for me to do that, if the panel is just a couple feet away from the exterior wall I can run a short conduit or I could go into the attic." Translate to Ashley voice (third-person Key + thanks lead): "Thanks for that. Since the panel is on an interior wall, Key would route the cable through either the attic or crawlspace to the exterior. Do you happen to have one of those accessible?"',
    fallback: () =>
      `Thanks for that. Since the panel is on an interior wall, Key would route the cable through either the attic or crawlspace to reach the outside. Do you happen to have one of those accessible?`,
    transitions: {
      // v10.1.14 — route through AWAIT_INLET_LOCATION before AWAIT_EMAIL so
      // we capture inlet placement + distance after the cable-routing path
      // is known.
      attic_access: 'AWAIT_INLET_LOCATION',
      crawlspace_access: 'AWAIT_INLET_LOCATION',
      both_access: 'AWAIT_INLET_LOCATION',
      no_access: 'NEEDS_CALLBACK',  // unusual; Key needs to walk through it personally
      affirmative: 'AWAIT_INLET_LOCATION',  // "yes attic" or generic yes
      negative: 'NEEDS_CALLBACK',  // no attic AND no crawlspace = Key callback
      asking_for_human: 'NEEDS_CALLBACK',
      asking_clarifying_technical: 'AWAIT_INSTALL_PATH',
      friendly_chitchat: 'AWAIT_INSTALL_PATH',
      answered_with_impatience: 'AWAIT_EMAIL',
      stop_variant: 'STOPPED',
      unclear: 'AWAIT_EMAIL',  // Key handles ambiguous cases on the call
    },
  },

  AWAIT_RUN_RETRY: {
    // v10: also repurposed — soft retry on default install offer
    intent: 'KEY-VOICE: re-ask if the default install plan (right beside panel, 20 foot cord) works for them, more simply. If they want something different, accept it gracefully.',
    fallback: () => `No problem. Would the connection box right beside your main panel work for you? Or a different location?`,
    transitions: {
      affirmative: 'AWAIT_EMAIL',
      run_short: 'AWAIT_EMAIL',
      run_medium: 'AWAIT_EMAIL',
      run_long: 'AWAIT_EMAIL',
      run_unsure: 'AWAIT_EMAIL',
      asking_for_human: 'NEEDS_CALLBACK',
      stop_variant: 'STOPPED',
      unclear: 'NEEDS_CALLBACK',
    },
  },

  AWAIT_EMAIL: {
    // v10: REPURPOSED as combined CLOSE-INFO ask — Key always asks for last name,
    // email, AND address together at the END of the qualification flow. Verbatim Key
    // pattern (used 8+ times): "I would be happy to send over the quote for approval.
    // I just need your last name, email, and address" / "To complete the quote could
    // I get your last name, email, and address?"
    intent: 'KEY-VOICE: ask for last name + email + install address combined in ONE close-info request. IDENTITY-TRANSLATION RULE: Key verbatim was "I would be happy to send over the quote" / "I will put a quote together" — but Ashley is intake, not the electrician. Translate to: "Key will put your quote together" / "Key will send the quote over" / use "we" for BPP-the-business action. v10.1.7: lead with thanks (customer just answered the install-path question). Bot output patterns: "Thank you. To complete the quote could I get your last name, email, and address?" or "Thanks for that. Key will put your quote together. To complete it could I get your last name, email, and address?" Acceptable opens: "Thank you." / "Thanks for that." / "Sounds good." / "Got it." / "Perfect." — rotate. This is the close — handing off to Key who will send the quote PDF.',
    fallback: () => `Thank you. To complete the quote could I get your last name, email, and address?`,
    transitions: {
      email_provided: 'CHECK_EMAIL_TYPO',  // typo-check the email; address may be in same message
      address_confirmed: 'CHECK_EMAIL_TYPO',  // partial — address received, still need email check
      asking_for_human: 'NEEDS_CALLBACK',
      asking_if_human: 'AWAIT_EMAIL',
      asking_for_context: 'AWAIT_EMAIL',
      friendly_chitchat: 'AWAIT_EMAIL',
      stop_variant: 'STOPPED',
      unclear: 'AWAIT_EMAIL',  // wait for valid info
    },
  },

  CHECK_EMAIL_TYPO: {
    // Pseudo-state: orchestrator routes here from AWAIT_EMAIL when classifier
    // emits email_typo_suspected=true. If typo is NOT suspected, orchestrator
    // skips this state and goes straight to RECAP (v10: AWAIT_ADDRESS_CONFIRM
    // is now a fallback retry only since address is captured in AWAIT_EMAIL).
    intent: 'confirm the spelling of an email that looks like a typo of a major domain (e.g. gmial -> gmail). Do not be patronizing — give them an out.',
    fallback: () =>
      `Just to double-check, that's the right spelling? Looks close to a typo so wanted to confirm.`,
    transitions: {
      affirmative: 'RECAP',  // v10: skip AWAIT_ADDRESS_CONFIRM since address was in close-info
      address_corrected: 'RECAP',  // they corrected the email; address still on file
      email_provided: 'CHECK_EMAIL_TYPO',  // they sent a different email — re-check
      asking_for_human: 'NEEDS_CALLBACK',
      stop_variant: 'STOPPED',
      unclear: 'CHECK_EMAIL_TYPO',
    },
  },

  AWAIT_ADDRESS_CONFIRM: {
    // v10: this is now a FALLBACK STATE only, fired when address parse fails in
    // AWAIT_EMAIL. Most flows skip this state since address is captured in the
    // combined close-info ask. Routes to RECAP after address received.
    intent: 'KEY-VOICE: ask politely for the install address (only fires if AWAIT_EMAIL did not capture it). The form only collects name and phone, so the bot must ASK open-endedly. Verbatim Key pattern (rare): "Could I also get your address to complete the quote?"',
    fallback: () => `Could I also get your install address to complete the quote?`,
    transitions: {
      address_confirmed: 'RECAP',  // v10: route to RECAP, panel photo already captured earlier
      address_corrected: 'RECAP',
      answered_with_impatience: 'RECAP',
      asking_for_human: 'NEEDS_CALLBACK',
      asking_if_human: 'AWAIT_ADDRESS_CONFIRM',
      asking_for_context: 'AWAIT_ADDRESS_CONFIRM',
      friendly_chitchat: 'AWAIT_ADDRESS_CONFIRM',
      stop_variant: 'STOPPED',
      unclear: 'AWAIT_ADDRESS_CONFIRM',
    },
  },

  AWAIT_PANEL_PHOTO: {
    // v10: panel photo comes EARLY (after voltage/amp confirmed). Then we go to
    // AWAIT_RUN (default install offer) → AWAIT_EMAIL (combined close info).
    intent: 'KEY-VOICE: ask for a photo of their main electrical panel and breakers with verified Key softener. IDENTITY-TRANSLATION RULE: Key verbatim was "I will also need" — but Ashley is intake. Translate to "Key will need" or "we will need" (BPP-business voice). Bot output patterns: (1) "To put together an accurate quote, Key will also need a picture of your main electrical panel and breakers. No rush, whenever you get the chance." (2) "Got it. To put your quote together we will also need a picture of your main electrical panel and breakers. I know it is late, no rush, tomorrow works as well." Use evening variant if time_of_day_bucket is "evening" or "late". Closing softener "no rush, whenever you get the chance" is non-negotiable Key voice — always include it. NEVER use first-person "I will need" / "I install" — Ashley is not the electrician.',
    fallback: ({ photo_classification } = {}) => {
      // v10.1.6 (2026-05-03 brutal-test fix): when photo_correction fires,
      // the orchestrator passes the photo_classification result. Render
      // a subject-aware fallback so the customer knows WHY we're re-asking
      // even if the LLM phraser is unavailable.
      if (photo_classification) {
        const subj = photo_classification.subject;
        if (subj === 'panel_subpanel') {
          return `Looks like that may be a sub-panel (no main breaker visible). For the quote Key needs the MAIN panel, usually larger, fed directly from the meter, with a big main breaker at the top. No rush, whenever you can grab one.`;
        }
        if (subj === 'panel_main_closed') {
          return `Got it. Looks like the panel door is closed. Could you open it so the breakers are visible, then resnap and send? No rush.`;
        }
        if (subj === 'meter') {
          return `Got the meter pic. What we need is the breaker panel inside the house, usually a gray metal box in a closet, basement, or garage. No rush.`;
        }
        if (subj === 'generator') {
          return `Got the generator pic. For the quote Key also needs the breaker panel inside the house. No rush whenever you can grab one.`;
        }
        if (subj === 'wrong_subject') {
          return `Looks like that one was off. For the quote Key needs the main breaker panel inside the house (usually a gray metal box). No rush whenever you can resnap.`;
        }
        if (subj === 'blurry') {
          return `Came through a little blurry. Could you try once more with a bit more light? No rush.`;
        }
      }
      return `To put together an accurate quote, Key will also need a picture of your main electrical panel and breakers. No rush, whenever you get the chance.`;
    },
    transitions: {
      photo_received: 'AWAIT_RUN',  // v10: route to default-install-offer (renamed AWAIT_RUN intent)
      // v10.1.14 — photo classifier moderate confidence on main breaker.
      // Bot asks customer to verify main breaker is present before advancing.
      photo_received_main_breaker_unsure: 'CONFIRM_MAIN_BREAKER',
      photo_will_send_later: 'AWAIT_PANEL_PHOTO',  // soft-pause, 24h reminder
      photo_refused: 'AWAIT_RUN',  // v10: continue to install-offer
      photo_correction: 'AWAIT_PANEL_PHOTO',  // self-loop, ack & wait for replacement
      // v10.1.6 (2026-05-03 brutal-test fix): customer at AWAIT_PANEL_PHOTO
      // sometimes sends an OUTLET photo instead (especially when they got
      // confused about the prior turn's voltage check). Photo classifier
      // returns outlet_120v_3prong_30a → contradicts their earlier "4-prong"
      // claim → route to soft DQ. outlet_240v_4prong stays parked at
      // AWAIT_PANEL_PHOTO since we already have voltage but still need
      // the panel pic.
      outlet_30a_3prong: 'DISQUALIFIED_120V',
      outlet_30a_4prong: 'AWAIT_PANEL_PHOTO',
      outlet_50a: 'AWAIT_PANEL_PHOTO',
      // amending — customer wants to revise an earlier slot
      amending_prior_answer: 'AWAIT_PANEL_PHOTO',  // routed via SLOT_TO_STATE; this entry just keeps the universal pathway from defaulting to NEEDS_CALLBACK
      asking_for_human: 'NEEDS_CALLBACK',
      asking_if_human: 'AWAIT_PANEL_PHOTO',
      asking_for_context: 'AWAIT_PANEL_PHOTO',
      asking_clarifying_technical: 'AWAIT_PANEL_PHOTO',
      friendly_chitchat: 'AWAIT_PANEL_PHOTO',
      callback_time_requested: 'NEEDS_CALLBACK',
      spouse_approval_needed: 'POSTPONED',
      referral_mentioned: 'AWAIT_PANEL_PHOTO',  // ack referral, continue
      dont_own_generator_yet: 'NEEDS_CALLBACK',
      off_topic_question: 'NEEDS_CALLBACK',
      stop_variant: 'STOPPED',
      unclear: 'AWAIT_PANEL_PHOTO',  // wait for photo
    },
  },

  RECAP: {
    intent: 'summarize all qualification slots back to customer in a tight one-message recap (e.g. "Thanks for all of that. Just to recap: 240v 50A, owner, 22ft run, install at 412 Oakmont Dr. Look right?") so they can confirm or correct anything before Key reviews. v10.1.7: lead with thanks since customer just gave their contact info (the close-info ask). Use the volunteered + classifier-extracted slot store. Casual phrasing.',
    fallback: ({ first_name }) =>
      `Thanks for all of that. Quick recap before Key reviews. Does everything look right on what you sent?`,
    transitions: {
      affirmative: 'SCHEDULE_QUOTE',
      negative: 'NEEDS_CALLBACK',  // they spotted an error — let Key clarify
      address_corrected: 'AWAIT_ADDRESS_CONFIRM',  // they corrected the address in recap
      amending_prior_answer: 'NEEDS_CALLBACK',  // they want to revise something — Key handles
      asking_for_human: 'NEEDS_CALLBACK',
      stop_variant: 'STOPPED',
      unclear: 'SCHEDULE_QUOTE',  // benign reply like "thanks" or "ok cool"
    },
  },

  SCHEDULE_QUOTE: {
    // v10: KEY-VOICE rotation — verified sign-offs only. No "y'all", "holler",
    // "talk soon", "catch ya". Use Key's actual sign-offs from real data:
    // "I would be happy to help with the project" (60+ uses), "let me know if
    // you have any questions" (37 uses), "Looking forward to it" (5 uses).
    intent: 'KEY-VOICE: wrap up. SOFT commitment that Key will have the quote ready by tomorrow morning. v10.1.7: lead with thanks (customer just confirmed the recap — they have given their full info). Sign-off rotation (Key-real, rotate, never reuse same one in last 5 conversations): (1) "Thank you {name}. Key will put the quote together and send it over by tomorrow morning. Let me know if you have any questions." (2) "Thanks for all of that. Key will review everything tonight and have the quote in your inbox by tomorrow morning." (3) "Thank you. I will pass this over to Key. He will send the quote over by tomorrow morning." (4) "Sounds good, thank you. Key will put your quote together. He will send it over by tomorrow morning. I would be happy to help if you have any questions in the meantime." (5) "Perfect, thanks for all of that. Quote will be in your inbox by tomorrow morning. Looking forward to helping out with this." Pick the variant that fits the register (terse=shorter, default=mid). NEVER use "y\'all", "y\'all\'ll", "holler", "talk soon", "catch ya", "have a good one". Those are fake-Key. Zero em-dashes anywhere.',
    fallback: ({ first_name } = {}) => {
      const name = first_name && first_name !== 'there' ? `, ${first_name}` : '';
      return `Thank you${name}. Key will put the quote together and send it over by tomorrow morning. Let me know if you have any questions.`;
    },
    transitions: {
      // Terminal-ish state — most replies route to COMPLETE
      affirmative: 'COMPLETE',
      negative: 'NEEDS_CALLBACK',
      asking_for_human: 'NEEDS_CALLBACK',
      // v10.1.32 — "thanks", "great", "sounds good" all classify as friendly_chitchat
      // and should resolve as COMPLETE (customer is acknowledging the wrap-up, not
      // raising a concern). Without this they fall to NEEDS_CALLBACK default.
      friendly_chitchat: 'COMPLETE',
      photo_correction: 'AWAIT_PANEL_PHOTO',  // customer wants to replace the photo — rewind
      photo_received: 'SCHEDULE_QUOTE',  // additional photos append to extras (P35)
      stop_variant: 'STOPPED',
      unclear: 'COMPLETE',  // they probably said "thanks" or similar
    },
    onEnter: { complete: true },  // signal to fire Key's "qualified lead" notification
  },

  COMPLETE: {
    intent: null,  // no further outbound; bot is done
    fallback: () => null,
    transitions: {},  // any inbound → NEEDS_CALLBACK
    terminal: true,
  },

  // ── Exit / dead-end states ──

  POSTPONED: {
    // v10.1.1 (2026-05-03): made POSTPONED soft-resumable for warm pauses
    // (spouse_approval_needed). When customer returns to a paused
    // conversation, bot-engine reads contacts.paused_at_state and resumes
    // the original state. The handoff-notifier sends Key a softer
    // "warm pause" notification (not silent like before).
    intent: 'KEY-VOICE: acknowledge politely, say no problem and we will follow up another time. No "y\'all" / "holler". Soft, no pressure.',
    fallback: () => `No problem. Just let me know whenever you are ready and I would be happy to follow up.`,
    transitions: {
      // Universal escapes still apply
      stop_variant: 'STOPPED',
      // Soft resume: when a customer returns after a warm pause, the
      // bot-engine handles the state restoration via paused_at_state
      // before transition() is called. The transitions below are the
      // "did not return" / "returned with explicit signals" paths.
      affirmative: 'POSTPONED_RESUME',  // "yes ready to continue", "ok bill is on board"
      negative: 'POSTPONED',  // "still need to think" — stay paused
    },
    terminal: false,  // CHANGED: was true, now soft-resumable
    onEnter: { warm_pause: true },  // signal for handoff-notifier to send softer notification
  },

  POSTPONED_RESUME: {
    // Pseudo-state: bot-engine reads paused_at_state and routes to that
    // state with a "welcome back" intent override. The phraser is told
    // to acknowledge the return + re-ask the question we paused on.
    intent: 'KEY-VOICE WELCOME-BACK: acknowledge the customer returning warmly (use their name + warm welcome lead like "Welcome back" / "Glad to hear it"), then RESUME the question we paused on. Bot-engine sets ctx.paused_at_state to the original state; the phraser uses that state\'s intent. Example: paused at AWAIT_RUN → "Welcome back {name}, glad to hear it. We were on the install setup. Key installs the connection box right beside your main panel with a 20 foot cord. Would that setup work?"',
    fallback: ({ first_name }) => `Welcome back ${first_name || 'there'}, glad to hear it. Just text me where you want to pick up and I will get Key whatever else he needs.`,
    transitions: {
      // After welcome-back, normal state machine continues. Bot-engine
      // overrides bot_state to paused_at_state after this turn.
      stop_variant: 'STOPPED',
    },
  },

  DISQUALIFIED_120V: {
    // v10: KEY-VOICE — verified verbatim soft DQ pattern from data:
    // "Ok. At the moment that only outputs 120 volts so when you upgrade get one with a 240 volt outlet"
    //
    // v10.1.3 (2026-05-03 Key feedback after Justin test):
    // 1. HEDGE the DQ slightly — bot lookup might be wrong (database error,
    //    typo, ambiguous brand). Use "looks like" / "from what I can see".
    // 2. EXPLICIT future-install offer — "if you upgrade later we would
    //    still be happy to help."
    // 3. NOT terminal anymore — accept follow-up questions about
    //    recommendations. The phraser handles tiered response:
    //    - general spec request → "at least 240V, around 5,000W
    //      minimum" (Key approved guidance)
    //    - specific model request → defer to Key + notify Key
    intent: 'KEY-VOICE: hedged soft DQ. Frame as "looks like / from what I can see" rather than absolute. Offer future-install. Verbatim Key pattern + v10.1.3 hedge: "Got it, {gen_brand_model}. Looks like that one outputs 120 volts only and would not work with our setup. If you upgrade to a 240V generator down the road, we would be happy to help with the install then." DO NOT proactively offer generator recommendations — wait for customer to ask.',
    fallback: ({ gen_brand_model }) => {
      // v10.1.6 (2026-05-03 brutal-test fix): when no brand+model is in
      // ctx (DQ via 30A 3-prong path or just "120 volt only"), the prior
      // fallback read awkwardly: "Got it, that generator." Now branches:
      //   - brand named  → "Got it, {brand_model}. Looks like that one..."
      //   - no brand     → "Got it. Looks like that outlet is 120 volts only..."
      if (gen_brand_model) {
        return `Got it, ${gen_brand_model}. Looks like that one outputs 120 volts only and would not work with our setup. If you upgrade to a 240V generator down the road, we would be happy to help with the install then.`;
      }
      return `Got it. Looks like that outlet is 120 volts only. Our install needs a 240V outlet (the larger 4-prong twist-lock or the 50-amp). If you upgrade down the road we would be happy to help with the install then.`;
    },
    transitions: {
      // v10.1.3 — accept follow-up questions instead of terminating
      asking_clarifying_technical: 'DISQUALIFIED_120V',  // self-loop, phraser handles tiered recommendation response
      asking_for_human: 'NEEDS_CALLBACK',
      // dont_own_generator_yet fires when customer says "ok i'll get a different one, what should i get"
      dont_own_generator_yet: 'DISQUALIFIED_120V',  // self-loop, phraser gives general spec or defers specific
      affirmative: 'DISQUALIFIED_120V',  // "ok thanks" — stay parked
      negative: 'DISQUALIFIED_120V',     // "ok bummer" — stay parked
      // v10.1.3 LOOKUP-CORRECTION PATHS: the bot's hedge ("Looks like...")
      // explicitly invites the customer to correct us if our generator-spec
      // lookup was wrong. If they do (say it actually has 240V, or send
      // an outlet photo), reopen the qualification flow.
      gen_240v: 'AWAIT_OUTLET',
      outlet_30a: 'AWAIT_PANEL_PHOTO',
      outlet_50a: 'AWAIT_PANEL_PHOTO',
      photo_received: 'AWAIT_PANEL_PHOTO',
      stop_variant: 'STOPPED',
      // unclear after the DQ message — assume conversation winding down
      unclear: 'DISQUALIFIED_120V',
    },
    terminal: false,  // CHANGED v10.1.3: was true, now soft-terminal (accepts followups)
    onEnter: { dq_120v: true, allow_recommendation_followup: true },
  },

  DISQUALIFIED_RENTER: {
    intent: 'KEY-VOICE: politely explain that panel work needs the property owner to authorize and suggest looping in the landlord. No "y\'all". Polite-professional.',
    fallback: () =>
      `Got it. For panel work like this we would need the property owner to sign off. If you can loop in your landlord, we would be happy to take it from there.`,
    transitions: { stop_variant: 'STOPPED' },
    terminal: true,
  },

  DISQUALIFIED_OUT_OF_AREA: {
    // v10.1.8 (2026-05-03 Alex KB cross-check): service area is GREENVILLE,
    // SPARTANBURG, PICKENS only. Anderson + Oconee + Cherokee + Laurens +
    // Greenwood are OUT. The prior fallback incorrectly listed Oconee as
    // in-service. Per Alex Topic 6 county mapping, Oconee (Seneca, Walhalla,
    // Westminster) is OUTSIDE BPP's service area.
    intent: 'KEY-VOICE: politely explain we cover Greenville, Spartanburg, and Pickens counties only. Add a courtesy "if you are still interested..." opener since Key extends courtesy to nearby out-of-area leads.',
    fallback: () =>
      `Looks like you are a little outside our normal service area. We cover Greenville, Spartanburg, and Pickens counties. Sorry we cannot help with this one.`,
    transitions: { stop_variant: 'STOPPED' },
    terminal: true,
  },

  NEEDS_CALLBACK: {
    intent: 'KEY-VOICE: warmly acknowledge and tell them Key will reach out personally shortly. No specific time. No "y\'all" / "holler". Use "let me have Key follow up" or similar polite-professional phrasing.',
    fallback: () =>
      `No problem. I will have Key follow up with you personally on this one. He will reach out shortly.`,
    transitions: { stop_variant: 'STOPPED' },
    terminal: true,
    onEnter: { handoff: true },  // signal to set bot_disabled=1 + notify Key
  },

  STOPPED: {
    intent: null,  // no outbound after STOP — TCPA
    fallback: () => null,
    transitions: {},
    terminal: true,
    onEnter: { dnc: true },
  },
};

// Pure transition function — the heart of the bot.
//
// `ctx` may contain:
//   - first_name, address_on_file (for fallback rendering)
//   - amended_slot (set by classifier when label === 'amending_prior_answer')
//   - email_typo_suspected (set by classifier; when label === 'email_provided'
//     and this is true, route to CHECK_EMAIL_TYPO instead of AWAIT_ADDRESS_CONFIRM)
export interface TransitionResult {
  next: string
  intent: string | null
  fallback: string | null
  endConversation?: boolean
  onEnter?: Record<string, any>
  amended?: boolean
  error?: string
}

function transition(currentState: string, label: string, ctx: any = {}): TransitionResult {
  const state = STATES[currentState];
  if (!state) {
    return { next: 'NEEDS_CALLBACK', intent: STATES.NEEDS_CALLBACK.intent, fallback: STATES.NEEDS_CALLBACK.fallback(ctx), error: `Unknown state: ${currentState}` };
  }

  // ── UNIVERSAL ESCAPES (apply at every non-terminal state) ──────────────
  // These labels override the per-state transition table. They fire from
  // any non-terminal state with the same effect.
  if (!state.terminal) {
    // Stop variants: terminal STOP regardless of state.
    if (label === 'stop_variant') {
      return { next: 'STOPPED', intent: null, fallback: null, endConversation: true, onEnter: { dnc: true } };
    }
    // Asking for human → NEEDS_CALLBACK from anywhere.
    if (label === 'asking_for_human') {
      return { next: 'NEEDS_CALLBACK', intent: STATES.NEEDS_CALLBACK.intent, fallback: STATES.NEEDS_CALLBACK.fallback(ctx), endConversation: true, onEnter: { handoff: true } };
    }
    // Spouse approval needed → soft-pause to POSTPONED from anywhere.
    if (label === 'spouse_approval_needed') {
      return {
        next: 'POSTPONED',
        intent: 'customer needs to consult spouse/partner; soft-pause with NO follow-up pressure (no "by when?")',
        fallback: STATES.POSTPONED.fallback(ctx),
        endConversation: true,
      };
    }
    // Callback time requested → NEEDS_CALLBACK with time captured in ctx.requested_time.
    if (label === 'callback_time_requested') {
      return {
        next: 'NEEDS_CALLBACK',
        intent: `customer wants Key to call at ${ctx.requested_time || 'a specific time'}; acknowledge time, confirm Key gets the message, do not commit on Key's behalf with certainty`,
        fallback: STATES.NEEDS_CALLBACK.fallback(ctx),
        endConversation: true,
        onEnter: { handoff: true, requested_time: ctx.requested_time },
      };
    }
    // Don't own generator yet → NEEDS_CALLBACK so Key can recommend.
    // v10.1.3: states can OVERRIDE this universal escape — DISQUALIFIED_120V
    // has its own dont_own_generator_yet self-loop because the customer
    // already had a 120V unit and is now asking what to upgrade to. The
    // phraser handles tiered response (general spec / specific defer).
    if (label === 'dont_own_generator_yet') {
      // Check for state-specific override
      if (state.transitions && state.transitions[label]) {
        const next = state.transitions[label];
        const meta = STATES[next];
        return {
          next,
          intent: meta.intent,
          fallback: meta.fallback(ctx),
          endConversation: !!meta.terminal,
          onEnter: meta.onEnter || {},
        };
      }
      // Default behavior: route to NEEDS_CALLBACK
      return {
        next: 'NEEDS_CALLBACK',
        intent: 'customer is shopping for a generator (not bought yet); route to Key for recommendation guidance',
        fallback: STATES.NEEDS_CALLBACK.fallback(ctx),
        endConversation: true,
        onEnter: { handoff: true, reason: 'shopping_for_generator' },
      };
    }
    // Referral mentioned → self-loop with intent enriched. Customer ALSO answered
    // the state's question (extracted_value should be set); we still advance.
    if (label === 'referral_mentioned' && ctx.referral_source) {
      // Acknowledge the referral as a side note; the per-state transition
      // STILL needs to fire on whatever extracted_value is. We return a
      // self-loop with referral context; the orchestrator should re-call
      // transition with the routing label (extracted_value) on the same turn.
      return {
        next: currentState,
        intent: `customer mentioned referrer "${ctx.referral_source}"; acknowledge briefly + continue with: ${state.intent}`,
        fallback: state.fallback(ctx),
        endConversation: false,
        onEnter: { capture_referral: ctx.referral_source },
      };
    }
  }

  if (state.terminal) {
    // Terminal states ignore inbound or route to NEEDS_CALLBACK depending on flow
    if (currentState === 'COMPLETE') {
      return { next: 'NEEDS_CALLBACK', intent: STATES.NEEDS_CALLBACK.intent, fallback: STATES.NEEDS_CALLBACK.fallback(ctx), endConversation: false };
    }
    return { next: currentState, intent: null, fallback: null, endConversation: true };
  }

  // Special-case 1: amend rewinds to the slot's owning state with a
  // re-ask intent. amended_slot must be set by the classifier.
  if (label === 'amending_prior_answer' && ctx.amended_slot) {
    const rewindTarget = SLOT_TO_STATE[ctx.amended_slot];
    if (rewindTarget && STATES[rewindTarget]) {
      return {
        next: rewindTarget,
        intent: `customer is amending their earlier answer about ${ctx.amended_slot}; acknowledge the amend graciously and re-ask: ${STATES[rewindTarget].intent}`,
        fallback: STATES[rewindTarget].fallback(ctx),
        endConversation: false,
        amended: true,
      };
    }
    // Unknown slot — fall through to NEEDS_CALLBACK
    return {
      next: 'NEEDS_CALLBACK',
      intent: STATES.NEEDS_CALLBACK.intent,
      fallback: STATES.NEEDS_CALLBACK.fallback(ctx),
      endConversation: true,
      error: `Unknown amend slot: ${ctx.amended_slot}`,
    };
  }

  // Special-case 2: email-typo branching from AWAIT_EMAIL.
  // v10: AWAIT_EMAIL now captures last name + email + address combined, so the
  // happy path skips AWAIT_ADDRESS_CONFIRM (only fires if address parse failed).
  // If email is typo-suspected, route to CHECK_EMAIL_TYPO which then routes to
  // RECAP. If address was parsed cleanly alongside email, skip address state
  // entirely and go straight to RECAP.
  // v10.1.10: also fire when customer drops email at AWAIT_RUN (multi-intent
  // message where they answer the panel-location question AND volunteer
  // contact info in the same turn). Without this, AWAIT_RUN -> AWAIT_EMAIL
  // would re-ask for the same info we just received.
  if ((currentState === 'AWAIT_EMAIL' || currentState === 'AWAIT_RUN' || currentState === 'AWAIT_INSTALL_PATH' || currentState === 'AWAIT_INLET_LOCATION' || currentState === 'CONFIRM_PANEL_WALL_TYPE' || currentState === 'CONFIRM_MAIN_BREAKER') && label === 'email_provided') {
    let next;
    if (ctx.email_typo_suspected) {
      next = 'CHECK_EMAIL_TYPO';
    } else if (ctx.address_captured === false) {
      // address was NOT in the same message; need to ask for it
      next = 'AWAIT_ADDRESS_CONFIRM';
    } else {
      // happy path: email + address both captured, go straight to RECAP
      next = 'RECAP';
    }
    const meta = STATES[next];
    return {
      next,
      intent: meta.intent,
      fallback: meta.fallback(ctx),
      endConversation: !!meta.terminal,
      onEnter: meta.onEnter || {},
    };
  }

  // Special-case 3: chitchat / context-request / asking_if_human all
  // self-loop to the same state but with a modified intent that tells the
  // phraser HOW to acknowledge before re-asking.
  if (label === 'friendly_chitchat' && state.transitions[label] === currentState) {
    return {
      next: currentState,
      intent: `customer threw friendly chitchat (in chitchat_excerpt); acknowledge in 4-7 words then continue: ${state.intent}`,
      fallback: state.fallback(ctx),
      endConversation: false,
      onEnter: { acknowledge_chitchat: true },
    };
  }
  if (label === 'asking_for_context' && state.transitions[label] === currentState) {
    return {
      next: currentState,
      intent: `customer is asking what this is for; give a one-line reminder it's their generator inlet quote, then re-ask: ${state.intent}`,
      fallback: currentState === 'GREETING'
        ? `It is for your generator inlet quote. You came through our site earlier. Just a couple quick questions and Key will put a number together for you.`
        : state.fallback(ctx),
      endConversation: false,
      onEnter: { remind_context: true },
    };
  }
  // v10.1.13 (2026-05-03 Tyler-test catch): asking_if_human used to only
  // self-loop where the state's transitions table had it explicitly. At
  // RECAP and many other states it had no transition → default routed to
  // NEEDS_CALLBACK, killing the conversation. Fix: treat asking_if_human
  // as a UNIVERSAL escape that self-loops from ANY non-terminal state
  // with honest disclosure + reoffer of current state's question.
  if (label === 'asking_if_human' && !state.terminal) {
    const askPart = capFirst((state.fallback ? state.fallback(ctx) : '')
      .replace(/^(Thanks for all of that\.?|Thank you\.?|Thanks( for that)?\.?|Perfect\.?|Got it\.?|Sounds good\.?|No problem\.?|Quick recap\.?)[\s,]*/i, '')
      .trim());
    const disclosureFallback = currentState === 'GREETING'
      ? `Good question. I'm Ashley, the BPP intake assistant (automated). Our electrician Key personally handles the quote and the install, I'm just gathering the details he needs. Got a couple of minutes to walk through them?`
      : `Honest answer: I'm Ashley, the BPP intake assistant (automated). Key is our real electrician, he personally handles the quote and the install. ${askPart}`;
    return {
      next: currentState,
      intent: `customer asked if you're a real person or AI; answer honestly: this is BPP intake (automated), our electrician Key handles the actual quote and install in person. Then re-ask: ${state.intent}`,
      fallback: disclosureFallback,
      endConversation: false,
      onEnter: { disclose_ai: true },
    };
  }

  // ── v10.1.8 (2026-05-03 Alex KB cross-check + Spanish drop): NEW UNIVERSAL ESCAPES ──

  // v10.1.9 — Out-of-service-area address. Orchestrator runs jurisdiction
  // lookup post-`email_provided`; if city is in Anderson / Oconee / Cherokee /
  // Laurens / Greenwood, label gets overridden to `out_of_area_address` and
  // we route to DISQUALIFIED_OUT_OF_AREA with the courtesy message.
  if (label === 'out_of_area_address' && !state.terminal) {
    return {
      next: 'DISQUALIFIED_OUT_OF_AREA',
      intent: STATES.DISQUALIFIED_OUT_OF_AREA.intent,
      fallback: STATES.DISQUALIFIED_OUT_OF_AREA.fallback(ctx),
      endConversation: true,
      onEnter: { out_of_area: true },
    };
  }

  // Non-English inbound (Spanish or other) — BPP is English-only. Per Key
  // directive 2026-05-03: "no spanish, i dont speak it so i cant help them."
  // Bot sends a polite English message and routes to NEEDS_CALLBACK so Key
  // sees the lead. Bot does NOT attempt translation.
  if (label === 'non_english_inbound' && !state.terminal) {
    return {
      next: 'NEEDS_CALLBACK',
      intent: 'customer typed in a non-English language; reply briefly in ENGLISH ONLY explaining we currently support English-only service. Polite, no apology spiral. Then hand off to Key.',
      fallback: `Sorry, we currently support English-only at BPP. Key will follow up with you personally so we can find a way to help.`,
      endConversation: true,
      onEnter: { handoff: true, non_english_lead: true },
    };
  }

  // Out-of-scope install: customer wants an Automatic Transfer Switch (ATS)
  // or whole-home automatic standby system. BPP installs the inlet+interlock
  // for portable generators — different scope. Don't reject; route to Key
  // who can clarify scope and either pivot or refer out.
  if (label === 'out_of_scope_install' && !state.terminal) {
    return {
      next: 'NEEDS_CALLBACK',
      intent: 'customer asked about an automatic transfer switch (ATS), whole-home standby generator, or fully-automatic setup — different scope than BPP\'s portable generator inlet+interlock install. Politely flag that this is a Key conversation (different scope, different price band) and hand off. Do NOT decline outright; Key may have options.',
      fallback: `Got it. The automatic / whole-home setup is a different scope than what we typically install (inlet + interlock for portable generators). Key would be happy to walk through what those options look like, I will have him reach out shortly.`,
      endConversation: true,
      onEnter: { handoff: true, scope_mismatch_ats: true },
    };
  }

  // v10.1.12 — Urgent callback demand. Customer is panicking / time-pressed.
  // Routes to NEEDS_CALLBACK with priority flag so Key sees a red badge.
  if (label === 'urgent_callback_demand' && !state.terminal) {
    return {
      next: 'NEEDS_CALLBACK',
      intent: 'customer is urgently demanding Key call them NOW (storm, panic, time-pressure). Acknowledge urgency + reassure Key gets the message immediately. Do not commit Key to specific time.',
      fallback: `Got it, sending Key your number now so he can reach out as soon as he's free. Hang tight.`,
      endConversation: true,
      onEnter: { handoff: true, priority: 'urgent' },
    };
  }

  // v10.1.12 — Customer prefers email channel. Acknowledge + capture preference.
  // Continue text-based qualification flow (still need answers to qualify).
  if (label === 'prefers_email_channel' && !state.terminal) {
    // At GREETING, the customer is opting for email before the bot has
    // asked any qualifying questions. Don't re-send the full greeting;
    // just ack + ask the simple "ok to walk through?" question.
    if (currentState === 'GREETING' || currentState === 'GREETING_RETRY') {
      return {
        next: currentState,
        intent: `customer asked for email channel at GREETING. Acknowledge briefly + reoffer the walk-through.`,
        fallback: `Got it, will pass to Key, the quote goes via email anyway. Just need a few quick details by text first. Got a couple of minutes?`,
        endConversation: false,
        onEnter: { prefers_email_channel: true },
      };
    }
    const askPart = capFirst((state.fallback ? state.fallback(ctx) : '')
      .replace(/^(Thank you\.?|Thanks( for that)?\.?|Perfect\.?|Got it\.?|Sounds good\.?|No problem\.?)[\s,]*/i, '')
      .trim());
    return {
      next: currentState,
      intent: `customer asked to be contacted via email instead of text. Acknowledge the preference (Key will send the quote via email primarily) but note we still need a few details by text to put it together. Then continue.`,
      fallback: `Got it, will note that. Key sends the quote via email anyway, just need a few details by text first. ${askPart}`,
      endConversation: false,
      onEnter: { prefers_email_channel: true },
    };
  }

  // v10.1.12 — Customer mentioned HOA approval. Brief ack + Key handles
  // HOA submittal package (some neighborhoods require). Continue flow.
  if (label === 'mentions_hoa' && !state.terminal) {
    const askPart = capFirst((state.fallback ? state.fallback(ctx) : '')
      .replace(/^(Thank you\.?|Thanks( for that)?\.?|Perfect\.?|Got it\.?|Sounds good\.?|No problem\.?)[\s,]*/i, '')
      .trim());
    return {
      next: currentState,
      intent: `customer mentioned needing HOA approval. Acknowledge briefly (Key can put together a submittal package if your HOA needs one). Continue with current state's ask.`,
      fallback: `Good call. Key can put together an HOA submittal package if your neighborhood needs one, just let him know on the install call. ${askPart}`,
      endConversation: false,
      onEnter: { mentions_hoa: true },
    };
  }

  // Credential trust check: "are you licensed?", "are you insured?", "do you
  // have insurance?", "are you bonded?". Brief factual answer + continue
  // current state's question. Self-loop pattern.
  if (label === 'asking_about_credentials' && !state.terminal) {
    const askPart = capFirst((state.fallback ? state.fallback(ctx) : '')
      .replace(/^(Thank you\.?|Thanks( for that)?\.?|Perfect\.?|Got it\.?|Sounds good\.?|No problem\.?)[\s,]*/i, '')
      .trim());
    return {
      next: currentState,
      intent: `customer asked a credential / trust question (licensed, insured, bonded, certified). Answer briefly and factually: Key is a licensed SC electrician, BPP carries general liability insurance, permit + inspection on every install. Then continue with the current state's ask. Polite-professional, no defensiveness. Zero em-dashes.`,
      fallback: `Yes. Key is a licensed SC electrician, BPP carries general liability, permit and inspection on every install. ${askPart}`,
      endConversation: false,
      onEnter: { credentials_disclosed: true },
    };
  }

  // No need to redefine asking_about_surge_protector — it's already below.

  // v10.1.10 — asking_clarifying_technical at specific states needs an
  // actual explanation, not just re-asking the same question. The plain
  // self-loop in transition table dumps to state.fallback() which doesn't
  // address the customer's confusion. Provide state-specific clarifications
  // that ARE self-contained (don't append the state's full fallback after,
  // which doubles message length).
  if (label === 'asking_clarifying_technical' && !state.terminal) {
    // v10.1.11 — topic matcher. Detect whether the customer's question is
    // ON-TOPIC (related to current state's slot) or OFF-TOPIC (about
    // sizing, install procedure, soft-start kits, etc.). Off-topic
    // clarifying questions get a Key-call defer + state ask (don't
    // pretend to answer something the state's explanation can't address).
    const stateTopicKeywords = {
      AWAIT_240V: /\b(240|volt|amp|outlet|prong|twist.?lock|nema|l14|l5|tt-?30|14-?50)\b/i,
      AWAIT_OUTLET: /\b(240|volt|amp|outlet|prong|twist.?lock|nema|l14|l5|tt-?30|14-?50)\b/i,
      AWAIT_PANEL_PHOTO: /\b(panel|breaker|box|main|amperage|150|200|400)\b/i,
      AWAIT_OUTLET_PHOTO: /\b(outlet|prong|twist.?lock|amp|240|volt)\b/i,
      AWAIT_RUN: /\b(panel|location|garage|basement|interior|exterior|wall|run|distance|cord|conduit)\b/i,
      AWAIT_INSTALL_PATH: /\b(attic|crawl|crawlspace|access|cable|conduit|route|run)\b/i,
    };
    const explanations = {
      AWAIT_240V: `No worries, the 240V outlet is the larger one on the generator (4-prong twist-lock or 50-amp dryer-style plug). A pic of the outlet works too if easier.`,
      AWAIT_OUTLET: `No worries, the 30 amp 4-prong twist-lock is round with 4 holes; the 50 amp is bigger and looks like a dryer plug. A pic works too if easier.`,
      AWAIT_PANEL_PHOTO: `No problem. The main panel is the metal box inside the house with the breaker switches (closet, garage, basement, or utility room). Open the door so the breakers are visible and snap one whenever you can.`,
      AWAIT_OUTLET_PHOTO: `No worries, just a quick photo of the outlet on the side of the generator. Usually a small panel with 1-3 outlets visible.`,
      AWAIT_RUN: `Most main panels are either in the garage on an exterior wall (best case) or on an interior wall (basement, closet). Which is yours?`,
      AWAIT_INSTALL_PATH: `Attic access is a hatch or pull-down stairs. Crawlspace is the low space under the floor (usually accessed from outside). Either gives Key a way to run the cable. Do you have either?`,
    };
    if (explanations[currentState]) {
      const customerText = (ctx.customer_last_message || ctx.extracted_value || '').toLowerCase();
      const topicRe = stateTopicKeywords[currentState];
      const onTopic = topicRe ? topicRe.test(customerText) : true;
      if (onTopic) {
        return {
          next: currentState,
          intent: `customer asked an ON-TOPIC clarifying question at ${currentState}; give a state-specific brief explanation that ALSO embeds the re-ask, no double-question. Zero em-dashes.`,
          fallback: explanations[currentState],
          endConversation: false,
          onEnter: { explained: true },
        };
      }
      // OFF-TOPIC technical question — defer to Key + continue with state ask.
      const askPart = capFirst((state.fallback ? state.fallback(ctx) : '')
        .replace(/^(Thank you\.?|Thanks( for that)?\.?|Perfect\.?|Got it\.?|Sounds good\.?|No problem\.?)[\s,]*/i, '')
        .trim());
      return {
        next: currentState,
        intent: `customer asked an OFF-TOPIC technical question at ${currentState}; defer to Key (he can walk through it on the call) and continue with the current state's ask. Zero em-dashes.`,
        fallback: `Good question, that one's a Key call, he can walk through it on the call. ${askPart}`,
        endConversation: false,
        onEnter: { off_topic_clarifying: true },
      };
    }
    // Fall through to default self-loop for states without a specific explanation
  }

  // v10.1.9 — Surge-protector question (Alex Topic 7). Customer asked about
  // whole-home surge protector or surge protection in general. Brief defer
  // (Key handles surge recommendations on the install call) + continue.
  if (label === 'asking_about_surge_protector' && !state.terminal) {
    const askPart = capFirst((state.fallback ? state.fallback(ctx) : '')
      .replace(/^(Thank you\.?|Thanks( for that)?\.?|Perfect\.?|Got it\.?|Sounds good\.?|No problem\.?)[\s,]*/i, '')
      .trim());
    return {
      next: currentState,
      intent: `customer asked about whole-home surge protector / surge protection. Brief honest answer: Key handles whole-home surge protector options on the install call (it can be added to the panel during the same install). Continue with current state's ask afterward. Zero em-dashes.`,
      fallback: `Good question. Key handles surge protector options on the install call (can be added during the same visit). ${askPart}`,
      endConversation: false,
      onEnter: { surge_protector_question: true },
    };
  }

  // ── Special-case for COVERAGE / SIZING questions (v10.1.7 — Key directive 2026-05-03) ──
  // Customer asks "will my generator power my home / run my AC / handle my appliances".
  // Ashley MUST NOT answer. Defer to Key, thank them for the question, and CONTINUE
  // the current state's question (don't dead-end to NEEDS_CALLBACK).
  // Applies in any non-terminal state where the customer asked a coverage question.
  // v10.1.9 polish: shortened bridge (was 200+ chars combined with state ask;
  // now ~80 chars) + zero em-dashes per Key voice rules.
  if (label === 'coverage_question' && !state.terminal) {
    const rawAsk = state.fallback ? state.fallback(ctx) : '';
    const askPart = capFirst(rawAsk
      .replace(/^(Thank you\.?|Thanks( for that)?\.?|Perfect\.?|Got it\.?|Sounds good\.?|No problem\.?|Quick recap\.?)[\s,]*/i, '')
      .trim());
    return {
      next: currentState,
      intent: `customer asked a generator coverage / sizing / load question (in ctx.coverage_excerpt). Ashley MUST NOT answer — that is a Key call (he handles sizing and load personally). Lead with thanks for the question, defer it to Key explicitly ("Key handles sizing and load questions personally"), and CONTINUE with the current state's ask (do not dead-end). Zero em-dashes. Re-ask: ${state.intent}`,
      fallback: `That one's a Key call, he handles sizing and load personally. In the meantime, ${lcFirst(askPart)}`,
      endConversation: false,
      onEnter: { defer_coverage_to_key: true, coverage_excerpt: ctx.coverage_excerpt || null },
    };
  }

  // Special-case for DISQUALIFIED_120V follow-up questions (v10.1.6).
  // When the customer asks a clarifying technical question or "what should
  // I get instead", give a tiered fallback: general spec only (NEVER name
  // a specific model). Bot defers specific-model questions to Key.
  if (currentState === 'DISQUALIFIED_120V') {
    if (label === 'asking_clarifying_technical' || label === 'dont_own_generator_yet') {
      // Look at the customer's last message (extracted_value) for a
      // specific brand+model — if found, defer to Key explicitly.
      const last = (ctx.extracted_value || ctx.customer_last_message || '').toLowerCase();
      const brandPattern = /(generac|champion|honda|westinghouse|predator|duromax|firman|ryobi|briggs|wen|harbor freight|northstar|cummins|kohler|onan|pulsar|powerstroke|powerhorse|simpson|titan)/i;
      const hasSpecificModel = brandPattern.test(last);
      if (hasSpecificModel) {
        return {
          next: 'DISQUALIFIED_120V',
          intent: 'customer at DQ_120V asked about a specific generator model; do NOT recommend or reject. Defer to Key politely and say Key can weigh in directly.',
          fallback: `Honestly that's a Key call, he sees the specific specs day-to-day. I will pass the question to him so he can weigh in directly.`,
          endConversation: false,
          onEnter: { handoff_recommendation_question: true },
        };
      }
      return {
        next: 'DISQUALIFIED_120V',
        intent: 'customer at DQ_120V asked for general guidance on what generator to get; give general spec only — what makes a generator work with the BPP install (240V outlet + 4-prong twist-lock or 50-amp). Do NOT name specific models. Do NOT promise a wattage will power their home or any specific appliances — sizing/load is Key\'s call. Lead with thanks.',
        fallback: `Thanks for asking. For our install side, the generator just needs a 240V outlet, either the 4-prong twist-lock (L14-30) or the 4-prong 50-amp. As for the wattage to actually run your home, Key handles sizing and load questions personally and would walk through that with you.`,
        endConversation: false,
      };
    }
  }

  // Special-case 4: answered_with_impatience routes on the underlying
  // answer (state.transitions[label] is set to the next state) but the
  // intent tells the phraser to also reassure the customer.
  if (label === 'answered_with_impatience') {
    const next = state.transitions[label];
    if (next && STATES[next]) {
      return {
        next,
        intent: `customer answered but added impatience (in impatience_excerpt); reassure they're almost done in <10 words, then continue: ${STATES[next].intent}`,
        fallback: STATES[next].fallback(ctx),
        endConversation: !!STATES[next].terminal,
        onEnter: { reassure_impatient: true },
      };
    }
  }

  const nextState = state.transitions[label] || 'NEEDS_CALLBACK';
  const nextMeta = STATES[nextState];
  return {
    next: nextState,
    intent: nextMeta.intent,
    fallback: nextMeta.fallback(ctx),
    endConversation: !!nextMeta.terminal,
    onEnter: nextMeta.onEnter || {},
  };
}

function getStateMeta(state: string): any {
  return STATES[state] || null;
}

function listStates(): string[] {
  return Object.keys(STATES);
}

export { transition, getStateMeta, listStates, STATES };
export default { transition, getStateMeta, listStates, INITIAL_STATE, STATES };
