'use client';

import React, { useState, useMemo } from 'react';
import { ShiftDefinition, FatigueResult } from '@/lib/types';
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
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calculate results whenever shifts change
  const results = useMemo(() => {
    const validShifts = shifts.filter(s => s.startTime && s.endTime);
    if (validShifts.length === 0) return [];
    return calculateFatigueIndex(validShifts);
  }, [shifts]);

  function updateShift(index: number, field: keyof ShiftDefinition, value: string | number) {
    setShifts(prev => prev.map((shift, i) => 
      i === index ? { ...shift, [field]: value } : shift
    ));
  }

  function addShift() {
    const lastDay = shifts.length > 0 ? shifts[shifts.length - 1].day : 0;
    setShifts(prev => [...prev, { 
      day: lastDay + 1, 
      startTime: '07:00', 
      endTime: '19:00' 
    }]);
  }

  function removeShift(index: number) {
    setShifts(prev => prev.filter((_, i) => i !== index));
  }

  function loadTemplate(template: string) {
    switch (template) {
      case '5-day':
        setShifts([
          { day: 1, startTime: '07:00', endTime: '19:00' },
          { day: 2, startTime: '07:00', endTime: '19:00' },
          { day: 3, startTime: '07:00', endTime: '19:00' },
          { day: 4, startTime: '07:00', endTime: '19:00' },
          { day: 5, startTime: '07:00', endTime: '12:00' },
        ]);
        break;
      case '4-night':
        setShifts([
          { day: 1, startTime: '19:00', endTime: '07:00' },
          { day: 2, startTime: '19:00', endTime: '07:00' },
          { day: 3, startTime: '19:00', endTime: '07:00' },
          { day: 4, startTime: '19:00', endTime: '07:00' },
        ]);
        break;
      case '7-day':
        setShifts([
          { day: 1, startTime: '08:00', endTime: '18:00' },
          { day: 2, startTime: '08:00', endTime: '18:00' },
          { day: 3, startTime: '08:00', endTime: '18:00' },
          { day: 4, startTime: '08:00', endTime: '18:00' },
          { day: 5, startTime: '08:00', endTime: '18:00' },
          { day: 6, startTime: '08:00', endTime: '14:00' },
          { day: 7, startTime: '08:00', endTime: '14:00' },
        ]);
        break;
    }
  }

  return (
    <div className="space-y-6">
      {/* Info Box */}
      <div className="card card-body bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">HSE Fatigue Index Calculator</h3>
        <p className="text-sm text-blue-800">
          Based on HSE Research Report RR446. Enter your shift pattern to calculate the 
          cumulative fatigue risk index for each day.
        </p>
      </div>

      {/* Templates */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-gray-600 py-1">Load template:</span>
        <button onClick={() => loadTemplate('5-day')} className="btn btn-secondary btn-sm">
          5-Day Pattern
        </button>
        <button onClick={() => loadTemplate('4-night')} className="btn btn-secondary btn-sm">
          4-Night Pattern
        </button>
        <button onClick={() => loadTemplate('7-day')} className="btn btn-secondary btn-sm">
          7-Day Pattern
        </button>
      </div>

      {/* Shift Input Table */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold">Shift Pattern</h3>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Options
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Start</th>
                <th>End</th>
                {showAdvanced && (
                  <>
                    <th>Commute (min)</th>
                    <th>Workload (1-5)</th>
                    <th>Attention (1-5)</th>
                  </>
                )}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift, index) => (
                <tr key={index}>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={shift.day}
                      onChange={e => updateShift(index, 'day', parseInt(e.target.value) || 1)}
                      className="form-input w-16"
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      value={shift.startTime}
                      onChange={e => updateShift(index, 'startTime', e.target.value)}
                      className="form-input w-28"
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      value={shift.endTime}
                      onChange={e => updateShift(index, 'endTime', e.target.value)}
                      className="form-input w-28"
                    />
                  </td>
                  {showAdvanced && (
                    <>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max="180"
                          value={shift.commuteIn || 60}
                          onChange={e => updateShift(index, 'commuteIn', parseInt(e.target.value) || 60)}
                          className="form-input w-20"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={shift.workload || 2}
                          onChange={e => updateShift(index, 'workload', parseInt(e.target.value) || 2)}
                          className="form-input w-16"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={shift.attention || 1}
                          onChange={e => updateShift(index, 'attention', parseInt(e.target.value) || 1)}
                          className="form-input w-16"
                        />
                      </td>
                    </>
                  )}
                  <td>
                    <button
                      onClick={() => removeShift(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t">
          <button onClick={addShift} className="btn btn-secondary btn-sm">
            + Add Day
          </button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold">Fatigue Index Results</h3>
          </div>
          
          {/* Visual Chart */}
          <div className="p-4 border-b">
            <div className="flex items-end gap-2 h-40">
              {results.map((result, index) => {
                const height = Math.min(100, (result.riskIndex / 1.5) * 100);
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full rounded-t transition-all"
                      style={{
                        height: `${height}%`,
                        backgroundColor: result.riskLevel.color,
                      }}
                    />
                    <span className="text-xs mt-1">D{result.day}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>0.0</span>
              <span>Risk Index</span>
              <span>1.5</span>
            </div>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Cumulative</th>
                  <th>Timing</th>
                  <th>Job/Breaks</th>
                  <th>Risk Index</th>
                  <th>Risk Level</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index}>
                    <td className="font-medium">Day {result.day}</td>
                    <td>{result.cumulative.toFixed(3)}</td>
                    <td>{result.timing.toFixed(3)}</td>
                    <td>{result.jobBreaks.toFixed(3)}</td>
                    <td className="font-semibold">{result.riskIndex.toFixed(3)}</td>
                    <td>
                      <span
                        className={`risk-badge risk-badge-${result.riskLevel.level}`}
                      >
                        {result.riskLevel.label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="card card-body">
        <h4 className="font-semibold mb-3">Risk Level Guide</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <span className="risk-badge risk-badge-low">Low Risk</span>
            <span className="text-sm text-gray-600">&lt; 1.0</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="risk-badge risk-badge-moderate">Moderate</span>
            <span className="text-sm text-gray-600">1.0 - 1.1</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="risk-badge risk-badge-elevated">Elevated</span>
            <span className="text-sm text-gray-600">1.1 - 1.2</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="risk-badge risk-badge-critical">High Risk</span>
            <span className="text-sm text-gray-600">&gt; 1.2</span>
          </div>
        </div>
      </div>
    </div>
  );
}
