'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ListTodo, Zap, Eye, EyeOff, LogOut, ShieldCheck } from 'lucide-react';
import { SyncStatusBadge } from '@/components/CloudSyncButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CloudSyncStatus } from '@/lib/cloud-storage';
import { signOut, isUserAdmin } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Clock, User, Users } from 'lucide-react';
import { formatStudyTime } from '@/lib/study-time/study-time-tracker';
import { DuoPartnership, PartnerSnapshot } from '@/lib/types/collaboration';
import { DuoSynergyBadge } from '@/components/Collaboration/DuoSynergyBadge';

interface SyncHeaderProps {
  loading: boolean;
  progress: number;
  syncStatus: CloudSyncStatus;
  hideCompleted: boolean;
  onToggleHideCompleted: () => void;
  activePlaylistName?: string;
  studyTimeSeconds?: number;
  collaborationEnabled?: boolean;
  onOpenModeModal?: () => void;
  partnership?: DuoPartnership | null;
  partnerSnapshot?: PartnerSnapshot | null;
  onOpenDuoHub?: () => void;
}

export function SyncHeader({
  loading, progress, syncStatus, hideCompleted, onToggleHideCompleted, activePlaylistName,
  studyTimeSeconds = 0, collaborationEnabled = false, onOpenModeModal,
  partnership = null, partnerSnapshot = null, onOpenDuoHub,
}: SyncHeaderProps) {
  const [user, setUser] = useState<{ name: string; avatar: string | null; email: string | null } | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          name: data.user.user_metadata?.full_name || data.user.email || 'User',
          avatar: data.user.user_metadata?.avatar_url || null,
          email: data.user.email || null,
        });
      }
    });
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
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

      <div className="flex items-center" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        {!loading && (
          <>
            <button
              onClick={onToggleHideCompleted}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: isHovered ? 'flex-start' : 'center',
                height: 36,
                width: isHovered ? 154 : 36,
                paddingLeft: isHovered ? 11 : 0,
                paddingRight: isHovered ? 10 : 0,
                background: hideCompleted ? 'var(--accent-primary)' : 'var(--bg-surface-2)',
                color: hideCompleted ? 'white' : 'var(--text-secondary)',
                borderRadius: 999,
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1), padding 0.25s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s',
                boxSizing: 'border-box',
                flexShrink: 0,
              }}
              title={hideCompleted ? 'Show Completed' : 'Hide Completed'}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, flexShrink: 0 }}>
                {hideCompleted ? <Eye style={{ width: 15, height: 15 }} /> : <EyeOff style={{ width: 15, height: 15 }} />}
              </div>
              <span
                style={{
                  opacity: isHovered ? 1 : 0,
                  transform: isHovered ? 'translateX(0)' : 'translateX(-6px)',
                  transition: 'opacity 0.15s ease-out, transform 0.15s ease-out',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginLeft: 8,
                  pointerEvents: 'none',
                }}
              >
                {hideCompleted ? 'Show Completed' : 'Hide Completed'}
              </span>
            </button>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              height: 36,
              background: progress === 100 ? 'var(--accent-success-light)' : 'var(--accent-light)',
              color: progress === 100 ? 'var(--accent-success)' : 'var(--accent-hover)',
              padding: '0 0.875rem', borderRadius: 999,
              fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-mono)',
              border: `1px solid ${progress === 100 ? 'rgba(52, 211, 153, 0.2)' : 'rgba(99, 102, 241, 0.2)'}`,
              boxShadow: progress === 100 ? '0 0 12px rgba(52, 211, 153, 0.15)' : '0 0 12px rgba(99, 102, 241, 0.15)',
              boxSizing: 'border-box',
              flexShrink: 0,
            }}>
              <Zap style={{ width: 13, height: 13 }} />
              <span>{progress}%</span>
            </div>

            {/* Daily Study Time Pill */}
            <div
              title="Active focus time today (automatically pauses when idle for 10m)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                height: 36,
                background: 'var(--bg-surface-2)',
                color: 'var(--text-secondary)',
                padding: '0 0.75rem',
                borderRadius: 999,
                fontSize: '0.75rem',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)',
                boxSizing: 'border-box',
                flexShrink: 0,
              }}
            >
              <Clock style={{ width: 13, height: 13, color: 'var(--accent-primary)' }} />
              <span>{formatStudyTime(studyTimeSeconds)}</span>
            </div>

            {/* Workspace Mode Pill */}
            <button
              onClick={onOpenModeModal}
              title={collaborationEnabled ? 'Duo Collaboration Mode active (Click to change)' : 'Solo Mode active (Click to change)'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                height: 36,
                background: collaborationEnabled ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-surface-2)',
                color: collaborationEnabled ? 'var(--accent-primary)' : 'var(--text-secondary)',
                padding: '0 0.75rem',
                borderRadius: 999,
                fontSize: '0.75rem',
                fontWeight: 600,
                border: '1px solid ' + (collaborationEnabled ? 'var(--accent-primary)' : 'var(--border-color)'),
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box',
                flexShrink: 0,
              }}
            >
              {collaborationEnabled ? (
                <>
                  <Users style={{ width: 13, height: 13 }} />
                  <span>Duo Mode</span>
                </>
              ) : (
                <>
                  <User style={{ width: 13, height: 13 }} />
                  <span>Solo Mode</span>
                </>
              )}
            </button>

            {/* Partner Status Badge (Only in Duo Mode) */}
            {collaborationEnabled && (
              <DuoSynergyBadge
                partnership={partnership}
                partnerSnapshot={partnerSnapshot}
                onClick={onOpenDuoHub || (() => {})}
              />
            )}
          </>
        )}
        <SyncStatusBadge status={syncStatus} />
        {isUserAdmin(user?.email) && (
          <Link
            href="/admin"
            title="Admin Governance Portal"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-color)',
              color: 'var(--accent-hover)',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              boxSizing: 'border-box',
              flexShrink: 0,
            }}
          >
            <ShieldCheck style={{ width: 16, height: 16 }} />
          </Link>
        )}
        <ThemeToggle />

        {/* User avatar + sign out */}
        {user && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', height: 36, flexShrink: 0 }}>
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--border-color-strong)', objectFit: 'cover', boxSizing: 'border-box' }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gradient-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 700, color: '#fff', boxSizing: 'border-box' }}>
                {user.name[0].toUpperCase()}
              </div>
            )}
            <button
              onClick={() => signOut()}
              title="Sign out"
              style={{
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                height: 36,
                padding: '0 0.75rem',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 500,
                transition: 'all 0.2s',
                boxSizing: 'border-box',
              }}
              className="signout-btn"
            >
              <LogOut style={{ width: 13, height: 13 }} />
              <span>Out</span>
            </button>
          </div>
        )}
      </div>
      <style>{`.signout-btn:hover { color: #f87171 !important; border-color: #f87171 !important; }`}</style>
    </motion.header>
  );
}
