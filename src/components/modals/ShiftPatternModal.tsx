'use client';

import { useState, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Grid';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Switch from '@mui/material/Switch';
import CircularProgress from '@mui/material/CircularProgress';
import { X, ChevronDown, Edit2 } from '@/components/ui/Icons';
import type { WeeklySchedule, ShiftDefinition } from '@/lib/types';
import { calculateFatigueSequence, getRiskLevel, type FatigueParams } from '@/lib/fatigue';

// Per-day fatigue parameters interface
interface DayFatigueParams {
  commuteIn: number;
  commuteOut: number;
  workload: number;
  attention: number;
  breakFreq: number;
  breakLen: number;
}

interface ShiftPatternModalProps {
  projectId: number;
  onClose: () => void;
  onSave: (data: {
    projectId: number;
    name: string;
    startTime: string;
    endTime: string;
    dutyType: string;
    isNight: boolean;
    weeklySchedule: WeeklySchedule;
    workload?: number;
    attention?: number;
    commuteTime?: number;
    breakFrequency?: number;
    breakLength?: number;
  }) => Promise<void>;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
type DayKey = typeof DAYS[number];

const DUTY_TYPES = [
  'Non-Possession',
  'Possession',
  'Lookout',
  'Machine',
  'Protection',
  'Other',
];

// Preset templates
const PRESETS = {
  dayShift: {
    name: 'Day Shift (07:00-19:00)',
    startTime: '07:00',
    endTime: '19:00',
    dutyType: 'Non-Possession',
    isNight: false,
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  nightShift: {
    name: 'Night Shift (19:00-07:00)',
    startTime: '19:00',
    endTime: '07:00',
    dutyType: 'Non-Possession',
    isNight: true,
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  weekendPossession: {
    name: 'Weekend Possession',
    startTime: '00:01',
    endTime: '05:59',
    dutyType: 'Possession',
    isNight: true,
    days: ['Sat', 'Sun'],
  },
  weekdays: {
    name: 'Weekdays Only (08:00-18:00)',
    startTime: '08:00',
    endTime: '18:00',
    dutyType: 'Non-Possession',
    isNight: false,
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
};

export function ShiftPatternModal({ projectId, onClose, onSave }: ShiftPatternModalProps) {
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('19:00');
  const [dutyType, setDutyType] = useState('Non-Possession');
  const [isNight, setIsNight] = useState(false);
  const [selectedDays, setSelectedDays] = useState<DayKey[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fatigue parameters (defaults)
  const [workload, setWorkload] = useState<number>(2);
  const [attention, setAttention] = useState<number>(2);
  const [commuteTime, setCommuteTime] = useState<number>(60);
  const [breakFrequency, setBreakFrequency] = useState<number>(180);
  const [breakLength, setBreakLength] = useState<number>(30);

  // Per-day fatigue parameter overrides
  const [usePerDayParams, setUsePerDayParams] = useState(false);
  const [perDayParams, setPerDayParams] = useState<Record<DayKey, DayFatigueParams>>(() => {
    const defaults: DayFatigueParams = {
      commuteIn: 30,
      commuteOut: 30,
      workload: 2,
      attention: 2,
      breakFreq: 180,
      breakLen: 30,
    };
    return {
      Mon: { ...defaults },
      Tue: { ...defaults },
      Wed: { ...defaults },
      Thu: { ...defaults },
      Fri: { ...defaults },
      Sat: { ...defaults },
      Sun: { ...defaults },
    };
  });
  const [editingDay, setEditingDay] = useState<DayKey | null>(null);

  // Calculate live fatigue risk for the pattern
  const fatigueResults = useMemo(() => {
    if (selectedDays.length === 0 || !startTime || !endTime) return [];

    const dayToNumber: Record<DayKey, number> = {
      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7
    };

    const sortedDays = [...selectedDays].sort((a, b) => dayToNumber[a] - dayToNumber[b]);
    const shifts: ShiftDefinition[] = sortedDays.map(day => {
      const dayParams = perDayParams[day];
      if (usePerDayParams) {
        return {
          day: dayToNumber[day],
          startTime,
          endTime,
          commuteIn: dayParams.commuteIn,
          commuteOut: dayParams.commuteOut,
          workload: dayParams.workload,
          attention: dayParams.attention,
          breakFreq: dayParams.breakFreq,
          breakLen: dayParams.breakLen,
        };
      }
      return {
        day: dayToNumber[day],
        startTime,
        endTime,
      };
    });

    const params: FatigueParams = {
      commuteTime: usePerDayParams ? 60 : commuteTime,
      workload: usePerDayParams ? 2 : workload,
      attention: usePerDayParams ? 2 : attention,
      breakFrequency: usePerDayParams ? 180 : breakFrequency,
      breakLength: usePerDayParams ? 30 : breakLength,
      continuousWork: usePerDayParams ? 180 : breakFrequency,
      breakAfterContinuous: usePerDayParams ? 30 : breakLength,
    };

    return calculateFatigueSequence(shifts, params);
  }, [selectedDays, startTime, endTime, workload, attention, commuteTime, breakFrequency, breakLength, usePerDayParams, perDayParams]);

  const maxRisk = useMemo(() => {
    if (fatigueResults.length === 0) return 0;
    return Math.max(...fatigueResults.map(r => r.riskIndex));
  }, [fatigueResults]);

  const toggleDay = (day: DayKey) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const updateDayParams = (day: DayKey, field: keyof DayFatigueParams, value: number) => {
    setPerDayParams(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const applyGlobalToAllDays = () => {
    const globalParams: DayFatigueParams = {
      commuteIn: Math.floor(commuteTime / 2),
      commuteOut: Math.ceil(commuteTime / 2),
      workload,
      attention,
      breakFreq: breakFrequency,
      breakLen: breakLength,
    };
    setPerDayParams({
      Mon: { ...globalParams },
      Tue: { ...globalParams },
      Wed: { ...globalParams },
      Thu: { ...globalParams },
      Fri: { ...globalParams },
      Sat: { ...globalParams },
      Sun: { ...globalParams },
    });
  };

  const applyPreset = (presetKey: keyof typeof PRESETS) => {
    const preset = PRESETS[presetKey];
    setName(preset.name);
    setStartTime(preset.startTime);
    setEndTime(preset.endTime);
    setDutyType(preset.dutyType);
    setIsNight(preset.isNight);
    setSelectedDays(preset.days as DayKey[]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Pattern name is required');
      return;
    }

    if (selectedDays.length === 0) {
      setError('Select at least one day');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const weeklySchedule: WeeklySchedule = {
        Mon: null, Tue: null, Wed: null, Thu: null, Fri: null, Sat: null, Sun: null,
      };

      selectedDays.forEach(day => {
        if (usePerDayParams) {
          const dayParams = perDayParams[day];
          weeklySchedule[day] = {
            startTime,
            endTime,
            commuteIn: dayParams.commuteIn,
            commuteOut: dayParams.commuteOut,
            workload: dayParams.workload,
            attention: dayParams.attention,
            breakFreq: dayParams.breakFreq,
            breakLen: dayParams.breakLen,
          };
        } else {
          weeklySchedule[day] = { startTime, endTime };
        }
      });

      await onSave({
        projectId,
        name: name.trim(),
        startTime,
        endTime,
        dutyType,
        isNight,
        weeklySchedule,
        workload: usePerDayParams ? undefined : workload,
        attention: usePerDayParams ? undefined : attention,
        commuteTime: usePerDayParams ? undefined : commuteTime,
        breakFrequency: usePerDayParams ? undefined : breakFrequency,
        breakLength: usePerDayParams ? undefined : breakLength,
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create shift pattern';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleStartTimeChange = (time: string) => {
    setStartTime(time);
    const hour = parseInt(time.split(':')[0]);
    if (hour >= 18 || hour < 6) {
      setIsNight(true);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Create Shift Pattern
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
          <X className="w-5 h-5" />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent dividers sx={{ maxHeight: '70vh' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {error && <Alert severity="error">{error}</Alert>}

            {/* Quick Templates */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>Quick Templates</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Button size="small" variant="contained" onClick={() => applyPreset('dayShift')}>
                  Day Shift
                </Button>
                <Button size="small" variant="contained" color="secondary" onClick={() => applyPreset('nightShift')}>
                  Night Shift
                </Button>
                <Button size="small" variant="contained" color="warning" onClick={() => applyPreset('weekendPossession')}>
                  Weekend Possession
                </Button>
                <Button size="small" variant="contained" color="success" onClick={() => applyPreset('weekdays')}>
                  Weekdays Only
                </Button>
              </Box>
            </Box>

            {/* Pattern Name */}
            <TextField
              label="Pattern Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Day Shift, Night Shift"
              required
              fullWidth
            />

            {/* Times */}
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  type="time"
                  label="Start Time"
                  value={startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  required
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  type="time"
                  label="End Time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
            </Grid>

            {/* Duty Type and Night Shift */}
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 6 }}>
                <TextField
                  select
                  label="Duty Type"
                  value={dutyType}
                  onChange={(e) => setDutyType(e.target.value)}
                  fullWidth
                >
                  {DUTY_TYPES.map(type => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isNight}
                      onChange={(e) => setIsNight(e.target.checked)}
                      color="secondary"
                    />
                  }
                  label="Night Shift"
                />
              </Grid>
            </Grid>

            {/* Active Days */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Active Days <Typography component="span" color="error">*</Typography>
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {DAYS.map(day => (
                  <Chip
                    key={day}
                    label={day}
                    onClick={() => toggleDay(day)}
                    color={selectedDays.includes(day) ? 'primary' : 'default'}
                    variant={selectedDays.includes(day) ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 500 }}
                  />
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Click to toggle. Employees can only be assigned on active days.
              </Typography>
            </Box>

            {/* Live Fatigue Risk Index */}
            {fatigueResults.length > 0 && (
              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, bgcolor: 'action.hover' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="subtitle2">Live Fatigue Risk Index (HSE RR446)</Typography>
                  <Chip
                    size="small"
                    label={`Max: ${maxRisk.toFixed(3)} - ${getRiskLevel(maxRisk).label}`}
                    sx={{
                      bgcolor: getRiskLevel(maxRisk).color + '20',
                      color: getRiskLevel(maxRisk).color,
                      fontWeight: 600,
                    }}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {(() => {
                    const dayToNumber: Record<DayKey, number> = {
                      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7
                    };
                    const sortedDays = [...selectedDays].sort((a, b) => dayToNumber[a] - dayToNumber[b]);
                    return sortedDays.map((day, idx) => {
                      const result = fatigueResults[idx];
                      if (!result) return null;
                      const riskLevel = getRiskLevel(result.riskIndex);
                      return (
                        <Box
                          key={day}
                          sx={{
                            flex: 1,
                            textAlign: 'center',
                            p: 1,
                            borderRadius: 1,
                            bgcolor: riskLevel.color + '20',
                          }}
                          title={`${day}: FRI=${result.riskIndex.toFixed(3)} (${riskLevel.label})`}
                        >
                          <Typography variant="caption" color="text.secondary">{day}</Typography>
                          <Typography variant="body2" fontWeight={700} sx={{ color: riskLevel.color }}>
                            {result.riskIndex.toFixed(3)}
                          </Typography>
                        </Box>
                      );
                    });
                  })()}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Risk levels: &lt;1.0 Low (green) | 1.0-1.1 Moderate (yellow) | 1.1-1.2 Elevated (orange) | &gt;1.2 High (red)
                </Typography>
              </Box>
            )}

            {/* Fatigue Settings (Collapsible) */}
            <Accordion>
              <AccordionSummary expandIcon={<ChevronDown className="w-4 h-4" />}>
                <Typography variant="subtitle2">Fatigue Risk Parameters</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    These values are used in HSE RR446 fatigue calculations for this shift pattern.
                  </Typography>

                  {/* Toggle between global and per-day params */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>Per-Day Parameters</Typography>
                      <Typography variant="caption" color="text.secondary">Set different fatigue factors for each day</Typography>
                    </Box>
                    <Switch
                      checked={usePerDayParams}
                      onChange={(e) => {
                        setUsePerDayParams(e.target.checked);
                        if (e.target.checked) applyGlobalToAllDays();
                      }}
                    />
                  </Box>

                  {!usePerDayParams ? (
                    /* Global Parameters */
                    <>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 6 }}>
                          <TextField
                            select
                            label="Workload (1-4)"
                            value={workload}
                            onChange={(e) => setWorkload(parseInt(e.target.value))}
                            fullWidth
                            size="small"
                          >
                            <MenuItem value={1}>1 - Extremely demanding</MenuItem>
                            <MenuItem value={2}>2 - Moderately demanding</MenuItem>
                            <MenuItem value={3}>3 - Moderately undemanding</MenuItem>
                            <MenuItem value={4}>4 - Extremely undemanding</MenuItem>
                          </TextField>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <TextField
                            select
                            label="Attention (1-4)"
                            value={attention}
                            onChange={(e) => setAttention(parseInt(e.target.value))}
                            fullWidth
                            size="small"
                          >
                            <MenuItem value={1}>1 - All/nearly all the time</MenuItem>
                            <MenuItem value={2}>2 - Some of the time</MenuItem>
                            <MenuItem value={3}>3 - Most of the time</MenuItem>
                            <MenuItem value={4}>4 - Rarely or never</MenuItem>
                          </TextField>
                        </Grid>
                      </Grid>

                      <TextField
                        type="number"
                        label="Commute Time (minutes)"
                        value={commuteTime}
                        onChange={(e) => setCommuteTime(parseInt(e.target.value) || 0)}
                        fullWidth
                        size="small"
                        slotProps={{ htmlInput: { min: 0, max: 180 } }}
                        helperText="Total daily commute (home to work + work to home)"
                      />

                      <Grid container spacing={2}>
                        <Grid size={{ xs: 6 }}>
                          <TextField
                            type="number"
                            label="Break Frequency (mins)"
                            value={breakFrequency}
                            onChange={(e) => setBreakFrequency(parseInt(e.target.value) || 180)}
                            fullWidth
                            size="small"
                            slotProps={{ htmlInput: { min: 30, max: 480 } }}
                          />
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <TextField
                            type="number"
                            label="Break Length (mins)"
                            value={breakLength}
                            onChange={(e) => setBreakLength(parseInt(e.target.value) || 30)}
                            fullWidth
                            size="small"
                            slotProps={{ htmlInput: { min: 5, max: 60 } }}
                          />
                        </Grid>
                      </Grid>
                    </>
                  ) : (
                    /* Per-Day Parameters */
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        Click a day to edit its fatigue parameters:
                      </Typography>
                      {selectedDays.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" fontStyle="italic">
                          Select active days above first
                        </Typography>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {[...selectedDays].sort((a, b) => {
                            const order: Record<DayKey, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
                            return order[a] - order[b];
                          }).map(day => {
                            const params = perDayParams[day];
                            const isEditing = editingDay === day;
                            return (
                              <Box key={day} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                                <Box
                                  onClick={() => setEditingDay(isEditing ? null : day)}
                                  sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    p: 1.5,
                                    bgcolor: 'action.hover',
                                    cursor: 'pointer',
                                    '&:hover': { bgcolor: 'action.selected' },
                                  }}
                                >
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="body2" fontWeight={500}>{day}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      W:{params.workload} A:{params.attention} C:{params.commuteIn + params.commuteOut}m
                                    </Typography>
                                  </Box>
                                  <Edit2 className={`w-4 h-4 ${isEditing ? 'text-blue-600' : ''}`} />
                                </Box>
                                {isEditing && (
                                  <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <Grid container spacing={2}>
                                      <Grid size={{ xs: 6 }}>
                                        <TextField
                                          type="number"
                                          label="Commute In (mins)"
                                          value={params.commuteIn}
                                          onChange={(e) => updateDayParams(day, 'commuteIn', parseInt(e.target.value) || 0)}
                                          fullWidth
                                          size="small"
                                          slotProps={{ htmlInput: { min: 0, max: 120 } }}
                                        />
                                      </Grid>
                                      <Grid size={{ xs: 6 }}>
                                        <TextField
                                          type="number"
                                          label="Commute Out (mins)"
                                          value={params.commuteOut}
                                          onChange={(e) => updateDayParams(day, 'commuteOut', parseInt(e.target.value) || 0)}
                                          fullWidth
                                          size="small"
                                          slotProps={{ htmlInput: { min: 0, max: 120 } }}
                                        />
                                      </Grid>
                                    </Grid>
                                    <Grid container spacing={2}>
                                      <Grid size={{ xs: 6 }}>
                                        <TextField
                                          select
                                          label="Workload (1-4)"
                                          value={params.workload}
                                          onChange={(e) => updateDayParams(day, 'workload', parseInt(e.target.value))}
                                          fullWidth
                                          size="small"
                                        >
                                          <MenuItem value={1}>1 - Extremely demanding</MenuItem>
                                          <MenuItem value={2}>2 - Moderately demanding</MenuItem>
                                          <MenuItem value={3}>3 - Moderately undemanding</MenuItem>
                                          <MenuItem value={4}>4 - Extremely undemanding</MenuItem>
                                        </TextField>
                                      </Grid>
                                      <Grid size={{ xs: 6 }}>
                                        <TextField
                                          select
                                          label="Attention (1-4)"
                                          value={params.attention}
                                          onChange={(e) => updateDayParams(day, 'attention', parseInt(e.target.value))}
                                          fullWidth
                                          size="small"
                                        >
                                          <MenuItem value={1}>1 - All/nearly all the time</MenuItem>
                                          <MenuItem value={2}>2 - Some of the time</MenuItem>
                                          <MenuItem value={3}>3 - Most of the time</MenuItem>
                                          <MenuItem value={4}>4 - Rarely or never</MenuItem>
                                        </TextField>
                                      </Grid>
                                    </Grid>
                                    <Grid container spacing={2}>
                                      <Grid size={{ xs: 6 }}>
                                        <TextField
                                          type="number"
                                          label="Break Freq (mins)"
                                          value={params.breakFreq}
                                          onChange={(e) => updateDayParams(day, 'breakFreq', parseInt(e.target.value) || 180)}
                                          fullWidth
                                          size="small"
                                          slotProps={{ htmlInput: { min: 30, max: 480 } }}
                                        />
                                      </Grid>
                                      <Grid size={{ xs: 6 }}>
                                        <TextField
                                          type="number"
                                          label="Break Length (mins)"
                                          value={params.breakLen}
                                          onChange={(e) => updateDayParams(day, 'breakLen', parseInt(e.target.value) || 30)}
                                          fullWidth
                                          size="small"
                                          slotProps={{ htmlInput: { min: 5, max: 60 } }}
                                        />
                                      </Grid>
                                    </Grid>
                                  </Box>
                                )}
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, bgcolor: 'action.hover' }}>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {saving ? 'Creating...' : 'Create Pattern'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
