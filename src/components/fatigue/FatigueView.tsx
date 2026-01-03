'use client';

import { useState, useMemo, useRef } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Collapse from '@mui/material/Collapse';
import LinearProgress from '@mui/material/LinearProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { ChevronLeft, Plus, Trash2, Settings, ChevronDown, ChevronUp, Download, FileText, BarChart, Users, X, Edit } from '@/components/ui/Icons';
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
import { FatigueEntryModal } from './FatigueEntryModal';
import { useFatigueMode } from './hooks/useFatigueMode';
import { getRiskColor } from '@/lib/utils';

interface Shift extends ShiftDefinition {
  id: number;
  isRestDay?: boolean;
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
  projects?: ProjectCamel[];
  employees?: EmployeeCamel[];
  shiftPatterns?: ShiftPatternCamel[];
  assignments?: AssignmentCamel[];
  onCreateShiftPattern?: (data: Omit<ShiftPatternCamel, 'id' | 'organisationId'>) => Promise<void>;
  onUpdateShiftPattern?: (id: string, data: Partial<ShiftPatternCamel>) => Promise<void>;
  onCreateProject?: (name: string, location?: string, type?: string, startDate?: string, endDate?: string) => Promise<ProjectCamel>;
}

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

const getDayOfWeek = (dayNum: number, startDay: number = 1): string => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const index = ((startDay - 1) + (dayNum - 1)) % 7;
  return days[index];
};

const NR_DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
type NRDayKey = typeof NR_DAYS[number];

const nrDayIndexToShiftDay = (nrIndex: number): number => nrIndex + 1;

const shiftsToWeeklySchedule = (shifts: Shift[], defaultParams: { commuteTime: number; workload: number; attention: number; breakFrequency: number; breakLength: number }) => {
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
const getRiskChipSx = (level: string) => {
  switch (level) {
    case 'low': return { bgcolor: '#dcfce7', color: '#166534' };
    case 'moderate': return { bgcolor: '#fef9c3', color: '#854d0e' };
    case 'elevated': return { bgcolor: '#ffedd5', color: '#9a3412' };
    case 'critical': return { bgcolor: '#fee2e2', color: '#991b1b' };
    default: return { bgcolor: 'grey.200', color: 'grey.700' };
  }
};

const getRiskCardSx = (level: string) => {
  switch (level) {
    case 'low': return { bgcolor: '#dcfce7', color: '#166534', borderColor: '#86efac' };
    case 'moderate': return { bgcolor: '#fef9c3', color: '#854d0e', borderColor: '#fde047' };
    case 'elevated': return { bgcolor: '#ffedd5', color: '#9a3412', borderColor: '#fdba74' };
    case 'critical': return { bgcolor: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' };
    default: return { bgcolor: 'grey.100', color: 'grey.800', borderColor: 'grey.300' };
  }
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
  onCreateProject,
}: FatigueViewProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedShift, setExpandedShift] = useState<number | null>(null);
  const [expandedShiftParams, setExpandedShiftParams] = useState<number | null>(null);
  const [showChart, setShowChart] = useState(true);
  const [showComponents, setShowComponents] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [viewMode, setViewMode] = useState<'weekly' | 'multiweek'>('weekly');

  // Mode management for entry modal and read-only state
  const {
    mode,
    isReadOnly,
    loadedPattern,
    loadedProject,
    enterReviewMode,
    enterEditMode,
    enterCreateMode,
    resetToEntry,
    setLoadedPattern,
  } = useFatigueMode();

  const [showEntryModal, setShowEntryModal] = useState(true);

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savePatternName, setSavePatternName] = useState('');
  const [saveProjectId, setSaveProjectId] = useState<number | null>(null);
  const [saveDutyType, setSaveDutyType] = useState<string>('Non-Possession');
  const [saveIsNight, setSaveIsNight] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [selectedRole, setSelectedRole] = useState<RoleKey>('custom');
  const [startDayOfWeek, setStartDayOfWeek] = useState<number>(1);
  const [compareRoles, setCompareRoles] = useState(false);
  const [selectedRolesForCompare, setSelectedRolesForCompare] = useState<RoleKey[]>(['coss', 'lookout', 'labourer']);

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

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const selectedPattern = shiftPatterns.find(p => p.id === selectedPatternId);
  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  const handleLoadPattern = () => {
    if (!selectedPatternId || !selectedPattern) return;

    const loadedShifts: Shift[] = [];

    if (selectedPattern.weeklySchedule) {
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

    loadedShifts.sort((a, b) => a.day - b.day);
    setStartDayOfWeek(1);
    setShifts(loadedShifts);
  };

  const handleApplyEmployeeRole = () => {
    if (!selectedEmployeeId || !selectedEmployee) return;

    const employeeRole = selectedEmployee.role?.toLowerCase() || '';

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

    setShifts(shifts.map(s => ({ ...s, workload, attention })));
    setParams(prev => ({ ...prev, workload, attention }));
  };

  const results = useMemo(() => {
    const workingShifts = shifts.filter(s => !s.isRestDay);
    if (workingShifts.length === 0) return null;

    const sortedShifts = [...workingShifts].sort((a, b) => a.day - b.day);
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

  const worstCaseResults = useMemo(() => {
    const workingShifts = shifts.filter(s => !s.isRestDay);
    if (workingShifts.length === 0) return null;

    const sortedShifts = [...workingShifts].sort((a, b) => a.day - b.day);
    const shiftDefinitions: ShiftDefinition[] = sortedShifts.map(s => ({
      day: s.day,
      startTime: s.startTime,
      endTime: s.endTime,
      commuteIn: s.commuteIn,
      commuteOut: s.commuteOut,
      workload: 5,
      attention: 5,
      breakFreq: s.breakFreq,
      breakLen: s.breakLen,
    }));

    const worstParams = { ...params, workload: 5, attention: 5 };
    const calculations = calculateFatigueSequence(shiftDefinitions, worstParams);

    const calcByDay = new Map<number, { riskIndex: number; riskLevel: { level: string } }>();
    sortedShifts.forEach((shift, idx) => {
      calcByDay.set(shift.day, {
        riskIndex: Math.round(calculations[idx].riskIndex * 1000) / 1000,
        riskLevel: getRiskLevel(calculations[idx].riskIndex),
      });
    });

    return calcByDay;
  }, [shifts, params]);

  const roleComparisonResults = useMemo(() => {
    const workingShifts = shifts.filter(s => !s.isRestDay);
    if (!compareRoles || workingShifts.length === 0) return null;

    const sortedShifts = [...workingShifts].sort((a, b) => a.day - b.day);

    const roleResults = selectedRolesForCompare.map(roleKey => {
      const role = ROLE_PRESETS[roleKey];

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

      const roleParams = { ...params, workload: role.workload, attention: role.attention };

      const calculations = calculateFatigueSequence(shiftDefinitions, roleParams);
      const maxRisk = Math.max(...calculations.map(c => c.riskIndex));
      const avgRisk = calculations.reduce((a, c) => a + c.riskIndex, 0) / calculations.length;
      const highRiskDays = calculations.filter(c => c.riskIndex >= 1.1).length;
      const isCompliant = maxRisk < 1.2;

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

  const handleApplyRolePreset = (roleKey: RoleKey) => {
    setSelectedRole(roleKey);
    if (roleKey !== 'custom') {
      const role = ROLE_PRESETS[roleKey];
      setParams(prev => ({ ...prev, workload: role.workload, attention: role.attention }));
      setShifts(shifts.map(s => ({ ...s, workload: role.workload, attention: role.attention })));
    }
  };

  const initializeWeeklyShifts = () => {
    const weekShifts: Shift[] = NR_DAYS.map((_, index) => ({
      id: Date.now() + index,
      day: nrDayIndexToShiftDay(index),
      startTime: '07:00',
      endTime: '19:00',
      isRestDay: index === 0 || index === 1,
      commuteIn: Math.floor(params.commuteTime / 2),
      commuteOut: Math.ceil(params.commuteTime / 2),
      workload: params.workload,
      attention: params.attention,
      breakFreq: params.breakFrequency,
      breakLen: params.breakLength,
    }));
    setShifts(weekShifts);
    setStartDayOfWeek(6);
  };

  const toggleRestDay = (dayIndex: number) => {
    const dayNum = nrDayIndexToShiftDay(dayIndex);
    setShifts(prev => prev.map(s =>
      s.day === dayNum ? { ...s, isRestDay: !s.isRestDay } : s
    ));
  };

  const updateWeeklyShiftTime = (dayIndex: number, field: 'startTime' | 'endTime', value: string) => {
    const dayNum = nrDayIndexToShiftDay(dayIndex);
    setShifts(prev => prev.map(s =>
      s.day === dayNum ? { ...s, [field]: value } : s
    ));
  };

  const updateWeeklyShiftParam = (dayIndex: number, field: keyof Shift, value: number) => {
    const dayNum = nrDayIndexToShiftDay(dayIndex);
    setShifts(prev => prev.map(s =>
      s.day === dayNum ? { ...s, [field]: value } : s
    ));
  };

  const getShiftForDay = (dayIndex: number): Shift | undefined => {
    const dayNum = nrDayIndexToShiftDay(dayIndex);
    return shifts.find(s => s.day === dayNum);
  };

  // Entry modal handlers
  const handleSelectPatternFromModal = (pattern: ShiftPatternCamel, project: ProjectCamel, mode: 'review' | 'edit') => {
    setSelectedProjectId(project.id);
    setSelectedPatternId(pattern.id);
    setShowEntryModal(false);

    // Load the pattern
    const loadedShifts: Shift[] = [];
    if (pattern.weeklySchedule) {
      const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
      const schedule = pattern.weeklySchedule;

      Object.entries(schedule).forEach(([dayName, daySchedule]) => {
        if (daySchedule && daySchedule.startTime && daySchedule.endTime) {
          const dayNum = dayMap[dayName] || 1;
          loadedShifts.push({
            id: Date.now() + dayNum,
            day: dayNum,
            startTime: daySchedule.startTime,
            endTime: daySchedule.endTime,
            commuteIn: daySchedule.commuteIn ?? Math.floor((pattern.commuteTime || params.commuteTime) / 2),
            commuteOut: daySchedule.commuteOut ?? Math.ceil((pattern.commuteTime || params.commuteTime) / 2),
            workload: daySchedule.workload ?? pattern.workload ?? params.workload,
            attention: daySchedule.attention ?? pattern.attention ?? params.attention,
            breakFreq: daySchedule.breakFreq ?? pattern.breakFrequency ?? params.breakFrequency,
            breakLen: daySchedule.breakLen ?? pattern.breakLength ?? params.breakLength,
          });
        }
      });
    } else if (pattern.startTime && pattern.endTime) {
      for (let day = 1; day <= 5; day++) {
        loadedShifts.push({
          id: Date.now() + day,
          day,
          startTime: pattern.startTime,
          endTime: pattern.endTime,
          commuteIn: Math.floor((pattern.commuteTime || params.commuteTime) / 2),
          commuteOut: Math.ceil((pattern.commuteTime || params.commuteTime) / 2),
          workload: pattern.workload ?? params.workload,
          attention: pattern.attention ?? params.attention,
          breakFreq: pattern.breakFrequency ?? params.breakFrequency,
          breakLen: pattern.breakLength ?? params.breakLength,
        });
      }
    }

    loadedShifts.sort((a, b) => a.day - b.day);
    setStartDayOfWeek(1);
    setShifts(loadedShifts);

    if (mode === 'review') {
      enterReviewMode(pattern, project);
    } else {
      enterEditMode();
      setLoadedPattern(pattern);
    }
  };

  const handleCreateNewPatternFromModal = (project: ProjectCamel) => {
    setSelectedProjectId(project.id);
    setSelectedPatternId(null);
    setShowEntryModal(false);
    enterCreateMode(project);
    initializeWeeklyShifts();
  };

  const handleCreateProjectFromModal = async (name: string, location?: string, type?: string, startDate?: string, endDate?: string): Promise<ProjectCamel> => {
    if (!onCreateProject) {
      throw new Error('Project creation not available');
    }
    return onCreateProject(name, location, type, startDate, endDate);
  };

  const handleBackToEntry = () => {
    setShifts([]);
    setSelectedProjectId(null);
    setSelectedPatternId(null);
    resetToEntry();
    setShowEntryModal(true);
  };

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
      alert('Pattern updated successfully!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update pattern';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCompareRole = (roleKey: RoleKey) => {
    if (selectedRolesForCompare.includes(roleKey)) {
      setSelectedRolesForCompare(selectedRolesForCompare.filter(r => r !== roleKey));
    } else {
      setSelectedRolesForCompare([...selectedRolesForCompare, roleKey]);
    }
  };

  const handleExportCSV = () => {
    if (!results) return;

    const headers = ['Day', 'Start Time', 'End Time', 'Duration (h)', 'Cumulative', 'Timing', 'Job/Breaks', 'FRI', 'Risk Level'];

    const rows = results.calculations.map(calc => [
      calc.day, calc.startTime, calc.endTime, calc.dutyLength,
      calc.cumulative, calc.timing, calc.jobBreaks, calc.riskIndex, calc.riskLevel.label,
    ]);

    rows.push([]);
    rows.push(['Summary']);
    rows.push(['Average FRI', '', '', '', '', '', '', results.summary.avgRisk]);
    rows.push(['Peak FRI', '', '', '', '', '', '', results.summary.maxRisk]);
    rows.push(['Total Hours', '', '', results.summary.totalHours]);
    rows.push(['High Risk Shifts', '', '', '', '', '', '', results.summary.highRiskCount]);

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
            <p>FRI = Cumulative Factor x Timing Factor x Job/Breaks Factor</p>
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

  // Risk bar component
  const RiskBar = ({ value, max = 1.5, label, color }: { value: number; max?: number; label: string; color: string }) => {
    const percentage = Math.min(100, (value / max) * 100);
    return (
      <Box sx={{ mb: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          <Typography variant="caption" fontWeight={600}>{value.toFixed(3)}</Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={percentage}
          sx={{
            height: 8,
            borderRadius: 1,
            bgcolor: 'grey.200',
            '& .MuiLinearProgress-bar': { bgcolor: color },
          }}
        />
      </Box>
    );
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Entry Modal */}
      <FatigueEntryModal
        open={showEntryModal}
        onClose={() => setShowEntryModal(false)}
        projects={projects}
        shiftPatterns={shiftPatterns}
        onSelectPattern={handleSelectPatternFromModal}
        onCreateNewPattern={handleCreateNewPatternFromModal}
        onCreateProject={handleCreateProjectFromModal}
      />

      {/* Header */}
      <AppBar position="static" sx={{ background: 'linear-gradient(to right, #1e293b, #0f172a)', borderBottom: '4px solid #f97316' }}>
        <Toolbar>
          <Button
            startIcon={<ChevronLeft className="w-4 h-4" />}
            onClick={mode === 'entry' ? onBack : handleBackToEntry}
            sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.1)', mr: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
          >
            {mode === 'entry' ? 'Back' : 'Change Pattern'}
          </Button>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
            Fatigue <Box component="span" sx={{ color: '#fb923c' }}>Risk Assessment</Box>
          </Typography>
          <Chip
            label="HSE RR446 COMPLIANT"
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#fb923c', fontFamily: 'monospace', fontSize: '0.7rem', mr: 2 }}
          />
          <Typography variant="body2" sx={{ color: 'grey.400' }}>{user?.email}</Typography>
        </Toolbar>
      </AppBar>

      {/* Mode Banner - shows in review mode */}
      {isReadOnly && (
        <Alert
          severity="info"
          sx={{ borderRadius: 0 }}
          action={
            <Button
              color="inherit"
              size="small"
              variant="outlined"
              startIcon={<Edit className="w-4 h-4" />}
              onClick={enterEditMode}
            >
              Edit Pattern
            </Button>
          }
        >
          <Typography variant="body2">
            <strong>Review Mode</strong> - Viewing {loadedPattern?.name} from {loadedProject?.name}. Click "Edit Pattern" to make changes.
          </Typography>
        </Alert>
      )}

      <Box sx={{ p: 3 }}>
        {/* Project/Pattern Info Banner */}
        {loadedProject && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">Project</Typography>
              <Typography variant="h6">{loadedProject.name}</Typography>
              {loadedProject.location && (
                <Typography variant="caption" color="text.secondary">{loadedProject.location}</Typography>
              )}
            </Box>
            {loadedPattern && (
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="subtitle2" color="text.secondary">Pattern</Typography>
                <Typography variant="h6">{loadedPattern.name}</Typography>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  <Chip label={loadedPattern.dutyType} size="small" variant="outlined" />
                  {loadedPattern.isNight && <Chip label="Night" size="small" color="info" variant="outlined" />}
                </Box>
              </Box>
            )}
          </Paper>
        )}

        {/* View Mode Toggle & Actions */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, val) => val && !isReadOnly && setViewMode(val)}
            size="small"
            sx={{ bgcolor: 'white' }}
            disabled={isReadOnly}
          >
            <ToggleButton value="weekly" sx={{ px: 3 }}>7-Day Week</ToggleButton>
            <ToggleButton value="multiweek" sx={{ px: 3 }}>Multi-Week Pattern</ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {!isReadOnly && shifts.length > 0 && onCreateShiftPattern && (
              <Button
                variant="contained"
                color="success"
                startIcon={<Download className="w-4 h-4" />}
                onClick={() => { setSaveProjectId(selectedProjectId); setShowSaveModal(true); }}
              >
                Save as New Pattern
              </Button>
            )}
            {!isReadOnly && shifts.length > 0 && selectedPatternId && onUpdateShiftPattern && (
              <Button
                variant="contained"
                color="secondary"
                onClick={handleUpdateExistingPattern}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Update Pattern'}
              </Button>
            )}
          </Box>
        </Box>

        {/* Two Column Layout - Shift Builder + Chart */}
        <Grid container spacing={2}>
          {/* Left Panel - Shift Builder */}
          <Grid size={{ xs: 12, lg: 7 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* 7-Day Weekly View */}
              {viewMode === 'weekly' && (
                <Paper elevation={2}>
                  <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1" fontWeight={600}>Network Rail Week (Sat-Fri)</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button size="small" variant="outlined" color="primary" onClick={initializeWeeklyShifts}>
                        Reset Week
                      </Button>
                      <Button
                        size="small"
                        variant={showSettings ? 'contained' : 'outlined'}
                        color={showSettings ? 'warning' : 'inherit'}
                        startIcon={<Settings className="w-4 h-4" />}
                        onClick={() => setShowSettings(!showSettings)}
                      >
                        Parameters
                      </Button>
                    </Box>
                  </Box>

                  <Box sx={{ p: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                      Network Rail week runs Saturday to Friday. Check "Rest" for non-working days.
                    </Typography>

                    {shifts.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography color="text.secondary" sx={{ mb: 2 }}>
                          Click "Reset Week" to create a 7-day roster template
                        </Typography>
                        <Button variant="contained" onClick={initializeWeeklyShifts}>
                          Create Week Template
                        </Button>
                      </Box>
                    ) : (
                      <Box>
                        {/* Global Parameters Summary */}
                        <Alert severity="warning" sx={{ mb: 2, py: 0.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" fontWeight={600}>Global Settings:</Typography>
                            <Typography variant="caption">
                              Continuous: <strong>{params.continuousWork}h</strong> | Break after: <strong>{params.breakAfterContinuous}m</strong>
                            </Typography>
                          </Box>
                        </Alert>

                        {/* Header */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: '45px 40px 50px 75px 75px 50px 45px 45px 45px 50px 45px 60px 60px', gap: 0.5, px: 1, py: 1, bgcolor: 'grey.100', borderRadius: 1, mb: 1 }}>
                          <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center' }}>Day</Typography>
                          <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center' }}>Rest</Typography>
                          <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center', color: 'info.main' }}>In</Typography>
                          <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center' }}>Start</Typography>
                          <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center' }}>End</Typography>
                          <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center', color: 'info.main' }}>Out</Typography>
                          <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center' }}>Hrs</Typography>
                          <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center', color: 'secondary.main' }}>W</Typography>
                          <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center', color: 'secondary.main' }}>A</Typography>
                          <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center', color: 'success.main' }}>BF</Typography>
                          <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center', color: 'success.main' }}>BL</Typography>
                          <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center' }}>FRI</Typography>
                          <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center', color: 'error.main' }}>Worst</Typography>
                        </Box>

                        {/* Day Rows */}
                        {NR_DAYS.map((dayName, index) => {
                          const shift = getShiftForDay(index);
                          const isRestDay = shift?.isRestDay ?? true;
                          const startHour = shift ? parseTimeToHours(shift.startTime) : 0;
                          let endHour = shift ? parseTimeToHours(shift.endTime) : 0;
                          if (endHour <= startHour) endHour += 24;
                          const duration = shift && !isRestDay ? calculateDutyLength(startHour, endHour) : 0;

                          const dayResult = results?.calculations.find(c => c.day === nrDayIndexToShiftDay(index));
                          const dayFRI = dayResult?.riskIndex;
                          const dayRiskLevel = dayResult?.riskLevel?.level || 'low';

                          const worstResult = worstCaseResults?.get(nrDayIndexToShiftDay(index));
                          const worstCaseFRI = worstResult?.riskIndex;
                          const worstCaseLevel = worstResult?.riskLevel?.level || 'low';

                          return (
                            <Box
                              key={dayName}
                              sx={{
                                display: 'grid',
                                gridTemplateColumns: '45px 40px 50px 75px 75px 50px 45px 45px 45px 50px 45px 60px 60px',
                                gap: 0.5,
                                p: 1,
                                borderRadius: 1,
                                alignItems: 'center',
                                bgcolor: isRestDay ? 'grey.100' : (index < 2 ? 'warning.50' : 'success.50'),
                                border: 1,
                                borderColor: isRestDay ? 'grey.300' : (index < 2 ? 'warning.200' : 'success.200'),
                                mb: 0.5,
                                opacity: isRestDay ? 0.7 : 1,
                              }}
                            >
                              <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'center' }}>{dayName}</Typography>

                              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                <Checkbox
                                  size="small"
                                  checked={isRestDay}
                                  onChange={() => toggleRestDay(index)}
                                  sx={{ p: 0 }}
                                />
                              </Box>

                              <TextField
                                type="number"
                                size="small"
                                value={shift?.commuteIn ?? 30}
                                onChange={(e) => updateWeeklyShiftParam(index, 'commuteIn', parseInt(e.target.value) || 0)}
                                disabled={isRestDay}
                                slotProps={{ htmlInput: { min: 0, max: 180, style: { textAlign: 'center', padding: '4px' } } }}
                                sx={{ '& .MuiOutlinedInput-root': { bgcolor: isRestDay ? 'grey.200' : 'info.50' } }}
                              />

                              <TextField
                                type="time"
                                size="small"
                                value={shift?.startTime || '07:00'}
                                onChange={(e) => updateWeeklyShiftTime(index, 'startTime', e.target.value)}
                                disabled={isRestDay}
                                slotProps={{ htmlInput: { style: { padding: '4px' } } }}
                                sx={{ '& .MuiOutlinedInput-root': { bgcolor: isRestDay ? 'grey.200' : 'white' } }}
                              />

                              <TextField
                                type="time"
                                size="small"
                                value={shift?.endTime || '19:00'}
                                onChange={(e) => updateWeeklyShiftTime(index, 'endTime', e.target.value)}
                                disabled={isRestDay}
                                slotProps={{ htmlInput: { style: { padding: '4px' } } }}
                                sx={{ '& .MuiOutlinedInput-root': { bgcolor: isRestDay ? 'grey.200' : 'white' } }}
                              />

                              <TextField
                                type="number"
                                size="small"
                                value={shift?.commuteOut ?? 30}
                                onChange={(e) => updateWeeklyShiftParam(index, 'commuteOut', parseInt(e.target.value) || 0)}
                                disabled={isRestDay}
                                slotProps={{ htmlInput: { min: 0, max: 180, style: { textAlign: 'center', padding: '4px' } } }}
                                sx={{ '& .MuiOutlinedInput-root': { bgcolor: isRestDay ? 'grey.200' : 'info.50' } }}
                              />

                              <Typography variant="body2" sx={{ textAlign: 'center', fontWeight: duration > 10 ? 600 : 400, color: duration > 10 ? 'warning.main' : 'text.primary' }}>
                                {isRestDay ? '-' : duration.toFixed(1)}
                              </Typography>

                              <TextField
                                select
                                size="small"
                                value={shift?.workload ?? params.workload}
                                onChange={(e) => updateWeeklyShiftParam(index, 'workload', parseInt(e.target.value))}
                                disabled={isRestDay}
                                slotProps={{ htmlInput: { style: { padding: '4px', textAlign: 'center' } } }}
                                sx={{ '& .MuiOutlinedInput-root': { bgcolor: isRestDay ? 'grey.200' : 'secondary.50' } }}
                              >
                                {[1, 2, 3, 4, 5].map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                              </TextField>

                              <TextField
                                select
                                size="small"
                                value={shift?.attention ?? params.attention}
                                onChange={(e) => updateWeeklyShiftParam(index, 'attention', parseInt(e.target.value))}
                                disabled={isRestDay}
                                slotProps={{ htmlInput: { style: { padding: '4px', textAlign: 'center' } } }}
                                sx={{ '& .MuiOutlinedInput-root': { bgcolor: isRestDay ? 'grey.200' : 'secondary.50' } }}
                              >
                                {[1, 2, 3, 4, 5].map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                              </TextField>

                              <TextField
                                type="number"
                                size="small"
                                value={shift?.breakFreq ?? params.breakFrequency}
                                onChange={(e) => updateWeeklyShiftParam(index, 'breakFreq', parseInt(e.target.value) || 2)}
                                disabled={isRestDay}
                                slotProps={{ htmlInput: { min: 1, max: 8, style: { textAlign: 'center', padding: '4px' } } }}
                                sx={{ '& .MuiOutlinedInput-root': { bgcolor: isRestDay ? 'grey.200' : 'success.50' } }}
                              />

                              <TextField
                                type="number"
                                size="small"
                                value={shift?.breakLen ?? params.breakLength}
                                onChange={(e) => updateWeeklyShiftParam(index, 'breakLen', parseInt(e.target.value) || 15)}
                                disabled={isRestDay}
                                slotProps={{ htmlInput: { min: 5, max: 60, step: 5, style: { textAlign: 'center', padding: '4px' } } }}
                                sx={{ '& .MuiOutlinedInput-root': { bgcolor: isRestDay ? 'grey.200' : 'success.50' } }}
                              />

                              <Box sx={{ textAlign: 'center' }}>
                                {isRestDay ? (
                                  <Typography variant="caption" color="text.disabled">-</Typography>
                                ) : dayFRI !== undefined ? (
                                  <Chip size="small" label={dayFRI.toFixed(3)} sx={{ ...getRiskChipSx(dayRiskLevel), fontSize: '0.7rem', fontWeight: 700, height: 22 }} />
                                ) : (
                                  <Typography variant="caption" color="text.disabled">-</Typography>
                                )}
                              </Box>

                              <Box sx={{ textAlign: 'center' }}>
                                {isRestDay ? (
                                  <Typography variant="caption" color="text.disabled">-</Typography>
                                ) : worstCaseFRI !== undefined ? (
                                  <Chip size="small" label={worstCaseFRI.toFixed(3)} sx={{ ...getRiskChipSx(worstCaseLevel), fontSize: '0.7rem', fontWeight: 700, height: 22 }} />
                                ) : (
                                  <Typography variant="caption" color="text.disabled">-</Typography>
                                )}
                              </Box>
                            </Box>
                          );
                        })}

                        {/* Weekly Summary */}
                        <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
                          <Grid container spacing={2} sx={{ mb: 2 }}>
                            <Grid size={{ xs: 6 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" color="text.secondary">Working Days:</Typography>
                                <Typography variant="body2" fontWeight={600}>{shifts.filter(s => !s.isRestDay).length}</Typography>
                              </Box>
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" color="text.secondary">Rest Days:</Typography>
                                <Typography variant="body2" fontWeight={600}>{shifts.filter(s => s.isRestDay).length}</Typography>
                              </Box>
                            </Grid>
                          </Grid>
                          {results && (
                            <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 6 }}>
                                  <Paper sx={{ p: 1.5, textAlign: 'center', ...getRiskCardSx(getRiskLevel(results.summary.avgRisk).level) }}>
                                    <Typography variant="caption" sx={{ opacity: 0.8 }}>Avg FRI</Typography>
                                    <Typography variant="h6" fontWeight={700}>{results.summary.avgRisk.toFixed(3)}</Typography>
                                  </Paper>
                                </Grid>
                                <Grid size={{ xs: 6 }}>
                                  <Paper sx={{ p: 1.5, textAlign: 'center', ...getRiskCardSx(getRiskLevel(results.summary.maxRisk).level) }}>
                                    <Typography variant="caption" sx={{ opacity: 0.8 }}>Peak FRI</Typography>
                                    <Typography variant="h6" fontWeight={700}>{results.summary.maxRisk.toFixed(3)}</Typography>
                                  </Paper>
                                </Grid>
                              </Grid>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                                {results.summary.highRiskCount > 0
                                  ? `${results.summary.highRiskCount} day(s) above 1.1 - monitor these roles`
                                  : 'All days within acceptable limits'}
                              </Typography>
                            </Box>
                          )}
                        </Paper>

                        {/* Role Quick-Compare */}
                        {results && (
                          <Paper variant="outlined" sx={{ mt: 2, p: 2, bgcolor: 'secondary.50' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                              <Typography variant="caption" fontWeight={600} color="secondary.dark">Quick Role Check</Typography>
                              <Button
                                size="small"
                                variant={compareRoles ? 'contained' : 'outlined'}
                                color="secondary"
                                onClick={() => setCompareRoles(!compareRoles)}
                              >
                                {compareRoles ? 'Hide' : 'Compare Roles'}
                              </Button>
                            </Box>
                            <Collapse in={compareRoles}>
                              {roleComparisonResults && (
                                <Box sx={{ mt: 1 }}>
                                  {roleComparisonResults.map(result => (
                                    <Paper
                                      key={result.roleKey}
                                      variant="outlined"
                                      sx={{
                                        p: 1,
                                        mb: 0.5,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        bgcolor: result.isCompliant ? 'success.50' : 'error.50',
                                        borderColor: result.isCompliant ? 'success.300' : 'error.300',
                                      }}
                                    >
                                      <Typography variant="body2" fontWeight={600} color={result.isCompliant ? 'success.dark' : 'error.dark'}>
                                        {result.roleName}
                                      </Typography>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="caption" color="text.secondary">
                                          Avg: {result.avgRisk.toFixed(2)} | Peak: {result.maxRisk.toFixed(2)}
                                        </Typography>
                                        <Typography variant="body2" color={result.isCompliant ? 'success.main' : 'error.main'}>
                                          {result.isCompliant ? '✓' : '✗'}
                                        </Typography>
                                      </Box>
                                    </Paper>
                                  ))}
                                  <Typography variant="caption" color="secondary.dark" sx={{ display: 'block', mt: 1 }}>
                                    Roles with Peak {'>'} 1.2 need monitoring
                                  </Typography>
                                </Box>
                              )}
                            </Collapse>
                          </Paper>
                        )}
                      </Box>
                    )}
                  </Box>
                </Paper>
              )}

              {/* Multi-Week Pattern View */}
              {viewMode === 'multiweek' && (
                <Paper elevation={2}>
                  <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1" fontWeight={600}>Shift Pattern Definition</Typography>
                    <Button
                      size="small"
                      variant={showSettings ? 'contained' : 'outlined'}
                      color={showSettings ? 'warning' : 'inherit'}
                      startIcon={<Settings className="w-4 h-4" />}
                      onClick={() => setShowSettings(!showSettings)}
                    >
                      Parameters
                    </Button>
                  </Box>

                  <Box sx={{ p: 2 }}>
                    {/* Role Preset & Start Day */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      <Grid size={{ xs: 6 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Role Preset</InputLabel>
                          <Select
                            value={selectedRole}
                            label="Role Preset"
                            onChange={(e) => handleApplyRolePreset(e.target.value as RoleKey)}
                          >
                            {Object.entries(ROLE_PRESETS).map(([key, role]) => (
                              <MenuItem key={key} value={key}>
                                {role.name} ({role.workload}/{role.attention})
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <Typography variant="caption" color="text.secondary">{ROLE_PRESETS[selectedRole].description}</Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Day 1 is</InputLabel>
                          <Select
                            value={startDayOfWeek}
                            label="Day 1 is"
                            onChange={(e) => setStartDayOfWeek(Number(e.target.value))}
                          >
                            <MenuItem value={1}>Monday</MenuItem>
                            <MenuItem value={2}>Tuesday</MenuItem>
                            <MenuItem value={3}>Wednesday</MenuItem>
                            <MenuItem value={4}>Thursday</MenuItem>
                            <MenuItem value={5}>Friday</MenuItem>
                            <MenuItem value={6}>Saturday</MenuItem>
                            <MenuItem value={7}>Sunday</MenuItem>
                          </Select>
                        </FormControl>
                        <Typography variant="caption" color="text.secondary">Set the start day of your roster</Typography>
                      </Grid>
                    </Grid>

                    {/* Load from Project */}
                    {projects.length > 0 && (
                      <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'info.50', borderColor: 'info.200' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                          <Users className="w-4 h-4" />
                          <Typography variant="subtitle2" color="info.dark">Load from Project</Typography>
                        </Box>

                        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                          <InputLabel>1. Select Project</InputLabel>
                          <Select
                            value={selectedProjectId || ''}
                            label="1. Select Project"
                            onChange={(e) => {
                              const projectId = e.target.value ? parseInt(String(e.target.value)) : null;
                              setSelectedProjectId(projectId);
                              setSelectedPatternId(null);
                              setSelectedEmployeeId(null);
                            }}
                          >
                            <MenuItem value="">Select project...</MenuItem>
                            {projects.map(project => (
                              <MenuItem key={project.id} value={project.id}>{project.name}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>

                        {selectedProjectId && (
                          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                            <InputLabel>2. Select Shift Pattern</InputLabel>
                            <Select
                              value={selectedPatternId || ''}
                              label="2. Select Shift Pattern"
                              onChange={(e) => {
                                setSelectedPatternId(e.target.value as string || null);
                                setSelectedEmployeeId(null);
                              }}
                            >
                              <MenuItem value="">Select shift pattern...</MenuItem>
                              {projectPatterns.map(pattern => (
                                <MenuItem key={pattern.id} value={pattern.id}>
                                  {pattern.name} {pattern.isNight ? '(Night)' : '(Day)'} - {pattern.startTime || '??'}-{pattern.endTime || '??'}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}

                        {selectedPatternId && (
                          <Button fullWidth variant="contained" color="primary" onClick={handleLoadPattern} sx={{ mb: 2 }}>
                            Load Shift Pattern
                          </Button>
                        )}

                        {selectedPatternId && shifts.length > 0 && (
                          <Box sx={{ pt: 2, borderTop: 1, borderColor: 'info.200' }}>
                            <Typography variant="caption" color="info.dark" sx={{ display: 'block', mb: 1 }}>
                              3. Check Individual Compliance (Optional)
                            </Typography>
                            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                              <InputLabel>Select employee</InputLabel>
                              <Select
                                value={selectedEmployeeId || ''}
                                label="Select employee"
                                onChange={(e) => setSelectedEmployeeId(e.target.value ? parseInt(String(e.target.value)) : null)}
                              >
                                <MenuItem value="">Select employee...</MenuItem>
                                {patternEmployees.map(emp => (
                                  <MenuItem key={emp.id} value={emp.id}>
                                    {emp.name} {emp.role ? `(${emp.role})` : ''}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            {selectedEmployeeId && (
                              <Button fullWidth variant="contained" color="secondary" onClick={handleApplyEmployeeRole}>
                                Apply {selectedEmployee?.name}'s Role
                              </Button>
                            )}
                          </Box>
                        )}
                      </Paper>
                    )}

                    {/* Templates */}
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Or Load Template</Typography>
                      <Grid container spacing={1}>
                        {Object.entries(TEMPLATES).map(([key, template]) => (
                          <Grid size={{ xs: 6 }} key={key}>
                            <Button
                              fullWidth
                              variant="outlined"
                              size="small"
                              onClick={() => handleLoadTemplate(key)}
                              sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                            >
                              {template.name}
                            </Button>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>

                    {/* Actions */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                      <Button variant="contained" startIcon={<Plus className="w-4 h-4" />} onClick={handleAddShift}>
                        Add Shift
                      </Button>
                      <Button variant="outlined" onClick={handleClearAll}>
                        Clear All
                      </Button>
                    </Box>

                    {/* Shifts List */}
                    {shifts.length > 0 && (
                      <Box sx={{ display: 'grid', gridTemplateColumns: '60px 50px 70px 90px 90px 70px 36px 36px', gap: 0.5, px: 1, py: 1, bgcolor: 'grey.200', borderRadius: '8px 8px 0 0' }}>
                        <Typography variant="caption" fontWeight={600}>Day</Typography>
                        <Typography variant="caption" fontWeight={600}>DoW</Typography>
                        <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center' }}>Travel In</Typography>
                        <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center' }}>Start</Typography>
                        <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center' }}>Finish</Typography>
                        <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center' }}>Travel Out</Typography>
                        <Box />
                        <Box />
                      </Box>
                    )}

                    <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
                      {shifts.length === 0 ? (
                        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                          Add shifts or load a template to calculate fatigue risk
                        </Typography>
                      ) : (
                        [...shifts].sort((a, b) => a.day - b.day).map(shift => {
                          const isExpanded = expandedShiftParams === shift.id;
                          return (
                            <Paper key={shift.id} variant="outlined" sx={{ mb: 0.5, overflow: 'hidden' }}>
                              <Box sx={{ display: 'grid', gridTemplateColumns: '60px 50px 70px 90px 90px 70px 36px 36px', gap: 0.5, p: 1, alignItems: 'center' }}>
                                <TextField
                                  type="number"
                                  size="small"
                                  value={shift.day}
                                  onChange={(e) => handleUpdateShift(shift.id, 'day', parseInt(e.target.value) || 1)}
                                  slotProps={{ htmlInput: { min: 1, max: 28, style: { textAlign: 'center', padding: '6px' } } }}
                                />
                                <Chip size="small" label={getDayOfWeek(shift.day, startDayOfWeek)} sx={{ bgcolor: 'grey.200' }} />
                                <TextField
                                  type="number"
                                  size="small"
                                  value={shift.commuteIn ?? 30}
                                  onChange={(e) => handleUpdateShift(shift.id, 'commuteIn', parseInt(e.target.value) || 0)}
                                  slotProps={{ htmlInput: { min: 0, max: 180, style: { textAlign: 'center', padding: '6px' } } }}
                                  sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'info.50' } }}
                                />
                                <TextField
                                  type="time"
                                  size="small"
                                  value={shift.startTime}
                                  onChange={(e) => handleUpdateShift(shift.id, 'startTime', e.target.value)}
                                  slotProps={{ htmlInput: { style: { padding: '6px' } } }}
                                />
                                <TextField
                                  type="time"
                                  size="small"
                                  value={shift.endTime}
                                  onChange={(e) => handleUpdateShift(shift.id, 'endTime', e.target.value)}
                                  slotProps={{ htmlInput: { style: { padding: '6px' } } }}
                                />
                                <TextField
                                  type="number"
                                  size="small"
                                  value={shift.commuteOut ?? 30}
                                  onChange={(e) => handleUpdateShift(shift.id, 'commuteOut', parseInt(e.target.value) || 0)}
                                  slotProps={{ htmlInput: { min: 0, max: 180, style: { textAlign: 'center', padding: '6px' } } }}
                                  sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'secondary.50' } }}
                                />
                                <IconButton
                                  size="small"
                                  onClick={() => setExpandedShiftParams(isExpanded ? null : shift.id)}
                                  color={isExpanded ? 'warning' : 'default'}
                                >
                                  <Settings className="w-4 h-4" />
                                </IconButton>
                                <IconButton size="small" color="error" onClick={() => handleRemoveShift(shift.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </IconButton>
                              </Box>

                              <Collapse in={isExpanded}>
                                <Box sx={{ px: 2, pb: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, mb: 1 }}>
                                    Day {shift.day} ({getDayOfWeek(shift.day, startDayOfWeek)}) Fatigue Parameters
                                  </Typography>
                                  <Grid container spacing={2}>
                                    <Grid size={{ xs: 6 }}>
                                      <FormControl fullWidth size="small">
                                        <InputLabel>Workload (1-5)</InputLabel>
                                        <Select
                                          value={shift.workload ?? params.workload}
                                          label="Workload (1-5)"
                                          onChange={(e) => handleUpdateShift(shift.id, 'workload', parseInt(String(e.target.value)))}
                                        >
                                          <MenuItem value={1}>1 - Light</MenuItem>
                                          <MenuItem value={2}>2 - Moderate</MenuItem>
                                          <MenuItem value={3}>3 - Average</MenuItem>
                                          <MenuItem value={4}>4 - Heavy</MenuItem>
                                          <MenuItem value={5}>5 - Very Heavy</MenuItem>
                                        </Select>
                                      </FormControl>
                                    </Grid>
                                    <Grid size={{ xs: 6 }}>
                                      <FormControl fullWidth size="small">
                                        <InputLabel>Attention (1-5)</InputLabel>
                                        <Select
                                          value={shift.attention ?? params.attention}
                                          label="Attention (1-5)"
                                          onChange={(e) => handleUpdateShift(shift.id, 'attention', parseInt(String(e.target.value)))}
                                        >
                                          <MenuItem value={1}>1 - Low</MenuItem>
                                          <MenuItem value={2}>2 - Moderate</MenuItem>
                                          <MenuItem value={3}>3 - Average</MenuItem>
                                          <MenuItem value={4}>4 - High</MenuItem>
                                          <MenuItem value={5}>5 - Very High</MenuItem>
                                        </Select>
                                      </FormControl>
                                    </Grid>
                                    <Grid size={{ xs: 6 }}>
                                      <TextField
                                        type="number"
                                        size="small"
                                        label="Break Freq (mins)"
                                        value={shift.breakFreq ?? 180}
                                        onChange={(e) => handleUpdateShift(shift.id, 'breakFreq', parseInt(e.target.value) || 180)}
                                        fullWidth
                                        slotProps={{ htmlInput: { min: 30, max: 480 } }}
                                      />
                                    </Grid>
                                    <Grid size={{ xs: 6 }}>
                                      <TextField
                                        type="number"
                                        size="small"
                                        label="Break Length (mins)"
                                        value={shift.breakLen ?? 30}
                                        onChange={(e) => handleUpdateShift(shift.id, 'breakLen', parseInt(e.target.value) || 30)}
                                        fullWidth
                                        slotProps={{ htmlInput: { min: 5, max: 60 } }}
                                      />
                                    </Grid>
                                  </Grid>
                                </Box>
                              </Collapse>
                            </Paper>
                          );
                        })
                      )}
                    </Box>
                  </Box>
                </Paper>
              )}

              {/* Parameters Panel */}
              <Collapse in={showSettings}>
                <Paper elevation={2}>
                  <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1" fontWeight={600}>HSE RR446 Default Parameters</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {shifts.length > 0 && (
                        <Button size="small" variant="outlined" color="warning" onClick={handleApplyGlobalToAll}>
                          Apply to All Days
                        </Button>
                      )}
                      <Button size="small" onClick={handleResetParams}>Reset Defaults</Button>
                    </Box>
                  </Box>
                  <Box sx={{ p: 2 }}>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography variant="caption">
                        These are default values for new shifts. Click the settings icon on each shift to customize per-day parameters.
                      </Typography>
                    </Alert>

                    <TextField
                      type="number"
                      label="Default Commute Time (minutes)"
                      value={params.commuteTime}
                      onChange={(e) => setParams({ ...params, commuteTime: parseInt(e.target.value) || 0 })}
                      fullWidth
                      size="small"
                      sx={{ mb: 2 }}
                      slotProps={{ htmlInput: { min: 0, max: 180 } }}
                      helperText="Total daily commute (split 50/50 for in/out)"
                    />

                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid size={{ xs: 6 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Workload (1-5)</InputLabel>
                          <Select
                            value={params.workload}
                            label="Workload (1-5)"
                            onChange={(e) => setParams({ ...params, workload: parseInt(String(e.target.value)) })}
                          >
                            <MenuItem value={1}>1 - Light</MenuItem>
                            <MenuItem value={2}>2 - Moderate</MenuItem>
                            <MenuItem value={3}>3 - Average</MenuItem>
                            <MenuItem value={4}>4 - Heavy</MenuItem>
                            <MenuItem value={5}>5 - Very Heavy</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Attention (1-5)</InputLabel>
                          <Select
                            value={params.attention}
                            label="Attention (1-5)"
                            onChange={(e) => setParams({ ...params, attention: parseInt(String(e.target.value)) })}
                          >
                            <MenuItem value={1}>1 - Low</MenuItem>
                            <MenuItem value={2}>2 - Moderate</MenuItem>
                            <MenuItem value={3}>3 - Average</MenuItem>
                            <MenuItem value={4}>4 - High</MenuItem>
                            <MenuItem value={5}>5 - Very High</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>

                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          type="number"
                          label="Break Frequency (mins)"
                          value={params.breakFrequency}
                          onChange={(e) => setParams({ ...params, breakFrequency: parseInt(e.target.value) || 180 })}
                          fullWidth
                          size="small"
                          slotProps={{ htmlInput: { min: 30, max: 480 } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          type="number"
                          label="Break Length (mins)"
                          value={params.breakLength}
                          onChange={(e) => setParams({ ...params, breakLength: parseInt(e.target.value) || 30 })}
                          fullWidth
                          size="small"
                          slotProps={{ htmlInput: { min: 5, max: 60 } }}
                        />
                      </Grid>
                    </Grid>

                    <Grid container spacing={2}>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          type="number"
                          label="Continuous Work (mins)"
                          value={params.continuousWork}
                          onChange={(e) => setParams({ ...params, continuousWork: parseInt(e.target.value) || 180 })}
                          fullWidth
                          size="small"
                          slotProps={{ htmlInput: { min: 30, max: 480 } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          type="number"
                          label="Break After Continuous"
                          value={params.breakAfterContinuous}
                          onChange={(e) => setParams({ ...params, breakAfterContinuous: parseInt(e.target.value) || 30 })}
                          fullWidth
                          size="small"
                          slotProps={{ htmlInput: { min: 5, max: 60 } }}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                </Paper>
              </Collapse>
            </Box>
          </Grid>

          {/* Right Panel - Chart & Results */}
          <Grid size={{ xs: 12, lg: 5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* FRI Chart */}
              <Paper elevation={2}>
                <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle2" fontWeight={600}>FRI Chart</Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={showComponents}
                          onChange={(e) => setShowComponents(e.target.checked)}
                        />
                      }
                      label={<Typography variant="caption">Components</Typography>}
                      sx={{ mr: 0 }}
                    />
                    <Button size="small" variant="text" onClick={handleExportCSV} sx={{ minWidth: 'auto', px: 1 }}>
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button size="small" variant="text" color="warning" onClick={handlePrint} sx={{ minWidth: 'auto', px: 1 }}>
                      <FileText className="w-3 h-3" />
                    </Button>
                  </Box>
                </Box>
                <Box sx={{ p: 1 }}>
                  {results ? (
                    <FatigueChart
                      data={results.calculations}
                      worstCaseData={worstCaseResults ? results.calculations.map(calc => {
                        const worst = worstCaseResults.get(calc.day);
                        return {
                          ...calc,
                          riskIndex: worst?.riskIndex ?? calc.riskIndex,
                          riskLevel: worst?.riskLevel ? { level: worst.riskLevel.level, label: '', color: '' } : calc.riskLevel,
                        };
                      }) : undefined}
                      height={180}
                      showThresholds={true}
                      showComponents={showComponents}
                      showWorstCase={true}
                    />
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" color="text.secondary">Add shifts to see chart</Typography>
                    </Box>
                  )}
                </Box>
              </Paper>

              {/* Results Summary */}
              <Paper elevation={2} ref={resultsRef}>
                <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle2" fontWeight={600}>Analysis</Typography>
                </Box>

                <Box sx={{ p: 1.5 }}>
                  {!results ? (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                      <Typography variant="body2" color="text.secondary">No shifts to analyze</Typography>
                    </Box>
                  ) : (
                    <>
                      {/* Summary Cards - Compact */}
                      <Grid container spacing={1} sx={{ mb: 2 }}>
                        <Grid size={{ xs: 6 }}>
                          <Paper sx={{ p: 1, border: 1, ...getRiskCardSx(getRiskLevel(results.summary.avgRisk).level) }}>
                            <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.65rem' }}>Avg FRI</Typography>
                            <Typography variant="h6" fontWeight={700}>{results.summary.avgRisk}</Typography>
                          </Paper>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Paper sx={{ p: 1, border: 1, ...getRiskCardSx(getRiskLevel(results.summary.maxRisk).level) }}>
                            <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.65rem' }}>Peak FRI</Typography>
                            <Typography variant="h6" fontWeight={700}>{results.summary.maxRisk}</Typography>
                          </Paper>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Paper variant="outlined" sx={{ p: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Hours</Typography>
                            <Typography variant="h6" fontWeight={700}>{results.summary.totalHours}h</Typography>
                          </Paper>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Paper variant="outlined" sx={{ p: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>High Risk</Typography>
                            <Typography variant="h6" fontWeight={700} color={results.summary.highRiskCount > 0 ? 'error.main' : 'success.main'}>
                              {results.summary.highRiskCount}
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>

                    </>
                  )}
                </Box>
              </Paper>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Save Pattern Modal */}
      <Dialog open={showSaveModal} onClose={() => { setShowSaveModal(false); setSaveError(null); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Save Shift Pattern
          <IconButton onClick={() => { setShowSaveModal(false); setSaveError(null); }} size="small">
            <X className="w-5 h-5" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {saveError && (
              <Alert severity="error">{saveError}</Alert>
            )}

            <TextField
              label="Pattern Name"
              value={savePatternName}
              onChange={(e) => setSavePatternName(e.target.value)}
              placeholder="e.g., Day Shift Mon-Fri"
              required
              fullWidth
            />

            <FormControl fullWidth required>
              <InputLabel>Assign to Project</InputLabel>
              <Select
                value={saveProjectId || ''}
                label="Assign to Project"
                onChange={(e) => setSaveProjectId(e.target.value ? Number(e.target.value) : null)}
              >
                <MenuItem value="">Select project...</MenuItem>
                {projects.map(project => (
                  <MenuItem key={project.id} value={project.id}>{project.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Duty Type</InputLabel>
              <Select
                value={saveDutyType}
                label="Duty Type"
                onChange={(e) => setSaveDutyType(e.target.value as string)}
              >
                <MenuItem value="Non-Possession">Non-Possession</MenuItem>
                <MenuItem value="Possession">Possession</MenuItem>
                <MenuItem value="Office">Office</MenuItem>
                <MenuItem value="Lookout">Lookout</MenuItem>
                <MenuItem value="Machine">Machine</MenuItem>
                <MenuItem value="Protection">Protection</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Checkbox
                  checked={saveIsNight}
                  onChange={(e) => setSaveIsNight(e.target.checked)}
                />
              }
              label="Night Shift Pattern"
            />

            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Pattern Summary</Typography>
              <Typography variant="body2" color="text.secondary">
                Working days: {shifts.filter(s => !s.isRestDay).length} |
                Rest days: {shifts.filter(s => s.isRestDay).length}
              </Typography>
            </Paper>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => { setShowSaveModal(false); setSaveError(null); }} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="contained" color="success" onClick={handleSavePattern} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Pattern'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
