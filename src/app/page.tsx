'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key exists:', !!supabaseKey);

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [debug, setDebug] = useState('Starting...');

  useEffect(() => {
    console.log('useEffect running, supabase:', !!supabase);
    setDebug('useEffect started');

    if (!supabase) {
      console.log('No supabase client');
      setDebug('No supabase client');
      setLoading(false);
      return;
    }

    // Force timeout after 3 seconds
    const timeout = setTimeout(() => {
      console.log('Timeout reached, forcing loading off');
      setDebug('Timeout - forcing login form');
      setLoading(false);
    }, 3000);

    console.log('Calling getSession...');
    setDebug('Calling getSession...');

    supabase.auth.getSession()
      .then(({ data, error }) => {
        console.log('getSession response:', { data, error });
        setDebug('getSession done: ' + JSON.stringify({ hasSession: !!data?.session, error: error?.message }));
        clearTimeout(timeout);
        
        if (data?.session?.user) {
          setUser(data.session.user);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('getSession error:', err);
        setDebug('getSession error: ' + err.message);
        clearTimeout(timeout);
        setLoading(false);
      });

    return () => clearTimeout(timeout);
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    
    setError('');
    setDebug('Signing in...');

    try {
      console.log('Attempting sign in...');
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      console.log('Sign in response:', { data, error });
      
      if (error) throw error;
      
      setDebug('Sign in success!');
      if (data.user) {
        setUser(data.user);
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || 'Sign in failed');
      setDebug('Sign in error: ' + err.message);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  };

  if (!supabase) {
    return (
      <div className="p-10">
        <h1 className="text-2xl font-bold mb-4">Configuration Error</h1>
        <p>Supabase environment variables not set.</p>
        <p className="mt-4 text-sm text-gray-500">URL: {supabaseUrl || 'missing'}</p>
        <p className="text-sm text-gray-500">Key: {supabaseKey ? 'present' : 'missing'}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading...</p>
          <p className="mt-4 text-xs text-gray-400">{debug}</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="p-10">
        <h1 className="text-2xl font-bold mb-4">Fatigue Management</h1>
        <p className="mb-4">Logged in as: {user.email}</p>
        <button 
          onClick={handleSignOut}
          className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
        >
          Sign Out
        </button>
        <hr className="my-6" />
        <p className="text-green-600">Auth working. Dashboard to be connected.</p>
      </div>
    );
  }

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
        <p className="mt-4 text-xs text-gray-400 text-center">{debug}</p>
      </div>
    </div>
  );
}
