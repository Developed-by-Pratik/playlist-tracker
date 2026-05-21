'use client';

import { motion } from 'framer-motion';
import { ListVideo, Plus, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  onAddPlaylist: () => void;
}

export function EmptyState({ onAddPlaylist }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', padding: '2rem', textAlign: 'center',
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{
          maxWidth: 480,
          background: 'var(--bg-surface)',
          backdropFilter: 'blur(20px)',
          border: '1px dashed var(--border-color-strong)',
          borderRadius: 28,
          padding: '3rem 2.5rem',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* Icon */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 80, height: 80,
            background: 'var(--gradient-accent)',
            borderRadius: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(99, 102, 241, 0.3)',
          }}
        >
          <ListVideo style={{ width: 38, height: 38, color: '#ffffff' }} />
        </motion.div>

        {/* Text */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
            Add your first playlist
          </h2>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
            Paste any YouTube playlist URL to start tracking your progress, streaks, and growth.
          </p>
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
          {['📈 Growth Chart', '🔥 Streaks', '✅ Execution Checklist', '🎯 Milestones'].map(f => (
            <span key={f} style={{
              fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 500,
              color: 'var(--text-secondary)',
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-color)',
              padding: '0.25rem 0.75rem', borderRadius: 99,
            }}>
              {f}
            </span>
          ))}
        </div>

        {/* CTA */}
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={onAddPlaylist}
          className="btn-primary"
          style={{ padding: '0.875rem 2rem', fontSize: '1rem', borderRadius: 14, gap: '0.625rem' }}
        >
          <Plus style={{ width: 20, height: 20 }} />
          Add Playlist
        </motion.button>
      </motion.div>
    </div>
  );
}
