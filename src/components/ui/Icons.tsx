// ============================================
// UI ICONS - MUI Material Icons
// Wrapper components maintaining original API
// ============================================

import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PeopleIcon from '@mui/icons-material/People';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoIcon from '@mui/icons-material/Info';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';
import HomeIcon from '@mui/icons-material/Home';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import BarChartIcon from '@mui/icons-material/BarChart';
import CircularProgress from '@mui/material/CircularProgress';
import TableChartIcon from '@mui/icons-material/TableChart';
import DescriptionIcon from '@mui/icons-material/Description';
import PersonIcon from '@mui/icons-material/Person';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RefreshIcon from '@mui/icons-material/Refresh';

interface IconProps {
  className?: string;
}

// Helper to convert Tailwind size classes to pixel sizes
const getSizeFromClass = (className?: string): number => {
  if (!className) return 24;
  // Check smallest sizes first (more specific matches like w-2.5 before w-2)
  if (className.includes('w-2.5') || className.includes('h-2.5')) return 10;
  if (className.includes('w-3.5') || className.includes('h-3.5')) return 14;
  if (className.includes('w-2') || className.includes('h-2')) return 8;
  if (className.includes('w-3') || className.includes('h-3')) return 12;
  if (className.includes('w-4') || className.includes('h-4')) return 16;
  if (className.includes('w-5') || className.includes('h-5')) return 20;
  if (className.includes('w-6') || className.includes('h-6')) return 24;
  if (className.includes('w-8') || className.includes('h-8')) return 32;
  if (className.includes('w-10') || className.includes('h-10')) return 40;
  if (className.includes('w-12') || className.includes('h-12')) return 48;
  return 24;
};

export const Calendar = ({ className = "w-6 h-6" }: IconProps) => (
  <CalendarMonthIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const Users = ({ className = "w-6 h-6" }: IconProps) => (
  <PeopleIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const Clock = ({ className = "w-6 h-6" }: IconProps) => (
  <AccessTimeIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const AlertTriangle = ({ className = "w-6 h-6" }: IconProps) => (
  <WarningIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const ErrorTriangle = ({ className = "w-6 h-6" }: IconProps) => (
  <ErrorIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const CheckCircle = ({ className = "w-6 h-6" }: IconProps) => (
  <CheckCircleIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const XCircle = ({ className = "w-6 h-6" }: IconProps) => (
  <CancelIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const AlertCircle = ({ className = "w-6 h-6" }: IconProps) => (
  <InfoIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const Plus = ({ className = "w-6 h-6" }: IconProps) => (
  <AddIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const Edit2 = ({ className = "w-6 h-6" }: IconProps) => (
  <EditIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const Trash2 = ({ className = "w-6 h-6" }: IconProps) => (
  <DeleteIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const ChevronLeft = ({ className = "w-6 h-6" }: IconProps) => (
  <ChevronLeftIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const ChevronRight = ({ className = "w-6 h-6" }: IconProps) => (
  <ChevronRightIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const ChevronDown = ({ className = "w-6 h-6" }: IconProps) => (
  <ExpandMoreIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const ChevronUp = ({ className = "w-6 h-6" }: IconProps) => (
  <ExpandLessIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const GripVertical = ({ className = "w-6 h-6" }: IconProps) => (
  <DragIndicatorIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const Upload = ({ className = "w-6 h-6" }: IconProps) => (
  <UploadIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const Download = ({ className = "w-6 h-6" }: IconProps) => (
  <DownloadIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const Home = ({ className = "w-6 h-6" }: IconProps) => (
  <HomeIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const X = ({ className = "w-6 h-6" }: IconProps) => (
  <CloseIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const Search = ({ className = "w-6 h-6" }: IconProps) => (
  <SearchIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const Settings = ({ className = "w-6 h-6" }: IconProps) => (
  <SettingsIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const BarChart = ({ className = "w-6 h-6" }: IconProps) => (
  <BarChartIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const Spinner = ({ className = "w-6 h-6" }: IconProps) => (
  <CircularProgress
    size={getSizeFromClass(className)}
    className={className}
  />
);

export const FileSpreadsheet = ({ className = "w-6 h-6" }: IconProps) => (
  <TableChartIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const FileText = ({ className = "w-6 h-6" }: IconProps) => (
  <DescriptionIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const User = ({ className = "w-6 h-6" }: IconProps) => (
  <PersonIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const Copy = ({ className = "w-6 h-6" }: IconProps) => (
  <ContentCopyIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const Check = ({ className = "w-6 h-6" }: IconProps) => (
  <CheckIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const ArrowLeft = ({ className = "w-6 h-6" }: IconProps) => (
  <ArrowBackIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const Eye = ({ className = "w-6 h-6" }: IconProps) => (
  <VisibilityIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const EyeOff = ({ className = "w-6 h-6" }: IconProps) => (
  <VisibilityOffIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const Edit = ({ className = "w-6 h-6" }: IconProps) => (
  <EditIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const Activity = ({ className = "w-6 h-6" }: IconProps) => (
  <ShowChartIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const HelpCircle = ({ className = "w-6 h-6" }: IconProps) => (
  <HelpOutlineIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const Circle = ({ className = "w-6 h-6" }: IconProps) => (
  <RadioButtonUncheckedIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);

export const RotateCcw = ({ className = "w-6 h-6" }: IconProps) => (
  <RefreshIcon
    className={className}
    sx={{ fontSize: getSizeFromClass(className) }}
  />
);
