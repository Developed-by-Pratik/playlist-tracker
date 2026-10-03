'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { User, Users, Check, X, Shield, Zap } from 'lucide-react';
import { logger } from '@/lib/observability/logger';

interface CollaborationToggleModalProps {
  isOpen: boolean;
  onClose: () => void;
  collaborationEnabled: boolean;
  onToggleCollaboration: (enabled: boolean) => void;
}

/**
 * CollaborationToggleModal — Settings modal to switch between Solo Mode and Duo Collaboration Mode
 */
export function CollaborationToggleModal({
  isOpen,
  onClose,
  collaborationEnabled,
  onToggleCollaboration,
}: CollaborationToggleModalProps) {
  if (!isOpen) return null;

  const handleSelect = (enabled: boolean) => {
    logger.info('collaboration', `Switched mode to: ${enabled ? 'Duo Collaboration Mode' : 'Solo Mode'}`);
    onToggleCollaboration(enabled);
  };

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={e => e.stopPropagation()}
          className="card"
          style={{
            maxWidth: 520,
            width: '100%',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            background: 'var(--bg-surface-1)',
            border: '1px solid var(--border-color-strong)',
            boxShadow: 'var(--shadow-lg)',
            borderRadius: 'var(--border-radius-md)',
            position: 'relative',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'var(--gradient-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                }}
              >
                <Zap style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Workspace Mode
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                  Choose your preferred study experience
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 6,
              }}
            >
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>

          {/* Mode Selector Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Solo Mode Option */}
            <div
              onClick={() => handleSelect(false)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '1rem',
                borderRadius: 'var(--border-radius-sm)',
                border: !collaborationEnabled
                  ? '2px solid var(--accent-primary)'
                  : '1px solid var(--border-color)',
                background: !collaborationEnabled
                  ? 'rgba(99, 102, 241, 0.06)'
                  : 'var(--bg-surface-2)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: !collaborationEnabled ? 'var(--accent-primary)' : 'var(--bg-surface-solid)',
                  color: !collaborationEnabled ? '#fff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <User style={{ width: 16, height: 16 }} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Solo Mode (Default)
                  </span>
                  {!collaborationEnabled && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        color: 'var(--accent-primary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <Check style={{ width: 12, height: 12 }} /> ACTIVE
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                  Distraction-free solo playlist tracking, habits, and bookmarks. Zero network background channels.
                </p>
              </div>
            </div>

            {/* Duo Collaboration Mode Option */}
            <div
              onClick={() => handleSelect(true)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '1rem',
                borderRadius: 'var(--border-radius-sm)',
                border: collaborationEnabled
                  ? '2px solid var(--accent-primary)'
                  : '1px solid var(--border-color)',
                background: collaborationEnabled
                  ? 'rgba(99, 102, 241, 0.06)'
                  : 'var(--bg-surface-2)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: collaborationEnabled ? 'var(--gradient-accent)' : 'var(--bg-surface-solid)',
                  color: collaborationEnabled ? '#fff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Users style={{ width: 16, height: 16 }} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Duo Collaboration Mode
                    </span>
                    <span
                      style={{
                        fontSize: '0.625rem',
                        fontFamily: 'var(--font-mono)',
                        padding: '1px 6px',
                        borderRadius: 99,
                        background: 'rgba(52, 211, 153, 0.15)',
                        color: 'var(--accent-success)',
                        fontWeight: 700,
                      }}
                    >
                      CO-OP
                    </span>
                  </div>
                  {collaborationEnabled && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        color: 'var(--accent-primary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <Check style={{ width: 12, height: 12 }} /> ACTIVE
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                  Connect with a study partner. View live read-only progress, share daily scratchpads, voice lounge, and synergy streaks.
                </p>
              </div>
            </div>
          </div>

          {/* Notice & Close */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              <Shield style={{ width: 12, height: 12, color: 'var(--accent-primary)' }} />
              <span>You can switch between Solo and Duo mode anytime.</span>
            </div>

            <button
              onClick={onClose}
              className="btn-primary"
              style={{ padding: '0.4rem 1.25rem', fontSize: '0.75rem' }}
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
