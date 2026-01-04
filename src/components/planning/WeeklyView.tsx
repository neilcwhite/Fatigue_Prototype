'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit2, Trash2 } from '@/components/ui/Icons';
import { checkEmployeeCompliance, getDateCellViolations, type ComplianceViolation } from '@/lib/compliance';
import type {
  ProjectCamel,
  EmployeeCamel,
  AssignmentCamel,
  ShiftPatternCamel,
  NetworkRailPeriod
} from '@/lib/types';
import { useNotification } from '@/hooks/useNotification';

interface WeeklyViewProps {
  project: ProjectCamel;
  employees: EmployeeCamel[];
  shiftPatterns: ShiftPatternCamel[];
  assignments: AssignmentCamel[];
  period: NetworkRailPeriod;
  onCellDragOver: (e: React.DragEvent) => void;
  onCellDrop: (e: React.DragEvent, shiftPatternId: string, date: string, isValidCell?: boolean) => void;
  onDeleteAssignment: (id: number) => Promise<void>;
  onEditAssignment?: (assignment: AssignmentCamel) => void;
}

// Network Rail week starts on Saturday
const DAYS_OF_WEEK = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export function WeeklyView({
  project,
  employees,
  shiftPatterns,
  assignments,
  period,
  onCellDragOver,
  onCellDrop,
  onDeleteAssignment,
  onEditAssignment,
}: WeeklyViewProps) {
  const { showError } = useNotification();
  // Current week index (0-3 for 4 weeks in a period)
  const [weekIndex, setWeekIndex] = useState(0);

  // Generate all 28 days
  const allDates = useMemo(() => {
    const result: string[] = [];
    const startDate = new Date(period.startDate);

    for (let i = 0; i < 28; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      result.push(date.toISOString().split('T')[0]);
    }

    return result;
  }, [period.startDate]);

  // Get dates for current week
  const weekDates = useMemo(() => {
    const start = weekIndex * 7;
    return allDates.slice(start, start + 7);
  }, [allDates, weekIndex]);

  // Build compliance violations map
  const complianceByEmployee = useMemo(() => {
    const result = new Map<number, ComplianceViolation[]>();
    const employeeIds = [...new Set(assignments.map(a => a.employeeId))];

    for (const empId of employeeIds) {
      const compliance = checkEmployeeCompliance(empId, assignments, shiftPatterns);
      result.set(empId, compliance.violations);
    }

    return result;
  }, [assignments, shiftPatterns]);

  // Get violations for cell
  const getViolationsForCell = (employeeId: number, date: string): ComplianceViolation[] => {
    const violations = complianceByEmployee.get(employeeId) || [];
    return getDateCellViolations(employeeId, date, violations);
  };

  // Get shift pattern info
  const getPatternInfo = (patternId: string) => {
    return shiftPatterns.find(p => p.id === patternId);
  };

  // Get pattern color
  const getPatternColor = (pattern: ShiftPatternCamel | undefined): string => {
    if (!pattern) return 'bg-slate-100 text-slate-800';

    if (pattern.isNight) return 'bg-purple-100 text-purple-800';

    switch (pattern.dutyType) {
      case 'Possession': return 'bg-blue-100 text-blue-800';
      case 'Non-Possession': return 'bg-green-100 text-green-800';
      case 'Office': return 'bg-amber-100 text-amber-800';
      case 'Lookout': return 'bg-orange-100 text-orange-800';
      case 'Machine': return 'bg-cyan-100 text-cyan-800';
      case 'Protection': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  // Get cell style based on violations
  const getCellViolationBorder = (violations: ComplianceViolation[]): string => {
    const hasError = violations.some(v => v.severity === 'error');
    const hasWarning = violations.some(v => v.severity === 'warning');

    if (hasError) return 'border-red-500 border-2';
    if (hasWarning) return 'border-amber-500 border-2';
    return 'border-slate-200';
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return {
      dayNum: d.getDate(),
      month: d.toLocaleDateString('en-GB', { month: 'short' }),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    };
  };

  // Get time display
  const getTimeDisplay = (assignment: AssignmentCamel): string => {
    if (assignment.customStartTime && assignment.customEndTime) {
      return `${assignment.customStartTime}-${assignment.customEndTime}`;
    }
    const pattern = getPatternInfo(assignment.shiftPatternId);
    if (pattern?.startTime && pattern?.endTime) {
      return `${pattern.startTime}-${pattern.endTime}`;
    }
    return '';
  };

  // Get employee name
  const getEmployeeName = (employeeId: number): string => {
    return employees.find(e => e.id === employeeId)?.name || 'Unknown';
  };

  // Handle delete
  const handleDelete = async (assignment: AssignmentCamel) => {
    const employeeName = getEmployeeName(assignment.employeeId);
    if (confirm(`Remove ${employeeName} from this shift?`)) {
      try {
        await onDeleteAssignment(assignment.id);
      } catch (err) {
        console.error('Error deleting assignment:', err);
        showError('Failed to delete assignment');
      }
    }
  };

  // Group assignments by shift pattern and date for each cell
  const getCellData = (date: string) => {
    const dayAssignments = assignments.filter(a => a.date === date);

    // Group by shift pattern
    const byPattern = new Map<string, AssignmentCamel[]>();
    for (const a of dayAssignments) {
      const existing = byPattern.get(a.shiftPatternId) || [];
      existing.push(a);
      byPattern.set(a.shiftPatternId, existing);
    }

    return byPattern;
  };

  // Week navigation
  const weekNumber = weekIndex + 1;
  const weekStartDate = weekDates[0] ? formatDate(weekDates[0]) : null;
  const weekEndDate = weekDates[6] ? formatDate(weekDates[6]) : null;

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Week Navigation Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <button
          onClick={() => setWeekIndex(Math.max(0, weekIndex - 1))}
          disabled={weekIndex === 0}
          className="p-2 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>

        <div className="text-center">
          <div className="font-semibold text-slate-800">
            Week {weekNumber} of 4
          </div>
          {weekStartDate && weekEndDate && (
            <div className="text-sm text-slate-500">
              {weekStartDate.dayNum} {weekStartDate.month} - {weekEndDate.dayNum} {weekEndDate.month}
            </div>
          )}
        </div>

        <button
          onClick={() => setWeekIndex(Math.min(3, weekIndex + 1))}
          disabled={weekIndex === 3}
          className="p-2 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Week dots indicator */}
      <div className="flex justify-center gap-2 py-2 bg-slate-50 border-b border-slate-200">
        {[0, 1, 2, 3].map(i => (
          <button
            key={i}
            onClick={() => setWeekIndex(i)}
            className={`w-3 h-3 rounded-full transition-colors ${
              i === weekIndex ? 'bg-blue-600' : 'bg-slate-300 hover:bg-slate-400'
            }`}
            title={`Week ${i + 1}`}
          />
        ))}
      </div>

      {/* Weekly Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-slate-200">
            {DAYS_OF_WEEK.map((day, idx) => {
              const date = weekDates[idx];
              const dateInfo = date ? formatDate(date) : null;
              const isWeekend = idx === 0 || idx === 1; // Sat, Sun

              return (
                <div
                  key={day}
                  className={`p-3 text-center border-r last:border-r-0 border-slate-200 ${
                    isWeekend ? 'weekend-header' : 'bg-slate-50'
                  }`}
                >
                  <div className="font-semibold text-slate-800">{day}</div>
                  {dateInfo && (
                    <div className="text-sm text-slate-600">
                      {dateInfo.dayNum} {dateInfo.month}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Day Columns */}
          <div className="grid grid-cols-7 min-h-[400px]">
            {weekDates.map((date, idx) => {
              const cellData = getCellData(date);
              const isWeekend = idx === 0 || idx === 1;

              return (
                <div
                  key={date}
                  className={`border-r last:border-r-0 border-slate-200 p-2 ${
                    isWeekend ? 'weekend-hatch' : ''
                  }`}
                  onDragOver={onCellDragOver}
                  onDrop={(e) => {
                    const defaultPattern = shiftPatterns[0];
                    if (defaultPattern) {
                      onCellDrop(e, defaultPattern.id, date);
                    }
                  }}
                >
                  {/* Assignments grouped by pattern */}
                  {Array.from(cellData.entries()).map(([patternId, patternAssignments]) => {
                    const pattern = getPatternInfo(patternId);

                    return (
                      <div
                        key={patternId}
                        className={`mb-2 p-2 rounded-lg ${getPatternColor(pattern)}`}
                      >
                        {/* Pattern header */}
                        <div className="text-xs font-semibold mb-1 pb-1 border-b border-current/20">
                          {pattern?.name || 'Unknown'}
                          {pattern?.startTime && pattern?.endTime && (
                            <span className="font-normal ml-1 opacity-75">
                              {pattern.startTime}-{pattern.endTime}
                            </span>
                          )}
                        </div>

                        {/* Employees in this pattern */}
                        <div className="space-y-1">
                          {patternAssignments
                            .sort((a, b) => getEmployeeName(a.employeeId).localeCompare(getEmployeeName(b.employeeId)))
                            .map((assignment) => {
                              const violations = getViolationsForCell(assignment.employeeId, date);
                              const hasViolation = violations.length > 0;
                              const employeeName = getEmployeeName(assignment.employeeId);
                              const customTime = assignment.customStartTime && assignment.customEndTime
                                ? `${assignment.customStartTime}-${assignment.customEndTime}`
                                : null;

                              return (
                                <div
                                  key={assignment.id}
                                  className={`text-xs py-1 px-1.5 rounded group flex items-center justify-between ${
                                    hasViolation ? 'bg-red-200/50 ring-1 ring-red-400' : 'bg-white/50'
                                  }`}
                                  title={violations.length > 0
                                    ? `${employeeName}\n\n${violations.map(v => `⚠️ ${v.message}`).join('\n')}`
                                    : employeeName
                                  }
                                >
                                  <div className="truncate">
                                    <span className="font-medium">{employeeName}</span>
                                    {customTime && (
                                      <span className="text-[10px] opacity-75 ml-1">({customTime})</span>
                                    )}
                                  </div>
                                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onEditAssignment?.(assignment);
                                      }}
                                      className="hover:bg-white/80 rounded p-0.5"
                                      title="Edit"
                                    >
                                      <Edit2 className="w-2 h-2" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(assignment);
                                      }}
                                      className="hover:bg-red-300 rounded p-0.5"
                                      title="Remove"
                                    >
                                      <Trash2 className="w-2 h-2" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Empty state */}
                  {cellData.size === 0 && (
                    <div className="text-xs text-slate-400 text-center py-4">
                      No assignments
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between text-sm">
          <div className="text-slate-600">
            <span className="font-medium">{assignments.filter(a => weekDates.includes(a.date)).length}</span>
            {' '}assignments this week
          </div>
          <div className="text-slate-600">
            <span className="font-medium">
              {new Set(assignments.filter(a => weekDates.includes(a.date)).map(a => a.employeeId)).size}
            </span>
            {' '}employees assigned
          </div>
        </div>
      </div>
    </div>
  );
}
