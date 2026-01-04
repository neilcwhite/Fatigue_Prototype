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
}

export function FatigueHeader({
  user,
  mode,
  onBack,
  onChangePattern,
}: FatigueHeaderProps) {
  const handleClick = mode === 'entry' ? onBack : onChangePattern;
  const buttonLabel = mode === 'entry' ? 'Back' : 'Change Pattern';

  return (
    <AppBar
      position="static"
      sx={{
        background: 'linear-gradient(to right, #1e293b, #0f172a)',
        borderBottom: '4px solid #f97316',
      }}
    >
      <Toolbar>
        <Button
          startIcon={<ChevronLeft className="w-4 h-4" />}
          onClick={handleClick}
          sx={{
            color: 'white',
            bgcolor: 'rgba(255,255,255,0.1)',
            mr: 2,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
          }}
        >
          {buttonLabel}
        </Button>
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
          Shift Pattern{' '}
          <Box component="span" sx={{ color: '#fb923c' }}>
            Builder
          </Box>
        </Typography>
        <Chip
          label="FATIGUE CHECKER"
          size="small"
          sx={{
            bgcolor: 'rgba(255,255,255,0.1)',
            color: '#fb923c',
            fontFamily: 'monospace',
            fontSize: '0.7rem',
            mr: 2,
          }}
        />
        <Typography variant="body2" sx={{ color: 'grey.400' }}>
          {user?.email}
        </Typography>
      </Toolbar>
    </AppBar>
  );
}
