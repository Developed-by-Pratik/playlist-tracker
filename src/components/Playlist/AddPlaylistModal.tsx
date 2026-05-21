'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle2, AlertCircle, ListVideo, Plus } from 'lucide-react';
import { Video } from '@/lib/types';

interface AddPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, playlistId: string, videoCount: number) => void;
}

function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  // Bare playlist ID
  if (/^PL[A-Za-z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  // URL with list= param
  try {
    const url = new URL(trimmed);
    const id = url.searchParams.get('list');
    if (id && id.startsWith('PL')) return id;
  } catch {}
  return null;
}

export function AddPlaylistModal({ isOpen, onClose, onAdd }: AddPlaylistModalProps) {
  const [input, setInput] = useState('');
  const [name, setName] = useState('');
  const [preview, setPreview] = useState<{ video: Video; total: number } | null>(null);
  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setInput(''); setName(''); setPreview(null);
      setFetchState('idle'); setErrorMsg('');
    }
  }, [isOpen]);

  // Debounced preview fetch when input changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const playlistId = extractPlaylistId(input);
    if (!playlistId) {
      setPreview(null);
      setFetchState(input.trim() ? 'error' : 'idle');
      setErrorMsg(input.trim() ? 'Could not find a valid playlist ID in this URL.' : '');
      return;
    }

    setFetchState('loading');
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/youtube?playlistId=${playlistId}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to fetch playlist');
        }
        const data = await res.json();
        const videos: Video[] = data.videos || [];
        const playlistTitle: string = data.title || '';
        if (videos.length === 0) throw new Error('Playlist is empty or private.');
        setPreview({ video: videos[0], total: videos.length });
        if (!name) setName(playlistTitle || `Playlist (${videos.length} videos)`);
        setFetchState('success');
        setErrorMsg('');
      } catch (e: any) {
        setFetchState('error');
        setErrorMsg(e.message || 'Failed to fetch playlist.');
        setPreview(null);
      }
    }, 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const handleAdd = async () => {
    const playlistId = extractPlaylistId(input);
    if (!playlistId || fetchState !== 'success' || !preview) return;
    setAdding(true);
    onAdd(name.trim() || 'My Playlist', playlistId, preview.total);
    setAdding(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <motion.div
          key="modal-content"
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 480,
            background: 'var(--bg-surface-solid)',
            border: '1px solid var(--border-color-strong)',
            borderRadius: 24,
            padding: '2rem',
            boxShadow: 'var(--shadow-lg), var(--shadow-glow)',
            display: 'flex', flexDirection: 'column', gap: '1.25rem',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'var(--accent-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ListVideo style={{ width: 18, height: 18, color: 'var(--accent-primary)' }} />
              </div>
              <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, margin: 0 }}>Add Playlist</h2>
            </div>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 6, borderRadius: 8,
              display: 'flex', transition: 'color 0.2s',
            }}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>

          {/* URL Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              YouTube Playlist URL or ID
            </label>
            <div style={{ position: 'relative' }}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="https://youtube.com/playlist?list=PL... or PL..."
                style={{ paddingRight: '2.5rem', fontSize: '0.875rem' }}
              />
              <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}>
                {fetchState === 'loading' && <Loader2 style={{ width: 16, height: 16, color: 'var(--accent-primary)', animation: 'spin 0.8s linear infinite' }} />}
                {fetchState === 'success' && <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--accent-success)' }} />}
                {fetchState === 'error' && input.trim() && <AlertCircle style={{ width: 16, height: 16, color: '#f87171' }} />}
              </div>
            </div>
            {fetchState === 'error' && errorMsg && (
              <p style={{ fontSize: '0.75rem', color: '#f87171', margin: 0 }}>{errorMsg}</p>
            )}
          </div>

          {/* Preview */}
          <AnimatePresence>
            {preview && fetchState === 'success' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  overflow: 'hidden',
                  background: 'var(--bg-surface-2)',
                  borderRadius: 12, border: '1px solid var(--border-color)',
                  display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.75rem',
                }}
              >
                <img
                  src={preview.video.thumbnailUrl}
                  alt="Preview"
                  style={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {preview.video.title}
                  </p>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: '2px 0 0', fontFamily: 'var(--font-mono)' }}>
                    {preview.total} videos found
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Name field — only shown after successful preview */}
          <AnimatePresence>
            {fetchState === 'success' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}
              >
                <label style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Playlist Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. DSA Course, System Design..."
                  style={{ fontSize: '0.875rem' }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={onClose} className="btn-outline" style={{ flex: 1 }}>Cancel</button>
            <button
              onClick={handleAdd}
              className="btn-primary"
              disabled={fetchState !== 'success' || adding}
              style={{ flex: 2, opacity: fetchState !== 'success' ? 0.5 : 1, cursor: fetchState !== 'success' ? 'not-allowed' : 'pointer' }}
            >
              {adding ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 0.8s linear infinite' }} /> : <Plus style={{ width: 16, height: 16 }} />}
              {adding ? 'Adding…' : 'Add Playlist'}
            </button>
          </div>
        </motion.div>
      </motion.div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AnimatePresence>
  );
}
