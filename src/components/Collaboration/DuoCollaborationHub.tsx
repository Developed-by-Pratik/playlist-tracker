'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Copy,
  Check,
  UserPlus,
  Unlink,
  Shield,
  EyeOff,
  Flame,
  Clock,
  Sparkles,
  MessageSquare,
  FileText,
  Trophy,
} from 'lucide-react';
import { DuoPartnership, PartnerSnapshot } from '@/lib/types/collaboration';
import {
  getMyDuoCode,
  formatLastActive,
  isGhostModeEnabled,
  setGhostMode,
} from '@/lib/collaboration/collaboration-service';
import { formatStudyTime } from '@/lib/study-time/study-time-tracker';
import { DuoChatWindow } from '@/components/Collaboration/DuoChatWindow';
import { DuoDailyScratchpad } from '@/components/Collaboration/DuoDailyScratchpad';
import { WeeklyDuoRecapCard } from '@/components/Collaboration/WeeklyDuoRecapCard';
import { duoChatService } from '@/lib/collaboration/chat-service';

interface DuoCollaborationHubProps {
  partnership: DuoPartnership | null;
  partnerSnapshot: PartnerSnapshot | null;
  onPair: (targetCode: string) => Promise<{ success: boolean; error?: string }>;
  onDisconnect: () => void;
  myStats: {
    progress: number;
    completed: number;
    streak: number;
    activePlaylistName?: string;
  };
  myDisplayName?: string;
  myStudyTimeSeconds?: number;
}

/**
 * DuoCollaborationHub — Central 1-on-1 accountability workspace
 */
export function DuoCollaborationHub({
  partnership,
  partnerSnapshot,
  onPair,
  onDisconnect,
  myStats,
  myDisplayName = 'Me',
  myStudyTimeSeconds = 0,
}: DuoCollaborationHubProps) {
  const [hubTab, setHubTab] = useState<'mirror' | 'chat' | 'scratchpad' | 'recap'>('mirror');
  const [unreadCount, setUnreadCount] = useState(0);
  const [targetCode, setTargetCode] = useState('');
  const [pairError, setPairError] = useState<string | null>(null);
  const [isPairingLoading, setIsPairingLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [ghostMode, setGhostModeState] = useState(isGhostModeEnabled());

  useEffect(() => {
    duoChatService.setPartnership(partnership);
    const unsub = duoChatService.subscribeToUnreadCount(count => {
      setUnreadCount(count);
    });
    return () => {
      unsub();
    };
  }, [partnership]);

  const myCode = getMyDuoCode();

  const handleCopyCode = () => {
    navigator.clipboard.writeText(myCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleConnect = async (codeToUse?: string) => {
    const code = (codeToUse || targetCode).trim();
    if (!code) {
      setPairError('Please enter a Duo Code.');
      return;
    }
    setPairError(null);
    setIsPairingLoading(true);

    const result = await onPair(code);
    setIsPairingLoading(false);
    if (!result.success) {
      setPairError(result.error || 'Failed to connect with partner.');
    } else {
      setTargetCode('');
    }
  };

  const handleToggleGhostMode = () => {
    const next = !ghostMode;
    setGhostModeState(next);
    setGhostMode(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* ── Unpaired State: Invitation & Pairing Card ── */}
      {!partnership ? (
        <div
          className="card"
          style={{
            padding: '2.5rem 1.75rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '1.5rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.1)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.2)',
            }}
          >
            <Users style={{ width: 28, height: 28 }} />
          </div>

          <div style={{ maxWidth: 460 }}>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
              Pair with your Study Partner
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Share your Duo Code with your study buddy or enter theirs to see each other’s learning progress,
              motivate each other, and spark a shared synergy streak!
            </p>
          </div>

          {/* Your Duo Code Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '0.625rem 1rem',
              borderRadius: 'var(--border-radius-sm)',
              background: 'var(--bg-surface-2)',
              border: '1px dashed var(--accent-primary)',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>YOUR DUO CODE:</span>
            <span style={{ fontSize: '1.125rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', letterSpacing: '0.08em' }}>
              {myCode}
            </span>
            <button
              onClick={handleCopyCode}
              className="btn-outline"
              style={{ padding: '0.35rem 0.625rem', fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {copiedCode ? <Check style={{ width: 12, height: 12, color: 'var(--accent-success)' }} /> : <Copy style={{ width: 12, height: 12 }} />}
              <span>{copiedCode ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          {/* Partner Code Input Form */}
          <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Enter Partner's Duo Code..."
                value={targetCode}
                onChange={e => setTargetCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
                style={{
                  flex: 1,
                  fontSize: '0.875rem',
                  padding: '0.625rem 0.875rem',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              />
              <button
                onClick={() => handleConnect()}
                disabled={isPairingLoading}
                className="btn-primary"
                style={{ padding: '0 1.25rem', fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <UserPlus style={{ width: 14, height: 14 }} />
                <span>{isPairingLoading ? 'Pairing...' : 'Connect'}</span>
              </button>
            </div>

            {pairError && (
              <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 500 }}>
                {pairError}
              </span>
            )}

            {/* Quick Demo Partner Button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Want to test right away?</span>
              <button
                onClick={() => handleConnect('DUO-DEMO')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Try Demo Partner (Alex)
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Paired State: Partner Progress Dashboard ── */
        <>
          {/* Partnership Header Bar */}
          <div
            className="card"
            style={{
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            {/* Left: Partner Profile & Live Presence */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ position: 'relative', width: 44, height: 44 }}>
                {partnerSnapshot?.avatarUrl ? (
                  <img
                    src={partnerSnapshot.avatarUrl}
                    alt={partnerSnapshot.displayName}
                    style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: 'var(--gradient-accent)',
                      color: '#fff',
                      fontSize: '1.125rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {partnerSnapshot?.displayName ? partnerSnapshot.displayName[0].toUpperCase() : 'B'}
                  </div>
                )}
                {/* Status Dot */}
                <span
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 11,
                    height: 11,
                    borderRadius: '50%',
                    background: partnerSnapshot?.isPrivate ? '#a855f7' : formatLastActive(partnerSnapshot?.lastActiveAt || '', false).includes('Online') ? '#34d399' : '#94a3b8',
                    border: '2px solid var(--bg-surface-1)',
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {partnerSnapshot?.displayName || 'Study Buddy'}
                  </h3>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontFamily: 'var(--font-mono)',
                      padding: '2px 8px',
                      borderRadius: 99,
                      background: 'var(--bg-surface-2)',
                      color: 'var(--accent-primary)',
                      border: '1px solid var(--border-color)',
                      fontWeight: 600,
                    }}
                  >
                    Partner: {partnership.duoCode}
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  {formatLastActive(partnerSnapshot?.lastActiveAt || '', partnerSnapshot?.isPrivate ?? false)}
                </p>
              </div>
            </div>

            {/* Right: Privacy Toggle & Disconnect */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Ghost Mode Toggle */}
              <button
                onClick={handleToggleGhostMode}
                title={ghostMode ? 'Ghost Mode Active (Your progress is hidden from partner)' : 'Enable Ghost Mode to study privately'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '0.4rem 0.75rem',
                  borderRadius: 99,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: '1px solid ' + (ghostMode ? '#a855f7' : 'var(--border-color)'),
                  background: ghostMode ? 'rgba(168, 85, 247, 0.12)' : 'var(--bg-surface-2)',
                  color: ghostMode ? '#c084fc' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <EyeOff style={{ width: 13, height: 13 }} />
                <span>{ghostMode ? 'Ghost Mode ON' : 'Privacy Mode'}</span>
              </button>

              <button
                onClick={onDisconnect}
                title="Disconnect from this study partner"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '0.4rem 0.75rem',
                  borderRadius: 99,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  border: '1px solid var(--border-color)',
                  background: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <Unlink style={{ width: 12, height: 12 }} />
                <span>Unpair</span>
              </button>
            </div>
          </div>

          {/* Sub-Tab Navigation Bar */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-surface-2)',
              borderRadius: 'var(--border-radius-sm)',
              padding: '4px',
              border: '1px solid var(--border-color)',
              gap: '4px',
              width: 'fit-content',
              flexWrap: 'wrap',
            }}
          >
            {[
              { id: 'mirror' as const, label: 'Progress Mirror', icon: Shield },
              { id: 'chat' as const, label: 'Duo Chat', icon: MessageSquare, badge: unreadCount },
              { id: 'scratchpad' as const, label: 'Daily Scratchpad', icon: FileText },
              { id: 'recap' as const, label: 'Weekly Recap', icon: Trophy },
            ].map(tab => {
              const isActive = hubTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setHubTab(tab.id);
                    if (tab.id === 'chat') {
                      duoChatService.markAllAsRead();
                    }
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    borderRadius: 'calc(var(--border-radius-sm) - 2px)',
                    border: 'none',
                    background: isActive ? 'var(--gradient-accent)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Icon style={{ width: 14, height: 14 }} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      style={{
                        padding: '1px 6px',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        borderRadius: 99,
                        background: '#ef4444',
                        color: '#fff',
                        marginLeft: 4,
                      }}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sub-Tab 1: Partner Read-Only Progress Mirror Card */}
          {hubTab === 'mirror' && (
          <div
            className="card"
            style={{
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Partner Learning Progress (Read-Only)
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: '0.6875rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--accent-primary)',
                    background: 'rgba(99, 102, 241, 0.08)',
                    padding: '2px 8px',
                    borderRadius: 99,
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                  }}
                >
                  <Shield style={{ width: 10, height: 10 }} />
                  READ-ONLY MIRROR
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-surface-2)',
                  padding: '3px 8px',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid var(--border-color)',
                }}>
                  <span>You: <strong style={{ color: 'var(--accent-primary)' }}>{myStats.progress}%</strong></span>
                  <span style={{ color: 'var(--border-color)' }}>|</span>
                  <span>Partner: <strong style={{ color: '#4ade80' }}>{partnerSnapshot?.progressPct ?? 0}%</strong></span>
                </div>

                {partnerSnapshot?.currentStreak ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#f97316',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <Flame style={{ width: 14, height: 14, fill: '#f97316' }} />
                    <span>{partnerSnapshot.currentStreak}-Day Study Streak</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* If Partner is in Privacy Mode */}
            {partnerSnapshot?.isPrivate ? (
              <div
                style={{
                  padding: '2rem 1.5rem',
                  borderRadius: 'var(--border-radius-sm)',
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-color)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <EyeOff style={{ width: 28, height: 28, color: '#a855f7' }} />
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Partner is currently studying in Privacy Mode
                </h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0, maxWidth: 380 }}>
                  Their active course and checklist metrics are hidden while they focus in private mode.
                </p>
              </div>
            ) : (
              /* Active Mirror Metrics */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                {/* Active Course Card */}
                <div
                  style={{
                    padding: '1.125rem',
                    borderRadius: 'var(--border-radius-sm)',
                    background: 'var(--bg-surface-2)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      ACTIVE COURSE
                    </span>
                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0 0 0' }}>
                      {partnerSnapshot?.activePlaylist || 'General Learning'}
                    </h4>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-muted)' }}>COMPLETION</span>
                      <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
                        {partnerSnapshot?.progressPct ?? 0}%
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-surface-solid)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${partnerSnapshot?.progressPct ?? 0}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        style={{ height: '100%', background: 'var(--gradient-accent)' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Today's Completed Items */}
                <div
                  style={{
                    padding: '1.125rem',
                    borderRadius: 'var(--border-radius-sm)',
                    background: 'var(--bg-surface-2)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                  }}
                >
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    TODAY&apos;S ACTIVITY
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {partnerSnapshot?.todayCompleted ?? 0}
                    </span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>tasks / goals completed</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.6875rem', color: 'var(--accent-success)' }}>
                    <Sparkles style={{ width: 12, height: 12 }} />
                    <span>Synchronized in real-time</span>
                  </div>
                </div>

                {/* Today's Study Time */}
                <div
                  style={{
                    padding: '1.125rem',
                    borderRadius: 'var(--border-radius-sm)',
                    background: 'var(--bg-surface-2)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                  }}
                >
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    FOCUS TIME TODAY
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {formatStudyTime(partnerSnapshot?.todayStudySeconds ?? 0)}
                    </span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>active study</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    <Clock style={{ width: 12, height: 12 }} />
                    <span>Idle detection active</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Sub-Tab 2: Duo Chat Window */}
          {hubTab === 'chat' && (
            <DuoChatWindow
              partnership={partnership}
              partnerSnapshot={partnerSnapshot}
              myDisplayName={myDisplayName}
            />
          )}

          {/* Sub-Tab 3: Daily Scratchpad */}
          {hubTab === 'scratchpad' && (
            <DuoDailyScratchpad
              partnership={partnership}
              myDisplayName={myDisplayName}
            />
          )}

          {/* Sub-Tab 4: Weekly Recap */}
          {hubTab === 'recap' && (
            <WeeklyDuoRecapCard
              partnerSnapshot={partnerSnapshot}
              myStats={myStats}
              myStudyTimeSeconds={myStudyTimeSeconds}
            />
          )}
        </>
      )}
    </div>
  );
}
