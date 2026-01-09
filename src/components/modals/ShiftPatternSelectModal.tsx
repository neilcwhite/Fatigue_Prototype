'use client';

import { useState, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Radio from '@mui/material/Radio';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import { X, Clock, Users, Plus, Calendar } from '@/components/ui/Icons';
import type { ShiftPatternCamel } from '@/lib/types';

interface ShiftPatternSelectModalProps {
  employeeNames: string[];
  date: string;
  shiftPatterns: ShiftPatternCamel[];
  onClose: () => void;
  onSelect: (
    shiftPatternId: string,
    customTimes?: { startTime: string; endTime: string },
    endDate?: string
  ) => void;
  /** Called when user wants to create a new shift pattern via Shift Builder */
  onCreateNewShift?: () => void;
}

type ModalStep = 'select' | 'custom-times' | 'date-range';

export function ShiftPatternSelectModal({
  employeeNames,
  date,
  shiftPatterns,
  onClose,
  onSelect,
  onCreateNewShift,
}: ShiftPatternSelectModalProps) {
  const [step, setStep] = useState<ModalStep>('select');
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [customStartTime, setCustomStartTime] = useState('07:00');
  const [customEndTime, setCustomEndTime] = useState('19:00');
  const [endDate, setEndDate] = useState<string>(date); // Default to same day (single assignment)
  const [error, setError] = useState<string | null>(null);

  const formattedDate = new Date(date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const formattedEndDate = endDate ? new Date(endDate).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }) : null;

  const employeeText =
    employeeNames.length > 1
      ? `${employeeNames.length} employees`
      : employeeNames[0];

  const isCustomSelected = selectedPatternId === 'custom-adhoc';
  const isMultipleDays = endDate && endDate !== date;

  // Calculate number of days in range
  const dayCount = useMemo(() => {
    if (!endDate || endDate === date) return 1;
    const start = new Date(date);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diffDays);
  }, [date, endDate]);

  const handleConfirm = () => {
    if (!selectedPatternId) {
      setError('Please select a shift pattern');
      return;
    }

    if (isCustomSelected) {
      // Need to get custom times first
      setStep('custom-times');
      return;
    }

    // Go to date range step
    setStep('date-range');
  };

  const handleCustomTimeConfirm = () => {
    if (!customStartTime || !customEndTime) {
      setError('Please enter both start and end times');
      return;
    }

    // Go to date range step
    setStep('date-range');
  };

  const handleFinalConfirm = () => {
    if (endDate && endDate < date) {
      setError('End date cannot be before start date');
      return;
    }

    if (isCustomSelected) {
      onSelect('custom-adhoc', { startTime: customStartTime, endTime: customEndTime }, isMultipleDays ? endDate : undefined);
    } else {
      onSelect(selectedPatternId!, undefined, isMultipleDays ? endDate : undefined);
    }
  };

  const getPatternTypeColor = (pattern: ShiftPatternCamel) => {
    if (pattern.isNight) return 'secondary';
    switch (pattern.dutyType) {
      case 'Possession':
        return 'primary';
      case 'Non-Possession':
        return 'success';
      case 'Office':
        return 'info';
      default:
        return 'default';
    }
  };

  const getSelectedPatternName = () => {
    if (selectedPatternId === 'custom-adhoc') {
      return `Custom (${customStartTime} - ${customEndTime})`;
    }
    const pattern = shiftPatterns.find(p => p.id === selectedPatternId);
    return pattern?.name || 'Unknown';
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Clock className="w-5 h-5" />
          {step === 'select' && 'Select Shift Pattern'}
          {step === 'custom-times' && 'Set Custom Work Times'}
          {step === 'date-range' && 'Set Date Range'}
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
          <X className="w-5 h-5" />
        </IconButton>
      </DialogTitle>

      {/* Step 1: Select Pattern */}
      {step === 'select' && (
        <>
          <DialogContent dividers>
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Users className="w-4 h-4 text-slate-500" />
                <Typography variant="body2" color="text.secondary">
                  Assigning <strong>{employeeText}</strong> to <strong>{formattedDate}</strong>
                </Typography>
              </Box>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Select a shift pattern:
            </Typography>

            <List sx={{ bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
              {shiftPatterns.map((pattern, index) => (
                <Box key={pattern.id}>
                  {index > 0 && <Divider />}
                  <ListItem disablePadding>
                    <ListItemButton
                      selected={selectedPatternId === pattern.id}
                      onClick={() => setSelectedPatternId(pattern.id)}
                      sx={{
                        '&.Mui-selected': {
                          bgcolor: 'primary.50',
                          '&:hover': { bgcolor: 'primary.100' },
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Radio
                          checked={selectedPatternId === pattern.id}
                          size="small"
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight={500}>
                              {pattern.name}
                            </Typography>
                            <Chip
                              label={pattern.dutyType}
                              size="small"
                              color={getPatternTypeColor(pattern)}
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                            {pattern.isNight && (
                              <Chip
                                label="Night"
                                size="small"
                                color="secondary"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          pattern.startTime && pattern.endTime
                            ? `${pattern.startTime} - ${pattern.endTime}`
                            : 'No fixed times'
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                </Box>
              ))}

              {/* Custom (Ad-hoc) option */}
              <Divider />
              <ListItem disablePadding>
                <ListItemButton
                  selected={selectedPatternId === 'custom-adhoc'}
                  onClick={() => setSelectedPatternId('custom-adhoc')}
                  sx={{
                    '&.Mui-selected': {
                      bgcolor: 'warning.50',
                      '&:hover': { bgcolor: 'warning.100' },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <Radio
                      checked={selectedPatternId === 'custom-adhoc'}
                      size="small"
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={500}>
                          Custom (Ad-hoc)
                        </Typography>
                        <Chip
                          label="Custom Times"
                          size="small"
                          color="warning"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      </Box>
                    }
                    secondary="Set custom start and end times"
                  />
                </ListItemButton>
              </ListItem>

              {/* Create New Shift Pattern option */}
              {onCreateNewShift && (
                <>
                  <Divider />
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={onCreateNewShift}
                      sx={{
                        bgcolor: 'grey.50',
                        '&:hover': { bgcolor: 'primary.50' },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Plus className="w-5 h-5 text-primary-600" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight={500} color="primary">
                              Create New Shift Pattern
                            </Typography>
                          </Box>
                        }
                        secondary="Open Shift Builder to create a reusable pattern"
                      />
                    </ListItemButton>
                  </ListItem>
                </>
              )}
            </List>
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={onClose} color="inherit">
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirm}
              disabled={!selectedPatternId}
            >
              Next
            </Button>
          </DialogActions>
        </>
      )}

      {/* Step 2: Custom Times (only for ad-hoc) */}
      {step === 'custom-times' && (
        <>
          <DialogContent dividers>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Set the work times for <strong>{employeeText}</strong>
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Start Time"
                type="time"
                value={customStartTime}
                onChange={(e) => setCustomStartTime(e.target.value)}
                fullWidth
                slotProps={{
                  inputLabel: { shrink: true },
                }}
              />
              <TextField
                label="End Time"
                type="time"
                value={customEndTime}
                onChange={(e) => setCustomEndTime(e.target.value)}
                fullWidth
                slotProps={{
                  inputLabel: { shrink: true },
                }}
              />
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setStep('select')} color="inherit">
              Back
            </Button>
            <Button variant="contained" onClick={handleCustomTimeConfirm}>
              Next
            </Button>
          </DialogActions>
        </>
      )}

      {/* Step 3: Date Range */}
      {step === 'date-range' && (
        <>
          <DialogContent dividers>
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Calendar className="w-4 h-4 text-slate-500" />
                <Typography variant="body2" color="text.secondary">
                  Assigning <strong>{employeeText}</strong> to <strong>{getSelectedPatternName()}</strong>
                </Typography>
              </Box>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Set the date range for this assignment:
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="Start Date"
                type="date"
                value={date}
                disabled
                fullWidth
                slotProps={{
                  inputLabel: { shrink: true },
                }}
              />
              <TextField
                label="End Date (optional)"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                fullWidth
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { min: date },
                }}
                helperText="Leave as start date for single day"
              />
            </Box>

            {isMultipleDays && (
              <Alert severity="info" sx={{ mt: 2 }}>
                This will create <strong>{dayCount} assignments</strong> from {formattedDate.split(',')[0]} to {formattedEndDate} for {employeeText}.
              </Alert>
            )}

            {!isMultipleDays && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Single day assignment on {formattedDate}
              </Typography>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setStep(isCustomSelected ? 'custom-times' : 'select')} color="inherit">
              Back
            </Button>
            <Button variant="contained" onClick={handleFinalConfirm}>
              {isMultipleDays ? `Assign ${dayCount} Days` : 'Assign'}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
