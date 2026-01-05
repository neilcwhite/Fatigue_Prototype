'use client';

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
import { SignOutHeader } from '@/components/auth/SignOutHeader';
import {
  Calendar,
  Users,
  Plus,
  CheckCircle,
  ErrorTriangle,
  BarChart
} from '@/components/ui/Icons';
import { checkProjectCompliance } from '@/lib/compliance';
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
    };
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
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
          <Box sx={{ flexGrow: 1 }}>
            <Box
              component="img"
              src="/logo-header.svg"
              alt="HerdWatch"
              sx={{ height: 32, width: 'auto' }}
            />
          </Box>
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
      <Box sx={{ p: 3 }}>
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
                HSE RR446 compliant shift pattern analysis
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

        {/* Project Cards */}
        <Grid container spacing={3}>
          {projects.map(project => {
            const stats = getProjectStats(project.id);
            return (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={project.id}>
                <Card
                  sx={{
                    height: '100%',
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
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        {project.name}
                      </Typography>
                      <Tooltip title={stats.violations.length > 0 ? 'Compliance issues' : 'Compliant'}>
                        <Box sx={{ transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.1)' } }}>
                          {stats.violations.length > 0 ? (
                            <ErrorTriangle className="w-6 h-6" />
                          ) : (
                            <CheckCircle className="w-6 h-6" />
                          )}
                        </Box>
                      </Tooltip>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Shift Patterns:</Typography>
                        <Typography variant="body2" fontWeight={600}>{stats.shiftPatternCount}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Total Hours:</Typography>
                        <Typography variant="body2" fontWeight={600}>{stats.totalHours.toLocaleString()}h</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Employees:</Typography>
                        <Typography variant="body2" fontWeight={600}>{stats.employeeCount}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Compliance:</Typography>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          sx={{ color: stats.violations.length > 0 ? 'error.main' : 'success.main' }}
                        >
                          {stats.violations.length === 0
                            ? 'Compliant'
                            : `${stats.violations.length} Breach${stats.violations.length > 1 ? 'es' : ''}`}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                  <CardActions sx={{ p: 2, pt: 0, gap: 1 }}>
                    <Button
                      variant="contained"
                      fullWidth
                      onClick={(e) => { e.stopPropagation(); onSelectProject(project.id); }}
                      sx={{ fontWeight: 500 }}
                    >
                      Planning
                    </Button>
                    <Button
                      variant="contained"
                      color="secondary"
                      fullWidth
                      onClick={(e) => { e.stopPropagation(); onViewSummary(project.id); }}
                      sx={{ fontWeight: 500 }}
                    >
                      Summary
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}

          {/* Create New Project Card */}
          <Grid size={{ xs: 12, md: 6, lg: 4 }}>
            <Card
              onClick={onCreateProject}
              sx={{
                height: '100%',
                minHeight: 280,
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
        </Grid>

        </Box>
    </Box>
  );
}
