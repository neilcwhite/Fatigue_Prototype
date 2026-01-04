// ============================================
// HSE FATIGUE/RISK INDEX CALCULATOR
// Based on HSE Research Report RR446 - Crown Copyright
// "The development of a fatigue/risk index for shiftworkers"
// https://www.hse.gov.uk/research/rrhtm/rr446.htm
// ============================================

import { ShiftDefinition, FatigueResult, RiskLevel } from './types';

// ==================== CONSTANTS ====================
// All constants below are derived from HSE Research Report RR446
// Page and equation references are provided for traceability

const CONSTANTS = {
  // Sleep/Wake homeostatic process parameters (RR446 Section 3.2, Eq. 3.1-3.2)
  // These model the build-up of sleep pressure during wakefulness and its
  // dissipation during sleep, based on the two-process model of sleep regulation
  SLEEP_DECAY_RATE: 0.136934833451947,    // Rate of sleep pressure decay (tau_s) - Table 3.1
  WAKE_DECAY_RATE: 0.686825862760272,     // Rate of fatigue build-up when awake (tau_w) - Table 3.1
  BASELINE_PVT: 3.9,                       // Baseline PVT reaction time (ms^-1) - Section 3.3
  ASYMPTOTE_FACTOR: 0.441596758431994,    // Upper asymptote for Process S - Eq. 3.2

  // Circadian process parameters (RR446 Section 3.2, Eq. 3.3)
  // These model the ~24-hour biological clock effects on alertness
  CIRCADIAN_AMPLITUDE: 0.74,               // Amplitude of circadian rhythm - Table 3.1
  CIRCADIAN_PHASE: 5.23,                   // Phase of circadian rhythm (hours) - Table 3.1
  START_AMPLITUDE: 0.5,                    // Sleep inertia amplitude at wake - Section 3.2.3
  START_PHASE: 1.25,                       // Sleep inertia decay time constant - Section 3.2.3

  // Shift duration risk coefficients (RR446 Section 4.2, Table 4.1)
  // Polynomial coefficients for modeling risk as function of shift duration
  P1: -0.4287,    // Constant term
  P2: 0.1501,     // Linear coefficient for shift duration
  P3: 0.129,      // Quadratic coefficient for shift duration
  P4: 0.0359,     // Cubic coefficient for shift duration
  P5: -0.8012,    // Night shift adjustment
  P6: 0.7315,     // Commute time factor

  // Break effect constants (RR446 Section 4.3, Eq. 4.5)
  // Model the restorative effect of breaks on fatigue
  CONST1: 1.826297414,    // Break effect magnitude - derived from Eq. 4.5
  CONST2: 1.146457295,    // Break effect decay rate - derived from Eq. 4.5
} as const;

// Fatigue parameters type
export interface FatigueParams {
  commuteTime: number;
  workload: number;
  attention: number;
  breakFrequency: number;
  breakLength: number;
  continuousWork: number;
  breakAfterContinuous: number;
}

// Default fatigue parameters
export const DEFAULT_FATIGUE_PARAMS: FatigueParams = {
  commuteTime: 60,
  workload: 3,
  attention: 3,
  breakFrequency: 180,
  breakLength: 30,
  continuousWork: 180,
  breakAfterContinuous: 30,
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Parse time string "HH:MM" to decimal hours
 */
export function parseTimeToHours(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + minutes / 60;
}

/**
 * Calculate duty duration, handling overnight shifts
 */
export function calculateDutyLength(startHour: number, endHour: number): number {
  return endHour > startHour ? endHour - startHour : (24 + endHour) - startHour;
}

/**
 * Calculate estimated bed time based on shift end
 * RR446 Section 3.3 - Sleep timing model
 *
 * The relationship between shift end time and sleep onset is modeled
 * to predict when the worker is likely to go to bed after their shift.
 *
 * @param endHour - Hour of day when shift ends (0-24)
 * @returns Estimated bed time in hours
 */
function calculateBedTime(endHour: number): number {
  // Linear relationship derived from sleep diary data (RR446 Section 3.3.2)
  if (endHour < 24.25) return 16.3 + 0.367 * endHour;
  // For very late shifts, assume 1 hour after shift end
  return endHour + 1;
}

/**
 * Calculate RK (Roenneberg-Kantermann) sleep duration fit factor
 * RR446 Section 3.3, Eq. 3.7
 *
 * Models the relationship between shift timing and sleep duration,
 * accounting for circadian phase effects on sleep efficiency.
 *
 * @param endHour - Hour of day when shift ends
 * @param bedTime - Estimated bed time in hours
 * @returns Sleep duration factor (hours)
 */
function calculateRKFit(endHour: number, bedTime: number): number {
  // Before 18:30, assume standard 8.13 hours of sleep opportunity
  if (endHour < 18.5) return 8.13;
  // Sigmoid function modeling reduced sleep with later bed times (Eq. 3.7)
  return -2.28827436527851 + 11.7995318577367 /
    (1 + 0.472949055173571 * Math.exp(-1.77393493516727 + 0.16244804759197 * (bedTime - 20)));
}

/**
 * Calculate aircrew fit factor for sleep duration
 * RR446 Section 3.3.3
 *
 * Alternative sleep duration model based on aircrew studies,
 * showing linear decrease in sleep with later shift ends.
 *
 * @param endHour - Hour of day when shift ends
 * @returns Sleep duration factor (hours), capped at 8
 */
function calculateAircrewFit(endHour: number): number {
  // Linear decrease: 0.285 hours less sleep per hour after 18:30
  return Math.min(8, 8 - 0.285 * (endHour - 18.5));
}

// ==================== COMPONENT CALCULATIONS ====================

/**
 * Calculate timing component of fatigue index
 */
function calculateTimingComponent(
  startHour: number, 
  endHour: number, 
  commuteMinutes: number
): number {
  const dutyLength = calculateDutyLength(startHour, endHour);
  const commuteHours = (commuteMinutes - 40) / 60;
  const adjStart = startHour - commuteHours;
  const adjLength = dutyLength + commuteHours;
  
  // Time of day risk
  const todRisk = 1.0106 + 0.1057 * 
    (Math.sin(Math.PI * endHour / 12) - Math.sin(Math.PI * adjStart / 12)) / 
    (adjLength * Math.PI / 12);
  
  // Shift length risk
  let shiftRisk: number;
  if (adjLength < 4.25) {
    shiftRisk = 1 + CONSTANTS.P4 + CONSTANTS.P5 * Math.exp(-CONSTANTS.P6 * adjLength);
  } else if (adjLength > 8.13) {
    shiftRisk = 1 + CONSTANTS.P1 + CONSTANTS.P2 * Math.exp(CONSTANTS.P3 * adjLength);
  } else {
    shiftRisk = 1;
  }
  
  if (commuteHours <= 0) {
    return (todRisk * shiftRisk) / 1.288 * 0.997976;
  }
  
  // Commute adjustment
  let commuteRisk: number;
  if (commuteHours < 4.25) {
    commuteRisk = 1 + CONSTANTS.P4 + CONSTANTS.P5 * Math.exp(-CONSTANTS.P6 * commuteHours);
  } else if (commuteHours > 8.13) {
    commuteRisk = 1 + CONSTANTS.P1 + CONSTANTS.P2 * Math.exp(CONSTANTS.P3 * commuteHours);
  } else {
    commuteRisk = 1;
  }
  
  const shiftRiskAdjusted = (shiftRisk * adjLength - commuteRisk * commuteHours) / dutyLength;
  return (todRisk * shiftRiskAdjusted) / 1.288 * 0.997976;
}

/**
 * Calculate job/breaks component of fatigue index
 */
function calculateJobBreaksComponent(
  dutyLength: number,
  params: {
    workload: number;
    attention: number;
    breakFrequency: number;
    breakLength: number;
    continuousWork: number;
    breakAfterContinuous: number;
  }
): number {
  const { workload, attention, breakFrequency, breakLength, continuousWork, breakAfterContinuous } = params;
  
  let workloadFactor = 0.125 + 0.015 * (workload + attention);
  const avgContinuous = (breakFrequency + continuousWork) / 2;
  const avgBreak = (breakLength + breakAfterContinuous) / 2;
  
  if (avgBreak === 0 && avgContinuous === 0) {
    workloadFactor *= 1.2;
  } else {
    workloadFactor *= 1.2 * avgContinuous / (avgContinuous + avgBreak);
  }
  
  // Break effectiveness calculations
  const fiveMinBreak = 0.172731235 + -0.200918653 * 0.04 + 0.03552264 * 0.04 * 0.04;
  const fifteenMinBreak = avgContinuous * 0.000442;
  const thirtyMinBreak = 0.000206 + -0.0000138433 * avgContinuous + 0.00000096491 * avgContinuous * avgContinuous;
  
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
  const breakEffect = 0.24 * Math.exp(-0.395 * (avgBreak - 13.3)) / 0.2388 / 
    (1 + Math.exp(-0.395 * (avgBreak - 13.3)));
  
  let n = 0, leng = -1, rr = 1, rrTotal = 0;
  
  do {
    if (leng < seqLength) { leng++; } else { leng = 0; }
    if (leng === 0) { rr = 1 + (rr - 1) * breakEffect; }
    else { rr = CONSTANTS.CONST1 + (rr - CONSTANTS.CONST1) * Math.exp(-0.25 * CONSTANTS.CONST2); }
    rrTotal += rr;
    n++;
  } while (n <= numSequences * seqLength);
  
  let riskFactor = rrTotal / n / 1.4858;
  riskFactor += ((workload + attention) - 3) * 0.0232;
  return (riskFactor / 1.032) / 1.0286182;
}

/**
 * Calculate cumulative fatigue component
 */
function calculateCumulativeComponent(
  duties: ShiftDefinition[],
  dutyIndex: number
): number {
  // Day 1 baseline
  if (dutyIndex === 0) return 0.8885804237312078;
  
  const currentDuty = duties[dutyIndex];
  const prevDuty = duties[dutyIndex - 1];
  
  const prevEnd = parseTimeToHours(prevDuty.endTime);
  const currStart = parseTimeToHours(currentDuty.startTime);
  
  // Calculate gap between shifts
  let gap = (currentDuty.day - prevDuty.day) * 24 + currStart - prevEnd;
  if (gap < 0) gap += 24;
  
  const bedTime = calculateBedTime(prevEnd);
  const rkFit = calculateRKFit(prevEnd, bedTime);
  const aircrewFit = calculateAircrewFit(prevEnd);
  
  // Sleep loss calculation
  let loss = Math.min(8, 8.07 - (rkFit + aircrewFit) / 2);
  if (loss < 9 - gap) loss = 9 - gap;
  
  // Get previous cumulative value (recursive)
  const prevCumulative = calculateCumulativeComponent(duties, dutyIndex - 1);
  
  const asymptote = CONSTANTS.BASELINE_PVT - loss * CONSTANTS.ASYMPTOTE_FACTOR;
  
  // PVT calculation
  let nightPVT: number;
  if (prevCumulative > asymptote) {
    nightPVT = asymptote + (prevCumulative - asymptote) * Math.exp(-CONSTANTS.SLEEP_DECAY_RATE);
  } else {
    nightPVT = asymptote + (prevCumulative - asymptote) * Math.exp(-CONSTANTS.WAKE_DECAY_RATE);
  }
  
  // Recovery for long gaps
  if (gap >= 24) {
    const recoveryFactor = Math.min(1, (gap - 24) / 48);
    nightPVT = nightPVT + (CONSTANTS.BASELINE_PVT - nightPVT) * recoveryFactor * 0.5;
  }
  
  return 0.88 + (nightPVT / CONSTANTS.BASELINE_PVT) * 0.12 + (dutyIndex * 0.02);
}

/**
 * Calculate rest period between shifts
 */
export function calculateRestPeriod(prevDuty: ShiftDefinition, currentDuty: ShiftDefinition): number {
  const prevEnd = parseTimeToHours(prevDuty.endTime);
  const currStart = parseTimeToHours(currentDuty.startTime);
  let gap = (currentDuty.day - prevDuty.day) * 24 + currStart - prevEnd;
  if (gap < 0) gap += 24;
  return Math.round(gap * 100) / 100;
}

// ==================== MAIN FUNCTIONS ====================

/**
 * Get risk level classification based on index value
 */
export function getRiskLevel(riskIndex: number): RiskLevel {
  if (riskIndex < 1.0) return { level: 'low', label: 'Low Risk', color: '#22c55e' };
  if (riskIndex < 1.1) return { level: 'moderate', label: 'Moderate', color: '#eab308' };
  if (riskIndex < 1.2) return { level: 'elevated', label: 'Elevated', color: '#f97316' };
  return { level: 'critical', label: 'High Risk', color: '#ef4444' };
}

/**
 * Calculate fatigue index for a single shift
 * Uses per-shift parameters if provided, otherwise falls back to global params
 */
export function calculateRiskIndex(
  duty: ShiftDefinition,
  dutyIndex: number,
  allDuties: ShiftDefinition[],
  params: FatigueParams = DEFAULT_FATIGUE_PARAMS
): FatigueResult {
  const startHour = parseTimeToHours(duty.startTime);
  let endHour = parseTimeToHours(duty.endTime);
  if (endHour <= startHour) endHour += 24;

  const dutyLength = endHour - startHour;

  // Use per-shift parameters if available, otherwise use global params
  const commuteIn = duty.commuteIn ?? Math.floor(params.commuteTime / 2);
  const commuteOut = duty.commuteOut ?? Math.ceil(params.commuteTime / 2);
  const totalCommute = commuteIn + commuteOut;

  const shiftWorkload = duty.workload ?? params.workload;
  const shiftAttention = duty.attention ?? params.attention;
  const shiftBreakFreq = duty.breakFreq ?? params.breakFrequency;
  const shiftBreakLen = duty.breakLen ?? params.breakLength;

  // Build per-shift job/breaks params
  const shiftJobParams = {
    workload: shiftWorkload,
    attention: shiftAttention,
    breakFrequency: shiftBreakFreq,
    breakLength: shiftBreakLen,
    continuousWork: shiftBreakFreq,
    breakAfterContinuous: shiftBreakLen,
  };

  const cumulative = calculateCumulativeComponent(allDuties, dutyIndex);
  const timing = calculateTimingComponent(startHour, endHour, totalCommute);
  const jobBreaks = calculateJobBreaksComponent(dutyLength, shiftJobParams);

  const riskIndex = cumulative * timing * jobBreaks;

  return {
    day: duty.day,
    riskIndex: Math.round(riskIndex * 1000) / 1000,
    cumulative: Math.round(cumulative * 1000) / 1000,
    timing: Math.round(timing * 1000) / 1000,
    jobBreaks: Math.round(jobBreaks * 1000) / 1000,
    riskLevel: getRiskLevel(riskIndex),
  };
}

/**
 * Calculate fatigue indices for a sequence of shifts
 */
export function calculateFatigueSequence(
  shifts: ShiftDefinition[],
  params: FatigueParams = DEFAULT_FATIGUE_PARAMS
): FatigueResult[] {
  return shifts.map((shift, index) => calculateRiskIndex(shift, index, shifts, params));
}

// ==================== TEMPLATE PATTERNS ====================

export const FATIGUE_TEMPLATES = {
  clactonRoster: {
    name: "Clacton Wheel Lathe",
    shifts: [
      { day: 1, startTime: "08:30", endTime: "18:00" },
      { day: 2, startTime: "07:30", endTime: "18:00" },
      { day: 3, startTime: "07:30", endTime: "18:00" },
      { day: 4, startTime: "07:30", endTime: "18:00" },
      { day: 5, startTime: "07:30", endTime: "12:00" },
      { day: 8, startTime: "08:30", endTime: "18:00" },
      { day: 9, startTime: "07:30", endTime: "18:00" },
      { day: 10, startTime: "07:30", endTime: "18:00" },
      { day: 11, startTime: "07:30", endTime: "18:00" },
      { day: 12, startTime: "07:30", endTime: "12:00" }
    ]
  },
  standardWeek: {
    name: "Standard 5-Day",
    shifts: [
      { day: 1, startTime: "08:00", endTime: "17:00" },
      { day: 2, startTime: "08:00", endTime: "17:00" },
      { day: 3, startTime: "08:00", endTime: "17:00" },
      { day: 4, startTime: "08:00", endTime: "17:00" },
      { day: 5, startTime: "08:00", endTime: "17:00" }
    ]
  },
  nightShift: {
    name: "7-Night Pattern",
    shifts: [
      { day: 1, startTime: "22:00", endTime: "06:00" },
      { day: 2, startTime: "22:00", endTime: "06:00" },
      { day: 3, startTime: "22:00", endTime: "06:00" },
      { day: 4, startTime: "22:00", endTime: "06:00" },
      { day: 5, startTime: "22:00", endTime: "06:00" },
      { day: 6, startTime: "22:00", endTime: "06:00" },
      { day: 7, startTime: "22:00", endTime: "06:00" }
    ]
  },
  possession: {
    name: "Possession (12-hour)",
    shifts: [
      { day: 1, startTime: "18:00", endTime: "06:00" },
      { day: 2, startTime: "18:00", endTime: "06:00" },
      { day: 3, startTime: "18:00", endTime: "06:00" }
    ]
  }
} as const;
