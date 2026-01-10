'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import { AlertTriangle, XCircle, FileText, CheckCircle, Eye } from '@/components/ui/Icons';
import type { ComplianceViolation } from '@/lib/compliance';
import type { FatigueAssessment } from '@/lib/types';

interface ViolationsListProps {
  violations: ComplianceViolation[];
  onViolationClick: (violation: ComplianceViolation) => void;
  onCreateAssessment?: (violation: ComplianceViolation) => void;
  assessments?: FatigueAssessment[];
  onViewAssessment?: (assessmentId: string) => void;
}

const getViolationIcon = (type: string): string => {
  // No emojis - return empty string
  return '';
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

// Check if violation requires FAMP assessment
const requiresAssessment = (type: string): boolean => {
  return ['LEVEL_1_EXCEEDANCE', 'LEVEL_2_EXCEEDANCE', 'ELEVATED_FATIGUE_INDEX'].includes(type);
};

// Find matching assessment for a violation
const findMatchingAssessment = (
  violation: ComplianceViolation,
  assessments: FatigueAssessment[]
): FatigueAssessment | undefined => {
  return assessments.find(
    a => a.violationType === violation.type && a.violationDate === violation.date
  );
};

// Get status display info
const getStatusInfo = (status: string) => {
  switch (status) {
    case 'completed':
      return { label: 'FAMP Completed', color: 'success' as const };
    case 'pending_manager':
      return { label: 'Awaiting Manager', color: 'warning' as const };
    case 'pending_employee':
      return { label: 'Awaiting Employee', color: 'info' as const };
    case 'draft':
      return { label: 'FAMP Draft', color: 'default' as const };
    default:
      return { label: 'In Progress', color: 'default' as const };
  }
};

export function ViolationsList({
  violations,
  onViolationClick,
  onCreateAssessment,
  assessments = [],
  onViewAssessment,
}: ViolationsListProps) {
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
        {sortedViolations.map((violation, idx) => {
          const matchingAssessment = requiresAssessment(violation.type)
            ? findMatchingAssessment(violation, assessments)
            : undefined;
          const hasAssessment = !!matchingAssessment;
          const statusInfo = matchingAssessment ? getStatusInfo(matchingAssessment.status) : null;

          return (
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
                borderColor: hasAssessment && matchingAssessment?.status === 'completed'
                  ? '#22c55e' // green for completed
                  : getSeverityColors(violation.severity).border,
                bgcolor: hasAssessment && matchingAssessment?.status === 'completed'
                  ? '#f0fdf4' // green-50 for completed
                  : getSeverityColors(violation.severity).bg,
                '&:hover': {
                  boxShadow: 2,
                  bgcolor: hasAssessment && matchingAssessment?.status === 'completed'
                    ? '#dcfce7' // green-100 for completed hover
                    : getSeverityColors(violation.severity).bgHover,
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Box
                  sx={{
                    color: hasAssessment && matchingAssessment?.status === 'completed'
                      ? '#16a34a' // green-600 for completed
                      : getSeverityColors(violation.severity).icon,
                    mt: 0.25,
                  }}
                >
                  {hasAssessment && matchingAssessment?.status === 'completed' ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : violation.severity === 'breach' ? (
                    <XCircle className="w-3 h-3" />
                  ) : (
                    <AlertTriangle className="w-3 h-3" />
                  )}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography
                      variant="caption"
                      fontWeight={600}
                      sx={{
                        color: hasAssessment && matchingAssessment?.status === 'completed'
                          ? '#166534' // green-800 for completed
                          : getSeverityColors(violation.severity).title,
                      }}
                    >
                      {getViolationIcon(violation.type)} {getViolationTitle(violation.type)}
                    </Typography>
                    {hasAssessment && statusInfo && (
                      <Chip
                        label={statusInfo.label}
                        size="small"
                        color={statusInfo.color}
                        sx={{ height: 18, fontSize: '0.6rem' }}
                      />
                    )}
                  </Box>
                  <Typography
                    variant="caption"
                    display="block"
                    sx={{
                      color: hasAssessment && matchingAssessment?.status === 'completed'
                        ? '#15803d' // green-700 for completed
                        : getSeverityColors(violation.severity).text,
                    }}
                  >
                    {violation.message}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <Typography variant="caption" sx={{ color: '#374151' }}>
                      {new Date(violation.date).toLocaleDateString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Typography>
                    {requiresAssessment(violation.type) && (
                      hasAssessment ? (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onViewAssessment && matchingAssessment) {
                              onViewAssessment(matchingAssessment.id);
                            }
                          }}
                          startIcon={<Eye className="w-3 h-3" />}
                          sx={{
                            fontSize: '0.65rem',
                            py: 0.25,
                            px: 0.75,
                            minHeight: 0,
                            borderColor: '#22c55e',
                            color: '#166534',
                            '&:hover': {
                              borderColor: '#16a34a',
                              bgcolor: '#dcfce7',
                            },
                          }}
                        >
                          View FAMP
                        </Button>
                      ) : onCreateAssessment && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCreateAssessment(violation);
                          }}
                          startIcon={<FileText className="w-3 h-3" />}
                          sx={{
                            fontSize: '0.65rem',
                            py: 0.25,
                            px: 0.75,
                            minHeight: 0,
                            borderColor: getSeverityColors(violation.severity).border,
                            color: getSeverityColors(violation.severity).title,
                            '&:hover': {
                              borderColor: getSeverityColors(violation.severity).icon,
                              bgcolor: getSeverityColors(violation.severity).bgHover,
                            },
                          }}
                        >
                          Create FAMP
                        </Button>
                      )
                    )}
                    <Box
                      component="span"
                      sx={{ color: 'primary.main', fontWeight: 500, fontSize: '0.7rem' }}
                    >
                      → View
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

export { getViolationIcon, getViolationTitle };
