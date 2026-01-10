// ============================================
// FATIGUE MANAGEMENT SYSTEM - SHARED UTILITIES
// ============================================

import type { RiskLevel, ViolationType } from './types';
import { COMPLIANCE_LIMITS } from './compliance';

// ==================== FRI COLOUR CONSTANTS ====================
// Standardized colours for Fatigue Risk Index display across all components
// FRI Thresholds per NR/L2/OHS/003: ≤1.6 (Green/OK), >1.6 (Red/Breach)

export const FRI_COLORS = {
  // Solid backgrounds with white text - for chips, badges, small UI elements
  solid: {
    ok: 'bg-green-600 text-white',
    breach: 'bg-red-600 text-white',
    unknown: 'bg-slate-500 text-white',
  },
  // Light backgrounds with dark text - for cards, larger areas
  light: {
    ok: 'bg-green-100 text-green-800 border-green-300',
    breach: 'bg-red-100 text-red-800 border-red-300',
    unknown: 'bg-slate-100 text-slate-800 border-slate-300',
  },
} as const;

// ==================== RISK COLORS ====================

/**
 * Get CSS classes for FRI chip/badge display (solid background, white text)
 * Use for: calendar chips, FRI badges, small indicators
 * Per NR/L2/OHS/003: ≤1.6 = OK (GREEN), >1.6 = BREACH (RED)
 */
export function getFRIChipColor(fri: number | null): string {
  if (fri === null) return FRI_COLORS.solid.unknown;
  if (fri > 1.6) return FRI_COLORS.solid.breach;
  return FRI_COLORS.solid.ok;
}

/**
 * Get CSS classes for FRI card/area display (light background, dark text)
 * Use for: summary cards, larger display areas
 * Per NR/L2/OHS/003: ≤1.6 = OK (GREEN), >1.6 = BREACH (RED)
 */
export function getFRICardColor(fri: number | null): string {
  if (fri === null) return FRI_COLORS.light.unknown;
  if (fri > 1.6) return FRI_COLORS.light.breach;
  return FRI_COLORS.light.ok;
}

/**
 * Get human-readable risk level label from FRI value
 * Per NR/L2/OHS/003: ≤1.6 = OK, >1.6 = BREACH
 */
export function getFRILevel(fri: number): string {
  if (fri > 1.6) return 'Breach';
  return 'OK';
}

/**
 * Get CSS classes for FGI chip/badge display (solid background, white text)
 * FGI (Fatigue Index 0-100) thresholds per NR/L2/OHS/003:
 * - ≤Good Practice (30 day/40 night) = OK (GREEN)
 * - >Good Practice but ≤Level 2 = Advisory (GREEN) - informational only
 * - >Level 2 (35 day/45 night) = Requires FARP (YELLOW/AMBER)
 */
export function getFGIChipColor(fgi: number | null, isNight: boolean = false): string {
  if (fgi === null) return 'bg-slate-500 text-white';
  const level2Threshold = isNight ? 45 : 35;
  if (fgi > level2Threshold) return 'bg-yellow-500 text-white'; // Level 2 - requires FARP
  return 'bg-green-600 text-white'; // OK (includes Good Practice advisory)
}

/**
 * Get CSS classes for FGI card/area display (light background, dark text)
 * FGI (Fatigue Index 0-100) thresholds per NR/L2/OHS/003:
 * - ≤Good Practice (30 day/40 night) = OK (GREEN)
 * - >Good Practice but ≤Level 2 = Advisory (LIGHT GREEN) - informational only
 * - >Level 2 (35 day/45 night) = Requires FARP (YELLOW/AMBER)
 */
export function getFGICardColor(fgi: number | null, isNight: boolean = false): string {
  if (fgi === null) return 'bg-slate-100 text-slate-800 border-slate-300';
  const goodPracticeThreshold = isNight ? 40 : 30;
  const level2Threshold = isNight ? 45 : 35;

  if (fgi > level2Threshold) return 'bg-yellow-100 text-yellow-800 border-yellow-300'; // Level 2 - requires FARP
  if (fgi > goodPracticeThreshold) return 'bg-lime-100 text-lime-800 border-lime-300'; // Good Practice advisory (light green)
  return 'bg-green-100 text-green-800 border-green-300'; // OK
}

/**
 * Get human-readable FGI level label
 * Per NR/L2/OHS/003: ≤Level 2 = OK, >Level 2 = Requires FARP
 */
export function getFGILevel(fgi: number, isNight: boolean = false): string {
  const goodPracticeThreshold = isNight ? 40 : 30;
  const level2Threshold = isNight ? 45 : 35;

  if (fgi > level2Threshold) return 'Level 2 - FARP Required';
  if (fgi > goodPracticeThreshold) return 'Good Practice Advisory';
  return 'OK';
}

/**
 * Get CSS classes for risk level display (with border)
 * Used in FatigueView for displaying risk cards
 * @deprecated Use getFRICardColor or getFGICardColor instead
 */
export function getRiskColor(level: RiskLevel['level'] | string): string {
  switch (level) {
    case 'low': return FRI_COLORS.light.ok;
    case 'moderate': return FRI_COLORS.light.ok;
    case 'elevated': return FRI_COLORS.light.ok;
    case 'critical': return FRI_COLORS.light.breach;
    default: return FRI_COLORS.light.unknown;
  }
}

/**
 * Get solid background color class for risk level
 * @deprecated Use getFRIChipColor or getFGIChipColor instead
 */
export function getRiskBgColor(level: RiskLevel['level'] | string): string {
  switch (level) {
    case 'low': return 'bg-green-600';
    case 'moderate': return 'bg-green-600';
    case 'elevated': return 'bg-green-600';
    case 'critical': return 'bg-red-600';
    default: return 'bg-slate-500';
  }
}

// ==================== VIOLATION UTILITIES ====================

interface ViolationMetadata {
  label: string;
  icon: string;
  color: string;
  description: string;
}

/**
 * Get metadata for compliance violation types
 * Used for consistent violation display across components
 * Values reference COMPLIANCE_LIMITS from compliance.ts for consistency
 */
export function getViolationMetadata(type: ViolationType): ViolationMetadata {
  switch (type) {
    case 'MAX_SHIFT_LENGTH':
      return {
        label: 'Shift Length',
        icon: '',
        color: 'text-red-600',
        description: `Maximum shift duration exceeded (${COMPLIANCE_LIMITS.MAX_SHIFT_HOURS} hours)`,
      };
    case 'INSUFFICIENT_REST':
      return {
        label: 'Rest Period',
        icon: '',
        color: 'text-red-600',
        description: `Minimum rest period not met (${COMPLIANCE_LIMITS.MIN_REST_HOURS} hours)`,
      };
    case 'MAX_WEEKLY_HOURS':
      return {
        label: 'Weekly Hours',
        icon: '',
        color: 'text-red-600',
        description: `Maximum weekly hours exceeded (${COMPLIANCE_LIMITS.MAX_WEEKLY_HOURS} hours)`,
      };
    case 'APPROACHING_WEEKLY_LIMIT':
      return {
        label: 'Weekly Hours Warning',
        icon: '',
        color: 'text-amber-600',
        description: `Approaching weekly hours limit (${COMPLIANCE_LIMITS.APPROACHING_WEEKLY_HOURS}+ hours)`,
      };
    case 'MAX_CONSECUTIVE_DAYS':
      return {
        label: 'Consecutive Days',
        icon: '',
        color: 'text-red-600',
        description: `Maximum consecutive working days exceeded (${COMPLIANCE_LIMITS.MAX_CONSECUTIVE_DAYS} days)`,
      };
    case 'CONSECUTIVE_DAYS_WARNING':
      return {
        label: 'Consecutive Days Warning',
        icon: '',
        color: 'text-amber-600',
        description: `Approaching consecutive days limit (${COMPLIANCE_LIMITS.CONSECUTIVE_DAYS_WARNING}+ days)`,
      };
    case 'MAX_CONSECUTIVE_NIGHTS':
      return {
        label: 'Consecutive Nights',
        icon: '',
        color: 'text-red-600',
        description: `Maximum consecutive night shifts exceeded (${COMPLIANCE_LIMITS.MAX_CONSECUTIVE_NIGHTS} nights)`,
      };
    case 'CONSECUTIVE_NIGHTS_WARNING':
      return {
        label: 'Consecutive Nights Warning',
        icon: '',
        color: 'text-amber-600',
        description: `Approaching consecutive nights limit (${COMPLIANCE_LIMITS.CONSECUTIVE_NIGHTS_WARNING}+ nights)`,
      };
    case 'DAY_NIGHT_TRANSITION':
      return {
        label: 'Day/Night Transition',
        icon: '',
        color: 'text-red-600',
        description: 'Unsafe transition from day shift to night shift',
      };
    case 'MULTIPLE_SHIFTS_SAME_DAY':
      return {
        label: 'Multiple Shifts',
        icon: '',
        color: 'text-red-600',
        description: 'Multiple shifts assigned on the same day',
      };
    case 'ELEVATED_FATIGUE_INDEX':
      return {
        label: 'High Fatigue',
        icon: '',
        color: 'text-amber-600',
        description: 'Fatigue Risk Index is elevated',
      };
    default:
      return {
        label: 'Unknown',
        icon: '',
        color: 'text-slate-600',
        description: 'Unknown violation type',
      };
  }
}

/**
 * Get severity color class for violations (5-tier NR system)
 * Per NR/L2/OHS/003 Chart 1:
 * - breach: RED - Stop work immediately (FRI >1.6, <12h rest, >12h shift, >13 consecutive days)
 * - level2: AMBER - Requires FAMP (>72h weekly, FGI >35 day/45 night)
 * - level1: YELLOW - Requires risk assessment (60-72h weekly)
 * - info: LIGHT GREEN - Good Practice advisory (FGI >30 day/40 night but ≤35/45)
 * - OK: GREEN - Fully compliant
 */
export function getViolationSeverityColor(severity: 'breach' | 'level2' | 'level1' | 'warning' | 'info' | null): string {
  switch (severity) {
    case 'breach':
      return 'bg-red-100 text-red-800 border-red-300'; // Red - STOP WORK
    case 'level2':
      return 'bg-orange-100 text-orange-800 border-orange-300'; // Amber - FAMP required
    case 'level1':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300'; // Yellow - Risk assessment
    case 'info':
      return 'bg-lime-100 text-lime-800 border-lime-300'; // Light Green - Good Practice
    case 'warning':
      return 'bg-gray-100 text-gray-800 border-gray-300'; // Gray - Warning
    default:
      return 'bg-green-100 text-green-800 border-green-300'; // Green - OK
  }
}

/**
 * Get MUI-compatible severity colors for violations (5-tier NR system)
 * Returns an object with bgcolor, borderColor for MUI sx prop
 */
export function getViolationSeveritySx(severity: 'breach' | 'level2' | 'level1' | 'warning' | 'info' | null): {
  bgcolor: string;
  borderColor: string;
  color?: string;
} {
  switch (severity) {
    case 'breach':
      return { bgcolor: '#fee2e2', borderColor: '#dc2626', color: '#991b1b' }; // Red
    case 'level2':
      return { bgcolor: '#ffedd5', borderColor: '#f97316', color: '#9a3412' }; // Amber/Orange
    case 'level1':
      return { bgcolor: '#fef9c3', borderColor: '#eab308', color: '#854d0e' }; // Yellow
    case 'info':
      return { bgcolor: '#d9f99d', borderColor: '#84cc16', color: '#365314' }; // Light Green
    case 'warning':
      return { bgcolor: '#f3f4f6', borderColor: '#6b7280', color: '#1f2937' }; // Gray
    default:
      return { bgcolor: '#bbf7d0', borderColor: '#22c55e', color: '#166534' }; // Green - OK
  }
}

// ==================== DATE FORMATTING ====================

/**
 * Format date for display in UK format (DD/MM/YYYY)
 */
export function formatDateUK(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB');
}

/**
 * Format date for display with day name (e.g., "Mon 25 Dec")
 */
export function formatDateWithDay(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

/**
 * Format ISO date string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Parse ISO date string to Date object (handles timezone correctly)
 */
export function parseISODate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// ==================== TIME FORMATTING ====================

/**
 * Format time from 24h format to 12h format with AM/PM
 */
export function formatTime12h(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Format hours as hours and minutes string (e.g., "8h 30m")
 */
export function formatHoursMinutes(totalHours: number): string {
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Format duration in minutes to hours and minutes (e.g., "2h 30m")
 */
export function formatDurationMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// ==================== DUTY TYPE UTILITIES ====================

type DutyType = 'Possession' | 'Non-Possession' | 'Office' | 'Lookout' | 'Machine' | 'Protection' | 'Other';

/**
 * Get color classes for duty type badges
 */
export function getDutyTypeColor(dutyType: DutyType): string {
  switch (dutyType) {
    case 'Possession':
      return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'Non-Possession':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'Office':
      return 'bg-slate-100 text-slate-800 border-slate-300';
    case 'Lookout':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'Machine':
      return 'bg-cyan-100 text-cyan-800 border-cyan-300';
    case 'Protection':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'Other':
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

// ==================== NUMBER FORMATTING ====================

/**
 * Format number with specified decimal places
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

/**
 * Format percentage (0-1 to 0-100%)
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Convert string to Title Case (proper name formatting)
 * Handles all-caps, all-lowercase, and mixed case names
 * Examples: "JOHN SMITH" -> "John Smith", "jane doe" -> "Jane Doe"
 */
export function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
