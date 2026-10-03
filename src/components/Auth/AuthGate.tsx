'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { LoginPage } from './LoginPage';
import { BlockedAccessScreen } from './BlockedAccessScreen';
import { userBlockService } from '@/lib/admin/user-block-service';

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null | undefined>(() => {
    if (!isSupabaseConfigured() || !supabase) {
      return null as unknown as Session; // Bypass auth for local dev
    }
    return undefined; // Loading
  });
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    userBlockService.init();

    if (!isSupabaseConfigured() || !supabase) {
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
      if (data.session) {
        cleanUrlHash();
        if (data.session.user) {
          setIsBlocked(userBlockService.isBlocked(data.session.user.id, data.session.user.email));
        }
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        cleanUrlHash();
        if (newSession.user) {
          setIsBlocked(userBlockService.isBlocked(newSession.user.id, newSession.user.email));
        }
      }
    });

    // Listen for real-time block state updates
    const unsubBlock = userBlockService.subscribe(() => {
      if (session?.user) {
        setIsBlocked(userBlockService.isBlocked(session.user.id, session.user.email));
      }
    });

    return () => {
      subscription.unsubscribe();
      unsubBlock();
    };
  }, [session]);

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

  // Suspended / Blocked User Gate
  if (session && isBlocked) {
    return <BlockedAccessScreen userEmail={session.user?.email} />;
  }

  // Not signed in (and Supabase is configured)
  if (!session && isSupabaseConfigured()) {
    return <LoginPage />;
  }

  // Signed in (or Supabase not configured — local dev)
  return <>{children}</>;
}
