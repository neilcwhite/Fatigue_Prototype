'use client';

import { useState, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import { X, ArrowLeft, Plus, Eye, Edit } from '@/components/ui/Icons';
import type { ProjectCamel, ShiftPatternCamel } from '@/lib/types';

interface FatigueEntryModalProps {
  open: boolean;
  onClose: () => void;
  projects: ProjectCamel[];
  shiftPatterns: ShiftPatternCamel[];
  onSelectPattern: (pattern: ShiftPatternCamel, project: ProjectCamel, mode: 'review' | 'edit') => void;
  onCreateNewPattern: (project: ProjectCamel) => void;
  onCreateProject: (name: string, location?: string, type?: string, startDate?: string, endDate?: string) => Promise<ProjectCamel>;
}

const PROJECT_TYPES = [
  'Resignalling',
  'Track Renewal',
  'Electrification',
  'Station Works',
  'Maintenance',
  'Other',
];

type ModalStep = 'select-project' | 'create-project' | 'select-pattern';

export function FatigueEntryModal({
  open,
  onClose,
  projects,
  shiftPatterns,
  onSelectPattern,
  onCreateNewPattern,
  onCreateProject,
}: FatigueEntryModalProps) {
  const [step, setStep] = useState<ModalStep>('select-project');
  const [selectedProject, setSelectedProject] = useState<ProjectCamel | null>(null);

  // Create project form state
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectLocation, setNewProjectLocation] = useState('');
  const [newProjectType, setNewProjectType] = useState('');
  const [newProjectStartDate, setNewProjectStartDate] = useState('');
  const [newProjectEndDate, setNewProjectEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter patterns for selected project
  const projectPatterns = useMemo(() => {
    if (!selectedProject) return [];
    return shiftPatterns.filter(p => p.projectId === selectedProject.id);
  }, [selectedProject, shiftPatterns]);

  // Get pattern count per project for display
  const patternCountByProject = useMemo(() => {
    const counts: Record<number, number> = {};
    shiftPatterns.forEach(p => {
      counts[p.projectId] = (counts[p.projectId] || 0) + 1;
    });
    return counts;
  }, [shiftPatterns]);

  const resetForm = () => {
    setNewProjectName('');
    setNewProjectLocation('');
    setNewProjectType('');
    setNewProjectStartDate('');
    setNewProjectEndDate('');
    setError(null);
  };

  const handleProjectSelect = (project: ProjectCamel) => {
    setSelectedProject(project);
    setStep('select-pattern');
  };

  const handleCreateProjectClick = () => {
    resetForm();
    setStep('create-project');
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newProjectName.trim()) {
      setError('Project name is required');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const newProject = await onCreateProject(
        newProjectName.trim(),
        newProjectLocation.trim() || undefined,
        newProjectType.trim() || undefined,
        newProjectStartDate || undefined,
        newProjectEndDate || undefined
      );
      setSelectedProject(newProject);
      setStep('select-pattern');
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (step === 'create-project' || step === 'select-pattern') {
      setStep('select-project');
      setSelectedProject(null);
    }
  };

  const handlePatternAction = (pattern: ShiftPatternCamel, mode: 'review' | 'edit') => {
    if (selectedProject) {
      onSelectPattern(pattern, selectedProject, mode);
    }
  };

  const handleCreateNewPattern = () => {
    if (selectedProject) {
      onCreateNewPattern(selectedProject);
    }
  };

  const getStepIndex = () => {
    switch (step) {
      case 'select-project':
      case 'create-project':
        return 0;
      case 'select-pattern':
        return 1;
      default:
        return 0;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {step !== 'select-project' && (
            <IconButton onClick={handleBack} size="small" sx={{ mr: 1 }}>
              <ArrowLeft className="w-5 h-5" />
            </IconButton>
          )}
          Fatigue Assessment
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
          <X className="w-5 h-5" />
        </IconButton>
      </DialogTitle>

      <Box sx={{ px: 3, pb: 2 }}>
        <Stepper activeStep={getStepIndex()} alternativeLabel>
          <Step>
            <StepLabel>Select Project</StepLabel>
          </Step>
          <Step>
            <StepLabel>Select Pattern</StepLabel>
          </Step>
        </Stepper>
      </Box>

      {/* Step 1: Select or Create Project */}
      {step === 'select-project' && (
        <>
          <DialogContent dividers>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select an existing project or create a new one to manage shift patterns.
            </Typography>

            {projects.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                No projects found. Create your first project to get started.
              </Alert>
            ) : (
              <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                {projects.map((project) => (
                  <ListItem
                    key={project.id}
                    component="div"
                    onClick={() => handleProjectSelect(project)}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1,
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    <ListItemText
                      primary={project.name}
                      secondary={
                        <Box component="span" sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                          {project.location && (
                            <Typography variant="caption" color="text.secondary">
                              {project.location}
                            </Typography>
                          )}
                          {project.type && (
                            <Chip label={project.type} size="small" variant="outlined" />
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        label={`${patternCountByProject[project.id] || 0} patterns`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="contained"
              startIcon={<Plus className="w-4 h-4" />}
              onClick={handleCreateProjectClick}
            >
              Create New Project
            </Button>
          </DialogActions>
        </>
      )}

      {/* Step 1b: Create Project Form */}
      {step === 'create-project' && (
        <form onSubmit={handleCreateProjectSubmit}>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {error && (
                <Alert severity="error" sx={{ mb: 1 }}>
                  {error}
                </Alert>
              )}

              <TextField
                label="Project Name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g., Clacton Resignalling"
                required
                fullWidth
                autoFocus
              />

              <TextField
                label="Location"
                value={newProjectLocation}
                onChange={(e) => setNewProjectLocation(e.target.value)}
                placeholder="e.g., Essex"
                fullWidth
              />

              <TextField
                select
                label="Project Type"
                value={newProjectType}
                onChange={(e) => setNewProjectType(e.target.value)}
                fullWidth
              >
                <MenuItem value="">
                  <em>Select type...</em>
                </MenuItem>
                {PROJECT_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    type="date"
                    label="Start Date"
                    value={newProjectStartDate}
                    onChange={(e) => setNewProjectStartDate(e.target.value)}
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    type="date"
                    label="End Date"
                    value={newProjectEndDate}
                    onChange={(e) => setNewProjectEndDate(e.target.value)}
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={handleBack} disabled={saving}>
              Back
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {saving ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogActions>
        </form>
      )}

      {/* Step 2: Select Pattern */}
      {step === 'select-pattern' && selectedProject && (
        <>
          <DialogContent dividers>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Project
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {selectedProject.name}
              </Typography>
              {selectedProject.location && (
                <Typography variant="caption" color="text.secondary">
                  {selectedProject.location}
                </Typography>
              )}
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select an existing shift pattern to review or edit, or create a new one.
            </Typography>

            {projectPatterns.length === 0 ? (
              <Alert severity="info">
                No shift patterns found for this project. Create your first pattern to start assessing fatigue.
              </Alert>
            ) : (
              <List sx={{ maxHeight: 250, overflow: 'auto' }}>
                {projectPatterns.map((pattern) => (
                  <ListItem
                    key={pattern.id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1,
                      flexDirection: 'column',
                      alignItems: 'stretch',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                      <ListItemText
                        primary={pattern.name}
                        secondary={
                          <Box component="span" sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                            <Chip label={pattern.dutyType} size="small" variant="outlined" />
                            {pattern.isNight && (
                              <Chip label="Night" size="small" color="info" variant="outlined" />
                            )}
                          </Box>
                        }
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1.5, justifyContent: 'flex-end' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Eye className="w-4 h-4" />}
                        onClick={() => handlePatternAction(pattern, 'review')}
                      >
                        Review
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<Edit className="w-4 h-4" />}
                        onClick={() => handlePatternAction(pattern, 'edit')}
                      >
                        Edit
                      </Button>
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={handleBack}>Back</Button>
            <Button
              variant="contained"
              startIcon={<Plus className="w-4 h-4" />}
              onClick={handleCreateNewPattern}
            >
              Create New Pattern
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
