'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, MessageSquare, Sparkles } from 'lucide-react';
import { DuoMessage, DuoPartnership, PartnerSnapshot } from '@/lib/types/collaboration';
import { duoChatService } from '@/lib/collaboration/chat-service';
import { getMyDuoCode } from '@/lib/collaboration/collaboration-service';

interface DuoChatWindowProps {
  partnership: DuoPartnership | null;
  partnerSnapshot: PartnerSnapshot | null;
  myDisplayName: string;
}

const QUICK_CHIPS = [
  "🔥 Let's lock in!",
  '🚀 1 more video!',
  '☕ 5m break',
  '🎉 Great job!',
  '📚 Question about this step',
];

export function DuoChatWindow({
  partnership,
  partnerSnapshot,
  myDisplayName,
}: DuoChatWindowProps) {
  const [messages, setMessages] = useState<DuoMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const myUid = getMyDuoCode();

  useEffect(() => {
    duoChatService.setPartnership(partnership);
    const unsubscribe = duoChatService.subscribeToMessages(msgs => {
      setMessages(msgs);
    });

    // Mark messages as read when opening window
    duoChatService.markAllAsRead();

    return () => {
      unsubscribe();
    };
  }, [partnership]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputVal).trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInputVal('');
    await duoChatService.sendMessage(text, myDisplayName || 'Me');
    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
      {/* Chat Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
              borderRadius: '50%',
              background: 'var(--gradient-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 700,
            }}
          >
            {partnerSnapshot?.displayName?.charAt(0) || 'P'}
          </div>
          <div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {partnerSnapshot?.displayName || 'Study Partner'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: partnerSnapshot?.isPrivate ? '#a855f7' : '#22c55e',
                }}
              />
              <span>{partnerSnapshot?.isPrivate ? 'Private Mode' : 'Connected via 1-on-1 Duo'}</span>
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: '0.6875rem',
            fontFamily: 'var(--font-mono)',
            padding: '3px 8px',
            borderRadius: 99,
            background: 'var(--bg-surface-1)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Sparkles style={{ width: 10, height: 10, color: 'var(--accent-primary)' }} />
          <span>Real-Time Sync</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.875rem',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              margin: 'auto',
              textAlign: 'center',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <MessageSquare style={{ width: 32, height: 32, opacity: 0.3 }} />
            <p style={{ fontSize: '0.875rem' }}>No messages yet. Say hello and start coordinating!</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.senderId === myUid || msg.senderName === myDisplayName;
            const timeStr = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '78%',
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                    marginBottom: 3,
                    padding: '0 4px',
                  }}
                >
                  {isMe ? 'You' : msg.senderName} • {timeStr}
                </div>
                <div
                  style={{
                    padding: '0.6875rem 1rem',
                    borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: isMe ? 'var(--gradient-accent)' : 'var(--bg-surface-2)',
                    color: isMe ? '#fff' : 'var(--text-primary)',
                    border: isMe ? 'none' : '1px solid var(--border-color)',
                    fontSize: '0.875rem',
                    lineHeight: 1.45,
                    wordBreak: 'break-word',
                    boxShadow: isMe ? '0 4px 12px rgba(99, 102, 241, 0.25)' : 'var(--shadow-sm)',
                  }}
                >
                  {msg.message}
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reaction Chips */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '0.5rem 1rem',
          background: 'var(--bg-surface-2)',
          borderTop: '1px solid var(--border-color)',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        {QUICK_CHIPS.map(chip => (
          <button
            key={chip}
            onClick={() => handleSend(chip)}
            style={{
              padding: '3px 10px',
              fontSize: '0.6875rem',
              borderRadius: 99,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-surface-1)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Chat Input Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0.875rem 1.25rem',
          background: 'var(--bg-surface-2)',
        }}
      >
        <input
          type="text"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message to your study buddy..."
          style={{
            flex: 1,
            padding: '0.625rem 1rem',
            borderRadius: 'var(--border-radius-sm)',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-surface-1)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
            outline: 'none',
          }}
        />
        <button
          onClick={() => handleSend()}
          disabled={!inputVal.trim() || isSending}
          style={{
            padding: '0.625rem 1.125rem',
            borderRadius: 'var(--border-radius-sm)',
            border: 'none',
            background: inputVal.trim() ? 'var(--gradient-accent)' : 'var(--bg-surface-1)',
            color: inputVal.trim() ? '#fff' : 'var(--text-muted)',
            cursor: inputVal.trim() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.8125rem',
            fontWeight: 600,
            transition: 'all 0.2s ease',
            boxShadow: inputVal.trim() ? '0 4px 12px rgba(99, 102, 241, 0.25)' : 'none',
          }}
        >
          <Send style={{ width: 14, height: 14 }} />
          <span>Send</span>
        </button>
      </div>
    </div>
  );
}
