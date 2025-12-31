'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { SignOutHeader } from '@/components/auth/SignOutHeader';
import { ChevronLeft, Download, Upload, Plus, AlertTriangle, CheckCircle } from '@/components/ui/Icons';
import { TimelineView } from './TimelineView';
import { GanttView } from './GanttView';
import { WeeklyView } from './WeeklyView';
import { CustomTimeModal } from '@/components/modals/CustomTimeModal';
import { ImportModal } from '@/components/modals/ImportModal';
import { AssignmentEditModal } from '@/components/modals/AssignmentEditModal';
import { exportToExcel, processImport, type ParsedAssignment } from '@/lib/importExport';
import { generateNetworkRailPeriods, getAvailableYears } from '@/lib/periods';
import { getEmployeeComplianceStatus } from '@/lib/compliance';
import type { 
  ProjectCamel, 
  EmployeeCamel, 
  AssignmentCamel, 
  ShiftPatternCamel 
} from '@/lib/types';

interface PlanningViewProps {
  user: any;
  onSignOut: () => void;
  project: ProjectCamel;
  employees: EmployeeCamel[];
  assignments: AssignmentCamel[];
  shiftPatterns: ShiftPatternCamel[];
  onBack: () => void;
  onCreateAssignment: (data: {
    employeeId: number;
    projectId: number;
    shiftPatternId: string;
    date: string;
    customStartTime?: string;
    customEndTime?: string;
  }) => Promise<void>;
  onUpdateAssignment?: (id: number, data: Partial<AssignmentCamel>) => Promise<void>;
  onDeleteAssignment: (id: number) => Promise<void>;
  onCreateShiftPattern?: () => void;
  onCreateShiftPatternDirect?: (data: Omit<ShiftPatternCamel, 'id' | 'organisationId'>) => Promise<void>;
  onNavigateToPerson?: (employeeId: number) => void;
}

type ViewMode = 'timeline' | 'gantt' | 'weekly';

export function PlanningView({
  user,
  onSignOut,
  project,
  employees,
  assignments,
  shiftPatterns,
  onBack,
  onCreateAssignment,
  onUpdateAssignment,
  onDeleteAssignment,
  onCreateShiftPattern,
  onCreateShiftPatternDirect,
  onNavigateToPerson,
}: PlanningViewProps) {
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  
  // Period selection
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  
  // Selection state
  const [selectedEmployees, setSelectedEmployees] = useState<EmployeeCamel[]>([]);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  
  // Employee panel resize
  const [employeePanelHeight, setEmployeePanelHeight] = useState(200);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(200);
  
  // Drag state
  const draggedEmployeeRef = useRef<EmployeeCamel[] | null>(null);
  
  // Custom time modal state
  const [customTimeModal, setCustomTimeModal] = useState<{
    show: boolean;
    employees: EmployeeCamel[];
    shiftPatternId: string;
    date: string;
    patternName: string;
  } | null>(null);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);

  // Edit assignment modal state
  const [editingAssignment, setEditingAssignment] = useState<AssignmentCamel | null>(null);
  
  // Generate periods for selected year
  const networkRailPeriods = useMemo(() => {
    return generateNetworkRailPeriods(selectedYear);
  }, [selectedYear]);
  
  // Available years
  const availableYears = getAvailableYears();
  
  // Initialize period on mount
  useEffect(() => {
    if (!selectedPeriod && networkRailPeriods.length > 0) {
      // Find current period or use first one
      const today = new Date().toISOString().split('T')[0];
      const currentPeriod = networkRailPeriods.find(
        p => today >= p.startDate && today <= p.endDate
      );
      setSelectedPeriod(currentPeriod?.name || networkRailPeriods[0].name);
    }
  }, [networkRailPeriods, selectedPeriod]);
  
  // Filter data for this project
  const projectShiftPatterns = shiftPatterns.filter(sp => sp.projectId === project.id);
  const projectAssignments = assignments.filter(a => a.projectId === project.id);

  // Find or track the Custom pattern for ad-hoc assignments
  const customPatternId = `${project.id}-custom`;
  const customPattern = projectShiftPatterns.find(sp => sp.id === customPatternId);

  // Helper to ensure Custom pattern exists
  const ensureCustomPattern = async (): Promise<string> => {
    if (customPattern) {
      return customPatternId;
    }

    // Create the Custom pattern if it doesn't exist
    if (onCreateShiftPatternDirect) {
      await onCreateShiftPatternDirect({
        id: customPatternId,  // Use specific ID so we can find it later
        projectId: project.id,
        name: 'Custom (Ad-hoc)',
        startTime: '',
        endTime: '',
        dutyType: 'Other',
        isNight: false,
        weeklySchedule: null,
      } as any);  // Cast to any since base type doesn't have id
    }

    return customPatternId;
  };
  
  // Filter employees for search
  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    (emp.role?.toLowerCase() || '').includes(employeeSearchTerm.toLowerCase())
  );
  
  // Handle resize
  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = employeePanelHeight;
    e.preventDefault();
  };
  
  useEffect(() => {
    if (!isResizing) return;
    
    const handleResizeMove = (e: MouseEvent) => {
      const deltaY = resizeStartY.current - e.clientY;
      const newHeight = Math.max(100, Math.min(window.innerHeight - 200, resizeStartHeight.current + deltaY));
      setEmployeePanelHeight(newHeight);
    };
    
    const handleResizeEnd = () => {
      setIsResizing(false);
    };
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing]);
  
  // Employee selection handlers
  const handleEmployeeClick = (e: React.MouseEvent, employee: EmployeeCamel) => {
    if (!e.ctrlKey && !e.metaKey) return;
    
    if (selectedEmployees.some(emp => emp.id === employee.id)) {
      setSelectedEmployees(selectedEmployees.filter(emp => emp.id !== employee.id));
    } else {
      setSelectedEmployees([...selectedEmployees, employee]);
    }
  };
  
  const clearSelection = () => {
    setSelectedEmployees([]);
  };
  
  // Handle ESC key to clear selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Drag handlers
  const handleEmployeeDragStart = (e: React.DragEvent, employee: EmployeeCamel) => {
    const employeesToDrag = selectedEmployees.some(emp => emp.id === employee.id)
      ? selectedEmployees
      : [employee];
    
    draggedEmployeeRef.current = employeesToDrag;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(employee.id));
    console.log('✅ Drag started:', employeesToDrag.length, 'employee(s)', employeesToDrag.map(e => e.name).join(', '));
  };
  
  const handleEmployeeDragEnd = () => {
    console.log('🛑 Drag ended');
    // Don't clear ref here - let drop handle it
  };
  
  const handleCellDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  
  const handleCellDrop = async (e: React.DragEvent, shiftPatternId: string, date: string, isValidCell: boolean = true) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('📦 Drop event on:', shiftPatternId, date, 'isValidCell:', isValidCell);
    console.log('📦 draggedEmployeeRef.current:', draggedEmployeeRef.current);
    
    const employeesToAssign = draggedEmployeeRef.current;
    
    if (!employeesToAssign || employeesToAssign.length === 0) {
      console.log('❌ No employees to assign');
      draggedEmployeeRef.current = null;
      return;
    }

    // If dropping on an invalid cell (date not in shift pattern), show custom time modal
    if (!isValidCell) {
      const pattern = projectShiftPatterns.find(p => p.id === shiftPatternId);
      setCustomTimeModal({
        show: true,
        employees: [...employeesToAssign],
        shiftPatternId,
        date,
        patternName: pattern?.name || 'Unknown Pattern',
      });
      draggedEmployeeRef.current = null;
      return;
    }

    // Valid cell - create assignments normally
    console.log('✅ Creating assignments for', employeesToAssign.length, 'employees');
    for (const employee of employeesToAssign) {
      const existing = projectAssignments.find(
        a => a.employeeId === employee.id && a.date === date && a.shiftPatternId === shiftPatternId
      );

      if (!existing) {
        try {
          console.log('📝 Creating assignment for', employee.name, 'on', date, 'pattern:', shiftPatternId);
          await onCreateAssignment({
            employeeId: employee.id,
            projectId: project.id,
            shiftPatternId,
            date,
          });
          console.log('✅ Assignment created successfully');
        } catch (err) {
          console.error('❌ Error creating assignment:', err);
        }
      } else {
        console.log('⏭️ Assignment already exists for', employee.name, 'on', date);
      }
    }

    clearSelection();
    draggedEmployeeRef.current = null;
  };

  // Handle custom time confirmation - assigns to Custom pattern, not original
  const handleCustomTimeConfirm = async (startTime: string, endTime: string) => {
    if (!customTimeModal) return;

    const { employees: emps, date } = customTimeModal;

    // Ensure the Custom pattern exists and get its ID
    const patternId = await ensureCustomPattern();

    for (const employee of emps) {
      // Check if already assigned to Custom pattern on this date
      const existing = projectAssignments.find(
        a => a.employeeId === employee.id && a.date === date && a.shiftPatternId === patternId
      );

      if (!existing) {
        try {
          await onCreateAssignment({
            employeeId: employee.id,
            projectId: project.id,
            shiftPatternId: patternId,
            date,
            customStartTime: startTime,
            customEndTime: endTime,
          });
        } catch (err) {
          console.error('Error creating custom assignment:', err);
        }
      }
    }

    setCustomTimeModal(null);
    clearSelection();
  };
  
  // Get current period
  const currentPeriod = networkRailPeriods.find(p => p.name === selectedPeriod);

  // Export handler
  const handleExport = () => {
    exportToExcel({
      project,
      employees,
      shiftPatterns: projectShiftPatterns,
      assignments: projectAssignments,
      periodName: currentPeriod?.name,
    });
  };

  // Import handler
  const handleImportConfirm = async (parsedAssignments: ParsedAssignment[]) => {
    const result = await processImport({
      parsedAssignments,
      employees,
      shiftPatterns: projectShiftPatterns,
      projectId: project.id,
      organisationId: project.organisationId,
      onCreateAssignment,
      existingAssignments: projectAssignments,
    });

    if (result.errors.length > 0) {
      console.warn('Import completed with errors:', result.errors);
    }

    console.log(`Import complete: ${result.created} created, ${result.skipped} skipped, ${result.failed} failed`);
  };
  
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 border-b-4 border-blue-600 flex-shrink-0">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-md text-sm flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <span className="text-white font-semibold text-lg">
                {project.name} <span className="text-blue-400">Planning</span>
              </span>
              <span className="text-slate-500 text-sm ml-3">
                {project.location} • {project.type}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="bg-slate-700 text-blue-400 px-3 py-1 rounded text-xs font-mono font-medium">
              PLANNING VIEW
            </span>
            <SignOutHeader user={user} onSignOut={onSignOut} />
          </div>
        </div>
      </header>
      
      {/* Controls Bar */}
      <div className="p-4 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-3 bg-white shadow-sm border border-slate-200 rounded-lg px-4 py-3">
          {/* View mode buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded text-sm ${
                viewMode === 'timeline'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={`px-3 py-1.5 rounded text-sm ${
                viewMode === 'gantt'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Gantt
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1.5 rounded text-sm ${
                viewMode === 'weekly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Weekly Grid
            </button>
          </div>
          
          {/* Year & Period selectors */}
          <div className="flex items-center gap-2 ml-4">
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value));
                setSelectedPeriod(null);
              }}
              className="border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white text-slate-900"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>
                  {year}/{year + 1}
                </option>
              ))}
            </select>
            <select
              value={selectedPeriod || ''}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white text-slate-900 min-w-[200px]"
            >
              {networkRailPeriods.map(period => (
                <option key={period.name} value={period.name}>
                  {period.name} ({period.startDate} - {period.endDate})
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex-1" />
          
          {/* Create Shift Pattern */}
          {onCreateShiftPattern && (
            <button 
              onClick={onCreateShiftPattern}
              className="px-3 py-1.5 rounded text-sm bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Add Shift Pattern
            </button>
          )}
          
          {/* Export/Import */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={projectAssignments.length === 0}
              className="px-3 py-1.5 rounded text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-3 py-1.5 rounded text-sm bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-auto px-4">
        {viewMode === 'timeline' && currentPeriod && projectShiftPatterns.length > 0 && (
          <TimelineView
            project={project}
            employees={employees}
            shiftPatterns={projectShiftPatterns}
            assignments={projectAssignments}
            period={currentPeriod}
            onCellDragOver={handleCellDragOver}
            onCellDrop={handleCellDrop}
            onDeleteAssignment={onDeleteAssignment}
            onEditAssignment={setEditingAssignment}
            onNavigateToPerson={onNavigateToPerson}
            onCreateAssignment={onCreateAssignment}
          />
        )}
        
        {viewMode === 'timeline' && currentPeriod && projectShiftPatterns.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-slate-400 text-5xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Shift Patterns</h3>
            <p className="text-slate-500 mb-6">
              Create shift patterns to start assigning employees to this project.
            </p>
            {onCreateShiftPattern && (
              <button
                onClick={onCreateShiftPattern}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto"
              >
                <Plus className="w-5 h-5" />
                Create First Shift Pattern
              </button>
            )}
          </div>
        )}
        
        {viewMode === 'gantt' && currentPeriod && (
          <GanttView
            project={project}
            employees={employees}
            shiftPatterns={projectShiftPatterns}
            assignments={projectAssignments}
            period={currentPeriod}
            onCellDragOver={handleCellDragOver}
            onCellDrop={handleCellDrop}
            onDeleteAssignment={onDeleteAssignment}
            onEditAssignment={setEditingAssignment}
          />
        )}

        {viewMode === 'weekly' && currentPeriod && (
          <WeeklyView
            project={project}
            employees={employees}
            shiftPatterns={projectShiftPatterns}
            assignments={projectAssignments}
            period={currentPeriod}
            onCellDragOver={handleCellDragOver}
            onCellDrop={handleCellDrop}
            onDeleteAssignment={onDeleteAssignment}
            onEditAssignment={setEditingAssignment}
          />
        )}
      </div>
      
      {/* Resize Handle */}
      <div
        onMouseDown={handleResizeStart}
        className={`h-2 cursor-row-resize flex items-center justify-center flex-shrink-0 ${
          isResizing ? 'bg-blue-500' : 'bg-slate-300'
        }`}
      >
        <div className="w-16 h-1 bg-slate-500 rounded" />
      </div>
      
      {/* Employee Panel */}
      <div
        className="bg-white border-t border-slate-200 flex-shrink-0 overflow-hidden"
        style={{ height: employeePanelHeight }}
      >
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold text-slate-800">
              Employees ({employees.length})
            </h3>
            <input
              type="text"
              placeholder="Search employees..."
              value={employeeSearchTerm}
              onChange={(e) => setEmployeeSearchTerm(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 text-sm w-48"
            />
          </div>
          {selectedEmployees.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-600 font-medium">
                {selectedEmployees.length} selected
              </span>
              <button
                onClick={clearSelection}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Clear
              </button>
            </div>
          )}
        </div>
        
        <div className="p-3 overflow-auto" style={{ height: employeePanelHeight - 60 }}>
          <div className="flex flex-wrap gap-2">
            {filteredEmployees.map(employee => {
              const isSelected = selectedEmployees.some(e => e.id === employee.id);
              const complianceStatus = getEmployeeComplianceStatus(employee.id, projectAssignments, projectShiftPatterns);
              
              return (
                <div
                  key={employee.id}
                  draggable
                  onDragStart={(e) => handleEmployeeDragStart(e, employee)}
                  onDragEnd={handleEmployeeDragEnd}
                  onClick={(e) => handleEmployeeClick(e, employee)}
                  className={`px-3 py-2 rounded-lg cursor-grab select-none transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-lg'
                      : complianceStatus.status === 'error'
                        ? 'bg-red-50 text-slate-700 border-2 border-red-300 hover:border-red-400'
                        : complianceStatus.status === 'warning'
                          ? 'bg-amber-50 text-slate-700 border-2 border-amber-300 hover:border-amber-400'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  title={complianceStatus.violations.length > 0 
                    ? `${employee.name}\n\n⚠️ ${complianceStatus.violations.map(v => v.message).join('\n⚠️ ')}\n\nDrag to assign to shift. Ctrl+click to select multiple.`
                    : 'Drag to assign to shift. Ctrl+click to select multiple.'
                  }
                >
                  <div className="flex items-center gap-1.5">
                    {complianceStatus.status === 'error' && !isSelected && (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    )}
                    {complianceStatus.status === 'warning' && !isSelected && (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    )}
                    <div className="font-medium text-sm">{employee.name}</div>
                  </div>
                  {employee.role && (
                    <div className={`text-xs ${isSelected ? 'text-blue-200' : 'text-slate-500'}`}>
                      {employee.role}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Custom Time Modal */}
      {customTimeModal && (
        <CustomTimeModal
          employeeNames={customTimeModal.employees.map(e => e.name)}
          date={customTimeModal.date}
          patternName={customTimeModal.patternName}
          onClose={() => setCustomTimeModal(null)}
          onConfirm={handleCustomTimeConfirm}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal
          projectName={project.name}
          onClose={() => setShowImportModal(false)}
          onConfirm={handleImportConfirm}
        />
      )}

      {/* Assignment Edit Modal */}
      {editingAssignment && onUpdateAssignment && (
        <AssignmentEditModal
          assignment={editingAssignment}
          employee={employees.find(e => e.id === editingAssignment.employeeId)!}
          shiftPattern={projectShiftPatterns.find(p => p.id === editingAssignment.shiftPatternId)!}
          allShiftPatterns={projectShiftPatterns}
          onClose={() => setEditingAssignment(null)}
          onSave={onUpdateAssignment}
          onDelete={onDeleteAssignment}
        />
      )}
    </div>
  );
}
