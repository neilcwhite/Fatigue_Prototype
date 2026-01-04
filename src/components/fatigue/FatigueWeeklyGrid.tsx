'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Tooltip from '@mui/material/Tooltip';
import { Settings } from '@/components/ui/Icons';
import { getRiskLevel, parseTimeToHours, calculateDutyLength } from '@/lib/fatigue';
import {
  NR_DAYS,
  nrDayIndexToShiftDay,
  getRiskChipSx,
  getRiskCardSx,
  type Shift,
  type FatigueParams,
} from './hooks/useFatigueState';
import type { FatigueResult } from '@/lib/types';

interface FatigueWeeklyGridProps {
  shifts: Shift[];
  params: FatigueParams;
  results: {
    calculations: Array<FatigueResult & { id: number; dayOfWeek: string }>;
    summary: {
      avgRisk: number;
      maxRisk: number;
      dutyCount: number;
      totalHours: number;
      highRiskCount: number;
    };
  } | null;
  worstCaseResults: Map<number, { riskIndex: number; riskLevel: { level: string } }> | null;
  roleComparisonResults: Array<{
    roleKey: string;
    roleName: string;
    workload: number;
    attention: number;
    maxRisk: number;
    avgRisk: number;
    highRiskDays: number;
    isCompliant: boolean;
  }> | null;
  isReadOnly: boolean;
  showSettings: boolean;
  compareRoles: boolean;
  onToggleSettings: () => void;
  onToggleCompareRoles: () => void;
  onInitializeWeeklyShifts: () => void;
  onToggleRestDay: (dayIndex: number) => void;
  onUpdateWeeklyShiftTime: (dayIndex: number, field: 'startTime' | 'endTime', value: string) => void;
  onUpdateWeeklyShiftParam: (dayIndex: number, field: keyof Shift, value: number) => void;
  getShiftForDay: (dayIndex: number) => Shift | undefined;
}

export function FatigueWeeklyGrid({
  shifts,
  params,
  results,
  worstCaseResults,
  roleComparisonResults,
  isReadOnly,
  showSettings,
  compareRoles,
  onToggleSettings,
  onToggleCompareRoles,
  onInitializeWeeklyShifts,
  onToggleRestDay,
  onUpdateWeeklyShiftTime,
  onUpdateWeeklyShiftParam,
  getShiftForDay,
}: FatigueWeeklyGridProps) {
  return (
    <Paper elevation={2}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle1" fontWeight={600}>Network Rail Week (Sat-Fri)</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {!isReadOnly && (
            <Button size="small" variant="outlined" color="primary" onClick={onInitializeWeeklyShifts}>
              Reset Week
            </Button>
          )}
          <Button
            size="small"
            variant={showSettings ? 'contained' : 'outlined'}
            color={showSettings ? 'warning' : 'inherit'}
            startIcon={<Settings className="w-4 h-4" />}
            onClick={onToggleSettings}
          >
            Parameters
          </Button>
        </Box>
      </Box>

      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Network Rail week runs Saturday to Friday. Check "Rest" for non-working days.
        </Typography>

        {shifts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Click "Reset Week" to create a 7-day roster template
            </Typography>
            <Button variant="contained" onClick={onInitializeWeeklyShifts}>
              Create Week Template
            </Button>
          </Box>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            {/* Global Parameters Summary */}
            <Alert severity="warning" sx={{ mb: 2, py: 0.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" fontWeight={600}>Global Settings:</Typography>
                <Typography variant="caption">
                  Max continuous work: <strong>{params.continuousWork}m</strong> | Break length: <strong>{params.breakAfterContinuous}m</strong>
                </Typography>
              </Box>
            </Alert>

            {/* Header */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '42px 38px 48px 90px 90px 48px 42px 50px 50px 50px 50px 54px 54px', gap: 0.5, px: 1, py: 1, bgcolor: 'grey.100', borderRadius: 1, mb: 1, minWidth: 760 }}>
              <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center' }}>Day</Typography>
              <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center' }}>Rest</Typography>
              <Tooltip title="Commute time to work (minutes)" arrow><Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center', color: 'info.main', cursor: 'help' }}>In</Typography></Tooltip>
              <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center' }}>Start</Typography>
              <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center' }}>End</Typography>
              <Tooltip title="Commute time from work (minutes)" arrow><Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center', color: 'info.main', cursor: 'help' }}>Out</Typography></Tooltip>
              <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center' }}>Hrs</Typography>
              <Tooltip title="Workload (1=Low, 2=Light, 3=Moderate, 4=High, 5=Very High)" arrow><Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center', color: 'secondary.main', cursor: 'help' }}>W</Typography></Tooltip>
              <Tooltip title="Attention Required (1=Minimal, 2=Low, 3=Moderate, 4=High, 5=Constant)" arrow><Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center', color: 'secondary.main', cursor: 'help' }}>A</Typography></Tooltip>
              <Tooltip title="Minutes between breaks" arrow><Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center', color: 'success.main', cursor: 'help' }}>BF</Typography></Tooltip>
              <Tooltip title="Break Length (minutes per break)" arrow><Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center', color: 'success.main', cursor: 'help' }}>BL</Typography></Tooltip>
              <Tooltip title="Fatigue Risk Index for current role parameters" arrow><Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center', cursor: 'help' }}>FRI</Typography></Tooltip>
              <Tooltip title="Worst-case FRI (Workload=5, Attention=5)" arrow><Typography variant="caption" fontWeight={600} sx={{ textAlign: 'center', color: 'error.main', cursor: 'help' }}>Worst</Typography></Tooltip>
            </Box>

            {/* Day Rows */}
            {NR_DAYS.map((dayName, index) => {
              const shift = getShiftForDay(index);
              const isRestDay = shift?.isRestDay ?? true;
              const startHour = shift ? parseTimeToHours(shift.startTime) : 0;
              let endHour = shift ? parseTimeToHours(shift.endTime) : 0;
              if (endHour <= startHour) endHour += 24;
              const duration = shift && !isRestDay ? calculateDutyLength(startHour, endHour) : 0;

              const dayResult = results?.calculations.find(c => c.day === nrDayIndexToShiftDay(index));
              const dayFRI = dayResult?.riskIndex;
              const dayRiskLevel = dayResult?.riskLevel?.level || 'low';

              const worstResult = worstCaseResults?.get(nrDayIndexToShiftDay(index));
              const worstCaseFRI = worstResult?.riskIndex;
              const worstCaseLevel = worstResult?.riskLevel?.level || 'low';

              return (
                <Box
                  key={dayName}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '42px 38px 48px 90px 90px 48px 42px 50px 50px 50px 50px 54px 54px',
                    gap: 0.5,
                    p: 1,
                    borderRadius: 1,
                    alignItems: 'center',
                    bgcolor: isRestDay ? 'grey.100' : (index < 2 ? 'warning.50' : 'success.50'),
                    border: 1,
                    borderColor: isRestDay ? 'grey.300' : (index < 2 ? 'warning.200' : 'success.200'),
                    mb: 0.5,
                    opacity: isRestDay ? 0.7 : 1,
                    minWidth: 760,
                  }}
                >
                  <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'center' }}>{dayName}</Typography>

                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Checkbox
                      size="small"
                      checked={isRestDay}
                      onChange={() => onToggleRestDay(index)}
                      disabled={isReadOnly}
                      sx={{ p: 0 }}
                    />
                  </Box>

                  <Tooltip title="Commute time to work (minutes)" arrow>
                    <TextField
                      type="number"
                      size="small"
                      value={shift?.commuteIn ?? 30}
                      onChange={(e) => onUpdateWeeklyShiftParam(index, 'commuteIn', parseInt(e.target.value) || 0)}
                      disabled={isRestDay || isReadOnly}
                      slotProps={{ htmlInput: { min: 0, max: 180, style: { textAlign: 'center', padding: '4px' } } }}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: isRestDay || isReadOnly ? 'grey.200' : 'info.50' } }}
                    />
                  </Tooltip>

                  <TextField
                    type="time"
                    size="small"
                    value={shift?.startTime || '07:00'}
                    onChange={(e) => onUpdateWeeklyShiftTime(index, 'startTime', e.target.value)}
                    disabled={isRestDay || isReadOnly}
                    slotProps={{ htmlInput: { style: { padding: '4px' } } }}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isRestDay || isReadOnly ? 'grey.200' : 'white' } }}
                  />

                  <TextField
                    type="time"
                    size="small"
                    value={shift?.endTime || '19:00'}
                    onChange={(e) => onUpdateWeeklyShiftTime(index, 'endTime', e.target.value)}
                    disabled={isRestDay || isReadOnly}
                    slotProps={{ htmlInput: { style: { padding: '4px' } } }}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isRestDay || isReadOnly ? 'grey.200' : 'white' } }}
                  />

                  <Tooltip title="Commute time from work (minutes)" arrow>
                    <TextField
                      type="number"
                      size="small"
                      value={shift?.commuteOut ?? 30}
                      onChange={(e) => onUpdateWeeklyShiftParam(index, 'commuteOut', parseInt(e.target.value) || 0)}
                      disabled={isRestDay || isReadOnly}
                      slotProps={{ htmlInput: { min: 0, max: 180, style: { textAlign: 'center', padding: '4px' } } }}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: isRestDay || isReadOnly ? 'grey.200' : 'info.50' } }}
                    />
                  </Tooltip>

                  <Typography variant="body2" sx={{ textAlign: 'center', fontWeight: duration > 10 ? 600 : 400, color: duration > 10 ? 'warning.main' : 'text.primary' }}>
                    {isRestDay ? '-' : duration.toFixed(1)}
                  </Typography>

                  <Tooltip title="Workload: 1=Low, 2=Light, 3=Moderate, 4=High, 5=Very High" arrow>
                    <TextField
                      select
                      size="small"
                      value={shift?.workload ?? params.workload}
                      onChange={(e) => onUpdateWeeklyShiftParam(index, 'workload', parseInt(e.target.value))}
                      disabled={isRestDay || isReadOnly}
                      slotProps={{ htmlInput: { style: { padding: '4px', textAlign: 'center' } } }}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: isRestDay || isReadOnly ? 'grey.200' : 'secondary.50' } }}
                    >
                      <MenuItem value={1}>1 - Low</MenuItem>
                      <MenuItem value={2}>2 - Light</MenuItem>
                      <MenuItem value={3}>3 - Moderate</MenuItem>
                      <MenuItem value={4}>4 - High</MenuItem>
                      <MenuItem value={5}>5 - Very High</MenuItem>
                    </TextField>
                  </Tooltip>

                  <Tooltip title="Attention: 1=Minimal, 2=Low, 3=Moderate, 4=High, 5=Constant" arrow>
                    <TextField
                      select
                      size="small"
                      value={shift?.attention ?? params.attention}
                      onChange={(e) => onUpdateWeeklyShiftParam(index, 'attention', parseInt(e.target.value))}
                      disabled={isRestDay || isReadOnly}
                      slotProps={{ htmlInput: { style: { padding: '4px', textAlign: 'center' } } }}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: isRestDay || isReadOnly ? 'grey.200' : 'secondary.50' } }}
                    >
                      <MenuItem value={1}>1 - Minimal</MenuItem>
                      <MenuItem value={2}>2 - Low</MenuItem>
                      <MenuItem value={3}>3 - Moderate</MenuItem>
                      <MenuItem value={4}>4 - High</MenuItem>
                      <MenuItem value={5}>5 - Constant</MenuItem>
                    </TextField>
                  </Tooltip>

                  <Tooltip title="Minutes between breaks" arrow>
                    <TextField
                      type="number"
                      size="small"
                      value={shift?.breakFreq ?? params.breakFrequency}
                      onChange={(e) => onUpdateWeeklyShiftParam(index, 'breakFreq', parseInt(e.target.value) || 2)}
                      disabled={isRestDay || isReadOnly}
                      slotProps={{ htmlInput: { min: 1, max: 180, style: { textAlign: 'center', padding: '4px' } } }}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: isRestDay || isReadOnly ? 'grey.200' : 'success.50' } }}
                    />
                  </Tooltip>

                  <Tooltip title="Break length (minutes per break)" arrow>
                    <TextField
                      type="number"
                      size="small"
                      value={shift?.breakLen ?? params.breakLength}
                      onChange={(e) => onUpdateWeeklyShiftParam(index, 'breakLen', parseInt(e.target.value) || 15)}
                      disabled={isRestDay || isReadOnly}
                      slotProps={{ htmlInput: { min: 5, max: 60, step: 5, style: { textAlign: 'center', padding: '4px' } } }}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: isRestDay || isReadOnly ? 'grey.200' : 'success.50' } }}
                    />
                  </Tooltip>

                  <Box sx={{ textAlign: 'center' }}>
                    {isRestDay ? (
                      <Typography variant="caption" color="text.disabled">-</Typography>
                    ) : dayFRI !== undefined ? (
                      <Chip size="small" label={dayFRI.toFixed(3)} sx={{ ...getRiskChipSx(dayRiskLevel), fontSize: '0.7rem', fontWeight: 700, height: 22 }} />
                    ) : (
                      <Typography variant="caption" color="text.disabled">-</Typography>
                    )}
                  </Box>

                  <Box sx={{ textAlign: 'center' }}>
                    {isRestDay ? (
                      <Typography variant="caption" color="text.disabled">-</Typography>
                    ) : worstCaseFRI !== undefined ? (
                      <Chip size="small" label={worstCaseFRI.toFixed(3)} sx={{ ...getRiskChipSx(worstCaseLevel), fontSize: '0.7rem', fontWeight: 700, height: 22 }} />
                    ) : (
                      <Typography variant="caption" color="text.disabled">-</Typography>
                    )}
                  </Box>
                </Box>
              );
            })}

            {/* Weekly Summary */}
            <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 6 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Working Days:</Typography>
                    <Typography variant="body2" fontWeight={600}>{shifts.filter(s => !s.isRestDay).length}</Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Rest Days:</Typography>
                    <Typography variant="body2" fontWeight={600}>{shifts.filter(s => s.isRestDay).length}</Typography>
                  </Box>
                </Grid>
              </Grid>
              {results && (
                <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <Paper sx={{ p: 1.5, textAlign: 'center', ...getRiskCardSx(getRiskLevel(results.summary.avgRisk).level) }}>
                        <Typography variant="caption" sx={{ opacity: 0.8 }}>Avg FRI</Typography>
                        <Typography variant="h6" fontWeight={700}>{results.summary.avgRisk.toFixed(3)}</Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Paper sx={{ p: 1.5, textAlign: 'center', ...getRiskCardSx(getRiskLevel(results.summary.maxRisk).level) }}>
                        <Typography variant="caption" sx={{ opacity: 0.8 }}>Peak FRI</Typography>
                        <Typography variant="h6" fontWeight={700}>{results.summary.maxRisk.toFixed(3)}</Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                    {results.summary.highRiskCount > 0
                      ? `${results.summary.highRiskCount} day(s) above 1.1 - monitor these roles`
                      : 'All days within acceptable limits'}
                  </Typography>
                </Box>
              )}
            </Paper>

            {/* Role Quick-Compare */}
            {results && (
              <Paper variant="outlined" sx={{ mt: 2, p: 2, bgcolor: 'secondary.50' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="caption" fontWeight={600} color="secondary.dark">Quick Role Check</Typography>
                  <Button
                    size="small"
                    variant={compareRoles ? 'contained' : 'outlined'}
                    color="secondary"
                    onClick={onToggleCompareRoles}
                  >
                    {compareRoles ? 'Hide' : 'Compare Roles'}
                  </Button>
                </Box>
                <Collapse in={compareRoles}>
                  {roleComparisonResults && (
                    <Box sx={{ mt: 1 }}>
                      {roleComparisonResults.map(result => (
                        <Paper
                          key={result.roleKey}
                          variant="outlined"
                          sx={{
                            p: 1,
                            mb: 0.5,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            bgcolor: result.isCompliant ? 'success.50' : 'error.50',
                            borderColor: result.isCompliant ? 'success.300' : 'error.300',
                          }}
                        >
                          <Typography variant="body2" fontWeight={600} color={result.isCompliant ? 'success.dark' : 'error.dark'}>
                            {result.roleName}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              Avg: {result.avgRisk.toFixed(2)} | Peak: {result.maxRisk.toFixed(2)}
                            </Typography>
                            <Typography variant="body2" color={result.isCompliant ? 'success.main' : 'error.main'}>
                              {result.isCompliant ? '✓' : '✗'}
                            </Typography>
                          </Box>
                        </Paper>
                      ))}
                      <Typography variant="caption" color="secondary.dark" sx={{ display: 'block', mt: 1 }}>
                        Roles with Peak {'>'} 1.2 need monitoring
                      </Typography>
                    </Box>
                  )}
                </Collapse>
              </Paper>
            )}
          </Box>
        )}
      </Box>
    </Paper>
  );
}
