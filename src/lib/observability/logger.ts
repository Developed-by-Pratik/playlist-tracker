/**
 * logger.ts — Centralized SaaS Observability Logger
 *
 * Provides structured logging with levels (DEBUG, INFO, WARN, ERROR),
 * in-memory ring-buffer storage for admin audit trails, and console routing.
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface SystemLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  metadata?: Record<string, unknown>;
  errorStack?: string;
}

const MAX_LOGS = 250;
const STORAGE_LOGS_KEY = 'playlist_tracker_system_logs';

class ObservabilityLogger {
  private logs: SystemLog[] = [];
  private listeners: Set<(log: SystemLog) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(STORAGE_LOGS_KEY);
        if (stored) {
          this.logs = JSON.parse(stored);
        }
      } catch {
        this.logs = [];
      }
    }
  }

  private persist() {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(this.logs));
      } catch {
        // Silently ignore storage quota errors
      }
    }
  }

  private addLog(
    level: LogLevel,
    context: string,
    message: string,
    metadata?: Record<string, unknown>,
    error?: unknown
  ): SystemLog {
    const errorStack =
      error instanceof Error
        ? error.stack || error.message
        : typeof error === 'string'
        ? error
        : undefined;

    const logEntry: SystemLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      metadata,
      errorStack,
    };

    this.logs.unshift(logEntry);
    if (this.logs.length > MAX_LOGS) {
      this.logs.length = MAX_LOGS;
    }

    this.persist();

    // Notify live listeners (e.g. Admin log viewer)
    this.listeners.forEach(listener => {
      try {
        listener(logEntry);
      } catch {
        // Prevent listener crashes from affecting app execution
      }
    });

    // Console output with styling in development
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
      const prefix = `[${logEntry.timestamp.slice(11, 19)}] [${context}]`;
      const meta = metadata ? metadata : '';

      switch (level) {
        case 'DEBUG':
          console.debug(prefix, message, meta);
          break;
        case 'INFO':
          console.info(prefix, message, meta);
          break;
        case 'WARN':
          console.warn(prefix, message, meta, errorStack ?? '');
          break;
        case 'ERROR':
          console.error(prefix, message, meta, errorStack ?? '');
          break;
      }
    }

    return logEntry;
  }

  public debug(context: string, message: string, metadata?: Record<string, unknown>) {
    return this.addLog('DEBUG', context, message, metadata);
  }

  public info(context: string, message: string, metadata?: Record<string, unknown>) {
    return this.addLog('INFO', context, message, metadata);
  }

  public warn(context: string, message: string, metadata?: Record<string, unknown>, error?: unknown) {
    return this.addLog('WARN', context, message, metadata, error);
  }

  public error(context: string, message: string, metadata?: Record<string, unknown>, error?: unknown) {
    return this.addLog('ERROR', context, message, metadata, error);
  }

  public getLogs(limit = 100, level?: LogLevel, search?: string): SystemLog[] {
    let result = this.logs;
    if (level) {
      result = result.filter(l => l.level === level);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        l =>
          l.message.toLowerCase().includes(q) ||
          l.context.toLowerCase().includes(q) ||
          (l.errorStack && l.errorStack.toLowerCase().includes(q))
      );
    }
    return result.slice(0, limit);
  }

  public clearLogs() {
    this.logs = [];
    this.persist();
  }

  public subscribe(listener: (log: SystemLog) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const logger = new ObservabilityLogger();
