'use client';

import { useState } from 'react';
import { X, ChevronDown, ChevronUp } from '@/components/ui/Icons';
import type { WeeklySchedule } from '@/lib/types';

interface ShiftPatternModalProps {
  projectId: number;
  onClose: () => void;
  onSave: (data: {
    projectId: number;
    name: string;
    startTime: string;
    endTime: string;
    dutyType: string;
    isNight: boolean;
    weeklySchedule: WeeklySchedule;
    // Fatigue parameters
    workload?: number;
    attention?: number;
    commuteTime?: number;
    breakFrequency?: number;
    breakLength?: number;
  }) => Promise<void>;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
type DayKey = typeof DAYS[number];

const DUTY_TYPES = [
  'Non-Possession',
  'Possession',
  'Lookout',
  'Machine',
  'Protection',
  'Other',
];

// Preset templates
const PRESETS = {
  dayShift: {
    name: 'Day Shift (07:00-19:00)',
    startTime: '07:00',
    endTime: '19:00',
    dutyType: 'Non-Possession',
    isNight: false,
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  nightShift: {
    name: 'Night Shift (19:00-07:00)',
    startTime: '19:00',
    endTime: '07:00',
    dutyType: 'Non-Possession',
    isNight: true,
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  weekendPossession: {
    name: 'Weekend Possession',
    startTime: '00:01',
    endTime: '05:59',
    dutyType: 'Possession',
    isNight: true,
    days: ['Sat', 'Sun'],
  },
  weekdays: {
    name: 'Weekdays Only (08:00-18:00)',
    startTime: '08:00',
    endTime: '18:00',
    dutyType: 'Non-Possession',
    isNight: false,
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
};

export function ShiftPatternModal({ projectId, onClose, onSave }: ShiftPatternModalProps) {
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('19:00');
  const [dutyType, setDutyType] = useState('Non-Possession');
  const [isNight, setIsNight] = useState(false);
  const [selectedDays, setSelectedDays] = useState<DayKey[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fatigue parameters
  const [showFatigueSettings, setShowFatigueSettings] = useState(false);
  const [workload, setWorkload] = useState<number>(2);
  const [attention, setAttention] = useState<number>(2);
  const [commuteTime, setCommuteTime] = useState<number>(60);
  const [breakFrequency, setBreakFrequency] = useState<number>(180);
  const [breakLength, setBreakLength] = useState<number>(30);

  const toggleDay = (day: DayKey) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const applyPreset = (presetKey: keyof typeof PRESETS) => {
    const preset = PRESETS[presetKey];
    setName(preset.name);
    setStartTime(preset.startTime);
    setEndTime(preset.endTime);
    setDutyType(preset.dutyType);
    setIsNight(preset.isNight);
    setSelectedDays(preset.days as DayKey[]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Pattern name is required');
      return;
    }

    if (selectedDays.length === 0) {
      setError('Select at least one day');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      // Build weekly schedule
      const weeklySchedule: WeeklySchedule = {
        Mon: null,
        Tue: null,
        Wed: null,
        Thu: null,
        Fri: null,
        Sat: null,
        Sun: null,
      };

      selectedDays.forEach(day => {
        weeklySchedule[day] = {
          startTime,
          endTime,
        };
      });

      await onSave({
        projectId,
        name: name.trim(),
        startTime,
        endTime,
        dutyType,
        isNight,
        weeklySchedule,
        // Fatigue parameters
        workload,
        attention,
        commuteTime,
        breakFrequency,
        breakLength,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create shift pattern');
    } finally {
      setSaving(false);
    }
  };

  // Auto-detect night shift
  const handleStartTimeChange = (time: string) => {
    setStartTime(time);
    const hour = parseInt(time.split(':')[0]);
    if (hour >= 18 || hour < 6) {
      setIsNight(true);
    }
  };

  // Common input style with good contrast
  const inputStyle = "w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
  const selectStyle = "w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Create Shift Pattern</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-200">
                {error}
              </div>
            )}

            {/* Presets - Fixed with visible text */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Quick Templates
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset('dayShift')}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
                >
                  Day Shift
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('nightShift')}
                  className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-md font-medium"
                >
                  Night Shift
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('weekendPossession')}
                  className="px-3 py-1.5 text-sm bg-orange-600 hover:bg-orange-700 text-white rounded-md font-medium"
                >
                  Weekend Possession
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('weekdays')}
                  className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md font-medium"
                >
                  Weekdays Only
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Pattern Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputStyle}
                placeholder="e.g., Day Shift, Night Shift"
                style={{ color: '#1e293b' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Start Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className={inputStyle}
                  style={{ color: '#1e293b' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  End Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={inputStyle}
                  style={{ color: '#1e293b' }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Duty Type
                </label>
                <select
                  value={dutyType}
                  onChange={(e) => setDutyType(e.target.value)}
                  className={selectStyle}
                  style={{ color: '#1e293b' }}
                >
                  {DUTY_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer mt-6">
                  <input
                    type="checkbox"
                    checked={isNight}
                    onChange={(e) => setIsNight(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700 font-medium">Night Shift 🌙</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Active Days <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                {DAYS.map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      selectedDays.includes(day)
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Click to toggle. Employees can only be assigned on active days.
              </p>
            </div>

            {/* Fatigue Settings (Collapsible) */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowFatigueSettings(!showFatigueSettings)}
                className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <span className="font-medium text-slate-700">Fatigue Risk Parameters</span>
                {showFatigueSettings ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>

              {showFatigueSettings && (
                <div className="p-4 space-y-4 bg-white border-t border-slate-200">
                  <p className="text-xs text-slate-500 mb-3">
                    These values are used in HSE RR446 fatigue calculations for this shift pattern.
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Workload (1-5)
                      </label>
                      <select
                        value={workload}
                        onChange={(e) => setWorkload(parseInt(e.target.value))}
                        className={selectStyle}
                        style={{ color: '#1e293b' }}
                      >
                        <option value={1}>1 - Light</option>
                        <option value={2}>2 - Moderate</option>
                        <option value={3}>3 - Average</option>
                        <option value={4}>4 - Heavy</option>
                        <option value={5}>5 - Very Heavy</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Attention (1-5)
                      </label>
                      <select
                        value={attention}
                        onChange={(e) => setAttention(parseInt(e.target.value))}
                        className={selectStyle}
                        style={{ color: '#1e293b' }}
                      >
                        <option value={1}>1 - Low</option>
                        <option value={2}>2 - Moderate</option>
                        <option value={3}>3 - Average</option>
                        <option value={4}>4 - High</option>
                        <option value={5}>5 - Very High</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Commute Time (minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="180"
                      value={commuteTime}
                      onChange={(e) => setCommuteTime(parseInt(e.target.value) || 0)}
                      className={inputStyle}
                      style={{ color: '#1e293b' }}
                    />
                    <p className="text-xs text-slate-500 mt-1">Total daily commute (home to work + work to home)</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Break Frequency (mins)
                      </label>
                      <input
                        type="number"
                        min="30"
                        max="480"
                        value={breakFrequency}
                        onChange={(e) => setBreakFrequency(parseInt(e.target.value) || 180)}
                        className={inputStyle}
                        style={{ color: '#1e293b' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Break Length (mins)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="60"
                        value={breakLength}
                        onChange={(e) => setBreakLength(parseInt(e.target.value) || 30)}
                        className={inputStyle}
                        style={{ color: '#1e293b' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 font-medium"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
              disabled={saving}
            >
              {saving ? 'Creating...' : 'Create Pattern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
