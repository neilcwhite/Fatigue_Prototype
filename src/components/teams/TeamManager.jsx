import { useMemo, useState } from 'react';
import { FiEdit3, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useAppContext } from '../../context/AppContext.jsx';

function TeamManager() {
  const { state, dispatch } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [form, setForm] = useState({
    name: '',
    members: []
  });

  const employeeOptions = useMemo(() => state.employees, [state.employees]);

  const openModal = (team) => {
    if (team) {
      setEditingTeam(team);
      setForm({ name: team.name, members: team.members });
    } else {
      setEditingTeam(null);
      setForm({ name: '', members: [] });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTeam(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (editingTeam) {
      dispatch({ type: 'UPDATE_TEAM', payload: { ...editingTeam, ...form } });
    } else {
      dispatch({ type: 'ADD_TEAM', payload: form });
    }
    closeModal();
  };

  const toggleMember = (memberId) => {
    setForm((prev) => ({
      ...prev,
      members: prev.members.includes(memberId)
        ? prev.members.filter((id) => id !== memberId)
        : [...prev.members, memberId]
    }));
  };

  const handleDelete = (team) => {
    if (window.confirm('Delete this team? Assignments using the team will be removed.')) {
      dispatch({ type: 'DELETE_TEAM', payload: { id: team.id } });
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Team manager</h2>
          <p className="small">Manage organisation-wide teams for rapid bulk assignments.</p>
        </div>
        <div className="toolbar">
          <button className="btn btn-primary" onClick={() => openModal(null)}>
            <FiPlus /> New team
          </button>
        </div>
      </div>

      <div className="card">
        <table className="table table-small">
          <thead>
            <tr>
              <th>Team</th>
              <th>Members</th>
              <th style={{ width: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {state.teams.map((team) => (
              <tr key={team.id}>
                <td>{team.name}</td>
                <td>{team.members.map((memberId) => state.employees.find((emp) => emp.id === memberId)?.name ?? 'Unknown').join(', ')}</td>
                <td>
                  <div className="flex">
                    <button className="btn btn-secondary" onClick={() => openModal(team)}>
                      <FiEdit3 /> Edit
                    </button>
                    <button className="btn btn-ghost" onClick={() => handleDelete(team)}>
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
            <h3>{editingTeam ? 'Edit team' : 'Create team'}</h3>
            <form onSubmit={handleSubmit} className="form-grid">
              <div className="input-group">
                <label>Name</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </div>

              <div className="input-group">
                <label>Members</label>
                <div className="card" style={{ maxHeight: '240px', overflowY: 'auto', padding: '12px' }}>
                  {employeeOptions.map((employee) => (
                    <label key={employee.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                      <input
                        type="checkbox"
                        checked={form.members.includes(employee.id)}
                        onChange={() => toggleMember(employee.id)}
                      />
                      <span>{employee.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save team</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamManager;
