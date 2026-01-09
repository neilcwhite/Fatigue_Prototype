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
import { ChevronLeft, Plus, Edit2, Trash2, Users, Calendar, X, Upload } from '@/components/ui/Icons';
import type { TeamCamel, EmployeeCamel, ProjectCamel, ShiftPatternCamel, AssignmentCamel, SupabaseUser, Employee, CSVImportRow } from '@/lib/types';
import { useNotification } from '@/hooks/useNotification';
import { CSVImportModal } from '@/components/admin/CSVImportModal';

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
  onCreateEmployee: (data: {
    name: string;
    role?: string;
    sentinelNumber?: string;
    primarySponsor?: string;
    subSponsors?: string;
    currentEmployer?: string;
  }) => Promise<void>;
}

export function TeamsView({
  user,
  onSignOut,
  onBack,
  teams,
  employees,
  projects,
  shiftPatterns,
  onCreateTeam,
  onUpdateTeam,
  onDeleteTeam,
  onCreateAssignment,
  onCreateEmployee,
}: TeamsViewProps) {
  const { showSuccess, showError, showWarning } = useNotification();
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

  // Add Employee modal state
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState('');
  const [creatingEmployee, setCreatingEmployee] = useState(false);

  // CSV Import modal state
  const [showCSVImportModal, setShowCSVImportModal] = useState(false);

  // Convert EmployeeCamel to Employee for CSV import modal
  const employeesForImport: Employee[] = employees.map(emp => ({
    id: emp.id,
    name: emp.name,
    role: emp.role,
    email: emp.email,
    sentinel_number: emp.sentinelNumber,
    team_id: emp.teamId,
    organisation_id: emp.organisationId,
  }));

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
      showWarning('Please enter a team name');
      return;
    }

    try {
      if (editingTeam) {
        await onUpdateTeam(editingTeam.id, { name: teamName, memberIds: selectedMembers });
        showSuccess('Team updated successfully');
      } else {
        await onCreateTeam(teamName, selectedMembers);
        showSuccess('Team created successfully');
      }
      setShowModal(false);
    } catch (err) {
      console.error('Error saving team:', err);
      showError('Failed to save team');
    }
  };

  const handleDelete = async (team: TeamCamel) => {
    if (confirm(`Delete team "${team.name}"?`)) {
      try {
        await onDeleteTeam(team.id);
        showSuccess('Team deleted');
      } catch (err) {
        console.error('Error deleting team:', err);
        showError('Failed to delete team');
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

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployeeName.trim()) {
      showWarning('Please enter an employee name');
      return;
    }

    setCreatingEmployee(true);
    try {
      await onCreateEmployee({
        name: newEmployeeName.trim(),
        role: newEmployeeRole.trim() || undefined,
      });
      showSuccess('Employee created successfully');
      setShowEmployeeModal(false);
      setNewEmployeeName('');
      setNewEmployeeRole('');
    } catch (err) {
      console.error('Error creating employee:', err);
      showError('Failed to create employee');
    } finally {
      setCreatingEmployee(false);
    }
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

  const handleCSVImport = async (rows: CSVImportRow[]) => {
    try {
      for (const row of rows) {
        const fullName = `${row.first_name} ${row.last_name}`;
        await onCreateEmployee({
          name: fullName,
          role: row.role,
          sentinelNumber: row.sentinel_number,
          primarySponsor: row.primary_sponsor,
          subSponsors: row.sub_sponsors,
          currentEmployer: row.current_employer,
        });
      }
      showSuccess(`Successfully imported ${rows.length} employee${rows.length === 1 ? '' : 's'}`);
      setShowCSVImportModal(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import employees';
      showError(message);
      throw err; // Re-throw so modal can handle it
    }
  };

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

      showSuccess(`Created ${created} assignments for ${memberIds.length} team members over ${dates.length} days`);
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
          borderBottom: '4px solid #22c55e',
        }}
      >
        <Toolbar sx={{ px: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            <Box component="span" sx={{ color: '#22c55e' }}>Team</Box>
            {' '}
            <Box component="span" sx={{ color: 'white' }}>Management</Box>
          </Typography>
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'grey.400' }}>{user?.email}</Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={onSignOut}
              sx={{
                color: '#22c55e',
                borderColor: 'rgba(34, 197, 94, 0.3)',
                '&:hover': {
                  borderColor: '#22c55e',
                  bgcolor: 'rgba(34, 197, 94, 0.1)',
                },
              }}
            >
              Sign Out
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Content */}
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" fontWeight={700}>Teams & Employees</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage employees and create teams for bulk shift assignment
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowEmployeeModal(true)}
              sx={{
                color: '#22c55e',
                borderColor: '#22c55e',
                '&:hover': {
                  borderColor: '#16a34a',
                  bgcolor: 'rgba(34, 197, 94, 0.1)',
                },
              }}
            >
              Add Employee
            </Button>
            <Button
              variant="outlined"
              startIcon={<Upload className="w-4 h-4" />}
              onClick={() => setShowCSVImportModal(true)}
              sx={{
                color: '#22c55e',
                borderColor: '#22c55e',
                '&:hover': {
                  borderColor: '#16a34a',
                  bgcolor: 'rgba(34, 197, 94, 0.1)',
                },
              }}
            >
              Import CSV
            </Button>
            <Button
              variant="contained"
              startIcon={<Plus className="w-4 h-4" />}
              onClick={openCreateModal}
              sx={{
                bgcolor: '#22c55e',
                '&:hover': {
                  bgcolor: '#16a34a',
                },
              }}
            >
              Create Team
            </Button>
          </Box>
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
            <Button
              variant="contained"
              onClick={openCreateModal}
              sx={{
                bgcolor: '#22c55e',
                '&:hover': {
                  bgcolor: '#16a34a',
                },
              }}
            >
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
                        fullWidth
                        startIcon={<Calendar className="w-4 h-4" />}
                        onClick={() => openAssignModal(team)}
                        disabled={teamMembers.length === 0 || projects.length === 0}
                        sx={{
                          bgcolor: '#22c55e',
                          '&:hover': {
                            bgcolor: '#16a34a',
                          },
                        }}
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
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  border: '2px dashed',
                  borderColor: '#22c55e',
                  '&:hover': { borderColor: '#16a34a' },
                }}
              >
                <Box sx={{ bgcolor: '#22c55e', borderRadius: '50%', p: 1.5, mb: 1.5 }}>
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
              {projects.filter(p => !p.archived).map(p => (
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

      {/* Add Employee Modal */}
      <Dialog open={showEmployeeModal} onClose={() => setShowEmployeeModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Employee</DialogTitle>
        <form onSubmit={handleCreateEmployee}>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Name"
                value={newEmployeeName}
                onChange={(e) => setNewEmployeeName(e.target.value)}
                placeholder="e.g., John Smith"
                fullWidth
                required
                autoFocus
              />
              <TextField
                label="Role (optional)"
                value={newEmployeeRole}
                onChange={(e) => setNewEmployeeRole(e.target.value)}
                placeholder="e.g., Track Engineer"
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setShowEmployeeModal(false)} disabled={creatingEmployee}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={creatingEmployee || !newEmployeeName.trim()}
              startIcon={creatingEmployee ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {creatingEmployee ? 'Adding...' : 'Add Employee'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* CSV Import Modal */}
      <CSVImportModal
        open={showCSVImportModal}
        onClose={() => setShowCSVImportModal(false)}
        existingEmployees={employeesForImport}
        onImport={handleCSVImport}
      />
    </Box>
  );
}
