'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Divider from '@mui/material/Divider';
import { supabase } from '@/lib/supabase';
import { getAllowedDomainsList } from '@/lib/constants';
import type { SupabaseUser } from '@/lib/types';

// Approved email domains that can sign up
const APPROVED_DOMAINS = getAllowedDomainsList();

interface AuthScreenProps {
  onLogin: (user: SupabaseUser) => void;
}

// Helper to check if email domain is approved
function isApprovedDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return APPROVED_DOMAINS.some(d => domain === d);
}

// Sign-up steps
const SIGNUP_STEPS = ['Create Account', 'Verify Email', 'Start Using'];

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupStep, setSignupStep] = useState(0);
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  // Common input styles - fixed to prevent label overlap
  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: '#0f172a',
      color: '#ffffff',
      '& fieldset': { borderColor: '#475569' },
      '&:hover fieldset': { borderColor: '#64748b' },
      '&.Mui-focused fieldset': { borderColor: 'primary.main' },
    },
    '& .MuiInputLabel-root': {
      color: '#94a3b8',
      '&.MuiInputLabel-shrink': {
        transform: 'translate(14px, -9px) scale(0.75)',
        bgcolor: '#1e293b',
        px: 0.5,
      },
    },
    '& .MuiInputLabel-root.Mui-focused': { color: 'primary.light' },
    '& .MuiOutlinedInput-input::placeholder': { color: '#64748b', opacity: 1 },
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Database not configured');
      return;
    }

    // Validation for signup
    if (mode === 'signup') {
      if (!isApprovedDomain(email)) {
        setError(`Sign-ups are restricted to approved company domains: ${APPROVED_DOMAINS.join(', ')}`);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              requested_at: new Date().toISOString(),
            }
          }
        });
        if (error) throw error;

        // Show verification step
        if (data.user && !data.session) {
          // Email confirmation required
          setSignupStep(1);
          setAwaitingVerification(true);
        } else if (data.user && data.session) {
          // No email confirmation required (or auto-confirmed)
          setSignupStep(2);
          onLogin(data.user);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) onLogin(data.user);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleModeSwitch = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError('');
    setSignupStep(0);
    setAwaitingVerification(false);
    setConfirmPassword('');
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
          maxWidth: 440,
          p: 4,
          borderRadius: 3,
          bgcolor: '#1e293b',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {/* Logo and Title */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          {/* HerdWatch Logo - text-based for now */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              mb: 1.5,
            }}
          >
            {/* Cow icon placeholder */}
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
              }}
            >
              🐄
            </Box>
          </Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.5px',
            }}
          >
            Herd<Box component="span" sx={{ color: '#22c55e' }}>Watch</Box>
          </Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5 }}>
            Fatigue management for your workforce
          </Typography>
        </Box>

        {/* Sign-up Stepper */}
        {mode === 'signup' && (
          <Box sx={{ mb: 3 }}>
            <Stepper activeStep={signupStep} alternativeLabel>
              {SIGNUP_STEPS.map((label) => (
                <Step key={label}>
                  <StepLabel
                    sx={{
                      '& .MuiStepLabel-label': {
                        color: '#94a3b8',
                        fontSize: '0.75rem',
                        '&.Mui-active': { color: '#22c55e' },
                        '&.Mui-completed': { color: '#22c55e' },
                      },
                      '& .MuiStepIcon-root': {
                        color: '#475569',
                        '&.Mui-active': { color: '#22c55e' },
                        '&.Mui-completed': { color: '#22c55e' },
                      },
                    }}
                  >
                    {label}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>
        )}

        {/* Awaiting Email Verification */}
        {awaitingVerification ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Alert
              severity="success"
              sx={{
                mb: 3,
                bgcolor: 'rgba(34, 197, 94, 0.1)',
                color: '#86efac',
                '& .MuiAlert-icon': { color: '#22c55e' },
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Check Your Email
              </Typography>
              <Typography variant="caption" sx={{ display: 'block' }}>
                We&apos;ve sent a verification link to <strong>{email}</strong>
              </Typography>
            </Alert>

            <Box sx={{ bgcolor: '#0f172a', borderRadius: 2, p: 2.5, textAlign: 'left' }}>
              <Typography variant="subtitle2" sx={{ color: '#ffffff', mb: 1.5 }}>
                What happens next?
              </Typography>
              <Box component="ol" sx={{ color: '#94a3b8', fontSize: '0.875rem', pl: 2.5, m: 0 }}>
                <li style={{ marginBottom: '8px' }}>
                  Open the email from <strong style={{ color: '#ffffff' }}>noreply@mail.app.supabase.io</strong>
                </li>
                <li style={{ marginBottom: '8px' }}>
                  Click the <strong style={{ color: '#22c55e' }}>Confirm your email</strong> link
                </li>
                <li>
                  You&apos;ll be signed in automatically
                </li>
              </Box>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 2 }}>
                Don&apos;t see the email? Check your spam folder.
              </Typography>
            </Box>

            <Divider sx={{ my: 3, borderColor: '#334155' }} />

            <Button
              variant="text"
              onClick={handleModeSwitch}
              sx={{
                color: 'primary.light',
                textTransform: 'none',
                '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.1)' },
              }}
            >
              Back to Sign In
            </Button>
          </Box>
        ) : (
          <>
            {/* Error Alert */}
            {error && (
              <Alert
                severity="error"
                sx={{
                  mb: 2,
                  bgcolor: 'rgba(239, 68, 68, 0.1)',
                  color: '#fca5a5',
                  '& .MuiAlert-icon': { color: '#f87171' },
                }}
              >
                {error}
              </Alert>
            )}

            {/* Sign-up Info */}
            {mode === 'signup' && signupStep === 0 && (
              <Alert
                severity="info"
                sx={{
                  mb: 2,
                  bgcolor: 'rgba(59, 130, 246, 0.1)',
                  color: '#93c5fd',
                  '& .MuiAlert-icon': { color: '#60a5fa' },
                }}
              >
                <Typography variant="caption">
                  Use your company email address. Your organisation will be automatically detected from your email domain.
                </Typography>
              </Alert>
            )}

            {/* Form */}
            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                type="email"
                label="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                disabled={loading}
                fullWidth
                variant="outlined"
                size="medium"
                sx={inputSx}
              />

              <TextField
                type="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={loading}
                fullWidth
                variant="outlined"
                size="medium"
                sx={inputSx}
              />

              {/* Confirm Password for Sign-up */}
              {mode === 'signup' && (
                <TextField
                  type="password"
                  label="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  disabled={loading}
                  fullWidth
                  variant="outlined"
                  size="medium"
                  sx={inputSx}
                />
              )}

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
                  bgcolor: mode === 'signup' ? '#22c55e' : 'primary.main',
                  '&:hover': {
                    bgcolor: mode === 'signup' ? '#16a34a' : 'primary.dark',
                  },
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
              <Divider sx={{ mb: 2, borderColor: '#334155' }}>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  {mode === 'signin' ? 'New to HerdWatch?' : 'Already have an account?'}
                </Typography>
              </Divider>
              <Button
                variant="outlined"
                onClick={handleModeSwitch}
                disabled={loading}
                fullWidth
                sx={{
                  color: mode === 'signin' ? '#22c55e' : 'primary.light',
                  borderColor: mode === 'signin' ? '#22c55e' : 'primary.light',
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: mode === 'signin' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                    borderColor: mode === 'signin' ? '#22c55e' : 'primary.light',
                  },
                }}
              >
                {mode === 'signin' ? 'Create an Account' : 'Sign In Instead'}
              </Button>
            </Box>
          </>
        )}

      </Paper>
    </Box>
  );
}
