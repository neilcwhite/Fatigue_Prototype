// ============================================
// FATIGUE ASSESSMENT AND MITIGATION PLAN (FAMP) CONSTANTS
// Based on Network Rail NR/L2/OHS/003 standard
// ============================================

import type {
  FAMPAssessmentReason,
  FAMPQuestionId,
  FAMPRiskLevel,
  FAMPExceedanceLevel,
  FAMPMitigation,
  FAMPQuestionAnswer,
  ViolationType,
} from './types';

// ==================== PART 2: ASSESSMENT REASONS ====================

export interface AssessmentReasonOption {
  id: FAMPAssessmentReason;
  label: string;
  description: string;
  autoRisk?: FAMPRiskLevel;  // If selecting this auto-sets a minimum risk level
}

export const ASSESSMENT_REASONS: AssessmentReasonOption[] = [
  {
    id: 'more_than_12_hours_shift',
    label: 'More than 12 hours in one shift/period of duty',
    description: 'Single shift exceeds 12 hours duration',
  },
  {
    id: 'less_than_12_hours_rest',
    label: 'Less than 12 hours break between shifts/periods of duty',
    description: 'Insufficient rest period between consecutive shifts',
  },
  {
    id: 'door_to_door_14_hours',
    label: '14 hours or more door to door',
    description: 'Total time from leaving home to returning exceeds 14 hours',
  },
  {
    id: 'more_than_13_days_in_14',
    label: 'More than 13 days or nights in 14 rolling days',
    description: 'Excessive consecutive working days',
  },
  {
    id: 'daytime_fri_35_plus',
    label: 'Day time fatigue score (FGI) of 35 or more',
    description: 'Elevated fatigue index during daytime shift',
  },
  {
    id: 'nighttime_fri_45_plus',
    label: 'Night time fatigue score (FGI) of 45 or more',
    description: 'Elevated fatigue index during nighttime shift',
  },
  {
    id: 'fri_risk_score_1_6_plus',
    label: 'Risk score (FRI) of 1.6 or more',
    description: 'Fatigue Risk Index exceeds threshold',
  },
  {
    id: 'on_call_work',
    label: 'Worked as a result of being On-Call',
    description: 'Does not include being on stand-by with no call-out during shift',
  },
  {
    id: 'fatigue_concern_self',
    label: 'Fatigue concern raised by Person being Assessed',
    description: 'Employee has self-reported fatigue concerns',
  },
  {
    id: 'fatigue_concern_others',
    label: 'Fatigue concern raised by Others',
    description: 'Colleagues or supervisors have raised fatigue concerns',
  },
  {
    id: 'more_than_72_hours_weekly',
    label: 'More than 72 hours in 7 rolling days',
    description: 'If Yes, automatically a High Fatigue Risk',
    autoRisk: 'HIGH',
  },
  {
    id: 'more_than_60_hours_weekly',
    label: 'More than 60 hours in 7 rolling days',
    description: 'If Yes, at least a Medium Fatigue Risk',
    autoRisk: 'MEDIUM',
  },
];

// Map violation types to assessment reasons
export const VIOLATION_TO_REASON_MAP: Partial<Record<ViolationType, FAMPAssessmentReason>> = {
  'MAX_SHIFT_LENGTH': 'more_than_12_hours_shift',
  'INSUFFICIENT_REST': 'less_than_12_hours_rest',
  'LEVEL_1_EXCEEDANCE': 'more_than_60_hours_weekly',
  'LEVEL_2_EXCEEDANCE': 'more_than_72_hours_weekly',
  'ELEVATED_FATIGUE_INDEX': 'fri_risk_score_1_6_plus',
  'MAX_CONSECUTIVE_DAYS': 'more_than_13_days_in_14',
  'MAX_CONSECUTIVE_NIGHTS': 'more_than_13_days_in_14',
};

// ==================== PART 3: ASSESSMENT QUESTIONS ====================

export interface AssessmentQuestionOption {
  value: string;
  label: string;
  score: number;
}

export interface AssessmentQuestion {
  id: FAMPQuestionId;
  number: number;
  question: string;
  options: AssessmentQuestionOption[];
}

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'hours_worked_today',
    number: 1,
    question: 'Hours Worked Today / This Shift',
    options: [
      { value: 'under_3_day', label: 'Less than 3 hours (if working days)', score: 1 },
      { value: '3_to_6_day_or_under_3_night', label: '3-6 hours (if working days) / less than 3 hours (if working nights)', score: 3 },
      { value: 'over_6_day_or_over_3_night', label: 'Over 6 hours (if working days) / over 3 hours (if working nights)', score: 5 },
    ],
  },
  {
    id: 'physical_activity_level',
    number: 2,
    question: 'Type of task being undertaken - Level of Physical Activity',
    options: [
      { value: 'low', label: 'Low', score: 1 },
      { value: 'medium', label: 'Medium', score: 3 },
      { value: 'high', label: 'High', score: 5 },
    ],
  },
  {
    id: 'concentration_required',
    number: 3,
    question: 'Type of task being undertaken - Level of Concentration',
    options: [
      { value: 'low', label: 'Low', score: 1 },
      { value: 'medium', label: 'Medium', score: 3 },
      { value: 'high', label: 'High', score: 5 },
    ],
  },
  {
    id: 'hours_left_in_shift',
    number: 4,
    question: 'Number of hours left to work today/tonight/this shift',
    options: [
      { value: 'under_2', label: 'Less than 2 hours', score: 1 },
      { value: '2_to_4', label: '2-4 hours', score: 3 },
      { value: 'over_4', label: 'Over 4 hours', score: 5 },
    ],
  },
  {
    id: 'remaining_activity_type',
    number: 5,
    question: 'Type of Activity planned for remaining hours',
    options: [
      { value: 'low', label: 'Low physical and/or concentration required', score: 1 },
      { value: 'medium', label: 'Medium physical and/or concentration required', score: 3 },
      { value: 'high', label: 'High physical and/or concentration required', score: 5 },
    ],
  },
  {
    id: 'breaks_and_refreshment',
    number: 6,
    question: 'Last break / refreshment',
    options: [
      { value: 'good_break_with_food', label: 'At least 20 minutes break/rest (or several breaks) in the last 6 hours and had a drink, snack or meal', score: 0 },
      { value: 'good_break_no_food', label: 'At least 20 mins break/rest in the last 6 hours but NO drink/snack', score: 1 },
      { value: 'short_break_with_food', label: 'Less than 20 minutes break in the last 6 hours and had a drink and snack', score: 3 },
      { value: 'short_break_no_food', label: 'Less than 20 minutes break in the last 6 hours and NO drink or snack', score: 5 },
    ],
  },
  {
    id: 'sleep_duration_24h',
    number: 7,
    question: 'Duration of sleep within the last 24 hours',
    options: [
      { value: '8_plus', label: '8 hours or more', score: 0 },
      { value: '6_to_8', label: '6-8 hours', score: 1 },
      { value: 'under_6', label: 'Under 6 hours', score: 3 },
      { value: 'no_sleep', label: 'No sleep (Note: Scored to reflect certainty of fatigue)', score: 40 },
    ],
  },
  {
    id: 'sleep_quality_24h',
    number: 8,
    question: 'Quality of sleep within the last 24 hours',
    options: [
      { value: 'no_disturbance', label: 'No disturbance. Slept straight through', score: 0 },
      { value: 'disturbed_back_to_sleep', label: 'Disturbed sleep but dropped back off', score: 3 },
      { value: 'disturbed_no_return', label: 'Disturbed sleep and could not get back to sleep', score: 5 },
    ],
  },
  {
    id: 'food_and_drink',
    number: 9,
    question: 'Food and drink today/this shift',
    options: [
      { value: 'healthy', label: 'Drank and ate healthily (at least a litre of water / healthy snacks / fruit or veg / balanced meals containing protein and carbohydrates)', score: 1 },
      { value: 'moderate', label: 'Drank and ate but not too healthily (some drinks and snacks / not balanced meals / acknowledges that recent food and drink could be healthier)', score: 3 },
      { value: 'unhealthy', label: 'Drank and ate unhealthily (high sugar, high caffeine and/or high calorie content / snacks rather than meals / less than 1 litre of water)', score: 5 },
    ],
  },
  {
    id: 'time_between_shifts',
    number: 10,
    question: 'Time between shifts',
    options: [
      { value: 'over_24', label: 'More than 24 hours', score: 1 },
      { value: '12_to_24', label: '12-24 hours', score: 3 },
      { value: 'under_12', label: 'Less than 12 hours', score: 5 },
    ],
  },
  {
    id: 'shift_type',
    number: 11,
    question: 'Type of shift',
    options: [
      { value: 'daytime', label: 'Daytime (between 06:00hrs - 20:00hrs)', score: 1 },
      { value: 'nighttime', label: 'Night Time (between 20:00hrs - 06:00hrs)', score: 3 },
      { value: 'straddles', label: 'Shift straddles (day/night transition)', score: 5 },
    ],
  },
  {
    id: 'fri_score_end_shift',
    number: 12,
    question: 'FRI score at end of current shift',
    options: [
      { value: 'low', label: 'Less than 25 (day) / 35 (night)', score: 1 },
      { value: 'moderate', label: '25-30 (day) / 35-40 (night)', score: 3 },
      { value: 'high', label: 'In excess of 40 (night) / 30 (day) OR No FRI score available', score: 5 },
    ],
  },
  {
    id: 'drive_time_home',
    number: 13,
    question: 'Drive between work location and home (The time it took even if this is temporary)',
    options: [
      { value: 'no_driving', label: 'No driving (inc. any motor vehicle or bicycle)', score: 0 },
      { value: 'under_45', label: 'Under 45 mins', score: 1 },
      { value: '45_to_75', label: 'More than 45 mins, but less than 75 mins', score: 3 },
      { value: 'over_75', label: 'Over 75 mins', score: 5 },
    ],
  },
];

// ==================== PART 4: RISK MATRIX ====================

export interface RiskMatrixResult {
  riskLevel: FAMPRiskLevel;
  source: 'score' | 'exceedance' | 'auto_reason';
  description: string;
}

/**
 * Calculate risk level based on total score, exceedance level, and assessment reasons
 * Following the guidance from the FAMP form:
 * - Score 9-19: LOW
 * - Score 20-39: MEDIUM
 * - Score 40-65: HIGH
 * - Level 1 Exceedance: MEDIUM (unless score puts it in HIGH)
 * - Level 2 Exceedance: HIGH
 * - More than 72h weekly: AUTO HIGH
 * - More than 60h weekly: AUTO MEDIUM (minimum)
 */
export function calculateRiskLevel(
  totalScore: number,
  exceedanceLevel: FAMPExceedanceLevel,
  assessmentReasons: FAMPAssessmentReason[]
): RiskMatrixResult {
  // Check for auto-HIGH reasons
  if (assessmentReasons.includes('more_than_72_hours_weekly')) {
    return {
      riskLevel: 'HIGH',
      source: 'auto_reason',
      description: 'More than 72 hours in 7 rolling days automatically triggers HIGH risk',
    };
  }

  // Check for Level 2 exceedance
  if (exceedanceLevel === 'level2') {
    return {
      riskLevel: 'HIGH',
      source: 'exceedance',
      description: 'Level 2 Exceedance automatically triggers HIGH risk',
    };
  }

  // Calculate risk from score
  let scoreRisk: FAMPRiskLevel;
  if (totalScore >= 40) {
    scoreRisk = 'HIGH';
  } else if (totalScore >= 20) {
    scoreRisk = 'MEDIUM';
  } else {
    scoreRisk = 'LOW';
  }

  // Check for auto-MEDIUM reasons (60+ hours)
  const hasAutoMedium = assessmentReasons.includes('more_than_60_hours_weekly');

  // Check for Level 1 exceedance
  const hasLevel1 = exceedanceLevel === 'level1';

  // If score is HIGH, that takes precedence
  if (scoreRisk === 'HIGH') {
    return {
      riskLevel: 'HIGH',
      source: 'score',
      description: `Fatigue Risk Score of ${totalScore} (40-65 range) indicates HIGH risk`,
    };
  }

  // Level 1 exceedance or 60+ hours means at least MEDIUM
  if (hasLevel1 || hasAutoMedium) {
    // But if score is already MEDIUM or higher, use that
    if (scoreRisk === 'MEDIUM') {
      return {
        riskLevel: 'MEDIUM',
        source: 'score',
        description: `Fatigue Risk Score of ${totalScore} (20-39 range) indicates MEDIUM risk`,
      };
    }
    // Score is LOW but we have Level 1 or 60+ hours
    return {
      riskLevel: 'MEDIUM',
      source: hasLevel1 ? 'exceedance' : 'auto_reason',
      description: hasLevel1
        ? 'Level 1 Exceedance requires minimum MEDIUM risk'
        : 'More than 60 hours in 7 rolling days requires minimum MEDIUM risk',
    };
  }

  // Just score-based
  return {
    riskLevel: scoreRisk,
    source: 'score',
    description: scoreRisk === 'MEDIUM'
      ? `Fatigue Risk Score of ${totalScore} (20-39 range) indicates MEDIUM risk`
      : `Fatigue Risk Score of ${totalScore} (9-19 range) indicates LOW risk`,
  };
}

/**
 * Calculate total score from assessment answers
 */
export function calculateTotalScore(answers: FAMPQuestionAnswer[]): number {
  return answers.reduce((sum, answer) => sum + answer.score, 0);
}

// ==================== PART 5: MITIGATIONS ====================

export interface MitigationOption {
  id: FAMPMitigation;
  label: string;
  description?: string;
  requiredFor: FAMPRiskLevel[];  // Which risk levels require this mitigation
  isAdditionalControl?: boolean;  // Part of the "Additional Controls" section
}

export const MITIGATION_OPTIONS: MitigationOption[] = [
  // HIGH risk mandatory mitigations
  {
    id: 'no_lookout_duties',
    label: 'No lookout duties',
    requiredFor: ['HIGH', 'MEDIUM'],
  },
  {
    id: 'no_individual_working_alone',
    label: 'No Individual working alone',
    requiredFor: ['HIGH', 'MEDIUM'],
  },
  {
    id: 'no_safety_critical_duties',
    label: 'No safety critical duties',
    description: 'For MEDIUM risk: without additional controls',
    requiredFor: ['HIGH'],
  },
  {
    id: 'no_management_of_trains',
    label: 'No management of trains',
    requiredFor: ['HIGH'],
  },
  {
    id: 'no_driving_duties',
    label: 'No driving duties',
    requiredFor: ['HIGH', 'MEDIUM'],
  },
  {
    id: 'no_otp_operation',
    label: 'No OTP operation',
    requiredFor: ['HIGH'],
  },
  {
    id: 'no_otm_operation',
    label: 'No OTM operation',
    requiredFor: ['HIGH'],
  },
  {
    id: 'relieve_from_duty',
    label: 'Relieve from duty at the earliest opportunity',
    requiredFor: ['HIGH'],
  },
  {
    id: 'minimum_24_hours_rest',
    label: 'Minimum of 24 hours rest before next period of work',
    requiredFor: ['HIGH'],
  },
  {
    id: 'minimum_12_hours_rest',
    label: 'Minimum 12 hours rest before next period of work',
    requiredFor: ['MEDIUM'],
  },
  // Additional controls (can be applied to any risk level)
  {
    id: 'additional_meal_rest_breaks',
    label: 'Additional meal/rest breaks within-shift',
    requiredFor: [],
    isAdditionalControl: true,
  },
  {
    id: 'change_scheduled_work',
    label: 'Change in scheduled work to reduce workload stress',
    requiredFor: [],
    isAdditionalControl: true,
  },
  {
    id: 'rotation_of_activity',
    label: 'Rotation of activity within shift to reduce boredom',
    requiredFor: [],
    isAdditionalControl: true,
  },
  {
    id: 'additional_supervision',
    label: 'Additional supervision by managers on site for shifts where the risk is higher',
    requiredFor: [],
    isAdditionalControl: true,
  },
  {
    id: 'reduction_in_shift_length',
    label: 'Reduction in shift length',
    requiredFor: [],
    isAdditionalControl: true,
  },
  {
    id: 'provision_of_accommodation',
    label: 'Provision of accommodation',
    requiredFor: [],
    isAdditionalControl: true,
  },
  {
    id: 'provision_of_rested_drivers',
    label: 'Provision of (rested) drivers / use public transport',
    requiredFor: [],
    isAdditionalControl: true,
  },
  {
    id: 'share_driving_duties',
    label: 'Share driving duties / rest before driving',
    requiredFor: [],
    isAdditionalControl: true,
  },
  {
    id: 'use_local_staff',
    label: 'Use of local staff rather than those having to travel long distances to site',
    requiredFor: [],
    isAdditionalControl: true,
  },
  {
    id: 'other',
    label: 'Other (specify in notes)',
    requiredFor: [],
    isAdditionalControl: true,
  },
];

/**
 * Get required mitigations for a given risk level
 */
export function getRequiredMitigations(riskLevel: FAMPRiskLevel): MitigationOption[] {
  return MITIGATION_OPTIONS.filter(
    m => m.requiredFor.includes(riskLevel) && !m.isAdditionalControl
  );
}

/**
 * Get additional control options
 */
export function getAdditionalControls(): MitigationOption[] {
  return MITIGATION_OPTIONS.filter(m => m.isAdditionalControl);
}

// ==================== RISK LEVEL COLORS ====================

export const FAMP_RISK_COLORS: Record<FAMPRiskLevel, { bg: string; text: string; border: string }> = {
  LOW: { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
  MEDIUM: { bg: '#fef3c7', text: '#92400e', border: '#eab308' },
  HIGH: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
};

export const FAMP_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_employee: 'Awaiting Employee Acceptance',
  pending_manager: 'Awaiting Manager Approval',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
