'use client';

import React, { useState } from 'react';
import { createShiftPattern } from '@/lib/data-service';

interface ShiftPatternModalProps {
  projectId: number;
  organisationId: string;
  onClose: () => void;
  onSaved: () => void;
}

// ==================== ICONS ====================
const X = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// ==================== TIME OPTIONS ====================
const generateTimeOptions = (): string[] => {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      options.push(
        `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      );
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

const DUTY_TYPES = [
  { value: 'Possession', label: 'Possession' },
  { value: 'Non-Possession', label: 'Non-Possession' },
  { value: 'Office', label: 'Office' },
  { value: 'Remote', label: 'Remote' },
  { value: 'Mixed', label: 'Mixed' },
];

// ==================== COMPONENT ====================
export function ShiftPatternModal({ 
  projectId, 
  organisationId, 
  onClose, 
  onSaved 
}: ShiftPatternModalProps) {
  // Form state
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('19:00');
  const [dutyType, setDutyType] = useState('Non-Possession');
  const [isNight, setIsNight] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Calculate duration for display
  const calculateDuration = (): string => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    let startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    
    if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60; // Overnight shift
    }
    
    const duration = endMinutes - startMinutes;
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    
    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  // Auto-detect night shift
  const detectNightShift = (start: string, end: string): boolean => {
    const startHour = parseInt(start.split(':')[0]);
    const endHour = parseInt(end.split(':')[0]);
    
    // Night shift if starts after 6pm or ends before 6am
    return startHour >= 18 || startHour < 6 || endHour <= 6;
  };

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    setIsNight(detectNightShift(value, endTime));
  };

  const handleEndTimeChange = (value: string) => {
    setEndTime(value);
    setIsNight(detectNightShift(startTime, value));
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Pattern name is required');
      return;
    }

    setLoading(true);

    try {
      const patternId = `${projectId}-${Date.now()}`;
      
      await createShiftPattern({
        id: patternId,
        organisation_id: organisationId,
        project_id: projectId,
        name: name.trim(),
        start_time: startTime,
        end_time: endTime,
        duty_type: dutyType,
        is_night: isNight,
        weekly_schedule: null,
      });

      onSaved();
    } catch (err) {
      console.error('Failed to create shift pattern:', err);
      setError(err instanceof Error ? err.message : 'Failed to create shift pattern');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Shift Pattern</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Pattern name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pattern Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Day Shift, Night Shift, Weekend"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Times */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <select
                  value={startTime}
                  onChange={e => handleStartTimeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {TIME_OPTIONS.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <select
                  value={endTime}
                  onChange={e => handleEndTimeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {TIME_OPTIONS.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Duration display */}
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Duration:</span>
                <span className="font-semibold text-gray-900">{calculateDuration()}</span>
              </div>
              {parseInt(calculateDuration()) > 12 && (
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ Shifts over 12 hours may trigger compliance warnings
                </p>
              )}
            </div>

            {/* Duty type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duty Type
              </label>
              <select
                value={dutyType}
                onChange={e => setDutyType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {DUTY_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* Night shift toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <label className="text-sm font-medium text-gray-700">Night Shift</label>
                <p className="text-xs text-gray-500">Affects compliance rules and display</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNight(!isNight)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  isNight ? 'bg-purple-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    isNight ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>

            {/* Preview */}
            <div className="border-t border-gray-200 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
              <div className={`px-3 py-2 rounded-lg text-sm ${
                isNight 
                  ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                <div className="font-semibold">{name || 'Unnamed Pattern'}</div>
                <div className="text-xs opacity-75">
                  {startTime} - {endTime} • {dutyType} {isNight && '• Night'}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Creating...
                </span>
              ) : (
                'Create Pattern'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
