/**
 * Work Verification Utilities
 *
 * Calculates summary data for manager sign-offs on work hours and FARP assessments.
 * Compares planned vs actual work, tracks modifications, and validates compliance.
 */

import type {
  AssignmentCamel,
  ShiftPatternCamel,
  EmployeeCamel,
  FatigueAssessment,
  WorkVerificationSummaryData,
  EmployeeWorkSummary,
  ViolationSummary,
  ShiftPatternUsage,
  ViolationType,
} from './types';
import { getShiftDuration } from './compliance';

/**
 * Calculate work verification summary for a date range
 */
export function calculateWorkVerificationSummary(
  projectId: number,
  startDate: string,
  endDate: string,
  assignments: AssignmentCamel[],
  shiftPatterns: ShiftPatternCamel[],
  employees: EmployeeCamel[],
  fatigueAssessments: FatigueAssessment[],
  violations: { employeeId: number; date: string; type: ViolationType }[]
): WorkVerificationSummaryData {
  // Filter assignments for this project and date range
  const projectAssignments = assignments.filter(
    (a) =>
      a.projectId === projectId &&
      a.date >= startDate &&
      a.date <= endDate
  );

  // Filter assessments for this project and date range
  const projectAssessments = fatigueAssessments.filter(
    (fa) =>
      // FARP assessments are linked to assignments via employee
      projectAssignments.some((a) => a.employeeId === fa.employeeId) &&
      fa.assessmentDate >= startDate &&
      fa.assessmentDate <= endDate
  );

  // Calculate total hours (planned vs actual)
  let totalHoursPlanned = 0;
  let totalHoursActual = 0;
  let modificationsCount = 0;

  const employeeWorkMap = new Map<number, EmployeeWorkSummary>();
  const patternUsageMap = new Map<string, ShiftPatternUsage>();

  projectAssignments.forEach((assignment) => {
    const pattern = shiftPatterns.find((p) => p.id === assignment.shiftPatternId);
    if (!pattern) return;

    const employee = employees.find((e) => e.id === assignment.employeeId);
    if (!employee) return;

    // Calculate planned hours (from pattern)
    const plannedHours = getShiftDuration(pattern, assignment.date, undefined) / 60;

    // Calculate actual hours (may have custom times)
    const actualHours = getShiftDuration(pattern, assignment.date, assignment) / 60;

    totalHoursPlanned += plannedHours;
    totalHoursActual += actualHours;

    // Track if this assignment has custom times (modification)
    const hasCustomTime = assignment.customStartTime || assignment.customEndTime;
    if (hasCustomTime) {
      modificationsCount++;
    }

    // Track employee work summary
    if (!employeeWorkMap.has(assignment.employeeId)) {
      employeeWorkMap.set(assignment.employeeId, {
        employeeId: assignment.employeeId,
        employeeName: employee.name,
        plannedHours: 0,
        actualHours: 0,
        assignmentsCount: 0,
        customTimesCount: 0,
        violations: [],
      });
    }

    const empSummary = employeeWorkMap.get(assignment.employeeId)!;
    empSummary.plannedHours += plannedHours;
    empSummary.actualHours += actualHours;
    empSummary.assignmentsCount++;
    if (hasCustomTime) {
      empSummary.customTimesCount++;
    }

    // Track pattern usage
    if (!patternUsageMap.has(pattern.id)) {
      patternUsageMap.set(pattern.id, {
        patternId: pattern.id,
        patternName: pattern.name,
        assignmentCount: 0,
      });
    }
    patternUsageMap.get(pattern.id)!.assignmentCount++;
  });

  // Process violations
  const violationMap = new Map<ViolationType, ViolationSummary>();

  violations
    .filter((v) => v.date >= startDate && v.date <= endDate)
    .forEach((violation) => {
      // Check if this violation's employee has assignments in this project
      const hasAssignment = projectAssignments.some(
        (a) => a.employeeId === violation.employeeId && a.date === violation.date
      );

      if (!hasAssignment) return;

      // Add to violation summary
      if (!violationMap.has(violation.type)) {
        violationMap.set(violation.type, {
          type: violation.type,
          count: 0,
          dates: [],
        });
      }
      const vSummary = violationMap.get(violation.type)!;
      vSummary.count++;
      if (!vSummary.dates.includes(violation.date)) {
        vSummary.dates.push(violation.date);
      }

      // Add to employee violations
      const empSummary = employeeWorkMap.get(violation.employeeId);
      if (empSummary && !empSummary.violations.includes(violation.type)) {
        empSummary.violations.push(violation.type);
      }
    });

  // Count FARP assessments by status
  const completedFarps = projectAssessments.filter(
    (fa) => fa.status === 'completed'
  ).length;
  const pendingFarps = projectAssessments.filter(
    (fa) =>
      fa.status === 'draft' ||
      fa.status === 'pending_employee' ||
      fa.status === 'pending_manager'
  ).length;

  return {
    totalAssignments: projectAssignments.length,
    totalHoursPlanned: Math.round(totalHoursPlanned * 10) / 10,
    totalHoursActual: Math.round(totalHoursActual * 10) / 10,
    modificationsCount,
    farpAssessmentsCount: projectAssessments.length,
    completedFarps,
    pendingFarps,
    violations: Array.from(violationMap.values()),
    employeeBreakdown: Array.from(employeeWorkMap.values()).sort(
      (a, b) => a.employeeName.localeCompare(b.employeeName)
    ),
    shiftPatternsUsed: Array.from(patternUsageMap.values()).sort(
      (a, b) => b.assignmentCount - a.assignmentCount
    ),
  };
}

/**
 * Check if a period can be signed off
 * Blocks sign-off if there are pending FARP assessments
 */
export function canSignOffPeriod(summaryData: WorkVerificationSummaryData): {
  canSignOff: boolean;
  reason?: string;
} {
  if (summaryData.pendingFarps > 0) {
    return {
      canSignOff: false,
      reason: `${summaryData.pendingFarps} FARP assessment${
        summaryData.pendingFarps > 1 ? 's' : ''
      } pending completion`,
    };
  }

  return { canSignOff: true };
}

/**
 * Format date range as readable string
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

/**
 * Get Network Rail period label
 */
export function getPeriodLabel(periodNumber: number, year: number): string {
  return `P${periodNumber} ${year}/${String(year + 1).slice(2)}`;
}
