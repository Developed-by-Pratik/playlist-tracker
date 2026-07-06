'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, Flame, 
  ChevronDown, TrendingUp 
} from 'lucide-react';
import { AppData, Video, PlaylistRecord } from '@/lib/types';
import { GrowthChart } from './GrowthChart';
import { PlaylistSwitcher } from '@/components/Playlist/PlaylistSwitcher';
import dynamic from 'next/dynamic';

const PomodoroTimer = dynamic(() => import('@/components/PomodoroTimer').then(m => m.PomodoroTimer), {
  ssr: false,
  loading: () => (
    <div style={{ height: 60, borderRadius: 20, background: 'var(--bg-surface-2)', border: '1px solid var(--border-color)', animation: 'pulse 1.5s ease-in-out infinite' }} />
  )
});

interface StatsSidebarProps {
  data: AppData;
  videos: Video[];
  stats: {
    completed: number;
    total: number;
    progress: number;
    streak: number;
  };
  chartData: { date: string; count: number; fullDate?: string }[];
  sessionCount: number;
  onPomodoroStateChange: (state: 'focus' | 'break' | 'idle') => void;
  playlists: Record<string, PlaylistRecord>;
  activePlaylistId: string | null;
  onSwitchPlaylist: (id: string) => void;
  onDeletePlaylist: (id: string) => void;
  onAddPlaylist: () => void;
  onRenamePlaylist: (id: string, name: string) => void;
}

const sidebarVariants = {
  hidden: { opacity: 0, x: -24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as any, delay: 0.1 }
  }
};

export function StatsSidebar({ 
  data, videos, stats, chartData, sessionCount, onPomodoroStateChange,
  playlists, activePlaylistId, onSwitchPlaylist, onDeletePlaylist, onAddPlaylist,
  onRenamePlaylist
}: StatsSidebarProps) {
  const [expandedSection, setExpandedSection] = useState<'playlists' | 'completion' | 'chart' | 'pomodoro' | null>('playlists');
  const isChartExpanded = expandedSection === 'chart';
  const [chartFilter, setChartFilter] = useState<'all' | 'week' | 'month'>('all');

  return (
    <motion.aside
      variants={sidebarVariants}
      initial="hidden"
      animate="visible"
      style={{ 
        position: 'sticky', 
        top: '2rem', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1rem',
        paddingRight: '0.5rem',
      }}
    >
      {/* 0. Playlist Switcher */}
      <PlaylistSwitcher
        playlists={playlists}
        activePlaylistId={activePlaylistId}
        onSwitch={onSwitchPlaylist}
        onDelete={onDeletePlaylist}
        onAddPlaylist={onAddPlaylist}
        onRename={onRenamePlaylist}
        isExpanded={expandedSection === 'playlists'}
        onToggleExpanded={(val) => setExpandedSection(val ? 'playlists' : null)}
      />

      {/* 1. Completion Card */}
      <motion.div 
        layout
        className="card sidebar-card" 
        style={{ 
          padding: '1.125rem', 
          cursor: expandedSection === 'completion' ? 'default' : 'pointer',
          overflow: 'hidden'
        }}
        onClick={() => expandedSection !== 'completion' && setExpandedSection('completion')}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
            <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--accent-primary)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)' }}>
              Completion
            </span>
            {expandedSection !== 'completion' && (
              <span style={{ 
                fontSize: '0.75rem', 
                fontFamily: 'var(--font-mono)', 
                color: 'var(--accent-primary)', 
                fontWeight: 700,
                marginLeft: '6px'
              }}>
                {stats.progress}%
              </span>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {expandedSection !== 'completion' && (
              <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 600 }}>
                {stats.completed}/{stats.total}
              </span>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); setExpandedSection(expandedSection === 'completion' ? null : 'completion'); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', display: 'flex' }}
            >
              <motion.div animate={{ rotate: expandedSection === 'completion' ? 180 : 0 }}>
                <ChevronDown style={{ width: 16, height: 16 }} />
              </motion.div>
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {expandedSection === 'completion' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
                    <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="32" cy="32" r="27" fill="none" stroke="var(--border-color)" strokeWidth="5" />
                      <motion.circle
                        cx="32" cy="32" r="27" fill="none"
                        stroke="var(--accent-primary)" strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 27}`}
                        initial={{ strokeDashoffset: 2 * Math.PI * 27 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 27 * (1 - stats.progress / 100) }}
                        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] as any, delay: 0.3 }}
                      />
                    </svg>
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
                      color: 'var(--accent-primary)',
                    }}>
                      {stats.progress}%
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                      Completion
                    </p>
                    <div style={{ fontSize: '1.625rem', fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)' }}>
                      {stats.completed}
                      <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                        /{stats.total}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}>
                  {[
                    { label: 'Done', value: stats.completed, icon: CheckCircle2, color: 'var(--accent-success)', bg: 'var(--accent-success-light)' },
                    { label: 'Streak', value: `${stats.streak}d`, icon: Flame, color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' },
                  ].map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} style={{
                      background: bg, borderRadius: 10, padding: '0.625rem 0.75rem',
                      display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 100px',
                      minWidth: 0, overflow: 'hidden'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Icon style={{ width: 12, height: 12, color }} />
                        <span style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)', color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{label}</span>
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 2. Daily Growth Chart (Toggleable) */}
      <motion.div 
        layout
        className="card sidebar-card" 
        style={{ padding: '1.25rem', cursor: 'pointer' }}
        onClick={() => !isChartExpanded && setExpandedSection('chart')}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp style={{ width: 16, height: 16, color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Daily Growth
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isChartExpanded && (
              <div 
                style={{
                  display: 'inline-flex',
                  background: 'var(--bg-surface-2)',
                  borderRadius: 'var(--border-radius-xs)',
                  padding: '2px',
                  border: '1px solid var(--border-color)',
                  marginRight: '0.25rem',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {(['all', 'week', 'month'] as const).map(f => {
                  const label = f === 'week' ? '7D' : f === 'month' ? '30D' : 'All';
                  const isActive = chartFilter === f;
                  return (
                    <button
                      key={f}
                      onClick={() => setChartFilter(f)}
                      style={{
                        background: isActive ? 'var(--bg-surface-solid)' : 'transparent',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                        border: 'none',
                        borderRadius: 'calc(var(--border-radius-xs) - 2px)',
                        padding: '2px 6px',
                        fontSize: '0.625rem',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: isActive ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            <button 
              onClick={(e) => { e.stopPropagation(); setExpandedSection(isChartExpanded ? null : 'chart'); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', display: 'flex' }}
            >
              <motion.div animate={{ rotate: isChartExpanded ? 180 : 0 }}>
                <ChevronDown style={{ width: 16, height: 16 }} />
              </motion.div>
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isChartExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ paddingTop: '1rem' }}>
                {chartData.length > 0 ? (
                  <GrowthChart data={chartData} isNested={true} filter={chartFilter} />
                ) : (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', margin: '0.5rem 0' }}>
                    Complete a module to see progress.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>


      {/* 4. Pomodoro Timer */}
      <PomodoroTimer 
        onStateChange={onPomodoroStateChange}
        isExpanded={expandedSection === 'pomodoro'}
        onToggleExpanded={(expanded) => setExpandedSection(expanded ? 'pomodoro' : null)}
      />
    </motion.aside>
  );
}
