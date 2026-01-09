'use client';

import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import { Calendar, Edit2, Trash2, X } from '@/components/ui/Icons';
import type { AssignmentCamel, ShiftPatternCamel, ProjectCamel, NetworkRailPeriod } from '@/lib/types';

// Helper to get FRI chip colors for MUI
const getFRIChipSx = (fri: number | null | undefined) => {
  if (fri === null || fri === undefined) return { bgcolor: 'grey.200', color: 'grey.700' };
  if (fri >= 1.2) return { bgcolor: '#dc2626', color: 'white' };
  if (fri >= 1.1) return { bgcolor: '#f97316', color: 'white' };
  if (fri >= 1.0) return { bgcolor: '#eab308', color: 'white' };
  return { bgcolor: '#22c55e', color: 'white' };
};

// Helper to get NR compliance chip colors for MUI (5-tier system)
const getNRComplianceChipSx = (severity: 'breach' | 'level2' | 'level1' | 'warning' | 'info' | null) => {
  if (severity === 'breach') return { bgcolor: '#ef4444', color: 'white' };  // Red - breach
  if (severity === 'level2') return { bgcolor: '#f97316', color: 'white' };  // Orange/Amber - Level 2
  if (severity === 'level1') return { bgcolor: '#eab308', color: 'white' };  // Yellow - Level 1
  if (severity === 'warning') return { bgcolor: '#6b7280', color: 'white' }; // Gray - warning
  if (severity === 'info') return { bgcolor: '#22c55e', color: 'white' };    // Green - Good Practice info
  return { bgcolor: '#22c55e', color: 'white' };  // Green - compliant
};

// Helper to get FRI cell background colors
const getFRICellSx = (fri: number | null | undefined) => {
  if (fri === null || fri === undefined) return { bgcolor: 'white', borderColor: 'grey.200' };
  if (fri >= 1.2) return { bgcolor: '#fecaca', borderColor: '#dc2626' }; // Red - High risk
  if (fri >= 1.1) return { bgcolor: '#fed7aa', borderColor: '#f97316' }; // Orange - Elevated risk
  if (fri >= 1.0) return { bgcolor: '#fef3c7', borderColor: '#eab308' }; // Yellow/Amber - Moderate risk
  return { bgcolor: '#bbf7d0', borderColor: '#22c55e' }; // Green - Low risk
};

interface FatigueResult {
  riskIndex: number;
  fatigueIndex: number;
}

interface ScheduleCalendarProps {
  currentPeriod: NetworkRailPeriod | undefined;
  calendarDates: string[];
  calendarDayHeaders: string[];
  periodAssignments: AssignmentCamel[];
  shiftPatterns: ShiftPatternCamel[];
  projects: ProjectCamel[];
  violationAssignmentSeverity: Map<number, 'breach' | 'level2' | 'level1' | 'warning' | 'info'>;
  fatigueResults: FatigueResult[] | null;
  highlightedDate: string | null;
  showFRI: boolean;
  onEditAssignment?: (assignment: AssignmentCamel) => void;
  onDeleteAssignment: (assignment: AssignmentCamel) => void;
  onBulkDeleteAssignments?: (assignments: AssignmentCamel[]) => Promise<void>;
  onAddShift?: (date: string) => void;
}

const formatDateHeader = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return {
    day: d.toLocaleDateString('en-GB', { weekday: 'short' }),
    date: d.getDate(),
    month: d.toLocaleDateString('en-GB', { month: 'short' }),
    isWeekend: d.getDay() === 0 || d.getDay() === 6,
    isToday: dateStr === new Date().toISOString().split('T')[0],
  };
};

const hasCustomTimes = (assignment: AssignmentCamel, pattern: ShiftPatternCamel | undefined): boolean => {
  if (!pattern) return false;
  const hasCustomStart = assignment.customStartTime && assignment.customStartTime !== pattern.startTime;
  const hasCustomEnd = assignment.customEndTime && assignment.customEndTime !== pattern.endTime;
  return !!(hasCustomStart || hasCustomEnd);
};

const getAssignmentDisplayName = (assignment: AssignmentCamel, pattern: ShiftPatternCamel | undefined): string => {
  if (!pattern) return 'Unknown';
  if (hasCustomTimes(assignment, pattern)) return 'Custom';
  return pattern.name;
};

export function ScheduleCalendar({
  currentPeriod,
  calendarDates,
  calendarDayHeaders,
  periodAssignments,
  shiftPatterns,
  projects,
  violationAssignmentSeverity,
  fatigueResults,
  highlightedDate,
  showFRI,
  onEditAssignment,
  onDeleteAssignment,
  onBulkDeleteAssignments,
  onAddShift,
}: ScheduleCalendarProps) {
  // Multi-select state
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<number>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const getAssignmentInfo = (assignment: AssignmentCamel) => {
    const pattern = shiftPatterns.find((p) => p.id === assignment.shiftPatternId);
    const project = projects.find((p) => p.id === assignment.projectId);
    return { pattern, project };
  };

  // Handle assignment click with Ctrl support for multi-select
  const handleAssignmentClick = useCallback((assignment: AssignmentCamel, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // Multi-select mode
      event.preventDefault();
      event.stopPropagation();
      setSelectedAssignmentIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(assignment.id)) {
          newSet.delete(assignment.id);
        } else {
          newSet.add(assignment.id);
        }
        return newSet;
      });
    }
  }, []);

  // Handle delete click - if item is selected and there are multiple selections, trigger bulk delete
  const handleDeleteClick = useCallback((assignment: AssignmentCamel, event: React.MouseEvent) => {
    event.stopPropagation();

    // If this assignment is selected and there are multiple selections, do bulk delete
    if (selectedAssignmentIds.has(assignment.id) && selectedAssignmentIds.size > 1) {
      setShowBulkDeleteConfirm(true);
    } else {
      // Single delete
      onDeleteAssignment(assignment);
    }
  }, [selectedAssignmentIds, onDeleteAssignment]);

  // Perform bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (!onBulkDeleteAssignments) return;

    setBulkDeleting(true);
    try {
      const assignmentsToDelete = periodAssignments.filter(a => selectedAssignmentIds.has(a.id));
      await onBulkDeleteAssignments(assignmentsToDelete);
      setSelectedAssignmentIds(new Set());
      setShowBulkDeleteConfirm(false);
    } finally {
      setBulkDeleting(false);
    }
  }, [onBulkDeleteAssignments, periodAssignments, selectedAssignmentIds]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedAssignmentIds(new Set());
  }, []);

  // Get selected assignments for display
  const selectedAssignments = periodAssignments.filter(a => selectedAssignmentIds.has(a.id));

  return (
    <Paper id="schedule-calendar" sx={{ mb: 2, scrollMarginTop: 16 }} data-testid="schedule-calendar">
      <Box
        sx={{
          p: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Calendar className="w-4 h-4" />
          <Typography variant="subtitle2" fontWeight={600}>
            Schedule - {currentPeriod?.name}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.65rem' }}>
            <Typography variant="caption" fontWeight={500} color="text.secondary">
              Chip (NR):
            </Typography>
            <Chip
              label="Prohibited"
              size="small"
              sx={{ bgcolor: '#ef4444', color: 'white', fontSize: '0.6rem', height: 18 }}
            />
            <Chip
              label="Level 2"
              size="small"
              sx={{ bgcolor: '#f97316', color: 'white', fontSize: '0.6rem', height: 18 }}
            />
            <Chip
              label="Level 1"
              size="small"
              sx={{ bgcolor: '#eab308', color: 'white', fontSize: '0.6rem', height: 18 }}
            />
            <Chip
              label="OK"
              size="small"
              sx={{ bgcolor: '#22c55e', color: 'white', fontSize: '0.6rem', height: 18 }}
            />
          </Box>
          {showFRI && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.65rem' }}>
              <Typography variant="caption" fontWeight={500} color="text.secondary">
                Cell (FRI):
              </Typography>
              <Chip label="<1.0" size="small" sx={{ bgcolor: '#bbf7d0', fontSize: '0.6rem', height: 18 }} />
              <Chip label="1.0-1.1" size="small" sx={{ bgcolor: '#fef3c7', fontSize: '0.6rem', height: 18 }} />
              <Chip label="1.1-1.2" size="small" sx={{ bgcolor: '#fed7aa', fontSize: '0.6rem', height: 18 }} />
              <Chip label=">=1.2" size="small" sx={{ bgcolor: '#fecaca', fontSize: '0.6rem', height: 18 }} />
            </Box>
          )}
        </Box>
      </Box>

      {/* Multi-select action bar */}
      {selectedAssignmentIds.size > 0 && (
        <Box
          sx={{
            p: 1,
            bgcolor: 'primary.50',
            borderBottom: 1,
            borderColor: 'primary.light',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" fontWeight={500} color="primary.main">
              {selectedAssignmentIds.size} shift{selectedAssignmentIds.size !== 1 ? 's' : ''} selected
            </Typography>
            <Typography variant="caption" color="text.secondary">
              (Ctrl+Click to select more)
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={clearSelection}
              startIcon={<X className="w-3 h-3" />}
              sx={{ textTransform: 'none', fontSize: '0.75rem' }}
            >
              Clear
            </Button>
            {onBulkDeleteAssignments && (
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={() => setShowBulkDeleteConfirm(true)}
                startIcon={<Trash2 className="w-3 h-3" />}
                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
              >
                Delete Selected
              </Button>
            )}
          </Box>
        </Box>
      )}

      <Box sx={{ p: 1.5, overflow: 'auto' }}>
        {/* Day Headers */}
        <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
          <Box sx={{ width: 40, minWidth: 40 }} />
          <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.5, alignItems: 'start' }}>
            {calendarDayHeaders.map((day) => (
              <Typography key={day} variant="caption" fontWeight={600} textAlign="center" color="text.secondary">
                {day}
              </Typography>
            ))}
          </Box>
        </Box>

        {/* Calendar Grid */}
        {[0, 1, 2, 3].map((weekIdx) => {
          const weekDates = calendarDates.slice(weekIdx * 7, (weekIdx + 1) * 7);
          const firstDateOfWeek = weekDates[0];
          const weekMonthName = firstDateOfWeek ? formatDateHeader(firstDateOfWeek).month : '';

          return (
            <Box key={weekIdx} sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
              <Box sx={{ width: 40, minWidth: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  {weekMonthName}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.5, alignItems: 'start' }}>
                {weekDates.map((date) => {
                  const { date: dateNum, isWeekend, isToday } = formatDateHeader(date);
                  const dateAssignments = periodAssignments.filter((a) => a.date === date);
                  // Severity priority: breach > level2 > level1 > warning > info
                  const severityPriority: Record<string, number> = { breach: 5, level2: 4, level1: 3, warning: 2, info: 1 };
                  const dateViolationSeverity = dateAssignments.reduce<'breach' | 'level2' | 'level1' | 'warning' | 'info' | null>((worst, a) => {
                    const severity = violationAssignmentSeverity.get(a.id);
                    if (!severity) return worst;
                    const newPriority = severityPriority[severity] || 0;
                    const worstPriority = worst ? severityPriority[worst] || 0 : 0;
                    if (newPriority > worstPriority) return severity;
                    return worst;
                  }, null);
                  const dateAssignmentIndices = periodAssignments
                    .map((a, idx) => (a.date === date ? idx : -1))
                    .filter((i) => i !== -1);
                  const dateFRI =
                    dateAssignmentIndices.length > 0 && fatigueResults
                      ? Math.max(...dateAssignmentIndices.map((i) => fatigueResults[i]?.riskIndex || 0))
                      : null;
                  const dateFGI =
                    dateAssignmentIndices.length > 0 && fatigueResults
                      ? Math.max(...dateAssignmentIndices.map((i) => fatigueResults[i]?.fatigueIndex || 0))
                      : null;
                  const isHighlighted = highlightedDate === date;
                  const hasAssignments = dateAssignments.length > 0;
                  const hasMultipleAssignments = dateAssignments.length > 1;

                  return (
                    <Box
                      key={date}
                      data-testid={`calendar-cell-${date}`}
                      sx={{
                        minHeight: 95,
                        // Allow cell to grow for multiple assignments
                        height: hasMultipleAssignments ? 'auto' : 95,
                        maxHeight: hasMultipleAssignments ? 'none' : 95,
                        p: 0.75,
                        borderRadius: 1,
                        border: 2,
                        transition: 'all 0.2s',
                        overflow: hasMultipleAssignments ? 'visible' : 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        ...(isHighlighted
                          ? {
                              bgcolor: 'primary.light',
                              borderColor: 'primary.main',
                              boxShadow: 4,
                              transform: 'scale(1.02)',
                              zIndex: 10,
                              animation: 'pulse 1s infinite',
                            }
                          : showFRI && hasAssignments && dateFRI !== null
                          ? getFRICellSx(dateFRI)
                          : isWeekend
                          ? { bgcolor: 'grey.100', borderColor: 'grey.200' }
                          : isToday
                          ? { bgcolor: 'primary.50', borderColor: 'primary.light' }
                          : { bgcolor: 'white', borderColor: 'grey.200' }),
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography
                            variant="caption"
                            fontWeight={600}
                            sx={{ color: isToday ? 'primary.main' : 'text.primary' }}
                          >
                            {dateNum}
                          </Typography>
                          {hasMultipleAssignments && (
                            <Chip
                              label={`${dateAssignments.length} shifts`}
                              size="small"
                              color="warning"
                              sx={{ fontSize: '0.5rem', height: 14, '& .MuiChip-label': { px: 0.5 } }}
                            />
                          )}
                        </Box>
                        {showFRI && dateFRI !== null && (
                          <Box sx={{ display: 'flex', gap: 0.25, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <Chip
                              label={`R:${dateFRI.toFixed(2)}`}
                              size="small"
                              sx={{ ...getFRIChipSx(dateFRI), fontSize: '0.5rem', height: 14, fontWeight: 700, '& .MuiChip-label': { px: 0.5 } }}
                            />
                            {dateFGI !== null && (
                              <Chip
                                label={`F:${dateFGI.toFixed(1)}`}
                                size="small"
                                sx={{
                                  fontSize: '0.5rem',
                                  height: 14,
                                  fontWeight: 700,
                                  bgcolor: dateFGI >= 35 ? '#ef4444' : dateFGI >= 25 ? '#f97316' : dateFGI >= 17.5 ? '#eab308' : '#22c55e',
                                  color: 'white',
                                  '& .MuiChip-label': { px: 0.5 }
                                }}
                              />
                            )}
                          </Box>
                        )}
                      </Box>

                      {dateAssignments.length === 0 ? (
                        onAddShift ? (
                          <Box
                            onClick={() => onAddShift(date)}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              py: 0.5,
                              cursor: 'pointer',
                              borderRadius: 0.5,
                              border: '1px dashed',
                              borderColor: 'grey.300',
                              color: 'grey.400',
                              fontSize: '0.7rem',
                              transition: 'all 0.15s',
                              '&:hover': {
                                borderColor: 'primary.main',
                                bgcolor: 'rgba(25, 118, 210, 0.08)',
                                color: 'primary.main',
                              },
                            }}
                          >
                            + Add
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.disabled" textAlign="center" display="block">
                            -
                          </Typography>
                        )
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mx: 0.25, mb: 0.25, alignItems: 'stretch' }}>
                          {dateAssignments.map((assignment) => {
                            const { pattern, project } = getAssignmentInfo(assignment);
                            const assignmentViolation = violationAssignmentSeverity.get(assignment.id) || null;
                            const isSelected = selectedAssignmentIds.has(assignment.id);
                            return (
                              <Box
                                key={assignment.id}
                                data-testid={`assignment-${assignment.id}`}
                                onClick={(e) => handleAssignmentClick(assignment, e)}
                                sx={{
                                  position: 'relative',
                                  borderRadius: 0.5,
                                  p: 0.5,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                  flexShrink: 0,
                                  ...getNRComplianceChipSx(assignmentViolation),
                                  // Selection styling
                                  ...(isSelected && {
                                    outline: '3px solid',
                                    outlineColor: 'primary.main',
                                    outlineOffset: 1,
                                    boxShadow: '0 0 8px rgba(25, 118, 210, 0.5)',
                                  }),
                                  '&:hover': {
                                    opacity: 0.9,
                                  },
                                }}
                              >
                                <Box sx={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: 0.25 }}>
                                  {onEditAssignment && (
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onEditAssignment(assignment);
                                      }}
                                      sx={{ p: 0.25, color: 'inherit', opacity: 0.8, '&:hover': { opacity: 1 } }}
                                      aria-label="Edit assignment"
                                    >
                                      <Edit2 className="w-2.5 h-2.5" />
                                    </IconButton>
                                  )}
                                  <IconButton
                                    size="small"
                                    onClick={(e) => handleDeleteClick(assignment, e)}
                                    sx={{ p: 0.25, color: 'inherit', opacity: 0.8, '&:hover': { opacity: 1 } }}
                                    aria-label={isSelected && selectedAssignmentIds.size > 1 ? 'Delete selected assignments' : 'Delete assignment'}
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </IconButton>
                                </Box>
                                <Typography
                                  variant="caption"
                                  fontWeight={500}
                                  sx={{
                                    pr: 4,
                                    display: 'block',
                                    fontSize: '0.6rem',
                                    lineHeight: 1.2,
                                    wordBreak: 'break-word',
                                    overflowWrap: 'break-word',
                                    hyphens: 'auto'
                                  }}
                                >
                                  {project?.name || 'Unknown'}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  fontWeight={500}
                                  sx={{
                                    pr: 4,
                                    display: 'block',
                                    fontSize: '0.6rem',
                                    lineHeight: 1.2,
                                    wordBreak: 'break-word',
                                    overflowWrap: 'break-word',
                                    hyphens: 'auto'
                                  }}
                                >
                                  {getAssignmentDisplayName(assignment, pattern)}
                                </Typography>
                                <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.55rem', pb: 0.25 }}>
                                  {assignment.customStartTime || pattern?.startTime || '?'}-
                                  {assignment.customEndTime || pattern?.endTime || '?'}
                                </Typography>
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog
        open={showBulkDeleteConfirm}
        onClose={() => !bulkDeleting && setShowBulkDeleteConfirm(false)}
      >
        <DialogTitle>Delete {selectedAssignmentIds.size} Shifts?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the following {selectedAssignmentIds.size} shift{selectedAssignmentIds.size !== 1 ? 's' : ''}?
          </DialogContentText>
          <Box sx={{ mt: 2, maxHeight: 200, overflow: 'auto' }}>
            {selectedAssignments.map(assignment => {
              const { pattern, project } = getAssignmentInfo(assignment);
              return (
                <Box key={assignment.id} sx={{ py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="body2" fontWeight={500}>
                    {new Date(assignment.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {project?.name} - {pattern?.name || 'Custom'} ({assignment.customStartTime || pattern?.startTime}-{assignment.customEndTime || pattern?.endTime})
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowBulkDeleteConfirm(false)}
            disabled={bulkDeleting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleBulkDelete}
            color="error"
            variant="contained"
            disabled={bulkDeleting}
          >
            {bulkDeleting ? 'Deleting...' : `Delete ${selectedAssignmentIds.size} Shift${selectedAssignmentIds.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export { getFRIChipSx, getNRComplianceChipSx, getFRICellSx, formatDateHeader, hasCustomTimes, getAssignmentDisplayName };
