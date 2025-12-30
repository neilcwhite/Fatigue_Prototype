'use client';

import { useState } from 'react';
import { ChevronLeft, Plus, Edit2, Trash2, Users, Calendar } from '@/components/ui/Icons';
import type { TeamCamel, EmployeeCamel } from '@/lib/types';

interface TeamsViewProps {
  user: any;
  onSignOut: () => void;
  onBack: () => void;
  teams: TeamCamel[];
  employees: EmployeeCamel[];
  onCreateTeam: (name: string, memberIds: number[]) => Promise<void>;
  onUpdateTeam: (id: number, data: Partial<TeamCamel>) => Promise<void>;
  onDeleteTeam: (id: number) => Promise<void>;
}

export function TeamsView({
  user,
  onSignOut,
  onBack,
  teams,
  employees,
  onCreateTeam,
  onUpdateTeam,
  onDeleteTeam,
}: TeamsViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamCamel | null>(null);
  const [teamName, setTeamName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);

  const openCreateModal = () => {
    setEditingTeam(null);
    setTeamName('');
    setSelectedMembers([]);
    setShowModal(true);
  };

  const openEditModal = (team: TeamCamel) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setSelectedMembers(team.memberIds || []);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      alert('Please enter a team name');
      return;
    }

    try {
      if (editingTeam) {
        await onUpdateTeam(editingTeam.id, { name: teamName, memberIds: selectedMembers });
      } else {
        await onCreateTeam(teamName, selectedMembers);
      }
      setShowModal(false);
    } catch (err) {
      console.error('Error saving team:', err);
      alert('Failed to save team');
    }
  };

  const handleDelete = async (team: TeamCamel) => {
    if (confirm(`Delete team "${team.name}"?`)) {
      try {
        await onDeleteTeam(team.id);
      } catch (err) {
        console.error('Error deleting team:', err);
        alert('Failed to delete team');
      }
    }
  };

  const toggleMember = (employeeId: number) => {
    setSelectedMembers(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 border-b-4 border-purple-500">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-white flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <div className="text-white font-semibold text-lg">
              <span className="text-purple-400">Team</span> Management
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="bg-slate-700 text-purple-400 px-3 py-1 rounded text-xs font-mono">
              TEAMS
            </span>
            <div className="text-slate-400 text-sm">{user?.email}</div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Teams</h2>
            <p className="text-slate-600">Create teams and bulk-assign them to shift patterns</p>
          </div>
          <button
            onClick={openCreateModal}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create Team
          </button>
        </div>

        {teams.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Teams Yet</h3>
            <p className="text-slate-500 mb-6">
              Create a team to group employees and assign them to projects together
            </p>
            <button
              onClick={openCreateModal}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700"
            >
              Create Your First Team
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map(team => {
              const teamMembers = employees.filter(e => team.memberIds?.includes(e.id));
              return (
                <div
                  key={team.id}
                  className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{team.name}</h3>
                      <p className="text-sm text-slate-600">
                        {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(team)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Edit team"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(team)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Delete team"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Team Members */}
                  <div className="mb-4">
                    <p className="text-xs font-medium text-slate-500 mb-2">MEMBERS</p>
                    <div className="flex flex-wrap gap-1">
                      {teamMembers.length === 0 ? (
                        <span className="text-slate-400 text-sm">No members</span>
                      ) : (
                        <>
                          {teamMembers.slice(0, 5).map(member => (
                            <span
                              key={member.id}
                              className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs"
                            >
                              {member.name.split(' ')[0]}
                            </span>
                          ))}
                          {teamMembers.length > 5 && (
                            <span className="bg-slate-200 text-slate-600 px-2 py-1 rounded text-xs">
                              +{teamMembers.length - 5} more
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Assign Button */}
                  <button
                    disabled={teamMembers.length === 0}
                    className={`w-full py-2 rounded-md flex items-center justify-center gap-2 ${
                      teamMembers.length === 0
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    Assign to Shift Pattern
                  </button>
                </div>
              );
            })}

            {/* Add Team Card */}
            <div
              onClick={openCreateModal}
              className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-dashed border-purple-300 rounded-lg p-6 hover:border-purple-500 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[200px]"
            >
              <div className="bg-purple-600 rounded-full p-3 mb-3">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-slate-900">Create New Team</h3>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                {editingTeam ? 'Edit Team' : 'Create Team'}
              </h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Team Name
                  </label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 bg-white"
                    placeholder="e.g., Night Shift Team A"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Members ({selectedMembers.length} selected)
                  </label>
                  <div className="border border-slate-200 rounded-md max-h-48 overflow-y-auto">
                    {employees.length === 0 ? (
                      <p className="p-3 text-slate-500 text-sm">No employees available</p>
                    ) : (
                      employees.map(emp => (
                        <label
                          key={emp.id}
                          className="flex items-center px-3 py-2 hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(emp.id)}
                            onChange={() => toggleMember(emp.id)}
                            className="mr-3"
                          />
                          <span className="text-sm text-slate-900">{emp.name}</span>
                          {emp.role && (
                            <span className="ml-2 text-xs text-slate-600">({emp.role})</span>
                          )}
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  {editingTeam ? 'Save Changes' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
