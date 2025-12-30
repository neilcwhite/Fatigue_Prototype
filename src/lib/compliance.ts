// ============================================
// NETWORK RAIL COMPLIANCE RULES
// Based on NR/L2/OHS/003 Fatigue Risk Management Standard
// ============================================

import { 
  Assignment, 
  ShiftPattern, 
  ComplianceViolation, 
  ComplianceResult,
  ViolationType 
} from './types';
import { parseTimeToHours, calculateDutyLength } from './fatigue';

// ==================== COMPLIANCE LIMITS ====================

export const COMPLIANCE_LIMITS = {
  // Maximum shift duration
  MAX_SHIFT_HOURS: 12,
  
  // Minimum rest between shifts
  MIN_REST_HOURS: 12,
  
  // Maximum hours in rolling 7-day period
  MAX_WEEKLY_HOURS: 72,
  
  // Maximum consecutive days worked
  MAX_CONSECUTIVE_DAYS: 13,
  
  // Maximum consecutive night shifts
  MAX_CONSECUTIVE_NIGHTS: 7,
  
  // Night shift definition (start after this hour)
  NIGHT_START_HOUR: 22,
  
  // Night shift definition (end before this hour)
  NIGHT_END_HOUR: 6,
} as const;

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate shift duration in hours
 */
function getShiftDuration(pattern: ShiftPattern, date: string): number {
  // Check for weekly schedule
  if (pattern.weekly_schedule) {
    const dayOfWeek = getDayOfWeek(date);
    const daySchedule = pattern.weekly_schedule[dayOfWeek];
    if (daySchedule?.startTime && daySchedule?.endTime) {
      const start = parseTimeToHours(daySchedule.startTime);
      const end = parseTimeToHours(daySchedule.endTime);
      return calculateDutyLength(start, end);
    }
  }
  
  // Fall back to simple times
  if (pattern.start_time && pattern.end_time) {
    const start = parseTimeToHours(pattern.start_time);
    const end = parseTimeToHours(pattern.end_time);
    return calculateDutyLength(start, end);
  }
  
  return 0;
}

/**
 * Get day of week key (Sat, Sun, Mon, etc.)
 */
type DayKey = 'Sat' | 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';

function getDayOfWeek(dateStr: string): DayKey {
  const date = new Date(dateStr);
  const days: DayKey[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
}

/**
 * Check if shift is a night shift
 */
function isNightShift(pattern: ShiftPattern, date?: string): boolean {
  if (pattern.is_night) return true;
  
  let startTime = pattern.start_time;
  let endTime = pattern.end_time;
  
  // Check weekly schedule
  if (pattern.weekly_schedule && date) {
    const dayOfWeek = getDayOfWeek(date);
    const daySchedule = pattern.weekly_schedule[dayOfWeek];
    if (daySchedule) {
      startTime = daySchedule.startTime;
      endTime = daySchedule.endTime;
    }
  }
  
  if (!startTime || !endTime) return false;
  
  const start = parseTimeToHours(startTime);
  const end = parseTimeToHours(endTime);
  
  // Night shift: starts after 22:00 or ends before 06:00 (and crosses midnight)
  return start >= COMPLIANCE_LIMITS.NIGHT_START_HOUR || 
         (end <= COMPLIANCE_LIMITS.NIGHT_END_HOUR && end < start);
}

/**
 * Get shift end time
 */
function getShiftEndTime(pattern: ShiftPattern, date: string): number {
  if (pattern.weekly_schedule) {
    const dayOfWeek = getDayOfWeek(date);
    const daySchedule = pattern.weekly_schedule[dayOfWeek];
    if (daySchedule?.endTime) {
      return parseTimeToHours(daySchedule.endTime);
    }
  }
  
  if (pattern.end_time) {
    return parseTimeToHours(pattern.end_time);
  }
  
  return 0;
}

/**
 * Get shift start time
 */
function getShiftStartTime(pattern: ShiftPattern, date: string): number {
  if (pattern.weekly_schedule) {
    const dayOfWeek = getDayOfWeek(date);
    const daySchedule = pattern.weekly_schedule[dayOfWeek];
    if (daySchedule?.startTime) {
      return parseTimeToHours(daySchedule.startTime);
    }
  }
  
  if (pattern.start_time) {
    return parseTimeToHours(pattern.start_time);
  }
  
  return 0;
}

/**
 * Calculate rest period between two consecutive assignments
 */
function calculateRestBetween(
  prevAssignment: Assignment,
  prevPattern: ShiftPattern,
  currentAssignment: Assignment,
  currentPattern: ShiftPattern
): number {
  const prevEndHour = getShiftEndTime(prevPattern, prevAssignment.date);
  const currStartHour = getShiftStartTime(currentPattern, currentAssignment.date);
  
  // Calculate days between
  const prevDate = new Date(prevAssignment.date);
  const currDate = new Date(currentAssignment.date);
  const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Calculate rest hours
  let restHours = daysDiff * 24 + currStartHour - prevEndHour;
  
  // Handle overnight shifts
  if (prevEndHour > currStartHour && daysDiff === 1) {
    restHours = currStartHour + (24 - prevEndHour);
  }
  
  return restHours;
}

// ==================== COMPLIANCE CHECKS ====================

/**
 * Check maximum shift duration
 */
export function checkMaxShiftDuration(
  assignment: Assignment,
  pattern: ShiftPattern
): ComplianceViolation | null {
  const duration = getShiftDuration(pattern, assignment.date);
  
  if (duration > COMPLIANCE_LIMITS.MAX_SHIFT_HOURS) {
    return {
      type: 'MAX_SHIFT_EXCEEDED',
      employeeId: assignment.employee_id,
      date: assignment.date,
      message: `Shift duration ${duration.toFixed(1)}h exceeds maximum ${COMPLIANCE_LIMITS.MAX_SHIFT_HOURS}h`,
      severity: 'breach',
    };
  }
  
  return null;
}

/**
 * Check minimum rest between shifts
 */
export function checkMinRestPeriod(
  assignments: Assignment[],
  patterns: Map<string, ShiftPattern>,
  employeeId: number
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];
  
  // Get employee's assignments sorted by date
  const empAssignments = assignments
    .filter(a => a.employee_id === employeeId)
    .sort((a, b) => a.date.localeCompare(b.date));
  
  for (let i = 1; i < empAssignments.length; i++) {
    const prev = empAssignments[i - 1];
    const curr = empAssignments[i];
    
    const prevPattern = patterns.get(prev.shift_pattern_id);
    const currPattern = patterns.get(curr.shift_pattern_id);
    
    if (!prevPattern || !currPattern) continue;
    
    const restHours = calculateRestBetween(prev, prevPattern, curr, currPattern);
    
    if (restHours < COMPLIANCE_LIMITS.MIN_REST_HOURS) {
      violations.push({
        type: 'MIN_REST_VIOLATED',
        employeeId,
        date: curr.date,
        message: `Rest period ${restHours.toFixed(1)}h is less than minimum ${COMPLIANCE_LIMITS.MIN_REST_HOURS}h`,
        severity: 'breach',
      });
    }
  }
  
  return violations;
}

/**
 * Check maximum weekly hours (rolling 7-day window)
 */
export function checkMaxWeeklyHours(
  assignments: Assignment[],
  patterns: Map<string, ShiftPattern>,
  employeeId: number
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];
  
  // Get employee's assignments sorted by date
  const empAssignments = assignments
    .filter(a => a.employee_id === employeeId)
    .sort((a, b) => a.date.localeCompare(b.date));
  
  if (empAssignments.length === 0) return violations;
  
  // Check each 7-day window
  const dates = [...new Set(empAssignments.map(a => a.date))];
  
  for (const startDate of dates) {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    
    const windowAssignments = empAssignments.filter(a => {
      const d = new Date(a.date);
      return d >= start && d < end;
    });
    
    let totalHours = 0;
    for (const a of windowAssignments) {
      const pattern = patterns.get(a.shift_pattern_id);
      if (pattern) {
        totalHours += getShiftDuration(pattern, a.date);
      }
    }
    
    if (totalHours > COMPLIANCE_LIMITS.MAX_WEEKLY_HOURS) {
      // Only add if not already reported for this window
      const existingViolation = violations.find(
        v => v.type === 'MAX_WEEKLY_EXCEEDED' && v.date === startDate
      );
      
      if (!existingViolation) {
        violations.push({
          type: 'MAX_WEEKLY_EXCEEDED',
          employeeId,
          date: startDate,
          message: `Weekly hours ${totalHours.toFixed(1)}h exceeds maximum ${COMPLIANCE_LIMITS.MAX_WEEKLY_HOURS}h`,
          severity: 'breach',
        });
      }
    }
  }
  
  return violations;
}

/**
 * Check maximum consecutive days worked
 */
export function checkMaxConsecutiveDays(
  assignments: Assignment[],
  employeeId: number
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];
  
  // Get unique dates for employee
  const dates = [...new Set(
    assignments
      .filter(a => a.employee_id === employeeId)
      .map(a => a.date)
  )].sort();
  
  if (dates.length <= COMPLIANCE_LIMITS.MAX_CONSECUTIVE_DAYS) return violations;
  
  let consecutiveCount = 1;
  let streakStart = dates[0];
  
  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1]);
    const currDate = new Date(dates[i]);
    const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 1) {
      consecutiveCount++;
      
      if (consecutiveCount > COMPLIANCE_LIMITS.MAX_CONSECUTIVE_DAYS) {
        violations.push({
          type: 'MAX_CONSECUTIVE_DAYS',
          employeeId,
          date: dates[i],
          message: `${consecutiveCount} consecutive days exceeds maximum ${COMPLIANCE_LIMITS.MAX_CONSECUTIVE_DAYS}`,
          severity: 'breach',
        });
      }
    } else {
      consecutiveCount = 1;
      streakStart = dates[i];
    }
  }
  
  return violations;
}

/**
 * Check maximum consecutive night shifts
 */
export function checkMaxConsecutiveNights(
  assignments: Assignment[],
  patterns: Map<string, ShiftPattern>,
  employeeId: number
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];
  
  // Get employee's night shift assignments sorted by date
  const nightAssignments = assignments
    .filter(a => {
      if (a.employee_id !== employeeId) return false;
      const pattern = patterns.get(a.shift_pattern_id);
      return pattern && isNightShift(pattern, a.date);
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  
  if (nightAssignments.length <= COMPLIANCE_LIMITS.MAX_CONSECUTIVE_NIGHTS) {
    return violations;
  }
  
  let consecutiveCount = 1;
  
  for (let i = 1; i < nightAssignments.length; i++) {
    const prevDate = new Date(nightAssignments[i - 1].date);
    const currDate = new Date(nightAssignments[i].date);
    const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 1) {
      consecutiveCount++;
      
      if (consecutiveCount > COMPLIANCE_LIMITS.MAX_CONSECUTIVE_NIGHTS) {
        violations.push({
          type: 'MAX_CONSECUTIVE_NIGHTS',
          employeeId,
          date: nightAssignments[i].date,
          message: `${consecutiveCount} consecutive nights exceeds maximum ${COMPLIANCE_LIMITS.MAX_CONSECUTIVE_NIGHTS}`,
          severity: 'breach',
        });
      }
    } else {
      consecutiveCount = 1;
    }
  }
  
  return violations;
}

// ==================== MAIN COMPLIANCE CHECK ====================

/**
 * Run all compliance checks for an employee
 */
export function checkEmployeeCompliance(
  employeeId: number,
  assignments: Assignment[],
  patterns: Map<string, ShiftPattern>
): ComplianceResult {
  const violations: ComplianceViolation[] = [];
  
  // Check each assignment for max shift duration
  const empAssignments = assignments.filter(a => a.employee_id === employeeId);
  
  for (const assignment of empAssignments) {
    const pattern = patterns.get(assignment.shift_pattern_id);
    if (pattern) {
      const shiftViolation = checkMaxShiftDuration(assignment, pattern);
      if (shiftViolation) violations.push(shiftViolation);
    }
  }
  
  // Check rest periods
  violations.push(...checkMinRestPeriod(assignments, patterns, employeeId));
  
  // Check weekly hours
  violations.push(...checkMaxWeeklyHours(assignments, patterns, employeeId));
  
  // Check consecutive days
  violations.push(...checkMaxConsecutiveDays(assignments, employeeId));
  
  // Check consecutive nights
  violations.push(...checkMaxConsecutiveNights(assignments, patterns, employeeId));
  
  return {
    isCompliant: violations.length === 0,
    violations,
  };
}

/**
 * Run compliance checks for all employees in a project
 */
export function checkProjectCompliance(
  projectId: number,
  assignments: Assignment[],
  patterns: ShiftPattern[]
): ComplianceResult {
  const projectAssignments = assignments.filter(a => a.project_id === projectId);
  const patternMap = new Map(patterns.map(p => [p.id, p]));
  
  const allViolations: ComplianceViolation[] = [];
  const employeeIds = [...new Set(projectAssignments.map(a => a.employee_id))];
  
  for (const employeeId of employeeIds) {
    const result = checkEmployeeCompliance(employeeId, projectAssignments, patternMap);
    allViolations.push(...result.violations);
  }
  
  return {
    isCompliant: allViolations.length === 0,
    violations: allViolations,
  };
}
