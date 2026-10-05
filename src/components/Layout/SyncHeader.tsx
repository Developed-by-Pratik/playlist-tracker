'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ListTodo,
  Eye,
  EyeOff,
  LogOut,
  ShieldCheck,
  Clock,
  User,
  Users,
  UserPlus,
  Moon,
  Sun,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { SyncStatusBadge } from '@/components/CloudSyncButton';
import { useTheme } from '@/components/ThemeProvider';
import { CloudSyncStatus } from '@/lib/cloud-storage';
import { signOut, isUserAdmin } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useEffect, useState, useRef } from 'react';
import { formatStudyTime } from '@/lib/study-time/study-time-tracker';
import { DuoPartnership, PartnerSnapshot } from '@/lib/types/collaboration';
import { logger } from '@/lib/observability/logger';

interface SyncHeaderProps {
  loading: boolean;
  progress?: number;
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
  onToggleTheme?: () => void;
}

export function SyncHeader({
  loading,
  syncStatus,
  hideCompleted,
  onToggleHideCompleted,
  activePlaylistName,
  studyTimeSeconds = 0,
  collaborationEnabled = false,
  onOpenModeModal,
  partnership = null,
  partnerSnapshot = null,
  onOpenDuoHub,
  onToggleTheme,
}: SyncHeaderProps) {
  const [user, setUser] = useState<{ name: string; avatar: string | null; email: string | null } | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const handleThemeToggle = () => {
    if (onToggleTheme) {
      onToggleTheme();
    } else {
      toggleTheme();
    }
  };

  useEffect(() => {
    supabase?.auth.getUser().then(({ data, error }) => {
      if (error) {
        logger.warn('auth', 'Could not retrieve active user for header', undefined, error);
        return;
      }
      if (data.user) {
        setUser({
          name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Learner',
          avatar: data.user.user_metadata?.avatar_url || null,
          email: data.user.email || null,
        });
      }
    });
  }, []);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false);
      }
    };

    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  const isAdmin = isUserAdmin(user?.email);
  const isPaired = partnership?.status === 'active';

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '2.5rem',
        paddingBottom: '1.75rem',
        borderBottom: '1px solid var(--border-color)',
        position: 'relative',
        zIndex: 40,
      }}
    >
      {/* Brand & Active Playlist Title */}
      <div className="flex items-center gap-3">
        <div
          style={{
            width: 44,
            height: 44,
            background: 'var(--gradient-accent)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)',
          }}
        >
          <ListTodo style={{ width: 22, height: 22, color: '#ffffff' }} />
        </div>
        <div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              marginBottom: 2,
              background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent-primary) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              opacity: 0.9,
            }}
          >
            Playlist Tracker
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
            {activePlaylistName || 'Select a playlist to track'}
          </p>
        </div>
      </div>

      {/* Header Primary Action & Telemetry Row */}
      <div className="flex items-center" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        {!loading && (
          <>
            {/* 1. Daily Active Study Focus Time Pill */}
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
          </>
        )}

        {/* 2. Cloud Sync Status Badge */}
        <SyncStatusBadge status={syncStatus} />

        {/* 3. User Profile Button & Dropdown Trigger */}
        <div ref={menuRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <button
            onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            aria-expanded={isProfileMenuOpen}
            aria-label="User Profile & Settings Menu"
            title="Profile & Quick Settings"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              height: 38,
              padding: '2px 8px 2px 3px',
              background: isProfileMenuOpen ? 'var(--bg-surface-3, var(--bg-surface-2))' : 'var(--bg-surface-2)',
              border: `1px solid ${isProfileMenuOpen ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              borderRadius: 999,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxSizing: 'border-box',
              flexShrink: 0,
            }}
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1.5px solid var(--border-color-strong)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'var(--gradient-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  color: '#ffffff',
                }}
              >
                {user?.name ? user.name[0].toUpperCase() : <User style={{ width: 15, height: 15 }} />}
              </div>
            )}
            <motion.div
              animate={{ rotate: isProfileMenuOpen ? 180 : 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronDown style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
            </motion.div>
          </button>

          {/* Profile Dropdown Popover */}
          <AnimatePresence>
            {isProfileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: 280,
                  background: 'var(--bg-surface)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid var(--border-color-strong)',
                  borderRadius: 16,
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                  padding: '0.75rem',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {/* User Identity Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem 0.5rem 0.625rem 0.5rem',
                    borderBottom: '1px solid var(--border-color)',
                  }}
                >
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid var(--accent-primary)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: 'var(--gradient-accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: '#ffffff',
                      }}
                    >
                      {user?.name ? user.name[0].toUpperCase() : 'U'}
                    </div>
                  )}
                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <div className="flex items-center gap-1.5">
                      <span
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'block',
                        }}
                      >
                        {user?.name || 'Study Learner'}
                      </span>
                      {isAdmin && (
                        <span
                          style={{
                            fontSize: '0.625rem',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: 'rgba(234, 179, 8, 0.15)',
                            color: '#eab308',
                            border: '1px solid rgba(234, 179, 8, 0.3)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          Admin
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'block',
                      }}
                    >
                      {user?.email || 'Active Session'}
                    </span>
                  </div>
                </div>

                {/* Dropdown Options List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {/* 1. Theme Mode Toggle Row */}
                  <div
                    onClick={handleThemeToggle}
                    role="button"
                    tabIndex={0}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.625rem',
                      borderRadius: 10,
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                      userSelect: 'none',
                    }}
                    className="profile-menu-item"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: isDark ? 'var(--accent-hover)' : '#f59e0b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isDark ? <Moon style={{ width: 15, height: 15 }} /> : <Sun style={{ width: 15, height: 15 }} />}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Dark Mode
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          {isDark ? 'Dark theme active' : 'Light theme active'}
                        </div>
                      </div>
                    </div>

                    {/* Smooth Pill Switch */}
                    <div
                      style={{
                        width: 38,
                        height: 22,
                        borderRadius: 999,
                        background: isDark ? 'var(--accent-primary)' : 'var(--border-color-strong)',
                        position: 'relative',
                        transition: 'background-color 0.2s ease',
                        padding: 2,
                        boxSizing: 'border-box',
                      }}
                    >
                      <motion.div
                        animate={{ x: isDark ? 16 : 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: '#ffffff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }}
                      />
                    </div>
                  </div>

                  {/* 2. Hide Completed Tasks / Videos Toggle Row */}
                  <div
                    onClick={onToggleHideCompleted}
                    role="button"
                    tabIndex={0}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.625rem',
                      borderRadius: 10,
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                      userSelect: 'none',
                    }}
                    className="profile-menu-item"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: hideCompleted ? 'rgba(99, 102, 241, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                          color: hideCompleted ? 'var(--accent-hover)' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {hideCompleted ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Hide Completed
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          {hideCompleted ? 'Done videos hidden' : 'Showing all videos'}
                        </div>
                      </div>
                    </div>

                    {/* Smooth Pill Switch */}
                    <div
                      style={{
                        width: 38,
                        height: 22,
                        borderRadius: 999,
                        background: hideCompleted ? 'var(--accent-primary)' : 'var(--border-color-strong)',
                        position: 'relative',
                        transition: 'background-color 0.2s ease',
                        padding: 2,
                        boxSizing: 'border-box',
                      }}
                    >
                      <motion.div
                        animate={{ x: hideCompleted ? 16 : 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: '#ffffff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }}
                      />
                    </div>
                  </div>

                  {/* 3. Pair Buddy / Duo Hub Row */}
                  <div
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      if (onOpenDuoHub) {
                        onOpenDuoHub();
                      } else if (onOpenModeModal) {
                        onOpenModeModal();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.625rem',
                      borderRadius: 10,
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                      userSelect: 'none',
                    }}
                    className="profile-menu-item"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: isPaired ? 'rgba(52, 211, 153, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                          color: isPaired ? '#34d399' : 'var(--accent-hover)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <UserPlus style={{ width: 15, height: 15 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Pair Buddy
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          {isPaired && partnerSnapshot
                            ? `${partnerSnapshot.displayName || 'Buddy'} • ${
                                Date.now() - new Date(partnerSnapshot.lastActiveAt).getTime() < 180000
                                  ? 'Online'
                                  : 'Offline'
                              }`
                            : 'Connect & study together'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          color: isPaired ? '#34d399' : 'var(--accent-hover)',
                        }}
                      >
                        {isPaired ? 'Active' : 'Pair'}
                      </span>
                      <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
                    </div>
                  </div>

                  {/* 4. Study Mode Selector Row */}
                  <div
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      onOpenModeModal?.();
                    }}
                    role="button"
                    tabIndex={0}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.625rem',
                      borderRadius: 10,
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                      userSelect: 'none',
                    }}
                    className="profile-menu-item"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: collaborationEnabled
                            ? 'rgba(99, 102, 241, 0.15)'
                            : 'rgba(100, 116, 139, 0.15)',
                          color: collaborationEnabled ? 'var(--accent-hover)' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {collaborationEnabled ? (
                          <Users style={{ width: 15, height: 15 }} />
                        ) : (
                          <User style={{ width: 15, height: 15 }} />
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Study Mode
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          {collaborationEnabled ? 'Duo Buddy Workspace' : 'Solo Self-Paced'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          color: collaborationEnabled ? 'var(--accent-hover)' : 'var(--text-muted)',
                        }}
                      >
                        {collaborationEnabled ? 'Duo' : 'Solo'}
                      </span>
                      <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
                    </div>
                  </div>

                  {/* 5. Admin Governance Portal Link (If Admin) */}
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setIsProfileMenuOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0.625rem',
                        borderRadius: 10,
                        textDecoration: 'none',
                        transition: 'background 0.15s ease',
                      }}
                      className="profile-menu-item"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: 'rgba(52, 211, 153, 0.15)',
                            color: '#34d399',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <ShieldCheck style={{ width: 15, height: 15 }} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Admin Portal
                          </div>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                            Learner directory & telemetry
                          </div>
                        </div>
                      </div>
                      <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
                    </Link>
                  )}

                  {/* Divider */}
                  <div
                    style={{
                      height: 1,
                      background: 'var(--border-color)',
                      margin: '0.25rem 0',
                    }}
                  />

                  {/* 6. Sign Out Option */}
                  <div
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      signOut();
                    }}
                    role="button"
                    tabIndex={0}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      padding: '0.5rem 0.625rem',
                      borderRadius: 10,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      userSelect: 'none',
                    }}
                    className="profile-menu-signout"
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'rgba(239, 68, 68, 0.12)',
                        color: '#f87171',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <LogOut style={{ width: 14, height: 14 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#f87171' }}>Sign Out</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>End cloud sync session</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <style>{`
        .profile-menu-item:hover {
          background: var(--bg-surface-2) !important;
        }
        .profile-menu-signout:hover {
          background: rgba(239, 68, 68, 0.12) !important;
        }
        .profile-menu-signout:hover div span {
          color: #ef4444 !important;
        }
      `}</style>
    </motion.header>
  );
}
