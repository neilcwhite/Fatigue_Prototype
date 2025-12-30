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
import { Spinner } from '@/components/ui/Icons';

type ViewMode = 'dashboard' | 'planning' | 'person' | 'summary' | 'fatigue' | 'teams';

export default function Home() {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);

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
    createAssignment,
    deleteAssignment,
    createTeam,
    updateTeam,
    deleteTeam,
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
            className="mt-4 btn btn-primary"
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
          onDeleteAssignment={deleteAssignment}
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
        />
      )}

      {currentView === 'fatigue' && (
        <FatigueView
          user={user}
          onSignOut={signOut}
          onBack={handleBackToDashboard}
        />
      )}

      {currentView === 'teams' && (
        <TeamsView
          user={user}
          onSignOut={signOut}
          onBack={handleBackToDashboard}
          teams={teams}
          employees={employees}
          onCreateTeam={createTeam}
          onUpdateTeam={updateTeam}
          onDeleteTeam={deleteTeam}
        />
      )}

      {/* Fallback for person view without employee selected */}
      {currentView === 'person' && !selectedEmployeeData && (
        <div className="min-h-screen bg-slate-900 text-white p-8">
          <button onClick={handleBackToDashboard} className="btn btn-secondary mb-4">
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
          <button onClick={handleBackToDashboard} className="btn btn-secondary mb-4">
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

      {/* Project Modal - Placeholder */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Create New Project</h2>
            <p className="text-slate-400 mb-4">Project creation form coming soon.</p>
            <button 
              onClick={() => setShowProjectModal(false)}
              className="px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
