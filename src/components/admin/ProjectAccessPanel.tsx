'use client';

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Autocomplete from '@mui/material/Autocomplete';
import { Search, Plus, Trash2, Users } from '@/components/ui/Icons';
import { formatProjectRoleLabel } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import type { ProjectCamel, ProjectMemberCamel, ProjectMemberRole, UserProfile } from '@/lib/types';

interface ProjectAccessPanelProps {
  projects: ProjectCamel[];
  organisationId: string;
  addProjectMember: (projectId: number, userId: string, role: ProjectMemberRole) => Promise<void>;
  updateProjectMemberRole: (projectId: number, userId: string, role: ProjectMemberRole) => Promise<void>;
  removeProjectMember: (projectId: number, userId: string) => Promise<void>;
  getProjectMembers: (projectId: number) => Promise<ProjectMemberCamel[]>;
}

interface OrgUser {
  id: string;
  email: string;
  fullName?: string;
  role: string;
}

export function ProjectAccessPanel({
  projects,
  organisationId,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  getProjectMembers,
}: ProjectAccessPanelProps) {
  const [selectedProject, setSelectedProject] = useState<ProjectCamel | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMemberCamel[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState<string>('');
  const [newMemberRole, setNewMemberRole] = useState<ProjectMemberRole>('viewer');
  const [error, setError] = useState<string | null>(null);

  // Load organisation users (for adding to projects)
  useEffect(() => {
    const loadOrgUsers = async () => {
      if (!supabase || !organisationId) return;

      const { data, error: err } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('organisation_id', organisationId);

      if (err) {
        console.error('Failed to load org users:', err);
        return;
      }

      setOrgUsers((data || []).map(u => ({
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        role: u.role,
      })));
    };

    loadOrgUsers();
  }, [organisationId]);

  // Load project members when a project is selected
  const loadProjectMembers = useCallback(async (projectId: number) => {
    setLoading(true);
    setError(null);
    try {
      const members = await getProjectMembers(projectId);
      setProjectMembers(members);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project members');
      setProjectMembers([]);
    } finally {
      setLoading(false);
    }
  }, [getProjectMembers]);

  useEffect(() => {
    if (selectedProject) {
      loadProjectMembers(selectedProject.id);
    } else {
      setProjectMembers([]);
    }
  }, [selectedProject, loadProjectMembers]);

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) && !p.archived
  );

  const handleAddMember = async () => {
    if (!selectedProject || !newMemberUserId) return;

    setLoading(true);
    setError(null);
    try {
      await addProjectMember(selectedProject.id, newMemberUserId, newMemberRole);
      await loadProjectMembers(selectedProject.id);
      setShowAddMemberDialog(false);
      setNewMemberUserId('');
      setNewMemberRole('viewer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedProject) return;

    setLoading(true);
    setError(null);
    try {
      await removeProjectMember(selectedProject.id, userId);
      await loadProjectMembers(selectedProject.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, role: ProjectMemberRole) => {
    if (!selectedProject) return;

    setLoading(true);
    setError(null);
    try {
      await updateProjectMemberRole(selectedProject.id, userId, role);
      await loadProjectMembers(selectedProject.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setLoading(false);
    }
  };

  // Get users who are not already members of the selected project
  const availableUsers = orgUsers.filter(
    u => !projectMembers.some(pm => pm.userId === u.id)
  );

  // Get user info from org users
  const getUserInfo = (userId: string): OrgUser | undefined => {
    return orgUsers.find(u => u.id === userId);
  };

  return (
    <Box sx={{ display: 'flex', gap: 3, height: 'calc(100vh - 200px)' }}>
      {/* Project List */}
      <Box sx={{ width: 320, flexShrink: 0 }}>
        <TextField
          placeholder="Search projects..."
          size="small"
          fullWidth
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search className="w-4 h-4" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />
        <Box sx={{ overflowY: 'auto', maxHeight: 'calc(100% - 56px)' }}>
          {filteredProjects.map((project) => (
            <Card
              key={project.id}
              onClick={() => setSelectedProject(project)}
              sx={{
                mb: 1,
                cursor: 'pointer',
                border: selectedProject?.id === project.id ? '2px solid #22c55e' : '1px solid transparent',
                bgcolor: selectedProject?.id === project.id ? 'rgba(34, 197, 94, 0.08)' : 'background.paper',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {project.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {project.startDate ? `Started: ${new Date(project.startDate).toLocaleDateString()}` : 'No start date'}
                </Typography>
              </CardContent>
            </Card>
          ))}
          {filteredProjects.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No projects found
            </Typography>
          )}
        </Box>
      </Box>

      {/* Project Members Panel */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedProject ? (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight={600}>
                  {selectedProject.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Manage who can access this project
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<Plus className="w-4 h-4" />}
                onClick={() => setShowAddMemberDialog(true)}
                sx={{
                  bgcolor: '#22c55e',
                  '&:hover': { bgcolor: '#16a34a' },
                }}
              >
                Add Member
              </Button>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <TableContainer component={Paper} variant="outlined" sx={{ flex: 1 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>System Role</TableCell>
                    <TableCell>Project Role</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading && projectMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        <CircularProgress size={24} />
                      </TableCell>
                    </TableRow>
                  ) : projectMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                          <Typography color="text.secondary">
                            No members assigned to this project yet
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Only users with viewer, editor, or manager role can access this project
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    projectMembers.map((member) => {
                      const userInfo = getUserInfo(member.userId);
                      return (
                        <TableRow key={member.id}>
                          <TableCell>
                            <Typography variant="body2">
                              {userInfo?.fullName || 'Unknown User'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {userInfo?.email || member.userId}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={userInfo?.role || 'user'}
                              size="small"
                              color={userInfo?.role === 'admin' || userInfo?.role === 'super_admin' ? 'primary' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={member.memberRole}
                              size="small"
                              onChange={(e) => handleUpdateRole(member.userId, e.target.value as ProjectMemberRole)}
                              sx={{ minWidth: 120 }}
                            >
                              <MenuItem value="viewer">Viewer</MenuItem>
                              <MenuItem value="editor">Editor</MenuItem>
                              <MenuItem value="manager">Manager</MenuItem>
                            </Select>
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={() => handleRemoveMember(member.userId)}
                              sx={{ color: 'error.main' }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Help text */}
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Project Role Permissions
              </Typography>
              <Box sx={{ display: 'flex', gap: 3 }}>
                <Box>
                  <Typography variant="caption" fontWeight={600} color="text.secondary">Viewer</Typography>
                  <Typography variant="caption" component="p" color="text.secondary">
                    Can view project data and schedules
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" fontWeight={600} color="text.secondary">Editor</Typography>
                  <Typography variant="caption" component="p" color="text.secondary">
                    Can edit shifts and assignments
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" fontWeight={600} color="text.secondary">Manager</Typography>
                  <Typography variant="caption" component="p" color="text.secondary">
                    Can manage project members
                  </Typography>
                </Box>
              </Box>
            </Box>
          </>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Users className="w-16 h-16 mx-auto mb-3 text-slate-300" />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Select a Project
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Choose a project from the list to manage access permissions
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Add Member Dialog */}
      <Dialog open={showAddMemberDialog} onClose={() => setShowAddMemberDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Project Member</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Autocomplete
              options={availableUsers}
              getOptionLabel={(option) => option.fullName || option.email}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box>
                    <Typography variant="body2">{option.fullName || 'No name'}</Typography>
                    <Typography variant="caption" color="text.secondary">{option.email}</Typography>
                  </Box>
                </Box>
              )}
              value={availableUsers.find(u => u.id === newMemberUserId) || null}
              onChange={(_, value) => setNewMemberUserId(value?.id || '')}
              renderInput={(params) => (
                <TextField {...params} label="Select User" placeholder="Search users..." />
              )}
            />
            <FormControl fullWidth>
              <InputLabel>Project Role</InputLabel>
              <Select
                value={newMemberRole}
                label="Project Role"
                onChange={(e) => setNewMemberRole(e.target.value as ProjectMemberRole)}
              >
                <MenuItem value="viewer">Viewer - Can view project data</MenuItem>
                <MenuItem value="editor">Editor - Can edit shifts and assignments</MenuItem>
                <MenuItem value="manager">Manager - Can manage project members</MenuItem>
              </Select>
            </FormControl>
            {availableUsers.length === 0 && (
              <Alert severity="info">
                All organisation users are already members of this project
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddMemberDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddMember}
            disabled={!newMemberUserId || loading}
            sx={{
              bgcolor: '#22c55e',
              '&:hover': { bgcolor: '#16a34a' },
            }}
          >
            Add Member
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
