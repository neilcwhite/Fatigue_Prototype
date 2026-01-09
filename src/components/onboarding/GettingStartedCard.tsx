'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import { ChevronRight, CheckCircle } from '@/components/ui/Icons';
import { useOnboarding, ONBOARDING_TASKS } from '@/hooks/useOnboarding';

export function GettingStartedCard() {
  const {
    completedTasks,
    completionPercentage,
    isComplete,
    dismissed,
    openPanel,
    getNextTask,
  } = useOnboarding();

  // Don't show if dismissed or complete
  if (dismissed || isComplete) {
    return null;
  }

  const nextTask = getNextTask();

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, #233e99 0%, #1a2d73 100%)',
        color: 'white',
        borderRadius: 2,
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardContent sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
          <Box>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5 }}>
              Getting Started
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              Complete these tasks to set up HerdWatch
            </Typography>
          </Box>
          <Box
            sx={{
              bgcolor: 'rgba(255,255,255,0.15)',
              borderRadius: 1,
              px: 1.5,
              py: 0.5,
            }}
          >
            <Typography variant="caption" fontWeight={600}>
              {completedTasks.length}/{ONBOARDING_TASKS.length}
            </Typography>
          </Box>
        </Box>

        {/* Progress bar */}
        <Box sx={{ mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={completionPercentage}
            sx={{
              height: 4,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.2)',
              '& .MuiLinearProgress-bar': {
                bgcolor: '#4ade80',
                borderRadius: 2,
              },
            }}
          />
        </Box>

        {/* Next task - compact single line */}
        {nextTask && (
          <Box
            sx={{
              bgcolor: 'rgba(255,255,255,0.1)',
              borderRadius: 1,
              px: 1.5,
              py: 1,
              mb: 1.5,
            }}
          >
            <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.7rem' }}>
              <span style={{ opacity: 0.7 }}>Next Step</span>
              <span style={{ margin: '0 6px' }}>–</span>
              <span style={{ fontWeight: 500 }}>{nextTask.title}</span>
            </Typography>
          </Box>
        )}

        {/* Action button */}
        <Button
          fullWidth
          variant="contained"
          onClick={openPanel}
          size="small"
          endIcon={<ChevronRight className="w-4 h-4" />}
          sx={{
            bgcolor: 'white',
            color: '#233e99',
            fontWeight: 600,
            py: 0.75,
            mt: 'auto',
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.9)',
            },
          }}
        >
          View All Tasks
        </Button>
      </CardContent>
    </Card>
  );
}
