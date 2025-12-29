import { Assignment, ShiftPattern, ComplianceResult, ComplianceViolation } from './types';

const RULES = {
  MAX_SHIFT_LENGTH: 12,
  MIN_REST_PERIOD: 12,
  MAX_WEEKLY_HOURS: 72,
  WEEKLY_WARNING_THRESHOLD: 66,
};

function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + minutes / 60;
}

function calculateDuration(startTime: string, endTime: string): number {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  if (end > start) return end - start;
  return (24 - start) + end;
}

function getShiftTimes(assignment: Assignment, pattern: ShiftPattern): { startTime: string; endTime: string } | null {
  if (assignment.custom_start_time && assignment.custom_end_time) {
    return { startTime: assignment.custom_start_time, endTime: assignment.custom_end_time };
  }
  if (pattern.weekly_schedule) {
    const date = new Date(assignment.date);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[date.getDay()] as keyof typeof pattern.weekly_schedule;
    const daySchedule = pattern.weekly_schedule[dayName];
    if (daySchedule && daySchedule.startTime && daySchedule.endTime) {
      return { startTime: daySchedule.startTime, endTime: daySchedule.endTime };
    }
  }
  if (pattern.start_time && pattern.end_time) {
    return { startTime: pattern.start_time, endTime: pattern.end_time };
  }
  return null;
}

export function checkProjectCompliance(assignments: Assignment[], patterns: ShiftPattern[]): ComplianceResult {
  const errors: ComplianceViolation[] = [];
  const warnings: ComplianceViolation[] = [];
  const patternMap = new Map(patterns.map(p => [p.id, p]));

  assignments.forEach(assignment => {
    const pattern = patternMap.get(assignment.shift_pattern_id);
    if (!pattern) return;

    const times = getShiftTimes(assignment, pattern);
    if (!times) return;

    const duration = calculateDuration(times.startTime, times.endTime);

    if (duration > RULES.MAX_SHIFT_LENGTH) {
      errors.push({
        rule: 'MAX_SHIFT_LENGTH',
        severity: 'error',
        message: `Shift exceeds ${RULES.MAX_SHIFT_LENGTH} hours (${duration.toFixed(1)}h)`,
        date: assignment.date,
        employeeId: assignment.employee_id,
      });
    }

    const employeeAssignments = assignments
      .filter(a => a.employee_id === assignment.employee_id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const sameDayAssignments = employeeAssignments.filter(a => a.date === assignment.date);
    if (sameDayAssignments.length > 1) {
      errors.push({
        rule: 'MULTIPLE_SHIFTS_SAME_DAY',
        severity: 'error',
        message: 'Multiple shifts on same day',
        date: assignment.date,
        employeeId: assignment.employee_id,
      });
    }

    const assignmentDate = new Date(assignment.date);
    const weekAgo = new Date(assignmentDate);
    weekAgo.setDate(weekAgo.getDate() - 6);

    let weeklyHours = 0;
    employeeAssignments.forEach(a => {
      const aDate = new Date(a.date);
      if (aDate >= weekAgo && aDate <= assignmentDate) {
        const aPattern = patternMap.get(a.shift_pattern_id);
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
        message: `Weekly hours exceed ${RULES.MAX_WEEKLY_HOURS}h (${weeklyHours.toFixed(1)}h)`,
        date: assignment.date,
        employeeId: assignment.employee_id,
      });
    } else if (weeklyHours > RULES.WEEKLY_WARNING_THRESHOLD) {
      warnings.push({
        rule: 'APPROACHING_WEEKLY_LIMIT',
        severity: 'warning',
        message: `Approaching weekly limit (${weeklyHours.toFixed(1)}h)`,
        date: assignment.date,
        employeeId: assignment.employee_id,
      });
    }
  });

  const uniqueErrors = errors.filter((v, i, arr) =>
    arr.findIndex(x => x.rule === v.rule && x.date === v.date && x.employeeId === v.employeeId) === i
  );

  return { errors: uniqueErrors, warnings, isValid: uniqueErrors.length === 0 };
}