'use client';

import { useState } from 'react';
import { X } from '@/components/ui/Icons';

interface CustomTimeModalProps {
  employeeNames: string[];
  date: string;
  patternName: string;
  onClose: () => void;
  onConfirm: (startTime: string, endTime: string) => void;
}

export function CustomTimeModal({ employeeNames, date, patternName, onClose, onConfirm }: CustomTimeModalProps) {
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Custom Shift Time</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                <strong>{formattedDate}</strong> is not part of the <strong>{patternName}</strong> schedule.
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Enter custom times to create an ad-hoc assignment for {employeeNames.length > 1 ? `${employeeNames.length} employees` : employeeNames[0]}.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-200">
                {error}
              </div>
            )}

            <div>
              <p className="text-sm text-slate-600 mb-2">
                Assigning: <strong>{employeeNames.join(', ')}</strong>
              </p>
            </div>

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
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 bg-white"
                />
              </div>
            </div>

            <div className="text-xs text-slate-500">
              This will create a custom assignment. The employee(s) will be shown on this shift pattern row for this date only.
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
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
              Add Assignment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
