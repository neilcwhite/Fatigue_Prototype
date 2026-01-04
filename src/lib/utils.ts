// ============================================
// FATIGUE MANAGEMENT SYSTEM - SHARED UTILITIES
// ============================================

import type { RiskLevel, ViolationType } from './types';
import { COMPLIANCE_LIMITS } from './compliance';

// ==================== FRI COLOUR CONSTANTS ====================
// Standardized colours for Fatigue Risk Index display across all components
// FRI Thresholds: <1.0 (Low), 1.0-1.1 (Moderate), 1.1-1.2 (Elevated), >=1.2 (Critical)

export const FRI_COLORS = {
  // Solid backgrounds with white text - for chips, badges, small UI elements
  solid: {
    low: 'bg-green-600 text-white',
    moderate: 'bg-yellow-500 text-white',
    elevated: 'bg-orange-500 text-white',
    critical: 'bg-red-600 text-white',
    unknown: 'bg-slate-500 text-white',
  },
  // Light backgrounds with dark text - for cards, larger areas
  light: {
    low: 'bg-green-100 text-green-800 border-green-300',
    moderate: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    elevated: 'bg-orange-100 text-orange-800 border-orange-300',
    critical: 'bg-red-100 text-red-800 border-red-300',
    unknown: 'bg-slate-100 text-slate-800 border-slate-300',
  },
} as const;

// ==================== RISK COLORS ====================

/**
 * Get CSS classes for FRI chip/badge display (solid background, white text)
 * Use for: calendar chips, FRI badges, small indicators
 */
export function getFRIChipColor(fri: number | null): string {
  if (fri === null) return FRI_COLORS.solid.unknown;
  if (fri >= 1.2) return FRI_COLORS.solid.critical;
  if (fri >= 1.1) return FRI_COLORS.solid.elevated;
  if (fri >= 1.0) return FRI_COLORS.solid.moderate;
  return FRI_COLORS.solid.low;
}

/**
 * Get CSS classes for FRI card/area display (light background, dark text)
 * Use for: summary cards, larger display areas
 */
export function getFRICardColor(fri: number | null): string {
  if (fri === null) return FRI_COLORS.light.unknown;
  if (fri >= 1.2) return FRI_COLORS.light.critical;
  if (fri >= 1.1) return FRI_COLORS.light.elevated;
  if (fri >= 1.0) return FRI_COLORS.light.moderate;
  return FRI_COLORS.light.low;
}

/**
 * Get CSS classes for FRI (Fatigue Risk Index) value display
 * @deprecated Use getFRIChipColor or getFRICardColor instead
 */
export function getFRIColor(fri: number): string {
  if (fri >= 1.2) return 'text-red-600 bg-red-100';
  if (fri >= 1.1) return 'text-amber-600 bg-amber-100';
  if (fri >= 1.0) return 'text-yellow-600 bg-yellow-100';
  return 'text-green-600 bg-green-100';
}

/**
 * Get human-readable risk level label from FRI value
 */
export function getFRILevel(fri: number): string {
  if (fri >= 1.2) return 'Critical';
  if (fri >= 1.1) return 'Elevated';
  if (fri >= 1.0) return 'Moderate';
  return 'Low';
}

/**
 * Get CSS classes for risk level display (with border)
 * Used in FatigueView for displaying risk cards
 */
export function getRiskColor(level: RiskLevel['level'] | string): string {
  switch (level) {
    case 'low': return FRI_COLORS.light.low;
    case 'moderate': return FRI_COLORS.light.moderate;
    case 'elevated': return FRI_COLORS.light.elevated;
    case 'critical': return FRI_COLORS.light.critical;
    default: return FRI_COLORS.light.unknown;
  }
}

/**
 * Get solid background color class for risk level
 */
export function getRiskBgColor(level: RiskLevel['level'] | string): string {
  switch (level) {
    case 'low': return 'bg-green-600';
    case 'moderate': return 'bg-yellow-500';
    case 'elevated': return 'bg-orange-500';
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
        icon: '⏱️',
        color: 'text-red-600',
        description: `Maximum shift duration exceeded (${COMPLIANCE_LIMITS.MAX_SHIFT_HOURS} hours)`,
      };
    case 'INSUFFICIENT_REST':
      return {
        label: 'Rest Period',
        icon: '🛏️',
        color: 'text-red-600',
        description: `Minimum rest period not met (${COMPLIANCE_LIMITS.MIN_REST_HOURS} hours)`,
      };
    case 'MAX_WEEKLY_HOURS':
      return {
        label: 'Weekly Hours',
        icon: '📅',
        color: 'text-red-600',
        description: `Maximum weekly hours exceeded (${COMPLIANCE_LIMITS.MAX_WEEKLY_HOURS} hours)`,
      };
    case 'APPROACHING_WEEKLY_LIMIT':
      return {
        label: 'Weekly Hours Warning',
        icon: '📅',
        color: 'text-amber-600',
        description: `Approaching weekly hours limit (${COMPLIANCE_LIMITS.APPROACHING_WEEKLY_HOURS}+ hours)`,
      };
    case 'MAX_CONSECUTIVE_DAYS':
      return {
        label: 'Consecutive Days',
        icon: '📆',
        color: 'text-red-600',
        description: `Maximum consecutive working days exceeded (${COMPLIANCE_LIMITS.MAX_CONSECUTIVE_DAYS} days)`,
      };
    case 'CONSECUTIVE_DAYS_WARNING':
      return {
        label: 'Consecutive Days Warning',
        icon: '📆',
        color: 'text-amber-600',
        description: `Approaching consecutive days limit (${COMPLIANCE_LIMITS.CONSECUTIVE_DAYS_WARNING}+ days)`,
      };
    case 'MAX_CONSECUTIVE_NIGHTS':
      return {
        label: 'Consecutive Nights',
        icon: '🌙',
        color: 'text-red-600',
        description: `Maximum consecutive night shifts exceeded (${COMPLIANCE_LIMITS.MAX_CONSECUTIVE_NIGHTS} nights)`,
      };
    case 'CONSECUTIVE_NIGHTS_WARNING':
      return {
        label: 'Consecutive Nights Warning',
        icon: '🌙',
        color: 'text-amber-600',
        description: `Approaching consecutive nights limit (${COMPLIANCE_LIMITS.CONSECUTIVE_NIGHTS_WARNING}+ nights)`,
      };
    case 'DAY_NIGHT_TRANSITION':
      return {
        label: 'Day/Night Transition',
        icon: '🔄',
        color: 'text-red-600',
        description: 'Unsafe transition from day shift to night shift',
      };
    case 'MULTIPLE_SHIFTS_SAME_DAY':
      return {
        label: 'Multiple Shifts',
        icon: '⚠️',
        color: 'text-red-600',
        description: 'Multiple shifts assigned on the same day',
      };
    case 'ELEVATED_FATIGUE_INDEX':
      return {
        label: 'High Fatigue',
        icon: '😴',
        color: 'text-amber-600',
        description: 'Fatigue Risk Index is elevated',
      };
    default:
      return {
        label: 'Unknown',
        icon: '⚠️',
        color: 'text-slate-600',
        description: 'Unknown violation type',
      };
  }
}

/**
 * Get severity color class for violations
 */
export function getViolationSeverityColor(severity: 'error' | 'warning'): string {
  return severity === 'error'
    ? 'bg-red-100 text-red-800 border-red-300'
    : 'bg-amber-100 text-amber-800 border-amber-300';
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
