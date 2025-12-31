'use client';

import { SignOutHeader } from '@/components/auth/SignOutHeader';
import {
  Calendar,
  Users,
  Plus,
  CheckCircle,
  ErrorTriangle,
  BarChart
} from '@/components/ui/Icons';
import { checkProjectCompliance } from '@/lib/compliance';
import type {
  ProjectCamel,
  EmployeeCamel,
  AssignmentCamel,
  ShiftPatternCamel
} from '@/lib/types';

interface ProjectStats {
  totalHours: number;
  employeeCount: number;
  shiftPatternCount: number;
  violations: string[];
}

interface DashboardProps {
  user: any;
  onSignOut: () => void;
  projects: ProjectCamel[];
  employees: EmployeeCamel[];
  assignments: AssignmentCamel[];
  shiftPatterns: ShiftPatternCamel[];
  onSelectProject: (projectId: number) => void;
  onViewSummary: (projectId: number) => void;
  onViewEmployee: () => void;
  onViewFatigue: () => void;
  onViewTeams: () => void;
  onCreateProject: () => void;
}

export function Dashboard({
  user,
  onSignOut,
  projects,
  employees,
  assignments,
  shiftPatterns,
  onSelectProject,
  onViewSummary,
  onViewEmployee,
  onViewFatigue,
  onViewTeams,
  onCreateProject,
}: DashboardProps) {

  // Calculate stats for a project
  const getProjectStats = (projectId: number): ProjectStats => {
    const projectAssignments = assignments.filter(a => a.projectId === projectId);
    const projectPatterns = shiftPatterns.filter(sp => sp.projectId === projectId);

    let totalHours = 0;
    const employeeIds = new Set<number>();

    projectAssignments.forEach(assignment => {
      employeeIds.add(assignment.employeeId);

      const pattern = projectPatterns.find(p => p.id === assignment.shiftPatternId);
      if (pattern?.startTime && pattern?.endTime) {
        const start = parseFloat(pattern.startTime.replace(':', '.'));
        const end = parseFloat(pattern.endTime.replace(':', '.'));
        let hours = end - start;
        if (hours < 0) hours += 24; // Overnight shift
        totalHours += hours;
      }
    });

    // Run proper compliance checking
    const complianceResult = checkProjectCompliance(projectId, assignments, shiftPatterns);
    const violations = complianceResult.violations.map(v => v.message);

    return {
      totalHours: Math.round(totalHours),
      employeeCount: employeeIds.size,
      shiftPatternCount: projectPatterns.length,
      violations,
    };
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 border-b-4 border-blue-600">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="text-white font-semibold text-lg">
            Network Rail <span className="text-blue-400">Fatigue Management</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="bg-slate-700 text-blue-400 px-3 py-1 rounded text-xs font-mono font-medium">
              DASHBOARD
            </span>
            <SignOutHeader user={user} onSignOut={onSignOut} />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-6">
        {/* Project Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(project => {
            const stats = getProjectStats(project.id);
            return (
              <div 
                key={project.id} 
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => onSelectProject(project.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">{project.name}</h3>
                    <p className="text-sm text-slate-600">{project.location}</p>
                    <p className="text-xs text-slate-500 mt-1">{project.type}</p>
                  </div>
                  <div className="hover:scale-110 transition-transform" title="Compliance status">
                    {stats.violations.length > 0 ? (
                      <ErrorTriangle className="w-6 h-6 text-red-500" />
                    ) : (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Shift Patterns:</span>
                    <span className="font-semibold text-slate-800">{stats.shiftPatternCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Hours:</span>
                    <span className="font-semibold text-slate-800">{stats.totalHours.toLocaleString()}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Employees:</span>
                    <span className="font-semibold text-slate-800">{stats.employeeCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Compliance:</span>
                    <span className={`font-semibold ${stats.violations.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {stats.violations.length === 0
                        ? 'Compliant'
                        : `${stats.violations.length} Breach${stats.violations.length > 1 ? 'es' : ''}`}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelectProject(project.id); }}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Planning
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onViewSummary(project.id); }}
                    className="flex-1 bg-violet-600 text-white py-2 rounded-md hover:bg-violet-700 transition-colors text-sm font-medium"
                  >
                    Summary
                  </button>
                </div>
              </div>
            );
          })}

          {/* Create New Project Card */}
          <div 
            onClick={onCreateProject}
            className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-dashed border-blue-300 rounded-lg shadow-md p-6 hover:shadow-lg hover:border-blue-500 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[280px]"
          >
            <div className="bg-blue-600 rounded-full p-4 mb-4">
              <Plus className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Create New Project</h3>
            <p className="text-sm text-slate-600 text-center">Add a new project to start planning shifts</p>
          </div>
        </div>

        {/* Action Cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <button 
            onClick={onViewEmployee}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow text-left"
          >
            <Calendar className="w-8 h-8 text-blue-600 mb-2" />
            <h3 className="text-xl font-semibold text-slate-900">Employee View</h3>
            <p className="text-slate-600 mt-2">Check individual compliance and schedules</p>
          </button>

          <button 
            onClick={onViewFatigue}
            className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow text-left"
          >
            <BarChart className="w-8 h-8 text-orange-600 mb-2" />
            <h3 className="text-xl font-semibold text-slate-900">Fatigue Risk Assessment</h3>
            <p className="text-slate-600 mt-2">HSE RR446 compliant shift pattern analysis</p>
            <span className="inline-block mt-2 text-xs font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded">
              NEW
            </span>
          </button>

          <button 
            onClick={onViewTeams}
            className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow text-left"
          >
            <Users className="w-8 h-8 text-purple-600 mb-2" />
            <h3 className="text-xl font-semibold text-slate-900">Team Management</h3>
            <p className="text-slate-600 mt-2">Create teams and assign them to shift patterns</p>
            <span className="inline-block mt-2 text-xs font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded">
              NEW
            </span>
          </button>
        </div>
      </main>
    </div>
  );
}
