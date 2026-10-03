'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code2,
  Bookmark,
  ExternalLink,
  Copy,
  Check,
  Plus,
  Trash2,
  Search,
  X,
  Link as LinkIcon,
} from 'lucide-react';
import { StudyResource } from '@/lib/types';

interface ResourcesHubProps {
  resources: StudyResource[];
  onAddResource: (resource: Omit<StudyResource, 'id' | 'createdAt'>) => void;
  onDeleteResource: (id: string) => void;
}

export function ResourcesHub({ resources, onAddResource, onDeleteResource }: ResourcesHubProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');

  const filteredResources = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return resources;
    return resources.filter(res => {
      return (
        res.title.toLowerCase().includes(q) ||
        res.url.toLowerCase().includes(q) ||
        (res.notes && res.notes.toLowerCase().includes(q))
      );
    });
  }, [resources, searchQuery]);

  const handleCopyLink = useCallback((id: string, linkUrl: string) => {
    navigator.clipboard.writeText(linkUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;

    const trimmedUrl = url.trim();
    const isGithub = trimmedUrl.includes('github.com');

    onAddResource({
      title: title.trim(),
      url: trimmedUrl,
      category: isGithub ? 'github' : 'general',
      notes: notes.trim() || undefined,
    });

    setTitle('');
    setUrl('');
    setNotes('');
    setIsAdding(false);
  };

  const formatDomain = (rawUrl: string) => {
    try {
      const u = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
      return new URL(u).hostname.replace('www.', '');
    } catch {
      return rawUrl;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* Top Banner & Action */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          padding: '1.5rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Study Resources & Links
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  padding: '2px 8px',
                  borderRadius: 99,
                  background: 'var(--bg-surface-2)',
                  color: 'var(--accent-primary)',
                  border: '1px solid var(--border-color)',
                  fontWeight: 600,
                }}
              >
                {resources.length} Saved
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
              Store GitHub repos, documentation pages, cheatsheets, and project links for easy reference.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Search Bar */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                width: 220,
              }}
            >
              <Search
                style={{
                  position: 'absolute',
                  left: 10,
                  width: 14,
                  height: 14,
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Search resources..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.75rem 0.4rem 30px',
                  fontSize: '0.75rem',
                  borderRadius: 99,
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 2,
                  }}
                >
                  <X style={{ width: 12, height: 12 }} />
                </button>
              )}
            </div>

            <button
              onClick={() => setIsAdding(prev => !prev)}
              className="btn-primary"
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.8125rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isAdding ? <X style={{ width: 14, height: 14 }} /> : <Plus style={{ width: 14, height: 14 }} />}
              <span>{isAdding ? 'Close' : 'Add Link'}</span>
            </button>
          </div>
        </div>

        {/* Add Resource Inline Form */}
        <AnimatePresence>
          {isAdding && (
            <motion.form
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.875rem',
                padding: '1.25rem',
                borderRadius: 'var(--border-radius-sm)',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border-color-strong)',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Next.js App Router Docs or Repo"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    style={{ fontSize: '0.8125rem', padding: '0.5rem 0.75rem' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    URL / Web Link *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="https://github.com/... or nextjs.org"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    style={{ fontSize: '0.8125rem', padding: '0.5rem 0.75rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Notes / Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Short note or key takeaway..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{ fontSize: '0.8125rem', padding: '0.5rem 0.75rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="btn-outline"
                  style={{ padding: '0.4rem 0.875rem', fontSize: '0.75rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '0.4rem 1.25rem', fontSize: '0.75rem' }}
                >
                  Save Link
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* Resources Grid / List */}
      {filteredResources.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--bg-surface-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-color)',
            }}
          >
            <LinkIcon style={{ width: 22, height: 22, color: 'var(--text-muted)' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              {searchQuery ? 'No matching links found' : 'No saved links yet'}
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0, maxWidth: 360 }}>
              {searchQuery
                ? 'Try a different search keyword.'
                : 'Bookmark GitHub repositories, documentation pages, cheatsheets, or practice problems to reference anytime.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={() => setIsAdding(true)}
              className="btn-primary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.75rem', marginTop: 6 }}
            >
              <Plus style={{ width: 13, height: 13 }} />
              <span>Add Your First Link</span>
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '0.875rem',
          }}
        >
          {filteredResources.map(res => {
            const isGithub = res.url.includes('github.com');
            const Icon = isGithub ? Code2 : Bookmark;
            const iconColor = isGithub ? '#38bdf8' : 'var(--accent-primary)';
            const domain = formatDomain(res.url);
            const isCopied = copiedId === res.id;

            return (
              <motion.div
                key={res.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '1.125rem',
                  gap: '0.75rem',
                  position: 'relative',
                  border: '1px solid var(--border-color)',
                  transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
                }}
              >
                {/* Header row: Icon, Domain Badge, Delete */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'var(--bg-surface-2)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: iconColor,
                        flexShrink: 0,
                      }}
                    >
                      <Icon style={{ width: 14, height: 14 }} />
                    </div>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {domain}
                    </span>
                  </div>

                  <button
                    onClick={() => onDeleteResource(res.id)}
                    title="Delete Link"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 4,
                      borderRadius: 4,
                      opacity: 0.6,
                      transition: 'opacity 0.2s, color 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.color = '#f87171';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.opacity = '0.6';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>

                {/* Content: Title & Notes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '0.9375rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      wordBreak: 'break-word',
                    }}
                    className="hover-underline"
                  >
                    <span>{res.title}</span>
                    <ExternalLink style={{ width: 13, height: 13, opacity: 0.6, flexShrink: 0 }} />
                  </a>

                  {res.notes && (
                    <p
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        margin: '4px 0 0 0',
                        background: 'var(--bg-surface-2)',
                        padding: '6px 10px',
                        borderRadius: 'var(--border-radius-xs)',
                        border: '1px solid var(--border-color)',
                        lineHeight: 1.4,
                      }}
                    >
                      {res.notes}
                    </p>
                  )}
                </div>

                {/* Footer Actions: Copy Link & Open in Tab */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border-color)',
                    marginTop: '2px',
                  }}
                >
                  <button
                    onClick={() => handleCopyLink(res.id, res.url)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'none',
                      border: 'none',
                      color: isCopied ? 'var(--accent-success)' : 'var(--text-muted)',
                      fontSize: '0.6875rem',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'color 0.2s',
                    }}
                  >
                    {isCopied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
                    <span>{isCopied ? 'Copied Link!' : 'Copy Link'}</span>
                  </button>

                  <a
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline"
                    style={{
                      padding: '0.25rem 0.625rem',
                      fontSize: '0.6875rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      textDecoration: 'none',
                    }}
                  >
                    <span>Open</span>
                    <ExternalLink style={{ width: 11, height: 11 }} />
                  </a>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
