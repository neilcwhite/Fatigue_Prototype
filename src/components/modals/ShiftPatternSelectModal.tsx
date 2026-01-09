'use client';

import { useState } from 'react';
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
import { X, Clock, Users } from '@/components/ui/Icons';
import type { ShiftPatternCamel } from '@/lib/types';

interface ShiftPatternSelectModalProps {
  employeeNames: string[];
  date: string;
  shiftPatterns: ShiftPatternCamel[];
  onClose: () => void;
  onSelect: (shiftPatternId: string, customTimes?: { startTime: string; endTime: string }) => void;
}

type ModalStep = 'select' | 'custom-times';

export function ShiftPatternSelectModal({
  employeeNames,
  date,
  shiftPatterns,
  onClose,
  onSelect,
}: ShiftPatternSelectModalProps) {
  const [step, setStep] = useState<ModalStep>('select');
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [customStartTime, setCustomStartTime] = useState('07:00');
  const [customEndTime, setCustomEndTime] = useState('19:00');
  const [error, setError] = useState<string | null>(null);

  const formattedDate = new Date(date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const employeeText =
    employeeNames.length > 1
      ? `${employeeNames.length} employees`
      : employeeNames[0];

  const isCustomSelected = selectedPatternId === 'custom-adhoc';

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

    onSelect(selectedPatternId);
  };

  const handleCustomTimeConfirm = () => {
    if (!customStartTime || !customEndTime) {
      setError('Please enter both start and end times');
      return;
    }

    onSelect('custom-adhoc', { startTime: customStartTime, endTime: customEndTime });
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

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Clock className="w-5 h-5" />
          {step === 'select' ? 'Select Shift Pattern' : 'Set Custom Work Times'}
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
              {isCustomSelected ? 'Next' : 'Assign'}
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
                Set the work times for <strong>{employeeText}</strong> on <strong>{formattedDate}</strong>
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
              Assign
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
