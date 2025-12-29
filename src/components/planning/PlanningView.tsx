'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Project, Employee, Team, ShiftPattern, Assignment } from '@/lib/types';
import { 
  getShiftPatterns, 
  getAssignments, 
  createAssignment, 
  deleteAssignment, 
  createShiftPattern,
  deleteShiftPattern,
  getEmployees
} from '@/lib/data-service';
import { checkProjectCompliance } from '@/lib/compliance';
import { 
  getCurrentPeriod, 
  getPeriodDateArray, 
  formatDateISO, 
  getPeriodsForFinancialYear,
  getDayName
} from '@/lib/network-rail-periods';
import { useAuth } from '@/components/auth/AuthProvider';
import { ShiftPatternModal } from './ShiftPatternModal';

interface PlanningViewProps {
  project: Project;
  onBack: () => void;
}

// ==================== ICONS ====================
const ChevronLeft = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const Plus = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const Trash2 = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const Search = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const AlertTriangle = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const Download = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const Upload = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

// ==================== NETWORK RAIL YEARS ====================
const NETWORK_RAIL_YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

// ==================== MAIN COMPONENT ====================
export function PlanningView({ project, onBack }: PlanningViewProps) {
  const { profile } = useAuth();
  
  // Data state
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Period selection
  const currentPeriod = getCurrentPeriod();
  const [selectedYear, setSelectedYear] = useState(currentPeriod.year);
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod.period);
  
  // UI state
  const [employeePanelHeight, setEmployeePanelHeight] = useState(220);
  const [isResizing, setIsResizing] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [draggedEmployee, setDraggedEmployee] = useState<Employee | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  
  // Modal state
  const [showPatternModal, setShowPatternModal] = useState(false);
  
  // Refs for resizing
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);

  // Generate periods for selected year
  const periods = useMemo(() => getPeriodsForFinancialYear(selectedYear), [selectedYear]);

  // Generate dates for selected period
  const periodDates = useMemo(() => {
    return getPeriodDateArray(selectedYear, selectedPeriod);
  }, [selectedYear, selectedPeriod]);

  // ==================== DATA LOADING ====================
  useEffect(() => {
    loadData();
  }, [project.id]);

  async function loadData() {
    try {
      setLoading(true);
      const [patternsData, assignmentsData, employeesData] = await Promise.all([
        getShiftPatterns(project.id),
        getAssignments(project.id),
        getEmployees()
      ]);
      setPatterns(patternsData);
      setAssignments(assignmentsData);
      setEmployees(employeesData);
    } catch (err) {
      console.error('Failed to load planning data:', err);
    } finally {
      setLoading(false);
    }
  }

  // ==================== FILTERED EMPLOYEES ====================
  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return employees;
    const search = employeeSearch.toLowerCase();
    return employees.filter(e => 
      e.name.toLowerCase().includes(search) || 
      (e.role && e.role.toLowerCase().includes(search))
    );
  }, [employees, employeeSearch]);

  // ==================== CELL HELPERS ====================
  const getCellAssignments = useCallback((patternId: string, date: string): Assignment[] => {
    return assignments.filter(a => a.shift_pattern_id === patternId && a.date === date);
  }, [assignments]);

  const getEmployeeById = useCallback((employeeId: number): Employee | undefined => {
    return employees.find(e => e.id === employeeId);
  }, [employees]);

  const hasEmployeeViolation = useCallback((employeeId: number): boolean => {
    const violations = checkProjectCompliance(
      assignments.filter(a => a.employee_id === employeeId),
      patterns
    );
    return violations.errors.length > 0;
  }, [assignments, patterns]);

  const getAssignmentViolation = useCallback((employeeId: number, date: string): boolean => {
    const empAssignments = assignments.filter(a => a.employee_id === employeeId);
    const violations = checkProjectCompliance(empAssignments, patterns);
    return violations.errors.some(v => v.date === date && v.employeeId === employeeId);
  }, [assignments, patterns]);

  // ==================== DRAG AND DROP ====================
  const handleDragStart = (e: React.DragEvent, employee: Employee) => {
    setDraggedEmployee(employee);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', employee.id.toString());
  };

  const handleDragEnd = () => {
    setDraggedEmployee(null);
    setDragOverCell(null);
  };

  const handleDragOver = (e: React.DragEvent, cellKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverCell(cellKey);
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = async (e: React.DragEvent, patternId: string, date: string) => {
    e.preventDefault();
    setDragOverCell(null);

    if (!draggedEmployee || !profile) return;

    // Check if already assigned
    const existing = assignments.find(a => 
      a.employee_id === draggedEmployee.id && 
      a.shift_pattern_id === patternId && 
      a.date === date
    );

    if (existing) {
      setDraggedEmployee(null);
      return;
    }

    try {
      await createAssignment({
        organisation_id: profile.organisation_id,
        employee_id: draggedEmployee.id,
        project_id: project.id,
        shift_pattern_id: patternId,
        date: date,
        custom_start_time: null,
        custom_end_time: null
      });
      await loadData();
    } catch (err) {
      console.error('Failed to create assignment:', err);
    }

    setDraggedEmployee(null);
  };

  // ==================== ASSIGNMENT ACTIONS ====================
  const handleRemoveAssignment = async (assignmentId: number) => {
    if (!confirm('Remove this assignment?')) return;
    try {
      await deleteAssignment(assignmentId);
      await loadData();
    } catch (err) {
      console.error('Failed to delete assignment:', err);
    }
  };

  const handleDeletePattern = async (patternId: string) => {
    const inUse = assignments.some(a => a.shift_pattern_id === patternId);
    if (inUse) {
      alert('Cannot delete - pattern has assignments. Remove assignments first.');
      return;
    }
    if (!confirm('Delete this shift pattern?')) return;
    try {
      await deleteShiftPattern(patternId);
      await loadData();
    } catch (err) {
      console.error('Failed to delete pattern:', err);
    }
  };

  // ==================== PANEL RESIZING ====================
  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = employeePanelHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleResizeMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const delta = resizeStartY.current - e.clientY;
      const newHeight = Math.max(100, Math.min(400, resizeStartHeight.current + delta));
      setEmployeePanelHeight(newHeight);
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing]);

  // ==================== PATTERN CREATION ====================
  const handlePatternCreated = async () => {
    setShowPatternModal(false);
    await loadData();
  };

  // ==================== RENDER: LOADING ====================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex items-center gap-3 text-white">
          <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // ==================== RENDER: MAIN ====================
  return (
    <div className="h-screen flex flex-col bg-slate-900 overflow-hidden">
      {/* ==================== HEADER ==================== */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Left: Back button and project info */}
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <div className="border-l border-slate-600 pl-4">
              <h1 className="text-lg font-semibold text-white">{project.name}</h1>
              {project.location && (
                <p className="text-sm text-slate-400">{project.location}</p>
              )}
            </div>
          </div>

          {/* Center: Period selector */}
          <div className="flex items-center gap-3">
            <select
              value={selectedYear}
              onChange={(e) => {
                const year = parseInt(e.target.value);
                setSelectedYear(year);
                setSelectedPeriod(1);
              }}
              className="bg-slate-700 border border-slate-600 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {NETWORK_RAIL_YEARS.map(year => (
                <option key={year} value={year}>{year}/{year + 1}</option>
              ))}
            </select>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
              className="bg-slate-700 border border-slate-600 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
            >
              {periods.map(p => (
                <option key={p.period} value={p.period}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPatternModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              Shift Pattern
            </button>
            <button className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors">
              <Upload className="w-4 h-4" />
              Import
            </button>
          </div>
        </div>
      </header>

      {/* ==================== TIMELINE GRID ==================== */}
      <div className="flex-1 overflow-auto">
        {patterns.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-slate-400 mb-4">No shift patterns defined</div>
              <button
                onClick={() => setShowPatternModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Create First Shift Pattern
              </button>
            </div>
          </div>
        ) : (
          <div className="min-w-max">
            {/* Grid container */}
            <div 
              className="grid"
              style={{ 
                gridTemplateColumns: `200px repeat(${periodDates.length}, 120px)`,
              }}
            >
              {/* ===== HEADER ROW ===== */}
              <div className="sticky left-0 top-0 z-30 bg-slate-800 border-b-2 border-r-2 border-slate-600 px-3 py-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Shift Pattern
                </span>
              </div>
              {periodDates.map((date, idx) => {
                const isWeekStart = date.getDay() === 6; // Saturday
                return (
                  <div 
                    key={formatDateISO(date)}
                    className={`sticky top-0 z-20 bg-slate-800 border-b-2 border-slate-600 px-2 py-2 text-center
                      ${isWeekStart ? 'border-l-2 border-l-slate-500' : 'border-l border-l-slate-700'}`}
                  >
                    <div className="text-xs text-slate-400">{getDayName(date)}</div>
                    <div className="text-sm font-semibold text-white">
                      {date.getDate()}/{(date.getMonth() + 1).toString().padStart(2, '0')}
                    </div>
                  </div>
                );
              })}

              {/* ===== PATTERN ROWS ===== */}
              {patterns.map(pattern => (
                <React.Fragment key={pattern.id}>
                  {/* Row header - pattern info */}
                  <div className="sticky left-0 z-10 bg-slate-800 border-r-2 border-b border-slate-600 px-3 py-2">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-white truncate">{pattern.name}</div>
                        <div className="text-xs text-slate-400">
                          {pattern.start_time} - {pattern.end_time}
                        </div>
                        <div className={`text-xs mt-1 ${pattern.is_night ? 'text-purple-400' : 'text-slate-500'}`}>
                          {pattern.duty_type} {pattern.is_night && '• Night'}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeletePattern(pattern.id)}
                        className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                        title="Delete pattern"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Date cells */}
                  {periodDates.map((date, idx) => {
                    const dateStr = formatDateISO(date);
                    const cellKey = `${pattern.id}-${dateStr}`;
                    const cellAssignments = getCellAssignments(pattern.id, dateStr);
                    const isWeekStart = date.getDay() === 6;
                    const isDragOver = dragOverCell === cellKey;

                    return (
                      <div
                        key={cellKey}
                        className={`border-b border-slate-700 p-1 min-h-[70px] transition-colors
                          ${isWeekStart ? 'border-l-2 border-l-slate-500' : 'border-l border-l-slate-700'}
                          ${isDragOver ? 'bg-blue-900/30 border-2 border-dashed border-blue-500' : 'bg-slate-900/50'}`}
                        onDragOver={(e) => handleDragOver(e, cellKey)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, pattern.id, dateStr)}
                      >
                        <div className="space-y-1">
                          {cellAssignments.map(assignment => {
                            const employee = getEmployeeById(assignment.employee_id);
                            const hasViolation = getAssignmentViolation(assignment.employee_id, dateStr);
                            
                            return (
                              <div
                                key={assignment.id}
                                onClick={() => handleRemoveAssignment(assignment.id)}
                                className={`relative px-2 py-1 rounded text-xs cursor-pointer transition-all hover:opacity-80
                                  ${pattern.is_night 
                                    ? 'bg-purple-900/60 text-purple-200 border border-purple-700' 
                                    : 'bg-blue-900/60 text-blue-200 border border-blue-700'}
                                  ${hasViolation ? 'border-red-500 border-2' : ''}`}
                                title={`${employee?.name || 'Unknown'} - Click to remove`}
                              >
                                <div className="truncate font-medium">
                                  {employee?.name || 'Unknown'}
                                </div>
                                {hasViolation && (
                                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                    <span className="text-white text-[10px] font-bold">!</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ==================== RESIZER ==================== */}
      <div 
        className="h-2 bg-gradient-to-b from-slate-700 to-slate-800 cursor-row-resize flex items-center justify-center flex-shrink-0 hover:from-slate-600 hover:to-slate-700 transition-colors"
        onMouseDown={handleResizeStart}
      >
        <div className="w-12 h-1 bg-slate-500 rounded-full" />
      </div>

      {/* ==================== EMPLOYEE PANEL ==================== */}
      <div 
        className="bg-slate-800 border-t border-slate-700 flex-shrink-0 flex flex-col"
        style={{ height: employeePanelHeight }}
      >
        {/* Panel header */}
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold text-white">Employees</h3>
            <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">
              {filteredEmployees.length} available
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search employees..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="bg-slate-700 border border-slate-600 text-white text-sm rounded-md pl-9 pr-4 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
              />
            </div>
            <span className="text-xs text-slate-400">
              <span className="text-yellow-400">Ctrl+click</span> to select • <span className="text-blue-400">Drag</span> to assign
            </span>
          </div>
        </div>

        {/* Employee grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-6 xl:grid-cols-8 gap-3">
            {filteredEmployees.map(employee => {
              const hasViolation = hasEmployeeViolation(employee.id);
              
              return (
                <div
                  key={employee.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, employee)}
                  onDragEnd={handleDragEnd}
                  className={`relative bg-slate-700 border rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all
                    hover:border-blue-400 hover:bg-slate-600 hover:shadow-lg hover:-translate-y-0.5
                    ${hasViolation ? 'border-red-500' : 'border-slate-600'}
                    ${draggedEmployee?.id === employee.id ? 'opacity-50' : ''}`}
                >
                  <div className="font-medium text-white text-sm truncate">
                    {employee.name}
                  </div>
                  {employee.role && (
                    <div className="text-xs text-slate-400 truncate mt-0.5">
                      {employee.role}
                    </div>
                  )}
                  {hasViolation && (
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                      <AlertTriangle className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {filteredEmployees.length === 0 && (
            <div className="text-center text-slate-400 py-8">
              {employeeSearch ? 'No employees match your search' : 'No employees available'}
            </div>
          )}
        </div>
      </div>

      {/* ==================== MODALS ==================== */}
      {showPatternModal && (
        <ShiftPatternModal
          projectId={project.id}
          organisationId={profile!.organisation_id}
          onClose={() => setShowPatternModal(false)}
          onSaved={handlePatternCreated}
        />
      )}
    </div>
  );
}
