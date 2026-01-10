'use client';

import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import { ChevronLeft, ChevronRight, CheckCircle, AlertTriangle } from '@/components/ui/Icons';
import type {
  ProjectCamel,
  AssignmentCamel,
  ShiftPatternCamel,
  EmployeeCamel,
  WeeklyShiftVerificationCamel,
  UserRole,
} from '@/lib/types';
import {
  getShiftPatternsForWeek,
  getWeekEndDate,
  formatWeekRange,
  isShiftSignedOff,
  areAllShiftsSignedOff,
} from '@/lib/weeklyShiftVerification';

interface WeeklySignOffGridProps {
  project: ProjectCamel;
  weekStartDate: string; // Saturday
  assignments: AssignmentCamel[];
  shiftPatterns: ShiftPatternCamel[];
  employees: EmployeeCamel[];
  verification?: WeeklyShiftVerificationCamel;
  managerName: string;
  managerId: string;
  managerRole: UserRole;
  onSignOffShift: (shiftPatternId: string, notes?: string) => Promise<void>;
  onUnsignShift: (shiftPatternId: string) => Promise<void>;
  onCompleteWeek: () => Promise<void>;
  onNavigateWeek: (direction: 'prev' | 'next') => void;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
}

const DAYS_OF_WEEK = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export function WeeklySignOffGrid({
  project,
  weekStartDate,
  assignments,
  shiftPatterns,
  employees,
  verification,
  managerName,
  managerId,
  managerRole,
  onSignOffShift,
  onUnsignShift,
  onCompleteWeek,
  onNavigateWeek,
  canNavigatePrev,
  canNavigateNext,
}: WeeklySignOffGridProps) {
  const [notesMap, setNotesMap] = useState<Map<string, string>>(new Map());
  const [expandedPattern, setExpandedPattern] = useState<string | null>(null);

  const weekEndDate = getWeekEndDate(weekStartDate);

  // Get all dates in the week (Saturday to Friday)
  const weekDates = useMemo(() => {
    const dates: string[] = [];
    const start = new Date(weekStartDate);

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }

    return dates;
  }, [weekStartDate]);

  // Get shift patterns used in this week with stats
  const shiftsInWeek = useMemo(() => {
    return getShiftPatternsForWeek(weekStartDate, assignments, shiftPatterns);
  }, [weekStartDate, assignments, shiftPatterns]);

  // Check if all shifts are signed off
  const allShiftsSigned = areAllShiftsSignedOff(verification, shiftsInWeek);

  // Get pattern color
  const getPatternColor = (pattern: ShiftPatternCamel): string => {
    if (pattern.isNight) return 'bg-purple-100 text-purple-800 border-purple-300';

    switch (pattern.dutyType) {
      case 'Possession':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Non-Possession':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Office':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Lookout':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Machine':
        return 'bg-cyan-100 text-cyan-800 border-cyan-300';
      case 'Protection':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return {
      dayNum: d.getDate(),
      month: d.toLocaleDateString('en-GB', { month: 'short' }),
      isWeekend: d.getDay() === 0 || d.getDay() === 6, // Sunday or Saturday
    };
  };

  // Get assignments for a specific shift pattern and date
  const getAssignmentsForCell = (patternId: string, date: string) => {
    return assignments.filter(
      (a) => a.shiftPatternId === patternId && a.date === date
    );
  };

  // Handle sign off toggle
  const handleSignOffToggle = async (shiftPatternId: string, currentlySigned: boolean) => {
    if (currentlySigned) {
      await onUnsignShift(shiftPatternId);
    } else {
      const notes = notesMap.get(shiftPatternId);
      await onSignOffShift(shiftPatternId, notes);
      setNotesMap(new Map(notesMap).set(shiftPatternId, '')); // Clear notes after sign-off
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Week Navigation Header */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <IconButton
            onClick={() => onNavigateWeek('prev')}
            disabled={!canNavigatePrev}
            size="small"
          >
            <ChevronLeft className="w-5 h-5" />
          </IconButton>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Week: {formatWeekRange(weekStartDate)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {project.name}
            </Typography>
          </Box>

          <IconButton
            onClick={() => onNavigateWeek('next')}
            disabled={!canNavigateNext}
            size="small"
          >
            <ChevronRight className="w-5 h-5" />
          </IconButton>
        </Box>

        {/* Status indicator */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          {verification?.isFullySignedOff ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-600" />
              <Typography variant="body2" color="success.main" fontWeight={600}>
                Week fully signed off by {verification.completedByName}
              </Typography>
            </>
          ) : allShiftsSigned && shiftsInWeek.length > 0 ? (
            <>
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <Typography variant="body2" color="warning.main" fontWeight={600}>
                All shifts signed - ready to complete week
              </Typography>
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5 text-slate-400" />
              <Typography variant="body2" color="text.secondary">
                {shiftsInWeek.length - (verification?.signedOffShifts.length || 0)} of{' '}
                {shiftsInWeek.length} shifts need sign-off
              </Typography>
            </>
          )}
        </Box>
      </Paper>

      {/* Weekly Grid */}
      <Paper sx={{ overflow: 'hidden' }}>
        {shiftsInWeek.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              No shifts scheduled for this week
            </Typography>
          </Box>
        ) : (
          <>
            {/* Day Headers */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(200px, 1fr) repeat(7, 1fr)',
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: 'grey.50',
              }}
            >
              <Box sx={{ p: 2, borderRight: 1, borderColor: 'divider', fontWeight: 600 }}>
                Shift Pattern
              </Box>
              {DAYS_OF_WEEK.map((day, idx) => {
                const date = weekDates[idx];
                const dateInfo = date ? formatDate(date) : null;
                const isWeekend = idx === 0 || idx === 1; // Sat, Sun

                return (
                  <Box
                    key={day}
                    sx={{
                      p: 1.5,
                      textAlign: 'center',
                      borderRight: 1,
                      borderColor: 'divider',
                      bgcolor: isWeekend ? 'warning.50' : 'grey.50',
                    }}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      {day}
                    </Typography>
                    {dateInfo && (
                      <Typography variant="caption" color="text.secondary">
                        {dateInfo.dayNum} {dateInfo.month}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>

            {/* Shift Pattern Rows */}
            {shiftsInWeek.map(({ pattern, employeeCount, assignmentCount }) => {
              const isSigned = isShiftSignedOff(verification, pattern.id);
              const signedData = verification?.signedOffShifts.find(
                (s) => s.shiftPatternId === pattern.id
              );
              const isExpanded = expandedPattern === pattern.id;

              return (
                <Box key={pattern.id}>
                  {/* Pattern Row */}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(200px, 1fr) repeat(7, 1fr)',
                      borderBottom: 1,
                      borderColor: 'divider',
                      bgcolor: isSigned ? 'success.50' : 'background.paper',
                    }}
                  >
                    {/* Pattern Info Column */}
                    <Box
                      sx={{
                        p: 2,
                        borderRight: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Checkbox
                          checked={isSigned}
                          onChange={() => handleSignOffToggle(pattern.id, isSigned)}
                          disabled={verification?.isFullySignedOff}
                          color="success"
                        />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {pattern.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {employeeCount} employee{employeeCount !== 1 ? 's' : ''} •{' '}
                            {assignmentCount} shift{assignmentCount !== 1 ? 's' : ''}
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        <Chip
                          label={pattern.dutyType}
                          size="small"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                        {pattern.isNight && (
                          <Chip
                            label="Night"
                            size="small"
                            color="secondary"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>

                      {isSigned && signedData && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="success.main" fontWeight={600}>
                            Signed by {signedData.signedOffByName}
                          </Typography>
                          <Typography variant="caption" display="block" color="text.secondary">
                            {new Date(signedData.signedOffAt).toLocaleString('en-GB')}
                          </Typography>
                          {signedData.notes && (
                            <Typography
                              variant="caption"
                              display="block"
                              color="text.secondary"
                              sx={{ fontStyle: 'italic', mt: 0.5 }}
                            >
                              "{signedData.notes}"
                            </Typography>
                          )}
                        </Box>
                      )}

                      {!isSigned && !verification?.isFullySignedOff && (
                        <TextField
                          size="small"
                          placeholder="Optional notes..."
                          value={notesMap.get(pattern.id) || ''}
                          onChange={(e) => {
                            const newMap = new Map(notesMap);
                            newMap.set(pattern.id, e.target.value);
                            setNotesMap(newMap);
                          }}
                          sx={{ mt: 1 }}
                          multiline
                          rows={2}
                        />
                      )}

                      <Button
                        size="small"
                        onClick={() =>
                          setExpandedPattern(isExpanded ? null : pattern.id)
                        }
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        {isExpanded ? 'Hide' : 'Show'} Details
                      </Button>
                    </Box>

                    {/* Day Columns */}
                    {weekDates.map((date, idx) => {
                      const cellAssignments = getAssignmentsForCell(pattern.id, date);
                      const isWeekend = idx === 0 || idx === 1;

                      return (
                        <Box
                          key={date}
                          sx={{
                            p: 1,
                            borderRight: 1,
                            borderColor: 'divider',
                            bgcolor: isWeekend ? 'warning.50' : 'background.paper',
                            minHeight: 60,
                          }}
                        >
                          {cellAssignments.length > 0 && (
                            <Box
                              className={getPatternColor(pattern)}
                              sx={{
                                px: 1,
                                py: 0.5,
                                borderRadius: 1,
                                border: 1,
                                fontSize: '0.75rem',
                                textAlign: 'center',
                              }}
                            >
                              {cellAssignments.length} shift
                              {cellAssignments.length !== 1 ? 's' : ''}
                            </Box>
                          )}
                          {isExpanded && cellAssignments.length > 0 && (
                            <Box sx={{ mt: 0.5 }}>
                              {cellAssignments.map((assignment) => {
                                const employee = employees.find(
                                  (e) => e.id === assignment.employeeId
                                );
                                return (
                                  <Typography
                                    key={assignment.id}
                                    variant="caption"
                                    display="block"
                                    sx={{ fontSize: '0.65rem' }}
                                  >
                                    {employee?.name || 'Unknown'}
                                  </Typography>
                                );
                              })}
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              );
            })}
          </>
        )}
      </Paper>

      {/* Complete Week Button */}
      {!verification?.isFullySignedOff && allShiftsSigned && shiftsInWeek.length > 0 && (
        <Paper sx={{ p: 2, bgcolor: 'success.50', border: 1, borderColor: 'success.main' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography variant="body1" fontWeight={600} color="success.main">
                All shifts signed off
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Complete the week to lock all sign-offs and move to the next unsigned week
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="success"
              size="large"
              onClick={onCompleteWeek}
              startIcon={<CheckCircle className="w-5 h-5" />}
            >
              Complete Week
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
