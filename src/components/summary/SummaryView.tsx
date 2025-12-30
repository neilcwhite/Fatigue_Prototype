'use client';

import { useMemo } from 'react';
import { ChevronLeft, AlertTriangle, CheckCircle, Users, Clock, Calendar, BarChart, XCircle } from '@/components/ui/Icons';
import type { ProjectCamel, EmployeeCamel, AssignmentCamel, ShiftPatternCamel } from '@/lib/types';
import { 
  checkProjectCompliance, 
  checkEmployeeCompliance,
  type ComplianceViolation 
} from '@/lib/compliance';
import { parseTimeToHours, calculateDutyLength } from '@/lib/fatigue';

interface SummaryViewProps {
  user: any;
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

        {complianceResult.violations.length > 0 && (
          <div className="bg-white rounded-lg shadow-md mb-6">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold text-slate-800">Compliance Issues ({complianceResult.violations.length})</h3>
            </div>
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
              {Object.entries(violationsByEmployee).map(([empId, empViolations]) => {
                const empName = employees.find(e => e.id === Number(empId))?.name || 'Unknown';
                const hasErrors = empViolations.some(v => v.severity === 'error');
                
                return (
                  <div key={empId} className={`p-4 rounded-lg ${hasErrors ? 'border-l-4 border-red-500 bg-red-50' : 'border-l-4 border-amber-500 bg-amber-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-semibold cursor-pointer hover:underline ${hasErrors ? 'text-red-900' : 'text-amber-900'}`} onClick={() => onNavigateToPerson(Number(empId))}>
                        {empName}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${hasErrors ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>
                        {empViolations.length} issue{empViolations.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {empViolations.map((violation, idx) => (
                        <div key={idx} className={`text-sm ${violation.severity === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
                          <span className="mr-1">{getViolationIcon(violation.type)}</span>
                          {violation.message}
                          {violation.date && <span className="text-slate-500 ml-1">({violation.date})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <BarChart className="w-5 h-5" />
                Shift Pattern Breakdown
              </h3>
            </div>
            <div className="p-4">
              {Object.keys(stats.shiftBreakdown).length === 0 ? (
                <p className="text-slate-500 text-center py-4">No shift patterns assigned</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(stats.shiftBreakdown).map(([name, data]) => (
                    <div key={name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${data.isNight ? 'bg-purple-500' : 'bg-green-500'}`} />
                        <div>
                          <p className="font-medium text-slate-800">{name}</p>
                          <p className="text-xs text-slate-500">{data.count} shifts</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-800">{Math.round(data.hours)}h</p>
                        <p className="text-xs text-slate-500">{stats.totalHours > 0 ? Math.round(data.hours / stats.totalHours * 100) : 0}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Employee Hours
              </h3>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {stats.employeeBreakdown.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No employees assigned</p>
              ) : (
                <div className="space-y-2">
                  {stats.employeeBreakdown.map(emp => (
                    <div key={emp.id} className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${emp.complianceStatus === 'error' ? 'bg-red-50 hover:bg-red-100 border border-red-200' : emp.complianceStatus === 'warning' ? 'bg-amber-50 hover:bg-amber-100 border border-amber-200' : 'bg-slate-50 hover:bg-slate-100'}`} onClick={() => onNavigateToPerson(emp.id)}>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-800">{emp.name}</p>
                          {emp.complianceStatus === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                          {emp.complianceStatus === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                        </div>
                        <p className="text-xs text-slate-500">{emp.role} - {emp.shifts} shifts</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-800">{emp.hours}h</p>
                        <p className="text-xs text-slate-500">{emp.shifts > 0 ? Math.round(emp.hours / emp.shifts * 10) / 10 : 0}h avg</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md mt-6">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">Project Details</h3>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-slate-500">Location</p>
              <p className="font-medium text-slate-900">{project.location || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Type</p>
              <p className="font-medium text-slate-900">{project.type || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Start Date</p>
              <p className="font-medium text-slate-900">{project.startDate || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">End Date</p>
              <p className="font-medium text-slate-900">{project.endDate || 'Not set'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
