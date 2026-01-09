'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import TableSortLabel from '@mui/material/TableSortLabel';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  Upload,
  Archive,
  Settings,
} from '@/components/ui/Icons';
import { CSVImportModal } from './CSVImportModal';
import { ProjectAccessPanel } from './ProjectAccessPanel';
import { formatRoleLabel } from '@/lib/permissions';
import type {
  SupabaseUser,
  UserRole,
  EmployeeCamel,
  ProjectCamel,
  Employee,
  CSVImportRow,
  ProjectMemberCamel,
  ProjectMemberRole,
} from '@/lib/types';

interface AdminViewProps {
  user: SupabaseUser;
  userRole?: UserRole;
  organisationId?: string;
  onSignOut: () => void;
  employees: EmployeeCamel[];
  projects: ProjectCamel[];
  onCreateEmployee: (data: {
    name: string;
    role?: string;
    sentinelNumber?: string;
    primarySponsor?: string;
    subSponsors?: string;
    currentEmployer?: string;
  }) => Promise<void>;
  onDeleteEmployee?: (id: number) => Promise<void>;
  onUpdateEmployee?: (id: number, data: Partial<EmployeeCamel>) => Promise<void>;
  onArchiveProject?: (id: number, archived: boolean) => Promise<void>;
  onDeleteProject?: (id: number) => Promise<void>;
  // Project access control
  addProjectMember?: (projectId: number, userId: string, role: ProjectMemberRole) => Promise<void>;
  updateProjectMemberRole?: (projectId: number, userId: string, role: ProjectMemberRole) => Promise<void>;
  removeProjectMember?: (projectId: number, userId: string) => Promise<void>;
  getProjectMembers?: (projectId: number) => Promise<ProjectMemberCamel[]>;
}

type AdminTab = 'overview' | 'employees' | 'projects' | 'access';

export function AdminView({
  user,
  userRole,
  organisationId,
  onSignOut,
  employees,
  projects,
  onCreateEmployee,
  onDeleteEmployee,
  onUpdateEmployee,
  onArchiveProject,
  onDeleteProject,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  getProjectMembers,
}: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCSVImportModal, setShowCSVImportModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Employee edit modal state
  const [editingEmployee, setEditingEmployee] = useState<EmployeeCamel | null>(null);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [employeeName, setEmployeeName] = useState('');
  const [employeeRole, setEmployeeRole] = useState('');

  // Delete confirmation state
  const [deleteConfirmEmployee, setDeleteConfirmEmployee] = useState<EmployeeCamel | null>(null);
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<ProjectCamel | null>(null);
  const [deleteProjectName, setDeleteProjectName] = useState('');

  // Project sorting state
  type ProjectSortField = 'name' | 'startDate' | 'endDate' | 'status' | 'createdAt' | 'archivedAt';
  const [projectSortField, setProjectSortField] = useState<ProjectSortField>('name');
  const [projectSortDirection, setProjectSortDirection] = useState<'asc' | 'desc'>('asc');

  // Convert employees for CSV import
  const employeesForImport: Employee[] = employees.map(emp => ({
    id: emp.id,
    name: emp.name,
    role: emp.role,
    email: emp.email,
    sentinel_number: emp.sentinelNumber,
    primary_sponsor: emp.primarySponsor,
    sub_sponsors: emp.subSponsors,
    current_employer: emp.currentEmployer,
    team_id: emp.teamId,
    organisation_id: emp.organisationId,
  }));

  // Filter employees by search
  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.sentinelNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter and sort projects
  const filteredProjects = projects
    .filter(project => {
      const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesArchived = showArchived ? true : !project.archived;
      return matchesSearch && matchesArchived;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (projectSortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'startDate':
          comparison = (a.startDate || '').localeCompare(b.startDate || '');
          break;
        case 'endDate':
          comparison = (a.endDate || '').localeCompare(b.endDate || '');
          break;
        case 'status':
          comparison = (a.archived ? 1 : 0) - (b.archived ? 1 : 0);
          break;
        case 'createdAt':
          comparison = (a.createdAt || '').localeCompare(b.createdAt || '');
          break;
        case 'archivedAt':
          comparison = (a.archivedAt || '').localeCompare(b.archivedAt || '');
          break;
      }
      return projectSortDirection === 'asc' ? comparison : -comparison;
    });

  const archivedCount = projects.filter(p => p.archived).length;
  const activeCount = projects.filter(p => !p.archived).length;

  const handleProjectSort = (field: ProjectSortField) => {
    if (projectSortField === field) {
      setProjectSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setProjectSortField(field);
      setProjectSortDirection('asc');
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  const handleCSVImport = async (rows: CSVImportRow[]) => {
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
    setShowCSVImportModal(false);
  };

  const handleAddEmployee = () => {
    setEditingEmployee(null);
    setEmployeeName('');
    setEmployeeRole('');
    setShowEmployeeModal(true);
  };

  const handleEditEmployee = (employee: EmployeeCamel) => {
    setEditingEmployee(employee);
    setEmployeeName(employee.name);
    setEmployeeRole(employee.role || '');
    setShowEmployeeModal(true);
  };

  const handleSaveEmployee = async () => {
    if (!employeeName.trim()) return;

    if (editingEmployee && onUpdateEmployee) {
      await onUpdateEmployee(editingEmployee.id, {
        name: employeeName,
        role: employeeRole || undefined,
      });
    } else {
      await onCreateEmployee({
        name: employeeName,
        role: employeeRole || undefined,
      });
    }
    setShowEmployeeModal(false);
  };

  const handleDeleteEmployee = async () => {
    if (deleteConfirmEmployee && onDeleteEmployee) {
      await onDeleteEmployee(deleteConfirmEmployee.id);
      setDeleteConfirmEmployee(null);
    }
  };

  const handleArchiveProject = async (project: ProjectCamel) => {
    if (onArchiveProject) {
      await onArchiveProject(project.id, !project.archived);
    }
  };

  const handleDeleteProject = async () => {
    if (deleteConfirmProject && onDeleteProject && deleteProjectName === deleteConfirmProject.name) {
      await onDeleteProject(deleteConfirmProject.id);
      setDeleteConfirmProject(null);
      setDeleteProjectName('');
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
            <Box component="span" sx={{ color: '#22c55e' }}>Admin</Box>
            {' '}
            <Box component="span" sx={{ color: 'white' }}>Dashboard</Box>
          </Typography>
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
            {userRole && (
              <Chip
                label={formatRoleLabel(userRole)}
                size="small"
                sx={{
                  bgcolor: 'rgba(34, 197, 94, 0.2)',
                  color: '#22c55e',
                  fontWeight: 500,
                  fontSize: '0.7rem',
                  border: '1px solid rgba(34, 197, 94, 0.5)',
                }}
              />
            )}
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

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ px: 3 }}
        >
          <Tab label="Overview" value="overview" />
          <Tab label="Employees" value="employees" />
          <Tab label="Projects" value="projects" />
          <Tab label="Project Access" value="access" />
        </Tabs>
      </Box>

      {/* Content */}
      <Box sx={{ p: 3 }}>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <Grid container spacing={3}>
            {/* Stats Cards */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Box sx={{ bgcolor: 'primary.light', borderRadius: 2, p: 1.5 }}>
                      <Users className="w-6 h-6 text-primary-700" />
                    </Box>
                    <Box>
                      <Typography variant="h4" fontWeight={700}>{employees.length}</Typography>
                      <Typography variant="body2" color="text.secondary">Total Employees</Typography>
                    </Box>
                  </Box>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => setActiveTab('employees')}
                  >
                    Manage Employees
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Box sx={{ bgcolor: 'secondary.light', borderRadius: 2, p: 1.5 }}>
                      <Settings className="w-6 h-6 text-secondary-700" />
                    </Box>
                    <Box>
                      <Typography variant="h4" fontWeight={700}>{activeCount}</Typography>
                      <Typography variant="body2" color="text.secondary">Active Projects</Typography>
                    </Box>
                  </Box>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => setActiveTab('projects')}
                  >
                    Manage Projects
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Box sx={{ bgcolor: 'warning.light', borderRadius: 2, p: 1.5 }}>
                      <Archive className="w-6 h-6 text-warning-700" />
                    </Box>
                    <Box>
                      <Typography variant="h4" fontWeight={700}>{archivedCount}</Typography>
                      <Typography variant="body2" color="text.secondary">Archived Projects</Typography>
                    </Box>
                  </Box>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => { setShowArchived(true); setActiveTab('projects'); }}
                  >
                    View Archived
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Quick Actions */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="h6" fontWeight={600} mb={2}>Quick Actions</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card
                    component="button"
                    onClick={handleAddEmployee}
                    sx={{
                      width: '100%',
                      p: 3,
                      textAlign: 'center',
                      border: '2px dashed',
                      borderColor: 'divider',
                      cursor: 'pointer',
                      '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                    }}
                  >
                    <Plus className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <Typography variant="subtitle1" fontWeight={600}>Add Employee</Typography>
                    <Typography variant="body2" color="text.secondary">Create new employee</Typography>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card
                    component="button"
                    onClick={() => setShowCSVImportModal(true)}
                    sx={{
                      width: '100%',
                      p: 3,
                      textAlign: 'center',
                      border: '2px dashed',
                      borderColor: 'divider',
                      cursor: 'pointer',
                      '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                    }}
                  >
                    <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <Typography variant="subtitle1" fontWeight={600}>Import CSV</Typography>
                    <Typography variant="body2" color="text.secondary">Bulk import employees</Typography>
                  </Card>
                </Grid>
              </Grid>
            </Grid>

            {/* Recent Employees */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="h6" fontWeight={600} mb={2}>Recent Employees</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Sentinel Number</TableCell>
                      <TableCell>Employer</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {employees.slice(0, 5).map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell>{employee.name}</TableCell>
                        <TableCell>{employee.role || '-'}</TableCell>
                        <TableCell>
                          {employee.sentinelNumber ? (
                            <Chip label={employee.sentinelNumber} size="small" />
                          ) : '-'}
                        </TableCell>
                        <TableCell>{employee.currentEmployer || '-'}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => handleEditEmployee(employee)}>
                            <Edit2 className="w-4 h-4" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        )}

        {/* Employees Tab */}
        {activeTab === 'employees' && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <TextField
                placeholder="Search employees..."
                size="small"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search className="w-4 h-4" />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: 300 }}
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<Upload className="w-4 h-4" />}
                  onClick={() => setShowCSVImportModal(true)}
                  sx={{
                    color: '#22c55e',
                    borderColor: '#22c55e',
                    '&:hover': { borderColor: '#16a34a', bgcolor: 'rgba(34, 197, 94, 0.1)' },
                  }}
                >
                  Import CSV
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Plus className="w-4 h-4" />}
                  onClick={handleAddEmployee}
                  sx={{
                    bgcolor: '#22c55e',
                    '&:hover': { bgcolor: '#16a34a' },
                  }}
                >
                  Add Employee
                </Button>
              </Box>
            </Box>

            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Sentinel Number</TableCell>
                    <TableCell>Primary Sponsor</TableCell>
                    <TableCell>Current Employer</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>{employee.name}</TableCell>
                      <TableCell>{employee.role || '-'}</TableCell>
                      <TableCell>
                        {employee.sentinelNumber ? (
                          <Chip label={employee.sentinelNumber} size="small" />
                        ) : '-'}
                      </TableCell>
                      <TableCell>{employee.primarySponsor || '-'}</TableCell>
                      <TableCell>{employee.currentEmployer || '-'}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleEditEmployee(employee)}>
                          <Edit2 className="w-4 h-4" />
                        </IconButton>
                        {onDeleteEmployee && (
                          <IconButton
                            size="small"
                            onClick={() => setDeleteConfirmEmployee(employee)}
                            sx={{ color: 'error.main' }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No employees found</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Projects Tab */}
        {activeTab === 'projects' && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                  placeholder="Search projects..."
                  size="small"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search className="w-4 h-4" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ width: 300 }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={showArchived}
                      onChange={(e) => setShowArchived(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Show Archived"
                />
              </Box>
            </Box>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <TableSortLabel
                        active={projectSortField === 'name'}
                        direction={projectSortField === 'name' ? projectSortDirection : 'asc'}
                        onClick={() => handleProjectSort('name')}
                      >
                        Project Name
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={projectSortField === 'startDate'}
                        direction={projectSortField === 'startDate' ? projectSortDirection : 'asc'}
                        onClick={() => handleProjectSort('startDate')}
                      >
                        Start Date
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={projectSortField === 'endDate'}
                        direction={projectSortField === 'endDate' ? projectSortDirection : 'asc'}
                        onClick={() => handleProjectSort('endDate')}
                      >
                        End Date
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={projectSortField === 'createdAt'}
                        direction={projectSortField === 'createdAt' ? projectSortDirection : 'asc'}
                        onClick={() => handleProjectSort('createdAt')}
                      >
                        Created
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={projectSortField === 'status'}
                        direction={projectSortField === 'status' ? projectSortDirection : 'asc'}
                        onClick={() => handleProjectSort('status')}
                      >
                        Status
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={projectSortField === 'archivedAt'}
                        direction={projectSortField === 'archivedAt' ? projectSortDirection : 'asc'}
                        onClick={() => handleProjectSort('archivedAt')}
                      >
                        Archived Date
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="center">Active</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredProjects.map((project) => (
                    <TableRow key={project.id} sx={{ opacity: project.archived ? 0.6 : 1 }}>
                      <TableCell>{project.name}</TableCell>
                      <TableCell>{formatDate(project.startDate)}</TableCell>
                      <TableCell>{formatDate(project.endDate)}</TableCell>
                      <TableCell>{formatDate(project.createdAt)}</TableCell>
                      <TableCell>
                        <Chip
                          label={project.archived ? 'Archived' : 'Active'}
                          size="small"
                          color={project.archived ? 'default' : 'success'}
                        />
                      </TableCell>
                      <TableCell>{project.archivedAt ? formatDate(project.archivedAt) : '-'}</TableCell>
                      <TableCell align="center">
                        {onArchiveProject && (
                          <Switch
                            size="small"
                            checked={!project.archived}
                            onChange={() => handleArchiveProject(project)}
                            color="success"
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {onDeleteProject && (
                          <IconButton
                            size="small"
                            onClick={() => setDeleteConfirmProject(project)}
                            sx={{ color: 'error.main' }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredProjects.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No projects found</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Project Access Tab */}
        {activeTab === 'access' && organisationId && addProjectMember && updateProjectMemberRole && removeProjectMember && getProjectMembers && (
          <ProjectAccessPanel
            projects={projects}
            organisationId={organisationId}
            addProjectMember={addProjectMember}
            updateProjectMemberRole={updateProjectMemberRole}
            removeProjectMember={removeProjectMember}
            getProjectMembers={getProjectMembers}
          />
        )}

        {activeTab === 'access' && (!organisationId || !addProjectMember) && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography color="text.secondary">
              Project access control is not available
            </Typography>
          </Box>
        )}
      </Box>

      {/* CSV Import Modal */}
      <CSVImportModal
        open={showCSVImportModal}
        onClose={() => setShowCSVImportModal(false)}
        existingEmployees={employeesForImport}
        onImport={handleCSVImport}
      />

      {/* Employee Edit Modal */}
      <Dialog open={showEmployeeModal} onClose={() => setShowEmployeeModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Role"
              value={employeeRole}
              onChange={(e) => setEmployeeRole(e.target.value)}
              fullWidth
              placeholder="e.g., Engineer, Supervisor"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEmployeeModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEmployee} disabled={!employeeName.trim()}>
            {editingEmployee ? 'Save Changes' : 'Add Employee'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Employee Confirmation */}
      <Dialog open={!!deleteConfirmEmployee} onClose={() => setDeleteConfirmEmployee(null)}>
        <DialogTitle>Delete Employee</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone.
          </Alert>
          <Typography>
            Are you sure you want to delete <strong>{deleteConfirmEmployee?.name}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmEmployee(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteEmployee}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Project Confirmation */}
      <Dialog open={!!deleteConfirmProject} onClose={() => { setDeleteConfirmProject(null); setDeleteProjectName(''); }}>
        <DialogTitle>Delete Project</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            This will permanently delete the project and all associated data including shift patterns and assignments.
          </Alert>
          <Typography sx={{ mb: 2 }}>
            To confirm, type the project name: <strong>{deleteConfirmProject?.name}</strong>
          </Typography>
          <TextField
            fullWidth
            value={deleteProjectName}
            onChange={(e) => setDeleteProjectName(e.target.value)}
            placeholder="Type project name to confirm"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteConfirmProject(null); setDeleteProjectName(''); }}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteProject}
            disabled={deleteProjectName !== deleteConfirmProject?.name}
          >
            Delete Project
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
