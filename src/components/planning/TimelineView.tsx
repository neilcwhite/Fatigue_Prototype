'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import { Edit2, Trash2, AlertTriangle, AlertCircle } from '@/components/ui/Icons';
import { checkEmployeeCompliance, getDateCellViolations, type ComplianceViolation } from '@/lib/compliance';
import type {
  ProjectCamel,
  EmployeeCamel,
  AssignmentCamel,
  ShiftPatternCamel,
  NetworkRailPeriod
} from '@/lib/types';
import { useNotification } from '@/hooks/useNotification';

interface TimelineViewProps {
  project: ProjectCamel;
  employees: EmployeeCamel[];
  shiftPatterns: ShiftPatternCamel[];
  assignments: AssignmentCamel[];
  /** All assignments across all projects - used for cross-project compliance checking */
  allAssignments?: AssignmentCamel[];
  /** All shift patterns across all projects - used for cross-project compliance checking */
  allShiftPatterns?: ShiftPatternCamel[];
  period: NetworkRailPeriod;
  onCellDragOver: (e: React.DragEvent) => void;
  onCellDrop: (e: React.DragEvent, shiftPatternId: string, date: string, isValidCell?: boolean) => void;
  onDeleteAssignment: (id: number) => Promise<void>;
  onEditAssignment?: (assignment: AssignmentCamel) => void;
  onNavigateToPerson?: (employeeId: number) => void;
  onCreateAssignment?: (data: {
    employeeId: number;
    projectId: number;
    shiftPatternId: string;
    date: string;
    customStartTime?: string;
    customEndTime?: string;
  }) => Promise<void>;
}

// Copy dialog state
interface CopyShiftDialogState {
  open: boolean;
  sourceDate: string;
  sourcePatternId: string;
  sourcePatternName: string;
  employeeAssignments: AssignmentCamel[];
}

export function TimelineView({
  project,
  employees,
  shiftPatterns,
  assignments,
  allAssignments,
  allShiftPatterns,
  period,
  onCellDragOver,
  onCellDrop,
  onDeleteAssignment,
  onEditAssignment,
  onNavigateToPerson,
  onCreateAssignment,
}: TimelineViewProps) {
  // Use all assignments/patterns for compliance (cross-project), fall back to project-only
  const complianceAssignments = allAssignments || assignments;
  const compliancePatterns = allShiftPatterns || shiftPatterns;
  const { showSuccess, showError } = useNotification();
  // Copy shift dialog state
  const [copyDialog, setCopyDialog] = useState<CopyShiftDialogState | null>(null);
  const [selectedTargetDates, setSelectedTargetDates] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  // Generate 28 days from period start
  const dates = useMemo(() => {
    const result: string[] = [];
    const startDate = new Date(period.startDate);

    for (let i = 0; i < 28; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      result.push(date.toISOString().split('T')[0]);
    }

    return result;
  }, [period.startDate]);

  // Close dialog on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && copyDialog) {
        setCopyDialog(null);
        setSelectedTargetDates(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copyDialog]);

  // Build compliance violations map for all employees
  // Uses ALL assignments across projects to detect cross-project conflicts
  const complianceByEmployee = useMemo(() => {
    const result = new Map<number, ComplianceViolation[]>();

    // Check employees who have assignments on THIS project
    const employeeIds = [...new Set(assignments.map(a => a.employeeId))];

    for (const empId of employeeIds) {
      // Pass ALL assignments to catch cross-project violations
      const compliance = checkEmployeeCompliance(empId, complianceAssignments, compliancePatterns);
      result.set(empId, compliance.violations);
    }

    return result;
  }, [assignments, complianceAssignments, compliancePatterns]);

  // Get violations for an employee on a specific date
  const getViolationsForCell = (employeeId: number, date: string): ComplianceViolation[] => {
    const violations = complianceByEmployee.get(employeeId) || [];
    return getDateCellViolations(employeeId, date, violations);
  };

  // Check if employee has any future violations (from given date onwards)
  const hasFutureViolations = (employeeId: number, fromDate: string): { hasWarning: boolean; hasError: boolean } => {
    const violations = complianceByEmployee.get(employeeId) || [];
    const fromDateObj = new Date(fromDate);

    const futureViolations = violations.filter(v => {
      const violationDate = new Date(v.date);
      return violationDate >= fromDateObj;
    });

    return {
      hasWarning: futureViolations.some(v => v.severity === 'warning' || v.severity === 'level1'),
      hasError: futureViolations.some(v => v.severity === 'breach' || v.severity === 'level2'),
    };
  };

  // Check if shift pattern has hours for a given day
  const shiftPatternHasHoursForDay = (pattern: ShiftPatternCamel, dateStr: string): boolean => {
    if (pattern.id.endsWith('-custom')) {
      const hasAssignmentOnDate = assignments.some(
        a => a.shiftPatternId === pattern.id && a.date === dateStr
      );
      return hasAssignmentOnDate;
    }

    if (pattern.weeklySchedule) {
      const dayOfWeek = new Date(dateStr).getDay();
      const dayNames: ('Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat')[] =
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayKey = dayNames[dayOfWeek];
      const daySchedule = pattern.weeklySchedule[dayKey];
      return !!(daySchedule?.startTime && daySchedule?.endTime);
    }

    return !!(pattern.startTime && pattern.endTime);
  };

  // Get employee name by ID
  const getEmployeeName = (employeeId: number): string => {
    return employees.find(e => e.id === employeeId)?.name || 'Unknown';
  };

  // Handle cell click (on background, not on employee name) to open copy dialog
  const handleCellBackgroundClick = useCallback((
    e: React.MouseEvent,
    patternId: string,
    patternName: string,
    date: string,
    cellAssignments: AssignmentCamel[]
  ) => {
    // Only trigger if clicking on the cell background, not on employee tiles
    const target = e.target as HTMLElement;
    if (target.closest('[data-employee-tile]')) {
      return; // Clicked on an employee tile, not background
    }

    // Only show dialog if there are assignments to copy
    if (cellAssignments.length === 0) return;

    setCopyDialog({
      open: true,
      sourceDate: date,
      sourcePatternId: patternId,
      sourcePatternName: patternName,
      employeeAssignments: cellAssignments,
    });
    setSelectedTargetDates(new Set());
  }, []);

  // Handle delete with confirmation
  const handleDelete = async (assignmentId: number, employeeId: number) => {
    const employeeName = getEmployeeName(employeeId);
    if (confirm(`Remove ${employeeName} from this shift?`)) {
      try {
        await onDeleteAssignment(assignmentId);
      } catch (err) {
        console.error('Error deleting assignment:', err);
        showError('Failed to delete assignment');
      }
    }
  };

  // Execute copy to selected dates
  const handleExecuteCopy = async () => {
    if (!onCreateAssignment || !copyDialog || selectedTargetDates.size === 0) return;

    setIsProcessing(true);
    try {
      const targetDates = Array.from(selectedTargetDates);
      const isCustomPattern = copyDialog.sourcePatternId.endsWith('-custom');

      for (const assignment of copyDialog.employeeAssignments) {
        for (const targetDate of targetDates) {
          // Check if assignment already exists for this employee on this date in this pattern
          const exists = assignments.some(
            a => a.employeeId === assignment.employeeId &&
                 a.shiftPatternId === assignment.shiftPatternId &&
                 a.date === targetDate
          );

          if (!exists) {
            // For Custom pattern, preserve custom times; for regular patterns, don't include times
            await onCreateAssignment({
              employeeId: assignment.employeeId,
              projectId: assignment.projectId,
              shiftPatternId: assignment.shiftPatternId,
              date: targetDate,
              ...(isCustomPattern && assignment.customStartTime && assignment.customEndTime
                ? { customStartTime: assignment.customStartTime, customEndTime: assignment.customEndTime }
                : {}),
            });
          }
        }
      }

      // Close dialog
      setCopyDialog(null);
      setSelectedTargetDates(new Set());
      showSuccess('Assignments copied successfully');
    } catch (err) {
      console.error('Error copying assignments:', err);
      showError('Failed to copy some assignments');
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle date selection in dialog
  const toggleDateSelection = (date: string) => {
    setSelectedTargetDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  // Get valid dates for copy target (dates that are part of the shift pattern and not the source date)
  const getValidCopyTargetDates = useMemo(() => {
    if (!copyDialog) return [];
    const pattern = shiftPatterns.find(p => p.id === copyDialog.sourcePatternId);
    if (!pattern) return [];

    return dates.filter(date => {
      if (date === copyDialog.sourceDate) return false; // Exclude source date
      return shiftPatternHasHoursForDay(pattern, date);
    });
  }, [copyDialog, dates, shiftPatterns]);

  // Format date for header
  const formatDateHeader = (dateStr: string) => {
    const d = new Date(dateStr);
    return {
      day: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      date: `${d.getDate()}/${d.getMonth() + 1}`,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    };
  };

  // Get tile color based on violations (4-tier NR system)
  // - violations: violations on THIS specific date (fill color)
  // - futureViolations: whether employee has any violations from this date onwards (border)
  const getTileStyle = (
    violations: ComplianceViolation[],
    futureViolations?: { hasWarning: boolean; hasError: boolean }
  ) => {
    // Current date has a violation - change fill color
    const hasBreach = violations.some(v => v.severity === 'breach');
    const hasLevel2 = violations.some(v => v.severity === 'level2');
    const hasLevel1 = violations.some(v => v.severity === 'level1');
    const hasWarning = violations.some(v => v.severity === 'warning');

    // Future violations - change border color (but not fill unless this date is a violation)
    const hasFutureError = futureViolations?.hasError || false;
    const hasFutureWarning = futureViolations?.hasWarning || false;

    // Fill color based on THIS date's violations (4-tier)
    let fillClass = 'bg-green-100 text-green-800';
    if (hasBreach) {
      fillClass = 'bg-red-100 text-red-800';
    } else if (hasLevel2) {
      fillClass = 'bg-orange-100 text-orange-800';
    } else if (hasLevel1) {
      fillClass = 'bg-yellow-100 text-yellow-800';
    } else if (hasWarning) {
      fillClass = 'bg-gray-100 text-gray-800';
    }

    // Border based on future violations (shows upcoming issues)
    let borderClass = 'border border-green-300';
    if (hasBreach || hasFutureError) {
      borderClass = 'border-2 border-red-400';
    } else if (hasLevel2) {
      borderClass = 'border-2 border-orange-400';
    } else if (hasLevel1 || hasFutureWarning) {
      borderClass = 'border-2 border-yellow-400';
    } else if (hasWarning) {
      borderClass = 'border border-gray-400';
    }

    return `${fillClass} ${borderClass}`;
  };

  // Get just the background color for the hover buttons overlay (4-tier)
  const getTileBackground = (violations: ComplianceViolation[]) => {
    const hasBreach = violations.some(v => v.severity === 'breach');
    const hasLevel2 = violations.some(v => v.severity === 'level2');
    const hasLevel1 = violations.some(v => v.severity === 'level1');
    const hasWarning = violations.some(v => v.severity === 'warning');
    if (hasBreach) return 'bg-red-100';
    if (hasLevel2) return 'bg-orange-100';
    if (hasLevel1) return 'bg-yellow-100';
    if (hasWarning) return 'bg-gray-100';
    return 'bg-green-100';
  };

  // Format violation tooltip
  const getViolationTooltip = (violations: ComplianceViolation[]): string => {
    if (violations.length === 0) return '';
    return violations.map(v => `⚠️ ${v.message}`).join('\n');
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-x-auto relative">
      <div className="min-w-max">
        {/* Header Row */}
        <div
          className="grid border-b border-slate-200"
          style={{ gridTemplateColumns: '200px repeat(28, 100px)' }}
        >
          <div className="p-3 font-semibold bg-slate-50 sticky left-0 z-10 border-r border-slate-200 text-slate-900">
            Shift Pattern
          </div>
          {dates.map((date, idx) => {
            const { day, date: dateStr, isWeekend } = formatDateHeader(date);

            return (
              <div
                key={idx}
                className={`p-2 text-center text-xs border-l border-slate-200 ${
                  isWeekend ? 'weekend-header' : 'bg-slate-50'
                }`}
              >
                <div className="font-semibold text-slate-900">{day}</div>
                <div className="text-slate-700">{dateStr}</div>
              </div>
            );
          })}
        </div>

        {/* Shift Pattern Rows */}
        {shiftPatterns.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No shift patterns defined for this project.
            <br />
            <span className="text-sm">Create a shift pattern to start planning.</span>
          </div>
        ) : (
          // Sort patterns so Custom (Ad-hoc) appears at the bottom
          [...shiftPatterns]
            .sort((a, b) => {
              const aIsCustom = a.id.endsWith('-custom');
              const bIsCustom = b.id.endsWith('-custom');
              if (aIsCustom && !bIsCustom) return 1;
              if (!aIsCustom && bIsCustom) return -1;
              return a.name.localeCompare(b.name);
            })
            .map(pattern => {
            const patternAssignments = assignments.filter(a => a.shiftPatternId === pattern.id);
            const isCustomPattern = pattern.id.endsWith('-custom');

            return (
              <div
                key={pattern.id}
                className="grid border-b border-slate-200 hover:bg-slate-50"
                style={{ gridTemplateColumns: '200px repeat(28, 100px)' }}
              >
                {/* Pattern Name Cell */}
                <div className="p-3 sticky left-0 bg-white border-r border-slate-200 z-10">
                  <div className="font-semibold text-sm text-slate-800">{pattern.name}</div>
                  {!isCustomPattern && (
                    <div className="text-xs text-slate-600">
                      {pattern.startTime || '??:??'} - {pattern.endTime || '??:??'}
                    </div>
                  )}
                  {isCustomPattern ? (
                    <div className="text-xs mt-1 text-amber-600">
                      Ad-hoc shifts
                    </div>
                  ) : (
                    <div className={`text-xs mt-1 ${
                      pattern.isNight ? 'text-purple-600' : 'text-slate-500'
                    }`}>
                      {pattern.dutyType} {pattern.isNight && '🌙'}
                    </div>
                  )}
                </div>

                {/* Day Cells */}
                {dates.map((date, idx) => {
                  const cellAssignments = patternAssignments.filter(a => a.date === date);
                  const isPartOfPattern = shiftPatternHasHoursForDay(pattern, date);

                  return (
                    <div
                      key={idx}
                      className={`border-l border-slate-200 p-1 min-h-[70px] transition-colors ${
                        !isPartOfPattern
                          ? 'weekend-hatch cursor-not-allowed'
                          : cellAssignments.length > 0
                            ? 'hover:bg-blue-50 cursor-pointer'
                            : 'hover:bg-blue-50'
                      }`}
                      onClick={(e) => handleCellBackgroundClick(e, pattern.id, pattern.name, date, cellAssignments)}
                      onDragOver={onCellDragOver}
                      onDrop={(e) => onCellDrop(e, pattern.id, date, isPartOfPattern)}
                      title={
                        !isPartOfPattern
                          ? 'This day is not part of the shift pattern'
                          : cellAssignments.length > 0
                            ? 'Click to copy this shift to other days'
                            : 'Drop employee here to assign'
                      }
                    >
                      {/* Assignment Tiles */}
                      {cellAssignments
                        .map(a => {
                          const violations = getViolationsForCell(a.employeeId, date);
                          const hasCustomTimes = !!(a.customStartTime && a.customEndTime);
                          const timeDisplay = hasCustomTimes
                            ? `${a.customStartTime}-${a.customEndTime}`
                            : null;
                          return {
                            original: a,
                            ...a,
                            employeeName: getEmployeeName(a.employeeId),
                            violations,
                            timeDisplay
                          };
                        })
                        .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
                        .map((assignment) => {
                          const hasViolations = assignment.violations.length > 0;
                          const hasError = assignment.violations.some(v => v.severity === 'breach' || v.severity === 'level2');
                          const hasWarning = assignment.violations.some(v => v.severity === 'warning' || v.severity === 'level1');

                          // Check for future violations (from this date onwards)
                          const futureViolations = hasFutureViolations(assignment.employeeId, date);
                          const hasFutureIssues = futureViolations.hasError || futureViolations.hasWarning;

                          // Handle chip click - navigate to employee page if any violations (current or future)
                          const handleChipClick = (e: React.MouseEvent) => {
                            e.stopPropagation(); // Prevent cell click from firing
                            if ((hasViolations || hasFutureIssues) && onNavigateToPerson) {
                              onNavigateToPerson(assignment.employeeId);
                            }
                          };

                          return (
                            <div
                              key={assignment.id}
                              data-employee-tile
                              onClick={handleChipClick}
                              className={`text-[10px] leading-tight px-1 py-0.5 mb-0.5 rounded group hover:opacity-90 transition-all cursor-pointer ${getTileStyle(assignment.violations, futureViolations)}`}
                              title={
                                hasViolations
                                  ? `${assignment.employeeName}${assignment.timeDisplay ? `\n${assignment.timeDisplay}` : ''}\n\n${getViolationTooltip(assignment.violations)}\n\nClick to view employee and resolve issues`
                                  : hasFutureIssues
                                    ? `${assignment.employeeName}${assignment.timeDisplay ? `\n${assignment.timeDisplay}` : ''}\n\n⚠️ Upcoming compliance issue - click to view`
                                    : assignment.timeDisplay
                                      ? `${assignment.employeeName}\n${assignment.timeDisplay}`
                                      : assignment.employeeName
                              }
                              onDragOver={onCellDragOver}
                              onDrop={(e) => onCellDrop(e, pattern.id, date, isPartOfPattern)}
                            >
                              <div className="relative flex items-center">
                                {/* Violation icon */}
                                {hasViolations && (
                                  <span className="flex-shrink-0 mr-0.5">
                                    {hasError ? (
                                      <AlertCircle className="w-2 h-2 text-red-600" />
                                    ) : hasWarning ? (
                                      <AlertTriangle className="w-2 h-2 text-amber-600" />
                                    ) : null}
                                  </span>
                                )}
                                <span className="font-medium truncate">
                                  {assignment.employeeName}
                                </span>
                                {/* Edit/Delete buttons - overlay on hover with solid background matching tile */}
                                <div className={`absolute right-0 top-0 bottom-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-r px-0.5 ${getTileBackground(assignment.violations)}`}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEditAssignment?.(assignment.original);
                                    }}
                                    className="hover:bg-white/50 rounded p-0.5"
                                    title="Edit assignment"
                                  >
                                    <Edit2 className="w-2 h-2" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(assignment.id, assignment.employeeId);
                                    }}
                                    className="hover:bg-red-200 rounded p-0.5"
                                    title="Remove from shift"
                                  >
                                    <Trash2 className="w-2 h-2" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* Copy Shift Dialog */}
      {copyDialog && (
        <Dialog
          open={copyDialog.open}
          onClose={() => {
            setCopyDialog(null);
            setSelectedTargetDates(new Set());
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            Copy Shift Assignments
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Copy {copyDialog.employeeAssignments.length} employee(s) from{' '}
                <strong>{copyDialog.sourcePatternName}</strong> on{' '}
                <strong>{formatDateHeader(copyDialog.sourceDate).day} {formatDateHeader(copyDialog.sourceDate).date}</strong>
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                {copyDialog.employeeAssignments.map(a => (
                  <Chip
                    key={a.id}
                    label={getEmployeeName(a.employeeId)}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>

            <Typography variant="subtitle2" gutterBottom>
              Select target dates:
            </Typography>

            {getValidCopyTargetDates.length === 0 ? (
              <Alert severity="info" sx={{ mt: 1 }}>
                No other valid dates found for this shift pattern in the current period.
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1, maxHeight: 200, overflow: 'auto' }}>
                {getValidCopyTargetDates.map(date => {
                  const { day, date: dateStr } = formatDateHeader(date);
                  const isSelected = selectedTargetDates.has(date);
                  return (
                    <FormControlLabel
                      key={date}
                      control={
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleDateSelection(date)}
                          size="small"
                        />
                      }
                      label={
                        <Typography variant="body2">
                          {day} {dateStr}
                        </Typography>
                      }
                      sx={{
                        border: 1,
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        borderRadius: 1,
                        px: 1,
                        py: 0.5,
                        m: 0,
                        bgcolor: isSelected ? 'primary.50' : 'transparent',
                      }}
                    />
                  );
                })}
              </Box>
            )}

            {selectedTargetDates.size > 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                {selectedTargetDates.size} date(s) selected. Existing assignments will be preserved.
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setCopyDialog(null);
                setSelectedTargetDates(new Set());
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleExecuteCopy}
              disabled={selectedTargetDates.size === 0 || isProcessing}
            >
              {isProcessing ? 'Copying...' : `Copy to ${selectedTargetDates.size} date(s)`}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}
