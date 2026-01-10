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
  sentinel_number?: string;  // 3-15 characters, alphanumeric
  primary_sponsor?: string;
  sub_sponsors?: string;
  current_employer?: string;
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
  archived?: boolean;  // Soft delete - hides project and FAMPs from normal users
  archived_at?: string; // Date when project was archived
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
  // Fatigue parameters (override pattern defaults for this specific assignment)
  commute_in?: number;       // minutes commute to work
  commute_out?: number;      // minutes commute from work
  workload?: number;         // 1-4 scale
  attention?: number;        // 1-4 scale
  break_frequency?: number;  // minutes between breaks
  break_length?: number;     // minutes per break
  continuous_work?: number;  // max continuous work time (minutes)
  break_after_continuous?: number; // rest after continuous work (minutes)
}

export type UserRole = 'super_admin' | 'admin' | 'sheq' | 'manager' | 'user';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  role: UserRole;
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
  | 'LEVEL_1_EXCEEDANCE'         // 60-72 hours: yellow, requires risk assessment
  | 'LEVEL_2_EXCEEDANCE'         // 72+ hours: amber, requires FAMP
  | 'APPROACHING_WEEKLY_LIMIT'
  | 'MAX_CONSECUTIVE_DAYS'
  | 'CONSECUTIVE_DAYS_WARNING'
  | 'CONSECUTIVE_NIGHTS_WARNING'
  | 'MAX_CONSECUTIVE_NIGHTS'
  | 'DAY_NIGHT_TRANSITION'
  | 'MULTIPLE_SHIFTS_SAME_DAY'
  | 'ELEVATED_FATIGUE_INDEX'     // FRI Risk Index >1.6: red breach
  | 'GOOD_PRACTICE_FRI'          // FRI 30/40: green info, monitor and record
  | 'LEVEL_2_FRI_EXCEEDANCE';    // FRI 35/45: amber, requires FAMP

export type ViolationSeverity = 'breach' | 'level2' | 'level1' | 'warning' | 'info';

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
  sentinelNumber?: string;  // 3-15 characters, alphanumeric
  primarySponsor?: string;
  subSponsors?: string;
  currentEmployer?: string;
  teamId?: number;
  organisationId: string;
}

export interface ProjectCamel {
  id: number;
  name: string;
  startDate?: string;
  endDate?: string;
  archived?: boolean;  // Soft delete - hides project and FAMPs from normal users
  archivedAt?: string; // Date when project was archived
  organisationId: string;
  createdAt?: string;
  updatedAt?: string;
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
  continuousWork?: number; // minutes max continuous work time
  breakAfterContinuous?: number; // minutes rest after continuous work
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
  // Fatigue parameters (override pattern defaults for this specific assignment)
  commuteIn?: number;       // minutes commute to work
  commuteOut?: number;      // minutes commute from work
  workload?: number;        // 1-4 scale
  attention?: number;       // 1-4 scale
  breakFrequency?: number;  // minutes between breaks
  breakLength?: number;     // minutes per break
  continuousWork?: number;  // max continuous work time (minutes)
  breakAfterContinuous?: number; // rest after continuous work (minutes)
}

export interface TeamCamel {
  id: number;
  name: string;
  memberIds: number[];
  organisationId: string;
}

// ==================== PROJECT ACCESS CONTROL ====================

/** Role a user has on a specific project */
export type ProjectMemberRole = 'viewer' | 'editor' | 'manager';

/** Database schema for project_members table (snake_case) */
export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: string;
  member_role: ProjectMemberRole;
  organisation_id: string;
  created_at?: string;
}

/** CamelCase version for frontend use */
export interface ProjectMemberCamel {
  id: number;
  projectId: number;
  userId: string;
  memberRole: ProjectMemberRole;
  organisationId: string;
  createdAt?: string;
}

/** Project with access information for the current user */
export interface ProjectWithAccess extends ProjectCamel {
  /** Current user's role on this project (undefined if no direct access) */
  userRole?: ProjectMemberRole;
  /** Whether user can edit this project */
  canEdit: boolean;
  /** Whether user can manage this project (add/remove members) */
  canManage: boolean;
}

// ==================== ADMIN & PERMISSIONS ====================

// Role hierarchy: super_admin > admin > sheq > manager > user
export interface RolePermissions {
  canViewArchived: boolean;
  canArchiveProjects: boolean;
  canDeleteProjects: boolean;
  canImportUsers: boolean;
  canManageRoles: boolean;
  canViewAllProjects: boolean;
  canEditAllProjects: boolean;
  canViewCompliance: boolean;
  canManageFAMPs: boolean;
}

// CSV import types
export interface CSVImportRow {
  first_name: string;
  last_name: string;
  sentinel_number: string;
  role?: string;
  primary_sponsor?: string;
  sub_sponsors?: string;
  current_employer?: string;
}

export interface CSVImportResult {
  imported: CSVImportRow[];
  skipped: CSVImportRow[];
  conflicts: CSVImportConflict[];
}

export interface CSVImportConflict {
  sentinel_number: string;
  csvFirstName: string;
  csvLastName: string;
  existingName: string;
  existingEmployeeId: number;
}

// ==================== FATIGUE ASSESSMENT (FAMP) ====================

// Reasons that can trigger a fatigue assessment
export type FAMPAssessmentReason =
  | 'more_than_12_hours_shift'
  | 'less_than_12_hours_rest'
  | 'door_to_door_14_hours'
  | 'more_than_13_days_in_14'
  | 'daytime_fri_35_plus'
  | 'nighttime_fri_45_plus'
  | 'fri_risk_score_1_6_plus'
  | 'on_call_work'
  | 'fatigue_concern_self'
  | 'fatigue_concern_others'
  | 'more_than_72_hours_weekly'    // Auto HIGH risk
  | 'more_than_60_hours_weekly';   // Auto MEDIUM risk

// Question IDs for the 13 scored assessment questions
export type FAMPQuestionId =
  | 'hours_worked_today'
  | 'physical_activity_level'
  | 'concentration_required'
  | 'hours_left_in_shift'
  | 'remaining_activity_type'
  | 'breaks_and_refreshment'
  | 'sleep_duration_24h'
  | 'sleep_quality_24h'
  | 'food_and_drink'
  | 'time_between_shifts'
  | 'shift_type'
  | 'fri_score_end_shift'
  | 'drive_time_home';

// Answer for a single assessment question
export interface FAMPQuestionAnswer {
  questionId: FAMPQuestionId;
  answerValue: string;
  answerLabel: string;
  score: number;
}

// Risk levels for FAMP
export type FAMPRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

// Exceedance levels
export type FAMPExceedanceLevel = 'none' | 'level1' | 'level2';

// Status of a fatigue assessment
export type FAMPStatus = 'draft' | 'pending_employee' | 'pending_manager' | 'completed' | 'cancelled';

// Mitigation controls that can be applied
export type FAMPMitigation =
  | 'no_lookout_duties'
  | 'no_individual_working_alone'
  | 'no_safety_critical_duties'
  | 'no_management_of_trains'
  | 'no_driving_duties'
  | 'no_otp_operation'
  | 'no_otm_operation'
  | 'relieve_from_duty'
  | 'minimum_24_hours_rest'
  | 'minimum_12_hours_rest'
  | 'additional_meal_rest_breaks'
  | 'change_scheduled_work'
  | 'rotation_of_activity'
  | 'additional_supervision'
  | 'reduction_in_shift_length'
  | 'provision_of_accommodation'
  | 'provision_of_rested_drivers'
  | 'share_driving_duties'
  | 'use_local_staff'
  | 'other';

// Full fatigue assessment record
export interface FatigueAssessment {
  id: string;
  organisationId: string;

  // Part 1: Details
  employeeId: number;
  employeeName: string;
  jobTitle?: string;
  contractNo?: string;
  location?: string;
  assessmentDate: string;  // YYYY-MM-DD
  shiftStartTime?: string;
  shiftEndTime?: string;
  assessorName: string;
  assessorRole?: string;

  // Link to violation that triggered this (optional)
  violationType?: ViolationType;
  violationDate?: string;
  assignmentId?: number;

  // Part 2: Reasons for assessment
  assessmentReasons: FAMPAssessmentReason[];

  // Part 3: Assessment scores
  assessmentAnswers: FAMPQuestionAnswer[];
  totalScore: number;

  // Part 4: Risk assessment result
  exceedanceLevel: FAMPExceedanceLevel;
  calculatedRiskLevel: FAMPRiskLevel;
  finalRiskLevel: FAMPRiskLevel;  // May be adjusted by assessor
  riskAdjustmentNotes?: string;

  // Part 5: Mitigations
  appliedMitigations: FAMPMitigation[];
  otherMitigationDetails?: string;

  // Part 6: Authorisation
  employeeAccepted: boolean;
  employeeAcceptanceDate?: string;
  employeeComments?: string;

  managerApproved: boolean;
  managerApprovalDate?: string;
  managerName?: string;
  managerComments?: string;

  // Status and audit
  status: FAMPStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// For creating a new assessment
export interface FatigueAssessmentCreate extends Omit<FatigueAssessment,
  'id' | 'organisationId' | 'createdAt' | 'updatedAt' | 'totalScore' | 'calculatedRiskLevel'
> {}

// Database row format (snake_case)
export interface FatigueAssessmentRow {
  id: string;
  organisation_id: string;
  employee_id: number;
  employee_name: string;
  job_title?: string;
  contract_no?: string;
  location?: string;
  assessment_date: string;
  shift_start_time?: string;
  shift_end_time?: string;
  assessor_name: string;
  assessor_role?: string;
  violation_type?: string;
  violation_date?: string;
  assignment_id?: number;
  assessment_reasons: FAMPAssessmentReason[];
  assessment_answers: FAMPQuestionAnswer[];
  total_score: number;
  exceedance_level: FAMPExceedanceLevel;
  calculated_risk_level: FAMPRiskLevel;
  final_risk_level: FAMPRiskLevel;
  risk_adjustment_notes?: string;
  applied_mitigations: FAMPMitigation[];
  other_mitigation_details?: string;
  employee_accepted: boolean;
  employee_acceptance_date?: string;
  employee_comments?: string;
  manager_approved: boolean;
  manager_approval_date?: string;
  manager_name?: string;
  manager_comments?: string;
  status: FAMPStatus;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

// ==================== WORK VERIFICATION RECORDS ====================
// NOTE: Period-based verification is being replaced by weekly shift verification

export interface ViolationSummary {
  type: ViolationType;
  count: number;
  dates: string[]; // ISO date strings
}

export interface EmployeeWorkSummary {
  employeeId: number;
  employeeName: string;
  plannedHours: number;
  actualHours: number;
  assignmentsCount: number;
  customTimesCount: number;
  violations: ViolationType[];
}

export interface ShiftPatternUsage {
  patternId: string;
  patternName: string;
  assignmentCount: number;
}

export interface WorkVerificationSummaryData {
  totalAssignments: number;
  totalHoursPlanned: number;
  totalHoursActual: number;
  modificationsCount: number;
  farpAssessmentsCount: number;
  completedFarps: number;
  pendingFarps: number;
  violations: ViolationSummary[];
  employeeBreakdown: EmployeeWorkSummary[];
  shiftPatternsUsed: ShiftPatternUsage[];
}

// Database row (snake_case)
export interface WorkVerificationRecordRow {
  id: string;
  organisation_id: string;
  project_id: number;
  period_number?: number;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  manager_id: string;
  manager_name: string;
  manager_role: UserRole;
  sign_off_date: string; // ISO timestamp
  comments?: string;
  summary_data: WorkVerificationSummaryData;
  created_at: string;
  updated_at: string;
}

// CamelCase variant for UI
export interface WorkVerificationRecordCamel {
  id: string;
  organisationId: string;
  projectId: number;
  periodNumber?: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  managerId: string;
  managerName: string;
  managerRole: UserRole;
  signOffDate: string; // ISO timestamp
  comments?: string;
  summaryData: WorkVerificationSummaryData;
  createdAt: string;
  updatedAt: string;
}

// ==================== WEEKLY SHIFT VERIFICATION ====================

export interface SignedOffShift {
  shiftPatternId: string;
  shiftPatternName: string;
  signedOffBy: string; // UUID of manager
  signedOffByName: string;
  signedOffAt: string; // ISO timestamp
  employeeCount: number; // Unique employees who worked this pattern in the week
  totalAssignments: number; // Total assignments for this pattern in the week
  notes?: string;
}

// Database row (snake_case)
export interface WeeklyShiftVerificationRow {
  id: string;
  organisation_id: string;
  project_id: number;
  week_start_date: string; // YYYY-MM-DD (Saturday)
  week_end_date: string; // YYYY-MM-DD (Friday)
  year: number;
  period_number: number;
  week_in_period: number; // 1-4
  signed_off_shifts: SignedOffShift[];
  is_fully_signed_off: boolean;
  completed_by_id?: string;
  completed_by_name?: string;
  completed_by_role?: UserRole;
  completed_at?: string; // ISO timestamp
  created_at: string;
  updated_at: string;
}

// CamelCase variant for UI
export interface WeeklyShiftVerificationCamel {
  id: string;
  organisationId: string;
  projectId: number;
  weekStartDate: string; // YYYY-MM-DD (Saturday)
  weekEndDate: string; // YYYY-MM-DD (Friday)
  year: number;
  periodNumber: number;
  weekInPeriod: number; // 1-4
  signedOffShifts: SignedOffShift[];
  isFullySignedOff: boolean;
  completedById?: string;
  completedByName?: string;
  completedByRole?: UserRole;
  completedAt?: string; // ISO timestamp
  createdAt: string;
  updatedAt: string;
}
