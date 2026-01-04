'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import { X } from '@/components/ui/Icons';
import type { ProjectCamel } from '@/lib/types';
import type { Shift } from './hooks/useFatigueState';

interface FatigueSaveModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  saveError: string | null;
  patternName: string;
  onPatternNameChange: (name: string) => void;
  projectId: number | null;
  onProjectIdChange: (id: number | null) => void;
  dutyType: string;
  onDutyTypeChange: (type: string) => void;
  isNight: boolean;
  onIsNightChange: (isNight: boolean) => void;
  projects: ProjectCamel[];
  shifts: Shift[];
}

export function FatigueSaveModal({
  open,
  onClose,
  onSave,
  isSaving,
  saveError,
  patternName,
  onPatternNameChange,
  projectId,
  onProjectIdChange,
  dutyType,
  onDutyTypeChange,
  isNight,
  onIsNightChange,
  projects,
  shifts,
}: FatigueSaveModalProps) {
  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Save Shift Pattern
        <IconButton onClick={handleClose} size="small">
          <X className="w-5 h-5" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {saveError && (
            <Alert severity="error">{saveError}</Alert>
          )}

          <TextField
            label="Pattern Name"
            value={patternName}
            onChange={(e) => onPatternNameChange(e.target.value)}
            placeholder="e.g., Day Shift Mon-Fri"
            required
            fullWidth
          />

          <FormControl fullWidth required>
            <InputLabel>Assign to Project</InputLabel>
            <Select
              value={projectId || ''}
              label="Assign to Project"
              onChange={(e) => onProjectIdChange(e.target.value ? Number(e.target.value) : null)}
            >
              <MenuItem value="">Select project...</MenuItem>
              {projects.map(project => (
                <MenuItem key={project.id} value={project.id}>{project.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Duty Type</InputLabel>
            <Select
              value={dutyType}
              label="Duty Type"
              onChange={(e) => onDutyTypeChange(e.target.value as string)}
            >
              <MenuItem value="Non-Possession">Non-Possession</MenuItem>
              <MenuItem value="Possession">Possession</MenuItem>
              <MenuItem value="Office">Office</MenuItem>
              <MenuItem value="Lookout">Lookout</MenuItem>
              <MenuItem value="Machine">Machine</MenuItem>
              <MenuItem value="Protection">Protection</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Checkbox
                checked={isNight}
                onChange={(e) => onIsNightChange(e.target.checked)}
              />
            }
            label="Night Shift Pattern"
          />

          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Pattern Summary</Typography>
            <Typography variant="body2" color="text.secondary">
              Working days: {shifts.filter(s => !s.isRestDay).length} |
              Rest days: {shifts.filter(s => s.isRestDay).length}
            </Typography>
          </Paper>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button variant="contained" color="success" onClick={onSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Pattern'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
