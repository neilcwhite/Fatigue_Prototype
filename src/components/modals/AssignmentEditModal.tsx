'use client';

import { useState } from 'react';
import { X, Clock, User, Calendar, FileText } from '@/components/ui/Icons';
import type { AssignmentCamel, ShiftPatternCamel, EmployeeCamel } from '@/lib/types';

interface AssignmentEditModalProps {
  assignment: AssignmentCamel;
  employee: EmployeeCamel;
  shiftPattern: ShiftPatternCamel;
  allShiftPatterns: ShiftPatternCamel[];
  onClose: () => void;
  onSave: (id: number, data: Partial<AssignmentCamel>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function AssignmentEditModal({
  assignment,
  employee,
  shiftPattern,
  allShiftPatterns,
  onClose,
  onSave,
  onDelete,
}: AssignmentEditModalProps) {
  const [customStartTime, setCustomStartTime] = useState(assignment.customStartTime || '');
  const [customEndTime, setCustomEndTime] = useState(assignment.customEndTime || '');
  const [notes, setNotes] = useState(assignment.notes || '');
  const [selectedPatternId, setSelectedPatternId] = useState(assignment.shiftPatternId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPattern = allShiftPatterns.find(p => p.id === selectedPatternId) || shiftPattern;

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      await onSave(assignment.id, {
        shiftPatternId: selectedPatternId,
        customStartTime: customStartTime || undefined,
        customEndTime: customEndTime || undefined,
        notes: notes || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Remove ${employee.name} from this shift on ${formatDate(assignment.date)}?`)) {
      return;
    }

    setSaving(true);
    try {
      await onDelete(assignment.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete assignment');
      setSaving(false);
    }
  };

  // Clear custom times if they match the pattern defaults
  const handleClearCustomTimes = () => {
    setCustomStartTime('');
    setCustomEndTime('');
  };

  // Get effective times for display
  const effectiveStartTime = customStartTime || selectedPattern.startTime || '--:--';
  const effectiveEndTime = customEndTime || selectedPattern.endTime || '--:--';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-800">Edit Assignment</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Employee info (read-only) */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
            <User className="w-5 h-5 text-blue-600" />
            <div>
              <div className="font-medium text-slate-800">{employee.name}</div>
              {employee.role && (
                <div className="text-sm text-slate-500">{employee.role}</div>
              )}
            </div>
          </div>

          {/* Date (read-only) */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Calendar className="w-5 h-5 text-slate-500" />
            <div className="text-slate-700">{formatDate(assignment.date)}</div>
          </div>

          {/* Shift Pattern selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Shift Pattern
            </label>
            <select
              value={selectedPatternId}
              onChange={(e) => setSelectedPatternId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {allShiftPatterns.map(pattern => (
                <option key={pattern.id} value={pattern.id}>
                  {pattern.name} ({pattern.startTime || '??'} - {pattern.endTime || '??'})
                </option>
              ))}
            </select>
          </div>

          {/* Custom times */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Custom Times (Override)
              </label>
              {(customStartTime || customEndTime) && (
                <button
                  onClick={handleClearCustomTimes}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Clear overrides
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Start</label>
                <input
                  type="time"
                  value={customStartTime}
                  onChange={(e) => setCustomStartTime(e.target.value)}
                  placeholder={selectedPattern.startTime || ''}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">End</label>
                <input
                  type="time"
                  value={customEndTime}
                  onChange={(e) => setCustomEndTime(e.target.value)}
                  placeholder={selectedPattern.endTime || ''}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Effective: {effectiveStartTime} - {effectiveEndTime}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              <div className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                Notes
              </div>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add notes for this assignment..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Error display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <button
            onClick={handleDelete}
            disabled={saving}
            className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-50"
          >
            Delete
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
