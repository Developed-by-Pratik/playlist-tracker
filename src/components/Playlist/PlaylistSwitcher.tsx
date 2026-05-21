'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListVideo, Plus, Trash2, ChevronRight } from 'lucide-react';
import { PlaylistRecord } from '@/lib/types';

interface PlaylistSwitcherProps {
  playlists: Record<string, PlaylistRecord>;
  activePlaylistId: string | null;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
  onAddPlaylist: () => void;
}

export function PlaylistSwitcher({
  playlists,
  activePlaylistId,
  onSwitch,
  onDelete,
  onAddPlaylist,
}: PlaylistSwitcherProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const entries = Object.values(playlists).sort(
    (a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()
  );

  const getProgress = (pl: PlaylistRecord) => {
    const tasks = Object.values(pl.tasks);
    if (tasks.length === 0) return 0;
    const done = tasks.filter(t => t.completedAt).length;
    return Math.round((done / tasks.length) * 100);
  };

  return (
    <div className="card sidebar-card" style={{ padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <ListVideo style={{ width: 14, height: 14, color: 'var(--accent-primary)' }} />
          <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>
            Playlists
          </span>
        </div>
        <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          {entries.length}
        </span>
      </div>

      {/* Playlist list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <AnimatePresence initial={false}>
          {entries.map(pl => {
            const isActive = pl.id === activePlaylistId;
            const progress = getProgress(pl);
            const isConfirming = confirmDelete === pl.id;

            return (
              <motion.div
                key={pl.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                {isConfirming ? (
                  // Confirm delete state
                  <div style={{
                    padding: '0.5rem 0.625rem',
                    borderRadius: 10,
                    background: 'rgba(248, 113, 113, 0.08)',
                    border: '1px solid rgba(248, 113, 113, 0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
                  }}>
                    <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 500 }}>Delete?</span>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <button
                        onClick={() => { onDelete(pl.id); setConfirmDelete(null); }}
                        style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#f87171', background: 'rgba(248,113,113,0.15)', border: 'none', borderRadius: 6, padding: '0.2rem 0.5rem', cursor: 'pointer' }}
                      >Yes</button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-surface-2)', border: 'none', borderRadius: 6, padding: '0.2rem 0.5rem', cursor: 'pointer' }}
                      >No</button>
                    </div>
                  </div>
                ) : (
                  // Normal playlist row
                  <div
                    className="playlist-row"
                    onClick={() => onSwitch(pl.id)}
                    style={{
                      padding: '0.5rem 0.625rem',
                      borderRadius: 10,
                      cursor: 'pointer',
                      border: `1px solid ${isActive ? 'var(--accent-primary)' : 'transparent'}`,
                      background: isActive ? 'var(--accent-light)' : 'transparent',
                      transition: 'all 0.2s ease',
                      display: 'flex', flexDirection: 'column', gap: '0.3rem',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{
                        fontSize: '0.8125rem', fontWeight: isActive ? 600 : 500,
                        color: isActive ? 'var(--accent-hover)' : 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        flex: 1, minWidth: 0,
                      }}>
                        {pl.name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                          {progress}%
                        </span>
                        <button
                          className="pl-delete-btn"
                          onClick={e => { e.stopPropagation(); setConfirmDelete(pl.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-muted)', display: 'flex', opacity: 0, transition: 'opacity 0.15s' }}
                        >
                          <Trash2 style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: 3, borderRadius: 99, background: 'var(--border-color)', overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        style={{ height: '100%', borderRadius: 99, background: isActive ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Add playlist button */}
      <button
        onClick={onAddPlaylist}
        style={{
          marginTop: '0.625rem',
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
          padding: '0.5rem',
          background: 'none',
          border: '1px dashed var(--border-color-strong)',
          borderRadius: 10,
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: '0.75rem', fontWeight: 500,
          transition: 'all 0.2s ease',
        }}
        className="add-playlist-btn"
      >
        <Plus style={{ width: 13, height: 13 }} />
        Add Playlist
      </button>

      <style>{`
        .playlist-row:hover { background: var(--bg-hover) !important; }
        .playlist-row:hover .pl-delete-btn { opacity: 0.6 !important; }
        .pl-delete-btn:hover { opacity: 1 !important; color: #f87171 !important; }
        .add-playlist-btn:hover { border-color: var(--accent-primary) !important; color: var(--accent-primary) !important; background: var(--accent-light) !important; }
      `}</style>
    </div>
  );
}
