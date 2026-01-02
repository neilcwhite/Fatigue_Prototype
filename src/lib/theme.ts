'use client';

import { createTheme } from '@mui/material/styles';

// Material Design 3 Theme Configuration
// Preserves existing risk level colors and brand colors

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb',      // Blue-600
      light: '#3b82f6',     // Blue-500
      dark: '#1d4ed8',      // Blue-700
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#7c3aed',      // Violet-600
      light: '#8b5cf6',     // Violet-500
      dark: '#6d28d9',      // Violet-700
      contrastText: '#ffffff',
    },
    error: {
      main: '#ef4444',      // Red-500 (risk-critical)
      light: '#f87171',     // Red-400
      dark: '#dc2626',      // Red-600
    },
    warning: {
      main: '#f97316',      // Orange-500 (risk-elevated)
      light: '#fb923c',     // Orange-400
      dark: '#ea580c',      // Orange-600
    },
    success: {
      main: '#22c55e',      // Green-500 (risk-low)
      light: '#4ade80',     // Green-400
      dark: '#16a34a',      // Green-600
    },
    info: {
      main: '#eab308',      // Yellow-500 (risk-moderate)
      light: '#facc15',     // Yellow-400
      dark: '#ca8a04',      // Yellow-600
    },
    background: {
      default: '#f1f5f9',   // Slate-100
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',   // Slate-900
      secondary: '#475569', // Slate-600
    },
    divider: '#e2e8f0',     // Slate-200
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 700,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    button: {
      textTransform: 'none' as const,
      fontWeight: 500,
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.5,
    },
  },
  shape: {
    borderRadius: 8,
  },
  shadows: [
    'none',
    '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 8,
        },
        contained: {
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          },
        },
        sizeSmall: {
          padding: '4px 12px',
          fontSize: '0.8125rem',
        },
        sizeMedium: {
          padding: '8px 16px',
        },
        sizeLarge: {
          padding: '12px 24px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
          '&:hover': {
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        rounded: {
          borderRadius: 12,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
        sizeSmall: {
          height: 24,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1.25rem',
          fontWeight: 600,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          backgroundColor: '#f8fafc', // Slate-50
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#1e293b', // Slate-800
          fontSize: '0.75rem',
        },
      },
    },
  },
});

// Custom risk level colors for FRI display
export const riskColors = {
  low: {
    main: '#22c55e',
    light: '#dcfce7',
    dark: '#166534',
    contrastText: '#ffffff',
  },
  moderate: {
    main: '#eab308',
    light: '#fef9c3',
    dark: '#854d0e',
    contrastText: '#ffffff',
  },
  elevated: {
    main: '#f97316',
    light: '#ffedd5',
    dark: '#9a3412',
    contrastText: '#ffffff',
  },
  critical: {
    main: '#ef4444',
    light: '#fee2e2',
    dark: '#991b1b',
    contrastText: '#ffffff',
  },
};

// Header gradient colors (dark theme for header)
export const headerColors = {
  gradient: 'linear-gradient(to right, #1e293b, #0f172a)',
  borderAccent: '#2563eb',
};
