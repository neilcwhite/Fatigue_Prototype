'use client';

import { useState, useCallback } from 'react';
import type { ShiftPatternCamel, ProjectCamel } from '@/lib/types';

export type FatigueMode = 'entry' | 'review' | 'edit' | 'create';

export interface FatigueModeState {
  mode: FatigueMode;
  isReadOnly: boolean;
  loadedPattern: ShiftPatternCamel | null;
  loadedProject: ProjectCamel | null;
}

export interface UseFatigueModeReturn extends FatigueModeState {
  enterReviewMode: (pattern: ShiftPatternCamel, project: ProjectCamel) => void;
  enterEditMode: (pattern?: ShiftPatternCamel, project?: ProjectCamel) => void;
  enterCreateMode: (project: ProjectCamel) => void;
  resetToEntry: () => void;
  setLoadedPattern: (pattern: ShiftPatternCamel | null) => void;
}

const initialState: FatigueModeState = {
  mode: 'entry',
  isReadOnly: false,
  loadedPattern: null,
  loadedProject: null,
};

export function useFatigueMode(): UseFatigueModeReturn {
  const [state, setState] = useState<FatigueModeState>(initialState);

  const enterReviewMode = useCallback((pattern: ShiftPatternCamel, project: ProjectCamel) => {
    setState({
      mode: 'review',
      isReadOnly: true,
      loadedPattern: pattern,
      loadedProject: project,
    });
  }, []);

  const enterEditMode = useCallback((pattern?: ShiftPatternCamel, project?: ProjectCamel) => {
    setState(prev => ({
      ...prev,
      mode: 'edit',
      isReadOnly: false,
      // If pattern/project provided (direct edit from modal), use them; otherwise keep existing
      loadedPattern: pattern ?? prev.loadedPattern,
      loadedProject: project ?? prev.loadedProject,
    }));
  }, []);

  const enterCreateMode = useCallback((project: ProjectCamel) => {
    setState({
      mode: 'create',
      isReadOnly: false,
      loadedPattern: null,
      loadedProject: project,
    });
  }, []);

  const resetToEntry = useCallback(() => {
    setState(initialState);
  }, []);

  const setLoadedPattern = useCallback((pattern: ShiftPatternCamel | null) => {
    setState(prev => ({
      ...prev,
      loadedPattern: pattern,
    }));
  }, []);

  return {
    ...state,
    enterReviewMode,
    enterEditMode,
    enterCreateMode,
    resetToEntry,
    setLoadedPattern,
  };
}
