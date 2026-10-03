/**
 * auth.ts — Supabase Auth helpers
 */
import { supabase } from './supabase';

export const signInWithGoogle = () => {
  if (!supabase) return Promise.reject(new Error('Supabase not configured'));
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });
};

export const signOut = () => {
  if (!supabase) return Promise.reject(new Error('Supabase not configured'));
  return supabase.auth.signOut();
};

export const getSession = () => {
  if (!supabase) return Promise.resolve({ data: { session: null }, error: null });
  return supabase.auth.getSession();
};

export const getUser = async () => {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
};

export const onAuthStateChange = (
  callback: (event: import('@supabase/supabase-js').AuthChangeEvent, session: import('@supabase/supabase-js').Session | null) => void
) => {
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
  return supabase.auth.onAuthStateChange(callback);
};

/** Whitelisted Administrator Emails */
export const ADMIN_EMAILS = [
  'pratikkakade.in@gmail.com',
  'pratikkakade4618@gmail.com',
] as const;

/** Check if given email has administrator privileges */
export const isUserAdmin = (email?: string | null): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim() as (typeof ADMIN_EMAILS)[number]);
};

