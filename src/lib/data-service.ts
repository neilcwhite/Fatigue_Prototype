import { supabase } from './supabase';
import { Employee, Project, ShiftPattern, Assignment, Team, ProjectStats } from './types';
import { checkProjectCompliance } from './compliance';

// ==================== EMPLOYEES ====================

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

export async function updateEmployee(id: number, updates: Partial<Employee>): Promise<Employee> {
  const { data, error } = await supabase.from('employees').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteEmployee(id: number): Promise<void> {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw error;
}

// ==================== PROJECTS ====================

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

export async function updateProject(id: number, updates: Partial<Project>): Promise<Project> {
  const { data, error } = await supabase.from('projects').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProject(id: number): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

// ==================== SHIFT PATTERNS ====================

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

export async function updateShiftPattern(id: string, updates: Partial<ShiftPattern>): Promise<ShiftPattern> {
  const { data, error } = await supabase.from('shift_patterns').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteShiftPattern(id: string): Promise<void> {
  const { error } = await supabase.from('shift_patterns').delete().eq('id', id);
  if (error) throw error;
}

// ==================== ASSIGNMENTS ====================

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

export async function createAssignmentsBulk(assignments: Omit<Assignment, 'id' | 'created_at' | 'updated_at'>[]): Promise<Assignment[]> {
  const { data, error } = await supabase.from('assignments').insert(assignments).select();
  if (error) throw error;
  return data || [];
}

export async function updateAssignment(id: number, updates: Partial<Assignment>): Promise<Assignment> {
  const { data, error } = await supabase.from('assignments').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteAssignment(id: number): Promise<void> {
  const { error } = await supabase.from('assignments').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteAssignmentsBulk(ids: number[]): Promise<void> {
  const { error } = await supabase.from('assignments').delete().in('id', ids);
  if (error) throw error;
}

// ==================== TEAMS ====================

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

export async function updateTeam(id: number, updates: Partial<Team>): Promise<Team> {
  const { data, error } = await supabase.from('teams').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTeam(id: number): Promise<void> {
  const { error } = await supabase.from('teams').delete().eq('id', id);
  if (error) throw error;
}

// ==================== PROJECT STATS ====================

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

// ==================== ASSIGNMENT HELPERS ====================

export async function assignEmployeeToPattern(
  organisationId: string,
  employeeId: number,
  projectId: number,
  shiftPatternId: string,
  startDate: string,
  endDate: string
): Promise<Assignment[]> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const assignments: Omit<Assignment, 'id' | 'created_at' | 'updated_at'>[] = [];

  let current = new Date(start);
  while (current <= end) {
    assignments.push({
      organisation_id: organisationId,
      employee_id: employeeId,
      project_id: projectId,
      shift_pattern_id: shiftPatternId,
      date: current.toISOString().split('T')[0],
      custom_start_time: null,
      custom_end_time: null,
    });
    current.setDate(current.getDate() + 1);
  }

  return createAssignmentsBulk(assignments);
}

export async function assignTeamToPattern(
  organisationId: string,
  teamId: number,
  projectId: number,
  shiftPatternId: string,
  startDate: string,
  endDate: string
): Promise<Assignment[]> {
  const teams = await getTeams();
  const team = teams.find(t => t.id === teamId);
  
  if (!team || !team.member_ids || team.member_ids.length === 0) {
    throw new Error('Team has no members');
  }

  const allAssignments: Assignment[] = [];
  
  for (const employeeId of team.member_ids) {
    const assignments = await assignEmployeeToPattern(
      organisationId,
      employeeId,
      projectId,
      shiftPatternId,
      startDate,
      endDate
    );
    allAssignments.push(...assignments);
  }

  return allAssignments;
}
