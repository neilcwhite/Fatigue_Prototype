'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import { ChevronLeft, ChevronRight, Trash2, Download, Edit2, Eye, EyeOff, Activity, AlertTriangle } from '@/components/ui/Icons';
import { AssignmentEditModal } from '@/components/modals/AssignmentEditModal';
import { FatigueAssessmentModal } from '@/components/modals/FatigueAssessmentModal';
import { checkEmployeeCompliance, type ComplianceViolation } from '@/lib/compliance';
import type { FatigueAssessment } from '@/lib/types';
import { parseTimeToHours, calculateDutyLength, calculateCombinedFatigueSequence, DEFAULT_FATIGUE_PARAMS } from '@/lib/fatigue';
import type { ShiftDefinition } from '@/lib/types';
import { generateNetworkRailPeriods, getAvailableYears, findPeriodForDate } from '@/lib/periods';
import type { EmployeeCamel, AssignmentCamel, ShiftPatternCamel, ProjectCamel, SupabaseUser } from '@/lib/types';
import { SignOutHeader } from '@/components/auth/SignOutHeader';
import { useNotification } from '@/hooks/useNotification';
import { PersonStatsBar } from './PersonStatsBar';
import { ViolationsList } from './ViolationsList';
import { ScheduleCalendar, getFRIChipSx, hasCustomTimes, getAssignmentDisplayName } from './ScheduleCalendar';
import { AddShiftModal } from './AddShiftModal';

interface PersonViewProps {
  user: SupabaseUser;
  onSignOut: () => void;
  onBack: () => void;
  employee: EmployeeCamel;
  employees: EmployeeCamel[];
  assignments: AssignmentCamel[];
  shiftPatterns: ShiftPatternCamel[];
  projects: ProjectCamel[];
  onSelectEmployee: (id: number) => void;
  onDeleteAssignment: (id: number) => Promise<void>;
  onUpdateAssignment?: (id: number, data: Partial<AssignmentCamel>) => Promise<void>;
  onUpdateShiftPattern?: (id: string, data: Partial<ShiftPatternCamel>) => Promise<void>;
  onCreateAssignment?: (data: {
    employeeId: number;
    projectId: number;
    shiftPatternId: string;
    date: string;
    customStartTime?: string;
    customEndTime?: string;
  }) => Promise<void>;
  onCreateFatigueAssessment?: (assessment: FatigueAssessment) => Promise<void>;
}


export function PersonView({
  user,
  onSignOut,
  onBack,
  employee,
  employees,
  assignments,
  shiftPatterns,
  projects,
  onSelectEmployee,
  onDeleteAssignment,
  onUpdateAssignment,
  onUpdateShiftPattern,
  onCreateAssignment,
  onCreateFatigueAssessment,
}: PersonViewProps) {
  const { showSuccess, showError } = useNotification();
  // Calculate initial year and period based on today's date
  const initialPeriodInfo = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const currentPeriod = findPeriodForDate(today);
    if (currentPeriod) {
      const periods = generateNetworkRailPeriods(currentPeriod.year);
      const periodIdx = periods.findIndex(p => p.period === currentPeriod.period);
      return { year: currentPeriod.year, periodIdx: periodIdx !== -1 ? periodIdx : 0 };
    }
    return { year: new Date().getFullYear(), periodIdx: 0 };
  }, []);

  const [selectedYear, setSelectedYear] = useState(initialPeriodInfo.year);
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(initialPeriodInfo.periodIdx);
  const [highlightedDate, setHighlightedDate] = useState<string | null>(null);
  const [showFatigueParams, setShowFatigueParams] = useState(true);
  const [showFRI, setShowFRI] = useState(true);
  const [editingPatternId, setEditingPatternId] = useState<string | null>(null);
  const [editingParams, setEditingParams] = useState<{
    workload: number;
    attention: number;
    commuteTime: number;
    breakFrequency: number;
    breakLength: number;
  } | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<AssignmentCamel | null>(null);
  const [addShiftDate, setAddShiftDate] = useState<string | null>(null);
  const [assessmentViolation, setAssessmentViolation] = useState<ComplianceViolation | null>(null);

  const networkRailPeriods = useMemo(() => generateNetworkRailPeriods(selectedYear), [selectedYear]);
  const availableYears = getAvailableYears();
  const currentPeriod = networkRailPeriods[selectedPeriodIdx];

  const empAssignments = useMemo(() => {
    return assignments
      .filter(a => a.employeeId === employee.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [assignments, employee.id]);

  const periodAssignments = useMemo(() => {
    if (!currentPeriod) return [];
    return empAssignments.filter(a =>
      a.date >= currentPeriod.startDate && a.date <= currentPeriod.endDate
    );
  }, [empAssignments, currentPeriod]);

  const compliance = useMemo(() =>
    checkEmployeeCompliance(employee.id, assignments, shiftPatterns),
    [employee.id, assignments, shiftPatterns]
  );

  const fatigueAnalysis = useMemo(() => {
    if (periodAssignments.length === 0) return null;

    // First, build shifts with period-relative day numbers to track gaps correctly
    const periodStart = new Date(currentPeriod!.startDate);
    const shiftsWithPeriodDays = periodAssignments.map((a) => {
      const pattern = shiftPatterns.find(p => p.id === a.shiftPatternId);
      const startTime = a.customStartTime || pattern?.startTime || '08:00';
      const endTime = a.customEndTime || pattern?.endTime || '18:00';
      const assignmentDate = new Date(a.date);
      const periodDayNumber = Math.floor((assignmentDate.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;

      // Use assignment's fatigue params if set, otherwise fall back to pattern, then defaults
      const patternCommuteIn = pattern?.commuteTime ? Math.floor(pattern.commuteTime / 2) : undefined;
      const patternCommuteOut = pattern?.commuteTime ? Math.ceil(pattern.commuteTime / 2) : undefined;

      return {
        periodDay: periodDayNumber,
        startTime,
        endTime,
        // Priority: assignment override -> pattern value -> default
        workload: a.workload ?? pattern?.workload,
        attention: a.attention ?? pattern?.attention,
        commuteIn: a.commuteIn ?? patternCommuteIn,
        commuteOut: a.commuteOut ?? patternCommuteOut,
        breakFreq: a.breakFrequency ?? pattern?.breakFrequency,
        breakLen: a.breakLength ?? pattern?.breakLength,
      };
    });

    // Now renumber starting from day 1, but preserve relative gaps between shifts
    // E.g., if shifts are on period days 3, 4, 5, 8, 9 -> renumber to 1, 2, 3, 6, 7
    const firstPeriodDay = shiftsWithPeriodDays[0]?.periodDay || 1;
    const shifts: ShiftDefinition[] = shiftsWithPeriodDays.map((s) => ({
      day: s.periodDay - firstPeriodDay + 1,  // Renumber so first shift is day 1
      startTime: s.startTime,
      endTime: s.endTime,
      workload: s.workload,
      attention: s.attention,
      commuteIn: s.commuteIn,
      commuteOut: s.commuteOut,
      breakFreq: s.breakFreq,
      breakLen: s.breakLen,
    }));

    // Use combined function to get both Risk Index (FRI) and Fatigue Index (FGI)
    const results = calculateCombinedFatigueSequence(shifts);
    const maxFRI = Math.max(...results.map(r => r.riskIndex));
    const avgFRI = results.reduce((sum, r) => sum + r.riskIndex, 0) / results.length;
    const criticalShifts = results.filter(r => r.riskIndex >= 1.2).length;
    const elevatedShifts = results.filter(r => r.riskIndex >= 1.1 && r.riskIndex < 1.2).length;
    const maxFGI = Math.max(...results.map(r => r.fatigueIndex));
    const avgFGI = results.reduce((sum, r) => sum + r.fatigueIndex, 0) / results.length;
    return { results, maxFRI, avgFRI, criticalShifts, elevatedShifts, maxFGI, avgFGI };
  }, [periodAssignments, shiftPatterns, currentPeriod]);

  const periodPatterns = useMemo(() => {
    const patternIds = [...new Set(periodAssignments.map(a => a.shiftPatternId))];
    return patternIds.map(id => {
      const pattern = shiftPatterns.find(p => p.id === id);
      const patternAssignmentIndices = periodAssignments
        .map((a, idx) => a.shiftPatternId === id ? idx : -1)
        .filter(i => i !== -1);
      const assignmentCount = patternAssignmentIndices.length;
      let avgFRI = 0;
      let maxFRI = 0;
      if (fatigueAnalysis && patternAssignmentIndices.length > 0) {
        const friValues = patternAssignmentIndices.map(i => fatigueAnalysis.results[i]?.riskIndex || 0);
        avgFRI = friValues.reduce((sum, v) => sum + v, 0) / friValues.length;
        maxFRI = Math.max(...friValues);
      }
      return pattern ? { ...pattern, assignmentCount, avgFRI, maxFRI } : null;
    }).filter(Boolean) as (ShiftPatternCamel & { assignmentCount: number; avgFRI: number; maxFRI: number })[];
  }, [periodAssignments, shiftPatterns, fatigueAnalysis]);

  const violationAssignmentSeverity = useMemo(() => {
    const severityMap = new Map<number, 'breach' | 'level2' | 'level1' | 'warning'>();
    compliance.violations.forEach(violation => {
      let violationAssignments: AssignmentCamel[] = [];
      if (violation.type === 'MAX_WEEKLY_HOURS' || violation.type === 'APPROACHING_WEEKLY_LIMIT') {
        const windowStart = new Date(violation.date);
        const windowEnd = violation.windowEnd
          ? new Date(violation.windowEnd)
          : new Date(windowStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        violationAssignments = empAssignments.filter(a => {
          const aDate = new Date(a.date);
          return aDate >= windowStart && aDate <= windowEnd;
        });
      } else if (violation.type === 'INSUFFICIENT_REST') {
        const violationDate = new Date(violation.date);
        const prevDate = new Date(violationDate);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevDateStr = prevDate.toISOString().split('T')[0];
        violationAssignments = empAssignments.filter(a => a.date === violation.date || a.date === prevDateStr);
      } else if (violation.type === 'MAX_CONSECUTIVE_DAYS' || violation.type === 'MAX_CONSECUTIVE_NIGHTS' || violation.type === 'CONSECUTIVE_NIGHTS_WARNING') {
        if (violation.relatedDates) {
          violationAssignments = empAssignments.filter(a => violation.relatedDates?.includes(a.date) || a.date === violation.date);
        } else {
          violationAssignments = empAssignments.filter(a => a.date === violation.date);
        }
      } else {
        violationAssignments = empAssignments.filter(a => a.date === violation.date);
      }
      // Severity priority: breach > level2 > level1 > warning
      const severityPriority = { breach: 4, level2: 3, level1: 2, warning: 1 };
      violationAssignments.forEach(a => {
        const existingSeverity = severityMap.get(a.id);
        const existingPriority = existingSeverity ? severityPriority[existingSeverity] : 0;
        const newPriority = severityPriority[violation.severity] || 0;
        if (newPriority > existingPriority) {
          severityMap.set(a.id, violation.severity);
        }
      });
    });
    return severityMap;
  }, [compliance.violations, empAssignments]);

  const parseDateLocal = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const calendarDates = useMemo(() => {
    if (!currentPeriod) return [];
    const dates: string[] = [];
    const startDate = parseDateLocal(currentPeriod.startDate);
    for (let i = 0; i < 28; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    return dates;
  }, [currentPeriod]);

  const calendarDayHeaders = useMemo(() => {
    if (!currentPeriod) return ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const startDate = parseDateLocal(currentPeriod.startDate);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const headers: string[] = [];
    for (let i = 0; i < 7; i++) {
      headers.push(dayNames[(startDate.getDay() + i) % 7]);
    }
    return headers;
  }, [currentPeriod]);

  const stats = useMemo(() => {
    const totalShifts = periodAssignments.length;
    const uniqueProjects = [...new Set(periodAssignments.map(a => a.projectId))].length;
    let totalHours = 0;
    let nightShifts = 0;
    periodAssignments.forEach(a => {
      const pattern = shiftPatterns.find(p => p.id === a.shiftPatternId);
      if (pattern?.startTime && pattern?.endTime) {
        const start = parseTimeToHours(pattern.startTime);
        const end = parseTimeToHours(pattern.endTime);
        totalHours += calculateDutyLength(start, end);
      } else {
        totalHours += 12;
      }
      if (pattern?.isNight) nightShifts++;
    });
    return { totalShifts, uniqueProjects, totalHours: Math.round(totalHours), nightShifts };
  }, [periodAssignments, shiftPatterns]);

  const getAssignmentInfo = (assignment: AssignmentCamel) => {
    const pattern = shiftPatterns.find(p => p.id === assignment.shiftPatternId);
    const project = projects.find(p => p.id === assignment.projectId);
    return { pattern, project };
  };

  const handleDelete = async (assignment: AssignmentCamel) => {
    const { pattern } = getAssignmentInfo(assignment);
    if (confirm(`Remove ${employee.name} from ${pattern?.name || 'shift'} on ${assignment.date}?`)) {
      try {
        await onDeleteAssignment(assignment.id);
        showSuccess('Assignment deleted');
      } catch (err) {
        console.error('Error deleting assignment:', err);
        showError('Failed to delete assignment');
      }
    }
  };

  const handlePrevPeriod = () => {
    if (selectedPeriodIdx > 0) {
      setSelectedPeriodIdx(selectedPeriodIdx - 1);
    } else if (selectedYear > availableYears[0]) {
      setSelectedYear(selectedYear - 1);
      setSelectedPeriodIdx(12);
    }
  };

  const handleNextPeriod = () => {
    if (selectedPeriodIdx < networkRailPeriods.length - 1) {
      setSelectedPeriodIdx(selectedPeriodIdx + 1);
    } else if (selectedYear < availableYears[availableYears.length - 1]) {
      setSelectedYear(selectedYear + 1);
      setSelectedPeriodIdx(0);
    }
  };

  const handleViolationClick = (violation: ComplianceViolation) => {
    const violationDate = violation.date;
    const period = findPeriodForDate(violationDate);
    if (!period) return;
    if (period.year !== selectedYear) setSelectedYear(period.year);
    const yearPeriods = generateNetworkRailPeriods(period.year);
    const periodIdx = yearPeriods.findIndex(p => p.period === period.period);
    if (periodIdx !== -1) setSelectedPeriodIdx(periodIdx);
    setHighlightedDate(violationDate);
    setTimeout(() => setHighlightedDate(null), 3000);
    document.getElementById('schedule-calendar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleExport = () => {
    if (!currentPeriod) return;
    const rows = [
      ['Employee Schedule Export'],
      [`Employee: ${employee.name}`],
      [`Role: ${employee.role || 'N/A'}`],
      [`Period: ${currentPeriod.name}`],
      [`Date Range: ${currentPeriod.startDate} to ${currentPeriod.endDate}`],
      [],
      ['Date', 'Day', 'Shift Pattern', 'Start', 'End', 'Project', 'Fatigue Risk'],
    ];
    periodAssignments.forEach((a, idx) => {
      const { pattern, project } = getAssignmentInfo(a);
      const d = new Date(a.date);
      const fri = fatigueAnalysis?.results[idx]?.riskIndex;
      rows.push([
        a.date,
        d.toLocaleDateString('en-GB', { weekday: 'short' }),
        getAssignmentDisplayName(a, pattern),
        a.customStartTime || pattern?.startTime || '',
        a.customEndTime || pattern?.endTime || '',
        project?.name || 'Unknown',
        fri ? fri.toFixed(3) : 'N/A',
      ]);
    });
    rows.push([]);
    rows.push(['Summary']);
    rows.push(['Total Shifts', String(stats.totalShifts)]);
    rows.push(['Total Hours', String(stats.totalHours)]);
    rows.push(['Night Shifts', String(stats.nightShifts)]);
    if (fatigueAnalysis) {
      rows.push(['Max FRI', fatigueAnalysis.maxFRI.toFixed(3)]);
      rows.push(['Avg FRI', fatigueAnalysis.avgFRI.toFixed(3)]);
      rows.push(['Critical Shifts (FRI >= 1.2)', String(fatigueAnalysis.criticalShifts)]);
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${employee.name.replace(/\s+/g, '_')}_${currentPeriod.name.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


  const handleStartEdit = (pattern: ShiftPatternCamel) => {
    setEditingPatternId(pattern.id);
    setEditingParams({
      workload: pattern.workload ?? DEFAULT_FATIGUE_PARAMS.workload,
      attention: pattern.attention ?? DEFAULT_FATIGUE_PARAMS.attention,
      commuteTime: pattern.commuteTime ?? DEFAULT_FATIGUE_PARAMS.commuteTime,
      breakFrequency: pattern.breakFrequency ?? DEFAULT_FATIGUE_PARAMS.breakFrequency,
      breakLength: pattern.breakLength ?? DEFAULT_FATIGUE_PARAMS.breakLength,
    });
  };

  const handleSaveParams = async () => {
    if (!editingPatternId || !editingParams || !onUpdateShiftPattern) return;
    try {
      await onUpdateShiftPattern(editingPatternId, {
        workload: editingParams.workload,
        attention: editingParams.attention,
        commuteTime: editingParams.commuteTime,
        breakFrequency: editingParams.breakFrequency,
        breakLength: editingParams.breakLength,
      });
      setEditingPatternId(null);
      setEditingParams(null);
      showSuccess('Parameters saved');
    } catch (err) {
      console.error('Failed to update pattern:', err);
      showError('Failed to save parameters');
    }
  };

  const handleCancelEdit = () => {
    setEditingPatternId(null);
    setEditingParams(null);
  };

  const isDefault = (value: number | undefined, defaultValue: number) => value === undefined || value === defaultValue;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          background: 'linear-gradient(to right, #1e293b, #0f172a)',
          borderBottom: '4px solid',
          borderColor: 'warning.main',
        }}
      >
        <Toolbar sx={{ px: { xs: 2, sm: 3 } }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="span" fontWeight={600}>
              {employee.name}
            </Typography>
            <Typography variant="body2" sx={{ color: 'grey.500', ml: 2 }} component="span">
              {employee.role}
            </Typography>
          </Box>
          <Chip
            label="PERSON VIEW"
            size="small"
            sx={{
              bgcolor: 'rgba(51, 65, 85, 0.8)',
              color: 'warning.light',
              fontFamily: 'monospace',
              fontWeight: 500,
              fontSize: '0.7rem',
              mr: 2,
            }}
          />
          <SignOutHeader user={user} onSignOut={onSignOut} />
        </Toolbar>
      </AppBar>

      {/* Period Navigation */}
      <Paper sx={{ px: 3, py: 1.5, borderRadius: 0, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                value={employee.id}
                onChange={(e) => onSelectEmployee(Number(e.target.value))}
              >
                {employees.map(emp => (
                  <MenuItem key={emp.id} value={emp.id}>{emp.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={selectedYear}
                onChange={(e) => { setSelectedYear(Number(e.target.value)); setSelectedPeriodIdx(0); }}
              >
                {availableYears.map(year => (
                  <MenuItem key={year} value={year}>{year}/{year + 1}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton size="small" onClick={handlePrevPeriod} title="Previous period">
                <ChevronLeft className="w-5 h-5" />
              </IconButton>
              <FormControl size="small" sx={{ minWidth: 280 }}>
                <Select
                  value={selectedPeriodIdx}
                  onChange={(e) => setSelectedPeriodIdx(Number(e.target.value))}
                >
                  {networkRailPeriods.map((period, idx) => (
                    <MenuItem key={period.name} value={idx}>
                      {period.name} ({period.startDate} - {period.endDate})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton size="small" onClick={handleNextPeriod} title="Next period">
                <ChevronRight className="w-5 h-5" />
              </IconButton>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant={showFRI ? 'contained' : 'outlined'}
              color={showFRI ? 'primary' : 'inherit'}
              size="small"
              onClick={() => setShowFRI(!showFRI)}
              startIcon={showFRI ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            >
              FRI
            </Button>
            <Button
              variant="contained"
              color="success"
              size="small"
              onClick={handleExport}
              disabled={periodAssignments.length === 0}
              startIcon={<Download className="w-4 h-4" />}
            >
              Export Schedule
            </Button>
          </Box>
        </Box>
      </Paper>

      <Box sx={{ p: 2 }}>
        {/* Compact Stats Row - extracted component */}
        <PersonStatsBar
          compliance={compliance}
          stats={stats}
          showFRI={showFRI}
          fatigueAnalysis={fatigueAnalysis}
        />

        {/* Compliance Violations - extracted component */}
        <ViolationsList
          violations={compliance.violations}
          onViolationClick={handleViolationClick}
          onCreateAssessment={setAssessmentViolation}
        />

        {/* Schedule Calendar Grid - extracted component */}
        <ScheduleCalendar
          currentPeriod={currentPeriod}
          calendarDates={calendarDates}
          calendarDayHeaders={calendarDayHeaders}
          periodAssignments={periodAssignments}
          shiftPatterns={shiftPatterns}
          projects={projects}
          violationAssignmentSeverity={violationAssignmentSeverity}
          fatigueResults={fatigueAnalysis?.results || null}
          highlightedDate={highlightedDate}
          showFRI={showFRI}
          onEditAssignment={onUpdateAssignment ? (assignment) => setEditingAssignment(assignment) : undefined}
          onDeleteAssignment={handleDelete}
          onAddShift={onCreateAssignment ? (date) => setAddShiftDate(date) : undefined}
        />

        {/* Period Assignments List */}
        <Paper>
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" fontWeight={600}>Period Assignments ({periodAssignments.length})</Typography>
          </Box>
          <Box sx={{ p: 1.5, maxHeight: 256, overflow: 'auto' }}>
            {periodAssignments.length === 0 ? (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                No assignments in this period
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {periodAssignments.map((assignment, idx) => {
                  const { pattern, project } = getAssignmentInfo(assignment);
                  const assignmentViolationSeverity = violationAssignmentSeverity.get(assignment.id);
                  const d = new Date(assignment.date);
                  const fri = fatigueAnalysis?.results[idx]?.riskIndex;
                  return (
                    <Paper
                      key={assignment.id}
                      variant="outlined"
                      sx={{
                        p: 1,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderLeft: 3,
                        borderColor: assignmentViolationSeverity === 'breach' ? '#ef4444' : assignmentViolationSeverity === 'level2' ? '#f97316' : assignmentViolationSeverity === 'level1' ? '#eab308' : assignmentViolationSeverity === 'warning' ? '#6b7280' : 'transparent',
                        bgcolor: (showFRI && fri !== undefined)
                          ? (fri >= 1.2 ? 'error.light' : fri >= 1.1 ? 'warning.light' : fri >= 1.0 ? 'warning.50' : 'success.light')
                          : 'action.hover',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ textAlign: 'center', minWidth: 45 }}>
                          <Typography variant="caption" color="text.secondary">{d.toLocaleDateString('en-GB', { month: 'short' })}</Typography>
                          <Typography variant="h6" fontWeight={700}>{d.getDate()}</Typography>
                          <Typography variant="caption">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</Typography>
                        </Box>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight={500}>{getAssignmentDisplayName(assignment, pattern)}</Typography>
                            {pattern?.isNight && !hasCustomTimes(assignment, pattern) && <span>🌙</span>}
                            {hasCustomTimes(assignment, pattern) && <Typography variant="caption" color="warning.main">(edited)</Typography>}
                            {assignmentViolationSeverity && <AlertTriangle className="w-3 h-3" />}
                          </Box>
                          <Typography variant="caption" color="text.secondary">{project?.name || 'Unknown Project'}</Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {assignment.customStartTime || pattern?.startTime || '?'} - {assignment.customEndTime || pattern?.endTime || '?'}
                            <Box component="span" sx={{ mx: 0.5 }}>•</Box>
                            {hasCustomTimes(assignment, pattern) ? 'Custom' : pattern?.dutyType}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {showFRI && fri !== undefined && (
                          <Chip
                            label={`FRI: ${fri.toFixed(3)}`}
                            size="small"
                            sx={{ ...getFRIChipSx(fri), fontWeight: 700, fontSize: '0.65rem' }}
                          />
                        )}
                        {onUpdateAssignment && (
                          <IconButton size="small" onClick={() => setEditingAssignment(assignment)} color="primary">
                            <Edit2 className="w-4 h-4" />
                          </IconButton>
                        )}
                        <IconButton size="small" onClick={() => handleDelete(assignment)} color="error">
                          <Trash2 className="w-4 h-4" />
                        </IconButton>
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
            )}
          </Box>
        </Paper>
      </Box>

      {/* Fatigue Analysis Section - FRI Results */}
      {showFRI && fatigueAnalysis && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Activity className="w-5 h-5" />
            Fatigue Risk Analysis
          </Typography>

          {/* FRI Summary Stats */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              FRI Summary
            </Typography>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Average FRI</Typography>
                <Typography
                  variant="h6"
                  fontWeight={700}
                  sx={{ color: fatigueAnalysis.avgFRI >= 1.2 ? 'error.main' : fatigueAnalysis.avgFRI >= 1.1 ? 'warning.main' : 'success.main' }}
                >
                  {fatigueAnalysis.avgFRI.toFixed(3)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Peak FRI</Typography>
                <Typography
                  variant="h6"
                  fontWeight={700}
                  sx={{ color: fatigueAnalysis.maxFRI >= 1.2 ? 'error.main' : fatigueAnalysis.maxFRI >= 1.1 ? 'warning.main' : 'success.main' }}
                >
                  {fatigueAnalysis.maxFRI.toFixed(3)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Shifts Analyzed</Typography>
                <Typography variant="h6" fontWeight={700}>
                  {fatigueAnalysis.results.length}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Critical Shifts</Typography>
                <Typography
                  variant="h6"
                  fontWeight={700}
                  sx={{ color: fatigueAnalysis.criticalShifts > 0 ? 'error.main' : 'success.main' }}
                >
                  {fatigueAnalysis.criticalShifts}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Elevated Shifts</Typography>
                <Typography
                  variant="h6"
                  fontWeight={700}
                  sx={{ color: fatigueAnalysis.elevatedShifts > 0 ? 'warning.main' : 'success.main' }}
                >
                  {fatigueAnalysis.elevatedShifts}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Per-Shift FRI Results */}
          {fatigueAnalysis.results.length > 0 && periodAssignments.length > 0 && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Per-Shift FRI Values
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {fatigueAnalysis.results.map((result, idx) => {
                  const assignment = periodAssignments[idx];
                  const pattern = assignment ? shiftPatterns.find(p => p.id === assignment.shiftPatternId) : null;
                  const startTime = assignment?.customStartTime || pattern?.startTime || '08:00';
                  const endTime = assignment?.customEndTime || pattern?.endTime || '18:00';
                  return (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1,
                        borderRadius: 1,
                        bgcolor: result.riskIndex >= 1.2 ? '#fef2f2' : result.riskIndex >= 1.1 ? '#fffbeb' : '#f0fdf4',
                        borderLeft: 3,
                        borderColor: result.riskIndex >= 1.2 ? 'error.main' : result.riskIndex >= 1.1 ? 'warning.main' : 'success.main',
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {assignment ? new Date(assignment.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : `Day ${result.day}`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {startTime} - {endTime}
                        </Typography>
                      </Box>
                      <Chip
                        label={`FRI: ${result.riskIndex.toFixed(3)}`}
                        size="small"
                        sx={{
                          ...getFRIChipSx(result.riskIndex),
                          fontWeight: 700,
                          fontSize: '0.75rem'
                        }}
                      />
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          )}
        </Box>
      )}

      {/* Assignment Edit Modal */}
      {editingAssignment && onUpdateAssignment && (
        <AssignmentEditModal
          assignment={editingAssignment}
          employee={employee}
          shiftPattern={shiftPatterns.find(p => p.id === editingAssignment.shiftPatternId) || shiftPatterns[0]}
          allShiftPatterns={shiftPatterns.filter(p => p.projectId === editingAssignment.projectId)}
          onClose={() => setEditingAssignment(null)}
          onSave={async (id, data) => {
            await onUpdateAssignment(id, data);
            setEditingAssignment(null);
          }}
          onDelete={async (id) => {
            await onDeleteAssignment(id);
            setEditingAssignment(null);
          }}
        />
      )}

      {/* Add Shift Modal */}
      {addShiftDate && onCreateAssignment && (
        <AddShiftModal
          open={true}
          onClose={() => setAddShiftDate(null)}
          employee={employee}
          date={addShiftDate}
          projects={projects}
          shiftPatterns={shiftPatterns}
          onAddShift={async (data) => {
            await onCreateAssignment(data);
            showSuccess(`Shift added for ${employee.name}`);
            setAddShiftDate(null);
          }}
        />
      )}

      {/* Fatigue Assessment Modal */}
      {assessmentViolation && (
        <FatigueAssessmentModal
          open={true}
          onClose={() => setAssessmentViolation(null)}
          onSave={async (assessment) => {
            try {
              if (onCreateFatigueAssessment) {
                await onCreateFatigueAssessment(assessment as FatigueAssessment);
                showSuccess('Fatigue assessment saved');
              } else {
                console.log('Assessment saved (local only):', assessment);
                showSuccess('Fatigue assessment saved (not persisted)');
              }
            } catch (err) {
              console.error('Failed to save assessment:', err);
              showError('Failed to save fatigue assessment');
            }
            setAssessmentViolation(null);
          }}
          employee={employee}
          violation={assessmentViolation}
          assessorName={user.email || ''}
        />
      )}
    </Box>
  );
}
