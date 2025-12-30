// ============================================
// FATIGUE MANAGEMENT SYSTEM - LIB EXPORTS
// ============================================

// Types
export * from './types';

// Supabase
export { 
  supabase,
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  getSession,
  TABLES,
  toSnakeCase,
  toCamelCase,
  fetchAll,
  fetchById,
  insert,
  update,
  remove,
  upsert,
} from './supabase';

// Fatigue calculation
export {
  parseTimeToHours,
  calculateDutyLength,
  getRiskLevel,
  calculateRiskIndex,
  calculateFatigueSequence,
  calculateRestPeriod,
  DEFAULT_FATIGUE_PARAMS,
  FATIGUE_TEMPLATES,
} from './fatigue';

// Compliance
export {
  COMPLIANCE_LIMITS,
  checkMaxShiftDuration,
  checkMinRestPeriod,
  checkMaxWeeklyHours,
  checkMaxConsecutiveDays,
  checkMaxConsecutiveNights,
  checkEmployeeCompliance,
  checkProjectCompliance,
} from './compliance';

// Network Rail periods
export {
  generateNetworkRailPeriods,
  getPeriodDates,
  getPeriodWeeks,
  findPeriodForDate,
  getCurrentPeriod,
  getAvailableYears,
  formatDate,
  formatDateRange,
  getDayName,
  getDayOfWeek,
  isWeekend,
  getNRWeekDayKey,
  parseDate,
  toISODateString,
  getDateRange,
  daysBetween,
} from './periods';
