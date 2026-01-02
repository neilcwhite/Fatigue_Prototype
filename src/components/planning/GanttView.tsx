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

interface GanttViewProps {
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

interface EmployeeAssignmentGroup {
  employee: EmployeeCamel;
  assignmentsByDate: Map<string, AssignmentCamel[]>;
  violations: ComplianceViolation[];
}

export function GanttView({
  project,
  employees,
  shiftPatterns,
  assignments,
  period,
  onCellDragOver,
  onCellDrop,
  onDeleteAssignment,
  onEditAssignment,
}: GanttViewProps) {
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

  // Group assignments by employee
  const employeeGroups = useMemo(() => {
    const groups: EmployeeAssignmentGroup[] = [];

    // Get employees who have assignments in this project
    const assignedEmployeeIds = new Set(assignments.map(a => a.employeeId));
    const assignedEmployees = employees.filter(e => assignedEmployeeIds.has(e.id));

    for (const employee of assignedEmployees) {
      const empAssignments = assignments.filter(a => a.employeeId === employee.id);
      const assignmentsByDate = new Map<string, AssignmentCamel[]>();

      for (const assignment of empAssignments) {
        const existing = assignmentsByDate.get(assignment.date) || [];
        existing.push(assignment);
        assignmentsByDate.set(assignment.date, existing);
      }

      const compliance = checkEmployeeCompliance(employee.id, assignments, shiftPatterns);

      groups.push({
        employee,
        assignmentsByDate,
        violations: compliance.violations,
      });
    }

    // Sort by employee name
    return groups.sort((a, b) => a.employee.name.localeCompare(b.employee.name));
  }, [employees, assignments, shiftPatterns]);

  // Get shift pattern name
  const getPatternName = (patternId: string): string => {
    return shiftPatterns.find(p => p.id === patternId)?.name || 'Unknown';
  };

  // Get pattern color based on duty type
  const getPatternColor = (patternId: string): string => {
    const pattern = shiftPatterns.find(p => p.id === patternId);
    if (!pattern) return 'bg-slate-200 border-slate-400';

    if (pattern.isNight) return 'bg-purple-100 border-purple-400 text-purple-800';

    switch (pattern.dutyType) {
      case 'Possession': return 'bg-blue-100 border-blue-400 text-blue-800';
      case 'Non-Possession': return 'bg-green-100 border-green-400 text-green-800';
      case 'Office': return 'bg-amber-100 border-amber-400 text-amber-800';
      case 'Lookout': return 'bg-orange-100 border-orange-400 text-orange-800';
      case 'Machine': return 'bg-cyan-100 border-cyan-400 text-cyan-800';
      case 'Protection': return 'bg-red-100 border-red-400 text-red-800';
      default: return 'bg-slate-100 border-slate-400 text-slate-800';
    }
  };

  // Get violations for cell
  const getViolationsForCell = (employeeId: number, date: string, allViolations: ComplianceViolation[]): ComplianceViolation[] => {
    return getDateCellViolations(employeeId, date, allViolations);
  };

  // Get cell style based on violations
  const getCellViolationStyle = (violations: ComplianceViolation[]): string => {
    const hasError = violations.some(v => v.severity === 'error');
    const hasWarning = violations.some(v => v.severity === 'warning');

    if (hasError) return 'ring-2 ring-red-500 ring-inset';
    if (hasWarning) return 'ring-2 ring-amber-500 ring-inset';
    return '';
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

  // Handle delete with confirmation
  const handleDelete = async (assignment: AssignmentCamel, employeeName: string) => {
    if (confirm(`Remove ${employeeName} from this shift?`)) {
      try {
        await onDeleteAssignment(assignment.id);
      } catch (err) {
        console.error('Error deleting assignment:', err);
        alert('Failed to delete assignment');
      }
    }
  };

  // Get time display for assignment
  const getTimeDisplay = (assignment: AssignmentCamel): string => {
    if (assignment.customStartTime && assignment.customEndTime) {
      return `${assignment.customStartTime}-${assignment.customEndTime}`;
    }
    const pattern = shiftPatterns.find(p => p.id === assignment.shiftPatternId);
    if (pattern?.startTime && pattern?.endTime) {
      return `${pattern.startTime}-${pattern.endTime}`;
    }
    return '';
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-x-auto">
      <div className="min-w-max">
        {/* Header Row */}
        <div
          className="grid border-b border-slate-200"
          style={{ gridTemplateColumns: '180px repeat(28, 90px)' }}
        >
          <div className="p-3 font-semibold bg-slate-50 sticky left-0 z-10 border-r border-slate-200 text-slate-900">
            Employee
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

        {/* Employee Rows */}
        {employeeGroups.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No employees assigned to this project yet.
            <br />
            <span className="text-sm">Drag employees from the panel below onto shift patterns in Timeline view.</span>
          </div>
        ) : (
          employeeGroups.map(({ employee, assignmentsByDate, violations }) => (
            <div
              key={employee.id}
              className="grid border-b border-slate-200 hover:bg-slate-50"
              style={{ gridTemplateColumns: '180px repeat(28, 90px)' }}
            >
              {/* Employee Name Cell */}
              <div className="p-3 sticky left-0 bg-white border-r border-slate-200 z-10">
                <div className="font-semibold text-sm text-slate-800 truncate">
                  {employee.name}
                </div>
                {employee.role && (
                  <div className="text-xs text-slate-500 truncate">{employee.role}</div>
                )}
                {violations.length > 0 && (
                  <div className="text-xs text-red-600 mt-1">
                    {violations.length} violation{violations.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>

              {/* Day Cells */}
              {dates.map((date, idx) => {
                const dayAssignments = assignmentsByDate.get(date) || [];
                const cellViolations = getViolationsForCell(employee.id, date, violations);
                const { isWeekend } = formatDateHeader(date);

                return (
                  <div
                    key={idx}
                    className={`border-l border-slate-200 p-1 min-h-[60px] transition-colors ${
                      isWeekend ? 'weekend-hatch' : ''
                    } ${getCellViolationStyle(cellViolations)}`}
                    onDragOver={onCellDragOver}
                    onDrop={(e) => {
                      // For Gantt view, we need to select a pattern - use first available
                      const defaultPattern = shiftPatterns[0];
                      if (defaultPattern) {
                        onCellDrop(e, defaultPattern.id, date);
                      }
                    }}
                    title={cellViolations.length > 0
                      ? cellViolations.map(v => `⚠️ ${v.message}`).join('\n')
                      : 'Drop employee here'
                    }
                  >
                    {/* Assignment Bars */}
                    {dayAssignments.map((assignment) => {
                      const patternName = getPatternName(assignment.shiftPatternId);
                      const timeDisplay = getTimeDisplay(assignment);

                      return (
                        <div
                          key={assignment.id}
                          className={`text-[9px] leading-tight px-1.5 py-1 mb-0.5 rounded border group cursor-pointer ${getPatternColor(assignment.shiftPatternId)}`}
                          title={`${patternName}${timeDisplay ? `\n${timeDisplay}` : ''}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="truncate font-medium">
                              {patternName}
                            </div>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditAssignment?.(assignment);
                                }}
                                className="hover:bg-white/50 rounded p-0.5"
                                title="Edit assignment"
                              >
                                <Edit2 className="w-2 h-2" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(assignment, employee.name);
                                }}
                                className="hover:bg-red-200 rounded p-0.5"
                                title="Remove"
                              >
                                <Trash2 className="w-2 h-2" />
                              </button>
                            </div>
                          </div>
                          {timeDisplay && (
                            <div className="text-[8px] opacity-75 mt-0.5">
                              {timeDisplay}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Legend */}
      <div className="p-3 border-t border-slate-200 bg-slate-50">
        <div className="text-xs font-medium text-slate-600 mb-2">Shift Types</div>
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="px-2 py-1 bg-blue-100 border border-blue-400 text-blue-800 rounded">Possession</span>
          <span className="px-2 py-1 bg-green-100 border border-green-400 text-green-800 rounded">Non-Possession</span>
          <span className="px-2 py-1 bg-amber-100 border border-amber-400 text-amber-800 rounded">Office</span>
          <span className="px-2 py-1 bg-purple-100 border border-purple-400 text-purple-800 rounded">Night</span>
          <span className="px-2 py-1 bg-orange-100 border border-orange-400 text-orange-800 rounded">Lookout</span>
          <span className="px-2 py-1 bg-cyan-100 border border-cyan-400 text-cyan-800 rounded">Machine</span>
          <span className="px-2 py-1 bg-red-100 border border-red-400 text-red-800 rounded">Protection</span>
        </div>
      </div>
    </div>
  );
}
