'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import { Download, FileText } from '@/components/ui/Icons';
import { getRiskLevel } from '@/lib/fatigue';
import { getRiskChipSx, getRiskCardSx, type Shift } from './hooks/useFatigueState';
import type { FatigueResult } from '@/lib/types';

interface FatigueResultsSummaryProps {
  shifts: Shift[];
  results: FatigueResult[];
  maxFRI: number;
  avgFRI: number;
  overallRisk: string;
  onExportCSV: () => void;
  onPrint: () => void;
  showChart: boolean;
  onToggleChart: () => void;
}

export function FatigueResultsSummary({
  shifts,
  results,
  maxFRI,
  avgFRI,
  overallRisk,
  onExportCSV,
  onPrint,
  showChart,
  onToggleChart,
}: FatigueResultsSummaryProps) {
  const workShifts = shifts.filter(s => !s.isRestDay).length;
  const criticalShifts = results.filter(r => r.riskIndex >= 1.2).length;
  const elevatedShifts = results.filter(r => r.riskIndex >= 1.1 && r.riskIndex < 1.2).length;
  const moderateShifts = results.filter(r => r.riskIndex >= 1.0 && r.riskIndex < 1.1).length;

  // Calculate FRI distribution for progress bar
  const friDistribution = {
    critical: (criticalShifts / Math.max(workShifts, 1)) * 100,
    elevated: (elevatedShifts / Math.max(workShifts, 1)) * 100,
    moderate: (moderateShifts / Math.max(workShifts, 1)) * 100,
    low: ((workShifts - criticalShifts - elevatedShifts - moderateShifts) / Math.max(workShifts, 1)) * 100,
  };

  if (results.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          Add shifts to see fatigue analysis results
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ mb: 2 }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" fontWeight={600}>
          Analysis Results
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Download className="w-4 h-4" />}
            onClick={onExportCSV}
          >
            Export CSV
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileText className="w-4 h-4" />}
            onClick={onPrint}
          >
            Print Report
          </Button>
        </Box>
      </Box>

      <Box sx={{ p: 2 }}>
        {/* Summary Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2, mb: 3 }}>
          {/* Overall Risk Card */}
          <Card sx={{ ...getRiskCardSx(overallRisk), border: 2 }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                Overall Risk
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {overallRisk.toUpperCase()}
              </Typography>
            </CardContent>
          </Card>

          {/* Max FRI Card */}
          <Card sx={{ ...getRiskCardSx(getRiskLevel(maxFRI).level), border: 2 }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                Maximum FRI
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {maxFRI.toFixed(3)}
              </Typography>
            </CardContent>
          </Card>

          {/* Average FRI Card */}
          <Card sx={{ bgcolor: 'grey.100', border: 2, borderColor: 'grey.300' }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Average FRI
              </Typography>
              <Typography variant="h4" fontWeight={700} color="text.primary">
                {avgFRI.toFixed(3)}
              </Typography>
            </CardContent>
          </Card>

          {/* Shifts Summary Card */}
          <Card sx={{ bgcolor: 'grey.100', border: 2, borderColor: 'grey.300' }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Work Shifts
              </Typography>
              <Typography variant="h4" fontWeight={700} color="text.primary">
                {workShifts}
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Risk Distribution */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Risk Distribution
          </Typography>
          <Box sx={{ display: 'flex', height: 24, borderRadius: 1, overflow: 'hidden', bgcolor: 'grey.200' }}>
            {friDistribution.low > 0 && (
              <Box sx={{ width: `${friDistribution.low}%`, bgcolor: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {friDistribution.low > 10 && <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>{Math.round(friDistribution.low)}%</Typography>}
              </Box>
            )}
            {friDistribution.moderate > 0 && (
              <Box sx={{ width: `${friDistribution.moderate}%`, bgcolor: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {friDistribution.moderate > 10 && <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>{Math.round(friDistribution.moderate)}%</Typography>}
              </Box>
            )}
            {friDistribution.elevated > 0 && (
              <Box sx={{ width: `${friDistribution.elevated}%`, bgcolor: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {friDistribution.elevated > 10 && <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>{Math.round(friDistribution.elevated)}%</Typography>}
              </Box>
            )}
            {friDistribution.critical > 0 && (
              <Box sx={{ width: `${friDistribution.critical}%`, bgcolor: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {friDistribution.critical > 10 && <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>{Math.round(friDistribution.critical)}%</Typography>}
              </Box>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: '#22c55e' }} />
              <Typography variant="caption">Low ({workShifts - criticalShifts - elevatedShifts - moderateShifts})</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: '#eab308' }} />
              <Typography variant="caption">Moderate ({moderateShifts})</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: '#f97316' }} />
              <Typography variant="caption">Elevated ({elevatedShifts})</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: '#dc2626' }} />
              <Typography variant="caption">Critical ({criticalShifts})</Typography>
            </Box>
          </Box>
        </Box>

        {/* Per-Shift Results */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Per-Shift Results
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 300, overflow: 'auto' }}>
            {results.map((result) => {
              const riskLevelObj = getRiskLevel(result.riskIndex);
              return (
                <Box
                  key={result.day}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1.5,
                    borderRadius: 1,
                    ...getRiskCardSx(riskLevelObj.level),
                    border: 1,
                  }}
                >
                  <Typography variant="body2" fontWeight={500}>
                    Day {result.day}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" fontWeight={700}>
                      FRI: {result.riskIndex.toFixed(3)}
                    </Typography>
                    <Chip
                      label={riskLevelObj.level.toUpperCase()}
                      size="small"
                      sx={{ ...getRiskChipSx(riskLevelObj.level), fontWeight: 600, fontSize: '0.7rem' }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}
