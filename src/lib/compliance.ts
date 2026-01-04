// ============================================
// NETWORK RAIL COMPLIANCE RULES
// Based on NR/L2/OHS/003 Fatigue Risk Management Standard
// ============================================

import type { AssignmentCamel, ShiftPatternCamel } from './types';
import { parseTimeToHours, calculateDutyLength } from './fatigue';

// ==================== DATE HANDLING ====================
// IMPORTANT: All date operations use UTC-safe parsing to avoid timezone issues
// that could cause day shifts when running in different locales/timezones.

/**
 * Parse ISO date string (YYYY-MM-DD) to Date object without timezone shift.
 * Using this instead of new Date('YYYY-MM-DD') which is locale-sensitive.
 */
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Calculate days difference between two date strings (YYYY-MM-DD format).
 * Returns positive number if date2 is after date1.
 */
function daysBetween(date1Str: string, date2Str: string): number {
  const d1 = parseLocalDate(date1Str);
  const d2 = parseLocalDate(date2Str);
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

// ==================== COMPLIANCE LIMITS ====================

export const COMPLIANCE_LIMITS = {
  // Hard Limits (Errors)
  MAX_SHIFT_HOURS: 12,
  MIN_REST_HOURS: 12,
  MAX_WEEKLY_HOURS: 72,
  MAX_CONSECUTIVE_DAYS: 13,
  MAX_CONSECUTIVE_NIGHTS: 7,

  // Soft Limits (Warnings)
  APPROACHING_WEEKLY_HOURS: 66,
  CONSECUTIVE_NIGHTS_WARNING: 4,
  CONSECUTIVE_DAYS_WARNING: 6, // Warn after 7 consecutive days

  // Night shift definition
  NIGHT_START_HOUR: 20, // 8pm onwards considered night
  NIGHT_END_HOUR: 6,    // Before 6am considered night
} as const;

// ==================== TYPES ====================

export type ViolationSeverity = 'error' | 'warning';

export type ViolationType =
  | 'MAX_SHIFT_LENGTH'
  | 'INSUFFICIENT_REST'
  | 'MAX_WEEKLY_HOURS'
  | 'APPROACHING_WEEKLY_LIMIT'
  | 'MAX_CONSECUTIVE_DAYS'
  | 'CONSECUTIVE_DAYS_WARNING'
  | 'CONSECUTIVE_NIGHTS_WARNING'
  | 'MAX_CONSECUTIVE_NIGHTS'
  | 'DAY_NIGHT_TRANSITION'
  | 'MULTIPLE_SHIFTS_SAME_DAY'
  | 'ELEVATED_FATIGUE_INDEX';

export interface ComplianceViolation {
  type: ViolationType;
  severity: ViolationSeverity;
  employeeId: number;
  employeeName?: string;
  date: string;
  message: string;
  value?: number;
  limit?: number;
  windowEnd?: string;
  relatedDates?: string[];
}

export interface ComplianceResult {
  isCompliant: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  violations: ComplianceViolation[];
  errorCount: number;
  warningCount: number;
}

export interface EmployeeComplianceStatus {
  employeeId: number;
  status: 'ok' | 'warning' | 'error';
  violations: ComplianceViolation[];
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get shift duration for a specific date
 * Supports custom times on assignments (for ad-hoc shifts)
 */
function getShiftDuration(pattern: ShiftPatternCamel, dateStr: string, assignment?: AssignmentCamel): number {
  let startTime: string | undefined;
  let endTime: string | undefined;

  // First check for custom times on the assignment (ad-hoc shifts)
  if (assignment?.customStartTime && assignment?.customEndTime) {
    startTime = assignment.customStartTime;
    endTime = assignment.customEndTime;
  } else if (pattern.weeklySchedule) {
    // Use parseLocalDate instead of new Date() to avoid timezone issues
    const dayOfWeek = parseLocalDate(dateStr).getDay();
    const dayNames: ('Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat')[] =
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayKey = dayNames[dayOfWeek];
    const daySchedule = pattern.weeklySchedule[dayKey];
    if (daySchedule?.startTime && daySchedule?.endTime) {
      startTime = daySchedule.startTime;
      endTime = daySchedule.endTime;
    }
  }

  if (!startTime || !endTime) {
    startTime = pattern.startTime;
    endTime = pattern.endTime;
  }

  if (!startTime || !endTime) return 0;

  const start = parseTimeToHours(startTime);
  const end = parseTimeToHours(endTime);
  return calculateDutyLength(start, end);
}

/**
 * Get shift times for a specific date
 * Supports custom times on assignments (for ad-hoc shifts)
 */
function getShiftTimes(pattern: ShiftPatternCamel, dateStr: string, assignment?: AssignmentCamel): { start: string; end: string } | null {
  let startTime: string | undefined;
  let endTime: string | undefined;

  // First check for custom times on the assignment (ad-hoc shifts)
  if (assignment?.customStartTime && assignment?.customEndTime) {
    startTime = assignment.customStartTime;
    endTime = assignment.customEndTime;
  } else if (pattern.weeklySchedule) {
    // Use parseLocalDate instead of new Date() to avoid timezone issues
    const dayOfWeek = parseLocalDate(dateStr).getDay();
    const dayNames: ('Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat')[] =
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayKey = dayNames[dayOfWeek];
    const daySchedule = pattern.weeklySchedule[dayKey];
    if (daySchedule?.startTime && daySchedule?.endTime) {
      startTime = daySchedule.startTime;
      endTime = daySchedule.endTime;
    }
  }

  if (!startTime || !endTime) {
    startTime = pattern.startTime;
    endTime = pattern.endTime;
  }

  if (!startTime || !endTime) return null;

  return { start: startTime, end: endTime };
}

/**
 * Check if a shift is a night shift
 * Supports custom times on assignments (for ad-hoc shifts)
 */
function isNightShift(pattern: ShiftPatternCamel, dateStr: string, assignment?: AssignmentCamel): boolean {
  // If explicitly marked as night, use that
  if (pattern.isNight) return true;

  const times = getShiftTimes(pattern, dateStr, assignment);
  if (!times) return false;

  const startHour = parseTimeToHours(times.start);
  const endHour = parseTimeToHours(times.end);

  // Night if starts after 8pm or ends before 6am
  return startHour >= COMPLIANCE_LIMITS.NIGHT_START_HOUR ||
         endHour <= COMPLIANCE_LIMITS.NIGHT_END_HOUR ||
         endHour < startHour; // Overnight shift
}

/**
 * Calculate rest period between two shifts in hours
 * Supports custom times on assignments (for ad-hoc shifts)
 */
function calculateRestBetweenShifts(
  prevPattern: ShiftPatternCamel,
  prevDate: string,
  nextPattern: ShiftPatternCamel,
  nextDate: string,
  prevAssignment?: AssignmentCamel,
  nextAssignment?: AssignmentCamel
): number {
  const prevTimes = getShiftTimes(prevPattern, prevDate, prevAssignment);
  const nextTimes = getShiftTimes(nextPattern, nextDate, nextAssignment);

  // FIXED: Instead of assuming 24 hours (which masks data issues), return -1 to signal
  // that we couldn't calculate. Callers should handle this appropriately.
  if (!prevTimes || !nextTimes) return -1;

  const prevEndHour = parseTimeToHours(prevTimes.end);
  const nextStartHour = parseTimeToHours(nextTimes.start);

  // Use daysBetween helper for timezone-safe date difference calculation
  const daysDiff = daysBetween(prevDate, nextDate);

  // Calculate hours between end of prev and start of next
  let restHours = (daysDiff * 24) + nextStartHour - prevEndHour;

  // Handle overnight shifts (end time < start time means next day)
  if (prevEndHour < parseTimeToHours(prevTimes.start)) {
    restHours -= 24; // Prev shift ended next day
  }

  return restHours;
}

// ==================== COMPLIANCE CHECKS ====================

/**
 * Check for maximum shift length violations
 */
export function checkMaxShiftLength(
  employeeId: number,
  assignments: AssignmentCamel[],
  patternMap: Map<string, ShiftPatternCamel>
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  assignments.forEach(assignment => {
    const pattern = patternMap.get(assignment.shiftPatternId);
    if (!pattern) return;

    // Pass assignment to support custom times
    const duration = getShiftDuration(pattern, assignment.date, assignment);

    if (duration > COMPLIANCE_LIMITS.MAX_SHIFT_HOURS) {
      violations.push({
        type: 'MAX_SHIFT_LENGTH',
        severity: 'error',
        employeeId,
        date: assignment.date,
        message: `Shift exceeds ${COMPLIANCE_LIMITS.MAX_SHIFT_HOURS}h limit (${duration.toFixed(1)}h)`,
        value: Math.round(duration * 10) / 10,
        limit: COMPLIANCE_LIMITS.MAX_SHIFT_HOURS,
      });
    }
  });

  return violations;
}

/**
 * Check for insufficient rest period between shifts
 */
export function checkRestPeriods(
  employeeId: number,
  assignments: AssignmentCamel[],
  patternMap: Map<string, ShiftPatternCamel>
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  // Sort by date using timezone-safe parsing
  const sorted = [...assignments].sort((a, b) =>
    parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()
  );

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    const prevPattern = patternMap.get(prev.shiftPatternId);
    const currPattern = patternMap.get(curr.shiftPatternId);

    if (!prevPattern || !currPattern) continue;

    // Pass assignments to support custom times
    const restHours = calculateRestBetweenShifts(prevPattern, prev.date, currPattern, curr.date, prev, curr);

    // Skip if we couldn't calculate rest hours (missing time data)
    if (restHours < 0) continue;

    if (restHours < COMPLIANCE_LIMITS.MIN_REST_HOURS) {
      violations.push({
        type: 'INSUFFICIENT_REST',
        severity: 'error',
        employeeId,
        date: curr.date,
        message: `Only ${restHours.toFixed(1)}h rest before this shift (minimum ${COMPLIANCE_LIMITS.MIN_REST_HOURS}h required)`,
        value: Math.round(restHours * 10) / 10,
        limit: COMPLIANCE_LIMITS.MIN_REST_HOURS,
        relatedDates: [prev.date],
      });
    }
  }

  return violations;
}

/**
 * Check for multiple shifts on same day
 */
export function checkMultipleShiftsSameDay(
  employeeId: number,
  assignments: AssignmentCamel[],
  patternMap: Map<string, ShiftPatternCamel>
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];
  const dateGroups: Record<string, AssignmentCamel[]> = {};
  
  // Group by date
  assignments.forEach(a => {
    if (!dateGroups[a.date]) dateGroups[a.date] = [];
    dateGroups[a.date].push(a);
  });
  
  // Check each date with multiple assignments
  Object.entries(dateGroups).forEach(([date, dayAssignments]) => {
    if (dayAssignments.length > 1) {
      // Check if it's a day-to-night transition (more serious)
      const hasDayShift = dayAssignments.some(a => {
        const p = patternMap.get(a.shiftPatternId);
        return p && !isNightShift(p, date, a);
      });
      const hasNightShift = dayAssignments.some(a => {
        const p = patternMap.get(a.shiftPatternId);
        return p && isNightShift(p, date, a);
      });
      
      if (hasDayShift && hasNightShift) {
        violations.push({
          type: 'DAY_NIGHT_TRANSITION',
          severity: 'error',
          employeeId,
          date,
          message: 'Day shift followed by night shift on same date - insufficient rest',
        });
      } else {
        violations.push({
          type: 'MULTIPLE_SHIFTS_SAME_DAY',
          severity: 'error',
          employeeId,
          date,
          message: `${dayAssignments.length} shifts assigned on same date`,
          value: dayAssignments.length,
        });
      }
    }
  });
  
  return violations;
}

/**
 * Check rolling 7-day weekly hours
 * For each assignment date, check the 7-day window ENDING on that date
 * (i.e., how many hours has this person worked in the last 7 days including today)
 */
export function checkWeeklyHours(
  employeeId: number,
  assignments: AssignmentCamel[],
  patternMap: Map<string, ShiftPatternCamel>
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  if (assignments.length === 0) return violations;

  // Sort by date using timezone-safe parsing
  const sorted = [...assignments].sort((a, b) =>
    parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()
  );

  // Check rolling 7-day window ENDING on each assignment date
  // This ensures we catch "Amy is working her 6th day in a row and approaching limits"
  const checkedWindows = new Set<string>();

  sorted.forEach(assignment => {
    // Use timezone-safe date parsing
    const windowEnd = parseLocalDate(assignment.date);
    const windowKey = assignment.date; // Already in YYYY-MM-DD format

    // Skip if we've already checked this exact date
    if (checkedWindows.has(windowKey)) return;
    checkedWindows.add(windowKey);

    // Window starts 6 days before (so 7 days total including today)
    const windowStart = new Date(windowEnd);
    windowStart.setDate(windowStart.getDate() - 6);

    let totalHours = 0;
    const windowDates: string[] = [];

    sorted.forEach(a => {
      const aDate = parseLocalDate(a.date);
      if (aDate >= windowStart && aDate <= windowEnd) {
        const pattern = patternMap.get(a.shiftPatternId);
        if (pattern) {
          // Pass assignment to support custom times
          totalHours += getShiftDuration(pattern, a.date, a);
          windowDates.push(a.date);
        }
      }
    });

    if (totalHours > COMPLIANCE_LIMITS.MAX_WEEKLY_HOURS) {
      violations.push({
        type: 'MAX_WEEKLY_HOURS',
        severity: 'error',
        employeeId,
        date: assignment.date,
        message: `${totalHours.toFixed(1)}h in last 7 days (maximum ${COMPLIANCE_LIMITS.MAX_WEEKLY_HOURS}h)`,
        value: Math.round(totalHours * 10) / 10,
        limit: COMPLIANCE_LIMITS.MAX_WEEKLY_HOURS,
        windowEnd: windowEnd.toISOString().split('T')[0],
        relatedDates: windowDates,
      });
    } else if (totalHours > COMPLIANCE_LIMITS.APPROACHING_WEEKLY_HOURS) {
      violations.push({
        type: 'APPROACHING_WEEKLY_LIMIT',
        severity: 'warning',
        employeeId,
        date: assignment.date,
        message: `${totalHours.toFixed(1)}h in last 7 days - approaching ${COMPLIANCE_LIMITS.MAX_WEEKLY_HOURS}h limit`,
        value: Math.round(totalHours * 10) / 10,
        limit: COMPLIANCE_LIMITS.MAX_WEEKLY_HOURS,
        windowEnd: windowEnd.toISOString().split('T')[0],
      });
    }
  });

  return violations;
}

/**
 * Check consecutive days worked
 * Reports violations on the specific day that crosses each threshold:
 * - Warning on 7th consecutive day (CONSECUTIVE_DAYS_WARNING + 1)
 * - Error on 14th consecutive day (MAX_CONSECUTIVE_DAYS + 1)
 */
export function checkConsecutiveDays(
  employeeId: number,
  assignments: AssignmentCamel[]
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];
  const addedViolationDates = new Set<string>(); // Track dates we've already flagged

  if (assignments.length < 2) return violations;

  // Get unique dates sorted
  const dates = [...new Set(assignments.map(a => a.date))].sort();

  let consecutiveCount = 1;
  let streakDates: string[] = [dates[0]];

  for (let i = 1; i < dates.length; i++) {
    // Use timezone-safe date parsing
    const prevDate = parseLocalDate(dates[i - 1]);
    const currDate = parseLocalDate(dates[i]);
    const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 1) {
      consecutiveCount++;
      streakDates.push(dates[i]);

      // Flag violation on the specific day when threshold is exceeded
      // Error on 14th day (MAX_CONSECUTIVE_DAYS + 1)
      if (consecutiveCount === COMPLIANCE_LIMITS.MAX_CONSECUTIVE_DAYS + 1) {
        const violationDate = dates[i];
        if (!addedViolationDates.has(violationDate)) {
          violations.push({
            type: 'MAX_CONSECUTIVE_DAYS',
            severity: 'error',
            employeeId,
            date: violationDate,
            message: `${consecutiveCount} consecutive days worked (maximum ${COMPLIANCE_LIMITS.MAX_CONSECUTIVE_DAYS})`,
            value: consecutiveCount,
            limit: COMPLIANCE_LIMITS.MAX_CONSECUTIVE_DAYS,
            relatedDates: [...streakDates],
          });
          addedViolationDates.add(violationDate);
        }
      }
      // Warning on 7th day (CONSECUTIVE_DAYS_WARNING + 1)
      else if (consecutiveCount === COMPLIANCE_LIMITS.CONSECUTIVE_DAYS_WARNING + 1) {
        const violationDate = dates[i];
        if (!addedViolationDates.has(violationDate)) {
          violations.push({
            type: 'CONSECUTIVE_DAYS_WARNING',
            severity: 'warning',
            employeeId,
            date: violationDate,
            message: `${consecutiveCount} consecutive days worked - consider rest period`,
            value: consecutiveCount,
            limit: COMPLIANCE_LIMITS.MAX_CONSECUTIVE_DAYS,
            relatedDates: [...streakDates],
          });
          addedViolationDates.add(violationDate);
        }
      }
    } else {
      // Streak broken, reset
      consecutiveCount = 1;
      streakDates = [dates[i]];
    }
  }

  return violations;
}

/**
 * Check consecutive night shifts
 */
export function checkConsecutiveNights(
  employeeId: number,
  assignments: AssignmentCamel[],
  patternMap: Map<string, ShiftPatternCamel>
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];
  const addedViolationDates = new Set<string>(); // Track dates we've already flagged

  // Get night shift dates
  const nightDates = assignments
    .filter(a => {
      const p = patternMap.get(a.shiftPatternId);
      // Pass assignment to support custom times
      return p && isNightShift(p, a.date, a);
    })
    .map(a => a.date)
    .sort();

  if (nightDates.length < 2) return violations;

  // Remove duplicates and sort
  const uniqueNightDates = [...new Set(nightDates)].sort();

  let consecutiveCount = 1;
  let streakDates: string[] = [uniqueNightDates[0]];

  for (let i = 1; i < uniqueNightDates.length; i++) {
    // Use timezone-safe date parsing
    const prevDate = parseLocalDate(uniqueNightDates[i - 1]);
    const currDate = parseLocalDate(uniqueNightDates[i]);
    const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 1) {
      consecutiveCount++;
      streakDates.push(uniqueNightDates[i]);

      // Flag violation on the specific day when threshold is exceeded
      // Warning on 5th night (CONSECUTIVE_NIGHTS_WARNING + 1), Error on 8th night (MAX_CONSECUTIVE_NIGHTS + 1)
      if (consecutiveCount === COMPLIANCE_LIMITS.MAX_CONSECUTIVE_NIGHTS + 1) {
        // Exceeded max - flag this day as an error
        const violationDate = uniqueNightDates[i];
        if (!addedViolationDates.has(violationDate)) {
          violations.push({
            type: 'MAX_CONSECUTIVE_NIGHTS',
            severity: 'error',
            employeeId,
            date: violationDate,
            message: `${consecutiveCount} consecutive night shifts (maximum ${COMPLIANCE_LIMITS.MAX_CONSECUTIVE_NIGHTS})`,
            value: consecutiveCount,
            limit: COMPLIANCE_LIMITS.MAX_CONSECUTIVE_NIGHTS,
            relatedDates: [...streakDates],
          });
          addedViolationDates.add(violationDate);
        }
      } else if (consecutiveCount === COMPLIANCE_LIMITS.CONSECUTIVE_NIGHTS_WARNING + 1) {
        // Reached warning threshold - flag this day as a warning
        const violationDate = uniqueNightDates[i];
        if (!addedViolationDates.has(violationDate)) {
          violations.push({
            type: 'CONSECUTIVE_NIGHTS_WARNING',
            severity: 'warning',
            employeeId,
            date: violationDate,
            message: `${consecutiveCount} consecutive night shifts - consider rest period`,
            value: consecutiveCount,
            limit: COMPLIANCE_LIMITS.MAX_CONSECUTIVE_NIGHTS,
            relatedDates: [...streakDates],
          });
          addedViolationDates.add(violationDate);
        }
      }
    } else {
      // Streak broken, reset
      consecutiveCount = 1;
      streakDates = [uniqueNightDates[i]];
    }
  }

  return violations;
}

// ==================== MAIN COMPLIANCE FUNCTIONS ====================

/**
 * Run all compliance checks for an employee
 */
export function checkEmployeeCompliance(
  employeeId: number,
  assignments: AssignmentCamel[],
  shiftPatterns: ShiftPatternCamel[]
): ComplianceResult {
  const patternMap = new Map(shiftPatterns.map(p => [p.id, p]));
  const empAssignments = assignments.filter(a => a.employeeId === employeeId);
  
  const violations: ComplianceViolation[] = [
    ...checkMaxShiftLength(employeeId, empAssignments, patternMap),
    ...checkRestPeriods(employeeId, empAssignments, patternMap),
    ...checkMultipleShiftsSameDay(employeeId, empAssignments, patternMap),
    ...checkWeeklyHours(employeeId, empAssignments, patternMap),
    ...checkConsecutiveDays(employeeId, empAssignments),
    ...checkConsecutiveNights(employeeId, empAssignments, patternMap),
  ];
  
  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');
  
  return {
    isCompliant: errors.length === 0,
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0,
    violations,
    errorCount: errors.length,
    warningCount: warnings.length,
  };
}

/**
 * Get compliance status badge for an employee
 */
export function getEmployeeComplianceStatus(
  employeeId: number,
  assignments: AssignmentCamel[],
  shiftPatterns: ShiftPatternCamel[]
): EmployeeComplianceStatus {
  const result = checkEmployeeCompliance(employeeId, assignments, shiftPatterns);
  
  return {
    employeeId,
    status: result.hasErrors ? 'error' : result.hasWarnings ? 'warning' : 'ok',
    violations: result.violations,
  };
}

/**
 * Run compliance checks for all employees in a project
 * IMPORTANT: This checks ALL assignments for employees who work on this project,
 * not just assignments within this project. This ensures cross-project violations
 * (e.g., working day shift on Project A then night shift on Project B) are detected.
 */
export function checkProjectCompliance(
  projectId: number,
  assignments: AssignmentCamel[],
  shiftPatterns: ShiftPatternCamel[]
): ComplianceResult {
  // Get employees who have assignments on THIS project
  const projectAssignments = assignments.filter(a => a.projectId === projectId);
  const employeeIds = [...new Set(projectAssignments.map(a => a.employeeId))];

  const allViolations: ComplianceViolation[] = [];

  // For each employee on this project, check ALL their assignments (cross-project)
  employeeIds.forEach(empId => {
    // Pass ALL assignments, not just project-filtered ones
    // This ensures we catch violations like:
    // - Day shift on Project A + Night shift on Project B = insufficient rest
    // - 72+ hours across multiple projects in a week
    const result = checkEmployeeCompliance(empId, assignments, shiftPatterns);
    allViolations.push(...result.violations);
  });

  const errors = allViolations.filter(v => v.severity === 'error');
  const warnings = allViolations.filter(v => v.severity === 'warning');

  return {
    isCompliant: errors.length === 0,
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0,
    violations: allViolations,
    errorCount: errors.length,
    warningCount: warnings.length,
  };
}

/**
 * Check if adding an assignment would cause violations
 * Used for real-time validation during drag-drop
 */
export function validateNewAssignment(
  employeeId: number,
  projectId: number,
  shiftPatternId: string,
  date: string,
  existingAssignments: AssignmentCamel[],
  shiftPatterns: ShiftPatternCamel[],
  customStartTime?: string,
  customEndTime?: string
): ComplianceViolation[] {
  // Create temporary assignment
  const tempAssignment: AssignmentCamel = {
    id: -1, // Temporary
    employeeId,
    projectId,
    shiftPatternId,
    date,
    organisationId: '',
    customStartTime,
    customEndTime,
  };

  // Get all employee assignments including the new one
  const allAssignments = [
    ...existingAssignments.filter(a => a.employeeId === employeeId),
    tempAssignment,
  ];

  const patternMap = new Map(shiftPatterns.map(p => [p.id, p]));

  // Run relevant checks
  const violations: ComplianceViolation[] = [];

  // Check max shift length for the new assignment
  const pattern = patternMap.get(shiftPatternId);
  if (pattern) {
    // Pass assignment to support custom times
    const duration = getShiftDuration(pattern, date, tempAssignment);
    if (duration > COMPLIANCE_LIMITS.MAX_SHIFT_HOURS) {
      violations.push({
        type: 'MAX_SHIFT_LENGTH',
        severity: 'error',
        employeeId,
        date,
        message: `Shift exceeds ${COMPLIANCE_LIMITS.MAX_SHIFT_HOURS}h limit`,
        value: duration,
        limit: COMPLIANCE_LIMITS.MAX_SHIFT_HOURS,
      });
    }
  }
  
  // Check for multiple shifts same day
  const sameDayAssignments = allAssignments.filter(a => a.date === date);
  if (sameDayAssignments.length > 1) {
    violations.push({
      type: 'MULTIPLE_SHIFTS_SAME_DAY',
      severity: 'error',
      employeeId,
      date,
      message: 'Already assigned to a shift on this date',
    });
  }
  
  // Check rest periods
  const restViolations = checkRestPeriods(employeeId, allAssignments, patternMap);
  violations.push(...restViolations.filter(v => v.date === date || v.relatedDates?.includes(date)));
  
  // Check weekly hours
  const weeklyViolations = checkWeeklyHours(employeeId, allAssignments, patternMap);
  violations.push(...weeklyViolations.filter(v => {
    // Only include violations on the date we're adding
    return v.date === date;
  }));
  
  return violations;
}

/**
 * Get violations for a specific date cell (for visual highlighting)
 * Only shows violations on the actual violation date, not on related dates
 * (e.g., consecutive nights warning only shows on the 5th night, not the first 4)
 */
export function getDateCellViolations(
  employeeId: number,
  date: string,
  violations: ComplianceViolation[]
): ComplianceViolation[] {
  return violations.filter(v =>
    v.employeeId === employeeId && v.date === date
  );
}
