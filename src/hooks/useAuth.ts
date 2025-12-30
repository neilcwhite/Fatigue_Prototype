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

  const loadProfile = useCallback(async (userId: string, userEmail: string): Promise<UserProfile | null> => {
    console.log('loadProfile: starting for user:', userId);
    
    if (!supabase) {
      console.log('loadProfile: no supabase client');
      return null;
    }

    try {
      // Try to get existing profile
      console.log('loadProfile: querying user_profiles...');
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*, organisations(name)')
        .eq('id', userId)
        .single();

      console.log('loadProfile: query result:', { profileData, profileError });

      // If no profile exists, create one with a new organisation
      if (profileError && profileError.code === 'PGRST116') {
        console.log('loadProfile: no profile found, creating new one...');
        const orgId = crypto.randomUUID();
        
        // Create organisation
        const { error: orgError } = await supabase.from('organisations').insert({
          id: orgId,
          name: 'My Organisation',
        });
        
        if (orgError) {
          console.error('loadProfile: error creating org:', orgError);
          throw orgError;
        }

        // Create profile
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

        if (insertError) {
          console.error('loadProfile: error creating profile:', insertError);
          throw insertError;
        }
        
        console.log('loadProfile: created new profile:', newProfile);
        
        if (newProfile) {
          const profile: UserProfile = {
            id: newProfile.id,
            email: newProfile.email,
            fullName: newProfile.full_name,
            role: newProfile.role,
            organisationId: newProfile.organisation_id,
            organisationName: newProfile.organisations?.name,
          };
          setProfile(profile);
          return profile;
        }
      } else if (profileError) {
        console.error('loadProfile: query error:', profileError);
        throw profileError;
      }

      if (profileData) {
        console.log('loadProfile: found existing profile');
        const profile: UserProfile = {
          id: profileData.id,
          email: profileData.email,
          fullName: profileData.full_name,
          role: profileData.role,
          organisationId: profileData.organisation_id,
          organisationName: profileData.organisations?.name,
        };
        setProfile(profile);
        return profile;
      }

      return null;
    } catch (err: any) {
      console.error('loadProfile: error:', err);
      setError(err.message);
      return null;
    }
  }, []);

  // Check session on mount
  useEffect(() => {
    console.log('useAuth: checking session, supabase:', !!supabase);
    
    if (!supabase) {
      console.log('useAuth: no supabase client, setting loading false');
      setLoading(false);
      return;
    }

    // Get current session
    console.log('useAuth: calling getSession...');
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        console.log('useAuth: getSession result, session:', !!session);
        if (session?.user) {
          setUser(session.user);
          loadProfile(session.user.id, session.user.email || '');
        }
      })
      .catch((err) => {
        console.error('useAuth: getSession error:', err);
        setError(err.message);
      })
      .finally(() => {
        console.log('useAuth: setting loading false');
        setLoading(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('onAuthStateChange:', _event, !!session);
        if (session?.user) {
          setUser(session.user);
          try {
            await loadProfile(session.user.id, session.user.email || '');
          } catch (err) {
            console.error('onAuthStateChange: loadProfile failed:', err);
          }
        } else {
          setUser(null);
          setProfile(null);
        }
        console.log('onAuthStateChange: setting loading false');
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured');
    
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ 
      email, 
      password 
    });
    
    if (error) throw error;
    if (data.user) {
      setUser(data.user);
      await loadProfile(data.user.id, data.user.email || '');
    }
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured');
    
    setError(null);
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password 
    });
    
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

  return {
    user,
    profile,
    loading,
    error,
    signIn,
    signUp,
    signOut,
  };
}
