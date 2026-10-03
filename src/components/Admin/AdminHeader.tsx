'use client';

import Link from 'next/link';
import { ArrowLeft, RefreshCw, Download, ShieldCheck } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface AdminHeaderProps {
  onRefresh: () => void;
  onExport: () => void;
  isRefreshing: boolean;
}

export function AdminHeader({ onRefresh, onExport, isRefreshing }: AdminHeaderProps) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        paddingBottom: '1.75rem',
        marginBottom: '2rem',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      {/* Title & Back Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Link
          href="/"
          className="btn-icon"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 'var(--border-radius-sm)',
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
          }}
          title="Return to Main Tracker"
        >
          <ArrowLeft style={{ width: 18, height: 18 }} />
        </Link>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Admin Governance Portal
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent-primary)',
                background: 'rgba(99, 102, 241, 0.1)',
                padding: '2px 8px',
                borderRadius: 9999,
                border: '1px solid rgba(99, 102, 241, 0.25)',
              }}
            >
              <ShieldCheck style={{ width: 11, height: 11 }} />
              ADMIN
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Active learners, enrolled playlists, and platform study engagement
          </p>
        </div>
      </div>

      {/* Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="btn-outline"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '0.5rem 1.1rem',
            fontSize: '0.8125rem',
            borderRadius: 'var(--border-radius-sm)',
            cursor: isRefreshing ? 'not-allowed' : 'pointer',
            opacity: isRefreshing ? 0.7 : 1,
          }}
          title="Refresh user metrics and active learner activity"
        >
          <RefreshCw
            style={{
              width: 14,
              height: 14,
              animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
            }}
          />
          <span>Refresh</span>
        </button>

        <button
          onClick={onExport}
          className="btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '0.5rem 1.1rem',
            fontSize: '0.8125rem',
            borderRadius: 'var(--border-radius-sm)',
            cursor: 'pointer',
          }}
          title="Export learner roster to CSV"
        >
          <Download style={{ width: 14, height: 14 }} />
          <span>Export CSV</span>
        </button>

        <ThemeToggle />
      </div>
    </header>
  );
}
