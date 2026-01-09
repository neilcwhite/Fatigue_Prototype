'use client';

import { useState, useEffect } from 'react';
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
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import { Search, Edit2, Users, AlertCircle } from '@/components/ui/Icons';
import { formatRoleLabel, isAdmin, isSuperAdmin, getRoleLevel } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import type { UserRole, ProjectCamel, ProjectMemberRole } from '@/lib/types';

interface UserManagementPanelProps {
  currentUserRole: UserRole;
  organisationId: string;
  projects: ProjectCamel[];
  addProjectMember: (projectId: number, userId: string, role: ProjectMemberRole) => Promise<void>;
}

interface OrgUser {
  id: string;
  email: string;
  fullName?: string;
  role: UserRole;
  createdAt?: string;
  projectCount?: number;
}

// Roles that can be assigned by different user types
const ASSIGNABLE_ROLES: Record<UserRole, UserRole[]> = {
  super_admin: ['user', 'manager', 'sheq', 'admin', 'super_admin'],
  admin: ['user', 'manager', 'sheq'],  // Admin cannot create other admins
  sheq: ['user', 'manager'],  // SHEQ has limited role assignment
  manager: [],
  user: [],
};

export function UserManagementPanel({
  currentUserRole,
  organisationId,
  projects,
  addProjectMember,
}: UserManagementPanelProps) {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit user dialog state
  const [editingUser, setEditingUser] = useState<OrgUser | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [projectRole, setProjectRole] = useState<ProjectMemberRole>('viewer');
  const [saving, setSaving] = useState(false);

  // Load users from organisation
  const loadUsers = async () => {
    if (!supabase || !organisationId) return;

    setLoading(true);
    setError(null);

    try {
      // Get all users in the organisation
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, role, created_at')
        .eq('organisation_id', organisationId)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get project member counts for each user
      const { data: memberData, error: memberError } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('organisation_id', organisationId);

      // Count projects per user (don't fail if table doesn't exist)
      const projectCounts: Record<string, number> = {};
      if (!memberError && memberData) {
        memberData.forEach(m => {
          projectCounts[m.user_id] = (projectCounts[m.user_id] || 0) + 1;
        });
      }

      const mappedUsers: OrgUser[] = (profilesData || []).map(u => ({
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        role: u.role as UserRole,
        createdAt: u.created_at,
        projectCount: projectCounts[u.id] || 0,
      }));

      setUsers(mappedUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [organisationId]);

  // Filter users based on search
  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.fullName && u.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Count new users (role = 'user' with no project access)
  const newUsersCount = users.filter(u => u.role === 'user' && (u.projectCount || 0) === 0).length;

  // Check if current user can edit a target user's role
  const canEditUserRole = (targetRole: UserRole): boolean => {
    // Cannot edit users with higher or equal role level (except yourself)
    if (getRoleLevel(targetRole) >= getRoleLevel(currentUserRole)) {
      return isSuperAdmin(currentUserRole); // Only super_admin can edit other super_admins
    }
    return true;
  };

  // Get assignable roles for current user
  const getAssignableRoles = (): UserRole[] => {
    return ASSIGNABLE_ROLES[currentUserRole] || [];
  };

  const handleEditUser = (user: OrgUser) => {
    setEditingUser(user);
    setNewRole(user.role);
    setSelectedProjects([]);
    setProjectRole('viewer');
    setError(null);
  };

  const handleSaveUser = async () => {
    if (!editingUser || !supabase) return;

    setSaving(true);
    setError(null);

    try {
      // Update role if changed
      if (newRole !== editingUser.role) {
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ role: newRole })
          .eq('id', editingUser.id)
          .eq('organisation_id', organisationId);

        if (updateError) throw updateError;
      }

      // Add project memberships
      for (const projectId of selectedProjects) {
        try {
          await addProjectMember(projectId, editingUser.id, projectRole);
        } catch (err) {
          // Ignore duplicate membership errors
          if (err instanceof Error && !err.message.includes('already a member')) {
            throw err;
          }
        }
      }

      setSuccessMessage(`Updated ${editingUser.fullName || editingUser.email}`);
      setEditingUser(null);
      await loadUsers();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const getRoleChipColor = (role: UserRole): 'error' | 'warning' | 'info' | 'success' | 'default' => {
    switch (role) {
      case 'super_admin': return 'error';
      case 'admin': return 'warning';
      case 'sheq': return 'info';
      case 'manager': return 'success';
      default: return 'default';
    }
  };

  const isNewUser = (user: OrgUser): boolean => {
    return user.role === 'user' && (user.projectCount || 0) === 0;
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={600}>
            User Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage user roles and project access
          </Typography>
        </Box>
        {newUsersCount > 0 && (
          <Chip
            icon={<AlertCircle className="w-4 h-4" />}
            label={`${newUsersCount} new user${newUsersCount > 1 ? 's' : ''} need access`}
            color="warning"
            sx={{ fontWeight: 500 }}
          />
        )}
      </Box>

      {/* Search */}
      <TextField
        placeholder="Search users..."
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
        sx={{ mb: 2, maxWidth: 400 }}
      />

      {/* Messages */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {/* Users Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell>User</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Projects</TableCell>
              <TableCell>Joined</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <Typography color="text.secondary">
                    {searchQuery ? 'No users match your search' : 'No users found'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow
                  key={user.id}
                  sx={{
                    bgcolor: isNewUser(user) ? 'rgba(251, 191, 36, 0.08)' : 'inherit',
                    '&:hover': { bgcolor: isNewUser(user) ? 'rgba(251, 191, 36, 0.12)' : 'action.hover' },
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {isNewUser(user) && (
                        <Tooltip title="New user - needs role and project access">
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                        </Tooltip>
                      )}
                      <Typography variant="body2" fontWeight={isNewUser(user) ? 600 : 400}>
                        {user.fullName || 'No name'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {user.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={formatRoleLabel(user.role)}
                      size="small"
                      color={getRoleChipColor(user.role)}
                      variant={user.role === 'user' ? 'outlined' : 'filled'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color={user.projectCount === 0 ? 'warning.main' : 'text.secondary'}>
                      {user.projectCount || 0} project{user.projectCount !== 1 ? 's' : ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={canEditUserRole(user.role) ? 'Edit user' : 'Cannot edit users with equal or higher role'}>
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => handleEditUser(user)}
                          disabled={!canEditUserRole(user.role)}
                          sx={{ color: '#22c55e' }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Role Legend */}
      <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          Role Permissions
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          <Box>
            <Chip label="Super Admin" size="small" color="error" sx={{ mb: 0.5 }} />
            <Typography variant="caption" component="p" color="text.secondary">
              Full system access, manage all users
            </Typography>
          </Box>
          <Box>
            <Chip label="Admin" size="small" color="warning" sx={{ mb: 0.5 }} />
            <Typography variant="caption" component="p" color="text.secondary">
              Manage projects, users, import data
            </Typography>
          </Box>
          <Box>
            <Chip label="SHEQ" size="small" color="info" sx={{ mb: 0.5 }} />
            <Typography variant="caption" component="p" color="text.secondary">
              View all projects, manage compliance
            </Typography>
          </Box>
          <Box>
            <Chip label="Manager" size="small" color="success" sx={{ mb: 0.5 }} />
            <Typography variant="caption" component="p" color="text.secondary">
              Create/edit assigned projects
            </Typography>
          </Box>
          <Box>
            <Chip label="User" size="small" variant="outlined" sx={{ mb: 0.5 }} />
            <Typography variant="caption" component="p" color="text.secondary">
              View assigned projects only
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onClose={() => setEditingUser(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit User Access
          {editingUser && (
            <Typography variant="body2" color="text.secondary">
              {editingUser.fullName || editingUser.email}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            {/* Role Selection */}
            <FormControl fullWidth>
              <InputLabel>System Role</InputLabel>
              <Select
                value={newRole}
                label="System Role"
                onChange={(e) => setNewRole(e.target.value as UserRole)}
              >
                {getAssignableRoles().map((role) => (
                  <MenuItem key={role} value={role}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={formatRoleLabel(role)} size="small" color={getRoleChipColor(role)} />
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Project Access Section - only show for user/manager roles */}
            {(newRole === 'user' || newRole === 'manager') && (
              <>
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Assign to Projects
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Select which projects this user can access
                  </Typography>
                </Box>

                {/* Project Role */}
                <FormControl fullWidth size="small">
                  <InputLabel>Project Role</InputLabel>
                  <Select
                    value={projectRole}
                    label="Project Role"
                    onChange={(e) => setProjectRole(e.target.value as ProjectMemberRole)}
                  >
                    <MenuItem value="viewer">Viewer - Can view project data</MenuItem>
                    <MenuItem value="editor">Editor - Can edit shifts and assignments</MenuItem>
                    <MenuItem value="manager">Manager - Can manage project members</MenuItem>
                  </Select>
                </FormControl>

                {/* Project Checkboxes */}
                <Box sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                  {projects.filter(p => !p.archived).length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                      No active projects available
                    </Typography>
                  ) : (
                    projects.filter(p => !p.archived).map((project) => (
                      <FormControlLabel
                        key={project.id}
                        control={
                          <Checkbox
                            checked={selectedProjects.includes(project.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProjects([...selectedProjects, project.id]);
                              } else {
                                setSelectedProjects(selectedProjects.filter(id => id !== project.id));
                              }
                            }}
                            sx={{ '&.Mui-checked': { color: '#22c55e' } }}
                          />
                        }
                        label={project.name}
                        sx={{ display: 'block', ml: 0 }}
                      />
                    ))
                  )}
                </Box>
              </>
            )}

            {/* Info for roles that see all projects */}
            {(newRole === 'admin' || newRole === 'super_admin' || newRole === 'sheq') && (
              <Alert severity="info">
                {newRole === 'sheq'
                  ? 'SHEQ users can view all projects for compliance monitoring but cannot edit them.'
                  : 'Admin users automatically have access to all projects.'}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingUser(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveUser}
            disabled={saving}
            sx={{
              bgcolor: '#22c55e',
              '&:hover': { bgcolor: '#16a34a' },
            }}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
