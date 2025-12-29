'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Project, Employee, Team, ProjectStats } from '@/lib/types';
import { getProjects, getEmployees, getTeams, getProjectStats, createProject } from '@/lib/data-service';
import { ProjectCard } from './ProjectCard';
import { ProjectModal } from './ProjectModal';
import { EmployeeModal } from './EmployeeModal';
import { TeamModal } from './TeamModal';
import { PlanningView } from '@/components/planning/PlanningView';
import { FatigueCalculator } from '@/components/calculator/FatigueCalculator';

type View = 'dashboard' | 'project' | 'calculator';

export function Dashboard() {
  const { profile, signOut } = useAuth();
  const [view, setView] = useState<View>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [projectStats, setProjectStats] = useState<Map<number, ProjectStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [projectsData, employeesData, teamsData] = await Promise.all([getProjects(), getEmployees(), getTeams()]);
      setProjects(projectsData);
      setEmployees(employeesData);
      setTeams(teamsData);
      const statsMap = new Map<number, ProjectStats>();
      for (const project of projectsData) {
        const stats = await getProjectStats(project.id);
        statsMap.set(project.id, stats);
      }
      setProjectStats(statsMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function handleProjectClick(projectId: number) { setSelectedProjectId(projectId); setView('project'); }
  function handleBackToDashboard() { setSelectedProjectId(null); setView('dashboard'); loadData(); }
  async function handleProjectCreated() { setShowProjectModal(false); await loadData(); }
  async function handleEmployeeCreated() { setShowEmployeeModal(false); setEmployees(await getEmployees()); }
  async function handleTeamCreated() { setShowTeamModal(false); setTeams(await getTeams()); }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="spinner" /></div>;
  }

  if (view === 'project' && selectedProjectId) {
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return null;
    return <PlanningView project={project} employees={employees} teams={teams} onBack={handleBackToDashboard} />;
  }

  if (view === 'calculator') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <button onClick={() => setView('dashboard')} className="text-gray-500 hover:text-gray-700">← Back to Dashboard</button>
            <h1 className="text-xl font-semibold">Fatigue Calculator</h1>
            <div />
          </div>
        </header>
        <main className="max-w-4xl mx-auto py-8 px-4"><FatigueCalculator /></main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Fatigue Management</h1>
            <p className="text-sm text-gray-500">{profile?.organisations?.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{profile?.email}</span>
            <button onClick={signOut} className="btn btn-secondary btn-sm">Sign Out</button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-8 px-4">
        {error && <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}
        <div className="mb-6 flex flex-wrap gap-3">
          <button onClick={() => setShowProjectModal(true)} className="btn btn-primary">+ New Project</button>
          <button onClick={() => setShowEmployeeModal(true)} className="btn btn-secondary">+ Add Employee</button>
          <button onClick={() => setShowTeamModal(true)} className="btn btn-secondary">+ Create Team</button>
          <button onClick={() => setView('calculator')} className="btn btn-secondary">Fatigue Calculator</button>
        </div>
        <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card card-body"><p className="text-sm text-gray-500">Total Projects</p><p className="text-2xl font-semibold">{projects.length}</p></div>
          <div className="card card-body"><p className="text-sm text-gray-500">Total Employees</p><p className="text-2xl font-semibold">{employees.length}</p></div>
          <div className="card card-body"><p className="text-sm text-gray-500">Teams</p><p className="text-2xl font-semibold">{teams.length}</p></div>
          <div className="card card-body"><p className="text-sm text-gray-500">Total Violations</p><p className="text-2xl font-semibold text-red-600">{Array.from(projectStats.values()).reduce((sum, s) => sum + s.violationCount, 0)}</p></div>
        </div>
        <h2 className="text-lg font-semibold mb-4">Projects</h2>
        {projects.length === 0 ? (
          <div className="card card-body text-center py-12"><p className="text-gray-500 mb-4">No projects yet</p><button onClick={() => setShowProjectModal(true)} className="btn btn-primary">Create Your First Project</button></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{projects.map(project => <ProjectCard key={project.id} project={project} stats={projectStats.get(project.id)} onClick={() => handleProjectClick(project.id)} />)}</div>
        )}
      </main>
      {showProjectModal && <ProjectModal organisationId={profile!.organisation_id} onClose={() => setShowProjectModal(false)} onSaved={handleProjectCreated} />}
      {showEmployeeModal && <EmployeeModal organisationId={profile!.organisation_id} onClose={() => setShowEmployeeModal(false)} onSaved={handleEmployeeCreated} />}
      {showTeamModal && <TeamModal organisationId={profile!.organisation_id} employees={employees} onClose={() => setShowTeamModal(false)} onSaved={handleTeamCreated} />}
    </div>
  );
}
