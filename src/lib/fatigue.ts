// ============================================
// HSE FATIGUE/RISK INDEX CALCULATOR v2.0
// Reverse-engineered from Excel VBA macros
// Validated against 86 test cases (100% match)
// Based on HSE Research Report RR446 - Crown Copyright
// ============================================

import { ShiftDefinition, FatigueResult, RiskLevel, FatigueIndexResult, FatigueLevel, CombinedFatigueResult } from './types';

// ==================== CONSTANTS ====================

const PI = Math.PI;

const CONSTANTS = {
  // Break effect constants (from VBA)
  CONST1: 1.826297414,
  CONST2: 1.146457295,

  // Cumulative fatigue constants
  DECAY_FAST: 0.136934833451947,
  DECAY_SLOW: 0.686825862760272,
  BASELINE_PVT: 3.87,
  MAX_PVT: 3.9,
  LOSS_SCALE: 0.441596758431994,

  // Circadian parameters
  CIRCADIAN_AMPLITUDE: 0.74,
  CIRCADIAN_PHASE: 5.23,
  START_AMPLITUDE: 0.5,
  START_PHASE: 1.25,

  // Risk timing coefficients
  P1: -0.4287,
  P2: 0.1501,
  P3: 0.129,
  P4: 0.0359,
  P5: -0.8012,
  P6: 0.7315,
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
// Workload/Attention use 1-4 scale per NR Excel tool (1=highest demand, 4=lowest demand)
export const DEFAULT_FATIGUE_PARAMS: FatigueParams = {
  commuteTime: 40,       // VBA default is 40 minutes
  workload: 2,           // "Moderately demanding, little spare capacity"
  attention: 1,          // "All of the time" (highest attention)
  breakFrequency: 180,   // 3 hours between breaks
  breakLength: 15,       // 15 minute average break
  continuousWork: 240,   // 4 hours continuous work
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

// ==================== DUTY FACTOR (Job Type / Breaks Component) ====================

/**
 * Calculate duty factor for both fatigue and risk
 * Returns: { fatigueFactor, riskFactor }
 */
function dutyFactor(
  dutyLengthHours: number,
  jobWorkload: number,
  jobAttention: number,
  breakFreqMin: number,
  breakAvgLenMin: number,
  contWorkLenMin: number,
  breakAfterContMin: number
): { fatigueFactor: number; riskFactor: number } {
  const workloadSum = jobWorkload + jobAttention;
  const w = workloadSum;
  const continuousWork = (breakFreqMin + contWorkLenMin) / 2;
  const durationOfBreak = (breakAvgLenMin + breakAfterContMin) / 2;

  // Workload effect
  let workload = 0.125 + 0.015 * workloadSum;
  if (durationOfBreak === 0 && continuousWork === 0) {
    workload = workload * 1.2;
  } else {
    workload = workload * 1.2 * continuousWork / (continuousWork + durationOfBreak);
  }

  // Break factor calculation
  const fiveMinBreak = 0.172731235 - 0.200918653 * 0.04 + 0.03552264 * 0.04 * 0.04;
  const fifteenMinBreak = continuousWork * 0.000442;
  const thirtyMinBreak = 0.000206 - 0.0000138433 * continuousWork + 0.00000096491 * continuousWork * continuousWork;

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

  const fatigueFactor = finalBreakFactor + workload;

  // Risk factor calculation
  const lengthOfDuty = dutyLengthHours * 60;
  const numberOfSequences = 1 + Math.floor(lengthOfDuty / (continuousWork + durationOfBreak) - 0.01);
  const lengthOfSequences = Math.round(continuousWork / 15);
  const breakEffect = 0.24 * Math.exp(-0.395 * (durationOfBreak - 13.3)) / 0.2388 /
    (1 + Math.exp(-0.395 * (durationOfBreak - 13.3)));

  let n = 0;
  let leng = -1;
  let rr = 1;
  let rrTotal = 0;

  while (n <= numberOfSequences * lengthOfSequences) {
    if (leng < lengthOfSequences) {
      leng += 1;
    } else {
      leng = 0;
    }

    if (leng === 0) {
      rr = 1 + (rr - 1) * breakEffect;
    } else {
      rr = CONSTANTS.CONST1 + (rr - CONSTANTS.CONST1) * Math.exp(-0.25 * CONSTANTS.CONST2);
    }

    rrTotal += rr;
    n += 1;
  }

  const riskFactor = rrTotal / n / 1.4858 + (w - 3) * 0.0232;

  return { fatigueFactor, riskFactor };
}

// ==================== THREE PROCESS ESTIMATION (Fatigue Duty Timing + Job/Breaks) ====================

/**
 * Calculate pKss8 probability (0-1) for fatigue
 * Commute is relative to 30-minute baseline
 */
function threeProcessEstimation(
  dutyStartHour: number,
  dutyLengthHours: number,
  timeOnDutyFactor: number,
  commuteMin: number
): number {
  const startAmplitude = CONSTANTS.START_AMPLITUDE;
  const startPhase = CONSTANTS.START_PHASE;
  const circadianAmplitude = CONSTANTS.CIRCADIAN_AMPLITUDE;
  const circadianPhase = CONSTANTS.CIRCADIAN_PHASE;

  let dutyHours = dutyStartHour;

  // Combined amplitude using cosine rule
  const eAmplitude = Math.sqrt(
    startAmplitude ** 2 + circadianAmplitude ** 2 -
    startAmplitude * circadianAmplitude * Math.cos((startPhase - circadianPhase) * PI / 12)
  );

  // Combined phase using atan2
  const xArg = startAmplitude * Math.cos(startPhase * PI / 12) - circadianAmplitude * Math.cos(circadianPhase * PI / 12);
  const yArg = startAmplitude * Math.sin(startPhase * PI / 12) - circadianAmplitude * Math.sin(circadianPhase * PI / 12);
  const ePhase = Math.atan2(yArg, xArg) * 12 / PI;

  const startTime = eAmplitude * Math.cos((dutyStartHour - ePhase) * PI / 12);

  let n = 0;
  let pKss8Total = 0;
  let duration = 0;

  while (duration <= dutyLengthHours + 0.001) {
    // Time on duty effect (commute adjustment relative to 30-min baseline)
    const tod = (duration + ((commuteMin - 30) / 60)) * timeOnDutyFactor;
    const cr = circadianAmplitude * Math.cos((dutyHours - circadianPhase) * PI / 12);
    const total = tod + startTime + cr;
    const sp = total + 2.45;
    const spcc = 1 + 6 / (1 + Math.exp(3.057 - 0.764 * sp));
    const kss = -0.6 + 1.436 * spcc;
    const pKss8 = 1.26 / (1 + 3670 * Math.exp(-1.06 * kss));

    pKss8Total += pKss8;
    n += 1;

    // Advance time (wrap at 24)
    if (dutyHours + 1 >= 24) {
      dutyHours -= 23.75;
    } else {
      dutyHours += 0.25;
    }
    duration += 0.25;
  }

  return n > 0 ? pKss8Total / n : 0;
}

// ==================== ASSOCIATED RISK (Risk Duty Timing) ====================

/**
 * Calculate risk duty timing component
 * Commute is relative to 40-minute baseline
 */
function associatedRisk(startHrs: number, endHrs: number, commuteMin: number): number {
  const { P1, P2, P3, P4, P5, P6 } = CONSTANTS;

  const dutyLength = endHrs > startHrs ? endHrs - startHrs : 24 + endHrs - startHrs;
  const adjStart = startHrs - ((commuteMin - 40) / 60);
  const relativeCommute = (commuteMin - 40) / 60;
  const adjLength = dutyLength + relativeCommute;

  // Time of day risk
  const todRisk = 1.0106 + 0.1057 * (Math.sin(PI * endHrs / 12) - Math.sin(PI * adjStart / 12)) / (adjLength * PI / 12);

  // Shift length risk
  let shiftRisk: number;
  if (adjLength < 4.25) {
    shiftRisk = 1 + P4 + P5 * Math.exp(-P6 * adjLength);
  } else if (adjLength > 8.13) {
    shiftRisk = 1 + P1 + P2 * Math.exp(P3 * adjLength);
  } else {
    shiftRisk = 1;
  }

  // Commute risk
  let commuteRisk: number;
  if (relativeCommute < 4.25) {
    commuteRisk = 1 + P4 + P5 * Math.exp(-P6 * relativeCommute);
  } else if (relativeCommute > 8.13) {
    commuteRisk = 1 + P1 + P2 * Math.exp(P3 * relativeCommute);
  } else {
    commuteRisk = 1;
  }

  const shiftRiskAdjusted = relativeCommute <= 0
    ? shiftRisk
    : (shiftRisk * adjLength - commuteRisk * relativeCommute) / dutyLength;

  return (todRisk * shiftRiskAdjusted / 1.288) * 0.997976;
}

// ==================== CUMULATIVE FATIGUE ====================

interface CumDuty {
  startDay: number;
  onDutyHour: number;
  offDutyHour: number;
}

/**
 * Calculate cumulative fatigue factors (one per duty)
 * This uses PVT tracking with day/night sleep calculations
 */
function cumulativeFatigue(duties: CumDuty[]): number[] {
  const numDuties = duties.length;
  if (numDuties === 0) return [];

  // Build cumulative duty data
  const cumDuties: Array<{
    startDay: number;
    startCommute: number;
    endCommute: number;
    night: number;
    night2: number;
    length: number;
    gap: number;
    startHr: number;
    lossn1: number;
    loss2xg: number;
    ngtt: number;
    pvt3: number;
    pvt4: number;
    pvtNext: number;
  }> = [];

  for (const duty of duties) {
    const startCommute = duty.onDutyHour - 0.5;
    const night = startCommute < 15 ? duty.startDay : duty.startDay + 1;
    const endCommute = duty.offDutyHour + 0.5;
    const length = endCommute > startCommute
      ? endCommute - startCommute
      : 24 + endCommute - startCommute;

    cumDuties.push({
      startDay: duty.startDay,
      startCommute,
      endCommute,
      night,
      night2: night + 1,
      length,
      gap: 24,
      startHr: 0,
      lossn1: 0,
      loss2xg: 0,
      ngtt: 0,
      pvt3: 0,
      pvt4: 0,
      pvtNext: 0,
    });
  }

  const dayCount = cumDuties[cumDuties.length - 1].night;

  // Calculate gaps and start hours
  for (let i = 0; i < cumDuties.length; i++) {
    const cd = cumDuties[i];
    if (i < numDuties - 1) {
      const nextCd = cumDuties[i + 1];
      cd.gap = 24 * (nextCd.startDay - cd.startDay) + nextCd.startCommute - cd.startCommute - cd.length;
    } else {
      cd.gap = 24;
    }

    cd.startHr = cd.startCommute + (cd.startDay - cd.night + 1) * 24;
    const endHr = cd.startHr + cd.length;

    // Sleep loss calculations
    const loss1 = cd.startHr > 22.76
      ? (0.03501 * (37.5 - cd.startHr) + 0.01928) * (37.5 - cd.startHr)
      : 0;

    const bedTime = endHr < 24.25 ? 16.3 + 0.367 * endHr : endHr + 1;

    const rkFit = endHr < 18.5
      ? 8.13
      : -2.28827436527851 + 11.7995318577367 / (1 + 0.472949055173571 * Math.exp(-1.77393493516727 + 0.16244804759197 * (bedTime - 20)));

    const aircrewFit = Math.min(8, 8 - 0.285 * (endHr - 18.5));
    const loss2 = Math.min(8, 8.07 - (rkFit + aircrewFit) / 2);
    const loss2g = Math.max(loss2, 9 - cd.gap);

    cd.lossn1 = (cd.startHr >= 15 && cd.startHr <= 22.67)
      ? loss2g
      : Math.min(loss1, loss2g);

    // Secondary night calculations
    const enxHr = endHr - 24;
    const bedTimeX = enxHr < 24.25 ? 16.3 + 0.367 * enxHr : enxHr + 1;
    const rkFitX = enxHr < 18.5
      ? 8.13
      : -2.28827436527851 + 11.7995318577367 / (1 + 0.472949055173571 * Math.exp(-1.77393493516727 + 0.16244804759197 * (bedTimeX - 20)));
    const aircrewX = Math.min(8, 8 - 0.285 * (enxHr - 18.5));
    const loss2x = Math.min(8, 8.07 - (rkFitX + aircrewX) / 2);
    cd.loss2xg = Math.max(loss2x, 9 - cd.gap);

    // Mark last duty on each night
    const lastn = (i >= numDuties - 1 || cumDuties[i + 1].night !== cd.night) ? 1 : 0;
    cd.ngtt = lastn === 1 ? cd.night : 0;
  }

  // Build per-day sleep tracking
  const cumDays: Map<number, { night: number; nextNight: number; nightPvt: number; pvtNext: number }> = new Map();
  for (let d = 1; d <= dayCount; d++) {
    cumDays.set(d, { night: d, nextNight: d + 1, nightPvt: 0, pvtNext: 0 });
  }

  // Forward pass: calculate night PVT values
  for (let day = 1; day <= dayCount; day++) {
    const loss = cumDuties.find(cd => cd.night === day)?.lossn1 ?? 0;
    const lossn2Val = day === 1 ? 0 : (cumDuties.find(cd => cd.night2 === day)?.loss2xg ?? 0);
    const totalLoss = Math.min(8, loss + lossn2Val);
    const asymptote = CONSTANTS.MAX_PVT - totalLoss * CONSTANTS.LOSS_SCALE;

    const prevPvt = day === 1 ? CONSTANTS.BASELINE_PVT : (cumDays.get(day - 1)?.nightPvt ?? CONSTANTS.BASELINE_PVT);
    const decayRate = prevPvt > asymptote ? CONSTANTS.DECAY_FAST : CONSTANTS.DECAY_SLOW;

    const dayData = cumDays.get(day)!;
    dayData.nightPvt = asymptote + (prevPvt - asymptote) * Math.exp(-decayRate);
  }

  // Backward pass: calculate pvtNext values
  for (let day = dayCount; day >= 1; day--) {
    const dayData = cumDays.get(day)!;
    dayData.pvtNext = day === dayCount ? 0 : (cumDays.get(day + 1)?.nightPvt ?? 0);
  }

  // Calculate PVT for each duty
  for (let i = 0; i < cumDuties.length; i++) {
    const cd = cumDuties[i];

    let cumPvt: number = CONSTANTS.MAX_PVT;
    let pvtNext: number = CONSTANTS.MAX_PVT;

    if (i > 0) {
      for (let d = 1; d <= dayCount; d++) {
        const dayData = cumDays.get(d)!;
        if (dayData.nextNight === cd.ngtt) {
          cumPvt = dayData.nightPvt;
          pvtNext = dayData.pvtNext;
          break;
        }
      }
    }

    cd.pvtNext = pvtNext;

    // Interpolate based on start time
    const pvt2 = (cd.startHr > 27 && cd.startHr < 39)
      ? cumPvt + (pvtNext - cumPvt) * 0.5 * (1 + Math.sin(PI * (cd.startHr - 33) / 12))
      : cumPvt;

    cd.pvt3 = (pvtNext === 0 && cumPvt === 0) ? 0 : pvt2 * 4.44 / 3.9;
  }

  // Backward pass for pvt4
  for (let i = numDuties - 1; i >= 0; i--) {
    cumDuties[i].pvt4 = (cumDuties[i].pvt3 === 0 && i + 1 < numDuties)
      ? cumDuties[i + 1].pvt4
      : cumDuties[i].pvt3;
  }

  // Final fatigue factor calculation
  const results: number[] = [];
  for (let i = 0; i < cumDuties.length; i++) {
    const cd = cumDuties[i];

    let x: number;
    if (i > 0) {
      const prevGap = cumDuties[i - 1].gap;
      x = prevGap > 9 ? 1 : (prevGap < 1 ? 0 : (prevGap - 1) / 8);
    } else {
      x = 1;
    }

    const pvtOut = cd.pvtNext > 0
      ? x * cd.pvt4 + (1 - x) * cd.pvtNext
      : cd.pvt4;

    const spVal = Math.max(1, Math.log((1.001 - pvtOut / 4.44) / 0.00189) / 0.801);
    const spcc = 1 + 6 / (1 + Math.exp(3.057 - 0.764 * spVal));
    const pKss = 1.26 / (1 + 3670 * Math.exp(-1.06 * (-0.6 + 1.436 * spcc)));

    results.push(pKss / 3);
  }

  return results;
}

// ==================== CUMULATIVE RISK ====================

/**
 * Calculate cumulative risk factors (one per duty)
 */
function cumulativeRisk(duties: CumDuty[]): number[] {
  const numDuties = duties.length;
  if (numDuties === 0) return [];

  // Build cumulative duty data
  const cumDuties: Array<{
    startDay: number;
    startCommute: number;
    endCommute: number;
    length: number;
    gap: number;
    cr: number;
    risk: number;
  }> = [];

  for (const duty of duties) {
    const startCommute = duty.onDutyHour - 0.5;
    const endCommute = duty.offDutyHour + 0.5;
    const length = endCommute > startCommute
      ? endCommute - startCommute
      : 24 + endCommute - startCommute;

    cumDuties.push({
      startDay: duty.startDay,
      startCommute,
      endCommute,
      length,
      gap: 24,
      cr: 0,
      risk: 1,
    });
  }

  // Calculate gaps and circadian components
  for (let i = 0; i < cumDuties.length; i++) {
    const cd = cumDuties[i];
    if (i < numDuties - 1) {
      const nextCd = cumDuties[i + 1];
      cd.gap = 24 * (nextCd.startDay - cd.startDay) + nextCd.startCommute - cd.startCommute - cd.length;
    } else {
      cd.gap = 24;
    }
    cd.cr = 0.0886 + 0.0359 * Math.cos(PI * (cd.startCommute + 0.5 * cd.length) / 12);
  }

  // Calculate cumulative risk
  const results: number[] = [];
  for (let i = 0; i < cumDuties.length; i++) {
    const cd = cumDuties[i];

    if (i === 0) {
      cd.risk = 1;
    } else {
      const prevCd = cumDuties[i - 1];
      const lGap = prevCd.gap;
      const endd = prevCd.endCommute;
      const nd = Math.floor(lGap / 24);

      const en1 = endd + 1 >= 24 ? endd - 23 : endd + 1;
      const st1 = cd.startCommute + 1 >= 24 ? cd.startCommute - 23 : cd.startCommute + 1;
      const endSleep = en1 < 8 ? Math.max(0, 8 - en1) : 0;
      const startSleep = st1 < 8 ? st1 : 0;
      const sleep2 = (endSleep > 0 && startSleep > 0) ? 1 : 0;
      const nslp1 = nd + (endSleep + startSleep) / 8;
      const nslp2 = (sleep2 === 1 && st1 >= en1) ? nslp1 - 2 : nslp1;

      const prevRisk = results[i - 1] * 1.113;

      if (lGap < 9) {
        cd.risk = prevRisk + 0.06 * (9 - lGap);
      } else if (lGap > 24) {
        cd.risk = 1 + (prevRisk - 1) * Math.exp(-1.118 * (nslp2 - 1));
      } else {
        cd.risk = prevRisk + 0.5 * (cd.cr + prevCd.cr);
      }
    }

    results.push(cd.risk / 1.113);
  }

  return results;
}

// ==================== MAIN CALCULATOR ====================

/**
 * Duty data for internal calculations
 */
interface DutyData {
  startDay: number;
  onDutyHour: number;
  offDutyHour: number;
  commute: number;
  workload: number;
  attention: number;
  breakFreq: number;
  breakLen: number;
  contWork: number;
  breakAfterCont: number;
}

/**
 * Calculate both Fatigue and Risk indices for a schedule
 */
function calculateIndices(
  duties: DutyData[],
  defaultParams: FatigueParams = DEFAULT_FATIGUE_PARAMS
): Array<{
  day: number;
  start: number;
  end: number;
  dutyLength: number;
  commuteMin: number;
  fatigueCumulative: number;
  fatigueDutyTiming: number;
  fatigueJobBreaks: number;
  fatigueIndex: number;
  riskCumulative: number;
  riskDutyTiming: number;
  riskJobBreaks: number;
  riskIndex: number;
}> {
  // Prepare base duties for cumulative calculations (uses 30-min default commute)
  const baseDuties: CumDuty[] = duties.map(d => ({
    startDay: d.startDay,
    onDutyHour: d.onDutyHour,
    offDutyHour: d.offDutyHour,
  }));

  // Calculate cumulative factors (independent of per-shift commute)
  const cumFatigue = cumulativeFatigue(baseDuties);
  const cumRisk = cumulativeRisk(baseDuties);

  const results = duties.map((duty, i) => {
    const start = duty.onDutyHour;
    const end = duty.offDutyHour;
    const dutyLen = end > start ? end - start : 24 + end - start;
    const commute = duty.commute;

    // Get job parameters
    const workload = duty.workload;
    const attention = duty.attention;
    const breakFreq = duty.breakFreq;
    const breakLen = duty.breakLen;
    const contWork = duty.contWork;
    const breakAfterCont = duty.breakAfterCont;

    // Duty factor (for both fatigue and risk)
    const { fatigueFactor, riskFactor } = dutyFactor(
      dutyLen, workload, attention,
      breakFreq, breakLen, contWork, breakAfterCont
    );

    // Fatigue components
    const Pt = threeProcessEstimation(start, dutyLen, fatigueFactor, commute);
    const P0 = threeProcessEstimation(start, dutyLen, 0.14, commute);
    const P0adj = Math.min(P0, Pt);

    const dtFatigue = P0adj * 100;
    const jbFatigue = (Pt - P0adj) * 100;
    const cumF = cumFatigue[i] * 100;
    const fi = 100 * (1 - (1 - cumF / 100) * (1 - dtFatigue / 100 - jbFatigue / 100));

    // Risk components
    const dtRisk = associatedRisk(start, end, commute);
    const jbRisk = (riskFactor / 1.032) / 1.0286182;
    const cumR = cumRisk[i] * 0.98899;
    const ri = cumR * dtRisk * jbRisk;

    return {
      day: duty.startDay,
      start,
      end,
      dutyLength: dutyLen,
      commuteMin: commute,
      fatigueCumulative: Math.round(cumF * 10) / 10,
      fatigueDutyTiming: Math.round(dtFatigue * 10) / 10,
      fatigueJobBreaks: Math.round(jbFatigue * 10) / 10,
      fatigueIndex: Math.round(fi * 10) / 10,
      riskCumulative: Math.round(cumR * 100) / 100,
      riskDutyTiming: Math.round(dtRisk * 100) / 100,
      riskJobBreaks: Math.round(jbRisk * 100) / 100,
      riskIndex: Math.round(ri * 100) / 100,
    };
  });

  return results;
}

// ==================== PUBLIC API ====================

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
 * Calculate rest period between shifts
 */
export function calculateRestPeriod(prevDuty: ShiftDefinition, currentDuty: ShiftDefinition): number {
  const prevEnd = parseTimeToHours(prevDuty.endTime);
  const currStart = parseTimeToHours(currentDuty.startTime);
  let gap = (currentDuty.day - prevDuty.day) * 24 + currStart - prevEnd;
  if (gap < 0) gap += 24;
  return Math.round(gap * 100) / 100;
}

/**
 * Calculate Risk Index for a single shift
 */
export function calculateRiskIndex(
  duty: ShiftDefinition,
  dutyIndex: number,
  allDuties: ShiftDefinition[],
  params: FatigueParams = DEFAULT_FATIGUE_PARAMS
): FatigueResult {
  // Convert shifts to internal format
  const internalDuties: DutyData[] = allDuties.map(d => {
    const startHour = parseTimeToHours(d.startTime);
    let endHour = parseTimeToHours(d.endTime);
    if (endHour <= startHour) endHour += 24;

    // Get per-shift parameters or use defaults
    const commuteIn = d.commuteIn ?? Math.floor(params.commuteTime / 2);
    const commuteOut = d.commuteOut ?? Math.ceil(params.commuteTime / 2);
    const totalCommute = commuteIn + commuteOut;

    return {
      startDay: d.day,
      onDutyHour: startHour,
      offDutyHour: endHour > 24 ? endHour - 24 : endHour,
      commute: totalCommute,
      workload: d.workload ?? params.workload,
      attention: d.attention ?? params.attention,
      breakFreq: d.breakFreq ?? params.breakFrequency,
      breakLen: d.breakLen ?? params.breakLength,
      contWork: params.continuousWork,
      breakAfterCont: params.breakAfterContinuous,
    };
  });

  const results = calculateIndices(internalDuties, params);
  const result = results[dutyIndex];

  return {
    day: duty.day,
    riskIndex: result.riskIndex,
    cumulative: result.riskCumulative,
    timing: result.riskDutyTiming,
    jobBreaks: result.riskJobBreaks,
    riskLevel: getRiskLevel(result.riskIndex),
  };
}

/**
 * Calculate Risk Index for a sequence of shifts
 */
export function calculateFatigueSequence(
  shifts: ShiftDefinition[],
  params: FatigueParams = DEFAULT_FATIGUE_PARAMS
): FatigueResult[] {
  return shifts.map((shift, index) => calculateRiskIndex(shift, index, shifts, params));
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
  // Convert shifts to internal format
  const internalDuties: DutyData[] = allDuties.map(d => {
    const startHour = parseTimeToHours(d.startTime);
    let endHour = parseTimeToHours(d.endTime);
    if (endHour <= startHour) endHour += 24;

    const commuteIn = d.commuteIn ?? Math.floor(params.commuteTime / 2);
    const commuteOut = d.commuteOut ?? Math.ceil(params.commuteTime / 2);
    const totalCommute = commuteIn + commuteOut;

    return {
      startDay: d.day,
      onDutyHour: startHour,
      offDutyHour: endHour > 24 ? endHour - 24 : endHour,
      commute: totalCommute,
      workload: d.workload ?? params.workload,
      attention: d.attention ?? params.attention,
      breakFreq: d.breakFreq ?? params.breakFrequency,
      breakLen: d.breakLen ?? params.breakLength,
      contWork: params.continuousWork,
      breakAfterCont: params.breakAfterContinuous,
    };
  });

  const results = calculateIndices(internalDuties, params);
  const result = results[dutyIndex];

  // Determine if night shift (start hour between 20:00-06:00)
  const startHour = parseTimeToHours(duty.startTime);
  const isNightShift = startHour >= 20 || startHour < 6;

  return {
    day: duty.day,
    cumulative: result.fatigueCumulative,
    timeOfDay: result.fatigueDutyTiming,
    task: result.fatigueJobBreaks,
    fatigueIndex: result.fatigueIndex,
    fatigueLevel: getFatigueLevel(result.fatigueIndex, isNightShift)
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
  // Convert shifts to internal format
  const internalDuties: DutyData[] = shifts.map(d => {
    const startHour = parseTimeToHours(d.startTime);
    let endHour = parseTimeToHours(d.endTime);
    if (endHour <= startHour) endHour += 24;

    const commuteIn = d.commuteIn ?? Math.floor(params.commuteTime / 2);
    const commuteOut = d.commuteOut ?? Math.ceil(params.commuteTime / 2);
    const totalCommute = commuteIn + commuteOut;

    return {
      startDay: d.day,
      onDutyHour: startHour,
      offDutyHour: endHour > 24 ? endHour - 24 : endHour,
      commute: totalCommute,
      workload: d.workload ?? params.workload,
      attention: d.attention ?? params.attention,
      breakFreq: d.breakFreq ?? params.breakFrequency,
      breakLen: d.breakLen ?? params.breakLength,
      contWork: params.continuousWork,
      breakAfterCont: params.breakAfterContinuous,
    };
  });

  const results = calculateIndices(internalDuties, params);

  return shifts.map((shift, index) => {
    const result = results[index];
    const startHour = parseTimeToHours(shift.startTime);
    const isNightShift = startHour >= 20 || startHour < 6;

    return {
      day: shift.day,
      // Risk Index components
      riskCumulative: result.riskCumulative,
      riskTiming: result.riskDutyTiming,
      riskJobBreaks: result.riskJobBreaks,
      riskIndex: result.riskIndex,
      riskLevel: getRiskLevel(result.riskIndex),
      // Fatigue Index components
      fatigueCumulative: result.fatigueCumulative,
      fatigueTimeOfDay: result.fatigueDutyTiming,
      fatigueTask: result.fatigueJobBreaks,
      fatigueIndex: result.fatigueIndex,
      fatigueLevel: getFatigueLevel(result.fatigueIndex, isNightShift)
    };
  });
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
