'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, XCircle, Trash2, Download, Clock, Calendar, BarChart } from '@/components/ui/Icons';
import { checkEmployeeCompliance, type ComplianceViolation } from '@/lib/compliance';
import { parseTimeToHours, calculateDutyLength, calculateFatigueSequence } from '@/lib/fatigue';
import type { ShiftDefinition, FatigueResult } from '@/lib/types';
import { generateNetworkRailPeriods, getAvailableYears, findPeriodForDate } from '@/lib/periods';
import type { EmployeeCamel, AssignmentCamel, ShiftPatternCamel, ProjectCamel } from '@/lib/types';
import { SignOutHeader } from '@/components/auth/SignOutHeader';

interface PersonViewProps {
  user: any;
  onSignOut: () => void;
  onBack: () => void;
  employee: EmployeeCamel;
  employees: EmployeeCamel[];
  assignments: AssignmentCamel[];
  shiftPatterns: ShiftPatternCamel[];
  projects: ProjectCamel[];
  onSelectEmployee: (id: number) => void;
  onDeleteAssignment: (id: number) => Promise<void>;
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
}: PersonViewProps) {
  // Period selection
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(0);
  const [highlightedDate, setHighlightedDate] = useState<string | null>(null);

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

    // Convert assignments to ShiftDefinitions
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

  // Build set of assignment IDs that are involved in violations
  const violationAssignmentIds = useMemo(() => {
    const ids = new Set<number>();

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

      violationAssignments.forEach(a => ids.add(a.id));
    });

    return ids;
  }, [compliance.violations, empAssignments]);

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

  const getFRIColor = (fri: number) => {
    if (fri >= 1.2) return 'text-red-600 bg-red-100';
    if (fri >= 1.1) return 'text-amber-600 bg-amber-100';
    if (fri >= 1.0) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getFRILevel = (fri: number) => {
    if (fri >= 1.2) return 'Critical';
    if (fri >= 1.1) return 'Elevated';
    if (fri >= 1.0) return 'Moderate';
    return 'Low';
  };

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

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-4">
          <div className={`bg-white rounded-lg shadow p-4 ${compliance.hasErrors ? 'border-l-4 border-red-500' : compliance.hasWarnings ? 'border-l-4 border-amber-500' : 'border-l-4 border-green-500'}`}>
            <p className="text-sm text-slate-600">Compliance</p>
            <div className="flex items-center gap-2 mt-1">
              {compliance.hasErrors ? <XCircle className="w-5 h-5 text-red-500" /> : compliance.hasWarnings ? <AlertTriangle className="w-5 h-5 text-amber-500" /> : <CheckCircle className="w-5 h-5 text-green-500" />}
              <span className={`text-xl font-bold ${compliance.hasErrors ? 'text-red-600' : compliance.hasWarnings ? 'text-amber-600' : 'text-green-600'}`}>
                {compliance.violations.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Issues</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600">Period Shifts</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalShifts}</p>
            <p className="text-xs text-slate-500 mt-1">{stats.nightShifts} nights</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600">Period Hours</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalHours}h</p>
            <p className="text-xs text-slate-500 mt-1">{stats.totalShifts > 0 ? Math.round(stats.totalHours / stats.totalShifts * 10) / 10 : 0}h avg</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600">Projects</p>
            <p className="text-2xl font-bold text-slate-900">{stats.uniqueProjects}</p>
          </div>

          {/* Fatigue Risk Card */}
          <div className={`bg-white rounded-lg shadow p-4 ${
            fatigueAnalysis?.maxFRI && fatigueAnalysis.maxFRI >= 1.2
              ? 'border-l-4 border-red-500'
              : fatigueAnalysis?.maxFRI && fatigueAnalysis.maxFRI >= 1.1
                ? 'border-l-4 border-amber-500'
                : 'border-l-4 border-green-500'
          }`}>
            <p className="text-sm text-slate-600">Max Fatigue Risk</p>
            {fatigueAnalysis ? (
              <>
                <p className={`text-2xl font-bold ${fatigueAnalysis.maxFRI >= 1.2 ? 'text-red-600' : fatigueAnalysis.maxFRI >= 1.1 ? 'text-amber-600' : 'text-green-600'}`}>
                  {fatigueAnalysis.maxFRI.toFixed(2)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {getFRILevel(fatigueAnalysis.maxFRI)} ({fatigueAnalysis.criticalShifts} critical)
                </p>
              </>
            ) : (
              <p className="text-xl font-bold text-slate-400">N/A</p>
            )}
          </div>
        </div>

        {/* Fatigue Analysis Section */}
        {fatigueAnalysis && fatigueAnalysis.results.length > 0 && (
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold text-slate-800">Fatigue Risk Analysis (HSE RR446)</h3>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="px-2 py-1 rounded bg-green-100 text-green-700">Low &lt;1.0</span>
                <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700">Moderate 1.0-1.1</span>
                <span className="px-2 py-1 rounded bg-amber-100 text-amber-700">Elevated 1.1-1.2</span>
                <span className="px-2 py-1 rounded bg-red-100 text-red-700">Critical &ge;1.2</span>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="bg-slate-50 rounded p-3">
                  <p className="text-xs text-slate-500">Average FRI</p>
                  <p className={`text-lg font-bold ${getFRIColor(fatigueAnalysis.avgFRI).split(' ')[0]}`}>
                    {fatigueAnalysis.avgFRI.toFixed(3)}
                  </p>
                </div>
                <div className="bg-slate-50 rounded p-3">
                  <p className="text-xs text-slate-500">Maximum FRI</p>
                  <p className={`text-lg font-bold ${getFRIColor(fatigueAnalysis.maxFRI).split(' ')[0]}`}>
                    {fatigueAnalysis.maxFRI.toFixed(3)}
                  </p>
                </div>
                <div className="bg-slate-50 rounded p-3">
                  <p className="text-xs text-slate-500">Elevated Shifts</p>
                  <p className="text-lg font-bold text-amber-600">{fatigueAnalysis.elevatedShifts}</p>
                </div>
                <div className="bg-slate-50 rounded p-3">
                  <p className="text-xs text-slate-500">Critical Shifts</p>
                  <p className="text-lg font-bold text-red-600">{fatigueAnalysis.criticalShifts}</p>
                </div>
              </div>

              {/* FRI Bar Chart */}
              <div className="h-32 flex items-end gap-1">
                {fatigueAnalysis.results.map((result, idx) => {
                  const height = Math.min(100, (result.riskIndex / 1.5) * 100);
                  const assignment = periodAssignments[idx];
                  const d = new Date(assignment.date);

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <div
                        className={`w-full rounded-t transition-all ${getFRIColor(result.riskIndex)}`}
                        style={{ height: `${height}%` }}
                        title={`${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}\nFRI: ${result.riskIndex.toFixed(3)}`}
                      />
                      <div className="text-[8px] text-slate-500 mt-1 truncate w-full text-center">
                        {d.getDate()}/{d.getMonth() + 1}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Compliance Violations Section */}
        {compliance.violations.length > 0 && (
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold text-slate-800">Compliance Violations ({compliance.violations.length})</h3>
            </div>
            <div className="p-4 space-y-4 max-h-64 overflow-y-auto">
              {compliance.violations.map((violation, idx) => (
                <button
                  key={idx}
                  onClick={() => handleViolationClick(violation)}
                  className={`w-full text-left p-3 rounded-lg cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] ${violation.severity === 'error' ? 'bg-red-50 border-l-4 border-red-500 hover:bg-red-100' : 'bg-amber-50 border-l-4 border-amber-500 hover:bg-amber-100'}`}
                >
                  <div className="flex items-start gap-2">
                    {violation.severity === 'error' ? <XCircle className="w-4 h-4 text-red-500 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />}
                    <div className="flex-1">
                      <p className={`font-medium text-sm ${violation.severity === 'error' ? 'text-red-900' : 'text-amber-900'}`}>
                        {getViolationIcon(violation.type)} {getViolationTitle(violation.type)}
                      </p>
                      <p className={`text-xs mt-0.5 ${violation.severity === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
                        {violation.message}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
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
          <div className="p-4 border-b border-slate-200 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-slate-800">Schedule - {currentPeriod?.name}</h3>
          </div>
          <div className="p-4 overflow-x-auto">
            {/* Week Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                <div key={day} className="text-center text-xs font-semibold text-slate-600 py-1">
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
                  const hasViolation = dateAssignments.some(a => violationAssignmentIds.has(a.id));

                  // Get fatigue data for this date
                  const dateAssignmentIndices = periodAssignments.map((a, idx) => a.date === date ? idx : -1).filter(i => i !== -1);
                  const dateFRI = dateAssignmentIndices.length > 0 && fatigueAnalysis
                    ? Math.max(...dateAssignmentIndices.map(i => fatigueAnalysis.results[i]?.riskIndex || 0))
                    : null;

                  const isHighlighted = highlightedDate === date;

                  return (
                    <div
                      key={date}
                      className={`min-h-[100px] p-2 rounded-lg border transition-all ${
                        isHighlighted
                          ? 'ring-4 ring-blue-500 ring-offset-2 animate-pulse bg-blue-100 border-blue-500 scale-105 z-10'
                          : hasViolation
                            ? 'bg-red-100 border-red-400'
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
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-semibold ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                          {dateNum}
                        </span>
                        {dateFRI !== null && (
                          <span className={`text-[9px] px-1 rounded ${getFRIColor(dateFRI)}`}>
                            {dateFRI.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {dateAssignments.length === 0 ? (
                        <div className="text-[10px] text-slate-400 text-center py-2">-</div>
                      ) : (
                        <div className="space-y-1">
                          {dateAssignments.map(assignment => {
                            const { pattern, project } = getAssignmentInfo(assignment);
                            const isViolationShift = violationAssignmentIds.has(assignment.id);

                            return (
                              <div
                                key={assignment.id}
                                className={`relative rounded p-1 text-[9px] ${
                                  isViolationShift
                                    ? 'bg-red-200 border border-red-400'
                                    : pattern?.isNight
                                      ? 'bg-purple-100 border border-purple-300'
                                      : 'bg-blue-100 border border-blue-300'
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
                                <div className="text-slate-500">
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
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">Period Assignments ({periodAssignments.length})</h3>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            {periodAssignments.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No assignments in this period</p>
            ) : (
              <div className="space-y-2">
                {periodAssignments.map((assignment, idx) => {
                  const { pattern, project } = getAssignmentInfo(assignment);
                  const isViolation = violationAssignmentIds.has(assignment.id);
                  const d = new Date(assignment.date);
                  const fri = fatigueAnalysis?.results[idx]?.riskIndex;

                  return (
                    <div
                      key={assignment.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isViolation
                          ? 'bg-red-50 border-2 border-red-300'
                          : fri && fri >= 1.2
                            ? 'bg-red-50 border border-red-200'
                            : fri && fri >= 1.1
                              ? 'bg-amber-50 border border-amber-200'
                              : 'bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`text-center min-w-[60px] ${isViolation ? 'text-red-700' : ''}`}>
                          <div className="text-xs text-slate-500">{d.toLocaleDateString('en-GB', { month: 'short' })}</div>
                          <div className="text-xl font-bold">{d.getDate()}</div>
                          <div className="text-xs">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">{pattern?.name || 'Unknown'}</span>
                            {pattern?.isNight && <span className="text-purple-600">🌙</span>}
                            {isViolation && <AlertTriangle className="w-4 h-4 text-red-500" />}
                          </div>
                          <div className="text-sm text-slate-600">{project?.name || 'Unknown Project'}</div>
                          <div className="text-xs text-slate-500">
                            {assignment.customStartTime || pattern?.startTime || '?'} - {assignment.customEndTime || pattern?.endTime || '?'}
                            <span className="mx-1">•</span>
                            {pattern?.dutyType}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {fri !== undefined && (
                          <div className={`px-2 py-1 rounded text-xs font-medium ${getFRIColor(fri)}`}>
                            FRI: {fri.toFixed(3)}
                          </div>
                        )}
                        <button onClick={() => handleDelete(assignment)} className="text-red-500 hover:text-red-700 p-2" title="Delete">
                          <Trash2 className="w-5 h-5" />
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
