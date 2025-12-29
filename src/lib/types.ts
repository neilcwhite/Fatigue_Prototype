// ==================== DATABASE TYPES ====================
// These match the Supabase schema exactly

export interface Organisation {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserProfile {
  id: string;
  organisation_id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'manager' | 'viewer';
  created_at?: string;
  updated_at?: string;
}

export interface Employee {
  id: number;
  organisation_id: string;
  name: string;
  role: string | null;
  email: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Project {
  id: number;
  organisation_id: string;
  name: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  type: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ShiftPattern {
  id: string;
  organisation_id: string;
  project_id: number;
  name: string;
  start_time: string | null;
  end_time: string | null;
  duty_type: string | null;
  is_night: boolean;
  weekly_schedule: WeeklySchedule | null;
  created_at?: string;
  updated_at?: string;
}

export interface WeeklySchedule {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

export interface DaySchedule {
  enabled: boolean;
  start_time: string;
  end_time: string;
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
  created_at?: string;
  updated_at?: string;
}

export interface Team {
  id: number;
  organisation_id: string;
  name: string;
  member_ids: number[];
  created_at?: string;
  updated_at?: string;
}

export interface AuditLog {
  id: number;
  organisation_id: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at?: string;
}

// ==================== COMPLIANCE TYPES ====================

export interface ComplianceViolation {
  severity: 'error' | 'warning';
  rule: string;
  message: string;
  date: string;
  employeeId: number;
  employeeName?: string;
}

export interface ComplianceResult {
  errors: ComplianceViolation[];
  warnings: ComplianceViolation[];
  isCompliant: boolean;
}

// ==================== FATIGUE INDEX TYPES ====================

export interface FatigueIndexResult {
  day: number;
  date: string;
  cumulative: number;
  timing: number;
  jobBreaks: number;
  riskIndex: number;
  riskLevel: RiskLevel;
}

export interface RiskLevel {
  level: 'low' | 'moderate' | 'elevated' | 'high';
  label: string;
  color: string;
}

export interface ShiftInput {
  day: number;
  startTime: string;
  endTime: string;
  commuteMinutes?: number;
}

export interface JobBreaksParams {
  workload?: number;       // 1-5 scale
  attention?: number;      // 1-5 scale
  breakFrequency?: number; // minutes between breaks
  breakLength?: number;    // break duration in minutes
}

// ==================== PROJECT STATS ====================

export interface ProjectStats {
  totalHours: number;
  employeeCount: number;
  violationCount: number;
  warningCount: number;
}

// ==================== NETWORK RAIL PERIODS ====================

export interface NetworkRailPeriod {
  year: number;
  period: number;
  label: string;
  startDate: Date;
  endDate: Date;
}

// ==================== UI TYPES ====================

export interface ModalProps {
  onClose: () => void;
}

export interface SelectOption {
  value: string | number;
  label: string;
}

// ==================== FORM TYPES ====================

export interface ProjectFormData {
  name: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  type?: string;
}

export interface EmployeeFormData {
  name: string;
  role?: string;
  email?: string;
}

export interface ShiftPatternFormData {
  name: string;
  start_time: string;
  end_time: string;
  duty_type: string;
  is_night: boolean;
  use_weekly_schedule?: boolean;
  weekly_schedule?: WeeklySchedule;
}

export interface TeamFormData {
  name: string;
  member_ids: number[];
}
