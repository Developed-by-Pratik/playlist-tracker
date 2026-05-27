'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListVideo, Plus, Trash2, Pencil, ChevronDown } from 'lucide-react';
import { PlaylistRecord } from '@/lib/types';

interface PlaylistSwitcherProps {
  playlists: Record<string, PlaylistRecord>;
  activePlaylistId: string | null;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
  onAddPlaylist: () => void;
  onRename: (id: string, name: string) => void;
  isExpanded: boolean;
  onToggleExpanded: (expanded: boolean) => void;
}

export function PlaylistSwitcher({
  playlists,
  activePlaylistId,
  onSwitch,
  onDelete,
  onAddPlaylist,
  onRename,
  isExpanded,
  onToggleExpanded,
}: PlaylistSwitcherProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  
  const handleSave = (id: string) => {
    if (renameValue.trim()) {
      onRename(id, renameValue.trim());
    }
    setRenamingId(null);
  };

  const entries = Object.values(playlists).sort(
    (a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()
  );

  const getProgress = (pl: PlaylistRecord) => {
    const tasks = Object.values(pl.tasks);
    const total = pl.videoCount || tasks.length;
    if (total === 0) return 0;
    const done = tasks.filter(t => t.completedAt).length;
    return Math.min(100, Math.round((done / total) * 100));
  };

  const activePlaylist = activePlaylistId ? playlists[activePlaylistId] : null;

  return (
    <motion.div 
      layout
      className="card sidebar-card" 
      style={{ 
        padding: '1.125rem', 
        cursor: isExpanded ? 'default' : 'pointer',
        overflow: 'hidden'
      }}
      onClick={() => !isExpanded && onToggleExpanded(true)}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
          <ListVideo style={{ width: 16, height: 16, color: 'var(--accent-primary)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)' }}>
            Playlists
          </span>
          {!isExpanded && activePlaylist && (
            <span style={{ 
              fontSize: '0.75rem', 
              color: 'var(--text-muted)', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap',
              fontStyle: 'italic',
              marginLeft: '4px',
              flex: 1
            }}>
              — {activePlaylist.name}
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {!isExpanded && (
            <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 600 }}>
              {entries.length}
            </span>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleExpanded(!isExpanded); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', display: 'flex' }}
          >
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
              <ChevronDown style={{ width: 16, height: 16 }} />
            </motion.div>
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingTop: '1rem' }}>
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
                            onClick={() => renamingId !== pl.id && onSwitch(pl.id)}
                            style={{
                              padding: '0.5rem 0.625rem',
                              borderRadius: 10,
                              cursor: renamingId === pl.id ? 'default' : 'pointer',
                              border: `1px solid ${isActive ? 'var(--accent-primary)' : 'transparent'}`,
                              background: isActive ? 'var(--accent-light)' : 'transparent',
                              transition: 'all 0.2s ease',
                              display: 'flex', flexDirection: 'column', gap: '0.3rem',
                              position: 'relative',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                              {renamingId === pl.id ? (
                                <input
                                  type="text"
                                  value={renameValue}
                                  onChange={e => setRenameValue(e.target.value)}
                                  onBlur={() => handleSave(pl.id)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleSave(pl.id);
                                    if (e.key === 'Escape') setRenamingId(null);
                                  }}
                                  autoFocus
                                  onClick={e => e.stopPropagation()}
                                  style={{
                                    fontSize: '0.8125rem',
                                    fontWeight: isActive ? 600 : 500,
                                    color: 'var(--text-primary)',
                                    background: 'var(--bg-surface-2)',
                                    border: '1px solid var(--accent-primary)',
                                    borderRadius: 6,
                                    padding: '0.1rem 0.35rem',
                                    width: '100%',
                                    outline: 'none',
                                  }}
                                />
                              ) : (
                                <>
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
                                      className="pl-edit-btn"
                                      onClick={e => {
                                        e.stopPropagation();
                                        setRenamingId(pl.id);
                                        setRenameValue(pl.name);
                                      }}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-muted)', display: 'flex', opacity: 0, transition: 'opacity 0.15s' }}
                                    >
                                      <Pencil style={{ width: 12, height: 12 }} />
                                    </button>
                                    <button
                                      className="pl-delete-btn"
                                      onClick={e => { e.stopPropagation(); setConfirmDelete(pl.id); }}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-muted)', display: 'flex', opacity: 0, transition: 'opacity 0.15s' }}
                                    >
                                      <Trash2 style={{ width: 12, height: 12 }} />
                                    </button>
                                  </div>
                                </>
                              )}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .playlist-row:hover { background: var(--bg-hover) !important; }
        .playlist-row:hover .pl-delete-btn, .playlist-row:hover .pl-edit-btn { opacity: 0.6 !important; }
        .pl-delete-btn:hover { opacity: 1 !important; color: #f87171 !important; }
        .pl-edit-btn:hover { opacity: 1 !important; color: var(--accent-primary) !important; }
        .add-playlist-btn:hover { border-color: var(--accent-primary) !important; color: var(--accent-primary) !important; background: var(--accent-light) !important; }
      `}</style>
    </motion.div>
  );
}
