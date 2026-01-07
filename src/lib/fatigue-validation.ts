/**
 * Fatigue Index Validation Script
 *
 * Compares calculated values against HSE Excel Calculator outputs from PDF examples
 * Run with: npx ts-node src/lib/fatigue-validation.ts
 */

import {
  calculateFatigueSequence,
  calculateFatigueIndexSequence,
  calculateCombinedFatigueSequence,
  DEFAULT_FATIGUE_PARAMS,
  FatigueParams
} from './fatigue';
import { ShiftDefinition } from './types';

// ==================== TEST DATA FROM PDFs ====================

// Roster 01: 5 days 12h shifts, 2h commute
const ROSTER_01 = {
  name: 'Roster 01 - 12h shifts, 2h commute',
  params: {
    commuteTime: 120, // 2 hours total
    workload: 2,      // "Moderately demanding, little spare capacity"
    attention: 2,     // "Some of the time"
    breakFrequency: 180,
    breakLength: 15,
    continuousWork: 240,
    breakAfterContinuous: 30
  } as FatigueParams,
  shifts: [
    { day: 1, startTime: '06:00', endTime: '18:00' },
    { day: 2, startTime: '06:00', endTime: '18:00' },
    { day: 3, startTime: '06:00', endTime: '18:00' },
    { day: 4, startTime: '06:00', endTime: '18:00' },
    { day: 5, startTime: '06:00', endTime: '18:00' },
    { day: 8, startTime: '06:00', endTime: '18:00' },
    { day: 9, startTime: '06:00', endTime: '18:00' },
    { day: 10, startTime: '06:00', endTime: '18:00' },
    { day: 11, startTime: '06:00', endTime: '18:00' },
    { day: 12, startTime: '06:00', endTime: '18:00' },
  ] as ShiftDefinition[],
  // Expected values from PDF (Fatigue Index mode)
  expectedFatigue: [
    { day: 1, cumulative: 0.1, timeOfDay: 1.3, task: 4.4, fatigueIndex: 5.7 },
    { day: 2, cumulative: 2.4, timeOfDay: 1.3, task: 4.4, fatigueIndex: 7.9 },
    { day: 3, cumulative: 6.2, timeOfDay: 1.3, task: 4.4, fatigueIndex: 11.5 },
    { day: 4, cumulative: 10.0, timeOfDay: 1.3, task: 4.4, fatigueIndex: 15.1 },
    { day: 5, cumulative: 13.1, timeOfDay: 1.3, task: 4.4, fatigueIndex: 18.0 },
    { day: 8, cumulative: 1.8, timeOfDay: 1.3, task: 4.4, fatigueIndex: 7.3 },
    { day: 9, cumulative: 5.4, timeOfDay: 1.3, task: 4.4, fatigueIndex: 10.8 },
    { day: 10, cumulative: 9.3, timeOfDay: 1.3, task: 4.4, fatigueIndex: 14.4 },
    { day: 11, cumulative: 12.5, timeOfDay: 1.3, task: 4.4, fatigueIndex: 17.5 },
    { day: 12, cumulative: 15.0, timeOfDay: 1.3, task: 4.4, fatigueIndex: 19.8 },
  ],
  // Expected values from PDF (Risk Index mode)
  expectedRisk: [
    { day: 1, cumulative: 0.89, timing: 1.09, jobBreaks: 1.02, riskIndex: 0.99 },
    { day: 2, cumulative: 0.94, timing: 1.09, jobBreaks: 1.02, riskIndex: 1.04 },
    { day: 3, cumulative: 0.98, timing: 1.09, jobBreaks: 1.02, riskIndex: 1.09 },
    { day: 4, cumulative: 1.03, timing: 1.09, jobBreaks: 1.02, riskIndex: 1.14 },
    { day: 5, cumulative: 1.08, timing: 1.09, jobBreaks: 1.02, riskIndex: 1.20 },
    { day: 8, cumulative: 0.91, timing: 1.09, jobBreaks: 1.02, riskIndex: 1.02 },
    { day: 9, cumulative: 0.96, timing: 1.09, jobBreaks: 1.02, riskIndex: 1.07 },
    { day: 10, cumulative: 1.01, timing: 1.09, jobBreaks: 1.02, riskIndex: 1.12 },
    { day: 11, cumulative: 1.05, timing: 1.09, jobBreaks: 1.02, riskIndex: 1.17 },
    { day: 12, cumulative: 1.10, timing: 1.09, jobBreaks: 1.02, riskIndex: 1.22 },
  ]
};

// Roster 02: 5 days 11h shifts, 2h commute
const ROSTER_02 = {
  name: 'Roster 02 - 11h shifts, 2h commute',
  params: {
    commuteTime: 120,
    workload: 2,
    attention: 2,
    breakFrequency: 180,
    breakLength: 15,
    continuousWork: 240,
    breakAfterContinuous: 30
  } as FatigueParams,
  shifts: [
    { day: 1, startTime: '06:30', endTime: '17:30' },
    { day: 2, startTime: '06:30', endTime: '17:30' },
    { day: 3, startTime: '06:30', endTime: '17:30' },
    { day: 4, startTime: '06:30', endTime: '17:30' },
    { day: 5, startTime: '06:30', endTime: '17:30' },
    { day: 8, startTime: '06:30', endTime: '17:30' },
    { day: 9, startTime: '06:30', endTime: '17:30' },
    { day: 10, startTime: '06:30', endTime: '17:30' },
    { day: 11, startTime: '06:30', endTime: '17:30' },
    { day: 12, startTime: '06:30', endTime: '17:30' },
  ] as ShiftDefinition[],
  expectedFatigue: [
    { day: 1, cumulative: 0.1, timeOfDay: 1.1, task: 3.0, fatigueIndex: 4.2 },
    { day: 2, cumulative: 2.0, timeOfDay: 1.1, task: 3.0, fatigueIndex: 6.1 },
    { day: 3, cumulative: 5.2, timeOfDay: 1.1, task: 3.0, fatigueIndex: 9.1 },
    { day: 4, cumulative: 8.5, timeOfDay: 1.1, task: 3.0, fatigueIndex: 12.2 },
    { day: 5, cumulative: 11.3, timeOfDay: 1.1, task: 3.0, fatigueIndex: 15.0 },
    { day: 8, cumulative: 1.5, timeOfDay: 1.1, task: 3.0, fatigueIndex: 5.5 },
    { day: 9, cumulative: 4.5, timeOfDay: 1.1, task: 3.0, fatigueIndex: 8.4 },
    { day: 10, cumulative: 7.8, timeOfDay: 1.1, task: 3.0, fatigueIndex: 11.6 },
    { day: 11, cumulative: 10.7, timeOfDay: 1.1, task: 3.0, fatigueIndex: 14.4 },
    { day: 12, cumulative: 13.1, timeOfDay: 1.1, task: 3.0, fatigueIndex: 16.7 },
  ],
  expectedRisk: [
    { day: 1, cumulative: 0.89, timing: 1.00, jobBreaks: 1.02, riskIndex: 0.91 },
    { day: 2, cumulative: 0.94, timing: 1.00, jobBreaks: 1.02, riskIndex: 0.96 },
    { day: 3, cumulative: 0.99, timing: 1.00, jobBreaks: 1.02, riskIndex: 1.01 },
    { day: 4, cumulative: 1.04, timing: 1.00, jobBreaks: 1.02, riskIndex: 1.06 },
    { day: 5, cumulative: 1.08, timing: 1.00, jobBreaks: 1.02, riskIndex: 1.10 },
    { day: 8, cumulative: 0.92, timing: 1.00, jobBreaks: 1.02, riskIndex: 0.94 },
    { day: 9, cumulative: 0.96, timing: 1.00, jobBreaks: 1.02, riskIndex: 0.98 },
    { day: 10, cumulative: 1.01, timing: 1.00, jobBreaks: 1.02, riskIndex: 1.03 },
    { day: 11, cumulative: 1.06, timing: 1.00, jobBreaks: 1.02, riskIndex: 1.08 },
    { day: 12, cumulative: 1.11, timing: 1.00, jobBreaks: 1.02, riskIndex: 1.13 },
  ]
};

// Roster 03: 5 days 10h shifts, 3h commute
const ROSTER_03 = {
  name: 'Roster 03 - 10h shifts, 3h commute',
  params: {
    commuteTime: 180, // 3 hours total
    workload: 2,
    attention: 2,
    breakFrequency: 180,
    breakLength: 15,
    continuousWork: 240,
    breakAfterContinuous: 30
  } as FatigueParams,
  shifts: [
    { day: 1, startTime: '07:00', endTime: '17:00' },
    { day: 2, startTime: '07:00', endTime: '17:00' },
    { day: 3, startTime: '07:00', endTime: '17:00' },
    { day: 4, startTime: '07:00', endTime: '17:00' },
    { day: 5, startTime: '07:00', endTime: '17:00' },
    { day: 8, startTime: '07:00', endTime: '17:00' },
    { day: 9, startTime: '07:00', endTime: '17:00' },
    { day: 10, startTime: '07:00', endTime: '17:00' },
    { day: 11, startTime: '07:00', endTime: '17:00' },
    { day: 12, startTime: '07:00', endTime: '17:00' },
  ] as ShiftDefinition[],
  expectedFatigue: [
    { day: 1, cumulative: 0.1, timeOfDay: 1.1, task: 3.4, fatigueIndex: 4.6 },
    { day: 2, cumulative: 1.7, timeOfDay: 1.1, task: 3.4, fatigueIndex: 6.2 },
    { day: 3, cumulative: 4.3, timeOfDay: 1.1, task: 3.4, fatigueIndex: 8.7 },
    { day: 4, cumulative: 7.1, timeOfDay: 1.1, task: 3.4, fatigueIndex: 11.3 },
    { day: 5, cumulative: 9.6, timeOfDay: 1.1, task: 3.4, fatigueIndex: 13.7 },
    { day: 8, cumulative: 1.2, timeOfDay: 1.1, task: 3.4, fatigueIndex: 5.7 },
    { day: 9, cumulative: 3.6, timeOfDay: 1.1, task: 3.4, fatigueIndex: 8.0 },
    { day: 10, cumulative: 6.4, timeOfDay: 1.1, task: 3.4, fatigueIndex: 10.7 },
    { day: 11, cumulative: 9.0, timeOfDay: 1.1, task: 3.4, fatigueIndex: 13.1 },
    { day: 12, cumulative: 11.2, timeOfDay: 1.1, task: 3.4, fatigueIndex: 15.2 },
  ],
  expectedRisk: [
    { day: 1, cumulative: 0.89, timing: 0.94, jobBreaks: 1.02, riskIndex: 0.93 },
    { day: 2, cumulative: 0.94, timing: 0.94, jobBreaks: 1.02, riskIndex: 0.98 },
    { day: 3, cumulative: 0.99, timing: 0.94, jobBreaks: 1.02, riskIndex: 1.03 },
    { day: 4, cumulative: 1.04, timing: 0.94, jobBreaks: 1.02, riskIndex: 1.08 },
    { day: 5, cumulative: 1.09, timing: 0.94, jobBreaks: 1.02, riskIndex: 1.13 },
    { day: 8, cumulative: 0.91, timing: 0.94, jobBreaks: 1.02, riskIndex: 0.95 },
    { day: 9, cumulative: 0.96, timing: 0.94, jobBreaks: 1.02, riskIndex: 1.00 },
    { day: 10, cumulative: 1.01, timing: 0.94, jobBreaks: 1.02, riskIndex: 1.05 },
    { day: 11, cumulative: 1.06, timing: 0.94, jobBreaks: 1.02, riskIndex: 1.10 },
    { day: 12, cumulative: 1.11, timing: 0.94, jobBreaks: 1.02, riskIndex: 1.15 },
  ]
};

// Roster 05: Day + Night shifts, 2h commute (most complex)
const ROSTER_05 = {
  name: 'Roster 05 - Day + Night shifts, 2h commute',
  params: {
    commuteTime: 120,
    workload: 2,
    attention: 2,
    breakFrequency: 180,
    breakLength: 15,
    continuousWork: 240,
    breakAfterContinuous: 30
  } as FatigueParams,
  shifts: [
    { day: 1, startTime: '07:00', endTime: '17:00' },
    { day: 2, startTime: '07:00', endTime: '17:00' },
    { day: 3, startTime: '07:00', endTime: '17:00' },
    { day: 4, startTime: '07:00', endTime: '17:00' },
    { day: 5, startTime: '07:00', endTime: '17:00' },
    { day: 6, startTime: '22:00', endTime: '08:00' }, // Night shift!
    { day: 8, startTime: '07:00', endTime: '17:00' },
    { day: 9, startTime: '07:00', endTime: '17:00' },
    { day: 10, startTime: '07:00', endTime: '17:00' },
    { day: 11, startTime: '07:00', endTime: '17:00' },
    { day: 12, startTime: '07:00', endTime: '17:00' },
    { day: 13, startTime: '22:00', endTime: '08:00' }, // Night shift!
  ] as ShiftDefinition[],
  expectedFatigue: [
    { day: 1, cumulative: 0.1, timeOfDay: 0.9, task: 2.1, fatigueIndex: 3.1 },
    { day: 2, cumulative: 1.7, timeOfDay: 0.9, task: 2.1, fatigueIndex: 4.7 },
    { day: 3, cumulative: 4.3, timeOfDay: 0.9, task: 2.1, fatigueIndex: 7.2 },
    { day: 4, cumulative: 7.1, timeOfDay: 0.9, task: 2.1, fatigueIndex: 9.9 },
    { day: 5, cumulative: 9.6, timeOfDay: 0.9, task: 2.1, fatigueIndex: 12.3 },
    { day: 6, cumulative: 3.6, timeOfDay: 18.0, task: 21.9, fatigueIndex: 42.0 }, // Night!
    { day: 8, cumulative: 10.9, timeOfDay: 0.9, task: 2.1, fatigueIndex: 13.6 },
    { day: 9, cumulative: 12.7, timeOfDay: 0.9, task: 2.1, fatigueIndex: 15.4 },
    { day: 10, cumulative: 14.2, timeOfDay: 0.9, task: 2.1, fatigueIndex: 16.8 },
    { day: 11, cumulative: 15.5, timeOfDay: 0.9, task: 2.1, fatigueIndex: 18.0 },
    { day: 12, cumulative: 16.5, timeOfDay: 0.9, task: 2.1, fatigueIndex: 19.0 },
    { day: 13, cumulative: 7.0, timeOfDay: 18.0, task: 21.9, fatigueIndex: 44.1 }, // Night!
  ],
  expectedRisk: [
    { day: 1, cumulative: 0.89, timing: 0.94, jobBreaks: 1.02, riskIndex: 0.84 },
    { day: 2, cumulative: 0.94, timing: 0.94, jobBreaks: 1.02, riskIndex: 0.89 },
    { day: 3, cumulative: 0.98, timing: 0.94, jobBreaks: 1.02, riskIndex: 0.93 },
    { day: 4, cumulative: 1.03, timing: 0.94, jobBreaks: 1.02, riskIndex: 0.98 },
    { day: 5, cumulative: 1.08, timing: 0.94, jobBreaks: 1.02, riskIndex: 1.02 },
    { day: 6, cumulative: 1.08, timing: 1.06, jobBreaks: 1.02, riskIndex: 1.16 }, // Night
    { day: 8, cumulative: 1.15, timing: 0.94, jobBreaks: 1.02, riskIndex: 1.09 },
    { day: 9, cumulative: 1.20, timing: 0.94, jobBreaks: 1.02, riskIndex: 1.14 },
    { day: 10, cumulative: 1.24, timing: 0.94, jobBreaks: 1.02, riskIndex: 1.18 },
    { day: 11, cumulative: 1.29, timing: 0.94, jobBreaks: 1.02, riskIndex: 1.23 },
    { day: 12, cumulative: 1.34, timing: 0.94, jobBreaks: 1.02, riskIndex: 1.27 },
    { day: 13, cumulative: 1.34, timing: 1.06, jobBreaks: 1.02, riskIndex: 1.44 }, // Night
  ]
};

// ==================== VALIDATION FUNCTIONS ====================

interface ValidationResult {
  roster: string;
  passed: boolean;
  details: string[];
  riskErrors: number;
  fatigueErrors: number;
}

function validateRoster(roster: typeof ROSTER_01): ValidationResult {
  const result: ValidationResult = {
    roster: roster.name,
    passed: true,
    details: [],
    riskErrors: 0,
    fatigueErrors: 0
  };

  // Calculate values
  const riskResults = calculateFatigueSequence(roster.shifts, roster.params);
  const fatigueResults = calculateFatigueIndexSequence(roster.shifts, roster.params);

  // Compare Risk Index results
  result.details.push('\n=== RISK INDEX COMPARISON ===');
  result.details.push('Day | Expected RI | Calculated RI | Diff | Expected Cum | Calc Cum | Expected Tim | Calc Tim');
  result.details.push('-'.repeat(100));

  roster.expectedRisk.forEach((expected, i) => {
    const calc = riskResults[i];
    const riDiff = Math.abs(expected.riskIndex - calc.riskIndex);
    const cumDiff = Math.abs(expected.cumulative - calc.cumulative);
    const timDiff = Math.abs(expected.timing - calc.timing);

    const riMatch = riDiff < 0.05;
    const cumMatch = cumDiff < 0.05;
    const timMatch = timDiff < 0.05;

    if (!riMatch || !cumMatch || !timMatch) {
      result.riskErrors++;
      result.passed = false;
    }

    result.details.push(
      `${expected.day.toString().padStart(3)} | ` +
      `${expected.riskIndex.toFixed(2).padStart(11)} | ` +
      `${calc.riskIndex.toFixed(2).padStart(13)} | ` +
      `${riDiff.toFixed(3).padStart(4)} ${riMatch ? '✓' : '✗'} | ` +
      `${expected.cumulative.toFixed(2).padStart(12)} | ` +
      `${calc.cumulative.toFixed(2).padStart(8)} ${cumMatch ? '✓' : '✗'} | ` +
      `${expected.timing.toFixed(2).padStart(12)} | ` +
      `${calc.timing.toFixed(2).padStart(8)} ${timMatch ? '✓' : '✗'}`
    );
  });

  // Compare Fatigue Index results
  result.details.push('\n=== FATIGUE INDEX COMPARISON ===');
  result.details.push('Day | Expected FI | Calculated FI | Diff | Expected Cum | Calc Cum | Expected ToD | Calc ToD');
  result.details.push('-'.repeat(100));

  roster.expectedFatigue.forEach((expected, i) => {
    const calc = fatigueResults[i];
    const fiDiff = Math.abs(expected.fatigueIndex - calc.fatigueIndex);
    const cumDiff = Math.abs(expected.cumulative - calc.cumulative);
    const todDiff = Math.abs(expected.timeOfDay - calc.timeOfDay);

    const fiMatch = fiDiff < 1.0; // Allow 1.0 tolerance for FGI
    const cumMatch = cumDiff < 1.0;
    const todMatch = todDiff < 0.5;

    if (!fiMatch || !cumMatch || !todMatch) {
      result.fatigueErrors++;
      result.passed = false;
    }

    result.details.push(
      `${expected.day.toString().padStart(3)} | ` +
      `${expected.fatigueIndex.toFixed(1).padStart(11)} | ` +
      `${calc.fatigueIndex.toFixed(1).padStart(13)} | ` +
      `${fiDiff.toFixed(1).padStart(4)} ${fiMatch ? '✓' : '✗'} | ` +
      `${expected.cumulative.toFixed(1).padStart(12)} | ` +
      `${calc.cumulative.toFixed(1).padStart(8)} ${cumMatch ? '✓' : '✗'} | ` +
      `${expected.timeOfDay.toFixed(1).padStart(12)} | ` +
      `${calc.timeOfDay.toFixed(1).padStart(8)} ${todMatch ? '✓' : '✗'}`
    );
  });

  return result;
}

// ==================== MAIN ====================

function runValidation() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  HSE Fatigue/Risk Index Calculator Validation                  ║');
  console.log('║  Comparing calculated values against PDF examples              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const rosters = [ROSTER_01, ROSTER_02, ROSTER_03, ROSTER_05];
  const results: ValidationResult[] = [];

  for (const roster of rosters) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`Testing: ${roster.name}`);
    console.log(`${'═'.repeat(70)}`);

    const result = validateRoster(roster);
    results.push(result);

    result.details.forEach(line => console.log(line));

    console.log(`\nResult: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`  Risk Index errors: ${result.riskErrors}`);
    console.log(`  Fatigue Index errors: ${result.fatigueErrors}`);
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('VALIDATION SUMMARY');
  console.log('═'.repeat(70));

  const totalPassed = results.filter(r => r.passed).length;
  const totalRosters = results.length;
  const totalRiskErrors = results.reduce((sum, r) => sum + r.riskErrors, 0);
  const totalFatigueErrors = results.reduce((sum, r) => sum + r.fatigueErrors, 0);

  console.log(`Rosters passed: ${totalPassed}/${totalRosters}`);
  console.log(`Total Risk Index errors: ${totalRiskErrors}`);
  console.log(`Total Fatigue Index errors: ${totalFatigueErrors}`);
  console.log(`Overall: ${totalPassed === totalRosters ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
}

// Run if executed directly
runValidation();

export { runValidation, validateRoster, ROSTER_01, ROSTER_02, ROSTER_03, ROSTER_05 };
