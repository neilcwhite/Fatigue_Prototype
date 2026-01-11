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
  Plus,
  CheckCircle,
  ErrorTriangle,
  AlertTriangle,
  Search,
  ChevronLeft
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
  hasErrors: boolean;
  hasWarnings: boolean;
  errorCount: number;
  warningCount: number;
}

interface ProjectSelectorProps {
  user: SupabaseUser;
  onSignOut: () => void;
  onBack: () => void;
  title: string;
  subtitle: string;
  projects: ProjectCamel[];
  employees: EmployeeCamel[];
  assignments: AssignmentCamel[];
  shiftPatterns: ShiftPatternCamel[];
  onSelectProject: (projectId: number) => void;
  onCreateProject: () => void;
  showCreateButton?: boolean;
}

export function ProjectSelector({
  user,
  onSignOut,
  onBack,
  title,
  subtitle,
  projects,
  employees,
  assignments,
  shiftPatterns,
  onSelectProject,
  onCreateProject,
  showCreateButton = true,
}: ProjectSelectorProps) {
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [showNonCompliantOnly, setShowNonCompliantOnly] = useState(false);

  // Calculate stats for a project
  const getProjectStats = (projectId: number): ProjectStats => {
    const projectAssignments = assignments.filter(a => a.projectId === projectId);
    const projectPatterns = shiftPatterns.filter(sp => sp.projectId === projectId);

    let totalHours = 0;
    const employeeIds = new Set<number>();

    projectAssignments.forEach(assignment => {
      const pattern = projectPatterns.find(p => p.id === assignment.shiftPatternId);
      if (pattern?.startTime && pattern?.endTime) {
        const [startH, startM] = pattern.startTime.split(':').map(Number);
        const [endH, endM] = pattern.endTime.split(':').map(Number);
        let hours = endH - startH + (endM - startM) / 60;
        if (hours < 0) hours += 24;
        totalHours += hours;
      }
      employeeIds.add(assignment.employeeId);
    });

    // Check compliance
    const complianceResult = checkProjectCompliance(
      projectId,
      assignments,
      shiftPatterns
    );

    return {
      totalHours: Math.round(totalHours),
      employeeCount: employeeIds.size,
      shiftPatternCount: projectPatterns.length,
      violations: complianceResult.violations.map(v => v.message),
      hasErrors: complianceResult.hasErrors,
      hasWarnings: complianceResult.hasWarnings,
      errorCount: complianceResult.errorCount,
      warningCount: complianceResult.warningCount,
    };
  };

  // Filter projects
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query)
      );
    }

    // Apply compliance filter
    if (showNonCompliantOnly) {
      filtered = filtered.filter(p => {
        const stats = getProjectStats(p.id);
        return stats.hasErrors || stats.hasWarnings;
      });
    }

    // Sort by most recently modified
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
          <Button
            onClick={onBack}
            sx={{ color: 'white', mr: 2 }}
            startIcon={<ChevronLeft className="w-5 h-5" />}
          >
            Back
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              label={title.toUpperCase()}
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
        <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
          {subtitle}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Select a project to continue
        </Typography>

        {/* Search Bar */}
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

        {/* Projects Grid */}
        <Box
          sx={{
            maxHeight: 'calc(3 * 200px + 2 * 24px)',
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
            {/* Create New Project Card */}
            {showCreateButton && (
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
            )}

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
                    <CardActions sx={{ p: 1.5, pt: 0 }}>
                      <Button
                        variant="contained"
                        size="small"
                        fullWidth
                        onClick={(e) => { e.stopPropagation(); onSelectProject(project.id); }}
                        sx={{ fontWeight: 500, py: 0.5 }}
                      >
                        Select Project
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
