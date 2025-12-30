'use client';

import { useMemo } from 'react';
import { ChevronLeft, AlertTriangle, CheckCircle, Users, Clock, Calendar, BarChart, XCircle } from '@/components/ui/Icons';
import type { ProjectCamel, EmployeeCamel, AssignmentCamel, ShiftPatternCamel } from '@/lib/types';
import { COMPLIANCE_LIMITS } from '@/lib/compliance';

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
}

interface Violation {
  employeeId: number;
  employeeName: string;
  type: string;
  message: string;
  date?: string;
  value?: number;
  limit?: number;
}

// Helper to get shift duration
function getShiftDuration(pattern: ShiftPatternCamel, date: string): number {
  if (pattern.weeklySchedule) {
    const dayOfWeek = new Date(date).getDay();
    const dayNames: ('Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat')[] = 
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayKey = dayNames[dayOfWeek];
    const daySchedule = pattern.weeklySchedule[dayKey];
    if (daySchedule?.startTime && daySchedule?.endTime) {
      const start = parseInt(daySchedule.startTime.split(':')[0]) + parseInt(daySchedule.startTime.split(':')[1]) / 60;
      let end = parseInt(daySchedule.endTime.split(':')[0]) + parseInt(daySchedule.endTime.split(':')[1]) / 60;
      if (end <= start) end += 24;
      return end - start;
    }
  }
  
  if (pattern.startTime && pattern.endTime) {
    const start = parseInt(pattern.startTime.split(':')[0]) + parseInt(pattern.startTime.split(':')[1]) / 60;
    let end = parseInt(pattern.endTime.split(':')[0]) + parseInt(pattern.endTime.split(':')[1]) / 60;
    if (end <= start) end += 24;
    return end - start;
  }
  
  return 12; // Default
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
}: SummaryViewProps) {
  // Get project-specific data
  const projectAssignments = useMemo(() => 
    assignments.filter(a => a.projectId === project.id),
    [assignments, project.id]
  );
  
  const projectShiftPatterns = useMemo(() =>
    shiftPatterns.filter(sp => sp.projectId === project.id),
    [shiftPatterns, project.id]
  );

  // Calculate stats and compliance
  const stats = useMemo(() => {
    const uniqueEmployeeIds = [...new Set(projectAssignments.map(a => a.employeeId))];
    const employeeCount = uniqueEmployeeIds.length;
    const patternMap = new Map(shiftPatterns.map(p => [p.id, p]));
    
    // Calculate total hours and shift breakdown
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

    // Employee breakdown
    const employeeBreakdown = uniqueEmployeeIds.map(empId => {
      const emp = employees.find(e => e.id === empId);
      const empAssignments = projectAssignments.filter(a => a.employeeId === empId);
      let hours = 0;
      empAssignments.forEach(a => {
        const pattern = patternMap.get(a.shiftPatternId);
        if (pattern) hours += getShiftDuration(pattern, a.date);
      });
      return {
        id: empId,
        name: emp?.name || 'Unknown',
        role: emp?.role || '',
        shifts: empAssignments.length,
        hours: Math.round(hours * 10) / 10,
      };
    }).sort((a, b) => b.hours - a.hours);

    // Run compliance checks
    const violations: Violation[] = [];
    
    for (const empId of uniqueEmployeeIds) {
      const emp = employees.find(e => e.id === empId);
      const empName = emp?.name || 'Unknown';
      const empAssignments = projectAssignments
        .filter(a => a.employeeId === empId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Check each assignment for max shift duration
      empAssignments.forEach(assignment => {
        const pattern = patternMap.get(assignment.shiftPatternId);
        if (pattern) {
          const duration = getShiftDuration(pattern, assignment.date);
          if (duration > COMPLIANCE_LIMITS.MAX_SHIFT_HOURS) {
            violations.push({
              employeeId: empId,
              employeeName: empName,
              type: 'MAX_SHIFT_EXCEEDED',
              message: `Shift exceeds ${COMPLIANCE_LIMITS.MAX_SHIFT_HOURS}h limit`,
              date: assignment.date,
              value: Math.round(duration * 10) / 10,
              limit: COMPLIANCE_LIMITS.MAX_SHIFT_HOURS,
            });
          }
        }
      });
      
      // Check rest periods between shifts
      for (let i = 1; i < empAssignments.length; i++) {
        const prevAssignment = empAssignments[i - 1];
        const currAssignment = empAssignments[i];
        const prevPattern = patternMap.get(prevAssignment.shiftPatternId);
        const currPattern = patternMap.get(currAssignment.shiftPatternId);
        
        if (prevPattern && currPattern) {
          const prevEnd = prevPattern.endTime || '19:00';
          const currStart = currPattern.startTime || '07:00';
          
          const prevDate = new Date(prevAssignment.date);
          const currDate = new Date(currAssignment.date);
          const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff === 1) {
            // Consecutive days - check rest period
            const prevEndHour = parseInt(prevEnd.split(':')[0]);
            const currStartHour = parseInt(currStart.split(':')[0]);
            
            let restHours = currStartHour - prevEndHour;
            if (currStartHour <= prevEndHour) {
              restHours = (24 - prevEndHour) + currStartHour;
            }
            
            if (restHours < COMPLIANCE_LIMITS.MIN_REST_HOURS) {
              violations.push({
                employeeId: empId,
                employeeName: empName,
                type: 'MIN_REST_VIOLATED',
                message: `Less than ${COMPLIANCE_LIMITS.MIN_REST_HOURS}h rest between shifts`,
                date: currAssignment.date,
                value: restHours,
                limit: COMPLIANCE_LIMITS.MIN_REST_HOURS,
              });
            }
          }
        }
      }
      
      // Check consecutive days
      let consecutiveDays = 1;
      let maxConsecutive = 1;
      
      for (let i = 1; i < empAssignments.length; i++) {
        const prevDate = new Date(empAssignments[i - 1].date);
        const currDate = new Date(empAssignments[i].date);
        const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 1) {
          consecutiveDays++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveDays);
        } else {
          consecutiveDays = 1;
        }
      }
      
      if (maxConsecutive > COMPLIANCE_LIMITS.MAX_CONSECUTIVE_DAYS) {
        violations.push({
          employeeId: empId,
          employeeName: empName,
          type: 'MAX_CONSECUTIVE_DAYS',
          message: `Worked ${maxConsecutive} consecutive days (max ${COMPLIANCE_LIMITS.MAX_CONSECUTIVE_DAYS})`,
          value: maxConsecutive,
          limit: COMPLIANCE_LIMITS.MAX_CONSECUTIVE_DAYS,
        });
      }
      
      // Check weekly hours (rolling 7-day windows)
      if (empAssignments.length >= 7) {
        for (let i = 0; i <= empAssignments.length - 7; i++) {
          const windowAssignments = empAssignments.slice(i, i + 7);
          const firstDate = new Date(windowAssignments[0].date);
          const lastDate = new Date(windowAssignments[windowAssignments.length - 1].date);
          const daySpan = Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daySpan <= 7) {
            let weeklyHours = 0;
            windowAssignments.forEach(a => {
              const pattern = patternMap.get(a.shiftPatternId);
              if (pattern) weeklyHours += getShiftDuration(pattern, a.date);
            });
            
            if (weeklyHours > COMPLIANCE_LIMITS.MAX_WEEKLY_HOURS) {
              violations.push({
                employeeId: empId,
                employeeName: empName,
                type: 'MAX_WEEKLY_EXCEEDED',
                message: `${Math.round(weeklyHours)}h in 7-day period (max ${COMPLIANCE_LIMITS.MAX_WEEKLY_HOURS}h)`,
                date: windowAssignments[0].date,
                value: Math.round(weeklyHours),
                limit: COMPLIANCE_LIMITS.MAX_WEEKLY_HOURS,
              });
              break; // Only report first instance
            }
          }
        }
      }
    }

    return {
      employeeCount,
      totalHours: Math.round(totalHours),
      totalAssignments: projectAssignments.length,
      shiftBreakdown,
      employeeBreakdown,
      violations,
    };
  }, [projectAssignments, shiftPatterns, employees]);

  const violationsByEmployee = useMemo(() => {
    const grouped: Record<number, Violation[]> = {};
    stats.violations.forEach(v => {
      if (!grouped[v.employeeId]) grouped[v.employeeId] = [];
      grouped[v.employeeId].push(v);
    });
    return grouped;
  }, [stats.violations]);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 border-b-4 border-violet-500">
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
                {project.name} <span className="text-violet-400">Summary</span>
              </span>
              <span className="text-slate-500 text-sm ml-3">{project.location}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={project.id}
              onChange={(e) => onSelectProject(Number(e.target.value))}
              className="bg-slate-700 text-white border-none px-3 py-1.5 rounded text-sm"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <span className="bg-slate-700 text-violet-400 px-3 py-1 rounded text-xs font-mono">
              PROJECT SUMMARY
            </span>
            <div className="text-slate-400 text-sm">{user?.email}</div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Stats Cards */}
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
          
          <div className={`bg-white rounded-lg shadow-md p-6 ${
            stats.violations.length > 0 ? 'border-l-4 border-red-500' : 'border-l-4 border-green-500'
          }`}>
            <div className="flex items-center gap-3">
              {stats.violations.length > 0 ? (
                <XCircle className="w-8 h-8 text-red-500" />
              ) : (
                <CheckCircle className="w-8 h-8 text-green-500" />
              )}
              <div>
                <p className="text-sm text-slate-600">Compliance Issues</p>
                <p className={`text-3xl font-bold ${stats.violations.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {stats.violations.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Compliance Violations */}
        {stats.violations.length > 0 && (
          <div className="bg-white rounded-lg shadow-md mb-6">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold text-slate-800">Compliance Issues Detected</h3>
            </div>
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
              {Object.entries(violationsByEmployee).map(([empId, empViolations]) => (
                <div key={empId} className="border-l-4 border-red-500 bg-red-50 p-4 rounded-r-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span 
                      className="font-semibold text-red-900 cursor-pointer hover:underline"
                      onClick={() => onNavigateToPerson(Number(empId))}
                    >
                      {empViolations[0].employeeName}
                    </span>
                    <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded">
                      {empViolations.length} issue{empViolations.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {empViolations.map((violation, idx) => (
                      <div key={idx} className="text-sm text-red-700">
                        <span className="font-medium">
                          {violation.type === 'MAX_SHIFT_EXCEEDED' && '⏱️ '}
                          {violation.type === 'MIN_REST_VIOLATED' && '😴 '}
                          {violation.type === 'MAX_CONSECUTIVE_DAYS' && '📅 '}
                          {violation.type === 'MAX_WEEKLY_EXCEEDED' && '⚠️ '}
                        </span>
                        {violation.message}
                        {violation.date && <span className="text-red-500 ml-1">({violation.date})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Shift Pattern Breakdown */}
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
                        <p className="text-xs text-slate-500">
                          {stats.totalHours > 0 ? Math.round(data.hours / stats.totalHours * 100) : 0}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Employee Hours */}
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
                  {stats.employeeBreakdown.map(emp => {
                    const hasViolations = violationsByEmployee[emp.id]?.length > 0;
                    return (
                      <div 
                        key={emp.id} 
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                          hasViolations 
                            ? 'bg-red-50 hover:bg-red-100 border border-red-200' 
                            : 'bg-slate-50 hover:bg-slate-100'
                        }`}
                        onClick={() => onNavigateToPerson(emp.id)}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-800">{emp.name}</p>
                            {hasViolations && <XCircle className="w-4 h-4 text-red-500" />}
                          </div>
                          <p className="text-xs text-slate-500">{emp.role} • {emp.shifts} shifts</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-800">{emp.hours}h</p>
                          <p className="text-xs text-slate-500">
                            {emp.shifts > 0 ? Math.round(emp.hours / emp.shifts * 10) / 10 : 0}h avg
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Project Info */}
        <div className="bg-white rounded-lg shadow-md mt-6">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">Project Details</h3>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-slate-500">Location</p>
              <p className="font-medium">{project.location || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Type</p>
              <p className="font-medium">{project.type || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Start Date</p>
              <p className="font-medium">{project.startDate || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">End Date</p>
              <p className="font-medium">{project.endDate || 'Not set'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
