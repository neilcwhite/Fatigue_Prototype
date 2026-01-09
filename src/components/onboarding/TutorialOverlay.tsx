'use client';

import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import StepContent from '@mui/material/StepContent';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import { X, ChevronRight, ChevronLeft, CheckCircle, Home, Calendar, Users, Settings, Plus } from '@/components/ui/Icons';

type ScreenshotType =
  // Create Project tutorial
  | 'dashboard'
  | 'dashboard-create-project-card'
  | 'create-project-modal'
  | 'create-project-modal-button'
  // Add Employee tutorial
  | 'teams'
  | 'teams-add-employee-button'
  | 'add-employee-modal'
  | 'add-employee-modal-role'
  | 'add-employee-modal-button'
  // Import Employees tutorial
  | 'teams-import-csv-button'
  | 'import-csv-modal'
  | 'import-csv-modal-mapped'
  // Create Team tutorial
  | 'teams-create-team-button'
  | 'create-team-modal'
  | 'create-team-modal-members'
  | 'create-team-modal-button'
  // Shift Builder tutorial
  | 'shiftbuilder'
  | 'shiftbuilder-project-dropdown'
  | 'shiftbuilder-days-config'
  | 'shiftbuilder-save-button'
  // Assign Shift tutorial
  | 'dashboard-project-card'
  | 'planning'
  | 'planning-employee-panel'
  | 'planning-drag-assign'
  | 'shift-pattern-select-modal'
  | 'planning-with-assignments'
  // View Compliance tutorial
  | 'planning-compliance-colors'
  | 'planning-tooltip'
  | 'planning-weekly-view'
  | 'planning-project-dropdown';

interface TutorialStep {
  title: string;
  description: string;
  tip?: string;
  image?: ScreenshotType;
}

interface TutorialContent {
  taskId: string;
  title: string;
  introduction: string;
  steps: TutorialStep[];
  onComplete?: () => void;
}

// Tutorial content for each onboarding task
// IMPORTANT: All button names and menu items must EXACTLY match the UI
const TUTORIAL_CONTENT: Record<string, Omit<TutorialContent, 'onComplete'>> = {
  create_project: {
    taskId: 'create_project',
    title: 'Creating Your First Project',
    introduction: 'Projects are the foundation of HerdWatch. They represent a job site, contract, or work location where you\'ll manage shifts and employees.',
    steps: [
      {
        title: 'Go to Dashboard',
        description: 'In the sidebar on the left, click "Dashboard". This is your home screen where all your projects are displayed as cards.',
        image: 'dashboard',
      },
      {
        title: 'Click "Create New Project"',
        description: 'Find the card with the + icon labelled "Create New Project". Click it to open the project creation dialog.',
        image: 'dashboard-create-project-card',
      },
      {
        title: 'Enter Project Details',
        description: 'In the dialog, fill in:\n\n• Project Name (required): e.g., "Silverstone Track Works"\n• Start Date (optional): When work begins\n• End Date (optional): When work ends',
        tip: 'Choose a clear name that your team will recognise.',
        image: 'create-project-modal',
      },
      {
        title: 'Click "Create Project"',
        description: 'Click the green "Create Project" button. Your new project card will appear on the Dashboard ready to use.',
        image: 'create-project-modal-button',
      },
    ],
  },
  create_team: {
    taskId: 'create_team',
    title: 'Creating a Team',
    introduction: 'Teams let you group employees together. You can drag entire teams to shifts in Planning view, making scheduling much faster.',
    steps: [
      {
        title: 'Go to Team Management',
        description: 'In the sidebar on the left, click "Team Management". This page shows all your teams on the left and all employees on the right.',
        image: 'teams',
      },
      {
        title: 'Click "Create Team"',
        description: 'Click the green "Create Team" button at the top of the Teams section, OR click the "Create New Team" card with the + icon.',
        image: 'teams-create-team-button',
      },
      {
        title: 'Enter Team Name',
        description: 'In the "Create Team" dialog:\n\nEnter a name in the "Team Name" field\nExample: "Night Shift Team A" or "Track Engineers"',
        image: 'create-team-modal',
      },
      {
        title: 'Select Team Members',
        description: 'Below the name field you\'ll see "Select Members":\n\n• A searchable list of all employees appears\n• Click the checkbox next to each person to add\n• The counter shows how many are selected',
        tip: 'You need to add employees first before you can add them to a team.',
        image: 'create-team-modal-members',
      },
      {
        title: 'Click "Create Team"',
        description: 'Click the green "Create Team" button at the bottom.\n\nYour new team card will appear showing the team name and member count.',
        image: 'create-team-modal-button',
      },
    ],
  },
  add_employee: {
    taskId: 'add_employee',
    title: 'Adding an Employee',
    introduction: 'Employees are the people you\'ll be scheduling for shifts. Add them individually here, or use Import to add many at once.',
    steps: [
      {
        title: 'Go to Team Management',
        description: 'In the sidebar on the left, click "Team Management".',
        image: 'teams',
      },
      {
        title: 'Click "Add Employee"',
        description: 'At the top of the Employees section (right side), click the green "Add Employee" button.',
        image: 'teams-add-employee-button',
      },
      {
        title: 'Enter First and Last Name',
        description: 'In the "Add Employee" dialog:\n\n• First Name: e.g., "John"\n• Last Name: e.g., "Smith"',
        image: 'add-employee-modal',
      },
      {
        title: 'Enter Role (optional)',
        description: 'In the "Role" field, enter their job title:\nExample: "Track Engineer" or "Controller"\n\nThis helps identify employees in the schedule.',
        image: 'add-employee-modal-role',
      },
      {
        title: 'Click "Add Employee"',
        description: 'Click the green "Add Employee" button at the bottom.\n\nThe employee will appear in the Employees list on the right.',
        image: 'add-employee-modal-button',
      },
    ],
  },
  import_employees: {
    taskId: 'import_employees',
    title: 'Importing Employees',
    introduction: 'Have a spreadsheet of employees? Import them all at once using a CSV file. This is much faster than adding them one by one.',
    steps: [
      {
        title: 'Go to Team Management',
        description: 'In the sidebar on the left, click "Team Management".',
        image: 'teams',
      },
      {
        title: 'Click "Import CSV"',
        description: 'At the top of the Employees section, click the "Import CSV" button next to Add Employee.',
        image: 'teams-import-csv-button',
      },
      {
        title: 'Prepare Your CSV File',
        description: 'Your CSV file should have columns for:\n\n• First Name (required)\n• Last Name (required)\n• Role (optional)\n\nThe first row should be headers.',
        tip: 'Network Rail format CSVs are also supported and will be auto-detected.',
        image: 'import-csv-modal',
      },
      {
        title: 'Upload and Map Columns',
        description: 'Click "Choose File" to select your CSV. The importer will show a preview. Use the dropdowns to map your columns to the correct fields.',
        image: 'import-csv-modal-mapped',
      },
      {
        title: 'Click "Import"',
        description: 'Review the preview to ensure names look correct, then click "Import" to add all employees at once.',
        image: 'import-csv-modal-mapped',
      },
    ],
  },
  create_shift_pattern: {
    taskId: 'create_shift_pattern',
    title: 'Creating a Shift Pattern',
    introduction: 'Shift patterns define working hours that you can reuse. The Shift Builder shows fatigue risk scores to help you create compliant schedules.',
    steps: [
      {
        title: 'Go to Shift Builder',
        description: 'In the sidebar on the left, click "Shift Builder".',
        image: 'shiftbuilder',
      },
      {
        title: 'Select Your Project',
        description: 'Use the project dropdown at the top to select which project this shift pattern belongs to.',
        tip: 'You must create a project first before creating shift patterns.',
        image: 'shiftbuilder-project-dropdown',
      },
      {
        title: 'Configure Working Days',
        description: 'You\'ll see a 7-day grid (Saturday to Friday). For each day:\n\n• Uncheck "Rest" to mark it as a working day\n• Set Start time (e.g., 07:00)\n• Set End time (e.g., 19:00)\n• The FRI score updates automatically',
        tip: 'Green FRI = low fatigue risk. Red = high risk. Aim for green!',
        image: 'shiftbuilder-days-config',
      },
      {
        title: 'Save the Pattern',
        description: 'Click the green "Save as New Pattern" button at the bottom.\n\nEnter a descriptive name like "Day Shift 07-19" or "Night Possession" and click Save.',
        image: 'shiftbuilder-save-button',
      },
    ],
  },
  assign_shift: {
    taskId: 'assign_shift',
    title: 'Assigning Shifts to Employees',
    introduction: 'Now for the main event! Drag employees onto the schedule to assign them shifts. HerdWatch will calculate fatigue compliance automatically.',
    steps: [
      {
        title: 'Open a Project',
        description: 'From the Dashboard, click on a project card then click "Open Planning" to enter the Planning view.',
        image: 'dashboard-project-card',
      },
      {
        title: 'Find the Employee Panel',
        description: 'At the bottom of Planning view is the employee panel. You\'ll see tabs for "Employees" and "Teams". Click a tab to filter.',
        image: 'planning-employee-panel',
      },
      {
        title: 'Drag to Assign',
        description: 'Drag an employee card from the panel onto a day in the timeline. A dialog will appear to select the shift pattern and date range.',
        tip: 'Hold Ctrl and click to select multiple employees, then drag them all at once!',
        image: 'planning-drag-assign',
      },
      {
        title: 'Select Pattern and Dates',
        description: 'In the dialog:\n\n1. Choose a shift pattern (or Custom for one-off times)\n2. Set the date range if assigning multiple days\n3. Click "Assign" to confirm',
        image: 'shift-pattern-select-modal',
      },
      {
        title: 'Check the Schedule',
        description: 'Assigned shifts appear as colored blocks on the timeline. Employee cards are color-coded:\n\n• Green = compliant\n• Amber = warning\n• Red = violation',
        image: 'planning-with-assignments',
      },
    ],
  },
  view_compliance: {
    taskId: 'view_compliance',
    title: 'Viewing Compliance Status',
    introduction: 'HerdWatch automatically monitors fatigue compliance based on hours worked. Here\'s how to check status and resolve issues.',
    steps: [
      {
        title: 'Check Employee Colors',
        description: 'In Planning view, look at the employee panel at the bottom. Cards are color-coded:\n\n• Green border = all good\n• Amber border = approaching limits\n• Red border = compliance violation',
        image: 'planning-compliance-colors',
      },
      {
        title: 'Hover for Details',
        description: 'Hover over any employee card to see a tooltip with specific warnings:\n\n• Hours worked this week\n• Rest period violations\n• Consecutive day limits',
        image: 'planning-tooltip',
      },
      {
        title: 'Use the Weekly View',
        description: 'Toggle between "Timeline" and "Weekly" views using the buttons at the top. Weekly view shows a clearer breakdown of hours per day.',
        tip: 'Weekly view is great for spotting patterns in overtime.',
        image: 'planning-weekly-view',
      },
      {
        title: 'Switch Projects',
        description: 'Use the project dropdown in the header to quickly switch between projects and check compliance across your portfolio.',
        image: 'planning-project-dropdown',
      },
    ],
  },
};

// Screenshot paths for each page/modal type
const SCREENSHOT_PATHS: Record<ScreenshotType, string> = {
  // Create Project tutorial (01-xx)
  'dashboard': '/tutorials/01-01-dashboard.png',
  'dashboard-create-project-card': '/tutorials/01-02-dashboard-create-project-card.png',
  'create-project-modal': '/tutorials/01-03-create-project-modal.png',
  'create-project-modal-button': '/tutorials/01-04-create-project-modal-button.png',
  // Add Employee tutorial (02-xx)
  'teams': '/tutorials/02-01-teams.png',
  'teams-add-employee-button': '/tutorials/02-02-teams-add-employee-button.png',
  'add-employee-modal': '/tutorials/02-03-add-employee-modal.png',
  'add-employee-modal-role': '/tutorials/02-04-add-employee-modal-role.png',
  'add-employee-modal-button': '/tutorials/02-05-add-employee-modal-button.png',
  // Import Employees tutorial (03-xx)
  'teams-import-csv-button': '/tutorials/03-02-teams-import-csv-button.png',
  'import-csv-modal': '/tutorials/03-03-import-csv-modal.png',
  'import-csv-modal-mapped': '/tutorials/03-04-import-csv-modal-mapped.png',
  // Create Team tutorial (04-xx)
  'teams-create-team-button': '/tutorials/04-02-teams-create-team-button.png',
  'create-team-modal': '/tutorials/04-03-create-team-modal.png',
  'create-team-modal-members': '/tutorials/04-04-create-team-modal-members.png',
  'create-team-modal-button': '/tutorials/04-05-create-team-modal-button.png',
  // Shift Builder tutorial (05-xx)
  'shiftbuilder': '/tutorials/05-01-shiftbuilder.png',
  'shiftbuilder-project-dropdown': '/tutorials/05-02-shiftbuilder-project-dropdown.png',
  'shiftbuilder-days-config': '/tutorials/05-03-shiftbuilder-days-config.png',
  'shiftbuilder-save-button': '/tutorials/05-04-shiftbuilder-save-button.png',
  // Assign Shift tutorial (06-xx)
  'dashboard-project-card': '/tutorials/06-01-dashboard-project-card.png',
  'planning': '/tutorials/06-02-planning.png',
  'planning-employee-panel': '/tutorials/06-02-planning-employee-panel.png',
  'planning-drag-assign': '/tutorials/06-03-planning-drag-assign.png',
  'shift-pattern-select-modal': '/tutorials/06-04-shift-pattern-select-modal.png',
  'planning-with-assignments': '/tutorials/06-05-planning-with-assignments.png',
  // View Compliance tutorial (07-xx)
  'planning-compliance-colors': '/tutorials/07-01-planning-compliance-colors.png',
  'planning-tooltip': '/tutorials/07-02-planning-tooltip.png',
  'planning-weekly-view': '/tutorials/07-03-planning-weekly-view.png',
  'planning-project-dropdown': '/tutorials/07-04-planning-project-dropdown.png',
};

// Screenshot component for each page type
function PageScreenshot({ type }: { type: ScreenshotType }) {
  const src = SCREENSHOT_PATHS[type];

  if (!src) return null;

  return (
    <Box
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'grey.300',
        boxShadow: 1,
      }}
    >
      <Box
        component="img"
        src={src}
        alt={`${type} screenshot`}
        sx={{
          width: '100%',
          height: 'auto',
          display: 'block',
        }}
      />
    </Box>
  );
}

interface TutorialOverlayProps {
  open: boolean;
  taskId: string | null;
  onClose: () => void;
  onStartTask: () => void;
  onMarkComplete: () => void;
}

export function TutorialOverlay({
  open,
  taskId,
  onClose,
  onStartTask,
  onMarkComplete,
}: TutorialOverlayProps) {
  const [activeStep, setActiveStep] = useState(0);

  const content = taskId ? TUTORIAL_CONTENT[taskId] : null;

  if (!content) return null;

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
  };

  const isLastStep = activeStep === content.steps.length - 1;
  const isComplete = activeStep === content.steps.length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3 }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box>
          <Chip
            label="Tutorial"
            size="small"
            color="primary"
            sx={{ mb: 0.5 }}
          />
          <Typography variant="h6" fontWeight={600}>
            {content.title}
          </Typography>
        </Box>
        <Button
          onClick={onClose}
          sx={{ minWidth: 'auto', p: 0.5 }}
        >
          <X className="w-5 h-5" />
        </Button>
      </DialogTitle>

      <DialogContent>
        {activeStep === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {content.introduction}
          </Alert>
        )}

        <Stepper activeStep={activeStep} orientation="vertical">
          {content.steps.map((step, index) => (
            <Step key={index}>
              <StepLabel>
                <Typography fontWeight={activeStep === index ? 600 : 400}>
                  {step.title}
                </Typography>
              </StepLabel>
              <StepContent>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ whiteSpace: 'pre-line', mb: 2 }}
                >
                  {step.description}
                </Typography>

                {step.image && (
                  <Box sx={{ mb: 2 }}>
                    <PageScreenshot type={step.image} />
                  </Box>
                )}

                {step.tip && (
                  <Alert severity="success" sx={{ mb: 2, py: 0.5 }}>
                    <Typography variant="caption">
                      <strong>Tip:</strong> {step.tip}
                    </Typography>
                  </Alert>
                )}

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    disabled={index === 0}
                    onClick={handleBack}
                    size="small"
                    startIcon={<ChevronLeft className="w-4 h-4" />}
                  >
                    Back
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    size="small"
                    endIcon={isLastStep ? <CheckCircle className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  >
                    {isLastStep ? 'Finish Tutorial' : 'Next'}
                  </Button>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>

        {isComplete && (
          <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'success.50', mt: 2 }}>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Tutorial Complete!
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              You now know how to {content.title.toLowerCase()}. Ready to try it yourself?
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
              <Button
                variant="outlined"
                onClick={() => {
                  handleReset();
                }}
              >
                Review Again
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={() => {
                  onMarkComplete();
                  onStartTask();
                }}
                endIcon={<ChevronRight className="w-4 h-4" />}
              >
                Do It Now
              </Button>
            </Box>
          </Paper>
        )}
      </DialogContent>

      {!isComplete && (
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="inherit">
            Close
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              onStartTask();
            }}
          >
            Skip Tutorial & Go There
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
