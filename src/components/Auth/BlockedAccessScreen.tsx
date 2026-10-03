'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Mail, Copy, Check, LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth';
import BackgroundPattern from '@/components/BackgroundPattern';
import { ThemeToggle } from '@/components/ThemeToggle';

interface BlockedAccessScreenProps {
  userEmail?: string | null;
}

export function BlockedAccessScreen({ userEmail }: BlockedAccessScreenProps) {
  const [copied, setCopied] = useState(false);
  const adminEmail = 'pratikkakade.in@gmail.com';

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(adminEmail).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleSignOut = () => {
    signOut().then(() => {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        padding: '2rem',
        background: 'var(--bg-base)',
      }}
    >
      <BackgroundPattern />

      {/* Theme toggle top-right */}
      <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 10 }}>
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="card"
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--bg-surface)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: 'var(--border-radius)',
          padding: '2.5rem 2rem',
          boxShadow: '0 20px 50px rgba(239, 68, 68, 0.1), var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '1.5rem',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Warning Icon with Red Halo */}
        <motion.div
          initial={{ scale: 0.6, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.15, duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '2px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
            boxShadow: '0 0 24px rgba(239, 68, 68, 0.25)',
          }}
        >
          <ShieldAlert style={{ width: 36, height: 36 }} />
        </motion.div>

        {/* Headline & Notice */}
        <div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
            }}
          >
            You Don&apos;t Have Access
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Your account has been suspended by the platform administrator. You will not be able to log in or access your playlists.
          </p>
          {userEmail && (
            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                marginTop: '0.5rem',
              }}
            >
              Account: {userEmail}
            </p>
          )}
        </div>

        {/* Contact Administrator Box */}
        <div
          style={{
            width: '100%',
            padding: '1.25rem',
            borderRadius: 'var(--border-radius-sm)',
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Contact admin for getting access:
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '0.6rem 0.85rem',
              borderRadius: 'var(--border-radius-xs)',
              background: 'var(--bg-surface-1)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
              <Mail style={{ width: 15, height: 15, color: 'var(--accent-primary)', flexShrink: 0 }} />
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {adminEmail}
              </span>
            </div>

            <button
              onClick={handleCopyEmail}
              style={{
                background: 'transparent',
                border: 'none',
                color: copied ? '#10b981' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.75rem',
                fontWeight: 600,
                flexShrink: 0,
                padding: '2px 6px',
                borderRadius: 4,
              }}
              title="Copy Email to Clipboard"
            >
              {copied ? (
                <>
                  <Check style={{ width: 14, height: 14 }} />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy style={{ width: 14, height: 14 }} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <a
            href={`mailto:${adminEmail}?subject=Access%20Request%20-%20Playlist%20Tracker&body=Hello%20Admin,%0A%0AI%20would%20like%20to%20request%20access%20to%20the%20Playlist%20Tracker%20app.%0A%0AAccount%20Email:%20${userEmail || ''}`}
            className="btn-primary"
            style={{
              width: '100%',
              justifyContent: 'center',
              textDecoration: 'none',
              padding: '0.65rem 1rem',
              fontSize: '0.8125rem',
              borderRadius: 'var(--border-radius-sm)',
            }}
          >
            <Mail style={{ width: 15, height: 15 }} />
            <span>Email Administrator</span>
          </a>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          className="btn-outline"
          style={{
            width: '100%',
            padding: '0.6rem 1rem',
            fontSize: '0.8125rem',
            borderRadius: 'var(--border-radius-sm)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <LogOut style={{ width: 14, height: 14 }} />
          <span>Sign Out / Switch Account</span>
        </button>
      </motion.div>
    </div>
  );
}
