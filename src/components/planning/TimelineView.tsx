'use client';

import { useMemo } from 'react';
import { Edit2, Trash2 } from '@/components/ui/Icons';
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
  onNavigateToPerson?: (employeeId: number) => void;
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
  onNavigateToPerson,
}: TimelineViewProps) {
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

  // Check if shift pattern has hours for a given day
  const shiftPatternHasHoursForDay = (pattern: ShiftPatternCamel, dateStr: string): boolean => {
    // If pattern has weekly schedule, check that day
    if (pattern.weeklySchedule) {
      const dayOfWeek = new Date(dateStr).getDay();
      const dayNames: ('Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat')[] = 
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayKey = dayNames[dayOfWeek];
      const daySchedule = pattern.weeklySchedule[dayKey];
      return !!(daySchedule?.startTime && daySchedule?.endTime);
    }
    
    // Simple pattern - always has hours
    return !!(pattern.startTime && pattern.endTime);
  };

  // Get employee name by ID
  const getEmployeeName = (employeeId: number): string => {
    return employees.find(e => e.id === employeeId)?.name || 'Unknown';
  };

  // Handle delete with confirmation
  const handleDelete = async (assignmentId: number, employeeId: number) => {
    const employeeName = getEmployeeName(employeeId);
    if (confirm(`Remove ${employeeName} from this shift?`)) {
      try {
        console.log('Deleting assignment:', assignmentId);
        await onDeleteAssignment(assignmentId);
        console.log('Assignment deleted successfully');
      } catch (err) {
        console.error('Error deleting assignment:', err);
        alert('Failed to delete assignment');
      }
    }
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

  // Get tile color based on violations
  const getTileStyle = (violations: ComplianceViolation[]) => {
    const hasError = violations.some(v => v.severity === 'error');
    const hasWarning = violations.some(v => v.severity === 'warning');
    
    if (hasError) {
      return 'bg-red-100 text-red-800 border-red-400 border-2';
    }
    if (hasWarning) {
      return 'bg-amber-100 text-amber-800 border-amber-400 border-2';
    }
    return 'bg-green-100 text-green-800 border border-green-300';
  };

  // Format violation tooltip
  const getViolationTooltip = (violations: ComplianceViolation[]): string => {
    if (violations.length === 0) return '';
    return violations.map(v => `⚠️ ${v.message}`).join('\n');
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-x-auto">
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
          shiftPatterns.map(pattern => {
            const patternAssignments = assignments.filter(a => a.shiftPatternId === pattern.id);

            return (
              <div
                key={pattern.id}
                className="grid border-b border-slate-200 hover:bg-slate-50"
                style={{ gridTemplateColumns: '200px repeat(28, 100px)' }}
              >
                {/* Pattern Name Cell */}
                <div className="p-3 sticky left-0 bg-white border-r border-slate-200 z-10">
                  <div className="font-semibold text-sm text-slate-800">{pattern.name}</div>
                  <div className="text-xs text-slate-600">
                    {pattern.startTime || '??:??'} - {pattern.endTime || '??:??'}
                  </div>
                  <div className={`text-xs mt-1 ${
                    pattern.isNight ? 'text-purple-600' : 'text-slate-500'
                  }`}>
                    {pattern.dutyType} {pattern.isNight && '🌙'}
                  </div>
                </div>

                {/* Day Cells */}
                {dates.map((date, idx) => {
                  const cellAssignments = patternAssignments.filter(a => a.date === date);
                  const isPartOfPattern = shiftPatternHasHoursForDay(pattern, date);
                  const { isWeekend } = formatDateHeader(date);

                  return (
                    <div
                      key={idx}
                      className={`border-l border-slate-200 p-1 min-h-[70px] transition-colors ${
                        !isPartOfPattern 
                          ? 'bg-slate-100/50 cursor-not-allowed' 
                          : isWeekend 
                            ? 'weekend-hatch hover:bg-blue-50 cursor-pointer' 
                            : 'hover:bg-blue-50 cursor-pointer'
                      }`}
                      onDragOver={(e) => {
                        if (isPartOfPattern) {
                          onCellDragOver(e);
                        }
                      }}
                      onDrop={(e) => {
                        if (isPartOfPattern) {
                          onCellDrop(e, pattern.id, date);
                        } else {
                          e.preventDefault();
                          // Call custom drop handler for non-pattern days
                          onCellDrop(e, pattern.id, date, false);
                        }
                      }}
                      title={!isPartOfPattern ? 'This day is not part of the shift pattern' : 'Drop employee here to assign'}
                    >
                      {/* Assignment Tiles */}
                      {cellAssignments
                        .map(a => {
                          const violations = getViolationsForCell(a.employeeId, date);
                          return { 
                            ...a, 
                            employeeName: getEmployeeName(a.employeeId),
                            violations
                          };
                        })
                        .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
                        .map((assignment) => (
                          <div
                            key={assignment.id}
                            className={`text-xs px-2 py-1.5 mb-1 rounded group hover:opacity-90 transition-colors ${getTileStyle(assignment.violations)}`}
                            title={assignment.violations.length > 0
                              ? `${assignment.employeeName}\n\n${getViolationTooltip(assignment.violations)}`
                              : assignment.employeeName
                            }
                            onDragOver={(e) => {
                              if (isPartOfPattern) {
                                onCellDragOver(e);
                              }
                            }}
                            onDrop={(e) => {
                              if (isPartOfPattern) {
                                onCellDrop(e, pattern.id, date);
                              } else {
                                e.preventDefault();
                                onCellDrop(e, pattern.id, date, false);
                              }
                            }}
                          >
                            <div className="font-medium mb-1">
                              {assignment.employeeName}
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigateToPerson?.(assignment.employeeId);
                                }}
                                className="hover:bg-white/50 rounded p-0.5"
                                title="View person details"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(assignment.id, assignment.employeeId);
                                }}
                                className="hover:bg-red-200 rounded p-0.5"
                                title="Remove from shift"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
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
