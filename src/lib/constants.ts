/**
 * Application Constants
 *
 * Centralised configuration for default values and application settings.
 * These can be overridden via environment variables or organisation settings.
 */

// ==================== DEFAULT SHIFT PATTERNS ====================

/**
 * Default shift times for new patterns
 */
export const DEFAULT_SHIFT = {
  START_TIME: '08:00',
  END_TIME: '17:00',
} as const;

/**
 * Default commute times in minutes
 * These represent typical commute times for Network Rail staff
 */
export const DEFAULT_COMMUTE = {
  /** Standard commute time (minutes) */
  STANDARD: 30,
  /** Extended commute on first day of week (Monday) - allows for travel */
  MONDAY_IN: 90,
  /** Extended commute on last day of week (Friday) - allows for travel home */
  FRIDAY_OUT: 90,
} as const;

/**
 * Network Rail week structure
 * NR weeks run Saturday to Friday for fatigue/compliance purposes
 */
export const NR_WEEK = {
  DAYS: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const,
  /** Day indices in the NR week (0 = Saturday) */
  SATURDAY: 0,
  SUNDAY: 1,
  MONDAY: 2,
  TUESDAY: 3,
  WEDNESDAY: 4,
  THURSDAY: 5,
  FRIDAY: 6,
  /** Rest days for standard Mon-Fri pattern */
  REST_DAYS: [0, 1] as const, // Sat, Sun
} as const;

// ==================== HSE RR446 FATIGUE PARAMETERS ====================

/**
 * Default HSE RR446 fatigue risk assessment parameters
 * All time values are in MINUTES
 */
export const FATIGUE_DEFAULTS = {
  /** Default one-way commute time (minutes) */
  COMMUTE_TIME: 60,
  /** Physical workload rating (1-5 scale) */
  WORKLOAD: 3,
  /** Attention/vigilance requirement (1-5 scale) */
  ATTENTION: 3,
  /** Maximum time between breaks (minutes) - 3 hours */
  BREAK_FREQUENCY: 180,
  /** Standard break duration (minutes) */
  BREAK_LENGTH: 30,
  /** Maximum continuous work before mandated break (minutes) */
  CONTINUOUS_WORK: 180,
  /** Break duration after continuous work period (minutes) */
  BREAK_AFTER_CONTINUOUS: 30,
} as const;

/**
 * FRI (Fatigue Risk Index) thresholds per HSE RR446
 */
export const FRI_THRESHOLDS = {
  /** Below this is low risk (green) */
  LOW: 1.0,
  /** Above LOW, below ELEVATED is moderate risk (yellow) */
  ELEVATED: 1.1,
  /** Above ELEVATED, below CRITICAL is elevated risk (orange) */
  CRITICAL: 1.2,
} as const;

// ==================== COMPLIANCE LIMITS ====================

/**
 * Network Rail NR/L2/OHS/003 compliance limits
 */
export const COMPLIANCE = {
  /** Maximum single shift duration (hours) */
  MAX_SHIFT_HOURS: 12,
  /** Minimum rest between shifts (hours) */
  MIN_REST_HOURS: 12,
  /** Maximum hours in any rolling 7-day period */
  MAX_WEEKLY_HOURS: 72,
  /** Maximum consecutive working days */
  MAX_CONSECUTIVE_DAYS: 13,
  /** Maximum consecutive night shifts */
  MAX_CONSECUTIVE_NIGHTS: 7,
  /** Warning threshold for weekly hours */
  APPROACHING_WEEKLY_HOURS: 66,
  /** Warning threshold for consecutive nights */
  CONSECUTIVE_NIGHTS_WARNING: 4,
  /** Warning threshold for consecutive days */
  CONSECUTIVE_DAYS_WARNING: 6,
  /** Night shift start hour (24h) */
  NIGHT_START_HOUR: 20,
  /** Night shift end hour (24h) */
  NIGHT_END_HOUR: 6,
} as const;

// ==================== UI/UX SETTINGS ====================

/**
 * Sidebar dimensions
 */
export const SIDEBAR = {
  EXPANDED_WIDTH: 220,
  COLLAPSED_WIDTH: 64,
} as const;

/**
 * Risk level colors (matching Tailwind palette)
 */
export const RISK_COLORS = {
  LOW: '#22c55e',      // green-500
  MODERATE: '#eab308', // yellow-500
  ELEVATED: '#f97316', // orange-500
  CRITICAL: '#ef4444', // red-500
} as const;

/**
 * Application metadata
 */
export const APP_META = {
  NAME: 'ShiftAdmin',
  VERSION: '2.1.0',
  DESCRIPTION: 'Network Rail Fatigue Management System',
} as const;

// ==================== HELPER FUNCTIONS ====================

/**
 * Get commute time for a specific day
 * @param nrDayIndex - Day index in NR week (0 = Saturday)
 * @param direction - 'in' or 'out'
 * @returns Commute time in minutes
 */
export function getCommuteForDay(nrDayIndex: number, direction: 'in' | 'out'): number {
  if (direction === 'in' && nrDayIndex === NR_WEEK.MONDAY) {
    return DEFAULT_COMMUTE.MONDAY_IN;
  }
  if (direction === 'out' && nrDayIndex === NR_WEEK.FRIDAY) {
    return DEFAULT_COMMUTE.FRIDAY_OUT;
  }
  return DEFAULT_COMMUTE.STANDARD;
}

/**
 * Check if a day index is a rest day in the standard pattern
 * @param nrDayIndex - Day index in NR week (0 = Saturday)
 */
export function isStandardRestDay(nrDayIndex: number): boolean {
  return NR_WEEK.REST_DAYS.includes(nrDayIndex as 0 | 1);
}

/**
 * Convert NR day index to shift day number (1-7)
 * @param nrDayIndex - Day index in NR week (0 = Saturday)
 */
export function nrDayToShiftDay(nrDayIndex: number): number {
  return nrDayIndex + 1;
}
