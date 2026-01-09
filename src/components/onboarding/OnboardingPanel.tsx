'use client';

import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { X, CheckCircle, Circle, ChevronRight, RotateCcw, Search } from '@/components/ui/Icons';
import { useOnboarding, ONBOARDING_TASKS, OnboardingTask } from '@/hooks/useOnboarding';

interface OnboardingPanelProps {
  onStartTask?: (taskId: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  setup: 'Setup',
  data: 'Add Data',
  advanced: 'Advanced',
};

const CATEGORY_COLORS: Record<string, string> = {
  setup: '#233e99',
  data: '#059669',
  advanced: '#7c3aed',
};

// Helper function to highlight matching text
function HighlightedText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight.trim()) {
    return <>{text}</>;
  }

  const query = highlight.toLowerCase();
  const lowerText = text.toLowerCase();
  const startIndex = lowerText.indexOf(query);

  if (startIndex === -1) {
    return <>{text}</>;
  }

  const endIndex = startIndex + query.length;

  return (
    <>
      {text.slice(0, startIndex)}
      <Box
        component="span"
        sx={{
          bgcolor: 'rgba(35, 62, 153, 0.2)',
          borderRadius: 0.5,
          px: 0.25,
        }}
      >
        {text.slice(startIndex, endIndex)}
      </Box>
      {text.slice(endIndex)}
    </>
  );
}

function TaskItem({
  task,
  isCompleted,
  isActive,
  onStart,
  onToggleComplete,
  searchQuery = '',
}: {
  task: OnboardingTask;
  isCompleted: boolean;
  isActive: boolean;
  onStart: () => void;
  onToggleComplete: () => void;
  searchQuery?: string;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        p: 1.5,
        borderRadius: 1,
        bgcolor: isActive ? 'rgba(35, 62, 153, 0.08)' : 'transparent',
        border: '1px solid',
        borderColor: isActive ? '#233e99' : 'transparent',
        transition: 'all 0.2s',
        cursor: 'pointer',
        '&:hover': {
          bgcolor: isCompleted ? 'rgba(5, 150, 105, 0.05)' : 'rgba(35, 62, 153, 0.05)',
        },
      }}
      onClick={!isCompleted ? onStart : undefined}
    >
      {/* Checkbox - only clickable when completed (to uncomplete) */}
      <Box
        sx={{
          mt: 0.25,
          color: isCompleted ? '#059669' : '#94a3b8',
          cursor: isCompleted ? 'pointer' : 'default',
          '&:hover': isCompleted ? {
            color: '#047857',
          } : {},
        }}
        onClick={isCompleted ? (e) => {
          e.stopPropagation();
          onToggleComplete();
        } : undefined}
        title={isCompleted ? 'Click to mark as incomplete' : undefined}
      >
        {isCompleted ? (
          <CheckCircle className="w-5 h-5" />
        ) : (
          <Circle className="w-5 h-5" />
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
          <Typography
            variant="body2"
            component="span"
            sx={{
              fontWeight: 500,
              color: isCompleted ? '#64748b' : '#1e293b',
              textDecoration: isCompleted ? 'line-through' : 'none',
            }}
          >
            <HighlightedText text={task.title} highlight={searchQuery} />
          </Typography>
          <Chip
            label={CATEGORY_LABELS[task.category]}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              bgcolor: `${CATEGORY_COLORS[task.category]}15`,
              color: CATEGORY_COLORS[task.category],
              fontWeight: 500,
            }}
          />
        </Box>
        <Typography
          variant="caption"
          component="span"
          sx={{
            color: isCompleted ? '#94a3b8' : '#64748b',
            display: 'block',
          }}
        >
          <HighlightedText text={task.description} highlight={searchQuery} />
        </Typography>
      </Box>
      {!isCompleted && (
        <Box sx={{ color: '#94a3b8', mt: 0.25 }}>
          <ChevronRight className="w-4 h-4" />
        </Box>
      )}
    </Box>
  );
}

// Helper function to check if a task matches the search query
function taskMatchesSearch(task: OnboardingTask, searchQuery: string): boolean {
  const query = searchQuery.toLowerCase().trim();
  if (!query) return true;

  // Check title
  if (task.title.toLowerCase().includes(query)) return true;

  // Check description
  if (task.description.toLowerCase().includes(query)) return true;

  // Check keywords
  if (task.keywords.some(keyword => keyword.toLowerCase().includes(query))) return true;

  return false;
}

export function OnboardingPanel({ onStartTask }: OnboardingPanelProps) {
  const {
    showPanel,
    closePanel,
    completedTasks,
    completionPercentage,
    isComplete,
    dismissed,
    resetOnboarding,
    dismissOnboarding,
    undismissOnboarding,
    setActiveTask,
    activeTaskId,
    toggleTaskCompletion,
  } = useOnboarding();

  const [searchQuery, setSearchQuery] = useState('');

  const handleStartTask = (taskId: string) => {
    setActiveTask(taskId);
    closePanel();
    onStartTask?.(taskId);
  };

  const sortedTasks = [...ONBOARDING_TASKS].sort((a, b) => a.order - b.order);

  // Filter tasks based on search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return sortedTasks;
    return sortedTasks.filter(task => taskMatchesSearch(task, searchQuery));
  }, [sortedTasks, searchQuery]);

  // Check if we're in search mode with results
  const isSearching = searchQuery.trim().length > 0;
  const hasSearchResults = filteredTasks.length > 0;

  return (
    <Drawer
      anchor="right"
      open={showPanel}
      onClose={closePanel}
      PaperProps={{
        sx: {
          width: 380,
          maxWidth: '100vw',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6" fontWeight={600}>
              Getting Started
            </Typography>
            <IconButton size="small" onClick={closePanel}>
              <X className="w-5 h-5" />
            </IconButton>
          </Box>

          {/* Search Input */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search tutorials... (e.g. shift, import, compliance)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search className="w-4 h-4 text-slate-400" />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery('')} edge="end">
                    <X className="w-4 h-4" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {/* Progress - hide when searching */}
          {!isSearching && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <LinearProgress
                variant="determinate"
                value={completionPercentage}
                sx={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  bgcolor: '#e2e8f0',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: isComplete ? '#059669' : '#233e99',
                    borderRadius: 4,
                  },
                }}
              />
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                {completedTasks.length}/{ONBOARDING_TASKS.length}
              </Typography>
            </Box>
          )}

          {/* Search results count */}
          {isSearching && (
            <Typography variant="body2" color="text.secondary">
              {hasSearchResults
                ? `Found ${filteredTasks.length} tutorial${filteredTasks.length !== 1 ? 's' : ''} matching "${searchQuery}"`
                : `No tutorials found for "${searchQuery}"`}
            </Typography>
          )}
        </Box>

        {/* Task List */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {/* No search results */}
          {isSearching && !hasSearchResults ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Try searching for:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                {['shift', 'employee', 'team', 'import', 'compliance', 'project'].map((term) => (
                  <Chip
                    key={term}
                    label={term}
                    size="small"
                    onClick={() => setSearchQuery(term)}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Box>
          ) : isComplete && !isSearching ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Box sx={{ color: '#059669', display: 'flex', justifyContent: 'center', mb: 2 }}>
                <CheckCircle className="w-12 h-12" />
              </Box>
              <Typography variant="h6" gutterBottom>
                All Done!
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                You&apos;ve completed all the setup tasks. HerdWatch is ready to use.
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RotateCcw className="w-4 h-4" />}
                onClick={resetOnboarding}
              >
                Reset Tutorial
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {filteredTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  isCompleted={completedTasks.includes(task.id)}
                  isActive={activeTaskId === task.id}
                  onStart={() => handleStartTask(task.id)}
                  onToggleComplete={() => toggleTaskCompletion(task.id)}
                  searchQuery={searchQuery}
                />
              ))}
            </Box>
          )}
        </Box>

        {/* Footer */}
        <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          {isComplete ? (
            // When complete, no footer actions needed
            null
          ) : dismissed ? (
            // When dismissed but not complete, offer to show on dashboard again
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={undismissOnboarding}
              sx={{ color: '#233e99', borderColor: '#233e99' }}
            >
              Show on Dashboard
            </Button>
          ) : (
            // When not dismissed and not complete, offer to skip
            <Button
              fullWidth
              variant="text"
              size="small"
              onClick={dismissOnboarding}
              sx={{ color: 'text.secondary' }}
            >
              Hide from Dashboard
            </Button>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
