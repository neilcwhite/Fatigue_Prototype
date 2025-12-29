'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Dashboard } from '@/components/dashboard/Dashboard';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export { supabase };

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Check session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    if (!supabase) return;
    
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*, organisations(*)')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Profile error:', error);
        // Create default profile if none exists
        if (error.code === 'PGRST116') {
          await createDefaultProfile(userId);
        }
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }

  async function createDefaultProfile(userId: string) {
    if (!supabase || !user) return;

    const orgId = crypto.randomUUID();

    // Create organisation
    await supabase.from('organisations').insert({ id: orgId, name: 'My Organisation' });

    // Create profile
    const { data } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        organisation_id: orgId,
        email: user.email,
        full_name: null,
        role: 'admin',
      })
      .select('*, organisations(*)')
      .single();

    if (data) setProfile(data);
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) {
        setUser(data.user);
        await loadProfile(data.user.id);
      }
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  // No config
  if (!supabase) {
    return (
      <div className="p-10">
        <h1 className="text-2xl font-bold mb-4">Configuration Error</h1>
        <p>Supabase environment variables not set.</p>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Logged in with profile - show Dashboard
  if (user && profile) {
    return <Dashboard profile={profile} onSignOut={handleSignOut} />;
  }

  // Logged in but no profile yet
  if (user && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Setting up your account...</p>
        </div>
      </div>
    );
  }

  // Login form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-80 p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-2">Fatigue Management</h1>
        <p className="text-gray-500 text-center mb-6">Sign in to continue</p>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSignIn}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
