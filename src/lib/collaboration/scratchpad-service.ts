/**
 * scratchpad-service.ts — Real-time Daily Duo Scratchpad Service
 *
 * Provides a shared daily notepad for paired buddies with automatic midnight reset,
 * optimistic updates, and Supabase realtime synchronization.
 */

import { SharedDailyNote, DuoPartnership } from '@/lib/types/collaboration';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { logger } from '@/lib/observability/logger';
import { RealtimeChannel } from '@supabase/supabase-js';

const SCRATCHPAD_TABLE = 'duo_scratchpads';

export function getTodayDateKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

class DuoScratchpadService {
  private currentPartnership: DuoPartnership | null = null;
  private currentNote: SharedDailyNote = {
    partnershipId: '',
    noteDate: getTodayDateKey(),
    content: '',
    updatedAt: new Date().toISOString(),
  };
  private listeners: Set<(note: SharedDailyNote) => void> = new Set();
  private channel: RealtimeChannel | null = null;
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  public setPartnership(partnership: DuoPartnership | null): void {
    if (this.currentPartnership?.id === partnership?.id) return;

    if (this.channel && supabase) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.currentPartnership = partnership;
    const today = getTodayDateKey();

    if (!partnership) {
      this.currentNote = {
        partnershipId: '',
        noteDate: today,
        content: '',
        updatedAt: new Date().toISOString(),
      };
      this.notifyListeners();
      return;
    }

    // Load local note
    this.currentNote = this.loadLocalNote(partnership.id, today);
    this.notifyListeners();

    // Setup Supabase Realtime
    this.setupRealtime(partnership.id, today);
  }

  private getStorageKey(partnershipId: string, dateKey: string): string {
    return `playlist_tracker_scratchpad_${partnershipId}_${dateKey}`;
  }

  private loadLocalNote(partnershipId: string, dateKey: string): SharedDailyNote {
    if (typeof window === 'undefined') {
      return { partnershipId, noteDate: dateKey, content: '', updatedAt: new Date().toISOString() };
    }
    try {
      const raw = localStorage.getItem(this.getStorageKey(partnershipId, dateKey));
      if (raw) return JSON.parse(raw);
    } catch {
      // Fallback
    }

    return {
      partnershipId,
      noteDate: dateKey,
      content: '',
      updatedAt: new Date().toISOString(),
    };
  }

  private saveLocalNote(note: SharedDailyNote): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.getStorageKey(note.partnershipId, note.noteDate), JSON.stringify(note));
    } catch {
      // Storage quota or serialization guard
    }
  }

  private async setupRealtime(partnershipId: string, dateKey: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return;

    try {
      const { data, error } = await supabase
        .from(SCRATCHPAD_TABLE)
        .select('*')
        .eq('partnership_id', partnershipId)
        .eq('note_date', dateKey)
        .single();

      if (!error && data) {
        const cloudNote: SharedDailyNote = {
          partnershipId: String(data.partnership_id),
          noteDate: String(data.note_date),
          content: String(data.content || ''),
          lastEditedBy: data.last_edited_by ? String(data.last_edited_by) : undefined,
          updatedAt: String(data.updated_at),
        };

        // If cloud note is newer than local, adopt it
        if (new Date(cloudNote.updatedAt).getTime() > new Date(this.currentNote.updatedAt).getTime()) {
          this.currentNote = cloudNote;
          this.saveLocalNote(cloudNote);
          this.notifyListeners();
        }
      }
    } catch (err) {
      logger.debug('collaboration', 'Scratchpad table query skipped or pending migration', { error: String(err) });
    }

    // Subscribe to changes on scratchpad
    const channelName = `duo_scratchpad_${partnershipId}_${Math.random().toString(36).slice(2, 6)}`;
    this.channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: SCRATCHPAD_TABLE,
          filter: `partnership_id=eq.${partnershipId}`,
        },
        payload => {
          if (payload.new) {
            const row = payload.new as Record<string, unknown>;
            if (row.note_date === dateKey) {
              const incoming: SharedDailyNote = {
                partnershipId: String(row.partnership_id),
                noteDate: String(row.note_date),
                content: String(row.content || ''),
                lastEditedBy: row.last_edited_by ? String(row.last_edited_by) : undefined,
                updatedAt: String(row.updated_at),
              };

              this.currentNote = incoming;
              this.saveLocalNote(incoming);
              this.notifyListeners();
            }
          }
        }
      )
      .subscribe();
  }

  /** Update scratchpad content with debounce */
  public updateNoteContent(content: string, editorName: string): void {
    if (!this.currentPartnership) return;

    const today = getTodayDateKey();
    const updatedNote: SharedDailyNote = {
      partnershipId: this.currentPartnership.id,
      noteDate: today,
      content,
      lastEditedBy: editorName,
      updatedAt: new Date().toISOString(),
    };

    this.currentNote = updatedNote;
    this.saveLocalNote(updatedNote);
    this.notifyListeners();

    // Debounce cloud upsert by 800ms
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(async () => {
      if (isSupabaseConfigured() && supabase) {
        try {
          await supabase.from(SCRATCHPAD_TABLE).upsert(
            {
              partnership_id: updatedNote.partnershipId,
              note_date: updatedNote.noteDate,
              content: updatedNote.content,
              last_edited_by: updatedNote.lastEditedBy,
              updated_at: updatedNote.updatedAt,
            },
            { onConflict: 'partnership_id,note_date' }
          );
          logger.debug('collaboration', 'Pushed scratchpad update to cloud');
        } catch (err) {
          logger.warn('collaboration', 'Failed to push scratchpad to cloud', undefined, err);
        }
      }
    }, 800);
  }

  public getNote(): SharedDailyNote {
    return this.currentNote;
  }

  public subscribe(callback: (note: SharedDailyNote) => void): () => void {
    this.listeners.add(callback);
    callback(this.currentNote);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(fn => {
      try {
        fn(this.currentNote);
      } catch {
        // Guard listener
      }
    });
  }
}

export const duoScratchpadService = new DuoScratchpadService();
