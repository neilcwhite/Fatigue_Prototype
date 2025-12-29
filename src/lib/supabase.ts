import { createClient } from '@supabase/supabase-js';

// ==================== ENVIRONMENT VARIABLES ====================
// These should be set in .env.local for local development
// and in Vercel environment variables for production

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

// ==================== SUPABASE CLIENT ====================
// This client is used for browser-side operations
// It uses the anon key which respects Row Level Security (RLS)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// ==================== TYPE EXPORTS ====================
// Re-export commonly used Supabase types

export type { User, Session, AuthError } from '@supabase/supabase-js';
