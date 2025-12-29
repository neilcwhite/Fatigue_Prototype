import { NetworkRailPeriod } from './types';

// ==================== CONSTANTS ====================

export const NETWORK_RAIL_YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
export const PERIODS_PER_YEAR = 13;
export const DAYS_PER_PERIOD = 28;

// Network Rail financial year starts first Saturday of April
// Each period is exactly 28 days (4 weeks)

// ==================== PERIOD GENERATION ====================

/**
 * Get the start date of a Network Rail financial year
 * The financial year starts on the first Saturday of April
 */
export function getFinancialYearStart(year: number): Date {
  const april1 = new Date(year, 3, 1); // April 1st
  const dayOfWeek = april1.getDay();
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
  const firstSaturday = new Date(year, 3, 1 + daysUntilSaturday);
  return firstSaturday;
}

/**
 * Generate all 13 periods for a Network Rail financial year
 */
export function getPeriodsForFinancialYear(year: number): NetworkRailPeriod[] {
  const periods: NetworkRailPeriod[] = [];
  const yearStart = getFinancialYearStart(year);

  for (let i = 0; i < PERIODS_PER_YEAR; i++) {
    const periodStart = new Date(yearStart);
    periodStart.setDate(yearStart.getDate() + (i * DAYS_PER_PERIOD));
    
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodStart.getDate() + DAYS_PER_PERIOD - 1);

    const startStr = formatDateShort(periodStart);
    const endStr = formatDateShort(periodEnd);

    periods.push({
      year,
      period: i + 1,
      label: `P${i + 1} (${startStr} - ${endStr})`,
      startDate: periodStart,
      endDate: periodEnd,
    });
  }

  return periods;
}

/**
 * Get a specific period
 */
export function getPeriod(year: number, period: number): NetworkRailPeriod | null {
  const periods = getPeriodsForFinancialYear(year);
  return periods.find(p => p.period === period) || null;
}

/**
 * Get the current Network Rail period based on today's date
 */
export function getCurrentPeriod(): NetworkRailPeriod {
  const today = new Date();
  
  for (const year of NETWORK_RAIL_YEARS) {
    const periods = getPeriodsForFinancialYear(year);
    for (const period of periods) {
      if (today >= period.startDate && today <= period.endDate) {
        return period;
      }
    }
  }

  // Default to first period of current calendar year if not found
  const currentYear = today.getFullYear();
  const periods = getPeriodsForFinancialYear(currentYear);
  return periods[0];
}

/**
 * Get all dates within a period as an array
 */
export function getPeriodDateArray(year: number, period: number): Date[] {
  const periodData = getPeriod(year, period);
  if (!periodData) return [];

  const dates: Date[] = [];
  const current = new Date(periodData.startDate);
  
  while (current <= periodData.endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Check if a date falls within a specific period
 */
export function isDateInPeriod(date: Date, year: number, period: number): boolean {
  const periodData = getPeriod(year, period);
  if (!periodData) return false;
  return date >= periodData.startDate && date <= periodData.endDate;
}

/**
 * Find which period a date belongs to
 */
export function findPeriodForDate(date: Date): NetworkRailPeriod | null {
  for (const year of NETWORK_RAIL_YEARS) {
    const periods = getPeriodsForFinancialYear(year);
    for (const period of periods) {
      if (date >= period.startDate && date <= period.endDate) {
        return period;
      }
    }
  }
  return null;
}

// ==================== DATE FORMATTING ====================

/**
 * Format date as DD MMM (e.g., "01 Apr")
 */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/**
 * Format date as ISO string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format date as DD/MM/YYYY
 */
export function formatDateUK(date: Date): string {
  return date.toLocaleDateString('en-GB');
}

/**
 * Get short day name (Mon, Tue, etc.)
 */
export function getDayName(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short' });
}

/**
 * Get full day name (Monday, Tuesday, etc.)
 */
export function getDayNameFull(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'long' });
}

/**
 * Parse ISO date string to Date object
 */
export function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

// ==================== DATE CALCULATIONS ====================

/**
 * Get the start of the week (Monday) for a given date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

/**
 * Get the end of the week (Sunday) for a given date
 */
export function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

/**
 * Calculate rolling 7-day date range ending on given date
 */
export function getRolling7Days(endDate: Date): { start: Date; end: Date } {
  const end = new Date(endDate);
  const start = new Date(endDate);
  start.setDate(end.getDate() - 6);
  return { start, end };
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get number of days between two dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date2.getTime() - date1.getTime()) / oneDay));
}

// ==================== WEEK IDENTIFICATION ====================

/**
 * Check if a date is a Saturday (Network Rail week start)
 */
export function isWeekStart(date: Date): boolean {
  return date.getDay() === 6;
}

/**
 * Check if a date is a Friday (Network Rail week end)
 */
export function isWeekEnd(date: Date): boolean {
  return date.getDay() === 5;
}

/**
 * Get the Network Rail week number within a period (1-4)
 */
export function getWeekInPeriod(date: Date, year: number, period: number): number {
  const periodData = getPeriod(year, period);
  if (!periodData) return 0;
  
  const daysSinceStart = daysBetween(periodData.startDate, date);
  return Math.floor(daysSinceStart / 7) + 1;
}
