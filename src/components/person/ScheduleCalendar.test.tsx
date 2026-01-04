import { render, screen, fireEvent } from '@testing-library/react';
import {
  ScheduleCalendar,
  getFRIChipSx,
  getNRComplianceChipSx,
  getFRICellSx,
  formatDateHeader,
  hasCustomTimes,
  getAssignmentDisplayName,
} from './ScheduleCalendar';
import type { AssignmentCamel, ShiftPatternCamel, ProjectCamel, NetworkRailPeriod } from '@/lib/types';

// Mock the Icons component
jest.mock('@/components/ui/Icons', () => ({
  Calendar: ({ className }: { className?: string }) => <span data-testid="calendar-icon" className={className}>📅</span>,
  Edit2: ({ className }: { className?: string }) => <span data-testid="edit-icon" className={className}>✏️</span>,
  Trash2: ({ className }: { className?: string }) => <span data-testid="trash-icon" className={className}>🗑️</span>,
}));

describe('ScheduleCalendar Helper Functions', () => {
  describe('getFRIChipSx', () => {
    it('returns grey for null/undefined FRI', () => {
      expect(getFRIChipSx(null)).toEqual({ bgcolor: 'grey.200', color: 'grey.700' });
      expect(getFRIChipSx(undefined)).toEqual({ bgcolor: 'grey.200', color: 'grey.700' });
    });

    it('returns red for critical FRI (>= 1.2)', () => {
      expect(getFRIChipSx(1.2)).toEqual({ bgcolor: '#dc2626', color: 'white' });
      expect(getFRIChipSx(1.5)).toEqual({ bgcolor: '#dc2626', color: 'white' });
    });

    it('returns orange for elevated FRI (1.1-1.2)', () => {
      expect(getFRIChipSx(1.1)).toEqual({ bgcolor: '#f97316', color: 'white' });
      expect(getFRIChipSx(1.15)).toEqual({ bgcolor: '#f97316', color: 'white' });
    });

    it('returns yellow for moderate FRI (1.0-1.1)', () => {
      expect(getFRIChipSx(1.0)).toEqual({ bgcolor: '#eab308', color: 'white' });
      expect(getFRIChipSx(1.05)).toEqual({ bgcolor: '#eab308', color: 'white' });
    });

    it('returns green for low FRI (< 1.0)', () => {
      expect(getFRIChipSx(0.9)).toEqual({ bgcolor: '#22c55e', color: 'white' });
      expect(getFRIChipSx(0.5)).toEqual({ bgcolor: '#22c55e', color: 'white' });
    });
  });

  describe('getNRComplianceChipSx', () => {
    it('returns red for error severity', () => {
      expect(getNRComplianceChipSx('error')).toEqual({ bgcolor: '#dc2626', color: 'white' });
    });

    it('returns amber for warning severity', () => {
      expect(getNRComplianceChipSx('warning')).toEqual({ bgcolor: '#f59e0b', color: 'white' });
    });

    it('returns green for null severity (compliant)', () => {
      expect(getNRComplianceChipSx(null)).toEqual({ bgcolor: '#22c55e', color: 'white' });
    });
  });

  describe('getFRICellSx', () => {
    it('returns white for null/undefined', () => {
      expect(getFRICellSx(null)).toEqual({ bgcolor: 'white', borderColor: 'grey.200' });
      expect(getFRICellSx(undefined)).toEqual({ bgcolor: 'white', borderColor: 'grey.200' });
    });

    it('returns error colors for critical FRI', () => {
      expect(getFRICellSx(1.2)).toEqual({ bgcolor: 'error.light', borderColor: 'error.main' });
    });

    it('returns warning colors for elevated FRI', () => {
      expect(getFRICellSx(1.1)).toEqual({ bgcolor: 'warning.light', borderColor: 'warning.main' });
    });

    it('returns warning.50 for moderate FRI', () => {
      expect(getFRICellSx(1.0)).toEqual({ bgcolor: 'warning.50', borderColor: 'warning.300' });
    });

    it('returns success colors for low FRI', () => {
      expect(getFRICellSx(0.9)).toEqual({ bgcolor: 'success.light', borderColor: 'success.light' });
    });
  });

  describe('formatDateHeader', () => {
    it('parses date string correctly', () => {
      const result = formatDateHeader('2024-01-15');
      expect(result.date).toBe(15);
      expect(result.month).toBe('Jan');
    });

    it('identifies weekends correctly', () => {
      // Saturday, Jan 13, 2024
      expect(formatDateHeader('2024-01-13').isWeekend).toBe(true);
      // Sunday, Jan 14, 2024
      expect(formatDateHeader('2024-01-14').isWeekend).toBe(true);
      // Monday, Jan 15, 2024
      expect(formatDateHeader('2024-01-15').isWeekend).toBe(false);
    });
  });

  describe('hasCustomTimes', () => {
    const mockPattern: ShiftPatternCamel = {
      id: 'p1',
      name: 'Day Shift',
      startTime: '08:00',
      endTime: '16:00',
      projectId: 1,
      organisationId: 'org1',
      isNight: false,
      dutyType: 'Possession',
    };

    it('returns false when no custom times', () => {
      const assignment: AssignmentCamel = {
        id: 1,
        employeeId: 1,
        projectId: 1,
        shiftPatternId: 'p1',
        date: '2024-01-15',
        organisationId: 'org1',
      };
      expect(hasCustomTimes(assignment, mockPattern)).toBe(false);
    });

    it('returns false when custom times match pattern times', () => {
      const assignment: AssignmentCamel = {
        id: 1,
        employeeId: 1,
        projectId: 1,
        shiftPatternId: 'p1',
        date: '2024-01-15',
        customStartTime: '08:00',
        customEndTime: '16:00',
        organisationId: 'org1',
      };
      expect(hasCustomTimes(assignment, mockPattern)).toBe(false);
    });

    it('returns true when custom start time differs', () => {
      const assignment: AssignmentCamel = {
        id: 1,
        employeeId: 1,
        projectId: 1,
        shiftPatternId: 'p1',
        date: '2024-01-15',
        customStartTime: '09:00',
        organisationId: 'org1',
      };
      expect(hasCustomTimes(assignment, mockPattern)).toBe(true);
    });

    it('returns true when custom end time differs', () => {
      const assignment: AssignmentCamel = {
        id: 1,
        employeeId: 1,
        projectId: 1,
        shiftPatternId: 'p1',
        date: '2024-01-15',
        customEndTime: '18:00',
        organisationId: 'org1',
      };
      expect(hasCustomTimes(assignment, mockPattern)).toBe(true);
    });

    it('returns false when pattern is undefined', () => {
      const assignment: AssignmentCamel = {
        id: 1,
        employeeId: 1,
        projectId: 1,
        shiftPatternId: 'p1',
        date: '2024-01-15',
        customStartTime: '09:00',
        organisationId: 'org1',
      };
      expect(hasCustomTimes(assignment, undefined)).toBe(false);
    });
  });

  describe('getAssignmentDisplayName', () => {
    const mockPattern: ShiftPatternCamel = {
      id: 'p1',
      name: 'Day Shift',
      startTime: '08:00',
      endTime: '16:00',
      projectId: 1,
      organisationId: 'org1',
      isNight: false,
      dutyType: 'Possession',
    };

    it('returns pattern name when no custom times', () => {
      const assignment: AssignmentCamel = {
        id: 1,
        employeeId: 1,
        projectId: 1,
        shiftPatternId: 'p1',
        date: '2024-01-15',
        organisationId: 'org1',
      };
      expect(getAssignmentDisplayName(assignment, mockPattern)).toBe('Day Shift');
    });

    it('returns "Custom" when custom times are set', () => {
      const assignment: AssignmentCamel = {
        id: 1,
        employeeId: 1,
        projectId: 1,
        shiftPatternId: 'p1',
        date: '2024-01-15',
        customStartTime: '09:00',
        customEndTime: '17:00',
        organisationId: 'org1',
      };
      expect(getAssignmentDisplayName(assignment, mockPattern)).toBe('Custom');
    });

    it('returns "Unknown" when pattern is undefined', () => {
      const assignment: AssignmentCamel = {
        id: 1,
        employeeId: 1,
        projectId: 1,
        shiftPatternId: 'p1',
        date: '2024-01-15',
        organisationId: 'org1',
      };
      expect(getAssignmentDisplayName(assignment, undefined)).toBe('Unknown');
    });
  });
});

describe('ScheduleCalendar Component', () => {
  const mockPeriod: NetworkRailPeriod = {
    period: 1,
    name: 'Period 1 (2024/25)',
    startDate: '2024-04-06',
    endDate: '2024-05-03',
    year: 2024,
  };

  const mockShiftPatterns: ShiftPatternCamel[] = [
    {
      id: 'p1',
      name: 'Day Shift',
      startTime: '08:00',
      endTime: '16:00',
      projectId: 1,
      organisationId: 'org1',
      isNight: false,
      dutyType: 'Possession',
    },
  ];

  const mockProjects: ProjectCamel[] = [
    {
      id: 1,
      name: 'Test Project',
      organisationId: 'org1',
    },
  ];

  const mockAssignments: AssignmentCamel[] = [
    {
      id: 1,
      employeeId: 1,
      projectId: 1,
      shiftPatternId: 'p1',
      date: '2024-04-08',
      organisationId: 'org1',
    },
  ];

  // Generate 28 days of calendar dates
  const generateCalendarDates = (startDate: string): string[] => {
    const dates: string[] = [];
    const [year, month, day] = startDate.split('-').map(Number);
    const start = new Date(year, month - 1, day);
    for (let i = 0; i < 28; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    return dates;
  };

  const mockCalendarDates = generateCalendarDates('2024-04-06');
  const mockCalendarDayHeaders = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const mockViolationSeverity = new Map<number, 'error' | 'warning'>();
  const mockOnDelete = jest.fn();
  const mockOnEdit = jest.fn();

  beforeEach(() => {
    mockOnDelete.mockClear();
    mockOnEdit.mockClear();
  });

  it('renders the calendar with period name', () => {
    render(
      <ScheduleCalendar
        currentPeriod={mockPeriod}
        calendarDates={mockCalendarDates}
        calendarDayHeaders={mockCalendarDayHeaders}
        periodAssignments={[]}
        shiftPatterns={mockShiftPatterns}
        projects={mockProjects}
        violationAssignmentSeverity={mockViolationSeverity}
        fatigueResults={null}
        highlightedDate={null}
        showFRI={false}
        onDeleteAssignment={mockOnDelete}
      />
    );

    expect(screen.getByText('Schedule - Period 1 (2024/25)')).toBeInTheDocument();
  });

  it('renders day headers correctly', () => {
    render(
      <ScheduleCalendar
        currentPeriod={mockPeriod}
        calendarDates={mockCalendarDates}
        calendarDayHeaders={mockCalendarDayHeaders}
        periodAssignments={[]}
        shiftPatterns={mockShiftPatterns}
        projects={mockProjects}
        violationAssignmentSeverity={mockViolationSeverity}
        fatigueResults={null}
        highlightedDate={null}
        showFRI={false}
        onDeleteAssignment={mockOnDelete}
      />
    );

    mockCalendarDayHeaders.forEach((day) => {
      expect(screen.getByText(day)).toBeInTheDocument();
    });
  });

  it('renders 28 calendar cells', () => {
    render(
      <ScheduleCalendar
        currentPeriod={mockPeriod}
        calendarDates={mockCalendarDates}
        calendarDayHeaders={mockCalendarDayHeaders}
        periodAssignments={[]}
        shiftPatterns={mockShiftPatterns}
        projects={mockProjects}
        violationAssignmentSeverity={mockViolationSeverity}
        fatigueResults={null}
        highlightedDate={null}
        showFRI={false}
        onDeleteAssignment={mockOnDelete}
      />
    );

    const cells = screen.getAllByTestId(/calendar-cell-/);
    expect(cells).toHaveLength(28);
  });

  it('renders assignments in the correct cell', () => {
    render(
      <ScheduleCalendar
        currentPeriod={mockPeriod}
        calendarDates={mockCalendarDates}
        calendarDayHeaders={mockCalendarDayHeaders}
        periodAssignments={mockAssignments}
        shiftPatterns={mockShiftPatterns}
        projects={mockProjects}
        violationAssignmentSeverity={mockViolationSeverity}
        fatigueResults={null}
        highlightedDate={null}
        showFRI={false}
        onDeleteAssignment={mockOnDelete}
      />
    );

    const cell = screen.getByTestId('calendar-cell-2024-04-08');
    expect(cell).toContainElement(screen.getByText('Test Project'));
    expect(cell).toContainElement(screen.getByText('Day Shift'));
  });

  it('calls onDeleteAssignment when delete button is clicked', () => {
    render(
      <ScheduleCalendar
        currentPeriod={mockPeriod}
        calendarDates={mockCalendarDates}
        calendarDayHeaders={mockCalendarDayHeaders}
        periodAssignments={mockAssignments}
        shiftPatterns={mockShiftPatterns}
        projects={mockProjects}
        violationAssignmentSeverity={mockViolationSeverity}
        fatigueResults={null}
        highlightedDate={null}
        showFRI={false}
        onDeleteAssignment={mockOnDelete}
      />
    );

    const deleteButton = screen.getByRole('button', { name: /delete assignment/i });
    fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith(mockAssignments[0]);
  });

  it('calls onEditAssignment when edit button is clicked', () => {
    render(
      <ScheduleCalendar
        currentPeriod={mockPeriod}
        calendarDates={mockCalendarDates}
        calendarDayHeaders={mockCalendarDayHeaders}
        periodAssignments={mockAssignments}
        shiftPatterns={mockShiftPatterns}
        projects={mockProjects}
        violationAssignmentSeverity={mockViolationSeverity}
        fatigueResults={null}
        highlightedDate={null}
        showFRI={false}
        onEditAssignment={mockOnEdit}
        onDeleteAssignment={mockOnDelete}
      />
    );

    const editButton = screen.getByRole('button', { name: /edit assignment/i });
    fireEvent.click(editButton);

    expect(mockOnEdit).toHaveBeenCalledWith(mockAssignments[0]);
  });

  it('shows FRI legend when showFRI is true', () => {
    render(
      <ScheduleCalendar
        currentPeriod={mockPeriod}
        calendarDates={mockCalendarDates}
        calendarDayHeaders={mockCalendarDayHeaders}
        periodAssignments={[]}
        shiftPatterns={mockShiftPatterns}
        projects={mockProjects}
        violationAssignmentSeverity={mockViolationSeverity}
        fatigueResults={null}
        highlightedDate={null}
        showFRI={true}
        onDeleteAssignment={mockOnDelete}
      />
    );

    expect(screen.getByText('Cell (FRI):')).toBeInTheDocument();
    expect(screen.getByText('<1.0')).toBeInTheDocument();
    expect(screen.getByText('>=1.2')).toBeInTheDocument();
  });

  it('hides FRI legend when showFRI is false', () => {
    render(
      <ScheduleCalendar
        currentPeriod={mockPeriod}
        calendarDates={mockCalendarDates}
        calendarDayHeaders={mockCalendarDayHeaders}
        periodAssignments={[]}
        shiftPatterns={mockShiftPatterns}
        projects={mockProjects}
        violationAssignmentSeverity={mockViolationSeverity}
        fatigueResults={null}
        highlightedDate={null}
        showFRI={false}
        onDeleteAssignment={mockOnDelete}
      />
    );

    expect(screen.queryByText('Cell (FRI):')).not.toBeInTheDocument();
  });
});
