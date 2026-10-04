/**
 * collaboration-service.ts — 1-on-1 Duo Pairing, Progress Mirroring & Real-Time Presence
 *
 * Manages pairing via 6-character Duo Codes, periodic snapshot publishing to Supabase,
 * real-time presence heartbeats, and read-only partner progress mirroring.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getSyncId } from '@/lib/cloud-storage';
import { DuoPartnership, PartnerSnapshot } from '@/lib/types/collaboration';
import { logger } from '@/lib/observability/logger';
import { RealtimeChannel } from '@supabase/supabase-js';

const STORAGE_PARTNERSHIP_KEY = 'playlist_tracker_duo_partnership';
const STORAGE_MY_CODE_KEY = 'playlist_tracker_my_duo_code';
const STORAGE_PARTNER_SNAPSHOT_KEY = 'playlist_tracker_partner_snapshot';
const STORAGE_GHOST_MODE_KEY = 'playlist_tracker_ghost_mode';

const SNAPSHOTS_TABLE = 'partner_snapshots';
const PARTNERSHIPS_TABLE = 'duo_partnerships';

/** Generate or retrieve a consistent 6-character user Duo Code */
export function getMyDuoCode(): string {
  if (typeof window === 'undefined') return 'SYNC-01';
  let code = localStorage.getItem(STORAGE_MY_CODE_KEY);
  if (!code) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let rand = '';
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code = `DUO-${rand}`;
    localStorage.setItem(STORAGE_MY_CODE_KEY, code);
  }
  return code;
}

/** Check if user currently has Privacy / Ghost Mode enabled */
export function isGhostModeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_GHOST_MODE_KEY) === 'true';
}

/** Toggle Privacy / Ghost Mode */
export function setGhostMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_GHOST_MODE_KEY, String(enabled));
  logger.info('collaboration', `Privacy / Ghost Mode toggled: ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

/** Load local partnership record */
export function getLocalPartnership(): DuoPartnership | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_PARTNERSHIP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Save local partnership record */
export function saveLocalPartnership(partnership: DuoPartnership | null): void {
  if (typeof window === 'undefined') return;
  if (!partnership) {
    localStorage.removeItem(STORAGE_PARTNERSHIP_KEY);
    localStorage.removeItem(STORAGE_PARTNER_SNAPSHOT_KEY);
  } else {
    localStorage.setItem(STORAGE_PARTNERSHIP_KEY, JSON.stringify(partnership));
  }
}

/** Load cached partner snapshot */
export function getCachedPartnerSnapshot(): PartnerSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_PARTNER_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Format last active timestamp into a human-friendly string */
export function formatLastActive(isoTimestamp: string, isPrivate: boolean): string {
  if (isPrivate) return 'Private 👻';
  if (!isoTimestamp) return 'Offline';

  const diffMs = Date.now() - new Date(isoTimestamp).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);

  if (diffMin < 2) return 'Online Now 🟢';
  if (diffMin < 60) return `Active ${diffMin}m ago`;
  if (diffHours < 24) return `Active ${diffHours}h ago`;
  return `Active on ${new Date(isoTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

class CollaborationService {
  private partnerChannel: RealtimeChannel | null = null;
  private partnerSnapshotListeners: Set<(snapshot: PartnerSnapshot | null) => void> = new Set();
  private partnershipListeners: Set<(partnership: DuoPartnership | null) => void> = new Set();
  private currentPartnerSnapshot: PartnerSnapshot | null = null;
  private currentPartnership: DuoPartnership | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.currentPartnership = getLocalPartnership();
      this.currentPartnerSnapshot = getCachedPartnerSnapshot();
    }
  }

  /** Initialize collaboration listeners and heartbeat */
  public async init(): Promise<void> {
    if (typeof window === 'undefined') return;

    this.currentPartnership = getLocalPartnership();
    this.currentPartnerSnapshot = getCachedPartnerSnapshot();

    if (this.currentPartnership && this.currentPartnership.status === 'active') {
      this.setupPartnerRealtime(this.currentPartnership);
    }

    // Start 60-second heartbeat ticker
    if (!this.heartbeatInterval) {
      this.heartbeatInterval = setInterval(() => {
        this.sendHeartbeat();
      }, 60000);
    }

    logger.info('collaboration', 'Collaboration service initialized', {
      duoCode: getMyDuoCode(),
      paired: !!this.currentPartnership,
    });
  }

  /** Setup real-time listener for partner snapshot */
  private async setupPartnerRealtime(partnership: DuoPartnership): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return;
    if (this.partnerChannel) {
      supabase.removeChannel(this.partnerChannel);
      this.partnerChannel = null;
    }

    const myUid = await getSyncId();
    const partnerId = partnership.userA === myUid ? partnership.userB : partnership.userA;
    if (!partnerId) return;

    // Fetch initial snapshot from database
    try {
      const { data, error } = await supabase
        .from(SNAPSHOTS_TABLE)
        .select('*')
        .eq('user_id', partnerId)
        .single();

      if (!error && data) {
        this.updatePartnerSnapshotFromRow(data);
      }
    } catch (err) {
      logger.debug('collaboration', 'Partner snapshot table query skipped or table pending', { error: String(err) });
    }

    // Subscribe to Postgres changes on partner's row
    const channelName = `partner_snapshot_${partnerId}_${Math.random().toString(36).slice(2, 7)}`;
    this.partnerChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: SNAPSHOTS_TABLE,
          filter: `user_id=eq.${partnerId}`,
        },
        payload => {
          if (payload.new) {
            this.updatePartnerSnapshotFromRow(payload.new);
          }
        }
      )
      .subscribe();
  }

  private updatePartnerSnapshotFromRow(row: Record<string, unknown>): void {
    const isPrivate = Boolean(row.is_private);
    const snapshot: PartnerSnapshot = {
      userId: String(row.user_id || ''),
      displayName: String(row.display_name || 'Study Partner'),
      avatarUrl: (row.avatar_url as string) || null,
      activePlaylist: isPrivate ? 'Studying in Privacy Mode' : (row.active_playlist as string) || 'General Study',
      progressPct: isPrivate ? 0 : Number(row.progress_pct || 0),
      todayCompleted: isPrivate ? 0 : Number(row.today_completed || 0),
      currentStreak: Number(row.current_streak || 0),
      todayStudySeconds: isPrivate ? 0 : Number(row.today_study_seconds || 0),
      isPrivate,
      lastActiveAt: String(row.last_active_at || new Date().toISOString()),
    };

    this.currentPartnerSnapshot = snapshot;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_PARTNER_SNAPSHOT_KEY, JSON.stringify(snapshot));
    }

    this.partnerSnapshotListeners.forEach(listener => {
      try {
        listener(snapshot);
      } catch {
        // Prevent listener crashes
      }
    });

    logger.debug('collaboration', `Updated partner snapshot: ${snapshot.displayName}`, {
      progress: snapshot.progressPct,
      isPrivate: snapshot.isPrivate,
    });
  }

  /** Publish the current user's progress snapshot to partner */
  public async publishMySnapshot(params: {
    displayName: string;
    avatarUrl?: string | null;
    email?: string | null;
    activePlaylistName?: string;
    progressPct: number;
    todayCompleted: number;
    currentStreak: number;
    todayStudySeconds: number;
  }): Promise<void> {
    const isPrivate = isGhostModeEnabled();
    const myUid = (await getSyncId()) || getMyDuoCode();

    const payload: Record<string, unknown> = {
      user_id: myUid,
      display_name: params.displayName,
      avatar_url: params.avatarUrl || null,
      active_playlist: params.activePlaylistName || 'General Learning',
      progress_pct: params.progressPct,
      today_completed: params.todayCompleted,
      current_streak: params.currentStreak,
      today_study_seconds: params.todayStudySeconds,
      is_private: isPrivate,
      last_active_at: new Date().toISOString(),
    };

    if (params.email) {
      payload.email = params.email;
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from(SNAPSHOTS_TABLE).upsert(payload, { onConflict: 'user_id' });
        logger.debug('collaboration', 'Pushed snapshot to cloud', { progress: params.progressPct });
      } catch (err) {
        logger.warn('collaboration', 'Failed to push snapshot to Supabase (table may not exist yet)', undefined, err);
      }
    }
  }

  /** Send a heartbeat to refresh last active presence */
  public async sendHeartbeat(): Promise<void> {
    const myUid = (await getSyncId()) || getMyDuoCode();
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from(SNAPSHOTS_TABLE)
          .update({ last_active_at: new Date().toISOString() })
          .eq('user_id', myUid);
      } catch {
        // Silently ignore heartbeat errors
      }
    }
  }

  /** Pair with a partner using their 6-character Duo Code */
  public async pairWithCode(
    targetCode: string,
    myProfile: { name: string; avatar?: string | null }
  ): Promise<{ success: boolean; error?: string; partnership?: DuoPartnership }> {
    const cleanCode = targetCode.trim().toUpperCase();
    const myCode = getMyDuoCode();

    if (!cleanCode) {
      return { success: false, error: 'Please enter a valid Duo Code.' };
    }

    if (cleanCode === myCode) {
      return { success: false, error: 'You cannot pair with your own Duo Code!' };
    }

    const myUid = (await getSyncId()) || myCode;

    // Handle Demo / Mock Partner option
    if (cleanCode === 'DEMO' || cleanCode === 'DUO-DEMO') {
      const demoPartnership: DuoPartnership = {
        id: 'demo-partnership-id',
        duoCode: cleanCode,
        userA: myUid,
        userB: 'demo-partner-alex',
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      const demoSnapshot: PartnerSnapshot = {
        userId: 'demo-partner-alex',
        displayName: 'Alex (Study Buddy)',
        avatarUrl: null,
        activePlaylist: 'Next.js 16 & React 19 Mastery',
        progressPct: 65,
        todayCompleted: 3,
        currentStreak: 4,
        todayStudySeconds: 4200, // 1h 10m
        isPrivate: false,
        lastActiveAt: new Date().toISOString(),
      };

      this.currentPartnership = demoPartnership;
      this.currentPartnerSnapshot = demoSnapshot;
      saveLocalPartnership(demoPartnership);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_PARTNER_SNAPSHOT_KEY, JSON.stringify(demoSnapshot));
      }

      this.notifyPartnershipListeners(demoPartnership);
      this.notifyPartnerSnapshotListeners(demoSnapshot);

      logger.info('collaboration', 'Paired successfully with Demo Partner (Alex)', { initiatedBy: myProfile.name });
      return { success: true, partnership: demoPartnership };
    }

    // Cloud pairing via Supabase
    if (isSupabaseConfigured() && supabase) {
      try {
        // Query partnerships table or create row
        const partnershipRow = {
          duo_code: cleanCode,
          user_a: myUid,
          user_b: cleanCode,
          status: 'active',
        };

        const { data, error } = await supabase
          .from(PARTNERSHIPS_TABLE)
          .upsert(partnershipRow, { onConflict: 'duo_code' })
          .select()
          .single();

        if (error) {
          logger.warn('collaboration', 'Cloud pairing failed, activating local pair mode', undefined, error);
        }

        const partnership: DuoPartnership = {
          id: (data?.id as string) || `pair-${Date.now()}`,
          duoCode: cleanCode,
          userA: myUid,
          userB: cleanCode,
          status: 'active',
          createdAt: new Date().toISOString(),
        };

        this.currentPartnership = partnership;
        saveLocalPartnership(partnership);
        this.notifyPartnershipListeners(partnership);
        this.setupPartnerRealtime(partnership);

        logger.info('collaboration', `Paired with partner code: ${cleanCode}`);
        return { success: true, partnership };
      } catch (err) {
        logger.error('collaboration', 'Error during pairing', undefined, err);
      }
    }

    // Local fallback pair
    const fallbackPair: DuoPartnership = {
      id: `pair-${Date.now()}`,
      duoCode: cleanCode,
      userA: myUid,
      userB: cleanCode,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    this.currentPartnership = fallbackPair;
    saveLocalPartnership(fallbackPair);
    this.notifyPartnershipListeners(fallbackPair);

    logger.info('collaboration', `Paired in local fallback mode with code: ${cleanCode}`);
    return { success: true, partnership: fallbackPair };
  }

  /** Disconnect and unpair from current study partner */
  public disconnectPartner(): void {
    if (this.partnerChannel && supabase) {
      supabase.removeChannel(this.partnerChannel);
      this.partnerChannel = null;
    }

    this.currentPartnership = null;
    this.currentPartnerSnapshot = null;
    saveLocalPartnership(null);

    this.notifyPartnershipListeners(null);
    this.notifyPartnerSnapshotListeners(null);

    logger.info('collaboration', 'Disconnected from study partner');
  }

  public subscribeToPartnerSnapshot(callback: (snapshot: PartnerSnapshot | null) => void): () => void {
    this.partnerSnapshotListeners.add(callback);
    callback(this.currentPartnerSnapshot);
    return () => {
      this.partnerSnapshotListeners.delete(callback);
    };
  }

  public subscribeToPartnership(callback: (partnership: DuoPartnership | null) => void): () => void {
    this.partnershipListeners.add(callback);
    callback(this.currentPartnership);
    return () => {
      this.partnershipListeners.delete(callback);
    };
  }

  private notifyPartnershipListeners(partnership: DuoPartnership | null): void {
    this.partnershipListeners.forEach(fn => {
      try {
        fn(partnership);
      } catch {
        // Prevent listener crashes
      }
    });
  }

  private notifyPartnerSnapshotListeners(snapshot: PartnerSnapshot | null): void {
    this.partnerSnapshotListeners.forEach(fn => {
      try {
        fn(snapshot);
      } catch {
        // Prevent listener crashes
      }
    });
  }

  public getPartnerSnapshot(): PartnerSnapshot | null {
    return this.currentPartnerSnapshot;
  }

  public getPartnership(): DuoPartnership | null {
    return this.currentPartnership;
  }
}

export const collaborationService = new CollaborationService();
