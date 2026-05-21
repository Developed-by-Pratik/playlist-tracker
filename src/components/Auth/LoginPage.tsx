'use client';

import { motion } from 'framer-motion';
import { ListTodo } from 'lucide-react';
import { signInWithGoogle } from '@/lib/auth';
import BackgroundPattern from '@/components/BackgroundPattern';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useState } from 'react';

export function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '2rem' }}>
      <BackgroundPattern />

      {/* Theme toggle top-right */}
      <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 10 }}>
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--bg-surface)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--border-color-strong)',
          borderRadius: 28,
          padding: '2.5rem',
          boxShadow: 'var(--shadow-lg), var(--shadow-glow)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.75rem',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          style={{
            width: 68, height: 68,
            background: 'var(--gradient-accent)',
            borderRadius: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 32px rgba(99, 102, 241, 0.4)',
          }}
        >
          <ListTodo style={{ width: 32, height: 32, color: '#ffffff' }} />
        </motion.div>

        {/* Headline */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem',
            background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent-primary) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            Playlist Tracker
          </h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            Track your learning, one playlist at a time.
          </p>
        </div>

        {/* Divider */}
        <div style={{ width: '100%', height: 1, background: 'var(--border-color)' }} />

        {/* Sign in button */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSignIn}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
              padding: '0.875rem 1.5rem',
              background: loading ? 'var(--bg-surface-2)' : 'var(--bg-surface-solid)',
              border: '1px solid var(--border-color-strong)',
              borderRadius: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: 'var(--shadow-sm)',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {/* Google logo SVG */}
            {loading ? (
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                border: '2px solid var(--border-color-strong)',
                borderTopColor: 'var(--accent-primary)',
                animation: 'spin 0.8s linear infinite',
              }} />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            <span style={{
              fontSize: '0.9375rem', fontWeight: 600,
              color: 'var(--text-primary)', fontFamily: 'var(--font-display)',
            }}>
              {loading ? 'Signing in…' : 'Continue with Google'}
            </span>
          </motion.button>

          <p style={{
            fontSize: '0.75rem', color: 'var(--text-muted)',
            textAlign: 'center', margin: 0, lineHeight: 1.5,
          }}>
            Your playlists and progress are securely synced across all your devices.
          </p>
        </div>
      </motion.div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
