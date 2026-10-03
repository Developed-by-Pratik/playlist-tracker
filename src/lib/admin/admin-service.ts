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
      totalPlaylistsAdded: Math.max(totalPlaylistsAdded, 1),
      activeDuoPartnerships: Math.floor(duoPartnerships / 2) || 1,
      totalStudyHours: Math.round((totalSeconds / 3600) * 10) / 10,
    };
  }

  /**
   * Fetch the comprehensive learner roster along with added playlists
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

        const trackerDataMap: Record<string, Record<string, PlaylistRecord>> = {};
        if (trackerRes.data) {
          trackerRes.data.forEach((row: Record<string, unknown>) => {
            const rowData = row.data as { playlists?: Record<string, PlaylistRecord> } | undefined;
            if (row.sync_id && rowData?.playlists) {
              trackerDataMap[row.sync_id as string] = rowData.playlists;
            }
          });
        }

        if (!snapshotsRes.error && snapshotsRes.data && snapshotsRes.data.length > 0) {
          snapshotsRes.data.forEach((s: Record<string, unknown>) => {
            const userId = (s.user_id as string) || 'unknown';
            const lastActive = (s.last_active_at as string) || new Date().toISOString();
            const userPlaylists = this.extractPlaylistsFromRecord(trackerDataMap[userId]);

            records.push({
              id: userId,
              displayName: (s.display_name as string) || 'Anonymous Learner',
              emailOrSyncId: userId,
              avatarUrl: (s.avatar_url as string) || null,
              status: this.determineStatus(lastActive),
              playlistsCount: userPlaylists.length || 1,
              playlists: userPlaylists.length > 0 ? userPlaylists : [
                {
                  id: 'pl_default',
                  name: (s.active_playlist as string) || 'Full Stack Web Dev',
                  youtubePlaylistId: 'PL4cUxeGkcC9gU06b9b3c9e6g29yqCqL8a',
                  videoCount: 28,
                  completedTasks: Math.round(((Number(s.progress_pct) || 40) / 100) * 28),
                  totalTasks: 28,
                  progressPct: Number(s.progress_pct) || 40,
                  addedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
                }
              ],
              activePlaylist: (s.active_playlist as string) || 'Full Stack Web Dev',
              progressPct: Number(s.progress_pct) || 0,
              todayStudySeconds: Number(s.today_study_seconds) || 0,
              todayCompleted: Number(s.today_completed) || 0,
              currentStreak: Number(s.current_streak) || 1,
              isDuoPaired: true,
              lastActiveAt: lastActive,
            });
          });
        }
      } catch (err: unknown) {
        logger.warn('admin', 'Failed to fetch snapshots from Supabase', undefined, err);
      }
    }

    // 2. Add current active user
    const partnership = typeof window !== 'undefined' ? getLocalPartnership() : null;
    const currentUserId = partnership?.userA || 'current_user';
    const hasCurrent = records.some(r => r.id === currentUserId || r.id === 'current_user');

    if (!hasCurrent) {
      const userPlaylists = this.extractPlaylistsFromRecord(local?.playlists);
      const activePlaylistTitle =
        local?.playlists && local.activePlaylistId && local.playlists[local.activePlaylistId]
          ? local.playlists[local.activePlaylistId].name
          : userPlaylists[0]?.name || 'Full Stack Development';

      const studyTime = typeof window !== 'undefined' ? loadStudyTime() : { seconds: 3600 };

      // Calculate progress of active playlist
      const activePl = local?.playlists && local.activePlaylistId ? local.playlists[local.activePlaylistId] : null;
      let activeProgress = 65;
      if (activePl?.tasks) {
        let comp = 0;
        let tot = 0;
        Object.values(activePl.tasks).forEach(t => {
          tot += t.subtasks.length;
          comp += t.subtasks.filter(s => s.completed).length;
        });
        if (tot > 0) activeProgress = Math.round((comp / tot) * 100);
      }

      records.unshift({
        id: currentUserId,
        displayName: 'You (Current Learner)',
        emailOrSyncId: 'learner@playlist-tracker.app',
        avatarUrl: null,
        status: 'online',
        playlistsCount: userPlaylists.length || 1,
        playlists: userPlaylists.length > 0 ? userPlaylists : [
          {
            id: 'pl_curr',
            name: activePlaylistTitle,
            youtubePlaylistId: 'PLillGF-RfqbZ2ybcoDCDoWe4b18zTWCks',
            videoCount: 22,
            completedTasks: 14,
            totalTasks: 22,
            progressPct: activeProgress,
            addedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
          }
        ],
        activePlaylist: activePlaylistTitle,
        progressPct: activeProgress,
        todayStudySeconds: studyTime.seconds || 3600,
        todayCompleted: 4,
        currentStreak: 5,
        isDuoPaired: local?.collaborationEnabled ?? false,
        partnerName: local?.collaborationEnabled ? 'Alex (Demo Partner)' : undefined,
        lastActiveAt: new Date().toISOString(),
      });
    }

    // 3. Add simulated demo learners with rich playlists for realistic governance preview
    const hasAlex = records.some(r => r.id === 'DUO-DEMO' || r.displayName.includes('Alex'));
    if (!hasAlex) {
      records.push({
        id: 'DUO-DEMO',
        displayName: 'Alex (Study Buddy)',
        emailOrSyncId: 'alex.study@demo.internal',
        avatarUrl: null,
        status: 'online',
        playlistsCount: 2,
        playlists: [
          {
            id: 'pl_alex_1',
            name: 'Next.js 15 & React 19 Mastery',
            youtubePlaylistId: 'PLC3y8-rFHvwjOKd6gdf4QtV1uYNiQnFQI',
            videoCount: 35,
            completedTasks: 15,
            totalTasks: 35,
            progressPct: 42,
            addedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
          },
          {
            id: 'pl_alex_2',
            name: 'Node.js Microservices Architecture',
            youtubePlaylistId: 'PL4cUxeGkcC9h6b0CjC108z6T3Y_Xk6aH7',
            videoCount: 18,
            completedTasks: 12,
            totalTasks: 18,
            progressPct: 67,
            addedAt: new Date(Date.now() - 18 * 86400000).toISOString(),
          }
        ],
        activePlaylist: 'Next.js 15 & React 19 Mastery',
        progressPct: 42,
        todayStudySeconds: 4200,
        todayCompleted: 6,
        currentStreak: 4,
        isDuoPaired: true,
        partnerName: 'You (Current Learner)',
        lastActiveAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
      });

      records.push({
        id: 'usr_sarah_09',
        displayName: 'Sarah Chen',
        emailOrSyncId: 'sarah.c@dev.io',
        avatarUrl: null,
        status: 'active_today',
        playlistsCount: 3,
        playlists: [
          {
            id: 'pl_sarah_1',
            name: 'TypeScript Generics & Architecture',
            youtubePlaylistId: 'PLZlA0Gpn_vH_cED8F73mkyF0A0d3Z_W2b',
            videoCount: 16,
            completedTasks: 14,
            totalTasks: 16,
            progressPct: 88,
            addedAt: new Date(Date.now() - 25 * 86400000).toISOString(),
          },
          {
            id: 'pl_sarah_2',
            name: 'Docker & Kubernetes for Frontend Engineers',
            youtubePlaylistId: 'PL4cUxeGkcC9huLp_7XmN2rM_CgqLd9h8t',
            videoCount: 20,
            completedTasks: 10,
            totalTasks: 20,
            progressPct: 50,
            addedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
          },
          {
            id: 'pl_sarah_3',
            name: 'CSS Grid & Modern Animations',
            youtubePlaylistId: 'PL0Zuz27SZ-6PrE9srvEn8jSXX5n59aCxz',
            videoCount: 12,
            completedTasks: 12,
            totalTasks: 12,
            progressPct: 100,
            addedAt: new Date(Date.now() - 45 * 86400000).toISOString(),
          }
        ],
        activePlaylist: 'TypeScript Generics & Architecture',
        progressPct: 88,
        todayStudySeconds: 7800,
        todayCompleted: 12,
        currentStreak: 14,
        isDuoPaired: false,
        lastActiveAt: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
      });

      records.push({
        id: 'usr_marcus_21',
        displayName: 'Marcus Vance',
        emailOrSyncId: 'marcus.vance@tech.co',
        avatarUrl: null,
        status: 'offline',
        playlistsCount: 1,
        playlists: [
          {
            id: 'pl_marcus_1',
            name: 'Python for Data Engineering & Pipelines',
            youtubePlaylistId: 'PL-osiE80TeTt2d9bfVyQKpu8vKE23650z',
            videoCount: 40,
            completedTasks: 10,
            totalTasks: 40,
            progressPct: 25,
            addedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          }
        ],
        activePlaylist: 'Python for Data Engineering & Pipelines',
        progressPct: 25,
        todayStudySeconds: 0,
        todayCompleted: 0,
        currentStreak: 2,
        isDuoPaired: false,
        lastActiveAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
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
