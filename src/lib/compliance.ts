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

  // NR/L2/OHS/003 Exceedance Levels
  LEVEL_1_THRESHOLD: 60,  // Level 1 exceedance: 60-72 hours (restrictions apply)
  LEVEL_2_THRESHOLD: 72,  // Level 2 exceedance: 72+ hours (complete prohibition)
  MANDATORY_REST_AFTER_LEVEL_2: 24, // 24 hours rest required after Level 2

  // Soft Limits (Warnings)
  APPROACHING_WEEKLY_HOURS: 66,
  CONSECUTIVE_NIGHTS_WARNING: 4,
  CONSECUTIVE_DAYS_WARNING: 6, // Warn after 7 consecutive days

  // Night shift definition
  NIGHT_START_HOUR: 20, // 8pm onwards considered night
  NIGHT_END_HOUR: 6,    // Before 6am considered night
} as const;

// ==================== TYPES ====================

/**
 * Compliance severity levels (4-tier system per NR/L2/OHS/003):
 * - 'ok': Green - Fully compliant, no issues
 * - 'level1': Yellow - Level 1 Exceedance (60-72h), requires risk assessment
 * - 'level2': Amber - Level 2 Exceedance (72h+), requires risk assessment
 * - 'breach': Red - Hard breach (e.g., <12h rest), stop working immediately
 */
export type ViolationSeverity = 'breach' | 'level2' | 'level1' | 'warning';

/**
 * Compliance status for display (4-tier)
 */
export type ComplianceStatus = 'ok' | 'level1' | 'level2' | 'breach';

export type ViolationType =
  | 'MAX_SHIFT_LENGTH'
  | 'INSUFFICIENT_REST'
  | 'MAX_WEEKLY_HOURS'
  | 'LEVEL_1_EXCEEDANCE'         // 60-72 hours: amber warning with duty restrictions
  | 'LEVEL_2_EXCEEDANCE'         // 72+ hours: red error, complete work prohibition
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
  status: ComplianceStatus;
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
        severity: 'breach',  // Red - hard limit exceeded, stop working
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
        severity: 'breach',  // Red - hard limit breached, stop working
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
          severity: 'breach',  // Red - hard limit breached
          employeeId,
          date,
          message: 'Day shift followed by night shift on same date - insufficient rest',
        });
      } else {
        violations.push({
          type: 'MULTIPLE_SHIFTS_SAME_DAY',
          severity: 'breach',  // Red - hard limit breached
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

    // NR/L2/OHS/003 Exceedance Levels
    if (totalHours >= COMPLIANCE_LIMITS.LEVEL_2_THRESHOLD) {
      // Level 2 Exceedance: 72+ hours - AMBER (requires risk assessment)
      // Complete prohibition on all work until 24 hours consecutive rest
      violations.push({
        type: 'LEVEL_2_EXCEEDANCE',
        severity: 'level2',  // Amber - Level 2 exceedance, needs risk assessment
        employeeId,
        date: assignment.date,
        message: `LEVEL 2 EXCEEDANCE: ${totalHours.toFixed(1)}h in rolling 7 days (72h limit breached) - Complete work prohibition, 24h mandatory rest required`,
        value: Math.round(totalHours * 10) / 10,
        limit: COMPLIANCE_LIMITS.LEVEL_2_THRESHOLD,
        windowEnd: windowEnd.toISOString().split('T')[0],
        relatedDates: windowDates,
      });
    } else if (totalHours >= COMPLIANCE_LIMITS.LEVEL_1_THRESHOLD) {
      // Level 1 Exceedance: 60-72 hours - YELLOW (requires risk assessment)
      // No safety-critical duties (COSS, PICOP, lookout, driving, IWA)
      violations.push({
        type: 'LEVEL_1_EXCEEDANCE',
        severity: 'level1',  // Yellow - Level 1 exceedance, needs risk assessment
        employeeId,
        date: assignment.date,
        message: `LEVEL 1 EXCEEDANCE: ${totalHours.toFixed(1)}h in rolling 7 days (60-72h range) - Safety-critical duty restrictions apply`,
        value: Math.round(totalHours * 10) / 10,
        limit: COMPLIANCE_LIMITS.LEVEL_1_THRESHOLD,
        windowEnd: windowEnd.toISOString().split('T')[0],
        relatedDates: windowDates,
      });
    } else if (totalHours > COMPLIANCE_LIMITS.APPROACHING_WEEKLY_HOURS) {
      // Approaching limits: 66+ hours - early warning
      violations.push({
        type: 'APPROACHING_WEEKLY_LIMIT',
        severity: 'warning',
        employeeId,
        date: assignment.date,
        message: `${totalHours.toFixed(1)}h in rolling 7 days (approaching 60h Level 1 threshold)`,
        value: Math.round(totalHours * 10) / 10,
        limit: COMPLIANCE_LIMITS.LEVEL_1_THRESHOLD,
        windowEnd: windowEnd.toISOString().split('T')[0],
      });
    }
  });

  return violations;
}

/**
 * Check 24-hour mandatory rest after Level 2 exceedance
 * When an employee reaches 72+ hours (Level 2), they must have 24 consecutive hours
 * of rest before returning to work. This checks if assignments violate this requirement.
 */
export function check24HourRestAfterLevel2(
  employeeId: number,
  assignments: AssignmentCamel[],
  patternMap: Map<string, ShiftPatternCamel>
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  if (assignments.length === 0) return violations;

  // Sort by date
  const sorted = [...assignments].sort((a, b) =>
    parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()
  );

  // Track Level 2 exceedances
  const level2Dates = new Set<string>();

  // First pass: identify all dates with Level 2 exceedances
  sorted.forEach(assignment => {
    const windowEnd = parseLocalDate(assignment.date);
    const windowStart = new Date(windowEnd);
    windowStart.setDate(windowStart.getDate() - 6);

    let totalHours = 0;

    sorted.forEach(a => {
      const aDate = parseLocalDate(a.date);
      if (aDate >= windowStart && aDate <= windowEnd) {
        const pattern = patternMap.get(a.shiftPatternId);
        if (pattern) {
          totalHours += getShiftDuration(pattern, a.date, a);
        }
      }
    });

    if (totalHours >= COMPLIANCE_LIMITS.LEVEL_2_THRESHOLD) {
      level2Dates.add(assignment.date);
    }
  });

  // Second pass: check if employee returns to work without 24h rest after Level 2
  for (let i = 0; i < sorted.length; i++) {
    const currentDate = sorted[i].date;

    // Check if this date is after a Level 2 exceedance
    // Find the most recent Level 2 date before current date
    let lastLevel2Date: string | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (level2Dates.has(sorted[j].date)) {
        lastLevel2Date = sorted[j].date;
        break;
      }
    }

    if (lastLevel2Date) {
      const lastLevel2Pattern = patternMap.get(sorted.find(a => a.date === lastLevel2Date)!.shiftPatternId);
      const currentPattern = patternMap.get(sorted[i].shiftPatternId);

      if (lastLevel2Pattern && currentPattern) {
        // Calculate time between end of last shift and start of current shift
        const lastLevel2Assignment = sorted.find(a => a.date === lastLevel2Date);
        const restHours = calculateRestBetweenShifts(
          lastLevel2Pattern,
          lastLevel2Date,
          currentPattern,
          currentDate,
          lastLevel2Assignment,
          sorted[i]
        );

        // Check if there was a full 24 hours of rest
        if (restHours >= 0 && restHours < COMPLIANCE_LIMITS.MANDATORY_REST_AFTER_LEVEL_2) {
          // Also verify no work occurred in between
          let workInBetween = false;
          for (let k = 0; k < sorted.length; k++) {
            const betweenDate = parseLocalDate(sorted[k].date);
            const level2EndDate = parseLocalDate(lastLevel2Date);
            const currentStartDate = parseLocalDate(currentDate);

            if (betweenDate > level2EndDate && betweenDate < currentStartDate) {
              workInBetween = true;
              break;
            }
          }

          if (!workInBetween) {
            violations.push({
              type: 'INSUFFICIENT_REST',
              severity: 'breach',  // Red - mandatory rest not taken after Level 2
              employeeId,
              date: currentDate,
              message: `Only ${restHours.toFixed(1)}h rest after Level 2 exceedance (24h mandatory rest required per NR/L2/OHS/003)`,
              value: Math.round(restHours * 10) / 10,
              limit: COMPLIANCE_LIMITS.MANDATORY_REST_AFTER_LEVEL_2,
              relatedDates: [lastLevel2Date],
            });
          }
        }
      }
    }
  }

  return violations;
}

/**
 * Check Fatigue Risk Index (FRI) thresholds per NR/L2/OHS/003
 * Module 1, Section 4.3: FRI risk score must not exceed 1.6
 *
 * NOTE: The standard also mentions fatigue scores of 35 (daytime) and 45 (nighttime),
 * but these appear to use a different scale than HSE RR446. The risk index threshold
 * of 1.6 is clearly defined and enforced here.
 */
export function checkFatigueRiskIndex(
  employeeId: number,
  assignments: AssignmentCamel[],
  patternMap: Map<string, ShiftPatternCamel>
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  // Import FRI calculation at runtime to avoid circular dependencies
  const { calculateRiskIndex } = require('./fatigue');
  const { FRI_THRESHOLDS } = require('./constants');

  if (assignments.length === 0) return violations;

  // Sort by date
  const sorted = [...assignments].sort((a, b) =>
    parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()
  );

  // Build shift sequence for FRI calculation
  const shiftSequence = sorted.map((assignment, index) => {
    const pattern = patternMap.get(assignment.shiftPatternId);
    if (!pattern) return null;

    const times = getShiftTimes(pattern, assignment.date, assignment);
    if (!times) return null;

    return {
      day: index + 1, // Sequential day number
      startTime: times.start,
      endTime: times.end,
      commuteIn: pattern.commuteTime ? Math.floor(pattern.commuteTime / 2) : 30,
      commuteOut: pattern.commuteTime ? Math.ceil(pattern.commuteTime / 2) : 30,
      workload: pattern.workload || 1, // Use worst-case (1=most demanding) for compliance checking
      attention: pattern.attention || 1, // Use worst-case (1=most attention) for compliance checking
      breakFreq: pattern.breakFrequency || 180,
      breakLen: pattern.breakLength || 30,
    };
  }).filter(Boolean);

  // Calculate FRI for each shift
  shiftSequence.forEach((shift, index) => {
    if (!shift) return;

    const friResult = calculateRiskIndex(shift, index, shiftSequence);
    const assignment = sorted[index];

    // Check if risk index exceeds Network Rail threshold
    if (friResult.riskIndex > FRI_THRESHOLDS.RISK_SCORE_LIMIT) {
      violations.push({
        type: 'ELEVATED_FATIGUE_INDEX',
        severity: 'breach',  // Red - FRI limit exceeded
        employeeId,
        date: assignment.date,
        message: `FRI risk score ${friResult.riskIndex.toFixed(2)} exceeds Network Rail limit of ${FRI_THRESHOLDS.RISK_SCORE_LIMIT} (NR/L2/OHS/003 Module 1)`,
        value: Math.round(friResult.riskIndex * 100) / 100,
        limit: FRI_THRESHOLDS.RISK_SCORE_LIMIT,
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
            severity: 'breach',  // Red - hard limit exceeded
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
            message: `${consecutiveCount} consecutive days (limit is ${COMPLIANCE_LIMITS.MAX_CONSECUTIVE_DAYS}) - not yet breached`,
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
        // Exceeded max - flag this day as a breach
        const violationDate = uniqueNightDates[i];
        if (!addedViolationDates.has(violationDate)) {
          violations.push({
            type: 'MAX_CONSECUTIVE_NIGHTS',
            severity: 'breach',  // Red - hard limit exceeded
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
            message: `${consecutiveCount} consecutive nights (limit is ${COMPLIANCE_LIMITS.MAX_CONSECUTIVE_NIGHTS}) - not yet breached`,
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
    ...check24HourRestAfterLevel2(employeeId, empAssignments, patternMap),
    ...checkConsecutiveDays(employeeId, empAssignments),
    ...checkConsecutiveNights(employeeId, empAssignments, patternMap),
    ...checkFatigueRiskIndex(employeeId, empAssignments, patternMap),
  ];
  
  const breaches = violations.filter(v => v.severity === 'breach');
  const level2Violations = violations.filter(v => v.severity === 'level2');
  const level1Violations = violations.filter(v => v.severity === 'level1');
  const warnings = violations.filter(v => v.severity === 'warning');

  return {
    isCompliant: breaches.length === 0 && level2Violations.length === 0 && level1Violations.length === 0,
    hasErrors: breaches.length > 0,
    hasWarnings: warnings.length > 0 || level1Violations.length > 0 || level2Violations.length > 0,
    violations,
    errorCount: breaches.length,
    warningCount: warnings.length + level1Violations.length + level2Violations.length,
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

  // Determine status based on highest severity violation (4-tier: ok, level1, level2, breach)
  const hasBreach = result.violations.some(v => v.severity === 'breach');
  const hasLevel2 = result.violations.some(v => v.severity === 'level2');
  const hasLevel1 = result.violations.some(v => v.severity === 'level1');

  let status: ComplianceStatus = 'ok';
  if (hasBreach) {
    status = 'breach';
  } else if (hasLevel2) {
    status = 'level2';
  } else if (hasLevel1) {
    status = 'level1';
  }

  return {
    employeeId,
    status,
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

  const breaches = allViolations.filter(v => v.severity === 'breach');
  const level2Violations = allViolations.filter(v => v.severity === 'level2');
  const level1Violations = allViolations.filter(v => v.severity === 'level1');
  const warnings = allViolations.filter(v => v.severity === 'warning');

  return {
    isCompliant: breaches.length === 0 && level2Violations.length === 0 && level1Violations.length === 0,
    hasErrors: breaches.length > 0,
    hasWarnings: warnings.length > 0 || level1Violations.length > 0 || level2Violations.length > 0,
    violations: allViolations,
    errorCount: breaches.length,
    warningCount: warnings.length + level1Violations.length + level2Violations.length,
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
        severity: 'breach',  // Red - hard limit exceeded
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
      severity: 'breach',  // Red - hard limit breached
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
