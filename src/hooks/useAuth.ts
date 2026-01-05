'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getOrganisationForEmail, getAllowedDomainsList } from '@/lib/constants';
import type { User, Session } from '@supabase/supabase-js';

// ==================== RETRY CONFIGURATION ====================
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number): number {
  const delay = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
}

interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  role: string;
  organisationId: string;
  organisationName?: string;
}

interface ProfileData {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  organisation_id: string;
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

  // Track retry attempts to prevent infinite loops
  const retryAttemptsRef = useRef(0);

  const loadProfile = useCallback(async (userId: string, userEmail: string, sessionToken?: string): Promise<void> => {
    if (!supabase) {
      return;
    }

    // SECURITY: Require a valid session token - do NOT fall back to anon key
    // Falling back to anon key with misconfigured RLS could allow cross-tenant reads
    if (!sessionToken) {
      throw new Error('Session token required for profile fetch');
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase not configured');
    }

    let lastError: Error | null = null;
    let profileData: ProfileData | null = null;

    // Retry loop with exponential backoff
    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Wait before retrying with exponential backoff
          const delay = getBackoffDelay(attempt - 1);
          await sleep(delay);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 10000); // Increased timeout to 10 seconds

        try {
          const response = await fetch(
            `${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}&select=*`,
            {
              method: 'GET',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${sessionToken}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation',
              },
              signal: controller.signal,
            }
          );

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const data = await response.json();
          // REST API returns an array, get first item
          profileData = data?.[0] || null;

          // Success - break out of retry loop
          retryAttemptsRef.current = 0;
          break;
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
            lastError = new Error(`Request timed out (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries + 1})`);
          } else {
            lastError = fetchErr instanceof Error ? fetchErr : new Error('Unknown fetch error');
          }

          // If this is the last attempt, throw the error
          if (attempt === RETRY_CONFIG.maxRetries) {
            throw lastError;
          }
          // Otherwise continue to next retry attempt
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Unknown error');
        if (attempt === RETRY_CONFIG.maxRetries) {
          throw lastError;
        }
      }
    }

    // Fetch organisation name separately if we have a profile
    let organisationName: string | undefined;
    if (profileData?.organisation_id) {
      try {
        const orgResponse = await fetch(
          `${supabaseUrl}/rest/v1/organisations?id=eq.${profileData.organisation_id}&select=name`,
          {
            method: 'GET',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${sessionToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (orgResponse.ok) {
          const orgData = await orgResponse.json();
          organisationName = orgData?.[0]?.name;
        }
      } catch {
        // Silently handle org fetch failure - non-critical
      }
    }

    // No profile found - create one using domain mapping
    if (!profileData) {
      // Look up organisation based on email domain
      const orgMapping = getOrganisationForEmail(userEmail);

      if (!orgMapping) {
        // This shouldn't happen if signup validation is working, but handle it gracefully
        throw new Error(
          'Your email domain is not authorized. Please contact your administrator.'
        );
      }

      // Check if the organisation already exists, if not create it
      const { data: existingOrg } = await supabase
        .from('organisations')
        .select('id')
        .eq('id', orgMapping.organisationId)
        .single();

      if (!existingOrg) {
        // Create the organisation with the predefined ID and name
        const { error: orgError } = await supabase.from('organisations').insert({
          id: orgMapping.organisationId,
          name: orgMapping.organisationName,
        });

        if (orgError && !orgError.message.includes('duplicate')) {
          throw orgError;
        }
      }

      const { data: newProfile, error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          email: userEmail,
          role: 'admin',
          organisation_id: orgMapping.organisationId,
        })
        .select('*')
        .single();

      if (insertError) {
        throw insertError;
      }

      if (newProfile) {
        setProfile({
          id: newProfile.id,
          email: newProfile.email,
          fullName: newProfile.full_name,
          role: newProfile.role,
          organisationId: newProfile.organisation_id,
          organisationName: orgMapping.organisationName,
        });
      }
    } else {
      // Profile found - use it
      setProfile({
        id: profileData.id,
        email: profileData.email,
        fullName: profileData.full_name,
        role: profileData.role,
        organisationId: profileData.organisation_id,
        organisationName: organisationName,
      });
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let profileLoadedForUser: string | null = null;

    const handleSession = async (session: Session | null, _source: string) => {
      if (!isMounted) return;

      if (session?.user) {
        // Skip if we already loaded profile for this user
        if (profileLoadedForUser === session.user.id) {
          if (isMounted) setLoading(false);
          return;
        }

        setUser(session.user);

        try {
          profileLoadedForUser = session.user.id;
          // Pass the session access token for RLS authentication
          await loadProfile(session.user.id, session.user.email || '', session.access_token);
          // Clear any previous errors on success
          if (isMounted) setError(null);
        } catch (err) {
          profileLoadedForUser = null; // Reset so we can retry
          retryAttemptsRef.current += 1;

          // Surface the error to the user after max retries
          if (retryAttemptsRef.current >= RETRY_CONFIG.maxRetries) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load user profile';
            if (isMounted) {
              setError(`Profile load failed: ${errorMessage}. Please try signing out and back in.`);
              // Force sign out on repeated failures to prevent stuck state
              setUser(null);
              setProfile(null);
            }
          }
        }
      } else {
        setUser(null);
        setProfile(null);
        profileLoadedForUser = null;
      }

      if (isMounted) setLoading(false);
    };

    // Listen for auth state changes first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        await handleSession(session, 'onAuthStateChange');
      }
    );

    // Then get initial session (onAuthStateChange will also fire for INITIAL_SESSION)
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        // Only handle if onAuthStateChange hasn't already handled it
        if (!profileLoadedForUser && session?.user) {
          await handleSession(session, 'getSession');
        } else if (!session) {
          if (isMounted) setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Authentication error');
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

    if (data.user && data.session) {
      setUser(data.user);
      await loadProfile(data.user.id, data.user.email || '', data.session.access_token);
    }
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured');
    setError(null);

    // Validate email domain before attempting signup
    const orgMapping = getOrganisationForEmail(email);
    if (!orgMapping) {
      const allowedDomains = getAllowedDomainsList();
      throw new Error(
        `Signups are currently restricted to approved domains: ${allowedDomains.join(', ')}. ` +
        `Please contact your administrator if you need access.`
      );
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    if (data.user && data.session) {
      setUser(data.user);
      await loadProfile(data.user.id, data.user.email || '', data.session.access_token);
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
