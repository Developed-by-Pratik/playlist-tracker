'use client';

import { useState, useEffect } from 'react';
import { PartnerSnapshot, DuoPartnership } from '@/lib/types/collaboration';
import { Flame, UserPlus } from 'lucide-react';
import { formatLastActive } from '@/lib/collaboration/collaboration-service';
import { duoChatService } from '@/lib/collaboration/chat-service';

interface DuoSynergyBadgeProps {
  partnership: DuoPartnership | null;
  partnerSnapshot: PartnerSnapshot | null;
  onClick: () => void;
}

/**
 * DuoSynergyBadge — Header status badge showing partner presence, avatar, and duo streak
 */
export function DuoSynergyBadge({ partnership, partnerSnapshot, onClick }: DuoSynergyBadgeProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    duoChatService.setPartnership(partnership);
    const unsub = duoChatService.subscribeToUnreadCount(count => setUnreadCount(count));
    return () => {
      unsub();
    };
  }, [partnership]);

  if (!partnership) {
    return (
      <button
        onClick={onClick}
        title="Connect with a study partner"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '0.375rem 0.75rem',
          borderRadius: 99,
          background: 'rgba(99, 102, 241, 0.08)',
          color: 'var(--accent-primary)',
          border: '1px dashed var(--accent-primary)',
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <UserPlus style={{ width: 13, height: 13 }} />
        <span>Pair Buddy</span>
      </button>
    );
  }

  const isOnline = partnerSnapshot && !partnerSnapshot.isPrivate && formatLastActive(partnerSnapshot.lastActiveAt, false).includes('Online');
  const isPrivate = partnerSnapshot?.isPrivate ?? false;

  return (
    <button
      onClick={onClick}
      title={partnerSnapshot ? `${partnerSnapshot.displayName} (${formatLastActive(partnerSnapshot.lastActiveAt, isPrivate)})` : 'View Partner Progress'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '0.3rem 0.625rem',
        borderRadius: 99,
        background: 'var(--bg-surface-2)',
        border: '1px solid var(--border-color)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Partner Avatar with Presence Pulse */}
      <div style={{ position: 'relative', width: 22, height: 22 }}>
        {partnerSnapshot?.avatarUrl ? (
          <img
            src={partnerSnapshot.avatarUrl}
            alt={partnerSnapshot.displayName}
            style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--gradient-accent)',
              color: '#fff',
              fontSize: '0.625rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {partnerSnapshot?.displayName ? partnerSnapshot.displayName[0].toUpperCase() : 'B'}
          </div>
        )}

        {/* Live Presence Pulse Indicator */}
        <span
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: isPrivate ? '#a855f7' : isOnline ? '#34d399' : '#94a3b8',
            border: '1.5px solid var(--bg-surface-1)',
            boxShadow: isOnline ? '0 0 6px rgba(52, 211, 153, 0.8)' : 'none',
          }}
        />
      </div>

      {/* Partner Name Snippet */}
      <span style={{ fontSize: '0.75rem', fontWeight: 600, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {partnerSnapshot?.displayName || 'Partner'}
      </span>

      {/* Streak Badge */}
      {partnerSnapshot && partnerSnapshot.currentStreak > 0 && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            fontSize: '0.6875rem',
            color: '#f97316',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
          }}
        >
          <Flame style={{ width: 11, height: 11, fill: '#f97316' }} />
          {partnerSnapshot.currentStreak}d
        </span>
      )}
      {/* Unread Message Counter */}
      {unreadCount > 0 && (
        <span
          style={{
            padding: '1px 5px',
            fontSize: '0.625rem',
            fontWeight: 800,
            borderRadius: 99,
            background: '#ef4444',
            color: '#fff',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {unreadCount}
        </span>
      )}
    </button>
  );
}
