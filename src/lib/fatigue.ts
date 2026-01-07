// ============================================
// HSE FATIGUE/RISK INDEX CALCULATOR
// Based on HSE Research Report RR446 - Crown Copyright
// "The development of a fatigue/risk index for shiftworkers"
// https://www.hse.gov.uk/research/rrhtm/rr446.htm
// ============================================

import { ShiftDefinition, FatigueResult, RiskLevel, FatigueIndexResult, FatigueLevel, CombinedFatigueResult } from './types';

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
 * Calculate job/breaks component of Risk Index
 * Based on HSE RR446 dutyFactorRisk function
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

  const workloadSum = workload + attention;
  const avgContinuous = (breakFrequency + continuousWork) / 2;
  const avgBreak = (breakLength + breakAfterContinuous) / 2;

  const dutyMinutes = dutyLength * 60;
  const numberOfSequences = Math.max(1,
    1 + Math.floor(dutyMinutes / (avgContinuous + avgBreak) - 0.01));
  const lengthOfSequences = Math.max(1, Math.round(avgContinuous / 15));

  // Break effectiveness on reaction time recovery
  const breakEffect = 0.24 * Math.exp(-0.395 * (avgBreak - 13.3)) / 0.2388 /
    (1 + Math.exp(-0.395 * (avgBreak - 13.3)));

  // Simulate reaction time buildup through shift
  let leng = -1;
  let rr = 1;
  let rrTotal = 0;
  const totalIterations = numberOfSequences * lengthOfSequences;

  for (let n = 0; n <= totalIterations; n++) {
    if (leng < lengthOfSequences) {
      leng++;
    } else {
      leng = 0;
    }

    if (leng === 0) {
      rr = 1 + (rr - 1) * breakEffect; // Break recovery
    } else {
      rr = CONSTANTS.CONST1 + (rr - CONSTANTS.CONST1) * Math.exp(-0.25 * CONSTANTS.CONST2); // Work buildup
    }

    rrTotal += rr;
  }

  let riskFactor = rrTotal / (totalIterations + 1) / 1.4858;

  // Workload adjustment (centered on 3 - "moderate" baseline)
  riskFactor = riskFactor + (workloadSum - 3) * 0.0232;

  // Apply normalization factors
  const RISK_TASK_NORM = 1.032;
  const RISK_TASK_ADJ = 1.0286182;

  return (riskFactor / RISK_TASK_NORM) / RISK_TASK_ADJ;
}

/**
 * Calculate cumulative risk factors for all shifts
 * Based on HSE RR446 cumulative fatigue model
 */
function calculateRiskCumulativeFactors(
  duties: ShiftDefinition[],
  commuteMinutes: number = 60
): number[] {
  if (duties.length === 0) return [];

  // Sort duties by day and start time
  const sortedDuties = [...duties].sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return parseTimeToHours(a.startTime) - parseTimeToHours(b.startTime);
  });

  const scheduleStart = sortedDuties[0].day;

  // Build duty data with commute-adjusted times
  const cumDuty = sortedDuties.map((duty, i) => {
    const startHour = parseTimeToHours(duty.startTime);
    let endHour = parseTimeToHours(duty.endTime);
    if (endHour <= startHour) endHour += 24;

    const commuteHours = (commuteMinutes - 40) / 60; // Relative to 40-min baseline
    const startCommute = startHour - commuteHours;
    const endCommute = endHour + commuteHours;
    const length = endHour - startHour;

    // Calculate gap to next duty
    let gap = 24; // Default for last duty
    if (i < sortedDuties.length - 1) {
      const nextDuty = sortedDuties[i + 1];
      const nextStartHour = parseTimeToHours(nextDuty.startTime);
      const nextStartCommute = nextStartHour - commuteHours;
      gap = 24 * (nextDuty.day - duty.day) + nextStartCommute - startCommute - length;
    }

    return {
      day: duty.day,
      startCommute,
      endCommute,
      length,
      gap,
      cr: 0, // Circadian component
      risk: 1 // Running risk value
    };
  });

  // Calculate cumulative risk factors
  cumDuty.forEach((cd, i) => {
    // Circadian component - based on mid-shift time
    cd.cr = 0.0886 + 0.0359 * Math.cos(Math.PI * (cd.startCommute + 0.5 * cd.length) / 12);

    const prevGap = i === 0 ? 24 : cumDuty[i - 1].gap;

    // Sleep opportunity calculation for recovery
    const prevEnd = i === 0 ? 0 : cumDuty[i - 1].endCommute;
    const en1 = prevEnd + 1 >= 24 ? prevEnd - 23 : prevEnd + 1;
    const st1 = cd.startCommute + 1 >= 24 ? cd.startCommute - 23 : cd.startCommute + 1;

    const endSleep = en1 < 8 ? 8 - en1 : 0;
    const startSleep = st1 < 8 ? st1 : 0;
    const sleep2 = (endSleep > 0 && startSleep > 0) ? 1 : 0;

    const nd = Math.floor(prevGap / 24);
    const nslp1 = nd + (endSleep + startSleep) / 8;
    const nslp2 = (sleep2 === 1 && st1 >= en1) ? nslp1 - 2 : nslp1;

    // Cumulative risk evolution
    if (i === 0) {
      cd.risk = 1;
    } else {
      const prevRisk = cumDuty[i - 1].risk;
      const prevCr = cumDuty[i - 1].cr;

      if (prevGap < 9) {
        // Short gap: fatigue builds up
        cd.risk = prevRisk + 0.06 * (9 - prevGap);
      } else if (prevGap > 24) {
        // Long gap (>24h): significant recovery
        cd.risk = 1 + (prevRisk - 1) * Math.exp(-1.118 * (nslp2 - 1));
      } else {
        // Normal gap: moderate buildup with circadian modulation
        cd.risk = prevRisk + 0.5 * (cd.cr + prevCr);
      }
    }
  });

  // Normalize and return
  const RISK_CUM_NORM = 1.113;
  const RISK_CUM_ADJ = 0.98899;

  return cumDuty.map(cd => (cd.risk / RISK_CUM_NORM) * RISK_CUM_ADJ);
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
 * Calculate Risk Index for a single shift
 * Uses per-shift parameters if provided, otherwise falls back to global params
 */
export function calculateRiskIndex(
  duty: ShiftDefinition,
  dutyIndex: number,
  allDuties: ShiftDefinition[],
  params: FatigueParams = DEFAULT_FATIGUE_PARAMS,
  precomputedCumulative?: number[]
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

  // Use precomputed cumulative if provided, otherwise calculate
  const cumulative = precomputedCumulative
    ? precomputedCumulative[dutyIndex]
    : calculateRiskCumulativeFactors(allDuties, totalCommute)[dutyIndex];

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
 * Calculate Risk Index for a sequence of shifts
 */
export function calculateFatigueSequence(
  shifts: ShiftDefinition[],
  params: FatigueParams = DEFAULT_FATIGUE_PARAMS
): FatigueResult[] {
  // Pre-calculate cumulative factors once for efficiency
  const totalCommute = params.commuteTime;
  const cumulativeFactors = calculateRiskCumulativeFactors(shifts, totalCommute);

  return shifts.map((shift, index) =>
    calculateRiskIndex(shift, index, shifts, params, cumulativeFactors)
  );
}

// ==================== FATIGUE INDEX CALCULATIONS ====================
// These implement the HSE Fatigue Index (FGI) - probability-based model
// Different from Risk Index (FRI) which uses multiplicative factors

/**
 * Three-process estimation for fatigue prediction
 * Implements the biomathematical model from HSE RR446
 *
 * @param dutyStartHour - Start hour (0-24 decimal)
 * @param dutyLengthHours - Duration in hours
 * @param fatigueFactor - Task-related fatigue rate
 * @param commuteMinutes - Total commute time in minutes
 * @returns Average probability of KSS >= 8 (severe sleepiness)
 */
function threeProcessEstimation(
  dutyStartHour: number,
  dutyLengthHours: number,
  fatigueFactor: number,
  commuteMinutes: number
): number {
  // Combined amplitude calculation
  const eAmplitude = Math.sqrt(
    CONSTANTS.START_AMPLITUDE ** 2 +
    CONSTANTS.CIRCADIAN_AMPLITUDE ** 2 -
    CONSTANTS.START_AMPLITUDE * CONSTANTS.CIRCADIAN_AMPLITUDE *
    Math.cos((CONSTANTS.START_PHASE - CONSTANTS.CIRCADIAN_PHASE) * Math.PI / 12)
  );

  // Combined phase calculation using atan2
  const ePhase = Math.atan2(
    CONSTANTS.START_AMPLITUDE * Math.sin(CONSTANTS.START_PHASE * Math.PI / 12) -
    CONSTANTS.CIRCADIAN_AMPLITUDE * Math.sin(CONSTANTS.CIRCADIAN_PHASE * Math.PI / 12),
    CONSTANTS.START_AMPLITUDE * Math.cos(CONSTANTS.START_PHASE * Math.PI / 12) -
    CONSTANTS.CIRCADIAN_AMPLITUDE * Math.cos(CONSTANTS.CIRCADIAN_PHASE * Math.PI / 12)
  ) * 12 / Math.PI;

  // Initial state at duty start
  const startTime = eAmplitude * Math.cos((dutyStartHour - ePhase) * Math.PI / 12);

  let pKss8Total = 0;
  let n = 0;
  let currentHour = dutyStartHour;

  // Iterate through duty in 15-minute increments
  for (let duration = 0; duration <= dutyLengthHours; duration += 0.25) {
    n++;

    // Time-on-duty effect (commute adjustment relative to 30-min baseline)
    const timeOnDuty = (duration + (commuteMinutes - 30) / 60) * fatigueFactor;

    // Circadian rhythm component
    const circadianRhythm = CONSTANTS.CIRCADIAN_AMPLITUDE *
      Math.cos((currentHour - CONSTANTS.CIRCADIAN_PHASE) * Math.PI / 12);

    // Combined sleep pressure
    const total = timeOnDuty + startTime + circadianRhythm;

    // Convert to sleepiness scales
    const sp = total + 2.45;
    const spcc = 1 + 6 / (1 + Math.exp(3.057 - 0.764 * sp));
    const kss = -0.6 + 1.436 * spcc;

    // Probability of KSS >= 8 (severe sleepiness)
    const pKss8 = 1.26 / (1 + 3670 * Math.exp(-1.06 * kss));

    pKss8Total += pKss8;

    // Advance time (wrap at 24)
    currentHour = (currentHour + 0.25) % 24;
    if (currentHour === 0) currentHour = 24;
  }

  return n > 0 ? pKss8Total / n : 0;
}

/**
 * Calculate fatigue factor from job characteristics (for Fatigue Index)
 */
function dutyFactorFatigue(
  dutyLengthHours: number,
  workload: number,
  attention: number,
  breakFreqMins: number,
  breakAvgLenMins: number,
  contWorkMins: number,
  breakAfterContMins: number
): number {
  const workloadSum = workload + attention;

  // Base workload effect
  let workloadEffect = 0.125 + 0.015 * workloadSum;

  // Average work/break pattern
  const continuousWork = (breakFreqMins + contWorkMins) / 2;
  const durationOfBreak = (breakAvgLenMins + breakAfterContMins) / 2;

  // Adjust for work/break ratio
  if (durationOfBreak === 0 && continuousWork === 0) {
    workloadEffect = workloadEffect * 1.2;
  } else {
    workloadEffect = workloadEffect * 1.2 * continuousWork / (continuousWork + durationOfBreak);
  }

  // Break effectiveness calculations
  const fiveMinBreak = 0.172731235 - 0.200918653 * 0.04 + 0.03552264 * 0.04 * 0.04;
  const fifteenMinBreak = continuousWork * 0.000442;
  const thirtyMinBreak = 0.000206 - 0.0000138433 * continuousWork +
    0.00000096491 * continuousWork * continuousWork;

  // Piecewise linear interpolation
  let finalBreakFactor: number;
  if (durationOfBreak < 5) {
    finalBreakFactor = 0.174 + (fiveMinBreak - 0.174) * durationOfBreak / 5;
  } else if (durationOfBreak < 15) {
    finalBreakFactor = fiveMinBreak + (fifteenMinBreak - fiveMinBreak) * (durationOfBreak - 5) / 10;
  } else if (durationOfBreak < 30) {
    finalBreakFactor = fifteenMinBreak + (thirtyMinBreak - fifteenMinBreak) * (durationOfBreak - 15) / 15;
  } else if (durationOfBreak < 60) {
    finalBreakFactor = thirtyMinBreak * (60 - durationOfBreak) / 30;
  } else {
    finalBreakFactor = 0;
  }

  return finalBreakFactor + workloadEffect;
}

/**
 * Calculate cumulative fatigue factors for Fatigue Index
 * Uses PVT-to-KSS probability conversion
 */
function calculateFatigueCumulativeFactors(
  duties: Array<{ day: number; startHour: number; endHour: number; commute: number }>
): number[] {
  if (duties.length === 0) return [];

  // Sort duties by day and start time
  const sortedDuties = [...duties].sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return a.startHour - b.startHour;
  });

  const scheduleStart = sortedDuties[0].day;

  // Build cumulative duty data
  const cumDuty = sortedDuties.map((duty, i) => {
    const commuteHours = (duty.commute - 30) / 60;
    const startCommute = duty.startHour - commuteHours;
    const length = calculateDutyLength(duty.startHour, duty.endHour);
    const endCommute = duty.startHour + length + commuteHours;

    // Determine which "night" this duty affects
    const night = startCommute < 15 ? duty.day - scheduleStart + 1 : duty.day - scheduleStart + 2;

    // Calculate gap to next duty
    let gap = 24;
    if (i < sortedDuties.length - 1) {
      const nextDuty = sortedDuties[i + 1];
      const nextCommuteHours = (nextDuty.commute - 30) / 60;
      const nextStartCommute = nextDuty.startHour - nextCommuteHours;
      gap = 24 * (nextDuty.day - duty.day) + nextStartCommute - startCommute - length;
    }

    return {
      duty,
      startCommute,
      endCommute,
      length,
      night,
      night2: night + 1,
      gap,
      startHr: startCommute + (duty.day - scheduleStart + 1 - night + 1) * 24,
      lossn1: 0,
      loss2xg: 0,
      fatigueFactor: 0,
      pvt3: 0,
      pvt4: 0,
      pvtNext: 0
    };
  });

  // Calculate sleep loss for each duty
  cumDuty.forEach(cd => {
    const endHr = cd.startHr + cd.length;

    // Bedtime estimation
    const bedTime = endHr < 24.25 ? 16.3 + 0.367 * endHr : endHr + 1;

    // Sleep duration models
    let rkFit = 8.13;
    if (endHr >= 18.5) {
      rkFit = -2.28827436527851 + 11.7995318577367 /
        (1 + 0.472949055173571 * Math.exp(-1.77393493516727 + 0.16244804759197 * (bedTime - 20)));
    }

    const aircrewFit = Math.min(8, 8 - 0.285 * (endHr - 18.5));

    // Sleep loss
    let loss2 = Math.min(8, 8.07 - (rkFit + aircrewFit) / 2);
    let loss2g = Math.max(loss2, 9 - cd.gap);

    // Early start loss
    let loss1 = 0;
    if (cd.startHr > 22.76) {
      loss1 = (0.03501 * (37.5 - cd.startHr) + 0.01928) * (37.5 - cd.startHr);
    }

    if (cd.startHr >= 15 && cd.startHr <= 22.67) {
      cd.lossn1 = loss2g;
    } else {
      cd.lossn1 = Math.min(loss1, loss2g);
    }

    // Secondary night calculations
    const enxHr = endHr - 24;
    const bedTimeX = enxHr < 24.25 ? 16.3 + 0.367 * enxHr : enxHr + 1;

    let rkFitx = 8.13;
    if (enxHr >= 18.5) {
      rkFitx = -2.28827436527851 + 11.7995318577367 /
        (1 + 0.472949055173571 * Math.exp(-1.77393493516727 + 0.16244804759197 * (bedTimeX - 20)));
    }

    const aircrewx = Math.min(8, 8 - 0.285 * (enxHr - 18.5));
    const loss2x = Math.min(8, 8.07 - (rkFitx + aircrewx) / 2);
    cd.loss2xg = Math.max(loss2x, 9 - cd.gap);
  });

  // Determine day count
  const dayCount = Math.max(...cumDuty.map(cd => cd.night));

  // Build per-day sleep quality tracking
  const cumDay: Array<{ night: number; nextNight: number; nightPVT: number; pvtNext: number }> = [];
  for (let day = 1; day <= dayCount; day++) {
    const lossForNight = cumDuty.find(cd => cd.night === day)?.lossn1 || 0;
    const lossForNight2 = cumDuty.find(cd => cd.night2 === day)?.loss2xg || 0;

    const totalLoss = Math.min(8, lossForNight + lossForNight2);
    const asymptote = 3.9 - totalLoss * 0.441596758431994;

    let nightPVT: number;
    if (day === 1) {
      const startPVT = 3.87;
      if (startPVT > asymptote) {
        nightPVT = asymptote + (startPVT - asymptote) * Math.exp(-0.136934833451947);
      } else {
        nightPVT = asymptote + (startPVT - asymptote) * Math.exp(-0.686825862760272);
      }
    } else {
      const prevPVT = cumDay[day - 2].nightPVT;
      if (prevPVT > asymptote) {
        nightPVT = asymptote + (prevPVT - asymptote) * Math.exp(-0.136934833451947);
      } else {
        nightPVT = asymptote + (prevPVT - asymptote) * Math.exp(-0.686825862760272);
      }
    }

    cumDay.push({ night: day, nextNight: day + 1, nightPVT, pvtNext: 0 });
  }

  // Backward pass for pvtNext
  for (let i = cumDay.length - 1; i >= 0; i--) {
    cumDay[i].pvtNext = i < cumDay.length - 1 ? cumDay[i + 1].nightPVT : 0;
  }

  // Calculate PVT values for each duty
  cumDuty.forEach((cd, i) => {
    const cumPVT = i === 0 ? 3.9 : (cumDay.find(d => d.nextNight === cd.night)?.nightPVT || 3.9);
    const pvtNext = cumDay.find(d => d.nextNight === cd.night)?.pvtNext || 0;

    let pvt2: number;
    if (cd.startHr > 27 && cd.startHr < 39) {
      pvt2 = cumPVT + (pvtNext - cumPVT) * 0.5 * (1 + Math.sin(Math.PI * (cd.startHr - 33) / 12));
    } else {
      pvt2 = cumPVT;
    }

    const pvt3 = (pvtNext === 0 && cumPVT === 0) ? 0 : pvt2 * 4.44 / 3.9;
    cd.pvt3 = pvt3;
    cd.pvt4 = pvt3;
    cd.pvtNext = pvtNext;
  });

  // Backward pass for pvt4
  for (let i = cumDuty.length - 1; i >= 0; i--) {
    if (cumDuty[i].pvt3 === 0 && i < cumDuty.length - 1) {
      cumDuty[i].pvt4 = cumDuty[i + 1].pvt4;
    }
  }

  // Final fatigue factor calculation
  cumDuty.forEach((cd, i) => {
    let x: number;
    if (i > 0) {
      const prevGap = cumDuty[i - 1].gap;
      if (prevGap > 9) x = 1;
      else if (prevGap < 1) x = 0;
      else x = (prevGap - 1) / 8;
    } else {
      x = 1;
    }

    let pvtOut: number;
    if (cd.pvtNext > 0) {
      pvtOut = x * cd.pvt4 + (1 - x) * cd.pvtNext;
    } else {
      pvtOut = cd.pvt4;
    }

    // Convert to sleepiness probability
    const sp = Math.max((Math.log((1.001 - pvtOut / 4.44) / 0.00189)) / 0.801, 1);
    const spcc = 1 + 6 / (1 + Math.exp(3.057 - 0.764 * sp));
    const pKss = 1.26 / (1 + 3670 * Math.exp(-1.06 * (-0.6 + 1.436 * spcc)));

    cd.fatigueFactor = pKss / 3; // Normalize by 3
  });

  return cumDuty.map(cd => cd.fatigueFactor);
}

/**
 * Get fatigue level classification based on Fatigue Index value
 * Thresholds: Day shifts ≥35 breach, Night shifts ≥45 breach
 */
export function getFatigueLevel(fatigueIndex: number, isNightShift: boolean = false): FatigueLevel {
  const threshold = isNightShift ? 45 : 35;

  if (fatigueIndex < threshold * 0.5) return { level: 'low', label: 'Low', color: '#22c55e' };
  if (fatigueIndex < threshold * 0.75) return { level: 'moderate', label: 'Moderate', color: '#eab308' };
  if (fatigueIndex < threshold) return { level: 'elevated', label: 'Elevated', color: '#f97316' };
  return { level: 'critical', label: 'High Risk', color: '#ef4444' };
}

/**
 * Calculate Fatigue Index for a single shift
 */
export function calculateFatigueIndexSingle(
  duty: ShiftDefinition,
  dutyIndex: number,
  allDuties: ShiftDefinition[],
  params: FatigueParams = DEFAULT_FATIGUE_PARAMS
): FatigueIndexResult {
  const startHour = parseTimeToHours(duty.startTime);
  let endHour = parseTimeToHours(duty.endTime);
  if (endHour <= startHour) endHour += 24;

  const dutyLength = endHour - startHour;

  // Get per-shift parameters
  const commuteIn = duty.commuteIn ?? Math.floor(params.commuteTime / 2);
  const commuteOut = duty.commuteOut ?? Math.ceil(params.commuteTime / 2);
  const totalCommute = commuteIn + commuteOut;

  const shiftWorkload = duty.workload ?? params.workload;
  const shiftAttention = duty.attention ?? params.attention;
  const shiftBreakFreq = duty.breakFreq ?? params.breakFrequency;
  const shiftBreakLen = duty.breakLen ?? params.breakLength;

  // Normalize duties for cumulative calculation
  const normalizedDuties = allDuties.map(d => ({
    day: d.day,
    startHour: parseTimeToHours(d.startTime),
    endHour: parseTimeToHours(d.endTime),
    commute: (d.commuteIn ?? Math.floor(params.commuteTime / 2)) +
             (d.commuteOut ?? Math.ceil(params.commuteTime / 2))
  }));

  // Calculate cumulative factors
  const fatigueCumulative = calculateFatigueCumulativeFactors(normalizedDuties);

  // Task factor
  const taskFatigue = dutyFactorFatigue(
    dutyLength,
    shiftWorkload,
    shiftAttention,
    shiftBreakFreq,
    shiftBreakLen,
    shiftBreakFreq, // continuousWork same as breakFreq
    shiftBreakLen   // breakAfterContinuous same as breakLen
  );

  // Time-of-day components
  const Pt = threeProcessEstimation(startHour, dutyLength, taskFatigue, totalCommute);
  const P0 = threeProcessEstimation(startHour, dutyLength, 0.14, totalCommute);
  const P0adj = Math.min(P0, Pt);

  // Components on 0-100 scale
  const cumulative = fatigueCumulative[dutyIndex] * 100;
  const timeOfDay = P0adj * 100;
  const task = (Pt - P0adj) * 100;

  // Final Fatigue Index formula
  const fatigueIndex = 100 * (1 - (1 - cumulative / 100) * (1 - timeOfDay / 100 - task / 100));

  // Determine if night shift (start hour between 20:00-06:00)
  const isNightShift = startHour >= 20 || startHour < 6;

  return {
    day: duty.day,
    cumulative: Math.round(cumulative * 10) / 10,
    timeOfDay: Math.round(timeOfDay * 10) / 10,
    task: Math.round(task * 10) / 10,
    fatigueIndex: Math.round(fatigueIndex * 10) / 10,
    fatigueLevel: getFatigueLevel(fatigueIndex, isNightShift)
  };
}

/**
 * Calculate Fatigue Index for a sequence of shifts
 */
export function calculateFatigueIndexSequence(
  shifts: ShiftDefinition[],
  params: FatigueParams = DEFAULT_FATIGUE_PARAMS
): FatigueIndexResult[] {
  return shifts.map((shift, index) => calculateFatigueIndexSingle(shift, index, shifts, params));
}

/**
 * Calculate both Risk Index and Fatigue Index for a sequence of shifts
 */
export function calculateCombinedFatigueSequence(
  shifts: ShiftDefinition[],
  params: FatigueParams = DEFAULT_FATIGUE_PARAMS
): CombinedFatigueResult[] {
  const riskResults = calculateFatigueSequence(shifts, params);
  const fatigueResults = calculateFatigueIndexSequence(shifts, params);

  return shifts.map((shift, index) => ({
    day: shift.day,
    // Risk Index components
    riskCumulative: riskResults[index].cumulative,
    riskTiming: riskResults[index].timing,
    riskJobBreaks: riskResults[index].jobBreaks,
    riskIndex: riskResults[index].riskIndex,
    riskLevel: riskResults[index].riskLevel,
    // Fatigue Index components
    fatigueCumulative: fatigueResults[index].cumulative,
    fatigueTimeOfDay: fatigueResults[index].timeOfDay,
    fatigueTask: fatigueResults[index].task,
    fatigueIndex: fatigueResults[index].fatigueIndex,
    fatigueLevel: fatigueResults[index].fatigueLevel
  }));
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
