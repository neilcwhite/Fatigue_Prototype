'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient, User, Session, SupabaseClient } from '@supabase/supabase-js';

// ==================== TYPES ====================
interface UserProfile {
  id: string;
  organisation_id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'manager' | 'viewer';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  supabase: SupabaseClient | null;
}

// ==================== SUPABASE INIT ====================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isConfigured = !!(supabaseUrl && supabaseAnonKey);

let supabase: SupabaseClient | null = null;

if (isConfigured) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

// ==================== CONTEXT ====================
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  supabase: null,
});

export const useAuth = () => useContext(AuthContext);

// ==================== PROVIDER ====================
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    if (!supabase) return;
    
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Profile fetch error:', error);
        
        // If no profile exists, create one
        if (error.code === 'PGRST116') {
          await createDefaultProfile(userId);
          return;
        }
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultProfile = async (userId: string) => {
    if (!supabase || !user) return;
    
    try {
      // First create a default organisation
      const orgId = crypto.randomUUID();
      
      const { error: orgError } = await supabase
        .from('organisations')
        .insert({
          id: orgId,
          name: 'My Organisation',
        });

      if (orgError && orgError.code !== '23505') { // Ignore duplicate key
        console.error('Org creation error:', orgError);
      }

      // Then create the profile
      const { data, error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          organisation_id: orgId,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || null,
          role: 'admin',
        })
        .select()
        .single();

      if (profileError) {
        console.error('Profile creation error:', profileError);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Failed to create default profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, supabase }}>
      {children}
    </AuthContext.Provider>
  );
}

// ==================== EXPORTS ====================
export { supabase };
