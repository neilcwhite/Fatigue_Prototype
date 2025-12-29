'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client directly to avoid import issues
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if environment variables are set
const isConfigured = supabaseUrl && supabaseAnonKey;

// Only create client if configured
const supabase = isConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function LoginForm() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Show configuration error if env vars not set
  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Configuration Error</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-700 text-sm">
              Supabase environment variables are not configured.
            </p>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Please set the following in your Vercel project settings:
          </p>
          <ul className="text-sm text-gray-700 space-y-2 bg-gray-50 p-4 rounded-lg font-mono">
            <li>NEXT_PUBLIC_SUPABASE_URL</li>
            <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
          </ul>
          <p className="text-gray-500 text-xs mt-4">
            After adding variables, redeploy the application.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supabase) {
      setError('Supabase client not initialized');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (signUpError) throw signUpError;
        
        if (data.user && !data.session) {
          setMessage('Check your email to confirm your account before signing in.');
          setMode('signin');
        }
      } else if (mode === 'reset') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}`,
        });
        
        if (resetError) throw resetError;
        setMessage('Password reset email sent. Check your inbox.');
      } else {
        // Sign in
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (signInError) {
          // Handle specific error messages
          if (signInError.message.includes('Invalid login credentials')) {
            throw new Error('Invalid email or password');
          }
          if (signInError.message.includes('Email not confirmed')) {
            throw new Error('Please confirm your email before signing in. Check your inbox.');
          }
          throw signInError;
        }
        
        // Success - the auth state change will be detected by AuthProvider
        if (data.session) {
          window.location.reload(); // Force reload to pick up new session
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Fatigue Management</h1>
          <p className="text-gray-500 mt-2">Network Rail Compliance System</p>
        </div>

        {/* Mode title */}
        <h2 className="text-lg font-semibold text-gray-700 mb-6 text-center">
          {mode === 'signin' && 'Sign in to your account'}
          {mode === 'signup' && 'Create a new account'}
          {mode === 'reset' && 'Reset your password'}
        </h2>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Success message */}
        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
            {message}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="you@example.com"
              required
              disabled={loading}
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                required
                minLength={6}
                disabled={loading}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              <>
                {mode === 'signin' && 'Sign In'}
                {mode === 'signup' && 'Create Account'}
                {mode === 'reset' && 'Send Reset Link'}
              </>
            )}
          </button>
        </form>

        {/* Mode switches */}
        <div className="mt-6 text-center space-y-2">
          {mode === 'signin' && (
            <>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                Don't have an account? Sign up
              </button>
              <br />
              <button
                type="button"
                onClick={() => { setMode('reset'); setError(''); setMessage(''); }}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Forgot your password?
              </button>
            </>
          )}
          {(mode === 'signup' || mode === 'reset') && (
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(''); setMessage(''); }}
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              Back to sign in
            </button>
          )}
        </div>

        {/* Debug info (remove in production) */}
        <div className="mt-8 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-400 text-center">
            Connected to: {supabaseUrl.replace('https://', '').split('.')[0]}...
          </p>
        </div>
      </div>
    </div>
  );
}
