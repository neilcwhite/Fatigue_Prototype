// ============================================
// FATIGUE MANAGEMENT SYSTEM - TYPE DEFINITIONS
// ============================================

export interface Organisation {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  organisation_id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'manager' | 'viewer';
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: number;
  organisation_id: string;
  name: string;
  role: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  organisation_id: string;
  name: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  type: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyScheduleDay {
  startTime: string;
  endTime: string;
  commuteIn: number;
  commuteOut: number;
  workload: number;
  attention: number;
  breakFreq: number;
  breakLen: number;
}

export interface WeeklySchedule {
  Sat?: WeeklyScheduleDay;
  Sun?: WeeklyScheduleDay;
  Mon?: WeeklyScheduleDay;
  Tue?: WeeklyScheduleDay;
  Wed?: WeeklyScheduleDay;
  Thu?: WeeklyScheduleDay;
  Fri?: WeeklyScheduleDay;
}

export type DutyType = 'Possession' | 'Non-Possession' | 'Office';

export interface ShiftPattern {
  id: string;
  organisation_id: string;
  project_id: number;
  name: string;
  start_time: string | null;
  end_time: string | null;
  weekly_schedule: WeeklySchedule | null;
  duty_type: DutyType | null;
  is_night: boolean;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: number;
  organisation_id: string;
  employee_id: number;
  project_id: number;
  shift_pattern_id: string;
  date: string;
  custom_start_time: string | null;
  custom_end_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: number;
  organisation_id: string;
  name: string;
  member_ids: number[];
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: number;
  organisation_id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

// Compliance Types
export type ViolationSeverity = 'error' | 'warning';

export interface ComplianceViolation {
  rule: string;
  severity: ViolationSeverity;
  message: string;
  date?: string;
  employeeId?: number;
}

export interface ComplianceResult {
  errors: ComplianceViolation[];
  warnings: ComplianceViolation[];
  isValid: boolean;
}

// Fatigue Calculator Types
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

export interface FatigueResult {
  day: number;
  cumulative: number;
  timing: number;
  jobBreaks: number;
  riskIndex: number;
  riskLevel: RiskLevel;
}

export interface RiskLevel {
  level: 'low' | 'moderate' | 'elevated' | 'critical';
  label: string;
  color: string;
}

// Network Rail Period Types
export interface NetworkRailPeriod {
  period: number;
  year: number;
  startDate: Date;
  endDate: Date;
  label: string;
}

// View Types
export type PlanningViewMode = 'timeline' | 'gantt' | 'weekly';

// Project Statistics
export interface ProjectStats {
  totalHours: number;
  employeeCount: number;
  violationCount: number;
  warningCount: number;
}