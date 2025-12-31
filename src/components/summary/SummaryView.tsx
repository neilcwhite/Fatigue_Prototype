'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, AlertTriangle, CheckCircle, Users, Clock, Calendar, BarChart, XCircle, ChevronDown, ChevronUp, Edit2 } from '@/components/ui/Icons';
import type { ProjectCamel, EmployeeCamel, AssignmentCamel, ShiftPatternCamel, WeeklySchedule, SupabaseUser } from '@/lib/types';
import {
  checkProjectCompliance,
  checkEmployeeCompliance,
  type ComplianceViolation
} from '@/lib/compliance';
import { parseTimeToHours, calculateDutyLength } from '@/lib/fatigue';

interface SummaryViewProps {
  user: SupabaseUser;
  onSignOut: () => void;
  onBack: () => void;
  project: ProjectCamel;
  projects: ProjectCamel[];
  employees: EmployeeCamel[];
  assignments: AssignmentCamel[];
  shiftPatterns: ShiftPatternCamel[];
  onSelectProject: (id: number) => void;
  onNavigateToPerson: (employeeId: number) => void;
  onNavigateToPlanning: (projectId: number) => void;
  onEditShiftPattern?: (pattern: ShiftPatternCamel) => void;
}

function getShiftDuration(pattern: ShiftPatternCamel, date: string): number {
  let startTime: string | undefined;
  let endTime: string | undefined;
  
  if (pattern.weeklySchedule) {
    const dayOfWeek = new Date(date).getDay();
    const dayNames: ('Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat')[] = 
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayKey = dayNames[dayOfWeek];
    const daySchedule = pattern.weeklySchedule[dayKey];
    if (daySchedule?.startTime && daySchedule?.endTime) {
      startTime = daySchedule.startTime;
      endTime = daySchedule.endTime;
    }
  }
  
  if (!startTime || !endTime) {
    startTime = pattern.startTime;
    endTime = pattern.endTime;
  }
  
  if (!startTime || !endTime) return 12;
  
  const start = parseTimeToHours(startTime);
  const end = parseTimeToHours(endTime);
  return calculateDutyLength(start, end);
}

export function SummaryView({
  user,
  onSignOut,
  onBack,
  project,
  projects,
  employees,
  assignments,
  shiftPatterns,
  onSelectProject,
  onNavigateToPerson,
  onNavigateToPlanning,
  onEditShiftPattern,
}: SummaryViewProps) {
  const projectAssignments = useMemo(() => 
    assignments.filter(a => a.projectId === project.id),
    [assignments, project.id]
  );

  const complianceResult = useMemo(() => 
    checkProjectCompliance(project.id, assignments, shiftPatterns),
    [project.id, assignments, shiftPatterns]
  );

  const stats = useMemo(() => {
    const uniqueEmployeeIds = [...new Set(projectAssignments.map(a => a.employeeId))];
    const patternMap = new Map(shiftPatterns.map(p => [p.id, p]));
    
    let totalHours = 0;
    const shiftBreakdown: Record<string, { hours: number; count: number; isNight: boolean }> = {};
    
    projectAssignments.forEach(assignment => {
      const pattern = patternMap.get(assignment.shiftPatternId);
      if (pattern) {
        const hours = getShiftDuration(pattern, assignment.date);
        totalHours += hours;
        
        if (!shiftBreakdown[pattern.name]) {
          shiftBreakdown[pattern.name] = { hours: 0, count: 0, isNight: pattern.isNight || false };
        }
        shiftBreakdown[pattern.name].hours += hours;
        shiftBreakdown[pattern.name].count += 1;
      }
    });

    const employeeBreakdown = uniqueEmployeeIds.map(empId => {
      const emp = employees.find(e => e.id === empId);
      const empAssignments = projectAssignments.filter(a => a.employeeId === empId);
      let hours = 0;
      empAssignments.forEach(a => {
        const pattern = patternMap.get(a.shiftPatternId);
        if (pattern) hours += getShiftDuration(pattern, a.date);
      });
      
      const empCompliance = checkEmployeeCompliance(empId, projectAssignments, shiftPatterns);
      
      return {
        id: empId,
        name: emp?.name || 'Unknown',
        role: emp?.role || '',
        shifts: empAssignments.length,
        hours: Math.round(hours * 10) / 10,
        complianceStatus: empCompliance.hasErrors ? 'error' : empCompliance.hasWarnings ? 'warning' : 'ok',
        violations: empCompliance.violations,
      };
    }).sort((a, b) => b.hours - a.hours);

    return {
      employeeCount: uniqueEmployeeIds.length,
      totalHours: Math.round(totalHours),
      totalAssignments: projectAssignments.length,
      shiftBreakdown,
      employeeBreakdown,
    };
  }, [projectAssignments, shiftPatterns, employees]);

  const violationsByEmployee = useMemo(() => {
    const grouped: Record<number, ComplianceViolation[]> = {};
    complianceResult.violations.forEach(v => {
      if (!grouped[v.employeeId]) grouped[v.employeeId] = [];
      grouped[v.employeeId].push(v);
    });
    return grouped;
  }, [complianceResult.violations]);

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

  // Get all shift patterns for this project
  const projectPatterns = useMemo(() =>
    shiftPatterns.filter(sp => sp.projectId === project.id),
    [shiftPatterns, project.id]
  );

  // State for expanding/collapsing shift patterns view when there are many
  const [showAllPatterns, setShowAllPatterns] = useState(false);
  const PATTERNS_COLLAPSED_LIMIT = 6;
  const displayedPatterns = showAllPatterns ? projectPatterns : projectPatterns.slice(0, PATTERNS_COLLAPSED_LIMIT);

  // Helper to get day schedule info
  const getDaySchedule = (pattern: ShiftPatternCamel, dayKey: keyof WeeklySchedule): { active: boolean; hours: string } => {
    const schedule = pattern.weeklySchedule?.[dayKey];
    if (schedule?.startTime && schedule?.endTime) {
      return { active: true, hours: `${schedule.startTime}-${schedule.endTime}` };
    }
    // Fall back to pattern-level times if no weekly schedule
    if (!pattern.weeklySchedule && pattern.startTime && pattern.endTime) {
      return { active: true, hours: `${pattern.startTime}-${pattern.endTime}` };
    }
    return { active: false, hours: '-' };
  };

  const dayKeys: (keyof WeeklySchedule)[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 border-b-4 border-violet-500">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-md text-sm flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <span className="text-white font-semibold text-lg">{project.name} <span className="text-violet-400">Summary</span></span>
              <span className="text-slate-500 text-sm ml-3">{project.location}</span>
            </div>
            <button
              onClick={() => onNavigateToPlanning(project.id)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium"
            >
              Go to Planning
            </button>
          </div>
          <div className="flex items-center gap-4">
            <select value={project.id} onChange={(e) => onSelectProject(Number(e.target.value))} className="bg-slate-700 text-white border-none px-3 py-1.5 rounded text-sm">
              {projects.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
            <span className="bg-slate-700 text-violet-400 px-3 py-1 rounded text-xs font-mono">PROJECT SUMMARY</span>
            <div className="text-slate-400 text-sm">{user?.email}</div>
          </div>
        </div>
      </header>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-slate-600">Total Hours</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalHours.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-slate-600">People Assigned</p>
                <p className="text-3xl font-bold text-slate-900">{stats.employeeCount}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-sm text-slate-600">Total Assignments</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalAssignments}</p>
              </div>
            </div>
          </div>
          
          <div className={`bg-white rounded-lg shadow-md p-6 ${complianceResult.hasErrors ? 'border-l-4 border-red-500' : complianceResult.hasWarnings ? 'border-l-4 border-amber-500' : 'border-l-4 border-green-500'}`}>
            <div className="flex items-center gap-3">
              {complianceResult.hasErrors ? <XCircle className="w-8 h-8 text-red-500" /> : complianceResult.hasWarnings ? <AlertTriangle className="w-8 h-8 text-amber-500" /> : <CheckCircle className="w-8 h-8 text-green-500" />}
              <div>
                <p className="text-sm text-slate-600">Compliance Issues</p>
                <p className={`text-3xl font-bold ${complianceResult.hasErrors ? 'text-red-600' : complianceResult.hasWarnings ? 'text-amber-600' : 'text-green-600'}`}>
                  {complianceResult.errorCount + complianceResult.warningCount}
                </p>
                {complianceResult.errorCount > 0 && <p className="text-xs text-red-600">{complianceResult.errorCount} errors</p>}
                {complianceResult.warningCount > 0 && <p className="text-xs text-amber-600">{complianceResult.warningCount} warnings</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Shift Patterns Week View */}
        {projectPatterns.length > 0 && (
          <div className="bg-white rounded-lg shadow-md mb-6">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-violet-500" />
                Shift Patterns Schedule ({projectPatterns.length})
              </h3>
              {projectPatterns.length > PATTERNS_COLLAPSED_LIMIT && (
                <button
                  onClick={() => setShowAllPatterns(!showAllPatterns)}
                  className="text-sm text-violet-600 hover:text-violet-700 flex items-center gap-1"
                >
                  {showAllPatterns ? (
                    <>Show Less <ChevronUp className="w-4 h-4" /></>
                  ) : (
                    <>Show All ({projectPatterns.length}) <ChevronDown className="w-4 h-4" /></>
                  )}
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left p-3 font-medium text-slate-700 border-b w-[220px]">Pattern</th>
                    {dayKeys.map(day => (
                      <th key={day} className="text-center p-3 font-medium text-slate-700 border-b w-[90px]">{day}</th>
                    ))}
                    <th className="text-center p-3 font-medium text-slate-700 border-b w-[60px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {displayedPatterns.map((pattern) => (
                    <tr key={pattern.id} className="border-b border-slate-100 hover:bg-slate-50 group">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${pattern.isNight ? 'bg-purple-500' : 'bg-green-500'}`} />
                          <div className="min-w-0">
                            <span className="font-medium text-slate-800 block truncate">{pattern.name}</span>
                            <span className="text-xs text-slate-500">{pattern.dutyType}</span>
                          </div>
                        </div>
                      </td>
                      {dayKeys.map(day => {
                        const { active, hours } = getDaySchedule(pattern, day);
                        return (
                          <td key={day} className="text-center p-2">
                            {active ? (
                              <div className={`inline-flex flex-col items-center justify-center w-full py-1.5 px-1 rounded ${pattern.isNight ? 'bg-purple-50' : 'bg-green-50'}`}>
                                <span className={`text-xs font-medium ${pattern.isNight ? 'text-purple-700' : 'text-green-700'}`}>
                                  {hours.split('-')[0]}
                                </span>
                                <span className={`text-[10px] ${pattern.isNight ? 'text-purple-400' : 'text-green-400'}`}>to</span>
                                <span className={`text-xs font-medium ${pattern.isNight ? 'text-purple-700' : 'text-green-700'}`}>
                                  {hours.split('-')[1]}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-center p-2">
                        {onEditShiftPattern && (
                          <button
                            onClick={() => onEditShiftPattern(pattern)}
                            className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Edit shift pattern"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {projectPatterns.length > PATTERNS_COLLAPSED_LIMIT && !showAllPatterns && (
              <div className="p-3 text-center border-t border-slate-100">
                <button
                  onClick={() => setShowAllPatterns(true)}
                  className="text-sm text-violet-600 hover:text-violet-700"
                >
                  + {projectPatterns.length - PATTERNS_COLLAPSED_LIMIT} more patterns
                </button>
              </div>
            )}
          </div>
        )}

        {/* Compliance Issues - Clickable to navigate to person */}
        {complianceResult.violations.length > 0 && (
          <div className="bg-white rounded-lg shadow-md mb-6">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold text-slate-800">Compliance Issues ({complianceResult.violations.length})</h3>
              <span className="text-xs text-slate-500 ml-2">Click any issue to view in calendar</span>
            </div>
            <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
              {Object.entries(violationsByEmployee).map(([empId, empViolations]) => {
                const emp = employees.find(e => e.id === Number(empId));
                const empName = emp?.name || 'Unknown';
                const empRole = emp?.role || '';
                const hasErrors = empViolations.some(v => v.severity === 'error');

                return (
                  <div key={empId} className={`rounded-lg overflow-hidden ${hasErrors ? 'border-l-4 border-red-500' : 'border-l-4 border-amber-500'}`}>
                    {/* Employee Header - Clickable */}
                    <button
                      onClick={() => onNavigateToPerson(Number(empId))}
                      className={`w-full text-left p-3 flex items-center justify-between transition-colors ${hasErrors ? 'bg-red-100 hover:bg-red-200' : 'bg-amber-100 hover:bg-amber-200'}`}
                    >
                      <div className="flex items-center gap-2">
                        {hasErrors ? <XCircle className="w-5 h-5 text-red-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}
                        <div>
                          <span className={`font-semibold ${hasErrors ? 'text-red-900' : 'text-amber-900'}`}>
                            {empName}
                          </span>
                          {empRole && <span className="text-xs text-slate-600 ml-2">({empRole})</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${hasErrors ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>
                          {empViolations.length} issue{empViolations.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-blue-600">View →</span>
                      </div>
                    </button>

                    {/* Individual Violations - Each Clickable */}
                    <div className={`${hasErrors ? 'bg-red-50' : 'bg-amber-50'}`}>
                      {empViolations.map((violation, idx) => (
                        <button
                          key={idx}
                          onClick={() => onNavigateToPerson(Number(empId))}
                          className={`w-full text-left p-3 border-t transition-all hover:shadow-inner ${
                            hasErrors
                              ? 'border-red-200 hover:bg-red-100'
                              : 'border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-lg">{getViolationIcon(violation.type)}</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${violation.severity === 'error' ? 'text-red-800' : 'text-amber-800'}`}>
                                {violation.message}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                {violation.date && new Date(violation.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                                <span className="text-blue-500 ml-1">→ Click to view in calendar</span>
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No Issues Message */}
        {complianceResult.violations.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div>
                <h3 className="font-semibold text-green-800">All Clear!</h3>
                <p className="text-sm text-green-700">No compliance issues detected for this project.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
