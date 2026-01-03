'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import { ChevronLeft, AlertTriangle, CheckCircle, Users, Clock, Calendar, XCircle, ChevronDown, ChevronUp, Edit2 } from '@/components/ui/Icons';
import type { ProjectCamel, EmployeeCamel, AssignmentCamel, ShiftPatternCamel, WeeklySchedule, SupabaseUser } from '@/lib/types';
import {
  checkProjectCompliance,
  checkEmployeeCompliance,
  type ComplianceViolation
} from '@/lib/compliance';
import { parseTimeToHours, calculateDutyLength } from '@/lib/fatigue';

interface SummaryViewProps {
  user: SupabaseUser;
  onSignOut: () => void;
  onBack: () => void;
  project: ProjectCamel;
  projects: ProjectCamel[];
  employees: EmployeeCamel[];
  assignments: AssignmentCamel[];
  shiftPatterns: ShiftPatternCamel[];
  onSelectProject: (id: number) => void;
  onNavigateToPerson: (employeeId: number) => void;
  onNavigateToPlanning: (projectId: number) => void;
  onEditShiftPattern?: (pattern: ShiftPatternCamel) => void;
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
  onBack,
  project,
  projects,
  employees,
  assignments,
  shiftPatterns,
  onSelectProject,
  onNavigateToPerson,
  onNavigateToPlanning,
  onEditShiftPattern,
}: SummaryViewProps) {
  const projectAssignments = useMemo(() =>
    assignments.filter(a => a.projectId === project.id),
    [assignments, project.id]
  );

  const complianceResult = useMemo(() =>
    checkProjectCompliance(project.id, assignments, shiftPatterns),
    [project.id, assignments, shiftPatterns]
  );

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
        if (a.createdAt && b.createdAt) {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return 0;
      }),
    [shiftPatterns, project.id]
  );

  const [showAllPatterns, setShowAllPatterns] = useState(false);
  const PATTERNS_COLLAPSED_LIMIT = 6;
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
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="span">
              {project.name}{' '}
              <Box component="span" sx={{ color: 'secondary.light' }}>Summary</Box>
            </Typography>
            <Typography variant="body2" sx={{ color: 'grey.500', ml: 2 }} component="span">
              {project.location}
            </Typography>
          </Box>
          <Button
            variant="contained"
            onClick={() => onNavigateToPlanning(project.id)}
            sx={{ mr: 2 }}
          >
            Go to Planning
          </Button>
          <FormControl size="small" sx={{ minWidth: 150, mr: 2 }}>
            <Select
              value={project.id}
              onChange={(e) => onSelectProject(Number(e.target.value))}
              sx={{
                bgcolor: 'rgba(51, 65, 85, 0.8)',
                color: 'white',
                '& .MuiSelect-icon': { color: 'white' },
              }}
            >
              {projects.map(p => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Chip
            label="PROJECT SUMMARY"
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
              }}
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
                  {complianceResult.errorCount > 0 && (
                    <Typography variant="caption" color="error">{complianceResult.errorCount} errors</Typography>
                  )}
                  {complianceResult.warningCount > 0 && (
                    <Typography variant="caption" color="warning.main" sx={{ ml: 1 }}>
                      {complianceResult.warningCount} warnings
                    </Typography>
                  )}
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
          <Paper sx={{ mb: 3 }}>
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
                const hasErrors = empViolations.some(v => v.severity === 'error');

                return (
                  <Paper
                    key={empId}
                    variant="outlined"
                    sx={{
                      mb: 2,
                      overflow: 'hidden',
                      borderLeft: 4,
                      borderColor: hasErrors ? 'error.main' : 'warning.main',
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
                        bgcolor: hasErrors ? 'error.light' : 'warning.light',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: hasErrors ? 'error.main' : 'warning.main', color: 'white' },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {hasErrors ? <XCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
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
                            bgcolor: hasErrors ? 'error.dark' : 'warning.dark',
                            color: 'white',
                          }}
                        />
                        <Typography variant="caption" color="primary">View →</Typography>
                      </Box>
                    </Box>

                    {/* Violations */}
                    <Box sx={{ bgcolor: hasErrors ? 'rgba(239, 68, 68, 0.05)' : 'rgba(249, 115, 22, 0.05)' }}>
                      {empViolations.map((violation, idx) => (
                        <Box
                          key={idx}
                          onClick={() => onNavigateToPerson(Number(empId))}
                          sx={{
                            p: 1.5,
                            borderTop: 1,
                            borderColor: 'divider',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                            <Typography sx={{ fontSize: '1rem' }}>{getViolationIcon(violation.type)}</Typography>
                            <Box>
                              <Typography
                                variant="body2"
                                fontWeight={500}
                                sx={{ color: violation.severity === 'error' ? 'error.main' : 'warning.main' }}
                              >
                                {violation.message}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {violation.date && new Date(violation.date).toLocaleDateString('en-GB', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short',
                                })}
                                <Box component="span" sx={{ color: 'primary.main', ml: 1 }}>
                                  → Click to view in calendar
                                </Box>
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      ))}
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
      </Box>
    </Box>
  );
}
