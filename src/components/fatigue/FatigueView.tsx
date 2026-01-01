'use client';

import { useState, useMemo, useRef } from 'react';
import { ChevronLeft, Plus, Trash2, Settings, ChevronDown, ChevronUp, Download, FileText, BarChart, Users } from '@/components/ui/Icons';
import {
  calculateFatigueSequence,
  getRiskLevel,
  DEFAULT_FATIGUE_PARAMS,
  FATIGUE_TEMPLATES,
  parseTimeToHours,
  calculateDutyLength,
} from '@/lib/fatigue';
import type { ShiftDefinition, ProjectCamel, EmployeeCamel, ShiftPatternCamel, AssignmentCamel, SupabaseUser } from '@/lib/types';
import { FatigueChart } from './FatigueChart';
import { getRiskColor } from '@/lib/utils';

interface Shift extends ShiftDefinition {
  id: number;
  isRestDay?: boolean;  // Mark day as rest/off (no work)
  // Per-day parameters (optional - uses global defaults if not set)
  commuteIn?: number;
  commuteOut?: number;
  workload?: number;
  attention?: number;
  breakFreq?: number;
  breakLen?: number;
}

interface FatigueViewProps {
  user: SupabaseUser;
  onSignOut: () => void;
  onBack: () => void;
  // Data from the app
  projects?: ProjectCamel[];
  employees?: EmployeeCamel[];
  shiftPatterns?: ShiftPatternCamel[];
  assignments?: AssignmentCamel[];
  // Save functions
  onCreateShiftPattern?: (data: Omit<ShiftPatternCamel, 'id' | 'organisationId'>) => Promise<void>;
  onUpdateShiftPattern?: (id: string, data: Partial<ShiftPatternCamel>) => Promise<void>;
}

// Extended templates including the original simple ones
const TEMPLATES = {
  ...FATIGUE_TEMPLATES,
  standard5x8: {
    name: 'Standard 5×8h Days',
    shifts: [
      { day: 1, startTime: '08:00', endTime: '16:00' },
      { day: 2, startTime: '08:00', endTime: '16:00' },
      { day: 3, startTime: '08:00', endTime: '16:00' },
      { day: 4, startTime: '08:00', endTime: '16:00' },
      { day: 5, startTime: '08:00', endTime: '16:00' },
    ],
  },
  days4x12: {
    name: '4×12h Day Shifts',
    shifts: [
      { day: 1, startTime: '07:00', endTime: '19:00' },
      { day: 2, startTime: '07:00', endTime: '19:00' },
      { day: 3, startTime: '07:00', endTime: '19:00' },
      { day: 4, startTime: '07:00', endTime: '19:00' },
    ],
  },
  nights4x12: {
    name: '4×12h Night Shifts',
    shifts: [
      { day: 1, startTime: '19:00', endTime: '07:00' },
      { day: 2, startTime: '19:00', endTime: '07:00' },
      { day: 3, startTime: '19:00', endTime: '07:00' },
      { day: 4, startTime: '19:00', endTime: '07:00' },
    ],
  },
  mixed7on7off: {
    name: '7 On / 7 Off Mixed',
    shifts: [
      { day: 1, startTime: '07:00', endTime: '19:00' },
      { day: 2, startTime: '07:00', endTime: '19:00' },
      { day: 3, startTime: '07:00', endTime: '19:00' },
      { day: 4, startTime: '19:00', endTime: '07:00' },
      { day: 5, startTime: '19:00', endTime: '07:00' },
      { day: 6, startTime: '19:00', endTime: '07:00' },
      { day: 7, startTime: '19:00', endTime: '07:00' },
    ],
  },
  continental: {
    name: 'Continental (2-2-3)',
    shifts: [
      { day: 1, startTime: '06:00', endTime: '18:00' },
      { day: 2, startTime: '06:00', endTime: '18:00' },
      { day: 5, startTime: '18:00', endTime: '06:00' },
      { day: 6, startTime: '18:00', endTime: '06:00' },
      { day: 9, startTime: '06:00', endTime: '18:00' },
      { day: 10, startTime: '06:00', endTime: '18:00' },
      { day: 11, startTime: '06:00', endTime: '18:00' },
    ],
  },
};

// Role-based fatigue presets (workload, attention)
// Based on typical rail industry safety-critical roles
const ROLE_PRESETS = {
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

type RoleKey = keyof typeof ROLE_PRESETS;

// Helper to get day of week from day number (assumes Day 1 = Monday)
const getDayOfWeek = (dayNum: number, startDay: number = 1): string => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // startDay: 1=Mon, 2=Tue, etc.
  const index = ((startDay - 1) + (dayNum - 1)) % 7;
  return days[index];
};

// Network Rail week days (Saturday to Friday)
const NR_DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
type NRDayKey = typeof NR_DAYS[number];

// Map NR day index (0=Sat) to Shift day number (1=Sat for NR week)
const nrDayIndexToShiftDay = (nrIndex: number): number => nrIndex + 1;

// Convert shifts array to WeeklySchedule format for database storage
const shiftsToWeeklySchedule = (shifts: Shift[], defaultParams: { commuteTime: number; workload: number; attention: number; breakFrequency: number; breakLength: number }) => {
  const schedule: Record<string, { startTime: string; endTime: string; commuteIn?: number; commuteOut?: number; workload?: number; attention?: number; breakFreq?: number; breakLen?: number } | null> = {
    Sat: null,
    Sun: null,
    Mon: null,
    Tue: null,
    Wed: null,
    Thu: null,
    Fri: null,
  };

  // Map day number to NR day name (1=Sat, 2=Sun, etc.)
  const dayNumToNRDay: Record<number, NRDayKey> = {
    1: 'Sat',
    2: 'Sun',
    3: 'Mon',
    4: 'Tue',
    5: 'Wed',
    6: 'Thu',
    7: 'Fri',
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

export function FatigueView({
  user,
  onSignOut,
  onBack,
  projects = [],
  employees = [],
  shiftPatterns = [],
  assignments = [],
  onCreateShiftPattern,
  onUpdateShiftPattern,
}: FatigueViewProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedShift, setExpandedShift] = useState<number | null>(null);
  const [expandedShiftParams, setExpandedShiftParams] = useState<number | null>(null);
  const [showChart, setShowChart] = useState(true);
  const [showComponents, setShowComponents] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // View mode: 'weekly' (7-day grid) or 'multiweek' (original flexible list)
  const [viewMode, setViewMode] = useState<'weekly' | 'multiweek'>('weekly');

  // Project, shift pattern, and employee selection for loading rosters
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savePatternName, setSavePatternName] = useState('');
  const [saveProjectId, setSaveProjectId] = useState<number | null>(null);
  const [saveDutyType, setSaveDutyType] = useState<string>('Non-Possession');
  const [saveIsNight, setSaveIsNight] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Role and day-of-week settings
  const [selectedRole, setSelectedRole] = useState<RoleKey>('custom');
  const [startDayOfWeek, setStartDayOfWeek] = useState<number>(1); // 1=Sat for NR week
  const [compareRoles, setCompareRoles] = useState(false);
  const [selectedRolesForCompare, setSelectedRolesForCompare] = useState<RoleKey[]>(['coss', 'lookout', 'labourer']);

  // Fatigue parameters - explicitly typed to allow mutable number values
  const [params, setParams] = useState<{
    commuteTime: number;
    workload: number;
    attention: number;
    breakFrequency: number;
    breakLength: number;
    continuousWork: number;
    breakAfterContinuous: number;
  }>({
    commuteTime: DEFAULT_FATIGUE_PARAMS.commuteTime,
    workload: DEFAULT_FATIGUE_PARAMS.workload,
    attention: DEFAULT_FATIGUE_PARAMS.attention,
    breakFrequency: DEFAULT_FATIGUE_PARAMS.breakFrequency,
    breakLength: DEFAULT_FATIGUE_PARAMS.breakLength,
    continuousWork: DEFAULT_FATIGUE_PARAMS.continuousWork,
    breakAfterContinuous: DEFAULT_FATIGUE_PARAMS.breakAfterContinuous,
  });

  // Get shift patterns for the selected project
  const projectPatterns = useMemo(() => {
    if (!selectedProjectId) return [];
    return shiftPatterns.filter(p => p.projectId === selectedProjectId);
  }, [selectedProjectId, shiftPatterns]);

  // Get employees assigned to the selected shift pattern
  const patternEmployees = useMemo(() => {
    if (!selectedProjectId || !selectedPatternId) return [];
    const employeeIds = new Set(
      assignments
        .filter(a => a.projectId === selectedProjectId && a.shiftPatternId === selectedPatternId)
        .map(a => a.employeeId)
    );
    return employees.filter(e => employeeIds.has(e.id));
  }, [selectedProjectId, selectedPatternId, assignments, employees]);

  // Get selected data
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const selectedPattern = shiftPatterns.find(p => p.id === selectedPatternId);
  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  // Load shift pattern as roster (converts weekly schedule to shifts)
  const handleLoadPattern = () => {
    if (!selectedPatternId || !selectedPattern) return;

    // Build shifts from the pattern's weekly schedule or default times
    const loadedShifts: Shift[] = [];

    if (selectedPattern.weeklySchedule) {
      // Use the weekly schedule if defined
      const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
      const schedule = selectedPattern.weeklySchedule;

      Object.entries(schedule).forEach(([dayName, daySchedule]) => {
        if (daySchedule && daySchedule.startTime && daySchedule.endTime) {
          const dayNum = dayMap[dayName] || 1;
          loadedShifts.push({
            id: Date.now() + dayNum,
            day: dayNum,
            startTime: daySchedule.startTime,
            endTime: daySchedule.endTime,
            commuteIn: daySchedule.commuteIn ?? Math.floor((selectedPattern.commuteTime || params.commuteTime) / 2),
            commuteOut: daySchedule.commuteOut ?? Math.ceil((selectedPattern.commuteTime || params.commuteTime) / 2),
            workload: daySchedule.workload ?? selectedPattern.workload ?? params.workload,
            attention: daySchedule.attention ?? selectedPattern.attention ?? params.attention,
            breakFreq: daySchedule.breakFreq ?? selectedPattern.breakFrequency ?? params.breakFrequency,
            breakLen: daySchedule.breakLen ?? selectedPattern.breakLength ?? params.breakLength,
          });
        }
      });
    } else if (selectedPattern.startTime && selectedPattern.endTime) {
      // No weekly schedule - create a simple 5-day pattern from pattern times
      for (let day = 1; day <= 5; day++) {
        loadedShifts.push({
          id: Date.now() + day,
          day,
          startTime: selectedPattern.startTime,
          endTime: selectedPattern.endTime,
          commuteIn: Math.floor((selectedPattern.commuteTime || params.commuteTime) / 2),
          commuteOut: Math.ceil((selectedPattern.commuteTime || params.commuteTime) / 2),
          workload: selectedPattern.workload ?? params.workload,
          attention: selectedPattern.attention ?? params.attention,
          breakFreq: selectedPattern.breakFrequency ?? params.breakFrequency,
          breakLen: selectedPattern.breakLength ?? params.breakLength,
        });
      }
    }

    // Sort by day number
    loadedShifts.sort((a, b) => a.day - b.day);

    // Set start day to Monday by default for patterns
    setStartDayOfWeek(1);
    setShifts(loadedShifts);
  };

  // Apply employee's role workload/attention to the current shifts
  const handleApplyEmployeeRole = () => {
    if (!selectedEmployeeId || !selectedEmployee) return;

    // Look up employee's role to get typical workload/attention
    // For now, we'll use the employee's role name to match a preset if possible
    const employeeRole = selectedEmployee.role?.toLowerCase() || '';

    // Try to match to a role preset
    let workload = params.workload;
    let attention = params.attention;

    if (employeeRole.includes('coss')) {
      workload = ROLE_PRESETS.coss.workload;
      attention = ROLE_PRESETS.coss.attention;
    } else if (employeeRole.includes('picop')) {
      workload = ROLE_PRESETS.picop.workload;
      attention = ROLE_PRESETS.picop.attention;
    } else if (employeeRole.includes('lookout')) {
      workload = ROLE_PRESETS.lookout.workload;
      attention = ROLE_PRESETS.lookout.attention;
    } else if (employeeRole.includes('warden')) {
      workload = ROLE_PRESETS.siteWarden.workload;
      attention = ROLE_PRESETS.siteWarden.attention;
    } else if (employeeRole.includes('machine') || employeeRole.includes('operator')) {
      workload = ROLE_PRESETS.machineOp.workload;
      attention = ROLE_PRESETS.machineOp.attention;
    } else if (employeeRole.includes('banksman')) {
      workload = ROLE_PRESETS.banksman.workload;
      attention = ROLE_PRESETS.banksman.attention;
    } else if (employeeRole.includes('skilled')) {
      workload = ROLE_PRESETS.skilledOp.workload;
      attention = ROLE_PRESETS.skilledOp.attention;
    } else if (employeeRole.includes('labourer') || employeeRole.includes('labor')) {
      workload = ROLE_PRESETS.labourer.workload;
      attention = ROLE_PRESETS.labourer.attention;
    } else if (employeeRole.includes('trainee') || employeeRole.includes('learner')) {
      workload = ROLE_PRESETS.trainee.workload;
      attention = ROLE_PRESETS.trainee.attention;
    }

    // Update all shifts with the employee's workload/attention
    setShifts(shifts.map(s => ({
      ...s,
      workload,
      attention,
    })));

    // Update global params too
    setParams(prev => ({ ...prev, workload, attention }));
  };

  // Calculate results using full HSE RR446 algorithm
  const results = useMemo(() => {
    // Filter out rest days - they don't contribute to fatigue
    const workingShifts = shifts.filter(s => !s.isRestDay);
    if (workingShifts.length === 0) return null;

    const sortedShifts = [...workingShifts].sort((a, b) => a.day - b.day);
    // Include per-shift fatigue parameters in the shift definitions
    const shiftDefinitions: ShiftDefinition[] = sortedShifts.map(s => ({
      day: s.day,
      startTime: s.startTime,
      endTime: s.endTime,
      commuteIn: s.commuteIn,
      commuteOut: s.commuteOut,
      workload: s.workload,
      attention: s.attention,
      breakFreq: s.breakFreq,
      breakLen: s.breakLen,
    }));

    const calculations = calculateFatigueSequence(shiftDefinitions, params);

    // Calculate duty lengths for display
    const calculationsWithDuty = calculations.map((calc, idx) => {
      const shift = sortedShifts[idx];
      const startHour = parseTimeToHours(shift.startTime);
      let endHour = parseTimeToHours(shift.endTime);
      if (endHour <= startHour) endHour += 24;
      const dutyLength = calculateDutyLength(startHour, endHour);

      return {
        ...calc,
        id: shift.id,
        startTime: shift.startTime,
        endTime: shift.endTime,
        dutyLength: Math.round(dutyLength * 10) / 10,
        dayOfWeek: getDayOfWeek(shift.day, startDayOfWeek),
      };
    });

    const riskIndices = calculationsWithDuty.map(c => c.riskIndex);
    const avgRisk = riskIndices.reduce((a, b) => a + b, 0) / riskIndices.length;
    const maxRisk = Math.max(...riskIndices);
    const totalHours = calculationsWithDuty.reduce((a, c) => a + c.dutyLength, 0);

    // Component averages
    const avgCumulative = calculationsWithDuty.reduce((a, c) => a + c.cumulative, 0) / calculationsWithDuty.length;
    const avgTiming = calculationsWithDuty.reduce((a, c) => a + c.timing, 0) / calculationsWithDuty.length;
    const avgJobBreaks = calculationsWithDuty.reduce((a, c) => a + c.jobBreaks, 0) / calculationsWithDuty.length;

    return {
      calculations: calculationsWithDuty,
      summary: {
        avgRisk: Math.round(avgRisk * 1000) / 1000,
        maxRisk: Math.round(maxRisk * 1000) / 1000,
        dutyCount: calculationsWithDuty.length,
        totalHours: Math.round(totalHours * 10) / 10,
        highRiskCount: calculationsWithDuty.filter(c => c.riskIndex >= 1.1).length,
        avgCumulative: Math.round(avgCumulative * 1000) / 1000,
        avgTiming: Math.round(avgTiming * 1000) / 1000,
        avgJobBreaks: Math.round(avgJobBreaks * 1000) / 1000,
      },
    };
  }, [shifts, params, startDayOfWeek]);

  // Calculate role comparison results
  const roleComparisonResults = useMemo(() => {
    // Filter out rest days - they don't contribute to fatigue
    const workingShifts = shifts.filter(s => !s.isRestDay);
    if (!compareRoles || workingShifts.length === 0) return null;

    const sortedShifts = [...workingShifts].sort((a, b) => a.day - b.day);

    // Calculate for each selected role
    const roleResults = selectedRolesForCompare.map(roleKey => {
      const role = ROLE_PRESETS[roleKey];

      // Build shift definitions using the role's workload/attention but keeping per-shift commute
      const shiftDefinitions: ShiftDefinition[] = sortedShifts.map(s => ({
        day: s.day,
        startTime: s.startTime,
        endTime: s.endTime,
        commuteIn: s.commuteIn,
        commuteOut: s.commuteOut,
        workload: role.workload,
        attention: role.attention,
        breakFreq: s.breakFreq,
        breakLen: s.breakLen,
      }));

      const roleParams = {
        ...params,
        workload: role.workload,
        attention: role.attention,
      };

      const calculations = calculateFatigueSequence(shiftDefinitions, roleParams);
      const maxRisk = Math.max(...calculations.map(c => c.riskIndex));
      const avgRisk = calculations.reduce((a, c) => a + c.riskIndex, 0) / calculations.length;
      const highRiskDays = calculations.filter(c => c.riskIndex >= 1.1).length;
      const isCompliant = maxRisk < 1.2; // Below "critical" threshold

      return {
        roleKey,
        roleName: role.name,
        workload: role.workload,
        attention: role.attention,
        calculations,
        maxRisk: Math.round(maxRisk * 1000) / 1000,
        avgRisk: Math.round(avgRisk * 1000) / 1000,
        highRiskDays,
        isCompliant,
      };
    });

    return roleResults;
  }, [compareRoles, shifts, selectedRolesForCompare, params]);

  const handleAddShift = () => {
    const lastDay = shifts.length > 0 ? Math.max(...shifts.map(s => s.day)) : 0;
    setShifts([...shifts, {
      id: Date.now(),
      day: lastDay + 1,
      startTime: '08:00',
      endTime: '17:00',
      // Initialize with global defaults split into in/out
      commuteIn: Math.floor(params.commuteTime / 2),
      commuteOut: Math.ceil(params.commuteTime / 2),
      workload: params.workload,
      attention: params.attention,
      breakFreq: params.breakFrequency,
      breakLen: params.breakLength,
    }]);
  };

  const handleRemoveShift = (id: number) => {
    setShifts(shifts.filter(s => s.id !== id));
    if (expandedShiftParams === id) setExpandedShiftParams(null);
  };

  const handleUpdateShift = (id: number, field: keyof Shift, value: any) => {
    setShifts(shifts.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  // Apply global params to all shifts
  const handleApplyGlobalToAll = () => {
    setShifts(shifts.map(s => ({
      ...s,
      commuteIn: Math.floor(params.commuteTime / 2),
      commuteOut: Math.ceil(params.commuteTime / 2),
      workload: params.workload,
      attention: params.attention,
      breakFreq: params.breakFrequency,
      breakLen: params.breakLength,
    })));
  };

  const handleLoadTemplate = (templateKey: string) => {
    const template = TEMPLATES[templateKey as keyof typeof TEMPLATES];
    if (template) {
      setShifts(template.shifts.map((s, i) => ({
        ...s,
        id: Date.now() + i,
        // Initialize with global defaults
        commuteIn: Math.floor(params.commuteTime / 2),
        commuteOut: Math.ceil(params.commuteTime / 2),
        workload: params.workload,
        attention: params.attention,
        breakFreq: params.breakFrequency,
        breakLen: params.breakLength,
      })));
    }
  };

  const handleClearAll = () => {
    setShifts([]);
  };

  const handleResetParams = () => {
    setParams({ ...DEFAULT_FATIGUE_PARAMS });
  };

  // Apply role preset to workload/attention
  const handleApplyRolePreset = (roleKey: RoleKey) => {
    setSelectedRole(roleKey);
    if (roleKey !== 'custom') {
      const role = ROLE_PRESETS[roleKey];
      setParams(prev => ({
        ...prev,
        workload: role.workload,
        attention: role.attention,
      }));
      // Also update all existing shifts
      setShifts(shifts.map(s => ({
        ...s,
        workload: role.workload,
        attention: role.attention,
      })));
    }
  };

  // Initialize 7-day week for weekly view mode
  const initializeWeeklyShifts = () => {
    const weekShifts: Shift[] = NR_DAYS.map((_, index) => ({
      id: Date.now() + index,
      day: nrDayIndexToShiftDay(index),
      startTime: '07:00',
      endTime: '19:00',
      isRestDay: index === 0 || index === 1, // Sat/Sun rest by default
      commuteIn: Math.floor(params.commuteTime / 2),
      commuteOut: Math.ceil(params.commuteTime / 2),
      workload: params.workload,
      attention: params.attention,
      breakFreq: params.breakFrequency,
      breakLen: params.breakLength,
    }));
    setShifts(weekShifts);
    setStartDayOfWeek(6); // Saturday start for NR week
  };

  // Toggle rest day for weekly view
  const toggleRestDay = (dayIndex: number) => {
    const dayNum = nrDayIndexToShiftDay(dayIndex);
    setShifts(prev => prev.map(s =>
      s.day === dayNum ? { ...s, isRestDay: !s.isRestDay } : s
    ));
  };

  // Update shift time for weekly view
  const updateWeeklyShiftTime = (dayIndex: number, field: 'startTime' | 'endTime', value: string) => {
    const dayNum = nrDayIndexToShiftDay(dayIndex);
    setShifts(prev => prev.map(s =>
      s.day === dayNum ? { ...s, [field]: value } : s
    ));
  };

  // Update shift parameter for weekly view (travel times, workload, attention, etc.)
  const updateWeeklyShiftParam = (dayIndex: number, field: keyof Shift, value: number) => {
    const dayNum = nrDayIndexToShiftDay(dayIndex);
    setShifts(prev => prev.map(s =>
      s.day === dayNum ? { ...s, [field]: value } : s
    ));
  };

  // Get shift for a specific NR day index
  const getShiftForDay = (dayIndex: number): Shift | undefined => {
    const dayNum = nrDayIndexToShiftDay(dayIndex);
    return shifts.find(s => s.day === dayNum);
  };

  // Save pattern handler
  const handleSavePattern = async () => {
    if (!savePatternName.trim()) {
      setSaveError('Pattern name is required');
      return;
    }
    if (!saveProjectId) {
      setSaveError('Please select a project');
      return;
    }
    if (!onCreateShiftPattern) {
      setSaveError('Save function not available');
      return;
    }

    // Check at least one working day
    const workingShifts = shifts.filter(s => !s.isRestDay);
    if (workingShifts.length === 0) {
      setSaveError('At least one working day is required');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const weeklySchedule = shiftsToWeeklySchedule(shifts, params);

      // Get representative start/end times from first working shift
      const firstWorking = workingShifts[0];

      await onCreateShiftPattern({
        projectId: saveProjectId,
        name: savePatternName.trim(),
        startTime: firstWorking.startTime,
        endTime: firstWorking.endTime,
        weeklySchedule,
        dutyType: saveDutyType as 'Possession' | 'Non-Possession' | 'Office' | 'Lookout' | 'Machine' | 'Protection' | 'Other',
        isNight: saveIsNight,
        workload: params.workload,
        attention: params.attention,
        commuteTime: params.commuteTime,
        breakFrequency: params.breakFrequency,
        breakLength: params.breakLength,
      });

      setShowSaveModal(false);
      setSavePatternName('');
      setSaveProjectId(null);
      setSaveError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save pattern';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Update existing pattern handler
  const handleUpdateExistingPattern = async () => {
    if (!selectedPatternId || !onUpdateShiftPattern) {
      setSaveError('No pattern selected or update function not available');
      return;
    }

    const workingShifts = shifts.filter(s => !s.isRestDay);
    if (workingShifts.length === 0) {
      setSaveError('At least one working day is required');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const weeklySchedule = shiftsToWeeklySchedule(shifts, params);
      const firstWorking = workingShifts[0];

      await onUpdateShiftPattern(selectedPatternId, {
        startTime: firstWorking.startTime,
        endTime: firstWorking.endTime,
        weeklySchedule,
        workload: params.workload,
        attention: params.attention,
        commuteTime: params.commuteTime,
        breakFrequency: params.breakFrequency,
        breakLength: params.breakLength,
      });

      setSaveError(null);
      // Show success feedback
      alert('Pattern updated successfully!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update pattern';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle a role in the comparison list
  const toggleCompareRole = (roleKey: RoleKey) => {
    if (selectedRolesForCompare.includes(roleKey)) {
      setSelectedRolesForCompare(selectedRolesForCompare.filter(r => r !== roleKey));
    } else {
      setSelectedRolesForCompare([...selectedRolesForCompare, roleKey]);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!results) return;

    const headers = [
      'Day',
      'Start Time',
      'End Time',
      'Duration (h)',
      'Cumulative',
      'Timing',
      'Job/Breaks',
      'FRI',
      'Risk Level',
    ];

    const rows = results.calculations.map(calc => [
      calc.day,
      calc.startTime,
      calc.endTime,
      calc.dutyLength,
      calc.cumulative,
      calc.timing,
      calc.jobBreaks,
      calc.riskIndex,
      calc.riskLevel.label,
    ]);

    // Add summary row
    rows.push([]);
    rows.push(['Summary']);
    rows.push(['Average FRI', '', '', '', '', '', '', results.summary.avgRisk]);
    rows.push(['Peak FRI', '', '', '', '', '', '', results.summary.maxRisk]);
    rows.push(['Total Hours', '', '', results.summary.totalHours]);
    rows.push(['High Risk Shifts', '', '', '', '', '', '', results.summary.highRiskCount]);

    // Add parameters
    rows.push([]);
    rows.push(['Parameters']);
    rows.push(['Commute Time', `${params.commuteTime} min`]);
    rows.push(['Workload', params.workload]);
    rows.push(['Attention', params.attention]);
    rows.push(['Break Frequency', `${params.breakFrequency} min`]);
    rows.push(['Break Length', `${params.breakLength} min`]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fatigue-assessment-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print/Export report
  const handlePrint = () => {
    if (!results) return;

    const printContent = `
      <html>
        <head>
          <title>Fatigue Risk Assessment Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { color: #1e293b; border-bottom: 3px solid #f97316; padding-bottom: 10px; }
            h2 { color: #475569; margin-top: 30px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
            th { background: #f8fafc; font-weight: 600; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
            .summary-card { background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center; }
            .summary-card .value { font-size: 24px; font-weight: bold; color: #1e293b; }
            .summary-card .label { font-size: 12px; color: #64748b; }
            .low { background: #dcfce7; color: #166534; }
            .moderate { background: #fef9c3; color: #854d0e; }
            .elevated { background: #ffedd5; color: #9a3412; }
            .critical { background: #fee2e2; color: #991b1b; }
            .params { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .params-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .param { font-size: 13px; }
            .param-label { color: #64748b; }
            .param-value { font-weight: 600; color: #1e293b; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <h1>Fatigue Risk Assessment Report</h1>
          <p style="color: #64748b;">Generated: ${new Date().toLocaleString()}</p>
          <p style="color: #64748b;">HSE Research Report RR446 Compliant</p>

          <h2>Summary</h2>
          <div class="summary">
            <div class="summary-card ${getRiskLevel(results.summary.avgRisk).level}">
              <div class="value">${results.summary.avgRisk}</div>
              <div class="label">Average FRI</div>
            </div>
            <div class="summary-card ${getRiskLevel(results.summary.maxRisk).level}">
              <div class="value">${results.summary.maxRisk}</div>
              <div class="label">Peak FRI</div>
            </div>
            <div class="summary-card">
              <div class="value">${results.summary.totalHours}h</div>
              <div class="label">Total Hours</div>
            </div>
            <div class="summary-card">
              <div class="value">${results.summary.highRiskCount}</div>
              <div class="label">High Risk Shifts</div>
            </div>
          </div>

          <h2>Component Analysis</h2>
          <table>
            <tr><th>Component</th><th>Average Score</th></tr>
            <tr><td>Cumulative Fatigue</td><td>${results.summary.avgCumulative}</td></tr>
            <tr><td>Timing Factor</td><td>${results.summary.avgTiming}</td></tr>
            <tr><td>Job/Breaks Factor</td><td>${results.summary.avgJobBreaks}</td></tr>
          </table>

          <h2>Shift-by-Shift Analysis</h2>
          <table>
            <tr>
              <th>Day</th>
              <th>Times</th>
              <th>Duration</th>
              <th>Cumulative</th>
              <th>Timing</th>
              <th>Job/Breaks</th>
              <th>FRI</th>
              <th>Risk</th>
            </tr>
            ${results.calculations.map(calc => `
              <tr class="${calc.riskLevel.level}">
                <td>${calc.day}</td>
                <td>${calc.startTime} - ${calc.endTime}</td>
                <td>${calc.dutyLength}h</td>
                <td>${calc.cumulative}</td>
                <td>${calc.timing}</td>
                <td>${calc.jobBreaks}</td>
                <td><strong>${calc.riskIndex}</strong></td>
                <td>${calc.riskLevel.label}</td>
              </tr>
            `).join('')}
          </table>

          <h2>Assessment Parameters</h2>
          <div class="params">
            <div class="params-grid">
              <div class="param"><span class="param-label">Commute Time:</span> <span class="param-value">${params.commuteTime} min</span></div>
              <div class="param"><span class="param-label">Workload:</span> <span class="param-value">${params.workload}/5</span></div>
              <div class="param"><span class="param-label">Attention:</span> <span class="param-value">${params.attention}/5</span></div>
              <div class="param"><span class="param-label">Break Frequency:</span> <span class="param-value">${params.breakFrequency} min</span></div>
              <div class="param"><span class="param-label">Break Length:</span> <span class="param-value">${params.breakLength} min</span></div>
              <div class="param"><span class="param-label">Continuous Work:</span> <span class="param-value">${params.continuousWork} min</span></div>
            </div>
          </div>

          <h2>Risk Level Guide</h2>
          <table>
            <tr><th>FRI Range</th><th>Risk Level</th><th>Action</th></tr>
            <tr class="low"><td>&lt; 1.0</td><td>Low</td><td>No action required</td></tr>
            <tr class="moderate"><td>1.0 - 1.1</td><td>Moderate</td><td>Monitor and review</td></tr>
            <tr class="elevated"><td>1.1 - 1.2</td><td>Elevated</td><td>Consider mitigation measures</td></tr>
            <tr class="critical"><td>&gt; 1.2</td><td>Critical</td><td>Immediate review required</td></tr>
          </table>

          <div class="footer">
            <p>This assessment uses the HSE Research Report RR446 methodology for calculating fatigue risk.</p>
            <p>FRI = Cumulative Factor × Timing Factor × Job/Breaks Factor</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Risk bar visualization
  const RiskBar = ({ value, max = 1.5, label, color }: { value: number; max?: number; label: string; color: string }) => {
    const percentage = Math.min(100, (value / max) * 100);
    return (
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-600">{label}</span>
          <span className="font-medium text-slate-800">{value.toFixed(3)}</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${color} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 border-b-4 border-orange-500">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-md text-sm flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <div className="text-white font-semibold text-lg">
              Fatigue <span className="text-orange-400">Risk Assessment</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="bg-slate-700 text-orange-400 px-3 py-1 rounded text-xs font-mono">
              HSE RR446 COMPLIANT
            </span>
            <div className="text-slate-400 text-sm">{user?.email}</div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* View Mode Toggle */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 bg-white rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'weekly'
                  ? 'bg-orange-500 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              7-Day Week
            </button>
            <button
              onClick={() => setViewMode('multiweek')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'multiweek'
                  ? 'bg-orange-500 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Multi-Week Pattern
            </button>
          </div>
          <div className="flex items-center gap-2">
            {shifts.length > 0 && onCreateShiftPattern && (
              <button
                onClick={() => {
                  setSaveProjectId(selectedProjectId);
                  setShowSaveModal(true);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Save as New Pattern
              </button>
            )}
            {shifts.length > 0 && selectedPatternId && onUpdateShiftPattern && (
              <button
                onClick={handleUpdateExistingPattern}
                disabled={isSaving}
                className="px-4 py-2 bg-violet-600 text-white rounded-md text-sm font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? 'Saving...' : 'Update Pattern'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Input */}
          <div className="space-y-4">
            {/* 7-Day Weekly View */}
            {viewMode === 'weekly' && (
              <div className="bg-white rounded-lg shadow-md">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Network Rail Week (Sat-Fri)</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={initializeWeeklyShifts}
                      className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      Reset Week
                    </button>
                    <button
                      onClick={() => setShowSettings(!showSettings)}
                      className={`text-sm px-3 py-1 rounded flex items-center gap-1 ${
                        showSettings ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <Settings className="w-4 h-4" />
                      Parameters
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  {/* Instructions */}
                  <p className="text-xs text-slate-500 mb-4">
                    Network Rail week runs Saturday to Friday. Check "Rest" for non-working days.
                  </p>

                  {/* 7-Day Grid */}
                  {shifts.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-slate-500 mb-4">Click "Reset Week" to create a 7-day roster template</p>
                      <button
                        onClick={initializeWeeklyShifts}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Create Week Template
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Global Parameters Summary */}
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-amber-800">Global Settings:</span>
                          <div className="flex gap-3 text-amber-700">
                            <span title="Maximum continuous work before mandatory break">
                              Continuous: <strong>{params.continuousWork}h</strong>
                            </span>
                            <span title="Break required after continuous work period">
                              Break after: <strong>{params.breakAfterContinuous}m</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Header */}
                      <div className="grid grid-cols-[50px_40px_55px_80px_80px_55px_50px_45px_45px_45px_45px_60px] gap-2 text-xs font-medium text-slate-600 px-1">
                        <span>Day</span>
                        <span className="text-center">Rest</span>
                        <span className="text-center text-blue-600" title="Travel time to work (mins)">In</span>
                        <span className="text-center">Start</span>
                        <span className="text-center">End</span>
                        <span className="text-center text-blue-600" title="Travel time home (mins)">Out</span>
                        <span className="text-center">Hrs</span>
                        <span className="text-center text-purple-600" title="Workload (1-5)">W</span>
                        <span className="text-center text-purple-600" title="Attention (1-5)">A</span>
                        <span className="text-center text-green-600" title="Break frequency (hours)">BF</span>
                        <span className="text-center text-green-600" title="Break length (mins)">BL</span>
                        <span className="text-center" title="Fatigue Risk Index">FRI</span>
                      </div>

                      {/* Day Rows */}
                      {NR_DAYS.map((dayName, index) => {
                        const shift = getShiftForDay(index);
                        const isRestDay = shift?.isRestDay ?? true;
                        const startHour = shift ? parseTimeToHours(shift.startTime) : 0;
                        let endHour = shift ? parseTimeToHours(shift.endTime) : 0;
                        if (endHour <= startHour) endHour += 24;
                        const duration = shift && !isRestDay ? calculateDutyLength(startHour, endHour) : 0;

                        // Get FRI for this day from results
                        const dayResult = results?.calculations.find(c => c.day === nrDayIndexToShiftDay(index));
                        const dayFRI = dayResult?.riskIndex;
                        const dayRiskLevel = dayResult?.riskLevel?.level || 'low';

                        return (
                          <div
                            key={dayName}
                            className={`grid grid-cols-[50px_40px_55px_80px_80px_55px_50px_45px_45px_45px_45px_60px] gap-2 p-1.5 rounded-lg items-center ${
                              isRestDay
                                ? 'bg-slate-100 text-slate-400'
                                : index < 2
                                  ? 'bg-amber-50 border border-amber-200'
                                  : 'bg-green-50 border border-green-200'
                            }`}
                          >
                            {/* Day Name */}
                            <span className={`font-medium text-sm ${isRestDay ? 'text-slate-400' : 'text-slate-700'}`}>
                              {dayName}
                            </span>

                            {/* Rest Checkbox */}
                            <div className="flex justify-center">
                              <input
                                type="checkbox"
                                checked={isRestDay}
                                onChange={() => toggleRestDay(index)}
                                className="w-4 h-4 text-slate-600 border-slate-300 rounded"
                                title="Rest day"
                              />
                            </div>

                            {/* Travel In */}
                            <input
                              type="number"
                              min="0"
                              max="180"
                              value={shift?.commuteIn ?? 30}
                              onChange={(e) => updateWeeklyShiftParam(index, 'commuteIn', parseInt(e.target.value) || 0)}
                              disabled={isRestDay}
                              className={`w-full border border-blue-200 rounded px-1 py-1 text-xs text-center ${
                                isRestDay ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-50 text-slate-900'
                              }`}
                              title="Travel to work (mins)"
                            />

                            {/* Start Time */}
                            <input
                              type="time"
                              value={shift?.startTime || '07:00'}
                              onChange={(e) => updateWeeklyShiftTime(index, 'startTime', e.target.value)}
                              disabled={isRestDay}
                              className={`border rounded px-1 py-1 text-xs ${
                                isRestDay ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-900'
                              }`}
                            />

                            {/* End Time */}
                            <input
                              type="time"
                              value={shift?.endTime || '19:00'}
                              onChange={(e) => updateWeeklyShiftTime(index, 'endTime', e.target.value)}
                              disabled={isRestDay}
                              className={`border rounded px-1 py-1 text-xs ${
                                isRestDay ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-900'
                              }`}
                            />

                            {/* Travel Out */}
                            <input
                              type="number"
                              min="0"
                              max="180"
                              value={shift?.commuteOut ?? 30}
                              onChange={(e) => updateWeeklyShiftParam(index, 'commuteOut', parseInt(e.target.value) || 0)}
                              disabled={isRestDay}
                              className={`w-full border border-blue-200 rounded px-1 py-1 text-xs text-center ${
                                isRestDay ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-50 text-slate-900'
                              }`}
                              title="Travel home (mins)"
                            />

                            {/* Duration */}
                            <div className="text-center">
                              {isRestDay ? (
                                <span className="text-xs text-slate-400">-</span>
                              ) : (
                                <span className={`text-xs font-medium ${duration > 10 ? 'text-amber-600' : 'text-slate-700'}`}>
                                  {duration.toFixed(1)}
                                </span>
                              )}
                            </div>

                            {/* Workload */}
                            <input
                              type="number"
                              min="1"
                              max="5"
                              value={shift?.workload ?? params.workload}
                              onChange={(e) => updateWeeklyShiftParam(index, 'workload', parseInt(e.target.value) || 2)}
                              disabled={isRestDay}
                              className={`w-full border border-purple-200 rounded px-1 py-1 text-xs text-center ${
                                isRestDay ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-purple-50 text-slate-900'
                              }`}
                              title="Workload (1-5)"
                            />

                            {/* Attention */}
                            <input
                              type="number"
                              min="1"
                              max="5"
                              value={shift?.attention ?? params.attention}
                              onChange={(e) => updateWeeklyShiftParam(index, 'attention', parseInt(e.target.value) || 2)}
                              disabled={isRestDay}
                              className={`w-full border border-purple-200 rounded px-1 py-1 text-xs text-center ${
                                isRestDay ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-purple-50 text-slate-900'
                              }`}
                              title="Attention (1-5)"
                            />

                            {/* Break Frequency */}
                            <input
                              type="number"
                              min="1"
                              max="8"
                              value={shift?.breakFreq ?? params.breakFrequency}
                              onChange={(e) => updateWeeklyShiftParam(index, 'breakFreq', parseInt(e.target.value) || 2)}
                              disabled={isRestDay}
                              className={`w-full border border-green-200 rounded px-1 py-1 text-xs text-center ${
                                isRestDay ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-green-50 text-slate-900'
                              }`}
                              title="Break frequency (hours between breaks)"
                            />

                            {/* Break Length */}
                            <input
                              type="number"
                              min="5"
                              max="60"
                              step="5"
                              value={shift?.breakLen ?? params.breakLength}
                              onChange={(e) => updateWeeklyShiftParam(index, 'breakLen', parseInt(e.target.value) || 15)}
                              disabled={isRestDay}
                              className={`w-full border border-green-200 rounded px-1 py-1 text-xs text-center ${
                                isRestDay ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-green-50 text-slate-900'
                              }`}
                              title="Break length (mins)"
                            />

                            {/* FRI */}
                            <div className="text-center">
                              {isRestDay ? (
                                <span className="text-xs text-slate-400">-</span>
                              ) : dayFRI !== undefined ? (
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                  dayRiskLevel === 'low' ? 'bg-green-100 text-green-800' :
                                  dayRiskLevel === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                                  dayRiskLevel === 'elevated' ? 'bg-orange-100 text-orange-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {dayFRI.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">-</span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Weekly Summary with Average & Peak FRI */}
                      <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Working Days:</span>
                            <span className="font-medium text-slate-800">{shifts.filter(s => !s.isRestDay).length}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Rest Days:</span>
                            <span className="font-medium text-slate-800">{shifts.filter(s => s.isRestDay).length}</span>
                          </div>
                        </div>
                        {results && (
                          <div className="pt-3 border-t border-slate-200">
                            <div className="grid grid-cols-2 gap-3">
                              <div className={`p-2 rounded text-center ${getRiskColor(getRiskLevel(results.summary.avgRisk).level)}`}>
                                <p className="text-xs opacity-75">Avg FRI</p>
                                <p className="text-lg font-bold">{results.summary.avgRisk.toFixed(3)}</p>
                              </div>
                              <div className={`p-2 rounded text-center ${getRiskColor(getRiskLevel(results.summary.maxRisk).level)}`}>
                                <p className="text-xs opacity-75">Peak FRI</p>
                                <p className="text-lg font-bold">{results.summary.maxRisk.toFixed(3)}</p>
                              </div>
                            </div>
                            <p className="text-xs text-slate-500 mt-2 text-center">
                              {results.summary.highRiskCount > 0
                                ? `${results.summary.highRiskCount} day(s) above 1.1 - monitor these roles`
                                : 'All days within acceptable limits'}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Role Quick-Compare for Weekly View */}
                      {results && (
                        <div className="mt-3 p-3 bg-violet-50 rounded-lg border border-violet-200">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-violet-800">Quick Role Check</p>
                            <button
                              onClick={() => setCompareRoles(!compareRoles)}
                              className={`text-xs px-2 py-1 rounded ${
                                compareRoles ? 'bg-violet-600 text-white' : 'bg-violet-200 text-violet-700 hover:bg-violet-300'
                              }`}
                            >
                              {compareRoles ? 'Hide' : 'Compare Roles'}
                            </button>
                          </div>
                          {compareRoles && roleComparisonResults && (
                            <div className="space-y-1.5 mt-2">
                              {roleComparisonResults.map(result => (
                                <div
                                  key={result.roleKey}
                                  className={`flex items-center justify-between p-2 rounded text-xs ${
                                    result.isCompliant
                                      ? 'bg-green-100 border border-green-300'
                                      : 'bg-red-100 border border-red-300'
                                  }`}
                                >
                                  <span className={`font-medium ${result.isCompliant ? 'text-green-800' : 'text-red-800'}`}>
                                    {result.roleName}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-600">
                                      Avg: {result.avgRisk.toFixed(2)} | Peak: {result.maxRisk.toFixed(2)}
                                    </span>
                                    <span className={result.isCompliant ? 'text-green-600' : 'text-red-600'}>
                                      {result.isCompliant ? '✓' : '✗'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                              <p className="text-xs text-violet-600 mt-1">
                                Roles with Peak {'>'} 1.2 need monitoring
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Multi-Week Pattern View (Original) */}
            {viewMode === 'multiweek' && (
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Shift Pattern Definition</h3>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`text-sm px-3 py-1 rounded flex items-center gap-1 ${
                    showSettings ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Parameters
                </button>
              </div>

              <div className="p-4">
                {/* Role Preset & Start Day Selector */}
                <div className="mb-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Role Preset</label>
                    <select
                      value={selectedRole}
                      onChange={(e) => handleApplyRolePreset(e.target.value as RoleKey)}
                      className="w-full border rounded px-3 py-2 text-sm text-slate-900 bg-white"
                    >
                      {Object.entries(ROLE_PRESETS).map(([key, role]) => (
                        <option key={key} value={key} title={role.description}>
                          {role.name} ({role.workload}/{role.attention})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">{ROLE_PRESETS[selectedRole].description}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Day 1 is</label>
                    <select
                      value={startDayOfWeek}
                      onChange={(e) => setStartDayOfWeek(parseInt(e.target.value))}
                      className="w-full border rounded px-3 py-2 text-sm text-slate-900 bg-white"
                    >
                      <option value={1}>Monday</option>
                      <option value={2}>Tuesday</option>
                      <option value={3}>Wednesday</option>
                      <option value={4}>Thursday</option>
                      <option value={5}>Friday</option>
                      <option value={6}>Saturday</option>
                      <option value={7}>Sunday</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">Set the start day of your roster</p>
                  </div>
                </div>

                {/* Load from Project Shift Patterns */}
                {projects.length > 0 && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <label className="text-sm font-medium text-blue-800 mb-2 block flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Load from Project
                    </label>

                    {/* Step 1: Select Project */}
                    <div className="mb-3">
                      <label className="text-xs text-blue-700 mb-1 block">1. Select Project</label>
                      <select
                        value={selectedProjectId || ''}
                        onChange={(e) => {
                          const projectId = e.target.value ? parseInt(e.target.value) : null;
                          setSelectedProjectId(projectId);
                          setSelectedPatternId(null);
                          setSelectedEmployeeId(null);
                        }}
                        className="w-full border border-blue-200 rounded px-2 py-1.5 text-sm text-slate-900 bg-white"
                      >
                        <option value="">Select project...</option>
                        {projects.map(project => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Step 2: Select Shift Pattern */}
                    {selectedProjectId && (
                      <div className="mb-3">
                        <label className="text-xs text-blue-700 mb-1 block">2. Select Shift Pattern</label>
                        <select
                          value={selectedPatternId || ''}
                          onChange={(e) => {
                            setSelectedPatternId(e.target.value || null);
                            setSelectedEmployeeId(null);
                          }}
                          className="w-full border border-blue-200 rounded px-2 py-1.5 text-sm text-slate-900 bg-white"
                        >
                          <option value="">Select shift pattern...</option>
                          {projectPatterns.map(pattern => (
                            <option key={pattern.id} value={pattern.id}>
                              {pattern.name} {pattern.isNight ? '(Night)' : '(Day)'} - {pattern.startTime || '??'}–{pattern.endTime || '??'}
                            </option>
                          ))}
                        </select>
                        {projectPatterns.length === 0 && (
                          <p className="text-xs text-amber-600 mt-1">No shift patterns defined for this project</p>
                        )}
                      </div>
                    )}

                    {/* Load Pattern Button */}
                    {selectedPatternId && (
                      <button
                        onClick={handleLoadPattern}
                        className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium mb-3"
                      >
                        Load Shift Pattern
                      </button>
                    )}

                    {/* Step 3: Optional - Check Individual Compliance */}
                    {selectedPatternId && shifts.length > 0 && (
                      <div className="pt-3 border-t border-blue-200">
                        <label className="text-xs text-blue-700 mb-1 block">3. Check Individual Compliance (Optional)</label>
                        <p className="text-xs text-blue-600 mb-2">Select a person to apply their role's workload/attention</p>
                        <select
                          value={selectedEmployeeId || ''}
                          onChange={(e) => setSelectedEmployeeId(e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full border border-blue-200 rounded px-2 py-1.5 text-sm text-slate-900 bg-white mb-2"
                        >
                          <option value="">Select employee...</option>
                          {patternEmployees.map(emp => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} {emp.role ? `(${emp.role})` : ''}
                            </option>
                          ))}
                        </select>
                        {patternEmployees.length === 0 && (
                          <p className="text-xs text-amber-600 mb-2">No employees assigned to this pattern</p>
                        )}
                        {selectedEmployeeId && (
                          <button
                            onClick={handleApplyEmployeeRole}
                            className="w-full px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm font-medium"
                          >
                            Apply {selectedEmployee?.name}'s Role
                          </button>
                        )}
                      </div>
                    )}

                    {/* Status message */}
                    {selectedPattern && (
                      <p className="text-xs text-blue-600 mt-2">
                        {shifts.length > 0
                          ? `Loaded: ${selectedPattern.name} (${shifts.length} shifts)`
                          : `Selected: ${selectedPattern.name}`
                        }
                        {selectedEmployee && ` • Checking for: ${selectedEmployee.name}`}
                      </p>
                    )}
                  </div>
                )}

                {/* Templates */}
                <div className="mb-4">
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Or Load Template</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(TEMPLATES).map(([key, template]) => (
                      <button
                        key={key}
                        onClick={() => handleLoadTemplate(key)}
                        className="text-xs px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded text-left text-slate-700 truncate"
                        title={template.name}
                      >
                        {template.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={handleAddShift}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1 text-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Shift
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 text-sm"
                  >
                    Clear All
                  </button>
                </div>

                {/* Shifts List - Header Row */}
                {shifts.length > 0 && (
                  <div className="grid grid-cols-[60px_50px_70px_90px_90px_70px_36px_36px] gap-1 px-3 py-2 bg-slate-200 rounded-t-lg text-xs font-medium text-slate-600 items-center">
                    <span>Day</span>
                    <span>DoW</span>
                    <span className="text-center">Travel In</span>
                    <span className="text-center">Start</span>
                    <span className="text-center">Finish</span>
                    <span className="text-center">Travel Out</span>
                    <span></span>
                    <span></span>
                  </div>
                )}

                {/* Shifts List with Per-Day Parameters */}
                <div className="space-y-0 max-h-[500px] overflow-y-auto">
                  {shifts.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">
                      Add shifts or load a template to calculate fatigue risk
                    </p>
                  ) : (
                    [...shifts].sort((a, b) => a.day - b.day).map(shift => {
                      const isExpanded = expandedShiftParams === shift.id;
                      return (
                        <div key={shift.id} className="border-x border-b first:border-t bg-slate-50 overflow-hidden first:rounded-t-lg last:rounded-b-lg">
                          {/* Main Row - Grid Layout */}
                          <div className="grid grid-cols-[60px_50px_70px_90px_90px_70px_36px_36px] gap-1 p-2 items-center">
                            {/* Day Number */}
                            <input
                              type="number"
                              min="1"
                              max="28"
                              value={shift.day}
                              onChange={(e) => handleUpdateShift(shift.id, 'day', parseInt(e.target.value) || 1)}
                              className="w-full border rounded px-2 py-1.5 text-sm text-slate-900 bg-white text-center"
                              title="Day number"
                            />

                            {/* Day of Week */}
                            <span className="text-xs font-medium text-slate-600 bg-slate-200 px-1.5 py-1.5 rounded text-center">
                              {getDayOfWeek(shift.day, startDayOfWeek)}
                            </span>

                            {/* Travel In */}
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="180"
                                value={shift.commuteIn ?? 30}
                                onChange={(e) => handleUpdateShift(shift.id, 'commuteIn', parseInt(e.target.value) || 0)}
                                className="w-full border border-blue-200 rounded px-2 py-1.5 text-sm text-slate-900 bg-blue-50 text-center"
                                title="Travel time to work (mins)"
                              />
                            </div>

                            {/* Start Time */}
                            <input
                              type="time"
                              value={shift.startTime}
                              onChange={(e) => handleUpdateShift(shift.id, 'startTime', e.target.value)}
                              className="w-full border rounded px-2 py-1.5 text-sm text-slate-900 bg-white"
                              title="Shift start time"
                            />

                            {/* End Time */}
                            <input
                              type="time"
                              value={shift.endTime}
                              onChange={(e) => handleUpdateShift(shift.id, 'endTime', e.target.value)}
                              className="w-full border rounded px-2 py-1.5 text-sm text-slate-900 bg-white"
                              title="Shift end time"
                            />

                            {/* Travel Out */}
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="180"
                                value={shift.commuteOut ?? 30}
                                onChange={(e) => handleUpdateShift(shift.id, 'commuteOut', parseInt(e.target.value) || 0)}
                                className="w-full border border-purple-200 rounded px-2 py-1.5 text-sm text-slate-900 bg-purple-50 text-center"
                                title="Travel time from work (mins)"
                              />
                            </div>

                            {/* Settings Button */}
                            <button
                              onClick={() => setExpandedShiftParams(isExpanded ? null : shift.id)}
                              className={`p-1.5 rounded transition-colors ${isExpanded ? 'bg-orange-100 text-orange-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'}`}
                              title="Edit day parameters"
                            >
                              <Settings className="w-4 h-4" />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleRemoveShift(shift.id)}
                              className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded"
                              title="Remove shift"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Expanded Per-Day Parameters */}
                          {isExpanded && (
                            <div className="px-3 pb-3 pt-0 border-t border-slate-200 bg-white">
                              <div className="pt-3 space-y-3">
                                <p className="text-xs text-slate-500 font-medium">Day {shift.day} ({getDayOfWeek(shift.day, startDayOfWeek)}) Fatigue Parameters</p>

                                {/* Workload / Attention */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-xs text-slate-600 block mb-1">Workload (1-5)</label>
                                    <select
                                      value={shift.workload ?? 2}
                                      onChange={(e) => handleUpdateShift(shift.id, 'workload', parseInt(e.target.value))}
                                      className="w-full border rounded px-2 py-1.5 text-sm text-slate-900 bg-white"
                                    >
                                      <option value={1}>1 - Light</option>
                                      <option value={2}>2 - Moderate</option>
                                      <option value={3}>3 - Average</option>
                                      <option value={4}>4 - Heavy</option>
                                      <option value={5}>5 - Very Heavy</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-600 block mb-1">Attention (1-5)</label>
                                    <select
                                      value={shift.attention ?? 1}
                                      onChange={(e) => handleUpdateShift(shift.id, 'attention', parseInt(e.target.value))}
                                      className="w-full border rounded px-2 py-1.5 text-sm text-slate-900 bg-white"
                                    >
                                      <option value={1}>1 - Low</option>
                                      <option value={2}>2 - Moderate</option>
                                      <option value={3}>3 - Average</option>
                                      <option value={4}>4 - High</option>
                                      <option value={5}>5 - Very High</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Break Frequency / Length */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-xs text-slate-600 block mb-1">Break Freq (mins)</label>
                                    <input
                                      type="number"
                                      min="30"
                                      max="480"
                                      value={shift.breakFreq ?? 180}
                                      onChange={(e) => handleUpdateShift(shift.id, 'breakFreq', parseInt(e.target.value) || 180)}
                                      className="w-full border rounded px-2 py-1.5 text-sm text-slate-900 bg-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-600 block mb-1">Break Length (mins)</label>
                                    <input
                                      type="number"
                                      min="5"
                                      max="60"
                                      value={shift.breakLen ?? 30}
                                      onChange={(e) => handleUpdateShift(shift.id, 'breakLen', parseInt(e.target.value) || 30)}
                                      className="w-full border rounded px-2 py-1.5 text-sm text-slate-900 bg-white"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            )}

            {/* Parameters Panel (Collapsible) */}
            {showSettings && (
              <div className="bg-white rounded-lg shadow-md">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">HSE RR446 Default Parameters</h3>
                  <div className="flex items-center gap-2">
                    {shifts.length > 0 && (
                      <button
                        onClick={handleApplyGlobalToAll}
                        className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                      >
                        Apply to All Days
                      </button>
                    )}
                    <button
                      onClick={handleResetParams}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Reset Defaults
                    </button>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
                    These are default values for new shifts. Click the <Settings className="w-3 h-3 inline" /> icon on each shift to customize per-day parameters (e.g., different commute times for hotel stays).
                  </p>
                  {/* Commute */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">
                      Default Commute Time (minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="180"
                      value={params.commuteTime}
                      onChange={(e) => setParams({ ...params, commuteTime: parseInt(e.target.value) || 0 })}
                      className="w-full border rounded px-3 py-2 text-slate-900 bg-white"
                    />
                    <p className="text-xs text-slate-500 mt-1">Total daily commute (split 50/50 for in/out)</p>
                  </div>

                  {/* Workload & Attention */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1">
                        Workload (1-5)
                      </label>
                      <select
                        value={params.workload}
                        onChange={(e) => setParams({ ...params, workload: parseInt(e.target.value) })}
                        className="w-full border rounded px-3 py-2 text-slate-900 bg-white"
                      >
                        <option value={1}>1 - Light</option>
                        <option value={2}>2 - Moderate</option>
                        <option value={3}>3 - Average</option>
                        <option value={4}>4 - Heavy</option>
                        <option value={5}>5 - Very Heavy</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1">
                        Attention (1-5)
                      </label>
                      <select
                        value={params.attention}
                        onChange={(e) => setParams({ ...params, attention: parseInt(e.target.value) })}
                        className="w-full border rounded px-3 py-2 text-slate-900 bg-white"
                      >
                        <option value={1}>1 - Low</option>
                        <option value={2}>2 - Moderate</option>
                        <option value={3}>3 - Average</option>
                        <option value={4}>4 - High</option>
                        <option value={5}>5 - Very High</option>
                      </select>
                    </div>
                  </div>

                  {/* Break Settings */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1">
                        Break Frequency (mins)
                      </label>
                      <input
                        type="number"
                        min="30"
                        max="480"
                        value={params.breakFrequency}
                        onChange={(e) => setParams({ ...params, breakFrequency: parseInt(e.target.value) || 180 })}
                        className="w-full border rounded px-3 py-2 text-slate-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1">
                        Break Length (mins)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="60"
                        value={params.breakLength}
                        onChange={(e) => setParams({ ...params, breakLength: parseInt(e.target.value) || 30 })}
                        className="w-full border rounded px-3 py-2 text-slate-900 bg-white"
                      />
                    </div>
                  </div>

                  {/* Continuous Work */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1">
                        Continuous Work (mins)
                      </label>
                      <input
                        type="number"
                        min="30"
                        max="480"
                        value={params.continuousWork}
                        onChange={(e) => setParams({ ...params, continuousWork: parseInt(e.target.value) || 180 })}
                        className="w-full border rounded px-3 py-2 text-slate-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1">
                        Break After Continuous
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="60"
                        value={params.breakAfterContinuous}
                        onChange={(e) => setParams({ ...params, breakAfterContinuous: parseInt(e.target.value) || 30 })}
                        className="w-full border rounded px-3 py-2 text-slate-900 bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Results */}
          <div className="bg-white rounded-lg shadow-md" ref={resultsRef}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Fatigue Risk Analysis</h3>
              {results && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowChart(!showChart)}
                    className={`text-xs px-3 py-1.5 rounded flex items-center gap-1 transition-colors ${
                      showChart ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <BarChart className="w-3.5 h-3.5" />
                    Chart
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 flex items-center gap-1"
                    title="Export to CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </button>
                  <button
                    onClick={handlePrint}
                    className="text-xs px-3 py-1.5 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 flex items-center gap-1"
                    title="Print Report"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Report
                  </button>
                </div>
              )}
            </div>

            <div className="p-4">
              {!results ? (
                <div className="text-center py-12 text-slate-500">
                  <p className="text-lg mb-2">No shifts to analyze</p>
                  <p className="text-sm">Add shifts on the left to see fatigue risk calculations</p>
                </div>
              ) : (
                <>
                  {/* Fatigue Chart */}
                  {showChart && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-slate-700">FRI Progression Chart</h4>
                        <label className="flex items-center gap-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={showComponents}
                            onChange={(e) => setShowComponents(e.target.checked)}
                            className="rounded border-slate-300"
                          />
                          Show component lines
                        </label>
                      </div>
                      <FatigueChart
                        data={results.calculations}
                        showThresholds={true}
                        showComponents={showComponents}
                      />
                    </div>
                  )}

                  {/* Role Comparison Toggle */}
                  <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-700">Compare Multiple Roles</p>
                        <p className="text-xs text-slate-500">Check compliance for different worker types on the same pattern</p>
                      </div>
                      <button
                        onClick={() => setCompareRoles(!compareRoles)}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                          compareRoles ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {compareRoles ? 'Comparing...' : 'Compare Roles'}
                      </button>
                    </div>

                    {/* Role Selection for Comparison */}
                    {compareRoles && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-xs text-slate-600 mb-2">Select roles to compare:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(ROLE_PRESETS).filter(([key]) => key !== 'custom').map(([key, role]) => {
                            const roleKey = key as RoleKey;
                            const isSelected = selectedRolesForCompare.includes(roleKey);
                            return (
                              <button
                                key={key}
                                onClick={() => toggleCompareRole(roleKey)}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                  isSelected
                                    ? 'bg-violet-600 text-white'
                                    : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                                }`}
                                title={role.description}
                              >
                                {role.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Role Comparison Results */}
                  {compareRoles && roleComparisonResults && roleComparisonResults.length > 0 && (
                    <div className="mb-6 p-4 bg-violet-50 rounded-lg border border-violet-200">
                      <h4 className="text-sm font-semibold text-violet-900 mb-3">Role Compliance Summary</h4>
                      <div className="space-y-2">
                        {roleComparisonResults.map(result => (
                          <div
                            key={result.roleKey}
                            className={`p-3 rounded-lg flex items-center justify-between ${
                              result.isCompliant
                                ? 'bg-green-100 border border-green-300'
                                : 'bg-red-100 border border-red-300'
                            }`}
                          >
                            <div>
                              <span className={`font-medium ${result.isCompliant ? 'text-green-800' : 'text-red-800'}`}>
                                {result.roleName}
                              </span>
                              <span className="text-xs ml-2 opacity-75">
                                (W:{result.workload} A:{result.attention})
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right text-xs">
                                <p className={result.isCompliant ? 'text-green-700' : 'text-red-700'}>
                                  Peak: {result.maxRisk} • Avg: {result.avgRisk}
                                </p>
                                {result.highRiskDays > 0 && (
                                  <p className="text-red-600">{result.highRiskDays} high-risk day(s)</p>
                                )}
                              </div>
                              <span className={`text-lg ${result.isCompliant ? 'text-green-600' : 'text-red-600'}`}>
                                {result.isCompliant ? '✓' : '✗'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-violet-700 mt-3">
                        Compliance = Peak FRI {'<'} 1.2 (below critical threshold)
                      </p>
                    </div>
                  )}

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className={`p-4 rounded-lg border ${getRiskColor(getRiskLevel(results.summary.avgRisk).level)}`}>
                      <p className="text-xs font-medium opacity-75">Average FRI</p>
                      <p className="text-2xl font-bold">{results.summary.avgRisk}</p>
                    </div>
                    <div className={`p-4 rounded-lg border ${getRiskColor(getRiskLevel(results.summary.maxRisk).level)}`}>
                      <p className="text-xs font-medium opacity-75">Peak FRI</p>
                      <p className="text-2xl font-bold">{results.summary.maxRisk}</p>
                    </div>
                    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                      <p className="text-xs font-medium text-slate-600">Total Hours</p>
                      <p className="text-2xl font-bold text-slate-800">{results.summary.totalHours}h</p>
                    </div>
                    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                      <p className="text-xs font-medium text-slate-600">High Risk Shifts</p>
                      <p className="text-2xl font-bold text-slate-800">{results.summary.highRiskCount}</p>
                    </div>
                  </div>

                  {/* Component Breakdown */}
                  <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">Average Component Scores</h4>
                    <RiskBar value={results.summary.avgCumulative} label="Cumulative Fatigue" color="bg-blue-500" />
                    <RiskBar value={results.summary.avgTiming} label="Timing Component" color="bg-purple-500" />
                    <RiskBar value={results.summary.avgJobBreaks} label="Job/Breaks Component" color="bg-amber-500" />
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 font-medium">Combined FRI</span>
                        <span className="font-bold text-slate-800">{results.summary.avgRisk}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        FRI = Cumulative × Timing × Job/Breaks
                      </p>
                    </div>
                  </div>

                  {/* Risk Level Legend */}
                  <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs font-medium text-slate-600 mb-2">Risk Level Guide (HSE RR446)</p>
                    <div className="flex gap-2 text-xs flex-wrap">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded">{'<1.0 Low'}</span>
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">1.0-1.1 Mod</span>
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded">1.1-1.2 Elev</span>
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded">{'>1.2 Critical'}</span>
                    </div>
                  </div>

                  {/* Per-Shift Results */}
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {results.calculations.map((calc) => (
                      <div
                        key={calc.id}
                        className={`rounded-lg border overflow-hidden ${getRiskColor(calc.riskLevel.level)}`}
                      >
                        <div
                          className="p-3 cursor-pointer"
                          onClick={() => setExpandedShift(expandedShift === calc.id ? null : calc.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {expandedShift === calc.id ? (
                                <ChevronUp className="w-4 h-4 opacity-50" />
                              ) : (
                                <ChevronDown className="w-4 h-4 opacity-50" />
                              )}
                              <div>
                                <span className="font-medium">Day {calc.day}</span>
                                <span className="text-xs ml-1.5 opacity-75 bg-white/30 px-1.5 py-0.5 rounded">{calc.dayOfWeek}</span>
                                <span className="text-sm ml-2 opacity-75">
                                  {calc.startTime} - {calc.endTime}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-lg">{calc.riskIndex}</span>
                              <span className="text-xs ml-1 opacity-75">FRI</span>
                            </div>
                          </div>
                          <div className="text-xs mt-1 opacity-75">
                            Duration: {calc.dutyLength}h • {calc.riskLevel.label}
                          </div>
                        </div>

                        {/* Expanded Component Details */}
                        {expandedShift === calc.id && (
                          <div className="px-3 pb-3 pt-0 border-t border-current/20">
                            <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                              <div className="bg-white/50 rounded p-2">
                                <p className="opacity-75">Cumulative</p>
                                <p className="font-bold">{calc.cumulative}</p>
                              </div>
                              <div className="bg-white/50 rounded p-2">
                                <p className="opacity-75">Timing</p>
                                <p className="font-bold">{calc.timing}</p>
                              </div>
                              <div className="bg-white/50 rounded p-2">
                                <p className="opacity-75">Job/Breaks</p>
                                <p className="font-bold">{calc.jobBreaks}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Pattern Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Save Shift Pattern</h2>
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveError(null);
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {saveError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-200">
                  {saveError}
                </div>
              )}

              {/* Pattern Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Pattern Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={savePatternName}
                  onChange={(e) => setSavePatternName(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 bg-white"
                  placeholder="e.g., Day Shift Mon-Fri"
                />
              </div>

              {/* Project Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Assign to Project <span className="text-red-500">*</span>
                </label>
                <select
                  value={saveProjectId || ''}
                  onChange={(e) => setSaveProjectId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 bg-white"
                >
                  <option value="">Select project...</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Duty Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Duty Type
                </label>
                <select
                  value={saveDutyType}
                  onChange={(e) => setSaveDutyType(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 bg-white"
                >
                  <option value="Non-Possession">Non-Possession</option>
                  <option value="Possession">Possession</option>
                  <option value="Office">Office</option>
                  <option value="Lookout">Lookout</option>
                  <option value="Machine">Machine</option>
                  <option value="Protection">Protection</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Night Shift Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="saveIsNight"
                  checked={saveIsNight}
                  onChange={(e) => setSaveIsNight(e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-slate-300 rounded"
                />
                <label htmlFor="saveIsNight" className="text-sm font-medium text-slate-700">
                  Night Shift Pattern
                </label>
              </div>

              {/* Summary */}
              <div className="bg-slate-50 p-3 rounded-lg text-sm">
                <p className="font-medium text-slate-700 mb-1">Pattern Summary</p>
                <p className="text-slate-600">
                  Working days: {shifts.filter(s => !s.isRestDay).length} •
                  Rest days: {shifts.filter(s => s.isRestDay).length}
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveError(null);
                }}
                className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSavePattern}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Pattern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
