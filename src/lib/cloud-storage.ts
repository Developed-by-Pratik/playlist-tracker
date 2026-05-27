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
import { AppData } from './types';
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

  if (localTime > remoteTime) {
    // Local copy is strictly newer, so local wins.
    // Sync local to the cloud to make sure remote gets it.
    syncToCloud(local).catch(err => console.warn('[cloud-sync] push local to cloud failed:', err));
    return local;
  } else if (remoteTime > localTime) {
    // Remote copy is strictly newer, remote wins.
    return remote;
  } else {
    // Already in sync — do NOT push to cloud again to avoid infinite realtime loops!
    return local;
  }
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
