'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  DEFAULT_FATIGUE_PARAMS,
  calculateFatigueSequence,
  getRiskLevel,
} from '@/lib/fatigue';
import type { ShiftDefinition, ShiftPatternCamel, ProjectCamel, EmployeeCamel, AssignmentCamel } from '@/lib/types';

// ==================== TYPES ====================

export interface Shift extends ShiftDefinition {
  id: number;
  isRestDay?: boolean;
  commuteIn?: number;
  commuteOut?: number;
  workload?: number;
  attention?: number;
  breakFreq?: number;
  breakLen?: number;
}

export interface FatigueParams {
  commuteTime: number;
  workload: number;
  attention: number;
  breakFrequency: number;
  breakLength: number;
  continuousWork: number;
  breakAfterContinuous: number;
}

export const ROLE_PRESETS = {
  custom: { name: 'Custom', workload: 2, attention: 2, description: 'Set your own values' },
  coss: { name: 'COSS', workload: 4, attention: 5, description: 'Controller of Site Safety - highest responsibility' },
  picop: { name: 'PICOP', workload: 4, attention: 5, description: 'Person In Charge Of Possession' },
  lookout: { name: 'Lookout', workload: 2, attention: 5, description: 'High vigilance required' },
  siteWarden: { name: 'Site Warden', workload: 3, attention: 4, description: 'Site access control' },
  machineOp: { name: 'Machine Operator', workload: 4, attention: 4, description: 'Heavy plant operation' },
  banksman: { name: 'Banksman', workload: 3, attention: 4, description: 'Plant movement guidance' },
  skilledOp: { name: 'Skilled Operative', workload: 3, attention: 3, description: 'Experienced track worker' },
  labourer: { name: 'Labourer', workload: 3, attention: 2, description: 'General duties' },
  trainee: { name: 'Trainee/Learner', workload: 2, attention: 2, description: 'Under supervision' },
} as const;

export type RoleKey = keyof typeof ROLE_PRESETS;

// ==================== HELPER FUNCTIONS ====================

export const getDayOfWeek = (dayNum: number, startDay: number = 1): string => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const index = ((startDay - 1) + (dayNum - 1)) % 7;
  return days[index];
};

export const NR_DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
export type NRDayKey = typeof NR_DAYS[number];

export const nrDayIndexToShiftDay = (nrIndex: number): number => nrIndex + 1;

export const shiftsToWeeklySchedule = (
  shifts: Shift[],
  defaultParams: { commuteTime: number; workload: number; attention: number; breakFrequency: number; breakLength: number }
) => {
  const schedule: Record<string, { startTime: string; endTime: string; commuteIn?: number; commuteOut?: number; workload?: number; attention?: number; breakFreq?: number; breakLen?: number } | null> = {
    Sat: null, Sun: null, Mon: null, Tue: null, Wed: null, Thu: null, Fri: null,
  };

  const dayNumToNRDay: Record<number, NRDayKey> = {
    1: 'Sat', 2: 'Sun', 3: 'Mon', 4: 'Tue', 5: 'Wed', 6: 'Thu', 7: 'Fri',
  };

  shifts.forEach(shift => {
    const dayName = dayNumToNRDay[shift.day];
    if (dayName && !shift.isRestDay) {
      schedule[dayName] = {
        startTime: shift.startTime,
        endTime: shift.endTime,
        commuteIn: shift.commuteIn,
        commuteOut: shift.commuteOut,
        workload: shift.workload,
        attention: shift.attention,
        breakFreq: shift.breakFreq,
        breakLen: shift.breakLen,
      };
    }
  });

  return schedule;
};

// Helper to get risk color for MUI sx prop
export const getRiskChipSx = (level: string) => {
  switch (level) {
    case 'low': return { bgcolor: '#dcfce7', color: '#166534' };
    case 'moderate': return { bgcolor: '#fef9c3', color: '#854d0e' };
    case 'elevated': return { bgcolor: '#ffedd5', color: '#9a3412' };
    case 'critical': return { bgcolor: '#fee2e2', color: '#991b1b' };
    default: return { bgcolor: 'grey.200', color: 'grey.700' };
  }
};

export const getRiskCardSx = (level: string) => {
  switch (level) {
    case 'low': return { bgcolor: '#dcfce7', color: '#166534', borderColor: '#86efac' };
    case 'moderate': return { bgcolor: '#fef9c3', color: '#854d0e', borderColor: '#fde047' };
    case 'elevated': return { bgcolor: '#ffedd5', color: '#9a3412', borderColor: '#fdba74' };
    case 'critical': return { bgcolor: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' };
    default: return { bgcolor: 'grey.100', color: 'grey.800', borderColor: 'grey.300' };
  }
};

// ==================== MAIN HOOK ====================

interface UseFatigueStateProps {
  projects: ProjectCamel[];
  employees: EmployeeCamel[];
  shiftPatterns: ShiftPatternCamel[];
  assignments: AssignmentCamel[];
}

interface UseFatigueStateReturn {
  // Shift state
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;

  // Parameters
  params: FatigueParams;
  setParams: React.Dispatch<React.SetStateAction<FatigueParams>>;

  // Selection state
  selectedProjectId: number | null;
  setSelectedProjectId: React.Dispatch<React.SetStateAction<number | null>>;
  selectedPatternId: string | null;
  setSelectedPatternId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedEmployeeId: number | null;
  setSelectedEmployeeId: React.Dispatch<React.SetStateAction<number | null>>;
  selectedRole: RoleKey;
  setSelectedRole: React.Dispatch<React.SetStateAction<RoleKey>>;

  // Computed values
  selectedProject: ProjectCamel | undefined;
  selectedPattern: ShiftPatternCamel | undefined;
  selectedEmployee: EmployeeCamel | undefined;
  projectPatterns: ShiftPatternCamel[];
  patternEmployees: EmployeeCamel[];

  // Results
  results: ReturnType<typeof calculateFatigueSequence>;
  maxFRI: number;
  avgFRI: number;
  overallRisk: string;

  // Actions
  handleAddShift: () => void;
  handleRemoveShift: (id: number) => void;
  handleUpdateShift: (id: number, field: keyof Shift, value: Shift[keyof Shift]) => void;
  handleApplyGlobalToAll: () => void;
  handleClearAll: () => void;
  handleResetParams: () => void;
  handleApplyRolePreset: (roleKey: RoleKey) => void;
}

export function useFatigueState({
  projects,
  employees,
  shiftPatterns,
  assignments,
}: UseFatigueStateProps): UseFatigueStateReturn {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<RoleKey>('custom');

  const [params, setParams] = useState<FatigueParams>({
    commuteTime: DEFAULT_FATIGUE_PARAMS.commuteTime,
    workload: DEFAULT_FATIGUE_PARAMS.workload,
    attention: DEFAULT_FATIGUE_PARAMS.attention,
    breakFrequency: DEFAULT_FATIGUE_PARAMS.breakFrequency,
    breakLength: DEFAULT_FATIGUE_PARAMS.breakLength,
    continuousWork: DEFAULT_FATIGUE_PARAMS.continuousWork,
    breakAfterContinuous: DEFAULT_FATIGUE_PARAMS.breakAfterContinuous,
  });

  // Computed selections
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const selectedPattern = shiftPatterns.find(p => p.id === selectedPatternId);
  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  const projectPatterns = useMemo(() => {
    if (!selectedProjectId) return [];
    return shiftPatterns.filter(p => p.projectId === selectedProjectId);
  }, [selectedProjectId, shiftPatterns]);

  const patternEmployees = useMemo(() => {
    if (!selectedProjectId || !selectedPatternId) return [];
    const employeeIds = new Set(
      assignments
        .filter(a => a.projectId === selectedProjectId && a.shiftPatternId === selectedPatternId)
        .map(a => a.employeeId)
    );
    return employees.filter(e => employeeIds.has(e.id));
  }, [selectedProjectId, selectedPatternId, assignments, employees]);

  // Calculate fatigue results
  const results = useMemo(() => {
    if (shifts.length === 0) return [];
    const shiftDefs = shifts
      .filter(s => !s.isRestDay)
      .map(s => ({
        day: s.day,
        startTime: s.startTime,
        endTime: s.endTime,
        commuteIn: s.commuteIn ?? Math.floor(params.commuteTime / 2),
        commuteOut: s.commuteOut ?? Math.ceil(params.commuteTime / 2),
        workload: s.workload ?? params.workload,
        attention: s.attention ?? params.attention,
        breakFreq: s.breakFreq ?? params.breakFrequency,
        breakLen: s.breakLen ?? params.breakLength,
      }));
    return calculateFatigueSequence(shiftDefs);
  }, [shifts, params]);

  const maxFRI = useMemo(() => {
    if (results.length === 0) return 0;
    return Math.max(...results.map(r => r.riskIndex));
  }, [results]);

  const avgFRI = useMemo(() => {
    if (results.length === 0) return 0;
    return results.reduce((sum, r) => sum + r.riskIndex, 0) / results.length;
  }, [results]);

  const overallRisk = getRiskLevel(maxFRI).level;

  // Actions
  const handleAddShift = useCallback(() => {
    const nextDay = shifts.length > 0 ? Math.max(...shifts.map(s => s.day)) + 1 : 1;
    const newShift: Shift = {
      id: Date.now(),
      day: nextDay,
      startTime: '08:00',
      endTime: '18:00',
    };
    setShifts(prev => [...prev, newShift]);
  }, [shifts]);

  const handleRemoveShift = useCallback((id: number) => {
    setShifts(prev => prev.filter(s => s.id !== id));
  }, []);

  const handleUpdateShift = useCallback((id: number, field: keyof Shift, value: Shift[keyof Shift]) => {
    setShifts(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  }, []);

  const handleApplyGlobalToAll = useCallback(() => {
    setShifts(prev => prev.map(s => ({
      ...s,
      commuteIn: Math.floor(params.commuteTime / 2),
      commuteOut: Math.ceil(params.commuteTime / 2),
      workload: params.workload,
      attention: params.attention,
      breakFreq: params.breakFrequency,
      breakLen: params.breakLength,
    })));
  }, [params]);

  const handleClearAll = useCallback(() => {
    setShifts([]);
  }, []);

  const handleResetParams = useCallback(() => {
    setParams({
      commuteTime: DEFAULT_FATIGUE_PARAMS.commuteTime,
      workload: DEFAULT_FATIGUE_PARAMS.workload,
      attention: DEFAULT_FATIGUE_PARAMS.attention,
      breakFrequency: DEFAULT_FATIGUE_PARAMS.breakFrequency,
      breakLength: DEFAULT_FATIGUE_PARAMS.breakLength,
      continuousWork: DEFAULT_FATIGUE_PARAMS.continuousWork,
      breakAfterContinuous: DEFAULT_FATIGUE_PARAMS.breakAfterContinuous,
    });
    setSelectedRole('custom');
  }, []);

  const handleApplyRolePreset = useCallback((roleKey: RoleKey) => {
    setSelectedRole(roleKey);
    if (roleKey !== 'custom') {
      const preset = ROLE_PRESETS[roleKey];
      setParams(prev => ({
        ...prev,
        workload: preset.workload,
        attention: preset.attention,
      }));
    }
  }, []);

  return {
    shifts,
    setShifts,
    params,
    setParams,
    selectedProjectId,
    setSelectedProjectId,
    selectedPatternId,
    setSelectedPatternId,
    selectedEmployeeId,
    setSelectedEmployeeId,
    selectedRole,
    setSelectedRole,
    selectedProject,
    selectedPattern,
    selectedEmployee,
    projectPatterns,
    patternEmployees,
    results,
    maxFRI,
    avgFRI,
    overallRisk,
    handleAddShift,
    handleRemoveShift,
    handleUpdateShift,
    handleApplyGlobalToAll,
    handleClearAll,
    handleResetParams,
    handleApplyRolePreset,
  };
}
