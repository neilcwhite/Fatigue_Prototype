# Network Rail Fatigue Management Prototype

This repository contains a React prototype for the Network Rail fatigue management planning tool. The prototype focuses on rapid planning workflows, compliance visibility, and a polished stakeholder-ready interface, all backed by rich mock data.

## Features

- **Shift Pattern Builder** – Create, edit, and delete project-specific shift templates with automatic night shift detection.
- **Team Manager** – Maintain organisation-wide teams with easy membership editing for bulk assignments.
- **Planning Workspace** – Switch between timeline, Gantt, and weekly grid views. Drag-and-drop people or teams, copy weeks forward, and capture manual assignments.
- **Compliance Engine** – Enforces Network Rail fatigue rules (max shift length, rest periods, rolling 72-hour limits, and consecutive night detection) across all projects in real time.
- **Person View** – Detailed individual schedule timeline with breaches, warnings, and cumulative hours.
- **Project Summary Dashboard** – Stakeholder-friendly overview with compliance breakdowns and shift pattern analytics.
- **Rich Mock Data** – Five example projects, twenty-five employees, eight shift patterns per project, team structures, and pre-seeded assignments including deliberate breaches for testing.

## Getting Started

```bash
npm install   # install dependencies (may require network access)
npm run dev   # start the Vite development server on http://localhost:5173
```

> **Note:** If the environment blocks access to npmjs.org the install step will fail with a 403 error. In that case, run the above commands in an environment with full registry access.

## Prototype tour

Once the development server is running, open the browser link printed in the terminal (typically `http://localhost:5173`). The prototype loads into the **Dashboard** view by default. Use the persistent navigation menu on the left to move between the core areas:

1. **Dashboard** – Review portfolio-level compliance KPIs and quick project stats.
2. **Project Planning** – Toggle between **Timeline**, **Gantt**, and **Weekly Grid** modes using the tab buttons above the workspace. Drag people or teams from the right-hand drawers into the schedule grid, or use the **Manual assignment** action for precise date ranges.
3. **Person View** – Choose a member of staff from the drop-down to inspect their cross-project calendar, breach timeline, and rest periods.
4. **Shift Pattern Manager** – Create new duty templates, edit existing patterns, or remove ones you no longer need. Changes are applied immediately to the planning tools.
5. **Team Manager** – Maintain organisation-wide teams by adding or removing members. Teams can be assigned in bulk to shifts from the planning views.
6. **Project Summary** – Pick a project to see total planned hours, compliance breakdowns, and shift-type analytics.

Every time you add, edit, or delete an assignment, the compliance indicator lights beside each person will refresh to flag breaches (red), emerging risks (amber), or full compliance (green).

## Tech Stack

- React 18 + Vite
- date-fns for scheduling logic
- React Icons for UI affordances

## Project Structure

```
src/
  components/
    dashboard/        # Dashboard & compliance widgets
    planning/         # Three-mode planning workspace
    people/           # Person compliance view
    shiftPatterns/    # Shift pattern management
    teams/            # Team manager
    summary/          # Project summary report
  context/            # Global data state & actions
  data/               # Mock data sets
  utils/              # Compliance engine utilities
  styles/             # Global styling
```

## Compliance Rules Implemented

1. **Maximum Shift Length** – 12 hours
2. **Minimum Rest Period** – 12 hours between shifts
3. **Rolling Weekly Cap** – 72 hours in any 7-day window with amber warning at 66 hours
4. **Night Shift Tracking** – Highlights three or more consecutive night duties

Each assignment change re-runs the compliance engine so breaches and warnings appear instantly across the UI.
