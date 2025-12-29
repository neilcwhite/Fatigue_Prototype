import { NetworkRailPeriod } from './types';

export function getFinancialYearStart(calendarYear: number): Date {
  return new Date(calendarYear, 3, 1);
}

export function getPeriodForDate(date: Date): NetworkRailPeriod {
  let fyStartYear = date.getFullYear();
  let fyStart = getFinancialYearStart(fyStartYear);

  if (date < fyStart) {
    fyStartYear--;
    fyStart = getFinancialYearStart(fyStartYear);
  }

  const daysSinceFYStart = Math.floor((date.getTime() - fyStart.getTime()) / (1000 * 60 * 60 * 24));
  const periodIndex = Math.floor(daysSinceFYStart / 28);
  const period = Math.min(periodIndex + 1, 13);

  const periodStart = new Date(fyStart);
  periodStart.setDate(periodStart.getDate() + (period - 1) * 28);

  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 27);

  const fyLabel = `${fyStartYear}/${(fyStartYear + 1).toString().slice(-2)}`;

  return { period, year: fyStartYear, startDate: periodStart, endDate: periodEnd, label: `P${period} ${fyLabel}` };
}

export function getPeriodsForFinancialYear(fyStartYear: number): NetworkRailPeriod[] {
  const periods: NetworkRailPeriod[] = [];
  const fyStart = getFinancialYearStart(fyStartYear);

  for (let p = 1; p <= 13; p++) {
    const periodStart = new Date(fyStart);
    periodStart.setDate(periodStart.getDate() + (p - 1) * 28);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 27);
    const fyLabel = `${fyStartYear}/${(fyStartYear + 1).toString().slice(-2)}`;
    periods.push({ period: p, year: fyStartYear, startDate: periodStart, endDate: periodEnd, label: `P${p} ${fyLabel}` });
  }

  return periods;
}

export function getPeriodDateArray(fyStartYear: number, period: number): Date[] {
  const fyStart = getFinancialYearStart(fyStartYear);
  const start = new Date(fyStart);
  start.setDate(start.getDate() + (period - 1) * 28);
  const dates: Date[] = [];
  for (let i = 0; i < 28; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  return dates;
}

export function getDayName(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
}

export function isWeekStart(date: Date): boolean {
  return date.getDay() === 6;
}

export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatDateShort(date: Date): string {
  const day = getDayName(date);
  return `${day} ${date.getDate()}`;
}

export function getCurrentPeriod(): NetworkRailPeriod {
  return getPeriodForDate(new Date());
}