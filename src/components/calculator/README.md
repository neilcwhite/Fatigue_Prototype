# Calculator Components

This folder contains the HSE RR446 Fatigue Calculator components.

## Components to Create

### FatigueCalculator.tsx
Main fatigue assessment tool.
- Shift input grid (up to 14 days)
- Parameter inputs (commute, workload, etc.)
- Calculate button
- Results display

### FatigueChart.tsx
Line chart showing fatigue index progression.
- Day-by-day index values
- Risk threshold lines
- Color coding by risk level

### FatigueResultsTable.tsx
Detailed breakdown table.
- Cumulative component
- Timing component
- Job/breaks component
- Total risk index

### PatternTemplates.tsx
Pre-built shift pattern templates.
- Clacton Roster
- Standard 5-Day
- Night Shift Pattern
- Possession Pattern

## Reference
See `fatigue-management-v76.html` for FatigueAssessmentView implementation.
The calculation logic is already in `/src/lib/fatigue.ts`.
