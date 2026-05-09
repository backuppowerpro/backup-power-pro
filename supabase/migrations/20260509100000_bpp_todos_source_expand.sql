-- Expand the bpp_todos.source allow-list to cover CRM v3's new origins.
-- Old constraint (`CHECK (source IN ('ai','manual'))`) rejected the rows
-- inserted by:
--   - QuickCaptureFAB (⌘.) → source='quick_capture'
--   - cancelProposal auto-reengagement → source='auto_cancel_reengage'
-- Postgres rejects with 23514 (check_violation), surfacing as a silent
-- no-op on fire-and-forget paths (auto_cancel_reengage) and a toast
-- error on user-facing paths (quick_capture). Catch was from the
-- 2026-05-09 security review.
--
-- We expand the allow-list in place rather than dropping it: keeping
-- a closed enum lets future audits ask "what created this row?" with
-- a finite vocabulary instead of a free-text field.

ALTER TABLE bpp_todos
  DROP CONSTRAINT IF EXISTS bpp_todos_source_check;

ALTER TABLE bpp_todos
  ADD CONSTRAINT bpp_todos_source_check
    CHECK (source IN ('ai', 'manual', 'quick_capture', 'auto_cancel_reengage'));
