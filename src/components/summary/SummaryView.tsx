'use client';

import { useMemo, useState, useRef } from 'react';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import { AlertTriangle, CheckCircle, Users, Clock, Calendar, XCircle, ChevronDown, ChevronUp, Edit2, Eye, FileText } from '@/components/ui/Icons';
import type { ProjectCamel, EmployeeCamel, AssignmentCamel, ShiftPatternCamel, WeeklySchedule, SupabaseUser, FatigueAssessment, UserRole, WorkVerificationRecordCamel } from '@/lib/types';
import {
  checkProjectCompliance,
  checkEmployeeCompliance,
  type ComplianceViolation
} from '@/lib/compliance';
import { parseTimeToHours, calculateDutyLength } from '@/lib/fatigue';
import { WorkVerificationModal } from '@/components/modals/WorkVerificationModal';
import { hasPermission, getRoleLevel } from '@/lib/permissions';

interface SummaryViewProps {
  user: SupabaseUser;
  userRole?: UserRole;
  managerName?: string;
  managerId?: string;
  onSignOut: () => void;
  onBack: () => void;
  project: ProjectCamel;
  projects: ProjectCamel[];
  employees: EmployeeCamel[];
  assignments: AssignmentCamel[];
  shiftPatterns: ShiftPatternCamel[];
  fatigueAssessments?: FatigueAssessment[];
  workVerificationRecords?: WorkVerificationRecordCamel[];
  onSelectProject: (id: number) => void;
  onNavigateToPerson: (employeeId: number) => void;
  onNavigateToPlanning: (projectId: number) => void;
  onEditShiftPattern?: (pattern: ShiftPatternCamel) => void;
  onViewAssessment?: (assessmentId: string) => void;
  onCreateAssessment?: (violation: ComplianceViolation) => void;
  onCreateWorkVerification?: (record: Partial<WorkVerificationRecordCamel>) => Promise<void>;
}

function getShiftDuration(pattern: ShiftPatternCamel, date: string): number {
  let startTime: string | undefined;
  let endTime: string | undefined;

  if (pattern.weeklySchedule) {
    const dayOfWeek = new Date(date).getDay();
    const dayNames: ('Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat')[] =
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayKey = dayNames[dayOfWeek];
    const daySchedule = pattern.weeklySchedule[dayKey];
    if (daySchedule?.startTime && daySchedule?.endTime) {
      startTime = daySchedule.startTime;
      endTime = daySchedule.endTime;
    }
  }

  if (!startTime || !endTime) {
    startTime = pattern.startTime;
    endTime = pattern.endTime;
  }

  if (!startTime || !endTime) return 12;

  const start = parseTimeToHours(startTime);
  const end = parseTimeToHours(endTime);
  return calculateDutyLength(start, end);
}

export function SummaryView({
  user,
  userRole,
  managerName,
  managerId,
  onSignOut,
  onBack,
  project,
  projects,
  employees,
  assignments,
  shiftPatterns,
  fatigueAssessments = [],
  workVerificationRecords = [],
  onSelectProject,
  onNavigateToPerson,
  onNavigateToPlanning,
  onEditShiftPattern,
  onViewAssessment,
  onCreateAssessment,
  onCreateWorkVerification,
}: SummaryViewProps) {
  const [showWorkVerificationModal, setShowWorkVerificationModal] = useState(false);

  const projectAssignments = useMemo(() =>
    assignments.filter(a => a.projectId === project.id),
    [assignments, project.id]
  );

  const projectVerifications = useMemo(() =>
    workVerificationRecords.filter(wv => wv.projectId === project.id),
    [workVerificationRecords, project.id]
  );

  const complianceResult = useMemo(() =>
    checkProjectCompliance(project.id, assignments, shiftPatterns),
    [project.id, assignments, shiftPatterns]
  );

  // Check if user can verify work (manager level or above)
  const canVerifyWork = useMemo(() => {
    if (!userRole) return false;
    return getRoleLevel(userRole) >= 2; // manager, sheq, admin, super_admin
  }, [userRole]);

  const handleWorkVerification = async (record: Partial<WorkVerificationRecordCamel>) => {
    if (onCreateWorkVerification) {
      await onCreateWorkVerification(record);
      setShowWorkVerificationModal(false);
    }
  };

  const stats = useMemo(() => {
    const uniqueEmployeeIds = [...new Set(projectAssignments.map(a => a.employeeId))];
    const patternMap = new Map(shiftPatterns.map(p => [p.id, p]));

    let totalHours = 0;

    projectAssignments.forEach(assignment => {
      const pattern = patternMap.get(assignment.shiftPatternId);
      if (pattern) {
        const hours = getShiftDuration(pattern, assignment.date);
        totalHours += hours;
      }
    });

    return {
      employeeCount: uniqueEmployeeIds.length,
      totalHours: Math.round(totalHours),
      totalAssignments: projectAssignments.length,
    };
  }, [projectAssignments, shiftPatterns]);

  const violationsByEmployee = useMemo(() => {
    const grouped: Record<number, ComplianceViolation[]> = {};
    complianceResult.violations.forEach(v => {
      if (!grouped[v.employeeId]) grouped[v.employeeId] = [];
      grouped[v.employeeId].push(v);
    });
    return grouped;
  }, [complianceResult.violations]);

  // Check if violation requires FAMP assessment
  const requiresAssessment = (type: string): boolean => {
    return ['LEVEL_1_EXCEEDANCE', 'LEVEL_2_EXCEEDANCE', 'ELEVATED_FATIGUE_INDEX'].includes(type);
  };

  // Find matching assessment for a violation
  const findMatchingAssessment = (violation: ComplianceViolation): FatigueAssessment | undefined => {
    return fatigueAssessments.find(
      a => a.violationType === violation.type &&
           a.violationDate === violation.date &&
           a.employeeId === violation.employeeId
    );
  };

  // Get status display info
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return { label: 'FAMP Completed', color: 'success' as const };
      case 'pending_manager':
        return { label: 'Awaiting Manager', color: 'warning' as const };
      case 'pending_employee':
        return { label: 'Awaiting Employee', color: 'info' as const };
      case 'draft':
        return { label: 'FAMP Draft', color: 'default' as const };
      default:
        return { label: 'In Progress', color: 'default' as const };
    }
  };

  const getViolationIcon = (type: string) => {
    switch (type) {
      case 'MAX_SHIFT_LENGTH': return '⏱️';
      case 'INSUFFICIENT_REST': return '😴';
      case 'MAX_WEEKLY_HOURS': return '📊';
      case 'APPROACHING_WEEKLY_LIMIT': return '⚠️';
      case 'MAX_CONSECUTIVE_DAYS': return '📅';
      case 'CONSECUTIVE_NIGHTS_WARNING': return '🌙';
      case 'MAX_CONSECUTIVE_NIGHTS': return '🌙';
      case 'DAY_NIGHT_TRANSITION': return '🔄';
      case 'MULTIPLE_SHIFTS_SAME_DAY': return '⚡';
      default: return '⚠️';
    }
  };

  const projectPatterns = useMemo(() =>
    shiftPatterns
      .filter(sp => sp.projectId === project.id)
      .sort((a, b) => {
        // Custom (Ad hoc) always goes to bottom
        const aIsCustom = a.name.toLowerCase().includes('custom') || a.name.toLowerCase().includes('ad hoc');
        const bIsCustom = b.name.toLowerCase().includes('custom') || b.name.toLowerCase().includes('ad hoc');
        if (aIsCustom && !bIsCustom) return 1;
        if (!aIsCustom && bIsCustom) return -1;
        // Otherwise sort by creation date
        if (a.createdAt && b.createdAt) {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return 0;
      }),
    [shiftPatterns, project.id]
  );

  const [showAllPatterns, setShowAllPatterns] = useState(false);
  const PATTERNS_COLLAPSED_LIMIT = 6;
  const complianceSectionRef = useRef<HTMLDivElement>(null);

  const scrollToCompliance = () => {
    complianceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const displayedPatterns = showAllPatterns ? projectPatterns : projectPatterns.slice(0, PATTERNS_COLLAPSED_LIMIT);

  const getDaySchedule = (pattern: ShiftPatternCamel, dayKey: keyof WeeklySchedule): { active: boolean; hours: string } => {
    const schedule = pattern.weeklySchedule?.[dayKey];
    if (schedule?.startTime && schedule?.endTime) {
      return { active: true, hours: `${schedule.startTime}-${schedule.endTime}` };
    }
    if (!pattern.weeklySchedule && pattern.startTime && pattern.endTime) {
      return { active: true, hours: `${pattern.startTime}-${pattern.endTime}` };
    }
    return { active: false, hours: '-' };
  };

  const dayKeys: (keyof WeeklySchedule)[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            <Box component="span" sx={{ color: 'secondary.light' }}>Project</Box>
            {' '}
            <Box component="span" sx={{ color: 'white' }}>Overview</Box>
          </Typography>
          <Typography variant="subtitle2" sx={{ color: 'grey.400', ml: 3, fontWeight: 400 }}>
            {project.name}
          </Typography>
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
            {canVerifyWork && onCreateWorkVerification && (
              <Button
                variant="contained"
                size="small"
                onClick={() => setShowWorkVerificationModal(true)}
                startIcon={<FileText className="w-4 h-4" />}
                sx={{
                  bgcolor: 'secondary.main',
                  '&:hover': {
                    bgcolor: 'secondary.dark',
                  },
                }}
              >
                Work Verification
              </Button>
            )}
            <Typography variant="body2" sx={{ color: 'grey.400' }}>{user?.email}</Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={onSignOut}
              sx={{
                color: 'secondary.light',
                borderColor: 'rgba(167, 139, 250, 0.3)',
                '&:hover': {
                  borderColor: 'secondary.light',
                  bgcolor: 'rgba(167, 139, 250, 0.1)',
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
        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 3 }}>
            <Card>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ color: 'primary.main' }}>
                  <Clock className="w-8 h-8" />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Total Hours</Typography>
                  <Typography variant="h4" fontWeight={700}>{stats.totalHours.toLocaleString()}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Card>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ color: 'success.main' }}>
                  <Users className="w-8 h-8" />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">People Assigned</Typography>
                  <Typography variant="h4" fontWeight={700}>{stats.employeeCount}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Card>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ color: 'secondary.main' }}>
                  <Calendar className="w-8 h-8" />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Total Assignments</Typography>
                  <Typography variant="h4" fontWeight={700}>{stats.totalAssignments}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Card
              sx={{
                borderLeft: 4,
                borderColor: complianceResult.hasErrors
                  ? 'error.main'
                  : complianceResult.hasWarnings
                  ? 'warning.main'
                  : 'success.main',
                cursor: complianceResult.violations.length > 0 ? 'pointer' : 'default',
                transition: 'box-shadow 0.2s',
                '&:hover': complianceResult.violations.length > 0 ? {
                  boxShadow: 4,
                } : {},
              }}
              onClick={complianceResult.violations.length > 0 ? scrollToCompliance : undefined}
            >
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    color: complianceResult.hasErrors
                      ? 'error.main'
                      : complianceResult.hasWarnings
                      ? 'warning.main'
                      : 'success.main',
                  }}
                >
                  {complianceResult.hasErrors ? (
                    <XCircle className="w-8 h-8" />
                  ) : complianceResult.hasWarnings ? (
                    <AlertTriangle className="w-8 h-8" />
                  ) : (
                    <CheckCircle className="w-8 h-8" />
                  )}
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Compliance Issues</Typography>
                  <Typography
                    variant="h4"
                    fontWeight={700}
                    sx={{
                      color: complianceResult.hasErrors
                        ? 'error.main'
                        : complianceResult.hasWarnings
                        ? 'warning.main'
                        : 'success.main',
                    }}
                  >
                    {complianceResult.errorCount + complianceResult.warningCount}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Shift Patterns Week View */}
        {projectPatterns.length > 0 && (
          <Paper sx={{ mb: 3 }}>
            <Box
              sx={{
                p: 2,
                borderBottom: 1,
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Clock className="w-5 h-5" />
                <Typography variant="subtitle1" fontWeight={600}>
                  Shift Patterns Schedule ({projectPatterns.length})
                </Typography>
              </Box>
              {projectPatterns.length > PATTERNS_COLLAPSED_LIMIT && (
                <Button
                  size="small"
                  onClick={() => setShowAllPatterns(!showAllPatterns)}
                  endIcon={showAllPatterns ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                >
                  {showAllPatterns ? 'Show Less' : `Show All (${projectPatterns.length})`}
                </Button>
              )}
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: 220 }}>Pattern</TableCell>
                  {dayKeys.map(day => (
                    <TableCell key={day} align="center" sx={{ fontWeight: 600, width: 90 }}>{day}</TableCell>
                  ))}
                  <TableCell sx={{ width: 60 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {displayedPatterns.map((pattern) => (
                  <TableRow key={pattern.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: pattern.isNight ? 'secondary.main' : 'success.main',
                          }}
                        />
                        <Box>
                          <Typography variant="body2" fontWeight={500}>{pattern.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{pattern.dutyType}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    {dayKeys.map(day => {
                      const { active, hours } = getDaySchedule(pattern, day);
                      return (
                        <TableCell key={day} align="center">
                          {active ? (
                            <Box
                              sx={{
                                bgcolor: pattern.isNight ? 'rgba(124, 58, 237, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                py: 0.5,
                                px: 1,
                                borderRadius: 1,
                              }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  fontWeight: 500,
                                  color: pattern.isNight ? 'secondary.main' : 'success.main',
                                  display: 'block',
                                }}
                              >
                                {hours.split('-')[0]}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">to</Typography>
                              <Typography
                                variant="caption"
                                sx={{
                                  fontWeight: 500,
                                  color: pattern.isNight ? 'secondary.main' : 'success.main',
                                  display: 'block',
                                }}
                              >
                                {hours.split('-')[1]}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.disabled">-</Typography>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell align="center">
                      {onEditShiftPattern && (
                        <IconButton
                          size="small"
                          onClick={() => onEditShiftPattern(pattern)}
                          sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {projectPatterns.length > PATTERNS_COLLAPSED_LIMIT && !showAllPatterns && (
              <Box sx={{ p: 1.5, textAlign: 'center', borderTop: 1, borderColor: 'divider' }}>
                <Button size="small" onClick={() => setShowAllPatterns(true)}>
                  + {projectPatterns.length - PATTERNS_COLLAPSED_LIMIT} more patterns
                </Button>
              </Box>
            )}
          </Paper>
        )}

        {/* Compliance Issues */}
        {complianceResult.violations.length > 0 && (
          <Paper ref={complianceSectionRef} sx={{ mb: 3 }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
              <AlertTriangle className="w-5 h-5" />
              <Typography variant="subtitle1" fontWeight={600}>
                Compliance Issues ({complianceResult.violations.length})
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Click any issue to view in calendar
              </Typography>
            </Box>
            <Box sx={{ p: 2, maxHeight: 500, overflow: 'auto' }}>
              {Object.entries(violationsByEmployee).map(([empId, empViolations]) => {
                const emp = employees.find(e => e.id === Number(empId));
                const empName = emp?.name || 'Unknown';
                const empRole = emp?.role || '';
                // 4-tier severity: breach > level2 > level1 > warning
                const hasBreach = empViolations.some(v => v.severity === 'breach');
                const hasLevel2 = empViolations.some(v => v.severity === 'level2');
                const hasLevel1 = empViolations.some(v => v.severity === 'level1');
                const borderColor = hasBreach ? '#ef4444' : hasLevel2 ? '#f97316' : hasLevel1 ? '#eab308' : '#6b7280';
                const bgColor = hasBreach ? '#fee2e2' : hasLevel2 ? '#ffedd5' : hasLevel1 ? '#fef9c3' : '#f3f4f6';
                const bgColorHover = hasBreach ? '#ef4444' : hasLevel2 ? '#f97316' : hasLevel1 ? '#eab308' : '#6b7280';

                return (
                  <Paper
                    key={empId}
                    variant="outlined"
                    sx={{
                      mb: 2,
                      overflow: 'hidden',
                      borderLeft: 4,
                      borderColor: borderColor,
                    }}
                  >
                    {/* Employee Header */}
                    <Box
                      onClick={() => onNavigateToPerson(Number(empId))}
                      sx={{
                        p: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        bgcolor: bgColor,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: bgColorHover, color: 'white' },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {hasBreach ? <XCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        <Typography fontWeight={600}>{empName}</Typography>
                        {empRole && (
                          <Typography variant="caption" sx={{ opacity: 0.7 }}>({empRole})</Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          size="small"
                          label={`${empViolations.length} issue${empViolations.length !== 1 ? 's' : ''}`}
                          sx={{
                            bgcolor: hasBreach ? '#b91c1c' : hasLevel2 ? '#c2410c' : hasLevel1 ? '#a16207' : '#4b5563',
                            color: 'white',
                          }}
                        />
                        <Typography variant="caption" color="primary">View →</Typography>
                      </Box>
                    </Box>

                    {/* Violations */}
                    <Box sx={{ bgcolor: hasBreach ? 'rgba(239, 68, 68, 0.05)' : hasLevel2 ? 'rgba(249, 115, 22, 0.05)' : hasLevel1 ? 'rgba(234, 179, 8, 0.05)' : 'rgba(107, 114, 128, 0.05)' }}>
                      {empViolations.map((violation, idx) => {
                        const matchingAssessment = requiresAssessment(violation.type)
                          ? findMatchingAssessment(violation)
                          : undefined;
                        const hasAssessment = !!matchingAssessment;
                        const statusInfo = matchingAssessment ? getStatusInfo(matchingAssessment.status) : null;
                        const isCompleted = hasAssessment && matchingAssessment?.status === 'completed';

                        return (
                          <Box
                            key={idx}
                            onClick={() => onNavigateToPerson(Number(empId))}
                            sx={{
                              p: 1.5,
                              borderTop: 1,
                              borderColor: 'divider',
                              cursor: 'pointer',
                              bgcolor: isCompleted ? 'rgba(34, 197, 94, 0.08)' : 'transparent',
                              '&:hover': { bgcolor: isCompleted ? 'rgba(34, 197, 94, 0.15)' : 'action.hover' },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                              <Typography sx={{ fontSize: '1rem' }}>
                                {isCompleted ? '✅' : getViolationIcon(violation.type)}
                              </Typography>
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                  <Typography
                                    variant="body2"
                                    fontWeight={500}
                                    sx={{
                                      color: isCompleted
                                        ? '#166534'
                                        : violation.severity === 'breach' ? '#ef4444'
                                        : violation.severity === 'level2' ? '#f97316'
                                        : violation.severity === 'level1' ? '#eab308'
                                        : '#6b7280'
                                    }}
                                  >
                                    {violation.message}
                                  </Typography>
                                  {hasAssessment && statusInfo && (
                                    <Chip
                                      label={statusInfo.label}
                                      size="small"
                                      color={statusInfo.color}
                                      sx={{ height: 18, fontSize: '0.65rem' }}
                                    />
                                  )}
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    {violation.date && new Date(violation.date).toLocaleDateString('en-GB', {
                                      weekday: 'short',
                                      day: 'numeric',
                                      month: 'short',
                                    })}
                                  </Typography>
                                  {requiresAssessment(violation.type) && (
                                    hasAssessment ? (
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onViewAssessment && matchingAssessment) {
                                            onViewAssessment(matchingAssessment.id);
                                          }
                                        }}
                                        startIcon={<Eye className="w-3 h-3" />}
                                        sx={{
                                          fontSize: '0.65rem',
                                          py: 0.25,
                                          px: 0.75,
                                          minHeight: 0,
                                          borderColor: '#22c55e',
                                          color: '#166534',
                                          '&:hover': {
                                            borderColor: '#16a34a',
                                            bgcolor: '#dcfce7',
                                          },
                                        }}
                                      >
                                        View FAMP
                                      </Button>
                                    ) : onCreateAssessment && (
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onCreateAssessment(violation);
                                        }}
                                        startIcon={<FileText className="w-3 h-3" />}
                                        sx={{
                                          fontSize: '0.65rem',
                                          py: 0.25,
                                          px: 0.75,
                                          minHeight: 0,
                                          borderColor: violation.severity === 'breach' ? '#ef4444' : violation.severity === 'level2' ? '#f97316' : '#eab308',
                                          color: violation.severity === 'breach' ? '#991b1b' : violation.severity === 'level2' ? '#9a3412' : '#854d0e',
                                          '&:hover': {
                                            borderColor: violation.severity === 'breach' ? '#dc2626' : violation.severity === 'level2' ? '#ea580c' : '#ca8a04',
                                            bgcolor: violation.severity === 'breach' ? '#fee2e2' : violation.severity === 'level2' ? '#ffedd5' : '#fef9c3',
                                          },
                                        }}
                                      >
                                        Create FAMP
                                      </Button>
                                    )
                                  )}
                                  <Box component="span" sx={{ color: 'primary.main', fontSize: '0.7rem' }}>
                                    → View in calendar
                                  </Box>
                                </Box>
                              </Box>
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          </Paper>
        )}

        {/* No Issues Message */}
        {complianceResult.violations.length === 0 && (
          <Alert
            severity="success"
            icon={<CheckCircle className="w-6 h-6" />}
            sx={{ mb: 3 }}
          >
            <Typography variant="subtitle1" fontWeight={600}>All Clear!</Typography>
            <Typography variant="body2">No compliance issues detected for this project.</Typography>
          </Alert>
        )}

        {/* Work Verification History */}
        {projectVerifications.length > 0 && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CheckCircle className="w-5 h-5 text-success-main" />
              Work Verification History
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Manager sign-offs demonstrating planned and controlled fatigue management
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {projectVerifications.slice(0, 10).map((verification) => (
                <Paper key={verification.id} sx={{ p: 2, bgcolor: 'grey.50', border: 1, borderColor: 'grey.200' }}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <Typography variant="caption" color="text.secondary">Period</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {verification.periodNumber
                          ? `P${verification.periodNumber}`
                          : `${new Date(verification.startDate).toLocaleDateString('en-GB')} - ${new Date(verification.endDate).toLocaleDateString('en-GB')}`
                        }
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <Typography variant="caption" color="text.secondary">Signed Off By</Typography>
                      <Typography variant="body2">{verification.managerName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        ({verification.managerRole.toUpperCase()})
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <Typography variant="caption" color="text.secondary">Date</Typography>
                      <Typography variant="body2">
                        {new Date(verification.signOffDate).toLocaleDateString('en-GB')}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <Box sx={{ textAlign: 'right' }}>
                        <Chip
                          label={`${verification.summaryData.totalAssignments} assignments`}
                          size="small"
                          color="primary"
                          sx={{ mb: 0.5 }}
                        />
                        <Typography variant="caption" display="block" color="text.secondary">
                          {verification.summaryData.totalHoursActual.toFixed(1)}h worked
                        </Typography>
                      </Box>
                    </Grid>
                    {verification.comments && (
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="caption" color="text.secondary">Comments:</Typography>
                        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                          {verification.comments}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              ))}
            </Box>

            {projectVerifications.length > 10 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                Showing 10 of {projectVerifications.length} verification records
              </Typography>
            )}
          </Paper>
        )}
      </Box>

      {/* Work Verification Modal */}
      {canVerifyWork && managerName && managerId && userRole && (
        <WorkVerificationModal
          open={showWorkVerificationModal}
          onClose={() => setShowWorkVerificationModal(false)}
          onSave={handleWorkVerification}
          project={project}
          assignments={assignments}
          shiftPatterns={shiftPatterns}
          employees={employees}
          fatigueAssessments={fatigueAssessments}
          managerName={managerName}
          managerRole={userRole}
          managerId={managerId}
        />
      )}
    </Box>
  );
}
