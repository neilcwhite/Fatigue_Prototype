'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  EmployeeCamel,
  ProjectCamel,
  TeamCamel,
  ShiftPatternCamel,
  AssignmentCamel
} from '@/lib/types';

// ==================== VALIDATION HELPERS ====================

/**
 * Validate fatigue parameters are within acceptable bounds
 * RR446 specifies workload/attention as 1-5 scale
 */
export function validateFatigueParams(params: {
  workload?: number;
  attention?: number;
  commuteTime?: number;
  breakFrequency?: number;
  breakLength?: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (params.workload !== undefined && (params.workload < 1 || params.workload > 5)) {
    errors.push('Workload must be between 1 and 5');
  }
  if (params.attention !== undefined && (params.attention < 1 || params.attention > 5)) {
    errors.push('Attention must be between 1 and 5');
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

interface AppData {
  employees: EmployeeCamel[];
  projects: ProjectCamel[];
  teams: TeamCamel[];
  shiftPatterns: ShiftPatternCamel[];
  assignments: AssignmentCamel[];
  loading: boolean;
  error: string | null;
}

interface UseAppDataReturn extends AppData {
  reload: () => Promise<void>;
  // Project operations
  createProject: (name: string, location?: string, type?: string, startDate?: string, endDate?: string) => Promise<ProjectCamel>;
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
}

export function useAppData(organisationId: string | null): UseAppDataReturn {
  const [data, setData] = useState<AppData>({
    employees: [],
    projects: [],
    teams: [],
    shiftPatterns: [],
    assignments: [],
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

      const [employeesRes, projectsRes, teamsRes, patternsRes, assignmentsRes] = await Promise.all([
        supabase.from('employees').select('*').eq('organisation_id', organisationId).order('name'),
        supabase.from('projects').select('*').eq('organisation_id', organisationId).order('name'),
        supabase.from('teams').select('*').eq('organisation_id', organisationId).order('name'),
        supabase.from('shift_patterns').select('*').eq('organisation_id', organisationId).order('name'),
        supabase.from('assignments').select('*').eq('organisation_id', organisationId).order('date'),
      ]);

      // Check for errors on any query - surface them instead of silently showing empty data
      const errors = [
        employeesRes.error && `Employees: ${employeesRes.error.message}`,
        projectsRes.error && `Projects: ${projectsRes.error.message}`,
        teamsRes.error && `Teams: ${teamsRes.error.message}`,
        patternsRes.error && `Shift patterns: ${patternsRes.error.message}`,
        assignmentsRes.error && `Assignments: ${assignmentsRes.error.message}`,
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
        location: p.location,
        startDate: p.start_date,
        endDate: p.end_date,
        type: p.type,
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
      }));

      setData({
        employees,
        projects,
        teams,
        shiftPatterns,
        assignments,
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

    const tables = ['employees', 'projects', 'teams', 'shift_patterns', 'assignments'];

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

  const createProject = async (name: string, location?: string, type?: string, startDate?: string, endDate?: string): Promise<ProjectCamel> => {
    if (!supabase || !organisationId) throw new Error('Not configured');

    const { data, error } = await supabase.from('projects').insert({
      name,
      location,
      type,
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
      location: data.location,
      type: data.type,
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
      location: updateData.location,
      start_date: updateData.startDate,
      end_date: updateData.endDate,
      type: updateData.type,
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
    
    const { error } = await supabase.from('assignments').insert({
      employee_id: assignmentData.employeeId,
      project_id: assignmentData.projectId,
      shift_pattern_id: assignmentData.shiftPatternId,
      date: assignmentData.date,
      custom_start_time: assignmentData.customStartTime,
      custom_end_time: assignmentData.customEndTime,
      notes: assignmentData.notes,
      organisation_id: organisationId,
    });
    
    if (error) throw error;
    await loadAllData();
  };

  const updateAssignment = async (id: number, updateData: Partial<AssignmentCamel>) => {
    if (!supabase || !organisationId) throw new Error('Not configured');

    // Include organisation_id filter to prevent cross-tenant writes
    const { error } = await supabase.from('assignments').update({
      employee_id: updateData.employeeId,
      project_id: updateData.projectId,
      shift_pattern_id: updateData.shiftPatternId,
      date: updateData.date,
      custom_start_time: updateData.customStartTime,
      custom_end_time: updateData.customEndTime,
      notes: updateData.notes,
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
  };
}
