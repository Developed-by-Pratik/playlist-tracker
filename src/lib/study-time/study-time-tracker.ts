/**
 * study-time-tracker.ts — Active Study Time Tracking with Idle Detection & Midnight Reset
 *
 * Tracks active focus time spent on the web application during the current calendar day.
 * Automatically pauses if the user is inactive for 10 minutes or if the browser tab is hidden.
 * Resets automatically at midnight local time.
 */

import { logger } from '@/lib/observability/logger';

const STUDY_TIME_STORAGE_KEY = 'playlist_tracker_study_time';
const IDLE_TIMEOUT_SECONDS = 600; // 10 minutes of inactivity pauses tracking

export interface DailyStudyTimeRecord {
  date: string; // 'YYYY-MM-DD'
  seconds: number;
}

/** Get the current date string in local YYYY-MM-DD format */
export function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Format seconds into a clean human-readable duration (e.g. "1h 45m" or "25m") */
export function formatStudyTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

/** Load current day's study time record from localStorage with auto-midnight reset */
export function loadStudyTime(): DailyStudyTimeRecord {
  const today = getLocalDateString();
  const fallback: DailyStudyTimeRecord = { date: today, seconds: 0 };

  if (typeof window === 'undefined') return fallback;

  try {
    const raw = localStorage.getItem(STUDY_TIME_STORAGE_KEY);
    if (!raw) return fallback;

    const parsed: DailyStudyTimeRecord = JSON.parse(raw);
    if (parsed.date !== today) {
      // Midnight has passed — reset cleanly for the new day
      logger.info('study-time', `Midnight rollover: resetting daily study time. Previous day: ${parsed.date} (${formatStudyTime(parsed.seconds)})`);
      saveStudyTime(fallback);
      return fallback;
    }

    return parsed;
  } catch (error) {
    logger.warn('study-time', 'Failed to parse study time record, resetting to zero', undefined, error);
    return fallback;
  }
}

/** Save study time record to localStorage */
export function saveStudyTime(record: DailyStudyTimeRecord): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STUDY_TIME_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Controller class to manage the active study time ticker, idle detection, and tab visibility.
 */
class StudyTimeTracker {
  private activeSeconds = 0;
  private secondsSinceLastActivity = 0;
  private isTabVisible = true;
  private isIdle = false;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(seconds: number) => void> = new Set();
  private isInitialized = false;

  public init(): () => void {
    if (typeof window === 'undefined' || this.isInitialized) {
      return () => {};
    }

    this.isInitialized = true;
    const initialRecord = loadStudyTime();
    this.activeSeconds = initialRecord.seconds;
    this.isTabVisible = document.visibilityState === 'visible';

    // Activity event listeners to reset idle timer
    const onUserActivity = () => {
      this.secondsSinceLastActivity = 0;
      if (this.isIdle) {
        this.isIdle = false;
        logger.debug('study-time', 'User resumed activity — study timer running');
      }
    };

    const onVisibilityChange = () => {
      this.isTabVisible = document.visibilityState === 'visible';
      if (this.isTabVisible) {
        this.secondsSinceLastActivity = 0;
        this.isIdle = false;
        logger.debug('study-time', 'Tab became visible — study timer running');
      } else {
        logger.debug('study-time', 'Tab hidden — study timer paused');
      }
    };

    window.addEventListener('mousemove', onUserActivity, { passive: true });
    window.addEventListener('keydown', onUserActivity, { passive: true });
    window.addEventListener('scroll', onUserActivity, { passive: true });
    window.addEventListener('click', onUserActivity, { passive: true });
    window.addEventListener('touchstart', onUserActivity, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    // 1-second interval ticker
    this.timerId = setInterval(() => {
      this.tick();
    }, 1000);

    logger.info('study-time', 'Study time tracker initialized', {
      initialSeconds: this.activeSeconds,
      formatted: formatStudyTime(this.activeSeconds),
    });

    return () => {
      this.cleanup(onUserActivity, onVisibilityChange);
    };
  }

  private tick(): void {
    const today = getLocalDateString();
    const storedRecord = loadStudyTime();

    // Check midnight rollover
    if (storedRecord.date !== today) {
      this.activeSeconds = 0;
      saveStudyTime({ date: today, seconds: 0 });
      this.notifyListeners();
      return;
    }

    // Check idle state
    this.secondsSinceLastActivity += 1;
    if (this.secondsSinceLastActivity >= IDLE_TIMEOUT_SECONDS) {
      if (!this.isIdle) {
        this.isIdle = true;
        logger.debug('study-time', 'User reached 10m inactivity threshold — study timer paused');
      }
    }

    // Only increment when tab is active and user is not idle
    if (this.isTabVisible && !this.isIdle) {
      this.activeSeconds += 1;

      // Persist to storage every 10 seconds or on notify
      if (this.activeSeconds % 10 === 0) {
        saveStudyTime({ date: today, seconds: this.activeSeconds });
      }

      this.notifyListeners();
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(fn => {
      try {
        fn(this.activeSeconds);
      } catch {
        // Prevent listener crashes
      }
    });
  }

  public subscribe(callback: (seconds: number) => void): () => void {
    this.listeners.add(callback);
    callback(this.activeSeconds);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public getActiveSeconds(): number {
    return this.activeSeconds;
  }

  private cleanup(activityHandler: () => void, visibilityHandler: () => void): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    window.removeEventListener('mousemove', activityHandler);
    window.removeEventListener('keydown', activityHandler);
    window.removeEventListener('scroll', activityHandler);
    window.removeEventListener('click', activityHandler);
    window.removeEventListener('touchstart', activityHandler);
    document.removeEventListener('visibilitychange', visibilityHandler);

    // Save final state
    saveStudyTime({ date: getLocalDateString(), seconds: this.activeSeconds });
    this.isInitialized = false;
  }
}

export const studyTimeTracker = new StudyTimeTracker();
