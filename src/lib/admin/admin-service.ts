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
    const records: AdminUserRecord[] = [];
    const local = typeof window !== 'undefined' ? loadData() : null;

    // 1. If Supabase is connected, query partner snapshots and tracker data
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
            dailyGoals?: { goals?: Array<{ completed?: boolean }> };
            dailyGoalsHistory?: Record<string, number>;
            collaborationEnabled?: boolean;
          }
        > = {};

        if (trackerRes.data) {
          trackerRes.data.forEach((row: Record<string, unknown>) => {
            const rowData = row.data as
              | {
                  playlists?: Record<string, PlaylistRecord>;
                  dailyGoals?: { goals?: Array<{ completed?: boolean }> };
                  dailyGoalsHistory?: Record<string, number>;
                  collaborationEnabled?: boolean;
                }
              | undefined;
            if (row.sync_id && rowData) {
              trackerDataMap[row.sync_id as string] = rowData;
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
            const activePlaylistTitle = (s.active_playlist as string) || (userPlaylists[0]?.name || 'None');

            records.push({
              id: userId,
              displayName: (s.display_name as string) || 'Anonymous Learner',
              emailOrSyncId: userId,
              avatarUrl: (s.avatar_url as string) || null,
              status: this.determineStatus(lastActive),
              playlistsCount: userPlaylists.length,
              playlists: userPlaylists,
              activePlaylist: activePlaylistTitle,
              progressPct: Number(s.progress_pct) || 0,
              todayStudySeconds: Number(s.today_study_seconds) || 0,
              todayCompleted: Number(s.today_completed) || 0,
              currentStreak: Number(s.current_streak) || 0,
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
                  dailyGoals?: { goals?: Array<{ completed?: boolean }> };
                  dailyGoalsHistory?: Record<string, number>;
                  collaborationEnabled?: boolean;
                }
              | undefined;
            const userPlaylists = this.extractPlaylistsFromRecord(rowData?.playlists);
            const lastActive = (row.updated_at as string) || new Date().toISOString();

            let progressPct = 0;
            if (userPlaylists.length > 0) {
              progressPct = userPlaylists[0].progressPct;
            }

            records.push({
              id: syncId,
              displayName: `Learner (${syncId.slice(0, 6)})`,
              emailOrSyncId: syncId,
              avatarUrl: null,
              status: this.determineStatus(lastActive),
              playlistsCount: userPlaylists.length,
              playlists: userPlaylists,
              activePlaylist: userPlaylists[0]?.name || 'None',
              progressPct,
              todayStudySeconds: 0,
              todayCompleted: rowData?.dailyGoals?.goals?.filter(g => g.completed)?.length || 0,
              currentStreak: Object.keys(rowData?.dailyGoalsHistory || {}).length || 0,
              isDuoPaired: rowData?.collaborationEnabled ?? false,
              lastActiveAt: lastActive,
            });
          });
        }
      } catch (err: unknown) {
        logger.error('admin', 'Failed to fetch snapshots from Supabase', undefined, err);
      }
    }

    // 2. Add current active user if not already in records
    const partnership = typeof window !== 'undefined' ? getLocalPartnership() : null;
    const currentUserId = partnership?.userA || 'current_user';
    const hasCurrent = records.some(r => r.id === currentUserId || (r.id === 'current_user' && currentUserId === 'current_user'));

    if (!hasCurrent) {
      const userPlaylists = this.extractPlaylistsFromRecord(local?.playlists);
      const activePlaylistTitle =
        local?.playlists && local.activePlaylistId && local.playlists[local.activePlaylistId]
          ? local.playlists[local.activePlaylistId].name
          : userPlaylists[0]?.name || 'None';

      const studyTime = typeof window !== 'undefined' ? loadStudyTime() : { seconds: 0 };

      // Calculate progress of active playlist
      const activePl = local?.playlists && local.activePlaylistId ? local.playlists[local.activePlaylistId] : null;
      let activeProgress = 0;
      if (activePl?.tasks) {
        let comp = 0;
        let tot = 0;
        Object.values(activePl.tasks).forEach(t => {
          if (t.subtasks) {
            tot += t.subtasks.length;
            comp += t.subtasks.filter(s => s.completed).length;
          }
        });
        if (tot > 0) activeProgress = Math.round((comp / tot) * 100);
      }

      const todayCompleted = local?.dailyGoals?.goals?.filter(g => g.completed)?.length || 0;
      const currentStreak = Object.keys(local?.dailyGoalsHistory || {}).length;

      records.unshift({
        id: currentUserId,
        displayName: 'You (Current Learner)',
        emailOrSyncId: currentUserId === 'current_user' ? 'Local Learner' : currentUserId,
        avatarUrl: null,
        status: 'online',
        playlistsCount: userPlaylists.length,
        playlists: userPlaylists,
        activePlaylist: activePlaylistTitle,
        progressPct: activeProgress,
        todayStudySeconds: studyTime.seconds || 0,
        todayCompleted,
        currentStreak,
        isDuoPaired: Boolean(local?.collaborationEnabled && partnership),
        partnerName: partnership ? 'Connected Partner' : undefined,
        lastActiveAt: new Date().toISOString(),
      });
    }

    return records;
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
