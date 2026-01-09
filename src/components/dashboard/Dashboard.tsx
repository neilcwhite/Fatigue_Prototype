'use client';

import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import InputAdornment from '@mui/material/InputAdornment';
import { SignOutHeader } from '@/components/auth/SignOutHeader';
import {
  Calendar,
  Users,
  Plus,
  CheckCircle,
  ErrorTriangle,
  AlertTriangle,
  BarChart,
  Search
} from '@/components/ui/Icons';
import { checkProjectCompliance } from '@/lib/compliance';
import { GettingStartedCard } from '@/components/onboarding/GettingStartedCard';
import { useOnboarding } from '@/hooks/useOnboarding';
import type {
  ProjectCamel,
  EmployeeCamel,
  AssignmentCamel,
  ShiftPatternCamel,
  SupabaseUser
} from '@/lib/types';

interface ProjectStats {
  totalHours: number;
  employeeCount: number;
  shiftPatternCount: number;
  violations: string[];
  hasErrors: boolean;
  hasWarnings: boolean;
  errorCount: number;
  warningCount: number;
}

interface DashboardProps {
  user: SupabaseUser;
  onSignOut: () => void;
  projects: ProjectCamel[];
  employees: EmployeeCamel[];
  assignments: AssignmentCamel[];
  shiftPatterns: ShiftPatternCamel[];
  onSelectProject: (projectId: number) => void;
  onViewSummary: (projectId: number) => void;
  onViewEmployee: () => void;
  onViewFatigue: () => void;
  onViewTeams: () => void;
  onCreateProject: () => void;
}

export function Dashboard({
  user,
  onSignOut,
  projects,
  employees,
  assignments,
  shiftPatterns,
  onSelectProject,
  onViewSummary,
  onViewEmployee,
  onViewFatigue,
  onViewTeams,
  onCreateProject,
}: DashboardProps) {
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [showNonCompliantOnly, setShowNonCompliantOnly] = useState(false);

  // Check if Getting Started card is visible
  const { dismissed, isComplete } = useOnboarding();
  const showGettingStarted = !dismissed && !isComplete;

  // Calculate stats for a project
  const getProjectStats = (projectId: number): ProjectStats => {
    const projectAssignments = assignments.filter(a => a.projectId === projectId);
    const projectPatterns = shiftPatterns.filter(sp => sp.projectId === projectId);

    let totalHours = 0;
    const employeeIds = new Set<number>();

    projectAssignments.forEach(assignment => {
      employeeIds.add(assignment.employeeId);

      const pattern = projectPatterns.find(p => p.id === assignment.shiftPatternId);
      if (pattern?.startTime && pattern?.endTime) {
        // Parse HH:MM format correctly - convert to decimal hours
        const [startHours, startMins] = pattern.startTime.split(':').map(Number);
        const [endHours, endMins] = pattern.endTime.split(':').map(Number);
        const start = startHours + (startMins / 60);
        const end = endHours + (endMins / 60);
        let hours = end - start;
        if (hours < 0) hours += 24; // Overnight shift
        totalHours += hours;
      }
    });

    // Run proper compliance checking
    const complianceResult = checkProjectCompliance(projectId, assignments, shiftPatterns);
    const violations = complianceResult.violations.map(v => v.message);

    return {
      totalHours: Math.round(totalHours),
      employeeCount: employeeIds.size,
      shiftPatternCount: projectPatterns.length,
      violations,
      hasErrors: complianceResult.hasErrors,
      hasWarnings: complianceResult.hasWarnings,
      errorCount: complianceResult.errorCount,
      warningCount: complianceResult.warningCount,
    };
  };

  // Filter and search projects
  const filteredProjects = useMemo(() => {
    const filtered = projects.filter(project => {
      // Search filter
      const matchesSearch = searchQuery === '' ||
        project.name.toLowerCase().includes(searchQuery.toLowerCase());

      // Compliance filter
      if (showNonCompliantOnly) {
        const stats = getProjectStats(project.id);
        return matchesSearch && (stats.hasErrors || stats.hasWarnings);
      }

      return matchesSearch;
    });

    // Sort by most recently modified (updated_at descending)
    return filtered.sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [projects, searchQuery, showNonCompliantOnly]);

  return (
    <Box sx={{ height: '100vh', bgcolor: 'background.default', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          background: 'linear-gradient(to right, #1e293b, #0f172a)',
          borderBottom: '4px solid',
          borderColor: 'primary.main',
        }}
      >
        <Toolbar sx={{ px: { xs: 2, sm: 3 } }}>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              label="DASHBOARD"
              size="small"
              sx={{
                bgcolor: 'rgba(51, 65, 85, 0.8)',
                color: 'primary.light',
                fontFamily: 'monospace',
                fontWeight: 500,
                fontSize: '0.7rem',
              }}
            />
            <SignOutHeader user={user} onSignOut={onSignOut} />
          </Box>
        </Toolbar>
      </AppBar>

      {/* Content */}
      <Box sx={{ p: 3, flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Action Cards - Above Projects */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card
              component="button"
              onClick={onViewEmployee}
              sx={{
                width: '100%',
                p: 3,
                textAlign: 'left',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
            >
              <Box sx={{ color: 'primary.main', mb: 1 }}>
                <Calendar className="w-8 h-8" />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Employee View
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Check individual compliance and schedules
              </Typography>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Card
              component="button"
              onClick={onViewFatigue}
              sx={{
                width: '100%',
                p: 3,
                textAlign: 'left',
                border: '1px solid',
                borderColor: 'warning.light',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
            >
              <Box sx={{ color: 'warning.main', mb: 1 }}>
                <BarChart className="w-8 h-8" />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Shift Builder
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Check and build safe shift patterns
              </Typography>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Card
              component="button"
              onClick={onViewTeams}
              sx={{
                width: '100%',
                p: 3,
                textAlign: 'left',
                border: '1px solid',
                borderColor: 'secondary.light',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
            >
              <Box sx={{ color: 'secondary.main', mb: 1 }}>
                <Users className="w-8 h-8" />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Team Management
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Create teams and assign them to shift patterns
              </Typography>
            </Card>
          </Grid>
        </Grid>

        {/* Search Bar - Above Everything */}
        <Box
          sx={{
            mb: 3,
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 50,
            boxShadow: 2,
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            flexWrap: 'wrap'
          }}
        >
          <TextField
            size="small"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{
              flexGrow: 1,
              minWidth: 250,
              '& .MuiOutlinedInput-root': {
                borderRadius: 50,
                bgcolor: 'grey.50',
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search className="w-5 h-5" />
                </InputAdornment>
              ),
            }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={showNonCompliantOnly}
                onChange={(e) => setShowNonCompliantOnly(e.target.checked)}
                size="small"
              />
            }
            label="Show non-compliant only"
          />
        </Box>

        {/* Projects Section - Getting Started + Create New Project + Projects in same grid */}
        <Box
          sx={{
            maxHeight: 'calc(3 * 200px + 2 * 24px)', // 3 rows * card height + 2 gaps
            overflowY: 'auto',
            pr: 1,
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              bgcolor: 'grey.100',
              borderRadius: 1,
            },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: 'grey.400',
              borderRadius: 1,
              '&:hover': {
                bgcolor: 'grey.500',
              },
            },
          }}
        >
          <Grid container spacing={3}>
            {/* Getting Started Card - only show if not dismissed/complete */}
            {showGettingStarted && (
              <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                <Box sx={{ height: 200, '& > *': { height: '100%' } }}>
                  <GettingStartedCard />
                </Box>
              </Grid>
            )}

            {/* Create New Project Card */}
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <Card
                onClick={onCreateProject}
                sx={{
                  height: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  border: '2px dashed',
                  borderColor: 'primary.light',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    borderColor: 'primary.main',
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
              >
                <CardContent sx={{ textAlign: 'center' }}>
                  <Box
                    sx={{
                      bgcolor: 'primary.main',
                      borderRadius: '50%',
                      p: 2,
                      mb: 2,
                      display: 'inline-flex',
                    }}
                  >
                    <Plus className="w-8 h-8" />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    Create New Project
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Add a new project to start planning shifts
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Project Cards */}
            {filteredProjects.map(project => {
            const stats = getProjectStats(project.id);
            return (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={project.id}>
                <Card
                  sx={{
                    height: 200,
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 6,
                    },
                  }}
                  onClick={() => onSelectProject(project.id)}
                >
                  <CardContent sx={{ flexGrow: 1, p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '1rem' }}>
                        {project.name}
                      </Typography>
                      <Tooltip title={
                        stats.hasErrors ? `${stats.errorCount} compliance breach${stats.errorCount > 1 ? 'es' : ''}` :
                        stats.hasWarnings ? `${stats.warningCount} warning${stats.warningCount > 1 ? 's' : ''}` :
                        'Compliant'
                      }>
                        <Box sx={{
                          transition: 'transform 0.2s',
                          '&:hover': { transform: 'scale(1.1)' },
                          color: stats.hasErrors ? 'error.main' : stats.hasWarnings ? 'warning.main' : 'success.main'
                        }}>
                          {stats.hasErrors ? (
                            <ErrorTriangle className="w-6 h-6" />
                          ) : stats.hasWarnings ? (
                            <AlertTriangle className="w-6 h-6" />
                          ) : (
                            <CheckCircle className="w-6 h-6" />
                          )}
                        </Box>
                      </Tooltip>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Shift Patterns:</Typography>
                        <Typography variant="caption" fontWeight={600}>{stats.shiftPatternCount}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Total Hours:</Typography>
                        <Typography variant="caption" fontWeight={600}>{stats.totalHours.toLocaleString()}h</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Employees:</Typography>
                        <Typography variant="caption" fontWeight={600}>{stats.employeeCount}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Compliance:</Typography>
                        <Typography
                          variant="caption"
                          fontWeight={600}
                          sx={{ color: stats.hasErrors ? 'error.main' : stats.hasWarnings ? 'warning.main' : 'success.main' }}
                        >
                          {stats.hasErrors
                            ? `${stats.errorCount} Breach${stats.errorCount > 1 ? 'es' : ''}`
                            : stats.hasWarnings
                            ? `${stats.warningCount} Warning${stats.warningCount > 1 ? 's' : ''}`
                            : 'Compliant'}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                  <CardActions sx={{ p: 1.5, pt: 0, gap: 1 }}>
                    <Button
                      variant="contained"
                      size="small"
                      fullWidth
                      onClick={(e) => { e.stopPropagation(); onSelectProject(project.id); }}
                      sx={{ fontWeight: 500, py: 0.5 }}
                    >
                      Planning
                    </Button>
                    <Button
                      variant="contained"
                      color="secondary"
                      size="small"
                      fullWidth
                      onClick={(e) => { e.stopPropagation(); onViewSummary(project.id); }}
                      sx={{ fontWeight: 500, py: 0.5 }}
                    >
                      Summary
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
            </Grid>
          </Box>
        </Box>
    </Box>
  );
}
