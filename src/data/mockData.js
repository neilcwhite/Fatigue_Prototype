import { addDays } from 'date-fns';

export const employees = [
  { id: 'emp-1', name: 'John Smith', role: 'Track Engineer' },
  { id: 'emp-2', name: 'Emily Clarke', role: 'Possession Manager' },
  { id: 'emp-3', name: 'Raj Patel', role: 'Signalling Technician' },
  { id: 'emp-4', name: 'Sarah Johnson', role: 'Track Labourer' },
  { id: 'emp-5', name: 'Michael Chen', role: 'Electrical Engineer' },
  { id: 'emp-6', name: 'Laura Hughes', role: 'Safety Supervisor' },
  { id: 'emp-7', name: 'James O’Connor', role: 'Track Labourer' },
  { id: 'emp-8', name: 'Hannah Wilson', role: 'Planner' },
  { id: 'emp-9', name: 'Oliver Green', role: 'Signalling Engineer' },
  { id: 'emp-10', name: 'Lucy Brennan', role: 'Track Engineer' },
  { id: 'emp-11', name: 'Daniel Romero', role: 'Possession Support' },
  { id: 'emp-12', name: 'Grace Matthews', role: 'Overhead Line Technician' },
  { id: 'emp-13', name: 'Noah Gallagher', role: 'Track Labourer' },
  { id: 'emp-14', name: 'Sophie Adams', role: 'Safety Inspector' },
  { id: 'emp-15', name: 'Isla McLean', role: 'Track Engineer' },
  { id: 'emp-16', name: 'Marcus Davies', role: 'Signalling Technician' },
  { id: 'emp-17', name: 'Ethan Wright', role: 'Possession Manager' },
  { id: 'emp-18', name: 'Charlotte Fraser', role: 'Planner' },
  { id: 'emp-19', name: 'Benjamin Hall', role: 'Track Labourer' },
  { id: 'emp-20', name: 'Ella Sutton', role: 'Signalling Engineer' },
  { id: 'emp-21', name: 'Jacob Reed', role: 'Track Labourer' },
  { id: 'emp-22', name: 'Phoebe Turner', role: 'Electrical Engineer' },
  { id: 'emp-23', name: 'Hugo Foster', role: 'Safety Supervisor' },
  { id: 'emp-24', name: 'Amelia Walsh', role: 'Track Engineer' },
  { id: 'emp-25', name: 'Liam Douglas', role: 'Signalling Technician' }
];

export const teams = [
  { id: 'team-1', name: 'Track Team A', members: ['emp-1', 'emp-4', 'emp-7', 'emp-13'] },
  { id: 'team-2', name: 'Signalling Crew Alpha', members: ['emp-3', 'emp-9', 'emp-20', 'emp-25'] },
  { id: 'team-3', name: 'Possession Response', members: ['emp-2', 'emp-11', 'emp-17'] },
  { id: 'team-4', name: 'Overhead Renewals', members: ['emp-5', 'emp-12', 'emp-22'] }
];

export const projects = [
  {
    id: 'proj-1',
    name: 'Manchester Track Renewal',
    type: 'Track Renewal',
    location: 'Manchester Piccadilly',
    startDate: '2024-03-01',
    endDate: '2024-05-15'
  },
  {
    id: 'proj-2',
    name: 'Bristol Signalling Upgrade',
    type: 'Signalling',
    location: 'Bristol Temple Meads',
    startDate: '2024-02-10',
    endDate: '2024-06-30'
  },
  {
    id: 'proj-3',
    name: 'Edinburgh Electrification',
    type: 'Electrification',
    location: 'Edinburgh Waverley',
    startDate: '2024-04-05',
    endDate: '2024-09-20'
  },
  {
    id: 'proj-4',
    name: 'Birmingham Weekend Blockade',
    type: 'Track & Civils',
    location: 'Birmingham New Street',
    startDate: '2024-01-20',
    endDate: '2024-04-15'
  },
  {
    id: 'proj-5',
    name: 'Leeds Control Migration',
    type: 'Control Migration',
    location: 'Leeds',
    startDate: '2024-02-01',
    endDate: '2024-07-12'
  }
];

const baseShiftPatterns = {
  standard: [
    { name: 'Days', startTime: '08:00', endTime: '20:00', dutyType: 'Non-Possession' },
    { name: 'Nights', startTime: '20:00', endTime: '08:00', dutyType: 'Non-Possession' },
    { name: 'Early Possession', startTime: '06:00', endTime: '16:00', dutyType: 'Possession' },
    { name: 'Late Possession', startTime: '14:00', endTime: '00:00', dutyType: 'Possession' },
    { name: 'Weekend Long Day', startTime: '07:00', endTime: '19:00', dutyType: 'Non-Possession' },
    { name: 'Weekend Night', startTime: '19:00', endTime: '07:00', dutyType: 'Possession' },
    { name: 'Maintenance Window', startTime: '22:00', endTime: '06:00', dutyType: 'Possession' },
    { name: 'Control Room Support', startTime: '09:00', endTime: '17:00', dutyType: 'Non-Possession' }
  ]
};

export const shiftPatterns = projects.flatMap((project, projectIndex) => (
  baseShiftPatterns.standard.map((pattern, idx) => ({
    id: `pat-${projectIndex + 1}-${idx + 1}`,
    projectId: project.id,
    ...pattern
  }))
));

const today = new Date('2024-03-18');

export const assignments = [
  {
    id: 'assign-1',
    projectId: 'proj-1',
    shiftPatternId: 'pat-1-1',
    assigneeType: 'team',
    assigneeId: 'team-1',
    startDate: '2024-03-18',
    endDate: '2024-03-24'
  },
  {
    id: 'assign-2',
    projectId: 'proj-1',
    shiftPatternId: 'pat-1-2',
    assigneeType: 'employee',
    assigneeId: 'emp-2',
    startDate: '2024-03-18',
    endDate: '2024-03-23'
  },
  {
    id: 'assign-3',
    projectId: 'proj-2',
    shiftPatternId: 'pat-2-3',
    assigneeType: 'team',
    assigneeId: 'team-2',
    startDate: '2024-03-18',
    endDate: '2024-03-25'
  },
  {
    id: 'assign-4',
    projectId: 'proj-2',
    shiftPatternId: 'pat-2-7',
    assigneeType: 'employee',
    assigneeId: 'emp-8',
    startDate: '2024-03-18',
    endDate: '2024-03-21'
  },
  {
    id: 'assign-5',
    projectId: 'proj-3',
    shiftPatternId: 'pat-3-5',
    assigneeType: 'team',
    assigneeId: 'team-4',
    startDate: '2024-03-17',
    endDate: '2024-03-24'
  },
  {
    id: 'assign-6',
    projectId: 'proj-4',
    shiftPatternId: 'pat-4-6',
    assigneeType: 'team',
    assigneeId: 'team-3',
    startDate: '2024-03-15',
    endDate: '2024-03-19'
  },
  {
    id: 'assign-7',
    projectId: 'proj-5',
    shiftPatternId: 'pat-5-1',
    assigneeType: 'employee',
    assigneeId: 'emp-18',
    startDate: '2024-03-18',
    endDate: '2024-04-02'
  },
  {
    id: 'assign-8',
    projectId: 'proj-5',
    shiftPatternId: 'pat-5-7',
    assigneeType: 'employee',
    assigneeId: 'emp-6',
    startDate: '2024-03-18',
    endDate: '2024-03-22'
  },
  {
    id: 'assign-9',
    projectId: 'proj-3',
    shiftPatternId: 'pat-3-2',
    assigneeType: 'employee',
    assigneeId: 'emp-1',
    startDate: '2024-03-20',
    endDate: '2024-03-27'
  },
  {
    id: 'assign-10',
    projectId: 'proj-2',
    shiftPatternId: 'pat-2-2',
    assigneeType: 'employee',
    assigneeId: 'emp-1',
    startDate: '2024-03-16',
    endDate: '2024-03-18'
  },
  {
    id: 'assign-11',
    projectId: 'proj-1',
    shiftPatternId: 'pat-1-5',
    assigneeType: 'employee',
    assigneeId: 'emp-14',
    startDate: '2024-03-18',
    endDate: '2024-03-24'
  },
  {
    id: 'assign-12',
    projectId: 'proj-4',
    shiftPatternId: 'pat-4-8',
    assigneeType: 'employee',
    assigneeId: 'emp-24',
    startDate: '2024-03-11',
    endDate: '2024-03-18'
  },
  {
    id: 'assign-13',
    projectId: 'proj-2',
    shiftPatternId: 'pat-2-5',
    assigneeType: 'employee',
    assigneeId: 'emp-9',
    startDate: '2024-03-18',
    endDate: '2024-03-25'
  },
  {
    id: 'assign-14',
    projectId: 'proj-3',
    shiftPatternId: 'pat-3-7',
    assigneeType: 'employee',
    assigneeId: 'emp-9',
    startDate: '2024-03-26',
    endDate: '2024-04-04'
  },
  {
    id: 'assign-15',
    projectId: 'proj-5',
    shiftPatternId: 'pat-5-6',
    assigneeType: 'team',
    assigneeId: 'team-2',
    startDate: '2024-03-28',
    endDate: '2024-04-03'
  },
  {
    id: 'assign-16',
    projectId: 'proj-4',
    shiftPatternId: 'pat-4-2',
    assigneeType: 'employee',
    assigneeId: 'emp-19',
    startDate: '2024-03-17',
    endDate: '2024-03-23'
  },
  {
    id: 'assign-17',
    projectId: 'proj-1',
    shiftPatternId: 'pat-1-7',
    assigneeType: 'employee',
    assigneeId: 'emp-6',
    startDate: '2024-03-24',
    endDate: '2024-03-28'
  },
  {
    id: 'assign-18',
    projectId: 'proj-2',
    shiftPatternId: 'pat-2-1',
    assigneeType: 'employee',
    assigneeId: 'emp-6',
    startDate: '2024-03-29',
    endDate: '2024-04-04'
  },
  {
    id: 'assign-19',
    projectId: 'proj-3',
    shiftPatternId: 'pat-3-4',
    assigneeType: 'employee',
    assigneeId: 'emp-15',
    startDate: '2024-03-18',
    endDate: '2024-03-22'
  },
  {
    id: 'assign-20',
    projectId: 'proj-5',
    shiftPatternId: 'pat-5-2',
    assigneeType: 'employee',
    assigneeId: 'emp-10',
    startDate: '2024-03-17',
    endDate: '2024-03-23'
  },
  {
    id: 'assign-21',
    projectId: 'proj-5',
    shiftPatternId: 'pat-5-2',
    assigneeType: 'employee',
    assigneeId: 'emp-10',
    startDate: '2024-03-24',
    endDate: '2024-03-30'
  },
  {
    id: 'assign-22',
    projectId: 'proj-3',
    shiftPatternId: 'pat-3-2',
    assigneeType: 'employee',
    assigneeId: 'emp-10',
    startDate: '2024-03-31',
    endDate: '2024-04-03'
  }
];

export const mockToday = today;

export function createEmptyAssignmentTemplate(projectId) {
  const projectPatterns = shiftPatterns.filter((pattern) => pattern.projectId === projectId);
  const defaultPattern = projectPatterns[0];
  return {
    id: `assign-${Math.random().toString(36).slice(2, 8)}`,
    projectId,
    shiftPatternId: defaultPattern?.id ?? '',
    assigneeType: 'employee',
    assigneeId: employees[0].id,
    startDate: addDays(today, 1).toISOString().slice(0, 10),
    endDate: addDays(today, 3).toISOString().slice(0, 10)
  };
}
