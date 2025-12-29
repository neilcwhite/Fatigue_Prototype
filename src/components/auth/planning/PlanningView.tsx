'use client';

import React, { useState, useEffect } from 'react';
import { Project, Employee, Team, ShiftPattern, Assignment } from '@/lib/types';
import { getShiftPatterns, getAssignments, createAssignment, deleteAssignment, createShiftPattern } from '@/lib/data-service';
import { checkProjectCompliance } from '@/lib/compliance';
import { getCurrentPeriod, getPeriodDateArray, formatDateISO, formatDateShort, isWeekStart, getPeriodsForFinancialYear, getPeriodDates } from '@/lib/network-rail-periods';
import { useAuth } from '@/components/auth/AuthProvider';
import { ShiftPatternModal } from './ShiftPatternModal';
import { AssignmentModal } from './AssignmentModal';

interface PlanningViewProps {
  project: Project;
  employees: Employee[];
  teams: Team[];
  onBack: () => void;
}

export function PlanningView({ project, employees, teams, onBack }: PlanningViewProps) {
  const { profile } = useAuth();
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Period selection
  const currentPeriod = getCurrentPeriod();
  const [selectedYear, setSelectedYear] = useState(currentPeriod.year);
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod.period);
  
  // Selection state
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
  
  // Modals
  const [showPatternModal, setShowPatternModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  // Get dates for current period
  const periodDates = getPeriodDateArray(selectedYear, selectedPeriod);
  const periods = getPeriodsForFinancialYear(selectedYear);

  useEffect(() => {
    loadData();
  }, [project.id]);

  async function loadData() {
    try {
      setLoading(true);
      const [patternsData, assignmentsData] = await Promise.all([
        getShiftPatterns(project.id),
        getAssignments(project.id),
      ]);
      setPatterns(patternsData);
      setAssignments(assignmentsData);
    } catch (err) {
      console.error('Failed to load planning data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Get assignment for a specific employee and date
  function getAssignment(employeeId: number, date: string): Assignment | undefined {
    return assignments.find(a => a.employee_id === employeeId && a.date === date);
  }

  // Get pattern for an assignment
  function getPattern(patternId: string): ShiftPattern | undefined {
    return patterns.find(p => p.id === patternId);
  }

  // Check if cell has violation
  function hasViolation(employeeId: number, date: string): boolean {
    const employeeAssignments = assignments.filter(a => a.employee_id === employeeId);
    const compliance = checkProjectCompliance(employeeAssignments, patterns);
    return compliance.errors.some(e => e.date === date && e.employeeId === employeeId);
  }

  // Handle cell click
  function handleCellClick(employeeId: number, date: string, e: React.MouseEvent) {
    const cellKey = `${employeeId}-${date}`;
    const assignment = getAssignment(employeeId, date);

    if (e.shiftKey) {
      // Multi-select
      setSelectedCells(prev => {
        const next = new Set(prev);
        if (next.has(cellKey)) {
          next.delete(cellKey);
        } else {
          next.add(cellKey);
        }
        return next;
      });
    } else if (assignment) {
      // Edit existing assignment
      setEditingAssignment(assignment);
      setShowAssignmentModal(true);
    } else if (selectedPattern) {
      // Create new assignment
      handleCreateAssignment(employeeId, date);
    } else {
      // Toggle selection
      setSelectedCells(prev => {
        const next = new Set<string>();
        if (!prev.has(cellKey)) {
          next.add(cellKey);
        }
        return next;
      });
    }
  }

  // Create assignment
  async function handleCreateAssignment(employeeId: number, date: string) {
    if (!selectedPattern || !profile) return;

    try {
      await createAssignment({
        organisation_id: profile.organisation_id,
        employee_id: employeeId,
        project_id: project.id,
        shift_pattern_id: selectedPattern,
        date,
        custom_start_time: null,
        custom_end_time: null,
      });
      await loadData();
      setSelectedCells(new Set());
    } catch (err) {
      console.error('Failed to create assignment:', err);
    }
  }

  // Bulk assign to selected cells
  async function handleBulkAssign() {
    if (!selectedPattern || selectedCells.size === 0 || !profile) return;

    try {
      for (const cellKey of selectedCells) {
        const [employeeId, date] = cellKey.split('-');
        const existing = getAssignment(parseInt(employeeId), date);
        if (!existing) {
          await createAssignment({
            organisation_id: profile.organisation_id,
            employee_id: parseInt(employeeId),
            project_id: project.id,
            shift_pattern_id: selectedPattern,
            date,
            custom_start_time: null,
            custom_end_time: null,
          });
        }
      }
      await loadData();
      setSelectedCells(new Set());
    } catch (err) {
      console.error('Failed to bulk assign:', err);
    }
  }

  // Delete assignment
  async function handleDeleteAssignment(assignmentId: number) {
    try {
      await deleteAssignment(assignmentId);
      await loadData();
      setShowAssignmentModal(false);
      setEditingAssignment(null);
    } catch (err) {
      console.error('Failed to delete assignment:', err);
    }
  }

  // Handle pattern created
  async function handlePatternCreated() {
    setShowPatternModal(false);
    await loadData();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-lg font-semibold">{project.name}</h1>
              <p className="text-sm text-gray-500">{project.location}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Period selector */}
            <select
              value={`${selectedYear}-${selectedPeriod}`}
              onChange={e => {
                const [year, period] = e.target.value.split('-').map(Number);
                setSelectedYear(year);
                setSelectedPeriod(period);
              }}
              className="form-input text-sm"
            >
              {periods.map(p => (
                <option key={`${p.year}-${p.period}`} value={`${p.year}-${p.period}`}>
                  {p.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowPatternModal(true)}
              className="btn btn-secondary btn-sm"
            >
              + Shift Pattern
            </button>
          </div>
        </div>

        {/* Pattern selector and actions */}
        <div className="px-4 py-2 bg-gray-50 border-t flex items-center gap-4">
          <span className="text-sm text-gray-600">Assign:</span>
          <select
            value={selectedPattern || ''}
            onChange={e => setSelectedPattern(e.target.value || null)}
            className="form-input text-sm w-48"
          >
            <option value="">Select pattern...</option>
            {patterns.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {selectedCells.size > 0 && selectedPattern && (
            <button onClick={handleBulkAssign} className="btn btn-primary btn-sm">
              Assign to {selectedCells.size} cells
            </button>
          )}

          {selectedCells.size > 0 && (
            <button
              onClick={() => setSelectedCells(new Set())}
              className="btn btn-secondary btn-sm"
            >
              Clear selection
            </button>
          )}
        </div>
      </header>

      {/* Timeline Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 bg-gray-50 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                  Employee
                </th>
                {periodDates.map(date => (
                  <th
                    key={formatDateISO(date)}
                    className={`px-2 py-2 text-center text-xs font-medium text-gray-500 min-w-[80px] ${
                      isWeekStart(date) ? 'border-l-2 border-gray-300' : ''
                    }`}
                  >
                    <div>{formatDateShort(date)}</div>
                    <div className="text-gray-400">{date.getDate()}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employees.map(employee => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="sticky left-0 bg-white px-4 py-2 whitespace-nowrap">
                    <div className="font-medium text-sm">{employee.name}</div>
                    {employee.role && (
                      <div className="text-xs text-gray-500">{employee.role}</div>
                    )}
                  </td>
                  {periodDates.map(date => {
                    const dateStr = formatDateISO(date);
                    const assignment = getAssignment(employee.id, dateStr);
                    const pattern = assignment ? getPattern(assignment.shift_pattern_id) : null;
                    const cellKey = `${employee.id}-${dateStr}`;
                    const isSelected = selectedCells.has(cellKey);
                    const violation = assignment && hasViolation(employee.id, dateStr);

                    return (
                      <td
                        key={dateStr}
                        onClick={e => handleCellClick(employee.id, dateStr, e)}
                        className={`px-1 py-1 text-center cursor-pointer ${
                          isWeekStart(date) ? 'border-l-2 border-gray-300' : ''
                        } ${isSelected ? 'bg-blue-50' : ''}`}
                      >
                        {assignment && pattern ? (
                          <div
                            className={`shift-tile ${
                              pattern.is_night ? 'shift-tile-night' : 'shift-tile-day'
                            } ${violation ? 'shift-tile-violation' : ''}`}
                          >
                            <div className="truncate">{pattern.name}</div>
                            {pattern.start_time && pattern.end_time && (
                              <div className="text-xs opacity-75">
                                {pattern.start_time}-{pattern.end_time}
                              </div>
                            )}
                          </div>
                        ) : isSelected ? (
                          <div className="w-full h-8 rounded bg-blue-100 border-2 border-blue-300 border-dashed" />
                        ) : (
                          <div className="w-full h-8" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showPatternModal && (
        <ShiftPatternModal
          projectId={project.id}
          organisationId={profile!.organisation_id}
          onClose={() => setShowPatternModal(false)}
          onSaved={handlePatternCreated}
        />
      )}

      {showAssignmentModal && editingAssignment && (
        <AssignmentModal
          assignment={editingAssignment}
          pattern={getPattern(editingAssignment.shift_pattern_id)}
          onClose={() => {
            setShowAssignmentModal(false);
            setEditingAssignment(null);
          }}
          onDelete={() => handleDeleteAssignment(editingAssignment.id)}
        />
      )}
    </div>
  );
}
