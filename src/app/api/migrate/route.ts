/**
 * /api/migrate — One-time migration route.
 *
 * Reads the legacy Supabase row (keyed by NEXT_PUBLIC_SYNC_ID env var)
 * and writes it under the authenticated user's auth.uid().
 *
 * Usage: GET /api/migrate (while signed in)
 * Run once — safe to call multiple times (idempotent upsert).
 */
import { type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const TABLE = 'tracker_data';

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const legacySyncId = process.env.NEXT_PUBLIC_SYNC_ID;

  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  // Auth header from client
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Invalid session' }, { status: 401 });
  }

  if (!legacySyncId) {
    return Response.json({ message: 'No legacy SYNC_ID configured — nothing to migrate' });
  }

  // Use service role or anon to read legacy row (anon policy was open before)
  const adminSupabase = createClient(supabaseUrl, supabaseKey);
  const { data: legacyRow } = await adminSupabase
    .from(TABLE)
    .select('data')
    .eq('sync_id', legacySyncId)
    .single();

  if (!legacyRow?.data) {
    return Response.json({ message: 'No legacy data found — nothing to migrate' });
  }

  // Write under auth UID
  const { error } = await supabase.from(TABLE).upsert(
    { sync_id: user.id, data: legacyRow.data, updated_at: new Date().toISOString() },
    { onConflict: 'sync_id' }
  );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    message: `Successfully migrated data from '${legacySyncId}' → '${user.id}'`,
  });
}
