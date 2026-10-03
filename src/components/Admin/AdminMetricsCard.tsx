'use client';

import { Users, UserCheck, UserPlus, Clock } from 'lucide-react';
import { AdminSystemMetrics } from '@/lib/admin/admin-service';

interface AdminMetricsCardProps {
  metrics: AdminSystemMetrics | null;
  isLoading: boolean;
}

export function AdminMetricsCard({ metrics, isLoading }: AdminMetricsCardProps) {
  const cards = [
    {
      label: 'TOTAL USERS',
      value: metrics?.totalUsers ?? 0,
      subtext: 'Registered learners',
      icon: Users,
      color: 'var(--accent-primary)',
    },
    {
      label: 'ACTIVE TODAY',
      value: metrics?.activeUsersToday ?? 0,
      subtext: 'Studied in last 24h',
      icon: UserCheck,
      color: '#10b981',
      statusDot: true,
      dotColor: '#10b981',
    },
    {
      label: 'DUO BUDDY PAIRS',
      value: metrics?.activeDuoPartnerships ?? 0,
      subtext: 'Studying collaboratively',
      icon: UserPlus,
      color: '#ec4899',
    },
    {
      label: 'TOTAL STUDY HOURS',
      value: `${metrics?.totalStudyHours ?? 0}h`,
      subtext: 'Collective focus time',
      icon: Clock,
      color: '#f59e0b',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2.5rem',
      }}
    >
      {cards.map(c => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="card"
            style={{
              padding: '1.65rem 1.6rem',
              borderRadius: 'var(--border-radius)',
              background: 'var(--bg-surface-solid)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '1rem',
              boxShadow: 'var(--shadow-sm)',
              opacity: isLoading ? 0.6 : 1,
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.05em',
                }}
              >
                {c.label}
              </span>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--border-radius-xs)',
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: c.color,
                }}
              >
                <Icon style={{ width: 18, height: 18 }} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              {c.statusDot && (
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: c.dotColor,
                    boxShadow: `0 0 12px ${c.dotColor}`,
                  }}
                />
              )}
              <span
                style={{
                  fontSize: '2.25rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  lineHeight: 1.1,
                }}
              >
                {c.value}
              </span>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {c.subtext}
            </div>
          </div>
        );
      })}
    </div>
  );
}
