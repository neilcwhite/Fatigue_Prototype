'use client';

import { useState } from 'react';
import { X } from '@/components/ui/Icons';
import type { ShiftPatternCamel, WeeklySchedule } from '@/lib/types';

interface ShiftPatternEditModalProps {
  pattern: ShiftPatternCamel;
  onClose: () => void;
  onSave: (id: string, data: Partial<ShiftPatternCamel>) => Promise<void>;
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
] as const;

type DutyType = typeof DUTY_TYPES[number];

export function ShiftPatternEditModal({
  pattern,
  onClose,
  onSave,
}: ShiftPatternEditModalProps) {
  // Initialize state from existing pattern
  const [name, setName] = useState(pattern.name);
  const [startTime, setStartTime] = useState(pattern.startTime || '07:00');
  const [endTime, setEndTime] = useState(pattern.endTime || '19:00');
  const [dutyType, setDutyType] = useState<DutyType>(pattern.dutyType as DutyType);
  const [isNight, setIsNight] = useState(pattern.isNight);

  // Get selected days from weekly schedule
  const getSelectedDays = (): DayKey[] => {
    if (!pattern.weeklySchedule) return [];
    return DAYS.filter(day => pattern.weeklySchedule?.[day] !== null && pattern.weeklySchedule?.[day] !== undefined);
  };

  const [selectedDays, setSelectedDays] = useState<DayKey[]>(getSelectedDays());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fatigue parameters
  const [workload, setWorkload] = useState<number>(pattern.workload || 2);
  const [attention, setAttention] = useState<number>(pattern.attention || 2);
  const [commuteTime, setCommuteTime] = useState<number>(pattern.commuteTime || 60);
  const [breakFrequency, setBreakFrequency] = useState<number>(pattern.breakFrequency || 180);
  const [breakLength, setBreakLength] = useState<number>(pattern.breakLength || 30);

  const toggleDay = (day: DayKey) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
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

      await onSave(pattern.id, {
        name: name.trim(),
        startTime,
        endTime,
        dutyType: dutyType as ShiftPatternCamel['dutyType'],
        isNight,
        weeklySchedule,
        workload,
        attention,
        commuteTime,
        breakFrequency,
        breakLength,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update shift pattern';
      setError(message);
      setSaving(false);
    }
  };

  const inputStyle = "w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
  const selectStyle = "w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Edit Shift Pattern</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-200">
                {error}
              </div>
            )}

            {/* Pattern Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Pattern Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputStyle}
                placeholder="e.g., Day Shift"
              />
            </div>

            {/* Times */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Start Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={inputStyle}
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
                />
              </div>
            </div>

            {/* Duty Type and Night Shift */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Duty Type
                </label>
                <select
                  value={dutyType}
                  onChange={(e) => setDutyType(e.target.value as DutyType)}
                  className={selectStyle}
                >
                  {DUTY_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer p-2">
                  <input
                    type="checkbox"
                    checked={isNight}
                    onChange={(e) => setIsNight(e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Night Shift</span>
                </label>
              </div>
            </div>

            {/* Active Days */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Active Days <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-1 flex-wrap">
                {DAYS.map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      selectedDays.includes(day)
                        ? isNight
                          ? 'bg-purple-600 text-white'
                          : 'bg-green-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            {/* Fatigue Parameters */}
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-medium text-slate-700 mb-3">Fatigue Parameters</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Workload (1-5)
                  </label>
                  <select
                    value={workload}
                    onChange={(e) => setWorkload(parseInt(e.target.value))}
                    className={selectStyle}
                  >
                    <option value={1}>1 - Light</option>
                    <option value={2}>2 - Moderate</option>
                    <option value={3}>3 - Average</option>
                    <option value={4}>4 - Heavy</option>
                    <option value={5}>5 - Very Heavy</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Attention (1-5)
                  </label>
                  <select
                    value={attention}
                    onChange={(e) => setAttention(parseInt(e.target.value))}
                    className={selectStyle}
                  >
                    <option value={1}>1 - Low</option>
                    <option value={2}>2 - Moderate</option>
                    <option value={3}>3 - Average</option>
                    <option value={4}>4 - High</option>
                    <option value={5}>5 - Very High</option>
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Commute Time (mins)
                </label>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={commuteTime}
                  onChange={(e) => setCommuteTime(parseInt(e.target.value) || 0)}
                  className={inputStyle}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Break Frequency (mins)
                  </label>
                  <input
                    type="number"
                    min="30"
                    max="480"
                    value={breakFrequency}
                    onChange={(e) => setBreakFrequency(parseInt(e.target.value) || 180)}
                    className={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Break Length (mins)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={breakLength}
                    onChange={(e) => setBreakLength(parseInt(e.target.value) || 30)}
                    className={inputStyle}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
