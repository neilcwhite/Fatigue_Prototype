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
import Grid from '@mui/material/Grid';
import { X, AlertTriangle, Clock, Users } from '@/components/ui/Icons';

interface CustomTimeModalProps {
  employeeNames: string[];
  date: string;
  patternName: string;
  onClose: () => void;
  onConfirm: (startTime: string, endTime: string) => void;
}

type ModalStep = 'confirm' | 'times';

export function CustomTimeModal({ employeeNames, date, patternName, onClose, onConfirm }: CustomTimeModalProps) {
  const [step, setStep] = useState<ModalStep>('confirm');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('19:00');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!startTime || !endTime) {
      setError('Please enter both start and end times');
      return;
    }

    onConfirm(startTime, endTime);
  };

  const formattedDate = new Date(date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const dayOfWeek = new Date(date).toLocaleDateString('en-GB', { weekday: 'long' });
  const employeeText = employeeNames.length > 1
    ? `these ${employeeNames.length} employees`
    : employeeNames[0];

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ color: 'warning.main' }}>
            <AlertTriangle className="w-5 h-5" />
          </Box>
          {step === 'confirm' ? 'Day Not in Shift Pattern' : 'Set Custom Work Times'}
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
          <X className="w-5 h-5" />
        </IconButton>
      </DialogTitle>

      {/* Step 1: Confirmation */}
      {step === 'confirm' && (
        <>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* Warning Box */}
              <Alert
                severity="warning"
                icon={<AlertTriangle className="w-5 h-5" />}
                sx={{ '& .MuiAlert-message': { width: '100%' } }}
              >
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  {dayOfWeek} is not a scheduled work day
                </Typography>
                <Typography variant="body2">
                  <strong>{formattedDate}</strong> is not part of the <strong>{patternName}</strong> shift pattern.
                </Typography>
              </Alert>

              {/* Employee Info */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.5,
                  p: 2,
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                }}
              >
                <Box sx={{ color: 'text.secondary', mt: 0.25 }}>
                  <Users className="w-5 h-5" />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    You're trying to assign:
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {employeeNames.join(', ')}
                  </Typography>
                </Box>
              </Box>

              {/* Question */}
              <Box sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="body1" fontWeight={500}>
                  Do you need {employeeText} to work on this day?
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  This will create a custom shift shown on the "Custom" roster row.
                </Typography>
              </Box>
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2, bgcolor: 'action.hover' }}>
            <Button onClick={onClose} variant="outlined">
              No, Cancel
            </Button>
            <Button onClick={() => setStep('times')} variant="contained">
              Yes, Add Custom Shift
            </Button>
          </DialogActions>
        </>
      )}

      {/* Step 2: Time Entry */}
      {step === 'times' && (
        <form onSubmit={handleSubmit}>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* Info Header */}
              <Alert
                severity="info"
                icon={<Clock className="w-5 h-5" />}
              >
                <Typography variant="subtitle2" fontWeight={600}>
                  Custom shift for {formattedDate}
                </Typography>
                <Typography variant="body2">
                  Enter the start and finish times for this shift.
                </Typography>
              </Alert>

              {error && (
                <Alert severity="error">
                  {error}
                </Alert>
              )}

              {/* Employee List */}
              <Typography variant="body2" color="text.secondary">
                Assigning: <strong>{employeeNames.join(', ')}</strong>
              </Typography>

              {/* Time Inputs */}
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    type="time"
                    label="Start Time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    fullWidth
                    autoFocus
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    type="time"
                    label="Finish Time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
              </Grid>

              {/* Info Note */}
              <Typography
                variant="caption"
                sx={{
                  p: 1.5,
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  display: 'block',
                }}
              >
                This assignment will appear on a <strong>"Custom"</strong> roster row, separate from the regular shift patterns.
              </Typography>
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between', bgcolor: 'action.hover' }}>
            <Button onClick={() => setStep('confirm')} color="inherit">
              ← Back
            </Button>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button onClick={onClose} variant="outlined">
                Cancel
              </Button>
              <Button type="submit" variant="contained">
                Add to Custom Roster
              </Button>
            </Box>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}
