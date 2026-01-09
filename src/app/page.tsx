'use client';

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useAuth } from '@/hooks/useAuth';
import { useAppData } from '@/hooks/useAppData';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { PlanningView } from '@/components/planning/PlanningView';
import { TeamsView } from '@/components/teams/TeamsView';
import { PersonView } from '@/components/person/PersonView';
import { SummaryView } from '@/components/summary/SummaryView';
import { FatigueView } from '@/components/fatigue/FatigueView';
import { AssessmentsView } from '@/components/assessments';
import { AdminView } from '@/components/admin/AdminView';
import { ProjectModal } from '@/components/modals/ProjectModal';
import { ShiftPatternModal } from '@/components/modals/ShiftPatternModal';
import { ShiftPatternEditModal } from '@/components/modals/ShiftPatternEditModal';
import { Sidebar, DRAWER_WIDTH_EXPANDED } from '@/components/layout';
import { Spinner, ChevronLeft } from '@/components/ui/Icons';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { OnboardingPanel } from '@/components/onboarding/OnboardingPanel';
import { TutorialOverlay } from '@/components/onboarding/TutorialOverlay';
import { useOnboarding } from '@/hooks/useOnboarding';
import type { ShiftPatternCamel, WeeklySchedule, ProjectCamel } from '@/lib/types';

type ViewMode = 'dashboard' | 'planning' | 'person' | 'summary' | 'fatigue' | 'teams' | 'assessments' | 'admin';

// Check Supabase configuration at module level
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export default function Home() {
  const { user, profile, loading: authLoading, error: authError, signOut } = useAuth();
  const { openPanel: openOnboardingPanel, setActiveTask, completeTask } = useOnboarding();
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showShiftPatternModal, setShowShiftPatternModal] = useState(false);
  const [editingShiftPattern, setEditingShiftPattern] = useState<ShiftPatternCamel | null>(null);
  const [shiftBuilderCreateMode, setShiftBuilderCreateMode] = useState<{ projectId: number } | null>(null);
  const [tutorialTaskId, setTutorialTaskId] = useState<string | null>(null);

  // Team creation from drag-drop
  const [teamCreationModal, setTeamCreationModal] = useState<{ memberIds: number[] } | null>(null);
  const [newTeamName, setNewTeamName] = useState('');

  // Load app data once we have an organisation (including fatigue assessments from Supabase)
  const {
    employees,
    projects,
    teams,
    shiftPatterns,
    assignments,
    fatigueAssessments,
    loading: dataLoading,
    error: dataError,
    createProject,
    updateProject,
    deleteProject,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    createTeam,
    updateTeam,
    deleteTeam,
    createShiftPattern,
    updateShiftPattern,
    deleteShiftPattern,
    createFatigueAssessment,
    updateFatigueAssessment,
  } = useAppData(profile?.organisationId || null);

  // Auto-select default project and employee when data loads
  useEffect(() => {
    // Auto-select newest project if none selected
    if (!selectedProject && projects.length > 0) {
      // Sort by ID descending (newest first) or use createdAt if available
      const sortedProjects = [...projects].sort((a, b) => b.id - a.id);
      setSelectedProject(sortedProjects[0].id);
    }
  }, [projects, selectedProject]);

  useEffect(() => {
    // Auto-select first employee by name if none selected
    if (!selectedEmployee && employees.length > 0) {
      const sortedEmployees = [...employees].sort((a, b) => a.name.localeCompare(b.name));
      setSelectedEmployee(sortedEmployees[0].id);
    }
  }, [employees, selectedEmployee]);

  // Supabase not configured - show clear error
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center text-white max-w-md p-8">
          <h1 className="text-2xl font-bold mb-4 text-red-400">Configuration Error</h1>
          <p className="text-slate-300 mb-4">
            Supabase is not configured. Please set the following environment variables:
          </p>
          <ul className="text-left text-slate-400 text-sm space-y-2 bg-slate-800 p-4 rounded">
            <li><code>NEXT_PUBLIC_SUPABASE_URL</code></li>
            <li><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>
          </ul>
          <p className="text-slate-400 text-sm mt-4">
            Add these to your <code>.env.local</code> file and restart the application.
          </p>
        </div>
      </div>
    );
  }

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

  // Auth error state - show error with retry option
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center text-white max-w-md p-8">
          <h1 className="text-2xl font-bold mb-4 text-red-400">Authentication Error</h1>
          <p className="text-slate-300 mb-4">{authError}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
            >
              Retry
            </button>
            <button
              onClick={signOut}
              className="px-4 py-2 bg-slate-700 rounded hover:bg-slate-600"
            >
              Sign Out
            </button>
          </div>
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

  const handleCreateTeamWithMembers = (memberIds: number[]) => {
    setTeamCreationModal({ memberIds });
    setNewTeamName('');
  };

  const handleConfirmTeamCreation = async () => {
    if (!teamCreationModal || !newTeamName.trim()) return;
    await createTeam(newTeamName.trim(), teamCreationModal.memberIds);
    setTeamCreationModal(null);
    setNewTeamName('');
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
  const handleCreateProject = async (name: string, startDate?: string, endDate?: string): Promise<ProjectCamel> => {
    return await createProject(name, startDate, endDate);
  };

  // Handle shift pattern creation
  const handleCreateShiftPattern = async (data: {
    projectId: number;
    name: string;
    startTime: string;
    endTime: string;
    dutyType: string;
    isNight: boolean;
    weeklySchedule?: WeeklySchedule;
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

  // Handle onboarding task click - show tutorial first
  const handleOnboardingTask = (taskId: string) => {
    setTutorialTaskId(taskId);
    setActiveTask(taskId);
  };

  // Actually navigate to perform the task (called after tutorial)
  const navigateToTask = (taskId: string) => {
    setTutorialTaskId(null); // Close tutorial
    switch (taskId) {
      case 'create_project':
        setCurrentView('dashboard');
        setShowProjectModal(true);
        break;
      case 'create_team':
        setCurrentView('teams');
        break;
      case 'add_employee':
        setCurrentView('teams'); // Teams view has employee management
        break;
      case 'import_employees':
        setCurrentView('teams'); // Teams view has import functionality
        break;
      case 'create_shift_pattern':
        if (selectedProject) {
          setShiftBuilderCreateMode({ projectId: selectedProject });
          setCurrentView('fatigue');
        } else {
          // Need to select a project first, go to dashboard
          setCurrentView('dashboard');
        }
        break;
      case 'assign_shift':
        if (selectedProject) {
          setCurrentView('planning');
        } else {
          setCurrentView('dashboard');
        }
        break;
      case 'view_compliance':
        if (selectedEmployee) {
          setCurrentView('person');
        } else if (selectedProject) {
          setCurrentView('summary');
        } else {
          setCurrentView('dashboard');
        }
        break;
      default:
        break;
    }
  };

  // Handle sidebar navigation
  const handleNavigate = (view: ViewMode) => {
    setCurrentView(view);
  };

  // Render based on current view
  return (
    <ErrorBoundary>
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        hasSelectedProject={!!selectedProject}
        hasSelectedEmployee={!!selectedEmployee}
        selectedProjectName={selectedProjectData?.name}
        selectedEmployeeName={selectedEmployeeData?.name}
        onOpenHelp={openOnboardingPanel}
      />

      {/* Onboarding Panel */}
      <OnboardingPanel onStartTask={handleOnboardingTask} />

      {/* Tutorial Overlay */}
      <TutorialOverlay
        open={!!tutorialTaskId}
        taskId={tutorialTaskId}
        onClose={() => setTutorialTaskId(null)}
        onStartTask={() => tutorialTaskId && navigateToTask(tutorialTaskId)}
        onMarkComplete={() => tutorialTaskId && completeTask(tutorialTaskId)}
      />

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: '100vh',
          overflow: 'auto',
        }}
      >
        {currentView === 'dashboard' && (
          <Dashboard
            user={user}
            userRole={profile?.role as import('@/lib/types').UserRole | undefined}
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
            teams={teams}
            assignments={assignments}
            shiftPatterns={shiftPatterns}
            onBack={handleBackToDashboard}
            onCreateAssignment={createAssignment}
            onUpdateAssignment={updateAssignment}
            onDeleteAssignment={deleteAssignment}
            onCreateShiftPattern={() => {
              setShiftBuilderCreateMode({ projectId: selectedProject! });
              setCurrentView('fatigue');
            }}
            onCreateShiftPatternDirect={createShiftPattern}
            onNavigateToPerson={(empId) => {
              setSelectedEmployee(empId);
              setCurrentView('person');
            }}
            onCreateTeamWithMembers={handleCreateTeamWithMembers}
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
            fatigueAssessments={fatigueAssessments}
            onSelectEmployee={(id) => setSelectedEmployee(id)}
            onDeleteAssignment={deleteAssignment}
            onUpdateAssignment={updateAssignment}
            onUpdateShiftPattern={updateShiftPattern}
            onCreateAssignment={createAssignment}
            onCreateFatigueAssessment={createFatigueAssessment}
            onUpdateFatigueAssessment={updateFatigueAssessment}
            onViewAssessment={(assessmentId) => {
              // Navigate to assessments view - for now, just go to assessments page
              setCurrentView('assessments');
            }}
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
            fatigueAssessments={fatigueAssessments}
            onSelectProject={(id) => setSelectedProject(id)}
            onNavigateToPerson={handleNavigateToPerson}
            onNavigateToPlanning={handleSelectProject}
            onEditShiftPattern={(pattern) => setEditingShiftPattern(pattern)}
            onViewAssessment={(assessmentId) => {
              setCurrentView('assessments');
            }}
          />
        )}

        {currentView === 'fatigue' && (
          <FatigueView
            user={user}
            onSignOut={signOut}
            onBack={() => {
              setShiftBuilderCreateMode(null);
              handleBackToDashboard();
            }}
            projects={projects}
            employees={employees}
            shiftPatterns={shiftPatterns}
            assignments={assignments}
            onCreateProject={handleCreateProject}
            onCreateShiftPattern={createShiftPattern}
            onUpdateShiftPattern={updateShiftPattern}
            onDeleteShiftPattern={deleteShiftPattern}
            onUpdateAssignment={updateAssignment}
            initialProjectId={shiftBuilderCreateMode?.projectId}
            startInCreateMode={!!shiftBuilderCreateMode}
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
            onCreateEmployee={createEmployee}
          />
        )}

        {currentView === 'admin' && (
          <AdminView
            user={user}
            userRole={profile?.role as import('@/lib/types').UserRole | undefined}
            onSignOut={signOut}
            employees={employees}
            projects={projects}
            onCreateEmployee={createEmployee}
            onDeleteEmployee={deleteEmployee}
            onUpdateEmployee={updateEmployee}
            onArchiveProject={async (id, archived) => updateProject(id, { archived })}
            onDeleteProject={deleteProject}
          />
        )}

        {currentView === 'assessments' && (
          <AssessmentsView
            user={user}
            onSignOut={signOut}
            onBack={handleBackToDashboard}
            employees={employees}
            assessments={fatigueAssessments}
            onCreateAssessment={createFatigueAssessment}
            onUpdateAssessment={updateFatigueAssessment}
          />
        )}

        {/* Fallback for person view without employee selected */}
        {currentView === 'person' && !selectedEmployeeData && (
          <div className="min-h-screen bg-slate-900 text-white p-8">
            <button onClick={handleBackToDashboard} className="flex items-center gap-2 px-4 py-2 bg-slate-700 rounded hover:bg-slate-600 mb-4">
              <ChevronLeft className="w-4 h-4" />
              Back to Dashboard
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
            <button onClick={handleBackToDashboard} className="flex items-center gap-2 px-4 py-2 bg-slate-700 rounded hover:bg-slate-600 mb-4">
              <ChevronLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold mb-4">Project Summary</h1>
            <p className="text-slate-400">
              {projects.length === 0
                ? 'No projects available. Create a project first.'
                : 'Select a project to view its summary.'}
            </p>
          </div>
        )}
      </Box>

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

      {/* Team Creation Modal (from drag-drop) */}
      <Dialog
        open={!!teamCreationModal}
        onClose={() => setTeamCreationModal(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Create New Team</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {teamCreationModal?.memberIds.length === 1
              ? '1 employee will be added to this team.'
              : `${teamCreationModal?.memberIds.length} employees will be added to this team.`}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Team Name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTeamName.trim()) {
                handleConfirmTeamCreation();
              }
            }}
            placeholder="e.g. Night Shift Crew"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTeamCreationModal(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirmTeamCreation}
            disabled={!newTeamName.trim()}
          >
            Create Team
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </ErrorBoundary>
  );
}
