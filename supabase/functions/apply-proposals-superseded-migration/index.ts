/**
 * One-shot: applies the proposals.superseded_by migration so prior open
 * quotes auto-mark as superseded when a new quote drops for the same
 * contact. Idempotent.
 *
 * Brain-token gated so we can run it from CLI without SR creds.
 *
 * After successful run, this function should be deleted.
 */

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'
import { timingSafeEqual, allowRate } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': 'https://backuppowerpro.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-bpp-brain-token',
  'Vary': 'Origin',
}

const MIGRATION_SQL = `
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.proposals(id),
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz;

CREATE INDEX IF NOT EXISTS proposals_superseded_idx
  ON public.proposals (contact_id, superseded_by)
  WHERE superseded_by IS NULL AND signed_at IS NULL;

COMMENT ON COLUMN public.proposals.superseded_by IS 'When a newer proposal supersedes this one, points at the new id.';
COMMENT ON COLUMN public.proposals.superseded_at IS 'Timestamp the row was superseded.';

CREATE OR REPLACE FUNCTION public.proposals_supersede_prior()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
BEGIN
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.proposals
  SET superseded_by = NEW.id,
      superseded_at = now()
  WHERE contact_id = NEW.contact_id
    AND id <> NEW.id
    AND superseded_by IS NULL
    AND signed_at IS NULL
    AND status IN ('Sent', 'Viewed', 'Created', 'Copied');

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS proposals_supersede_prior_trigger ON public.proposals;
CREATE TRIGGER proposals_supersede_prior_trigger
AFTER INSERT ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.proposals_supersede_prior();
`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS })

  const BRAIN = Deno.env.get('BPP_BRAIN_TOKEN') || ''
  const sent = req.headers.get('x-bpp-brain-token') || ''
  if (!BRAIN || !timingSafeEqual(sent, BRAIN)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowRate(`apply-proposals-superseded:${ip}`, 1)) {
    return new Response(JSON.stringify({ error: 'rate limited' }), {
      status: 429, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const dbUrl = Deno.env.get('SUPABASE_DB_URL')
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: 'no db url' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const sql = postgres(dbUrl, { max: 1 })
  try {
    await sql.unsafe(MIGRATION_SQL)

    // Backfill: mark older open proposals where the SAME contact has a newer
    // open one. Conservative — only operates on rows that the new trigger
    // would have caught if it had been in place when each was created.
    const backfillRows = await sql.unsafe(`
      WITH ranked AS (
        SELECT id, contact_id,
               ROW_NUMBER() OVER (PARTITION BY contact_id ORDER BY created_at DESC) AS rn
        FROM public.proposals
        WHERE signed_at IS NULL
          AND superseded_by IS NULL
          AND status IN ('Sent', 'Viewed', 'Created', 'Copied')
      ),
      newest AS (
        SELECT contact_id, id AS newest_id FROM ranked WHERE rn = 1
      )
      UPDATE public.proposals p
      SET superseded_by = n.newest_id, superseded_at = now()
      FROM newest n
      WHERE p.contact_id = n.contact_id
        AND p.id <> n.newest_id
        AND p.signed_at IS NULL
        AND p.superseded_by IS NULL
        AND p.status IN ('Sent', 'Viewed', 'Created', 'Copied')
      RETURNING p.id;
    `)
    const backfillCount = Array.isArray(backfillRows) ? backfillRows.length : 0

    await sql.end()
    return new Response(JSON.stringify({
      success: true,
      backfilled_proposals: backfillCount,
    }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    try { await sql.end() } catch (_) {}
    console.error('[apply-proposals-superseded] error:', err?.message || err)
    return new Response(JSON.stringify({
      error: 'migration failed',
      detail: String(err?.message || err).slice(0, 400),
    }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
