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
import { X, Clock, User, Calendar, FileText } from '@/components/ui/Icons';
import type { AssignmentCamel, ShiftPatternCamel, EmployeeCamel } from '@/lib/types';

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

  const selectedPattern = allShiftPatterns.find(p => p.id === selectedPatternId) || shiftPattern;

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

      await onSave(assignment.id, {
        shiftPatternId: targetPatternId,
        customStartTime: finalCustomStartTime,
        customEndTime: finalCustomEndTime,
        notes: notes || undefined,
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
