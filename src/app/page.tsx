'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAppData } from '@/hooks/useAppData';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { PlanningView } from '@/components/planning/PlanningView';
import { Spinner } from '@/components/ui/Icons';

type ViewMode = 'dashboard' | 'planning' | 'person' | 'summary' | 'fatigue' | 'teams';

export default function Home() {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);

  // Debug logging
  console.log('Page render:', { authLoading, hasUser: !!user, hasProfile: !!profile });

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

  // Get selected project
  const selectedProjectData = projects.find(p => p.id === selectedProject);

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

      {currentView === 'person' && (
        <div className="min-h-screen bg-slate-900 text-white p-8">
          <button onClick={handleBackToDashboard} className="btn btn-secondary mb-4">
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold mb-4">Employee View</h1>
          <p className="text-slate-400">
            Employee view component coming soon.
            This will show individual employee schedules and compliance.
          </p>
        </div>
      )}

      {currentView === 'fatigue' && (
        <div className="min-h-screen bg-slate-900 text-white p-8">
          <button onClick={handleBackToDashboard} className="btn btn-secondary mb-4">
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold mb-4">Fatigue Risk Assessment</h1>
          <p className="text-slate-400">
            HSE RR446 Fatigue Calculator component coming soon.
            This will calculate fatigue indices for shift patterns.
          </p>
        </div>
      )}

      {currentView === 'teams' && (
        <div className="min-h-screen bg-slate-900 text-white p-8">
          <button onClick={handleBackToDashboard} className="btn btn-secondary mb-4">
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold mb-4">Team Management</h1>
          <p className="text-slate-400 mb-4">
            Teams: {teams.length} | Employees: {employees.length}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.map(team => (
              <div key={team.id} className="card p-4">
                <h3 className="font-semibold">{team.name}</h3>
                <p className="text-slate-400 text-sm">
                  {team.memberIds?.length || 0} members
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentView === 'summary' && selectedProject && (
        <div className="min-h-screen bg-slate-900 text-white p-8">
          <button onClick={handleBackToDashboard} className="btn btn-secondary mb-4">
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold mb-4">
            Project Summary - {projects.find(p => p.id === selectedProject)?.name}
          </h1>
          <p className="text-slate-400">
            Project summary component coming soon.
            This will show compliance overview and statistics.
          </p>
        </div>
      )}

      {/* Project Modal - Placeholder */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Create New Project</h2>
            <p className="text-slate-400 mb-4">Project creation form coming soon.</p>
            <button 
              onClick={() => setShowProjectModal(false)}
              className="btn btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
