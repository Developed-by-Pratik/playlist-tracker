'use client';

import { CloudSyncStatus } from '@/lib/cloud-storage';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Cloud, CloudOff, RefreshCw, Check, AlertTriangle, Wifi } from 'lucide-react';

interface SyncStatusBadgeProps {
  status: CloudSyncStatus;
}

const configured = isSupabaseConfigured();

export function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  if (!configured) {
    return (
      <div
        title="Cloud sync not configured — add Supabase keys to .env.local"
        style={{
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          padding: '0.35rem 0.65rem',
          borderRadius: 8,
          border: '1px solid var(--border-color)',
          background: 'var(--bg-surface-2)',
          color: 'var(--text-muted)',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-mono)',
          fontWeight: 500,
          cursor: 'default',
        }}
      >
        <CloudOff style={{ width: 13, height: 13 }} />
        <span>No sync</span>
      </div>
    );
  }

  const config: Record<CloudSyncStatus, { icon: React.ReactNode; label: string; color: string; border: string; bg: string }> = {
    idle: {
      icon: <Cloud style={{ width: 13, height: 13 }} />,
      label: 'Synced',
      color: 'var(--text-muted)',
      border: 'var(--border-color)',
      bg: 'var(--bg-surface-2)',
    },
    syncing: {
      icon: <RefreshCw style={{ width: 13, height: 13, animation: 'spin 0.8s linear infinite' }} />,
      label: 'Syncing…',
      color: 'var(--accent-primary)',
      border: 'rgba(99,102,241,0.3)',
      bg: 'rgba(99,102,241,0.06)',
    },
    synced: {
      icon: <Check style={{ width: 13, height: 13 }} />,
      label: 'Synced',
      color: 'var(--accent-success)',
      border: 'rgba(52,211,153,0.3)',
      bg: 'rgba(52,211,153,0.06)',
    },
    error: {
      icon: <AlertTriangle style={{ width: 13, height: 13 }} />,
      label: 'Sync error',
      color: '#f87171',
      border: 'rgba(248,113,113,0.3)',
      bg: 'rgba(248,113,113,0.06)',
    },
    offline: {
      icon: <Wifi style={{ width: 13, height: 13 }} />,
      label: 'Offline',
      color: '#fbbf24',
      border: 'rgba(251,191,36,0.3)',
      bg: 'rgba(251,191,36,0.06)',
    },
    unconfigured: {
      icon: <CloudOff style={{ width: 13, height: 13 }} />,
      label: 'No sync',
      color: 'var(--text-muted)',
      border: 'var(--border-color)',
      bg: 'var(--bg-surface-2)',
    },
  };

  const c = config[status];
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '0.375rem',
        padding: '0.35rem 0.65rem',
        borderRadius: 8,
        border: `1px solid ${c.border}`,
        background: c.bg,
        color: c.color,
        fontSize: '0.75rem',
        fontFamily: 'var(--font-mono)',
        fontWeight: 500,
        cursor: 'default',
        transition: 'all 0.3s ease',
      }}
    >
      {c.icon}
      <span>{c.label}</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
