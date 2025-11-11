import { createContext, useContext, useMemo, useReducer } from 'react';
import {
  assignments as mockAssignments,
  employees as mockEmployees,
  projects as mockProjects,
  shiftPatterns as mockShiftPatterns,
  teams as mockTeams
} from '../data/mockData.js';
import { computeCompliance, groupAssignmentsByProject, isNightShift } from '../utils/compliance.js';

const AppContext = createContext(null);

const createId = () => `id-${Math.random().toString(36).slice(2, 10)}`;

const initialState = {
  employees: mockEmployees,
  teams: mockTeams,
  projects: mockProjects,
  shiftPatterns: mockShiftPatterns,
  assignments: mockAssignments
};

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_SHIFT_PATTERN': {
      const newPattern = {
        ...action.payload,
        id: action.payload.id ?? createId(),
        isNight: isNightShift(action.payload.startTime, action.payload.endTime)
      };
      return {
        ...state,
        shiftPatterns: [...state.shiftPatterns, newPattern]
      };
    }
    case 'UPDATE_SHIFT_PATTERN': {
      const updated = state.shiftPatterns.map((pattern) => (
        pattern.id === action.payload.id
          ? {
              ...pattern,
              ...action.payload,
              isNight: isNightShift(action.payload.startTime, action.payload.endTime)
            }
          : pattern
      ));
      return { ...state, shiftPatterns: updated };
    }
    case 'DELETE_SHIFT_PATTERN': {
      return {
        ...state,
        shiftPatterns: state.shiftPatterns.filter((pattern) => pattern.id !== action.payload.id),
        assignments: state.assignments.filter((assignment) => assignment.shiftPatternId !== action.payload.id)
      };
    }
    case 'ADD_TEAM': {
      const newTeam = { ...action.payload, id: action.payload.id ?? createId() };
      return { ...state, teams: [...state.teams, newTeam] };
    }
    case 'UPDATE_TEAM': {
      return {
        ...state,
        teams: state.teams.map((team) => (team.id === action.payload.id ? { ...team, ...action.payload } : team))
      };
    }
    case 'DELETE_TEAM': {
      return {
        ...state,
        teams: state.teams.filter((team) => team.id !== action.payload.id),
        assignments: state.assignments.filter((assignment) => assignment.assigneeId !== action.payload.id)
      };
    }
    case 'ADD_ASSIGNMENT': {
      const newAssignment = { ...action.payload, id: action.payload.id ?? createId() };
      return { ...state, assignments: [...state.assignments, newAssignment] };
    }
    case 'UPDATE_ASSIGNMENT': {
      return {
        ...state,
        assignments: state.assignments.map((assignment) => (
          assignment.id === action.payload.id ? { ...assignment, ...action.payload } : assignment
        ))
      };
    }
    case 'DELETE_ASSIGNMENT': {
      return {
        ...state,
        assignments: state.assignments.filter((assignment) => assignment.id !== action.payload.id)
      };
    }
    case 'COPY_ASSIGNMENTS_TO_RANGE': {
      const { sourceRange, targetRange, projectId } = action.payload;
      const copies = state.assignments
        .filter((assignment) => assignment.projectId === projectId)
        .filter((assignment) => assignment.startDate === sourceRange.start && assignment.endDate === sourceRange.end)
        .map((assignment) => ({
          ...assignment,
          id: createId(),
          startDate: targetRange.start,
          endDate: targetRange.end
        }));
      return { ...state, assignments: [...state.assignments, ...copies] };
    }
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const compliance = useMemo(() => (
    computeCompliance({
      assignments: state.assignments,
      shiftPatterns: state.shiftPatterns,
      teams: state.teams
    })
  ), [state.assignments, state.shiftPatterns, state.teams]);

  const assignmentsByProject = useMemo(() => (
    groupAssignmentsByProject(state.assignments)
  ), [state.assignments]);

  const value = {
    state,
    dispatch,
    compliance,
    assignmentsByProject
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
