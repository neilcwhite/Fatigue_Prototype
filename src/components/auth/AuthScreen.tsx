'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { Calendar } from '@/components/ui/Icons';
import { supabase } from '@/lib/supabase';
import type { SupabaseUser } from '@/lib/types';

// Approved email domains that can sign up without admin approval
const APPROVED_DOMAINS = ['thespencergroup.co.uk'];

// Admin email to receive signup notifications
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@thespencergroup.co.uk';

interface AuthScreenProps {
  onLogin: (user: SupabaseUser) => void;
}

// Helper to check if email domain is approved
function isApprovedDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return APPROVED_DOMAINS.some(d => domain === d);
}

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase not configured');
      return;
    }

    setLoading(true);
    setError('');
    setPendingApproval(false);

    try {
      if (mode === 'signup') {
        // Check if email domain is approved for auto-signup
        const approved = isApprovedDomain(email);

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              pending_approval: !approved,
              requested_at: new Date().toISOString(),
            }
          }
        });
        if (error) throw error;

        if (!approved) {
          // Non-approved domain - show pending message and send notification
          setPendingApproval(true);

          // Call API to send notification email to admin
          try {
            await fetch('/api/notify-signup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email,
                userId: data.user?.id,
                requestedAt: new Date().toISOString()
              }),
            });
          } catch {
            // Notification failed but signup succeeded - continue
            console.error('Failed to send signup notification');
          }

          return; // Don't proceed to login
        }

        if (data.user) onLogin(data.user);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Check if user is pending approval
        if (data.user?.user_metadata?.pending_approval) {
          setError('Your account is pending approval. You will receive an email once approved.');
          await supabase.auth.signOut();
          return;
        }

        if (data.user) onLogin(data.user);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        p: 2,
      }}
    >
      <Paper
        elevation={8}
        sx={{
          width: '100%',
          maxWidth: 400,
          p: 4,
          borderRadius: 3,
          bgcolor: '#1e293b',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {/* Logo and Title */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'primary.main',
              p: 1.5,
              borderRadius: 2,
              mb: 2,
            }}
          >
            <Calendar className="w-8 h-8" />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#ffffff', mb: 0.5 }}>
            Network Rail{' '}
            <Box component="span" sx={{ color: 'primary.light' }}>
              Fatigue Management
            </Box>
          </Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
            HSE RR446 compliant shift planning system
          </Typography>
        </Box>

        {/* Pending Approval Message */}
        {pendingApproval && (
          <Alert
            severity="info"
            sx={{
              mb: 3,
              bgcolor: 'rgba(59, 130, 246, 0.1)',
              color: '#93c5fd',
              '& .MuiAlert-icon': { color: '#60a5fa' },
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Account Created - Pending Approval
            </Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>
              Your account has been created but requires admin approval before you can access the system.
              An administrator has been notified and will review your request.
            </Typography>
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 3,
              bgcolor: 'rgba(239, 68, 68, 0.1)',
              color: '#fca5a5',
              '& .MuiAlert-icon': { color: '#f87171' },
            }}
          >
            {error}
          </Alert>
        )}

        {/* Form */}
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={loading}
            fullWidth
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#0f172a',
                color: '#ffffff',
                '& fieldset': { borderColor: '#475569' },
                '&:hover fieldset': { borderColor: '#64748b' },
                '&.Mui-focused fieldset': { borderColor: 'primary.main' },
              },
              '& .MuiInputLabel-root': { color: '#94a3b8' },
              '& .MuiInputLabel-root.Mui-focused': { color: 'primary.light' },
              '& .MuiOutlinedInput-input::placeholder': { color: '#64748b', opacity: 1 },
            }}
          />

          <TextField
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={loading}
            fullWidth
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#0f172a',
                color: '#ffffff',
                '& fieldset': { borderColor: '#475569' },
                '&:hover fieldset': { borderColor: '#64748b' },
                '&.Mui-focused fieldset': { borderColor: 'primary.main' },
              },
              '& .MuiInputLabel-root': { color: '#94a3b8' },
              '& .MuiInputLabel-root.Mui-focused': { color: 'primary.light' },
              '& .MuiOutlinedInput-input::placeholder': { color: '#64748b', opacity: 1 },
            }}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            fullWidth
            sx={{
              py: 1.5,
              mt: 1,
              fontWeight: 600,
              fontSize: '1rem',
            }}
          >
            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={20} color="inherit" />
                {mode === 'signin' ? 'Signing in...' : 'Creating account...'}
              </Box>
            ) : (
              mode === 'signin' ? 'Sign In' : 'Create Account'
            )}
          </Button>
        </Box>

        {/* Mode Toggle */}
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Button
            variant="text"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError('');
            }}
            disabled={loading}
            sx={{
              color: 'primary.light',
              textTransform: 'none',
              '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.1)' },
            }}
          >
            {mode === 'signin'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
