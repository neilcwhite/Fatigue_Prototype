import { supabase } from './supabase';
import { Employee, Project, ShiftPattern, Assignment, Team, ProjectStats } from './types';
import { checkProjectCompliance } from './compliance';

export async function getEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase.from('employees').select('*').order('name');
  if (error) throw error;
  return data || [];
}

export async function createEmployee(employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>): Promise<Employee> {
  const { data, error } = await supabase.from('employees').insert(employee).select().single();
  if (error) throw error;
  return data;
}

export async function deleteEmployee(id: number): Promise<void> {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw error;
}

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from('projects').select('*').order('name');
  if (error) throw error;
  return data || [];
}

export async function createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project> {
  const { data, error } = await supabase.from('projects').insert(project).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProject(id: number): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

export async function getShiftPatterns(projectId?: number): Promise<ShiftPattern[]> {
  let query = supabase.from('shift_patterns').select('*').order('name');
  if (projectId) query = query.eq('project_id', projectId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createShiftPattern(pattern: Omit<ShiftPattern, 'created_at' | 'updated_at'>): Promise<ShiftPattern> {
  const { data, error } = await supabase.from('shift_patterns').insert(pattern).select().single();
  if (error) throw error;
  return data;
}

export async function getAssignments(projectId?: number): Promise<Assignment[]> {
  let query = supabase.from('assignments').select('*').order('date');
  if (projectId) query = query.eq('project_id', projectId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createAssignment(assignment: Omit<Assignment, 'id' | 'created_at' | 'updated_at'>): Promise<Assignment> {
  const { data, error } = await supabase.from('assignments').insert(assignment).select().single();
  if (error) throw error;
  return data;
}

export async function deleteAssignment(id: number): Promise<void> {
  const { error } = await supabase.from('assignments').delete().eq('id', id);
  if (error) throw error;
}

export async function getTeams(): Promise<Team[]> {
  const { data, error } = await supabase.from('teams').select('*').order('name');
  if (error) throw error;
  return data || [];
}

export async function createTeam(team: Omit<Team, 'id' | 'created_at' | 'updated_at'>): Promise<Team> {
  const { data, error } = await supabase.from('teams').insert(team).select().single();
  if (error) throw error;
  return data;
}

export async function getProjectStats(projectId: number): Promise<ProjectStats> {
  const assignments = await getAssignments(projectId);
  const patterns = await getShiftPatterns(projectId);

  let totalHours = 0;
  const employeeIds = new Set<number>();
  const patternMap = new Map(patterns.map(p => [p.id, p]));

  assignments.forEach(a => {
    employeeIds.add(a.employee_id);
    const pattern = patternMap.get(a.shift_pattern_id);
    if (pattern && pattern.start_time && pattern.end_time) {
      const [startH, startM] = pattern.start_time.split(':').map(Number);
      const [endH, endM] = pattern.end_time.split(':').map(Number);
      let duration = (endH + endM / 60) - (startH + startM / 60);
      if (duration < 0) duration += 24;
      totalHours += duration;
    }
  });

  const compliance = checkProjectCompliance(assignments, patterns);

  return {
    totalHours: Math.round(totalHours * 10) / 10,
    employeeCount: employeeIds.size,
    violationCount: compliance.errors.length,
    warningCount: compliance.warnings.length,
  };
}