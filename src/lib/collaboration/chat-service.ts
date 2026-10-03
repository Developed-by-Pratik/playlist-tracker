/**
 * chat-service.ts — 1-on-1 Duo Chat Service
 *
 * Provides real-time messaging between paired study buddies, offline message persistence,
 * unread badges, and an interactive motivational bot for Demo Partner mode.
 */

import { DuoMessage, DuoPartnership } from '@/lib/types/collaboration';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getSyncId } from '@/lib/cloud-storage';
import { getMyDuoCode } from '@/lib/collaboration/collaboration-service';
import { logger } from '@/lib/observability/logger';
import { RealtimeChannel } from '@supabase/supabase-js';

const CHAT_TABLE = 'duo_messages';

const DEMO_RESPONSES = [
  'Awesome progress! Keep crushing those modules! 🚀',
  'I just finished lesson 3 on Next.js App Router, super insightful!',
  "Let's lock in for another 25-minute Pomodoro focus block! 🔥",
  "Great seeing your streak stay alive! We've got this! 💪",
  "Checking that out now. Let's aim to complete this playlist this week! 🎯",
  'Taking a quick 5m water break, then right back to studying! ☕',
];

class DuoChatService {
  private currentPartnership: DuoPartnership | null = null;
  private messages: DuoMessage[] = [];
  private messageListeners: Set<(messages: DuoMessage[]) => void> = new Set();
  private unreadListeners: Set<(unreadCount: number) => void> = new Set();
  private channel: RealtimeChannel | null = null;
  private demoReplyTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Initialize chat for a given partnership */
  public setPartnership(partnership: DuoPartnership | null): void {
    if (this.currentPartnership?.id === partnership?.id) return;

    if (this.channel && supabase) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    if (this.demoReplyTimeout) {
      clearTimeout(this.demoReplyTimeout);
      this.demoReplyTimeout = null;
    }

    this.currentPartnership = partnership;

    if (!partnership) {
      this.messages = [];
      this.notifyListeners();
      return;
    }

    // Load local messages
    this.messages = this.loadLocalMessages(partnership.id);
    this.notifyListeners();

    // If Demo partner and messages are empty, seed a welcoming hello
    if (this.isDemoPartner(partnership) && this.messages.length === 0) {
      const welcomeMsg: DuoMessage = {
        id: 'msg-demo-welcome',
        partnershipId: partnership.id,
        senderId: 'demo-partner-alex',
        senderName: 'Alex (Study Buddy)',
        message: 'Hey! Glad we paired up. Let me know what you are studying today! 🤝',
        read: false,
        createdAt: new Date().toISOString(),
      };
      this.messages = [welcomeMsg];
      this.saveLocalMessages(partnership.id, this.messages);
      this.notifyListeners();
    }

    // Connect to Supabase realtime channel if configured
    this.setupRealtime(partnership.id);
  }

  private isDemoPartner(partnership: DuoPartnership): boolean {
    return partnership.duoCode === 'DUO-DEMO' || partnership.userB === 'demo-partner-alex';
  }

  private getStorageKey(partnershipId: string): string {
    return `playlist_tracker_duo_chat_${partnershipId}`;
  }

  private loadLocalMessages(partnershipId: string): DuoMessage[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.getStorageKey(partnershipId));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalMessages(partnershipId: string, msgs: DuoMessage[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.getStorageKey(partnershipId), JSON.stringify(msgs));
    } catch {
      // Storage quota or serialization guard
    }
  }

  private async setupRealtime(partnershipId: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return;

    // Fetch latest messages from Supabase
    try {
      const { data, error } = await supabase
        .from(CHAT_TABLE)
        .select('*')
        .eq('partnership_id', partnershipId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (!error && data && data.length > 0) {
        const cloudMsgs: DuoMessage[] = data.map(row => ({
          id: String(row.id),
          partnershipId: String(row.partnership_id),
          senderId: String(row.sender_id),
          senderName: String(row.sender_name || 'Study Partner'),
          message: String(row.message || ''),
          read: Boolean(row.is_read),
          createdAt: String(row.created_at),
        }));

        this.messages = cloudMsgs;
        this.saveLocalMessages(partnershipId, this.messages);
        this.notifyListeners();
      }
    } catch (err) {
      logger.debug('collaboration', 'Messages table query skipped or pending migration', { error: String(err) });
    }

    // Subscribe to new incoming messages
    const channelName = `duo_chat_${partnershipId}_${Math.random().toString(36).slice(2, 6)}`;
    this.channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: CHAT_TABLE,
          filter: `partnership_id=eq.${partnershipId}`,
        },
        payload => {
          if (payload.new) {
            const row = payload.new as Record<string, unknown>;
            const newMsg: DuoMessage = {
              id: String(row.id),
              partnershipId: String(row.partnership_id),
              senderId: String(row.sender_id),
              senderName: String(row.sender_name || 'Partner'),
              message: String(row.message || ''),
              read: Boolean(row.is_read),
              createdAt: String(row.created_at),
            };

            // Avoid duplicate message appending
            if (!this.messages.some(m => m.id === newMsg.id)) {
              this.messages = [...this.messages, newMsg];
              this.saveLocalMessages(partnershipId, this.messages);
              this.notifyListeners();
            }
          }
        }
      )
      .subscribe();
  }

  /** Send a new message to the study partner */
  public async sendMessage(text: string, senderName: string): Promise<DuoMessage | null> {
    if (!this.currentPartnership || !text.trim()) return null;

    const partnershipId = this.currentPartnership.id;
    const myUid = (await getSyncId()) || getMyDuoCode();
    const cleanText = text.trim();

    const newMsg: DuoMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      partnershipId,
      senderId: myUid,
      senderName,
      message: cleanText,
      read: true, // Read by sender
      createdAt: new Date().toISOString(),
    };

    // Optimistic local state update
    this.messages = [...this.messages, newMsg];
    this.saveLocalMessages(partnershipId, this.messages);
    this.notifyListeners();

    logger.info('collaboration', 'Sent duo chat message', { textLength: cleanText.length });

    // Push to Supabase if configured
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from(CHAT_TABLE).insert({
          id: newMsg.id,
          partnership_id: partnershipId,
          sender_id: myUid,
          sender_name: senderName,
          message: cleanText,
          is_read: false,
          created_at: newMsg.createdAt,
        });
      } catch (err) {
        logger.warn('collaboration', 'Failed to push message to cloud (local fallback active)', undefined, err);
      }
    }

    // Trigger Demo Partner response if in demo mode
    if (this.isDemoPartner(this.currentPartnership)) {
      this.triggerDemoReply(partnershipId);
    }

    return newMsg;
  }

  private triggerDemoReply(partnershipId: string): void {
    if (this.demoReplyTimeout) clearTimeout(this.demoReplyTimeout);

    this.demoReplyTimeout = setTimeout(() => {
      const randomResponse = DEMO_RESPONSES[Math.floor(Math.random() * DEMO_RESPONSES.length)];
      const replyMsg: DuoMessage = {
        id: `msg-demo-${Date.now()}`,
        partnershipId,
        senderId: 'demo-partner-alex',
        senderName: 'Alex (Study Buddy)',
        message: randomResponse,
        read: false,
        createdAt: new Date().toISOString(),
      };

      this.messages = [...this.messages, replyMsg];
      this.saveLocalMessages(partnershipId, this.messages);
      this.notifyListeners();

      logger.info('collaboration', 'Received demo partner reply from Alex');
    }, 1200);
  }

  /** Mark all unread messages as read */
  public async markAllAsRead(): Promise<void> {
    if (!this.currentPartnership) return;

    let hasUnread = false;
    this.messages = this.messages.map(m => {
      if (!m.read) {
        hasUnread = true;
        return { ...m, read: true };
      }
      return m;
    });

    if (hasUnread) {
      this.saveLocalMessages(this.currentPartnership.id, this.messages);
      this.notifyListeners();

      if (isSupabaseConfigured() && supabase) {
        const myUid = (await getSyncId()) || getMyDuoCode();
        try {
          await supabase
            .from(CHAT_TABLE)
            .update({ is_read: true })
            .eq('partnership_id', this.currentPartnership.id)
            .neq('sender_id', myUid);
        } catch {
          // Silent ignore
        }
      }
    }
  }

  public getMessages(): DuoMessage[] {
    return this.messages;
  }

  public getUnreadCount(myUid?: string): number {
    const idToCompare = myUid || getMyDuoCode();
    return this.messages.filter(m => m.senderId !== idToCompare && !m.read).length;
  }

  public subscribeToMessages(callback: (messages: DuoMessage[]) => void): () => void {
    this.messageListeners.add(callback);
    callback(this.messages);
    return () => {
      this.messageListeners.delete(callback);
    };
  }

  public subscribeToUnreadCount(callback: (count: number) => void): () => void {
    this.unreadListeners.add(callback);
    callback(this.getUnreadCount());
    return () => {
      this.unreadListeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    this.messageListeners.forEach(fn => {
      try {
        fn(this.messages);
      } catch {
        // Guard listener
      }
    });

    const unread = this.getUnreadCount();
    this.unreadListeners.forEach(fn => {
      try {
        fn(unread);
      } catch {
        // Guard listener
      }
    });
  }
}

export const duoChatService = new DuoChatService();
