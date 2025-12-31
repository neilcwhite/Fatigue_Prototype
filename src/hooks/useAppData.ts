'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { 
  EmployeeCamel, 
  ProjectCamel, 
  TeamCamel, 
  ShiftPatternCamel, 
  AssignmentCamel 
} from '@/lib/types';

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
  createProject: (name: string, location?: string, type?: string, startDate?: string, endDate?: string) => Promise<void>;
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

  const loadAllData = useCallback(async () => {
    if (!supabase || !organisationId) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      console.log('useAppData: loading data for org:', organisationId);
      
      const [employeesRes, projectsRes, teamsRes, patternsRes, assignmentsRes] = await Promise.all([
        supabase.from('employees').select('*').eq('organisation_id', organisationId).order('name'),
        supabase.from('projects').select('*').eq('organisation_id', organisationId).order('name'),
        supabase.from('teams').select('*').eq('organisation_id', organisationId).order('name'),
        supabase.from('shift_patterns').select('*').eq('organisation_id', organisationId).order('name'),
        supabase.from('assignments').select('*').eq('organisation_id', organisationId).order('date'),
      ]);
      
      console.log('useAppData: data loaded', {
        employees: employeesRes.data?.length,
        projects: projectsRes.data?.length,
        errors: { e: employeesRes.error, p: projectsRes.error }
      });

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
    } catch (err: any) {
      console.error('Error loading data:', err);
      setData(prev => ({ 
        ...prev, 
        loading: false, 
        error: err.message || 'Failed to load data' 
      }));
    }
  }, [organisationId]);

  // Initial load
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Set up realtime subscriptions
  useEffect(() => {
    if (!supabase || !organisationId) return;

    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        loadAllData();
      })
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [organisationId, loadAllData]);

  // ==================== PROJECT OPERATIONS ====================

  const createProject = async (name: string, location?: string, type?: string, startDate?: string, endDate?: string) => {
    if (!supabase || !organisationId) throw new Error('Not configured');
    
    const { error } = await supabase.from('projects').insert({
      name,
      location,
      type,
      start_date: startDate,
      end_date: endDate,
      organisation_id: organisationId,
    });
    
    if (error) throw error;
    await loadAllData();
  };

  const updateProject = async (id: number, updateData: Partial<ProjectCamel>) => {
    if (!supabase) throw new Error('Not configured');
    
    const { error } = await supabase.from('projects').update({
      name: updateData.name,
      location: updateData.location,
      start_date: updateData.startDate,
      end_date: updateData.endDate,
      type: updateData.type,
    }).eq('id', id);
    
    if (error) throw error;
    await loadAllData();
  };

  const deleteProject = async (id: number) => {
    if (!supabase) throw new Error('Not configured');
    
    const { error } = await supabase.from('projects').delete().eq('id', id);
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
    if (!supabase) throw new Error('Not configured');
    
    const { error } = await supabase.from('employees').update({
      name: updateData.name,
      role: updateData.role,
      email: updateData.email,
      team_id: updateData.teamId,
    }).eq('id', id);
    
    if (error) throw error;
    await loadAllData();
  };

  const deleteEmployee = async (id: number) => {
    if (!supabase) throw new Error('Not configured');
    
    const { error } = await supabase.from('employees').delete().eq('id', id);
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
    if (!supabase) throw new Error('Not configured');
    
    const { error } = await supabase.from('teams').update({
      name: updateData.name,
      member_ids: updateData.memberIds,
    }).eq('id', id);
    
    if (error) throw error;
    await loadAllData();
  };

  const deleteTeam = async (id: number) => {
    if (!supabase) throw new Error('Not configured');
    
    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (error) throw error;
    await loadAllData();
  };

  // ==================== SHIFT PATTERN OPERATIONS ====================

  const createShiftPattern = async (patternData: Omit<ShiftPatternCamel, 'id' | 'organisationId'> & { id?: string }) => {
    if (!supabase || !organisationId) throw new Error('Not configured');

    // Use provided ID or generate one
    const id = patternData.id || `${patternData.projectId}-${Date.now()}`;

    const { error } = await supabase.from('shift_patterns').insert({
      id,
      project_id: patternData.projectId,
      name: patternData.name,
      start_time: patternData.startTime,
      end_time: patternData.endTime,
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
    console.log('updateShiftPattern: starting update for id:', id);
    console.log('updateShiftPattern: data:', updateData);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase not configured');
    }

    const updatePayload = {
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
    };

    console.log('updateShiftPattern: payload:', updatePayload);

    // Use direct REST API fetch to avoid Supabase client hanging issues
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/shift_patterns?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(updatePayload),
        }
      );

      console.log('updateShiftPattern: fetch responded, status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('updateShiftPattern: fetch error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('updateShiftPattern: result:', { data });

    } catch (err: any) {
      console.error('updateShiftPattern: error:', err);
      throw err;
    }

    console.log('updateShiftPattern: reloading data...');
    await loadAllData();
    console.log('updateShiftPattern: complete');
  };

  const deleteShiftPattern = async (id: string) => {
    if (!supabase) throw new Error('Not configured');
    
    const { error } = await supabase.from('shift_patterns').delete().eq('id', id);
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
    if (!supabase) throw new Error('Not configured');
    
    const { error } = await supabase.from('assignments').update({
      employee_id: updateData.employeeId,
      project_id: updateData.projectId,
      shift_pattern_id: updateData.shiftPatternId,
      date: updateData.date,
      custom_start_time: updateData.customStartTime,
      custom_end_time: updateData.customEndTime,
      notes: updateData.notes,
    }).eq('id', id);
    
    if (error) throw error;
    await loadAllData();
  };

  const deleteAssignment = async (id: number) => {
    if (!supabase) throw new Error('Not configured');
    
    const { error } = await supabase.from('assignments').delete().eq('id', id);
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
