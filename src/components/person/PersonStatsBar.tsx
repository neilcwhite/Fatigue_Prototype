'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { XCircle, AlertTriangle, CheckCircle } from '@/components/ui/Icons';
import type { ComplianceResult } from '@/lib/compliance';

interface FatigueAnalysisSummary {
  maxFRI: number;
  avgFRI: number;
  criticalShifts: number;
  elevatedShifts: number;
}

interface PersonStats {
  totalShifts: number;
  uniqueProjects: number;
  totalHours: number;
  nightShifts: number;
  periodShiftsCompleted: number;
  periodShiftsOutstanding: number;
  yearProjects: number;
  yearShiftsTotal: number;
  yearShiftsCompleted: number;
  yearShiftsOutstanding: number;
  futureShiftsCount: number;
  futureNonCompliantShifts: number;
}

interface PersonStatsBarProps {
  compliance: ComplianceResult;
  stats: PersonStats;
  showFRI: boolean;
  fatigueAnalysis: FatigueAnalysisSummary | null;
}

export function PersonStatsBar({
  compliance,
  stats,
  showFRI,
  fatigueAnalysis,
}: PersonStatsBarProps) {
  return (
    <Paper sx={{ mb: 2, px: 2, py: 1 }} data-testid="person-stats-bar">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        {/* Compliance */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            borderLeft: 3,
            borderColor: compliance.hasErrors
              ? 'error.main'
              : compliance.hasWarnings
              ? 'warning.main'
              : 'success.main',
            pl: 1,
          }}
          data-testid="compliance-status"
        >
          {compliance.hasErrors ? (
            <XCircle className="w-4 h-4" />
          ) : compliance.hasWarnings ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          <Typography variant="body2" color="text.secondary">
            Compliance:
          </Typography>
          <Typography
            variant="body1"
            fontWeight={700}
            sx={{
              color: compliance.hasErrors
                ? 'error.main'
                : compliance.hasWarnings
                ? 'warning.main'
                : 'success.main',
            }}
          >
            {compliance.violations.length}{' '}
            {compliance.violations.length === 1 ? 'issue' : 'issues'}
          </Typography>
        </Box>

        <Box sx={{ height: 20, borderLeft: 1, borderColor: 'divider' }} />

        {/* Year Projects */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} data-testid="year-projects-stat">
          <Typography variant="body2" color="text.secondary">
            Projects (Year):
          </Typography>
          <Typography variant="body1" fontWeight={700}>
            {stats.yearProjects}
          </Typography>
        </Box>

        <Box sx={{ height: 20, borderLeft: 1, borderColor: 'divider' }} />

        {/* Year Shifts */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} data-testid="year-shifts-stat">
          <Typography variant="body2" color="text.secondary">
            Shifts (Year):
          </Typography>
          <Typography variant="body1" fontWeight={700}>
            {stats.yearShiftsTotal}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ({stats.yearShiftsCompleted} done / {stats.yearShiftsOutstanding} outstanding)
          </Typography>
        </Box>

        <Box sx={{ height: 20, borderLeft: 1, borderColor: 'divider' }} />

        {/* Period Shifts */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} data-testid="period-shifts-stat">
          <Typography variant="body2" color="text.secondary">
            Shifts (Period):
          </Typography>
          <Typography variant="body1" fontWeight={700}>
            {stats.totalShifts}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ({stats.periodShiftsCompleted} done / {stats.periodShiftsOutstanding} outstanding)
          </Typography>
        </Box>

        <Box sx={{ height: 20, borderLeft: 1, borderColor: 'divider' }} />

        {/* Future Shifts */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} data-testid="future-shifts-stat">
          <Typography variant="body2" color="text.secondary">
            Future Shifts:
          </Typography>
          <Typography variant="body1" fontWeight={700}>
            {stats.futureShiftsCount}
          </Typography>
        </Box>

        <Box sx={{ height: 20, borderLeft: 1, borderColor: 'divider' }} />

        {/* Non-Compliant Future Shifts without FAMP */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            borderLeft: 3,
            borderColor: stats.futureNonCompliantShifts > 0 ? 'error.main' : 'success.main',
            pl: 1,
          }}
          data-testid="non-compliant-famp-stat"
        >
          {stats.futureNonCompliantShifts > 0 ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          <Typography variant="body2" color="text.secondary">
            Non-Compliant (No FAMP):
          </Typography>
          <Typography
            variant="body1"
            fontWeight={700}
            sx={{
              color: stats.futureNonCompliantShifts > 0 ? 'error.main' : 'success.main',
            }}
          >
            {stats.futureNonCompliantShifts}
          </Typography>
        </Box>

        <Box sx={{ height: 20, borderLeft: 1, borderColor: 'divider' }} />

        {/* Period Hours */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} data-testid="hours-stat">
          <Typography variant="body2" color="text.secondary">
            Hours:
          </Typography>
          <Typography variant="body1" fontWeight={700}>
            {stats.totalHours}h
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ({stats.totalShifts > 0 ? Math.round((stats.totalHours / stats.totalShifts) * 10) / 10 : 0}h avg)
          </Typography>
        </Box>

        {/* Max FRI - only show if FRI enabled */}
        {showFRI && fatigueAnalysis && (
          <>
            <Box sx={{ height: 20, borderLeft: 1, borderColor: 'divider' }} />
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                borderLeft: 3,
                borderColor:
                  fatigueAnalysis.maxFRI >= 1.2
                    ? 'error.main'
                    : fatigueAnalysis.maxFRI >= 1.1
                    ? 'warning.main'
                    : 'success.main',
                pl: 1,
              }}
              data-testid="fri-stat"
            >
              <Typography variant="body2" color="text.secondary">
                Max FRI:
              </Typography>
              <Typography
                variant="body1"
                fontWeight={700}
                sx={{
                  color:
                    fatigueAnalysis.maxFRI >= 1.2
                      ? 'error.main'
                      : fatigueAnalysis.maxFRI >= 1.1
                      ? 'warning.main'
                      : 'success.main',
                }}
              >
                {fatigueAnalysis.maxFRI.toFixed(3)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ({fatigueAnalysis.criticalShifts} critical)
              </Typography>
            </Box>
          </>
        )}
      </Box>
    </Paper>
  );
}
