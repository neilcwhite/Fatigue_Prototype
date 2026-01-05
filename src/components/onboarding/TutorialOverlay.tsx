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

interface TutorialStep {
  title: string;
  description: string;
  tip?: string;
  image?: 'dashboard' | 'teams' | 'planning' | 'shiftbuilder';
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
        description: 'In the sidebar on the left, click "Dashboard". This is the main view where all your projects are displayed.',
        image: 'dashboard',
      },
      {
        title: 'Click "Create New Project"',
        description: 'On the Dashboard, find the card labeled "Create New Project" with a + icon. Click it to open the project creation form.',
      },
      {
        title: 'Enter Project Details',
        description: 'In the popup form, fill in:\n\n• Project Name (required): e.g., "Silverstone Track Works"\n• Start Date (optional)\n• End Date (optional)',
        tip: 'Choose a clear, recognizable name that your team will understand.',
      },
      {
        title: 'Click "Create Project"',
        description: 'Click the "Create Project" button at the bottom of the form. Your new project will appear on the Dashboard.',
      },
    ],
  },
  create_team: {
    taskId: 'create_team',
    title: 'Creating a Team',
    introduction: 'Teams help you organize employees into groups. You can assign entire teams to shifts at once, making scheduling faster.',
    steps: [
      {
        title: 'Go to Teams',
        description: 'In the sidebar on the left, click "Teams".',
        image: 'teams',
      },
      {
        title: 'Click "Create Team" button or card',
        description: 'Either click the purple "Create Team" button at the top right, OR click the "Create New Team" card with the + icon.',
      },
      {
        title: 'Enter Team Name',
        description: 'In the "Create Team" popup:\n\n1. Enter a name in the "Team Name" field\n   Example: "Night Shift Team A"',
      },
      {
        title: 'Select Team Members',
        description: 'Below the name field is "Select Members":\n\n1. You\'ll see a list of all employees\n2. Click the checkbox next to each employee you want to add\n3. The count shows how many are selected',
        tip: 'You need to add employees first before you can add them to a team.',
      },
      {
        title: 'Click "Create Team"',
        description: 'Click the purple "Create Team" button at the bottom right of the popup.\n\nYour team will appear as a card showing the team name and member count.',
      },
    ],
  },
  add_employee: {
    taskId: 'add_employee',
    title: 'Adding an Employee',
    introduction: 'Employees are the people you\'ll be scheduling for shifts. Add them one at a time here.',
    steps: [
      {
        title: 'Go to Teams',
        description: 'In the sidebar on the left, click "Teams".',
        image: 'teams',
      },
      {
        title: 'Click "Add Employee"',
        description: 'At the top right of the page, click the green "Add Employee" button.',
      },
      {
        title: 'Enter Name',
        description: 'In the "Add Employee" popup:\n\n1. Enter the employee\'s full name in the "Name" field\n   Example: "John Smith"',
      },
      {
        title: 'Enter Role (optional)',
        description: 'In the "Role" field, enter their job title:\n   Example: "Track Engineer"\n\nThis is optional but helps with fatigue calculations.',
      },
      {
        title: 'Click "Add Employee"',
        description: 'Click the blue "Add Employee" button at the bottom right.\n\nThe employee will appear in the Employees list on the right side of the page.',
      },
    ],
  },
  import_employees: {
    taskId: 'import_employees',
    title: 'Importing Employees',
    introduction: 'If you have a spreadsheet with employee data, you can import multiple employees at once.',
    steps: [
      {
        title: 'Go to Teams',
        description: 'In the sidebar on the left, click "Teams".',
        image: 'teams',
      },
      {
        title: 'Look for Import Option',
        description: 'On the Teams page, look for an "Import" button (this feature may be coming soon).',
      },
      {
        title: 'Prepare Your Spreadsheet',
        description: 'Your spreadsheet should have columns for:\n\n• Name (required)\n• Role (optional)',
        tip: 'CSV format works best.',
      },
      {
        title: 'Upload and Confirm',
        description: 'Select your file, review the preview, and confirm to add all employees.',
      },
    ],
  },
  create_shift_pattern: {
    taskId: 'create_shift_pattern',
    title: 'Creating a Shift Pattern',
    introduction: 'Shift patterns define working hours for your project. The Shift Builder calculates fatigue risk to help ensure compliance.',
    steps: [
      {
        title: 'Go to Shift Builder',
        description: 'In the sidebar on the left, click "Shift Builder".',
        image: 'shiftbuilder',
      },
      {
        title: 'Select Your Project',
        description: 'When prompted, select the project this shift pattern will belong to. You must have a project created first.',
        tip: 'Each shift pattern is linked to a specific project.',
      },
      {
        title: 'Configure the Week',
        description: 'You\'ll see a 7-day week (Saturday to Friday). For each working day:\n\n• Uncheck "Rest" to make it a working day\n• Set the Start time (e.g., 08:00)\n• Set the End time (e.g., 17:00)',
        tip: 'Watch the FRI (Fatigue Risk Index) column - green is good.',
      },
      {
        title: 'Click "Save as New Pattern"',
        description: 'Click the green "Save as New Pattern" button. Enter a name like "Day Shift Mon-Fri" and click Save.',
      },
    ],
  },
  assign_shift: {
    taskId: 'assign_shift',
    title: 'Assigning Shifts to Employees',
    introduction: 'With a project, shift patterns, and employees set up, you can now schedule people to work.',
    steps: [
      {
        title: 'Select a Project',
        description: 'Go to "Dashboard" and click on a project card to select it.',
        image: 'planning',
      },
      {
        title: 'Open Planning View',
        description: 'Click "Open Planning" on the project card, or click "Planning" in the sidebar (after selecting a project).',
      },
      {
        title: 'Drag Employees to Shifts',
        description: 'At the bottom of the screen is the employee panel. Drag an employee card onto a shift cell (day/row) to assign them.',
        tip: 'Hold Ctrl and click to select multiple employees, then drag them all at once.',
      },
      {
        title: 'Check for Warnings',
        description: 'Employee cards are color-coded:\n\n• Green border = compliant\n• Yellow border = approaching limits\n• Red border = compliance issue\n\nHover over a card to see details.',
      },
    ],
  },
  view_compliance: {
    taskId: 'view_compliance',
    title: 'Viewing Compliance Status',
    introduction: 'HerdWatch automatically tracks fatigue compliance. Here\'s how to review the status.',
    steps: [
      {
        title: 'Open Planning View',
        description: 'Go to "Planning" in the sidebar (you must have a project selected).',
      },
      {
        title: 'Check Employee Colors',
        description: 'In the employee panel at the bottom, cards are color-coded:\n\n• Green = OK\n• Yellow = Warning (approaching limits)\n• Red = Violation (compliance issue)',
      },
      {
        title: 'Hover for Details',
        description: 'Hover over any employee card to see specific warning or violation messages.',
      },
      {
        title: 'Go to Person View',
        description: 'Click "Person View" in the sidebar to see detailed compliance information for the selected employee.',
        tip: 'You must have an employee selected first.',
      },
    ],
  },
};

// Screenshot paths for each page type
const SCREENSHOT_PATHS: Record<string, string> = {
  dashboard: '/tutorials/01-dashboard.png',
  teams: '/tutorials/03-teams-page.png',
  planning: '/tutorials/01-dashboard.png', // Use dashboard until we have planning screenshot
  shiftbuilder: '/tutorials/06-shift-builder.png',
};

// Screenshot component for each page type
function PageScreenshot({ type }: { type: 'dashboard' | 'teams' | 'planning' | 'shiftbuilder' }) {
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
