'use client';

import { useMemo } from 'react';
import { Edit2, Trash2 } from '@/components/ui/Icons';
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
  onCellDrop: (e: React.DragEvent, shiftPatternId: string, date: string) => void;
  onDeleteAssignment: (id: number) => Promise<void>;
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
  const handleDelete = async (assignment: AssignmentCamel) => {
    const employeeName = getEmployeeName(assignment.employeeId);
    if (confirm(`Remove ${employeeName} from this shift?`)) {
      try {
        await onDeleteAssignment(assignment.id);
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

  return (
    <div className="bg-white rounded-lg shadow-md overflow-x-auto">
      <div className="min-w-max">
        {/* Header Row */}
        <div 
          className="grid border-b border-slate-200"
          style={{ gridTemplateColumns: '200px repeat(28, 100px)' }}
        >
          <div className="p-3 font-semibold bg-slate-50 sticky left-0 z-10 border-r border-slate-200">
            Shift Pattern
          </div>
          {dates.map((date, idx) => {
            const { day, date: dateStr, isWeekend } = formatDateHeader(date);
            
            return (
              <div
                key={idx}
                className={`p-2 text-center text-xs border-l border-slate-200 ${
                  isWeekend ? 'bg-slate-100' : 'bg-slate-50'
                }`}
              >
                <div className="font-semibold">{day}</div>
                <div className="text-slate-600">{dateStr}</div>
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
                          ? 'bg-slate-100/50' 
                          : isWeekend 
                            ? 'bg-slate-50 hover:bg-blue-50' 
                            : 'hover:bg-blue-50'
                      }`}
                      onDragOver={onCellDragOver}
                      onDrop={(e) => onCellDrop(e, pattern.id, date)}
                      title={!isPartOfPattern ? 'No shift scheduled for this day' : 'Drop employee here to assign'}
                    >
                      {/* Assignment Tiles */}
                      {cellAssignments
                        .map(a => ({ ...a, employeeName: getEmployeeName(a.employeeId) }))
                        .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
                        .map((assignment) => (
                          <div
                            key={assignment.id}
                            className="text-[10px] px-1.5 py-1 mb-1 rounded flex items-center justify-between gap-1 group bg-green-100 text-green-800 border border-green-300 hover:bg-green-200 transition-colors"
                          >
                            <span className="truncate flex-1" title={assignment.employeeName}>
                              {assignment.employeeName}
                            </span>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // TODO: Open edit modal
                                }}
                                className="hover:bg-green-300 rounded p-0.5"
                                title="Edit"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(assignment);
                                }}
                                className="hover:bg-red-200 rounded p-0.5"
                                title="Remove"
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
