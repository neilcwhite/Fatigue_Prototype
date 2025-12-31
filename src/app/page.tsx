'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAppData } from '@/hooks/useAppData';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { PlanningView } from '@/components/planning/PlanningView';
import { TeamsView } from '@/components/teams/TeamsView';
import { PersonView } from '@/components/person/PersonView';
import { SummaryView } from '@/components/summary/SummaryView';
import { FatigueView } from '@/components/fatigue/FatigueView';
import { ProjectModal } from '@/components/modals/ProjectModal';
import { ShiftPatternModal } from '@/components/modals/ShiftPatternModal';
import { ShiftPatternEditModal } from '@/components/modals/ShiftPatternEditModal';
import { Spinner } from '@/components/ui/Icons';
import type { ShiftPatternCamel } from '@/lib/types';

type ViewMode = 'dashboard' | 'planning' | 'person' | 'summary' | 'fatigue' | 'teams';

export default function Home() {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showShiftPatternModal, setShowShiftPatternModal] = useState(false);
  const [editingShiftPattern, setEditingShiftPattern] = useState<ShiftPatternCamel | null>(null);

  // Debug logging
  console.log('Page render:', { authLoading, hasUser: !!user, hasProfile: !!profile, orgId: profile?.organisationId });

  // Load app data once we have an organisation
  const {
    employees,
    projects,
    teams,
    shiftPatterns,
    assignments,
    loading: dataLoading,
    error: dataError,
    createProject,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    createTeam,
    updateTeam,
    deleteTeam,
    createShiftPattern,
    updateShiftPattern,
  } = useAppData(profile?.organisationId || null);

  // Auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex items-center gap-4 text-white">
          <Spinner className="w-8 h-8" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <AuthScreen onLogin={() => {}} />;
  }

  // Data loading state
  if (dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4 text-white">
          <Spinner className="w-8 h-8" />
          <span>Loading data...</span>
        </div>
      </div>
    );
  }

  // Data error state
  if (dataError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">Error Loading Data</h1>
          <p className="text-slate-400">{dataError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Handle project selection
  const handleSelectProject = (projectId: number) => {
    setSelectedProject(projectId);
    setCurrentView('planning');
  };

  // Handle view navigation
  const handleViewEmployee = () => {
    if (employees.length > 0) {
      setSelectedEmployee(employees[0].id);
      setCurrentView('person');
    }
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedProject(null);
    setSelectedEmployee(null);
  };

  const handleNavigateToSummary = (projectId: number) => {
    setSelectedProject(projectId);
    setCurrentView('summary');
  };

  const handleNavigateToPerson = (employeeId: number) => {
    setSelectedEmployee(employeeId);
    setCurrentView('person');
  };

  // Get selected project and employee
  const selectedProjectData = projects.find(p => p.id === selectedProject);
  const selectedEmployeeData = employees.find(e => e.id === selectedEmployee);

  // Handle project creation
  const handleCreateProject = async (name: string, location?: string, type?: string, startDate?: string, endDate?: string) => {
    await createProject(name, location, type, startDate, endDate);
  };

  // Handle shift pattern creation
  const handleCreateShiftPattern = async (data: {
    projectId: number;
    name: string;
    startTime: string;
    endTime: string;
    dutyType: string;
    isNight: boolean;
    weeklySchedule: any;
    workload?: number;
    attention?: number;
    commuteTime?: number;
    breakFrequency?: number;
    breakLength?: number;
  }) => {
    await createShiftPattern({
      projectId: data.projectId,
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      dutyType: data.dutyType as 'Possession' | 'Non-Possession' | 'Office' | 'Lookout' | 'Machine' | 'Protection' | 'Other',
      isNight: data.isNight,
      weeklySchedule: data.weeklySchedule,
      // Fatigue parameters
      workload: data.workload,
      attention: data.attention,
      commuteTime: data.commuteTime,
      breakFrequency: data.breakFrequency,
      breakLength: data.breakLength,
    });
  };

  // Render based on current view
  return (
    <>
      {currentView === 'dashboard' && (
        <Dashboard
          user={user}
          onSignOut={signOut}
          projects={projects}
          employees={employees}
          assignments={assignments}
          shiftPatterns={shiftPatterns}
          onSelectProject={handleSelectProject}
          onViewSummary={handleNavigateToSummary}
          onViewEmployee={handleViewEmployee}
          onViewFatigue={() => setCurrentView('fatigue')}
          onViewTeams={() => setCurrentView('teams')}
          onCreateProject={() => setShowProjectModal(true)}
        />
      )}

      {currentView === 'planning' && selectedProjectData && (
        <PlanningView
          user={user}
          onSignOut={signOut}
          project={selectedProjectData}
          employees={employees}
          assignments={assignments}
          shiftPatterns={shiftPatterns}
          onBack={handleBackToDashboard}
          onCreateAssignment={createAssignment}
          onUpdateAssignment={updateAssignment}
          onDeleteAssignment={deleteAssignment}
          onCreateShiftPattern={() => setShowShiftPatternModal(true)}
          onCreateShiftPatternDirect={createShiftPattern}
          onNavigateToPerson={(empId) => {
            setSelectedEmployee(empId);
            setCurrentView('person');
          }}
        />
      )}

      {currentView === 'person' && selectedEmployeeData && (
        <PersonView
          user={user}
          onSignOut={signOut}
          onBack={handleBackToDashboard}
          employee={selectedEmployeeData}
          employees={employees}
          assignments={assignments}
          shiftPatterns={shiftPatterns}
          projects={projects}
          onSelectEmployee={(id) => setSelectedEmployee(id)}
          onDeleteAssignment={deleteAssignment}
          onUpdateShiftPattern={updateShiftPattern}
        />
      )}

      {currentView === 'summary' && selectedProjectData && (
        <SummaryView
          user={user}
          onSignOut={signOut}
          onBack={handleBackToDashboard}
          project={selectedProjectData}
          projects={projects}
          employees={employees}
          assignments={assignments}
          shiftPatterns={shiftPatterns}
          onSelectProject={(id) => setSelectedProject(id)}
          onNavigateToPerson={handleNavigateToPerson}
          onNavigateToPlanning={handleSelectProject}
          onEditShiftPattern={(pattern) => setEditingShiftPattern(pattern)}
        />
      )}

      {currentView === 'fatigue' && (
        <FatigueView
          user={user}
          onSignOut={signOut}
          onBack={handleBackToDashboard}
          projects={projects}
          employees={employees}
          shiftPatterns={shiftPatterns}
          assignments={assignments}
        />
      )}

      {currentView === 'teams' && (
        <TeamsView
          user={user}
          onSignOut={signOut}
          onBack={handleBackToDashboard}
          teams={teams}
          employees={employees}
          projects={projects}
          shiftPatterns={shiftPatterns}
          onCreateTeam={createTeam}
          onUpdateTeam={updateTeam}
          onDeleteTeam={deleteTeam}
          onCreateAssignment={createAssignment}
        />
      )}

      {/* Fallback for person view without employee selected */}
      {currentView === 'person' && !selectedEmployeeData && (
        <div className="min-h-screen bg-slate-900 text-white p-8">
          <button onClick={handleBackToDashboard} className="px-4 py-2 bg-slate-700 rounded hover:bg-slate-600 mb-4">
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold mb-4">Employee View</h1>
          <p className="text-slate-400">
            {employees.length === 0 
              ? 'No employees available. Create employees first.'
              : 'Select an employee to view their schedule.'}
          </p>
        </div>
      )}

      {/* Fallback for summary view without project selected */}
      {currentView === 'summary' && !selectedProjectData && (
        <div className="min-h-screen bg-slate-900 text-white p-8">
          <button onClick={handleBackToDashboard} className="px-4 py-2 bg-slate-700 rounded hover:bg-slate-600 mb-4">
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold mb-4">Project Summary</h1>
          <p className="text-slate-400">
            {projects.length === 0 
              ? 'No projects available. Create a project first.'
              : 'Select a project to view its summary.'}
          </p>
        </div>
      )}

      {/* Project Modal */}
      {showProjectModal && (
        <ProjectModal
          onClose={() => setShowProjectModal(false)}
          onSave={handleCreateProject}
        />
      )}

      {/* Shift Pattern Modal */}
      {showShiftPatternModal && selectedProject && (
        <ShiftPatternModal
          projectId={selectedProject}
          onClose={() => setShowShiftPatternModal(false)}
          onSave={handleCreateShiftPattern}
        />
      )}

      {/* Shift Pattern Edit Modal */}
      {editingShiftPattern && (
        <ShiftPatternEditModal
          pattern={editingShiftPattern}
          onClose={() => setEditingShiftPattern(null)}
          onSave={async (id, data) => {
            await updateShiftPattern(id, data);
            setEditingShiftPattern(null);
          }}
        />
      )}
    </>
  );
}
