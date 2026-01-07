'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Autocomplete from '@mui/material/Autocomplete';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import { FileText, Search, Eye, Plus, ChevronLeft } from '@/components/ui/Icons';
import { FatigueAssessmentModal } from '@/components/modals/FatigueAssessmentModal';
import type { SupabaseUser, FatigueAssessment, FAMPRiskLevel, FAMPStatus, EmployeeCamel } from '@/lib/types';

interface AssessmentsViewProps {
  user: SupabaseUser;
  onSignOut: () => void;
  onBack: () => void;
  employees: EmployeeCamel[];
  assessments: FatigueAssessment[];
  onCreateAssessment: (assessment: FatigueAssessment) => void;
  onUpdateAssessment: (id: string, assessment: Partial<FatigueAssessment>) => void;
}

const getRiskChipColor = (risk: FAMPRiskLevel): 'success' | 'warning' | 'error' => {
  switch (risk) {
    case 'LOW': return 'success';
    case 'MEDIUM': return 'warning';
    case 'HIGH': return 'error';
    default: return 'warning';
  }
};

const getStatusChipColor = (status: FAMPStatus): 'default' | 'primary' | 'warning' | 'success' | 'error' => {
  switch (status) {
    case 'draft': return 'default';
    case 'pending_employee': return 'warning';
    case 'pending_manager': return 'primary';
    case 'completed': return 'success';
    case 'cancelled': return 'error';
    default: return 'default';
  }
};

const getStatusLabel = (status: FAMPStatus): string => {
  switch (status) {
    case 'draft': return 'Draft';
    case 'pending_employee': return 'Pending Employee';
    case 'pending_manager': return 'Pending Manager';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
};

export function AssessmentsView({
  user,
  onSignOut,
  onBack,
  employees,
  assessments,
  onCreateAssessment,
  onUpdateAssessment,
}: AssessmentsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FAMPStatus | 'all'>('all');
  const [riskFilter, setRiskFilter] = useState<FAMPRiskLevel | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEmployeeSelectDialog, setShowEmployeeSelectDialog] = useState(false);
  const [viewingAssessment, setViewingAssessment] = useState<FatigueAssessment | null>(null);
  const [selectedEmployeeForCreate, setSelectedEmployeeForCreate] = useState<EmployeeCamel | null>(null);

  // Filter assessments
  const filteredAssessments = assessments.filter(assessment => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = assessment.employeeName.toLowerCase().includes(query);
      const matchesId = assessment.id.toLowerCase().includes(query);
      if (!matchesName && !matchesId) return false;
    }

    // Status filter
    if (statusFilter !== 'all' && assessment.status !== statusFilter) return false;

    // Risk filter
    if (riskFilter !== 'all' && assessment.finalRiskLevel !== riskFilter) return false;

    return true;
  });

  // Sort by date descending (most recent first)
  const sortedAssessments = [...filteredAssessments].sort(
    (a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime()
  );

  const handleSaveAssessment = async (assessment: Partial<FatigueAssessment>): Promise<void> => {
    if (viewingAssessment && assessment.id) {
      onUpdateAssessment(assessment.id, assessment);
    } else if (assessment as FatigueAssessment) {
      onCreateAssessment(assessment as FatigueAssessment);
    }
    setShowCreateModal(false);
    setViewingAssessment(null);
    setSelectedEmployeeForCreate(null);
  };

  const handleStartNewAssessment = () => {
    setSelectedEmployeeForCreate(null);
    setViewingAssessment(null);
    setShowEmployeeSelectDialog(true);
  };

  const handleEmployeeSelectedForAssessment = () => {
    if (selectedEmployeeForCreate) {
      setShowEmployeeSelectDialog(false);
      setShowCreateModal(true);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" elevation={0} sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <IconButton edge="start" onClick={onBack} sx={{ mr: 2 }}>
            <ChevronLeft className="w-5 h-5" />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, color: 'text.primary' }}>
            Fatigue Assessments
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 3 }}>
        {/* Stats Summary */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="caption" color="text.secondary">Total Assessments</Typography>
            <Typography variant="h4">{assessments.length}</Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="caption" color="text.secondary">Pending Review</Typography>
            <Typography variant="h4" color="warning.main">
              {assessments.filter(a => a.status === 'pending_employee' || a.status === 'pending_manager').length}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="caption" color="text.secondary">High Risk</Typography>
            <Typography variant="h4" color="error.main">
              {assessments.filter(a => a.finalRiskLevel === 'HIGH').length}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="caption" color="text.secondary">Completed</Typography>
            <Typography variant="h4" color="success.main">
              {assessments.filter(a => a.status === 'completed').length}
            </Typography>
          </Paper>
        </Box>

        {/* Filters and Actions */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search className="w-4 h-4" />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 250 }}
            />

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value as FAMPStatus | 'all')}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="pending_employee">Pending Employee</MenuItem>
                <MenuItem value="pending_manager">Pending Manager</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Risk Level</InputLabel>
              <Select
                value={riskFilter}
                label="Risk Level"
                onChange={(e) => setRiskFilter(e.target.value as FAMPRiskLevel | 'all')}
              >
                <MenuItem value="all">All Levels</MenuItem>
                <MenuItem value="LOW">Low</MenuItem>
                <MenuItem value="MEDIUM">Medium</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ flexGrow: 1 }} />

            <Button
              variant="contained"
              startIcon={<Plus className="w-4 h-4" />}
              onClick={handleStartNewAssessment}
            >
              New Assessment
            </Button>
          </Box>
        </Paper>

        {/* Assessments Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Employee</TableCell>
                <TableCell>Trigger</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Risk Level</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Assessor</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedAssessments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <Typography color="text.secondary">
                      {assessments.length === 0
                        ? 'No assessments yet. Create one when a Level 1 or Level 2 exceedance occurs.'
                        : 'No assessments match your filters.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedAssessments.map((assessment) => (
                  <TableRow
                    key={assessment.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setViewingAssessment(assessment)}
                  >
                    <TableCell>
                      {new Date(assessment.assessmentDate).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {assessment.employeeName}
                      </Typography>
                      {assessment.jobTitle && (
                        <Typography variant="caption" color="text.secondary">
                          {assessment.jobTitle}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {assessment.violationType
                          ? assessment.violationType.replace(/_/g, ' ')
                          : assessment.assessmentReasons[0]?.replace(/_/g, ' ') || 'Manual'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {assessment.totalScore}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={assessment.finalRiskLevel}
                        color={getRiskChipColor(assessment.finalRiskLevel)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(assessment.status)}
                        color={getStatusChipColor(assessment.status)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {assessment.assessorName}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingAssessment(assessment);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Employee Selection Dialog */}
      <Dialog
        open={showEmployeeSelectDialog}
        onClose={() => setShowEmployeeSelectDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Select Employee for Assessment</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Autocomplete
              options={employees}
              getOptionLabel={(option) => option.name}
              value={selectedEmployeeForCreate}
              onChange={(_, newValue) => setSelectedEmployeeForCreate(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Employee"
                  placeholder="Search employees..."
                  fullWidth
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box>
                    <Typography variant="body2">{option.name}</Typography>
                    {option.role && (
                      <Typography variant="caption" color="text.secondary">
                        {option.role}
                      </Typography>
                    )}
                  </Box>
                </li>
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEmployeeSelectDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleEmployeeSelectedForAssessment}
            disabled={!selectedEmployeeForCreate}
          >
            Continue
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create/View Assessment Modal */}
      {(showCreateModal || viewingAssessment) && (
        <FatigueAssessmentModal
          open={true}
          onClose={() => {
            setShowCreateModal(false);
            setViewingAssessment(null);
            setSelectedEmployeeForCreate(null);
          }}
          onSave={handleSaveAssessment}
          employee={viewingAssessment
            ? employees.find(e => e.id === viewingAssessment.employeeId)
            : selectedEmployeeForCreate || undefined}
          assessorName={user.email || 'Unknown'}
          existingAssessment={viewingAssessment || undefined}
        />
      )}
    </Box>
  );
}
