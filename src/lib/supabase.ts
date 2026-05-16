import { createClient } from '@supabase/supabase-js';

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Sanitize URL: remove trailing /rest/v1/ if user copied it from dashboard incorrectly
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Only create client if env vars are set (graceful degradation)
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const isSupabaseConfigured = () =>
  !!(supabaseUrl && supabaseAnonKey);
