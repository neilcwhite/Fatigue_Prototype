'use client';

import React, { useState, useMemo } from 'react';
import { ShiftDefinition } from '@/lib/types';
import { calculateFatigueIndex } from '@/lib/fatigue-calculator';

const DEFAULT_SHIFTS: ShiftDefinition[] = [
  { day: 1, startTime: '07:00', endTime: '19:00' },
  { day: 2, startTime: '07:00', endTime: '19:00' },
  { day: 3, startTime: '07:00', endTime: '19:00' },
  { day: 4, startTime: '07:00', endTime: '19:00' },
  { day: 5, startTime: '07:00', endTime: '12:00' },
];

export function FatigueCalculator() {
  const [shifts, setShifts] = useState<ShiftDefinition[]>(DEFAULT_SHIFTS);

  const results = useMemo(() => {
    const validShifts = shifts.filter(s => s.startTime && s.endTime);
    if (validShifts.length === 0) return [];
    return calculateFatigueIndex(validShifts);
  }, [shifts]);

  function updateShift(index: number, field: keyof ShiftDefinition, value: string | number) {
    setShifts(prev => prev.map((shift, i) => i === index ? { ...shift, [field]: value } : shift));
  }

  function addShift() {
    const lastDay = shifts.length > 0 ? shifts[shifts.length - 1].day : 0;
    setShifts(prev => [...prev, { day: lastDay + 1, startTime: '07:00', endTime: '19:00' }]);
  }

  function removeShift(index: number) {
    setShifts(prev => prev.filter((_, i) => i !== index));
  }

  function loadTemplate(template: string) {
    if (template === '5-day') setShifts([{ day: 1, startTime: '07:00', endTime: '19:00' }, { day: 2, startTime: '07:00', endTime: '19:00' }, { day: 3, startTime: '07:00', endTime: '19:00' }, { day: 4, startTime: '07:00', endTime: '19:00' }, { day: 5, startTime: '07:00', endTime: '12:00' }]);
    if (template === '4-night') setShifts([{ day: 1, startTime: '19:00', endTime: '07:00' }, { day: 2, startTime: '19:00', endTime: '07:00' }, { day: 3, startTime: '19:00', endTime: '07:00' }, { day: 4, startTime: '19:00', endTime: '07:00' }]);
    if (template === '7-day') setShifts([{ day: 1, startTime: '08:00', endTime: '18:00' }, { day: 2, startTime: '08:00', endTime: '18:00' }, { day: 3, startTime: '08:00', endTime: '18:00' }, { day: 4, startTime: '08:00', endTime: '18:00' }, { day: 5, startTime: '08:00', endTime: '18:00' }, { day: 6, startTime: '08:00', endTime: '14:00' }, { day: 7, startTime: '08:00', endTime: '14:00' }]);
  }

  return (
    <div className="space-y-6">
      <div className="card card-body bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">HSE Fatigue Index Calculator</h3>
        <p className="text-sm text-blue-800">Based on HSE Research Report RR446. Enter your shift pattern to calculate the cumulative fatigue risk index.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-gray-600 py-1">Load template:</span>
        <button onClick={() => loadTemplate('5-day')} className="btn btn-secondary btn-sm">5-Day Pattern</button>
        <button onClick={() => loadTemplate('4-night')} className="btn btn-secondary btn-sm">4-Night Pattern</button>
        <button onClick={() => loadTemplate('7-day')} className="btn btn-secondary btn-sm">7-Day Pattern</button>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="font-semibold">Shift Pattern</h3></div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead><tr className="bg-gray-50"><th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Day</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Start</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500">End</th><th></th></tr></thead>
            <tbody>
              {shifts.map((shift, index) => (
                <tr key={index} className="border-t">
                  <td className="px-4 py-2"><input type="number" min="1" value={shift.day} onChange={e => updateShift(index, 'day', parseInt(e.target.value) || 1)} className="form-input w-16" /></td>
                  <td className="px-4 py-2"><input type="time" value={shift.startTime} onChange={e => updateShift(index, 'startTime', e.target.value)} className="form-input w-28" /></td>
                  <td className="px-4 py-2"><input type="time" value={shift.endTime} onChange={e => updateShift(index, 'endTime', e.target.value)} className="form-input w-28" /></td>
                  <td className="px-4 py-2"><button onClick={() => removeShift(index)} className="text-red-500 hover:text-red-700">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t"><button onClick={addShift} className="btn btn-secondary btn-sm">+ Add Day</button></div>
      </div>

      {results.length > 0 && (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Fatigue Index Results</h3></div>
          <div className="p-4 border-b">
            <div className="flex items-end gap-2 h-40">
              {results.map((result, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full rounded-t" style={{ height: `${Math.min(100, (result.riskIndex / 1.5) * 100)}%`, backgroundColor: result.riskLevel.color }} />
                  <span className="text-xs mt-1">D{result.day}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead><tr className="bg-gray-50"><th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Day</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Cumulative</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Timing</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Job/Breaks</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Risk Index</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Level</th></tr></thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-4 py-2 font-medium">Day {result.day}</td>
                    <td className="px-4 py-2">{result.cumulative.toFixed(3)}</td>
                    <td className="px-4 py-2">{result.timing.toFixed(3)}</td>
                    <td className="px-4 py-2">{result.jobBreaks.toFixed(3)}</td>
                    <td className="px-4 py-2 font-semibold">{result.riskIndex.toFixed(3)}</td>
                    <td className="px-4 py-2"><span className={`risk-badge risk-badge-${result.riskLevel.level}`}>{result.riskLevel.label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card card-body">
        <h4 className="font-semibold mb-3">Risk Level Guide</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2"><span className="risk-badge risk-badge-low">Low Risk</span><span className="text-sm text-gray-600">&lt; 1.0</span></div>
          <div className="flex items-center gap-2"><span className="risk-badge risk-badge-moderate">Moderate</span><span className="text-sm text-gray-600">1.0 - 1.1</span></div>
          <div className="flex items-center gap-2"><span className="risk-badge risk-badge-elevated">Elevated</span><span className="text-sm text-gray-600">1.1 - 1.2</span></div>
          <div className="flex items-center gap-2"><span className="risk-badge risk-badge-critical">High Risk</span><span className="text-sm text-gray-600">&gt; 1.2</span></div>
        </div>
      </div>
    </div>
  );
}
