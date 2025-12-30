'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  role: string;
  organisationId: string;
  organisationName?: string;
}

interface UseAuthReturn {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (userId: string, userEmail: string): Promise<void> => {
    if (!supabase) return;

    console.log('loadProfile: starting for user:', userId);

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*, organisations(name)')
        .eq('id', userId)
        .single();

      console.log('loadProfile: result:', { profileData, error: profileError });

      if (profileError) {
        // No profile found - create one
        if (profileError.code === 'PGRST116') {
          console.log('loadProfile: no profile, creating...');
          const orgId = crypto.randomUUID();
          
          await supabase.from('organisations').insert({
            id: orgId,
            name: 'My Organisation',
          });

          const { data: newProfile, error: insertError } = await supabase
            .from('user_profiles')
            .insert({
              id: userId,
              email: userEmail,
              role: 'admin',
              organisation_id: orgId,
            })
            .select('*, organisations(name)')
            .single();

          if (insertError) throw insertError;
          
          if (newProfile) {
            setProfile({
              id: newProfile.id,
              email: newProfile.email,
              fullName: newProfile.full_name,
              role: newProfile.role,
              organisationId: newProfile.organisation_id,
              organisationName: newProfile.organisations?.name,
            });
          }
        } else {
          throw profileError;
        }
      } else if (profileData) {
        setProfile({
          id: profileData.id,
          email: profileData.email,
          fullName: profileData.full_name,
          role: profileData.role,
          organisationId: profileData.organisation_id,
          organisationName: profileData.organisations?.name,
        });
      }
    } catch (err: any) {
      console.error('loadProfile error:', err);
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    console.log('useAuth: initializing...');

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        console.log('useAuth: session:', !!session);
        if (session?.user) {
          setUser(session.user);
          await loadProfile(session.user.id, session.user.email || '');
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('useAuth: getSession error:', err);
        setError(err.message);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('onAuthStateChange:', _event);
        if (session?.user) {
          setUser(session.user);
          await loadProfile(session.user.id, session.user.email || '');
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured');
    setError(null);
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    
    if (data.user) {
      setUser(data.user);
      await loadProfile(data.user.id, data.user.email || '');
    }
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured');
    setError(null);
    
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    
    if (data.user) {
      setUser(data.user);
      await loadProfile(data.user.id, data.user.email || '');
    }
  };

  const signOut = async () => {
    if (!supabase) throw new Error('Supabase not configured');
    
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    setUser(null);
    setProfile(null);
  };

  return { user, profile, loading, error, signIn, signUp, signOut };
}
