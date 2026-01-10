/**
 * Weekly Shift Verification Utilities
 *
 * Provides utilities for managing weekly shift-level verification by managers.
 * Replaces the period-based verification with granular week-by-week sign-offs.
 */

import type {
  AssignmentCamel,
  ShiftPatternCamel,
  EmployeeCamel,
  WeeklyShiftVerificationCamel,
  SignedOffShift,
} from './types';

/**
 * Get all unique shift patterns used in a week
 */
export function getShiftPatternsForWeek(
  weekStartDate: string,
  assignments: AssignmentCamel[],
  shiftPatterns: ShiftPatternCamel[]
): Array<{ pattern: ShiftPatternCamel; employeeCount: number; assignmentCount: number }> {
  const weekEndDate = getWeekEndDate(weekStartDate);

  // Filter assignments for this week
  const weekAssignments = assignments.filter(
    (a) => a.date >= weekStartDate && a.date <= weekEndDate
  );

  // Group by shift pattern
  const patternMap = new Map<
    string,
    { employeeIds: Set<number>; assignmentCount: number }
  >();

  weekAssignments.forEach((assignment) => {
    const existing = patternMap.get(assignment.shiftPatternId);
    if (existing) {
      existing.employeeIds.add(assignment.employeeId);
      existing.assignmentCount++;
    } else {
      patternMap.set(assignment.shiftPatternId, {
        employeeIds: new Set([assignment.employeeId]),
        assignmentCount: 1,
      });
    }
  });

  // Build result array
  const result: Array<{
    pattern: ShiftPatternCamel;
    employeeCount: number;
    assignmentCount: number;
  }> = [];

  patternMap.forEach((data, patternId) => {
    const pattern = shiftPatterns.find((p) => p.id === patternId);
    if (pattern) {
      result.push({
        pattern,
        employeeCount: data.employeeIds.size,
        assignmentCount: data.assignmentCount,
      });
    }
  });

  // Sort by assignment count descending
  return result.sort((a, b) => b.assignmentCount - a.assignmentCount);
}

/**
 * Get the end date (Friday) for a week starting on Saturday
 */
export function getWeekEndDate(weekStartDate: string): string {
  const start = new Date(weekStartDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6); // Saturday + 6 days = Friday
  return end.toISOString().split('T')[0];
}

/**
 * Get all week start dates (Saturdays) in a period
 */
export function getWeeksInPeriod(periodStartDate: string): string[] {
  const weeks: string[] = [];
  const start = new Date(periodStartDate);

  for (let i = 0; i < 4; i++) {
    const weekStart = new Date(start);
    weekStart.setDate(weekStart.getDate() + i * 7);
    weeks.push(weekStart.toISOString().split('T')[0]);
  }

  return weeks;
}

/**
 * Check if a shift pattern is signed off in a verification record
 */
export function isShiftSignedOff(
  verification: WeeklyShiftVerificationCamel | undefined,
  shiftPatternId: string
): boolean {
  if (!verification) return false;
  return verification.signedOffShifts.some(
    (shift) => shift.shiftPatternId === shiftPatternId
  );
}

/**
 * Get the count of unsigned weeks for a project (in the past only)
 */
export function getUnsignedWeeksCount(
  projectId: number,
  verifications: WeeklyShiftVerificationCamel[],
  assignments: AssignmentCamel[]
): number {
  const today = new Date().toISOString().split('T')[0];

  // Get all unique week start dates from assignments (in the past)
  const weekStartDates = new Set<string>();

  assignments
    .filter((a) => a.projectId === projectId && a.date < today)
    .forEach((assignment) => {
      const weekStart = getWeekStartDate(assignment.date);
      weekStartDates.add(weekStart);
    });

  // Count how many weeks are not fully signed off
  let unsignedCount = 0;

  weekStartDates.forEach((weekStart) => {
    const verification = verifications.find(
      (v) => v.projectId === projectId && v.weekStartDate === weekStart
    );

    // If no verification record OR not fully signed off
    if (!verification || !verification.isFullySignedOff) {
      unsignedCount++;
    }
  });

  return unsignedCount;
}

/**
 * Get the next (oldest) unsigned week for a project
 */
export function getNextUnsignedWeek(
  projectId: number,
  verifications: WeeklyShiftVerificationCamel[],
  assignments: AssignmentCamel[]
): string | null {
  const today = new Date().toISOString().split('T')[0];

  // Get all unique week start dates from assignments (in the past)
  const weekStartDates = new Set<string>();

  assignments
    .filter((a) => a.projectId === projectId && a.date < today)
    .forEach((assignment) => {
      const weekStart = getWeekStartDate(assignment.date);
      weekStartDates.add(weekStart);
    });

  // Convert to sorted array (oldest first)
  const sortedWeeks = Array.from(weekStartDates).sort();

  // Find the first unsigned week
  for (const weekStart of sortedWeeks) {
    const verification = verifications.find(
      (v) => v.projectId === projectId && v.weekStartDate === weekStart
    );

    // If no verification record OR not fully signed off
    if (!verification || !verification.isFullySignedOff) {
      return weekStart;
    }
  }

  return null; // All weeks signed off
}

/**
 * Get the Saturday (week start) for a given date
 */
export function getWeekStartDate(date: string): string {
  const d = new Date(date);
  const dayOfWeek = d.getDay(); // 0 = Sunday, 6 = Saturday

  // Calculate days to subtract to get to Saturday
  const daysToSaturday = dayOfWeek === 6 ? 0 : dayOfWeek + 1;

  const saturday = new Date(d);
  saturday.setDate(saturday.getDate() - daysToSaturday);

  return saturday.toISOString().split('T')[0];
}

/**
 * Format week range as readable string
 */
export function formatWeekRange(weekStartDate: string): string {
  const start = new Date(weekStartDate);
  const end = new Date(weekStartDate);
  end.setDate(end.getDate() + 6);

  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

/**
 * Get week metadata (year, period, week number)
 */
export function getWeekMetadata(
  weekStartDate: string,
  periodStartDate: string,
  periodNumber: number,
  year: number
): { year: number; periodNumber: number; weekInPeriod: number } {
  const weekStart = new Date(weekStartDate);
  const periodStart = new Date(periodStartDate);

  const daysDiff = Math.floor(
    (weekStart.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const weekInPeriod = Math.floor(daysDiff / 7) + 1;

  return {
    year,
    periodNumber,
    weekInPeriod: Math.min(4, Math.max(1, weekInPeriod)), // Clamp to 1-4
  };
}

/**
 * Check if all shifts in a week are signed off
 */
export function areAllShiftsSignedOff(
  verification: WeeklyShiftVerificationCamel | undefined,
  shiftsInWeek: Array<{ pattern: ShiftPatternCamel }>
): boolean {
  if (!verification) return false;
  if (shiftsInWeek.length === 0) return true; // No shifts = nothing to sign off

  // Check if every shift pattern in the week has been signed off
  return shiftsInWeek.every((shift) =>
    verification.signedOffShifts.some(
      (signed) => signed.shiftPatternId === shift.pattern.id
    )
  );
}
