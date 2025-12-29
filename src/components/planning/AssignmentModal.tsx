'use client';

import React from 'react';
import { Assignment, ShiftPattern } from '@/lib/types';

interface AssignmentModalProps {
  assignment: Assignment;
  pattern?: ShiftPattern;
  onClose: () => void;
  onDelete: () => void;
}

export function AssignmentModal({ assignment, pattern, onClose, onDelete }: AssignmentModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="text-lg font-semibold">Assignment Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="form-label">Date</label>
            <p className="text-gray-900">{new Date(assignment.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div>
            <label className="form-label">Shift Pattern</label>
            <p className="text-gray-900">{pattern?.name || 'Unknown'}</p>
          </div>
          {pattern && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Start Time</label>
                  <p className="text-gray-900">{assignment.custom_start_time || pattern.start_time || '-'}</p>
                </div>
                <div>
                  <label className="form-label">End Time</label>
                  <p className="text-gray-900">{assignment.custom_end_time || pattern.end_time || '-'}</p>
                </div>
              </div>
              <div>
                <label className="form-label">Duty Type</label>
                <p className="text-gray-900">{pattern.duty_type || '-'}</p>
              </div>
              {pattern.is_night && <div className="bg-purple-50 text-purple-700 px-3 py-2 rounded text-sm">Night shift</div>}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onDelete} className="btn btn-danger">Delete Assignment</button>
          <button onClick={onClose} className="btn btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
}
