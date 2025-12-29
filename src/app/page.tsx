'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<any[]>([]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) {
        setUser(data.user);
        loadProjects();
      }
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    }
  };

  const loadProjects = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('projects').select('*').order('name');
    setProjects(data || []);
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setProjects([]);
  };

  // No config
  if (!supabase) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Configuration Error</h1>
        <p>Supabase not configured.</p>
      </div>
    );
  }

  // Logged in
  if (user) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
          <div>
            <h1 style={{ margin: 0 }}>Fatigue Management</h1>
            <p style={{ color: '#666', margin: '5px 0 0 0' }}>{user.email}</p>
          </div>
          <button onClick={handleSignOut} style={{ padding: '10px 20px', cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 30 }}>
          <div style={{ background: '#fff', padding: 20, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ color: '#666', margin: 0 }}>Projects</p>
            <p style={{ fontSize: 28, fontWeight: 'bold', margin: '5px 0 0 0' }}>{projects.length}</p>
          </div>
          <div style={{ background: '#fff', padding: 20, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ color: '#666', margin: 0 }}>Status</p>
            <p style={{ fontSize: 28, fontWeight: 'bold', margin: '5px 0 0 0', color: 'green' }}>Active</p>
          </div>
        </div>

        <h2>Projects</h2>
        {projects.length === 0 ? (
          <p style={{ color: '#666' }}>No projects yet</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {projects.map((p) => (
              <div key={p.id} style={{ background: '#fff', padding: 20, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: 0 }}>{p.name}</h3>
                <p style={{ color: '#666', margin: '5px 0 0 0' }}>{p.location || 'No location'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Login form - NO useEffect, NO loading state
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', fontFamily: 'system-ui' }}>
      <div style={{ width: 320, padding: 30, background: '#fff', borderRadius: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <h1 style={{ textAlign: 'center', marginBottom: 5 }}>Fatigue Management</h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: 25 }}>Sign in to continue</p>
        
        {error && (
          <div style={{ background: '#fee', border: '1px solid #fcc', padding: 10, borderRadius: 4, marginBottom: 15, color: '#c00' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSignIn}>
          <div style={{ marginBottom: 15 }}>
            <label style={{ display: 'block', marginBottom: 5, fontWeight: 500 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box' }}
              required
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 5, fontWeight: 500 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box' }}
              required
            />
          </div>
          <button
            type="submit"
            style={{ width: '100%', padding: 12, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 16, fontWeight: 500 }}
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
