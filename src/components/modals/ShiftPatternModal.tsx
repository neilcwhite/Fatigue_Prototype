'use client';

import { useState, useMemo } from 'react';
import { X, ChevronDown, ChevronUp, Edit2 } from '@/components/ui/Icons';
import type { WeeklySchedule, ShiftDefinition, DaySchedule } from '@/lib/types';
import { calculateFatigueSequence, getRiskLevel, type FatigueParams } from '@/lib/fatigue';

// Per-day fatigue parameters interface
interface DayFatigueParams {
  commuteIn: number;
  commuteOut: number;
  workload: number;
  attention: number;
  breakFreq: number;
  breakLen: number;
}

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

  // Fatigue parameters (defaults)
  const [showFatigueSettings, setShowFatigueSettings] = useState(false);
  const [workload, setWorkload] = useState<number>(2);
  const [attention, setAttention] = useState<number>(2);
  const [commuteTime, setCommuteTime] = useState<number>(60);
  const [breakFrequency, setBreakFrequency] = useState<number>(180);
  const [breakLength, setBreakLength] = useState<number>(30);

  // Per-day fatigue parameter overrides
  const [usePerDayParams, setUsePerDayParams] = useState(false);
  const [perDayParams, setPerDayParams] = useState<Record<DayKey, DayFatigueParams>>(() => {
    const defaults: DayFatigueParams = {
      commuteIn: 30,
      commuteOut: 30,
      workload: 2,
      attention: 2,
      breakFreq: 180,
      breakLen: 30,
    };
    return {
      Mon: { ...defaults },
      Tue: { ...defaults },
      Wed: { ...defaults },
      Thu: { ...defaults },
      Fri: { ...defaults },
      Sat: { ...defaults },
      Sun: { ...defaults },
    };
  });
  const [editingDay, setEditingDay] = useState<DayKey | null>(null);

  // Calculate live fatigue risk for the pattern
  const fatigueResults = useMemo(() => {
    if (selectedDays.length === 0 || !startTime || !endTime) return [];

    // Map days to day numbers (Mon=1, Tue=2, etc.)
    const dayToNumber: Record<DayKey, number> = {
      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7
    };

    // Sort selected days and create shift definitions with per-day params if enabled
    const sortedDays = [...selectedDays].sort((a, b) => dayToNumber[a] - dayToNumber[b]);
    const shifts: ShiftDefinition[] = sortedDays.map(day => {
      const dayParams = perDayParams[day];
      if (usePerDayParams) {
        return {
          day: dayToNumber[day],
          startTime,
          endTime,
          commuteIn: dayParams.commuteIn,
          commuteOut: dayParams.commuteOut,
          workload: dayParams.workload,
          attention: dayParams.attention,
          breakFreq: dayParams.breakFreq,
          breakLen: dayParams.breakLen,
        };
      }
      return {
        day: dayToNumber[day],
        startTime,
        endTime,
      };
    });

    // Use global params for calculation (per-day params are embedded in shifts)
    const params: FatigueParams = {
      commuteTime: usePerDayParams ? 60 : commuteTime,
      workload: usePerDayParams ? 2 : workload,
      attention: usePerDayParams ? 2 : attention,
      breakFrequency: usePerDayParams ? 180 : breakFrequency,
      breakLength: usePerDayParams ? 30 : breakLength,
      continuousWork: usePerDayParams ? 180 : breakFrequency,
      breakAfterContinuous: usePerDayParams ? 30 : breakLength,
    };

    return calculateFatigueSequence(shifts, params);
  }, [selectedDays, startTime, endTime, workload, attention, commuteTime, breakFrequency, breakLength, usePerDayParams, perDayParams]);

  // Get max risk for color coding
  const maxRisk = useMemo(() => {
    if (fatigueResults.length === 0) return 0;
    return Math.max(...fatigueResults.map(r => r.riskIndex));
  }, [fatigueResults]);

  const toggleDay = (day: DayKey) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  // Update a specific day's fatigue params
  const updateDayParams = (day: DayKey, field: keyof DayFatigueParams, value: number) => {
    setPerDayParams(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  // Copy global params to all days
  const applyGlobalToAllDays = () => {
    const globalParams: DayFatigueParams = {
      commuteIn: Math.floor(commuteTime / 2),
      commuteOut: Math.ceil(commuteTime / 2),
      workload,
      attention,
      breakFreq: breakFrequency,
      breakLen: breakLength,
    };
    setPerDayParams({
      Mon: { ...globalParams },
      Tue: { ...globalParams },
      Wed: { ...globalParams },
      Thu: { ...globalParams },
      Fri: { ...globalParams },
      Sat: { ...globalParams },
      Sun: { ...globalParams },
    });
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
      // Build weekly schedule with per-day fatigue params if enabled
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
        if (usePerDayParams) {
          const dayParams = perDayParams[day];
          weeklySchedule[day] = {
            startTime,
            endTime,
            commuteIn: dayParams.commuteIn,
            commuteOut: dayParams.commuteOut,
            workload: dayParams.workload,
            attention: dayParams.attention,
            breakFreq: dayParams.breakFreq,
            breakLen: dayParams.breakLen,
          };
        } else {
          weeklySchedule[day] = {
            startTime,
            endTime,
          };
        }
      });

      await onSave({
        projectId,
        name: name.trim(),
        startTime,
        endTime,
        dutyType,
        isNight,
        weeklySchedule,
        // Global fatigue parameters (used when per-day not enabled)
        workload: usePerDayParams ? undefined : workload,
        attention: usePerDayParams ? undefined : attention,
        commuteTime: usePerDayParams ? undefined : commuteTime,
        breakFrequency: usePerDayParams ? undefined : breakFrequency,
        breakLength: usePerDayParams ? undefined : breakLength,
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create shift pattern';
      setError(message);
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Create Shift Pattern</h2>
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

            {/* Live Fatigue Risk Index */}
            {fatigueResults.length > 0 && (
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Live Fatigue Risk Index (HSE RR446)</span>
                  <span
                    className="text-xs font-medium px-2 py-1 rounded"
                    style={{
                      backgroundColor: getRiskLevel(maxRisk).color + '20',
                      color: getRiskLevel(maxRisk).color,
                    }}
                  >
                    Max: {maxRisk.toFixed(3)} - {getRiskLevel(maxRisk).label}
                  </span>
                </div>
                <div className="flex gap-1">
                  {(() => {
                    const dayToNumber: Record<DayKey, number> = {
                      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7
                    };
                    const sortedDays = [...selectedDays].sort((a, b) => dayToNumber[a] - dayToNumber[b]);
                    return sortedDays.map((day, idx) => {
                      const result = fatigueResults[idx];
                      if (!result) return null;
                      const riskLevel = getRiskLevel(result.riskIndex);
                      return (
                        <div
                          key={day}
                          className="flex-1 text-center p-2 rounded"
                          style={{ backgroundColor: riskLevel.color + '20' }}
                          title={`${day}: FRI=${result.riskIndex.toFixed(3)} (${riskLevel.label})`}
                        >
                          <div className="text-xs font-medium text-slate-600">{day}</div>
                          <div
                            className="text-sm font-bold"
                            style={{ color: riskLevel.color }}
                          >
                            {result.riskIndex.toFixed(2)}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Risk levels: &lt;1.0 Low (green) | 1.0-1.1 Moderate (yellow) | 1.1-1.2 Elevated (orange) | &gt;1.2 High (red)
                </p>
              </div>
            )}

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

                  {/* Toggle between global and per-day params */}
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-slate-700">Per-Day Parameters</span>
                      <p className="text-xs text-slate-500">Set different fatigue factors for each day</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={usePerDayParams}
                        onChange={(e) => {
                          setUsePerDayParams(e.target.checked);
                          if (e.target.checked) {
                            applyGlobalToAllDays();
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {!usePerDayParams ? (
                    /* Global Parameters */
                    <>
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
                    </>
                  ) : (
                    /* Per-Day Parameters */
                    <div className="space-y-2">
                      <div className="text-xs text-slate-500 mb-2">Click a day to edit its fatigue parameters:</div>
                      <div className="space-y-1">
                        {selectedDays.length === 0 ? (
                          <p className="text-sm text-slate-400 italic">Select active days above first</p>
                        ) : (
                          [...selectedDays].sort((a, b) => {
                            const order: Record<DayKey, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
                            return order[a] - order[b];
                          }).map(day => {
                            const params = perDayParams[day];
                            const isEditing = editingDay === day;
                            return (
                              <div key={day} className="border border-slate-200 rounded-lg overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => setEditingDay(isEditing ? null : day)}
                                  className="w-full px-3 py-2 flex items-center justify-between bg-slate-50 hover:bg-slate-100 text-left"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-slate-700">{day}</span>
                                    <span className="text-xs text-slate-500">
                                      W:{params.workload} A:{params.attention} C:{params.commuteIn + params.commuteOut}m
                                    </span>
                                  </div>
                                  <Edit2 className={`w-4 h-4 ${isEditing ? 'text-blue-600' : 'text-slate-400'}`} />
                                </button>
                                {isEditing && (
                                  <div className="p-3 space-y-3 bg-white border-t border-slate-200">
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Commute In (mins)</label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="120"
                                          value={params.commuteIn}
                                          onChange={(e) => updateDayParams(day, 'commuteIn', parseInt(e.target.value) || 0)}
                                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm text-slate-900"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Commute Out (mins)</label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="120"
                                          value={params.commuteOut}
                                          onChange={(e) => updateDayParams(day, 'commuteOut', parseInt(e.target.value) || 0)}
                                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm text-slate-900"
                                        />
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Workload (1-5)</label>
                                        <select
                                          value={params.workload}
                                          onChange={(e) => updateDayParams(day, 'workload', parseInt(e.target.value))}
                                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm text-slate-900"
                                        >
                                          <option value={1}>1 - Light</option>
                                          <option value={2}>2 - Moderate</option>
                                          <option value={3}>3 - Average</option>
                                          <option value={4}>4 - Heavy</option>
                                          <option value={5}>5 - Very Heavy</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Attention (1-5)</label>
                                        <select
                                          value={params.attention}
                                          onChange={(e) => updateDayParams(day, 'attention', parseInt(e.target.value))}
                                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm text-slate-900"
                                        >
                                          <option value={1}>1 - Low</option>
                                          <option value={2}>2 - Moderate</option>
                                          <option value={3}>3 - Average</option>
                                          <option value={4}>4 - High</option>
                                          <option value={5}>5 - Very High</option>
                                        </select>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Break Freq (mins)</label>
                                        <input
                                          type="number"
                                          min="30"
                                          max="480"
                                          value={params.breakFreq}
                                          onChange={(e) => updateDayParams(day, 'breakFreq', parseInt(e.target.value) || 180)}
                                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm text-slate-900"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Break Length (mins)</label>
                                        <input
                                          type="number"
                                          min="5"
                                          max="60"
                                          value={params.breakLen}
                                          onChange={(e) => updateDayParams(day, 'breakLen', parseInt(e.target.value) || 30)}
                                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm text-slate-900"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
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
