'use client';

import { useState, useEffect } from 'react';
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
import { ChevronLeft, Plus, Edit2, Trash2, Users, Calendar, X, Upload, Settings } from '@/components/ui/Icons';
import type { TeamCamel, EmployeeCamel, ProjectCamel, ShiftPatternCamel, AssignmentCamel, SupabaseUser, Employee, CSVImportRow } from '@/lib/types';
import { useNotification } from '@/hooks/useNotification';
import { CSVImportModal } from '@/components/admin/CSVImportModal';
import { toTitleCase } from '@/lib/utils';
import { DEFAULT_FATIGUE_PARAMS } from '@/lib/fatigue';

interface TeamsViewProps {
  user: SupabaseUser;
  onSignOut: () => void;
  onBack: () => void;
  onNavigateToShiftBuilder?: (teamId: number, teamName: string) => void;
  newlyCreatedPatternId?: string | null;
  pendingTeamAssignment?: { teamId: number; teamName: string } | null;
  onClearPendingAssignment?: () => void;
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
  onNavigateToShiftBuilder,
  newlyCreatedPatternId,
  pendingTeamAssignment,
  onClearPendingAssignment,
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
  const [searchQuery, setSearchQuery] = useState('');

  // Assignment modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningTeam, setAssigningTeam] = useState<TeamCamel | null>(null);
  const [assignmentWorkflow, setAssignmentWorkflow] = useState<'select' | 'existing' | 'oneoff' | 'create'>('select');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [assignStartDate, setAssignStartDate] = useState('');
  const [assignEndDate, setAssignEndDate] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Day of week selection for one-off shifts
  const [selectedDays, setSelectedDays] = useState<boolean[]>([true, true, true, true, true, true, true]); // Sun-Sat

  // Custom times state for assignment modal
  const [useCustomTimes, setUseCustomTimes] = useState(false);
  const [customStartTime, setCustomStartTime] = useState('07:00');
  const [customEndTime, setCustomEndTime] = useState('19:00');

  // Fatigue parameters state for assignment modal
  const [commuteIn, setCommuteIn] = useState<number | ''>('');
  const [commuteOut, setCommuteOut] = useState<number | ''>('');
  const [workload, setWorkload] = useState<number | ''>('');
  const [attention, setAttention] = useState<number | ''>('');
  const [breakFrequency, setBreakFrequency] = useState<number | ''>('');
  const [breakLength, setBreakLength] = useState<number | ''>('');
  const [continuousWork, setContinuousWork] = useState<number | ''>('');
  const [breakAfterContinuous, setBreakAfterContinuous] = useState<number | ''>('');

  // Special value for "enter custom times" option
  const CUSTOM_PATTERN_VALUE = '__CUSTOM__';
  const isCustomTimesMode = selectedPatternId === CUSTOM_PATTERN_VALUE;

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

  // Handle return from Shift Builder with newly created pattern
  useEffect(() => {
    if (pendingTeamAssignment && newlyCreatedPatternId) {
      // Find the team
      const team = teams.find(t => t.id === pendingTeamAssignment.teamId);
      if (team) {
        // Reopen assignment modal with the team
        setAssigningTeam(team);
        setShowAssignModal(true);
        // Pre-select the newly created pattern
        setSelectedPatternId(newlyCreatedPatternId);
        setAssignmentWorkflow('existing'); // Set to 'existing' workflow
        // Clear the pending state
        if (onClearPendingAssignment) {
          onClearPendingAssignment();
        }
      }
    }
  }, [pendingTeamAssignment, newlyCreatedPatternId, teams, onClearPendingAssignment]);

  const openCreateModal = () => {
    setEditingTeam(null);
    setTeamName('');
    setSelectedMembers([]);
    setSearchQuery('');
    setShowModal(true);
  };

  const openEditModal = (team: TeamCamel) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setSelectedMembers(team.memberIds || []);
    setSearchQuery('');
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

  const addMember = (employeeId: number) => {
    if (!selectedMembers.includes(employeeId)) {
      setSelectedMembers(prev => [...prev, employeeId]);
    }
  };

  const removeMember = (employeeId: number) => {
    setSelectedMembers(prev => prev.filter(id => id !== employeeId));
  };

  // Filter available employees (not in team, matching search)
  const availableEmployees = employees.filter(emp => {
    const notInTeam = !selectedMembers.includes(emp.id);
    const matchesSearch = searchQuery.trim() === '' ||
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.role && emp.role.toLowerCase().includes(searchQuery.toLowerCase()));
    return notInTeam && matchesSearch;
  });

  // Get team members
  const teamMembers = employees.filter(emp => selectedMembers.includes(emp.id));

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
    setAssignmentWorkflow('select');
    setSelectedProjectId(projects.length > 0 ? projects[0].id : null);
    setSelectedPatternId(null);
    setAssignStartDate('');
    setAssignEndDate('');
    setAssignError(null);
    setSelectedDays([true, true, true, true, true, true, true]);
    setUseCustomTimes(false);
    setCustomStartTime('07:00');
    setCustomEndTime('19:00');
    setCommuteIn('');
    setCommuteOut('');
    setWorkload('');
    setAttention('');
    setBreakFrequency('');
    setBreakLength('');
    setContinuousWork('');
    setBreakAfterContinuous('');
    setShowAssignModal(true);
  };

  const projectPatterns = selectedProjectId
    ? shiftPatterns.filter(sp => sp.projectId === selectedProjectId)
    : [];

  // Find a "Custom" pattern for the selected project (to use when entering custom times)
  const customPatternForProject = selectedProjectId
    ? shiftPatterns.find(
        p => p.projectId === selectedProjectId && p.name.toLowerCase().startsWith('custom')
      )
    : null;

  const availablePatterns = projectPatterns;

  const selectedPattern = isCustomTimesMode ? null : shiftPatterns.find(p => p.id === selectedPatternId);
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // Get the pattern to use for defaults (works in both normal and custom mode)
  const patternForDefaults = selectedPattern || (isCustomTimesMode ? (customPatternForProject || availablePatterns[0]) : null);

  // Handler to apply pattern defaults to fatigue parameters
  const handleApplyPatternDefaults = () => {
    if (!patternForDefaults) return;

    // Apply commute defaults (or use system default if pattern doesn't have it)
    const commuteTime = patternForDefaults.commuteTime ?? DEFAULT_FATIGUE_PARAMS.commuteTime;
    setCommuteIn(Math.floor(commuteTime / 2));
    setCommuteOut(Math.ceil(commuteTime / 2));

    // Apply other defaults (use system defaults if pattern doesn't have them)
    setWorkload(patternForDefaults.workload ?? DEFAULT_FATIGUE_PARAMS.workload);
    setAttention(patternForDefaults.attention ?? DEFAULT_FATIGUE_PARAMS.attention);
    setBreakFrequency(patternForDefaults.breakFrequency ?? DEFAULT_FATIGUE_PARAMS.breakFrequency);
    setBreakLength(patternForDefaults.breakLength ?? DEFAULT_FATIGUE_PARAMS.breakLength);
    setContinuousWork(patternForDefaults.continuousWork ?? DEFAULT_FATIGUE_PARAMS.continuousWork);
    setBreakAfterContinuous(patternForDefaults.breakAfterContinuous ?? DEFAULT_FATIGUE_PARAMS.breakAfterContinuous);
  };

  const handleProjectChange = (projectId: number) => {
    setSelectedProjectId(projectId);
    setSelectedPatternId(null); // Reset pattern when project changes
    setAssignError(null);
  };

  const handlePatternChange = (patternId: string) => {
    setSelectedPatternId(patternId);
    setAssignError(null);
    // Reset custom times when pattern changes
    if (patternId !== CUSTOM_PATTERN_VALUE) {
      setUseCustomTimes(false);
    }
  };

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
    if (!assigningTeam || !selectedProjectId || !assignStartDate || !assignEndDate) {
      setAssignError('Please fill in all required fields');
      return;
    }

    // Validate pattern selection
    if (isCustomTimesMode) {
      if (!customStartTime || !customEndTime) {
        setAssignError('Please enter both start and end times');
        return;
      }
      if (availablePatterns.length === 0) {
        setAssignError('No shift patterns exist for this project. Please create one first in the Planning view.');
        return;
      }
    } else if (!selectedPatternId) {
      setAssignError('Please select a shift pattern');
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

    // Determine which pattern ID to use
    const patternIdToUse = isCustomTimesMode
      ? (customPatternForProject?.id || availablePatterns[0]?.id)
      : selectedPatternId;

    const pattern = shiftPatterns.find(sp => sp.id === patternIdToUse);
    if (!pattern) {
      setAssignError('Shift pattern not found');
      return;
    }

    setAssigning(true);
    setAssignError(null);

    try {
      // Build list of dates based on workflow and pattern schedule
      const dates: string[] = [];
      const current = new Date(start);

      if (assignmentWorkflow === 'oneoff') {
        // One-off custom shift: use selected days of week
        while (current <= end) {
          const dayOfWeek = current.getDay(); // 0 = Sunday
          if (selectedDays[dayOfWeek]) {
            dates.push(current.toISOString().split('T')[0]);
          }
          current.setDate(current.getDate() + 1);
        }
      } else if (isCustomTimesMode || useCustomTimes) {
        // Custom times mode: include all dates in range
        while (current <= end) {
          dates.push(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
        }
      } else {
        // Existing pattern: use pattern's weekly schedule
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
      }

      if (dates.length === 0) {
        setAssignError('No active days in the selected date range for this shift pattern');
        setAssigning(false);
        return;
      }

      // Determine if we need custom times
      const needsCustomTimes = isCustomTimesMode || useCustomTimes;

      let created = 0;
      let skipped = 0;

      for (const employeeId of memberIds) {
        for (const date of dates) {
          try {
            await onCreateAssignment({
              employeeId,
              projectId: selectedProjectId,
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
              continuousWork: continuousWork !== '' ? continuousWork : undefined,
              breakAfterContinuous: breakAfterContinuous !== '' ? breakAfterContinuous : undefined,
            });
            created++;
          } catch (err) {
            // If assignment already exists, skip it silently (user requested this)
            if (err instanceof Error && err.message.includes('already assigned')) {
              skipped++;
            } else {
              throw err; // Re-throw other errors
            }
          }
        }
      }

      const message = skipped > 0
        ? `Created ${created} assignments (skipped ${skipped} duplicate${skipped !== 1 ? 's' : ''}) for ${memberIds.length} team members over ${dates.length} days`
        : `Created ${created} assignments for ${memberIds.length} team members over ${dates.length} days`;

      showSuccess(message);
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

      {/* Create/Edit Team Modal - Drag & Drop Interface */}
      <Dialog open={showModal} onClose={() => setShowModal(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingTeam ? 'Edit Team' : 'Create Team'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                label="Team Name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g., C2*** - Night Shift Team A"
                fullWidth
                required
                helperText="Include project number (e.g., C2***) to help identify teams"
              />

              <Box sx={{ display: 'flex', gap: 2, height: 400 }}>
                {/* Available Employees Panel */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    Available Employees ({availableEmployees.length})
                  </Typography>

                  <TextField
                    placeholder="Search employees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    size="small"
                    fullWidth
                  />

                  <Paper
                    variant="outlined"
                    sx={{
                      flex: 1,
                      overflow: 'auto',
                      bgcolor: 'grey.50',
                    }}
                  >
                    {availableEmployees.length === 0 ? (
                      <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                          {searchQuery ? 'No employees match your search' : 'No employees available'}
                        </Typography>
                      </Box>
                    ) : (
                      <List dense sx={{ p: 1 }}>
                        {availableEmployees.map(emp => (
                          <ListItem
                            key={emp.id}
                            sx={{
                              mb: 0.5,
                              bgcolor: 'white',
                              border: 1,
                              borderColor: 'grey.300',
                              borderRadius: 1,
                              cursor: 'pointer',
                              '&:hover': {
                                bgcolor: 'primary.50',
                                borderColor: 'primary.300',
                              },
                            }}
                            onClick={() => addMember(emp.id)}
                          >
                            <ListItemText
                              primary={toTitleCase(emp.name)}
                              secondary={emp.role || 'No role assigned'}
                              primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
                              secondaryTypographyProps={{ fontSize: '0.75rem' }}
                            />
                            <Plus className="w-4 h-4 text-green-600" />
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Paper>
                </Box>

                {/* Team Members Panel */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    Team Members ({teamMembers.length})
                  </Typography>

                  <Paper
                    variant="outlined"
                    sx={{
                      flex: 1,
                      overflow: 'auto',
                      bgcolor: 'success.50',
                      borderColor: 'success.300',
                      mt: 4.5, // Align with available list (after search box)
                    }}
                  >
                    {teamMembers.length === 0 ? (
                      <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                          Click employees from the left to add them to this team
                        </Typography>
                      </Box>
                    ) : (
                      <List dense sx={{ p: 1 }}>
                        {teamMembers.map(emp => (
                          <ListItem
                            key={emp.id}
                            sx={{
                              mb: 0.5,
                              bgcolor: 'white',
                              border: 1,
                              borderColor: 'success.300',
                              borderRadius: 1,
                              cursor: 'pointer',
                              '&:hover': {
                                bgcolor: 'error.50',
                                borderColor: 'error.300',
                              },
                            }}
                            onClick={() => removeMember(emp.id)}
                          >
                            <ListItemText
                              primary={toTitleCase(emp.name)}
                              secondary={emp.role || 'No role assigned'}
                              primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
                              secondaryTypographyProps={{ fontSize: '0.75rem' }}
                            />
                            <X className="w-4 h-4 text-red-600" />
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Paper>
                </Box>
              </Box>

              <Alert severity="info" sx={{ py: 0.5 }}>
                <Typography variant="caption">
                  Click an employee from the left panel to add them to the team. Click a team member on the right to remove them.
                  Employees can be in multiple teams.
                </Typography>
              </Alert>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setShowModal(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              sx={{
                bgcolor: '#22c55e',
                '&:hover': {
                  bgcolor: '#16a34a',
                },
              }}
            >
              {editingTeam ? 'Save Changes' : 'Create Team'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Assignment Modal - Full AddShiftModal Experience */}
      <Dialog open={showAssignModal} onClose={() => setShowAssignModal(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h6" fontWeight={600}>
              Assign Team to Shift Pattern
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Assigning: <strong>{assigningTeam?.name}</strong> ({assigningTeam?.memberIds?.length || 0} members)
            </Typography>
          </Box>
          <IconButton onClick={() => setShowAssignModal(false)} size="small">
            <X className="w-5 h-5" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Team Info */}
            <Alert severity="info" sx={{ py: 0.5 }}>
              <Typography variant="body2">
                Team assignments for <strong>{assigningTeam?.name}</strong> ({assigningTeam?.memberIds?.length || 0} members)
              </Typography>
            </Alert>

            {assignError && (
              <Alert severity="error" sx={{ py: 0.5 }}>
                {assignError}
              </Alert>
            )}

            {/* WORKFLOW SELECTION - Step 1 */}
            {assignmentWorkflow === 'select' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 2 }}>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                  How would you like to assign this team?
                </Typography>

                {/* Option 1: Use Existing Pattern */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    border: 2,
                    borderColor: 'divider',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'action.hover',
                    },
                  }}
                  onClick={() => setAssignmentWorkflow('existing')}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Box sx={{ mt: 0.5 }}>
                      <Calendar className="w-6 h-6 text-green-600" />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        Use Existing Pattern
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Quick assignment using a saved shift pattern with all times and parameters already configured
                      </Typography>
                    </Box>
                  </Box>
                </Paper>

                {/* Option 2: One-Off Custom Shift */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    border: 2,
                    borderColor: 'divider',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'action.hover',
                    },
                  }}
                  onClick={() => {
                    setAssignmentWorkflow('oneoff');
                    setSelectedPatternId(CUSTOM_PATTERN_VALUE);
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Box sx={{ mt: 0.5 }}>
                      <Plus className="w-6 h-6 text-blue-600" />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        One-Off Custom Shift
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Define custom times and select specific days of the week (not saved as a pattern)
                      </Typography>
                    </Box>
                  </Box>
                </Paper>

                {/* Option 3: Create New Pattern First */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    border: 2,
                    borderColor: 'divider',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'action.hover',
                    },
                  }}
                  onClick={() => setAssignmentWorkflow('create')}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Box sx={{ mt: 0.5 }}>
                      <Settings className="w-6 h-6 text-purple-600" />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        Create New Pattern First
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Build a reusable shift pattern in Shift Builder with full configuration options
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Box>
            )}

            {/* CREATE NEW PATTERN WORKFLOW - Navigate to Shift Builder */}
            {assignmentWorkflow === 'create' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 2 }}>
                <Alert severity="info">
                  <Typography variant="body2" fontWeight={600} gutterBottom>
                    Create Pattern in Shift Builder
                  </Typography>
                  <Typography variant="body2">
                    Click the button below to open Shift Builder where you can create a fully configured shift pattern.
                    After creating the pattern, return to Team Management to assign this team.
                  </Typography>
                </Alert>

                {onNavigateToShiftBuilder ? (
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => {
                      if (assigningTeam) {
                        onNavigateToShiftBuilder(assigningTeam.id, assigningTeam.name);
                        setShowAssignModal(false);
                      }
                    }}
                    startIcon={<Settings className="w-5 h-5" />}
                    sx={{
                      bgcolor: '#16a34a',
                      '&:hover': { bgcolor: '#15803d' },
                    }}
                  >
                    Open Shift Builder
                  </Button>
                ) : (
                  <Alert severity="warning">
                    <Typography variant="body2">
                      Navigation to Shift Builder not configured. Please contact your administrator.
                    </Typography>
                  </Alert>
                )}

                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setAssignmentWorkflow('select')}
                  startIcon={<ChevronLeft className="w-4 h-4" />}
                >
                  Back to Options
                </Button>
              </Box>
            )}

            {/* EXISTING PATTERN & ONE-OFF WORKFLOWS - Main Assignment UI */}
            {(assignmentWorkflow === 'existing' || assignmentWorkflow === 'oneoff') && (
              <>
                {/* Back Button */}
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    setAssignmentWorkflow('select');
                    setSelectedPatternId(null);
                  }}
                  startIcon={<ChevronLeft className="w-4 h-4" />}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Change Workflow
                </Button>

                {/* Project Selection */}
            <TextField
              select
              label="Project"
              value={selectedProjectId || ''}
              onChange={(e) => handleProjectChange(Number(e.target.value))}
              fullWidth
              required
            >
              <MenuItem value="">Select a project...</MenuItem>
              {projects.filter(p => !p.archived).map(p => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </TextField>

            {/* Shift Pattern Selection with Custom Times Option */}
            <TextField
              select
              label="Shift Pattern"
              value={selectedPatternId || ''}
              onChange={(e) => handlePatternChange(e.target.value)}
              fullWidth
              required
              disabled={!selectedProjectId}
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
            </TextField>

            {selectedProjectId && projectPatterns.length === 0 && (
              <Alert severity="warning" variant="outlined">
                No shift patterns defined for this project. Create one in Planning view first.
              </Alert>
            )}

            {/* Custom Times Mode - time inputs shown immediately */}
            {isCustomTimesMode && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Alert severity="info" sx={{ py: 0.5 }}>
                  <Typography variant="caption">
                    {assignmentWorkflow === 'oneoff'
                      ? 'Define custom shift times and select which days of the week to work.'
                      : 'Enter custom start and end times for these shifts.'}
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

                {/* Day of Week Selector - Only for One-Off Workflow */}
                {assignmentWorkflow === 'oneoff' && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Select Days of Week
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                      Choose which days this shift should repeat within the date range
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                        <Chip
                          key={day}
                          label={day}
                          onClick={() => {
                            const newDays = [...selectedDays];
                            newDays[index] = !newDays[index];
                            setSelectedDays(newDays);
                          }}
                          color={selectedDays[index] ? 'primary' : 'default'}
                          variant={selectedDays[index] ? 'filled' : 'outlined'}
                          sx={{
                            cursor: 'pointer',
                            minWidth: 60,
                            fontWeight: selectedDays[index] ? 600 : 400,
                          }}
                        />
                      ))}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setSelectedDays([true, true, true, true, true, true, true])}
                      >
                        Select All
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setSelectedDays([false, false, true, true, true, true, true])}
                      >
                        Weekdays Only
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setSelectedDays([true, true, false, false, false, false, false])}
                      >
                        Weekends Only
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setSelectedDays([false, false, false, false, false, false, false])}
                      >
                        Clear All
                      </Button>
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            {/* Date Range Selection */}
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

            {/* Fatigue Parameters - shown when pattern is selected OR in custom mode */}
            {(selectedPatternId || isCustomTimesMode) && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Fatigue Parameters (Optional Overrides)
                  </Typography>
                  {patternForDefaults && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleApplyPatternDefaults}
                    >
                      Apply Pattern Defaults
                    </Button>
                  )}
                </Box>

                {/* Show pattern defaults info */}
                {patternForDefaults && (
                  <Alert severity="info" sx={{ py: 0.5 }}>
                    <Typography variant="caption" fontWeight={600}>
                      Pattern Defaults from "{patternForDefaults.name}":
                    </Typography>
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      Commute: {Math.floor((patternForDefaults.commuteTime ?? DEFAULT_FATIGUE_PARAMS.commuteTime) / 2)}min in, {Math.ceil((patternForDefaults.commuteTime ?? DEFAULT_FATIGUE_PARAMS.commuteTime) / 2)}min out •{' '}
                      Workload: {patternForDefaults.workload ?? DEFAULT_FATIGUE_PARAMS.workload} •{' '}
                      Attention: {patternForDefaults.attention ?? DEFAULT_FATIGUE_PARAMS.attention}
                      <br />
                      Break Frequency: {patternForDefaults.breakFrequency ?? DEFAULT_FATIGUE_PARAMS.breakFrequency}min •{' '}
                      Break Length: {patternForDefaults.breakLength ?? DEFAULT_FATIGUE_PARAMS.breakLength}min •{' '}
                      Continuous Work: {patternForDefaults.continuousWork ?? DEFAULT_FATIGUE_PARAMS.continuousWork}min •{' '}
                      Break After: {patternForDefaults.breakAfterContinuous ?? DEFAULT_FATIGUE_PARAMS.breakAfterContinuous}min
                    </Typography>
                  </Alert>
                )}

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

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="Continuous Work (mins)"
                    type="number"
                    value={continuousWork}
                    onChange={(e) => setContinuousWork(e.target.value === '' ? '' : Number(e.target.value))}
                    fullWidth
                    slotProps={{ htmlInput: { min: 30, max: 720 } }}
                    helperText="Max continuous work time"
                  />
                  <TextField
                    label="Break After Continuous (mins)"
                    type="number"
                    value={breakAfterContinuous}
                    onChange={(e) => setBreakAfterContinuous(e.target.value === '' ? '' : Number(e.target.value))}
                    fullWidth
                    slotProps={{ htmlInput: { min: 5, max: 120 } }}
                    helperText="Rest after continuous work"
                  />
                </Box>
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

            {/* Summary Info */}
            {selectedPatternId && assignStartDate && assignEndDate && (
              <Alert severity="info" variant="outlined">
                <Typography variant="body2">
                  This will create assignments for <strong>{assigningTeam?.memberIds?.length || 0}</strong> team members
                  from <strong>{assignStartDate}</strong> to <strong>{assignEndDate}</strong>{' '}
                  {assignmentWorkflow === 'oneoff'
                    ? 'on selected days of the week'
                    : isCustomTimesMode || useCustomTimes
                    ? 'on all days in range'
                    : 'on days when the shift pattern is active'}.
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  Employees already assigned individually will be skipped automatically.
                </Typography>
              </Alert>
            )}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setShowAssignModal(false)} disabled={assigning}>
            {assignmentWorkflow === 'select' || assignmentWorkflow === 'create' ? 'Close' : 'Cancel'}
          </Button>
          {(assignmentWorkflow === 'existing' || assignmentWorkflow === 'oneoff') && (
            <Button
              onClick={handleBulkAssign}
              variant="contained"
              sx={{
                bgcolor: '#22c55e',
                '&:hover': {
                  bgcolor: '#16a34a',
                },
              }}
              disabled={
                assigning ||
                !selectedProjectId ||
                !selectedPatternId ||
                !assignStartDate ||
                !assignEndDate ||
                (isCustomTimesMode && availablePatterns.length === 0) ||
                (assignmentWorkflow === 'oneoff' && !selectedDays.some(d => d))
              }
              startIcon={assigning ? <CircularProgress size={16} color="inherit" /> : <Calendar className="w-4 h-4" />}
            >
              {assigning ? 'Assigning...' : 'Assign Team'}
            </Button>
          )}
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
