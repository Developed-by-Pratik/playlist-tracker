/**
 * user-block-service.ts — User Access Suspension & Administrative Moderation Service
 *
 * Manages blocked users list, enforces login gates, and syncs block status
 * between Supabase and local storage cache.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { logger } from '@/lib/observability/logger';
import { ADMIN_EMAILS } from '@/lib/auth';

const STORAGE_BLOCKED_USERS_KEY = 'playlist_tracker_blocked_users';
const BLOCKED_TABLE = 'blocked_users';

export interface BlockedUserEntry {
  id: string;
  email: string;
  displayName: string;
  blockedAt: string;
}

type BlockListener = (blocked: BlockedUserEntry[]) => void;

class UserBlockService {
  private listeners: Set<BlockListener> = new Set();
  private cachedBlocked: BlockedUserEntry[] = [];
  private isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.cachedBlocked = this.loadLocalBlocked();
    }
  }

  private loadLocalBlocked(): BlockedUserEntry[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_BLOCKED_USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalBlocked(list: BlockedUserEntry[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_BLOCKED_USERS_KEY, JSON.stringify(list));
      this.cachedBlocked = list;
      this.notify();
    } catch (e) {
      logger.error('admin', 'Failed to save blocked users to localStorage', undefined, e);
    }
  }

  private notify(): void {
    this.listeners.forEach(fn => {
      try {
        fn(this.cachedBlocked);
      } catch (e) {
        logger.error('admin', 'Error in block listener notification', undefined, e);
      }
    });
  }

  /**
   * Initialize service and sync with Supabase if configured
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from(BLOCKED_TABLE).select('*');
        if (!error && data) {
          const list: BlockedUserEntry[] = data.map((row: Record<string, unknown>) => ({
            id: String(row.id || ''),
            email: String(row.email || '').toLowerCase().trim(),
            displayName: String(row.display_name || 'User'),
            blockedAt: String(row.blocked_at || new Date().toISOString()),
          }));
          this.saveLocalBlocked(list);
        }
      } catch {
        // Fallback to local storage cache
      }
    }
  }

  /**
   * Subscribe to changes in the blocked users list
   */
  public subscribe(listener: BlockListener): () => void {
    this.listeners.add(listener);
    listener(this.cachedBlocked);
    return () => this.listeners.delete(listener);
  }

  /**
   * Check if a given user ID or email is currently blocked
   */
  public isBlocked(userId?: string | null, email?: string | null): boolean {
    if (!this.cachedBlocked.length) {
      this.cachedBlocked = this.loadLocalBlocked();
    }

    const cleanEmail = email?.toLowerCase().trim();
    if (cleanEmail && ADMIN_EMAILS.includes(cleanEmail as (typeof ADMIN_EMAILS)[number])) {
      return false; // Administrators can never be blocked
    }

    return this.cachedBlocked.some(entry => {
      const matchId = userId && entry.id && entry.id === userId;
      const matchEmail = cleanEmail && entry.email && entry.email.toLowerCase().trim() === cleanEmail;
      return matchId || matchEmail;
    });
  }

  /**
   * Block a specific user by ID and email
   */
  public async blockUser(user: { id: string; email: string; displayName: string }): Promise<boolean> {
    const cleanEmail = user.email.toLowerCase().trim();

    // Prevent blocking administrators
    if (ADMIN_EMAILS.includes(cleanEmail as (typeof ADMIN_EMAILS)[number])) {
      logger.warn('admin', 'Attempted to block an administrator account. Action rejected.', { email: cleanEmail });
      return false;
    }

    const current = this.loadLocalBlocked();
    const exists = current.some(e => e.id === user.id || e.email.toLowerCase() === cleanEmail);
    if (exists) return true;

    const newEntry: BlockedUserEntry = {
      id: user.id,
      email: cleanEmail,
      displayName: user.displayName || 'Learner',
      blockedAt: new Date().toISOString(),
    };

    const updated = [...current, newEntry];
    this.saveLocalBlocked(updated);

    // Sync to Supabase if available
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from(BLOCKED_TABLE).upsert({
          id: newEntry.id,
          email: newEntry.email,
          display_name: newEntry.displayName,
          blocked_at: newEntry.blockedAt,
        });
      } catch (err: unknown) {
        logger.warn('admin', 'Failed to sync blocked user to Supabase', undefined, err);
      }
    }

    logger.info('admin', `User blocked successfully: ${user.displayName} (${cleanEmail})`);
    return true;
  }

  /**
   * Unblock a previously suspended user
   */
  public async unblockUser(userIdOrEmail: string): Promise<void> {
    const target = userIdOrEmail.toLowerCase().trim();
    const current = this.loadLocalBlocked();
    const updated = current.filter(e => e.id !== target && e.email.toLowerCase().trim() !== target);
    this.saveLocalBlocked(updated);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from(BLOCKED_TABLE).delete().or(`id.eq.${userIdOrEmail},email.eq.${target}`);
      } catch (err: unknown) {
        logger.warn('admin', 'Failed to remove blocked user from Supabase', undefined, err);
      }
    }

    logger.info('admin', `User unblocked: ${userIdOrEmail}`);
  }

  /**
   * Retrieve list of all blocked user entries
   */
  public getBlockedUsers(): BlockedUserEntry[] {
    return this.cachedBlocked;
  }
}

export const userBlockService = new UserBlockService();
