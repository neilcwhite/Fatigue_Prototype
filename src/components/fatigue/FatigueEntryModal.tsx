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
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import { X, ArrowLeft, Plus, Trash2 } from '@/components/ui/Icons';
import type { ProjectCamel, ShiftPatternCamel, AssignmentCamel } from '@/lib/types';

interface FatigueEntryModalProps {
  open: boolean;
  onClose: () => void;
  projects: ProjectCamel[];
  shiftPatterns: ShiftPatternCamel[];
  assignments: AssignmentCamel[];
  onSelectPattern: (pattern: ShiftPatternCamel, project: ProjectCamel, mode: 'review' | 'edit') => void;
  onCreateNewPattern: (project: ProjectCamel) => void;
  onCreateProject: (name: string, startDate?: string, endDate?: string) => Promise<ProjectCamel>;
  onDeleteShiftPattern: (id: string) => Promise<void>;
  onUpdateAssignment: (id: number, data: Partial<AssignmentCamel>) => Promise<void>;
}

type ModalStep = 'select-project' | 'create-project' | 'select-pattern';

export function FatigueEntryModal({
  open,
  onClose,
  projects,
  shiftPatterns,
  assignments,
  onSelectPattern,
  onCreateNewPattern,
  onCreateProject,
  onDeleteShiftPattern,
  onUpdateAssignment,
}: FatigueEntryModalProps) {
  const [step, setStep] = useState<ModalStep>('select-project');
  const [selectedProject, setSelectedProject] = useState<ProjectCamel | null>(null);

  // Create project form state
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectStartDate, setNewProjectStartDate] = useState('');
  const [newProjectEndDate, setNewProjectEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    pattern: ShiftPatternCamel;
    futureAssignments: AssignmentCamel[];
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filter patterns for selected project and sort (Custom always last)
  const projectPatterns = useMemo(() => {
    if (!selectedProject) return [];
    return shiftPatterns
      .filter(p => p.projectId === selectedProject.id)
      .sort((a, b) => {
        // Custom (Ad hoc) always goes to bottom
        const aIsCustom = a.name.toLowerCase().includes('custom') || a.name.toLowerCase().includes('ad hoc');
        const bIsCustom = b.name.toLowerCase().includes('custom') || b.name.toLowerCase().includes('ad hoc');
        if (aIsCustom && !bIsCustom) return 1;
        if (!aIsCustom && bIsCustom) return -1;
        // Otherwise sort by creation date (oldest first)
        if (a.createdAt && b.createdAt) {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return 0;
      });
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

  const handlePatternSelect = (pattern: ShiftPatternCamel) => {
    if (selectedProject) {
      // Go straight to edit mode
      onSelectPattern(pattern, selectedProject, 'edit');
    }
  };

  const handleCreateNewPattern = () => {
    if (selectedProject) {
      onCreateNewPattern(selectedProject);
    }
  };

  // Get Custom (Ad-hoc) pattern for this project
  const customPattern = useMemo(() => {
    if (!selectedProject) return null;
    return shiftPatterns.find(
      p => p.projectId === selectedProject.id &&
      (p.name.toLowerCase().includes('custom') || p.name.toLowerCase().includes('ad hoc'))
    );
  }, [selectedProject, shiftPatterns]);

  const handleDeleteClick = (pattern: ShiftPatternCamel, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click

    const today = new Date().toISOString().split('T')[0];
    const futureAssignments = assignments.filter(
      a => a.shiftPatternId === pattern.id && a.date >= today
    );

    if (futureAssignments.length === 0) {
      // No future assignments - delete directly
      handleConfirmDelete(pattern, []);
    } else {
      // Has future assignments - show confirmation
      setDeleteConfirm({ pattern, futureAssignments });
    }
  };

  const handleConfirmDelete = async (pattern: ShiftPatternCamel, futureAssignments: AssignmentCamel[], moveToCustom = false) => {
    setDeleting(true);
    setError(null);

    try {
      if (moveToCustom && customPattern && futureAssignments.length > 0) {
        // Move future assignments to Custom pattern
        for (const assignment of futureAssignments) {
          await onUpdateAssignment(assignment.id, { shiftPatternId: customPattern.id });
        }
      }

      // Delete the pattern
      await onDeleteShiftPattern(pattern.id);
      setDeleteConfirm(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete pattern';
      setError(message);
    } finally {
      setDeleting(false);
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
          Shift Builder
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

            {projects.filter(p => !p.archived).length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                No active projects found. Create your first project to get started.
              </Alert>
            ) : (
              <Grid container spacing={1.5} sx={{ maxHeight: 300, overflow: 'auto' }}>
                {projects.filter(p => !p.archived).map((project) => (
                  <Grid size={{ xs: 6 }} key={project.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        height: '100%',
                        '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' }
                      }}
                    >
                      <CardActionArea onClick={() => handleProjectSelect(project)} sx={{ height: '100%' }}>
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Typography variant="subtitle2" noWrap fontWeight="medium">
                            {project.name}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                            <Chip
                              label={`${patternCountByProject[project.id] || 0} patterns`}
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          </Box>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
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
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select a shift pattern to edit, or create a new one.
            </Typography>

            {projectPatterns.length === 0 ? (
              <Alert severity="info">
                No shift patterns found for this project. Create your first pattern to start assessing fatigue.
              </Alert>
            ) : (
              <Grid container spacing={1} sx={{ maxHeight: 280, overflow: 'auto' }}>
                {projectPatterns.map((pattern) => (
                    <Grid size={{ xs: 4 }} key={pattern.id}>
                      <Card
                        variant="outlined"
                        sx={{
                          height: '100%',
                          position: 'relative',
                          '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                          '&:hover .delete-btn': { opacity: 1 },
                        }}
                      >
                        <CardActionArea onClick={() => handlePatternSelect(pattern)} sx={{ height: '100%' }}>
                          <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                            <Typography variant="caption" noWrap fontWeight="medium" display="block">
                              {pattern.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap display="block" sx={{ fontSize: '0.65rem' }}>
                              {pattern.startTime} - {pattern.endTime}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                              <Chip
                                label={pattern.dutyType}
                                size="small"
                                variant="outlined"
                                sx={{ height: 18, fontSize: '0.6rem' }}
                              />
                              {pattern.isNight && (
                                <Chip
                                  label="Night"
                                  size="small"
                                  color="info"
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: '0.6rem' }}
                                />
                              )}
                            </Box>
                          </CardContent>
                        </CardActionArea>
                        {/* Delete button */}
                        <IconButton
                          className="delete-btn"
                          size="small"
                          onClick={(e) => handleDeleteClick(pattern, e)}
                          sx={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            opacity: 0,
                            transition: 'opacity 0.2s',
                            bgcolor: 'background.paper',
                            p: 0.25,
                            '&:hover': { bgcolor: 'error.light', color: 'error.contrastText' },
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </IconButton>
                      </Card>
                    </Grid>
                  ))}
              </Grid>
            )}

            {/* Delete Confirmation Dialog */}
            {deleteConfirm && (
              <Alert
                severity="warning"
                sx={{ mt: 2 }}
                action={
                  <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                    {customPattern && (
                      <Button
                        size="small"
                        color="inherit"
                        disabled={deleting}
                        onClick={() => handleConfirmDelete(deleteConfirm.pattern, deleteConfirm.futureAssignments, true)}
                      >
                        {deleting ? 'Moving...' : 'Move to Custom & Delete'}
                      </Button>
                    )}
                    <Button
                      size="small"
                      color="error"
                      disabled={deleting}
                      onClick={() => handleConfirmDelete(deleteConfirm.pattern, deleteConfirm.futureAssignments, false)}
                    >
                      {deleting ? 'Deleting...' : 'Delete Anyway'}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => setDeleteConfirm(null)}
                      disabled={deleting}
                    >
                      Cancel
                    </Button>
                  </Box>
                }
              >
                <Typography variant="body2" fontWeight="medium">
                  "{deleteConfirm.pattern.name}" has {deleteConfirm.futureAssignments.length} future assignment(s)
                </Typography>
                <Typography variant="caption">
                  {customPattern
                    ? 'You can move these to the Custom pattern before deleting, or delete anyway (assignments will be removed).'
                    : 'Deleting will remove these future assignments. Past assignments are preserved.'}
                </Typography>
              </Alert>
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
