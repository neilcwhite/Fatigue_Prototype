// ============================================
// NETWORK RAIL PERIOD SYSTEM
// 13-period financial year (28 days each)
// Year runs April 1 to March 31
// Week runs Saturday to Friday
// ============================================

import { NetworkRailPeriod } from './types';

// ==================== YEAR START DATES ====================

// April 1st start dates for each financial year
const YEAR_START_DATES: Record<number, string> = {
  2024: '2024-04-01',
  2025: '2025-03-31', // Adjusted for Saturday start
  2026: '2026-03-30',
  2027: '2027-03-29',
  2028: '2028-04-03',
  2029: '2029-04-02',
  2030: '2030-04-01',
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Parse date string without timezone issues
 */
function parseDateLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format date to YYYY-MM-DD string
 */
function formatDateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Add days to a date string
 */
function addDays(dateStr: string, days: number): string {
  const date = parseDateLocal(dateStr);
  date.setDate(date.getDate() + days);
  return formatDateString(date);
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string): string {
  const date = parseDateLocal(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Format date range for display
 */
export function formatDateRange(startDate: string, endDate: string): string {
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

/**
 * Get the Saturday before or on a given date
 */
function getSaturdayBefore(dateStr: string): string {
  const date = parseDateLocal(dateStr);
  const day = date.getDay();
  const diff = day === 6 ? 0 : (day + 1); // Days since Saturday
  date.setDate(date.getDate() - diff);
  return formatDateString(date);
}

// ==================== PERIOD GENERATION ====================

/**
 * Generate Network Rail periods for a given year
 */
export function generateNetworkRailPeriods(year: number): NetworkRailPeriod[] {
  const periods: NetworkRailPeriod[] = [];
  
  // Get the financial year start date
  let yearStart = YEAR_START_DATES[year];
  
  if (!yearStart) {
    // Calculate for unknown years (April 1, adjusted to nearest Saturday)
    yearStart = getSaturdayBefore(`${year}-04-01`);
  }
  
  // Adjust to Saturday if not already
  yearStart = getSaturdayBefore(yearStart);
  
  let currentStart = yearStart;
  
  for (let p = 1; p <= 13; p++) {
    const periodEnd = addDays(currentStart, 27); // 28 days = 27 + start day
    
    periods.push({
      period: p,
      name: `P${p} ${year}/${(year + 1).toString().slice(2)}`,
      startDate: currentStart,
      endDate: periodEnd,
      year,
    });
    
    currentStart = addDays(periodEnd, 1);
  }
  
  return periods;
}

/**
 * Get all dates in a period
 */
export function getPeriodDates(period: NetworkRailPeriod): string[] {
  const dates: string[] = [];
  let current = period.startDate;
  
  while (current <= period.endDate) {
    dates.push(current);
    current = addDays(current, 1);
  }
  
  return dates;
}

/**
 * Get weeks in a period (array of week start dates)
 */
export function getPeriodWeeks(period: NetworkRailPeriod): string[] {
  const weeks: string[] = [];
  let current = period.startDate;
  
  for (let w = 0; w < 4; w++) {
    weeks.push(current);
    current = addDays(current, 7);
  }
  
  return weeks;
}

// ==================== PERIOD LOOKUP ====================

/**
 * Find which period a date falls into
 */
export function findPeriodForDate(dateStr: string, year?: number): NetworkRailPeriod | null {
  const date = new Date(dateStr);
  const checkYears = year ? [year] : [date.getFullYear(), date.getFullYear() - 1];
  
  for (const y of checkYears) {
    const periods = generateNetworkRailPeriods(y);
    
    for (const period of periods) {
      if (dateStr >= period.startDate && dateStr <= period.endDate) {
        return period;
      }
    }
  }
  
  return null;
}

/**
 * Get the current period based on today's date
 */
export function getCurrentPeriod(): NetworkRailPeriod | null {
  const today = new Date().toISOString().split('T')[0];
  return findPeriodForDate(today);
}

/**
 * Get available years for selection
 */
export function getAvailableYears(): number[] {
  return Object.keys(YEAR_START_DATES).map(Number).sort();
}

// ==================== DATE UTILITIES ====================

/**
 * Get day name (Mon, Tue, etc.)
 */
export function getDayName(dateStr: string, short = true): string {
  const date = parseDateLocal(dateStr);
  const days = short
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

/**
 * Get day of week (0 = Sunday, 6 = Saturday)
 */
export function getDayOfWeek(dateStr: string): number {
  return parseDateLocal(dateStr).getDay();
}

/**
 * Check if date is a weekend (Saturday or Sunday)
 */
export function isWeekend(dateStr: string): boolean {
  const day = getDayOfWeek(dateStr);
  return day === 0 || day === 6;
}

/**
 * Get Network Rail week day key (Sat, Sun, Mon, etc.)
 */
export function getNRWeekDayKey(dateStr: string): 'Sat' | 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' {
  const days: Record<number, 'Sat' | 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'> = {
    0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat'
  };
  return days[getDayOfWeek(dateStr)];
}

/**
 * Parse date string to Date object (timezone-safe)
 */
export function parseDate(dateStr: string): Date {
  return parseDateLocal(dateStr);
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
export function toISODateString(date: Date): string {
  return formatDateString(date);
}

/**
 * Get array of dates between start and end (inclusive)
 */
export function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = startDate;
  
  while (current <= endDate) {
    dates.push(current);
    current = addDays(current, 1);
  }
  
  return dates;
}

/**
 * Calculate days between two dates
 */
export function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}
