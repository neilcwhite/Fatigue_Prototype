/**
 * Unit Tests for Network Rail Compliance Rules
 *
 * Tests verify compliance checking against NR/L2/OHS/003 Fatigue Risk Management Standard.
 */

import {
  COMPLIANCE_LIMITS,
  checkMaxShiftLength,
  checkRestPeriods,
  checkMultipleShiftsSameDay,
  checkWeeklyHours,
  checkConsecutiveDays,
  checkConsecutiveNights,
  checkEmployeeCompliance,
  checkProjectCompliance,
  validateNewAssignment,
  getDateCellViolations,
} from './compliance';
import type { AssignmentCamel, ShiftPatternCamel } from './types';

// Helper to create test assignments
const createAssignment = (
  id: number,
  employeeId: number,
  projectId: number,
  shiftPatternId: string,
  date: string,
  overrides: Partial<AssignmentCamel> = {}
): AssignmentCamel => ({
  id,
  employeeId,
  projectId,
  shiftPatternId,
  date,
  organisationId: 'test-org',
  ...overrides,
});

// Helper to create test shift patterns
const createPattern = (
  id: string,
  projectId: number,
  startTime: string,
  endTime: string,
  overrides: Partial<ShiftPatternCamel> = {}
): ShiftPatternCamel => ({
  id,
  projectId,
  name: `Pattern ${id}`,
  startTime,
  endTime,
  dutyType: 'Non-Possession',
  isNight: false,
  organisationId: 'test-org',
  ...overrides,
});

describe('compliance.ts', () => {
  // ==================== COMPLIANCE_LIMITS ====================
  describe('COMPLIANCE_LIMITS', () => {
    it('has correct hard limits defined', () => {
      expect(COMPLIANCE_LIMITS.MAX_SHIFT_HOURS).toBe(12);
      expect(COMPLIANCE_LIMITS.MIN_REST_HOURS).toBe(12);
      expect(COMPLIANCE_LIMITS.MAX_WEEKLY_HOURS).toBe(72);
      expect(COMPLIANCE_LIMITS.MAX_CONSECUTIVE_DAYS).toBe(13);
      expect(COMPLIANCE_LIMITS.MAX_CONSECUTIVE_NIGHTS).toBe(7);
    });

    it('has correct soft limits defined', () => {
      expect(COMPLIANCE_LIMITS.APPROACHING_WEEKLY_HOURS).toBe(66);
      expect(COMPLIANCE_LIMITS.CONSECUTIVE_NIGHTS_WARNING).toBe(4);
      expect(COMPLIANCE_LIMITS.CONSECUTIVE_DAYS_WARNING).toBe(6);
    });

    it('has night shift time boundaries defined', () => {
      expect(COMPLIANCE_LIMITS.NIGHT_START_HOUR).toBe(20);
      expect(COMPLIANCE_LIMITS.NIGHT_END_HOUR).toBe(6);
    });
  });

  // ==================== checkMaxShiftLength ====================
  describe('checkMaxShiftLength', () => {
    const patterns = [
      createPattern('p1', 1, '08:00', '17:00'), // 9 hours - OK
      createPattern('p2', 1, '07:00', '19:00'), // 12 hours - OK (exactly at limit)
      createPattern('p3', 1, '06:00', '19:00'), // 13 hours - VIOLATION
      createPattern('p4', 1, '18:00', '08:00'), // 14 hours overnight - VIOLATION
    ];
    const patternMap = new Map(patterns.map(p => [p.id, p]));

    it('allows shifts up to 12 hours', () => {
      const assignments = [
        createAssignment(1, 100, 1, 'p1', '2024-01-15'),
        createAssignment(2, 100, 1, 'p2', '2024-01-16'),
      ];

      const violations = checkMaxShiftLength(100, assignments, patternMap);
      expect(violations).toHaveLength(0);
    });

    it('flags shifts exceeding 12 hours', () => {
      const assignments = [
        createAssignment(1, 100, 1, 'p3', '2024-01-15'),
      ];

      const violations = checkMaxShiftLength(100, assignments, patternMap);
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('MAX_SHIFT_LENGTH');
      expect(violations[0].severity).toBe('breach');
      expect(violations[0].value).toBe(13);
    });

    it('correctly calculates overnight shift duration', () => {
      const assignments = [
        createAssignment(1, 100, 1, 'p4', '2024-01-15'),
      ];

      const violations = checkMaxShiftLength(100, assignments, patternMap);
      expect(violations).toHaveLength(1);
      expect(violations[0].value).toBe(14);
    });

    it('uses custom times from assignment when provided', () => {
      const assignments = [
        createAssignment(1, 100, 1, 'p1', '2024-01-15', {
          customStartTime: '05:00',
          customEndTime: '19:00', // 14 hours
        }),
      ];

      const violations = checkMaxShiftLength(100, assignments, patternMap);
      expect(violations).toHaveLength(1);
      expect(violations[0].value).toBe(14);
    });
  });

  // ==================== checkRestPeriods ====================
  describe('checkRestPeriods', () => {
    const patterns = [
      createPattern('day', 1, '08:00', '17:00'),
      createPattern('early', 1, '06:00', '14:00'),
      createPattern('late', 1, '14:00', '22:00'),
    ];
    const patternMap = new Map(patterns.map(p => [p.id, p]));

    it('allows 12+ hours rest between shifts', () => {
      const assignments = [
        createAssignment(1, 100, 1, 'day', '2024-01-15'),
        createAssignment(2, 100, 1, 'day', '2024-01-16'),
      ];

      const violations = checkRestPeriods(100, assignments, patternMap);
      expect(violations).toHaveLength(0);
    });

    it('flags insufficient rest period', () => {
      // Day 1: 06:00-14:00, Day 2: 06:00-14:00 = 16 hours rest (OK)
      // But early to late on SAME day would be violation
      const assignments = [
        createAssignment(1, 100, 1, 'late', '2024-01-15'), // 14:00-22:00
        createAssignment(2, 100, 1, 'early', '2024-01-16'), // 06:00-14:00 = 8 hours rest
      ];

      const violations = checkRestPeriods(100, assignments, patternMap);
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('INSUFFICIENT_REST');
      expect(violations[0].severity).toBe('breach');
      expect(violations[0].value).toBe(8);
    });

    it('handles overnight shifts correctly', () => {
      const nightPattern = createPattern('night', 1, '22:00', '06:00', { isNight: true });
      const extendedPatternMap = new Map([...patternMap, [nightPattern.id, nightPattern]]);

      const assignments = [
        createAssignment(1, 100, 1, 'night', '2024-01-15'), // 22:00-06:00
        createAssignment(2, 100, 1, 'day', '2024-01-16'), // 08:00-17:00 = only 2 hours rest!
      ];

      const violations = checkRestPeriods(100, assignments, extendedPatternMap);
      expect(violations).toHaveLength(1);
    });
  });

  // ==================== checkMultipleShiftsSameDay ====================
  describe('checkMultipleShiftsSameDay', () => {
    const patterns = [
      createPattern('day', 1, '08:00', '14:00'),
      createPattern('night', 1, '20:00', '04:00', { isNight: true }),
    ];
    const patternMap = new Map(patterns.map(p => [p.id, p]));

    it('allows single shift per day', () => {
      const assignments = [
        createAssignment(1, 100, 1, 'day', '2024-01-15'),
        createAssignment(2, 100, 1, 'day', '2024-01-16'),
      ];

      const violations = checkMultipleShiftsSameDay(100, assignments, patternMap);
      expect(violations).toHaveLength(0);
    });

    it('flags multiple shifts on same day', () => {
      const assignments = [
        createAssignment(1, 100, 1, 'day', '2024-01-15'),
        createAssignment(2, 100, 1, 'day', '2024-01-15'),
      ];

      const violations = checkMultipleShiftsSameDay(100, assignments, patternMap);
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('MULTIPLE_SHIFTS_SAME_DAY');
    });

    it('flags day-to-night transition as more serious', () => {
      const assignments = [
        createAssignment(1, 100, 1, 'day', '2024-01-15'),
        createAssignment(2, 100, 1, 'night', '2024-01-15'),
      ];

      const violations = checkMultipleShiftsSameDay(100, assignments, patternMap);
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('DAY_NIGHT_TRANSITION');
    });
  });

  // ==================== checkWeeklyHours ====================
  describe('checkWeeklyHours', () => {
    const patterns = [
      createPattern('12h', 1, '07:00', '19:00'), // 12 hours
      createPattern('10h', 1, '08:00', '18:00'), // 10 hours
      createPattern('8h', 1, '09:00', '17:00'), // 8 hours
    ];
    const patternMap = new Map(patterns.map(p => [p.id, p]));

    it('allows up to 72 hours per week', () => {
      // 6 x 12 hour shifts = 72 hours (exactly at limit)
      const assignments = [
        createAssignment(1, 100, 1, '12h', '2024-01-15'),
        createAssignment(2, 100, 1, '12h', '2024-01-16'),
        createAssignment(3, 100, 1, '12h', '2024-01-17'),
        createAssignment(4, 100, 1, '12h', '2024-01-18'),
        createAssignment(5, 100, 1, '12h', '2024-01-19'),
        createAssignment(6, 100, 1, '12h', '2024-01-20'),
      ];

      const violations = checkWeeklyHours(100, assignments, patternMap);
      // Should not have MAX_WEEKLY_HOURS error (72 is the limit)
      const errors = violations.filter(v => v.type === 'MAX_WEEKLY_HOURS');
      expect(errors).toHaveLength(0);
    });

    it('flags weekly hours exceeding 72', () => {
      // 7 x 12 hour shifts = 84 hours - OVER LIMIT (Level 2 exceedance)
      const assignments = [
        createAssignment(1, 100, 1, '12h', '2024-01-15'),
        createAssignment(2, 100, 1, '12h', '2024-01-16'),
        createAssignment(3, 100, 1, '12h', '2024-01-17'),
        createAssignment(4, 100, 1, '12h', '2024-01-18'),
        createAssignment(5, 100, 1, '12h', '2024-01-19'),
        createAssignment(6, 100, 1, '12h', '2024-01-20'),
        createAssignment(7, 100, 1, '12h', '2024-01-21'),
      ];

      const violations = checkWeeklyHours(100, assignments, patternMap);
      // Level 2 exceedance for 72+ hours (was MAX_WEEKLY_HOURS in old system)
      const errors = violations.filter(v => v.type === 'LEVEL_2_EXCEEDANCE');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('generates Level 1 exceedance for 60-72 hour range', () => {
      // 7 x 10 hour shifts = 70 hours - Level 1 Exceedance zone (60-72h)
      const assignments = [
        createAssignment(1, 100, 1, '10h', '2024-01-15'),
        createAssignment(2, 100, 1, '10h', '2024-01-16'),
        createAssignment(3, 100, 1, '10h', '2024-01-17'),
        createAssignment(4, 100, 1, '10h', '2024-01-18'),
        createAssignment(5, 100, 1, '10h', '2024-01-19'),
        createAssignment(6, 100, 1, '10h', '2024-01-20'),
        createAssignment(7, 100, 1, '10h', '2024-01-21'),
      ];

      const violations = checkWeeklyHours(100, assignments, patternMap);
      // With 70 hours, this triggers Level 1 exceedance (60-72h range)
      const level1 = violations.filter(v => v.type === 'LEVEL_1_EXCEEDANCE');
      expect(level1.length).toBeGreaterThan(0);
    });

    it('uses rolling 7-day window', () => {
      // Spread over more than 7 days - should check each 7-day window
      const assignments = [
        createAssignment(1, 100, 1, '12h', '2024-01-10'),
        createAssignment(2, 100, 1, '12h', '2024-01-11'),
        createAssignment(3, 100, 1, '12h', '2024-01-12'),
        // Gap
        createAssignment(4, 100, 1, '12h', '2024-01-20'),
        createAssignment(5, 100, 1, '12h', '2024-01-21'),
        createAssignment(6, 100, 1, '12h', '2024-01-22'),
      ];

      // No single 7-day window should exceed 72 hours (36 hours max in any window)
      const violations = checkWeeklyHours(100, assignments, patternMap);
      // No Level 2 exceedance (was MAX_WEEKLY_HOURS in old system)
      const errors = violations.filter(v => v.type === 'LEVEL_2_EXCEEDANCE');
      expect(errors).toHaveLength(0);
    });
  });

  // ==================== checkConsecutiveDays ====================
  describe('checkConsecutiveDays', () => {
    it('allows up to 13 consecutive days', () => {
      const assignments: AssignmentCamel[] = [];
      // Create 13 consecutive days
      for (let i = 0; i < 13; i++) {
        const day = 15 + i;
        assignments.push(createAssignment(i, 100, 1, 'p1', `2024-01-${day.toString().padStart(2, '0')}`));
      }

      const violations = checkConsecutiveDays(100, assignments);
      const errors = violations.filter(v => v.type === 'MAX_CONSECUTIVE_DAYS');
      expect(errors).toHaveLength(0);
    });

    it('flags more than 13 consecutive days', () => {
      const assignments: AssignmentCamel[] = [];
      // Create 14 consecutive days
      for (let i = 0; i < 14; i++) {
        const day = 10 + i;
        assignments.push(createAssignment(i, 100, 1, 'p1', `2024-01-${day.toString().padStart(2, '0')}`));
      }

      const violations = checkConsecutiveDays(100, assignments);
      const errors = violations.filter(v => v.type === 'MAX_CONSECUTIVE_DAYS');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].value).toBe(14);
    });

    it('warns after 6 consecutive days', () => {
      const assignments: AssignmentCamel[] = [];
      // Create 7 consecutive days
      for (let i = 0; i < 7; i++) {
        const day = 15 + i;
        assignments.push(createAssignment(i, 100, 1, 'p1', `2024-01-${day.toString().padStart(2, '0')}`));
      }

      const violations = checkConsecutiveDays(100, assignments);
      const warnings = violations.filter(v => v.type === 'CONSECUTIVE_DAYS_WARNING');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].value).toBe(7);
    });

    it('resets count after day off', () => {
      const assignments = [
        createAssignment(1, 100, 1, 'p1', '2024-01-15'),
        createAssignment(2, 100, 1, 'p1', '2024-01-16'),
        createAssignment(3, 100, 1, 'p1', '2024-01-17'),
        // Gap on 18th
        createAssignment(4, 100, 1, 'p1', '2024-01-19'),
        createAssignment(5, 100, 1, 'p1', '2024-01-20'),
      ];

      const violations = checkConsecutiveDays(100, assignments);
      expect(violations).toHaveLength(0);
    });
  });

  // ==================== checkConsecutiveNights ====================
  describe('checkConsecutiveNights', () => {
    const patterns = [
      createPattern('night', 1, '22:00', '06:00', { isNight: true }),
      createPattern('day', 1, '08:00', '17:00'),
    ];
    const patternMap = new Map(patterns.map(p => [p.id, p]));

    it('allows up to 7 consecutive nights', () => {
      const assignments: AssignmentCamel[] = [];
      for (let i = 0; i < 7; i++) {
        const day = 15 + i;
        assignments.push(createAssignment(i, 100, 1, 'night', `2024-01-${day.toString().padStart(2, '0')}`));
      }

      const violations = checkConsecutiveNights(100, assignments, patternMap);
      const errors = violations.filter(v => v.type === 'MAX_CONSECUTIVE_NIGHTS');
      expect(errors).toHaveLength(0);
    });

    it('flags more than 7 consecutive nights', () => {
      const assignments: AssignmentCamel[] = [];
      for (let i = 0; i < 8; i++) {
        const day = 15 + i;
        assignments.push(createAssignment(i, 100, 1, 'night', `2024-01-${day.toString().padStart(2, '0')}`));
      }

      const violations = checkConsecutiveNights(100, assignments, patternMap);
      const errors = violations.filter(v => v.type === 'MAX_CONSECUTIVE_NIGHTS');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('warns after 4 consecutive nights', () => {
      const assignments: AssignmentCamel[] = [];
      for (let i = 0; i < 5; i++) {
        const day = 15 + i;
        assignments.push(createAssignment(i, 100, 1, 'night', `2024-01-${day.toString().padStart(2, '0')}`));
      }

      const violations = checkConsecutiveNights(100, assignments, patternMap);
      const warnings = violations.filter(v => v.type === 'CONSECUTIVE_NIGHTS_WARNING');
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('does not count day shifts as nights', () => {
      const assignments = [
        createAssignment(1, 100, 1, 'night', '2024-01-15'),
        createAssignment(2, 100, 1, 'night', '2024-01-16'),
        createAssignment(3, 100, 1, 'day', '2024-01-17'), // Day shift breaks the streak
        createAssignment(4, 100, 1, 'night', '2024-01-18'),
        createAssignment(5, 100, 1, 'night', '2024-01-19'),
      ];

      const violations = checkConsecutiveNights(100, assignments, patternMap);
      expect(violations).toHaveLength(0);
    });
  });

  // ==================== checkEmployeeCompliance ====================
  describe('checkEmployeeCompliance', () => {
    const patterns = [
      createPattern('12h', 1, '07:00', '19:00'),
      createPattern('8h', 1, '09:00', '17:00'),
    ];

    it('returns compliant for valid schedule', () => {
      const assignments = [
        createAssignment(1, 100, 1, '8h', '2024-01-15'),
        createAssignment(2, 100, 1, '8h', '2024-01-16'),
        createAssignment(3, 100, 1, '8h', '2024-01-17'),
      ];

      const result = checkEmployeeCompliance(100, assignments, patterns);
      expect(result.isCompliant).toBe(true);
      expect(result.hasErrors).toBe(false);
      expect(result.errorCount).toBe(0);
    });

    it('aggregates all violation types', () => {
      // Create a very problematic schedule
      const assignments: AssignmentCamel[] = [];
      for (let i = 0; i < 7; i++) {
        const day = 15 + i;
        assignments.push(createAssignment(i, 100, 1, '12h', `2024-01-${day.toString().padStart(2, '0')}`));
      }

      const result = checkEmployeeCompliance(100, assignments, patterns);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('distinguishes between errors and warnings', () => {
      // Schedule that triggers warning but not error
      const assignments: AssignmentCamel[] = [];
      for (let i = 0; i < 7; i++) {
        const day = 15 + i;
        assignments.push(createAssignment(i, 100, 1, '8h', `2024-01-${day.toString().padStart(2, '0')}`));
      }

      const result = checkEmployeeCompliance(100, assignments, patterns);
      // 7 consecutive 8-hour days = 56 hours (no weekly warning)
      // But 7 consecutive days should trigger warning
      expect(result.hasWarnings).toBe(true);
      expect(result.warningCount).toBeGreaterThan(0);
    });
  });

  // ==================== checkProjectCompliance ====================
  describe('checkProjectCompliance', () => {
    const patterns = [
      createPattern('8h', 1, '09:00', '17:00'),
      createPattern('12h', 2, '07:00', '19:00'),
    ];

    it('checks all employees on a project', () => {
      const assignments = [
        createAssignment(1, 100, 1, '8h', '2024-01-15'),
        createAssignment(2, 101, 1, '8h', '2024-01-15'),
        createAssignment(3, 102, 1, '8h', '2024-01-15'),
      ];

      const result = checkProjectCompliance(1, assignments, patterns);
      expect(result.isCompliant).toBe(true);
    });

    it('detects cross-project violations', () => {
      // Employee works on project 1 AND project 2 on same day
      const assignments = [
        createAssignment(1, 100, 1, '8h', '2024-01-15'),
        createAssignment(2, 100, 2, '12h', '2024-01-15'), // Same employee, different project
      ];

      // When checking project 1, should detect that employee 100 has multiple shifts
      const result = checkProjectCompliance(1, assignments, patterns);
      expect(result.isCompliant).toBe(false);
    });
  });

  // ==================== validateNewAssignment ====================
  describe('validateNewAssignment', () => {
    const patterns = [
      createPattern('8h', 1, '09:00', '17:00'),
      createPattern('14h', 1, '05:00', '19:00'), // Over 12 hours
    ];

    it('allows valid new assignment', () => {
      const existing = [
        createAssignment(1, 100, 1, '8h', '2024-01-15'),
      ];

      const violations = validateNewAssignment(
        100, 1, '8h', '2024-01-17', existing, patterns
      );
      expect(violations).toHaveLength(0);
    });

    it('prevents duplicate assignment on same day', () => {
      const existing = [
        createAssignment(1, 100, 1, '8h', '2024-01-15'),
      ];

      const violations = validateNewAssignment(
        100, 1, '8h', '2024-01-15', existing, patterns
      );
      const duplicates = violations.filter(v => v.type === 'MULTIPLE_SHIFTS_SAME_DAY');
      expect(duplicates.length).toBeGreaterThan(0);
    });

    it('checks shift length for new assignment', () => {
      const violations = validateNewAssignment(
        100, 1, '14h', '2024-01-15', [], patterns
      );
      const lengthViolations = violations.filter(v => v.type === 'MAX_SHIFT_LENGTH');
      expect(lengthViolations.length).toBeGreaterThan(0);
    });

    it('validates against existing assignments for rest periods', () => {
      const latePrevious = createPattern('late', 1, '14:00', '23:00');
      const earlyNext = createPattern('early', 1, '05:00', '13:00');
      const patternsWithTiming = [...patterns, latePrevious, earlyNext];

      const existing = [
        createAssignment(1, 100, 1, 'late', '2024-01-15'),
      ];

      // Adding early shift next day would violate rest period (23:00 to 05:00 = 6 hours)
      const violations = validateNewAssignment(
        100, 1, 'early', '2024-01-16', existing, patternsWithTiming
      );
      const restViolations = violations.filter(v => v.type === 'INSUFFICIENT_REST');
      expect(restViolations.length).toBeGreaterThan(0);
    });
  });

  // ==================== getDateCellViolations ====================
  describe('getDateCellViolations', () => {
    it('filters violations for specific employee and date', () => {
      const violations = [
        { type: 'MAX_SHIFT_LENGTH' as const, severity: 'breach' as const, employeeId: 100, date: '2024-01-15', message: 'Test' },
        { type: 'MAX_SHIFT_LENGTH' as const, severity: 'breach' as const, employeeId: 100, date: '2024-01-16', message: 'Test' },
        { type: 'MAX_SHIFT_LENGTH' as const, severity: 'breach' as const, employeeId: 101, date: '2024-01-15', message: 'Test' },
      ];

      const result = getDateCellViolations(100, '2024-01-15', violations);
      expect(result).toHaveLength(1);
      expect(result[0].employeeId).toBe(100);
      expect(result[0].date).toBe('2024-01-15');
    });

    it('returns empty array when no violations match', () => {
      const violations = [
        { type: 'MAX_SHIFT_LENGTH' as const, severity: 'breach' as const, employeeId: 101, date: '2024-01-15', message: 'Test' },
      ];

      const result = getDateCellViolations(100, '2024-01-15', violations);
      expect(result).toHaveLength(0);
    });
  });

  // ==================== Edge Cases ====================
  describe('Edge Cases', () => {
    it('handles empty assignment list', () => {
      const patterns = [createPattern('8h', 1, '09:00', '17:00')];

      const result = checkEmployeeCompliance(100, [], patterns);
      expect(result.isCompliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('handles missing pattern gracefully', () => {
      const assignments = [
        createAssignment(1, 100, 1, 'nonexistent', '2024-01-15'),
      ];

      // Should not throw, just skip the assignment
      const violations = checkMaxShiftLength(100, assignments, new Map());
      expect(violations).toHaveLength(0);
    });

    it('handles assignments spanning month boundary', () => {
      const patterns = [createPattern('12h', 1, '07:00', '19:00')];
      const assignments = [
        createAssignment(1, 100, 1, '12h', '2024-01-30'),
        createAssignment(2, 100, 1, '12h', '2024-01-31'),
        createAssignment(3, 100, 1, '12h', '2024-02-01'),
        createAssignment(4, 100, 1, '12h', '2024-02-02'),
      ];

      const result = checkEmployeeCompliance(100, assignments, patterns);
      // Should correctly detect 4 consecutive days
      expect(result.violations.length).toBeLessThanOrEqual(1); // Maybe a warning
    });

    it('handles year boundary correctly', () => {
      const patterns = [createPattern('8h', 1, '09:00', '17:00')];
      const assignments = [
        createAssignment(1, 100, 1, '8h', '2023-12-31'),
        createAssignment(2, 100, 1, '8h', '2024-01-01'),
      ];

      const result = checkEmployeeCompliance(100, assignments, patterns);
      expect(result.isCompliant).toBe(true);
    });
  });
});
