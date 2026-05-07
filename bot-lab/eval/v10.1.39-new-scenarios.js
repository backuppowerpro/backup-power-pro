// v10.1.39 — five new scenarios that exercise the prod-only transitions
// ported into bot-lab/state-machine.js (v10.1.32 / v10.1.33 / v10.1.36).
// Without these, the lab can silently drift away from prod on the new
// happy paths (off_topic_question self-loops + friendly_chitchat → COMPLETE).
//
// Scenario format mirrors v10.1.14-brutal-scenarios.js exactly.

'use strict';

module.exports = [
  // ─────────────────────────────────────────────────────────────
  // C1: chitchat at RECAP — tests v10.1.33
  // Customer happy-paths through to RECAP, says "thanks, great" at
  // SCHEDULE_QUOTE. Should land at COMPLETE.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'C1 — chitchat_at_recap',
    expected_terminal: 'COMPLETE',
    first_name: 'Linda',
    greeting_variant: 'A',
    turns: [
      { customer: 'sure', label: 'affirmative' },
      { customer: 'yes 50 amp', label: 'outlet_50a' },
      { customer: '[sends panel photo, Square D, main panel open clear]', label: 'photo_received', photo: 'main panel open clear, square d, breakers visible' },
      { customer: 'yes garage exterior wall', label: 'panel_garage_exterior' },
      { customer: 'Linda Park, lpark@gmail.com, 312 Maple Ave Greer SC 29651', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'yep that looks right', label: 'affirmative' },
      // v10.1.33 path: friendly chitchat at RECAP → SCHEDULE_QUOTE
      // then v10.1.32 path: friendly chitchat at SCHEDULE_QUOTE → COMPLETE
      { customer: 'thanks great', label: 'friendly_chitchat' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // C2: licensed-question at AWAIT_240V — tests v10.1.36
  // Customer asks "are you licensed?" mid-AWAIT_240V. Bot should
  // self-loop (answer + re-ask). Then full happy path to SCHEDULE_QUOTE.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'C2 — licensed_question_at_240V',
    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Marcus',
    greeting_variant: 'A',
    turns: [
      { customer: 'yes go ahead', label: 'affirmative' },
      // v10.1.36 — was NEEDS_CALLBACK, now self-loops
      { customer: 'real quick are you licensed and insured?', label: 'off_topic_question' },
      { customer: 'cool, yes 50 amp 4 prong', label: 'outlet_50a' },
      { customer: '[sends panel photo, Square D, main panel open clear]', label: 'photo_received', photo: 'main panel open clear, square d, breakers visible' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Marcus Webb, mwebb@gmail.com, 88 Oak St Greer SC 29651', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'looks right', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // C3: Generac question at AWAIT_PANEL_PHOTO — tests v10.1.36
  // Customer asks "do you do Generac whole-home?" at AWAIT_PANEL_PHOTO.
  // Bot self-loops (answers no, only portable + re-asks for panel pic).
  // ─────────────────────────────────────────────────────────────
  {
    name: 'C3 — generac_question_at_panel_photo',
    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Tasha',
    greeting_variant: 'A',
    turns: [
      { customer: 'yeah', label: 'affirmative' },
      { customer: 'yes 50 amp', label: 'outlet_50a' },
      // v10.1.36 — was NEEDS_CALLBACK terminal, now self-loops at AWAIT_PANEL_PHOTO
      { customer: 'do you do Generac whole-home installs too?', label: 'off_topic_question' },
      { customer: '[sends panel photo, Square D, main panel open clear]', label: 'photo_received', photo: 'main panel open clear, square d, breakers visible' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Tasha Reed, treed@gmail.com, 401 Pine Rd Greer SC 29651', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'looks right', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // C4: bare "yes" at AWAIT_240V — tests v10.1.32
  // Customer just says "yes" to the 240V Q. Bot accepts as gen_240v
  // and routes to AWAIT_OUTLET. Then full happy path.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'C4 — bare_yes_at_240V',
    expected_terminal: 'SCHEDULE_QUOTE',
    first_name: 'Greg',
    greeting_variant: 'A',
    turns: [
      { customer: 'sure', label: 'affirmative' },
      // v10.1.32 — bare "yes" at AWAIT_240V now treated as gen_240v
      { customer: 'yes', label: 'affirmative' },
      // Bot is now at AWAIT_OUTLET, asks 30 vs 50
      { customer: '50 amp', label: 'outlet_50a' },
      { customer: '[sends panel photo, Square D, main panel open clear]', label: 'photo_received', photo: 'main panel open clear, square d, breakers visible' },
      { customer: 'yes garage exterior', label: 'panel_garage_exterior' },
      { customer: 'Greg Hall, ghall@gmail.com, 27 Cedar Ln Greer SC 29651', label: 'email_provided', ctx_overlay: { address_captured: true } },
      { customer: 'looks right', label: 'affirmative' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // C5: subpanel disagreement — main breaker confirm rebound
  // Customer claims main breaker exists, ambiguous follow-up photo
  // returns sub-panel signal → bot asks CONFIRM_MAIN_BREAKER →
  // customer admits sub-panel → NEEDS_CALLBACK.
  // ─────────────────────────────────────────────────────────────
  {
    name: 'C5 — subpanel_disagreement',
    expected_terminal: 'NEEDS_CALLBACK',
    first_name: 'Ron',
    greeting_variant: 'A',
    turns: [
      { customer: 'yeah', label: 'affirmative' },
      { customer: 'yes 50 amp 4 prong', label: 'outlet_50a' },
      // First photo: ambiguous — main breaker_confidence is moderate
      // photoClassify uses "main breaker unclear" or similar wording to set ambiguousMain.
      // Use a panel narration with "unclear" to trigger photo_received_main_breaker_unsure.
      { customer: '[sends panel photo, breakers all same size, main breaker unclear, hard to see]', label: 'photo_received', photo: 'main panel open, breakers visible, main breaker unclear, hard to see' },
      // Bot now at CONFIRM_MAIN_BREAKER. Customer admits no main breaker → sub-panel.
      { customer: 'actually I think this might be a sub-panel, the main is elsewhere', label: 'negative' },
    ],
  },
];
