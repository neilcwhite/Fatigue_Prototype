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
    commuteIn?: number;
    commuteOut?: number;
    workload?: number;
    attention?: number;
    breakFrequency?: number;
    breakLength?: number;
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

  // Fatigue parameters state
  const [commuteIn, setCommuteIn] = useState<number | ''>('');
  const [commuteOut, setCommuteOut] = useState<number | ''>('');
  const [workload, setWorkload] = useState<number | ''>('');
  const [attention, setAttention] = useState<number | ''>('');
  const [breakFrequency, setBreakFrequency] = useState<number | ''>('');
  const [breakLength, setBreakLength] = useState<number | ''>('');

  // Special value for "enter custom times" option
  const CUSTOM_PATTERN_VALUE = '__CUSTOM__';

  // Check if user selected the custom times option
  const isCustomTimesMode = selectedPatternId === CUSTOM_PATTERN_VALUE;

  // Filter patterns by selected project
  const availablePatterns = useMemo(() => {
    if (!selectedProjectId) return [];
    return shiftPatterns.filter(p => p.projectId === selectedProjectId);
  }, [selectedProjectId, shiftPatterns]);

  // Find a "Custom" pattern for the selected project (to use when entering custom times)
  // Matches patterns named "Custom", "Custom (Ad-hoc)", etc.
  const customPatternForProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return shiftPatterns.find(
      p => p.projectId === selectedProjectId && p.name.toLowerCase().startsWith('custom')
    );
  }, [selectedProjectId, shiftPatterns]);

  const selectedPattern = isCustomTimesMode ? null : shiftPatterns.find(p => p.id === selectedPatternId);
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
    if (!selectedProjectId) {
      setError('Please select a project');
      return;
    }

    if (isCustomTimesMode) {
      // Custom times mode - check for times
      if (!customStartTime || !customEndTime) {
        setError('Please enter both start and end times');
        return;
      }
      // Need at least one pattern for this project (will use Custom if available, otherwise any pattern)
      if (availablePatterns.length === 0) {
        setError('No shift patterns exist for this project. Please create one first in the Planning view.');
        return;
      }
    } else if (!selectedPatternId) {
      setError('Please select a shift pattern');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Determine which pattern ID to use
      const patternIdToUse = isCustomTimesMode
        ? (customPatternForProject?.id || availablePatterns[0]?.id) // Use Custom pattern if exists, otherwise first available
        : selectedPatternId;

      // Determine if we need custom times
      const needsCustomTimes = isCustomTimesMode || useCustomTimes;

      await onAddShift({
        employeeId: employee.id,
        projectId: selectedProjectId as number,
        shiftPatternId: patternIdToUse,
        date,
        customStartTime: needsCustomTimes ? customStartTime : undefined,
        customEndTime: needsCustomTimes ? customEndTime : undefined,
        commuteIn: commuteIn !== '' ? commuteIn : undefined,
        commuteOut: commuteOut !== '' ? commuteOut : undefined,
        workload: workload !== '' ? workload : undefined,
        attention: attention !== '' ? attention : undefined,
        breakFrequency: breakFrequency !== '' ? breakFrequency : undefined,
        breakLength: breakLength !== '' ? breakLength : undefined,
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
              {projects.filter(p => !p.archived).map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Shift Pattern Selection */}
          <FormControl fullWidth disabled={!selectedProjectId}>
            <InputLabel id="shift-pattern-label">Shift Pattern</InputLabel>
            <Select
              labelId="shift-pattern-label"
              value={selectedPatternId}
              onChange={(e) => {
                const value = e.target.value as string;
                setSelectedPatternId(value);
              }}
              label="Shift Pattern"
            >
              {!selectedProjectId ? (
                <MenuItem disabled value="">Select a project first</MenuItem>
              ) : (
                [
                  // Custom times option - always available
                  <MenuItem key="__custom__" value={CUSTOM_PATTERN_VALUE}>
                    Enter Custom Times
                    <Chip label="Manual" size="small" color="secondary" sx={{ height: 18, fontSize: '0.65rem', ml: 1 }} />
                  </MenuItem>,
                  // Divider
                  ...(availablePatterns.length > 0 ? [
                    <MenuItem key="__divider__" disabled value="" sx={{ borderTop: 1, borderColor: 'divider', mt: 0.5, pt: 1 }}>
                      <Typography variant="caption" color="text.secondary">— or select a pattern —</Typography>
                    </MenuItem>
                  ] : []),
                  // Existing patterns
                  ...availablePatterns.map((pattern) => (
                    <MenuItem key={pattern.id} value={pattern.id}>
                      {pattern.name}
                      {pattern.isNight && <Chip label="Night" size="small" color="info" sx={{ height: 18, fontSize: '0.65rem', ml: 1 }} />}
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                        {pattern.startTime || '?'} - {pattern.endTime || '?'}
                      </Typography>
                    </MenuItem>
                  ))
                ]
              )}
            </Select>
          </FormControl>

          {/* Custom Times Mode - time inputs shown immediately */}
          {isCustomTimesMode && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Alert severity="info" sx={{ py: 0.5 }}>
                <Typography variant="caption">
                  Enter custom start and end times for this shift.
                  {customPatternForProject ? (
                    <><br />Using pattern: <strong>{customPatternForProject.name}</strong></>
                  ) : availablePatterns.length > 0 ? (
                    <><br />Using pattern: <strong>{availablePatterns[0].name}</strong> (with custom times)</>
                  ) : (
                    <><br /><strong>Warning:</strong> No shift patterns exist for this project. Create one in Planning view first.</>
                  )}
                </Typography>
              </Alert>
              <Box sx={{ display: 'flex', gap: 2 }}>
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
            </Box>
          )}

          {/* Fatigue Parameters - shown when pattern is selected OR in custom mode */}
          {(selectedPatternId || isCustomTimesMode) && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Fatigue Parameters (Optional Overrides)
              </Typography>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Commute In (mins)"
                  type="number"
                  value={commuteIn}
                  onChange={(e) => setCommuteIn(e.target.value === '' ? '' : Number(e.target.value))}
                  fullWidth
                  slotProps={{ htmlInput: { min: 0, max: 240 } }}
                  helperText="Travel to work"
                />
                <TextField
                  label="Commute Out (mins)"
                  type="number"
                  value={commuteOut}
                  onChange={(e) => setCommuteOut(e.target.value === '' ? '' : Number(e.target.value))}
                  fullWidth
                  slotProps={{ htmlInput: { min: 0, max: 240 } }}
                  helperText="Travel from work"
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Workload"
                  type="number"
                  value={workload}
                  onChange={(e) => setWorkload(e.target.value === '' ? '' : Number(e.target.value))}
                  fullWidth
                  select
                  helperText="1=High, 4=Low"
                >
                  <MenuItem value={1}>1 - High</MenuItem>
                  <MenuItem value={2}>2 - Moderate</MenuItem>
                  <MenuItem value={3}>3 - Light</MenuItem>
                  <MenuItem value={4}>4 - Very Light</MenuItem>
                </TextField>
                <TextField
                  label="Attention"
                  type="number"
                  value={attention}
                  onChange={(e) => setAttention(e.target.value === '' ? '' : Number(e.target.value))}
                  fullWidth
                  select
                  helperText="1=High, 4=Low"
                >
                  <MenuItem value={1}>1 - Continuous</MenuItem>
                  <MenuItem value={2}>2 - Frequent</MenuItem>
                  <MenuItem value={3}>3 - Occasional</MenuItem>
                  <MenuItem value={4}>4 - Minimal</MenuItem>
                </TextField>
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Break Frequency (mins)"
                  type="number"
                  value={breakFrequency}
                  onChange={(e) => setBreakFrequency(e.target.value === '' ? '' : Number(e.target.value))}
                  fullWidth
                  slotProps={{ htmlInput: { min: 30, max: 480 } }}
                  helperText="Time between breaks"
                />
                <TextField
                  label="Break Length (mins)"
                  type="number"
                  value={breakLength}
                  onChange={(e) => setBreakLength(e.target.value === '' ? '' : Number(e.target.value))}
                  fullWidth
                  slotProps={{ htmlInput: { min: 5, max: 120 } }}
                  helperText="Duration of each break"
                />
              </Box>

              {selectedPattern && (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  <Typography variant="caption">
                    <strong>Pattern defaults:</strong> Commute: {selectedPattern.commuteTime ? `${selectedPattern.commuteTime} mins` : 'Not set'} |
                    Workload: {selectedPattern.workload || 'Not set'} |
                    Attention: {selectedPattern.attention || 'Not set'} |
                    Breaks: {selectedPattern.breakFrequency ? `every ${selectedPattern.breakFrequency} mins` : 'Not set'}
                    ({selectedPattern.breakLength ? `${selectedPattern.breakLength} mins each` : 'Not set'})
                  </Typography>
                </Alert>
              )}
            </Box>
          )}

          {/* Selected Pattern Info */}
          {selectedPattern && !isCustomTimesMode && (
            <Alert severity="success" sx={{ py: 0.5 }}>
              <Typography variant="caption">
                <strong>{selectedPattern.name}</strong> ({selectedPattern.dutyType})
                {selectedPattern.isNight && ' - Night Shift'}
                <br />
                Default times: {selectedPattern.startTime || '?'} - {selectedPattern.endTime || '?'}
              </Typography>
            </Alert>
          )}

          {/* Custom Times Toggle - only for existing patterns */}
          {selectedPatternId && !isCustomTimesMode && (
            <Box>
              <Button
                variant={useCustomTimes ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setUseCustomTimes(!useCustomTimes)}
              >
                {useCustomTimes ? 'Using Custom Times' : 'Override Times'}
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
          disabled={
            isSubmitting ||
            !selectedProjectId ||
            !selectedPatternId ||
            (isCustomTimesMode && availablePatterns.length === 0)
          }
          startIcon={<Plus className="w-4 h-4" />}
        >
          {isSubmitting ? 'Adding...' : 'Add Shift'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
