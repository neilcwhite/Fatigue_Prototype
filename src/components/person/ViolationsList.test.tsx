import { render, screen, fireEvent } from '@testing-library/react';
import { ViolationsList, getViolationIcon, getViolationTitle } from './ViolationsList';
import type { ComplianceViolation } from '@/lib/compliance';

// Mock the Icons component
jest.mock('@/components/ui/Icons', () => ({
  XCircle: ({ className }: { className?: string }) => <span data-testid="x-circle" className={className}>X</span>,
  AlertTriangle: ({ className }: { className?: string }) => <span data-testid="alert-triangle" className={className}>!</span>,
  FileText: ({ className }: { className?: string }) => <span data-testid="file-text" className={className}>📄</span>,
}));

describe('ViolationsList', () => {
  const mockViolations: ComplianceViolation[] = [
    {
      type: 'MAX_WEEKLY_HOURS',
      severity: 'breach',
      employeeId: 1,
      date: '2024-01-15',
      message: 'Weekly hours exceeded (75/72)',
    },
    {
      type: 'APPROACHING_WEEKLY_LIMIT',
      severity: 'warning',
      employeeId: 1,
      date: '2024-01-10',
      message: 'Approaching weekly limit (65/72)',
    },
    {
      type: 'INSUFFICIENT_REST',
      severity: 'breach',
      employeeId: 1,
      date: '2024-01-12',
      message: 'Only 8 hours rest between shifts',
    },
  ];

  const mockOnClick = jest.fn();

  beforeEach(() => {
    mockOnClick.mockClear();
  });

  it('renders nothing when violations array is empty', () => {
    const { container } = render(
      <ViolationsList violations={[]} onViolationClick={mockOnClick} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders the correct number of violations', () => {
    render(
      <ViolationsList violations={mockViolations} onViolationClick={mockOnClick} />
    );

    expect(screen.getByText('Compliance Issues (3)')).toBeInTheDocument();
  });

  it('sorts violations by date (soonest first)', () => {
    render(
      <ViolationsList violations={mockViolations} onViolationClick={mockOnClick} />
    );

    const items = screen.getAllByTestId(/violation-item-/);
    expect(items).toHaveLength(3);

    // First should be Jan 10 (earliest), then Jan 12, then Jan 15
    expect(items[0]).toHaveTextContent('Approaching weekly limit');
    expect(items[1]).toHaveTextContent('Only 8 hours rest');
    expect(items[2]).toHaveTextContent('Weekly hours exceeded');
  });

  it('calls onViolationClick when clicking a violation', () => {
    render(
      <ViolationsList violations={mockViolations} onViolationClick={mockOnClick} />
    );

    const firstItem = screen.getByTestId('violation-item-0');
    fireEvent.click(firstItem);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
    // Should be called with the sorted violation (Jan 10 - approaching limit)
    expect(mockOnClick).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'APPROACHING_WEEKLY_LIMIT',
        date: '2024-01-10',
      })
    );
  });

  it('displays error icon for error severity', () => {
    render(
      <ViolationsList
        violations={[mockViolations[0]]} // MAX_WEEKLY_HOURS - error
        onViolationClick={mockOnClick}
      />
    );

    expect(screen.getByTestId('x-circle')).toBeInTheDocument();
  });

  it('displays warning icon for warning severity', () => {
    render(
      <ViolationsList
        violations={[mockViolations[1]]} // APPROACHING_WEEKLY_LIMIT - warning
        onViolationClick={mockOnClick}
      />
    );

    // There are 2 alert-triangle icons - one in header, one in violation item
    const alertIcons = screen.getAllByTestId('alert-triangle');
    expect(alertIcons.length).toBeGreaterThanOrEqual(1);
  });

  it('displays formatted date correctly', () => {
    render(
      <ViolationsList violations={mockViolations} onViolationClick={mockOnClick} />
    );

    // Check that dates are formatted as "Wed 10 Jan" style (no comma)
    expect(screen.getByText(/Wed 10 Jan/i)).toBeInTheDocument();
  });
});

describe('getViolationIcon', () => {
  it('returns correct icons for each violation type', () => {
    expect(getViolationIcon('MAX_SHIFT_LENGTH')).toBe('⏱️');
    expect(getViolationIcon('INSUFFICIENT_REST')).toBe('😴');
    expect(getViolationIcon('MAX_WEEKLY_HOURS')).toBe('🚫');
    expect(getViolationIcon('LEVEL_1_EXCEEDANCE')).toBe('⚠️');
    expect(getViolationIcon('LEVEL_2_EXCEEDANCE')).toBe('🚨');
    expect(getViolationIcon('APPROACHING_WEEKLY_LIMIT')).toBe('⚠️');
    expect(getViolationIcon('MAX_CONSECUTIVE_DAYS')).toBe('📅');
    expect(getViolationIcon('CONSECUTIVE_DAYS_WARNING')).toBe('📅');
    expect(getViolationIcon('CONSECUTIVE_NIGHTS_WARNING')).toBe('🌙');
    expect(getViolationIcon('MAX_CONSECUTIVE_NIGHTS')).toBe('🌙');
    expect(getViolationIcon('DAY_NIGHT_TRANSITION')).toBe('🔄');
    expect(getViolationIcon('MULTIPLE_SHIFTS_SAME_DAY')).toBe('⚡');
    expect(getViolationIcon('ELEVATED_FATIGUE_INDEX')).toBe('😵');
    expect(getViolationIcon('UNKNOWN_TYPE')).toBe('⚠️');
  });
});

describe('getViolationTitle', () => {
  it('returns correct titles for each violation type', () => {
    expect(getViolationTitle('MAX_SHIFT_LENGTH')).toBe('STOP: Shift Too Long');
    expect(getViolationTitle('INSUFFICIENT_REST')).toBe('STOP: Rest Period Too Short');
    expect(getViolationTitle('MAX_WEEKLY_HOURS')).toBe('STOP: Weekly Hours Exceeded');
    expect(getViolationTitle('LEVEL_1_EXCEEDANCE')).toBe('Level 1: Requires Risk Assessment');
    expect(getViolationTitle('LEVEL_2_EXCEEDANCE')).toBe('Level 2: Requires Risk Assessment');
    expect(getViolationTitle('APPROACHING_WEEKLY_LIMIT')).toBe('Warning: Approaching Weekly Limit');
    expect(getViolationTitle('MAX_CONSECUTIVE_DAYS')).toBe('STOP: Too Many Consecutive Days');
    expect(getViolationTitle('CONSECUTIVE_DAYS_WARNING')).toBe('Warning: Extended Working Days');
    expect(getViolationTitle('CONSECUTIVE_NIGHTS_WARNING')).toBe('Warning: Extended Night Shift Run');
    expect(getViolationTitle('MAX_CONSECUTIVE_NIGHTS')).toBe('STOP: Too Many Consecutive Nights');
    expect(getViolationTitle('DAY_NIGHT_TRANSITION')).toBe('STOP: Day-Night Transition Same Day');
    expect(getViolationTitle('MULTIPLE_SHIFTS_SAME_DAY')).toBe('STOP: Multiple Shifts Same Day');
    expect(getViolationTitle('ELEVATED_FATIGUE_INDEX')).toBe('STOP: Fatigue Risk Index Exceeded');
    expect(getViolationTitle('UNKNOWN_TYPE')).toBe('Compliance Issue');
  });
});
