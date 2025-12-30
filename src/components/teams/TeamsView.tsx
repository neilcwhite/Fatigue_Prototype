'use client';

import { useState } from 'react';
import { ChevronLeft, Plus, Edit2, Trash2, Users, Calendar, X } from '@/components/ui/Icons';
import type { TeamCamel, EmployeeCamel, ProjectCamel, ShiftPatternCamel, AssignmentCamel } from '@/lib/types';

interface TeamsViewProps {
  user: any;
  onSignOut: () => void;
  onBack: () => void;
  teams: TeamCamel[];
  employees: EmployeeCamel[];
  projects: ProjectCamel[];
  shiftPatterns: ShiftPatternCamel[];
  onCreateTeam: (name: string, memberIds: number[]) => Promise<void>;
  onUpdateTeam: (id: number, data: Partial<TeamCamel>) => Promise<void>;
  onDeleteTeam: (id: number) => Promise<void>;
  onCreateAssignment: (data: Omit<AssignmentCamel, 'id' | 'organisationId'>) => Promise<void>;
}

export function TeamsView({
  user,
  onSignOut,
  onBack,
  teams,
  employees,
  projects,
  shiftPatterns,
  onCreateTeam,
  onUpdateTeam,
  onDeleteTeam,
  onCreateAssignment,
}: TeamsViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamCamel | null>(null);
  const [teamName, setTeamName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);

  // Assignment modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningTeam, setAssigningTeam] = useState<TeamCamel | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [assignStartDate, setAssignStartDate] = useState('');
  const [assignEndDate, setAssignEndDate] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

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

  // Open assignment modal
  const openAssignModal = (team: TeamCamel) => {
    setAssigningTeam(team);
    setSelectedProjectId(projects.length > 0 ? projects[0].id : null);
    setSelectedPatternId(null);
    setAssignStartDate('');
    setAssignEndDate('');
    setAssignError(null);
    setShowAssignModal(true);
  };

  // Get shift patterns for selected project
  const projectPatterns = selectedProjectId
    ? shiftPatterns.filter(sp => sp.projectId === selectedProjectId)
    : [];

  // Handle bulk assignment
  const handleBulkAssign = async () => {
    if (!assigningTeam || !selectedProjectId || !selectedPatternId || !assignStartDate || !assignEndDate) {
      setAssignError('Please fill in all fields');
      return;
    }

    const memberIds = assigningTeam.memberIds || [];
    if (memberIds.length === 0) {
      setAssignError('Team has no members');
      return;
    }

    const start = new Date(assignStartDate);
    const end = new Date(assignEndDate);
    if (end < start) {
      setAssignError('End date must be after start date');
      return;
    }

    // Get the shift pattern to check which days are active
    const pattern = shiftPatterns.find(sp => sp.id === selectedPatternId);
    if (!pattern) {
      setAssignError('Shift pattern not found');
      return;
    }

    setAssigning(true);
    setAssignError(null);

    try {
      // Generate all dates in the range
      const dates: string[] = [];
      const current = new Date(start);
      while (current <= end) {
        const dayOfWeek = current.getDay();
        const dayNames: ('Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat')[] =
          ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayKey = dayNames[dayOfWeek];

        // Only include days where the pattern is active
        if (pattern.weeklySchedule && pattern.weeklySchedule[dayKey]) {
          dates.push(current.toISOString().split('T')[0]);
        }
        current.setDate(current.getDate() + 1);
      }

      if (dates.length === 0) {
        setAssignError('No active days in the selected date range for this shift pattern');
        setAssigning(false);
        return;
      }

      // Create assignments for each team member for each date
      let created = 0;
      for (const employeeId of memberIds) {
        for (const date of dates) {
          await onCreateAssignment({
            employeeId,
            projectId: selectedProjectId,
            shiftPatternId: selectedPatternId,
            date,
          });
          created++;
        }
      }

      alert(`Successfully created ${created} assignments for ${memberIds.length} team members over ${dates.length} days`);
      setShowAssignModal(false);
    } catch (err: any) {
      console.error('Error creating assignments:', err);
      setAssignError(err.message || 'Failed to create assignments');
    } finally {
      setAssigning(false);
    }
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
                    onClick={() => openAssignModal(team)}
                    disabled={teamMembers.length === 0 || projects.length === 0}
                    className={`w-full py-2 rounded-md flex items-center justify-center gap-2 ${
                      teamMembers.length === 0 || projects.length === 0
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                    title={projects.length === 0 ? 'Create a project first' : teamMembers.length === 0 ? 'Add team members first' : 'Assign team to shift pattern'}
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

      {/* Assignment Modal */}
      {showAssignModal && assigningTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Assign Team to Shift Pattern</h2>
                <p className="text-sm text-slate-600">
                  Assigning: <span className="font-medium">{assigningTeam.name}</span> ({assigningTeam.memberIds?.length || 0} members)
                </p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-500 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {assignError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-200">
                  {assignError}
                </div>
              )}

              {/* Project Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Project <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedProjectId || ''}
                  onChange={(e) => {
                    setSelectedProjectId(Number(e.target.value));
                    setSelectedPatternId(null);
                  }}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 bg-white"
                >
                  <option value="">Select a project...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Shift Pattern Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Shift Pattern <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedPatternId || ''}
                  onChange={(e) => setSelectedPatternId(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 bg-white"
                  disabled={!selectedProjectId}
                >
                  <option value="">Select a shift pattern...</option>
                  {projectPatterns.map(sp => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name} ({sp.startTime} - {sp.endTime})
                    </option>
                  ))}
                </select>
                {selectedProjectId && projectPatterns.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No shift patterns defined for this project. Create one in Planning view first.
                  </p>
                )}
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={assignStartDate}
                    onChange={(e) => setAssignStartDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={assignEndDate}
                    onChange={(e) => setAssignEndDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 bg-white"
                  />
                </div>
              </div>

              {/* Preview */}
              {selectedPatternId && assignStartDate && assignEndDate && (
                <div className="bg-slate-50 p-3 rounded-md">
                  <p className="text-sm text-slate-600">
                    This will create assignments for <strong>{assigningTeam.memberIds?.length || 0}</strong> team members
                    from <strong>{assignStartDate}</strong> to <strong>{assignEndDate}</strong> on days
                    when the shift pattern is active.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                disabled={assigning}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAssign}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                disabled={assigning || !selectedProjectId || !selectedPatternId || !assignStartDate || !assignEndDate}
              >
                {assigning ? 'Assigning...' : 'Assign Team'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
