// ============================================
// HSE FATIGUE INDEX CALCULATOR
// Based on HSE Research Report RR446
// ============================================

import { ShiftDefinition, FatigueResult, RiskLevel } from './types';

// Mathematical Constants from HSE RR446
const CONSTANTS = {
  // Sleep/Wake decay rates
  SLEEP_DECAY_RATE: 0.136934833451947,
  WAKE_DECAY_RATE: 0.686825862760272,
  BASELINE_PVT: 3.9,
  ASYMPTOTE_FACTOR: 0.441596758431994,
  
  // Circadian rhythm
  CIRCADIAN_AMPLITUDE: 0.74,
  CIRCADIAN_PHASE: 5.23,
  START_AMPLITUDE: 0.5,
  START_PHASE: 1.25,
  
  // Shift duration risk coefficients
  P1: -0.4287,
  P2: 0.1501,
  P3: 0.129,
  P4: 0.0359,
  P5: -0.8012,
  P6: 0.7315,
  
  // Cumulative fatigue coefficients
  c0: -2.28827436527851,
  c1: 11.7995318577367,
  c2: 0.472949055173571,
  c3: -1.77393493516727,
  c4: 0.16244804759197,
  CONST1: 1.826297414,
  CONST2: 1.146457295,
};

// Default fatigue parameters
const DEFAULTS = {
  commuteIn: 60,
  commuteOut: 60,
  workload: 2,
  attention: 1,
  breakFreq: 180,
  breakLen: 30,
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
function calculateDuration(startHour: number, endHour: number): number {
  if (endHour > startHour) {
    return endHour - startHour;
  }
  return (24 - startHour) + endHour;
}

/**
 * Calculate the cumulative fatigue component
 */
function calculateCumulative(
  dutyIndex: number,
  shifts: ShiftDefinition[],
): number {
  // Day 1 baseline
  if (dutyIndex === 0) {
    return 0.8885804237312078;
  }

  const currentShift = shifts[dutyIndex];
  const prevShift = shifts[dutyIndex - 1];

  const currStart = parseTime(currentShift.startTime);
  const prevEnd = parseTime(prevShift.endTime);
  const prevStart = parseTime(prevShift.startTime);

  // Calculate gap between shifts
  const dayGap = currentShift.day - prevShift.day;
  let gap = dayGap * 24 + currStart - prevEnd;
  if (gap < 0) gap += 24;

  // Previous shift end hour (adjusted for overnight)
  let prevEndHour = prevEnd;
  if (prevEnd < prevStart) {
    prevEndHour = prevEnd + 24;
  }

  // Bed time calculation
  let bedTime: number;
  if (prevEndHour < 24.25) {
    bedTime = 16.3 + 0.367 * prevEndHour;
  } else {
    bedTime = prevEndHour + 1;
  }

  // RKFit calculation
  let rkFit: number;
  if (prevEndHour < 18.5) {
    rkFit = 8.13;
  } else {
    rkFit = CONSTANTS.c0 + CONSTANTS.c1 / (1 + CONSTANTS.c2 * Math.exp(CONSTANTS.c3 + CONSTANTS.c4 * (bedTime - 20)));
  }

  // Aircrew fit calculation
  const aircrewFit = Math.min(8, 8 - 0.285 * (prevEndHour - 18.5));

  // Sleep loss calculation
  let loss = Math.min(8, 8.07 - (rkFit + aircrewFit) / 2);
  if (loss < 9 - gap) {
    loss = 9 - gap;
  }

  // Get previous cumulative and apply sleep recovery
  const prevCumulative = calculateCumulative(dutyIndex - 1, shifts);
  
  // Recovery factor based on gap
  const recoveryFactor = Math.max(0, 1 - (gap / 24) * 0.3);
  
  // Increment cumulative fatigue
  return prevCumulative + 0.047 * recoveryFactor;
}

/**
 * Calculate the duty timing component
 */
function calculateTiming(
  startHour: number,
  endHour: number,
  commuteMinutes: number = DEFAULTS.commuteIn,
): number {
  // Calculate duty length
  const dutyLength = calculateDuration(startHour, endHour);

  // Adjust for commute (default 40 min baseline)
  const commuteHours = (commuteMinutes - 40) / 60;
  const adjStart = startHour - commuteHours;
  const adjLength = dutyLength + commuteHours;

  // Time-of-day risk
  const todRisk = 1.0106 + 0.1057 * (Math.sin(Math.PI * endHour / 12) - Math.sin(Math.PI * adjStart / 12)) / (adjLength * Math.PI / 12);

  // Shift length risk
  let shiftRisk: number;
  if (adjLength < 4.25) {
    shiftRisk = 1 + CONSTANTS.P4 + CONSTANTS.P5 * Math.exp(-CONSTANTS.P6 * adjLength);
  } else if (adjLength > 8.13) {
    shiftRisk = 1 + CONSTANTS.P1 + CONSTANTS.P2 * Math.exp(CONSTANTS.P3 * adjLength);
  } else {
    shiftRisk = 1.0;
  }

  // Final timing component
  if (commuteHours <= 0) {
    return (todRisk * shiftRisk) / 1.288 * 0.997976;
  }

  // Commute adjustment
  const commuteRisk = 1 + CONSTANTS.P4 + CONSTANTS.P5 * Math.exp(-CONSTANTS.P6 * commuteHours);
  const shiftRiskAdjusted = (shiftRisk * adjLength - commuteRisk * commuteHours) / dutyLength;
  return (todRisk * shiftRiskAdjusted) / 1.288 * 0.997976;
}

/**
 * Calculate the job/breaks component
 */
function calculateJobBreaks(
  dutyLength: number,
  workload: number = DEFAULTS.workload,
  attention: number = DEFAULTS.attention,
  breakFreq: number = DEFAULTS.breakFreq,
  breakLen: number = DEFAULTS.breakLen,
): number {
  const continuousWork = breakFreq;
  const breakAfterContinuous = breakLen;

  // Workload factor
  let workloadFactor = 0.125 + 0.015 * (workload + attention);
  const avgContinuous = (breakFreq + continuousWork) / 2;
  const avgBreak = (breakLen + breakAfterContinuous) / 2;

  if (avgBreak === 0 && avgContinuous === 0) {
    workloadFactor *= 1.2;
  } else {
    workloadFactor *= 1.2 * avgContinuous / (avgContinuous + avgBreak);
  }

  // Break effectiveness calculations
  const fiveMinBreak = 0.172731235 + (-0.200918653 * 0.04) + (0.03552264 * 0.04 * 0.04);
  const fifteenMinBreak = avgContinuous * 0.000442;
  const thirtyMinBreak = 0.000206 + (-0.0000138433 * avgContinuous) + (0.00000096491 * avgContinuous * avgContinuous);

  // Interpolate based on avgBreak
  let finalBreakFactor: number;
  if (avgBreak < 5) {
    finalBreakFactor = 0.174 + (fiveMinBreak - 0.174) * avgBreak / 5;
  } else if (avgBreak < 15) {
    finalBreakFactor = fiveMinBreak + (fifteenMinBreak - fiveMinBreak) * (avgBreak - 5) / 10;
  } else if (avgBreak < 30) {
    finalBreakFactor = fifteenMinBreak + (thirtyMinBreak - fifteenMinBreak) * (avgBreak - 15) / 15;
  } else if (avgBreak < 60) {
    finalBreakFactor = thirtyMinBreak * (60 - avgBreak) / 30;
  } else {
    finalBreakFactor = 0;
  }

  // Sequence risk calculation
  const dutyMinutes = dutyLength * 60;
  const numSequences = 1 + Math.floor(dutyMinutes / (avgContinuous + avgBreak) - 0.01);
  const seqLength = Math.floor(0.5 + avgContinuous / 15);
  const breakEffect = 0.24 * Math.exp(-0.395 * (avgBreak - 13.3)) / 0.2388 / (1 + Math.exp(-0.395 * (avgBreak - 13.3)));

  // Iterate through work sequences
  let n = 0;
  let leng = -1;
  let rr = 1;
  let rrTotal = 0;

  do {
    if (leng < seqLength) {
      leng++;
    } else {
      leng = 0;
    }

    if (leng === 0) {
      rr = 1 + (rr - 1) * breakEffect;
    } else {
      rr = CONSTANTS.CONST1 + (rr - CONSTANTS.CONST1) * Math.exp(-0.25 * CONSTANTS.CONST2);
    }

    rrTotal += rr;
    n++;
  } while (n <= numSequences * seqLength);

  let riskFactor = rrTotal / n / 1.4858;
  riskFactor += ((workload + attention) - 3) * 0.0232;

  return (riskFactor / 1.032) / 1.0286182;
}

/**
 * Classify risk level based on index value
 */
export function getRiskLevel(riskIndex: number): RiskLevel {
  if (riskIndex < 1.0) {
    return { level: 'low', label: 'Low Risk', color: '#22c55e' };
  }
  if (riskIndex < 1.1) {
    return { level: 'moderate', label: 'Moderate', color: '#eab308' };
  }
  if (riskIndex < 1.2) {
    return { level: 'elevated', label: 'Elevated', color: '#f97316' };
  }
  return { level: 'critical', label: 'High Risk', color: '#ef4444' };
}

/**
 * Calculate HSE Fatigue Index for a sequence of shifts
 */
export function calculateFatigueIndex(shifts: ShiftDefinition[]): FatigueResult[] {
  const results: FatigueResult[] = [];

  for (let i = 0; i < shifts.length; i++) {
    const shift = shifts[i];
    const startHour = parseTime(shift.startTime);
    const endHour = parseTime(shift.endTime);
    const dutyLength = calculateDuration(startHour, endHour);

    // Calculate components
    const cumulative = calculateCumulative(i, shifts);
    const timing = calculateTiming(
      startHour,
      endHour,
      shift.commuteIn ?? DEFAULTS.commuteIn,
    );
    const jobBreaks = calculateJobBreaks(
      dutyLength,
      shift.workload ?? DEFAULTS.workload,
      shift.attention ?? DEFAULTS.attention,
      shift.breakFreq ?? DEFAULTS.breakFreq,
      shift.breakLen ?? DEFAULTS.breakLen,
    );

    // Final risk index
    const riskIndex = cumulative * timing * jobBreaks;

    results.push({
      day: shift.day,
      cumulative: Math.round(cumulative * 1000) / 1000,
      timing: Math.round(timing * 1000) / 1000,
      jobBreaks: Math.round(jobBreaks * 1000) / 1000,
      riskIndex: Math.round(riskIndex * 1000) / 1000,
      riskLevel: getRiskLevel(riskIndex),
    });
  }

  return results;
}

/**
 * Calculate fatigue for a single shift (day 1 baseline)
 */
export function calculateSingleShiftFatigue(
  startTime: string,
  endTime: string,
  options?: Partial<ShiftDefinition>,
): FatigueResult {
  const shifts: ShiftDefinition[] = [{
    day: 1,
    startTime,
    endTime,
    ...options,
  }];

  return calculateFatigueIndex(shifts)[0];
}
