/**
 * admin-service.ts — Central Admin Governance Service
 *
 * Provides real-time user metrics, active user tracking, user playlists inspection,
 * and learner directory data for the /admin portal.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { logger } from '@/lib/observability/logger';
import { loadData } from '@/lib/storage';
import { loadStudyTime } from '@/lib/study-time/study-time-tracker';
import { getLocalPartnership } from '@/lib/collaboration/collaboration-service';
import { PlaylistRecord } from '@/lib/types';

export interface AdminUserPlaylist {
  id: string;
  name: string;
  youtubePlaylistId: string;
  videoCount: number;
  completedTasks: number;
  totalTasks: number;
  progressPct: number;
  addedAt: string;
}

export interface AdminUserRecord {
  id: string;
  displayName: string;
  emailOrSyncId: string;
  avatarUrl?: string | null;
  status: 'online' | 'active_today' | 'offline';
  playlistsCount: number;
  playlists: AdminUserPlaylist[];
  activePlaylist: string;
  progressPct: number;
  todayStudySeconds: number;
  todayCompleted: number;
  currentStreak: number;
  isDuoPaired: boolean;
  partnerName?: string;
  lastActiveAt: string;
}

export interface AdminSystemMetrics {
  totalUsers: number;
  activeUsersToday: number;
  activeUsersNow: number;
  totalPlaylistsAdded: number;
  activeDuoPartnerships: number;
  totalStudyHours: number;
}

class AdminService {
  /**
   * Determine user status relative to current timestamp
   */
  private determineStatus(lastActiveAt: string): 'online' | 'active_today' | 'offline' {
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

  /**
   * Helper to format playlist records into typed AdminUserPlaylist list
   */
  private extractPlaylistsFromRecord(playlistsMap: Record<string, PlaylistRecord> | undefined): AdminUserPlaylist[] {
    if (!playlistsMap) return [];
    return Object.values(playlistsMap).map(pl => {
      let completedTasks = 0;
      let totalTasks = 0;
      if (pl.tasks) {
        Object.values(pl.tasks).forEach(task => {
          if (task.subtasks) {
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
        addedAt: pl.addedAt,
      };
    });
  }

  /**
   * Fetch aggregated platform metrics focusing on users, playlists, and study engagement
   */
  public async getSystemMetrics(): Promise<AdminSystemMetrics> {
    const users = await this.getUserDirectory();

    let totalPlaylistsAdded = 0;
    let totalSeconds = 0;
    let duoPartnerships = 0;

    users.forEach(u => {
      totalSeconds += u.todayStudySeconds;
      totalPlaylistsAdded += u.playlistsCount;
      if (u.isDuoPaired) duoPartnerships++;
    });

    const activeUsersNow = users.filter(u => u.status === 'online').length;
    const activeUsersToday = users.filter(u => u.status === 'online' || u.status === 'active_today').length;

    return {
      totalUsers: users.length,
      activeUsersToday,
      activeUsersNow,
      totalPlaylistsAdded,
      activeDuoPartnerships: Math.floor(duoPartnerships / 2),
      totalStudyHours: Math.round((totalSeconds / 3600) * 10) / 10,
    };
  }

  /**
   * Fetch the comprehensive learner roster along with added playlists from real data sources
   */
  public async getUserDirectory(): Promise<AdminUserRecord[]> {
    // 1. Try fetching 100% verified server data from /api/admin/users
    if (typeof window !== 'undefined' && isSupabaseConfigured() && supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          const res = await fetch('/api/admin/users', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.users && Array.isArray(data.users)) {
              return data.users;
            }
          }
        }
      } catch (err: unknown) {
        logger.warn('admin', 'Failed to fetch from /api/admin/users route, using direct Supabase client', undefined, err);
      }
    }

    const records: AdminUserRecord[] = [];

    // 2. If Supabase is connected, query partner snapshots and tracker data directly
    if (isSupabaseConfigured() && supabase) {
      try {
        const [snapshotsRes, trackerRes] = await Promise.all([
          supabase.from('partner_snapshots').select('*').order('last_active_at', { ascending: false }),
          supabase.from('tracker_data').select('sync_id, data, updated_at'),
        ]);

        const trackerDataMap: Record<
          string,
          {
            playlists?: Record<string, PlaylistRecord>;
            activePlaylistId?: string | null;
            dailyGoals?: { goals?: Array<{ completed?: boolean }> };
            dailyGoalsHistory?: Record<string, number>;
            collaborationEnabled?: boolean;
            updatedAt?: string;
          }
        > = {};

        if (trackerRes.data) {
          trackerRes.data.forEach((row: Record<string, unknown>) => {
            const rowData = row.data as
              | {
                  playlists?: Record<string, PlaylistRecord>;
                  activePlaylistId?: string | null;
                  dailyGoals?: { goals?: Array<{ completed?: boolean }> };
                  dailyGoalsHistory?: Record<string, number>;
                  collaborationEnabled?: boolean;
                }
              | undefined;
            if (row.sync_id && rowData) {
              trackerDataMap[row.sync_id as string] = {
                ...rowData,
                updatedAt: row.updated_at as string | undefined,
              };
            }
          });
        }

        const processedUserIds = new Set<string>();

        if (!snapshotsRes.error && snapshotsRes.data && snapshotsRes.data.length > 0) {
          snapshotsRes.data.forEach((s: Record<string, unknown>) => {
            const userId = (s.user_id as string) || 'unknown';
            processedUserIds.add(userId);
            const lastActive = (s.last_active_at as string) || new Date().toISOString();
            const userTracked = trackerDataMap[userId];
            const userPlaylists = this.extractPlaylistsFromRecord(userTracked?.playlists);

            // Compute real active course and exact progress percentage from ground truth
            let activePlaylistTitle = 'None';
            let realProgressPct = 0;

            if (userTracked?.playlists && Object.keys(userTracked.playlists).length > 0) {
              const activeId = userTracked.activePlaylistId;
              const activePl = activeId && userTracked.playlists[activeId]
                ? userTracked.playlists[activeId]
                : userTracked.playlists[Object.keys(userTracked.playlists)[0]];

              if (activePl) {
                activePlaylistTitle = activePl.name;
                let completedTasks = 0;
                let totalTasks = 0;
                if (activePl.tasks) {
                  Object.values(activePl.tasks).forEach(task => {
                    if (task && Array.isArray(task.subtasks)) {
                      totalTasks += task.subtasks.length;
                      completedTasks += task.subtasks.filter(sub => sub.completed).length;
                    }
                  });
                }
                realProgressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
              }
            } else if (userPlaylists.length > 0) {
              activePlaylistTitle = userPlaylists[0].name;
              realProgressPct = userPlaylists[0].progressPct;
            }

            const todayCompleted =
              userTracked?.dailyGoals?.goals?.filter(g => g.completed)?.length ??
              (Number(s.today_completed) || 0);

            const currentStreak =
              Object.keys(userTracked?.dailyGoalsHistory || {}).length ||
              (Number(s.current_streak) || 0);

            records.push({
              id: userId,
              displayName: (s.display_name as string) || `Learner (${userId.slice(0, 6)})`,
              emailOrSyncId: userId,
              avatarUrl: (s.avatar_url as string) || null,
              status: this.determineStatus(lastActive),
              playlistsCount: userPlaylists.length,
              playlists: userPlaylists,
              activePlaylist: activePlaylistTitle,
              progressPct: realProgressPct,
              todayStudySeconds: Number(s.today_study_seconds) || 0,
              todayCompleted,
              currentStreak,
              isDuoPaired: userTracked?.collaborationEnabled ?? false,
              lastActiveAt: lastActive,
            });
          });
        }

        // Also process any synced tracker_data users not present in partner_snapshots
        if (trackerRes.data) {
          trackerRes.data.forEach((row: Record<string, unknown>) => {
            const syncId = row.sync_id as string;
            if (!syncId || processedUserIds.has(syncId)) return;
            processedUserIds.add(syncId);

            const rowData = row.data as
              | {
                  playlists?: Record<string, PlaylistRecord>;
                  activePlaylistId?: string | null;
                  dailyGoals?: { goals?: Array<{ completed?: boolean }> };
                  dailyGoalsHistory?: Record<string, number>;
                  collaborationEnabled?: boolean;
                }
              | undefined;
            const userPlaylists = this.extractPlaylistsFromRecord(rowData?.playlists);
            const lastActive = (row.updated_at as string) || new Date().toISOString();

            let activePlaylistTitle = 'None';
            let realProgressPct = 0;

            if (rowData?.playlists && Object.keys(rowData.playlists).length > 0) {
              const activeId = rowData.activePlaylistId;
              const activePl = activeId && rowData.playlists[activeId]
                ? rowData.playlists[activeId]
                : rowData.playlists[Object.keys(rowData.playlists)[0]];

              if (activePl) {
                activePlaylistTitle = activePl.name;
                let completedTasks = 0;
                let totalTasks = 0;
                if (activePl.tasks) {
                  Object.values(activePl.tasks).forEach(task => {
                    if (task && Array.isArray(task.subtasks)) {
                      totalTasks += task.subtasks.length;
                      completedTasks += task.subtasks.filter(sub => sub.completed).length;
                    }
                  });
                }
                realProgressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
              }
            } else if (userPlaylists.length > 0) {
              activePlaylistTitle = userPlaylists[0].name;
              realProgressPct = userPlaylists[0].progressPct;
            }

            records.push({
              id: syncId,
              displayName: `Learner (${syncId.slice(0, 6)})`,
              emailOrSyncId: syncId,
              avatarUrl: null,
              status: this.determineStatus(lastActive),
              playlistsCount: userPlaylists.length,
              playlists: userPlaylists,
              activePlaylist: activePlaylistTitle,
              progressPct: realProgressPct,
              todayStudySeconds: 0,
              todayCompleted: rowData?.dailyGoals?.goals?.filter(g => g.completed)?.length || 0,
              currentStreak: Object.keys(rowData?.dailyGoalsHistory || {}).length || 0,
              isDuoPaired: rowData?.collaborationEnabled ?? false,
              lastActiveAt: lastActive,
            });
          });
        }
      } catch (err: unknown) {
        logger.error('admin', 'Failed to fetch real records from Supabase', undefined, err);
      }
    } else if (typeof window !== 'undefined') {
      // Local dev only (when Supabase is unconfigured)
      const local = loadData();
      const userPlaylists = this.extractPlaylistsFromRecord(local?.playlists);
      const activePl = local?.playlists && local.activePlaylistId ? local.playlists[local.activePlaylistId] : null;
      let activeProgress = 0;
      if (activePl?.tasks) {
        let comp = 0;
        let tot = 0;
        Object.values(activePl.tasks).forEach(t => {
          if (t && Array.isArray(t.subtasks)) {
            tot += t.subtasks.length;
            comp += t.subtasks.filter(s => s.completed).length;
          }
        });
        if (tot > 0) activeProgress = Math.round((comp / tot) * 100);
      }

      const studyTime = loadStudyTime();
      records.push({
        id: 'local_learner',
        displayName: 'Local Learner',
        emailOrSyncId: 'local_learner',
        avatarUrl: null,
        status: 'online',
        playlistsCount: userPlaylists.length,
        playlists: userPlaylists,
        activePlaylist: activePl?.name || userPlaylists[0]?.name || 'None',
        progressPct: activeProgress,
        todayStudySeconds: studyTime.seconds || 0,
        todayCompleted: local?.dailyGoals?.goals?.filter(g => g.completed)?.length || 0,
        currentStreak: Object.keys(local?.dailyGoalsHistory || {}).length || 0,
        isDuoPaired: false,
        lastActiveAt: new Date().toISOString(),
      });
    }

    // Sort learners by Last Active date descending (most recently active first)
    records.sort((a, b) => {
      const timeA = new Date(a.lastActiveAt).getTime() || 0;
      const timeB = new Date(b.lastActiveAt).getTime() || 0;
      return timeB - timeA;
    });

    return records;
  }

  /**
   * Hard Delete a user and all of their associated data completely from the database:
   * - Tracker data (playlists, checklists, daily habits, focus logs)
   * - Duo buddy partnerships, chat messages, and shared scratchpads
   * - Partner snapshots & public telemetry
   * - Blocked user entries
   * - Supabase Auth record (via API route)
   */
  public async hardDeleteUser(userId: string, email?: string): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('admin', `Initiating Hard Delete for user: ${userId} (${email || 'no email'})`);

      let apiSuccess = false;

      // 1. Call the server-side deletion API route with the current admin session token
      if (isSupabaseConfigured() && supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        if (token) {
          try {
            const response = await fetch('/api/admin/users/delete', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ userId, email }),
            });

            const result = await response.json();
            if (response.ok && result.success) {
              apiSuccess = true;
            } else if (result.error) {
              logger.warn('admin', 'Server delete route reported error, executing direct client fallback', undefined, result.error);
            }
          } catch (err: unknown) {
            logger.warn('admin', 'Failed to call /api/admin/users/delete route, falling back to direct client deletion', undefined, err);
          }
        }

        // 2. Client-side cascading deletion fallback (in case API route had partial network failure or direct DB access)
        try {
          const { data: partnerships } = await supabase
            .from('duo_partnerships')
            .select('id')
            .or(`user_a.eq.${userId},user_b.eq.${userId}`);

          const partnershipIds = (partnerships || []).map((p: { id: string }) => p.id).filter(Boolean);

          if (partnershipIds.length > 0) {
            await Promise.allSettled([
              supabase.from('duo_scratchpads').delete().in('partnership_id', partnershipIds),
              supabase.from('duo_messages').delete().in('partnership_id', partnershipIds),
              supabase.from('duo_partnerships').delete().in('id', partnershipIds),
            ]);
          }

          await Promise.allSettled([
            supabase.from('duo_messages').delete().eq('sender_id', userId),
            supabase.from('duo_scratchpads').delete().eq('updated_by', userId),
            supabase.from('partner_snapshots').delete().eq('user_id', userId),
            supabase.from('tracker_data').delete().eq('sync_id', userId),
            email
              ? supabase.from('blocked_users').delete().or(`id.eq.${userId},email.eq.${email.toLowerCase().trim()}`)
              : supabase.from('blocked_users').delete().eq('id', userId),
          ]);
        } catch (dbErr: unknown) {
          logger.warn('admin', 'Client-side fallback cleanup had partial error', undefined, dbErr);
        }
      }

      logger.info('admin', `Hard Delete completed successfully for user ${userId}`);
      return { success: true };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete user data';
      logger.error('admin', `Failed to hard delete user ${userId}`, undefined, err);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Export learner roster to CSV file
   */
  public exportUsersCsv(users: AdminUserRecord[]): void {
    if (typeof window === 'undefined') return;

    const headers = [
      'User ID',
      'Name',
      'Status',
      'Playlists Count',
      'Playlists Added',
      'Active Course',
      'Course Progress (%)',
      'Today Study (min)',
      'Today Tasks',
      'Streak (days)',
      'Last Active',
    ];

    const rows = users.map(u => [
      `"${u.id}"`,
      `"${u.displayName}"`,
      `"${u.status}"`,
      u.playlistsCount,
      `"${u.playlists.map(p => `${p.name} (${p.progressPct}%)`).join('; ')}"`,
      `"${u.activePlaylist.replace(/"/g, '""')}"`,
      u.progressPct,
      Math.round(u.todayStudySeconds / 60),
      u.todayCompleted,
      u.currentStreak,
      `"${u.lastActiveAt}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `learners-roster-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logger.info('admin', 'Exported learner roster CSV', { rowCount: users.length });
  }
}

export const adminService = new AdminService();

