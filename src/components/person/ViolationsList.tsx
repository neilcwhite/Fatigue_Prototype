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
      return '🚫';
    case 'LEVEL_1_EXCEEDANCE':
      return '⚠️';
    case 'LEVEL_2_EXCEEDANCE':
      return '🚨';
    case 'APPROACHING_WEEKLY_LIMIT':
      return '⚠️';
    case 'MAX_CONSECUTIVE_DAYS':
      return '📅';
    case 'CONSECUTIVE_DAYS_WARNING':
      return '📅';
    case 'CONSECUTIVE_NIGHTS_WARNING':
      return '🌙';
    case 'MAX_CONSECUTIVE_NIGHTS':
      return '🌙';
    case 'DAY_NIGHT_TRANSITION':
      return '🔄';
    case 'MULTIPLE_SHIFTS_SAME_DAY':
      return '⚡';
    case 'ELEVATED_FATIGUE_INDEX':
      return '😵';
    default:
      return '⚠️';
  }
};

const getViolationTitle = (type: string): string => {
  switch (type) {
    case 'MAX_SHIFT_LENGTH':
      return 'STOP: Shift Too Long';
    case 'INSUFFICIENT_REST':
      return 'STOP: Rest Period Too Short';
    case 'MAX_WEEKLY_HOURS':
      return 'STOP: Weekly Hours Exceeded';
    case 'LEVEL_1_EXCEEDANCE':
      return 'Level 1: Requires Risk Assessment';
    case 'LEVEL_2_EXCEEDANCE':
      return 'Level 2: Requires Risk Assessment';
    case 'APPROACHING_WEEKLY_LIMIT':
      return 'Warning: Approaching Weekly Limit';
    case 'MAX_CONSECUTIVE_DAYS':
      return 'STOP: Too Many Consecutive Days';
    case 'CONSECUTIVE_DAYS_WARNING':
      return 'Warning: Extended Working Days';
    case 'CONSECUTIVE_NIGHTS_WARNING':
      return 'Warning: Extended Night Shift Run';
    case 'MAX_CONSECUTIVE_NIGHTS':
      return 'STOP: Too Many Consecutive Nights';
    case 'DAY_NIGHT_TRANSITION':
      return 'STOP: Day-Night Transition Same Day';
    case 'MULTIPLE_SHIFTS_SAME_DAY':
      return 'STOP: Multiple Shifts Same Day';
    case 'ELEVATED_FATIGUE_INDEX':
      return 'STOP: Fatigue Risk Index Exceeded';
    default:
      return 'Compliance Issue';
  }
};

// Get colors based on 4-tier severity system
const getSeverityColors = (severity: string) => {
  switch (severity) {
    case 'breach':
      return {
        border: '#ef4444',    // red-500
        bg: '#fef2f2',        // red-50
        bgHover: '#fee2e2',   // red-100
        icon: '#b91c1c',      // red-700
        title: '#991b1b',     // red-800
        text: '#7f1d1d',      // red-900
      };
    case 'level2':
      return {
        border: '#f97316',    // orange-500
        bg: '#fff7ed',        // orange-50
        bgHover: '#ffedd5',   // orange-100
        icon: '#c2410c',      // orange-700
        title: '#9a3412',     // orange-800
        text: '#7c2d12',      // orange-900
      };
    case 'level1':
      return {
        border: '#eab308',    // yellow-500
        bg: '#fefce8',        // yellow-50
        bgHover: '#fef9c3',   // yellow-100
        icon: '#a16207',      // yellow-700
        title: '#854d0e',     // yellow-800
        text: '#713f12',      // yellow-900
      };
    default: // warning
      return {
        border: '#6b7280',    // gray-500
        bg: '#f9fafb',        // gray-50
        bgHover: '#f3f4f6',   // gray-100
        icon: '#374151',      // gray-700
        title: '#1f2937',     // gray-800
        text: '#111827',      // gray-900
      };
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
          Compliance Issues ({violations.length})
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
              borderColor: getSeverityColors(violation.severity).border,
              bgcolor: getSeverityColors(violation.severity).bg,
              '&:hover': {
                boxShadow: 2,
                bgcolor: getSeverityColors(violation.severity).bgHover,
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box
                sx={{
                  color: getSeverityColors(violation.severity).icon,
                  mt: 0.25,
                }}
              >
                {violation.severity === 'breach' ? (
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
                    color: getSeverityColors(violation.severity).title,
                  }}
                >
                  {getViolationIcon(violation.type)} {getViolationTitle(violation.type)}
                </Typography>
                <Typography
                  variant="caption"
                  display="block"
                  sx={{
                    color: getSeverityColors(violation.severity).text,
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
