# Calculator Components

This folder contains the HSE RR446 Fatigue Calculator components.

## Implementation Status: COMPLETE

The fatigue calculator functionality has been implemented in `/src/components/fatigue/`:

### FatigueView.tsx (Main Component)
Main fatigue assessment tool.
- Shift input grid (up to 28 days)
- Parameter inputs (commute, workload, attention, break settings)
- Real-time fatigue calculations
- Results display with summary cards
- Per-shift breakdown with expandable details
- CSV export functionality
- Print/PDF report generation

### FatigueChart.tsx
SVG line chart showing fatigue index progression.
- Day-by-day FRI values with color-coded data points
- Risk threshold lines (1.0 moderate, 1.1 elevated, 1.2 critical)
- Risk zone background shading
- Optional component breakdown lines (cumulative, timing, job/breaks)
- Interactive legend

### Pattern Templates (Built-in)
Pre-built shift pattern templates:
- Standard 5x8h Days
- 4x12h Day Shifts
- 4x12h Night Shifts
- 7 On / 7 Off Mixed
- Continental (2-2-3)
- Clacton Roster
- Possessions

## Reference
The calculation logic is in `/src/lib/fatigue.ts`.
Based on HSE Research Report RR446 methodology.
