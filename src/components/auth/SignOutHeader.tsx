'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { supabase } from '@/lib/supabase';
import type { SupabaseUser } from '@/lib/types';

interface SignOutHeaderProps {
  user: SupabaseUser;
  onSignOut: () => void;
}

export function SignOutHeader({ user, onSignOut }: SignOutHeaderProps) {
  if (!user) return null;

  const handleSignOut = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      onSignOut();
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Failed to sign out. Check console for details.');
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        bgcolor: 'rgba(30, 41, 59, 0.9)',
        backdropFilter: 'blur(4px)',
        px: 2,
        py: 0.75,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'rgba(71, 85, 105, 0.5)',
      }}
    >
      <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 500 }}>
        {user.email}
      </Typography>
      <Button
        onClick={handleSignOut}
        variant="text"
        size="small"
        sx={{
          color: 'primary.light',
          textTransform: 'none',
          fontSize: '0.75rem',
          minWidth: 'auto',
          p: 0.5,
          '&:hover': {
            bgcolor: 'rgba(59, 130, 246, 0.1)',
          },
        }}
      >
        Sign out
      </Button>
    </Box>
  );
}
