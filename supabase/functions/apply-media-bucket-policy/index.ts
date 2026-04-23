// One-shot: install the RLS policy that lets authenticated CRM users upload
// to the message-media Supabase Storage bucket. Without this, the compose
// bar's attach-photo button gets a 403 on upload. Idempotent via DROP IF
// EXISTS → CREATE POLICY.

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'
import { requireServiceRole } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const gate = requireServiceRole(req); if (gate) return gate

  const url = Deno.env.get('DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL')
  if (!url) {
    return new Response(JSON.stringify({ error: 'no DATABASE_URL' }), { status: 500, headers: CORS })
  }

  const sql = postgres(url, { ssl: 'prefer', max: 1 })
  try {
    // INSERT — authenticated users can upload images to the bucket.
    await sql.unsafe(`
      DROP POLICY IF EXISTS "authenticated can upload to message-media" ON storage.objects;
      CREATE POLICY "authenticated can upload to message-media"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'message-media');
    `)

    // UPDATE — authenticated users can replace their own uploads (rare, but
    // allowed so the upsert path doesn't break on re-uploads).
    await sql.unsafe(`
      DROP POLICY IF EXISTS "authenticated can update message-media" ON storage.objects;
      CREATE POLICY "authenticated can update message-media"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'message-media');
    `)

    // DELETE — authenticated users can delete (e.g. Key wants to remove an
    // accidentally-sent photo; still readable in Twilio logs, but yanked
    // from our bucket so the thread no longer renders it).
    await sql.unsafe(`
      DROP POLICY IF EXISTS "authenticated can delete from message-media" ON storage.objects;
      CREATE POLICY "authenticated can delete from message-media"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'message-media');
    `)

    // SELECT — the bucket is public, so anon reads already work. Adding this
    // explicit policy avoids any surprises if the bucket's public flag ever
    // gets flipped off.
    await sql.unsafe(`
      DROP POLICY IF EXISTS "anyone can read message-media" ON storage.objects;
      CREATE POLICY "anyone can read message-media"
      ON storage.objects
      FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'message-media');
    `)

    const policies = await sql`
      SELECT policyname, cmd
      FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname LIKE '%message-media%'
    `
    return new Response(JSON.stringify({ ok: true, policies }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: CORS })
  } finally {
    await sql.end()
  }
})
