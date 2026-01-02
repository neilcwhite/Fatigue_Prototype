'use client';

import { useState } from 'react';
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
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import { X } from '@/components/ui/Icons';
import type { ShiftPatternCamel, WeeklySchedule } from '@/lib/types';

interface ShiftPatternEditModalProps {
  pattern: ShiftPatternCamel;
  onClose: () => void;
  onSave: (id: string, data: Partial<ShiftPatternCamel>) => Promise<void>;
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
] as const;

type DutyType = typeof DUTY_TYPES[number];

export function ShiftPatternEditModal({
  pattern,
  onClose,
  onSave,
}: ShiftPatternEditModalProps) {
  // Initialize state from existing pattern
  const [name, setName] = useState(pattern.name);
  const [startTime, setStartTime] = useState(pattern.startTime || '07:00');
  const [endTime, setEndTime] = useState(pattern.endTime || '19:00');
  const [dutyType, setDutyType] = useState<DutyType>(pattern.dutyType as DutyType);
  const [isNight, setIsNight] = useState(pattern.isNight);

  // Get selected days from weekly schedule
  const getSelectedDays = (): DayKey[] => {
    if (!pattern.weeklySchedule) return [];
    return DAYS.filter(day => pattern.weeklySchedule?.[day] !== null && pattern.weeklySchedule?.[day] !== undefined);
  };

  const [selectedDays, setSelectedDays] = useState<DayKey[]>(getSelectedDays());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fatigue parameters
  const [workload, setWorkload] = useState<number>(pattern.workload || 2);
  const [attention, setAttention] = useState<number>(pattern.attention || 2);
  const [commuteTime, setCommuteTime] = useState<number>(pattern.commuteTime || 60);
  const [breakFrequency, setBreakFrequency] = useState<number>(pattern.breakFrequency || 180);
  const [breakLength, setBreakLength] = useState<number>(pattern.breakLength || 30);

  const toggleDay = (day: DayKey) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
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
      // Build weekly schedule
      const weeklySchedule: WeeklySchedule = {
        Mon: null,
        Tue: null,
        Wed: null,
        Thu: null,
        Fri: null,
        Sat: null,
        Sun: null,
      };

      selectedDays.forEach(day => {
        weeklySchedule[day] = {
          startTime,
          endTime,
        };
      });

      await onSave(pattern.id, {
        name: name.trim(),
        startTime,
        endTime,
        dutyType: dutyType as ShiftPatternCamel['dutyType'],
        isNight,
        weeklySchedule,
        workload,
        attention,
        commuteTime,
        breakFrequency,
        breakLength,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update shift pattern';
      setError(message);
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Edit Shift Pattern
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
          <X className="w-5 h-5" />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent dividers sx={{ maxHeight: '60vh' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {error && (
              <Alert severity="error">
                {error}
              </Alert>
            )}

            {/* Pattern Name */}
            <TextField
              label="Pattern Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Day Shift"
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
                  onChange={(e) => setStartTime(e.target.value)}
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
                  onChange={(e) => setDutyType(e.target.value as DutyType)}
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
                    color={selectedDays.includes(day) ? (isNight ? 'secondary' : 'success') : 'default'}
                    variant={selectedDays.includes(day) ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 500 }}
                  />
                ))}
              </Box>
            </Box>

            {/* Fatigue Parameters */}
            <Divider />
            <Typography variant="subtitle2">Fatigue Parameters</Typography>

            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  select
                  label="Workload (1-5)"
                  value={workload}
                  onChange={(e) => setWorkload(parseInt(e.target.value))}
                  fullWidth
                  size="small"
                >
                  <MenuItem value={1}>1 - Light</MenuItem>
                  <MenuItem value={2}>2 - Moderate</MenuItem>
                  <MenuItem value={3}>3 - Average</MenuItem>
                  <MenuItem value={4}>4 - Heavy</MenuItem>
                  <MenuItem value={5}>5 - Very Heavy</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  select
                  label="Attention (1-5)"
                  value={attention}
                  onChange={(e) => setAttention(parseInt(e.target.value))}
                  fullWidth
                  size="small"
                >
                  <MenuItem value={1}>1 - Low</MenuItem>
                  <MenuItem value={2}>2 - Moderate</MenuItem>
                  <MenuItem value={3}>3 - Average</MenuItem>
                  <MenuItem value={4}>4 - High</MenuItem>
                  <MenuItem value={5}>5 - Very High</MenuItem>
                </TextField>
              </Grid>
            </Grid>

            <TextField
              type="number"
              label="Commute Time (mins)"
              value={commuteTime}
              onChange={(e) => setCommuteTime(parseInt(e.target.value) || 0)}
              fullWidth
              size="small"
              slotProps={{ htmlInput: { min: 0, max: 180 } }}
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
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, bgcolor: 'action.hover' }}>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="secondary"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
