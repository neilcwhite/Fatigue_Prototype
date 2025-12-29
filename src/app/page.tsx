'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Check session with timeout
    const timeout = setTimeout(() => {
      console.log('Auth check timed out');
      setLoading(false);
    }, 5000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      setUser(session?.user || null);
      setLoading(false);
    }).catch((err) => {
      clearTimeout(timeout);
      console.error('Session check failed:', err);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  };

  // No Supabase config
  if (!supabase) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui' }}>
        <h1>Configuration Error</h1>
        <p>Supabase environment variables not set.</p>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'system-ui' }}>
        <div>Loading... (max 5 seconds)</div>
      </div>
    );
  }

  // Logged in
  if (user) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui' }}>
        <h1>Fatigue Management</h1>
        <p>Logged in as: {user.email}</p>
        <button onClick={handleSignOut} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Sign Out
        </button>
        <hr style={{ margin: '20px 0' }} />
        <p>✅ Authentication working. Dashboard component needs to be connected.</p>
      </div>
    );
  }

  // Login form
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'system-ui' }}>
      <div style={{ width: 320, padding: 20 }}>
        <h1 style={{ textAlign: 'center' }}>Fatigue Management</h1>
        <p style={{ textAlign: 'center', color: '#666' }}>Sign in to continue</p>
        
        {error && (
          <div style={{ background: '#fee', border: '1px solid #fcc', padding: 10, borderRadius: 4, marginBottom: 15, color: '#c00' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSignIn}>
          <div style={{ marginBottom: 15 }}>
            <label style={{ display: 'block', marginBottom: 5 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }}
              required
            />
          </div>
          <div style={{ marginBottom: 15 }}>
            <label style={{ display: 'block', marginBottom: 5 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }}
              required
            />
          </div>
          <button
            type="submit"
            style={{ width: '100%', padding: 12, background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 16 }}
