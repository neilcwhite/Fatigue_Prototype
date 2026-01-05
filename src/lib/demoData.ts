/**
 * Demo data for onboarding tutorial
 * This data shows realistic scenarios including compliance violations
 * Uses negative IDs to distinguish from real database data
 */

import type {
  ProjectCamel,
  EmployeeCamel,
  ShiftPatternCamel,
  AssignmentCamel,
  TeamCamel
} from './types';

// Demo IDs - negative numbers to avoid collision with real data
const DEMO_ORG_ID = 'demo_org_001';

// Demo Projects (using negative IDs)
export const DEMO_PROJECTS: ProjectCamel[] = [
  {
    id: -1,
    organisationId: DEMO_ORG_ID,
    name: 'Northern Line Maintenance',
  },
  {
    id: -2,
    organisationId: DEMO_ORG_ID,
    name: 'Station Upgrade Project',
  },
];

// Demo Teams
export const DEMO_TEAMS: TeamCamel[] = [
  {
    id: -1,
    organisationId: DEMO_ORG_ID,
    name: 'Night Shift Crew',
    memberIds: [-1, -2],
  },
  {
    id: -2,
    organisationId: DEMO_ORG_ID,
    name: 'Day Shift Crew',
    memberIds: [-3, -4],
  },
];

// Demo Employees - mix of compliant and non-compliant schedules
export const DEMO_EMPLOYEES: EmployeeCamel[] = [
  {
    id: -1,
    organisationId: DEMO_ORG_ID,
    name: 'John Smith',
    email: 'john.smith@demo.com',
    role: 'Track Engineer',
    teamId: -1,
  },
  {
    id: -2,
    organisationId: DEMO_ORG_ID,
    name: 'Sarah Johnson',
    email: 'sarah.johnson@demo.com',
    role: 'Site Supervisor',
    teamId: -1,
  },
  {
    id: -3,
    organisationId: DEMO_ORG_ID,
    name: 'Mike Brown',
    email: 'mike.brown@demo.com',
    role: 'Electrician',
    teamId: -2,
  },
  {
    id: -4,
    organisationId: DEMO_ORG_ID,
    name: 'Emma Wilson',
    email: 'emma.wilson@demo.com',
    role: 'Safety Officer',
    teamId: -2,
  },
];

// Demo Shift Patterns
export const DEMO_SHIFT_PATTERNS: ShiftPatternCamel[] = [
  {
    id: 'demo_pattern_001',
    projectId: -1,
    name: 'Night Shift',
    startTime: '22:00',
    endTime: '06:00',
    dutyType: 'Possession',
    isNight: true,
    organisationId: DEMO_ORG_ID,
  },
  {
    id: 'demo_pattern_002',
    projectId: -1,
    name: 'Early Morning',
    startTime: '05:00',
    endTime: '13:00',
    dutyType: 'Possession',
    isNight: false,
    organisationId: DEMO_ORG_ID,
  },
  {
    id: 'demo_pattern_003',
    projectId: -2,
    name: 'Day Shift',
    startTime: '08:00',
    endTime: '18:00',
    dutyType: 'Non-Possession',
    isNight: false,
    organisationId: DEMO_ORG_ID,
  },
  {
    id: 'demo_pattern_004',
    projectId: -2,
    name: 'Extended Day',
    startTime: '07:00',
    endTime: '19:00',
    dutyType: 'Non-Possession',
    isNight: false,
    organisationId: DEMO_ORG_ID,
  },
];

// Helper to generate dates relative to today
function getDateString(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().split('T')[0];
}

// Demo Assignments - designed to show various compliance scenarios
export function generateDemoAssignments(): AssignmentCamel[] {
  const assignments: AssignmentCamel[] = [];
  let assignmentId = -1;

  // John Smith - 8 consecutive night shifts (violation: max 7 nights)
  for (let i = 0; i < 8; i++) {
    assignments.push({
      id: assignmentId--,
      organisationId: DEMO_ORG_ID,
      projectId: -1,
      employeeId: -1,
      shiftPatternId: 'demo_pattern_001',
      date: getDateString(i - 3), // Start 3 days ago
    });
  }

  // Sarah Johnson - Short rest between shifts (violation: less than 11 hours)
  // Night shift ending 06:00, then early morning starting 05:00 next day = only 23 hours rest
  assignments.push({
    id: assignmentId--,
    organisationId: DEMO_ORG_ID,
    projectId: -1,
    employeeId: -2,
    shiftPatternId: 'demo_pattern_001', // Night 22:00-06:00
    date: getDateString(0),
  });
  assignments.push({
    id: assignmentId--,
    organisationId: DEMO_ORG_ID,
    projectId: -1,
    employeeId: -2,
    shiftPatternId: 'demo_pattern_002', // Early 05:00-13:00 (only 23hr rest!)
    date: getDateString(1),
  });

  // Mike Brown - Compliant schedule (good example)
  for (let i = 0; i < 5; i++) {
    assignments.push({
      id: assignmentId--,
      organisationId: DEMO_ORG_ID,
      projectId: -2,
      employeeId: -3,
      shiftPatternId: 'demo_pattern_003', // Day 08:00-18:00
      date: getDateString(i),
    });
  }

  // Emma Wilson - Extended shifts causing high fatigue (FRI warning)
  for (let i = 0; i < 6; i++) {
    assignments.push({
      id: assignmentId--,
      organisationId: DEMO_ORG_ID,
      projectId: -2,
      employeeId: -4,
      shiftPatternId: 'demo_pattern_004', // Extended 07:00-19:00 (12hr shifts)
      date: getDateString(i),
    });
  }

  return assignments;
}

// Check if an ID is demo data
export function isDemoId(id: number | string): boolean {
  if (typeof id === 'number') {
    return id < 0;
  }
  return id.startsWith('demo_');
}

// Get all demo data as a bundle
export function getDemoDataBundle() {
  return {
    projects: DEMO_PROJECTS,
    teams: DEMO_TEAMS,
    employees: DEMO_EMPLOYEES,
    shiftPatterns: DEMO_SHIFT_PATTERNS,
    assignments: generateDemoAssignments(),
  };
}

// Compliance violation explanations for the tutorial
export const DEMO_VIOLATION_EXPLANATIONS = {
  consecutive_nights: {
    employee: 'John Smith',
    issue: '8 consecutive night shifts',
    rule: 'Maximum 7 consecutive night shifts allowed',
    fix: 'Insert a rest day or reassign some shifts to another employee',
  },
  insufficient_rest: {
    employee: 'Sarah Johnson',
    issue: 'Only 23 hours between shifts',
    rule: 'Minimum 11 hours rest required between shifts',
    fix: 'Change the early morning shift to a later start time, or move to a different day',
  },
  high_fatigue: {
    employee: 'Emma Wilson',
    issue: 'FRI score above 1.0 due to extended shifts',
    rule: 'Fatigue Risk Index should ideally stay below 1.0',
    fix: 'Reduce shift length or add more rest days between extended shifts',
  },
};
