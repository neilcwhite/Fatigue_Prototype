'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Edit2, Trash2, Copy, X, Check, AlertTriangle, AlertCircle } from '@/components/ui/Icons';
import { checkEmployeeCompliance, getDateCellViolations, type ComplianceViolation } from '@/lib/compliance';
import type {
  ProjectCamel,
  EmployeeCamel,
  AssignmentCamel,
  ShiftPatternCamel,
  NetworkRailPeriod
} from '@/lib/types';

interface TimelineViewProps {
  project: ProjectCamel;
  employees: EmployeeCamel[];
  shiftPatterns: ShiftPatternCamel[];
  assignments: AssignmentCamel[];
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

export function TimelineView({
  project,
  employees,
  shiftPatterns,
  assignments,
  period,
  onCellDragOver,
  onCellDrop,
  onDeleteAssignment,
  onEditAssignment,
  onNavigateToPerson,
  onCreateAssignment,
}: TimelineViewProps) {
  // Selection state
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<number>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [copyTargetDates, setCopyTargetDates] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  // Track sorted assignments for shift-click range selection
  const sortedAssignmentsRef = useRef<AssignmentCamel[]>([]);

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

  // Update sorted assignments ref when assignments change
  useEffect(() => {
    sortedAssignmentsRef.current = [...assignments].sort((a, b) => {
      // Sort by pattern, then date, then employee
      if (a.shiftPatternId !== b.shiftPatternId) {
        return a.shiftPatternId.localeCompare(b.shiftPatternId);
      }
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.employeeId - b.employeeId;
    });
  }, [assignments]);

  // Clear selection on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedAssignmentIds(new Set());
        setLastSelectedId(null);
        setIsCopyMode(false);
        setCopyTargetDates(new Set());
      }
      // Delete selected with Delete key
      if (e.key === 'Delete' && selectedAssignmentIds.size > 0 && !isProcessing) {
        handleBulkDelete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAssignmentIds, isProcessing]);

  // Build compliance violations map for all employees
  const complianceByEmployee = useMemo(() => {
    const result = new Map<number, ComplianceViolation[]>();

    const employeeIds = [...new Set(assignments.map(a => a.employeeId))];

    for (const empId of employeeIds) {
      const compliance = checkEmployeeCompliance(empId, assignments, shiftPatterns);
      result.set(empId, compliance.violations);
    }

    return result;
  }, [assignments, shiftPatterns]);

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
      hasWarning: futureViolations.some(v => v.severity === 'warning'),
      hasError: futureViolations.some(v => v.severity === 'error'),
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

  // Handle tile click for selection
  const handleTileClick = useCallback((e: React.MouseEvent, assignment: AssignmentCamel) => {
    e.stopPropagation();

    // If in copy mode, ignore tile clicks
    if (isCopyMode) return;

    const assignmentId = assignment.id;

    if (e.shiftKey && lastSelectedId !== null) {
      // Shift+click: range selection
      const sorted = sortedAssignmentsRef.current;
      const lastIdx = sorted.findIndex(a => a.id === lastSelectedId);
      const currentIdx = sorted.findIndex(a => a.id === assignmentId);

      if (lastIdx !== -1 && currentIdx !== -1) {
        const [start, end] = [Math.min(lastIdx, currentIdx), Math.max(lastIdx, currentIdx)];
        const rangeIds = sorted.slice(start, end + 1).map(a => a.id);

        if (e.ctrlKey || e.metaKey) {
          // Add range to existing selection
          setSelectedAssignmentIds(prev => {
            const next = new Set(prev);
            rangeIds.forEach(id => next.add(id));
            return next;
          });
        } else {
          // Replace selection with range
          setSelectedAssignmentIds(new Set(rangeIds));
        }
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl+click: toggle individual selection
      setSelectedAssignmentIds(prev => {
        const next = new Set(prev);
        if (next.has(assignmentId)) {
          next.delete(assignmentId);
        } else {
          next.add(assignmentId);
        }
        return next;
      });
      setLastSelectedId(assignmentId);
    } else {
      // Regular click: select only this one (or deselect if already sole selection)
      if (selectedAssignmentIds.size === 1 && selectedAssignmentIds.has(assignmentId)) {
        setSelectedAssignmentIds(new Set());
        setLastSelectedId(null);
      } else {
        setSelectedAssignmentIds(new Set([assignmentId]));
        setLastSelectedId(assignmentId);
      }
    }
  }, [lastSelectedId, isCopyMode, selectedAssignmentIds]);

  // Handle cell click for copy target selection
  const handleCellClick = useCallback((e: React.MouseEvent, date: string, isValidCell: boolean) => {
    if (!isCopyMode || !isValidCell) return;

    e.stopPropagation();
    setCopyTargetDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  }, [isCopyMode]);

  // Handle delete with confirmation
  const handleDelete = async (assignmentId: number, employeeId: number) => {
    const employeeName = getEmployeeName(employeeId);
    if (confirm(`Remove ${employeeName} from this shift?`)) {
      try {
        await onDeleteAssignment(assignmentId);
      } catch (err) {
        console.error('Error deleting assignment:', err);
        alert('Failed to delete assignment');
      }
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedAssignmentIds.size === 0) return;

    const count = selectedAssignmentIds.size;
    if (!confirm(`Delete ${count} selected assignment${count > 1 ? 's' : ''}?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const ids = Array.from(selectedAssignmentIds);
      for (const id of ids) {
        await onDeleteAssignment(id);
      }
      setSelectedAssignmentIds(new Set());
      setLastSelectedId(null);
    } catch (err) {
      console.error('Error bulk deleting:', err);
      alert('Failed to delete some assignments');
    } finally {
      setIsProcessing(false);
    }
  };

  // Enter copy mode
  const handleStartCopy = () => {
    setIsCopyMode(true);
    setCopyTargetDates(new Set());
  };

  // Execute copy
  const handleExecuteCopy = async () => {
    if (!onCreateAssignment || copyTargetDates.size === 0) return;

    setIsProcessing(true);
    try {
      const selectedAssignments = assignments.filter(a => selectedAssignmentIds.has(a.id));
      const targetDates = Array.from(copyTargetDates);

      for (const assignment of selectedAssignments) {
        for (const targetDate of targetDates) {
          // Check if assignment already exists
          const exists = assignments.some(
            a => a.employeeId === assignment.employeeId &&
                 a.shiftPatternId === assignment.shiftPatternId &&
                 a.date === targetDate
          );

          if (!exists) {
            await onCreateAssignment({
              employeeId: assignment.employeeId,
              projectId: assignment.projectId,
              shiftPatternId: assignment.shiftPatternId,
              date: targetDate,
              customStartTime: assignment.customStartTime,
              customEndTime: assignment.customEndTime,
            });
          }
        }
      }

      // Exit copy mode and clear selection
      setIsCopyMode(false);
      setCopyTargetDates(new Set());
      setSelectedAssignmentIds(new Set());
      setLastSelectedId(null);
    } catch (err) {
      console.error('Error copying assignments:', err);
      alert('Failed to copy some assignments');
    } finally {
      setIsProcessing(false);
    }
  };

  // Cancel copy mode
  const handleCancelCopy = () => {
    setIsCopyMode(false);
    setCopyTargetDates(new Set());
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedAssignmentIds(new Set());
    setLastSelectedId(null);
    setIsCopyMode(false);
    setCopyTargetDates(new Set());
  };

  // Format date for header
  const formatDateHeader = (dateStr: string) => {
    const d = new Date(dateStr);
    return {
      day: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      date: `${d.getDate()}/${d.getMonth() + 1}`,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    };
  };

  // Get tile color based on violations and selection
  // - violations: violations on THIS specific date (fill color)
  // - futureViolations: whether employee has any violations from this date onwards (border)
  const getTileStyle = (
    violations: ComplianceViolation[],
    isSelected: boolean,
    futureViolations?: { hasWarning: boolean; hasError: boolean }
  ) => {
    if (isSelected) {
      return 'bg-blue-500 text-white border-blue-600 border-2 ring-2 ring-blue-300';
    }

    // Current date has a violation - change fill color
    const hasError = violations.some(v => v.severity === 'error');
    const hasWarning = violations.some(v => v.severity === 'warning');

    // Future violations - change border color (but not fill unless this date is a violation)
    const hasFutureError = futureViolations?.hasError || false;
    const hasFutureWarning = futureViolations?.hasWarning || false;

    // Fill color based on THIS date's violations
    let fillClass = 'bg-green-100 text-green-800';
    if (hasError) {
      fillClass = 'bg-red-100 text-red-800';
    } else if (hasWarning) {
      fillClass = 'bg-amber-100 text-amber-800';
    }

    // Border based on future violations (shows upcoming issues)
    let borderClass = 'border border-green-300';
    if (hasError || hasFutureError) {
      borderClass = 'border-2 border-red-400';
    } else if (hasWarning || hasFutureWarning) {
      borderClass = 'border-2 border-amber-400';
    }

    return `${fillClass} ${borderClass}`;
  };

  // Get just the background color for the hover buttons overlay
  const getTileBackground = (violations: ComplianceViolation[], isSelected: boolean) => {
    if (isSelected) return 'bg-blue-500';
    const hasError = violations.some(v => v.severity === 'error');
    const hasWarning = violations.some(v => v.severity === 'warning');
    if (hasError) return 'bg-red-100';
    if (hasWarning) return 'bg-amber-100';
    return 'bg-green-100';
  };

  // Format violation tooltip
  const getViolationTooltip = (violations: ComplianceViolation[]): string => {
    if (violations.length === 0) return '';
    return violations.map(v => `⚠️ ${v.message}`).join('\n');
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-x-auto relative">
      {/* Bulk Operations Toolbar */}
      {selectedAssignmentIds.size > 0 && (
        <div className="sticky top-0 left-0 right-0 z-20 bg-blue-600 text-white px-4 py-2 flex items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="font-medium">
              {selectedAssignmentIds.size} selected
            </span>
            <span className="text-blue-200 text-sm">
              (Ctrl+click to multi-select, Shift+click for range, Esc to clear)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isCopyMode ? (
              <>
                {onCreateAssignment && (
                  <button
                    onClick={handleStartCopy}
                    disabled={isProcessing}
                    className="px-3 py-1.5 bg-blue-500 hover:bg-blue-400 rounded text-sm flex items-center gap-1 disabled:opacity-50"
                  >
                    <Copy className="w-4 h-4" />
                    Copy to...
                  </button>
                )}
                <button
                  onClick={handleBulkDelete}
                  disabled={isProcessing}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-400 rounded text-sm flex items-center gap-1 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button
                  onClick={handleClearSelection}
                  className="px-3 py-1.5 bg-blue-500 hover:bg-blue-400 rounded text-sm flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Clear
                </button>
              </>
            ) : (
              <>
                <span className="text-sm text-blue-200">
                  Click on dates to select copy targets ({copyTargetDates.size} selected)
                </span>
                <button
                  onClick={handleExecuteCopy}
                  disabled={isProcessing || copyTargetDates.size === 0}
                  className="px-3 py-1.5 bg-green-500 hover:bg-green-400 rounded text-sm flex items-center gap-1 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Confirm Copy
                </button>
                <button
                  onClick={handleCancelCopy}
                  disabled={isProcessing}
                  className="px-3 py-1.5 bg-slate-500 hover:bg-slate-400 rounded text-sm flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

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
            const isCopyTarget = copyTargetDates.has(date);

            return (
              <div
                key={idx}
                className={`p-2 text-center text-xs border-l border-slate-200 ${
                  isCopyMode && isCopyTarget
                    ? 'bg-green-200 border-green-400 border-2'
                    : isWeekend
                      ? 'weekend-header'
                      : 'bg-slate-50'
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
                  const { isWeekend } = formatDateHeader(date);
                  const isCopyTarget = copyTargetDates.has(date);

                  return (
                    <div
                      key={idx}
                      className={`border-l border-slate-200 p-1 min-h-[70px] transition-colors ${
                        isCopyMode && isCopyTarget
                          ? 'bg-green-100 ring-2 ring-green-400 ring-inset'
                          : isCopyMode && isPartOfPattern
                            ? 'bg-blue-50 hover:bg-green-50 cursor-pointer'
                            : !isPartOfPattern
                              ? 'weekend-hatch cursor-not-allowed'
                              : 'hover:bg-blue-50 cursor-pointer'
                      }`}
                      onClick={(e) => handleCellClick(e, date, isPartOfPattern)}
                      onDragOver={(e) => {
                        // Allow dragOver on all cells (not just valid ones) so drop event fires
                        // This enables the custom time modal for invalid cells
                        if (!isCopyMode) {
                          onCellDragOver(e);
                        }
                      }}
                      onDrop={(e) => {
                        if (isCopyMode) {
                          e.preventDefault();
                          return;
                        }
                        // Pass isPartOfPattern as the isValidCell parameter
                        onCellDrop(e, pattern.id, date, isPartOfPattern);
                      }}
                      title={
                        isCopyMode
                          ? isPartOfPattern
                            ? 'Click to select as copy target'
                            : 'This day is not part of the shift pattern'
                          : !isPartOfPattern
                            ? 'This day is not part of the shift pattern'
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
                          const isSelected = selectedAssignmentIds.has(assignment.id);

                          const hasViolations = assignment.violations.length > 0;
                          const hasError = assignment.violations.some(v => v.severity === 'error');
                          const hasWarning = assignment.violations.some(v => v.severity === 'warning');

                          // Check for future violations (from this date onwards)
                          const futureViolations = hasFutureViolations(assignment.employeeId, date);
                          const hasFutureIssues = futureViolations.hasError || futureViolations.hasWarning;

                          // Handle chip click - navigate to employee page if any violations (current or future)
                          const handleChipClick = (e: React.MouseEvent) => {
                            if ((hasViolations || hasFutureIssues) && onNavigateToPerson && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                              e.stopPropagation();
                              onNavigateToPerson(assignment.employeeId);
                            } else {
                              handleTileClick(e, assignment.original);
                            }
                          };

                          return (
                            <div
                              key={assignment.id}
                              onClick={handleChipClick}
                              className={`text-[10px] leading-tight px-1 py-0.5 mb-0.5 rounded group hover:opacity-90 transition-all cursor-pointer ${getTileStyle(assignment.violations, isSelected, futureViolations)}`}
                              title={
                                hasViolations
                                  ? `${assignment.employeeName}${assignment.timeDisplay ? `\n${assignment.timeDisplay}` : ''}\n\n${getViolationTooltip(assignment.violations)}\n\nClick to view employee and resolve issues`
                                  : hasFutureIssues
                                    ? `${assignment.employeeName}${assignment.timeDisplay ? `\n${assignment.timeDisplay}` : ''}\n\n⚠️ Upcoming compliance issue - click to view`
                                    : assignment.timeDisplay
                                      ? `${assignment.employeeName}\n${assignment.timeDisplay}`
                                      : `${assignment.employeeName}\n\nClick to select, Ctrl+click for multi-select`
                              }
                              onDragOver={(e) => {
                                if (!isCopyMode) {
                                  onCellDragOver(e);
                                }
                              }}
                              onDrop={(e) => {
                                if (isCopyMode) {
                                  e.preventDefault();
                                  return;
                                }
                                onCellDrop(e, pattern.id, date, isPartOfPattern);
                              }}
                            >
                              <div className="relative flex items-center">
                                {/* Violation icon */}
                                {hasViolations && (
                                  <span className="flex-shrink-0 mr-0.5">
                                    {hasError ? (
                                      <AlertCircle className="w-3 h-3 text-red-600" />
                                    ) : hasWarning ? (
                                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    ) : null}
                                  </span>
                                )}
                                <span className="font-medium truncate">
                                  {assignment.employeeName}
                                </span>
                                {/* Edit/Delete buttons - overlay on hover with solid background matching tile */}
                                {!isCopyMode && (
                                  <div className={`absolute right-0 top-0 bottom-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-r px-0.5 ${getTileBackground(assignment.violations, isSelected)}`}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onEditAssignment?.(assignment.original);
                                      }}
                                      className={`hover:bg-white/50 rounded p-0.5 ${isSelected ? 'text-white' : ''}`}
                                      title="Edit assignment"
                                    >
                                      <Edit2 className="w-2 h-2" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(assignment.id, assignment.employeeId);
                                      }}
                                      className={`hover:bg-red-200 rounded p-0.5 ${isSelected ? 'text-white hover:text-red-800' : ''}`}
                                      title="Remove from shift"
                                    >
                                      <Trash2 className="w-2 h-2" />
                                    </button>
                                  </div>
                                )}
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
    </div>
  );
}
