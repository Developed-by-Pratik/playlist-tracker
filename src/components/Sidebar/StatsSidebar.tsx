'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, Flame, Trophy, Target, Award, 
  ChevronDown, TrendingUp 
} from 'lucide-react';
import { AppData, Video, PlaylistRecord } from '@/lib/types';
import { GrowthChart } from './GrowthChart';
import { PomodoroTimer } from '@/components/PomodoroTimer';
import { PlaylistSwitcher } from '@/components/Playlist/PlaylistSwitcher';

interface StatsSidebarProps {
  data: AppData;
  videos: Video[];
  stats: {
    completed: number;
    total: number;
    progress: number;
    streak: number;
  };
  chartData: { date: string; count: number }[];
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
  const [expandedSection, setExpandedSection] = useState<'chart' | 'milestones' | 'pomodoro' | null>(null);
  const isChartExpanded = expandedSection === 'chart';
  const isMilestonesExpanded = expandedSection === 'milestones';

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
      />

      {/* 1. Completion Card */}
      <div className="card sidebar-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
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

          <button 
            onClick={(e) => { e.stopPropagation(); setExpandedSection(isChartExpanded ? null : 'chart'); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', display: 'flex' }}
          >
            <motion.div animate={{ rotate: isChartExpanded ? 180 : 0 }}>
              <ChevronDown style={{ width: 16, height: 16 }} />
            </motion.div>
          </button>
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
                  <GrowthChart data={chartData} isNested={true} />
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

      {/* 3. Milestones Section (Toggleable) */}
      <motion.div 
        layout
        className="card sidebar-card" 
        style={{ padding: '1.25rem', cursor: 'pointer' }}
        onClick={() => !isMilestonesExpanded && setExpandedSection('milestones')}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Trophy style={{ width: 16, height: 16, color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Milestones
            </span>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); setExpandedSection(isMilestonesExpanded ? null : 'milestones'); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', display: 'flex' }}
          >
            <motion.div animate={{ rotate: isMilestonesExpanded ? 180 : 0 }}>
              <ChevronDown style={{ width: 16, height: 16 }} />
            </motion.div>
          </button>
        </div>

        <AnimatePresence>
          {isMilestonesExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '1rem' }}>
                {[
                  { label: 'First Step', desc: 'Complete 1 module', icon: Target, unlocked: stats.completed >= 1 },
                  { label: 'Consistent', desc: '3 day streak', icon: Flame, unlocked: stats.streak >= 3 },
                  { label: 'Halfway', desc: '50% completion', icon: Award, unlocked: stats.progress >= 50 },
                ].map((a, i) => (
                  <div key={i} style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    opacity: a.unlocked ? 1 : 0.4,
                    filter: a.unlocked ? 'none' : 'grayscale(1)',
                    transition: 'all 0.3s ease'
                  }}>
                    <div style={{ 
                      width: 32, height: 32, borderRadius: 8, 
                      background: a.unlocked ? 'var(--gradient-accent)' : 'var(--bg-surface-2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: a.unlocked ? '0 4px 12px rgba(99, 102, 241, 0.2)' : 'none'
                    }}>
                      <a.icon style={{ width: 16, height: 16, color: a.unlocked ? 'white' : 'var(--text-muted)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{a.label}</div>
                      <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{a.desc}</div>
                    </div>
                  </div>
                ))}
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
