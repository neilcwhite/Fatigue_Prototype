'use client';

import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { ChevronLeft } from '@/components/ui/Icons';
import type { SupabaseUser } from '@/lib/types';

type FatigueMode = 'entry' | 'review' | 'edit' | 'create';

interface FatigueHeaderProps {
  user: SupabaseUser;
  mode: FatigueMode;
  onBack: () => void;
  onChangePattern: () => void;
  onSignOut: () => void;
  projectName?: string;
}

export function FatigueHeader({
  user,
  mode,
  onBack,
  onChangePattern,
  onSignOut,
  projectName,
}: FatigueHeaderProps) {
  return (
    <AppBar
      position="static"
      sx={{
        background: 'linear-gradient(to right, #1e293b, #0f172a)',
        borderBottom: '4px solid #f97316',
      }}
    >
      <Toolbar>
        <Chip
          label="SHIFT BUILDER"
          size="small"
          sx={{
            bgcolor: 'rgba(249, 115, 22, 0.2)',
            color: '#fb923c',
            fontFamily: 'monospace',
            fontWeight: 600,
            fontSize: '0.75rem',
            px: 1,
            mr: 2,
          }}
        />
        {projectName && (
          <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 600 }}>
            {projectName}
          </Typography>
        )}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" sx={{ color: 'grey.400' }}>
            {user?.email}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={onSignOut}
            sx={{
              color: 'white',
              borderColor: 'rgba(255, 255, 255, 0.3)',
              '&:hover': {
                borderColor: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            Sign Out
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
