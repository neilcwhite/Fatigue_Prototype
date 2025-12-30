'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, Plus, Trash2, Settings, ChevronDown, ChevronUp } from '@/components/ui/Icons';
import {
  calculateFatigueSequence,
  getRiskLevel,
  DEFAULT_FATIGUE_PARAMS,
  FATIGUE_TEMPLATES,
  parseTimeToHours,
  calculateDutyLength,
} from '@/lib/fatigue';
import type { ShiftDefinition, FatigueResult } from '@/lib/types';

interface Shift extends ShiftDefinition {
  id: number;
}

interface FatigueViewProps {
  user: any;
  onSignOut: () => void;
  onBack: () => void;
}

// Extended templates including the original simple ones
const TEMPLATES = {
  ...FATIGUE_TEMPLATES,
  standard5x8: {
    name: 'Standard 5×8h Days',
    shifts: [
      { day: 1, startTime: '08:00', endTime: '16:00' },
      { day: 2, startTime: '08:00', endTime: '16:00' },
      { day: 3, startTime: '08:00', endTime: '16:00' },
      { day: 4, startTime: '08:00', endTime: '16:00' },
      { day: 5, startTime: '08:00', endTime: '16:00' },
    ],
  },
  days4x12: {
    name: '4×12h Day Shifts',
    shifts: [
      { day: 1, startTime: '07:00', endTime: '19:00' },
      { day: 2, startTime: '07:00', endTime: '19:00' },
      { day: 3, startTime: '07:00', endTime: '19:00' },
      { day: 4, startTime: '07:00', endTime: '19:00' },
    ],
  },
  nights4x12: {
    name: '4×12h Night Shifts',
    shifts: [
      { day: 1, startTime: '19:00', endTime: '07:00' },
      { day: 2, startTime: '19:00', endTime: '07:00' },
      { day: 3, startTime: '19:00', endTime: '07:00' },
      { day: 4, startTime: '19:00', endTime: '07:00' },
    ],
  },
  mixed7on7off: {
    name: '7 On / 7 Off Mixed',
    shifts: [
      { day: 1, startTime: '07:00', endTime: '19:00' },
      { day: 2, startTime: '07:00', endTime: '19:00' },
      { day: 3, startTime: '07:00', endTime: '19:00' },
      { day: 4, startTime: '19:00', endTime: '07:00' },
      { day: 5, startTime: '19:00', endTime: '07:00' },
      { day: 6, startTime: '19:00', endTime: '07:00' },
      { day: 7, startTime: '19:00', endTime: '07:00' },
    ],
  },
  continental: {
    name: 'Continental (2-2-3)',
    shifts: [
      { day: 1, startTime: '06:00', endTime: '18:00' },
      { day: 2, startTime: '06:00', endTime: '18:00' },
      { day: 5, startTime: '18:00', endTime: '06:00' },
      { day: 6, startTime: '18:00', endTime: '06:00' },
      { day: 9, startTime: '06:00', endTime: '18:00' },
      { day: 10, startTime: '06:00', endTime: '18:00' },
      { day: 11, startTime: '06:00', endTime: '18:00' },
    ],
  },
};

export function FatigueView({
  user,
  onSignOut,
  onBack,
}: FatigueViewProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedShift, setExpandedShift] = useState<number | null>(null);

  // Fatigue parameters - explicitly typed to allow mutable number values
  const [params, setParams] = useState<{
    commuteTime: number;
    workload: number;
    attention: number;
    breakFrequency: number;
    breakLength: number;
    continuousWork: number;
    breakAfterContinuous: number;
  }>({
    commuteTime: DEFAULT_FATIGUE_PARAMS.commuteTime,
    workload: DEFAULT_FATIGUE_PARAMS.workload,
    attention: DEFAULT_FATIGUE_PARAMS.attention,
    breakFrequency: DEFAULT_FATIGUE_PARAMS.breakFrequency,
    breakLength: DEFAULT_FATIGUE_PARAMS.breakLength,
    continuousWork: DEFAULT_FATIGUE_PARAMS.continuousWork,
    breakAfterContinuous: DEFAULT_FATIGUE_PARAMS.breakAfterContinuous,
  });

  // Calculate results using full HSE RR446 algorithm
  const results = useMemo(() => {
    if (shifts.length === 0) return null;

    const sortedShifts = [...shifts].sort((a, b) => a.day - b.day);
    const shiftDefinitions: ShiftDefinition[] = sortedShifts.map(s => ({
      day: s.day,
      startTime: s.startTime,
      endTime: s.endTime,
    }));

    const calculations = calculateFatigueSequence(shiftDefinitions, params);

    // Calculate duty lengths for display
    const calculationsWithDuty = calculations.map((calc, idx) => {
      const shift = sortedShifts[idx];
      const startHour = parseTimeToHours(shift.startTime);
      let endHour = parseTimeToHours(shift.endTime);
      if (endHour <= startHour) endHour += 24;
      const dutyLength = calculateDutyLength(startHour, endHour);

      return {
        ...calc,
        id: shift.id,
        startTime: shift.startTime,
        endTime: shift.endTime,
        dutyLength: Math.round(dutyLength * 10) / 10,
      };
    });

    const riskIndices = calculationsWithDuty.map(c => c.riskIndex);
    const avgRisk = riskIndices.reduce((a, b) => a + b, 0) / riskIndices.length;
    const maxRisk = Math.max(...riskIndices);
    const totalHours = calculationsWithDuty.reduce((a, c) => a + c.dutyLength, 0);

    // Component averages
    const avgCumulative = calculationsWithDuty.reduce((a, c) => a + c.cumulative, 0) / calculationsWithDuty.length;
    const avgTiming = calculationsWithDuty.reduce((a, c) => a + c.timing, 0) / calculationsWithDuty.length;
    const avgJobBreaks = calculationsWithDuty.reduce((a, c) => a + c.jobBreaks, 0) / calculationsWithDuty.length;

    return {
      calculations: calculationsWithDuty,
      summary: {
        avgRisk: Math.round(avgRisk * 1000) / 1000,
        maxRisk: Math.round(maxRisk * 1000) / 1000,
        dutyCount: calculationsWithDuty.length,
        totalHours: Math.round(totalHours * 10) / 10,
        highRiskCount: calculationsWithDuty.filter(c => c.riskIndex >= 1.1).length,
        avgCumulative: Math.round(avgCumulative * 1000) / 1000,
        avgTiming: Math.round(avgTiming * 1000) / 1000,
        avgJobBreaks: Math.round(avgJobBreaks * 1000) / 1000,
      },
    };
  }, [shifts, params]);

  const handleAddShift = () => {
    const lastDay = shifts.length > 0 ? Math.max(...shifts.map(s => s.day)) : 0;
    setShifts([...shifts, { id: Date.now(), day: lastDay + 1, startTime: '08:00', endTime: '17:00' }]);
  };

  const handleRemoveShift = (id: number) => {
    setShifts(shifts.filter(s => s.id !== id));
  };

  const handleUpdateShift = (id: number, field: keyof Shift, value: any) => {
    setShifts(shifts.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleLoadTemplate = (templateKey: string) => {
    const template = TEMPLATES[templateKey as keyof typeof TEMPLATES];
    if (template) {
      setShifts(template.shifts.map((s, i) => ({ ...s, id: Date.now() + i })));
    }
  };

  const handleClearAll = () => {
    setShifts([]);
  };

  const handleResetParams = () => {
    setParams({ ...DEFAULT_FATIGUE_PARAMS });
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800 border-green-300';
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'elevated': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  // Risk bar visualization
  const RiskBar = ({ value, max = 1.5, label, color }: { value: number; max?: number; label: string; color: string }) => {
    const percentage = Math.min(100, (value / max) * 100);
    return (
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-600">{label}</span>
          <span className="font-medium text-slate-800">{value.toFixed(3)}</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${color} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 border-b-4 border-orange-500">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-md text-sm flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <div className="text-white font-semibold text-lg">
              Fatigue <span className="text-orange-400">Risk Assessment</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="bg-slate-700 text-orange-400 px-3 py-1 rounded text-xs font-mono">
              HSE RR446 COMPLIANT
            </span>
            <div className="text-slate-400 text-sm">{user?.email}</div>
          </div>
        </div>
      </header>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Input */}
          <div className="space-y-4">
            {/* Shift Pattern Definition */}
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Shift Pattern Definition</h3>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`text-sm px-3 py-1 rounded flex items-center gap-1 ${
                    showSettings ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Parameters
                </button>
              </div>

              <div className="p-4">
                {/* Templates */}
                <div className="mb-4">
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Load Template</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(TEMPLATES).map(([key, template]) => (
                      <button
                        key={key}
                        onClick={() => handleLoadTemplate(key)}
                        className="text-xs px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded text-left text-slate-700 truncate"
                        title={template.name}
                      >
                        {template.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={handleAddShift}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1 text-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Shift
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 text-sm"
                  >
                    Clear All
                  </button>
                </div>

                {/* Shifts List */}
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {shifts.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">
                      Add shifts or load a template to calculate fatigue risk
                    </p>
                  ) : (
                    [...shifts].sort((a, b) => a.day - b.day).map(shift => (
                      <div key={shift.id} className="border rounded-lg p-3 bg-slate-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min="1"
                              max="28"
                              value={shift.day}
                              onChange={(e) => handleUpdateShift(shift.id, 'day', parseInt(e.target.value) || 1)}
                              className="w-16 border rounded px-2 py-1 text-sm text-slate-900 bg-white text-center"
                              title="Day number"
                            />
                            <input
                              type="time"
                              value={shift.startTime}
                              onChange={(e) => handleUpdateShift(shift.id, 'startTime', e.target.value)}
                              className="border rounded px-2 py-1 text-sm text-slate-900 bg-white"
                            />
                            <span className="text-slate-600">to</span>
                            <input
                              type="time"
                              value={shift.endTime}
                              onChange={(e) => handleUpdateShift(shift.id, 'endTime', e.target.value)}
                              className="border rounded px-2 py-1 text-sm text-slate-900 bg-white"
                            />
                          </div>
                          <button
                            onClick={() => handleRemoveShift(shift.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Parameters Panel (Collapsible) */}
            {showSettings && (
              <div className="bg-white rounded-lg shadow-md">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">HSE RR446 Parameters</h3>
                  <button
                    onClick={handleResetParams}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Reset to Defaults
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  {/* Commute */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">
                      Commute Time (minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="180"
                      value={params.commuteTime}
                      onChange={(e) => setParams({ ...params, commuteTime: parseInt(e.target.value) || 0 })}
                      className="w-full border rounded px-3 py-2 text-slate-900 bg-white"
                    />
                    <p className="text-xs text-slate-500 mt-1">Total daily commute time (home to work + work to home)</p>
                  </div>

                  {/* Workload & Attention */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1">
                        Workload (1-5)
                      </label>
                      <select
                        value={params.workload}
                        onChange={(e) => setParams({ ...params, workload: parseInt(e.target.value) })}
                        className="w-full border rounded px-3 py-2 text-slate-900 bg-white"
                      >
                        <option value={1}>1 - Light</option>
                        <option value={2}>2 - Moderate</option>
                        <option value={3}>3 - Average</option>
                        <option value={4}>4 - Heavy</option>
                        <option value={5}>5 - Very Heavy</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1">
                        Attention (1-5)
                      </label>
                      <select
                        value={params.attention}
                        onChange={(e) => setParams({ ...params, attention: parseInt(e.target.value) })}
                        className="w-full border rounded px-3 py-2 text-slate-900 bg-white"
                      >
                        <option value={1}>1 - Low</option>
                        <option value={2}>2 - Moderate</option>
                        <option value={3}>3 - Average</option>
                        <option value={4}>4 - High</option>
                        <option value={5}>5 - Very High</option>
                      </select>
                    </div>
                  </div>

                  {/* Break Settings */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1">
                        Break Frequency (mins)
                      </label>
                      <input
                        type="number"
                        min="30"
                        max="480"
                        value={params.breakFrequency}
                        onChange={(e) => setParams({ ...params, breakFrequency: parseInt(e.target.value) || 180 })}
                        className="w-full border rounded px-3 py-2 text-slate-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1">
                        Break Length (mins)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="60"
                        value={params.breakLength}
                        onChange={(e) => setParams({ ...params, breakLength: parseInt(e.target.value) || 30 })}
                        className="w-full border rounded px-3 py-2 text-slate-900 bg-white"
                      />
                    </div>
                  </div>

                  {/* Continuous Work */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1">
                        Continuous Work (mins)
                      </label>
                      <input
                        type="number"
                        min="30"
                        max="480"
                        value={params.continuousWork}
                        onChange={(e) => setParams({ ...params, continuousWork: parseInt(e.target.value) || 180 })}
                        className="w-full border rounded px-3 py-2 text-slate-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1">
                        Break After Continuous
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="60"
                        value={params.breakAfterContinuous}
                        onChange={(e) => setParams({ ...params, breakAfterContinuous: parseInt(e.target.value) || 30 })}
                        className="w-full border rounded px-3 py-2 text-slate-900 bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Results */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">Fatigue Risk Analysis</h3>
            </div>

            <div className="p-4">
              {!results ? (
                <div className="text-center py-12 text-slate-500">
                  <p className="text-lg mb-2">No shifts to analyze</p>
                  <p className="text-sm">Add shifts on the left to see fatigue risk calculations</p>
                </div>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className={`p-4 rounded-lg border ${getRiskColor(getRiskLevel(results.summary.avgRisk).level)}`}>
                      <p className="text-xs font-medium opacity-75">Average FRI</p>
                      <p className="text-2xl font-bold">{results.summary.avgRisk}</p>
                    </div>
                    <div className={`p-4 rounded-lg border ${getRiskColor(getRiskLevel(results.summary.maxRisk).level)}`}>
                      <p className="text-xs font-medium opacity-75">Peak FRI</p>
                      <p className="text-2xl font-bold">{results.summary.maxRisk}</p>
                    </div>
                    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                      <p className="text-xs font-medium text-slate-600">Total Hours</p>
                      <p className="text-2xl font-bold text-slate-800">{results.summary.totalHours}h</p>
                    </div>
                    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                      <p className="text-xs font-medium text-slate-600">High Risk Shifts</p>
                      <p className="text-2xl font-bold text-slate-800">{results.summary.highRiskCount}</p>
                    </div>
                  </div>

                  {/* Component Breakdown */}
                  <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">Average Component Scores</h4>
                    <RiskBar value={results.summary.avgCumulative} label="Cumulative Fatigue" color="bg-blue-500" />
                    <RiskBar value={results.summary.avgTiming} label="Timing Component" color="bg-purple-500" />
                    <RiskBar value={results.summary.avgJobBreaks} label="Job/Breaks Component" color="bg-amber-500" />
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 font-medium">Combined FRI</span>
                        <span className="font-bold text-slate-800">{results.summary.avgRisk}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        FRI = Cumulative × Timing × Job/Breaks
                      </p>
                    </div>
                  </div>

                  {/* Risk Level Legend */}
                  <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs font-medium text-slate-600 mb-2">Risk Level Guide (HSE RR446)</p>
                    <div className="flex gap-2 text-xs flex-wrap">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded">{'<1.0 Low'}</span>
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">1.0-1.1 Mod</span>
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded">1.1-1.2 Elev</span>
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded">{'>1.2 Critical'}</span>
                    </div>
                  </div>

                  {/* Per-Shift Results */}
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {results.calculations.map((calc) => (
                      <div
                        key={calc.id}
                        className={`rounded-lg border overflow-hidden ${getRiskColor(calc.riskLevel.level)}`}
                      >
                        <div
                          className="p-3 cursor-pointer"
                          onClick={() => setExpandedShift(expandedShift === calc.id ? null : calc.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {expandedShift === calc.id ? (
                                <ChevronUp className="w-4 h-4 opacity-50" />
                              ) : (
                                <ChevronDown className="w-4 h-4 opacity-50" />
                              )}
                              <div>
                                <span className="font-medium">Day {calc.day}</span>
                                <span className="text-sm ml-2 opacity-75">
                                  {calc.startTime} - {calc.endTime}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-lg">{calc.riskIndex}</span>
                              <span className="text-xs ml-1 opacity-75">FRI</span>
                            </div>
                          </div>
                          <div className="text-xs mt-1 opacity-75">
                            Duration: {calc.dutyLength}h • {calc.riskLevel.label}
                          </div>
                        </div>

                        {/* Expanded Component Details */}
                        {expandedShift === calc.id && (
                          <div className="px-3 pb-3 pt-0 border-t border-current/20">
                            <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                              <div className="bg-white/50 rounded p-2">
                                <p className="opacity-75">Cumulative</p>
                                <p className="font-bold">{calc.cumulative}</p>
                              </div>
                              <div className="bg-white/50 rounded p-2">
                                <p className="opacity-75">Timing</p>
                                <p className="font-bold">{calc.timing}</p>
                              </div>
                              <div className="bg-white/50 rounded p-2">
                                <p className="opacity-75">Job/Breaks</p>
                                <p className="font-bold">{calc.jobBreaks}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
