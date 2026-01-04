'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { AlertTriangle, XCircle } from '@/components/ui/Icons';
import type { ComplianceViolation } from '@/lib/compliance';

interface ViolationsListProps {
  violations: ComplianceViolation[];
  onViolationClick: (violation: ComplianceViolation) => void;
}

const getViolationIcon = (type: string): string => {
  switch (type) {
    case 'MAX_SHIFT_LENGTH':
      return '⏱️';
    case 'INSUFFICIENT_REST':
      return '😴';
    case 'MAX_WEEKLY_HOURS':
      return '📊';
    case 'APPROACHING_WEEKLY_LIMIT':
      return '⚠️';
    case 'MAX_CONSECUTIVE_DAYS':
      return '📅';
    case 'CONSECUTIVE_NIGHTS_WARNING':
      return '🌙';
    case 'MAX_CONSECUTIVE_NIGHTS':
      return '🌙';
    case 'DAY_NIGHT_TRANSITION':
      return '🔄';
    case 'MULTIPLE_SHIFTS_SAME_DAY':
      return '⚡';
    default:
      return '⚠️';
  }
};

const getViolationTitle = (type: string): string => {
  switch (type) {
    case 'MAX_SHIFT_LENGTH':
      return 'Maximum Shift Length Exceeded';
    case 'INSUFFICIENT_REST':
      return 'Insufficient Rest Period';
    case 'MAX_WEEKLY_HOURS':
      return 'Maximum Weekly Hours Exceeded';
    case 'APPROACHING_WEEKLY_LIMIT':
      return 'Approaching Weekly Limit';
    case 'MAX_CONSECUTIVE_DAYS':
      return 'Too Many Consecutive Days';
    case 'CONSECUTIVE_NIGHTS_WARNING':
      return 'Extended Night Shift Run';
    case 'MAX_CONSECUTIVE_NIGHTS':
      return 'Too Many Consecutive Nights';
    case 'DAY_NIGHT_TRANSITION':
      return 'Day-Night Transition Same Day';
    case 'MULTIPLE_SHIFTS_SAME_DAY':
      return 'Multiple Shifts Same Day';
    default:
      return 'Compliance Issue';
  }
};

export function ViolationsList({ violations, onViolationClick }: ViolationsListProps) {
  if (violations.length === 0) return null;

  // Sort by date, soonest first
  const sortedViolations = [...violations].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <Paper sx={{ mb: 2 }} data-testid="violations-list">
      <Box
        sx={{
          p: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <AlertTriangle className="w-4 h-4" />
        <Typography variant="subtitle2" fontWeight={600}>
          Compliance Violations ({violations.length})
        </Typography>
      </Box>
      <Box sx={{ p: 1.5, maxHeight: 200, overflow: 'auto' }}>
        {sortedViolations.map((violation, idx) => (
          <Box
            key={idx}
            onClick={() => onViolationClick(violation)}
            data-testid={`violation-item-${idx}`}
            sx={{
              p: 1,
              mb: 1,
              borderRadius: 1,
              cursor: 'pointer',
              borderLeft: 4,
              borderColor: violation.severity === 'error' ? 'error.main' : 'warning.main',
              bgcolor: violation.severity === 'error' ? '#fef2f2' : '#fffbeb',
              '&:hover': {
                boxShadow: 2,
                bgcolor: violation.severity === 'error' ? '#fee2e2' : '#fef3c7',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box
                sx={{
                  color: violation.severity === 'error' ? '#b91c1c' : '#b45309',
                  mt: 0.25,
                }}
              >
                {violation.severity === 'error' ? (
                  <XCircle className="w-3 h-3" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  fontWeight={600}
                  sx={{
                    color: violation.severity === 'error' ? '#991b1b' : '#92400e',
                  }}
                >
                  {getViolationIcon(violation.type)} {getViolationTitle(violation.type)}
                </Typography>
                <Typography
                  variant="caption"
                  display="block"
                  sx={{
                    color: violation.severity === 'error' ? '#7f1d1d' : '#78350f',
                  }}
                >
                  {violation.message}
                </Typography>
                <Typography variant="caption" sx={{ color: '#374151' }}>
                  {new Date(violation.date).toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                  <Box
                    component="span"
                    sx={{ color: 'primary.main', ml: 1, fontWeight: 500 }}
                  >
                    → Click to view
                  </Box>
                </Typography>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

export { getViolationIcon, getViolationTitle };
