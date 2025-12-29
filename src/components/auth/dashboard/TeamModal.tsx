'use client';

import React, { useState } from 'react';
import { Employee } from '@/lib/types';
import { createTeam } from '@/lib/data-service';

interface TeamModalProps {
  organisationId: string;
  employees: Employee[];
  onClose: () => void;
  onSaved: () => void;
}

export function TeamModal({ organisationId, employees, onClose, onSaved }: TeamModalProps) {
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleEmployee(id: number) {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selectedIds.length === 0) {
      setError('Please select at least one team member');
      return;
    }

    setLoading(true);

    try {
      await createTeam({
        organisation_id: organisationId,
        name,
        member_ids: selectedIds,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="text-lg font-semibold">Create Team</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="form-label">
                Team Name *
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="form-input"
                placeholder="e.g., Night Shift A"
              />
            </div>

            <div>
              <label className="form-label">
                Team Members ({selectedIds.length} selected)
              </label>
              <div className="border rounded-md max-h-60 overflow-y-auto">
                {employees.length === 0 ? (
                  <p className="p-3 text-sm text-gray-500">No employees available</p>
                ) : (
                  employees.map(employee => (
                    <label
                      key={employee.id}
                      className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(employee.id)}
                        onChange={() => toggleEmployee(employee.id)}
                        className="mr-3"
                      />
                      <div>
                        <p className="text-sm font-medium">{employee.name}</p>
                        {employee.role && (
                          <p className="text-xs text-gray-500">{employee.role}</p>
                        )}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
