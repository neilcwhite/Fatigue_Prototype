'use client';

import { useState, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import { X, Calendar, Users, AlertTriangle } from '@/components/ui/Icons';
import IconButton from '@mui/material/IconButton';
import type { EmployeeCamel, ShiftPatternCamel, AssignmentCamel } from '@/lib/types';

interface BulkAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  employees: EmployeeCamel[];
  selectedEmployees: EmployeeCamel[];
  shiftPatterns: ShiftPatternCamel[];
  existingAssignments: AssignmentCamel[];
  projectId: number;
  onCreateAssignments: (assignments: Array<{
    employeeId: number;
    projectId: number;
    shiftPatternId: string;
    date: string;
  }>) => Promise<void>;
  // Pre-fill from existing assignment (Option 3 - extend/repeat)
  prefilledShiftPatternId?: string;
  prefilledStartDate?: string;
}

type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

const DAYS_OF_WEEK: { key: DayOfWeek; label: string; index: number }[] = [
  { key: 'Mon', label: 'Mon', index: 1 },
  { key: 'Tue', label: 'Tue', index: 2 },
  { key: 'Wed', label: 'Wed', index: 3 },
  { key: 'Thu', label: 'Thu', index: 4 },
  { key: 'Fri', label: 'Fri', index: 5 },
  { key: 'Sat', label: 'Sat', index: 6 },
  { key: 'Sun', label: 'Sun', index: 0 },
];

// Generate dates between start and end, filtered by selected days of week
function generateDates(
  startDate: string,
  endDate: string,
  selectedDays: DayOfWeek[]
): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Map day keys to JS day indices (0 = Sunday, 1 = Monday, etc.)
  const dayIndices = selectedDays.map(day =>
    DAYS_OF_WEEK.find(d => d.key === day)?.index ?? -1
  ).filter(i => i >= 0);

  const current = new Date(start);
  while (current <= end) {
    if (dayIndices.includes(current.getDay())) {
      dates.push(current.toISOString().split('T')[0]);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export function BulkAssignmentModal({
  open,
  onClose,
  employees,
  selectedEmployees,
  shiftPatterns,
  existingAssignments,
  projectId,
  onCreateAssignments,
  prefilledShiftPatternId,
  prefilledStartDate,
}: BulkAssignmentModalProps) {
  // Form state
  const [shiftPatternId, setShiftPatternId] = useState(prefilledShiftPatternId || '');
  const [startDate, setStartDate] = useState(prefilledStartDate || new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate preview of assignments to be created
  const preview = useMemo(() => {
    if (!shiftPatternId || !startDate || !endDate || selectedEmployees.length === 0) {
      return { dates: [], totalAssignments: 0, conflicts: 0 };
    }

    const dates = generateDates(startDate, endDate, selectedDays);
    const totalAssignments = dates.length * selectedEmployees.length;

    // Check for conflicts (existing assignments on same date for same employee)
    let conflicts = 0;
    for (const date of dates) {
      for (const emp of selectedEmployees) {
        const hasExisting = existingAssignments.some(
          a => a.employeeId === emp.id && a.date === date
        );
        if (hasExisting) conflicts++;
      }
    }

    return { dates, totalAssignments, conflicts };
  }, [shiftPatternId, startDate, endDate, selectedDays, selectedEmployees, existingAssignments]);

  // Toggle day selection
  const toggleDay = (day: DayOfWeek) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  // Quick select presets
  const selectWeekdays = () => setSelectedDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const selectAllDays = () => setSelectedDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  const selectWeekends = () => setSelectedDays(['Sat', 'Sun']);

  // Handle save
  const handleSave = async () => {
    if (!shiftPatternId || !startDate || !endDate || selectedEmployees.length === 0) {
      setError('Please fill in all required fields');
      return;
    }

    if (selectedDays.length === 0) {
      setError('Please select at least one day of the week');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const dates = generateDates(startDate, endDate, selectedDays);
      const assignments: Array<{
        employeeId: number;
        projectId: number;
        shiftPatternId: string;
        date: string;
      }> = [];

      for (const date of dates) {
        for (const emp of selectedEmployees) {
          // Skip if there's already an assignment for this employee on this date
          const hasExisting = existingAssignments.some(
            a => a.employeeId === emp.id && a.date === date
          );
          if (!hasExisting) {
            assignments.push({
              employeeId: emp.id,
              projectId,
              shiftPatternId,
              date,
            });
          }
        }
      }

      if (assignments.length === 0) {
        setError('No new assignments to create - all dates already have assignments');
        setSaving(false);
        return;
      }

      await onCreateAssignments(assignments);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create assignments');
    } finally {
      setSaving(false);
    }
  };

  const selectedPattern = shiftPatterns.find(sp => sp.id === shiftPatternId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Calendar className="w-5 h-5" />
          Bulk Assignment
        </Box>
        <IconButton size="small" onClick={onClose}>
          <X className="w-4 h-4" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          {/* Selected Employees */}
          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Users className="w-4 h-4" />
              Selected Employees ({selectedEmployees.length})
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {selectedEmployees.map(emp => (
                <Chip
                  key={emp.id}
                  label={emp.name}
                  size="small"
                  variant="outlined"
                />
              ))}
              {selectedEmployees.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No employees selected
                </Typography>
              )}
            </Box>
          </Box>

          <Divider />

          {/* Shift Pattern Selection */}
          <FormControl fullWidth size="small">
            <InputLabel>Shift Pattern *</InputLabel>
            <Select
              value={shiftPatternId}
              label="Shift Pattern *"
              onChange={(e) => setShiftPatternId(e.target.value)}
            >
              {shiftPatterns.map(sp => (
                <MenuItem key={sp.id} value={sp.id}>
                  <Box>
                    <Typography variant="body2">{sp.name}</Typography>
                    {sp.startTime && sp.endTime && (
                      <Typography variant="caption" color="text.secondary">
                        {sp.startTime} - {sp.endTime} • {sp.dutyType}
                      </Typography>
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Date Range */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Start Date *"
              type="date"
              size="small"
              fullWidth
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End Date *"
              type="date"
              size="small"
              fullWidth
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: startDate }}
            />
          </Box>

          {/* Days of Week */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">Days of Week</Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Button size="small" variant="text" onClick={selectWeekdays} sx={{ fontSize: '0.7rem', minWidth: 0, px: 1 }}>
                  Weekdays
                </Button>
                <Button size="small" variant="text" onClick={selectWeekends} sx={{ fontSize: '0.7rem', minWidth: 0, px: 1 }}>
                  Weekends
                </Button>
                <Button size="small" variant="text" onClick={selectAllDays} sx={{ fontSize: '0.7rem', minWidth: 0, px: 1 }}>
                  All
                </Button>
              </Box>
            </Box>
            <FormGroup row>
              {DAYS_OF_WEEK.map(day => (
                <FormControlLabel
                  key={day.key}
                  control={
                    <Checkbox
                      checked={selectedDays.includes(day.key)}
                      onChange={() => toggleDay(day.key)}
                      size="small"
                    />
                  }
                  label={day.label}
                  sx={{ mr: 1 }}
                />
              ))}
            </FormGroup>
          </Box>

          <Divider />

          {/* Preview */}
          {preview.totalAssignments > 0 && (
            <Box sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>Preview</Typography>
              <Typography variant="body2">
                <strong>{preview.totalAssignments}</strong> assignments will be created
                ({preview.dates.length} dates × {selectedEmployees.length} employees)
              </Typography>
              {selectedPattern && (
                <Typography variant="caption" color="text.secondary" display="block">
                  Shift: {selectedPattern.name}
                </Typography>
              )}
              {preview.conflicts > 0 && (
                <Alert severity="warning" sx={{ mt: 1 }} icon={<AlertTriangle className="w-4 h-4" />}>
                  {preview.conflicts} existing assignments will be skipped (no duplicates)
                </Alert>
              )}
            </Box>
          )}

          {/* Error */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || selectedEmployees.length === 0 || !shiftPatternId || !startDate || !endDate}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          {saving ? 'Creating...' : `Create ${preview.totalAssignments - preview.conflicts} Assignments`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
