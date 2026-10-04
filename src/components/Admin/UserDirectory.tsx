'use client';

import { useState, useMemo, Fragment } from 'react';
import {
  Search,
  Flame,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  PlayCircle,
  Clock,
  Layers,
  Users,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react';
import { AdminUserRecord, adminService } from '@/lib/admin/admin-service';
import { isUserAdmin } from '@/lib/auth';

interface UserDirectoryProps {
  users: AdminUserRecord[];
  isLoading: boolean;
  onRefresh?: () => void;
  onUserDeleted?: (userId: string) => void;
}

function formatStudyTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function formatRelativeTime(isoString: string): string {
  try {
    const target = new Date(isoString).getTime();
    if (isNaN(target)) return 'Recently';
    const diffMs = Math.max(0, Date.now() - target);
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  } catch {
    return 'Recently';
  }
}

export function UserDirectory({ users, isLoading, onRefresh, onUserDeleted }: UserDirectoryProps) {
  const [activeView, setActiveView] = useState<'users' | 'catalog'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'online' | 'active_today' | 'duo'>('all');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Hard Delete Modal State
  const [userToDelete, setUserToDelete] = useState<AdminUserRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Toggle row expansion to inspect which playlists were added
  const toggleExpand = (userId: string) => {
    setExpandedUserId(prev => (prev === userId ? null : userId));
  };

  // Perform permanent user hard delete
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const result = await adminService.hardDeleteUser(userToDelete.id, userToDelete.emailOrSyncId);
      if (result.success) {
        onUserDeleted?.(userToDelete.id);
        onRefresh?.();
        setUserToDelete(null);
      } else {
        setDeleteError(result.error || 'Failed to delete user. Please try again.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during user deletion.';
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered users (strictly sorted by Last Active date descending)
  const filteredUsers = useMemo(() => {
    return users
      .filter(user => {
        if (filterTab === 'online' && user.status !== 'online') return false;
        if (filterTab === 'active_today' && user.status !== 'online' && user.status !== 'active_today') return false;
        if (filterTab === 'duo' && !user.isDuoPaired) return false;

        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const matchesPlaylist = user.playlists.some(p => p.name.toLowerCase().includes(q));
        return (
          user.displayName.toLowerCase().includes(q) ||
          user.emailOrSyncId.toLowerCase().includes(q) ||
          user.activePlaylist.toLowerCase().includes(q) ||
          matchesPlaylist
        );
      })
      .sort((a, b) => {
        const timeA = new Date(a.lastActiveAt).getTime() || 0;
        const timeB = new Date(b.lastActiveAt).getTime() || 0;
        return timeB - timeA;
      });
  }, [users, filterTab, searchQuery]);

  // Aggregate catalog of all playlists added across all users
  const allPlaylistsCatalog = useMemo(() => {
    const list: Array<{
      playlistId: string;
      name: string;
      youtubePlaylistId: string;
      videoCount: number;
      completedVideos: number;
      totalVideos: number;
      progressPct: number;
      addedAt: string;
      addedByUserName: string;
      addedByUserId: string;
      userStatus: 'online' | 'active_today' | 'offline';
    }> = [];

    users.forEach(u => {
      u.playlists.forEach(p => {
        list.push({
          playlistId: p.id,
          name: p.name,
          youtubePlaylistId: p.youtubePlaylistId,
          videoCount: p.videoCount,
          completedVideos: p.completedVideos,
          totalVideos: p.totalVideos,
          progressPct: p.progressPct,
          addedAt: p.addedAt,
          addedByUserName: u.displayName,
          addedByUserId: u.id,
          userStatus: u.status,
        });
      });
    });

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.addedByUserName.toLowerCase().includes(q) ||
        p.youtubePlaylistId.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const counts = useMemo(() => {
    return {
      all: users.length,
      online: users.filter(u => u.status === 'online').length,
      activeToday: users.filter(u => u.status === 'online' || u.status === 'active_today').length,
      duo: users.filter(u => u.isDuoPaired).length,
      totalPlaylists: users.reduce((acc, u) => acc + u.playlistsCount, 0),
    };
  }, [users]);

  return (
    <div
      className="card"
      style={{
        padding: '2.25rem clamp(1.25rem, 2.5vw, 2.5rem)',
        borderRadius: 'var(--border-radius)',
        background: 'var(--bg-surface-solid)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* View Switcher Tabs (Learners Roster vs. All Playlists Catalog) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem',
          paddingBottom: '1.5rem',
          marginBottom: '1.75rem',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveView('users')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '0.6rem 1.25rem',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: '0.875rem',
              fontWeight: 600,
              background: activeView === 'users' ? 'var(--accent-primary)' : 'var(--bg-surface-2)',
              color: activeView === 'users' ? '#ffffff' : 'var(--text-secondary)',
              border: '1px solid',
              borderColor: activeView === 'users' ? 'var(--accent-primary)' : 'var(--border-color)',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <Users style={{ width: 16, height: 16 }} />
            <span>Learner Directory ({counts.all})</span>
          </button>

          <button
            onClick={() => setActiveView('catalog')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '0.6rem 1.25rem',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: '0.875rem',
              fontWeight: 600,
              background: activeView === 'catalog' ? 'var(--accent-primary)' : 'var(--bg-surface-2)',
              color: activeView === 'catalog' ? '#ffffff' : 'var(--text-secondary)',
              border: '1px solid',
              borderColor: activeView === 'catalog' ? 'var(--accent-primary)' : 'var(--border-color)',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <Layers style={{ width: 16, height: 16 }} />
            <span>All Added Playlists ({counts.totalPlaylists})</span>
          </button>
        </div>

        {/* Global Search Bar */}
        <div style={{ position: 'relative', flex: '1 1 340px', maxWidth: '520px' }}>
          <Search
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 16,
              height: 16,
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={
              activeView === 'users'
                ? 'Search learner, ID, or course...'
                : 'Search playlist title or creator...'
            }
            className="input-field"
            style={{
              width: '100%',
              paddingLeft: '2.5rem',
              paddingTop: '0.65rem',
              paddingBottom: '0.65rem',
              fontSize: '0.875rem',
              borderRadius: 'var(--border-radius-sm)',
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {/* VIEW 1: LEARNERS DIRECTORY */}
      {activeView === 'users' && (
        <>
          {/* Sub-Filters */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: '1.75rem',
              flexWrap: 'wrap',
            }}
          >
            {[
              { id: 'all', label: `All Learners (${counts.all})` },
              { id: 'online', label: `🟢 Online Now (${counts.online})` },
              { id: 'active_today', label: `🟡 Active Today (${counts.activeToday})` },
              { id: 'duo', label: `👥 Duo Paired (${counts.duo})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id as typeof filterTab)}
                style={{
                  padding: '0.45rem 1.15rem',
                  borderRadius: 9999,
                  fontSize: '0.8125rem',
                  fontWeight: filterTab === tab.id ? 700 : 500,
                  background: filterTab === tab.id ? 'var(--accent-primary)' : 'var(--bg-surface-2)',
                  color: filterTab === tab.id ? '#ffffff' : 'var(--text-secondary)',
                  border: '1px solid',
                  borderColor: filterTab === tab.id ? 'var(--accent-primary)' : 'var(--border-color)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              Loading learner directory...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              No learners found matching your criteria.
            </div>
          ) : (
            <div
              style={{
                borderRadius: 'var(--border-radius-sm)',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
                background: 'var(--bg-surface-2)',
              }}
            >
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.8125rem',
                    textAlign: 'left',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem',
                        letterSpacing: '0.05em',
                        background: 'rgba(0, 0, 0, 0.12)',
                      }}
                    >
                      <th style={{ padding: '1rem 1.25rem' }}>LEARNER</th>
                      <th style={{ padding: '1rem 1.25rem' }}>STATUS</th>
                      <th style={{ padding: '1rem 1.25rem' }}>PLAYLISTS ADDED</th>
                      <th style={{ padding: '1rem 1.25rem' }}>ACTIVE COURSE & PROGRESS</th>
                      <th style={{ padding: '1rem 1.25rem' }}>TODAY FOCUS</th>
                      <th style={{ padding: '1rem 1.25rem' }}>STREAK</th>
                      <th style={{ padding: '1rem 1.25rem', color: 'var(--accent-hover)', fontWeight: 700 }}>
                        LAST ACTIVE ↓
                      </th>
                      <th style={{ padding: '1rem 1.25rem' }}>ACTIONS</th>
                      <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>INSPECT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => {
                      const isExpanded = expandedUserId === user.id;
                      const initials = user.displayName
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();

                      const isOnline = user.status === 'online';
                      const isActiveToday = user.status === 'active_today';

                      return (
                        <Fragment key={user.id}>
                          <tr
                            style={{
                              borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)',
                              transition: 'background 0.15s ease',
                              background: isExpanded ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                            }}
                          >
                            {/* Learner Identity */}
                            <td style={{ padding: '1.1rem 1.25rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div
                                  style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, var(--accent-primary), #ec4899)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff',
                                    fontWeight: 700,
                                    fontSize: '0.8125rem',
                                    flexShrink: 0,
                                    boxShadow: 'var(--shadow-sm)',
                                  }}
                                >
                                  {initials}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                                    {user.displayName}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '0.75rem',
                                      color: 'var(--text-muted)',
                                      fontFamily: 'var(--font-mono)',
                                    }}
                                  >
                                    {user.emailOrSyncId}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Status Pill */}
                            <td style={{ padding: '1.1rem 1.25rem' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '4px 10px',
                                  borderRadius: 9999,
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: isOnline
                                    ? 'rgba(16, 185, 129, 0.12)'
                                    : isActiveToday
                                    ? 'rgba(245, 158, 11, 0.12)'
                                    : 'var(--bg-surface-2)',
                                  color: isOnline
                                    ? '#10b981'
                                    : isActiveToday
                                    ? '#f59e0b'
                                    : 'var(--text-muted)',
                                  border: `1px solid ${
                                    isOnline
                                      ? 'rgba(16, 185, 129, 0.3)'
                                      : isActiveToday
                                      ? 'rgba(245, 158, 11, 0.3)'
                                      : 'var(--border-color)'
                                  }`,
                                }}
                              >
                                <span
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background: isOnline ? '#10b981' : isActiveToday ? '#f59e0b' : '#64748b',
                                    boxShadow: isOnline ? '0 0 6px #10b981' : 'none',
                                  }}
                                />
                                {isOnline ? 'Online Now' : isActiveToday ? 'Active Today' : 'Offline'}
                              </span>
                            </td>

                            {/* Playlists Count with click-to-expand */}
                            <td style={{ padding: '1.1rem 1.25rem' }}>
                              <button
                                onClick={() => toggleExpand(user.id)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '5px 12px',
                                  borderRadius: 'var(--border-radius-xs)',
                                  background: isExpanded ? 'var(--accent-light)' : 'var(--bg-surface-1)',
                                  border: '1px solid',
                                  borderColor: isExpanded ? 'var(--accent-primary)' : 'var(--border-color)',
                                  color: isExpanded ? 'var(--accent-hover)' : 'var(--text-primary)',
                                  fontSize: '0.8125rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                title="Click to view playlists added by this user"
                              >
                                <PlayCircle style={{ width: 14, height: 14, color: 'var(--accent-primary)' }} />
                                <span>{user.playlistsCount} {user.playlistsCount === 1 ? 'Playlist' : 'Playlists'}</span>
                                {isExpanded ? (
                                  <ChevronUp style={{ width: 13, height: 13 }} />
                                ) : (
                                  <ChevronDown style={{ width: 13, height: 13 }} />
                                )}
                              </button>
                            </td>

                            {/* Active Course & Progress */}
                            <td style={{ padding: '1.1rem 1.25rem', maxWidth: '280px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                                <BookOpen style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
                                <span
                                  style={{
                                    fontWeight: 500,
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontSize: '0.8125rem',
                                  }}
                                >
                                  {user.activePlaylist}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div
                                  style={{
                                    flex: 1,
                                    height: 6,
                                    borderRadius: 9999,
                                    background: 'var(--bg-surface-1)',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${user.progressPct}%`,
                                      height: '100%',
                                      borderRadius: 9999,
                                      background: 'var(--accent-primary)',
                                    }}
                                  />
                                </div>
                                <span
                                  style={{
                                    fontSize: '0.75rem',
                                    fontFamily: 'var(--font-mono)',
                                    color: 'var(--text-secondary)',
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {user.totalVideos > 0
                                    ? `${user.completedVideos}/${user.totalVideos} videos (${user.progressPct}%)`
                                    : `${user.progressPct}%`}
                                </span>
                              </div>
                            </td>

                            {/* Today Focus Time */}
                            <td style={{ padding: '1.1rem 1.25rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Clock style={{ width: 13, height: 13, color: 'var(--text-muted)' }} />
                                <span
                                  style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontWeight: 700,
                                    color: user.todayStudySeconds > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                                    fontSize: '0.8125rem',
                                  }}
                                >
                                  {formatStudyTime(user.todayStudySeconds)}
                                </span>
                              </div>
                            </td>

                            {/* Current Streak */}
                            <td style={{ padding: '1.1rem 1.25rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Flame style={{ width: 14, height: 14, color: '#f59e0b' }} />
                                <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.8125rem' }}>
                                  {user.currentStreak}d
                                </span>
                              </div>
                            </td>

                            {/* Last Active */}
                            <td style={{ padding: '1.1rem 1.25rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                              {formatRelativeTime(user.lastActiveAt)}
                            </td>

                            {/* User Removal Action (Replaces Block) */}
                            <td style={{ padding: '1.1rem 1.25rem' }}>
                              {isUserAdmin(user.emailOrSyncId) ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    fontSize: '0.75rem',
                                    fontFamily: 'var(--font-mono)',
                                    color: 'var(--accent-hover)',
                                    background: 'rgba(99, 102, 241, 0.1)',
                                    padding: '4px 10px',
                                    borderRadius: 9999,
                                    border: '1px solid rgba(99, 102, 241, 0.25)',
                                    fontWeight: 600,
                                  }}
                                >
                                  <ShieldCheck style={{ width: 12, height: 12 }} />
                                  Admin
                                </span>
                              ) : (
                                <button
                                  onClick={() => {
                                    setDeleteError(null);
                                    setUserToDelete(user);
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '5px 12px',
                                    borderRadius: 'var(--border-radius-xs)',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    background: 'rgba(239, 68, 68, 0.08)',
                                    color: '#ef4444',
                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                  title={`Permanently delete ${user.displayName} and all associated data from the database`}
                                >
                                  <Trash2 style={{ width: 12, height: 12 }} />
                                  <span>Remove User</span>
                                </button>
                              )}
                            </td>

                            {/* Expand Button */}
                            <td style={{ padding: '1.1rem 1.25rem', textAlign: 'right' }}>
                              <button
                                onClick={() => toggleExpand(user.id)}
                                className="btn-icon"
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 'var(--border-radius-xs)',
                                  background: 'var(--bg-surface-1)',
                                  border: '1px solid var(--border-color)',
                                  color: isExpanded ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                  cursor: 'pointer',
                                }}
                                title={isExpanded ? 'Hide added playlists' : 'View added playlists'}
                              >
                                {isExpanded ? (
                                  <ChevronUp style={{ width: 15, height: 15 }} />
                                ) : (
                                  <ChevronDown style={{ width: 15, height: 15 }} />
                                )}
                              </button>
                            </td>
                          </tr>

                          {/* INLINE EXPANDED PLAYLISTS DRAWER */}
                          {isExpanded && (
                            <tr key={`${user.id}-expanded-drawer`} style={{ background: 'rgba(99, 102, 241, 0.04)' }}>
                              <td
                                colSpan={9}
                                style={{
                                  padding: '1.5rem 2rem',
                                  borderBottom: '1px solid var(--border-color)',
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      marginBottom: '1.25rem',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <PlayCircle style={{ width: 18, height: 18, color: 'var(--accent-primary)' }} />
                                      <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        Playlists Added by {user.displayName} ({user.playlists.length})
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => setExpandedUserId(null)}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        fontSize: '0.8125rem',
                                        cursor: 'pointer',
                                        padding: '4px 8px',
                                      }}
                                    >
                                      Close Details ✕
                                    </button>
                                  </div>

                                  {user.playlists.length === 0 ? (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', padding: '0.75rem 0' }}>
                                      No playlists added yet by this learner.
                                    </div>
                                  ) : (
                                    <div
                                      style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                                        gap: '1.25rem',
                                      }}
                                    >
                                      {user.playlists.map(pl => (
                                        <div
                                          key={pl.id}
                                          style={{
                                            padding: '1.25rem',
                                            borderRadius: 'var(--border-radius-sm)',
                                            background: 'var(--bg-surface-solid)',
                                            border: '1px solid var(--border-color)',
                                            boxShadow: 'var(--shadow-sm)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.85rem',
                                          }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                                              {pl.name}
                                            </div>
                                            <a
                                              href={`https://www.youtube.com/playlist?list=${pl.youtubePlaylistId}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: 28,
                                                height: 28,
                                                borderRadius: 'var(--border-radius-xs)',
                                                background: 'var(--bg-surface-2)',
                                                border: '1px solid var(--border-color)',
                                                color: 'var(--accent-primary)',
                                                flexShrink: 0,
                                              }}
                                              title="Open YouTube Playlist"
                                            >
                                              <ExternalLink style={{ width: 14, height: 14 }} />
                                            </a>
                                          </div>

                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            <span>{pl.videoCount} videos in playlist</span>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-hover)' }}>
                                              {pl.completedVideos}/{pl.totalVideos} completed ({pl.progressPct}%)
                                            </span>
                                          </div>

                                          <div
                                            style={{
                                              height: 5,
                                              borderRadius: 9999,
                                              background: 'var(--bg-surface-2)',
                                              overflow: 'hidden',
                                            }}
                                          >
                                            <div
                                              style={{
                                                width: `${pl.progressPct}%`,
                                                height: '100%',
                                                borderRadius: 9999,
                                                background: 'var(--accent-primary)',
                                              }}
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* VIEW 2: ALL ADDED PLAYLISTS CATALOG */}
      {activeView === 'catalog' && (
        <div>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              Loading platform playlists catalog...
            </div>
          ) : allPlaylistsCatalog.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              No playlists found matching your search.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {allPlaylistsCatalog.map((pl, idx) => (
                <div
                  key={`${pl.playlistId}-${idx}`}
                  style={{
                    padding: '1.4rem',
                    borderRadius: 'var(--border-radius-sm)',
                    background: 'var(--bg-surface-2)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                        {pl.name}
                      </div>
                      <a
                        href={`https://www.youtube.com/playlist?list=${pl.youtubePlaylistId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 'var(--border-radius-xs)',
                          background: 'var(--bg-surface-1)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent-primary)',
                          border: '1px solid var(--border-color)',
                          flexShrink: 0,
                        }}
                        title="Open Playlist on YouTube"
                      >
                        <ExternalLink style={{ width: 14, height: 14 }} />
                      </a>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      <span>Added by:</span>
                      <strong style={{ color: 'var(--text-secondary)' }}>{pl.addedByUserName}</strong>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 8 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{pl.videoCount} total videos</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-hover)' }}>
                        {pl.completedVideos}/{pl.totalVideos} completed ({pl.progressPct}%)
                      </span>
                    </div>

                    <div
                      style={{
                        height: 6,
                        borderRadius: 9999,
                        background: 'var(--bg-surface-1)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${pl.progressPct}%`,
                          height: '100%',
                          borderRadius: 9999,
                          background: 'var(--gradient-accent)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* HARD DELETE CONFIRMATION MODAL */}
      {userToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            padding: '1.5rem',
          }}
          onClick={e => {
            if (e.target === e.currentTarget && !isDeleting) {
              setUserToDelete(null);
            }
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              borderRadius: 'var(--border-radius)',
              background: 'var(--bg-surface-solid)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 24px rgba(239, 68, 68, 0.15)',
              overflow: 'hidden',
              animation: 'modalSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-color)',
                background: 'rgba(239, 68, 68, 0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                  }}
                >
                  <AlertTriangle style={{ width: 18, height: 18 }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Hard Delete User
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>
                    Permanent & Irreversible Removal
                  </span>
                </div>
              </div>

              <button
                onClick={() => !isDeleting && setUserToDelete(null)}
                disabled={isDeleting}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  padding: 6,
                  borderRadius: 'var(--border-radius-xs)',
                }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                Are you sure you want to permanently remove <strong style={{ color: 'var(--text-primary)' }}>{userToDelete.displayName}</strong>?
              </p>

              {/* User Summary Box */}
              <div
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--border-radius-sm)',
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.8125rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Identifier / Email:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {userToDelete.emailOrSyncId}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Playlists Tracked:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {userToDelete.playlistsCount} playlists
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Habit Streak:</span>
                  <span style={{ fontWeight: 600, color: '#f59e0b' }}>
                    {userToDelete.currentStreak} days
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Today Focus Time:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatStudyTime(userToDelete.todayStudySeconds)}
                  </span>
                </div>
              </div>

              {/* Consequence Warning Notice */}
              <div
                style={{
                  padding: '0.9rem 1.1rem',
                  borderRadius: 'var(--border-radius-sm)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                <strong style={{ color: '#ef4444', display: 'block', marginBottom: 4 }}>
                  ⚠️ This action will completely purge:
                </strong>
                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  <li>All saved playlists, task checklists, and video progress from the database.</li>
                  <li>Duo buddy partnerships, 1-on-1 chat logs, and daily scratchpads.</li>
                  <li>Study telemetry, snapshots, and authentication credentials.</li>
                </ul>
              </div>

              {deleteError && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--border-radius-xs)',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    color: '#ef4444',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                  }}
                >
                  {deleteError}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 12,
                padding: '1.1rem 1.5rem',
                borderTop: '1px solid var(--border-color)',
                background: 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <button
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                style={{
                  padding: '0.55rem 1.15rem',
                  borderRadius: 'var(--border-radius-sm)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0.55rem 1.35rem',
                  borderRadius: 'var(--border-radius-sm)',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  background: '#ef4444',
                  border: '1px solid #dc2626',
                  color: '#ffffff',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
                  transition: 'all 0.15s ease',
                  opacity: isDeleting ? 0.8 : 1,
                }}
              >
                {isDeleting ? (
                  <>
                    <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                    <span>Hard Deleting User...</span>
                  </>
                ) : (
                  <>
                    <Trash2 style={{ width: 14, height: 14 }} />
                    <span>Permanently Remove User</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
