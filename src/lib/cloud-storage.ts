/**
 * cloud-storage.ts — Centralized real-time sync via Supabase
 *
 * All devices share a single SYNC_ID row in the `tracker_data` table.
 * Any write from any device updates that row; Supabase Realtime broadcasts
 * the change to all other connected devices instantly.
 *
 * Required SQL (run once in Supabase SQL Editor):
 * ────────────────────────────────────────────────
 * create table if not exists tracker_data (
 *   sync_id    text primary key,
 *   data       jsonb not null,
 *   updated_at timestamptz default now()
 * );
 * alter table tracker_data enable row level security;
 * create policy "anon_all" on tracker_data for all using (true) with check (true);
 *
 * -- Enable realtime on this table (Supabase Dashboard → Database → Replication):
 * --   Toggle "tracker_data" table ON under Realtime.
 * ────────────────────────────────────────────────
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { AppData } from './types';
import { RealtimeChannel } from '@supabase/supabase-js';

const TABLE = 'tracker_data';

/** Shared identity for all your devices — set NEXT_PUBLIC_SYNC_ID in .env.local */
export function getSyncId(): string {
  return process.env.NEXT_PUBLIC_SYNC_ID || 'default';
}

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'unconfigured' | 'offline';

/** Write the full AppData to Supabase (upsert) */
export async function syncToCloud(data: AppData): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  await supabase.from(TABLE).upsert(
    { sync_id: getSyncId(), data, updated_at: new Date().toISOString() },
    { onConflict: 'sync_id' }
  );
}

/** Load the current AppData from Supabase. Returns null if not found yet. */
export async function loadFromCloud(): Promise<AppData | null> {
  if (!isSupabaseConfigured() || !supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select('data')
    .eq('sync_id', getSyncId())
    .single();
  if (error || !data) return null;
  return data.data as AppData;
}

/** 
 * Merges remote data into local data.
 * Strategy: Remote tasks override local ones, but we keep any local tasks 
 * that aren't in the cloud yet.
 */
export function mergeData(local: AppData, remote: AppData): AppData {
  return {
    ...remote,
    tasks: {
      ...local.tasks,
      ...remote.tasks,
    },
    // Keep settings from remote as they are usually API keys/etc
    settings: remote.settings || local.settings,
  };
}

let activeChannel: RealtimeChannel | null = null;

/**
 * Subscribe to real-time changes from other devices.
 * Calls `onUpdate(newData)` whenever another device writes.
 * Returns an unsubscribe function.
 */
export function subscribeToCloudChanges(onUpdate: (data: AppData) => void): () => void {
  if (!isSupabaseConfigured() || !supabase) return () => {};

  // Clean up any previous subscription
  if (activeChannel) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
  }

  activeChannel = supabase
    .channel('tracker_data_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: TABLE,
        filter: `sync_id=eq.${getSyncId()}`,
      },
      (payload) => {
        const newRow = payload.new as { data: AppData };
        if (newRow?.data) {
          onUpdate(newRow.data);
        }
      }
    )
    .subscribe();

  return () => {
    if (activeChannel && supabase) {
      supabase.removeChannel(activeChannel);
      activeChannel = null;
    }
  };
}
