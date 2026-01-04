'use client';

import { useState, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import { Plus } from '@/components/ui/Icons';
import type { ProjectCamel, ShiftPatternCamel, EmployeeCamel } from '@/lib/types';

interface AddShiftModalProps {
  open: boolean;
  onClose: () => void;
  employee: EmployeeCamel;
  date: string;
  projects: ProjectCamel[];
  shiftPatterns: ShiftPatternCamel[];
  onAddShift: (data: {
    employeeId: number;
    projectId: number;
    shiftPatternId: string;
    date: string;
    customStartTime?: string;
    customEndTime?: string;
  }) => Promise<void>;
}

export function AddShiftModal({
  open,
  onClose,
  employee,
  date,
  projects,
  shiftPatterns,
  onAddShift,
}: AddShiftModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [selectedPatternId, setSelectedPatternId] = useState<string>('');
  const [useCustomTimes, setUseCustomTimes] = useState(false);
  const [customStartTime, setCustomStartTime] = useState('07:00');
  const [customEndTime, setCustomEndTime] = useState('19:00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter patterns by selected project
  const availablePatterns = useMemo(() => {
    if (!selectedProjectId) return [];
    return shiftPatterns.filter(p => p.projectId === selectedProjectId);
  }, [selectedProjectId, shiftPatterns]);

  const selectedPattern = shiftPatterns.find(p => p.id === selectedPatternId);
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // Format date for display
  const formattedDate = useMemo(() => {
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [date]);

  const handleProjectChange = (projectId: number) => {
    setSelectedProjectId(projectId);
    setSelectedPatternId(''); // Reset pattern when project changes
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selectedProjectId || !selectedPatternId) {
      setError('Please select a project and shift pattern');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onAddShift({
        employeeId: employee.id,
        projectId: selectedProjectId as number,
        shiftPatternId: selectedPatternId,
        date,
        customStartTime: useCustomTimes ? customStartTime : undefined,
        customEndTime: useCustomTimes ? customEndTime : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add shift');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedProjectId('');
    setSelectedPatternId('');
    setUseCustomTimes(false);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Plus className="w-5 h-5" />
        Add Shift for {employee.name}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Date Display */}
          <Alert severity="info" sx={{ py: 0.5 }}>
            <Typography variant="body2">
              Adding shift on <strong>{formattedDate}</strong>
            </Typography>
          </Alert>

          {error && (
            <Alert severity="error" sx={{ py: 0.5 }}>
              {error}
            </Alert>
          )}

          {/* Project Selection */}
          <FormControl fullWidth>
            <InputLabel>Project</InputLabel>
            <Select
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(Number(e.target.value))}
              label="Project"
            >
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Shift Pattern Selection */}
          <FormControl fullWidth disabled={!selectedProjectId}>
            <InputLabel>Shift Pattern</InputLabel>
            <Select
              value={selectedPatternId}
              onChange={(e) => setSelectedPatternId(e.target.value)}
              label="Shift Pattern"
            >
              {availablePatterns.length === 0 ? (
                <MenuItem disabled>
                  {selectedProjectId ? 'No patterns available' : 'Select a project first'}
                </MenuItem>
              ) : (
                availablePatterns.map((pattern) => (
                  <MenuItem key={pattern.id} value={pattern.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <span>{pattern.name}</span>
                      {pattern.isNight && <Chip label="Night" size="small" color="info" sx={{ height: 18, fontSize: '0.65rem' }} />}
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                        {pattern.startTime || '?'} - {pattern.endTime || '?'}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          {/* Selected Pattern Info */}
          {selectedPattern && (
            <Alert severity="success" sx={{ py: 0.5 }}>
              <Typography variant="caption">
                <strong>{selectedPattern.name}</strong> ({selectedPattern.dutyType})
                {selectedPattern.isNight && ' - Night Shift'}
                <br />
                Default times: {selectedPattern.startTime || '?'} - {selectedPattern.endTime || '?'}
              </Typography>
            </Alert>
          )}

          {/* Custom Times Toggle */}
          {selectedPatternId && (
            <Box>
              <Button
                variant={useCustomTimes ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setUseCustomTimes(!useCustomTimes)}
              >
                {useCustomTimes ? 'Using Custom Times' : 'Use Custom Times'}
              </Button>

              {useCustomTimes && (
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <TextField
                    label="Start Time"
                    type="time"
                    value={customStartTime}
                    onChange={(e) => setCustomStartTime(e.target.value)}
                    fullWidth
                    slotProps={{ htmlInput: { step: 300 } }}
                  />
                  <TextField
                    label="End Time"
                    type="time"
                    value={customEndTime}
                    onChange={(e) => setCustomEndTime(e.target.value)}
                    fullWidth
                    slotProps={{ htmlInput: { step: 300 } }}
                  />
                </Box>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSubmitting || !selectedProjectId || !selectedPatternId}
          startIcon={<Plus className="w-4 h-4" />}
        >
          {isSubmitting ? 'Adding...' : 'Add Shift'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
