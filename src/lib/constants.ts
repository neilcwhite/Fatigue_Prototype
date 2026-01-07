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
 * Values matched to NR Excel tool VBA defaults
 */
export const FATIGUE_DEFAULTS = {
  /** Default one-way commute time (minutes) - VBA default is 40 */
  COMMUTE_TIME: 40,
  /** Physical workload rating (1-4 scale: 1=most demanding, 4=least) */
  WORKLOAD: 2,
  /** Attention/vigilance requirement (1-4 scale: 1=most demanding, 4=least) - VBA default maps to 3 */
  ATTENTION: 3,
  /** How frequently rest breaks are typically provided/taken (minutes) - 3 hours */
  BREAK_FREQUENCY: 180,
  /** Average length of rest breaks (minutes) */
  BREAK_LENGTH: 15,
  /** Longest period of continuous work before a break (minutes) - VBA default is 6 hours */
  CONTINUOUS_WORK: 360,
  /** Length of break after longest continuous work period (minutes) */
  BREAK_AFTER_CONTINUOUS: 30,
} as const;

/**
 * FRI (Fatigue Risk Index) thresholds per HSE RR446 and NR/L2/OHS/003
 */
export const FRI_THRESHOLDS = {
  /** Below this is low risk (green) */
  LOW: 1.0,
  /** Above LOW, below ELEVATED is moderate risk (yellow) */
  ELEVATED: 1.1,
  /** Above ELEVATED, below CRITICAL is elevated risk (orange) */
  CRITICAL: 1.2,

  /** Network Rail NR/L2/OHS/003 compliance thresholds */
  /** Fatigue score threshold for daytime hours (Module 1, Section 4.3) */
  FATIGUE_SCORE_DAYTIME: 35,
  /** Fatigue score threshold for nighttime hours (Module 1, Section 4.3) */
  FATIGUE_SCORE_NIGHTTIME: 45,
  /** Risk score threshold regardless of time of day (Module 1, Section 4.3) */
  RISK_SCORE_LIMIT: 1.6,
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

// ==================== ORGANISATION & AUTH SETTINGS ====================

/**
 * Allowed email domains and their corresponding organisation details.
 * Users can only sign up with email addresses from these domains.
 * Each domain maps to a specific organisation ID and name.
 *
 * To add a new organisation:
 * 1. Create the organisation in Supabase with a known UUID
 * 2. Add the domain mapping here
 */
export const ALLOWED_DOMAINS: Record<string, { organisationId: string; organisationName: string }> = {
  'thespencergroup.co.uk': {
    organisationId: 'bb74dd23-9959-4f7a-a315-d8b15fe1db25',
    organisationName: 'The Spencer Group',
  },
  // Add more domains as needed:
  // 'example.com': {
  //   organisationId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  //   organisationName: 'Example Company',
  // },
};

/**
 * Get the list of allowed email domains for display
 */
export function getAllowedDomainsList(): string[] {
  return Object.keys(ALLOWED_DOMAINS);
}

/**
 * Check if an email domain is allowed for signup
 * @param email - The email address to check
 * @returns The organisation mapping if allowed, null otherwise
 */
export function getOrganisationForEmail(email: string): { organisationId: string; organisationName: string } | null {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;
  return ALLOWED_DOMAINS[domain] || null;
}

/**
 * Validate if an email is from an allowed domain
 * @param email - The email address to check
 */
export function isEmailDomainAllowed(email: string): boolean {
  return getOrganisationForEmail(email) !== null;
}

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
 * Compliance status colors (4-tier NR system)
 * - OK: Green - fully compliant
 * - LEVEL1: Yellow - Level 1 exceedance (60-72h), requires risk assessment
 * - LEVEL2: Amber/Orange - Level 2 exceedance (72h+), requires risk assessment
 * - BREACH: Red - hard breach, stop working immediately
 */
export const COMPLIANCE_COLORS = {
  OK: '#22c55e',       // green-500 - compliant
  LEVEL1: '#eab308',   // yellow-500 - Level 1 exceedance
  LEVEL2: '#f97316',   // orange-500 - Level 2 exceedance
  BREACH: '#ef4444',   // red-500 - hard breach
} as const;

/**
 * Compliance status background colors (lighter variants for cards/cells)
 */
export const COMPLIANCE_BG_COLORS = {
  OK: '#dcfce7',       // green-100
  LEVEL1: '#fef9c3',   // yellow-100
  LEVEL2: '#ffedd5',   // orange-100
  BREACH: '#fee2e2',   // red-100
} as const;

/**
 * Application metadata
 */
export const APP_META = {
  NAME: 'HerdWatch',
  VERSION: '2.1.0',
  DESCRIPTION: 'Workforce Fatigue Management',
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
