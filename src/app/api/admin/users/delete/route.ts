/**
 * /api/admin/users/delete — Hard Delete User API Route
 *
 * Removes a user completely from the database along with all their associated data:
 * - tracker_data (playlists, checklists, habits, study logs)
 * - partner_snapshots (presence and public study telemetry)
 * - duo_partnerships, duo_messages, duo_scratchpads (collaboration data)
 * - blocked_users (if present)
 * - auth.users (if Supabase service role key is configured)
 *
 * Protected: Requires authenticated request from an administrator email.
 */

import { type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isUserAdmin } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return Response.json({ error: 'Supabase credentials are not configured.' }, { status: 500 });
    }

    // 1. Authenticate the caller
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return Response.json({ error: 'Missing authorization header.' }, { status: 401 });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user: callerUser }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !callerUser) {
      return Response.json({ error: 'Invalid authentication session.' }, { status: 401 });
    }

    // 2. Verify admin permissions
    if (!isUserAdmin(callerUser.email)) {
      return Response.json(
        { error: 'Forbidden: You do not have administrator permissions to delete users.' },
        { status: 403 }
      );
    }

    // 3. Parse request payload
    const body = await request.json();
    const { userId, email } = body as { userId?: string; email?: string };

    if (!userId) {
      return Response.json({ error: 'Missing required parameter: userId.' }, { status: 400 });
    }

    // 4. Protect admin accounts from deletion
    if (isUserAdmin(email) || isUserAdmin(userId)) {
      return Response.json(
        { error: 'Administrator accounts are protected and cannot be deleted.' },
        { status: 400 }
      );
    }

    // 5. Use Service Role client if available, else use anon/auth client
    const dbClient = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
      : createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });

    // Step A: Find and cleanup duo partnerships & associated messages/scratchpads
    const { data: partnerships } = await dbClient
      .from('duo_partnerships')
      .select('id')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`);

    const partnershipIds = (partnerships || []).map((p: { id: string }) => p.id).filter(Boolean);

    if (partnershipIds.length > 0) {
      // Delete scratchpads for these partnerships
      await dbClient
        .from('duo_scratchpads')
        .delete()
        .in('partnership_id', partnershipIds);

      // Delete messages for these partnerships
      await dbClient
        .from('duo_messages')
        .delete()
        .in('partnership_id', partnershipIds);

      // Delete the partnerships themselves
      await dbClient
        .from('duo_partnerships')
        .delete()
        .in('id', partnershipIds);
    }

    // Also delete any orphan messages or scratchpads sent by this user
    await Promise.allSettled([
      dbClient.from('duo_messages').delete().eq('sender_id', userId),
      dbClient.from('duo_scratchpads').delete().eq('updated_by', userId),
    ]);

    // Step B: Delete partner snapshot telemetry
    await dbClient.from('partner_snapshots').delete().eq('user_id', userId);

    // Step C: Delete core tracker data (playlists, checklists, habits, study logs)
    await dbClient.from('tracker_data').delete().eq('sync_id', userId);

    // Step D: Delete from blocked_users table if present
    if (email) {
      await dbClient.from('blocked_users').delete().or(`id.eq.${userId},email.eq.${email.toLowerCase().trim()}`);
    } else {
      await dbClient.from('blocked_users').delete().eq('id', userId);
    }

    // Step E: If service role is available, permanently delete from Supabase Auth
    let authUserDeleted = false;
    if (serviceRoleKey) {
      try {
        const adminAuthClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { error: deleteAuthError } = await adminAuthClient.auth.admin.deleteUser(userId);
        if (!deleteAuthError) {
          authUserDeleted = true;
        }
      } catch {
        // Continue even if auth deletion had a non-fatal issue
      }
    }

    return Response.json({
      success: true,
      message: `User ${userId} and all associated data have been permanently deleted (Hard Delete).`,
      authUserDeleted,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return Response.json({ error: message }, { status: 500 });
  }
}
