'use client';

import React, { useState, useEffect } from 'react';
import { signIn, signUp, supabase } from '@/lib/supabase';

export function LoginForm() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset' | 'newpassword'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check if this is a password reset callback
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setMode('newpassword');
    }
    
    // Also check for error in URL
    if (hash && hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1));
      const errorDesc = params.get('error_description');
      if (errorDesc) {
        setError(decodeURIComponent(errorDesc.replace(/\+/g, ' ')));
      }
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === 'newpassword') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage('Password updated successfully! You can now sign in.');
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
        // Clear the hash from URL
        window.history.replaceState(null, '', window.location.pathname);
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMessage('Password reset email sent. Check your inbox.');
      } else if (mode === 'signup') {
        if (!fullName || !orgName) throw new Error('Please fill in all fields');
        await signUp(email, password, fullName, orgName);
        setMessage('Account created! Check your email to confirm, then sign in.');
        setMode('signin');
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.message?.includes('User already registered')) {
        setError('This email is already registered. Try signing in instead.');
      } else if (err.message?.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.');
      } else if (err.message?.includes('Email not confirmed')) {
        setError('Please confirm your email address first. Check your inbox.');
      } else if (err.code === '23505') {
        setError('This account already exists. Try signing in.');
      } else if (err.message?.includes('row-level security')) {
        setError('Account setup failed. Please contact support.');
      } else {
        setError(err.message || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold text-gray-900">Fatigue Management</h1>
          <h2 className="mt-2 text-center text-lg text-gray-600">Network Rail Compliance System</h2>
          <p className="mt-6 text-center text-sm text-gray-500">
            {mode === 'signin' && 'Sign in to your account'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'reset' && 'Reset your password'}
            {mode === 'newpassword' && 'Set your new password'}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>
          )}
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">{message}</div>
          )}

          <div className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label htmlFor="fullName" className="form-label">Full Name</label>
                  <input id="fullName" type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="form-input" placeholder="John Smith" />
                </div>
                <div>
                  <label htmlFor="orgName" className="form-label">Organisation Name</label>
                  <input id="orgName" type="text" required value={orgName} onChange={(e) => setOrgName(e.target.value)} className="form-input" placeholder="Your Company Ltd" />
                </div>
              </>
            )}
            
            {mode !== 'newpassword' && mode !== 'reset' && (
              <div>
                <label htmlFor="email" className="form-label">Email Address</label>
                <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" placeholder="you@example.com" />
              </div>
            )}
            
            {mode === 'reset' && (
              <div>
                <label htmlFor="email" className="form-label">Email Address</label>
                <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" placeholder="you@example.com" />
              </div>
            )}
            
            {(mode === 'signin' || mode === 'signup') && (
              <div>
                <label htmlFor="password" className="form-label">Password</label>
                <input id="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" placeholder="••••••••" minLength={6} />
              </div>
            )}
            
            {mode === 'newpassword' && (
              <>
                <div>
                  <label htmlFor="password" className="form-label">New Password</label>
                  <input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" placeholder="••••••••" minLength={6} />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="form-label">Confirm New Password</label>
                  <input id="confirmPassword" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="form-input" placeholder="••••••••" minLength={6} />
                </div>
              </>
            )}
          </div>

          <div>
            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? 'Please wait...' : (
                mode === 'signin' ? 'Sign In' : 
                mode === 'signup' ? 'Create Account' : 
                mode === 'reset' ? 'Send Reset Link' :
                'Update Password'
              )}
            </button>
          </div>

          <div className="text-center space-y-2">
            {mode === 'signin' && (
              <>
                <button type="button" onClick={() => { setMode('signup'); setError(null); setMessage(null); }} className="block w-full text-sm text-blue-600 hover:text-blue-500">
                  Don't have an account? Sign up
                </button>
                <button type="button" onClick={() => { setMode('reset'); setError(null); setMessage(null); }} className="block w-full text-sm text-gray-500 hover:text-gray-700">
                  Forgot your password?
                </button>
              </>
            )}
            {mode === 'signup' && (
              <button type="button" onClick={() => { setMode('signin'); setError(null); setMessage(null); }} className="text-sm text-blue-600 hover:text-blue-500">
                Already have an account? Sign in
              </button>
            )}
            {(mode === 'reset' || mode === 'newpassword') && (
              <button type="button" onClick={() => { setMode('signin'); setError(null); setMessage(null); }} className="text-sm text-blue-600 hover:text-blue-500">
                Back to sign in
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
