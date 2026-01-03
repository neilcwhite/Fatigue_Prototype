'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import { Home, Calendar, Users, BarChart, Settings, ChevronLeft, ChevronRight } from '@/components/ui/Icons';

export type ViewMode = 'dashboard' | 'planning' | 'person' | 'summary' | 'fatigue' | 'teams';

interface NavItem {
  id: ViewMode;
  label: string;
  icon: React.ReactNode;
  requiresProject?: boolean;
  requiresEmployee?: boolean;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <Home className="w-5 h-5" /> },
  { id: 'planning', label: 'Planning', icon: <Calendar className="w-5 h-5" />, requiresProject: true },
  { id: 'summary', label: 'Summary', icon: <BarChart className="w-5 h-5" />, requiresProject: true },
  { id: 'person', label: 'Person View', icon: <Users className="w-5 h-5" />, requiresEmployee: true },
  { id: 'teams', label: 'Teams', icon: <Users className="w-5 h-5" /> },
  { id: 'fatigue', label: 'Fatigue', icon: <Settings className="w-5 h-5" /> },
];

interface SidebarProps {
  currentView: ViewMode;
  onNavigate: (view: ViewMode) => void;
  hasSelectedProject: boolean;
  hasSelectedEmployee: boolean;
  selectedProjectName?: string;
  selectedEmployeeName?: string;
}

const DRAWER_WIDTH_EXPANDED = 220;
const DRAWER_WIDTH_COLLAPSED = 64;

export function Sidebar({
  currentView,
  onNavigate,
  hasSelectedProject,
  hasSelectedEmployee,
  selectedProjectName,
  selectedEmployeeName,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const drawerWidth = collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH_EXPANDED;

  const isItemDisabled = (item: NavItem): boolean => {
    if (item.requiresProject && !hasSelectedProject) return true;
    if (item.requiresEmployee && !hasSelectedEmployee) return true;
    return false;
  };

  const getTooltipText = (item: NavItem): string => {
    if (item.requiresProject && !hasSelectedProject) {
      return `${item.label} - Select a project first`;
    }
    if (item.requiresEmployee && !hasSelectedEmployee) {
      return `${item.label} - Select an employee first`;
    }
    return item.label;
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          bgcolor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider',
          transition: 'width 0.2s ease-in-out',
          overflowX: 'hidden',
        },
      }}
    >
      {/* Logo / App Name */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          p: 2,
          minHeight: 64,
        }}
      >
        {!collapsed && (
          <Typography variant="h6" fontWeight="bold" color="primary" noWrap>
            ShiftAdmin
          </Typography>
        )}
        <IconButton onClick={() => setCollapsed(!collapsed)} size="small">
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </IconButton>
      </Box>

      <Divider />

      {/* Navigation Items */}
      <List sx={{ pt: 1 }}>
        {navItems.map((item) => {
          const disabled = isItemDisabled(item);
          const isActive = currentView === item.id;

          const listItemContent = (
            <ListItem key={item.id} disablePadding sx={{ display: 'block' }}>
              <ListItemButton
                onClick={() => !disabled && onNavigate(item.id)}
                disabled={disabled}
                sx={{
                  minHeight: 48,
                  justifyContent: collapsed ? 'center' : 'initial',
                  px: 2.5,
                  bgcolor: isActive ? 'action.selected' : 'transparent',
                  borderLeft: isActive ? '3px solid' : '3px solid transparent',
                  borderColor: isActive ? 'primary.main' : 'transparent',
                  '&:hover': {
                    bgcolor: disabled ? 'transparent' : 'action.hover',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: collapsed ? 0 : 2,
                    justifyContent: 'center',
                    color: isActive ? 'primary.main' : disabled ? 'text.disabled' : 'text.secondary',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: 14,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'primary.main' : disabled ? 'text.disabled' : 'text.primary',
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );

          // Wrap with tooltip when collapsed or disabled
          if (collapsed || disabled) {
            return (
              <Tooltip key={item.id} title={getTooltipText(item)} placement="right" arrow>
                <span>{listItemContent}</span>
              </Tooltip>
            );
          }

          return listItemContent;
        })}
      </List>

      <Divider sx={{ mt: 'auto' }} />

      {/* Context Info (when expanded) */}
      {!collapsed && (hasSelectedProject || hasSelectedEmployee) && (
        <Box sx={{ p: 2 }}>
          {hasSelectedProject && selectedProjectName && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Project
              </Typography>
              <Typography variant="body2" fontWeight="medium" noWrap>
                {selectedProjectName}
              </Typography>
            </Box>
          )}
          {hasSelectedEmployee && selectedEmployeeName && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Employee
              </Typography>
              <Typography variant="body2" fontWeight="medium" noWrap>
                {selectedEmployeeName}
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Drawer>
  );
}

export { DRAWER_WIDTH_EXPANDED, DRAWER_WIDTH_COLLAPSED };
