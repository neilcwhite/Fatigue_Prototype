'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import TextField from '@mui/material/TextField';
import Collapse from '@mui/material/Collapse';
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, XCircle, Trash2, Download, Clock, Calendar, BarChart, Settings, ChevronDown, ChevronUp, Edit2, Eye, EyeOff } from '@/components/ui/Icons';
import { AssignmentEditModal } from '@/components/modals/AssignmentEditModal';
import { checkEmployeeCompliance, type ComplianceViolation } from '@/lib/compliance';
import { parseTimeToHours, calculateDutyLength, calculateFatigueSequence, DEFAULT_FATIGUE_PARAMS } from '@/lib/fatigue';
import type { ShiftDefinition, FatigueResult } from '@/lib/types';
import { generateNetworkRailPeriods, getAvailableYears, findPeriodForDate } from '@/lib/periods';
import type { EmployeeCamel, AssignmentCamel, ShiftPatternCamel, ProjectCamel, SupabaseUser } from '@/lib/types';
import { SignOutHeader } from '@/components/auth/SignOutHeader';
import { getFRIChipColor, getFRILevel } from '@/lib/utils';

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
}

// Helper to get FRI chip colors for MUI
const getFRIChipSx = (fri: number | null | undefined) => {
  if (fri === null || fri === undefined) return { bgcolor: 'grey.200', color: 'grey.700' };
  if (fri >= 1.2) return { bgcolor: '#dc2626', color: 'white' };
  if (fri >= 1.1) return { bgcolor: '#f97316', color: 'white' };
  if (fri >= 1.0) return { bgcolor: '#eab308', color: 'white' };
  return { bgcolor: '#22c55e', color: 'white' };
};

// Helper to get NR compliance chip colors for MUI
const getNRComplianceChipSx = (severity: 'error' | 'warning' | null) => {
  if (severity === 'error') return { bgcolor: '#dc2626', color: 'white' };
  if (severity === 'warning') return { bgcolor: '#f59e0b', color: 'white' };
  return { bgcolor: '#22c55e', color: 'white' };
};

// Helper to get FRI cell background colors
const getFRICellSx = (fri: number | null | undefined) => {
  if (fri === null || fri === undefined) return { bgcolor: 'white', borderColor: 'grey.200' };
  if (fri >= 1.2) return { bgcolor: 'error.light', borderColor: 'error.main' };
  if (fri >= 1.1) return { bgcolor: 'warning.light', borderColor: 'warning.main' };
  if (fri >= 1.0) return { bgcolor: 'warning.50', borderColor: 'warning.300' };
  return { bgcolor: 'success.light', borderColor: 'success.light' };
};

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
}: PersonViewProps) {
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
    const shifts: ShiftDefinition[] = periodAssignments.map((a) => {
      const pattern = shiftPatterns.find(p => p.id === a.shiftPatternId);
      const startTime = a.customStartTime || pattern?.startTime || '08:00';
      const endTime = a.customEndTime || pattern?.endTime || '18:00';
      const periodStart = new Date(currentPeriod!.startDate);
      const assignmentDate = new Date(a.date);
      const dayNumber = Math.floor((assignmentDate.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      return {
        day: dayNumber,
        startTime,
        endTime,
        workload: pattern?.workload,
        attention: pattern?.attention,
        commuteIn: pattern?.commuteTime ? Math.floor(pattern.commuteTime / 2) : undefined,
        commuteOut: pattern?.commuteTime ? Math.ceil(pattern.commuteTime / 2) : undefined,
        breakFreq: pattern?.breakFrequency,
        breakLen: pattern?.breakLength,
      };
    });
    const results = calculateFatigueSequence(shifts);
    const maxFRI = Math.max(...results.map(r => r.riskIndex));
    const avgFRI = results.reduce((sum, r) => sum + r.riskIndex, 0) / results.length;
    const criticalShifts = results.filter(r => r.riskIndex >= 1.2).length;
    const elevatedShifts = results.filter(r => r.riskIndex >= 1.1 && r.riskIndex < 1.2).length;
    return { results, maxFRI, avgFRI, criticalShifts, elevatedShifts };
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
    const severityMap = new Map<number, 'error' | 'warning'>();
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
      violationAssignments.forEach(a => {
        const existingSeverity = severityMap.get(a.id);
        if (!existingSeverity || (existingSeverity === 'warning' && violation.severity === 'error')) {
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

  const hasCustomTimes = (assignment: AssignmentCamel, pattern: ShiftPatternCamel | undefined): boolean => {
    if (!pattern) return false;
    const hasCustomStart = assignment.customStartTime && assignment.customStartTime !== pattern.startTime;
    const hasCustomEnd = assignment.customEndTime && assignment.customEndTime !== pattern.endTime;
    return !!(hasCustomStart || hasCustomEnd);
  };

  const getAssignmentDisplayName = (assignment: AssignmentCamel, pattern: ShiftPatternCamel | undefined): string => {
    if (!pattern) return 'Unknown';
    if (hasCustomTimes(assignment, pattern)) return 'Custom';
    return pattern.name;
  };

  const formatDateHeader = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return {
      day: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      date: d.getDate(),
      month: d.toLocaleDateString('en-GB', { month: 'short' }),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isToday: dateStr === new Date().toISOString().split('T')[0],
    };
  };

  const handleDelete = async (assignment: AssignmentCamel) => {
    const { pattern } = getAssignmentInfo(assignment);
    if (confirm(`Remove ${employee.name} from ${pattern?.name || 'shift'} on ${assignment.date}?`)) {
      try {
        await onDeleteAssignment(assignment.id);
      } catch (err) {
        console.error('Error deleting assignment:', err);
        alert('Failed to delete assignment');
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

  const getViolationIcon = (type: string) => {
    switch (type) {
      case 'MAX_SHIFT_LENGTH': return '⏱️';
      case 'INSUFFICIENT_REST': return '😴';
      case 'MAX_WEEKLY_HOURS': return '📊';
      case 'APPROACHING_WEEKLY_LIMIT': return '⚠️';
      case 'MAX_CONSECUTIVE_DAYS': return '📅';
      case 'CONSECUTIVE_NIGHTS_WARNING': return '🌙';
      case 'MAX_CONSECUTIVE_NIGHTS': return '🌙';
      case 'DAY_NIGHT_TRANSITION': return '🔄';
      case 'MULTIPLE_SHIFTS_SAME_DAY': return '⚡';
      default: return '⚠️';
    }
  };

  const getViolationTitle = (type: string) => {
    switch (type) {
      case 'MAX_SHIFT_LENGTH': return 'Maximum Shift Length Exceeded';
      case 'INSUFFICIENT_REST': return 'Insufficient Rest Period';
      case 'MAX_WEEKLY_HOURS': return 'Maximum Weekly Hours Exceeded';
      case 'APPROACHING_WEEKLY_LIMIT': return 'Approaching Weekly Limit';
      case 'MAX_CONSECUTIVE_DAYS': return 'Too Many Consecutive Days';
      case 'CONSECUTIVE_NIGHTS_WARNING': return 'Extended Night Shift Run';
      case 'MAX_CONSECUTIVE_NIGHTS': return 'Too Many Consecutive Nights';
      case 'DAY_NIGHT_TRANSITION': return 'Day-Night Transition Same Day';
      case 'MULTIPLE_SHIFTS_SAME_DAY': return 'Multiple Shifts Same Day';
      default: return 'Compliance Issue';
    }
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
    } catch (err) {
      console.error('Failed to update pattern:', err);
      alert('Failed to save parameters');
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
        {/* Stats Cards */}
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Card sx={{ borderLeft: 4, borderColor: compliance.hasErrors ? 'error.main' : compliance.hasWarnings ? 'warning.main' : 'success.main' }}>
              <CardContent sx={{ py: 1.5, px: 2 }}>
                <Typography variant="caption" color="text.secondary">Compliance</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {compliance.hasErrors ? <XCircle className="w-4 h-4" /> : compliance.hasWarnings ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  <Typography variant="h5" fontWeight={700} sx={{ color: compliance.hasErrors ? 'error.main' : compliance.hasWarnings ? 'warning.main' : 'success.main' }}>
                    {compliance.violations.length}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">Issues</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Card>
              <CardContent sx={{ py: 1.5, px: 2 }}>
                <Typography variant="caption" color="text.secondary">Period Shifts</Typography>
                <Typography variant="h5" fontWeight={700}>{stats.totalShifts}</Typography>
                <Typography variant="caption" color="text.secondary">{stats.nightShifts} nights</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Card>
              <CardContent sx={{ py: 1.5, px: 2 }}>
                <Typography variant="caption" color="text.secondary">Period Hours</Typography>
                <Typography variant="h5" fontWeight={700}>{stats.totalHours}h</Typography>
                <Typography variant="caption" color="text.secondary">
                  {stats.totalShifts > 0 ? Math.round(stats.totalHours / stats.totalShifts * 10) / 10 : 0}h avg
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Card>
              <CardContent sx={{ py: 1.5, px: 2 }}>
                <Typography variant="caption" color="text.secondary">Projects</Typography>
                <Typography variant="h5" fontWeight={700}>{stats.uniqueProjects}</Typography>
              </CardContent>
            </Card>
          </Grid>

          {showFRI && (
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Card sx={{ borderLeft: 4, borderColor: fatigueAnalysis?.maxFRI && fatigueAnalysis.maxFRI >= 1.2 ? 'error.main' : fatigueAnalysis?.maxFRI && fatigueAnalysis.maxFRI >= 1.1 ? 'warning.main' : 'success.main' }}>
              <CardContent sx={{ py: 1.5, px: 2 }}>
                <Typography variant="caption" color="text.secondary">Max Fatigue Risk</Typography>
                {fatigueAnalysis ? (
                  <>
                    <Typography
                      variant="h5"
                      fontWeight={700}
                      sx={{ color: fatigueAnalysis.maxFRI >= 1.2 ? 'error.main' : fatigueAnalysis.maxFRI >= 1.1 ? 'warning.main' : 'success.main' }}
                    >
                      {fatigueAnalysis.maxFRI.toFixed(3)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {getFRILevel(fatigueAnalysis.maxFRI)} ({fatigueAnalysis.criticalShifts} critical)
                    </Typography>
                  </>
                ) : (
                  <Typography variant="h5" fontWeight={700} color="text.disabled">N/A</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          )}
        </Grid>

        {/* Fatigue Analysis Section */}
        {showFRI && fatigueAnalysis && fatigueAnalysis.results.length > 0 && (
          <Paper sx={{ mb: 2 }}>
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BarChart className="w-4 h-4" />
                <Typography variant="subtitle2" fontWeight={600}>Fatigue Risk Analysis (HSE RR446)</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Chip label="Low <1.0" size="small" sx={{ bgcolor: '#22c55e', color: 'white', fontSize: '0.6rem' }} />
                <Chip label="Mod 1.0-1.1" size="small" sx={{ bgcolor: '#eab308', color: 'white', fontSize: '0.6rem' }} />
                <Chip label="Elev 1.1-1.2" size="small" sx={{ bgcolor: '#f97316', color: 'white', fontSize: '0.6rem' }} />
                <Chip label="Crit ≥1.2" size="small" sx={{ bgcolor: '#dc2626', color: 'white', fontSize: '0.6rem' }} />
              </Box>
            </Box>
            <Box sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 3, mb: 2, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">Avg:</Typography>
                  <Chip label={fatigueAnalysis.avgFRI.toFixed(3)} size="small" sx={{ ...getFRIChipSx(fatigueAnalysis.avgFRI), fontWeight: 700, fontSize: '0.75rem' }} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">Max:</Typography>
                  <Chip label={fatigueAnalysis.maxFRI.toFixed(3)} size="small" sx={{ ...getFRIChipSx(fatigueAnalysis.maxFRI), fontWeight: 700, fontSize: '0.75rem' }} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">Elevated:</Typography>
                  <Typography variant="body2" fontWeight={700} color="warning.main">{fatigueAnalysis.elevatedShifts}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">Critical:</Typography>
                  <Typography variant="body2" fontWeight={700} color="error.main">{fatigueAnalysis.criticalShifts}</Typography>
                </Box>
              </Box>

              {/* Pattern Parameters */}
              {periodPatterns.length > 0 && (
                <Box>
                  <Box
                    onClick={() => setShowFatigueParams(!showFatigueParams)}
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', mb: 1 }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Settings className="w-4 h-4" />
                      <Typography variant="body2" fontWeight={500}>Shift Pattern Parameters</Typography>
                      <Typography variant="caption" color="text.secondary">({periodPatterns.length} pattern{periodPatterns.length > 1 ? 's' : ''})</Typography>
                    </Box>
                    {showFatigueParams ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Box>
                  <Collapse in={showFatigueParams}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                      {periodPatterns.map((pattern) => (
                        <Paper key={pattern.id} variant="outlined" sx={{ p: 1.5 }}>
                          {editingPatternId === pattern.id && editingParams ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2" fontWeight={600}>{pattern.name}</Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  <Button size="small" variant="contained" color="success" onClick={handleSaveParams}>Save</Button>
                                  <Button size="small" variant="outlined" onClick={handleCancelEdit}>Cancel</Button>
                                </Box>
                              </Box>
                              <Grid container spacing={1}>
                                <Grid size={{ xs: 2.4 }}>
                                  <TextField
                                    select
                                    size="small"
                                    label="Workload"
                                    value={editingParams.workload}
                                    onChange={(e) => setEditingParams({ ...editingParams, workload: parseInt(e.target.value) })}
                                    fullWidth
                                  >
                                    {[1, 2, 3, 4, 5].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                                  </TextField>
                                </Grid>
                                <Grid size={{ xs: 2.4 }}>
                                  <TextField
                                    select
                                    size="small"
                                    label="Attention"
                                    value={editingParams.attention}
                                    onChange={(e) => setEditingParams({ ...editingParams, attention: parseInt(e.target.value) })}
                                    fullWidth
                                  >
                                    {[1, 2, 3, 4, 5].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                                  </TextField>
                                </Grid>
                                <Grid size={{ xs: 2.4 }}>
                                  <TextField
                                    type="number"
                                    size="small"
                                    label="Commute"
                                    value={editingParams.commuteTime}
                                    onChange={(e) => setEditingParams({ ...editingParams, commuteTime: parseInt(e.target.value) || 0 })}
                                    fullWidth
                                    slotProps={{ htmlInput: { min: 0, max: 180 } }}
                                  />
                                </Grid>
                                <Grid size={{ xs: 2.4 }}>
                                  <TextField
                                    type="number"
                                    size="small"
                                    label="Break Freq"
                                    value={editingParams.breakFrequency}
                                    onChange={(e) => setEditingParams({ ...editingParams, breakFrequency: parseInt(e.target.value) || 180 })}
                                    fullWidth
                                    slotProps={{ htmlInput: { min: 30, max: 480 } }}
                                  />
                                </Grid>
                                <Grid size={{ xs: 2.4 }}>
                                  <TextField
                                    type="number"
                                    size="small"
                                    label="Break Len"
                                    value={editingParams.breakLength}
                                    onChange={(e) => setEditingParams({ ...editingParams, breakLength: parseInt(e.target.value) || 30 })}
                                    fullWidth
                                    slotProps={{ htmlInput: { min: 5, max: 60 } }}
                                  />
                                </Grid>
                              </Grid>
                            </Box>
                          ) : (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2" fontWeight={600}>{pattern.name}</Typography>
                                  {pattern.isNight && <Typography>🌙</Typography>}
                                  <Typography variant="caption" color="text.secondary">({pattern.assignmentCount} shift{pattern.assignmentCount > 1 ? 's' : ''})</Typography>
                                  {pattern.avgFRI > 0 && (
                                    <Chip
                                      size="small"
                                      label={`FRI: ${pattern.avgFRI.toFixed(3)} (max ${pattern.maxFRI.toFixed(3)})`}
                                      sx={{ ...getFRIChipSx(pattern.maxFRI), fontSize: '0.6rem', ml: 1 }}
                                    />
                                  )}
                                </Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                                  <span>Workload: <strong>{pattern.workload ?? DEFAULT_FATIGUE_PARAMS.workload}</strong>/5</span>
                                  <span>Attention: <strong>{pattern.attention ?? DEFAULT_FATIGUE_PARAMS.attention}</strong>/5</span>
                                  <span>Commute: <strong>{pattern.commuteTime ?? DEFAULT_FATIGUE_PARAMS.commuteTime}</strong>min</span>
                                  <span>Breaks: <strong>{pattern.breakFrequency ?? DEFAULT_FATIGUE_PARAMS.breakFrequency}</strong>/{pattern.breakLength ?? DEFAULT_FATIGUE_PARAMS.breakLength}min</span>
                                </Typography>
                              </Box>
                              {onUpdateShiftPattern && (
                                <Button size="small" variant="outlined" startIcon={<Settings className="w-3 h-3" />} onClick={() => handleStartEdit(pattern)}>
                                  Edit
                                </Button>
                              )}
                            </Box>
                          )}
                        </Paper>
                      ))}
                    </Box>
                  </Collapse>
                </Box>
              )}
            </Box>
          </Paper>
        )}

        {/* Compliance Violations */}
        {compliance.violations.length > 0 && (
          <Paper sx={{ mb: 2 }}>
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
              <AlertTriangle className="w-4 h-4" />
              <Typography variant="subtitle2" fontWeight={600}>Compliance Violations ({compliance.violations.length})</Typography>
            </Box>
            <Box sx={{ p: 1.5, maxHeight: 200, overflow: 'auto' }}>
              {compliance.violations.map((violation, idx) => (
                <Box
                  key={idx}
                  onClick={() => handleViolationClick(violation)}
                  sx={{
                    p: 1,
                    mb: 1,
                    borderRadius: 1,
                    cursor: 'pointer',
                    borderLeft: 4,
                    borderColor: violation.severity === 'error' ? 'error.main' : 'warning.main',
                    bgcolor: violation.severity === 'error' ? 'error.light' : 'warning.light',
                    '&:hover': { boxShadow: 2 },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    {violation.severity === 'error' ? <XCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    <Box>
                      <Typography variant="caption" fontWeight={600} sx={{ color: violation.severity === 'error' ? 'error.dark' : 'warning.dark' }}>
                        {getViolationIcon(violation.type)} {getViolationTitle(violation.type)}
                      </Typography>
                      <Typography variant="caption" display="block" sx={{ color: violation.severity === 'error' ? 'error.dark' : 'warning.dark' }}>
                        {violation.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(violation.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        <Box component="span" sx={{ color: 'primary.main', ml: 1 }}>→ Click to view</Box>
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        )}

        {/* Schedule Calendar Grid */}
        <Paper id="schedule-calendar" sx={{ mb: 2, scrollMarginTop: 16 }}>
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Calendar className="w-4 h-4" />
              <Typography variant="subtitle2" fontWeight={600}>Schedule - {currentPeriod?.name}</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.65rem' }}>
                <Typography variant="caption" fontWeight={500} color="text.secondary">Chip (NR):</Typography>
                <Chip label="Error" size="small" sx={{ bgcolor: '#dc2626', color: 'white', fontSize: '0.6rem', height: 18 }} />
                <Chip label="Warning" size="small" sx={{ bgcolor: '#f59e0b', color: 'white', fontSize: '0.6rem', height: 18 }} />
                <Chip label="OK" size="small" sx={{ bgcolor: '#22c55e', color: 'white', fontSize: '0.6rem', height: 18 }} />
              </Box>
              {showFRI && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.65rem' }}>
                <Typography variant="caption" fontWeight={500} color="text.secondary">Cell (FRI):</Typography>
                <Chip label="<1.0" size="small" sx={{ bgcolor: 'success.light', fontSize: '0.6rem', height: 18 }} />
                <Chip label="1.0-1.1" size="small" sx={{ bgcolor: 'warning.50', fontSize: '0.6rem', height: 18 }} />
                <Chip label="1.1-1.2" size="small" sx={{ bgcolor: 'warning.light', fontSize: '0.6rem', height: 18 }} />
                <Chip label="≥1.2" size="small" sx={{ bgcolor: 'error.light', fontSize: '0.6rem', height: 18 }} />
              </Box>
              )}
            </Box>
          </Box>
          <Box sx={{ p: 1.5, overflow: 'auto' }}>
            {/* Day Headers */}
            <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
              {/* Empty space for month column */}
              <Box sx={{ width: 40, minWidth: 40 }} />
              <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
                {calendarDayHeaders.map(day => (
                  <Typography key={day} variant="caption" fontWeight={600} textAlign="center" color="text.secondary">
                    {day}
                  </Typography>
                ))}
              </Box>
            </Box>

            {/* Calendar Grid */}
            {[0, 1, 2, 3].map(weekIdx => {
              // Get month name from first day of the week
              const weekDates = calendarDates.slice(weekIdx * 7, (weekIdx + 1) * 7);
              const firstDateOfWeek = weekDates[0];
              const weekMonthName = firstDateOfWeek ? formatDateHeader(firstDateOfWeek).month : '';
              return (
              <Box key={weekIdx} sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
                {/* Month label column */}
                <Box sx={{ width: 40, minWidth: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                    {weekMonthName}
                  </Typography>
                </Box>
                {/* Week days */}
                <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
                {weekDates.map((date) => {
                  const { date: dateNum, isWeekend, isToday } = formatDateHeader(date);
                  const dateAssignments = periodAssignments.filter(a => a.date === date);
                  const dateViolationSeverity = dateAssignments.reduce<'error' | 'warning' | null>((worst, a) => {
                    const severity = violationAssignmentSeverity.get(a.id);
                    if (!severity) return worst;
                    if (severity === 'error') return 'error';
                    if (!worst) return severity;
                    return worst;
                  }, null);
                  const dateAssignmentIndices = periodAssignments.map((a, idx) => a.date === date ? idx : -1).filter(i => i !== -1);
                  const dateFRI = dateAssignmentIndices.length > 0 && fatigueAnalysis
                    ? Math.max(...dateAssignmentIndices.map(i => fatigueAnalysis.results[i]?.riskIndex || 0))
                    : null;
                  const isHighlighted = highlightedDate === date;
                  const hasAssignments = dateAssignments.length > 0;
                  const isNRCompliant = hasAssignments && !dateViolationSeverity;

                  return (
                    <Box
                      key={date}
                      sx={{
                        minHeight: 80,
                        p: 0.75,
                        borderRadius: 1,
                        border: 2,
                        transition: 'all 0.2s',
                        ...(isHighlighted
                          ? { bgcolor: 'primary.light', borderColor: 'primary.main', boxShadow: 4, transform: 'scale(1.02)', zIndex: 10, animation: 'pulse 1s infinite' }
                          : showFRI && hasAssignments && dateFRI !== null
                          ? getFRICellSx(dateFRI)
                          : isWeekend
                          ? { bgcolor: 'grey.100', borderColor: 'grey.200' }
                          : isToday
                          ? { bgcolor: 'primary.50', borderColor: 'primary.light' }
                          : { bgcolor: 'white', borderColor: 'grey.200' }),
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                        <Typography variant="caption" fontWeight={600} sx={{ color: isToday ? 'primary.main' : 'text.primary' }}>
                          {dateNum}
                        </Typography>
                        {showFRI && dateFRI !== null && (
                          <Chip
                            label={dateFRI.toFixed(3)}
                            size="small"
                            sx={{ ...getFRIChipSx(dateFRI), fontSize: '0.55rem', height: 16, fontWeight: 700 }}
                          />
                        )}
                      </Box>

                      {dateAssignments.length === 0 ? (
                        <Typography variant="caption" color="text.disabled" textAlign="center" display="block">-</Typography>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {dateAssignments.map(assignment => {
                            const { pattern, project } = getAssignmentInfo(assignment);
                            const assignmentViolation = violationAssignmentSeverity.get(assignment.id) || null;
                            return (
                              <Box
                                key={assignment.id}
                                sx={{
                                  position: 'relative',
                                  borderRadius: 0.5,
                                  p: 0.5,
                                  ...getNRComplianceChipSx(assignmentViolation),
                                }}
                              >
                                <Box sx={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: 0.25 }}>
                                  {onUpdateAssignment && (
                                    <IconButton size="small" onClick={() => setEditingAssignment(assignment)} sx={{ p: 0.25, color: 'inherit', opacity: 0.8, '&:hover': { opacity: 1 } }}>
                                      <Edit2 className="w-2.5 h-2.5" />
                                    </IconButton>
                                  )}
                                  <IconButton size="small" onClick={() => handleDelete(assignment)} sx={{ p: 0.25, color: 'inherit', opacity: 0.8, '&:hover': { opacity: 1 } }}>
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </IconButton>
                                </Box>
                                <Typography variant="caption" fontWeight={500} noWrap sx={{ pr: 4, display: 'block', fontSize: '0.6rem' }}>
                                  {project?.name || 'Unknown'}
                                </Typography>
                                <Typography variant="caption" fontWeight={500} noWrap sx={{ pr: 4, display: 'block', fontSize: '0.6rem' }}>
                                  {getAssignmentDisplayName(assignment, pattern)}
                                </Typography>
                                <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.55rem' }}>
                                  {assignment.customStartTime || pattern?.startTime || '?'}-{assignment.customEndTime || pattern?.endTime || '?'}
                                </Typography>
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                    </Box>
                  );
                })}
                </Box>
              </Box>
            );
            })}
          </Box>
        </Paper>

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
                        borderColor: assignmentViolationSeverity === 'error' ? 'error.main' : assignmentViolationSeverity === 'warning' ? 'warning.main' : 'transparent',
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
    </Box>
  );
}
