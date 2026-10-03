/**
 * collaboration.ts — Data contracts for Collaboration Suite, Study Resources & Observability
 */

export type ResourceCategory = 'github' | 'docs' | 'practice' | 'article' | 'general';

export interface StudyResource {
  id: string;
  title: string;
  url: string;
  category: ResourceCategory;
  notes?: string;
  createdAt: string;
  addedBy?: string;
  isShared?: boolean;
}

export type PartnershipStatus = 'pending' | 'active' | 'disconnected';

export interface DuoPartnership {
  id: string;
  duoCode: string;
  userA: string;
  userB?: string;
  status: PartnershipStatus;
  createdAt: string;
}

export interface PartnerSnapshot {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  activePlaylist?: string;
  progressPct: number;
  todayCompleted: number;
  currentStreak: number;
  todayStudySeconds: number;
  isPrivate: boolean;
  lastActiveAt: string;
}

export interface DuoMessage {
  id: string;
  partnershipId: string;
  senderId: string;
  senderName: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface SharedDailyNote {
  partnershipId: string;
  noteDate: string; // 'YYYY-MM-DD'
  content: string;
  lastEditedBy?: string;
  updatedAt: string;
}

export type LiveReactionType = 'fire' | 'rocket' | 'muscle' | 'clap' | 'coffee';

export interface LiveReactionPayload {
  id: string;
  senderId: string;
  senderName: string;
  type: LiveReactionType;
  timestamp: string;
}

export interface MilestoneCelebrationEvent {
  id: string;
  senderId: string;
  senderName: string;
  milestoneType: 'fifty_percent' | 'course_completed' | 'daily_habits_completed';
  playlistName?: string;
  timestamp: string;
}

export interface WeeklyRecapStats {
  weekStartDate: string;
  weekEndDate: string;
  totalStudySecondsCombined: number;
  videosCompletedCombined: number;
  duoStreakDays: number;
  topContributorName?: string;
  synergyLevel: string;
}

export type VoiceConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface VoiceSessionState {
  isActive: boolean;
  connectionState: VoiceConnectionState;
  isMuted: boolean;
  isDeafened: boolean;
  isSelfSpeaking: boolean;
  isPartnerSpeaking: boolean;
  partnerName: string;
  partnerAvatar?: string | null;
  durationSeconds: number;
  error?: string | null;
}

