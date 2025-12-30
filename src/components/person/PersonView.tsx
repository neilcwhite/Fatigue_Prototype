'use client';

import { useMemo } from 'react';
import { ChevronLeft, AlertTriangle, CheckCircle, XCircle, Trash2 } from '@/components/ui/Icons';
import { checkEmployeeCompliance, type ComplianceViolation } from '@/lib/compliance';
import { parseTimeToHours, calculateDutyLength } from '@/lib/fatigue';
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

  // Run compliance checks
  const compliance = useMemo(() => 
    checkEmployeeCompliance(employee.id, assignments, shiftPatterns),
    [employee.id, assignments, shiftPatterns]
  );

  // Build set of assignment IDs that are involved in violations
  const violationAssignmentIds = useMemo(() => {
    const ids = new Set<number>();
    
    compliance.violations.forEach(violation => {
      let violationAssignments: AssignmentCamel[] = [];
      
      if (violation.type === 'MAX_WEEKLY_HOURS' || violation.type === 'APPROACHING_WEEKLY_LIMIT') {
        const windowStart = new Date(violation.date);
        const windowEnd = violation.windowEnd 
          ? new Date(violation.windowEnd)
          : new Date(windowStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        
        violationAssignments = empAssignments.filter(a => {
          const aDate = new Date(a.date);
          return aDate >= windowStart && aDate <= windowEnd;
        });
      } else if (violation.type === 'INSUFFICIENT_REST') {
        // Include both the current day and previous day assignments
        const violationDate = new Date(violation.date);
        const prevDate = new Date(violationDate);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevDateStr = prevDate.toISOString().split('T')[0];
        
        violationAssignments = empAssignments.filter(a => 
          a.date === violation.date || a.date === prevDateStr
        );
      } else if (violation.type === 'MAX_CONSECUTIVE_DAYS' || violation.type === 'MAX_CONSECUTIVE_NIGHTS' || violation.type === 'CONSECUTIVE_NIGHTS_WARNING') {
        // Include all related dates
        if (violation.relatedDates) {
          violationAssignments = empAssignments.filter(a => 
            violation.relatedDates?.includes(a.date) || a.date === violation.date
          );
        } else {
          violationAssignments = empAssignments.filter(a => a.date === violation.date);
        }
      } else {
        // MAX_SHIFT_LENGTH, DAY_NIGHT_TRANSITION, MULTIPLE_SHIFTS_SAME_DAY
        violationAssignments = empAssignments.filter(a => a.date === violation.date);
      }
      
      violationAssignments.forEach(a => ids.add(a.id));
    });
    
    return ids;
  }, [compliance.violations, empAssignments]);

  // Calculate date range for calendar
  const calendarDates = useMemo(() => {
    const dates: string[] = [];
    const today = new Date();
    const startDate = empAssignments.length > 0 
      ? new Date(Math.min(new Date(empAssignments[0].date).getTime(), today.getTime()))
      : today;
    
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
    
    let totalHours = 0;
    empAssignments.forEach(a => {
      const pattern = shiftPatterns.find(p => p.id === a.shiftPatternId);
      if (pattern?.startTime && pattern?.endTime) {
        const start = parseTimeToHours(pattern.startTime);
        const end = parseTimeToHours(pattern.endTime);
        totalHours += calculateDutyLength(start, end);
      } else {
        totalHours += 12;
      }
    });

    return { totalShifts, uniqueProjects, totalHours: Math.round(totalHours) };
  }, [empAssignments, shiftPatterns]);

  const getAssignmentInfo = (assignment: AssignmentCamel) => {
    const pattern = shiftPatterns.find(p => p.id === assignment.shiftPatternId);
    const project = projects.find(p => p.id === assignment.projectId);
    return { pattern, project };
  };

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
    const { pattern } = getAssignmentInfo(assignment);
    if (confirm(`Remove ${employee.name} from ${pattern?.name || 'shift'} on ${assignment.date}?`)) {
      try {
        await onDeleteAssignment(assignment.id);
      } catch (err) {
        console.error('Error deleting assignment:', err);
        alert('Failed to delete assignment');
      }
    }
  };

  const getViolationIcon = (type: string) => {
    switch (type) {
      case 'MAX_SHIFT_LENGTH': return '⏱️';
      case 'INSUFFICIENT_REST': return '😴';
      case 'MAX_WEEKLY_HOURS': return '📊';
      case 'APPROACHING_WEEKLY_LIMIT': return '⚠️';
      case 'MAX_CONSECUTIVE_DAYS': return '📅';
      case 'CONSECUTIVE_NIGHTS_WARNING': return '🌙';
      case 'MAX_CONSECUTIVE_NIGHTS': return '🌙';
      case 'DAY_NIGHT_TRANSITION': return '🔄';
      case 'MULTIPLE_SHIFTS_SAME_DAY': return '⚡';
      default: return '⚠️';
    }
  };

  const getViolationTitle = (type: string) => {
    switch (type) {
      case 'MAX_SHIFT_LENGTH': return 'Maximum Shift Length Exceeded';
      case 'INSUFFICIENT_REST': return 'Insufficient Rest Period';
      case 'MAX_WEEKLY_HOURS': return 'Maximum Weekly Hours Exceeded';
      case 'APPROACHING_WEEKLY_LIMIT': return 'Approaching Weekly Limit';
      case 'MAX_CONSECUTIVE_DAYS': return 'Too Many Consecutive Days';
      case 'CONSECUTIVE_NIGHTS_WARNING': return 'Extended Night Shift Run';
      case 'MAX_CONSECUTIVE_NIGHTS': return 'Too Many Consecutive Nights';
      case 'DAY_NIGHT_TRANSITION': return 'Day-Night Transition Same Day';
      case 'MULTIPLE_SHIFTS_SAME_DAY': return 'Multiple Shifts Same Day';
      default: return 'Compliance Issue';
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 border-b-4 border-orange-500">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-md text-sm flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <span className="text-white font-semibold text-lg">{employee.name}</span>
              <span className="text-slate-500 text-sm ml-3">{employee.role}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <select value={employee.id} onChange={(e) => onSelectEmployee(Number(e.target.value))} className="bg-slate-700 text-white border-none px-3 py-1.5 rounded text-sm">
              {employees.map(emp => (<option key={emp.id} value={emp.id}>{emp.name}</option>))}
            </select>
            <span className="bg-slate-700 text-orange-400 px-3 py-1 rounded text-xs font-mono">PERSON VIEW</span>
            <div className="text-slate-400 text-sm">{user?.email}</div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className={`bg-white rounded-lg shadow p-4 ${compliance.hasErrors ? 'border-l-4 border-red-500' : compliance.hasWarnings ? 'border-l-4 border-amber-500' : 'border-l-4 border-green-500'}`}>
            <p className="text-sm text-slate-600">Compliance Status</p>
            <div className="flex items-center gap-2 mt-1">
              {compliance.hasErrors ? <XCircle className="w-6 h-6 text-red-500" /> : compliance.hasWarnings ? <AlertTriangle className="w-6 h-6 text-amber-500" /> : <CheckCircle className="w-6 h-6 text-green-500" />}
              <span className={`text-xl font-bold ${compliance.hasErrors ? 'text-red-600' : compliance.hasWarnings ? 'text-amber-600' : 'text-green-600'}`}>
                {compliance.violations.length} Issues
              </span>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600">Total Shifts</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalShifts}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600">Total Hours</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalHours}h</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600">Projects</p>
            <p className="text-2xl font-bold text-slate-900">{stats.uniqueProjects}</p>
          </div>
        </div>

        {/* Compliance Violations Section */}
        {compliance.violations.length > 0 && (
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold text-slate-800">Compliance Violations ({compliance.violations.length})</h3>
            </div>
            <div className="p-4 space-y-4">
              {compliance.violations.map((violation, idx) => {
                // Get assignments involved in this violation
                const involvedAssignments = empAssignments.filter(a => violationAssignmentIds.has(a.id) && (
                  a.date === violation.date || 
                  violation.relatedDates?.includes(a.date) ||
                  (violation.windowEnd && new Date(a.date) >= new Date(violation.date) && new Date(a.date) <= new Date(violation.windowEnd))
                ));

                return (
                  <div key={idx} className={`p-4 rounded-lg ${violation.severity === 'error' ? 'bg-red-50 border-l-4 border-red-500' : 'bg-amber-50 border-l-4 border-amber-500'}`}>
                    <div className="flex items-start gap-3">
                      {violation.severity === 'error' ? <XCircle className="w-5 h-5 text-red-500 mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />}
                      <div className="flex-1">
                        <p className={`font-semibold ${violation.severity === 'error' ? 'text-red-900' : 'text-amber-900'}`}>
                          {getViolationIcon(violation.type)} {getViolationTitle(violation.type)}
                        </p>
                        <p className={`text-sm mt-1 ${violation.severity === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
                          {violation.message}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Date: {new Date(violation.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                          {violation.windowEnd && ` to ${new Date(violation.windowEnd).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`}
                        </p>
                        
                        {/* Shifts causing this violation */}
                        {involvedAssignments.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-semibold text-slate-700">Shifts involved:</p>
                            {involvedAssignments.slice(0, 5).map(assignment => {
                              const { pattern, project } = getAssignmentInfo(assignment);
                              return (
                                <div key={assignment.id} className="flex items-center justify-between bg-white rounded p-2 border border-slate-200">
                                  <div>
                                    <span className="text-sm font-medium text-slate-800">{pattern?.name || 'Unknown'}</span>
                                    <span className="text-xs text-slate-500 ml-2">
                                      {new Date(assignment.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </span>
                                    <span className="text-xs text-slate-400 ml-2">{project?.name}</span>
                                  </div>
                                  <button onClick={() => handleDelete(assignment)} className="text-red-500 hover:text-red-700 p-1" title="Delete this assignment to resolve">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              );
                            })}
                            {involvedAssignments.length > 5 && (
                              <p className="text-xs text-slate-500">...and {involvedAssignments.length - 5} more</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Schedule Timeline */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Schedule Timeline</h3>
          <div className="overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              {calendarDates.map((date, idx) => {
                const { day, date: dateNum, month, isWeekend, isToday } = formatDateHeader(date);
                const dateAssignments = empAssignments.filter(a => a.date === date);
                const hasViolation = dateAssignments.some(a => violationAssignmentIds.has(a.id));
                
                return (
                  <div 
                    key={idx} 
                    className={`flex-shrink-0 w-32 p-2 border rounded-lg ${
                      hasViolation 
                        ? 'bg-red-600 border-red-700 border-2' 
                        : dateAssignments.length > 0 
                          ? 'bg-green-100 border-green-300' 
                          : isWeekend 
                            ? 'weekend-hatch border-slate-200' 
                            : isToday 
                              ? 'bg-blue-50 border-blue-300' 
                              : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className={`text-sm font-bold text-center ${hasViolation ? 'text-white' : 'text-slate-900'}`}>{day}</div>
                    <div className={`text-sm font-semibold text-center mb-2 ${hasViolation ? 'text-white' : 'text-slate-700'}`}>{dateNum} {month}</div>
                    
                    {dateAssignments.length === 0 ? (
                      <div className="text-xs text-slate-400 text-center py-2">No shift</div>
                    ) : (
                      <div className="space-y-1">
                        {dateAssignments.map(assignment => {
                          const { pattern, project } = getAssignmentInfo(assignment);
                          const isViolationShift = violationAssignmentIds.has(assignment.id);
                          
                          return (
                            <div 
                              key={assignment.id} 
                              className={`relative rounded p-1.5 text-xs ${
                                isViolationShift 
                                  ? 'bg-white border-2 border-red-400 ring-2 ring-red-200' 
                                  : 'bg-white border border-slate-200'
                              }`}
                            >
                              <button 
                                onClick={() => handleDelete(assignment)} 
                                className="absolute top-0.5 right-0.5 text-red-400 hover:text-red-600 p-0.5"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                              <div className="font-medium text-slate-800 pr-4">{pattern?.name || '?'}</div>
                              <div className="text-slate-500">{pattern?.startTime} - {pattern?.endTime}</div>
                              {isViolationShift && <AlertTriangle className="w-3 h-3 text-red-500 mt-1" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* All Assignments List */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">All Assignments ({empAssignments.length})</h3>
          </div>
          <div className="p-4">
            {empAssignments.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No assignments</p>
            ) : (
              <div className="space-y-2">
                {empAssignments.map(assignment => {
                  const { pattern, project } = getAssignmentInfo(assignment);
                  const isViolation = violationAssignmentIds.has(assignment.id);
                  const d = new Date(assignment.date);
                  
                  return (
                    <div key={assignment.id} className={`flex items-center justify-between p-3 rounded-lg ${isViolation ? 'bg-red-50 border-2 border-red-300' : 'bg-slate-50'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`text-center min-w-[60px] ${isViolation ? 'text-red-700' : ''}`}>
                          <div className="text-xs text-slate-500">{d.toLocaleDateString('en-GB', { month: 'short' })}</div>
                          <div className="text-xl font-bold">{d.getDate()}</div>
                          <div className="text-xs">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">{pattern?.name || 'Unknown'}</span>
                            {isViolation && <AlertTriangle className="w-4 h-4 text-red-500" />}
                          </div>
                          <div className="text-sm text-slate-600">{project?.name || 'Unknown Project'}</div>
                          <div className="text-xs text-slate-500">{pattern?.startTime || '?'} - {pattern?.endTime || '?'} • {pattern?.dutyType}</div>
                        </div>
                      </div>
                      <button onClick={() => handleDelete(assignment)} className="text-red-500 hover:text-red-700 p-2" title="Delete">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
