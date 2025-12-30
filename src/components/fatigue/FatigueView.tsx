'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, Plus, Trash2, Settings } from '@/components/ui/Icons';

interface Shift {
  id: number;
  day: number;
  startTime: string;
  endTime: string;
}

interface FatigueViewProps {
  user: any;
  onSignOut: () => void;
  onBack: () => void;
}

// Simple fatigue calculation (simplified from HSE RR446)
function calculateSimpleFatigue(shift: Shift, allShifts: Shift[]) {
  // Parse times
  const startHour = parseInt(shift.startTime.split(':')[0]) + parseInt(shift.startTime.split(':')[1]) / 60;
  let endHour = parseInt(shift.endTime.split(':')[0]) + parseInt(shift.endTime.split(':')[1]) / 60;
  if (endHour <= startHour) endHour += 24;
  
  const dutyLength = endHour - startHour;
  
  // Simplified risk calculation
  let risk = 1.0;
  
  // Long shift penalty
  if (dutyLength > 8) risk += (dutyLength - 8) * 0.03;
  if (dutyLength > 10) risk += (dutyLength - 10) * 0.05;
  if (dutyLength > 12) risk += (dutyLength - 12) * 0.1;
  
  // Night shift penalty
  if (startHour >= 18 || startHour < 6) risk += 0.15;
  
  // Early start penalty
  if (startHour < 6) risk += 0.1;
  
  // Cumulative penalty (consecutive shifts)
  const sortedShifts = [...allShifts].sort((a, b) => a.day - b.day);
  const dayIndex = sortedShifts.findIndex(s => s.id === shift.id);
  if (dayIndex > 0) {
    risk += dayIndex * 0.02;
  }
  
  return {
    riskIndex: Math.round(risk * 100) / 100,
    dutyLength: Math.round(dutyLength * 10) / 10,
  };
}

function getRiskLevel(riskIndex: number): 'low' | 'moderate' | 'elevated' | 'critical' {
  if (riskIndex < 1.0) return 'low';
  if (riskIndex < 1.1) return 'moderate';
  if (riskIndex < 1.2) return 'elevated';
  return 'critical';
}

const TEMPLATES = {
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
};

export function FatigueView({
  user,
  onSignOut,
  onBack,
}: FatigueViewProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [showDefaults, setShowDefaults] = useState(false);

  // Calculate results for all shifts
  const results = useMemo(() => {
    if (shifts.length === 0) return null;

    const sortedShifts = [...shifts].sort((a, b) => a.day - b.day);
    
    const calculations = sortedShifts.map((shift) => {
      const calc = calculateSimpleFatigue(shift, sortedShifts);
      return {
        ...shift,
        ...calc,
        riskLevel: getRiskLevel(calc.riskIndex),
      };
    });

    const riskIndices = calculations.map(c => c.riskIndex);
    const avgRisk = riskIndices.reduce((a, b) => a + b, 0) / riskIndices.length;
    const maxRisk = Math.max(...riskIndices);
    const totalHours = calculations.reduce((a, c) => a + c.dutyLength, 0);

    return {
      calculations,
      summary: {
        avgRisk: Math.round(avgRisk * 100) / 100,
        maxRisk: Math.round(maxRisk * 100) / 100,
        dutyCount: calculations.length,
        totalHours: Math.round(totalHours * 10) / 10,
        highRiskCount: calculations.filter(c => c.riskIndex >= 1.1).length,
      },
    };
  }, [shifts]);

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

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800 border-green-300';
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'elevated': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
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
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">📋 Shift Pattern Definition</h3>
              <button
                onClick={() => setShowDefaults(!showDefaults)}
                className="text-sm px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1"
              >
                <Settings className="w-4 h-4" />
                Settings
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
                      className="text-xs px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded text-left"
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
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {shifts.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">
                    Add shifts or load a template to calculate fatigue risk
                  </p>
                ) : (
                  shifts.map(shift => (
                    <div key={shift.id} className="border rounded-lg p-3 bg-slate-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-sm text-slate-900">Day {shift.day}</span>
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

          {/* Right Panel - Results */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">📊 Fatigue Risk Analysis</h3>
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
                    <div className={`p-4 rounded-lg border ${getRiskColor(getRiskLevel(results.summary.avgRisk))}`}>
                      <p className="text-xs font-medium opacity-75">Average Risk Index</p>
                      <p className="text-2xl font-bold">{results.summary.avgRisk}</p>
                    </div>
                    <div className={`p-4 rounded-lg border ${getRiskColor(getRiskLevel(results.summary.maxRisk))}`}>
                      <p className="text-xs font-medium opacity-75">Peak Risk Index</p>
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
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {results.calculations.map((calc) => (
                      <div 
                        key={calc.id}
                        className={`p-3 rounded-lg border ${getRiskColor(calc.riskLevel)}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">Day {calc.day}</span>
                            <span className="text-sm ml-2 opacity-75">
                              {calc.startTime} - {calc.endTime}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold">{calc.riskIndex}</span>
                            <span className="text-xs ml-1 opacity-75">FRI</span>
                          </div>
                        </div>
                        <div className="text-xs mt-1 opacity-75">
                          Duration: {calc.dutyLength}h
                        </div>
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
