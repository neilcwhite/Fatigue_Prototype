import { useMemo, useState } from 'react';
import Sidebar from './components/navigation/Sidebar.jsx';
import Dashboard from './components/dashboard/Dashboard.jsx';
import ProjectPlanning from './components/planning/ProjectPlanning.jsx';
import PersonView from './components/people/PersonView.jsx';
import ShiftPatternManager from './components/shiftPatterns/ShiftPatternManager.jsx';
import TeamManager from './components/teams/TeamManager.jsx';
import ProjectSummary from './components/summary/ProjectSummary.jsx';
import { AppProvider, useAppContext } from './context/AppContext.jsx';

function AppContent() {
  const { state } = useAppContext();
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedProject, setSelectedProject] = useState(state.projects[0]?.id ?? '');
  const [selectedPerson, setSelectedPerson] = useState(state.employees[0]?.id ?? '');

  const projectOptions = useMemo(() => (
    state.projects.map((project) => ({ label: project.name, value: project.id }))
  ), [state.projects]);

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="main-content">
        {activePage === 'dashboard' && (
          <Dashboard
            activeProject={selectedProject}
            onProjectChange={setSelectedProject}
          />
        )}

        {activePage === 'planning' && (
          <ProjectPlanning
            selectedProject={selectedProject}
            onProjectChange={setSelectedProject}
            projectOptions={projectOptions}
          />
        )}

        {activePage === 'people' && (
          <PersonView
            selectedPerson={selectedPerson}
            onPersonChange={setSelectedPerson}
          />
        )}

        {activePage === 'patterns' && (
          <ShiftPatternManager
            selectedProject={selectedProject}
            onProjectChange={setSelectedProject}
            projectOptions={projectOptions}
          />
        )}

        {activePage === 'teams' && (
          <TeamManager />
        )}

        {activePage === 'summary' && (
          <ProjectSummary
            selectedProject={selectedProject}
            onProjectChange={setSelectedProject}
            projectOptions={projectOptions}
          />
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
