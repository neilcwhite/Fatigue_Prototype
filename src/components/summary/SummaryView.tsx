'use client';

import { useMemo } from 'react';
import { ChevronLeft, AlertTriangle, CheckCircle, Users, Clock, Calendar, BarChart } from '@/components/ui/Icons';
import type { ProjectCamel, EmployeeCamel, AssignmentCamel, ShiftPatternCamel } from '@/lib/types';

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

  // Calculate stats
  const stats = useMemo(() => {
    const uniqueEmployeeIds = [...new Set(projectAssignments.map(a => a.employeeId))];
    const employeeCount = uniqueEmployeeIds.length;
    
    // Calculate total hours
    let totalHours = 0;
    projectAssignments.forEach(assignment => {
      const pattern = shiftPatterns.find(p => p.id === assignment.shiftPatternId);
      if (pattern?.startTime && pattern?.endTime) {
        const start = parseInt(pattern.startTime.split(':')[0]);
        const end = parseInt(pattern.endTime.split(':')[0]);
        const hours = end > start ? end - start : (24 - start) + end;
        totalHours += hours;
      } else {
        totalHours += 12; // Default 12 hours
      }
    });

    // Shift breakdown
    const shiftBreakdown: Record<string, { hours: number; count: number; isNight: boolean }> = {};
    projectAssignments.forEach(assignment => {
      const pattern = shiftPatterns.find(p => p.id === assignment.shiftPatternId);
      if (pattern) {
        if (!shiftBreakdown[pattern.name]) {
          shiftBreakdown[pattern.name] = { hours: 0, count: 0, isNight: pattern.isNight || false };
        }
        const start = parseInt(pattern.startTime?.split(':')[0] || '0');
        const end = parseInt(pattern.endTime?.split(':')[0] || '0');
        const hours = end > start ? end - start : (24 - start) + end;
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
        const pattern = shiftPatterns.find(p => p.id === a.shiftPatternId);
        if (pattern?.startTime && pattern?.endTime) {
          const start = parseInt(pattern.startTime.split(':')[0]);
          const end = parseInt(pattern.endTime.split(':')[0]);
          hours += end > start ? end - start : (24 - start) + end;
        } else {
          hours += 12;
        }
      });
      return {
        id: empId,
        name: emp?.name || 'Unknown',
        role: emp?.role || '',
        shifts: empAssignments.length,
        hours,
      };
    }).sort((a, b) => b.hours - a.hours);

    return {
      employeeCount,
      totalHours,
      totalAssignments: projectAssignments.length,
      shiftBreakdown,
      employeeBreakdown,
      violations: [], // TODO: Calculate compliance violations
    };
  }, [projectAssignments, shiftPatterns, employees]);

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
            {/* Project Selector */}
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
                <p className="text-sm text-slate-600">Total Hours Planned</p>
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
                <AlertTriangle className="w-8 h-8 text-red-500" />
              ) : (
                <CheckCircle className="w-8 h-8 text-green-500" />
              )}
              <div>
                <p className="text-sm text-slate-600">Compliance Breaches</p>
                <p className={`text-3xl font-bold ${stats.violations.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {stats.violations.length}
                </p>
              </div>
            </div>
          </div>
        </div>

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
                        <p className="font-semibold text-slate-800">{data.hours}h</p>
                        <p className="text-xs text-slate-500">{Math.round(data.hours / stats.totalHours * 100)}%</p>
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
                  {stats.employeeBreakdown.map(emp => (
                    <div 
                      key={emp.id} 
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                      onClick={() => onNavigateToPerson(emp.id)}
                    >
                      <div>
                        <p className="font-medium text-slate-800">{emp.name}</p>
                        <p className="text-xs text-slate-500">{emp.role} • {emp.shifts} shifts</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-800">{emp.hours}h</p>
                        <p className="text-xs text-slate-500">
                          {emp.shifts > 0 ? Math.round(emp.hours / emp.shifts) : 0}h avg
                        </p>
                      </div>
                    </div>
                  ))}
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
