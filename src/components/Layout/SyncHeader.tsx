'use client';

import { motion } from 'framer-motion';
import { ListTodo, Zap, Eye, EyeOff, LogOut } from 'lucide-react';
import { SyncStatusBadge } from '@/components/CloudSyncButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CloudSyncStatus } from '@/lib/cloud-storage';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

interface SyncHeaderProps {
  loading: boolean;
  progress: number;
  syncStatus: CloudSyncStatus;
  hideCompleted: boolean;
  onToggleHideCompleted: () => void;
  activePlaylistName?: string;
}

export function SyncHeader({
  loading, progress, syncStatus, hideCompleted, onToggleHideCompleted, activePlaylistName,
}: SyncHeaderProps) {
  const [user, setUser] = useState<{ name: string; avatar: string | null } | null>(null);

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          name: data.user.user_metadata?.full_name || data.user.email || 'User',
          avatar: data.user.user_metadata?.avatar_url || null,
        });
      }
    });
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as any }}
      style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
        gap: '1rem', marginBottom: '2.5rem', paddingBottom: '1.75rem',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <div className="flex items-center gap-3">
        <div style={{
          width: 44, height: 44, background: 'var(--gradient-accent)',
          borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)',
        }}>
          <ListTodo style={{ width: 22, height: 22, color: '#ffffff' }} />
        </div>
        <div>
          <h1 style={{
            fontSize: '1.5rem', fontWeight: 800, marginBottom: 2,
            background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent-primary) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', opacity: 0.9,
          }}>Playlist Tracker</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
            {activePlaylistName || 'Select a playlist to track'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {!loading && (
          <>
            <button
              onClick={onToggleHideCompleted}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34,
                background: hideCompleted ? 'var(--accent-primary)' : 'var(--bg-surface-2)',
                color: hideCompleted ? 'white' : 'var(--text-secondary)',
                borderRadius: '50%',
                border: '1px solid var(--border-color)',
                cursor: 'pointer', transition: 'all 0.2s ease',
              }}
              title={hideCompleted ? 'Show Completed' : 'Hide Completed'}
            >
              {hideCompleted ? <Eye style={{ width: 15, height: 15 }} /> : <EyeOff style={{ width: 15, height: 15 }} />}
            </button>

            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: progress === 100 ? 'var(--accent-success-light)' : 'var(--accent-light)',
              color: progress === 100 ? 'var(--accent-success)' : 'var(--accent-hover)',
              padding: '0.375rem 0.875rem', borderRadius: 99,
              fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-mono)',
              border: `1px solid ${progress === 100 ? 'rgba(52, 211, 153, 0.2)' : 'rgba(99, 102, 241, 0.2)'}`,
              boxShadow: progress === 100 ? '0 0 12px rgba(52, 211, 153, 0.15)' : '0 0 12px rgba(99, 102, 241, 0.15)',
            }}>
              <Zap style={{ width: 13, height: 13 }} />
              {progress}%
            </div>
          </>
        )}
        <SyncStatusBadge status={syncStatus} />
        <ThemeToggle />

        {/* User avatar + sign out */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--border-color-strong)' }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gradient-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>
                {user.name[0].toUpperCase()}
              </div>
            )}
            <button
              onClick={() => signOut()}
              title="Sign out"
              style={{
                background: 'none', border: '1px solid var(--border-color)', borderRadius: 8,
                padding: '0.3rem 0.5rem', cursor: 'pointer', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                fontSize: '0.6875rem', fontWeight: 500, transition: 'all 0.2s',
              }}
              className="signout-btn"
            >
              <LogOut style={{ width: 12, height: 12 }} />
              Out
            </button>
          </div>
        )}
      </div>
      <style>{`.signout-btn:hover { color: #f87171 !important; border-color: #f87171 !important; }`}</style>
    </motion.header>
  );
}
