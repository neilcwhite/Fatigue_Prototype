'use client';

import { useState, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { X } from '@/components/ui/Icons';
import { WeeklySignOffGrid } from '@/components/verification/WeeklySignOffGrid';
import type {
  ProjectCamel,
  AssignmentCamel,
  ShiftPatternCamel,
  EmployeeCamel,
  WeeklyShiftVerificationCamel,
  UserRole,
} from '@/lib/types';
import {
  getWeekStartDate,
  getShiftPatternsForWeek,
  getNextUnsignedWeek,
} from '@/lib/weeklyShiftVerification';

interface WeeklyVerificationModalProps {
  open: boolean;
  onClose: () => void;
  project: ProjectCamel;
  assignments: AssignmentCamel[];
  shiftPatterns: ShiftPatternCamel[];
  employees: EmployeeCamel[];
  weeklyVerifications: WeeklyShiftVerificationCamel[];
  managerName: string;
  managerId: string;
  managerRole: UserRole;
  onSignOffShift: (
    weekStartDate: string,
    projectId: number,
    shiftPatternId: string,
    shiftPatternName: string,
    employeeCount: number,
    assignmentCount: number,
    managerId: string,
    managerName: string,
    managerRole: UserRole,
    notes?: string
  ) => Promise<void>;
  onUnsignShift: (
    weekStartDate: string,
    projectId: number,
    shiftPatternId: string
  ) => Promise<void>;
  onCompleteWeek: (
    weekStartDate: string,
    projectId: number,
    managerId: string,
    managerName: string,
    managerRole: UserRole
  ) => Promise<void>;
  initialWeekStart?: string; // Optional: navigate to specific week
}

export function WeeklyVerificationModal({
  open,
  onClose,
  project,
  assignments,
  shiftPatterns,
  employees,
  weeklyVerifications,
  managerName,
  managerId,
  managerRole,
  onSignOffShift,
  onUnsignShift,
  onCompleteWeek,
  initialWeekStart,
}: WeeklyVerificationModalProps) {
  // Get project-specific data
  const projectAssignments = assignments.filter((a) => a.projectId === project.id);
  const projectShiftPatterns = shiftPatterns.filter((sp) => sp.projectId === project.id);
  const projectVerifications = weeklyVerifications.filter((v) => v.projectId === project.id);

  // Get all unique weeks with assignments (sorted oldest to newest)
  const allWeeks = useMemo(() => {
    const weekSet = new Set<string>();
    projectAssignments.forEach((a) => {
      const weekStart = getWeekStartDate(a.date);
      weekSet.add(weekStart);
    });
    return Array.from(weekSet).sort();
  }, [projectAssignments]);

  // Initialize to either the initialWeekStart, the next unsigned week, or the most recent week
  const defaultWeek = useMemo(() => {
    if (initialWeekStart && allWeeks.includes(initialWeekStart)) {
      return initialWeekStart;
    }
    const nextUnsigned = getNextUnsignedWeek(project.id, projectVerifications, projectAssignments);
    if (nextUnsigned) {
      return nextUnsigned;
    }
    return allWeeks[allWeeks.length - 1] || null;
  }, [initialWeekStart, project.id, projectVerifications, projectAssignments, allWeeks]);

  const [currentWeekStart, setCurrentWeekStart] = useState<string | null>(defaultWeek);

  const currentWeekIndex = useMemo(() => {
    if (!currentWeekStart) return -1;
    return allWeeks.indexOf(currentWeekStart);
  }, [currentWeekStart, allWeeks]);

  const canNavigatePrev = currentWeekIndex > 0;
  const canNavigateNext = currentWeekIndex < allWeeks.length - 1;

  const handleNavigateWeek = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && canNavigatePrev) {
      setCurrentWeekStart(allWeeks[currentWeekIndex - 1]);
    } else if (direction === 'next' && canNavigateNext) {
      setCurrentWeekStart(allWeeks[currentWeekIndex + 1]);
    }
  };

  // Get verification record for current week
  const currentVerification = useMemo(() => {
    if (!currentWeekStart) return undefined;
    return projectVerifications.find((v) => v.weekStartDate === currentWeekStart);
  }, [currentWeekStart, projectVerifications]);

  // Handlers that pass through with additional data
  const handleSignOffShift = async (shiftPatternId: string, notes?: string) => {
    if (!currentWeekStart) return;

    // Get shift pattern stats
    const shiftsInWeek = getShiftPatternsForWeek(
      currentWeekStart,
      projectAssignments,
      projectShiftPatterns
    );
    const shiftData = shiftsInWeek.find((s) => s.pattern.id === shiftPatternId);

    if (!shiftData) {
      throw new Error('Shift pattern not found in this week');
    }

    await onSignOffShift(
      currentWeekStart,
      project.id,
      shiftPatternId,
      shiftData.pattern.name,
      shiftData.employeeCount,
      shiftData.assignmentCount,
      managerId,
      managerName,
      managerRole,
      notes
    );
  };

  const handleUnsignShift = async (shiftPatternId: string) => {
    if (!currentWeekStart) return;
    await onUnsignShift(currentWeekStart, project.id, shiftPatternId);
  };

  const handleCompleteWeek = async () => {
    if (!currentWeekStart) return;

    await onCompleteWeek(
      currentWeekStart,
      project.id,
      managerId,
      managerName,
      managerRole
    );

    // After completing, navigate to next unsigned week if available
    const nextUnsigned = getNextUnsignedWeek(project.id, projectVerifications, projectAssignments);
    if (nextUnsigned && nextUnsigned !== currentWeekStart) {
      setCurrentWeekStart(nextUnsigned);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" component="div" fontWeight={600}>
              Weekly Shift Verification
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign off each shift pattern for the week
            </Typography>
          </Box>
          <Button
            onClick={onClose}
            sx={{ minWidth: 'auto', p: 1 }}
            color="inherit"
          >
            <X className="w-5 h-5" />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        {allWeeks.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No shifts scheduled yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create assignments in the Planning view to start tracking weekly sign-offs
            </Typography>
          </Box>
        ) : currentWeekStart ? (
          <WeeklySignOffGrid
            project={project}
            weekStartDate={currentWeekStart}
            assignments={projectAssignments}
            shiftPatterns={projectShiftPatterns}
            employees={employees}
            verification={currentVerification}
            managerName={managerName}
            managerId={managerId}
            managerRole={managerRole}
            onSignOffShift={handleSignOffShift}
            onUnsignShift={handleUnsignShift}
            onCompleteWeek={handleCompleteWeek}
            onNavigateWeek={handleNavigateWeek}
            canNavigatePrev={canNavigatePrev}
            canNavigateNext={canNavigateNext}
          />
        ) : (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              Unable to load week data
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
