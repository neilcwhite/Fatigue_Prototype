/**
 * Fatigue Calculator Debug View
 * Shows all parameters and calculation components for validation against HSE Excel tool
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  MenuItem,
  Grid,
  Divider,
  Checkbox,
} from '@mui/material';
import {
  calculateCombinedFatigueSequence,
  FatigueParams,
} from '../../lib/fatigue';
import { ShiftDefinition } from '../../lib/types';

// Days of week - HSE format: Mon=1, Tue=2, ..., Fri=5, Sat=6, Sun=7
// For two-week roster: Week1 Mon-Fri=1-5, Week2 Mon-Fri=8-12
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

interface ShiftRow {
  day: typeof DAYS[number];
  dayNum: number;
  enabled: boolean;
  commuteIn: number;
  startTime: string;
  endTime: string;
  commuteOut: number;
  workload: number;
  attention: number;
  breakFreq: number;
  breakLen: number;
}

const defaultShift = (day: typeof DAYS[number], dayNum: number): ShiftRow => ({
  day,
  dayNum,
  enabled: !['Sat', 'Sun'].includes(day),
  commuteIn: 60,
  startTime: '06:00',
  endTime: '18:00',
  commuteOut: 60,
  workload: 2,
  attention: 2,
  breakFreq: 180,
  breakLen: 15,
});

export default function FatigueDebug() {
  // Number of weeks to display
  const [numWeeks, setNumWeeks] = useState(1);

  // Global parameters
  const [globalParams, setGlobalParams] = useState<FatigueParams>({
    commuteTime: 120,
    workload: 2,
    attention: 2,
    breakFrequency: 180,
    breakLength: 15,
    continuousWork: 240,
    breakAfterContinuous: 30,
  });

  // Generate shifts for all weeks - day numbers continue: Week1=1-7, Week2=8-14, Week3=15-21, etc.
  const generateMultiWeekShifts = (weeks: number): ShiftRow[] => {
    const allShifts: ShiftRow[] = [];
    for (let week = 0; week < weeks; week++) {
      DAYS.forEach((day, i) => {
        const dayNum = week * 7 + i + 1;
        allShifts.push(defaultShift(day, dayNum));
      });
    }
    return allShifts;
  };

  // Per-shift data - HSE day numbering continues across weeks
  const [shifts, setShifts] = useState<ShiftRow[]>(
    generateMultiWeekShifts(1)
  );

  // Update shifts when numWeeks changes
  const handleWeeksChange = (newWeeks: number) => {
    setNumWeeks(newWeeks);
    // Preserve existing shift settings where possible
    const newShifts = generateMultiWeekShifts(newWeeks);
    // Copy over existing settings for days that already exist
    shifts.forEach((existingShift, idx) => {
      if (idx < newShifts.length) {
        newShifts[idx] = { ...newShifts[idx], ...existingShift, dayNum: newShifts[idx].dayNum };
      }
    });
    setShifts(newShifts);
  };

  // Convert to ShiftDefinition array for calculation
  const shiftDefinitions = useMemo((): ShiftDefinition[] => {
    return shifts
      .filter(s => s.enabled)
      .map(s => ({
        day: s.dayNum,
        startTime: s.startTime,
        endTime: s.endTime,
        commuteIn: s.commuteIn,
        commuteOut: s.commuteOut,
        workload: s.workload,
        attention: s.attention,
        breakFreq: s.breakFreq,
        breakLen: s.breakLen,
      }));
  }, [shifts]);

  // Calculate results
  const results = useMemo(() => {
    if (shiftDefinitions.length === 0) return [];
    return calculateCombinedFatigueSequence(shiftDefinitions, globalParams);
  }, [shiftDefinitions, globalParams]);

  // Map results back to shift rows
  const resultsMap = useMemo(() => {
    const map = new Map<number, typeof results[0]>();
    shiftDefinitions.forEach((sd, i) => {
      map.set(sd.day, results[i]);
    });
    return map;
  }, [shiftDefinitions, results]);

  const updateShift = (index: number, field: keyof ShiftRow, value: unknown) => {
    setShifts(prev => {
      const newShifts = [...prev];
      newShifts[index] = { ...newShifts[index], [field]: value };
      return newShifts;
    });
  };

  const calculateHours = (start: string, end: string): number => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    const diff = endMins > startMins ? endMins - startMins : (24 * 60 + endMins) - startMins;
    return Math.round(diff / 60 * 10) / 10;
  };

  return (
    <Box sx={{ p: 2, maxWidth: '100%', overflow: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        Fatigue Calculator Debug View
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Compare values against HSE Excel tool. All parameters shown explicitly.
      </Typography>

      {/* Week Selector */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: '#e3f2fd' }}>
        <Typography variant="h6" gutterBottom>Multi-Week Analysis</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 6, sm: 3, md: 2 }}>
            <TextField
              select
              label="Number of Weeks"
              value={numWeeks}
              onChange={(e) => handleWeeksChange(parseInt(e.target.value))}
              size="small"
              fullWidth
            >
              <MenuItem value={1}>1 Week</MenuItem>
              <MenuItem value={2}>2 Weeks</MenuItem>
              <MenuItem value={3}>3 Weeks</MenuItem>
              <MenuItem value={4}>4 Weeks</MenuItem>
              <MenuItem value={5}>5 Weeks</MenuItem>
              <MenuItem value={6}>6 Weeks</MenuItem>
              <MenuItem value={7}>7 Weeks</MenuItem>
              <MenuItem value={8}>8 Weeks</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 9, md: 10 }}>
            <Typography variant="body2" color="text.secondary">
              Extend to multiple weeks to see cumulative fatigue build-up. Week 2+ continues day numbering (Day 8, 9, etc.)
              to simulate repeating the same shift pattern.
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Global Parameters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>Global Parameters (HSE RR446 Defaults)</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3, md: 2 }}>
            <TextField
              label="Commute Total (mins)"
              type="number"
              value={globalParams.commuteTime}
              onChange={(e) => setGlobalParams({ ...globalParams, commuteTime: parseInt(e.target.value) || 0 })}
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 2 }}>
            <TextField
              select
              label="Workload (1-4)"
              value={globalParams.workload}
              onChange={(e) => setGlobalParams({ ...globalParams, workload: parseInt(e.target.value) })}
              size="small"
              fullWidth
            >
              <MenuItem value={1}>1 - Extremely demanding</MenuItem>
              <MenuItem value={2}>2 - Moderately demanding</MenuItem>
              <MenuItem value={3}>3 - Moderately undemanding</MenuItem>
              <MenuItem value={4}>4 - Extremely undemanding</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 2 }}>
            <TextField
              select
              label="Attention (1-4)"
              value={globalParams.attention}
              onChange={(e) => setGlobalParams({ ...globalParams, attention: parseInt(e.target.value) })}
              size="small"
              fullWidth
            >
              <MenuItem value={1}>1 - All/nearly all the time</MenuItem>
              <MenuItem value={2}>2 - Some of the time</MenuItem>
              <MenuItem value={3}>3 - Most of the time</MenuItem>
              <MenuItem value={4}>4 - Rarely or never</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 2 }}>
            <TextField
              label="Break Freq (mins)"
              type="number"
              value={globalParams.breakFrequency}
              onChange={(e) => setGlobalParams({ ...globalParams, breakFrequency: parseInt(e.target.value) || 0 })}
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 2 }}>
            <TextField
              label="Break Length (mins)"
              type="number"
              value={globalParams.breakLength}
              onChange={(e) => setGlobalParams({ ...globalParams, breakLength: parseInt(e.target.value) || 0 })}
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 2 }}>
            <TextField
              label="Max Continuous (mins)"
              type="number"
              value={globalParams.continuousWork}
              onChange={(e) => setGlobalParams({ ...globalParams, continuousWork: parseInt(e.target.value) || 0 })}
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 2 }}>
            <TextField
              label="Break After Max (mins)"
              type="number"
              value={globalParams.breakAfterContinuous}
              onChange={(e) => setGlobalParams({ ...globalParams, breakAfterContinuous: parseInt(e.target.value) || 0 })}
              size="small"
              fullWidth
            />
          </Grid>
        </Grid>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Workload+Attention Sum: <strong>{globalParams.workload + globalParams.attention}</strong> |
          Continuous Work Avg: <strong>{(globalParams.breakFrequency + globalParams.continuousWork) / 2}</strong> |
          Break Duration Avg: <strong>{(globalParams.breakLength + globalParams.breakAfterContinuous) / 2}</strong>
        </Typography>
      </Paper>

      {/* Shift Table */}
      <TableContainer component={Paper}>
        <Table size="small" sx={{ minWidth: 1500 }}>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell sx={{ fontWeight: 'bold', width: 40 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 50 }}>Day</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 50 }}>On</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 60 }}>In</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 80 }}>Start</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 80 }}>End</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 60 }}>Out</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 50 }}>Hrs</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 50 }}>W</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 50 }}>A</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 60 }}>BF</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 60 }}>BL</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 70, backgroundColor: '#e3f2fd' }}>FRI</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 70, backgroundColor: '#fff3e0' }}>FGI</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 70, backgroundColor: '#e8f5e9' }}>Cum(R)</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 70, backgroundColor: '#e8f5e9' }}>Tim(R)</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 70, backgroundColor: '#e8f5e9' }}>Job(R)</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 70, backgroundColor: '#fce4ec' }}>Cum(F)</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 70, backgroundColor: '#fce4ec' }}>ToD(F)</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 70, backgroundColor: '#fce4ec' }}>Task(F)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shifts.map((shift, index) => {
              const result = resultsMap.get(shift.dayNum);
              const hours = shift.enabled ? calculateHours(shift.startTime, shift.endTime) : '-';
              const weekNum = Math.floor((shift.dayNum - 1) / 7) + 1;
              const isWeekStart = (shift.dayNum - 1) % 7 === 0;

              return (
                <TableRow
                  key={shift.dayNum}
                  sx={{
                    backgroundColor: shift.enabled ? 'inherit' : '#f9f9f9',
                    opacity: shift.enabled ? 1 : 0.6,
                    borderTop: isWeekStart && weekNum > 1 ? '3px solid #1976d2' : undefined,
                  }}
                >
                  <TableCell sx={{ fontWeight: 'bold', color: '#1976d2' }}>{shift.dayNum}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>
                    {weekNum > 1 ? `W${weekNum} ` : ''}{shift.day}
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={shift.enabled}
                      onChange={(e) => updateShift(index, 'enabled', e.target.checked)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={shift.commuteIn}
                      onChange={(e) => updateShift(index, 'commuteIn', parseInt(e.target.value) || 0)}
                      size="small"
                      disabled={!shift.enabled}
                      sx={{ width: 60 }}
                      slotProps={{ htmlInput: { style: { padding: '4px 8px' } } }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="time"
                      value={shift.startTime}
                      onChange={(e) => updateShift(index, 'startTime', e.target.value)}
                      size="small"
                      disabled={!shift.enabled}
                      sx={{ width: 100 }}
                      slotProps={{ htmlInput: { style: { padding: '4px 8px' } } }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="time"
                      value={shift.endTime}
                      onChange={(e) => updateShift(index, 'endTime', e.target.value)}
                      size="small"
                      disabled={!shift.enabled}
                      sx={{ width: 100 }}
                      slotProps={{ htmlInput: { style: { padding: '4px 8px' } } }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={shift.commuteOut}
                      onChange={(e) => updateShift(index, 'commuteOut', parseInt(e.target.value) || 0)}
                      size="small"
                      disabled={!shift.enabled}
                      sx={{ width: 60 }}
                      slotProps={{ htmlInput: { style: { padding: '4px 8px' } } }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#1976d2', fontWeight: 'bold' }}>{hours}</TableCell>
                  <TableCell>
                    <TextField
                      select
                      value={shift.workload}
                      onChange={(e) => updateShift(index, 'workload', parseInt(e.target.value))}
                      size="small"
                      disabled={!shift.enabled}
                      sx={{ width: 55 }}
                    >
                      <MenuItem value={1}>1</MenuItem>
                      <MenuItem value={2}>2</MenuItem>
                      <MenuItem value={3}>3</MenuItem>
                      <MenuItem value={4}>4</MenuItem>
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField
                      select
                      value={shift.attention}
                      onChange={(e) => updateShift(index, 'attention', parseInt(e.target.value))}
                      size="small"
                      disabled={!shift.enabled}
                      sx={{ width: 55 }}
                    >
                      <MenuItem value={1}>1</MenuItem>
                      <MenuItem value={2}>2</MenuItem>
                      <MenuItem value={3}>3</MenuItem>
                      <MenuItem value={4}>4</MenuItem>
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={shift.breakFreq}
                      onChange={(e) => updateShift(index, 'breakFreq', parseInt(e.target.value) || 0)}
                      size="small"
                      disabled={!shift.enabled}
                      sx={{ width: 60 }}
                      slotProps={{ htmlInput: { style: { padding: '4px 8px' } } }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={shift.breakLen}
                      onChange={(e) => updateShift(index, 'breakLen', parseInt(e.target.value) || 0)}
                      size="small"
                      disabled={!shift.enabled}
                      sx={{ width: 60 }}
                      slotProps={{ htmlInput: { style: { padding: '4px 8px' } } }}
                    />
                  </TableCell>
                  {/* Results columns - Per NR/L2/OHS/003: FRI >1.6 = RED breach, FGI >35 day/45 night = YELLOW Level 2 */}
                  <TableCell sx={{
                    backgroundColor: '#e3f2fd',
                    fontWeight: 'bold',
                    color: result && result.riskIndex > 1.6 ? '#d32f2f' : 'inherit' // Red if >1.6 (breach)
                  }}>
                    {result ? result.riskIndex.toFixed(3) : '-'}
                  </TableCell>
                  <TableCell sx={{
                    backgroundColor: '#fff3e0',
                    fontWeight: 'bold',
                    color: result && result.fatigueIndex > 35 ? '#ed6c02' : result && result.fatigueIndex > 30 ? '#84cc16' : 'inherit' // Yellow if >35 (Level 2), Light green if >30 (Good Practice)
                  }}>
                    {result ? result.fatigueIndex.toFixed(1) : '-'}
                  </TableCell>
                  <TableCell sx={{ backgroundColor: '#e8f5e9' }}>
                    {result ? result.riskCumulative.toFixed(3) : '-'}
                  </TableCell>
                  <TableCell sx={{ backgroundColor: '#e8f5e9' }}>
                    {result ? result.riskTiming.toFixed(3) : '-'}
                  </TableCell>
                  <TableCell sx={{ backgroundColor: '#e8f5e9' }}>
                    {result ? result.riskJobBreaks.toFixed(3) : '-'}
                  </TableCell>
                  <TableCell sx={{ backgroundColor: '#fce4ec' }}>
                    {result ? result.fatigueCumulative.toFixed(1) : '-'}
                  </TableCell>
                  <TableCell sx={{ backgroundColor: '#fce4ec' }}>
                    {result ? result.fatigueTimeOfDay.toFixed(1) : '-'}
                  </TableCell>
                  <TableCell sx={{ backgroundColor: '#fce4ec' }}>
                    {result ? result.fatigueTask.toFixed(1) : '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Legend */}
      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Legend</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="caption" component="div">
              <strong>Columns:</strong><br />
              In = Commute In (mins) | Out = Commute Out (mins) | Hrs = Shift Length<br />
              W = Workload (1-4) | A = Attention (1-4) | BF = Break Frequency | BL = Break Length
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="caption" component="div">
              <strong>Results:</strong><br />
              FRI = Fatigue Risk Index | FGI = Fatigue Index<br />
              Cum = Cumulative | Tim = Timing | Job = Job/Breaks | ToD = Time of Day | Task = Task
            </Typography>
          </Grid>
        </Grid>
        <Divider sx={{ my: 1 }} />
        <Typography variant="caption" component="div">
          <strong>Attention Scale:</strong> 1 = All/nearly all the time, 2 = Some of the time, 3 = Most of the time, 4 = Rarely/never<br />
          <strong>Workload Scale:</strong> 1 = Extremely demanding, 2 = Moderately demanding, 3 = Moderately undemanding, 4 = Extremely undemanding
        </Typography>
      </Paper>

      {/* Raw calculation inputs */}
      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Calculation Inputs (for verification)</Typography>
        <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
{`Global Params:
  commuteTime: ${globalParams.commuteTime}
  workload: ${globalParams.workload}
  attention: ${globalParams.attention}
  breakFrequency: ${globalParams.breakFrequency}
  breakLength: ${globalParams.breakLength}
  continuousWork: ${globalParams.continuousWork}
  breakAfterContinuous: ${globalParams.breakAfterContinuous}

Shifts being calculated:
${JSON.stringify(shiftDefinitions, null, 2)}
`}
        </Typography>
      </Paper>
    </Box>
  );
}
