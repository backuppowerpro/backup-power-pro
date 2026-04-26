-- Add install_date column to contacts so the Calendar tab can show actual
-- scheduled installs instead of heuristic stage-based guessing. Nullable
-- because not every contact has a scheduled install yet (pre-booking stages).
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS install_date timestamptz;

CREATE INDEX IF NOT EXISTS contacts_install_date_idx
  ON contacts (install_date)
  WHERE install_date IS NOT NULL;
