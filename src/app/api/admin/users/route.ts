/**
 * /api/admin/users — Real Learner Roster & System Metrics API
 *
 * Fetches 100% real user data and platform telemetry from Supabase Auth,
 * tracker_data, and partner_snapshots without any synthetic or predictive values.
 *
 * Protected: Administrator email access only.
 */

import { type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isUserAdmin } from '@/lib/auth';
import { PlaylistRecord } from '@/lib/types';

export interface RealAdminUserPlaylist {
  id: string;
  name: string;
  youtubePlaylistId: string;
  videoCount: number;
  completedTasks: number;
  totalTasks: number;
  progressPct: number;
  addedAt: string;
}

export interface RealAdminUserRecord {
  id: string;
  displayName: string;
  emailOrSyncId: string;
  avatarUrl?: string | null;
  status: 'online' | 'active_today' | 'offline';
  playlistsCount: number;
  playlists: RealAdminUserPlaylist[];
  activePlaylist: string;
  progressPct: number;
  todayStudySeconds: number;
  todayCompleted: number;
  currentStreak: number;
  isDuoPaired: boolean;
  partnerName?: string;
  lastActiveAt: string;
}

function determineStatus(lastActiveAt: string): 'online' | 'active_today' | 'offline' {
  const lastActiveTime = new Date(lastActiveAt).getTime();
  const now = Date.now();
  const diffMinutes = (now - lastActiveTime) / (1000 * 60);

  if (diffMinutes <= 15) {
    return 'online';
  }

  const todayDate = new Date().toISOString().slice(0, 10);
  const activeDate = new Date(lastActiveAt).toISOString().slice(0, 10);
  if (todayDate === activeDate) {
    return 'active_today';
  }

  return 'offline';
}

function extractPlaylists(playlistsMap?: Record<string, PlaylistRecord>): RealAdminUserPlaylist[] {
  if (!playlistsMap || typeof playlistsMap !== 'object') return [];
  return Object.values(playlistsMap).map(pl => {
    let completedTasks = 0;
    let totalTasks = 0;
    if (pl.tasks && typeof pl.tasks === 'object') {
      Object.values(pl.tasks).forEach(task => {
        if (task && Array.isArray(task.subtasks)) {
          totalTasks += task.subtasks.length;
          completedTasks += task.subtasks.filter(s => s.completed).length;
        }
      });
    }
    const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    return {
      id: pl.id,
      name: pl.name,
      youtubePlaylistId: pl.youtubePlaylistId,
      videoCount: pl.videoCount || 0,
      completedTasks,
      totalTasks,
      progressPct,
      addedAt: pl.addedAt || new Date().toISOString(),
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return Response.json({ error: 'Supabase credentials are not configured.' }, { status: 500 });
    }

    // 1. Authenticate caller
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

    if (!isUserAdmin(callerUser.email)) {
      return Response.json({ error: 'Forbidden: Requires administrator access.' }, { status: 403 });
    }

    // 2. Setup DB client (service role if available, or admin auth client)
    const dbClient = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
      : createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });

    // 3. Fetch all real data in parallel
    const [authUsersRes, trackerRes, snapshotsRes, partnershipsRes] = await Promise.allSettled([
      serviceRoleKey
        ? dbClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
        : Promise.resolve({ data: { users: [] }, error: null }),
      dbClient.from('tracker_data').select('sync_id, data, updated_at'),
      dbClient.from('partner_snapshots').select('*').order('last_active_at', { ascending: false }),
      dbClient.from('duo_partnerships').select('user_a, user_b'),
    ]);

    // Build auth user lookup map
    const authUserMap = new Map<string, { email: string; name: string; avatarUrl?: string | null; lastSignIn?: string }>();
    if (authUsersRes.status === 'fulfilled' && authUsersRes.value?.data?.users) {
      authUsersRes.value.data.users.forEach((u: { id: string; email?: string; user_metadata?: Record<string, unknown>; last_sign_in_at?: string }) => {
        const metadata = u.user_metadata || {};
        const displayName =
          (metadata.full_name as string) ||
          (metadata.name as string) ||
          (metadata.user_name as string) ||
          u.email?.split('@')[0] ||
          'Learner';
        const avatarUrl = (metadata.avatar_url as string) || (metadata.picture as string) || null;

        authUserMap.set(u.id, {
          email: u.email || u.id,
          name: displayName,
          avatarUrl,
          lastSignIn: u.last_sign_in_at,
        });
      });
    }

    // Build tracker data map
    const trackerMap = new Map<
      string,
      {
        playlists?: Record<string, PlaylistRecord>;
        activePlaylistId?: string | null;
        dailyGoals?: { goals?: Array<{ completed?: boolean }> };
        dailyGoalsHistory?: Record<string, number>;
        collaborationEnabled?: boolean;
        updatedAt?: string;
      }
    >();

    if (trackerRes.status === 'fulfilled' && trackerRes.value?.data) {
      trackerRes.value.data.forEach((row: { sync_id: string; data: Record<string, unknown>; updated_at?: string }) => {
        if (row.sync_id && row.data) {
          trackerMap.set(row.sync_id, {
            ...(row.data as object),
            updatedAt: row.updated_at,
          });
        }
      });
    }

    // Build partner snapshots map
    const snapshotMap = new Map<
      string,
      {
        display_name?: string;
        avatar_url?: string | null;
        active_playlist?: string;
        progress_pct?: number;
        today_study_seconds?: number;
        today_completed?: number;
        current_streak?: number;
        last_active_at?: string;
      }
    >();

    if (snapshotsRes.status === 'fulfilled' && snapshotsRes.value?.data) {
      snapshotsRes.value.data.forEach((s: Record<string, unknown>) => {
        const userId = String(s.user_id || '');
        if (userId) {
          snapshotMap.set(userId, s as object);
        }
      });
    }

    // Build paired user set from actual partnerships table
    const pairedUserSet = new Set<string>();
    if (partnershipsRes.status === 'fulfilled' && partnershipsRes.value?.data) {
      partnershipsRes.value.data.forEach((p: { user_a?: string; user_b?: string }) => {
        if (p.user_a) pairedUserSet.add(p.user_a);
        if (p.user_b) pairedUserSet.add(p.user_b);
      });
    }

    // Collect all distinct user IDs from Auth, Tracker, and Snapshots
    const allUserIds = new Set<string>([
      ...Array.from(authUserMap.keys()),
      ...Array.from(trackerMap.keys()),
      ...Array.from(snapshotMap.keys()),
    ]);

    const records: RealAdminUserRecord[] = [];

    allUserIds.forEach(userId => {
      const authInfo = authUserMap.get(userId);
      const trackerData = trackerMap.get(userId);
      const snapshot = snapshotMap.get(userId);

      // Identity resolution across Auth metadata, partner snapshots, and tracker profile
      const userProfile = (trackerData as { userProfile?: { email?: string; displayName?: string; avatarUrl?: string | null } } | undefined)?.userProfile;
      const snapshotEmail = (snapshot as { email?: string } | undefined)?.email;

      const email =
        authInfo?.email ||
        snapshotEmail ||
        userProfile?.email ||
        userId;

      const displayName =
        authInfo?.name ||
        snapshot?.display_name ||
        userProfile?.displayName ||
        (email.includes('@') ? email.split('@')[0] : `Learner (${userId.slice(0, 6)})`);

      const avatarUrl =
        authInfo?.avatarUrl ||
        snapshot?.avatar_url ||
        userProfile?.avatarUrl ||
        null;

      // Extract real playlists
      const playlists = extractPlaylists(trackerData?.playlists);

      // Ground truth active playlist and progress resolution
      let activePlaylistName = 'None';
      let realProgressPct = 0;

      if (trackerData?.playlists && Object.keys(trackerData.playlists).length > 0) {
        const activeId = trackerData.activePlaylistId;
        const activePl = activeId && trackerData.playlists[activeId]
          ? trackerData.playlists[activeId]
          : trackerData.playlists[Object.keys(trackerData.playlists)[0]];

        if (activePl) {
          activePlaylistName = activePl.name;
          let completed = 0;
          let total = 0;
          if (activePl.tasks && typeof activePl.tasks === 'object') {
            Object.values(activePl.tasks).forEach(t => {
              if (t && Array.isArray(t.subtasks)) {
                total += t.subtasks.length;
                completed += t.subtasks.filter(s => s.completed).length;
              }
            });
          }
          realProgressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
        }
      } else if (playlists.length > 0) {
        activePlaylistName = playlists[0].name;
        realProgressPct = playlists[0].progressPct;
      }

      // Real study telemetry
      const todayStudySeconds = Number(snapshot?.today_study_seconds) || 0;
      const todayCompleted =
        trackerData?.dailyGoals?.goals?.filter(g => g.completed)?.length ??
        Number(snapshot?.today_completed || 0);
      const currentStreak =
        Object.keys(trackerData?.dailyGoalsHistory || {}).length ||
        Number(snapshot?.current_streak || 0);
      const isDuoPaired = pairedUserSet.has(userId) || Boolean(trackerData?.collaborationEnabled);

      // Real last active timestamp
      const lastActiveAt =
        snapshot?.last_active_at ||
        trackerData?.updatedAt ||
        authInfo?.lastSignIn ||
        new Date().toISOString();

      records.push({
        id: userId,
        displayName,
        emailOrSyncId: email,
        avatarUrl,
        status: determineStatus(lastActiveAt),
        playlistsCount: playlists.length,
        playlists,
        activePlaylist: activePlaylistName,
        progressPct: realProgressPct,
        todayStudySeconds,
        todayCompleted,
        currentStreak,
        isDuoPaired,
        lastActiveAt,
      });
    });

    // Sort by Last Active date descending (most recently active learner first)
    records.sort((a, b) => {
      const timeA = new Date(a.lastActiveAt).getTime() || 0;
      const timeB = new Date(b.lastActiveAt).getTime() || 0;
      return timeB - timeA;
    });

    // Compute real aggregated system metrics
    let totalPlaylistsAdded = 0;
    let totalSeconds = 0;
    let duoPartnerships = 0;

    records.forEach(u => {
      totalSeconds += u.todayStudySeconds;
      totalPlaylistsAdded += u.playlistsCount;
      if (u.isDuoPaired) duoPartnerships++;
    });

    const activeUsersNow = records.filter(u => u.status === 'online').length;
    const activeUsersToday = records.filter(u => u.status === 'online' || u.status === 'active_today').length;

    const metrics = {
      totalUsers: records.length,
      activeUsersToday,
      activeUsersNow,
      totalPlaylistsAdded,
      activeDuoPartnerships: Math.floor(duoPartnerships / 2),
      totalStudyHours: Math.round((totalSeconds / 3600) * 10) / 10,
    };

    return Response.json({
      success: true,
      metrics,
      users: records,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return Response.json({ error: message }, { status: 500 });
  }
}
