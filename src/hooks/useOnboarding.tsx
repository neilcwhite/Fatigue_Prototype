'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// Onboarding task definitions
export interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  category: 'setup' | 'data' | 'advanced';
  order: number;
  /** Keywords for search - includes related terms users might search for */
  keywords: string[];
}

export const ONBOARDING_TASKS: OnboardingTask[] = [
  {
    id: 'create_project',
    title: 'Create a Project',
    description: 'Set up your first project to organise shifts and employees',
    category: 'setup',
    order: 1,
    keywords: ['project', 'new project', 'add project', 'job', 'site', 'contract', 'work location', 'dashboard', 'start', 'begin', 'setup'],
  },
  {
    id: 'add_employee',
    title: 'Add an Employee',
    description: 'Add your first employee to the system',
    category: 'data',
    order: 2,
    keywords: ['employee', 'staff', 'worker', 'person', 'add person', 'new employee', 'team member', 'name', 'role', 'job title'],
  },
  {
    id: 'import_employees',
    title: 'Import Employees',
    description: 'Bulk import employees from a CSV file',
    category: 'data',
    order: 3,
    keywords: ['import', 'csv', 'spreadsheet', 'excel', 'bulk', 'upload', 'file', 'network rail', 'multiple employees', 'batch'],
  },
  {
    id: 'create_team',
    title: 'Create a Team',
    description: 'Group employees into teams for faster scheduling',
    category: 'setup',
    order: 4,
    keywords: ['team', 'group', 'crew', 'gang', 'squad', 'department', 'members', 'organise', 'organize'],
  },
  {
    id: 'create_shift_pattern',
    title: 'Create a Shift Pattern',
    description: 'Define reusable shift patterns with fatigue scoring',
    category: 'setup',
    order: 5,
    keywords: ['shift', 'pattern', 'shift builder', 'hours', 'working hours', 'schedule', 'roster', 'fatigue', 'FRI', 'risk', 'night shift', 'day shift', 'times', 'start time', 'end time'],
  },
  {
    id: 'assign_shift',
    title: 'Assign a Shift',
    description: 'Drag employees to the schedule in Planning view',
    category: 'data',
    order: 6,
    keywords: ['assign', 'schedule', 'planning', 'drag', 'drop', 'allocation', 'rota', 'roster', 'timeline', 'weekly', 'calendar', 'book'],
  },
  {
    id: 'view_compliance',
    title: 'View Compliance Status',
    description: 'Check fatigue compliance across your workforce',
    category: 'advanced',
    order: 7,
    keywords: ['compliance', 'fatigue', 'hours', 'violations', 'warnings', 'rest', 'break', 'overtime', 'limits', 'rules', 'regulations', 'red', 'amber', 'green', 'status', 'check'],
  },
];

const STORAGE_KEY = 'herdwatch_onboarding';

interface OnboardingState {
  completedTasks: string[];
  dismissed: boolean;
  activeTaskId: string | null;
  showPanel: boolean;
}

interface OnboardingContextValue extends OnboardingState {
  completeTask: (taskId: string) => void;
  uncompleteTask: (taskId: string) => void;
  toggleTaskCompletion: (taskId: string) => void;
  resetOnboarding: () => void;
  dismissOnboarding: () => void;
  undismissOnboarding: () => void;
  setActiveTask: (taskId: string | null) => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  isTaskCompleted: (taskId: string) => boolean;
  getNextTask: () => OnboardingTask | null;
  completionPercentage: number;
  isComplete: boolean;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const defaultState: OnboardingState = {
  completedTasks: [],
  dismissed: false,
  activeTaskId: null,
  showPanel: false,
};

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(defaultState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setState(prev => ({
          ...prev,
          completedTasks: parsed.completedTasks || [],
          dismissed: parsed.dismissed || false,
        }));
      }
    } catch (e) {
      console.error('Failed to load onboarding state:', e);
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          completedTasks: state.completedTasks,
          dismissed: state.dismissed,
        }));
      } catch (e) {
        console.error('Failed to save onboarding state:', e);
      }
    }
  }, [state.completedTasks, state.dismissed, isHydrated]);

  const completeTask = useCallback((taskId: string) => {
    setState(prev => {
      if (prev.completedTasks.includes(taskId)) return prev;
      return {
        ...prev,
        completedTasks: [...prev.completedTasks, taskId],
        activeTaskId: null,
      };
    });
  }, []);

  const uncompleteTask = useCallback((taskId: string) => {
    setState(prev => {
      if (!prev.completedTasks.includes(taskId)) return prev;
      return {
        ...prev,
        completedTasks: prev.completedTasks.filter(id => id !== taskId),
      };
    });
  }, []);

  const toggleTaskCompletion = useCallback((taskId: string) => {
    setState(prev => {
      if (prev.completedTasks.includes(taskId)) {
        return {
          ...prev,
          completedTasks: prev.completedTasks.filter(id => id !== taskId),
        };
      } else {
        return {
          ...prev,
          completedTasks: [...prev.completedTasks, taskId],
          activeTaskId: null,
        };
      }
    });
  }, []);

  const resetOnboarding = useCallback(() => {
    setState({
      ...defaultState,
      showPanel: true,
    });
  }, []);

  const dismissOnboarding = useCallback(() => {
    setState(prev => ({
      ...prev,
      dismissed: true,
      showPanel: false,
    }));
  }, []);

  const undismissOnboarding = useCallback(() => {
    setState(prev => ({
      ...prev,
      dismissed: false,
    }));
  }, []);

  const setActiveTask = useCallback((taskId: string | null) => {
    setState(prev => ({
      ...prev,
      activeTaskId: taskId,
    }));
  }, []);

  const togglePanel = useCallback(() => {
    setState(prev => ({
      ...prev,
      showPanel: !prev.showPanel,
    }));
  }, []);

  const openPanel = useCallback(() => {
    setState(prev => ({
      ...prev,
      showPanel: true,
    }));
  }, []);

  const closePanel = useCallback(() => {
    setState(prev => ({
      ...prev,
      showPanel: false,
    }));
  }, []);

  const isTaskCompleted = useCallback((taskId: string) => {
    return state.completedTasks.includes(taskId);
  }, [state.completedTasks]);

  const getNextTask = useCallback(() => {
    const sortedTasks = [...ONBOARDING_TASKS].sort((a, b) => a.order - b.order);
    return sortedTasks.find(task => !state.completedTasks.includes(task.id)) || null;
  }, [state.completedTasks]);

  const completionPercentage = Math.round(
    (state.completedTasks.length / ONBOARDING_TASKS.length) * 100
  );

  const isComplete = state.completedTasks.length === ONBOARDING_TASKS.length;

  const value: OnboardingContextValue = {
    ...state,
    completeTask,
    uncompleteTask,
    toggleTaskCompletion,
    resetOnboarding,
    dismissOnboarding,
    undismissOnboarding,
    setActiveTask,
    togglePanel,
    openPanel,
    closePanel,
    isTaskCompleted,
    getNextTask,
    completionPercentage,
    isComplete,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
