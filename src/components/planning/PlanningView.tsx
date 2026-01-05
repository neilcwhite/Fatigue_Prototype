'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
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
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import type {
  ProjectCamel,
  EmployeeCamel,
  AssignmentCamel,
  ShiftPatternCamel,
  TeamCamel,
  SupabaseUser
} from '@/lib/types';

interface PlanningViewProps {
  user: SupabaseUser;
  onSignOut: () => void;
  project: ProjectCamel;
  employees: EmployeeCamel[];
  teams: TeamCamel[];
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
  onCreateShiftPatternDirect?: (data: Omit<ShiftPatternCamel, 'id' | 'organisationId'> & { id?: string }) => Promise<void>;
  onNavigateToPerson?: (employeeId: number) => void;
}

type ViewMode = 'timeline' | 'gantt' | 'weekly';

export function PlanningView({
  user,
  onSignOut,
  project,
  employees,
  teams,
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

  // Refs for measuring fixed heights
  const headerRef = useRef<HTMLElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [fixedHeight, setFixedHeight] = useState(0);

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

  // Error notification state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  // Measure fixed heights on mount and resize
  useEffect(() => {
    const measureFixedHeight = () => {
      const headerH = headerRef.current?.offsetHeight || 0;
      const controlsH = controlsRef.current?.offsetHeight || 0;
      const resizeHandleH = 8; // h-2 = 0.5rem = 8px
      setFixedHeight(headerH + controlsH + resizeHandleH);
    };

    measureFixedHeight();
    window.addEventListener('resize', measureFixedHeight);
    return () => window.removeEventListener('resize', measureFixedHeight);
  }, []);

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
        startTime: null as unknown as string,  // No fixed time - each assignment has custom times
        endTime: null as unknown as string,
        dutyType: 'Non-Possession',  // Use valid duty type for ad-hoc work
        isNight: false,
        weeklySchedule: undefined,
      });
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
  };

  const handleEmployeeDragEnd = () => {
    // Don't clear ref here - let drop handle it
  };

  const handleCellDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleCellDrop = async (e: React.DragEvent, shiftPatternId: string, date: string, isValidCell: boolean = true) => {
    e.preventDefault();
    e.stopPropagation();

    const employeesToAssign = draggedEmployeeRef.current;

    if (!employeesToAssign || employeesToAssign.length === 0) {
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
    try {
      for (const employee of employeesToAssign) {
        const existing = projectAssignments.find(
          a => a.employeeId === employee.id && a.date === date && a.shiftPatternId === shiftPatternId
        );

        if (!existing) {
          await onCreateAssignment({
            employeeId: employee.id,
            projectId: project.id,
            shiftPatternId,
            date,
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create assignment';
      setErrorMessage(message);
    }

    clearSelection();
    draggedEmployeeRef.current = null;
  };

  // Handle custom time confirmation - assigns to Custom pattern, not original
  const handleCustomTimeConfirm = async (startTime: string, endTime: string) => {
    if (!customTimeModal) {
      return;
    }

    const { employees: emps, date } = customTimeModal;

    try {
      // Ensure the Custom pattern exists and get its ID
      const patternId = await ensureCustomPattern();

      for (const employee of emps) {
        // Check if already assigned to Custom pattern on this date
        const existing = projectAssignments.find(
          a => a.employeeId === employee.id && a.date === date && a.shiftPatternId === patternId
        );

        if (!existing) {
          await onCreateAssignment({
            employeeId: employee.id,
            projectId: project.id,
            shiftPatternId: patternId,
            date,
            customStartTime: startTime,
            customEndTime: endTime,
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create assignment';
      setErrorMessage(message);
    }

    setCustomTimeModal(null);
    clearSelection();
  };

  // Get current period
  const currentPeriod = networkRailPeriods.find(p => p.name === selectedPeriod);

  // Calculate main content height (viewport - header - controls - resize handle - employee panel)
  const mainContentHeight = `calc(100vh - ${fixedHeight}px - ${employeePanelHeight}px)`;

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
    await processImport({
      parsedAssignments,
      employees,
      shiftPatterns: projectShiftPatterns,
      projectId: project.id,
      organisationId: project.organisationId,
      onCreateAssignment,
      existingAssignments: projectAssignments,
    });
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'grey.100' }}>
      {/* Header */}
      <AppBar
        ref={headerRef}
        position="static"
        sx={{ background: 'linear-gradient(to right, #1e293b, #0f172a)', borderBottom: '4px solid #2563eb', flexShrink: 0 }}
      >
        <Toolbar sx={{ px: 3, py: 1.5 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 600 }}>
              {project.name} <Box component="span" sx={{ color: '#60a5fa' }}>Planning</Box>
            </Typography>
          </Box>
          <Chip
            label="PLANNING VIEW"
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#60a5fa', fontFamily: 'monospace', fontSize: '0.7rem', mr: 2 }}
          />
          <SignOutHeader user={user} onSignOut={onSignOut} />
        </Toolbar>
      </AppBar>

      {/* Controls Bar */}
      <Box ref={controlsRef} sx={{ p: 2, flexShrink: 0 }}>
        <Paper sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, px: 2, py: 1.5 }}>
          {/* View mode buttons */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, val) => val && setViewMode(val)}
            size="small"
          >
            <ToggleButton value="timeline" sx={{ px: 2 }}>Timeline</ToggleButton>
            <ToggleButton value="gantt" sx={{ px: 2 }}>Gantt</ToggleButton>
            <ToggleButton value="weekly" sx={{ px: 2 }}>Weekly Grid</ToggleButton>
          </ToggleButtonGroup>

          {/* Year & Period selectors */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(Number(e.target.value));
                  setSelectedPeriod(null);
                }}
              >
                {availableYears.map(year => (
                  <MenuItem key={year} value={year}>
                    {year}/{year + 1}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <Select
                value={selectedPeriod || ''}
                onChange={(e) => setSelectedPeriod(e.target.value as string)}
              >
                {networkRailPeriods.map(period => (
                  <MenuItem key={period.name} value={period.name}>
                    {period.name} ({period.startDate} - {period.endDate})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Create Shift Pattern */}
          {onCreateShiftPattern && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<Plus className="w-4 h-4" />}
              onClick={onCreateShiftPattern}
              size="small"
            >
              Add Shift Pattern
            </Button>
          )}

          {/* Export/Import */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<Download className="w-4 h-4" />}
              onClick={handleExport}
              disabled={projectAssignments.length === 0}
              size="small"
            >
              Export
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<Upload className="w-4 h-4" />}
              onClick={() => setShowImportModal(true)}
              size="small"
            >
              Import
            </Button>
          </Box>
        </Paper>
      </Box>

      {/* Main Content Area - height calculated to shrink when employee panel grows */}
      <Box
        sx={{ overflow: 'auto', px: 2, height: mainContentHeight }}
      >
        {viewMode === 'timeline' && currentPeriod && projectShiftPatterns.length > 0 && (
          <TimelineView
            project={project}
            employees={employees}
            shiftPatterns={projectShiftPatterns}
            assignments={projectAssignments}
            allAssignments={assignments}
            allShiftPatterns={shiftPatterns}
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
          <Paper sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="h2" sx={{ color: 'grey.400', mb: 2 }}>📋</Typography>
            <Typography variant="h6" sx={{ color: 'grey.700', mb: 1 }}>No Shift Patterns</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create shift patterns to start assigning employees to this project.
            </Typography>
            {onCreateShiftPattern && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<Plus className="w-5 h-5" />}
                onClick={onCreateShiftPattern}
                size="large"
              >
                Create First Shift Pattern
              </Button>
            )}
          </Paper>
        )}

        {viewMode === 'gantt' && currentPeriod && (
          <GanttView
            project={project}
            employees={employees}
            shiftPatterns={projectShiftPatterns}
            assignments={projectAssignments}
            allAssignments={assignments}
            allShiftPatterns={shiftPatterns}
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
            allAssignments={assignments}
            allShiftPatterns={shiftPatterns}
            period={currentPeriod}
            onCellDragOver={handleCellDragOver}
            onCellDrop={handleCellDrop}
            onDeleteAssignment={onDeleteAssignment}
            onEditAssignment={setEditingAssignment}
          />
        )}
      </Box>

      {/* Resize Handle */}
      <Box
        onMouseDown={handleResizeStart}
        sx={{
          height: 8,
          cursor: 'row-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          bgcolor: isResizing ? 'primary.main' : 'grey.300',
        }}
      >
        <Box sx={{ width: 64, height: 4, bgcolor: 'grey.500', borderRadius: 1 }} />
      </Box>

      {/* Employee Panel */}
      <Paper
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          flexShrink: 0,
          overflow: 'hidden',
          borderRadius: 0,
        }}
        style={{ height: employeePanelHeight }}
      >
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              Employees ({employees.length})
            </Typography>
            <TextField
              size="small"
              placeholder="Search employees..."
              value={employeeSearchTerm}
              onChange={(e) => setEmployeeSearchTerm(e.target.value)}
              sx={{ width: 200 }}
            />
          </Box>
          {selectedEmployees.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="primary" fontWeight={600}>
                {selectedEmployees.length} selected
              </Typography>
              <Button size="small" onClick={clearSelection}>
                Clear
              </Button>
            </Box>
          )}
        </Box>

        <Box sx={{ p: 1.5, overflow: 'auto' }} style={{ height: employeePanelHeight - 60 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {filteredEmployees.map(employee => {
              const isSelected = selectedEmployees.some(e => e.id === employee.id);
              // Use ALL assignments for compliance to catch cross-project conflicts
              const complianceStatus = getEmployeeComplianceStatus(employee.id, assignments, shiftPatterns);

              return (
                <Paper
                  key={employee.id}
                  draggable
                  onDragStart={(e) => handleEmployeeDragStart(e, employee)}
                  onDragEnd={handleEmployeeDragEnd}
                  onClick={(e) => handleEmployeeClick(e, employee)}
                  elevation={isSelected ? 4 : 0}
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    cursor: 'grab',
                    userSelect: 'none',
                    transition: 'all 0.2s',
                    bgcolor: isSelected
                      ? 'primary.main'
                      : complianceStatus.status === 'error'
                        ? 'error.50'
                        : complianceStatus.status === 'warning'
                          ? 'warning.50'
                          : 'success.50',
                    color: isSelected ? 'white' : 'text.primary',
                    border: 2,
                    borderColor: isSelected
                      ? 'primary.main'
                      : complianceStatus.status === 'error'
                        ? 'error.300'
                        : complianceStatus.status === 'warning'
                          ? 'warning.300'
                          : 'success.300',
                    '&:hover': {
                      borderColor: isSelected
                        ? 'primary.dark'
                        : complianceStatus.status === 'error'
                          ? 'error.400'
                          : complianceStatus.status === 'warning'
                            ? 'warning.400'
                            : 'success.400',
                    },
                  }}
                  title={complianceStatus.violations.length > 0
                    ? `${employee.name}\n\n⚠️ ${complianceStatus.violations.map(v => v.message).join('\n⚠️ ')}\n\nDrag to assign to shift. Ctrl+click to select multiple.`
                    : 'Drag to assign to shift. Ctrl+click to select multiple.'
                  }
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {complianceStatus.status === 'error' && !isSelected && (
                      <Box sx={{ color: '#ef4444', flexShrink: 0, display: 'flex' }}>
                        <AlertTriangle className="w-2.5 h-2.5" />
                      </Box>
                    )}
                    {complianceStatus.status === 'warning' && !isSelected && (
                      <Box sx={{ color: '#f59e0b', flexShrink: 0, display: 'flex' }}>
                        <AlertTriangle className="w-2.5 h-2.5" />
                      </Box>
                    )}
                    {complianceStatus.status === 'ok' && !isSelected && (
                      <Box sx={{ color: '#22c55e', flexShrink: 0, display: 'flex' }}>
                        <CheckCircle className="w-2.5 h-2.5" />
                      </Box>
                    )}
                    <Typography variant="body2" fontWeight={600}>{employee.name}</Typography>
                  </Box>
                  {employee.role && (
                    <Typography variant="caption" sx={{ color: isSelected ? 'primary.100' : 'text.secondary' }}>
                      {employee.role}
                    </Typography>
                  )}
                </Paper>
              );
            })}
          </Box>
        </Box>
      </Paper>

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

      {/* Error Snackbar */}
      <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={() => setErrorMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setErrorMessage(null)}
          severity="error"
          sx={{ width: '100%' }}
        >
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
