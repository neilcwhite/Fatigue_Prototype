# Planning Components

This folder contains the planning view components extracted from v76.

## Components to Create

### TimelineView.tsx
28-day timeline grid with employee rows and day columns.
- Horizontal scrolling
- Employee panel (resizable)
- Shift tiles with drag-drop
- Multi-select with Shift+click

### GanttView.tsx
Gantt chart showing shift durations as horizontal bars.
- Time-based x-axis
- Employee rows
- Duration visualization

### WeeklyView.tsx
Saturday-Friday weekly grid (Network Rail convention).
- Compact 7-day view
- Pattern identification

### PlanningViewContainer.tsx
Main container that switches between view modes.
- View mode selector (Timeline/Gantt/Weekly)
- Period navigation
- Import/Export buttons

## Reference
See `fatigue-management-v76.html` lines 2890-7866 for the original implementation.
