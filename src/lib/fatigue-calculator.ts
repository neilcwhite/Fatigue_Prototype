import { ShiftInput, JobBreaksParams, FatigueIndexResult, RiskLevel } from './types';

// ==================== HSE FATIGUE/RISK INDEX CALCULATOR ====================
// Based on HSE Research Report RR446 - Crown Copyright
// Reference: https://www.hse.gov.uk/research/rrpdf/rr446.pdf

// ==================== CONSTANTS ====================

const CONSTANTS = {
  SLEEP_DECAY_RATE: 0.136934833451947,
  WAKE_DECAY_RATE: 0.686825862760272,
  BASELINE_PVT: 3.9,
  ASYMPTOTE_FACTOR: 0.441596758431994,
  CIRCADIAN_AMPLITUDE: 0.74,
  CIRCADIAN_PHASE: 5.23,
  START_AMPLITUDE: 0.5,
  START_PHASE: 1.25,
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Parse time string (HH:MM) to decimal hours
 */
export function parseTimeToHours(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + minutes / 60;
}

/**
 * Calculate shift duration in hours, handling overnight shifts
 */
export function calculateShiftDuration(startTime: string, endTime: string): number {
  const start = parseTimeToHours(startTime);
  const end = parseTimeToHours(endTime);
  
  if (end > start) {
    return end - start;
  }
  // Overnight shift
  return (24 - start) + end;
}

/**
 * Format decimal hours to HH:MM string
 */
export function formatHoursToTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ==================== RISK LEVEL CLASSIFICATION ====================

/**
 * Classify risk index into risk level
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
  return { level: 'high', label: 'High Risk', color: '#ef4444' };
}

// ==================== TIMING COMPONENT ====================

/**
 * Calculate the duty timing component of the fatigue index
 * Accounts for time of day effects and shift duration
 */
export function calculateTimingComponent(
  startHour: number,
  endHour: number,
  commuteMinutes: number = 60
): number {
  // Calculate duty length accounting for overnight shifts
  const dutyLength = endHour > startHour 
    ? endHour - startHour 
    : (24 + endHour) - startHour;
  
  // Adjust for commute beyond standard 40 minutes
  const commuteHours = (commuteMinutes - 40) / 60;
  const adjStart = startHour - commuteHours;
  const adjLength = dutyLength + commuteHours;
  
  // Time of day risk factor (circadian effect)
  const todRisk = 1.0106 + 0.1057 * 
    (Math.sin(Math.PI * endHour / 12) - Math.sin(Math.PI * adjStart / 12)) / 
    (adjLength * Math.PI / 12);
  
  // Shift duration risk coefficients
  const P1 = -0.4287, P2 = 0.1501, P3 = 0.129;
  const P4 = 0.0359, P5 = -0.8012, P6 = 0.7315;
  
  // Calculate shift duration risk
  let shiftRisk: number;
  if (adjLength < 4.25) {
    shiftRisk = 1 + P4 + P5 * Math.exp(-P6 * adjLength);
  } else if (adjLength > 8.13) {
    shiftRisk = 1 + P1 + P2 * Math.exp(P3 * adjLength);
  } else {
    shiftRisk = 1;
  }
  
  // No additional commute adjustment needed
  if (commuteHours <= 0) {
    return (todRisk * shiftRisk) / 1.288 * 0.997976;
  }
  
  // Adjust for commute risk
  let commuteRisk: number;
  if (commuteHours < 4.25) {
    commuteRisk = 1 + P4 + P5 * Math.exp(-P6 * commuteHours);
  } else if (commuteHours > 8.13) {
    commuteRisk = 1 + P1 + P2 * Math.exp(P3 * commuteHours);
  } else {
    commuteRisk = 1;
  }
  
  const shiftRiskAdjusted = (shiftRisk * adjLength - commuteRisk * commuteHours) / dutyLength;
  return (todRisk * shiftRiskAdjusted) / 1.288 * 0.997976;
}

// ==================== JOB/BREAKS COMPONENT ====================

/**
 * Calculate the job and breaks component of the fatigue index
 * Accounts for workload, attention demands, and break patterns
 */
export function calculateJobBreaksComponent(
  dutyLength: number,
  params: JobBreaksParams = {}
): number {
  const {
    workload = 2,           // 1-5 scale, default moderate
    attention = 1,          // 1-5 scale, default low
    breakFrequency = 180,   // minutes between breaks
    breakLength = 30,       // break duration in minutes
  } = params;
  
  // Calculate workload factor
  let workloadFactor = 0.125 + 0.015 * (workload + attention);
  
  const avgContinuous = breakFrequency;
  const avgBreak = breakLength;
  
  // Adjust workload factor for break pattern
  workloadFactor *= 1.2 * avgContinuous / (avgContinuous + avgBreak);
  
  // Constants for risk calculation
  const CONST1 = 1.826297414;
  const CONST2 = 1.146457295;
  
  const dutyMinutes = dutyLength * 60;
  const numSequences = 1 + Math.floor(dutyMinutes / (avgContinuous + avgBreak) - 0.01);
  const seqLength = Math.floor(0.5 + avgContinuous / 15);
  const breakEffect = 0.24 * Math.exp(-0.395 * (avgBreak - 13.3)) / 0.2388 / 
    (1 + Math.exp(-0.395 * (avgBreak - 13.3)));
  
  // Calculate cumulative risk over work sequences
  let n = 0, leng = -1, rr = 1, rrTotal = 0;
  do {
    if (leng < seqLength) {
      leng++;
    } else {
      leng = 0;
    }
    if (leng === 0) {
      rr = 1 + (rr - 1) * breakEffect;
    } else {
      rr = CONST1 + (rr - CONST1) * Math.exp(-0.25 * CONST2);
    }
    rrTotal += rr;
    n++;
  } while (n <= numSequences * seqLength);
  
  // Calculate final risk factor
  let riskFactor = rrTotal / n / 1.4858;
  riskFactor += ((workload + attention) - 3) * 0.0232;
  
  return (riskFactor / 1.032) / 1.0286182;
}

// ==================== CUMULATIVE COMPONENT ====================

/**
 * Calculate the cumulative fatigue component
 * Accounts for fatigue accumulation over consecutive shifts
 */
export function calculateCumulativeComponent(
  dutyIndex: number,
  shifts: ShiftInput[]
): number {
  // First shift baseline
  if (dutyIndex === 0) {
    return 0.8885804237312078;
  }
  
  const currentShift = shifts[dutyIndex];
  const prevShift = shifts[dutyIndex - 1];
  
  const currStart = parseTimeToHours(currentShift.startTime);
  const prevEnd = parseTimeToHours(prevShift.endTime);
  
  // Calculate gap between shifts
  const dayGap = currentShift.day - prevShift.day;
  let gap = dayGap * 24 + currStart - prevEnd;
  if (gap < 0) gap += 24;
  
  // Calculate previous cumulative and recovery
  const prevCumulative = calculateCumulativeComponent(dutyIndex - 1, shifts);
  const recoveryFactor = Math.max(0, 1 - (gap / 24) * 0.3);
  
  return prevCumulative + 0.047 * recoveryFactor;
}

// ==================== SLEEP ESTIMATION ====================

/**
 * Estimate sleep duration based on shift end time
 */
export function estimateSleepDuration(endHour: number): number {
  // Model based on RR446 sleep estimation
  const bedTime = calculateBedTime(endHour);
  return calculateExpectedSleep(endHour, bedTime);
}

function calculateBedTime(endHour: number): number {
  if (endHour < 24.25) {
    return 16.3 + 0.367 * endHour;
  }
  return endHour + 1;
}

function calculateExpectedSleep(endHour: number, bedTime: number): number {
  if (endHour < 18.5) {
    return 8.13;
  }
  return -2.28827436527851 + 11.7995318577367 / 
    (1 + 0.472949055173571 * Math.exp(-1.77393493516727 + 0.16244804759197 * (bedTime - 20)));
}

// ==================== MAIN CALCULATOR ====================

/**
 * Calculate fatigue index for a series of shifts
 */
export function calculateFatigueIndex(
  shifts: ShiftInput[],
  jobParams: JobBreaksParams = {}
): FatigueIndexResult[] {
  return shifts.map((shift, idx) => {
    const startHour = parseTimeToHours(shift.startTime);
    const endHour = parseTimeToHours(shift.endTime);
    const duration = calculateShiftDuration(shift.startTime, shift.endTime);
    const commuteMinutes = shift.commuteMinutes || 60;
    
    // Calculate each component
    const cumulative = calculateCumulativeComponent(idx, shifts);
    const timing = calculateTimingComponent(startHour, endHour, commuteMinutes);
    const jobBreaks = calculateJobBreaksComponent(duration, jobParams);
    
    // Combined risk index
    const riskIndex = cumulative * timing * jobBreaks;
    const riskLevel = getRiskLevel(riskIndex);
    
    return {
      day: shift.day,
      date: '', // Can be populated by caller
      cumulative: Math.round(cumulative * 1000) / 1000,
      timing: Math.round(timing * 1000) / 1000,
      jobBreaks: Math.round(jobBreaks * 1000) / 1000,
      riskIndex: Math.round(riskIndex * 1000) / 1000,
      riskLevel,
    };
  });
}

// ==================== QUICK ASSESSMENT ====================

/**
 * Quick single-shift risk assessment
 */
export function assessSingleShift(
  startTime: string,
  endTime: string,
  isFirstShift: boolean = true,
  commuteMinutes: number = 60,
  jobParams: JobBreaksParams = {}
): FatigueIndexResult {
  const startHour = parseTimeToHours(startTime);
  const endHour = parseTimeToHours(endTime);
  const duration = calculateShiftDuration(startTime, endTime);
  
  const cumulative = isFirstShift ? 0.8885804237312078 : 0.95;
  const timing = calculateTimingComponent(startHour, endHour, commuteMinutes);
  const jobBreaks = calculateJobBreaksComponent(duration, jobParams);
  
  const riskIndex = cumulative * timing * jobBreaks;
  const riskLevel = getRiskLevel(riskIndex);
  
  return {
    day: 1,
    date: '',
    cumulative: Math.round(cumulative * 1000) / 1000,
    timing: Math.round(timing * 1000) / 1000,
    jobBreaks: Math.round(jobBreaks * 1000) / 1000,
    riskIndex: Math.round(riskIndex * 1000) / 1000,
    riskLevel,
  };
}

// ==================== PATTERN ANALYSIS ====================

/**
 * Analyze a typical work pattern (e.g., 5 days on, 2 off)
 */
export function analyzeWorkPattern(
  startTime: string,
  endTime: string,
  daysOn: number,
  commuteMinutes: number = 60,
  jobParams: JobBreaksParams = {}
): {
  results: FatigueIndexResult[];
  maxRisk: number;
  avgRisk: number;
  recommendation: string;
} {
  const shifts: ShiftInput[] = [];
  
  for (let i = 0; i < daysOn; i++) {
    shifts.push({
      day: i + 1,
      startTime,
      endTime,
      commuteMinutes,
    });
  }
  
  const results = calculateFatigueIndex(shifts, jobParams);
  const maxRisk = Math.max(...results.map(r => r.riskIndex));
  const avgRisk = results.reduce((sum, r) => sum + r.riskIndex, 0) / results.length;
  
  let recommendation: string;
  if (maxRisk >= 1.2) {
    recommendation = 'High risk pattern - review shift length and/or consecutive days';
  } else if (maxRisk >= 1.1) {
    recommendation = 'Elevated risk - consider additional breaks or shorter shifts';
  } else if (maxRisk >= 1.0) {
    recommendation = 'Moderate risk - monitor fatigue symptoms';
  } else {
    recommendation = 'Acceptable risk level';
  }
  
  return {
    results,
    maxRisk: Math.round(maxRisk * 1000) / 1000,
    avgRisk: Math.round(avgRisk * 1000) / 1000,
    recommendation,
  };
}
