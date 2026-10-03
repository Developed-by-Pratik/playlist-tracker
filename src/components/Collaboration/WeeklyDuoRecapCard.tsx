'use client';

import { Trophy, Flame, Clock, CheckCircle2, Zap, Sparkles } from 'lucide-react';
import { PartnerSnapshot } from '@/lib/types/collaboration';
import { formatStudyTime } from '@/lib/study-time/study-time-tracker';
import { fireConfetti } from '@/lib/celebration/confetti';

interface WeeklyDuoRecapCardProps {
  partnerSnapshot: PartnerSnapshot | null;
  myStats: {
    progress: number;
    completed: number;
    streak: number;
    activePlaylistName?: string;
  };
  myStudyTimeSeconds: number;
}

export function WeeklyDuoRecapCard({
  partnerSnapshot,
  myStats,
  myStudyTimeSeconds,
}: WeeklyDuoRecapCardProps) {
  // Aggregate stats
  const partnerSeconds = partnerSnapshot?.todayStudySeconds || 0;
  const combinedSeconds = myStudyTimeSeconds + partnerSeconds;
  const combinedCompleted = myStats.completed + (partnerSnapshot?.todayCompleted || 0);
  const maxStreak = Math.max(myStats.streak, partnerSnapshot?.currentStreak || 0);

  // Synergy Tier derivation
  const getSynergyTier = () => {
    if (maxStreak >= 7) return { label: '⚡ Elite Duo Champions', desc: 'Top tier consistency! You and your partner are in the zone.', color: '#ec4899' };
    if (maxStreak >= 4) return { label: '🔥 Momentum Masters', desc: 'Over 4 consecutive days of active learning together!', color: '#f97316' };
    if (combinedSeconds > 3600) return { label: '🚀 Focused Flow State', desc: 'Over 1 hour of mutual study time logged today.', color: '#6366f1' };
    return { label: '🌱 Synergy Initiators', desc: 'Collaborating daily creates unstoppable accountability.', color: '#10b981' };
  };

  const tier = getSynergyTier();

  const handleCelebrate = () => {
    fireConfetti({ count: 90 });
  };

  return (
    <div
      className="card"
      style={{
        padding: '1.75rem',
        borderRadius: 'var(--border-radius-md)',
        background: 'var(--bg-surface-1)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Decorative gradient glow */}
      <div
        style={{
          position: 'absolute',
          top: -60,
          right: -60,
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--border-radius-sm)',
              background: 'rgba(236, 72, 153, 0.12)',
              border: '1px solid rgba(236, 72, 153, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ec4899',
            }}
          >
            <Trophy style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Duo Synergy Recap & Milestones
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              Mutual accountability analytics for this study cycle
            </p>
          </div>
        </div>

        <button
          onClick={handleCelebrate}
          className="btn-primary"
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Sparkles style={{ width: 14, height: 14 }} />
          <span>Celebrate Wins 🎉</span>
        </button>
      </div>

      {/* Synergy Badge Hero */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          borderRadius: 'var(--border-radius-sm)',
          background: 'var(--bg-surface-2)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              padding: '8px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
            }}
          >
            <Zap style={{ width: 24, height: 24, color: tier.color }} />
          </div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: tier.color }}>
              {tier.label}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {tier.desc}
            </div>
          </div>
        </div>
      </div>

      {/* Key Combined Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Total Mutual Focus Time */}
        <div
          style={{
            padding: '1.125rem',
            borderRadius: 'var(--border-radius-sm)',
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: 600 }}>
            <Clock style={{ width: 14, height: 14 }} />
            <span>COMBINED FOCUS TIME</span>
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {formatStudyTime(combinedSeconds)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            You ({formatStudyTime(myStudyTimeSeconds)}) • Partner ({formatStudyTime(partnerSeconds)})
          </div>
        </div>

        {/* Combined Tasks Completed */}
        <div
          style={{
            padding: '1.125rem',
            borderRadius: 'var(--border-radius-sm)',
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}>
            <CheckCircle2 style={{ width: 14, height: 14 }} />
            <span>TASKS & GOALS CRUSHED</span>
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {combinedCompleted}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Total learning milestones reached
          </div>
        </div>

        {/* Study Streak */}
        <div
          style={{
            padding: '1.125rem',
            borderRadius: 'var(--border-radius-sm)',
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f97316', fontSize: '0.75rem', fontWeight: 600 }}>
            <Flame style={{ width: 14, height: 14 }} />
            <span>DUO STREAK RECORD</span>
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {maxStreak} Days
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Active daily study streak
          </div>
        </div>
      </div>
    </div>
  );
}
