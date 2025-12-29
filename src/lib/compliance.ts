import { Assignment, ShiftPattern, ComplianceViolation, ComplianceResult } from './types';
import { calculateShiftDuration, parseTimeToHours } from './fatigue-calculator';

// ==================== COMPLIANCE RULES ====================
// Based on Network Rail Fatigue Management Standard NR/L2/OHS/003

export const COMPLIANCE_RULES = {
  // Hard limits (errors)
  MAX_SHIFT_LENGTH: 12,           // Maximum shift length in hours
  MIN_REST_PERIOD: 12,            // Minimum rest between shifts in hours
  MAX_WEEKLY_HOURS: 72,           // Maximum hours in rolling 7-day period
  MAX_CONSECUTIVE_DAYS: 13,       // Maximum consecutive working days
  MAX_CONSECUTIVE_NIGHTS: 7,      // Maximum consecutive night shifts
  
  // Soft limits (warnings)
  WEEKLY_WARNING_THRESHOLD: 66,   // Warn when approaching weekly limit
  SHIFT_WARNING_THRESHOLD: 10,    // Warn for long shifts
  CONSECUTIVE_DAYS_WARNING: 10,   // Warn for consecutive days
  CONSECUTIVE_NIGHTS_WARNING: 4,  // Warn for consecutive nights
  
  // Night shift definition
  NIGHT_START_HOUR: 23,           // 23:00
  NIGHT_END_HOUR: 6,              // 06:00
};

// ==================== RULE CODES ====================

export const RULE_CODES = {
  MAX_SHIFT_LENGTH: 'MAX_SHIFT_LENGTH',
  MIN_REST_PERIOD: 'MIN_REST_PERIOD',
  MAX_WEEKLY_HOURS: 'MAX_WEEKLY_HOURS',
  APPROACHING_WEEKLY_LIMIT: 'APPROACHING_WEEKLY_LIMIT',
  MAX_CONSECUTIVE_DAYS: 'MAX_CONSECUTIVE_DAYS',
  MAX_CONSECUTIVE_NIGHTS: 'MAX_CONSECUTIVE_NIGHTS',
  CONSECUTIVE_DAYS_WARNING: 'CONSECUTIVE_DAYS_WARNING',
  CONSECUTIVE_NIGHTS_WARNING: 'CONSECUTIVE_NIGHTS_WARNING',
  MULTIPLE_SHIFTS_SAME_DAY: 'MULTIPLE_SHIFTS_SAME_DAY',
  DAY_NIGHT_TRANSITION: 'DAY_NIGHT_TRANSITION',
};

// ==================== HELPER FUNCTIONS ====================

function getShiftTimes(pattern: ShiftPattern, assignment: Assignment): { start: string; end: string } {
  return {
    start: assignment.custom_start_time || pattern.start_time || '00:00',
    end: assignment.custom_end_time || pattern.end_time || '00:00',
  };
}

function isNightShift(startTime: string, endTime: string, patternIsNight: boolean): boolean {
  if (patternIsNight) return true;
  
  const startHour = parseTimeToHours(startTime);
  const endHour = parseTimeToHours(endTime);
  
  // Night shift if it includes hours between 23:00 and 06:00
  return startHour >= COMPLIANCE_RULES.NIGHT_START_HOUR || endHour <= COMPLIANCE_RULES.NIGHT_END_HOUR;
}

function getPatternMap(patterns: ShiftPattern[]): Map<string, ShiftPattern> {
  return new Map(patterns.map(p => [p.id, p]));
}

// ==================== MAIN COMPLIANCE CHECK ====================

export function checkProjectCompliance(
  assignments: Assignment[],
  patterns: ShiftPattern[]
): ComplianceResult {
  const errors: ComplianceViolation[] = [];
  const warnings: ComplianceViolation[] = [];
  const patternMap = getPatternMap(patterns);

  // Group assignments by employee
  const assignmentsByEmployee = new Map<number, Assignment[]>();
  assignments.forEach(a => {
    const existing = assignmentsByEmployee.get(a.employee_id) || [];
    existing.push(a);
    assignmentsByEmployee.set(a.employee_id, existing);
  });

  // Check each employee's assignments
  assignmentsByEmployee.forEach((empAssignments, employeeId) => {
    const sortedAssignments = [...empAssignments].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Check individual shift rules
    sortedAssignments.forEach((assignment, idx) => {
      const pattern = patternMap.get(assignment.shift_pattern_id);
      if (!pattern) return;

      const times = getShiftTimes(pattern, assignment);
      const duration = calculateShiftDuration(times.start, times.end);

      // Check max shift length
      if (duration > COMPLIANCE_RULES.MAX_SHIFT_LENGTH) {
        errors.push({
          severity: 'error',
          rule: RULE_CODES.MAX_SHIFT_LENGTH,
          message: `Shift exceeds ${COMPLIANCE_RULES.MAX_SHIFT_LENGTH}h maximum (${duration.toFixed(1)}h)`,
          date: assignment.date,
          employeeId,
        });
      } else if (duration > COMPLIANCE_RULES.SHIFT_WARNING_THRESHOLD) {
        warnings.push({
          severity: 'warning',
          rule: RULE_CODES.MAX_SHIFT_LENGTH,
          message: `Long shift: ${duration.toFixed(1)}h`,
          date: assignment.date,
          employeeId,
        });
      }

      // Check rest period from previous shift
      if (idx > 0) {
        const prevAssignment = sortedAssignments[idx - 1];
        const prevPattern = patternMap.get(prevAssignment.shift_pattern_id);
        
        if (prevPattern) {
          const prevTimes = getShiftTimes(prevPattern, prevAssignment);
          const restHours = calculateRestPeriod(
            prevAssignment.date,
            prevTimes.end,
            assignment.date,
            times.start
          );

          if (restHours < COMPLIANCE_RULES.MIN_REST_PERIOD) {
            errors.push({
              severity: 'error',
              rule: RULE_CODES.MIN_REST_PERIOD,
              message: `Rest period below ${COMPLIANCE_RULES.MIN_REST_PERIOD}h minimum (${restHours.toFixed(1)}h)`,
              date: assignment.date,
              employeeId,
            });
          }

          // Check day/night transition
          const prevIsNight = isNightShift(prevTimes.start, prevTimes.end, prevPattern.is_night);
          const currIsNight = isNightShift(times.start, times.end, pattern.is_night);
          
          if (prevIsNight !== currIsNight && restHours < 24) {
            warnings.push({
              severity: 'warning',
              rule: RULE_CODES.DAY_NIGHT_TRANSITION,
              message: `Day/night transition with only ${restHours.toFixed(1)}h rest`,
              date: assignment.date,
              employeeId,
            });
          }
        }
      }
    });

    // Check multiple shifts same day
    const dateMap = new Map<string, Assignment[]>();
    sortedAssignments.forEach(a => {
      const existing = dateMap.get(a.date) || [];
      existing.push(a);
      dateMap.set(a.date, existing);
    });

    dateMap.forEach((dayAssignments, date) => {
      if (dayAssignments.length > 1) {
        errors.push({
          severity: 'error',
          rule: RULE_CODES.MULTIPLE_SHIFTS_SAME_DAY,
          message: `Multiple shifts assigned on same day (${dayAssignments.length} shifts)`,
          date,
          employeeId,
        });
      }
    });

    // Check weekly hours (rolling 7-day periods)
    checkWeeklyHours(sortedAssignments, patternMap, employeeId, errors, warnings);

    // Check consecutive working days
    checkConsecutiveDays(sortedAssignments, employeeId, errors, warnings);

    // Check consecutive night shifts
    checkConsecutiveNights(sortedAssignments, patternMap, employeeId, errors, warnings);
  });

  return {
    errors,
    warnings,
    isCompliant: errors.length === 0,
  };
}

// ==================== REST PERIOD CALCULATION ====================

function calculateRestPeriod(
  prevDate: string,
  prevEndTime: string,
  currDate: string,
  currStartTime: string
): number {
  const prevEndHour = parseTimeToHours(prevEndTime);
  const currStartHour = parseTimeToHours(currStartTime);
  
  const prevDateTime = new Date(prevDate);
  const currDateTime = new Date(currDate);
  const dayDiff = (currDateTime.getTime() - prevDateTime.getTime()) / (1000 * 60 * 60 * 24);
  
  let restHours = (dayDiff * 24) + currStartHour - prevEndHour;
  
  // Handle overnight shifts
  if (prevEndHour < 12 && dayDiff === 0) {
    // Previous shift ended early morning same day
    restHours = currStartHour - prevEndHour;
  } else if (prevEndHour > currStartHour && dayDiff === 1) {
    // Normal overnight gap
    restHours = (24 - prevEndHour) + currStartHour;
  }
  
  return Math.max(0, restHours);
}

// ==================== WEEKLY HOURS CHECK ====================

function checkWeeklyHours(
  assignments: Assignment[],
  patternMap: Map<string, ShiftPattern>,
  employeeId: number,
  errors: ComplianceViolation[],
  warnings: ComplianceViolation[]
): void {
  if (assignments.length === 0) return;

  // Get date range
  const dates = assignments.map(a => new Date(a.date));
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

  // Check each 7-day rolling window
  const current = new Date(minDate);
  while (current <= maxDate) {
    const windowEnd = new Date(current);
    windowEnd.setDate(windowEnd.getDate() + 6);

    let weeklyHours = 0;
    assignments.forEach(a => {
      const assignmentDate = new Date(a.date);
      if (assignmentDate >= current && assignmentDate <= windowEnd) {
        const pattern = patternMap.get(a.shift_pattern_id);
        if (pattern) {
          const times = getShiftTimes(pattern, a);
          weeklyHours += calculateShiftDuration(times.start, times.end);
        }
      }
    });

    const weekKey = current.toISOString().split('T')[0];

    if (weeklyHours > COMPLIANCE_RULES.MAX_WEEKLY_HOURS) {
      errors.push({
        severity: 'error',
        rule: RULE_CODES.MAX_WEEKLY_HOURS,
        message: `Weekly hours exceed ${COMPLIANCE_RULES.MAX_WEEKLY_HOURS}h maximum (${weeklyHours.toFixed(1)}h)`,
        date: weekKey,
        employeeId,
      });
    } else if (weeklyHours > COMPLIANCE_RULES.WEEKLY_WARNING_THRESHOLD) {
      warnings.push({
        severity: 'warning',
        rule: RULE_CODES.APPROACHING_WEEKLY_LIMIT,
        message: `Approaching weekly limit (${weeklyHours.toFixed(1)}h / ${COMPLIANCE_RULES.MAX_WEEKLY_HOURS}h)`,
        date: weekKey,
        employeeId,
      });
    }

    current.setDate(current.getDate() + 1);
  }
}

// ==================== CONSECUTIVE DAYS CHECK ====================

function checkConsecutiveDays(
  assignments: Assignment[],
  employeeId: number,
  errors: ComplianceViolation[],
  warnings: ComplianceViolation[]
): void {
  if (assignments.length === 0) return;

  const dates = [...new Set(assignments.map(a => a.date))].sort();
  let consecutiveCount = 1;
  let streakStart = dates[0];

  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1]);
    const currDate = new Date(dates[i]);
    const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

    if (dayDiff === 1) {
      consecutiveCount++;
    } else {
      // Check if streak exceeded limits
      if (consecutiveCount > COMPLIANCE_RULES.MAX_CONSECUTIVE_DAYS) {
        errors.push({
          severity: 'error',
          rule: RULE_CODES.MAX_CONSECUTIVE_DAYS,
          message: `Exceeded ${COMPLIANCE_RULES.MAX_CONSECUTIVE_DAYS} consecutive working days (${consecutiveCount} days)`,
          date: streakStart,
          employeeId,
        });
      } else if (consecutiveCount > COMPLIANCE_RULES.CONSECUTIVE_DAYS_WARNING) {
        warnings.push({
          severity: 'warning',
          rule: RULE_CODES.CONSECUTIVE_DAYS_WARNING,
          message: `${consecutiveCount} consecutive working days`,
          date: streakStart,
          employeeId,
        });
      }
      consecutiveCount = 1;
      streakStart = dates[i];
    }
  }

  // Check final streak
  if (consecutiveCount > COMPLIANCE_RULES.MAX_CONSECUTIVE_DAYS) {
    errors.push({
      severity: 'error',
      rule: RULE_CODES.MAX_CONSECUTIVE_DAYS,
      message: `Exceeded ${COMPLIANCE_RULES.MAX_CONSECUTIVE_DAYS} consecutive working days (${consecutiveCount} days)`,
      date: streakStart,
      employeeId,
    });
  } else if (consecutiveCount > COMPLIANCE_RULES.CONSECUTIVE_DAYS_WARNING) {
    warnings.push({
      severity: 'warning',
      rule: RULE_CODES.CONSECUTIVE_DAYS_WARNING,
      message: `${consecutiveCount} consecutive working days`,
      date: streakStart,
      employeeId,
    });
  }
}

// ==================== CONSECUTIVE NIGHTS CHECK ====================

function checkConsecutiveNights(
  assignments: Assignment[],
  patternMap: Map<string, ShiftPattern>,
  employeeId: number,
  errors: ComplianceViolation[],
  warnings: ComplianceViolation[]
): void {
  const nightAssignments = assignments.filter(a => {
    const pattern = patternMap.get(a.shift_pattern_id);
    if (!pattern) return false;
    const times = getShiftTimes(pattern, a);
    return isNightShift(times.start, times.end, pattern.is_night);
  });

  if (nightAssignments.length === 0) return;

  const dates = [...new Set(nightAssignments.map(a => a.date))].sort();
  let consecutiveCount = 1;
  let streakStart = dates[0];

  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1]);
    const currDate = new Date(dates[i]);
    const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

    if (dayDiff === 1) {
      consecutiveCount++;
    } else {
      if (consecutiveCount > COMPLIANCE_RULES.MAX_CONSECUTIVE_NIGHTS) {
        errors.push({
          severity: 'error',
          rule: RULE_CODES.MAX_CONSECUTIVE_NIGHTS,
          message: `Exceeded ${COMPLIANCE_RULES.MAX_CONSECUTIVE_NIGHTS} consecutive night shifts (${consecutiveCount} nights)`,
          date: streakStart,
          employeeId,
        });
      } else if (consecutiveCount > COMPLIANCE_RULES.CONSECUTIVE_NIGHTS_WARNING) {
        warnings.push({
          severity: 'warning',
          rule: RULE_CODES.CONSECUTIVE_NIGHTS_WARNING,
          message: `${consecutiveCount} consecutive night shifts`,
          date: streakStart,
          employeeId,
        });
      }
      consecutiveCount = 1;
      streakStart = dates[i];
    }
  }

  // Check final streak
  if (consecutiveCount > COMPLIANCE_RULES.MAX_CONSECUTIVE_NIGHTS) {
    errors.push({
      severity: 'error',
      rule: RULE_CODES.MAX_CONSECUTIVE_NIGHTS,
      message: `Exceeded ${COMPLIANCE_RULES.MAX_CONSECUTIVE_NIGHTS} consecutive night shifts (${consecutiveCount} nights)`,
      date: streakStart,
      employeeId,
    });
  } else if (consecutiveCount > COMPLIANCE_RULES.CONSECUTIVE_NIGHTS_WARNING) {
    warnings.push({
      severity: 'warning',
      rule: RULE_CODES.CONSECUTIVE_NIGHTS_WARNING,
      message: `${consecutiveCount} consecutive night shifts`,
      date: streakStart,
      employeeId,
    });
  }
}

// ==================== SINGLE EMPLOYEE CHECK ====================

export function checkEmployeeCompliance(
  employeeId: number,
  assignments: Assignment[],
  patterns: ShiftPattern[]
): ComplianceResult {
  const employeeAssignments = assignments.filter(a => a.employee_id === employeeId);
  return checkProjectCompliance(employeeAssignments, patterns);
}
