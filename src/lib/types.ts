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
  location?: string;
  start_date?: string;
  end_date?: string;
  type?: string;
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
  // Fatigue parameters
  workload?: number;      // 1-5 scale
  attention?: number;     // 1-5 scale
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

// ==================== COMPLIANCE ====================

export type ViolationType = 
  | 'MAX_SHIFT_EXCEEDED'
  | 'MIN_REST_VIOLATED'
  | 'MAX_WEEKLY_EXCEEDED'
  | 'MAX_CONSECUTIVE_DAYS'
  | 'MAX_CONSECUTIVE_NIGHTS';

export interface ComplianceViolation {
  type: ViolationType;
  employeeId: number;
  date: string;
  message: string;
  severity: 'warning' | 'breach';
}

export interface ComplianceResult {
  isCompliant: boolean;
  violations: ComplianceViolation[];
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
  location?: string;
  startDate?: string;
  endDate?: string;
  type?: string;
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
  // Fatigue parameters
  workload?: number;      // 1-5 scale
  attention?: number;     // 1-5 scale
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
