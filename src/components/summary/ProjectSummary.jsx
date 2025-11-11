import { useMemo } from 'react';
import { FiAlertCircle, FiClock, FiUsers } from 'react-icons/fi';
import { useAppContext } from '../../context/AppContext.jsx';
import { summarizeProject } from '../../utils/compliance.js';

function ProjectSummary({ selectedProject, onProjectChange, projectOptions }) {
  const { state, assignmentsByProject, compliance } = useAppContext();
  const project = state.projects.find((proj) => proj.id === selectedProject) ?? state.projects[0];

  const summary = useMemo(() => {
    const assignments = assignmentsByProject.get(selectedProject) ?? [];
    return summarizeProject(assignments, state.shiftPatterns, state.teams);
  }, [assignmentsByProject, selectedProject, state.shiftPatterns, state.teams]);

  const complianceDetails = useMemo(() => {
    const result = [];
    compliance.forEach((personSummary, personId) => {
      const person = state.employees.find((emp) => emp.id === personId);
      if (!person) return;
      const projectBreaches = personSummary.breaches.filter((breach) => breach.projectId === selectedProject);
      const projectWarnings = personSummary.approaching.filter((warning) => warning.projectId === selectedProject);
      if (projectBreaches.length === 0 && projectWarnings.length === 0) return;
      result.push({
        person,
        breaches: projectBreaches,
        warnings: projectWarnings,
        status: projectBreaches.length > 0 ? 'red' : 'amber'
      });
    });
    return result;
  }, [compliance, selectedProject, state.employees]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Project summary report</h2>
          <p className="small">Export-ready snapshot covering hours, assignments and fatigue compliance for stakeholders.</p>
        </div>
        <div className="toolbar">
          <select
            className="btn btn-secondary"
            value={selectedProject}
            onChange={(event) => onProjectChange(event.target.value)}
          >
            {projectOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="report-grid" style={{ marginBottom: '24px' }}>
        <div className="report-card">
          <h3>Project window</h3>
          <p className="small">{project.type} · {project.location}</p>
          <div className="divider" />
          <p><strong>Start:</strong> {project.startDate}</p>
          <p><strong>End:</strong> {project.endDate}</p>
        </div>

        <div className="report-card">
          <h3>Resource totals</h3>
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <div className="flex" style={{ alignItems: 'center' }}>
              <FiClock size={20} />
              <div>
                <p className="small">Total hours planned</p>
                <strong>{summary.totalHours.toFixed(1)}h</strong>
              </div>
            </div>
            <div className="flex" style={{ alignItems: 'center' }}>
              <FiUsers size={20} />
              <div>
                <p className="small">People assigned</p>
                <strong>{summary.peopleCount}</strong>
              </div>
            </div>
          </div>
          <div className="divider" />
          <div>
            <p className="small" style={{ marginBottom: '4px' }}>Hours by shift pattern</p>
            {Object.entries(summary.hoursByPattern).map(([pattern, hours]) => (
              <div key={pattern} style={{ marginBottom: '6px' }}>
                <div className="flex-between">
                  <span>{pattern}</span>
                  <strong>{hours.toFixed(1)}h</strong>
                </div>
                <div className="timeline-bar">
                  <div style={{ width: `${Math.min(100, (hours / summary.totalHours) * 100 || 0)}%`, background: '#4f46e5' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="report-card">
          <h3>Compliance breakdown</h3>
          <p className="small">Real-time checks against Network Rail fatigue limits.</p>
          <div className="divider" />
          <p><strong>Total breaches:</strong> {complianceDetails.filter((item) => item.status === 'red').length}</p>
          <p><strong>Amber warnings:</strong> {complianceDetails.filter((item) => item.status === 'amber').length}</p>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Detailed compliance items</h3>
        {complianceDetails.length === 0 ? (
          <div className="empty-state">
            <FiAlertCircle size={32} color="#10b981" />
            <p>No issues detected for this project.</p>
          </div>
        ) : (
          <div className="list">
            {complianceDetails.map((item) => (
              <div key={item.person.id} className="list-item">
                <div>
                  <strong>{item.person.name}</strong>
                  {item.breaches.map((breach, index) => (
                    <p key={`breach-${index}`} className="small">Breach: {breach.label} ({breach.dateRange}) · {breach.magnitude}</p>
                  ))}
                  {item.warnings.map((warning, index) => (
                    <p key={`warn-${index}`} className="small">Warning: {warning.label} ({warning.dateRange}) · {warning.magnitude}</p>
                  ))}
                </div>
                <span className={`badge ${item.status}`}>
                  <span className={`status-dot ${item.status}`} />
                  {item.status === 'red' ? 'Breach' : 'Warning'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectSummary;
