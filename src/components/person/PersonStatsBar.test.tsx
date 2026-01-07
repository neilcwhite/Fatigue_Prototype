import { render, screen } from '@testing-library/react';
import { PersonStatsBar } from './PersonStatsBar';
import type { ComplianceResult } from '@/lib/compliance';

// Mock the Icons component
jest.mock('@/components/ui/Icons', () => ({
  XCircle: ({ className }: { className?: string }) => <span data-testid="x-circle" className={className}>X</span>,
  AlertTriangle: ({ className }: { className?: string }) => <span data-testid="alert-triangle" className={className}>!</span>,
  CheckCircle: ({ className }: { className?: string }) => <span data-testid="check-circle" className={className}>✓</span>,
}));

describe('PersonStatsBar', () => {
  const mockStats = {
    totalShifts: 10,
    uniqueProjects: 2,
    totalHours: 100,
    nightShifts: 3,
  };

  const mockComplianceClean: ComplianceResult = {
    isCompliant: true,
    hasErrors: false,
    hasWarnings: false,
    violations: [],
    errorCount: 0,
    warningCount: 0,
  };

  const mockComplianceWithWarnings: ComplianceResult = {
    isCompliant: false,
    hasErrors: false,
    hasWarnings: true,
    violations: [
      {
        type: 'APPROACHING_WEEKLY_LIMIT',
        severity: 'warning',
        employeeId: 1,
        date: '2024-01-15',
        message: 'Approaching weekly limit',
      },
    ],
    errorCount: 0,
    warningCount: 1,
  };

  const mockComplianceWithErrors: ComplianceResult = {
    isCompliant: false,
    hasErrors: true,
    hasWarnings: false,
    violations: [
      {
        type: 'MAX_WEEKLY_HOURS',
        severity: 'breach',
        employeeId: 1,
        date: '2024-01-15',
        message: 'Weekly hours exceeded',
      },
    ],
    errorCount: 1,
    warningCount: 0,
  };

  const mockFatigueAnalysis = {
    maxFRI: 1.15,
    avgFRI: 0.95,
    criticalShifts: 0,
    elevatedShifts: 2,
  };

  it('renders basic stats correctly', () => {
    render(
      <PersonStatsBar
        compliance={mockComplianceClean}
        stats={mockStats}
        showFRI={false}
        fatigueAnalysis={null}
      />
    );

    expect(screen.getByTestId('person-stats-bar')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument(); // totalShifts
    expect(screen.getByText('(3 nights)')).toBeInTheDocument();
    expect(screen.getByText('100h')).toBeInTheDocument(); // totalHours
    expect(screen.getByText('2')).toBeInTheDocument(); // uniqueProjects
  });

  it('shows compliance as OK when no violations', () => {
    render(
      <PersonStatsBar
        compliance={mockComplianceClean}
        stats={mockStats}
        showFRI={false}
        fatigueAnalysis={null}
      />
    );

    expect(screen.getByText('0 issues')).toBeInTheDocument();
    expect(screen.getByTestId('check-circle')).toBeInTheDocument();
  });

  it('shows warning icon when there are warnings', () => {
    render(
      <PersonStatsBar
        compliance={mockComplianceWithWarnings}
        stats={mockStats}
        showFRI={false}
        fatigueAnalysis={null}
      />
    );

    expect(screen.getByText('1 issue')).toBeInTheDocument();
    expect(screen.getByTestId('alert-triangle')).toBeInTheDocument();
  });

  it('shows error icon when there are errors', () => {
    render(
      <PersonStatsBar
        compliance={mockComplianceWithErrors}
        stats={mockStats}
        showFRI={false}
        fatigueAnalysis={null}
      />
    );

    expect(screen.getByText('1 issue')).toBeInTheDocument();
    expect(screen.getByTestId('x-circle')).toBeInTheDocument();
  });

  it('shows FRI stats when showFRI is true and data is provided', () => {
    render(
      <PersonStatsBar
        compliance={mockComplianceClean}
        stats={mockStats}
        showFRI={true}
        fatigueAnalysis={mockFatigueAnalysis}
      />
    );

    expect(screen.getByTestId('fri-stat')).toBeInTheDocument();
    expect(screen.getByText('1.150')).toBeInTheDocument(); // maxFRI
    expect(screen.getByText('(0 critical)')).toBeInTheDocument();
  });

  it('hides FRI stats when showFRI is false', () => {
    render(
      <PersonStatsBar
        compliance={mockComplianceClean}
        stats={mockStats}
        showFRI={false}
        fatigueAnalysis={mockFatigueAnalysis}
      />
    );

    expect(screen.queryByTestId('fri-stat')).not.toBeInTheDocument();
  });

  it('calculates average hours correctly', () => {
    render(
      <PersonStatsBar
        compliance={mockComplianceClean}
        stats={mockStats}
        showFRI={false}
        fatigueAnalysis={null}
      />
    );

    // 100 hours / 10 shifts = 10h avg
    expect(screen.getByText('(10h avg)')).toBeInTheDocument();
  });

  it('handles zero shifts without division error', () => {
    const zeroStats = { ...mockStats, totalShifts: 0, totalHours: 0 };

    render(
      <PersonStatsBar
        compliance={mockComplianceClean}
        stats={zeroStats}
        showFRI={false}
        fatigueAnalysis={null}
      />
    );

    expect(screen.getByText('(0h avg)')).toBeInTheDocument();
  });
});
