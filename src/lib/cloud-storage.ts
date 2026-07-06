/**
 * cloud-storage.ts — Centralized real-time sync via Supabase
 *
 * sync_id is now the authenticated user's auth.uid().
 * Each user gets their own isolated row in tracker_data.
 *
 * Required SQL (run once in Supabase SQL Editor):
 * ────────────────────────────────────────────────
 * create table if not exists tracker_data (
 *   sync_id    text primary key,
 *   data       jsonb not null,
 *   updated_at timestamptz default now()
 * );
 * alter table tracker_data enable row level security;
 *
 * -- Authenticated users can only access their own row
 * drop policy if exists "anon_all" on tracker_data;
 * create policy "users_own_data" on tracker_data
 *   for all
 *   using  (auth.uid()::text = sync_id)
 *   with check (auth.uid()::text = sync_id);
 *
 * -- Enable realtime on this table (Supabase Dashboard → Database → Replication)
 * ────────────────────────────────────────────────
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { AppData, PlaylistRecord, TaskRecord, SubTask, DailyGoal } from './types';
import { RealtimeChannel } from '@supabase/supabase-js';

const TABLE = 'tracker_data';

let cachedSyncId: string | null = null;

if (typeof window !== 'undefined' && isSupabaseConfigured() && supabase) {
  // Prime the cache and listen for updates reactively
  supabase.auth.getSession().then(({ data }) => {
    cachedSyncId = data.session?.user?.id ?? null;
  });
  supabase.auth.onAuthStateChange((event, session) => {
    cachedSyncId = session?.user?.id ?? null;
  });
}

/** Get the current user's auth UID to use as sync_id */
export async function getSyncId(): Promise<string | null> {
  if (!isSupabaseConfigured() || !supabase) return null;
  if (cachedSyncId) return cachedSyncId;

  const { data } = await supabase.auth.getUser();
  cachedSyncId = data.user?.id ?? null;
  return cachedSyncId;
}

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'unconfigured' | 'offline';

/** Write the full AppData to Supabase (upsert) */
export async function syncToCloud(data: AppData): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const syncId = await getSyncId();
  if (!syncId) return; // Not signed in — skip cloud sync
  await supabase.from(TABLE).upsert(
    { sync_id: syncId, data, updated_at: new Date().toISOString() },
    { onConflict: 'sync_id' }
  );
}

/** Load the current AppData from Supabase. Returns null if not found yet. */
export async function loadFromCloud(): Promise<AppData | null> {
  if (!isSupabaseConfigured() || !supabase) return null;
  const syncId = await getSyncId();
  if (!syncId) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select('data')
    .eq('sync_id', syncId)
    .single();
  if (error || !data) return null;
  return data.data as AppData;
}

/**
 * Merges remote data into local data using Last-Write-Wins (LWW) protocol.
 * The newer updatedAt timestamp decides which data copy is the source of truth.
 */
export function mergeData(local: AppData, remote: AppData): AppData {
  const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
  const remoteTime = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;

  // If one of them has never been updated/saved, return the other.
  if (!local.updatedAt) return remote;
  if (!remote.updatedAt) return local;

  // Helper to compare data content ignoring updatedAt and key ordering
  const isContentEqual = (a: AppData, b: AppData) => {
    const { updatedAt: _a, ...restA } = a;
    const { updatedAt: _b, ...restB } = b;

    const canonicalStringify = (obj: any): string => {
      if (obj === null || obj === undefined) {
        return 'null';
      }
      if (typeof obj !== 'object') {
        return JSON.stringify(obj);
      }
      if (Array.isArray(obj)) {
        return '[' + obj.map(canonicalStringify).join(',') + ']';
      }
      const sortedKeys = Object.keys(obj)
        .filter(key => obj[key] !== undefined && obj[key] !== null)
        .sort();
      const pairs = sortedKeys.map(key => `${JSON.stringify(key)}:${canonicalStringify(obj[key])}`);
      return '{' + pairs.join(',') + '}';
    };

    return canonicalStringify(restA) === canonicalStringify(restB);
  };

  if (isContentEqual(local, remote)) {
    return localTime >= remoteTime ? local : remote;
  }

  // If timestamps are identical, they are already in sync.
  if (localTime === remoteTime) {
    return local;
  }

  // Determine the overall winner for scalar values (like activePlaylistId, settings)
  const newer = localTime > remoteTime ? local : remote;

  // Deep merge playlists
  const mergedPlaylists: Record<string, PlaylistRecord> = {};

  // Gather all playlist IDs from both
  const allPlaylistIds = new Set([
    ...Object.keys(local.playlists || {}),
    ...Object.keys(remote.playlists || {})
  ]);

  allPlaylistIds.forEach(pid => {
    const localPl = local.playlists?.[pid];
    const remotePl = remote.playlists?.[pid];

    if (localPl && !remotePl) {
      // Playlist exists in local but not remote.
      // Was it added locally after the remote's last update?
      // Or was it deleted remotely after local added it?
      const addedTime = new Date(localPl.addedAt).getTime();
      if (addedTime > remoteTime) {
        // Added locally after remote's last sync
        mergedPlaylists[pid] = localPl;
      } else if (localTime > remoteTime) {
        // Local is newer, keep it
        mergedPlaylists[pid] = localPl;
      }
      // Otherwise, it was probably deleted remotely, so we omit it.
    } else if (remotePl && !localPl) {
      // Playlist exists in remote but not local.
      const addedTime = new Date(remotePl.addedAt).getTime();
      if (addedTime > localTime) {
        // Added remotely after local's last sync
        mergedPlaylists[pid] = remotePl;
      } else if (remoteTime > localTime) {
        // Remote is newer, keep it
        mergedPlaylists[pid] = remotePl;
      }
      // Otherwise, it was probably deleted locally, so we omit it.
    } else if (localPl && remotePl) {
      // Playlist exists in both. Merge their tasks!
      const mergedTasks: Record<string, TaskRecord> = {};
      const allVideoIds = new Set([
        ...Object.keys(localPl.tasks || {}),
        ...Object.keys(remotePl.tasks || {})
      ]);

      allVideoIds.forEach(vid => {
        const localTask = localPl.tasks[vid];
        const remoteTask = remotePl.tasks[vid];

        if (localTask && !remoteTask) {
          mergedTasks[vid] = localTask;
        } else if (remoteTask && !localTask) {
          mergedTasks[vid] = remoteTask;
        } else if (localTask && remoteTask) {
          // Merge subtasks. Match by id.
          const subtaskMap = new Map<string, SubTask>();
          
          // Add remote subtasks first
          remoteTask.subtasks.forEach(s => subtaskMap.set(s.id, { ...s }));
          
          // Merge local subtasks
          localTask.subtasks.forEach(localSub => {
            const existing = subtaskMap.get(localSub.id);
            if (existing) {
              // If completed in either, set as completed
              existing.completed = existing.completed || localSub.completed;
            } else {
              subtaskMap.set(localSub.id, { ...localSub });
            }
          });

          const mergedSubtasks = Array.from(subtaskMap.values());
          const allCompleted = mergedSubtasks.length > 0 && mergedSubtasks.every(s => s.completed);
          
          // completedAt: take the oldest completedAt if both completed, or whichever exists
          let completedAt = remoteTask.completedAt || localTask.completedAt;
          if (!allCompleted) {
            completedAt = undefined;
          } else if (!completedAt) {
            completedAt = new Date().toISOString();
          }

          mergedTasks[vid] = {
            videoId: vid,
            subtasks: mergedSubtasks,
            completedAt
          };
        }
      });

      // Keep the newer metadata (e.g. name, videoCount)
      const basePlaylist = localTime > remoteTime ? localPl : remotePl;
      mergedPlaylists[pid] = {
        ...basePlaylist,
        tasks: mergedTasks
      };
    }
  });

  // Deep merge daily goals
  let mergedDailyGoals = newer.dailyGoals;
  if (local.dailyGoals && remote.dailyGoals) {
    const localGoalsDate = local.dailyGoals.lastRefreshedDate;
    const remoteGoalsDate = remote.dailyGoals.lastRefreshedDate;

    if (localGoalsDate === remoteGoalsDate) {
      // Same day, merge the checklist statuses
      const goalsMap = new Map<string, DailyGoal>();
      remote.dailyGoals.goals.forEach(g => goalsMap.set(g.id, { ...g }));
      local.dailyGoals.goals.forEach(lg => {
        const existing = goalsMap.get(lg.id);
        if (existing) {
          existing.completed = existing.completed || lg.completed;
          existing.label = lg.label; // take local label
        } else {
          goalsMap.set(lg.id, { ...lg });
        }
      });
      mergedDailyGoals = {
        lastRefreshedDate: localGoalsDate,
        goals: Array.from(goalsMap.values())
      };
    } else {
      // Different days, take the newer day
      mergedDailyGoals = localGoalsDate > remoteGoalsDate ? local.dailyGoals : remote.dailyGoals;
    }
  }

  // Deep merge daily goals history
  const mergedHistory: Record<string, number> = {};
  const allHistoryDates = new Set([
    ...Object.keys(local.dailyGoalsHistory || {}),
    ...Object.keys(remote.dailyGoalsHistory || {})
  ]);
  allHistoryDates.forEach(date => {
    const localVal = local.dailyGoalsHistory?.[date] || 0;
    const remoteVal = remote.dailyGoalsHistory?.[date] || 0;
    mergedHistory[date] = Math.max(localVal, remoteVal);
  });

  // Assemble the merged AppData
  const mergedData: AppData = {
    settings: {
      youtubeApiKey: newer.settings.youtubeApiKey
    },
    playlists: mergedPlaylists,
    activePlaylistId: newer.activePlaylistId,
    dailyGoals: mergedDailyGoals,
    dailyGoalsHistory: Object.keys(mergedHistory).length > 0 ? mergedHistory : undefined,
    updatedAt: new Date().toISOString()
  };

  // If local was the winner, but we resolved merges, or vice-versa, make sure to sync back
  if (localTime > remoteTime || JSON.stringify(mergedData) !== JSON.stringify(remote)) {
    syncToCloud(mergedData).catch(err => console.warn('[cloud-sync] push merged data failed:', err));
  }

  return mergedData;
}

/**
 * Subscribe to real-time changes from other devices.
 * Returns an unsubscribe function.
 */
export function subscribeToCloudChanges(onUpdate: (data: AppData) => void): () => void {
  if (!isSupabaseConfigured() || !supabase) return () => {};

  let unsubscribed = false;
  let localChannel: RealtimeChannel | null = null;

  getSyncId().then(syncId => {
    if (unsubscribed || !syncId || !supabase) return;

    // Use a unique channel name per subscription instance to avoid React StrictMode double-mount conflicts
    const channelName = `tracker_changes_${syncId}_${Math.random().toString(36).substring(2, 10)}`;
    
    localChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLE,
          filter: `sync_id=eq.${syncId}`,
        },
        payload => {
          const newRow = payload.new as { data: AppData };
          if (newRow?.data) onUpdate(newRow.data);
        }
      )
      .subscribe();
  });

  return () => {
    unsubscribed = true;
    if (localChannel && supabase) {
      supabase.removeChannel(localChannel);
    }
  };
}
