import { render, screen, fireEvent } from '@testing-library/react';
import { PlanningView } from './PlanningView';
import type { ProjectCamel, EmployeeCamel, AssignmentCamel, ShiftPatternCamel, SupabaseUser } from '@/lib/types';

// Mock the Icons component
jest.mock('@/components/ui/Icons', () => ({
  ChevronLeft: ({ className }: { className?: string }) => <span data-testid="chevron-left" className={className}>←</span>,
  ChevronRight: ({ className }: { className?: string }) => <span data-testid="chevron-right" className={className}>→</span>,
  Download: ({ className }: { className?: string }) => <span data-testid="download-icon" className={className}>↓</span>,
  Upload: ({ className }: { className?: string }) => <span data-testid="upload-icon" className={className}>↑</span>,
  Plus: ({ className }: { className?: string }) => <span data-testid="plus-icon" className={className}>+</span>,
  AlertTriangle: ({ className }: { className?: string }) => <span data-testid="alert-triangle" className={className}>!</span>,
  CheckCircle: ({ className }: { className?: string }) => <span data-testid="check-circle" className={className}>✓</span>,
}));

// Mock the SignOutHeader component
jest.mock('@/components/auth/SignOutHeader', () => ({
  SignOutHeader: ({ user, onSignOut }: { user: SupabaseUser; onSignOut: () => void }) => (
    <button data-testid="sign-out-header" onClick={onSignOut}>
      Sign Out ({user.email})
    </button>
  ),
}));

// Mock the view components
jest.mock('./TimelineView', () => ({
  TimelineView: () => <div data-testid="timeline-view">Timeline View</div>,
}));

jest.mock('./GanttView', () => ({
  GanttView: () => <div data-testid="gantt-view">Gantt View</div>,
}));

jest.mock('./WeeklyView', () => ({
  WeeklyView: () => <div data-testid="weekly-view">Weekly View</div>,
}));

// Mock modals
jest.mock('@/components/modals/CustomTimeModal', () => ({
  CustomTimeModal: () => null,
}));

jest.mock('@/components/modals/ImportModal', () => ({
  ImportModal: () => null,
}));

jest.mock('@/components/modals/AssignmentEditModal', () => ({
  AssignmentEditModal: () => null,
}));

// Mock import/export utilities
jest.mock('@/lib/importExport', () => ({
  exportToExcel: jest.fn(),
  processImport: jest.fn(),
}));

describe('PlanningView', () => {
  const mockUser: SupabaseUser = {
    id: 'user-1',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2024-01-01',
  };

  const mockProject: ProjectCamel = {
    id: 1,
    name: 'Test Project',
    organisationId: 'org-1',
  };

  const mockEmployees: EmployeeCamel[] = [
    { id: 1, name: 'John Doe', organisationId: 'org-1', role: 'Engineer' },
    { id: 2, name: 'Jane Smith', organisationId: 'org-1', role: 'Technician' },
  ];

  const mockShiftPatterns: ShiftPatternCamel[] = [
    {
      id: 'sp-1',
      name: 'Day Shift',
      startTime: '08:00',
      endTime: '18:00',
      projectId: 1,
      organisationId: 'org-1',
      isNight: false,
      dutyType: 'Possession',
    },
    {
      id: 'sp-2',
      name: 'Night Shift',
      startTime: '20:00',
      endTime: '06:00',
      projectId: 1,
      organisationId: 'org-1',
      isNight: true,
      dutyType: 'Possession',
    },
  ];

  const mockAssignments: AssignmentCamel[] = [
    {
      id: 1,
      employeeId: 1,
      projectId: 1,
      shiftPatternId: 'sp-1',
      date: '2024-04-08',
      organisationId: 'org-1',
    },
  ];

  const mockOnBack = jest.fn();
  const mockOnSignOut = jest.fn();
  const mockOnCreateAssignment = jest.fn();
  const mockOnDeleteAssignment = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders project name in header', () => {
    render(
      <PlanningView
        user={mockUser}
        onSignOut={mockOnSignOut}
        project={mockProject}
        employees={mockEmployees}
        assignments={mockAssignments}
        shiftPatterns={mockShiftPatterns}
        onBack={mockOnBack}
        onCreateAssignment={mockOnCreateAssignment}
        onDeleteAssignment={mockOnDeleteAssignment}
      />
    );

    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('renders view mode toggle buttons', () => {
    render(
      <PlanningView
        user={mockUser}
        onSignOut={mockOnSignOut}
        project={mockProject}
        employees={mockEmployees}
        assignments={mockAssignments}
        shiftPatterns={mockShiftPatterns}
        onBack={mockOnBack}
        onCreateAssignment={mockOnCreateAssignment}
        onDeleteAssignment={mockOnDeleteAssignment}
      />
    );

    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('Gantt')).toBeInTheDocument();
    expect(screen.getByText('Weekly Grid')).toBeInTheDocument();
  });

  it('shows timeline view by default', () => {
    render(
      <PlanningView
        user={mockUser}
        onSignOut={mockOnSignOut}
        project={mockProject}
        employees={mockEmployees}
        assignments={mockAssignments}
        shiftPatterns={mockShiftPatterns}
        onBack={mockOnBack}
        onCreateAssignment={mockOnCreateAssignment}
        onDeleteAssignment={mockOnDeleteAssignment}
      />
    );

    expect(screen.getByTestId('timeline-view')).toBeInTheDocument();
  });

  it('switches to gantt view when clicked', () => {
    render(
      <PlanningView
        user={mockUser}
        onSignOut={mockOnSignOut}
        project={mockProject}
        employees={mockEmployees}
        assignments={mockAssignments}
        shiftPatterns={mockShiftPatterns}
        onBack={mockOnBack}
        onCreateAssignment={mockOnCreateAssignment}
        onDeleteAssignment={mockOnDeleteAssignment}
      />
    );

    const ganttButton = screen.getByText('Gantt');
    fireEvent.click(ganttButton);

    expect(screen.getByTestId('gantt-view')).toBeInTheDocument();
  });

  it('switches to weekly view when clicked', () => {
    render(
      <PlanningView
        user={mockUser}
        onSignOut={mockOnSignOut}
        project={mockProject}
        employees={mockEmployees}
        assignments={mockAssignments}
        shiftPatterns={mockShiftPatterns}
        onBack={mockOnBack}
        onCreateAssignment={mockOnCreateAssignment}
        onDeleteAssignment={mockOnDeleteAssignment}
      />
    );

    const weeklyButton = screen.getByText('Weekly Grid');
    fireEvent.click(weeklyButton);

    expect(screen.getByTestId('weekly-view')).toBeInTheDocument();
  });

  it('renders export button', () => {
    render(
      <PlanningView
        user={mockUser}
        onSignOut={mockOnSignOut}
        project={mockProject}
        employees={mockEmployees}
        assignments={mockAssignments}
        shiftPatterns={mockShiftPatterns}
        onBack={mockOnBack}
        onCreateAssignment={mockOnCreateAssignment}
        onDeleteAssignment={mockOnDeleteAssignment}
      />
    );

    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('renders import button', () => {
    render(
      <PlanningView
        user={mockUser}
        onSignOut={mockOnSignOut}
        project={mockProject}
        employees={mockEmployees}
        assignments={mockAssignments}
        shiftPatterns={mockShiftPatterns}
        onBack={mockOnBack}
        onCreateAssignment={mockOnCreateAssignment}
        onDeleteAssignment={mockOnDeleteAssignment}
      />
    );

    expect(screen.getByText('Import')).toBeInTheDocument();
  });

  it('renders PLANNING VIEW chip in header', () => {
    render(
      <PlanningView
        user={mockUser}
        onSignOut={mockOnSignOut}
        project={mockProject}
        employees={mockEmployees}
        assignments={mockAssignments}
        shiftPatterns={mockShiftPatterns}
        onBack={mockOnBack}
        onCreateAssignment={mockOnCreateAssignment}
        onDeleteAssignment={mockOnDeleteAssignment}
      />
    );

    expect(screen.getByText('PLANNING VIEW')).toBeInTheDocument();
  });

  it('renders sign out header with user email', () => {
    render(
      <PlanningView
        user={mockUser}
        onSignOut={mockOnSignOut}
        project={mockProject}
        employees={mockEmployees}
        assignments={mockAssignments}
        shiftPatterns={mockShiftPatterns}
        onBack={mockOnBack}
        onCreateAssignment={mockOnCreateAssignment}
        onDeleteAssignment={mockOnDeleteAssignment}
      />
    );

    expect(screen.getByTestId('sign-out-header')).toBeInTheDocument();
    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
  });

  it('renders with empty employees array', () => {
    render(
      <PlanningView
        user={mockUser}
        onSignOut={mockOnSignOut}
        project={mockProject}
        employees={[]}
        assignments={[]}
        shiftPatterns={mockShiftPatterns}
        onBack={mockOnBack}
        onCreateAssignment={mockOnCreateAssignment}
        onDeleteAssignment={mockOnDeleteAssignment}
      />
    );

    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('renders with empty shift patterns array', () => {
    render(
      <PlanningView
        user={mockUser}
        onSignOut={mockOnSignOut}
        project={mockProject}
        employees={mockEmployees}
        assignments={[]}
        shiftPatterns={[]}
        onBack={mockOnBack}
        onCreateAssignment={mockOnCreateAssignment}
        onDeleteAssignment={mockOnDeleteAssignment}
      />
    );

    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('renders year selector dropdown', () => {
    render(
      <PlanningView
        user={mockUser}
        onSignOut={mockOnSignOut}
        project={mockProject}
        employees={mockEmployees}
        assignments={mockAssignments}
        shiftPatterns={mockShiftPatterns}
        onBack={mockOnBack}
        onCreateAssignment={mockOnCreateAssignment}
        onDeleteAssignment={mockOnDeleteAssignment}
      />
    );

    // Multiple comboboxes are present (year, period, etc.)
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBeGreaterThan(0);
  });
});
