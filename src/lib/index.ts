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
  checkMaxShiftLength,
  checkRestPeriods,
  checkMultipleShiftsSameDay,
  checkWeeklyHours,
  checkConsecutiveDays,
  checkConsecutiveNights,
  checkEmployeeCompliance,
  checkProjectCompliance,
  getEmployeeComplianceStatus,
  validateNewAssignment,
  getDateCellViolations,
} from './compliance';

export type {
  ViolationType,
  ViolationSeverity,
  ComplianceViolation,
  ComplianceResult,
  EmployeeComplianceStatus,
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

// Import/Export
export {
  exportToExcel,
  parseImportFile,
  processImport,
} from './importExport';

export type {
  ExportData,
  ImportResult,
  ParsedAssignment,
  ProcessImportOptions,
  ProcessImportResult,
} from './importExport';
