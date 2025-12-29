// ============================================
// COMPLIANCE ENGINE
// Network Rail Fatigue Rules
// ============================================

import { Assignment, ShiftPattern, ComplianceResult, ComplianceViolation } from './types';

// Compliance rule constants
const RULES = {
  MAX_SHIFT_LENGTH: 12, // hours
  MIN_REST_PERIOD: 12, // hours
  MAX_WEEKLY_HOURS: 72, // hours in rolling 7 days
  WEEKLY_WARNING_THRESHOLD: 66, // hours - warning level
  MAX_CONSECUTIVE_NIGHTS: 4, // warning after this
};

/**
 * Parse time string "HH:MM" to decimal hours
 */
function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + minutes / 60;
}

/**
 * Calculate shift duration handling overnight shifts
 */
function calculateDuration(startTime: string, endTime: string): number {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  
  if (end > start) {
    return end - start;
  }
  return (24 - start) + end;
}

/**
 * Check if a shift is a night shift (crosses midnight or ends after midnight)
 */
function isNightShift(startTime: string, endTime: string): boolean {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  return end < start || start >= 19 || end <= 7;
}

/**
 * Get shift times from assignment (using custom times or pattern defaults)
 */
function getShiftTimes(
  assignment: Assignment,
  pattern: ShiftPattern,
): { startTime: string; endTime: string } | null {
  // Check for custom times first
  if (assignment.custom_start_time && assignment.custom_end_time) {
    return {
      startTime: assignment.custom_start_time,
      endTime: assignment.custom_end_time,
    };
  }

  // Check weekly schedule
  if (pattern.weekly_schedule) {
    const date = new Date(assignment.date);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[date.getDay()] as keyof typeof pattern.weekly_schedule;
    const daySchedule = pattern.weekly_schedule[dayName];
    
    if (daySchedule && daySchedule.startTime && daySchedule.endTime) {
      return {
        startTime: daySchedule.startTime,
        endTime: daySchedule.endTime,
      };
    }
  }

  // Fall back to pattern defaults
  if (pattern.start_time && pattern.end_time) {
    return {
      startTime: pattern.start_time,
      endTime: pattern.end_time,
    };
  }

  return null;
}

/**
 * Check compliance for a single assignment
 */
export function checkSingleAssignment(
  assignment: Assignment,
  pattern: ShiftPattern,
  allAssignments: Assignment[],
  allPatterns: Map<string, ShiftPattern>,
): ComplianceResult {
  const errors: ComplianceViolation[] = [];
  const warnings: ComplianceViolation[] = [];

  const times = getShiftTimes(assignment, pattern);
  if (!times) {
    return { errors: [], warnings: [], isValid: true };
  }

  const { startTime, endTime } = times;
  const duration = calculateDuration(startTime, endTime);
  const assignmentDate = new Date(assignment.date);

  // Rule 1: Maximum shift length
  if (duration > RULES.MAX_SHIFT_LENGTH) {
    errors.push({
      rule: 'MAX_SHIFT_LENGTH',
      severity: 'error',
      message: `Shift exceeds maximum ${RULES.MAX_SHIFT_LENGTH} hours (${duration.toFixed(1)}h)`,
      date: assignment.date,
      employeeId: assignment.employee_id,
    });
  }

  // Get all assignments for this employee
  const employeeAssignments = allAssignments
    .filter(a => a.employee_id === assignment.employee_id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Rule 2: Multiple shifts same day
  const sameDayAssignments = employeeAssignments.filter(a => a.date === assignment.date);
  if (sameDayAssignments.length > 1) {
    errors.push({
      rule: 'MULTIPLE_SHIFTS_SAME_DAY',
      severity: 'error',
      message: 'Multiple shifts assigned on the same day',
      date: assignment.date,
      employeeId: assignment.employee_id,
    });
  }

  // Rule 3: Minimum rest period
  const currentIndex = employeeAssignments.findIndex(a => a.id === assignment.id);
  
  if (currentIndex > 0) {
    const prevAssignment = employeeAssignments[currentIndex - 1];
    const prevPattern = allPatterns.get(prevAssignment.shift_pattern_id);
    
    if (prevPattern) {
      const prevTimes = getShiftTimes(prevAssignment, prevPattern);
      if (prevTimes) {
        const prevDate = new Date(prevAssignment.date);
        const prevEndHour = parseTime(prevTimes.endTime);
        const currStartHour = parseTime(startTime);
        
        // Calculate rest period
        const daysDiff = Math.floor((assignmentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        let restHours = daysDiff * 24 + currStartHour - prevEndHour;
        
        // Handle overnight previous shift
        if (parseTime(prevTimes.startTime) > prevEndHour) {
          restHours -= 24;
        }
        
        if (restHours < RULES.MIN_REST_PERIOD) {
          errors.push({
            rule: 'MIN_REST_PERIOD',
            severity: 'error',
            message: `Rest period less than ${RULES.MIN_REST_PERIOD} hours (${restHours.toFixed(1)}h)`,
            date: assignment.date,
            employeeId: assignment.employee_id,
          });
        }

        // Rule 4: Day-to-night transition
        const prevIsNight = isNightShift(prevTimes.startTime, prevTimes.endTime);
        const currIsNight = isNightShift(startTime, endTime);
        
        if (!prevIsNight && currIsNight && prevAssignment.date === assignment.date) {
          errors.push({
            rule: 'DAY_NIGHT_TRANSITION',
            severity: 'error',
            message: 'Day shift followed by night shift on same day',
            date: assignment.date,
            employeeId: assignment.employee_id,
          });
        }
      }
    }
  }

  // Rule 5: Rolling 7-day hours
  const weekAgo = new Date(assignmentDate);
  weekAgo.setDate(weekAgo.getDate() - 6);
  
  let weeklyHours = 0;
  employeeAssignments.forEach(a => {
    const aDate = new Date(a.date);
    if (aDate >= weekAgo && aDate <= assignmentDate) {
      const aPattern = allPatterns.get(a.shift_pattern_id);
      if (aPattern) {
        const aTimes = getShiftTimes(a, aPattern);
        if (aTimes) {
          weeklyHours += calculateDuration(aTimes.startTime, aTimes.endTime);
        }
      }
    }
  });

  if (weeklyHours > RULES.MAX_WEEKLY_HOURS) {
    errors.push({
      rule: 'MAX_WEEKLY_HOURS',
      severity: 'error',
      message: `Weekly hours exceed ${RULES.MAX_WEEKLY_HOURS} hours (${weeklyHours.toFixed(1)}h in rolling 7 days)`,
      date: assignment.date,
      employeeId: assignment.employee_id,
    });
  } else if (weeklyHours > RULES.WEEKLY_WARNING_THRESHOLD) {
    warnings.push({
      rule: 'APPROACHING_WEEKLY_LIMIT',
      severity: 'warning',
      message: `Approaching weekly limit (${weeklyHours.toFixed(1)}h of ${RULES.MAX_WEEKLY_HOURS}h)`,
      date: assignment.date,
      employeeId: assignment.employee_id,
    });
  }

  // Rule 6: Consecutive night shifts
  let consecutiveNights = 0;
  for (let i = currentIndex; i >= 0; i--) {
    const a = employeeAssignments[i];
    const p = allPatterns.get(a.shift_pattern_id);
    if (p) {
      const t = getShiftTimes(a, p);
      if (t && isNightShift(t.startTime, t.endTime)) {
        consecutiveNights++;
      } else {
        break;
      }
    }
  }

  if (consecutiveNights > RULES.MAX_CONSECUTIVE_NIGHTS) {
    warnings.push({
      rule: 'CONSECUTIVE_NIGHT_SHIFTS',
      severity: 'warning',
      message: `${consecutiveNights} consecutive night shifts (recommended max: ${RULES.MAX_CONSECUTIVE_NIGHTS})`,
      date: assignment.date,
      employeeId: assignment.employee_id,
    });
  }

  return {
    errors,
    warnings,
    isValid: errors.length === 0,
  };
}

/**
 * Check compliance for all assignments in a project
 */
export function checkProjectCompliance(
  assignments: Assignment[],
  patterns: ShiftPattern[],
): ComplianceResult {
  const allErrors: ComplianceViolation[] = [];
  const allWarnings: ComplianceViolation[] = [];
  
  const patternMap = new Map(patterns.map(p => [p.id, p]));

  assignments.forEach(assignment => {
    const pattern = patternMap.get(assignment.shift_pattern_id);
    if (pattern) {
      const result = checkSingleAssignment(assignment, pattern, assignments, patternMap);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }
  });

  // Deduplicate violations
  const uniqueErrors = allErrors.filter((v, i, arr) => 
    arr.findIndex(x => x.rule === v.rule && x.date === v.date && x.employeeId === v.employeeId) === i
  );
  const uniqueWarnings = allWarnings.filter((v, i, arr) => 
    arr.findIndex(x => x.rule === v.rule && x.date === v.date && x.employeeId === v.employeeId) === i
  );

  return {
    errors: uniqueErrors,
    warnings: uniqueWarnings,
    isValid: uniqueErrors.length === 0,
  };
}

/**
 * Get compliance summary counts for a project
 */
export function getComplianceSummary(
  assignments: Assignment[],
  patterns: ShiftPattern[],
): { errorCount: number; warningCount: number } {
  const result = checkProjectCompliance(assignments, patterns);
  return {
    errorCount: result.errors.length,
    warningCount: result.warnings.length,
  };
}
