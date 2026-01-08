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
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import { X, Clock, User, Calendar, FileText, ChevronDown, ChevronUp, Settings } from '@/components/ui/Icons';
import type { AssignmentCamel, ShiftPatternCamel, EmployeeCamel } from '@/lib/types';
import { DEFAULT_FATIGUE_PARAMS } from '@/lib/fatigue';

interface AssignmentEditModalProps {
  assignment: AssignmentCamel;
  employee: EmployeeCamel;
  shiftPattern: ShiftPatternCamel;
  allShiftPatterns: ShiftPatternCamel[];
  onClose: () => void;
  onSave: (id: number, data: Partial<AssignmentCamel>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function AssignmentEditModal({
  assignment,
  employee,
  shiftPattern,
  allShiftPatterns,
  onClose,
  onSave,
  onDelete,
}: AssignmentEditModalProps) {
  const [customStartTime, setCustomStartTime] = useState(assignment.customStartTime || '');
  const [customEndTime, setCustomEndTime] = useState(assignment.customEndTime || '');
  const [notes, setNotes] = useState(assignment.notes || '');
  const [selectedPatternId, setSelectedPatternId] = useState(assignment.shiftPatternId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFatigueParams, setShowFatigueParams] = useState(false);

  const selectedPattern = allShiftPatterns.find(p => p.id === selectedPatternId) || shiftPattern;

  // Helper to get pattern defaults
  const getPatternCommuteIn = (pattern: ShiftPatternCamel) =>
    pattern.commuteTime ? Math.floor(pattern.commuteTime / 2) : Math.floor(DEFAULT_FATIGUE_PARAMS.commuteTime / 2);
  const getPatternCommuteOut = (pattern: ShiftPatternCamel) =>
    pattern.commuteTime ? Math.ceil(pattern.commuteTime / 2) : Math.ceil(DEFAULT_FATIGUE_PARAMS.commuteTime / 2);

  // Fatigue parameters - initialize from assignment first, then pattern, then defaults
  // This ensures when we open the modal, we see what's actually being used for this assignment
  const [commuteIn, setCommuteIn] = useState<number>(
    assignment.commuteIn ?? getPatternCommuteIn(selectedPattern)
  );
  const [commuteOut, setCommuteOut] = useState<number>(
    assignment.commuteOut ?? getPatternCommuteOut(selectedPattern)
  );
  const [workload, setWorkload] = useState<number>(
    assignment.workload ?? selectedPattern.workload ?? DEFAULT_FATIGUE_PARAMS.workload
  );
  const [attention, setAttention] = useState<number>(
    assignment.attention ?? selectedPattern.attention ?? DEFAULT_FATIGUE_PARAMS.attention
  );
  const [breakFrequency, setBreakFrequency] = useState<number>(
    assignment.breakFrequency ?? selectedPattern.breakFrequency ?? DEFAULT_FATIGUE_PARAMS.breakFrequency
  );
  const [breakLength, setBreakLength] = useState<number>(
    assignment.breakLength ?? selectedPattern.breakLength ?? DEFAULT_FATIGUE_PARAMS.breakLength
  );

  // Check if params differ from pattern defaults
  const patternCommuteIn = selectedPattern.commuteTime ? Math.floor(selectedPattern.commuteTime / 2) : Math.floor(DEFAULT_FATIGUE_PARAMS.commuteTime / 2);
  const patternCommuteOut = selectedPattern.commuteTime ? Math.ceil(selectedPattern.commuteTime / 2) : Math.ceil(DEFAULT_FATIGUE_PARAMS.commuteTime / 2);
  const hasCustomParams =
    commuteIn !== patternCommuteIn ||
    commuteOut !== patternCommuteOut ||
    workload !== (selectedPattern.workload ?? DEFAULT_FATIGUE_PARAMS.workload) ||
    attention !== (selectedPattern.attention ?? DEFAULT_FATIGUE_PARAMS.attention) ||
    breakFrequency !== (selectedPattern.breakFrequency ?? DEFAULT_FATIGUE_PARAMS.breakFrequency) ||
    breakLength !== (selectedPattern.breakLength ?? DEFAULT_FATIGUE_PARAMS.breakLength);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Determine if we have custom times that differ from the selected pattern
      const hasCustomStart = customStartTime && customStartTime !== selectedPattern.startTime;
      const hasCustomEnd = customEndTime && customEndTime !== selectedPattern.endTime;
      const hasCustomTimes = hasCustomStart || hasCustomEnd;

      // Find the Custom (Ad-hoc) pattern for this project
      const customPattern = allShiftPatterns.find(p => p.id.endsWith('-custom'));

      // Determine which pattern to use
      let targetPatternId = selectedPatternId;
      let finalCustomStartTime = customStartTime || undefined;
      let finalCustomEndTime = customEndTime || undefined;

      // If we have custom times and we're not already on the custom pattern, move to custom
      if (hasCustomTimes && customPattern && !selectedPatternId.endsWith('-custom')) {
        targetPatternId = customPattern.id;
        // Keep the custom times as they are
      }

      // If we're on the custom pattern and clearing custom times back to match another pattern,
      // and the user explicitly selected a different pattern, use that pattern
      if (!hasCustomTimes && selectedPatternId.endsWith('-custom') && selectedPatternId !== assignment.shiftPatternId) {
        // User explicitly selected a non-custom pattern and has no custom times
        targetPatternId = selectedPatternId;
        finalCustomStartTime = undefined;
        finalCustomEndTime = undefined;
      }

      // Determine if fatigue params differ from pattern defaults
      // If they do, save them; if not, clear them so we inherit from pattern
      const saveCommuteIn = commuteIn !== patternCommuteIn ? commuteIn : undefined;
      const saveCommuteOut = commuteOut !== patternCommuteOut ? commuteOut : undefined;
      const saveWorkload = workload !== (selectedPattern.workload ?? DEFAULT_FATIGUE_PARAMS.workload) ? workload : undefined;
      const saveAttention = attention !== (selectedPattern.attention ?? DEFAULT_FATIGUE_PARAMS.attention) ? attention : undefined;
      const saveBreakFrequency = breakFrequency !== (selectedPattern.breakFrequency ?? DEFAULT_FATIGUE_PARAMS.breakFrequency) ? breakFrequency : undefined;
      const saveBreakLength = breakLength !== (selectedPattern.breakLength ?? DEFAULT_FATIGUE_PARAMS.breakLength) ? breakLength : undefined;

      await onSave(assignment.id, {
        shiftPatternId: targetPatternId,
        customStartTime: finalCustomStartTime,
        customEndTime: finalCustomEndTime,
        notes: notes || undefined,
        // Include fatigue parameters (only if modified from pattern defaults)
        commuteIn: saveCommuteIn,
        commuteOut: saveCommuteOut,
        workload: saveWorkload,
        attention: saveAttention,
        breakFrequency: saveBreakFrequency,
        breakLength: saveBreakLength,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Remove ${employee.name} from this shift on ${formatDate(assignment.date)}?`)) {
      return;
    }

    setSaving(true);
    try {
      await onDelete(assignment.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete assignment');
      setSaving(false);
    }
  };

  // Clear custom times if they match the pattern defaults
  const handleClearCustomTimes = () => {
    setCustomStartTime('');
    setCustomEndTime('');
  };

  // Get effective times for display
  const effectiveStartTime = customStartTime || selectedPattern.startTime || '--:--';
  const effectiveEndTime = customEndTime || selectedPattern.endTime || '--:--';

  // Warning: will move to Custom row
  const hasCustomStart = customStartTime && customStartTime !== selectedPattern.startTime;
  const hasCustomEnd = customEndTime && customEndTime !== selectedPattern.endTime;
  const willMoveToCustom = (hasCustomStart || hasCustomEnd) && !selectedPatternId.endsWith('-custom');

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'action.hover' }}>
        Edit Assignment
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
          <X className="w-5 h-5" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Employee info (read-only) */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 2,
              bgcolor: 'primary.50',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'primary.light',
            }}
          >
            <Box sx={{ color: 'primary.main' }}>
              <User className="w-5 h-5" />
            </Box>
            <Box>
              <Typography variant="subtitle2">{employee.name}</Typography>
              {employee.role && (
                <Typography variant="body2" color="text.secondary">{employee.role}</Typography>
              )}
            </Box>
          </Box>

          {/* Date (read-only) */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 2,
              bgcolor: 'action.hover',
              borderRadius: 1,
            }}
          >
            <Box sx={{ color: 'text.secondary' }}>
              <Calendar className="w-5 h-5" />
            </Box>
            <Typography variant="body2">{formatDate(assignment.date)}</Typography>
          </Box>

          {/* Shift Pattern selector */}
          <TextField
            select
            label="Shift Pattern"
            value={selectedPatternId}
            onChange={(e) => setSelectedPatternId(e.target.value)}
            fullWidth
          >
            {allShiftPatterns.map(pattern => (
              <MenuItem key={pattern.id} value={pattern.id}>
                {pattern.name} ({pattern.startTime || '??'} - {pattern.endTime || '??'})
              </MenuItem>
            ))}
          </TextField>

          {/* Custom times */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">Custom Times (Override)</Typography>
              {(customStartTime || customEndTime) && (
                <Button
                  size="small"
                  onClick={handleClearCustomTimes}
                  sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                >
                  Clear overrides
                </Button>
              )}
            </Box>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  type="time"
                  label="Start"
                  value={customStartTime}
                  onChange={(e) => setCustomStartTime(e.target.value)}
                  fullWidth
                  size="small"
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  type="time"
                  label="End"
                  value={customEndTime}
                  onChange={(e) => setCustomEndTime(e.target.value)}
                  fullWidth
                  size="small"
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
            </Grid>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
              <Clock className="w-3 h-3" />
              <Typography variant="caption" color="text.secondary">
                Effective: {effectiveStartTime} - {effectiveEndTime}
              </Typography>
            </Box>
            {willMoveToCustom && (
              <Alert severity="warning" sx={{ mt: 1.5 }} icon={<Clock className="w-4 h-4" />}>
                <Typography variant="caption">
                  Custom times will move this assignment to the <strong>Custom (Ad-hoc)</strong> row
                </Typography>
              </Alert>
            )}
          </Box>

          {/* Fatigue Parameters Section */}
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
            <Box
              onClick={() => setShowFatigueParams(!showFatigueParams)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1.5,
                bgcolor: hasCustomParams ? 'warning.50' : 'action.hover',
                cursor: 'pointer',
                '&:hover': { bgcolor: hasCustomParams ? 'warning.100' : 'action.selected' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Settings className="w-4 h-4" />
                <Typography variant="subtitle2">
                  Fatigue Parameters
                  {hasCustomParams && (
                    <Typography component="span" variant="caption" sx={{ ml: 1, color: 'warning.main' }}>
                      (modified)
                    </Typography>
                  )}
                </Typography>
              </Box>
              {showFatigueParams ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Box>

            <Collapse in={showFatigueParams}>
              <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
                {/* Commute Times */}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Journey Time (minutes)
                </Typography>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      type="number"
                      label="Commute to work"
                      value={commuteIn}
                      onChange={(e) => setCommuteIn(parseInt(e.target.value) || 0)}
                      fullWidth
                      size="small"
                      slotProps={{ htmlInput: { min: 0, max: 180 } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      type="number"
                      label="Commute from work"
                      value={commuteOut}
                      onChange={(e) => setCommuteOut(parseInt(e.target.value) || 0)}
                      fullWidth
                      size="small"
                      slotProps={{ htmlInput: { min: 0, max: 180 } }}
                    />
                  </Grid>
                </Grid>

                {/* Workload & Attention */}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Job Characteristics (1=most demanding, 4=least demanding)
                </Typography>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      select
                      label="Workload"
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
                      label="Attention Required"
                      value={attention}
                      onChange={(e) => setAttention(parseInt(e.target.value))}
                      fullWidth
                      size="small"
                    >
                      <MenuItem value={1}>1 - All/most of the time</MenuItem>
                      <MenuItem value={2}>2 - Some of the time</MenuItem>
                      <MenuItem value={3}>3 - Occasionally</MenuItem>
                      <MenuItem value={4}>4 - Rarely/never</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>

                {/* Break Settings */}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Break Settings
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      type="number"
                      label="Mins between breaks"
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
                      label="Break duration (mins)"
                      value={breakLength}
                      onChange={(e) => setBreakLength(parseInt(e.target.value) || 15)}
                      fullWidth
                      size="small"
                      slotProps={{ htmlInput: { min: 5, max: 60 } }}
                    />
                  </Grid>
                </Grid>

                {/* Reset to pattern defaults button */}
                {hasCustomParams && (
                  <Button
                    size="small"
                    onClick={() => {
                      setCommuteIn(patternCommuteIn);
                      setCommuteOut(patternCommuteOut);
                      setWorkload(selectedPattern.workload ?? DEFAULT_FATIGUE_PARAMS.workload);
                      setAttention(selectedPattern.attention ?? DEFAULT_FATIGUE_PARAMS.attention);
                      setBreakFrequency(selectedPattern.breakFrequency ?? DEFAULT_FATIGUE_PARAMS.breakFrequency);
                      setBreakLength(selectedPattern.breakLength ?? DEFAULT_FATIGUE_PARAMS.breakLength);
                    }}
                    sx={{ mt: 2, textTransform: 'none' }}
                  >
                    Reset to pattern defaults
                  </Button>
                )}
              </Box>
            </Collapse>
          </Box>

          {/* Notes */}
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            rows={3}
            placeholder="Add notes for this assignment..."
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <Box sx={{ alignSelf: 'flex-start', mt: 1, mr: 1, color: 'text.secondary' }}>
                    <FileText className="w-4 h-4" />
                  </Box>
                ),
              },
            }}
          />

          {/* Error display */}
          {error && (
            <Alert severity="error">
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between', bgcolor: 'action.hover' }}>
        <Button
          onClick={handleDelete}
          disabled={saving}
          color="error"
        >
          Delete
        </Button>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
