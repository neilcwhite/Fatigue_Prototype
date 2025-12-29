import { ShiftDefinition, FatigueResult, RiskLevel } from './types';

const CONSTANTS = {
  SLEEP_DECAY_RATE: 0.136934833451947,
  WAKE_DECAY_RATE: 0.686825862760272,
  BASELINE_PVT: 3.9,
  ASYMPTOTE_FACTOR: 0.441596758431994,
  CIRCADIAN_AMPLITUDE: 0.74,
  CIRCADIAN_PHASE: 5.23,
  START_AMPLITUDE: 0.5,
  START_PHASE: 1.25,
  P1: -0.4287,
  P2: 0.1501,
  P3: 0.129,
  P4: 0.0359,
  P5: -0.8012,
  P6: 0.7315,
  c0: -2.28827436527851,
  c1: 11.7995318577367,
  c2: 0.472949055173571,
  c3: -1.77393493516727,
  c4: 0.16244804759197,
  CONST1: 1.826297414,
  CONST2: 1.146457295,
};

function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + minutes / 60;
}

function calculateDuration(startHour: number, endHour: number): number {
  if (endHour > startHour) {
    return endHour - startHour;
  }
  return (24 - startHour) + endHour;
}

function calculateCumulative(dutyIndex: number, shifts: ShiftDefinition[]): number {
  if (dutyIndex === 0) {
    return 0.8885804237312078;
  }

  const currentShift = shifts[dutyIndex];
  const prevShift = shifts[dutyIndex - 1];
  const currStart = parseTime(currentShift.startTime);
  const prevEnd = parseTime(prevShift.endTime);
  const dayGap = currentShift.day - prevShift.day;
  let gap = dayGap * 24 + currStart - prevEnd;
  if (gap < 0) gap += 24;

  const prevCumulative = calculateCumulative(dutyIndex - 1, shifts);
  const recoveryFactor = Math.max(0, 1 - (gap / 24) * 0.3);
  return prevCumulative + 0.047 * recoveryFactor;
}

function calculateTiming(startHour: number, endHour: number, commuteMinutes: number = 60): number {
  const dutyLength = calculateDuration(startHour, endHour);
  const commuteHours = (commuteMinutes - 40) / 60;
  const adjStart = startHour - commuteHours;
  const adjLength = dutyLength + commuteHours;

  const todRisk = 1.0106 + 0.1057 * (Math.sin(Math.PI * endHour / 12) - Math.sin(Math.PI * adjStart / 12)) / (adjLength * Math.PI / 12);

  let shiftRisk: number;
  if (adjLength < 4.25) {
    shiftRisk = 1 + CONSTANTS.P4 + CONSTANTS.P5 * Math.exp(-CONSTANTS.P6 * adjLength);
  } else if (adjLength > 8.13) {
    shiftRisk = 1 + CONSTANTS.P1 + CONSTANTS.P2 * Math.exp(CONSTANTS.P3 * adjLength);
  } else {
    shiftRisk = 1.0;
  }

  return (todRisk * shiftRisk) / 1.288 * 0.997976;
}

function calculateJobBreaks(dutyLength: number, workload: number = 2, attention: number = 1, breakFreq: number = 180, breakLen: number = 30): number {
  let workloadFactor = 0.125 + 0.015 * (workload + attention);
  const avgContinuous = breakFreq;
  const avgBreak = breakLen;

  workloadFactor *= 1.2 * avgContinuous / (avgContinuous + avgBreak);

  const dutyMinutes = dutyLength * 60;
  const numSequences = 1 + Math.floor(dutyMinutes / (avgContinuous + avgBreak) - 0.01);
  const seqLength = Math.floor(0.5 + avgContinuous / 15);
  const breakEffect = 0.24 * Math.exp(-0.395 * (avgBreak - 13.3)) / 0.2388 / (1 + Math.exp(-0.395 * (avgBreak - 13.3)));

  let n = 0, leng = -1, rr = 1, rrTotal = 0;
  do {
    if (leng < seqLength) { leng++; } else { leng = 0; }
    if (leng === 0) { rr = 1 + (rr - 1) * breakEffect; } else { rr = CONSTANTS.CONST1 + (rr - CONSTANTS.CONST1) * Math.exp(-0.25 * CONSTANTS.CONST2); }
    rrTotal += rr;
    n++;
  } while (n <= numSequences * seqLength);

  let riskFactor = rrTotal / n / 1.4858;
  riskFactor += ((workload + attention) - 3) * 0.0232;
  return (riskFactor / 1.032) / 1.0286182;
}

export function getRiskLevel(riskIndex: number): RiskLevel {
  if (riskIndex < 1.0) return { level: 'low', label: 'Low Risk', color: '#22c55e' };
  if (riskIndex < 1.1) return { level: 'moderate', label: 'Moderate', color: '#eab308' };
  if (riskIndex < 1.2) return { level: 'elevated', label: 'Elevated', color: '#f97316' };
  return { level: 'critical', label: 'High Risk', color: '#ef4444' };
}

export function calculateFatigueIndex(shifts: ShiftDefinition[]): FatigueResult[] {
  const results: FatigueResult[] = [];

  for (let i = 0; i < shifts.length; i++) {
    const shift = shifts[i];
    const startHour = parseTime(shift.startTime);
    const endHour = parseTime(shift.endTime);
    const dutyLength = calculateDuration(startHour, endHour);

    const cumulative = calculateCumulative(i, shifts);
    const timing = calculateTiming(startHour, endHour, shift.commuteIn ?? 60);
    const jobBreaks = calculateJobBreaks(dutyLength, shift.workload ?? 2, shift.attention ?? 1, shift.breakFreq ?? 180, shift.breakLen ?? 30);
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