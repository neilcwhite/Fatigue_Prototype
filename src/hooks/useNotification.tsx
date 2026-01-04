'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import type { AlertColor } from '@mui/material/Alert';

interface NotificationState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

interface NotificationContextType {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: '',
    severity: 'info',
  });

  const showNotification = useCallback((message: string, severity: AlertColor) => {
    setNotification({ open: true, message, severity });
  }, []);

  const handleClose = useCallback((_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setNotification(prev => ({ ...prev, open: false }));
  }, []);

  const value: NotificationContextType = {
    showSuccess: useCallback((message: string) => showNotification(message, 'success'), [showNotification]),
    showError: useCallback((message: string) => showNotification(message, 'error'), [showNotification]),
    showWarning: useCallback((message: string) => showNotification(message, 'warning'), [showNotification]),
    showInfo: useCallback((message: string) => showNotification(message, 'info'), [showNotification]),
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleClose}
          severity={notification.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    // Return a fallback that uses console.log when used outside provider
    // This prevents breaking existing code during migration
    return {
      showSuccess: (message: string) => console.log('[Success]', message),
      showError: (message: string) => console.error('[Error]', message),
      showWarning: (message: string) => console.warn('[Warning]', message),
      showInfo: (message: string) => console.info('[Info]', message),
    };
  }
  return context;
}
