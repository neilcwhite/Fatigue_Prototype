import { useMemo } from 'react';
import { addDays, format } from 'date-fns';
import { FiAlertTriangle, FiClock, FiTrendingUp } from 'react-icons/fi';
import { useAppContext } from '../../context/AppContext.jsx';
import { getPersonCompliance } from '../../utils/compliance.js';

function buildCalendar(entries) {
  if (entries.length === 0) return [];
  const start = entries[0].startDateTime;
  const end = addDays(entries[entries.length - 1].endDateTime, 7);
  const days = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const dayKey = format(cursor, 'yyyy-MM-dd');
    const dayEntries = entries.filter((entry) => format(entry.startDateTime, 'yyyy-MM-dd') === dayKey);
    days.push({ date: cursor, items: dayEntries });
  }
  return days;
}

function PersonView({ selectedPerson, onPersonChange }) {
  const { state, compliance } = useAppContext();
  const person = state.employees.find((employee) => employee.id === selectedPerson) ?? state.employees[0];
  const summary = getPersonCompliance(person?.id ?? '', compliance);

  const calendar = useMemo(() => buildCalendar(summary.entries), [summary.entries]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Person compliance view</h2>
          <p className="small">View cumulative hours, rest periods and breaches across all projects for an individual.</p>
        </div>
        <div className="toolbar">
          <select
            className="btn btn-secondary"
            value={selectedPerson}
            onChange={(event) => onPersonChange(event.target.value)}
          >
            {state.employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.name}</option>
            ))}
          </select>
        </div>
      </div>

      {person && (
        <div className="grid two" style={{ marginBottom: '24px' }}>
          <div className="report-card">
            <h3>{person.name}</h3>
            <p className="small">{person.role}</p>
            <div className="divider" />
            <div className="flex" style={{ justifyContent: 'space-between' }}>
              <div>
                <p className="small">Total hours scheduled</p>
                <strong>{summary.totalHours.toFixed(1)}h</strong>
              </div>
              <div>
                <p className="small">Compliance status</p>
                <span className={`badge ${summary.status}`}>
                  <span className={`status-dot ${summary.status}`} />
                  {summary.status === 'green' ? 'Compliant' : summary.status === 'amber' ? 'Approaching limits' : 'Breaches present'}
                </span>
              </div>
            </div>
          </div>

          <div className="report-card">
            <h3>Active alerts</h3>
            {summary.breaches.length === 0 && summary.approaching.length === 0 ? (
              <p className="small">No breaches or warnings detected in the current plan.</p>
            ) : (
              <div className="list">
                {summary.breaches.map((breach, index) => (
                  <div key={`breach-${index}`} className="list-item">
                    <div>
                      <strong>{breach.label}</strong>
                      <p className="small">{breach.dateRange}</p>
                      <p className="small">{breach.magnitude}</p>
                    </div>
                    <span className="badge red"><FiAlertTriangle />Breach</span>
                  </div>
                ))}
                {summary.approaching.map((warning, index) => (
                  <div key={`warning-${index}`} className="list-item">
                    <div>
                      <strong>{warning.label}</strong>
                      <p className="small">{warning.dateRange}</p>
                      <p className="small">{warning.magnitude}</p>
                    </div>
                    <span className="badge amber"><FiTrendingUp />Warning</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Rolling schedule overview</h3>
        {calendar.length === 0 ? (
          <div className="empty-state">
            <FiClock size={32} color="#4f46e5" />
            <p>No assignments currently scheduled for this person.</p>
          </div>
        ) : (
          <div className="scroll-x">
            <table className="table table-small">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Shift</th>
                  <th>Project</th>
                  <th>Duration</th>
                  <th>Night</th>
                </tr>
              </thead>
              <tbody>
                {calendar.map((day) => (
                  day.items.length === 0 ? (
                    <tr key={day.date.toISOString()}>
                      <td>{format(day.date, 'EEE dd MMM')}</td>
                      <td colSpan={4} style={{ color: '#94a3b8' }}>Rest day</td>
                    </tr>
                  ) : (
                    day.items.map((entry, index) => {
                      const project = state.projects.find((proj) => proj.id === entry.projectId);
                      return (
                        <tr key={`${day.date.toISOString()}-${index}`}>
                          <td>{format(day.date, 'EEE dd MMM')}</td>
                          <td>{entry.pattern.name} · {entry.pattern.startTime}-{entry.pattern.endTime}</td>
                          <td>{project?.name ?? 'Unknown project'}</td>
                          <td>{entry.duration.toFixed(1)}h</td>
                          <td>{entry.pattern.endTime <= entry.pattern.startTime ? 'Yes' : 'No'}</td>
                        </tr>
                      );
                    })
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default PersonView;
