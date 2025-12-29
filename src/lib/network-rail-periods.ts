// ============================================
// NETWORK RAIL PERIOD UTILITIES
// 13-period financial year starting 1 April
// ============================================

import { NetworkRailPeriod } from './types';

/**
 * Get the Network Rail financial year start date for a given calendar year
 * Financial year starts 1 April
 */
export function getFinancialYearStart(calendarYear: number): Date {
  return new Date(calendarYear, 3, 1); // April 1st (month is 0-indexed)
}

/**
 * Get the Network Rail period for a given date
 */
export function getPeriodForDate(date: Date): NetworkRailPeriod {
  // Find which financial year this date is in
  let fyStartYear = date.getFullYear();
  let fyStart = getFinancialYearStart(fyStartYear);
  
  // If date is before April 1st, it's in the previous financial year
  if (date < fyStart) {
    fyStartYear--;
    fyStart = getFinancialYearStart(fyStartYear);
  }
  
  // Calculate days since financial year start
  const daysSinceFYStart = Math.floor((date.getTime() - fyStart.getTime()) / (1000 * 60 * 60 * 24));
  
  // Each period is 28 days
  const periodIndex = Math.floor(daysSinceFYStart / 28);
  const period = Math.min(periodIndex + 1, 13); // Periods 1-13
  
  // Calculate period dates
  const periodStart = new Date(fyStart);
  periodStart.setDate(periodStart.getDate() + (period - 1) * 28);
  
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 27);
  
  // Financial year label (e.g., "2024/25" for FY starting April 2024)
  const fyLabel = `${fyStartYear}/${(fyStartYear + 1).toString().slice(-2)}`;
  
  return {
    period,
    year: fyStartYear,
    startDate: periodStart,
    endDate: periodEnd,
    label: `P${period} ${fyLabel}`,
  };
}

/**
 * Get all periods for a financial year
 */
export function getPeriodsForFinancialYear(fyStartYear: number): NetworkRailPeriod[] {
  const periods: NetworkRailPeriod[] = [];
  const fyStart = getFinancialYearStart(fyStartYear);
  
  for (let p = 1; p <= 13; p++) {
    const periodStart = new Date(fyStart);
    periodStart.setDate(periodStart.getDate() + (p - 1) * 28);
    
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 27);
    
    const fyLabel = `${fyStartYear}/${(fyStartYear + 1).toString().slice(-2)}`;
    
    periods.push({
      period: p,
      year: fyStartYear,
      startDate: periodStart,
      endDate: periodEnd,
      label: `P${p} ${fyLabel}`,
    });
  }
  
  return periods;
}

/**
 * Get the dates for a specific period
 */
export function getPeriodDates(fyStartYear: number, period: number): { start: Date; end: Date } {
  const fyStart = getFinancialYearStart(fyStartYear);
  
  const start = new Date(fyStart);
  start.setDate(start.getDate() + (period - 1) * 28);
  
  const end = new Date(start);
  end.setDate(end.getDate() + 27);
  
  return { start, end };
}

/**
 * Generate array of dates for a period (28 days)
 */
export function getPeriodDateArray(fyStartYear: number, period: number): Date[] {
  const { start } = getPeriodDates(fyStartYear, period);
  const dates: Date[] = [];
  
  for (let i = 0; i < 28; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  
  return dates;
}

/**
 * Get day of week name (Network Rail week: Sat-Fri)
 */
export function getDayName(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
}

/**
 * Check if date is a Saturday (start of Network Rail week)
 */
export function isWeekStart(date: Date): boolean {
  return date.getDay() === 6; // Saturday
}

/**
 * Format date as ISO string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format date for display (e.g., "Mon 15")
 */
export function formatDateShort(date: Date): string {
  const day = getDayName(date);
  return `${day} ${date.getDate()}`;
}

/**
 * Get current Network Rail period
 */
export function getCurrentPeriod(): NetworkRailPeriod {
  return getPeriodForDate(new Date());
}

/**
 * Get available financial years for selection (current ± 2 years)
 */
export function getAvailableFinancialYears(): number[] {
  const currentPeriod = getCurrentPeriod();
  const years: number[] = [];
  
  for (let y = currentPeriod.year - 2; y <= currentPeriod.year + 2; y++) {
    years.push(y);
  }
  
  return years;
}
