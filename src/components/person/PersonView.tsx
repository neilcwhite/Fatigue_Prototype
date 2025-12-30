'use client';

import { useMemo } from 'react';
import { ChevronLeft, AlertTriangle, CheckCircle, XCircle, Edit2, Trash2 } from '@/components/ui/Icons';
import type { EmployeeCamel, AssignmentCamel, ShiftPatternCamel, ProjectCamel } from '@/lib/types';

interface PersonViewProps {
  user: any;
  onSignOut: () => void;
  onBack: () => void;
  employee: EmployeeCamel;
  employees: EmployeeCamel[];
  assignments: AssignmentCamel[];
  shiftPatterns: ShiftPatternCamel[];
  projects: ProjectCamel[];
  onSelectEmployee: (id: number) => void;
  onDeleteAssignment: (id: number) => Promise<void>;
}

export function PersonView({
  user,
  onSignOut,
  onBack,
  employee,
  employees,
  assignments,
  shiftPatterns,
  projects,
  onSelectEmployee,
  onDeleteAssignment,
}: PersonViewProps) {
  // Get this employee's assignments
  const empAssignments = useMemo(() => {
    return assignments
      .filter(a => a.employeeId === employee.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [assignments, employee.id]);

  // Calculate date range for calendar
  const calendarDates = useMemo(() => {
    const dates: string[] = [];
    const today = new Date();
    const startDate = empAssignments.length > 0 
      ? new Date(Math.min(new Date(empAssignments[0].date).getTime(), today.getTime()))
      : today;
    
    // Show 28 days
    for (let i = 0; i < 28; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  }, [empAssignments]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalShifts = empAssignments.length;
    const uniqueProjects = [...new Set(empAssignments.map(a => a.projectId))].length;
    
    // Calculate total hours (simplified - assumes 12hr shifts)
    const totalHours = empAssignments.reduce((sum, a) => {
      const pattern = shiftPatterns.find(p => p.id === a.shiftPatternId);
      if (pattern?.startTime && pattern?.endTime) {
        const start = parseInt(pattern.startTime.split(':')[0]);
        const end = parseInt(pattern.endTime.split(':')[0]);
        const hours = end > start ? end - start : (24 - start) + end;
        return sum + hours;
      }
      return sum + 12; // Default 12 hours
    }, 0);

    return { totalShifts, uniqueProjects, totalHours };
  }, [empAssignments, shiftPatterns]);

  // Get pattern and project info for an assignment
  const getAssignmentInfo = (assignment: AssignmentCamel) => {
    const pattern = shiftPatterns.find(p => p.id === assignment.shiftPatternId);
    const project = projects.find(p => p.id === assignment.projectId);
    return { pattern, project };
  };

  // Format date for display
  const formatDateHeader = (dateStr: string) => {
    const d = new Date(dateStr);
    return {
      day: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      date: d.getDate(),
      month: d.toLocaleDateString('en-GB', { month: 'short' }),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isToday: dateStr === new Date().toISOString().split('T')[0],
    };
  };

  const handleDelete = async (assignment: AssignmentCamel) => {
    const { pattern, project } = getAssignmentInfo(assignment);
    if (confirm(`Remove ${employee.name} from ${pattern?.name || 'shift'} on ${assignment.date}?`)) {
      try {
        await onDeleteAssignment(assignment.id);
      } catch (err) {
        console.error('Error deleting assignment:', err);
        alert('Failed to delete assignment');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 border-b-4 border-orange-500">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-md text-sm flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <span className="text-white font-semibold text-lg">
                {employee.name} <span className="text-orange-400">Timeline</span>
              </span>
              <span className="text-slate-500 text-sm ml-3">{employee.role}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Employee Selector */}
            <select
              value={employee.id}
              onChange={(e) => onSelectEmployee(Number(e.target.value))}
              className="bg-slate-700 text-white border-none px-3 py-1.5 rounded text-sm"
            >
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
            <span className="bg-slate-700 text-orange-400 px-3 py-1 rounded text-xs font-mono">
              PERSON VIEW
            </span>
            <div className="text-slate-400 text-sm">{user?.email}</div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <p className="text-sm text-slate-600">Compliance Status</p>
            <p className="text-2xl font-bold text-green-600">Compliant</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-slate-600">Total Shifts</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalShifts}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-slate-600">Total Hours</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalHours}h</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-slate-600">Projects</p>
            <p className="text-2xl font-bold text-slate-900">{stats.uniqueProjects}</p>
          </div>
        </div>

        {/* Calendar Timeline */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">Schedule Timeline</h3>
          </div>
          
          <div className="overflow-x-auto">
            <div className="min-w-max">
              {/* Date Headers */}
              <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: `repeat(${calendarDates.length}, 100px)` }}>
                {calendarDates.map((date, idx) => {
                  const { day, date: dateNum, month, isWeekend, isToday } = formatDateHeader(date);
                  return (
                    <div
                      key={idx}
                      className={`p-2 text-center text-xs border-r border-slate-200 ${
                        isToday ? 'bg-blue-100' : isWeekend ? 'weekend-header' : 'bg-slate-50'
                      }`}
                    >
                      <div className="font-semibold text-slate-900">{day}</div>
                      <div className={isToday ? 'text-blue-600 font-bold' : 'text-slate-700'}>
                        {dateNum} {month}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Assignment Row */}
              <div className="grid" style={{ gridTemplateColumns: `repeat(${calendarDates.length}, 100px)` }}>
                {calendarDates.map((date, idx) => {
                  const dateAssignments = empAssignments.filter(a => a.date === date);
                  const { isWeekend, isToday } = formatDateHeader(date);

                  return (
                    <div
                      key={idx}
                      className={`min-h-[80px] p-1 border-r border-slate-200 ${
                        isToday ? 'bg-blue-50' : isWeekend ? 'weekend-hatch' : ''
                      }`}
                    >
                      {dateAssignments.map(assignment => {
                        const { pattern, project } = getAssignmentInfo(assignment);
                        return (
                          <div
                            key={assignment.id}
                            className={`text-xs p-1.5 mb-1 rounded group ${
                              pattern?.isNight
                                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                : 'bg-green-100 text-green-800 border border-green-300'
                            }`}
                          >
                            <div className="font-medium truncate">{pattern?.name || 'Shift'}</div>
                            <div className="text-[10px] opacity-75 truncate">{project?.name}</div>
                            <div className="text-[10px] opacity-75">
                              {pattern?.startTime} - {pattern?.endTime}
                            </div>
                            <button
                              onClick={() => handleDelete(assignment)}
                              className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 text-red-500 hover:text-red-700"
                              title="Remove"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Assignment List */}
        <div className="bg-white rounded-lg shadow-md mt-6">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">All Assignments ({empAssignments.length})</h3>
          </div>
          <div className="divide-y divide-slate-200">
            {empAssignments.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No assignments for this employee
              </div>
            ) : (
              empAssignments.map(assignment => {
                const { pattern, project } = getAssignmentInfo(assignment);
                const dateInfo = formatDateHeader(assignment.date);
                
                return (
                  <div key={assignment.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[60px]">
                        <div className="text-sm font-semibold">{dateInfo.day}</div>
                        <div className="text-lg font-bold">{dateInfo.date}</div>
                        <div className="text-xs text-slate-500">{dateInfo.month}</div>
                      </div>
                      <div>
                        <div className="font-medium">{pattern?.name || 'Unknown Shift'}</div>
                        <div className="text-sm text-slate-600">{project?.name || 'Unknown Project'}</div>
                        <div className="text-xs text-slate-500">
                          {pattern?.startTime} - {pattern?.endTime}
                          {pattern?.isNight && ' 🌙'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        pattern?.isNight ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {pattern?.dutyType || 'Shift'}
                      </span>
                      <button
                        onClick={() => handleDelete(assignment)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove assignment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
