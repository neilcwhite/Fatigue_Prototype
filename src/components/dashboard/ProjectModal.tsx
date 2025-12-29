'use client';

import React, { useState } from 'react';
import { createProject } from '@/lib/data-service';

interface ProjectModalProps {
  organisationId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function ProjectModal({ organisationId, onClose, onSaved }: ProjectModalProps) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createProject({
        organisation_id: organisationId,
        name,
        location: location || null,
        start_date: startDate || null,
        end_date: endDate || null,
        type: type || null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="text-lg font-semibold">New Project</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
            <div>
              <label htmlFor="name" className="form-label">Project Name *</label>
              <input id="name" type="text" required value={name} onChange={e => setName(e.target.value)} className="form-input" placeholder="e.g., Euston Station Works" />
            </div>
            <div>
              <label htmlFor="location" className="form-label">Location</label>
              <input id="location" type="text" value={location} onChange={e => setLocation(e.target.value)} className="form-input" placeholder="e.g., London Euston" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className="form-label">Start Date</label>
                <input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input" />
              </div>
              <div>
                <label htmlFor="endDate" className="form-label">End Date</label>
                <input id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input" />
              </div>
            </div>
            <div>
              <label htmlFor="type" className="form-label">Project Type</label>
              <select id="type" value={type} onChange={e => setType(e.target.value)} className="form-input">
                <option value="">Select type...</option>
                <option value="Possession">Possession</option>
                <option value="Non-Possession">Non-Possession</option>
                <option value="Mixed">Mixed</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Creating...' : 'Create Project'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
