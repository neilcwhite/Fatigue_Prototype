'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, XCircle, Trash2, Download, Clock, Calendar, BarChart, Settings, ChevronDown, ChevronUp } from '@/components/ui/Icons';
import { checkEmployeeCompliance, type ComplianceViolation } from '@/lib/compliance';
import { parseTimeToHours, calculateDutyLength, calculateFatigueSequence, DEFAULT_FATIGUE_PARAMS } from '@/lib/fatigue';
import type { ShiftDefinition, FatigueResult } from '@/lib/types';
import { generateNetworkRailPeriods, getAvailableYears, findPeriodForDate } from '@/lib/periods';
import type { EmployeeCamel, AssignmentCamel, ShiftPatternCamel, ProjectCamel, SupabaseUser } from '@/lib/types';
import { SignOutHeader } from '@/components/auth/SignOutHeader';
import { getFRIColor, getFRILevel } from '@/lib/utils';

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
  onUpdateShiftPattern?: (id: string, data: Partial<ShiftPatternCamel>) => Promise<void>;
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
  onUpdateShiftPattern,
}: PersonViewProps) {
  // Calculate initial year and period based on today's date
  const initialPeriodInfo = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const currentPeriod = findPeriodForDate(today);

    if (currentPeriod) {
      const periods = generateNetworkRailPeriods(currentPeriod.year);
      const periodIdx = periods.findIndex(p => p.period === currentPeriod.period);
      return {
        year: currentPeriod.year,
        periodIdx: periodIdx !== -1 ? periodIdx : 0
      };
    }

    // Fallback to current calendar year, period 0
    return { year: new Date().getFullYear(), periodIdx: 0 };
  }, []);

  // Period selection - initialized to current period
  const [selectedYear, setSelectedYear] = useState(initialPeriodInfo.year);
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(initialPeriodInfo.periodIdx);
  const [highlightedDate, setHighlightedDate] = useState<string | null>(null);

  // Fatigue parameters UI state - expanded by default
  const [showFatigueParams, setShowFatigueParams] = useState(true);
  const [editingPatternId, setEditingPatternId] = useState<string | null>(null);
  const [editingParams, setEditingParams] = useState<{
    workload: number;
    attention: number;
    commuteTime: number;
    breakFrequency: number;
    breakLength: number;
  } | null>(null);

  const networkRailPeriods = useMemo(() => generateNetworkRailPeriods(selectedYear), [selectedYear]);
  const availableYears = getAvailableYears();
  const currentPeriod = networkRailPeriods[selectedPeriodIdx];

  // Get this employee's assignments
  const empAssignments = useMemo(() => {
    return assignments
      .filter(a => a.employeeId === employee.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [assignments, employee.id]);

  // Filter assignments for current period
  const periodAssignments = useMemo(() => {
    if (!currentPeriod) return [];
    return empAssignments.filter(a =>
      a.date >= currentPeriod.startDate && a.date <= currentPeriod.endDate
    );
  }, [empAssignments, currentPeriod]);

  // Run compliance checks
  const compliance = useMemo(() =>
    checkEmployeeCompliance(employee.id, assignments, shiftPatterns),
    [employee.id, assignments, shiftPatterns]
  );

  // Calculate fatigue risk for period assignments
  const fatigueAnalysis = useMemo(() => {
    if (periodAssignments.length === 0) return null;

    // Convert assignments to ShiftDefinitions with pattern-specific fatigue parameters
    const shifts: ShiftDefinition[] = periodAssignments.map((a, idx) => {
      const pattern = shiftPatterns.find(p => p.id === a.shiftPatternId);
      const startTime = a.customStartTime || pattern?.startTime || '08:00';
      const endTime = a.customEndTime || pattern?.endTime || '18:00';

      // Calculate day number from period start
      const periodStart = new Date(currentPeriod!.startDate);
      const assignmentDate = new Date(a.date);
      const dayNumber = Math.floor((assignmentDate.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;

      return {
        day: dayNumber,
        startTime,
        endTime,
        // Include pattern-specific fatigue parameters
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

    return {
      results,
      maxFRI,
      avgFRI,
      criticalShifts,
      elevatedShifts,
    };
  }, [periodAssignments, shiftPatterns, currentPeriod]);

  // Get unique shift patterns used in this period with their fatigue parameters and average FRI
  const periodPatterns = useMemo(() => {
    const patternIds = [...new Set(periodAssignments.map(a => a.shiftPatternId))];
    return patternIds.map(id => {
      const pattern = shiftPatterns.find(p => p.id === id);
      const patternAssignmentIndices = periodAssignments
        .map((a, idx) => a.shiftPatternId === id ? idx : -1)
        .filter(i => i !== -1);
      const assignmentCount = patternAssignmentIndices.length;

      // Calculate average FRI for this pattern's assignments
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

  // Build map of assignment IDs to their violation severity (error takes precedence over warning)
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

        violationAssignments = empAssignments.filter(a =>
          a.date === violation.date || a.date === prevDateStr
        );
      } else if (violation.type === 'MAX_CONSECUTIVE_DAYS' || violation.type === 'MAX_CONSECUTIVE_NIGHTS' || violation.type === 'CONSECUTIVE_NIGHTS_WARNING') {
        if (violation.relatedDates) {
          violationAssignments = empAssignments.filter(a =>
            violation.relatedDates?.includes(a.date) || a.date === violation.date
          );
        } else {
          violationAssignments = empAssignments.filter(a => a.date === violation.date);
        }
      } else {
        violationAssignments = empAssignments.filter(a => a.date === violation.date);
      }

      violationAssignments.forEach(a => {
        const existingSeverity = severityMap.get(a.id);
        // Error takes precedence over warning
        if (!existingSeverity || (existingSeverity === 'warning' && violation.severity === 'error')) {
          severityMap.set(a.id, violation.severity);
        }
      });
    });

    return severityMap;
  }, [compliance.violations, empAssignments]);

  // Keep a simple set for backward compatibility checks
  const violationAssignmentIds = useMemo(() => {
    return new Set(violationAssignmentSeverity.keys());
  }, [violationAssignmentSeverity]);

  // Generate 28 days for current period
  const calendarDates = useMemo(() => {
    if (!currentPeriod) return [];
    const dates: string[] = [];
    const startDate = new Date(currentPeriod.startDate);

    for (let i = 0; i < 28; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  }, [currentPeriod]);

  // Generate day headers based on the actual start day of the period
  const calendarDayHeaders = useMemo(() => {
    if (!currentPeriod) return ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const startDate = new Date(currentPeriod.startDate);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const headers: string[] = [];
    for (let i = 0; i < 7; i++) {
      const dayOfWeek = (startDate.getDay() + i) % 7;
      headers.push(dayNames[dayOfWeek]);
    }
    return headers;
  }, [currentPeriod]);

  // Calculate stats for the period
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

  const formatDateHeader = (dateStr: string) => {
    const d = new Date(dateStr);
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
      setSelectedPeriodIdx(12); // Last period of previous year
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

  // Navigate to violation date
  const handleViolationClick = (violation: ComplianceViolation) => {
    const violationDate = violation.date;

    // Find which period contains this date
    const period = findPeriodForDate(violationDate);
    if (!period) return;

    // Set the year if different
    if (period.year !== selectedYear) {
      setSelectedYear(period.year);
    }

    // Find the period index for this year
    const yearPeriods = generateNetworkRailPeriods(period.year);
    const periodIdx = yearPeriods.findIndex(p => p.period === period.period);

    if (periodIdx !== -1) {
      setSelectedPeriodIdx(periodIdx);
    }

    // Highlight the violation date
    setHighlightedDate(violationDate);

    // Clear highlight after 3 seconds
    setTimeout(() => setHighlightedDate(null), 3000);

    // Scroll to calendar section
    const calendarSection = document.getElementById('schedule-calendar');
    if (calendarSection) {
      calendarSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Export employee schedule
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
        pattern?.name || 'Unknown',
        a.customStartTime || pattern?.startTime || '',
        a.customEndTime || pattern?.endTime || '',
        project?.name || 'Unknown',
        fri ? fri.toFixed(3) : 'N/A',
      ]);
    });

    // Add summary
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

  // Start editing fatigue parameters for a pattern
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

  // Save edited fatigue parameters
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

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingPatternId(null);
    setEditingParams(null);
  };

  // Check if a value is using default
  const isDefault = (value: number | undefined, defaultValue: number) => value === undefined || value === defaultValue;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 border-b-4 border-orange-500">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-md text-sm flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <span className="text-white font-semibold text-lg">{employee.name}</span>
              <span className="text-slate-500 text-sm ml-3">{employee.role}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={employee.id}
              onChange={(e) => onSelectEmployee(Number(e.target.value))}
              className="bg-slate-700 text-white border-none px-3 py-1.5 rounded text-sm"
            >
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
            <span className="bg-slate-700 text-orange-400 px-3 py-1 rounded text-xs font-mono">PERSON VIEW</span>
            <SignOutHeader user={user} onSignOut={onSignOut} />
          </div>
        </div>
      </header>

      {/* Period Navigation */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value));
                setSelectedPeriodIdx(0);
              }}
              className="border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white text-slate-900"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}/{year + 1}</option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPeriod}
                className="p-1.5 rounded hover:bg-slate-100"
                title="Previous period"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>

              <select
                value={selectedPeriodIdx}
                onChange={(e) => setSelectedPeriodIdx(Number(e.target.value))}
                className="border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white text-slate-900 min-w-[250px]"
              >
                {networkRailPeriods.map((period, idx) => (
                  <option key={period.name} value={idx}>
                    {period.name} ({period.startDate} - {period.endDate})
                  </option>
                ))}
              </select>

              <button
                onClick={handleNextPeriod}
                className="p-1.5 rounded hover:bg-slate-100"
                title="Next period"
              >
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={periodAssignments.length === 0}
            className="px-3 py-1.5 rounded text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <Download className="w-4 h-4" />
            Export Schedule
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-3">
          <div className={`bg-white rounded-lg shadow p-3 ${compliance.hasErrors ? 'border-l-4 border-red-500' : compliance.hasWarnings ? 'border-l-4 border-amber-500' : 'border-l-4 border-green-500'}`}>
            <p className="text-xs text-slate-600">Compliance</p>
            <div className="flex items-center gap-2">
              {compliance.hasErrors ? <XCircle className="w-4 h-4 text-red-500" /> : compliance.hasWarnings ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : <CheckCircle className="w-4 h-4 text-green-500" />}
              <span className={`text-lg font-bold ${compliance.hasErrors ? 'text-red-600' : compliance.hasWarnings ? 'text-amber-600' : 'text-green-600'}`}>
                {compliance.violations.length}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">Issues</p>
          </div>

          <div className="bg-white rounded-lg shadow p-3">
            <p className="text-xs text-slate-600">Period Shifts</p>
            <p className="text-lg font-bold text-slate-900">{stats.totalShifts}</p>
            <p className="text-[10px] text-slate-500">{stats.nightShifts} nights</p>
          </div>

          <div className="bg-white rounded-lg shadow p-3">
            <p className="text-xs text-slate-600">Period Hours</p>
            <p className="text-lg font-bold text-slate-900">{stats.totalHours}h</p>
            <p className="text-[10px] text-slate-500">{stats.totalShifts > 0 ? Math.round(stats.totalHours / stats.totalShifts * 10) / 10 : 0}h avg</p>
          </div>

          <div className="bg-white rounded-lg shadow p-3">
            <p className="text-xs text-slate-600">Projects</p>
            <p className="text-lg font-bold text-slate-900">{stats.uniqueProjects}</p>
          </div>

          {/* Fatigue Risk Card */}
          <div className={`bg-white rounded-lg shadow p-3 ${
            fatigueAnalysis?.maxFRI && fatigueAnalysis.maxFRI >= 1.2
              ? 'border-l-4 border-red-500'
              : fatigueAnalysis?.maxFRI && fatigueAnalysis.maxFRI >= 1.1
                ? 'border-l-4 border-amber-500'
                : 'border-l-4 border-green-500'
          }`}>
            <p className="text-xs text-slate-600">Max Fatigue Risk</p>
            {fatigueAnalysis ? (
              <>
                <p className={`text-lg font-bold ${fatigueAnalysis.maxFRI >= 1.2 ? 'text-red-600' : fatigueAnalysis.maxFRI >= 1.1 ? 'text-amber-600' : 'text-green-600'}`}>
                  {fatigueAnalysis.maxFRI.toFixed(2)}
                </p>
                <p className="text-[10px] text-slate-500">
                  {getFRILevel(fatigueAnalysis.maxFRI)} ({fatigueAnalysis.criticalShifts} critical)
                </p>
              </>
            ) : (
              <p className="text-lg font-bold text-slate-400">N/A</p>
            )}
          </div>
        </div>

        {/* Fatigue Analysis Section */}
        {fatigueAnalysis && fatigueAnalysis.results.length > 0 && (
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart className="w-4 h-4 text-purple-500" />
                <h3 className="font-semibold text-slate-800 text-sm">Fatigue Risk Analysis (HSE RR446)</h3>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">Low &lt;1.0</span>
                <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">Mod 1.0-1.1</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Elev 1.1-1.2</span>
                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700">Crit &ge;1.2</span>
              </div>
            </div>
            <div className="p-3">
              {/* Compact FRI Summary Row */}
              <div className="flex items-center gap-4 mb-3 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Avg:</span>
                  <span className={`text-sm font-bold ${getFRIColor(fatigueAnalysis.avgFRI).split(' ')[0]}`}>
                    {fatigueAnalysis.avgFRI.toFixed(3)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Max:</span>
                  <span className={`text-sm font-bold ${getFRIColor(fatigueAnalysis.maxFRI).split(' ')[0]}`}>
                    {fatigueAnalysis.maxFRI.toFixed(3)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Elevated:</span>
                  <span className="text-sm font-bold text-amber-600">{fatigueAnalysis.elevatedShifts}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Critical:</span>
                  <span className="text-sm font-bold text-red-600">{fatigueAnalysis.criticalShifts}</span>
                </div>
              </div>

              {/* Shift Pattern Fatigue Parameters - Expanded by Default */}
              {periodPatterns.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowFatigueParams(!showFatigueParams)}
                    className="flex items-center justify-between w-full text-left mb-2"
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-700">Shift Pattern Parameters</span>
                      <span className="text-xs text-slate-500">({periodPatterns.length} pattern{periodPatterns.length > 1 ? 's' : ''})</span>
                    </div>
                    {showFatigueParams ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {showFatigueParams && (
                    <div className="mt-3 space-y-2">
                      {periodPatterns.map((pattern) => (
                        <div key={pattern.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                          {editingPatternId === pattern.id && editingParams ? (
                            // Edit mode
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-slate-800">{pattern.name}</span>
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleSaveParams}
                                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="px-2 py-1 text-xs bg-slate-300 text-slate-700 rounded hover:bg-slate-400"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-5 gap-2">
                                <div>
                                  <label className="text-[10px] text-slate-500 block">Workload</label>
                                  <select
                                    value={editingParams.workload}
                                    onChange={(e) => setEditingParams({ ...editingParams, workload: parseInt(e.target.value) })}
                                    className="w-full border rounded px-1.5 py-1 text-xs bg-white text-slate-900"
                                  >
                                    {[1, 2, 3, 4, 5].map(n => (
                                      <option key={n} value={n}>{n}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] text-slate-500 block">Attention</label>
                                  <select
                                    value={editingParams.attention}
                                    onChange={(e) => setEditingParams({ ...editingParams, attention: parseInt(e.target.value) })}
                                    className="w-full border rounded px-1.5 py-1 text-xs bg-white text-slate-900"
                                  >
                                    {[1, 2, 3, 4, 5].map(n => (
                                      <option key={n} value={n}>{n}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] text-slate-500 block">Commute (min)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="180"
                                    value={editingParams.commuteTime}
                                    onChange={(e) => setEditingParams({ ...editingParams, commuteTime: parseInt(e.target.value) || 0 })}
                                    className="w-full border rounded px-1.5 py-1 text-xs bg-white text-slate-900"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-slate-500 block">Break Freq</label>
                                  <input
                                    type="number"
                                    min="30"
                                    max="480"
                                    value={editingParams.breakFrequency}
                                    onChange={(e) => setEditingParams({ ...editingParams, breakFrequency: parseInt(e.target.value) || 180 })}
                                    className="w-full border rounded px-1.5 py-1 text-xs bg-white text-slate-900"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-slate-500 block">Break Len</label>
                                  <input
                                    type="number"
                                    min="5"
                                    max="60"
                                    value={editingParams.breakLength}
                                    onChange={(e) => setEditingParams({ ...editingParams, breakLength: parseInt(e.target.value) || 30 })}
                                    className="w-full border rounded px-1.5 py-1 text-xs bg-white text-slate-900"
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            // Display mode
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-800 text-sm">{pattern.name}</span>
                                  {pattern.isNight && <span className="text-purple-600">🌙</span>}
                                  <span className="text-[10px] text-slate-400">({pattern.assignmentCount} shift{pattern.assignmentCount > 1 ? 's' : ''})</span>
                                  {/* FRI indicator for this pattern */}
                                  {pattern.avgFRI > 0 && (
                                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${getFRIColor(pattern.maxFRI)}`}>
                                      FRI: {pattern.avgFRI.toFixed(2)} (max {pattern.maxFRI.toFixed(2)})
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-slate-600">
                                  <span>
                                    Workload: <strong>{pattern.workload ?? DEFAULT_FATIGUE_PARAMS.workload}</strong>/5
                                    {isDefault(pattern.workload, DEFAULT_FATIGUE_PARAMS.workload) && <span className="text-slate-400 ml-0.5">(def)</span>}
                                  </span>
                                  <span>
                                    Attention: <strong>{pattern.attention ?? DEFAULT_FATIGUE_PARAMS.attention}</strong>/5
                                    {isDefault(pattern.attention, DEFAULT_FATIGUE_PARAMS.attention) && <span className="text-slate-400 ml-0.5">(def)</span>}
                                  </span>
                                  <span>
                                    Commute: <strong>{pattern.commuteTime ?? DEFAULT_FATIGUE_PARAMS.commuteTime}</strong>min
                                    {isDefault(pattern.commuteTime, DEFAULT_FATIGUE_PARAMS.commuteTime) && <span className="text-slate-400 ml-0.5">(def)</span>}
                                  </span>
                                  <span>
                                    Breaks: <strong>{pattern.breakFrequency ?? DEFAULT_FATIGUE_PARAMS.breakFrequency}</strong>min / <strong>{pattern.breakLength ?? DEFAULT_FATIGUE_PARAMS.breakLength}</strong>min
                                  </span>
                                </div>
                              </div>
                              {onUpdateShiftPattern && (
                                <button
                                  onClick={() => handleStartEdit(pattern)}
                                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1"
                                >
                                  <Settings className="w-3 h-3" />
                                  Edit
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Compliance Violations Section */}
        {compliance.violations.length > 0 && (
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-3 border-b border-slate-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h3 className="font-semibold text-slate-800 text-sm">Compliance Violations ({compliance.violations.length})</h3>
            </div>
            <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
              {compliance.violations.map((violation, idx) => (
                <button
                  key={idx}
                  onClick={() => handleViolationClick(violation)}
                  className={`w-full text-left p-2 rounded-lg cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] ${violation.severity === 'error' ? 'bg-red-50 border-l-4 border-red-500 hover:bg-red-100' : 'bg-amber-50 border-l-4 border-amber-500 hover:bg-amber-100'}`}
                >
                  <div className="flex items-start gap-2">
                    {violation.severity === 'error' ? <XCircle className="w-3 h-3 text-red-500 mt-0.5" /> : <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5" />}
                    <div className="flex-1">
                      <p className={`font-medium text-xs ${violation.severity === 'error' ? 'text-red-900' : 'text-amber-900'}`}>
                        {getViolationIcon(violation.type)} {getViolationTitle(violation.type)}
                      </p>
                      <p className={`text-[10px] ${violation.severity === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
                        {violation.message}
                      </p>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1">
                        {new Date(violation.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        <span className="text-blue-500 ml-1">→ Click to view</span>
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Schedule Calendar Grid */}
        <div id="schedule-calendar" className="bg-white rounded-lg shadow-md scroll-mt-4">
          <div className="p-3 border-b border-slate-200 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" />
            <h3 className="font-semibold text-slate-800 text-sm">Schedule - {currentPeriod?.name}</h3>
          </div>
          <div className="p-3 overflow-x-auto">
            {/* Week Headers - dynamic based on period start day */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {calendarDayHeaders.map(day => (
                <div key={day} className="text-center text-[10px] font-semibold text-slate-600 py-0.5">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid - 4 weeks */}
            {[0, 1, 2, 3].map(weekIdx => (
              <div key={weekIdx} className="grid grid-cols-7 gap-1 mb-1">
                {calendarDates.slice(weekIdx * 7, (weekIdx + 1) * 7).map((date, dayIdx) => {
                  const { day, date: dateNum, month, isWeekend, isToday } = formatDateHeader(date);
                  const dateAssignments = periodAssignments.filter(a => a.date === date);

                  // Get the worst violation severity for this date (error > warning)
                  const dateViolationSeverity = dateAssignments.reduce<'error' | 'warning' | null>((worst, a) => {
                    const severity = violationAssignmentSeverity.get(a.id);
                    if (!severity) return worst;
                    if (severity === 'error') return 'error';
                    if (!worst) return severity;
                    return worst;
                  }, null);

                  // Get fatigue data for this date
                  const dateAssignmentIndices = periodAssignments.map((a, idx) => a.date === date ? idx : -1).filter(i => i !== -1);
                  const dateFRI = dateAssignmentIndices.length > 0 && fatigueAnalysis
                    ? Math.max(...dateAssignmentIndices.map(i => fatigueAnalysis.results[i]?.riskIndex || 0))
                    : null;

                  const isHighlighted = highlightedDate === date;

                  return (
                    <div
                      key={date}
                      className={`min-h-[80px] p-1.5 rounded-lg border transition-all ${
                        isHighlighted
                          ? 'ring-4 ring-blue-500 ring-offset-2 animate-pulse bg-blue-100 border-blue-500 scale-105 z-10'
                          : dateViolationSeverity === 'error'
                            ? 'bg-red-100 border-red-400'
                            : dateViolationSeverity === 'warning'
                              ? 'bg-amber-100 border-amber-400'
                              : dateAssignments.length > 0
                                ? dateFRI && dateFRI >= 1.2
                                  ? 'bg-red-50 border-red-300'
                                  : dateFRI && dateFRI >= 1.1
                                    ? 'bg-amber-50 border-amber-300'
                                    : 'bg-green-50 border-green-300'
                                : isWeekend
                                  ? 'bg-slate-100 border-slate-200'
                                  : isToday
                                    ? 'bg-blue-50 border-blue-300'
                                    : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-[10px] font-semibold ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                          {dateNum}
                        </span>
                        {dateFRI !== null && (
                          <span className={`text-[8px] px-0.5 rounded ${getFRIColor(dateFRI)}`}>
                            {dateFRI.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {dateAssignments.length === 0 ? (
                        <div className="text-[9px] text-slate-400 text-center py-1">-</div>
                      ) : (
                        <div className="space-y-1">
                          {dateAssignments.map(assignment => {
                            const { pattern, project } = getAssignmentInfo(assignment);
                            const shiftViolationSeverity = violationAssignmentSeverity.get(assignment.id);

                            return (
                              <div
                                key={assignment.id}
                                className={`relative rounded p-1 text-[9px] ${
                                  shiftViolationSeverity === 'error'
                                    ? 'bg-red-200 border border-red-400 text-red-900'
                                    : shiftViolationSeverity === 'warning'
                                      ? 'bg-amber-200 border border-amber-400 text-amber-900'
                                      : pattern?.isNight
                                        ? 'bg-purple-100 border border-purple-300 text-purple-900'
                                        : 'bg-blue-100 border border-blue-300 text-blue-900'
                                }`}
                              >
                                <button
                                  onClick={() => handleDelete(assignment)}
                                  className="absolute top-0 right-0 text-red-400 hover:text-red-600 p-0.5"
                                  title="Delete"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                                <div className="font-medium truncate pr-3">{pattern?.name || '?'}</div>
                                <div className="opacity-75">
                                  {assignment.customStartTime || pattern?.startTime || '?'}-{assignment.customEndTime || pattern?.endTime || '?'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* All Period Assignments List */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800 text-sm">Period Assignments ({periodAssignments.length})</h3>
          </div>
          <div className="p-3 max-h-64 overflow-y-auto">
            {periodAssignments.length === 0 ? (
              <p className="text-slate-500 text-center py-2 text-sm">No assignments in this period</p>
            ) : (
              <div className="space-y-1.5">
                {periodAssignments.map((assignment, idx) => {
                  const { pattern, project } = getAssignmentInfo(assignment);
                  const assignmentViolationSeverity = violationAssignmentSeverity.get(assignment.id);
                  const d = new Date(assignment.date);
                  const fri = fatigueAnalysis?.results[idx]?.riskIndex;

                  return (
                    <div
                      key={assignment.id}
                      className={`flex items-center justify-between p-2 rounded-lg ${
                        assignmentViolationSeverity === 'error'
                          ? 'bg-red-50 border-2 border-red-300'
                          : assignmentViolationSeverity === 'warning'
                            ? 'bg-amber-50 border-2 border-amber-300'
                            : fri && fri >= 1.2
                              ? 'bg-red-50 border border-red-200'
                              : fri && fri >= 1.1
                                ? 'bg-amber-50 border border-amber-200'
                                : 'bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`text-center min-w-[45px] ${assignmentViolationSeverity === 'error' ? 'text-red-700' : assignmentViolationSeverity === 'warning' ? 'text-amber-700' : ''}`}>
                          <div className="text-[10px] text-slate-500">{d.toLocaleDateString('en-GB', { month: 'short' })}</div>
                          <div className="text-lg font-bold">{d.getDate()}</div>
                          <div className="text-[10px]">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800 text-sm">{pattern?.name || 'Unknown'}</span>
                            {pattern?.isNight && <span className="text-purple-600 text-sm">🌙</span>}
                            {assignmentViolationSeverity === 'error' && <AlertTriangle className="w-3 h-3 text-red-500" />}
                            {assignmentViolationSeverity === 'warning' && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                          </div>
                          <div className="text-xs text-slate-600">{project?.name || 'Unknown Project'}</div>
                          <div className="text-[10px] text-slate-500">
                            {assignment.customStartTime || pattern?.startTime || '?'} - {assignment.customEndTime || pattern?.endTime || '?'}
                            <span className="mx-1">•</span>
                            {pattern?.dutyType}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {fri !== undefined && (
                          <div className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getFRIColor(fri)}`}>
                            FRI: {fri.toFixed(3)}
                          </div>
                        )}
                        <button onClick={() => handleDelete(assignment)} className="text-red-500 hover:text-red-700 p-1" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
