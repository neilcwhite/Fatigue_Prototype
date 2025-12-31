'use client';

import { useState } from 'react';
import { X, AlertTriangle, Clock, Users } from '@/components/ui/Icons';

interface CustomTimeModalProps {
  employeeNames: string[];
  date: string;
  patternName: string;
  onClose: () => void;
  onConfirm: (startTime: string, endTime: string) => void;
}

type ModalStep = 'confirm' | 'times';

export function CustomTimeModal({ employeeNames, date, patternName, onClose, onConfirm }: CustomTimeModalProps) {
  const [step, setStep] = useState<ModalStep>('confirm');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('19:00');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!startTime || !endTime) {
      setError('Please enter both start and end times');
      return;
    }

    onConfirm(startTime, endTime);
  };

  const formattedDate = new Date(date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const dayOfWeek = new Date(date).toLocaleDateString('en-GB', { weekday: 'long' });
  const employeeText = employeeNames.length > 1
    ? `these ${employeeNames.length} employees`
    : employeeNames[0];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-bold text-slate-900">
              {step === 'confirm' ? 'Day Not in Shift Pattern' : 'Set Custom Work Times'}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Confirmation */}
        {step === 'confirm' && (
          <div>
            <div className="p-4 space-y-4">
              {/* Warning Box */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800 mb-1">
                      {dayOfWeek} is not a scheduled work day
                    </p>
                    <p className="text-sm text-amber-700">
                      <strong>{formattedDate}</strong> is not part of the <strong>{patternName}</strong> shift pattern.
                    </p>
                  </div>
                </div>
              </div>

              {/* Employee Info */}
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <Users className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-600">You're trying to assign:</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {employeeNames.join(', ')}
                  </p>
                </div>
              </div>

              {/* Question */}
              <div className="text-center py-2">
                <p className="text-base font-medium text-slate-800">
                  Do you need {employeeText} to work on this day?
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  This will create a custom shift shown on the "Custom" roster row.
                </p>
              </div>
            </div>

            {/* Confirmation Buttons */}
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 font-medium"
              >
                No, Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep('times')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                Yes, Add Custom Shift
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Time Entry */}
        {step === 'times' && (
          <form onSubmit={handleSubmit}>
            <div className="p-4 space-y-4">
              {/* Info Header */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Clock className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">
                      Custom shift for {formattedDate}
                    </p>
                    <p className="text-sm text-blue-700 mt-0.5">
                      Enter the start and finish times for this shift.
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-200">
                  {error}
                </div>
              )}

              {/* Employee List */}
              <div>
                <p className="text-sm text-slate-600 mb-1">
                  Assigning: <strong>{employeeNames.join(', ')}</strong>
                </p>
              </div>

              {/* Time Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 bg-white"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Finish Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 bg-white"
                  />
                </div>
              </div>

              {/* Info Note */}
              <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
                This assignment will appear on a <strong>"Custom"</strong> roster row, separate from the regular shift patterns.
              </div>
            </div>

            {/* Form Buttons */}
            <div className="p-4 border-t border-slate-200 flex justify-between bg-slate-50">
              <button
                type="button"
                onClick={() => setStep('confirm')}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
              >
                ← Back
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                >
                  Add to Custom Roster
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
