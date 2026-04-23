-- Store installer tokens as SHA-256 hashes at rest so a DB leak doesn't
-- expose the bearer tokens directly. Keep the plaintext `token` column
-- nullable during migration so existing rows still authenticate; new
-- rows set `token_hash` only.
--
-- sub-schedule + sub-mark-complete edge fns will accept either:
--   (a) a row whose token_hash matches sha256(provided), OR
--   (b) a legacy row whose plaintext `token` matches (deprecated path)
-- after all rows are re-issued we drop column `token` entirely.

ALTER TABLE installer_tokens
  ADD COLUMN IF NOT EXISTS token_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS installer_tokens_token_hash_uidx
  ON installer_tokens (token_hash)
  WHERE token_hash IS NOT NULL;

-- Backfill existing rows so the hashed lookup path works for current
-- live tokens. Uses pgcrypto's `digest` which is available in every
-- Supabase project by default (we enable `create extension if not exists
-- pgcrypto` so this is safe).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE installer_tokens
   SET token_hash = encode(digest(token, 'sha256'), 'hex')
 WHERE token IS NOT NULL AND token_hash IS NULL;
