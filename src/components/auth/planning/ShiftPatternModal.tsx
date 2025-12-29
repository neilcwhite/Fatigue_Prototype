'use client';

import React, { useState } from 'react';
import { DutyType } from '@/lib/types';
import { createShiftPattern } from '@/lib/data-service';

interface ShiftPatternModalProps {
  projectId: number;
  organisationId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function ShiftPatternModal({ projectId, organisationId, onClose, onSaved }: ShiftPatternModalProps) {
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('19:00');
  const [dutyType, setDutyType] = useState<DutyType>('Non-Possession');
  const [isNight, setIsNight] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const patternId = `${projectId}-${Date.now()}`;
      
      await createShiftPattern({
        id: patternId,
        organisation_id: organisationId,
        project_id: projectId,
        name,
        start_time: startTime,
        end_time: endTime,
        weekly_schedule: null,
        duty_type: dutyType,
        is_night: isNight,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create shift pattern');
    } finally {
      setLoading(false);
    }
  }

  // Auto-detect night shift
  function handleTimeChange(start: string, end: string) {
    const startHour = parseInt(start.split(':')[0]);
    const endHour = parseInt(end.split(':')[0]);
    
    // Night shift if end time is before start time or starts after 6pm
    const isOvernightOrEvening = endHour < startHour || startHour >= 18;
    setIsNight(isOvernightOrEvening);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="text-lg font-semibold">New Shift Pattern</h2>
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
                Pattern Name *
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="form-input"
                placeholder="e.g., Day Shift, Night Shift"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startTime" className="form-label">
                  Start Time
                </label>
                <input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={e => {
                    setStartTime(e.target.value);
                    handleTimeChange(e.target.value, endTime);
                  }}
                  className="form-input"
                />
              </div>
              <div>
                <label htmlFor="endTime" className="form-label">
                  End Time
                </label>
                <input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={e => {
                    setEndTime(e.target.value);
                    handleTimeChange(startTime, e.target.value);
                  }}
                  className="form-input"
                />
              </div>
            </div>

            <div>
              <label htmlFor="dutyType" className="form-label">
                Duty Type
              </label>
              <select
                id="dutyType"
                value={dutyType}
                onChange={e => setDutyType(e.target.value as DutyType)}
                className="form-input"
              >
                <option value="Possession">Possession</option>
                <option value="Non-Possession">Non-Possession</option>
                <option value="Office">Office</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="isNight"
                type="checkbox"
                checked={isNight}
                onChange={e => setIsNight(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="isNight" className="text-sm">
                Night shift (crosses midnight)
              </label>
            </div>

            {isNight && (
              <div className="bg-purple-50 text-purple-700 px-3 py-2 rounded text-sm">
                This shift will be marked as an overnight shift
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Creating...' : 'Create Pattern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
