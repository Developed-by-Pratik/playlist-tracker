'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { LoginPage } from './LoginPage';

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      // Supabase not configured — bypass auth for local dev
      setSession(null as any); // treat as "no session but allow through"
      return;
    }

    const cleanUrlHash = () => {
      if (typeof window !== 'undefined') {
        const { href, pathname, search } = window.location;
        if (href.includes('#')) {
          window.history.replaceState(null, '', pathname + search);
        }
      }
    };

    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) cleanUrlHash();
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) cleanUrlHash();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Loading state
  if (session === undefined) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-base)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '3px solid var(--border-color)',
          borderTopColor: 'var(--accent-primary)',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Not signed in (and Supabase is configured)
  if (!session && isSupabaseConfigured()) {
    return <LoginPage />;
  }

  // Signed in (or Supabase not configured — local dev)
  return <>{children}</>;
}
