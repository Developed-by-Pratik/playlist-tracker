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
import { AppData, PlaylistRecord, TaskRecord, SubTask, DailyGoal, StudyResource, UserPreferences } from './types';
import { RealtimeChannel } from '@supabase/supabase-js';
import { logger } from '@/lib/observability/logger';

const TABLE = 'tracker_data';

let cachedSyncId: string | null = null;

if (typeof window !== 'undefined' && isSupabaseConfigured() && supabase) {
  // Prime the cache and listen for updates reactively
  supabase.auth.getSession().then(({ data }) => {
    cachedSyncId = data.session?.user?.id ?? null;
  });
  supabase.auth.onAuthStateChange((_event, session) => {
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

  const { error } = await supabase.from(TABLE).upsert(
    { sync_id: syncId, data, updated_at: new Date().toISOString() },
    { onConflict: 'sync_id' }
  );

  if (error) {
    logger.error('cloud-sync', 'Failed to upsert tracker data to Supabase', { syncId }, error);
    throw error;
  }
  logger.debug('cloud-sync', 'Successfully synced tracker data to Supabase', {
    syncId,
    resourcesCount: data.resources?.length || 0,
  });
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

  if (error || !data) {
    if (error && error.code !== 'PGRST116') {
      logger.warn('cloud-sync', 'Could not load data from cloud', { syncId }, error);
    }
    return null;
  }

  const cloudData = data.data as AppData;
  logger.info('cloud-sync', 'Loaded tracker data from cloud', {
    syncId,
    playlistsCount: Object.keys(cloudData.playlists || {}).length,
    resourcesCount: cloudData.resources?.length || 0,
    hasUserPreferences: !!cloudData.userPreferences,
  });
  return cloudData;
}

/**
 * Merges remote data into local data using Last-Write-Wins (LWW) protocol
 * with granular merging for Playlists, Subtasks, Daily Goals, Resources, and User Preferences.
 */
export function mergeData(local: AppData, remote: AppData): AppData {
  const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
  const remoteTime = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;

  // If one of them has never been updated/saved, return the other.
  if (!local.updatedAt) return remote;
  if (!remote.updatedAt) return local;

  // Helper to compare data content ignoring updatedAt and key ordering
  const isContentEqual = (a: AppData, b: AppData) => {
    const { updatedAt: _, ...restA } = a;
    const { updatedAt: __, ...restB } = b;
    void _;
    void __;

    const canonicalStringify = (obj: unknown): string => {
      if (obj === null || obj === undefined) {
        return 'null';
      }
      if (typeof obj !== 'object') {
        return JSON.stringify(obj);
      }
      if (Array.isArray(obj)) {
        return '[' + obj.map(canonicalStringify).join(',') + ']';
      }
      const record = obj as Record<string, unknown>;
      const sortedKeys = Object.keys(record)
        .filter(key => record[key] !== undefined && record[key] !== null)
        .sort();
      const pairs = sortedKeys.map(key => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`);
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
      const addedTime = new Date(localPl.addedAt).getTime();
      if (addedTime > remoteTime) {
        mergedPlaylists[pid] = localPl;
      } else if (localTime > remoteTime) {
        mergedPlaylists[pid] = localPl;
      }
    } else if (remotePl && !localPl) {
      const addedTime = new Date(remotePl.addedAt).getTime();
      if (addedTime > localTime) {
        mergedPlaylists[pid] = remotePl;
      } else if (remoteTime > localTime) {
        mergedPlaylists[pid] = remotePl;
      }
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
          // Merge subtasks: the newer record defines the authoritative list of subtasks
          const baseTask = localTime >= remoteTime ? localTask : remoteTask;
          const otherTask = localTime >= remoteTime ? remoteTask : localTask;
          const otherMap = new Map<string, SubTask>(otherTask.subtasks.map(s => [s.id, s]));

          const mergedSubtasks = baseTask.subtasks.map(baseSub => {
            const otherSub = otherMap.get(baseSub.id);
            return {
              ...baseSub,
              completed: baseSub.completed || (otherSub ? otherSub.completed : false),
            };
          });

          const allCompleted = mergedSubtasks.length > 0 && mergedSubtasks.every(s => s.completed);

          let completedAt = baseTask.completedAt || otherTask.completedAt;
          if (!allCompleted) {
            completedAt = undefined;
          } else if (!completedAt) {
            completedAt = new Date().toISOString();
          }

          mergedTasks[vid] = {
            videoId: vid,
            subtasks: mergedSubtasks,
            completedAt,
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
      const baseGoals = localTime >= remoteTime ? local.dailyGoals.goals : remote.dailyGoals.goals;
      const otherGoals = localTime >= remoteTime ? remote.dailyGoals.goals : local.dailyGoals.goals;
      const otherMap = new Map<string, DailyGoal>(otherGoals.map(g => [g.id, g]));

      mergedDailyGoals = {
        lastRefreshedDate: localGoalsDate,
        goals: baseGoals.map(baseGoal => {
          const otherGoal = otherMap.get(baseGoal.id);
          return {
            ...baseGoal,
            completed: baseGoal.completed || (otherGoal && localTime === remoteTime ? otherGoal.completed : baseGoal.completed),
          };
        }),
      };
    } else {
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

  // Deep merge resources by resource ID
  const localResources = local.resources || [];
  const remoteResources = remote.resources || [];
  let mergedResources: StudyResource[];

  if (localResources.length === 0 && remoteResources.length > 0) {
    mergedResources = remoteResources;
  } else if (remoteResources.length === 0 && localResources.length > 0) {
    mergedResources = localResources;
  } else {
    const resourceMap = new Map<string, StudyResource>();
    remoteResources.forEach(res => {
      resourceMap.set(res.id, res);
    });

    localResources.forEach(localRes => {
      const remoteRes = resourceMap.get(localRes.id);
      if (!remoteRes) {
        const addedTime = localRes.createdAt ? new Date(localRes.createdAt).getTime() : 0;
        if (addedTime > remoteTime || localTime >= remoteTime) {
          resourceMap.set(localRes.id, localRes);
        }
      } else {
        const chosen = localTime >= remoteTime ? localRes : remoteRes;
        resourceMap.set(localRes.id, chosen);
      }
    });

    // Check if any deleted remotely or locally
    if (localTime > remoteTime) {
      remoteResources.forEach(remRes => {
        const createdTime = remRes.createdAt ? new Date(remRes.createdAt).getTime() : 0;
        if (!localResources.some(lr => lr.id === remRes.id) && createdTime < localTime) {
          resourceMap.delete(remRes.id);
        }
      });
    }

    mergedResources = Array.from(resourceMap.values()).sort((a, b) => {
      const tA = new Date(a.createdAt || 0).getTime();
      const tB = new Date(b.createdAt || 0).getTime();
      return tB - tA;
    });
  }

  // Merge User Preferences per account
  const mergedUserPreferences: UserPreferences = {
    theme: newer.userPreferences?.theme ?? local.userPreferences?.theme ?? remote.userPreferences?.theme ?? 'dark',
    hideCompleted: newer.userPreferences?.hideCompleted ?? local.userPreferences?.hideCompleted ?? remote.userPreferences?.hideCompleted ?? false,
    sidebarCollapsed: newer.userPreferences?.sidebarCollapsed ?? local.userPreferences?.sidebarCollapsed ?? remote.userPreferences?.sidebarCollapsed ?? false,
  };

  // Merge User Profile
  const mergedUserProfile = newer.userProfile || local.userProfile || remote.userProfile;

  // Merge Collaboration State
  const mergedCollaborationEnabled = newer.collaborationEnabled ?? local.collaborationEnabled ?? remote.collaborationEnabled ?? false;

  // Assemble the merged AppData
  const mergedData: AppData = {
    settings: {
      youtubeApiKey: newer.settings.youtubeApiKey
    },
    playlists: mergedPlaylists,
    activePlaylistId: newer.activePlaylistId,
    dailyGoals: mergedDailyGoals,
    dailyGoalsHistory: Object.keys(mergedHistory).length > 0 ? mergedHistory : undefined,
    resources: mergedResources,
    collaborationEnabled: mergedCollaborationEnabled,
    userProfile: mergedUserProfile,
    userPreferences: mergedUserPreferences,
    updatedAt: new Date().toISOString()
  };

  // If local was the winner, but we resolved merges, or vice-versa, make sure to sync back
  if (localTime > remoteTime || JSON.stringify(mergedData) !== JSON.stringify(remote)) {
    syncToCloud(mergedData).catch(err => logger.warn('cloud-sync', 'Failed to push merged data to cloud', undefined, err));
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

  const initSubscription = async () => {
    const syncId = await getSyncId();
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
          if (newRow?.data) {
            logger.info('cloud-sync', 'Received realtime cloud update from remote device', { syncId });
            onUpdate(newRow.data);
          }
        }
      )
      .subscribe((status) => {
        logger.debug('cloud-sync', `Realtime channel subscription status: ${status}`, { syncId });
      });
  };

  initSubscription();

  return () => {
    unsubscribed = true;
    if (localChannel && supabase) {
      supabase.removeChannel(localChannel);
    }
  };
}
