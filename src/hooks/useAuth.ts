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
    if (!supabase) {
      console.log('loadProfile: supabase not configured');
      return;
    }

    console.log('loadProfile: starting for user:', userId, 'email:', userEmail);

    try {
      console.log('loadProfile: querying user_profiles table...');

      // Try direct fetch to Supabase REST API as a workaround for client library issues
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase not configured');
      }

      // Get the current session token for authenticated requests
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || supabaseKey;

      console.log('loadProfile: using direct fetch with token');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('loadProfile: Aborting fetch due to timeout');
        controller.abort();
      }, 8000);

      let profileData: any = null;
      let profileError: any = null;

      try {
        console.log('loadProfile: fetching from REST API...');

        const response = await fetch(
          `${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}&select=*`,
          {
            method: 'GET',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation',
            },
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);
        console.log('loadProfile: fetch responded, status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('loadProfile: fetch error:', errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('loadProfile: data received, count:', data?.length);

        // REST API returns an array, get first item
        profileData = data?.[0] || null;
        profileError = null;

        console.log('loadProfile: query responded!');
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          throw new Error('Query timed out after 8 seconds');
        }
        throw fetchErr;
      }

      console.log('loadProfile: query completed, profileData:', profileData ? 'found' : 'not found');

      // Fetch organisation name separately if we have a profile
      let organisationName: string | undefined;
      if (profileData?.organisation_id) {
        console.log('loadProfile: fetching organisation name...');
        const { data: orgData } = await supabase
          .from('organisations')
          .select('name')
          .eq('id', profileData.organisation_id)
          .single();
        organisationName = orgData?.name;
        console.log('loadProfile: organisation name:', organisationName);
      }

      console.log('loadProfile: result:', {
        hasData: !!profileData,
        errorMessage: profileError?.message,
        errorCode: profileError?.code,
        errorHint: profileError?.hint
      });

      if (profileError) {
        // Some error occurred
        console.error('loadProfile: unexpected error:', profileError);
        throw profileError;
      }

      // No profile found - create one (maybeSingle returns null when no row)
      if (!profileData) {
        console.log('loadProfile: no profile exists, creating new one...');
        const orgId = crypto.randomUUID();

        const { error: orgError } = await supabase.from('organisations').insert({
          id: orgId,
          name: 'My Organisation',
        });

        if (orgError) {
          console.error('loadProfile: failed to create organisation:', orgError);
          throw orgError;
        }

        const { data: newProfile, error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: userId,
            email: userEmail,
            role: 'admin',
            organisation_id: orgId,
          })
          .select('*')
          .single();

        if (insertError) {
          console.error('loadProfile: failed to create profile:', insertError);
          throw insertError;
        }

        console.log('loadProfile: created new profile successfully');

        if (newProfile) {
          setProfile({
            id: newProfile.id,
            email: newProfile.email,
            fullName: newProfile.full_name,
            role: newProfile.role,
            organisationId: newProfile.organisation_id,
            organisationName: 'My Organisation',
          });
        }
      } else {
        // Profile found - use it
        console.log('loadProfile: profile found, setting state');
        setProfile({
          id: profileData.id,
          email: profileData.email,
          fullName: profileData.full_name,
          role: profileData.role,
          organisationId: profileData.organisation_id,
          organisationName: organisationName,
        });
      }
    } catch (err: any) {
      console.error('loadProfile error:', err);

      // If query timed out, create a temporary fallback profile so the app can still be used
      if (err.message?.includes('timed out')) {
        console.log('loadProfile: Query timed out, creating fallback profile');
        // Create a temporary org and profile - the app can still function
        const tempOrgId = crypto.randomUUID();
        setProfile({
          id: userId,
          email: userEmail,
          role: 'admin',
          organisationId: tempOrgId,
          organisationName: 'My Organisation (Offline)',
        });
        setError('Database connection slow - using offline mode');
      } else {
        setError(err.message);
      }
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    console.log('useAuth: initializing...');
    let isMounted = true;
    let profileLoadedForUser: string | null = null;

    const handleSession = async (session: any, source: string) => {
      if (!isMounted) return;

      if (session?.user) {
        // Skip if we already loaded profile for this user
        if (profileLoadedForUser === session.user.id) {
          console.log(`${source}: profile already loaded for user, skipping`);
          if (isMounted) setLoading(false);
          return;
        }

        console.log(`${source}: setting user:`, session.user.id);
        setUser(session.user);

        try {
          profileLoadedForUser = session.user.id;
          await loadProfile(session.user.id, session.user.email || '');
          console.log(`${source}: profile load complete`);
        } catch (err) {
          console.error(`${source}: profile load failed:`, err);
          profileLoadedForUser = null; // Reset so we can retry
        }
      } else {
        console.log(`${source}: no session, clearing user/profile`);
        setUser(null);
        setProfile(null);
        profileLoadedForUser = null;
      }

      if (isMounted) setLoading(false);
    };

    // Listen for auth state changes first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('onAuthStateChange:', _event, 'hasSession:', !!session);
        await handleSession(session, 'onAuthStateChange');
      }
    );

    // Then get initial session (onAuthStateChange will also fire for INITIAL_SESSION)
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        console.log('getSession: result hasSession:', !!session);
        // Only handle if onAuthStateChange hasn't already handled it
        if (!profileLoadedForUser && session?.user) {
          await handleSession(session, 'getSession');
        } else if (!session) {
          if (isMounted) setLoading(false);
        }
      })
      .catch((err) => {
        console.error('getSession error:', err);
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
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
