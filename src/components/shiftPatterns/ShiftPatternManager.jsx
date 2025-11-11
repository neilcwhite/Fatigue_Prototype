import { useMemo, useState } from 'react';
import { FiEdit3, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useAppContext } from '../../context/AppContext.jsx';
import { isNightShift } from '../../utils/compliance.js';

function ShiftPatternManager({ selectedProject, onProjectChange, projectOptions }) {
  const { state, dispatch } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState(null);
  const [form, setForm] = useState({
    name: '',
    startTime: '08:00',
    endTime: '18:00',
    dutyType: 'Non-Possession',
    night: false
  });

  const patterns = useMemo(() => (
    state.shiftPatterns.filter((pattern) => pattern.projectId === selectedProject)
  ), [selectedProject, state.shiftPatterns]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      projectId: selectedProject,
      isNight: isNightShift(form.startTime, form.endTime)
    };

    if (editingPattern) {
      dispatch({ type: 'UPDATE_SHIFT_PATTERN', payload: { ...payload, id: editingPattern.id } });
    } else {
      dispatch({ type: 'ADD_SHIFT_PATTERN', payload: payload });
    }
    setIsModalOpen(false);
    setEditingPattern(null);
    setForm({ name: '', startTime: '08:00', endTime: '18:00', dutyType: 'Non-Possession', night: false });
  };

  const handleEdit = (pattern) => {
    setEditingPattern(pattern);
    setForm({
      name: pattern.name,
      startTime: pattern.startTime,
      endTime: pattern.endTime,
      dutyType: pattern.dutyType,
      night: isNightShift(pattern.startTime, pattern.endTime)
    });
    setIsModalOpen(true);
  };

  const handleDelete = (pattern) => {
    if (window.confirm('Delete this shift pattern? Any related assignments will also be removed.')) {
      dispatch({ type: 'DELETE_SHIFT_PATTERN', payload: { id: pattern.id } });
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Shift pattern library</h2>
          <p className="small">Build project-specific shift templates and reuse them across the planning views.</p>
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
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <FiPlus /> New shift pattern
          </button>
        </div>
      </div>

      <div className="card">
        <table className="table table-small">
          <thead>
            <tr>
              <th>Name</th>
              <th>Times</th>
              <th>Duty type</th>
              <th>Night shift</th>
              <th style={{ width: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {patterns.map((pattern) => (
              <tr key={pattern.id}>
                <td>{pattern.name}</td>
                <td>{pattern.startTime} – {pattern.endTime}</td>
                <td>{pattern.dutyType}</td>
                <td>{isNightShift(pattern.startTime, pattern.endTime) ? 'Yes' : 'No'}</td>
                <td>
                  <div className="flex">
                    <button className="btn btn-secondary" onClick={() => handleEdit(pattern)}>
                      <FiEdit3 /> Edit
                    </button>
                    <button className="btn btn-ghost" onClick={() => handleDelete(pattern)}>
                      <FiTrash2 />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>{editingPattern ? 'Edit shift pattern' : 'Create shift pattern'}</h3>
            <form onSubmit={handleSubmit} className="form-grid">
              <div className="form-grid two">
                <div className="input-group">
                  <label>Name</label>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </div>
                <div className="input-group">
                  <label>Duty type</label>
                  <select
                    value={form.dutyType}
                    onChange={(event) => setForm((prev) => ({ ...prev, dutyType: event.target.value }))}
                  >
                    <option value="Possession">Possession</option>
                    <option value="Non-Possession">Non-Possession</option>
                  </select>
                </div>
              </div>

              <div className="form-grid two">
                <div className="input-group">
                  <label>Start time</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))}
                    required
                  />
                </div>
                <div className="input-group">
                  <label>End time</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Night shift</label>
                <div className="checkbox-group">
                  <input type="checkbox" checked={isNightShift(form.startTime, form.endTime)} readOnly />
                  <span className="small">Automatically detected when the shift spans midnight or early hours.</span>
                </div>
              </div>

              <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => { setIsModalOpen(false); setEditingPattern(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShiftPatternManager;
