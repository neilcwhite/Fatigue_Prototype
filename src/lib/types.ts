// ============================================
// FATIGUE MANAGEMENT SYSTEM - TYPE DEFINITIONS
// ============================================

// Re-export Supabase User type for component props
export type { User as SupabaseUser } from '@supabase/supabase-js';

// ==================== DATABASE ENTITIES ====================

export interface Employee {
  id: number;
  name: string;
  role?: string;
  email?: string;
  team_id?: number;
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface Project {
  id: number;
  name: string;
  start_date?: string;
  end_date?: string;
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface Team {
  id: number;
  name: string;
  member_ids: number[];
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface DaySchedule {
  startTime: string;
  endTime: string;
  commuteIn?: number;
  commuteOut?: number;
  workload?: number;
  attention?: number;
  breakFreq?: number;
  breakLen?: number;
}

export interface WeeklySchedule {
  Sat?: DaySchedule | null;
  Sun?: DaySchedule | null;
  Mon?: DaySchedule | null;
  Tue?: DaySchedule | null;
  Wed?: DaySchedule | null;
  Thu?: DaySchedule | null;
  Fri?: DaySchedule | null;
}

export interface ShiftPattern {
  id: string;
  project_id: number;
  name: string;
  start_time?: string;
  end_time?: string;
  weekly_schedule?: WeeklySchedule;
  duty_type: 'Possession' | 'Non-Possession' | 'Office' | 'Lookout' | 'Machine' | 'Protection' | 'Other';
  is_night: boolean;
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
  // Fatigue parameters (NR Excel tool scale: 1=highest demand, 4=lowest)
  workload?: number;      // 1-4 scale
  attention?: number;     // 1-4 scale
  commute_time?: number;  // minutes
  break_frequency?: number; // minutes between breaks
  break_length?: number;  // minutes per break
}

export interface Assignment {
  id: number;
  employee_id: number;
  project_id: number;
  shift_pattern_id: string;
  date: string;
  custom_start_time?: string;
  custom_end_time?: string;
  notes?: string;
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  role: 'admin' | 'manager' | 'viewer';
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface Organisation {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

// ==================== FATIGUE CALCULATION ====================

export interface ShiftDefinition {
  day: number;
  startTime: string;
  endTime: string;
  commuteIn?: number;
  commuteOut?: number;
  workload?: number;
  attention?: number;
  breakFreq?: number;
  breakLen?: number;
}

export interface RiskLevel {
  level: 'low' | 'moderate' | 'elevated' | 'critical';
  label: string;
  color: string;
}

export interface FatigueResult {
  day: number;
  cumulative: number;
  timing: number;
  jobBreaks: number;
  riskIndex: number;
  riskLevel: RiskLevel;
}

// Fatigue Index result (additive probability-based model)
export interface FatigueIndexResult {
  day: number;
  cumulative: number;      // 0-100 scale
  timeOfDay: number;       // 0-100 scale
  task: number;            // 0-100 scale
  fatigueIndex: number;    // Final FGI value
  fatigueLevel: FatigueLevel;
}

export interface FatigueLevel {
  level: 'low' | 'moderate' | 'elevated' | 'critical';
  label: string;
  color: string;
}

// Combined result for both indices
export interface CombinedFatigueResult {
  day: number;
  // Risk Index components (multiplicative)
  riskCumulative: number;
  riskTiming: number;
  riskJobBreaks: number;
  riskIndex: number;
  riskLevel: RiskLevel;
  // Fatigue Index components (additive/probability)
  fatigueCumulative: number;
  fatigueTimeOfDay: number;
  fatigueTask: number;
  fatigueIndex: number;
  fatigueLevel: FatigueLevel;
}

// ==================== COMPLIANCE ====================
// These types must match compliance.ts - single source of truth is compliance.ts

export type ViolationType =
  | 'MAX_SHIFT_LENGTH'
  | 'INSUFFICIENT_REST'
  | 'MAX_WEEKLY_HOURS'
  | 'LEVEL_1_EXCEEDANCE'         // 60-72 hours: amber warning with duty restrictions
  | 'LEVEL_2_EXCEEDANCE'         // 72+ hours: red error, complete work prohibition
  | 'APPROACHING_WEEKLY_LIMIT'
  | 'MAX_CONSECUTIVE_DAYS'
  | 'CONSECUTIVE_DAYS_WARNING'
  | 'CONSECUTIVE_NIGHTS_WARNING'
  | 'MAX_CONSECUTIVE_NIGHTS'
  | 'DAY_NIGHT_TRANSITION'
  | 'MULTIPLE_SHIFTS_SAME_DAY'
  | 'ELEVATED_FATIGUE_INDEX';

export type ViolationSeverity = 'breach' | 'level2' | 'level1' | 'warning';

export interface ComplianceViolation {
  type: ViolationType;
  severity: ViolationSeverity;
  employeeId: number;
  employeeName?: string;
  date: string;
  message: string;
  value?: number;
  limit?: number;
  windowEnd?: string;
  relatedDates?: string[];
}

export interface ComplianceResult {
  isCompliant: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  violations: ComplianceViolation[];
  errorCount: number;
  warningCount: number;
}

// ==================== NETWORK RAIL PERIODS ====================

export interface NetworkRailPeriod {
  period: number;
  name: string;
  startDate: string;
  endDate: string;
  year: number;
}

// ==================== UI STATE ====================

export type ViewMode = 'dashboard' | 'planning' | 'calculator' | 'employee' | 'teams';

export type PlanningViewMode = 'timeline' | 'gantt' | 'weekly';

export interface ProjectStats {
  totalHours: number;
  employeeCount: number;
  violationCount: number;
  complianceStatus: 'compliant' | 'warning' | 'breach';
}

// ==================== HELPER TYPES ====================

// For camelCase compatibility with existing v76 code
export interface EmployeeCamel {
  id: number;
  name: string;
  role?: string;
  email?: string;
  teamId?: number;
  organisationId: string;
}

export interface ProjectCamel {
  id: number;
  name: string;
  startDate?: string;
  endDate?: string;
  organisationId: string;
}

export interface ShiftPatternCamel {
  id: string;
  projectId: number;
  name: string;
  startTime?: string;
  endTime?: string;
  weeklySchedule?: WeeklySchedule;
  dutyType: 'Possession' | 'Non-Possession' | 'Office' | 'Lookout' | 'Machine' | 'Protection' | 'Other';
  isNight: boolean;
  organisationId: string;
  createdAt?: string;     // ISO timestamp for sorting
  // Fatigue parameters (NR Excel tool scale: 1=highest demand, 4=lowest)
  workload?: number;      // 1-4 scale
  attention?: number;     // 1-4 scale
  commuteTime?: number;   // minutes
  breakFrequency?: number; // minutes between breaks
  breakLength?: number;   // minutes per break
}

export interface AssignmentCamel {
  id: number;
  employeeId: number;
  projectId: number;
  shiftPatternId: string;
  date: string;
  customStartTime?: string;
  customEndTime?: string;
  notes?: string;
  organisationId: string;
}

export interface TeamCamel {
  id: number;
  name: string;
  memberIds: number[];
  organisationId: string;
}
