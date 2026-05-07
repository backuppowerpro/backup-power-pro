// Brutal scenarios — pretending to be the customer, hitting Maya with
// every weird real-world thing I can think of.
//
// Each scenario has:
//   name, first_name, greeting_variant
//   turns: [{customer, label, photo?, gen_brand_model?, ctx_overlay?}]
//
// label is the classifier's expected emit. photo and gen_brand_model are
// optional triggers that override the label dynamically (mirrors
// orchestrator behavior).

'use strict';

module.exports = [
  // ─────────────────────────────────────────────────────────────
  // SCENARIO 1: The "hot install" — Square D garage exterior, 50A
  // Generac, sends panel pic on first ask. Should run clean.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S1 — clean Square D garage exterior 50A',

    expected_terminal: 'COMPLETE',
    first_name: 'Sarah',
    greeting_variant: 'A',
    turns: [
      { customer: 'yeah go ahead', label: 'affirmative' },
      { customer: 'yes 240 50 amp', label: 'outlet_50a' },
      { customer: '[sends panel photo, Square D, main panel open clear, breakers visible]', label: 'photo_received', photo: 'main panel open clear, square d, breakers visible' },
      { customer: 'yes garage on the exterior wall', label: 'panel_garage_exterior' },
      { customer: 'Sarah Bennett, sbennett@gmail.com, 142 Pinehurst Dr Greer SC 29651', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes that looks right', label: 'affirmative' },
      { customer: 'thanks', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 2: 30A 3-prong trap (TT-30R RV outlet, 120V only)
  // Customer is sure their generator is 30A. Bot must DISAMBIGUATE.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S2 — 30A but 3-prong RV outlet (TT-30R 120V only)',

    expected_terminal: 'DISQUALIFIED_120V',
    first_name: 'Mike',
    greeting_variant: 'A',
    turns: [
      { customer: 'sure', label: 'affirmative' },
      { customer: '30 amp', label: 'outlet_30a_unspecified' },
      { customer: 'its 3 prong, like an rv plug', label: 'outlet_30a_3prong' },
      // After soft-DQ, customer asks what to upgrade to
      { customer: 'so what kind should I get', label: 'dont_own_generator_yet' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 3: Sub-panel sent first (Maya must re-ask for main)
  // Then they send a Zinsco panel — hazardous, flag for replacement
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S3 — sub-panel first, then Zinsco main panel',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Don',
    greeting_variant: 'A',
    turns: [
      { customer: 'ok', label: 'affirmative' },
      { customer: 'yes 50 amp 4 prong', label: 'outlet_50a' },
      { customer: '[sends sub-panel photo from workshop, no main breaker visible]', label: 'photo_correction', photo: 'sub-panel photo, workshop subpanel, no main breaker visible' },
      { customer: '[sends main panel, Zinsco silver bus bars and pink/blue/green breakers]', label: 'photo_received', photo: 'zinsco panel main, silver bus bars, pink/blue/green breakers visible, sylvania label' },
      { customer: 'in the basement on an interior wall', label: 'panel_basement' },
      { customer: 'yeah we have a crawlspace under the house', label: 'crawlspace_access' },
      { customer: 'Don Hollis, dhollis62@yahoo.com, 88 Foggy Oak Ln Spartanburg SC 29307', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yep all good', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 4: Predator 3500 trap — known 120V-only inverter.
  // Bot should DQ from generator-spec lookup before asking voltage.
  // Customer pushes for recommendations. Must not over-promise.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S4 — Predator 3500 + recommendation push',

    expected_terminal: 'DISQUALIFIED_120V',
    first_name: 'Justin',
    greeting_variant: 'D',
    turns: [
      { customer: 'predator 3500', label: 'gen_brand_model', gen_brand_model: 'predator 3500' },
      { customer: 'damn ok. so what generator should I get', label: 'dont_own_generator_yet' },
      { customer: 'cool. is the dewalt dxgnr7000 ok', label: 'asking_clarifying_technical' },
      { customer: 'thanks', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 5: Champion 8500 lookup compatible — bot skips voltage
  // check, advances directly to panel photo. Panel is on interior
  // wall in basement. Has attic access.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S5 — Champion 8500 (known compatible) + interior basement',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Patricia',
    greeting_variant: 'D',
    turns: [
      { customer: 'champion 8500', label: 'gen_brand_model', gen_brand_model: 'champion 8500' },
      // After lookup compatible_30a, bot jumps to AWAIT_PANEL_PHOTO; customer sends panel pic next
      { customer: '[sends main panel photo, Eaton CH, clear]', label: 'photo_received', photo: 'main panel open clear, eaton, breakers visible' },
      { customer: 'no, basement', label: 'panel_basement' },
      { customer: 'we have an attic too', label: 'attic_access' },
      { customer: 'Patricia Wells, pat.wells@gmail.com, 7012 Coachlight Dr Simpsonville SC 29680', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'looks right', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 6: Hostile / asking for human / wants pricing.
  // Maya MUST NOT quote prices. Must hand off to Key.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S6 — hostile, demands price + human',

    expected_terminal: 'NEEDS_CALLBACK',
    first_name: 'Tony',
    greeting_variant: 'A',
    turns: [
      { customer: "what's this gonna cost me", label: 'off_topic_question' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 7: FPE Stab-Lok hazardous panel.
  // Customer cooperates fully but sends an FPE panel pic.
  // Should accept_flag_hazardous, route through normal flow but Key
  // gets a panel-replacement-first ping.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S7 — FPE Stab-Lok hazardous panel',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Diana',
    greeting_variant: 'C',
    turns: [
      { customer: 'sure I have a few mins', label: 'affirmative' },
      { customer: 'yes 30 amp 4 prong twist lock', label: 'outlet_30a_4prong' },
      { customer: '[sends panel photo, Federal Pacific Stab-Lok, red label, thin breaker handles]', label: 'photo_received', photo: 'federal pacific panel, stab-lok, fpe label, thin breaker handles, red label visible' },
      { customer: 'on the outside actually, mounted to the back of the house', label: 'panel_outdoor' },
      { customer: 'Diana Rodriguez, drod1985@gmail.com, 51 Indigo Hill Rd Pickens SC 29671', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes correct', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 8: STOP / unsubscribe at random point.
  // Must terminate immediately, no further outbound.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S8 — customer says STOP mid-flow',

    expected_terminal: 'STOPPED',
    first_name: 'Pat',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'STOP', label: 'stop_variant' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 9: Honda EU7000iS — voltage-selector switch.
  // Spec says voltage_selector_check. Bot should still ask voltage.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S9 — Honda EU7000iS (voltage selector)',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Brad',
    greeting_variant: 'D',
    turns: [
      { customer: 'honda eu7000is', label: 'gen_brand_model', gen_brand_model: 'honda eu7000is' },
      { customer: 'yes 240v 30 amp 4 prong', label: 'outlet_30a_4prong' },
      { customer: '[sends panel pic, Square D Homeline, clear]', label: 'photo_received', photo: 'main panel open square d homeline clear breakers' },
      { customer: 'yes garage exterior wall', label: 'panel_garage_exterior' },
      { customer: 'Brad Foster, brad.foster73@gmail.com, 209 Hampton Ridge Dr Greenville SC 29615', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'all good', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 10: Customer in box / refuses to unbox photo.
  // After volunteering brand+model from CLARIFY_240V, lookup matches
  // compatible_30a → bot advances to AWAIT_PANEL_PHOTO.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S10 — generator in box, brand+model resolves via lookup',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Greg',
    greeting_variant: 'A',
    turns: [
      { customer: 'yeah', label: 'affirmative' },
      { customer: 'not sure, its still in the box', label: 'gen_unsure' },
      // CLARIFY_240V — customer volunteers brand+model in lieu of photo.
      // Lookup matches compatible_30a → orchestrator overrides to gen_240v
      // → CLARIFY_240V transitions to AWAIT_OUTLET. Then they need to volunteer
      // L14-30 4-prong since CLARIFY_240V doesn't auto-skip-outlet (only
      // GREETING does in our v10.1.6 fix).
      { customer: 'westinghouse wgen7500', label: 'gen_brand_model', gen_brand_model: 'westinghouse wgen7500' },
      { customer: 'l14-30 4 prong yes', label: 'outlet_30a_4prong' },
      { customer: '[sends panel photo, Siemens, main open]', label: 'photo_received', photo: 'main panel open siemens clear breakers visible' },
      { customer: 'garage exterior wall yes', label: 'panel_garage_exterior' },
      { customer: 'Greg Tanner, gtanner@yahoo.com, 1850 Roper Mountain Rd Greenville SC 29615', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 11: Wrong photos repeatedly (selfie, then living room,
  // then meter outside, then finally panel)
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S11 — sends 3 wrong photos before getting it right',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Carl',
    greeting_variant: 'A',
    turns: [
      { customer: 'yeah lets go', label: 'affirmative' },
      { customer: '50 amp 4 prong yes', label: 'outlet_50a' },
      { customer: '[accidentally sends a selfie]', label: 'photo_correction', photo: 'selfie of customer face' },
      { customer: '[sends meter outside the house]', label: 'photo_correction', photo: 'meter outside on wall' },
      { customer: '[sends panel finally, Eaton, clear]', label: 'photo_received', photo: 'main panel open eaton clear' },
      { customer: 'garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Carl Marsh, cmarsh77@gmail.com, 412 Riverbend Dr Greenville SC 29609', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yep', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 12: Spouse approval — soft pause then resumes
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S12 — spouse approval pause',

    expected_terminal: 'POSTPONED',
    first_name: 'Linda',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'yes 240 50 amp', label: 'outlet_50a' },
      { customer: 'let me check with my husband first', label: 'spouse_approval_needed' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 13: Pricing question early ("how much"), then continues
  // when bot says Key prepares the quote.
  // Must NOT name a price.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S13 — pricing demand early',

    expected_terminal: 'NEEDS_CALLBACK',
    first_name: 'Nate',
    greeting_variant: 'A',
    turns: [
      { customer: 'how much for an inlet install', label: 'off_topic_question' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 14: Renter volunteers status → DQ_RENTER
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S14 — renter volunteers',

    expected_terminal: 'DISQUALIFIED_RENTER',
    first_name: 'Beverly',
    greeting_variant: 'A',
    turns: [
      { customer: "yes but I'm renting btw, would my landlord need to approve", label: 'renter' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 15: Asking if AI/human at GREETING. Bot must self-disclose
  // honestly without breaking the flow.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S15 — "are you a bot?" check',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Trevor',
    greeting_variant: 'A',
    turns: [
      { customer: 'are you a real person or a bot', label: 'asking_if_human' },
      { customer: 'ok yeah lets do it', label: 'affirmative' },
      { customer: 'yes 50 amp', label: 'outlet_50a' },
      { customer: '[sends panel photo, GE, clear]', label: 'photo_received', photo: 'main panel open ge clear' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Trevor Kim, tkim@gmail.com, 7 Sycamore Way Mauldin SC 29662', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes good', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 16: Detached garage panel (panel_other) → AWAIT_INSTALL_PATH
  // Customer says no attic + no crawlspace → NEEDS_CALLBACK
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S16 — detached garage, no attic, no crawlspace',

    expected_terminal: 'NEEDS_CALLBACK',
    first_name: 'Tom',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'yes 50 amp', label: 'outlet_50a' },
      { customer: '[sends panel photo, Square D, main panel open]', label: 'photo_received', photo: 'main panel open square d qo clear' },
      { customer: 'detached garage building', label: 'panel_other' },
      { customer: 'no attic and the house is on a slab', label: 'no_access' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ROUND 2 — harder edge cases
  // ═══════════════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 17: Email typo (gmial.com) → CHECK_EMAIL_TYPO
  // Customer corrects → RECAP → COMPLETE
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S17 — email typo gmial.com',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Mark',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'yes 50 amp', label: 'outlet_50a' },
      { customer: '[sends panel photo, Eaton, main panel open]', label: 'photo_received', photo: 'main panel open eaton clear' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Mark Davies, mdavies82@gmial.com, 1011 Westbrook Ln Greer SC 29651', label: 'email_provided', ctx_overlay: { email_typo_suspected: true, email_likely_meant: 'mdavies82@gmail.com', address_captured: true } },
      { customer: 'oh whoops, mdavies82@gmail.com', label: 'address_corrected' },
      { customer: 'yep all good', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 18: Out-of-area address (Atlanta, GA)
  // The state machine doesn't currently route DISQUALIFIED_OUT_OF_AREA;
  // address-zip check happens in production. Lab can flag it via Key
  // notify. Test: bot doesn't reject mid-conversation, completes via
  // RECAP, but Key gets a flagged handoff.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S18 — out-of-area Atlanta address',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Steve',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'yes 50 amp', label: 'outlet_50a' },
      { customer: '[sends panel photo, GE, clear]', label: 'photo_received', photo: 'main panel open ge clear' },
      { customer: 'yes garage exterior wall', label: 'panel_garage_exterior' },
      { customer: 'Steve Hollins, shollins@gmail.com, 4202 Peachtree Rd Atlanta GA 30319', label: 'email_provided', ctx_overlay: { address_captured: true, out_of_area: true } },
      { customer: 'yes correct', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 19: After 120V DQ, customer asks for specific
  // generator recommendation. Bot must NOT recommend specific models —
  // give general spec ("at least 240V, around 5,000W minimum"), defer
  // specific model questions to Key.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S19 — DQ then "should I get the Generac GP6500"',

    expected_terminal: 'DISQUALIFIED_120V',
    first_name: 'Janet',
    greeting_variant: 'A',
    turns: [
      { customer: 'sure', label: 'affirmative' },
      { customer: 'just regular outlets, 120v', label: 'gen_120v' },
      { customer: 'so should I get a Generac GP6500?', label: 'asking_clarifying_technical' },
      { customer: 'ok thanks', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 20: Customer asks about install timing / "what days"
  // Bot MUST NOT promise weekday or specific date — defer to Key.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S20, "what days do you install" timing push',

    // v10.1.36 changed off_topic_question at AWAIT_240V to self-loop instead
    // of NEEDS_CALLBACK (less callback-spammy). "yeah" routes GREETING to
    // AWAIT_240V (affirmative-as-continue), then "what days" self-loops.
    // Final terminal is AWAIT_240V. Was NEEDS_CALLBACK pre-v10.1.36.
    expected_terminal: 'AWAIT_240V',
    first_name: 'Walter',
    greeting_variant: 'A',
    turns: [
      { customer: 'yeah', label: 'affirmative' },
      { customer: 'what days do yall do installs', label: 'off_topic_question' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 21: Customer claims 4-prong but PHOTO shows 3-prong.
  // Photo classifier should override — DQ via 120V.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S21 — claims 4-prong, photo shows 3-prong (TT-30R)',

    expected_terminal: 'DISQUALIFIED_120V',
    first_name: 'Bobby',
    greeting_variant: 'A',
    turns: [
      { customer: 'yeah I think 4 prong', label: 'outlet_30a_4prong' },  // bot routes to AWAIT_PANEL_PHOTO
      { customer: '[sends outlet photo, TT-30R RV-style 3-prong 120V]', label: 'outlet_30a_3prong', photo: 'tt-30 rv-style 3-prong 30 amp outlet' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 22: amending prior answer mid-flow
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S22 — amending: "actually it\'s 30 amp not 50"',
    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Karen',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'yeah 50 amp', label: 'outlet_50a' },
      { customer: 'wait actually I think its 30 amp 4 prong, my mistake', label: 'amending_prior_answer', ctx_overlay: { amended_slot: '240v' } },
      { customer: 'yes 30 amp 4 prong twist lock', label: 'outlet_30a_4prong' },
      { customer: '[sends panel photo, Square D, clear]', label: 'photo_received', photo: 'main panel open square d clear' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Karen Lee, klee@gmail.com, 88 Birchwood Way Greer SC 29651', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 23: Big chitchat — neighbor referral, lots of talk
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S23 — neighbor referral + chitchat',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Holly',
    greeting_variant: 'A',
    turns: [
      { customer: "yeah! my neighbor Bob on Hampton said y'all did his last month and he loved it haha", label: 'affirmative', ctx_overlay: { referral_source: 'Bob on Hampton' } },
      { customer: 'yes 50 amp', label: 'outlet_50a' },
      { customer: '[sends panel photo, Square D Homeline, open]', label: 'photo_received', photo: 'main panel open square d homeline clear' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Holly Briggs, hbriggs@gmail.com, 5 Hampton Lake Dr Greer SC 29651', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes good thanks!', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 24: Customer wants to specify install location
  // (custom run length / wants box around the side, not behind panel)
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S24 — custom install location request',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Frank',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'yes 50 amp', label: 'outlet_50a' },
      { customer: '[sends panel photo, Eaton, clear]', label: 'photo_received', photo: 'main panel open eaton clear' },
      { customer: 'panel is in the garage but I want the inlet around the side near my carport', label: 'panel_other' },
      { customer: 'yes there is attic access above the garage', label: 'attic_access' },
      { customer: 'Frank Vance, fvance51@gmail.com, 707 Cedar Hill Dr Greenville SC 29615', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ROUND 3 — coverage / sizing / "will power" defer scenarios (v10.1.7)
  // ═══════════════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 25: "Will my generator power my whole house?"
  // Bot MUST NOT answer with a yes/no/"easily" — must defer to Key
  // and continue the qualification flow.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S25 — "will it power my whole house" mid-flow',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Andy',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: "will my 7500W generator power my whole house?", label: 'coverage_question', ctx_overlay: { coverage_excerpt: 'will my 7500W generator power my whole house?' } },
      { customer: 'yes 30 amp 4 prong', label: 'outlet_30a_4prong' },
      { customer: '[sends panel photo, Square D, clear]', label: 'photo_received', photo: 'main panel open square d clear' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Andy Holt, aholt@gmail.com, 33 Magnolia Way Greenville SC 29615', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 26: "Is the Generac 7500 enough for my AC and fridge?"
  // Specific appliance load — Key call. Defer + continue.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S26 — "is Generac 7500 enough for AC + fridge"',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Lisa',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'is the Generac 7500 enough to run my AC and fridge?', label: 'coverage_question', ctx_overlay: { coverage_excerpt: 'is the Generac 7500 enough to run my AC and fridge?' } },
      { customer: 'yes 30 amp 4 prong', label: 'outlet_30a_4prong' },
      { customer: '[sends panel photo, GE, clear]', label: 'photo_received', photo: 'main panel open ge clear' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Lisa Bremer, lbremer@gmail.com, 9 Greenway Ct Greer SC 29651', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes correct', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 27: Coverage question DURING DQ_120V flow
  // Customer at DQ asks "what wattage will run my whole house" —
  // Bot defers (sizing is Key's call) and stays parked in DQ.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S27 — DQ_120V + coverage push',

    expected_terminal: 'DISQUALIFIED_120V',
    first_name: 'Otis',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'just a 120v inverter', label: 'gen_120v' },
      { customer: 'so what wattage do I need to actually power my whole house?', label: 'coverage_question', ctx_overlay: { coverage_excerpt: 'what wattage do I need to actually power my whole house' } },
      { customer: 'ok thanks', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 28: "Will the Honda EU7000iS run my heat pump?"
  // Specific appliance — defer.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S28 — Honda EU7000iS + heat pump load question',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Ray',
    greeting_variant: 'D',
    turns: [
      { customer: 'honda eu7000is', label: 'gen_brand_model', gen_brand_model: 'honda eu7000is' },
      { customer: 'will it run my heat pump and my fridge?', label: 'coverage_question', ctx_overlay: { coverage_excerpt: 'will it run my heat pump and my fridge' } },
      { customer: 'yes 240v 30 amp 4 prong', label: 'outlet_30a_4prong' },
      { customer: '[sends panel photo, Eaton, clear]', label: 'photo_received', photo: 'main panel open eaton clear' },
      { customer: 'yes garage exterior wall', label: 'panel_garage_exterior' },
      { customer: 'Ray Polk, rpolk@gmail.com, 88 Forest Trail Pickens SC 29671', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'looks right', label: 'affirmative' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ROUND 4 — v10.1.8 Alex KB cross-check + Key directives (2026-05-03)
  // ═══════════════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────
  // SCENARIO N1: Spanish inbound — bot replies in English only +
  // routes to NEEDS_CALLBACK. Doesn't attempt translation.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'N1 — Spanish inbound (English-only response + handoff)',

    expected_terminal: 'NEEDS_CALLBACK',
    first_name: 'Maria',
    greeting_variant: 'A',
    turns: [
      { customer: 'Hola, necesito ayuda con un generador. Hablan español?', label: 'non_english_inbound' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO N2: Customer wants a fully automatic transfer switch.
  // BPP doesn't install ATS — Maya routes to Key for scope discussion.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'N2 — wants ATS / fully automatic setup',

    expected_terminal: 'NEEDS_CALLBACK',
    first_name: 'Roy',
    greeting_variant: 'A',
    turns: [
      { customer: 'I want an automatic transfer switch so it kicks on when the power goes out', label: 'out_of_scope_install' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO N3: Customer has a 22kW Generac standby (whole-home).
  // Different scope. Should route to Key callback.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'N3 — 22kW Generac whole-home standby',

    expected_terminal: 'NEEDS_CALLBACK',
    first_name: 'Pete',
    greeting_variant: 'D',
    turns: [
      { customer: 'I have a 22kW Generac whole-home standby generator already installed', label: 'out_of_scope_install' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO N4: Customer asks "are you licensed and insured?"
  // mid-flow. Bot answers briefly + continues.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'N4 — "are you licensed and insured" mid-flow',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Susan',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'quick question are you licensed and insured?', label: 'asking_about_credentials' },
      { customer: 'yes 50 amp', label: 'outlet_50a' },
      { customer: '[sends panel photo, Square D, clear]', label: 'photo_received', photo: 'main panel open square d clear' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Susan Drake, sdrake@gmail.com, 712 Riverbend Dr Greenville SC 29609', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ROUND 5 — v10.1.9 (brand-only UX, load mentions, jurisdiction, surge)
  // ═══════════════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────
  // SCENARIO N5: Brand only ("I have a Champion" — no model).
  // Generator-lookup returns brand_only. Bot acks brand + asks for
  // model alongside voltage check.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'N5 — brand only, no model (Champion)',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Phil',
    greeting_variant: 'D',
    turns: [
      { customer: 'champion', label: 'gen_brand_model', gen_brand_model: 'champion' },
      { customer: 'oh I think 7500 maybe', label: 'gen_brand_model', gen_brand_model: 'champion 7500' },
      { customer: '[sends panel photo, GE, clear]', label: 'photo_received', photo: 'main panel open ge clear' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Phil Adkins, padkins@gmail.com, 41 Pinegate Way Greer SC 29651', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO N6: Customer mentions central AC, well pump, AND EV charger
  // across multiple turns. Load detector should pick all three up;
  // Maya doesn't change flow but Key gets context in handoff.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'N6 — multiple load mentions for Key context',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Lara',
    greeting_variant: 'A',
    turns: [
      { customer: "yes, especially worried about my central AC during summer outages", label: 'affirmative' },
      { customer: 'yes 50 amp, also have a well pump and a level 2 EV charger', label: 'outlet_50a' },
      { customer: '[sends panel photo, Square D, clear]', label: 'photo_received', photo: 'main panel open square d clear' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Lara Quinn, lquinn@gmail.com, 88 Hidden Spring Ln Simpsonville SC 29680', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO N7: Customer in Boiling Springs (commonly mistaken
  // for Greenville — actually Spartanburg). Jurisdiction lookup
  // captures Spartanburg County for permit handoff.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'N7 — Boiling Springs jurisdiction trap (Spartanburg, not Greenville)',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Hank',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'yes 50 amp', label: 'outlet_50a' },
      { customer: '[sends panel photo, Eaton, clear]', label: 'photo_received', photo: 'main panel open eaton clear' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Hank Reeves, hreeves@gmail.com, 1101 Brookside Dr Boiling Springs SC 29316', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO N8: Customer in Seneca (Oconee — OUT of service).
  // Jurisdiction lookup auto-routes to DISQUALIFIED_OUT_OF_AREA.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'N8 — Seneca/Oconee out-of-service auto-DQ',

    expected_terminal: 'DISQUALIFIED_OUT_OF_AREA',
    first_name: 'Glen',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'yes 50 amp', label: 'outlet_50a' },
      { customer: '[sends panel photo, Square D, clear]', label: 'photo_received', photo: 'main panel open square d clear' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      // Address in Oconee County (out of service area). Jurisdiction lookup overrides label.
      { customer: 'Glen Marsh, gmarsh@gmail.com, 500 Lake Hartwell Dr Seneca SC 29672', label: 'email_provided', ctx_overlay: { address_captured: true } },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO N9: "Do I need a surge protector?" — Alex Topic 7.
  // Bot briefly defers to Key + continues current state's question.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'N9 — surge protector question mid-flow',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Eli',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'should I add a whole-home surge protector with this?', label: 'asking_about_surge_protector' },
      { customer: 'yes 30 amp 4 prong', label: 'outlet_30a_4prong' },
      { customer: '[sends panel photo, Square D, clear]', label: 'photo_received', photo: 'main panel open square d clear' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Eli Brown, ebrown@gmail.com, 7 Ridgeline Rd Mauldin SC 29662', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO N10: Customer in Williamston (Anderson County — OUT)
  // Jurisdiction lookup routes to DQ_OUT_OF_AREA.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'N10 — Williamston/Anderson out-of-service auto-DQ',

    expected_terminal: 'DISQUALIFIED_OUT_OF_AREA',
    first_name: 'Cindy',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'yes 50 amp', label: 'outlet_50a' },
      { customer: '[sends panel photo, GE, clear]', label: 'photo_received', photo: 'main panel open ge clear' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Cindy Hayes, chayes@gmail.com, 222 Mill St Williamston SC 29697', label: 'email_provided', ctx_overlay: { address_captured: true } },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ROUND 6 — v10.1.11 burst-message + multi-intent + volunteered slots
  // ═══════════════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────
  // SCENARIO B1: Customer texts in 3 quick bubbles. Combined into
  // ONE classifier turn (production webhook idempotency batches).
  // Volunteered slots get captured; bot doesn't re-ask.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'B1 — burst message: yes / generac / 50 amp 4 prong',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Brent',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes\nI have a generac\n50 amp 4 prong twist lock', label: 'outlet_50a' },
      { customer: '[sends panel photo, Eaton, clear]', label: 'photo_received', photo: 'main panel open eaton clear' },
      { customer: 'yes garage exterior wall', label: 'panel_garage_exterior' },
      { customer: 'Brent Mason, bmason@gmail.com, 411 Pine Ridge Dr Greer SC 29651', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO B2: Multi-intent message — customer answers location AND
  // volunteers email in same turn. Old harness dropped one or the other;
  // v10.1.11 volunteered-slots detector catches both.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'B2 — multi-intent: location + email in same message',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Maria',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'yes 50 amp', label: 'outlet_50a' },
      { customer: '[sends panel photo, Square D, clear]', label: 'photo_received', photo: 'main panel open square d clear' },
      // Multi-intent: panel location + full close info in one bubble
      { customer: 'garage exterior wall — also: Maria Aguirre, maguirre@gmail.com, 88 Hampton Ridge Dr Greenville SC 29615', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO B3: Off-topic clarifying-technical mid-flow.
  // Customer asks "do you guys do panel upgrades too?" at AWAIT_PANEL_PHOTO.
  // That's not on-topic (doesn't match panel keywords directly — it's
  // about scope). Bot should defer to Key + continue.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'B3 — off-topic technical mid-flow (panel upgrades)',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Owen',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'yes 50 amp', label: 'outlet_50a' },
      { customer: 'do you guys do whole panel upgrades or service replacements too', label: 'asking_clarifying_technical' },
      { customer: '[sends panel photo, GE, clear]', label: 'photo_received', photo: 'main panel open ge clear' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Owen Reed, oreed@gmail.com, 51 Maple Ave Easley SC 29642', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ROUND 7 — v10.1.12 polish (urgent/email/HOA/manufactured/older/solar)
  // ═══════════════════════════════════════════════════════════════════

  // P1 — Urgent callback demand
  {
    name: 'P1 — urgent: storm-imminent demands Key NOW',

    expected_terminal: 'NEEDS_CALLBACK',
    first_name: 'Bobby',
    greeting_variant: 'A',
    turns: [
      { customer: "I need someone to call me NOW, storm hits in 4 hours can someone come out today?", label: 'urgent_callback_demand' },
    ],
  },

  // P2 — Customer prefers email
  {
    name: 'P2 — prefers email channel',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Joan',
    greeting_variant: 'A',
    turns: [
      { customer: "yes, but can you email me instead? I dont do text well", label: 'prefers_email_channel' },
      { customer: 'yes 50 amp 4 prong', label: 'outlet_50a' },
      { customer: '[sends panel photo, Square D, clear]', label: 'photo_received', photo: 'main panel open square d clear' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Joan Pierce, jpierce@gmail.com, 412 Hampton Lake Greer SC 29651', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // P3 — HOA approval mid-flow (HOA captured as metadata via regex; classifier emits primary routing label)
  {
    name: 'P3 — HOA approval mention mid-flow',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Reggie',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'yes 50 amp, but I need to check with my HOA first about the outdoor outlet', label: 'outlet_50a' },
      { customer: '[sends panel photo, Eaton, clear]', label: 'photo_received', photo: 'main panel open eaton clear' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Reggie Stratton, rstratton@gmail.com, 7 Fairway Lakes Dr Mauldin SC 29662', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // P4 — Manufactured home
  {
    name: 'P4 — manufactured home flag for Key',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Vera',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes, just so you know I have a manufactured home', label: 'affirmative' },
      { customer: 'yes 30 amp 4 prong twist lock', label: 'outlet_30a_4prong' },
      { customer: '[sends panel photo, GE, clear]', label: 'photo_received', photo: 'main panel open ge clear' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Vera Holt, vholt@gmail.com, 22 Pine Ridge Way Pickens SC 29671', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // P5 — Older home (1920s farmhouse, possible knob-and-tube)
  {
    name: 'P5 — 1920 farmhouse + knob-and-tube wiring',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Otis',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes, FYI we live in a 1925 farmhouse with some original knob and tube wiring', label: 'affirmative' },
      { customer: 'yes 50 amp', label: 'outlet_50a' },
      { customer: '[sends panel photo, Square D, clear]', label: 'photo_received', photo: 'main panel open square d clear' },
      { customer: 'basement on interior wall', label: 'panel_basement' },
      { customer: 'yes attic and crawl', label: 'both_access' },
      { customer: 'Otis Mercer, omercer@gmail.com, 88 Old Spring Rd Greenville SC 29609', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // P6 — Solar + battery storage
  {
    name: 'P6 — solar panels + Tesla Powerwall mention',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Riley',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes, we already have solar panels and a Tesla Powerwall but want backup for extended outages', label: 'affirmative' },
      { customer: 'yes 50 amp', label: 'outlet_50a' },
      { customer: '[sends panel photo, Eaton, clear]', label: 'photo_received', photo: 'main panel open eaton clear' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Riley Burke, rburke@gmail.com, 51 Lake Forest Dr Simpsonville SC 29680', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // P7 — Late-night greeting (form fires at 11pm)
  {
    name: 'P7 — late-night form fires (time-of-day suffix)',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Marcus',
    greeting_variant: 'A',
    ctx: { time_of_day_bucket: 'late' },
    turns: [
      { customer: "yeah I'm up", label: 'affirmative' },
      { customer: 'yes 50 amp 4 prong', label: 'outlet_50a' },
      { customer: '[sends panel photo, Square D, clear]', label: 'photo_received', photo: 'main panel open square d clear' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Marcus Aldridge, maldridge@gmail.com, 71 Riverwood Dr Greenville SC 29609', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ROUND 8 — v10.1.14 Tyler feedback (wall confusion, inlet location, main breaker)
  // ═══════════════════════════════════════════════════════════════════

  // T1 — Wall-type confusion (Tyler's actual case): says "interior" but
  // really means "panel is inside, on a wall facing the back yard"
  {
    name: 'T1 — interior-vs-exterior wall confusion (Tyler case)',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Carlos',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'yes 30 amp 4 prong', label: 'outlet_30a_4prong' },
      { customer: '[sends panel photo, Square D 200A main breaker visible at top]', label: 'photo_received', photo: 'main panel open square d 200a main breaker visible at top' },
      { customer: 'in the garage but its inside not the outside', label: 'panel_garage_interior' },
      // Bot now asks CONFIRM_PANEL_WALL_TYPE — explains interior vs exterior
      { customer: 'oh, exterior then. the wall backs up to the back yard', label: 'panel_garage_exterior' },
      // Routes to AWAIT_INLET_LOCATION
      { customer: 'yeah right behind the panel works', label: 'inlet_default' },
      { customer: 'Carlos Reyes, creyes@gmail.com, 22 Pine Way Greer SC 29651', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // T2 — Customer wants inlet at custom location (carport, around the side)
  {
    name: 'T2 — custom inlet location, 30ft from panel',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Marsha',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'yes 50 amp', label: 'outlet_50a' },
      { customer: '[sends panel photo, Eaton 150A main breaker labeled at top]', label: 'photo_received', photo: 'main panel open eaton 150a main breaker labeled at top' },
      { customer: 'yes garage on exterior wall', label: 'panel_garage_exterior' },
      // AWAIT_INLET_LOCATION fires
      { customer: "actually I'd want it on the side near my carport, about 30 feet from the panel", label: 'inlet_custom' },
      { customer: 'Marsha Quill, mquill@gmail.com, 88 Lake Forest Dr Simpsonville SC 29680', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // T3 — Photo classifier moderate confidence on main breaker (Tyler's
  // dual-Bryant case). Bot asks customer to confirm a main breaker exists.
  {
    name: 'T3 — main breaker unclear, bot asks customer to verify',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Doug',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'yes 50 amp', label: 'outlet_50a' },
      // Photo description includes "unclear" → photoClassify returns moderate confidence
      { customer: '[sends panel photo, Bryant 125A label, main breaker unclear top cut off]', label: 'photo_received_main_breaker_unsure', photo: 'main panel open bryant 125a label main breaker unclear top cut off' },
      // CONFIRM_MAIN_BREAKER fires; customer confirms
      { customer: "yeah there's a 200 at the top, says MAIN", label: 'affirmative' },
      // Routes back to AWAIT_RUN
      { customer: 'garage exterior', label: 'panel_garage_exterior' },
      { customer: 'right behind panel is fine', label: 'inlet_default' },
      { customer: 'Doug Sims, dsims@gmail.com, 51 Mockingbird Ln Mauldin SC 29662', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // T4 — Customer truly has a sub-panel (no main). DQ via Key callback
  // since interlock can't install on a sub-panel.
  {
    name: 'T4 — confirmed sub-panel (no main breaker) → callback',

    expected_terminal: 'NEEDS_CALLBACK',
    first_name: 'Vince',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'yes 50 amp', label: 'outlet_50a' },
      { customer: '[sends panel photo, Bryant subpanel no main breaker all breakers same size]', label: 'photo_received_main_breaker_unsure', photo: 'main panel open bryant no main breaker all breakers same size workshop subpanel' },
      { customer: 'no there is no big switch at the top, just regular breakers all the same', label: 'negative' },
    ],
  },

  // T5 — True interior wall (between two indoor rooms) → AWAIT_INSTALL_PATH
  {
    name: 'T5 — truly interior wall (between rooms) → install path',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Helen',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'yes 30 amp 4 prong', label: 'outlet_30a_4prong' },
      { customer: '[sends panel photo, GE 200A main breaker visible at top]', label: 'photo_received', photo: 'main panel open ge 200a main breaker visible at top' },
      { customer: 'in a hallway closet, interior wall', label: 'panel_interior_wall' },
      // CONFIRM_PANEL_WALL_TYPE fires
      { customer: 'right, between two rooms inside, no outside on either side', label: 'negative' },
      // Routes to AWAIT_INSTALL_PATH
      { customer: 'we have an attic above the hallway', label: 'attic_access' },
      { customer: 'around the side of the house near the back door, maybe 25 feet from panel', label: 'inlet_custom' },
      { customer: 'Helen Park, hpark@gmail.com, 7 Oakwood Way Pickens SC 29671', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 29: Repeated coverage push at every state.
  // Customer is anxious about whether their setup will work.
  // Bot must defer EACH time + continue. Should not crash.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'S29 — repeated coverage push at every step',

    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Wendy',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes', label: 'affirmative' },
      { customer: 'will an 8000W run my whole house easily?', label: 'coverage_question', ctx_overlay: { coverage_excerpt: 'will an 8000W run my whole house easily' } },
      { customer: 'yes 30 amp 4 prong', label: 'outlet_30a_4prong' },
      { customer: 'wait one more — is that enough for two ACs?', label: 'coverage_question', ctx_overlay: { coverage_excerpt: 'is that enough for two ACs' } },
      { customer: '[sends panel photo, Square D, clear]', label: 'photo_received', photo: 'main panel open square d clear' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Wendy Cole, wcole@gmail.com, 41 Ridge Crest Dr Greer SC 29651', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yes good', label: 'affirmative' },
    ],
  },
];
