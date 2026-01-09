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
        borderBottom: '4px solid #06b6d4',
      }}
    >
      <Toolbar>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          <Box component="span" sx={{ color: '#06b6d4' }}>Shift</Box>
          {' '}
          <Box component="span" sx={{ color: 'white' }}>Builder</Box>
        </Typography>
        {projectName && (
          <Typography variant="subtitle2" sx={{ color: 'grey.400', ml: 3, fontWeight: 400 }}>
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
              color: '#06b6d4',
              borderColor: 'rgba(6, 182, 212, 0.3)',
              '&:hover': {
                borderColor: '#06b6d4',
                bgcolor: 'rgba(6, 182, 212, 0.1)',
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
