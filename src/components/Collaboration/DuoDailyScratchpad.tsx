'use client';

import { useState, useEffect } from 'react';
import { FileText, Copy, Check, Trash2, Clock, Sparkles } from 'lucide-react';
import { SharedDailyNote, DuoPartnership } from '@/lib/types/collaboration';
import { duoScratchpadService, getTodayDateKey } from '@/lib/collaboration/scratchpad-service';

interface DuoDailyScratchpadProps {
  partnership: DuoPartnership | null;
  myDisplayName: string;
}

export function DuoDailyScratchpad({
  partnership,
  myDisplayName,
}: DuoDailyScratchpadProps) {
  const [note, setNote] = useState<SharedDailyNote>({
    partnershipId: '',
    noteDate: getTodayDateKey(),
    content: '',
    updatedAt: new Date().toISOString(),
  });
  const [copied, setCopied] = useState(false);
  const [isSavedPill, setIsSavedPill] = useState(false);

  useEffect(() => {
    duoScratchpadService.setPartnership(partnership);
    const unsubscribe = duoScratchpadService.subscribe(updatedNote => {
      setNote(updatedNote);
    });

    return () => {
      unsubscribe();
    };
  }, [partnership]);

  const handleChange = (val: string) => {
    setNote(prev => ({ ...prev, content: val }));
    duoScratchpadService.updateNoteContent(val, myDisplayName || 'Me');
    setIsSavedPill(true);
    setTimeout(() => setIsSavedPill(false), 1200);
  };

  const handleCopy = () => {
    if (!note.content) return;
    navigator.clipboard.writeText(note.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    if (window.confirm('Clear today\'s scratchpad for both you and your study partner?')) {
      handleChange('');
    }
  };

  const lineCount = note.content ? note.content.split('\n').length : 0;
  const charCount = note.content.length;

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '520px',
        padding: 0,
        overflow: 'hidden',
        background: 'var(--bg-surface-1)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--border-radius-md)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Scratchpad Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '1rem 1.25rem',
          background: 'var(--bg-surface-2)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 'var(--border-radius-sm)',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
            }}
          >
            <FileText style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Real-Time Daily Scratchpad
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontFamily: 'var(--font-mono)',
                  color: isSavedPill ? 'var(--accent-success)' : 'var(--text-muted)',
                  transition: 'color 0.2s ease',
                }}
              >
                {isSavedPill ? '● Saved' : '● Synced'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              <Clock style={{ width: 11, height: 11 }} />
              <span>Auto-resets at midnight (12:00 AM) • {note.noteDate}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleCopy}
            disabled={!note.content}
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: 'var(--border-radius-sm)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-surface-1)',
              color: copied ? 'var(--accent-success)' : 'var(--text-secondary)',
              cursor: note.content ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.2s ease',
            }}
          >
            {copied ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
            <span>{copied ? 'Copied' : 'Copy All'}</span>
          </button>

          <button
            onClick={handleClear}
            disabled={!note.content}
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: 'var(--border-radius-sm)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-surface-1)',
              color: 'var(--accent-danger, #ef4444)',
              cursor: note.content ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.2s ease',
            }}
          >
            <Trash2 style={{ width: 13, height: 13 }} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <textarea
          value={note.content}
          onChange={e => handleChange(e.target.value)}
          placeholder="Shared workspace for today: paste code snippets, study topics, questions, bugs, or your daily sprint targets here..."
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            padding: '1.25rem',
            background: 'transparent',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            fontFamily: 'var(--font-mono, monospace)',
            border: 'none',
            outline: 'none',
            resize: 'none',
          }}
        />
      </div>

      {/* Footer Meta bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.625rem 1.25rem',
          background: 'var(--bg-surface-2)',
          borderTop: '1px solid var(--border-color)',
          fontSize: '0.6875rem',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{lineCount} lines</span>
          <span>•</span>
          <span>{charCount} characters</span>
          {note.lastEditedBy && (
            <>
              <span>•</span>
              <span>Last edit by {note.lastEditedBy}</span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-primary)' }}>
          <Sparkles style={{ width: 11, height: 11 }} />
          <span>Realtime Shared Pad</span>
        </div>
      </div>
    </div>
  );
}
