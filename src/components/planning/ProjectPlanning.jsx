import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfWeek
} from 'date-fns';
import { FiCopy, FiDownload, FiPlus, FiUsers } from 'react-icons/fi';
import { useAppContext } from '../../context/AppContext.jsx';
import { getPersonCompliance, isNightShift } from '../../utils/compliance.js';

const VIEW_MODES = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'gantt', label: 'Gantt chart' },
  { id: 'weekly', label: 'Weekly grid' }
];

function getAssignmentsForDate(assignments, date) {
  return assignments.filter((assignment) => (
    assignment.startDate <= date && assignment.endDate >= date
  ));
}

function formatAssignee(assignment, state) {
  if (assignment.assigneeType === 'team') {
    return state.teams.find((team) => team.id === assignment.assigneeId)?.name ?? 'Team';
  }
  return state.employees.find((emp) => emp.id === assignment.assigneeId)?.name ?? 'Employee';
}

function ProjectPlanning({ selectedProject, onProjectChange, projectOptions }) {
  const { state, dispatch, compliance } = useAppContext();
  const [viewMode, setViewMode] = useState('timeline');
  const [weekStart, setWeekStart] = useState(startOfWeek(parseISO('2024-03-18'), { weekStartsOn: 1 }));
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [copiedRange, setCopiedRange] = useState(null);
  const [manualForm, setManualForm] = useState({
    assigneeType: 'employee',
    assigneeId: state.employees[0]?.id ?? '',
    shiftPatternId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });

  const projectPatterns = useMemo(() => (
    state.shiftPatterns.filter((pattern) => pattern.projectId === selectedProject)
  ), [selectedProject, state.shiftPatterns]);

  const projectAssignments = useMemo(() => (
    state.assignments.filter((assignment) => assignment.projectId === selectedProject)
  ), [selectedProject, state.assignments]);

  useEffect(() => {
    const defaultPatternId = projectPatterns[0]?.id ?? '';
    setManualForm((prev) => ({
      ...prev,
      shiftPatternId: defaultPatternId,
      assigneeId: prev.assigneeType === 'employee'
        ? (state.employees.find((emp) => emp.id === prev.assigneeId) ? prev.assigneeId : state.employees[0]?.id ?? '')
        : (state.teams.find((team) => team.id === prev.assigneeId) ? prev.assigneeId : state.teams[0]?.id ?? '')
    }));
  }, [projectPatterns, state.employees, state.teams]);

  const weekDays = useMemo(() => (
    Array.from({ length: 7 }).map((_, index) => addDays(weekStart, index))
  ), [weekStart]);

  const timelineDays = useMemo(() => (
    Array.from({ length: 14 }).map((_, index) => addDays(weekStart, index))
  ), [weekStart]);

  const handleDrop = (event, patternId, date) => {
    event.preventDefault();
    const data = event.dataTransfer.getData('application/json');
    if (!data) return;
    const parsed = JSON.parse(data);
    const assignment = {
      projectId: selectedProject,
      shiftPatternId: patternId,
      assigneeType: parsed.type,
      assigneeId: parsed.id,
      startDate: date,
      endDate: date
    };
    dispatch({ type: 'ADD_ASSIGNMENT', payload: assignment });
  };

  const handleManualSubmit = (event) => {
    event.preventDefault();
    dispatch({
      type: 'ADD_ASSIGNMENT',
      payload: {
        ...manualForm,
        projectId: selectedProject,
        shiftPatternId: manualForm.shiftPatternId || projectPatterns[0]?.id
      }
    });
    setIsManualOpen(false);
  };

  const handleCopyWeek = () => {
    const start = format(weekDays[0], 'yyyy-MM-dd');
    const end = format(weekDays[6], 'yyyy-MM-dd');
    setCopiedRange({ start, end });
  };

  const handlePasteWeek = () => {
    if (!copiedRange) return;
    const targetStart = format(addDays(weekDays[0], 7), 'yyyy-MM-dd');
    const targetEnd = format(addDays(weekDays[6], 7), 'yyyy-MM-dd');
    dispatch({
      type: 'COPY_ASSIGNMENTS_TO_RANGE',
      payload: {
        projectId: selectedProject,
        sourceRange: copiedRange,
        targetRange: { start: targetStart, end: targetEnd }
      }
    });
  };

  const renderAssignments = (patternId, date) => {
    const dayString = format(date, 'yyyy-MM-dd');
    const items = getAssignmentsForDate(projectAssignments, dayString).filter((assignment) => assignment.shiftPatternId === patternId);
    if (items.length === 0) return null;
    return items.map((assignment) => (
      <div key={assignment.id} className="assignment-card">
        {formatAssignee(assignment, state)}
      </div>
    ));
  };

  const renderGanttBlocks = (employee) => {
    const entries = projectAssignments.filter((assignment) => (
      assignment.assigneeType === 'employee' && assignment.assigneeId === employee.id
    ));

    const visibleWindow = 14;
    return entries.map((assignment) => {
      const start = parseISO(assignment.startDate);
      const end = parseISO(assignment.endDate);
      const offsetDays = differenceInCalendarDays(start, weekDays[0]);
      const rawEndOffset = differenceInCalendarDays(addDays(end, 1), weekDays[0]);
      const clampedStart = Math.max(0, Math.min(visibleWindow, offsetDays));
      const clampedEnd = Math.max(clampedStart + 1, Math.min(visibleWindow, rawEndOffset));
      const left = clampedStart * 120;
      const width = Math.max(1, clampedEnd - clampedStart) * 120 - 12;
      const pattern = projectPatterns.find((pat) => pat.id === assignment.shiftPatternId);
      const night = pattern ? isNightShift(pattern.startTime, pattern.endTime) : false;
      return (
        <div
          key={assignment.id}
          className="gantt-block"
          style={{ left, width, background: night ? 'rgba(79, 70, 229, 0.2)' : 'rgba(16, 185, 129, 0.2)' }}
        >
          <div>
            <strong>{pattern?.name ?? 'Shift'}</strong>
            <div className="small">{format(start, 'dd MMM')} - {format(end, 'dd MMM')}</div>
          </div>
        </div>
      );
    });
  };

  const selectedShift = projectPatterns.find((pattern) => pattern.id === manualForm.shiftPatternId) ?? projectPatterns[0];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Project planning</h2>
          <p className="small">Drag people or teams to schedule shifts. All changes are checked against fatigue rules instantly.</p>
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
          <button className="btn btn-secondary" onClick={() => setIsManualOpen(true)}>
            <FiPlus /> Manual assignment
          </button>
          <button className="btn btn-secondary" onClick={handleCopyWeek}>
            <FiCopy /> Copy week
          </button>
          <button className="btn btn-secondary" onClick={handlePasteWeek} disabled={!copiedRange}>
            <FiCopy /> Paste to next week
          </button>
          <button className="btn btn-ghost">
            <FiDownload /> Export CSV
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '18px' }}>
        <div className="toolbar">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              className={`btn ${viewMode === mode.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
          <button className="btn btn-secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            ← Previous week
          </button>
          <button className="btn btn-secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            Next week →
          </button>
        </div>
      </div>

      <div className="plan-grid">
        <div className="left-pane">
          <h3 style={{ marginTop: 0 }}>People & teams</h3>
          <p className="small" style={{ marginBottom: '12px' }}>Drag onto the planning canvas to assign.</p>
          <div>
            <h4>Employees</h4>
            <div className="list">
              {state.employees.map((employee) => {
                const summary = getPersonCompliance(employee.id, compliance);
                return (
                  <div
                    key={employee.id}
                    className="list-item"
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData('application/json', JSON.stringify({ type: 'employee', id: employee.id }))}
                  >
                    <div>
                      <strong>{employee.name}</strong>
                      <p className="small">{employee.role}</p>
                    </div>
                    <span className={`badge ${summary.status}`}>
                      <span className={`status-dot ${summary.status}`} />
                      {summary.status === 'green' ? 'Compliant' : summary.status === 'amber' ? 'Warning' : 'Breach'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <h4>Teams</h4>
            <div className="list">
              {state.teams.map((team) => (
                <div
                  key={team.id}
                  className="list-item"
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData('application/json', JSON.stringify({ type: 'team', id: team.id }))}
                >
                  <div>
                    <strong>{team.name}</strong>
                    <p className="small">{team.members.length} members</p>
                  </div>
                  <FiUsers color="#4f46e5" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="right-pane">
          {viewMode === 'timeline' && (
            <div className="timeline-grid">
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: '220px' }}>Shift pattern</th>
                    {timelineDays.map((day) => (
                      <th key={day.toISOString()}>{format(day, 'EEE dd MMM')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projectPatterns.map((pattern) => (
                    <tr key={pattern.id}>
                      <td>
                        <strong>{pattern.name}</strong>
                        <p className="small">{pattern.startTime} - {pattern.endTime} · {pattern.dutyType}</p>
                      </td>
                      {timelineDays.map((day) => {
                        const dayString = format(day, 'yyyy-MM-dd');
                        return (
                          <td
                            key={dayString}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => handleDrop(event, pattern.id, dayString)}
                          >
                            {renderAssignments(pattern.id, day)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {viewMode === 'weekly' && (
            <div className="weekly-grid">
              <div className="header">Shift pattern</div>
              {weekDays.map((day) => (
                <div key={day.toISOString()} className="header">{format(day, 'EEE dd')}</div>
              ))}
              {projectPatterns.map((pattern) => (
                <>
                  <div key={`${pattern.id}-label`} className="cell">
                    <strong>{pattern.name}</strong>
                    <div className="small">{pattern.startTime} – {pattern.endTime}</div>
                  </div>
                  {weekDays.map((day) => {
                    const dayString = format(day, 'yyyy-MM-dd');
                    return (
                      <div
                        key={`${pattern.id}-${dayString}`}
                        className="cell"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleDrop(event, pattern.id, dayString)}
                      >
                        {renderAssignments(pattern.id, day)}
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          )}

          {viewMode === 'gantt' && (
            <div className="gantt-container">
              {state.employees.map((employee) => (
                <div key={employee.id} className="gantt-row">
                  <div className="label">
                    <strong>{employee.name}</strong>
                    <div className="small">{employee.role}</div>
                  </div>
                  <div className="timeline">
                    {renderGanttBlocks(employee)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isManualOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Create manual assignment</h3>
            <form onSubmit={handleManualSubmit} className="form-grid">
              <div className="form-grid two">
                <div className="input-group">
                  <label>Assign to</label>
                  <select
                    value={manualForm.assigneeType}
                    onChange={(event) => setManualForm((prev) => ({
                      ...prev,
                      assigneeType: event.target.value,
                      assigneeId: event.target.value === 'employee' ? state.employees[0]?.id : state.teams[0]?.id
                    }))}
                  >
                    <option value="employee">Individual</option>
                    <option value="team">Team</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>{manualForm.assigneeType === 'employee' ? 'Employee' : 'Team'}</label>
                  <select
                    value={manualForm.assigneeId}
                    onChange={(event) => setManualForm((prev) => ({ ...prev, assigneeId: event.target.value }))}
                  >
                    {(manualForm.assigneeType === 'employee' ? state.employees : state.teams).map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label>Shift pattern</label>
                <select
                  value={manualForm.shiftPatternId || projectPatterns[0]?.id}
                  onChange={(event) => setManualForm((prev) => ({ ...prev, shiftPatternId: event.target.value }))}
                >
                  {projectPatterns.map((pattern) => (
                    <option key={pattern.id} value={pattern.id}>
                      {pattern.name} · {pattern.startTime}-{pattern.endTime}
                    </option>
                  ))}
                </select>
              </div>

              <div className="date-picker-group">
                <div className="input-group">
                  <label>Start date</label>
                  <input
                    type="date"
                    value={manualForm.startDate}
                    onChange={(event) => setManualForm((prev) => ({ ...prev, startDate: event.target.value }))}
                    required
                  />
                </div>
                <div className="input-group">
                  <label>End date</label>
                  <input
                    type="date"
                    value={manualForm.endDate}
                    onChange={(event) => setManualForm((prev) => ({ ...prev, endDate: event.target.value }))}
                    required
                  />
                </div>
              </div>

              {selectedShift && (
                <div className="card" style={{ background: '#f8fafc' }}>
                  <p style={{ marginTop: 0 }}><strong>{selectedShift.name}</strong></p>
                  <p className="small">{selectedShift.startTime} – {selectedShift.endTime} · {selectedShift.dutyType}</p>
                  <p className="small">{isNightShift(selectedShift.startTime, selectedShift.endTime) ? 'Night shift' : 'Day shift'}</p>
                </div>
              )}

              <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsManualOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create assignment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectPlanning;
