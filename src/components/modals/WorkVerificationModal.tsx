'use client';

import { useState, useMemo, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import {
  X,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Users,
  Clock,
  FileText,
  Edit,
} from '@/components/ui/Icons';
import type {
  ProjectCamel,
  AssignmentCamel,
  ShiftPatternCamel,
  EmployeeCamel,
  FatigueAssessment,
  WorkVerificationRecordCamel,
  WorkVerificationSummaryData,
  ViolationType,
  UserRole,
} from '@/lib/types';
import {
  calculateWorkVerificationSummary,
  canSignOffPeriod,
  formatDateRange,
  getPeriodLabel,
} from '@/lib/workVerification';
import { getCurrentPeriod, generateNetworkRailPeriods, getPeriodDates } from '@/lib/periods';
import { checkProjectCompliance } from '@/lib/compliance';
import { getViolationMetadata } from '@/lib/utils';

const STEPS = [
  'Period Selection',
  'Work Summary',
  'FARP Review',
  'Compliance',
  'Sign-Off',
];

interface WorkVerificationModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (record: Partial<WorkVerificationRecordCamel>) => Promise<void>;
  project: ProjectCamel;
  assignments: AssignmentCamel[];
  shiftPatterns: ShiftPatternCamel[];
  employees: EmployeeCamel[];
  fatigueAssessments: FatigueAssessment[];
  managerName: string;
  managerRole: UserRole;
  managerId: string;
}

export function WorkVerificationModal({
  open,
  onClose,
  onSave,
  project,
  assignments,
  shiftPatterns,
  employees,
  fatigueAssessments,
  managerName,
  managerRole,
  managerId,
}: WorkVerificationModalProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Period selection
  const currentPeriod = useMemo(() => getCurrentPeriod(), []);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(
    currentPeriod?.period || null
  );
  const [customDateRange, setCustomDateRange] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Sign-off state
  const [comments, setComments] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  // Generate periods for selected year
  const periods = useMemo(() => generateNetworkRailPeriods(selectedYear), [selectedYear]);

  // Get date range based on selection
  const dateRange = useMemo(() => {
    if (customDateRange) {
      return customStartDate && customEndDate
        ? { start: customStartDate, end: customEndDate }
        : null;
    }

    if (selectedPeriod === null) return null;

    const period = periods.find((p) => p.period === selectedPeriod);
    if (!period) return null;

    return { start: period.startDate, end: period.endDate };
  }, [customDateRange, customStartDate, customEndDate, selectedPeriod, periods]);

  // Calculate compliance violations for the period
  const violations = useMemo(() => {
    if (!dateRange) return [];

    const projectAssignments = assignments.filter(
      (a) => a.projectId === project.id && a.date >= dateRange.start && a.date <= dateRange.end
    );

    const { violations: complianceViolations } = checkProjectCompliance(
      project.id,
      assignments,
      shiftPatterns
    );

    return complianceViolations.map((v) => ({
      employeeId: v.employeeId,
      date: v.date,
      type: v.type as ViolationType,
    }));
  }, [dateRange, project.id, assignments, shiftPatterns, employees]);

  // Calculate summary data
  const summaryData = useMemo<WorkVerificationSummaryData | null>(() => {
    if (!dateRange) return null;

    return calculateWorkVerificationSummary(
      project.id,
      dateRange.start,
      dateRange.end,
      assignments,
      shiftPatterns,
      employees,
      fatigueAssessments,
      violations
    );
  }, [dateRange, project.id, assignments, shiftPatterns, employees, fatigueAssessments, violations]);

  // Check if can proceed to next step
  const canProceed = useCallback(
    (step: number): boolean => {
      switch (step) {
        case 0:
          // Period selection
          return dateRange !== null;
        case 1:
        case 2:
        case 3:
          // Review steps - always can proceed
          return true;
        case 4:
          // Sign-off - need confirmation
          return confirmed && summaryData !== null && canSignOffPeriod(summaryData).canSignOff;
        default:
          return false;
      }
    },
    [dateRange, confirmed, summaryData]
  );

  const handleNext = () => {
    if (canProceed(activeStep)) {
      setActiveStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSave = async () => {
    if (!summaryData || !dateRange) return;

    const signOffCheck = canSignOffPeriod(summaryData);
    if (!signOffCheck.canSignOff) {
      setError(signOffCheck.reason || 'Cannot sign off this period');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const record: Partial<WorkVerificationRecordCamel> = {
        organisationId: project.organisationId,
        projectId: project.id,
        periodNumber: customDateRange ? undefined : selectedPeriod || undefined,
        startDate: dateRange.start,
        endDate: dateRange.end,
        managerId,
        managerName,
        managerRole,
        signOffDate: new Date().toISOString(),
        comments: comments.trim() || undefined,
        summaryData,
      };

      await onSave(record);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save verification record');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setActiveStep(0);
      setError(null);
      setConfirmed(false);
      setComments('');
      onClose();
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return renderPeriodSelection();
      case 1:
        return renderWorkSummary();
      case 2:
        return renderFarpReview();
      case 3:
        return renderCompliance();
      case 4:
        return renderSignOff();
      default:
        return null;
    }
  };

  // Step 1: Period Selection
  const renderPeriodSelection = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Select Period for Verification
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose a Network Rail period or custom date range to verify work hours and FARP assessments.
      </Typography>

      <FormControlLabel
        control={
          <Checkbox
            checked={customDateRange}
            onChange={(e) => setCustomDateRange(e.target.checked)}
          />
        }
        label="Use custom date range"
      />

      {!customDateRange ? (
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={6}>
            <FormControl fullWidth>
              <InputLabel>Year</InputLabel>
              <Select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                label="Year"
              >
                {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}/{String(year + 1).slice(2)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth>
              <InputLabel>Period</InputLabel>
              <Select
                value={selectedPeriod || ''}
                onChange={(e) => setSelectedPeriod(Number(e.target.value))}
                label="Period"
              >
                {periods.map((p) => (
                  <MenuItem key={p.period} value={p.period}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={6}>
            <TextField
              label="Start Date"
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="End Date"
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      )}

      {dateRange && summaryData && (
        <Paper sx={{ mt: 3, p: 2, bgcolor: 'primary.50' }}>
          <Typography variant="subtitle2" gutterBottom>
            Period Quick Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4">{summaryData.totalAssignments}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Assignments
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4">{summaryData.employeeBreakdown.length}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Employees
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color={summaryData.violations.length > 0 ? 'error' : 'success.main'}>
                  {summaryData.violations.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Violations
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4">{summaryData.farpAssessmentsCount}</Typography>
                <Typography variant="caption" color="text.secondary">
                  FARPs
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );

  // Step 2: Work Summary
  const renderWorkSummary = () => {
    if (!summaryData || !dateRange) return null;

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Work Hours Summary
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {formatDateRange(dateRange.start, dateRange.end)}
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={4}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h5" color="primary">
                {summaryData.totalHoursPlanned.toFixed(1)}h
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Planned Hours
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={4}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h5" color="secondary">
                {summaryData.totalHoursActual.toFixed(1)}h
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Actual Hours
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={4}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h5" color={summaryData.modificationsCount > 0 ? 'warning.main' : 'text.primary'}>
                {summaryData.modificationsCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Modifications
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Employee Breakdown
        </Typography>
        <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell align="right">Assignments</TableCell>
                <TableCell align="right">Planned</TableCell>
                <TableCell align="right">Actual</TableCell>
                <TableCell align="right">Custom Times</TableCell>
                <TableCell>Issues</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summaryData.employeeBreakdown.map((emp) => (
                <TableRow key={emp.employeeId}>
                  <TableCell>{emp.employeeName}</TableCell>
                  <TableCell align="right">{emp.assignmentsCount}</TableCell>
                  <TableCell align="right">{emp.plannedHours.toFixed(1)}h</TableCell>
                  <TableCell align="right">{emp.actualHours.toFixed(1)}h</TableCell>
                  <TableCell align="right">
                    {emp.customTimesCount > 0 ? (
                      <Chip label={emp.customTimesCount} size="small" color="warning" />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {emp.violations.length > 0 ? (
                      <Chip
                        label={emp.violations.length}
                        size="small"
                        color="error"
                        icon={<AlertTriangle className="w-4 h-4" />}
                      />
                    ) : (
                      <Chip label="OK" size="small" color="success" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {summaryData.shiftPatternsUsed.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Shift Patterns Used
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {summaryData.shiftPatternsUsed.map((pattern) => (
                <Chip
                  key={pattern.patternId}
                  label={`${pattern.patternName} (${pattern.assignmentCount})`}
                  size="small"
                />
              ))}
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  // Step 3: FARP Review
  const renderFarpReview = () => {
    if (!summaryData || !dateRange) return null;

    const periodAssessments = fatigueAssessments.filter(
      (fa) =>
        assignments.some((a) => a.employeeId === fa.employeeId && a.projectId === project.id) &&
        fa.assessmentDate >= dateRange.start &&
        fa.assessmentDate <= dateRange.end
    );

    const completedAssessments = periodAssessments.filter((fa) => fa.status === 'completed');
    const pendingAssessments = periodAssessments.filter(
      (fa) => fa.status === 'draft' || fa.status === 'pending_employee' || fa.status === 'pending_manager'
    );

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          FARP Assessments
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Review all fatigue risk assessments for this period.
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={4}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h5">{periodAssessments.length}</Typography>
              <Typography variant="body2" color="text.secondary">
                Total FARPs
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={4}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.50' }}>
              <Typography variant="h5" color="success.main">
                {completedAssessments.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Completed
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={4}>
            <Paper
              sx={{
                p: 2,
                textAlign: 'center',
                bgcolor: pendingAssessments.length > 0 ? 'error.50' : 'grey.50',
              }}
            >
              <Typography
                variant="h5"
                color={pendingAssessments.length > 0 ? 'error.main' : 'text.secondary'}
              >
                {pendingAssessments.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pending
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {pendingAssessments.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Cannot sign off - {pendingAssessments.length} FARP assessment{pendingAssessments.length > 1 ? 's' : ''} pending
            </Typography>
            <Typography variant="body2">
              All FARP assessments must be completed before this period can be signed off.
            </Typography>
          </Alert>
        )}

        {periodAssessments.length > 0 && (
          <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Risk Level</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {periodAssessments.map((fa) => (
                  <TableRow key={fa.id}>
                    <TableCell>{fa.employeeName}</TableCell>
                    <TableCell>{fa.assessmentDate}</TableCell>
                    <TableCell>
                      <Chip
                        label={fa.finalRiskLevel}
                        size="small"
                        sx={{
                          bgcolor:
                            fa.finalRiskLevel === 'HIGH'
                              ? 'error.main'
                              : fa.finalRiskLevel === 'MEDIUM'
                              ? 'warning.main'
                              : 'success.main',
                          color: 'white',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={fa.status === 'completed' ? 'Completed' : 'Pending'}
                        size="small"
                        color={fa.status === 'completed' ? 'success' : 'error'}
                        icon={
                          fa.status === 'completed' ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <AlertTriangle className="w-4 h-4" />
                          )
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {periodAssessments.length === 0 && (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-success-main" />
            <Typography variant="body1" color="text.secondary">
              No FARP assessments required for this period
            </Typography>
          </Paper>
        )}
      </Box>
    );
  };

  // Step 4: Compliance Review
  const renderCompliance = () => {
    if (!summaryData || !dateRange) return null;

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Compliance Summary
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Review any compliance violations that occurred during this period.
        </Typography>

        {summaryData.violations.length > 0 ? (
          <Box>
            <Alert severity="warning" sx={{ mb: 2 }}>
              {summaryData.violations.length} violation type{summaryData.violations.length > 1 ? 's' : ''} detected in this period
            </Alert>

            {summaryData.violations.map((v) => {
              const metadata = getViolationMetadata(v.type);
              return (
                <Paper key={v.type} sx={{ p: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <AlertTriangle className="w-5 h-5 text-error-main" />
                    <Typography variant="subtitle2">{metadata.label}</Typography>
                    <Chip label={v.count} size="small" color="error" />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Occurred on {v.dates.length} date{v.dates.length > 1 ? 's' : ''}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {v.dates.slice(0, 5).map((date) => (
                      <Chip key={date} label={date} size="small" variant="outlined" />
                    ))}
                    {v.dates.length > 5 && (
                      <Chip label={`+${v.dates.length - 5} more`} size="small" variant="outlined" />
                    )}
                  </Box>
                </Paper>
              );
            })}
          </Box>
        ) : (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-success-main" />
            <Typography variant="h6" gutterBottom>
              No Compliance Violations
            </Typography>
            <Typography variant="body2" color="text.secondary">
              All work in this period complied with Network Rail regulations.
            </Typography>
          </Paper>
        )}
      </Box>
    );
  };

  // Step 5: Sign-Off
  const renderSignOff = () => {
    if (!summaryData || !dateRange) return null;

    const signOffCheck = canSignOffPeriod(summaryData);

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Manager Sign-Off
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Confirm the work hours and fatigue assessments for this period.
        </Typography>

        {!signOffCheck.canSignOff && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2">{signOffCheck.reason}</Typography>
          </Alert>
        )}

        <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Manager
              </Typography>
              <Typography variant="body1">{managerName}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Role
              </Typography>
              <Typography variant="body1">{managerRole.toUpperCase()}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Period
              </Typography>
              <Typography variant="body1">{formatDateRange(dateRange.start, dateRange.end)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Sign-Off Date
              </Typography>
              <Typography variant="body1">{new Date().toLocaleDateString('en-GB')}</Typography>
            </Grid>
          </Grid>
        </Paper>

        <TextField
          label="Comments"
          multiline
          rows={4}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          fullWidth
          sx={{ mb: 3 }}
          placeholder={
            summaryData.violations.length > 0
              ? 'Comments required when violations are present'
              : 'Optional comments about this period'
          }
          required={summaryData.violations.length > 0}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={!signOffCheck.canSignOff}
            />
          }
          label={
            <Typography variant="body2">
              I confirm that the hours worked on <strong>{project.name}</strong> during this period match
              the records shown, and all required fatigue assessments have been completed and approved.
            </Typography>
          }
        />
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FileText className="w-5 h-5" />
            <span>Work Verification - {project.name}</span>
          </Box>
          <IconButton onClick={handleClose} disabled={saving}>
            <X />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {renderStepContent()}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={saving}>
            Back
          </Button>
        )}
        {activeStep < STEPS.length - 1 ? (
          <Button
            onClick={handleNext}
            variant="contained"
            disabled={!canProceed(activeStep)}
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            disabled={!canProceed(activeStep) || saving}
            startIcon={saving ? <CircularProgress size={16} /> : <CheckCircle className="w-4 h-4" />}
          >
            {saving ? 'Saving...' : 'Complete Sign-Off'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
