import { useMemo } from 'react';
import { FiAlertTriangle, FiClock, FiUsers, FiMapPin } from 'react-icons/fi';
import { useAppContext } from '../../context/AppContext.jsx';
import { summarizeProject } from '../../utils/compliance.js';

function Dashboard({ activeProject, onProjectChange }) {
  const { state, assignmentsByProject, compliance } = useAppContext();

  const projectSummary = useMemo(() => {
    const assignments = assignmentsByProject.get(activeProject) ?? [];
    return summarizeProject(assignments, state.shiftPatterns, state.teams);
  }, [activeProject, assignmentsByProject, state.shiftPatterns, state.teams]);

  const project = state.projects.find((proj) => proj.id === activeProject) ?? state.projects[0];

  const complianceBreaches = useMemo(() => {
    const entries = [];
    compliance.forEach((summary, personId) => {
      summary.breaches.forEach((breach) => {
        const person = state.employees.find((emp) => emp.id === personId);
        const projectName = state.projects.find((proj) => proj.id === breach.projectId)?.name ?? 'Unknown project';
        entries.push({
          person,
          breach,
          projectName
        });
      });
    });
    return entries.slice(0, 6);
  }, [compliance, state.employees, state.projects]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Project dashboard</h2>
          <p className="small">Monitor active projects, resources and fatigue compliance.</p>
        </div>
        <div className="toolbar">
          <select
            value={activeProject}
            onChange={(event) => onProjectChange(event.target.value)}
            className="btn btn-secondary"
          >
            {state.projects.map((proj) => (
              <option key={proj.id} value={proj.id}>{proj.name}</option>
            ))}
          </select>
        </div>
      </div>

      {project && (
        <div className="grid two" style={{ marginBottom: '28px' }}>
          <div className="card">
            <div className="flex-between">
              <div>
                <p className="small">Project window</p>
                <h3 style={{ margin: '6px 0 4px' }}>{project.name}</h3>
                <p style={{ margin: 0, color: '#475569' }}>{project.type} · {project.location}</p>
              </div>
              <FiMapPin size={28} color="#4f46e5" />
            </div>
            <div className="divider" />
            <div className="flex-between">
              <div>
                <p className="small">Start</p>
                <strong>{project.startDate}</strong>
              </div>
              <div>
                <p className="small">End</p>
                <strong>{project.endDate}</strong>
              </div>
              <div>
                <p className="small">Total hours planned</p>
                <strong>{projectSummary.totalHours.toFixed(1)}h</strong>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Live compliance</h3>
            <div className="legend" style={{ marginBottom: '12px' }}>
              <span className="item"><span className="status-dot green" />Compliant</span>
              <span className="item"><span className="status-dot amber" />Approaching</span>
              <span className="item"><span className="status-dot red" />Breaches</span>
            </div>
            <div className="chip-group">
              {state.employees.map((employee) => {
                const summary = compliance.get(employee.id) ?? { status: 'green' };
                return (
                  <span key={employee.id} className={`badge ${summary.status}`}>
                    <span className={`status-dot ${summary.status}`} />
                    {employee.name}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="grid two">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Resource allocation snapshot</h3>
          <div className="flex-between" style={{ marginBottom: '12px' }}>
            <div className="flex" style={{ alignItems: 'center' }}>
              <FiUsers size={18} />
              <span><strong>{projectSummary.peopleCount}</strong> people assigned</span>
            </div>
            <div className="flex" style={{ alignItems: 'center' }}>
              <FiClock size={18} />
              <span><strong>{projectSummary.totalHours.toFixed(1)}h</strong> scheduled</span>
            </div>
          </div>
          <table className="table table-small">
            <thead>
              <tr>
                <th>Shift pattern</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(projectSummary.hoursByPattern).map(([pattern, hours]) => (
                <tr key={pattern}>
                  <td>{pattern}</td>
                  <td>{hours.toFixed(1)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Active compliance breaches</h3>
          {complianceBreaches.length === 0 ? (
            <div className="empty-state">
              <FiAlertTriangle size={32} color="#10b981" />
              <p>All team members are compliant across the rolling 7-day window.</p>
            </div>
          ) : (
            <div className="list">
              {complianceBreaches.map(({ person, breach, projectName }, index) => (
                <div key={`${person.id}-${index}`} className="list-item">
                  <div>
                    <strong>{person.name}</strong>
                    <p className="small">{breach.label} · {breach.dateRange}</p>
                    <p className="small">{projectName} · {breach.magnitude}</p>
                  </div>
                  <span className="badge red">
                    <FiAlertTriangle />
                    Breach
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
