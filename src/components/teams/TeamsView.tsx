'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import { ChevronLeft, Plus, Edit2, Trash2, Users, Calendar, X } from '@/components/ui/Icons';
import type { TeamCamel, EmployeeCamel, ProjectCamel, ShiftPatternCamel, AssignmentCamel, SupabaseUser } from '@/lib/types';

interface TeamsViewProps {
  user: SupabaseUser;
  onSignOut: () => void;
  onBack: () => void;
  teams: TeamCamel[];
  employees: EmployeeCamel[];
  projects: ProjectCamel[];
  shiftPatterns: ShiftPatternCamel[];
  onCreateTeam: (name: string, memberIds: number[]) => Promise<void>;
  onUpdateTeam: (id: number, data: Partial<TeamCamel>) => Promise<void>;
  onDeleteTeam: (id: number) => Promise<void>;
  onCreateAssignment: (data: Omit<AssignmentCamel, 'id' | 'organisationId'>) => Promise<void>;
}

export function TeamsView({
  user,
  onBack,
  teams,
  employees,
  projects,
  shiftPatterns,
  onCreateTeam,
  onUpdateTeam,
  onDeleteTeam,
  onCreateAssignment,
}: TeamsViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamCamel | null>(null);
  const [teamName, setTeamName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);

  // Assignment modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningTeam, setAssigningTeam] = useState<TeamCamel | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [assignStartDate, setAssignStartDate] = useState('');
  const [assignEndDate, setAssignEndDate] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingTeam(null);
    setTeamName('');
    setSelectedMembers([]);
    setShowModal(true);
  };

  const openEditModal = (team: TeamCamel) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setSelectedMembers(team.memberIds || []);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      alert('Please enter a team name');
      return;
    }

    try {
      if (editingTeam) {
        await onUpdateTeam(editingTeam.id, { name: teamName, memberIds: selectedMembers });
      } else {
        await onCreateTeam(teamName, selectedMembers);
      }
      setShowModal(false);
    } catch (err) {
      console.error('Error saving team:', err);
      alert('Failed to save team');
    }
  };

  const handleDelete = async (team: TeamCamel) => {
    if (confirm(`Delete team "${team.name}"?`)) {
      try {
        await onDeleteTeam(team.id);
      } catch (err) {
        console.error('Error deleting team:', err);
        alert('Failed to delete team');
      }
    }
  };

  const toggleMember = (employeeId: number) => {
    setSelectedMembers(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const openAssignModal = (team: TeamCamel) => {
    setAssigningTeam(team);
    setSelectedProjectId(projects.length > 0 ? projects[0].id : null);
    setSelectedPatternId(null);
    setAssignStartDate('');
    setAssignEndDate('');
    setAssignError(null);
    setShowAssignModal(true);
  };

  const projectPatterns = selectedProjectId
    ? shiftPatterns.filter(sp => sp.projectId === selectedProjectId)
    : [];

  const handleBulkAssign = async () => {
    if (!assigningTeam || !selectedProjectId || !selectedPatternId || !assignStartDate || !assignEndDate) {
      setAssignError('Please fill in all fields');
      return;
    }

    const memberIds = assigningTeam.memberIds || [];
    if (memberIds.length === 0) {
      setAssignError('Team has no members');
      return;
    }

    const start = new Date(assignStartDate);
    const end = new Date(assignEndDate);
    if (end < start) {
      setAssignError('End date must be after start date');
      return;
    }

    const pattern = shiftPatterns.find(sp => sp.id === selectedPatternId);
    if (!pattern) {
      setAssignError('Shift pattern not found');
      return;
    }

    setAssigning(true);
    setAssignError(null);

    try {
      const dates: string[] = [];
      const current = new Date(start);
      while (current <= end) {
        const dayOfWeek = current.getDay();
        const dayNames: ('Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat')[] =
          ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayKey = dayNames[dayOfWeek];

        if (pattern.weeklySchedule && pattern.weeklySchedule[dayKey]) {
          dates.push(current.toISOString().split('T')[0]);
        }
        current.setDate(current.getDate() + 1);
      }

      if (dates.length === 0) {
        setAssignError('No active days in the selected date range for this shift pattern');
        setAssigning(false);
        return;
      }

      let created = 0;
      for (const employeeId of memberIds) {
        for (const date of dates) {
          await onCreateAssignment({
            employeeId,
            projectId: selectedProjectId,
            shiftPatternId: selectedPatternId,
            date,
          });
          created++;
        }
      }

      alert(`Successfully created ${created} assignments for ${memberIds.length} team members over ${dates.length} days`);
      setShowAssignModal(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create assignments';
      setAssignError(message);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          background: 'linear-gradient(to right, #1e293b, #0f172a)',
          borderBottom: '4px solid',
          borderColor: 'secondary.main',
        }}
      >
        <Toolbar sx={{ px: { xs: 2, sm: 3 } }}>
          <Button
            onClick={onBack}
            startIcon={<ChevronLeft className="w-4 h-4" />}
            sx={{ color: 'grey.400', mr: 2, '&:hover': { color: 'white' } }}
          >
            Back
          </Button>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            <Box component="span" sx={{ color: 'secondary.light' }}>Team</Box> Management
          </Typography>
          <Chip
            label="TEAMS"
            size="small"
            sx={{
              bgcolor: 'rgba(51, 65, 85, 0.8)',
              color: 'secondary.light',
              fontFamily: 'monospace',
              fontWeight: 500,
              fontSize: '0.7rem',
              mr: 2,
            }}
          />
          <Typography variant="body2" sx={{ color: 'grey.400' }}>{user?.email}</Typography>
        </Toolbar>
      </AppBar>

      {/* Content */}
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" fontWeight={700}>Teams</Typography>
            <Typography variant="body2" color="text.secondary">
              Create teams and bulk-assign them to shift patterns
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<Plus className="w-4 h-4" />}
            onClick={openCreateModal}
          >
            Create Team
          </Button>
        </Box>

        {teams.length === 0 ? (
          <Card sx={{ p: 6, textAlign: 'center' }}>
            <Box sx={{ color: 'grey.300', mb: 2 }}>
              <Users className="w-16 h-16" />
            </Box>
            <Typography variant="h6" gutterBottom>No Teams Yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create a team to group employees and assign them to projects together
            </Typography>
            <Button variant="contained" color="secondary" onClick={openCreateModal}>
              Create Your First Team
            </Button>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {teams.map(team => {
              const teamMembers = employees.filter(e => team.memberIds?.includes(e.id));
              return (
                <Grid size={{ xs: 12, md: 6, lg: 4 }} key={team.id}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box>
                          <Typography variant="h6" fontWeight={600}>{team.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
                          </Typography>
                        </Box>
                        <Box>
                          <IconButton size="small" onClick={() => openEditModal(team)} color="primary">
                            <Edit2 className="w-4 h-4" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDelete(team)} color="error">
                            <Trash2 className="w-4 h-4" />
                          </IconButton>
                        </Box>
                      </Box>

                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        MEMBERS
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {teamMembers.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">No members</Typography>
                        ) : (
                          <>
                            {teamMembers.slice(0, 5).map(member => (
                              <Chip key={member.id} label={member.name.split(' ')[0]} size="small" />
                            ))}
                            {teamMembers.length > 5 && (
                              <Chip label={`+${teamMembers.length - 5} more`} size="small" color="default" />
                            )}
                          </>
                        )}
                      </Box>
                    </CardContent>
                    <CardActions sx={{ p: 2, pt: 0 }}>
                      <Button
                        variant="contained"
                        color="secondary"
                        fullWidth
                        startIcon={<Calendar className="w-4 h-4" />}
                        onClick={() => openAssignModal(team)}
                        disabled={teamMembers.length === 0 || projects.length === 0}
                      >
                        Assign to Shift Pattern
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}

            {/* Add Team Card */}
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <Card
                onClick={openCreateModal}
                sx={{
                  height: '100%',
                  minHeight: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
                  border: '2px dashed',
                  borderColor: 'secondary.light',
                  '&:hover': { borderColor: 'secondary.main' },
                }}
              >
                <Box sx={{ bgcolor: 'secondary.main', borderRadius: '50%', p: 1.5, mb: 1.5 }}>
                  <Plus className="w-6 h-6" />
                </Box>
                <Typography variant="subtitle1" fontWeight={600}>Create New Team</Typography>
              </Card>
            </Grid>
          </Grid>
        )}
      </Box>

      {/* Create/Edit Team Modal */}
      <Dialog open={showModal} onClose={() => setShowModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTeam ? 'Edit Team' : 'Create Team'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="Team Name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g., Night Shift Team A"
                fullWidth
                required
              />

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Select Members ({selectedMembers.length} selected)
                </Typography>
                <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {employees.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                      No employees available
                    </Typography>
                  ) : (
                    <List dense>
                      {employees.map(emp => (
                        <ListItem key={emp.id} disablePadding>
                          <ListItemButton onClick={() => toggleMember(emp.id)}>
                            <ListItemIcon>
                              <Checkbox
                                edge="start"
                                checked={selectedMembers.includes(emp.id)}
                                disableRipple
                              />
                            </ListItemIcon>
                            <ListItemText
                              primary={emp.name}
                              secondary={emp.role}
                            />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Paper>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" variant="contained" color="secondary">
              {editingTeam ? 'Save Changes' : 'Create Team'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Assignment Modal */}
      <Dialog open={showAssignModal} onClose={() => setShowAssignModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            Assign Team to Shift Pattern
            <Typography variant="body2" color="text.secondary">
              Assigning: <strong>{assigningTeam?.name}</strong> ({assigningTeam?.memberIds?.length || 0} members)
            </Typography>
          </Box>
          <IconButton onClick={() => setShowAssignModal(false)} size="small">
            <X className="w-5 h-5" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {assignError && <Alert severity="error">{assignError}</Alert>}

            <TextField
              select
              label="Project"
              value={selectedProjectId || ''}
              onChange={(e) => {
                setSelectedProjectId(Number(e.target.value));
                setSelectedPatternId(null);
              }}
              fullWidth
              required
            >
              <MenuItem value="">Select a project...</MenuItem>
              {projects.map(p => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Shift Pattern"
              value={selectedPatternId || ''}
              onChange={(e) => setSelectedPatternId(e.target.value)}
              fullWidth
              required
              disabled={!selectedProjectId}
            >
              <MenuItem value="">Select a shift pattern...</MenuItem>
              {projectPatterns.map(sp => (
                <MenuItem key={sp.id} value={sp.id}>
                  {sp.name} ({sp.startTime} - {sp.endTime})
                </MenuItem>
              ))}
            </TextField>
            {selectedProjectId && projectPatterns.length === 0 && (
              <Alert severity="warning" variant="outlined">
                No shift patterns defined for this project. Create one in Planning view first.
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  type="date"
                  label="Start Date"
                  value={assignStartDate}
                  onChange={(e) => setAssignStartDate(e.target.value)}
                  fullWidth
                  required
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  type="date"
                  label="End Date"
                  value={assignEndDate}
                  onChange={(e) => setAssignEndDate(e.target.value)}
                  fullWidth
                  required
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
            </Grid>

            {selectedPatternId && assignStartDate && assignEndDate && (
              <Alert severity="info" variant="outlined">
                This will create assignments for <strong>{assigningTeam?.memberIds?.length || 0}</strong> team members
                from <strong>{assignStartDate}</strong> to <strong>{assignEndDate}</strong> on days
                when the shift pattern is active.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, bgcolor: 'action.hover' }}>
          <Button onClick={() => setShowAssignModal(false)} disabled={assigning}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkAssign}
            variant="contained"
            color="secondary"
            disabled={assigning || !selectedProjectId || !selectedPatternId || !assignStartDate || !assignEndDate}
            startIcon={assigning ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {assigning ? 'Assigning...' : 'Assign Team'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
