'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  EmployeeCamel,
  ProjectCamel,
  TeamCamel,
  ShiftPatternCamel,
  AssignmentCamel,
  FatigueAssessment,
  FatigueAssessmentRow,
} from '@/lib/types';

// ==================== VALIDATION HELPERS ====================

/**
 * Validate fatigue parameters are within acceptable bounds
 * NR Excel tool specifies workload/attention as 1-4 scale (1=highest demand, 4=lowest)
 */
export function validateFatigueParams(params: {
  workload?: number;
  attention?: number;
  commuteTime?: number;
  breakFrequency?: number;
  breakLength?: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (params.workload !== undefined && (params.workload < 1 || params.workload > 4)) {
    errors.push('Workload must be between 1 and 4');
  }
  if (params.attention !== undefined && (params.attention < 1 || params.attention > 4)) {
    errors.push('Attention must be between 1 and 4');
  }
  if (params.commuteTime !== undefined && (params.commuteTime < 0 || params.commuteTime > 480)) {
    errors.push('Commute time must be between 0 and 480 minutes (8 hours)');
  }
  if (params.breakFrequency !== undefined && (params.breakFrequency < 0 || params.breakFrequency > 720)) {
    errors.push('Break frequency must be between 0 and 720 minutes');
  }
  if (params.breakLength !== undefined && (params.breakLength < 0 || params.breakLength > 120)) {
    errors.push('Break length must be between 0 and 120 minutes');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate time string format (HH:MM)
 */
export function validateTimeString(time: string | undefined | null): boolean {
  if (!time) return true; // Allow null/undefined
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  return timeRegex.test(time);
}

/**
 * Validate date string format (YYYY-MM-DD)
 */
export function validateDateString(date: string | undefined | null): boolean {
  if (!date) return false; // Date is required for assignments
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;
  // Verify it's a valid date
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

/**
 * Validate a single DaySchedule entry
 */
interface DayScheduleEntry {
  startTime: string;
  endTime: string;
  commuteIn?: number;
  commuteOut?: number;
  workload?: number;
  attention?: number;
  breakFreq?: number;
  breakLen?: number;
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Calculate shift duration in minutes, handling overnight shifts
 */
function calculateShiftDuration(startTime: string, endTime: string): number {
  const startMins = parseTimeToMinutes(startTime);
  const endMins = parseTimeToMinutes(endTime);

  // If end is before start, it's an overnight shift
  if (endMins <= startMins) {
    return (24 * 60 - startMins) + endMins;
  }
  return endMins - startMins;
}

export function validateDaySchedule(day: DayScheduleEntry | null | undefined): { valid: boolean; errors: string[] } {
  if (!day) return { valid: true, errors: [] }; // null/undefined is allowed (rest day)

  const errors: string[] = [];

  // Validate time strings
  const startTimeValid = validateTimeString(day.startTime);
  const endTimeValid = validateTimeString(day.endTime);

  if (!startTimeValid) {
    errors.push('Invalid start time format (use HH:MM)');
  }
  if (!endTimeValid) {
    errors.push('Invalid end time format (use HH:MM)');
  }

  // Logical consistency checks (only if times are valid)
  if (startTimeValid && endTimeValid && day.startTime && day.endTime) {
    const shiftDuration = calculateShiftDuration(day.startTime, day.endTime);

    // Check shift duration is reasonable (minimum 1 hour, maximum 16 hours per Network Rail limits)
    if (shiftDuration < 60) {
      errors.push('Shift duration must be at least 1 hour');
    }
    if (shiftDuration > 16 * 60) {
      errors.push('Shift duration cannot exceed 16 hours');
    }

    // Check break frequency makes sense relative to shift length
    if (day.breakFreq !== undefined && day.breakFreq > 0) {
      if (day.breakFreq > shiftDuration) {
        errors.push(`Break frequency (${day.breakFreq} mins) exceeds shift duration (${Math.round(shiftDuration)} mins)`);
      }
    }
  }

  // Validate optional numeric fields
  if (day.commuteIn !== undefined && (day.commuteIn < 0 || day.commuteIn > 480)) {
    errors.push('Commute in must be between 0 and 480 minutes');
  }
  if (day.commuteOut !== undefined && (day.commuteOut < 0 || day.commuteOut > 480)) {
    errors.push('Commute out must be between 0 and 480 minutes');
  }
  if (day.workload !== undefined && (day.workload < 1 || day.workload > 4)) {
    errors.push('Workload must be between 1 and 4');
  }
  if (day.attention !== undefined && (day.attention < 1 || day.attention > 4)) {
    errors.push('Attention must be between 1 and 4');
  }
  if (day.breakFreq !== undefined && (day.breakFreq < 0 || day.breakFreq > 720)) {
    errors.push('Break frequency must be between 0 and 720 minutes');
  }
  if (day.breakLen !== undefined && (day.breakLen < 0 || day.breakLen > 120)) {
    errors.push('Break length must be between 0 and 120 minutes');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate weekly schedule object
 */
interface WeeklyScheduleInput {
  Sat?: DayScheduleEntry | null;
  Sun?: DayScheduleEntry | null;
  Mon?: DayScheduleEntry | null;
  Tue?: DayScheduleEntry | null;
  Wed?: DayScheduleEntry | null;
  Thu?: DayScheduleEntry | null;
  Fri?: DayScheduleEntry | null;
}

export function validateWeeklySchedule(schedule: WeeklyScheduleInput | undefined | null): { valid: boolean; errors: string[] } {
  if (!schedule) return { valid: true, errors: [] }; // null/undefined is allowed

  const errors: string[] = [];
  const days = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

  for (const day of days) {
    const dayData = schedule[day];
    const validation = validateDaySchedule(dayData);
    if (!validation.valid) {
      errors.push(`${day}: ${validation.errors.join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

interface AppData {
  employees: EmployeeCamel[];
  projects: ProjectCamel[];
  teams: TeamCamel[];
  shiftPatterns: ShiftPatternCamel[];
  assignments: AssignmentCamel[];
  fatigueAssessments: FatigueAssessment[];
  loading: boolean;
  error: string | null;
}

interface UseAppDataReturn extends AppData {
  reload: () => Promise<void>;
  // Project operations
  createProject: (name: string, startDate?: string, endDate?: string) => Promise<ProjectCamel>;
  updateProject: (id: number, data: Partial<ProjectCamel>) => Promise<void>;
  deleteProject: (id: number) => Promise<void>;
  // Employee operations
  createEmployee: (name: string, role?: string) => Promise<void>;
  updateEmployee: (id: number, data: Partial<EmployeeCamel>) => Promise<void>;
  deleteEmployee: (id: number) => Promise<void>;
  // Team operations
  createTeam: (name: string, memberIds?: number[]) => Promise<void>;
  updateTeam: (id: number, data: Partial<TeamCamel>) => Promise<void>;
  deleteTeam: (id: number) => Promise<void>;
  // Shift pattern operations
  createShiftPattern: (data: Omit<ShiftPatternCamel, 'id' | 'organisationId'>) => Promise<void>;
  updateShiftPattern: (id: string, data: Partial<ShiftPatternCamel>) => Promise<void>;
  deleteShiftPattern: (id: string) => Promise<void>;
  // Assignment operations
  createAssignment: (data: Omit<AssignmentCamel, 'id' | 'organisationId'>) => Promise<void>;
  updateAssignment: (id: number, data: Partial<AssignmentCamel>) => Promise<void>;
  deleteAssignment: (id: number) => Promise<void>;
  // Fatigue assessment operations
  createFatigueAssessment: (data: FatigueAssessment) => Promise<void>;
  updateFatigueAssessment: (id: string, data: Partial<FatigueAssessment>) => Promise<void>;
  deleteFatigueAssessment: (id: string) => Promise<void>;
}

export function useAppData(organisationId: string | null): UseAppDataReturn {
  const [data, setData] = useState<AppData>({
    employees: [],
    projects: [],
    teams: [],
    shiftPatterns: [],
    assignments: [],
    fatigueAssessments: [],
    loading: true,
    error: null,
  });

  const loadAllData = useCallback(async (isInitialLoad = false) => {
    if (!supabase || !organisationId) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      // Only show loading spinner on initial load, not on refreshes
      // This prevents the PlanningView from being unmounted/remounted
      if (isInitialLoad) {
        setData(prev => ({ ...prev, loading: true, error: null }));
      }

      const [employeesRes, projectsRes, teamsRes, patternsRes, assignmentsRes, assessmentsRes] = await Promise.all([
        supabase.from('employees').select('*').eq('organisation_id', organisationId).order('name'),
        supabase.from('projects').select('*').eq('organisation_id', organisationId).order('name'),
        supabase.from('teams').select('*').eq('organisation_id', organisationId).order('name'),
        supabase.from('shift_patterns').select('*').eq('organisation_id', organisationId).order('name'),
        supabase.from('assignments').select('*').eq('organisation_id', organisationId).order('date'),
        supabase.from('fatigue_assessments').select('*').eq('organisation_id', organisationId).order('assessment_date', { ascending: false }),
      ]);

      // Check for errors on any query - surface them instead of silently showing empty data
      // Note: fatigue_assessments table may not exist yet, so we handle that gracefully
      const errors = [
        employeesRes.error && `Employees: ${employeesRes.error.message}`,
        projectsRes.error && `Projects: ${projectsRes.error.message}`,
        teamsRes.error && `Teams: ${teamsRes.error.message}`,
        patternsRes.error && `Shift patterns: ${patternsRes.error.message}`,
        assignmentsRes.error && `Assignments: ${assignmentsRes.error.message}`,
        // Don't fail if fatigue_assessments table doesn't exist - it's optional
        assessmentsRes.error && !assessmentsRes.error.message.includes('does not exist') && `Assessments: ${assessmentsRes.error.message}`,
      ].filter(Boolean);

      if (errors.length > 0) {
        throw new Error(`Data load failed - check RLS policies. ${errors.join('; ')}`);
      }

      // Map snake_case to camelCase for compatibility with v76 code
      const employees: EmployeeCamel[] = (employeesRes.data || []).map(e => ({
        id: e.id,
        name: e.name,
        role: e.role,
        email: e.email,
        teamId: e.team_id,
        organisationId: e.organisation_id,
      }));

      const projects: ProjectCamel[] = (projectsRes.data || []).map(p => ({
        id: p.id,
        name: p.name,
        startDate: p.start_date,
        endDate: p.end_date,
        organisationId: p.organisation_id,
      }));

      const teams: TeamCamel[] = (teamsRes.data || []).map(t => ({
        id: t.id,
        name: t.name,
        memberIds: t.member_ids || [],
        organisationId: t.organisation_id,
      }));

      const shiftPatterns: ShiftPatternCamel[] = (patternsRes.data || []).map(sp => ({
        id: sp.id,
        projectId: sp.project_id,
        name: sp.name,
        startTime: sp.start_time,
        endTime: sp.end_time,
        weeklySchedule: sp.weekly_schedule,
        dutyType: sp.duty_type || 'Non-Possession',
        isNight: sp.is_night || false,
        organisationId: sp.organisation_id,
        createdAt: sp.created_at,
        // Fatigue parameters
        workload: sp.workload,
        attention: sp.attention,
        commuteTime: sp.commute_time,
        breakFrequency: sp.break_frequency,
        breakLength: sp.break_length,
      }));

      const assignments: AssignmentCamel[] = (assignmentsRes.data || []).map(a => ({
        id: a.id,
        employeeId: a.employee_id,
        projectId: a.project_id,
        shiftPatternId: a.shift_pattern_id,
        date: a.date,
        customStartTime: a.custom_start_time,
        customEndTime: a.custom_end_time,
        notes: a.notes,
        organisationId: a.organisation_id,
        // Fatigue parameters
        commuteIn: a.commute_in,
        commuteOut: a.commute_out,
        workload: a.workload,
        attention: a.attention,
        breakFrequency: a.break_frequency,
        breakLength: a.break_length,
      }));

      // Map fatigue assessments from snake_case to camelCase
      const fatigueAssessments: FatigueAssessment[] = (assessmentsRes.data || []).map((fa: FatigueAssessmentRow) => ({
        id: fa.id,
        organisationId: fa.organisation_id,
        employeeId: fa.employee_id,
        employeeName: fa.employee_name,
        jobTitle: fa.job_title,
        contractNo: fa.contract_no,
        location: fa.location,
        assessmentDate: fa.assessment_date,
        shiftStartTime: fa.shift_start_time,
        shiftEndTime: fa.shift_end_time,
        assessorName: fa.assessor_name,
        assessorRole: fa.assessor_role,
        violationType: fa.violation_type as FatigueAssessment['violationType'],
        violationDate: fa.violation_date,
        assignmentId: fa.assignment_id,
        assessmentReasons: fa.assessment_reasons || [],
        assessmentAnswers: fa.assessment_answers || [],
        totalScore: fa.total_score,
        exceedanceLevel: fa.exceedance_level,
        calculatedRiskLevel: fa.calculated_risk_level,
        finalRiskLevel: fa.final_risk_level,
        riskAdjustmentNotes: fa.risk_adjustment_notes,
        appliedMitigations: fa.applied_mitigations || [],
        otherMitigationDetails: fa.other_mitigation_details,
        employeeAccepted: fa.employee_accepted,
        employeeAcceptanceDate: fa.employee_acceptance_date,
        employeeComments: fa.employee_comments,
        managerApproved: fa.manager_approved,
        managerApprovalDate: fa.manager_approval_date,
        managerName: fa.manager_name,
        managerComments: fa.manager_comments,
        status: fa.status,
        createdAt: fa.created_at,
        updatedAt: fa.updated_at,
      }));

      setData({
        employees,
        projects,
        teams,
        shiftPatterns,
        assignments,
        fatigueAssessments,
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setData(prev => ({
        ...prev,
        loading: false,
        error: message
      }));
    }
  }, [organisationId]);

  // Initial load
  useEffect(() => {
    loadAllData(true); // Pass true for initial load to show spinner
  }, [loadAllData]);

  // Debounce ref for realtime updates - prevents rapid-fire reloads during bulk operations
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const DEBOUNCE_MS = 500; // Wait 500ms after last change before reloading

  // Set up realtime subscriptions - scoped by table and organisation
  useEffect(() => {
    if (!supabase || !organisationId) return;

    const tables = ['employees', 'projects', 'teams', 'shift_patterns', 'assignments', 'fatigue_assessments'];

    const channel = supabase.channel(`org-${organisationId}-changes`);

    // Debounced reload function - coalesces rapid changes into single reload
    const debouncedReload = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        loadAllData();
        debounceTimerRef.current = null;
      }, DEBOUNCE_MS);
    };

    // Subscribe to each table, filtered by organisation_id
    tables.forEach(table => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: `organisation_id=eq.${organisationId}`,
        },
        () => {
          debouncedReload();
        }
      );
    });

    channel.subscribe();

    return () => {
      // Clean up debounce timer on unmount
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [organisationId, loadAllData]);

  // ==================== PROJECT OPERATIONS ====================

  const createProject = async (name: string, startDate?: string, endDate?: string): Promise<ProjectCamel> => {
    if (!supabase || !organisationId) throw new Error('Not configured');

    const { data, error } = await supabase.from('projects').insert({
      name,
      start_date: startDate,
      end_date: endDate,
      organisation_id: organisationId,
    }).select().single();

    if (error) throw error;
    await loadAllData();

    // Return the created project in camelCase format
    return {
      id: data.id,
      name: data.name,
      startDate: data.start_date,
      endDate: data.end_date,
      organisationId: data.organisation_id,
    };
  };

  const updateProject = async (id: number, updateData: Partial<ProjectCamel>) => {
    if (!supabase || !organisationId) throw new Error('Not configured');

    // Include organisation_id filter to prevent cross-tenant writes
    const { error } = await supabase.from('projects').update({
      name: updateData.name,
      start_date: updateData.startDate,
      end_date: updateData.endDate,
    }).eq('id', id).eq('organisation_id', organisationId);

    if (error) throw error;
    await loadAllData();
  };

  const deleteProject = async (id: number) => {
    if (!supabase || !organisationId) throw new Error('Not configured');

    // Include organisation_id filter to prevent cross-tenant deletes
    const { error } = await supabase.from('projects').delete().eq('id', id).eq('organisation_id', organisationId);
    if (error) throw error;
    await loadAllData();
  };

  // ==================== EMPLOYEE OPERATIONS ====================

  const createEmployee = async (name: string, role?: string) => {
    if (!supabase || !organisationId) throw new Error('Not configured');
    
    const { error } = await supabase.from('employees').insert({
      name,
      role,
      organisation_id: organisationId,
    });
    
    if (error) throw error;
    await loadAllData();
  };

  const updateEmployee = async (id: number, updateData: Partial<EmployeeCamel>) => {
    if (!supabase || !organisationId) throw new Error('Not configured');

    // Include organisation_id filter to prevent cross-tenant writes
    const { error } = await supabase.from('employees').update({
      name: updateData.name,
      role: updateData.role,
      email: updateData.email,
      team_id: updateData.teamId,
    }).eq('id', id).eq('organisation_id', organisationId);

    if (error) throw error;
    await loadAllData();
  };

  const deleteEmployee = async (id: number) => {
    if (!supabase || !organisationId) throw new Error('Not configured');

    // Include organisation_id filter to prevent cross-tenant deletes
    const { error } = await supabase.from('employees').delete().eq('id', id).eq('organisation_id', organisationId);
    if (error) throw error;
    await loadAllData();
  };

  // ==================== TEAM OPERATIONS ====================

  const createTeam = async (name: string, memberIds: number[] = []) => {
    if (!supabase || !organisationId) throw new Error('Not configured');
    
    const { error } = await supabase.from('teams').insert({
      name,
      member_ids: memberIds,
      organisation_id: organisationId,
    });
    
    if (error) throw error;
    await loadAllData();
  };

  const updateTeam = async (id: number, updateData: Partial<TeamCamel>) => {
    if (!supabase || !organisationId) throw new Error('Not configured');

    // Include organisation_id filter to prevent cross-tenant writes
    const { error } = await supabase.from('teams').update({
      name: updateData.name,
      member_ids: updateData.memberIds,
    }).eq('id', id).eq('organisation_id', organisationId);

    if (error) throw error;
    await loadAllData();
  };

  const deleteTeam = async (id: number) => {
    if (!supabase || !organisationId) throw new Error('Not configured');

    // Include organisation_id filter to prevent cross-tenant deletes
    const { error } = await supabase.from('teams').delete().eq('id', id).eq('organisation_id', organisationId);
    if (error) throw error;
    await loadAllData();
  };

  // ==================== SHIFT PATTERN OPERATIONS ====================

  const createShiftPattern = async (patternData: Omit<ShiftPatternCamel, 'id' | 'organisationId'>) => {
    if (!supabase || !organisationId) throw new Error('Not configured');

    // SECURITY: Always use server-generated UUIDs - never accept client IDs
    // Client-supplied IDs could enable ID spoofing or collisions
    const id = crypto.randomUUID();

    // Validate time strings
    if (!validateTimeString(patternData.startTime)) {
      throw new Error('Invalid start time format. Use HH:MM format.');
    }
    if (!validateTimeString(patternData.endTime)) {
      throw new Error('Invalid end time format. Use HH:MM format.');
    }

    // Validate fatigue parameters
    const fatigueValidation = validateFatigueParams({
      workload: patternData.workload,
      attention: patternData.attention,
      commuteTime: patternData.commuteTime,
      breakFrequency: patternData.breakFrequency,
      breakLength: patternData.breakLength,
    });
    if (!fatigueValidation.valid) {
      throw new Error(`Invalid fatigue parameters: ${fatigueValidation.errors.join(', ')}`);
    }

    // Validate weekly schedule entries if provided
    const scheduleValidation = validateWeeklySchedule(patternData.weeklySchedule);
    if (!scheduleValidation.valid) {
      throw new Error(`Invalid weekly schedule: ${scheduleValidation.errors.join('; ')}`);
    }

    // Convert empty strings to null for time fields (database expects null, not "")
    const startTime = patternData.startTime || null;
    const endTime = patternData.endTime || null;

    const { error } = await supabase.from('shift_patterns').insert({
      id,
      project_id: patternData.projectId,
      name: patternData.name,
      start_time: startTime,
      end_time: endTime,
      weekly_schedule: patternData.weeklySchedule,
      duty_type: patternData.dutyType,
      is_night: patternData.isNight,
      organisation_id: organisationId,
      // Fatigue parameters
      workload: patternData.workload,
      attention: patternData.attention,
      commute_time: patternData.commuteTime,
      break_frequency: patternData.breakFrequency,
      break_length: patternData.breakLength,
    });

    if (error) throw error;
    await loadAllData();
  };

  const updateShiftPattern = async (id: string, updateData: Partial<ShiftPatternCamel>) => {
    if (!supabase || !organisationId) throw new Error('Not configured');

    // Validate time strings if provided
    if (updateData.startTime !== undefined && !validateTimeString(updateData.startTime)) {
      throw new Error('Invalid start time format. Use HH:MM format.');
    }
    if (updateData.endTime !== undefined && !validateTimeString(updateData.endTime)) {
      throw new Error('Invalid end time format. Use HH:MM format.');
    }

    // Validate fatigue parameters if any are provided
    const fatigueValidation = validateFatigueParams({
      workload: updateData.workload,
      attention: updateData.attention,
      commuteTime: updateData.commuteTime,
      breakFrequency: updateData.breakFrequency,
      breakLength: updateData.breakLength,
    });
    if (!fatigueValidation.valid) {
      throw new Error(`Invalid fatigue parameters: ${fatigueValidation.errors.join(', ')}`);
    }

    // Validate weekly schedule entries if provided
    if (updateData.weeklySchedule !== undefined) {
      const scheduleValidation = validateWeeklySchedule(updateData.weeklySchedule);
      if (!scheduleValidation.valid) {
        throw new Error(`Invalid weekly schedule: ${scheduleValidation.errors.join('; ')}`);
      }
    }

    // Include organisation_id filter to prevent cross-tenant writes
    const { error } = await supabase.from('shift_patterns').update({
      name: updateData.name,
      start_time: updateData.startTime,
      end_time: updateData.endTime,
      weekly_schedule: updateData.weeklySchedule,
      duty_type: updateData.dutyType,
      is_night: updateData.isNight,
      // Fatigue parameters
      workload: updateData.workload,
      attention: updateData.attention,
      commute_time: updateData.commuteTime,
      break_frequency: updateData.breakFrequency,
      break_length: updateData.breakLength,
    }).eq('id', id).eq('organisation_id', organisationId);

    if (error) throw error;
    await loadAllData();
  };

  const deleteShiftPattern = async (id: string) => {
    if (!supabase || !organisationId) throw new Error('Not configured');

    // Include organisation_id filter to prevent cross-tenant deletes
    const { error } = await supabase.from('shift_patterns').delete().eq('id', id).eq('organisation_id', organisationId);
    if (error) throw error;
    await loadAllData();
  };

  // ==================== ASSIGNMENT OPERATIONS ====================

  const createAssignment = async (assignmentData: Omit<AssignmentCamel, 'id' | 'organisationId'>) => {
    if (!supabase || !organisationId) throw new Error('Not configured');

    // Validate required date field
    if (!validateDateString(assignmentData.date)) {
      throw new Error('Invalid or missing date. Use YYYY-MM-DD format.');
    }

    // Validate optional custom time fields
    if (assignmentData.customStartTime !== undefined && !validateTimeString(assignmentData.customStartTime)) {
      throw new Error('Invalid custom start time format. Use HH:MM format.');
    }
    if (assignmentData.customEndTime !== undefined && !validateTimeString(assignmentData.customEndTime)) {
      throw new Error('Invalid custom end time format. Use HH:MM format.');
    }

    // Validate fatigue parameters if provided
    const fatigueValidation = validateFatigueParams({
      workload: assignmentData.workload,
      attention: assignmentData.attention,
      commuteTime: (assignmentData.commuteIn ?? 0) + (assignmentData.commuteOut ?? 0),
      breakFrequency: assignmentData.breakFrequency,
      breakLength: assignmentData.breakLength,
    });
    if (!fatigueValidation.valid) {
      throw new Error(`Invalid fatigue parameters: ${fatigueValidation.errors.join(', ')}`);
    }

    const { error } = await supabase.from('assignments').insert({
      employee_id: assignmentData.employeeId,
      project_id: assignmentData.projectId,
      shift_pattern_id: assignmentData.shiftPatternId,
      date: assignmentData.date,
      custom_start_time: assignmentData.customStartTime,
      custom_end_time: assignmentData.customEndTime,
      notes: assignmentData.notes,
      organisation_id: organisationId,
      // Fatigue parameters
      commute_in: assignmentData.commuteIn,
      commute_out: assignmentData.commuteOut,
      workload: assignmentData.workload,
      attention: assignmentData.attention,
      break_frequency: assignmentData.breakFrequency,
      break_length: assignmentData.breakLength,
    });

    if (error) throw error;
    await loadAllData();
  };

  const updateAssignment = async (id: number, updateData: Partial<AssignmentCamel>) => {
    if (!supabase || !organisationId) throw new Error('Not configured');

    // Validate date field if provided
    if (updateData.date !== undefined && !validateDateString(updateData.date)) {
      throw new Error('Invalid date format. Use YYYY-MM-DD format.');
    }

    // Validate custom time fields if provided
    if (updateData.customStartTime !== undefined && !validateTimeString(updateData.customStartTime)) {
      throw new Error('Invalid custom start time format. Use HH:MM format.');
    }
    if (updateData.customEndTime !== undefined && !validateTimeString(updateData.customEndTime)) {
      throw new Error('Invalid custom end time format. Use HH:MM format.');
    }

    // Validate fatigue parameters if any are provided
    const fatigueValidation = validateFatigueParams({
      workload: updateData.workload,
      attention: updateData.attention,
      commuteTime: (updateData.commuteIn ?? 0) + (updateData.commuteOut ?? 0),
      breakFrequency: updateData.breakFrequency,
      breakLength: updateData.breakLength,
    });
    if (!fatigueValidation.valid) {
      throw new Error(`Invalid fatigue parameters: ${fatigueValidation.errors.join(', ')}`);
    }

    // Include organisation_id filter to prevent cross-tenant writes
    const { error } = await supabase.from('assignments').update({
      employee_id: updateData.employeeId,
      project_id: updateData.projectId,
      shift_pattern_id: updateData.shiftPatternId,
      date: updateData.date,
      custom_start_time: updateData.customStartTime,
      custom_end_time: updateData.customEndTime,
      notes: updateData.notes,
      // Fatigue parameters
      commute_in: updateData.commuteIn,
      commute_out: updateData.commuteOut,
      workload: updateData.workload,
      attention: updateData.attention,
      break_frequency: updateData.breakFrequency,
      break_length: updateData.breakLength,
    }).eq('id', id).eq('organisation_id', organisationId);

    if (error) throw error;
    await loadAllData();
  };

  const deleteAssignment = async (id: number) => {
    if (!supabase || !organisationId) throw new Error('Not configured');

    // Include organisation_id filter to prevent cross-tenant deletes
    const { error } = await supabase.from('assignments').delete().eq('id', id).eq('organisation_id', organisationId);
    if (error) throw error;
    await loadAllData();
  };

  // ==================== FATIGUE ASSESSMENT OPERATIONS ====================

  const createFatigueAssessment = async (assessment: FatigueAssessment) => {
    if (!supabase || !organisationId) throw new Error('Not configured');

    // Generate a new ID if not provided
    const id = assessment.id || crypto.randomUUID();

    const { error } = await supabase.from('fatigue_assessments').insert({
      id,
      organisation_id: organisationId,
      employee_id: assessment.employeeId,
      employee_name: assessment.employeeName,
      job_title: assessment.jobTitle,
      contract_no: assessment.contractNo,
      location: assessment.location,
      assessment_date: assessment.assessmentDate,
      shift_start_time: assessment.shiftStartTime,
      shift_end_time: assessment.shiftEndTime,
      assessor_name: assessment.assessorName,
      assessor_role: assessment.assessorRole,
      violation_type: assessment.violationType,
      violation_date: assessment.violationDate,
      assignment_id: assessment.assignmentId,
      assessment_reasons: assessment.assessmentReasons,
      assessment_answers: assessment.assessmentAnswers,
      total_score: assessment.totalScore,
      exceedance_level: assessment.exceedanceLevel,
      calculated_risk_level: assessment.calculatedRiskLevel,
      final_risk_level: assessment.finalRiskLevel,
      risk_adjustment_notes: assessment.riskAdjustmentNotes,
      applied_mitigations: assessment.appliedMitigations,
      other_mitigation_details: assessment.otherMitigationDetails,
      employee_accepted: assessment.employeeAccepted,
      employee_acceptance_date: assessment.employeeAcceptanceDate,
      employee_comments: assessment.employeeComments,
      manager_approved: assessment.managerApproved,
      manager_approval_date: assessment.managerApprovalDate,
      manager_name: assessment.managerName,
      manager_comments: assessment.managerComments,
      status: assessment.status,
    });

    if (error) throw error;
    await loadAllData();
  };

  const updateFatigueAssessment = async (id: string, updateData: Partial<FatigueAssessment>) => {
    if (!supabase || !organisationId) throw new Error('Not configured');

    // Build the update object, only including defined fields
    const updateObj: Record<string, unknown> = {};
    if (updateData.employeeName !== undefined) updateObj.employee_name = updateData.employeeName;
    if (updateData.jobTitle !== undefined) updateObj.job_title = updateData.jobTitle;
    if (updateData.contractNo !== undefined) updateObj.contract_no = updateData.contractNo;
    if (updateData.location !== undefined) updateObj.location = updateData.location;
    if (updateData.assessmentDate !== undefined) updateObj.assessment_date = updateData.assessmentDate;
    if (updateData.shiftStartTime !== undefined) updateObj.shift_start_time = updateData.shiftStartTime;
    if (updateData.shiftEndTime !== undefined) updateObj.shift_end_time = updateData.shiftEndTime;
    if (updateData.assessorName !== undefined) updateObj.assessor_name = updateData.assessorName;
    if (updateData.assessorRole !== undefined) updateObj.assessor_role = updateData.assessorRole;
    if (updateData.assessmentReasons !== undefined) updateObj.assessment_reasons = updateData.assessmentReasons;
    if (updateData.assessmentAnswers !== undefined) updateObj.assessment_answers = updateData.assessmentAnswers;
    if (updateData.totalScore !== undefined) updateObj.total_score = updateData.totalScore;
    if (updateData.exceedanceLevel !== undefined) updateObj.exceedance_level = updateData.exceedanceLevel;
    if (updateData.calculatedRiskLevel !== undefined) updateObj.calculated_risk_level = updateData.calculatedRiskLevel;
    if (updateData.finalRiskLevel !== undefined) updateObj.final_risk_level = updateData.finalRiskLevel;
    if (updateData.riskAdjustmentNotes !== undefined) updateObj.risk_adjustment_notes = updateData.riskAdjustmentNotes;
    if (updateData.appliedMitigations !== undefined) updateObj.applied_mitigations = updateData.appliedMitigations;
    if (updateData.otherMitigationDetails !== undefined) updateObj.other_mitigation_details = updateData.otherMitigationDetails;
    if (updateData.employeeAccepted !== undefined) updateObj.employee_accepted = updateData.employeeAccepted;
    if (updateData.employeeAcceptanceDate !== undefined) updateObj.employee_acceptance_date = updateData.employeeAcceptanceDate;
    if (updateData.employeeComments !== undefined) updateObj.employee_comments = updateData.employeeComments;
    if (updateData.managerApproved !== undefined) updateObj.manager_approved = updateData.managerApproved;
    if (updateData.managerApprovalDate !== undefined) updateObj.manager_approval_date = updateData.managerApprovalDate;
    if (updateData.managerName !== undefined) updateObj.manager_name = updateData.managerName;
    if (updateData.managerComments !== undefined) updateObj.manager_comments = updateData.managerComments;
    if (updateData.status !== undefined) updateObj.status = updateData.status;

    const { error } = await supabase
      .from('fatigue_assessments')
      .update(updateObj)
      .eq('id', id)
      .eq('organisation_id', organisationId);

    if (error) throw error;
    await loadAllData();
  };

  const deleteFatigueAssessment = async (id: string) => {
    if (!supabase || !organisationId) throw new Error('Not configured');

    const { error } = await supabase
      .from('fatigue_assessments')
      .delete()
      .eq('id', id)
      .eq('organisation_id', organisationId);

    if (error) throw error;
    await loadAllData();
  };

  return {
    ...data,
    reload: loadAllData,
    createProject,
    updateProject,
    deleteProject,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    createTeam,
    updateTeam,
    deleteTeam,
    createShiftPattern,
    updateShiftPattern,
    deleteShiftPattern,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    createFatigueAssessment,
    updateFatigueAssessment,
    deleteFatigueAssessment,
  };
}
