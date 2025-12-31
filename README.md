# Fatigue Management System

A Network Rail compliant shift planning and fatigue monitoring system, implementing HSE Research Report RR446 fatigue calculations.

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file and add your Supabase credentials
cp .env.local.example .env.local

# Run development server
npm run dev
```

## Architecture Overview

### Technology Stack
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth

### Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout with fonts
│   ├── page.tsx                # Main application entry point
│   └── globals.css             # Tailwind + custom styles
│
├── components/                 # React components
│   ├── auth/                   # Authentication components
│   │   ├── AuthScreen.tsx      # Login/signup form
│   │   └── SignOutHeader.tsx   # User header with sign out
│   │
│   ├── dashboard/              # Dashboard view
│   │   └── Dashboard.tsx       # Project cards, stats, navigation
│   │
│   ├── planning/               # Assignment planning
│   │   ├── PlanningView.tsx    # Main planning container
│   │   ├── TimelineView.tsx    # Timeline grid view
│   │   ├── GanttView.tsx       # Gantt chart view
│   │   └── WeeklyView.tsx      # Weekly calendar view
│   │
│   ├── person/                 # Employee-centric view
│   │   └── PersonView.tsx      # Calendar + fatigue analysis
│   │
│   ├── summary/                # Project summary
│   │   └── SummaryView.tsx     # Stats, compliance, patterns
│   │
│   ├── fatigue/                # Fatigue calculator
│   │   ├── FatigueView.tsx     # Pattern builder + analysis
│   │   └── FatigueChart.tsx    # Risk visualization chart
│   │
│   ├── teams/                  # Team management
│   │   └── TeamsView.tsx       # Create/manage teams
│   │
│   ├── modals/                 # Modal dialogs
│   │   ├── ProjectModal.tsx    # Create project
│   │   ├── ShiftPatternModal.tsx        # Create pattern
│   │   ├── ShiftPatternEditModal.tsx    # Edit pattern
│   │   ├── AssignmentEditModal.tsx      # Edit assignment
│   │   └── CustomTimeModal.tsx          # Custom shift times
│   │
│   └── ui/                     # Shared UI
│       └── Icons.tsx           # Lucide icon exports
│
├── hooks/                      # Custom React hooks
│   ├── useAuth.ts              # Authentication state
│   └── useAppData.ts           # Data fetching & CRUD operations
│
└── lib/                        # Core business logic
    ├── types.ts                # TypeScript interfaces
    ├── supabase.ts             # Supabase client configuration
    ├── fatigue.ts              # HSE RR446 calculations
    ├── compliance.ts           # Network Rail rule checking
    ├── periods.ts              # Network Rail period utilities
    ├── utils.ts                # Shared utility functions
    └── importExport.ts         # Excel import/export
```

## Core Modules

### `/src/lib/types.ts`
TypeScript interfaces for all entities:
- Database types: `Employee`, `Project`, `Team`, `ShiftPattern`, `Assignment`
- CamelCase variants for UI: `EmployeeCamel`, `ProjectCamel`, etc.
- Fatigue types: `FatigueResult`, `RiskLevel`, `ShiftDefinition`
- Compliance types: `ComplianceViolation`, `ViolationType`
- Re-exports `SupabaseUser` from `@supabase/supabase-js`

### `/src/lib/fatigue.ts`
HSE Research Report RR446 fatigue index calculator:
- `calculateFatigueSequence()` - Calculate cumulative fatigue for shift sequence
- `getRiskLevel()` - Classify risk (low/moderate/elevated/critical)
- `DEFAULT_FATIGUE_PARAMS` - Default parameters for calculations
- `FATIGUE_TEMPLATES` - Pre-built shift pattern templates

### `/src/lib/compliance.ts`
Network Rail compliance rule checking (NR/L2/OHS/003):
- `checkProjectCompliance()` - Check all employees on a project
- `checkEmployeeCompliance()` - Check individual employee
- `getEmployeeComplianceStatus()` - Quick status check
- Cross-project analysis for employees working multiple projects

### `/src/lib/periods.ts`
Network Rail 13-period financial year:
- `generateNetworkRailPeriods()` - Generate periods for any year
- `findPeriodForDate()` - Find which period a date falls into
- `getCurrentPeriod()` - Get current period
- `getAvailableYears()` - Get selectable year range

### `/src/lib/utils.ts`
Shared utility functions:
- `getFRIColor()` - CSS classes for FRI values
- `getRiskColor()` - CSS classes for risk levels
- `getViolationMetadata()` - Labels/icons for violations
- Date and time formatting utilities

### `/src/hooks/useAuth.ts`
Authentication hook:
- Session management with auto-refresh
- Profile loading with organisation context
- Sign in/up/out methods

### `/src/hooks/useAppData.ts`
Data management hook:
- Loads all data for current organisation
- Real-time subscriptions for live updates
- CRUD operations for all entities
- Automatic snake_case/camelCase conversion

## Fatigue Risk Index (FRI)

Based on HSE Research Report RR446, the system calculates:

| Factor | Description |
|--------|-------------|
| Cumulative | Sleep debt accumulation over shift sequence |
| Timing | Time-of-day effects (circadian rhythm) |
| Job/Breaks | Work intensity and rest break effects |

### Risk Levels

| FRI Value | Level | Colour | Action |
|-----------|-------|--------|--------|
| < 1.0 | Low | Green | Acceptable |
| 1.0 - 1.1 | Moderate | Yellow | Monitor |
| 1.1 - 1.2 | Elevated | Orange | Review required |
| > 1.2 | Critical | Red | Intervention needed |

### Fatigue Parameters (per shift pattern)

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| Workload | 1-5 | 2 | Physical/mental workload |
| Attention | 1-5 | 1 | Required attention level |
| Commute Time | 0-180 min | 60 | Total daily commute |
| Break Frequency | 30-480 min | 180 | Time between breaks |
| Break Length | 5-60 min | 30 | Duration of breaks |

## Compliance Rules

| Rule | Limit | Source | Severity |
|------|-------|--------|----------|
| Maximum shift duration | 12 hours | NR/L2/OHS/003 | Error |
| Minimum rest between shifts | 12 hours | NR/L2/OHS/003 | Error |
| Maximum weekly hours | 60 hours | Working Time Regs | Warning at 55h |
| Maximum consecutive days | 13 days | NR/L2/OHS/003 | Error |
| Maximum consecutive nights | 4 nights | NR/L2/OHS/003 | Warning at 3 |

## Database Schema

```sql
-- Shift patterns with fatigue parameters
CREATE TABLE shift_patterns (
  id TEXT PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  name TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  weekly_schedule JSONB,
  duty_type TEXT DEFAULT 'Non-Possession',
  is_night BOOLEAN DEFAULT FALSE,
  -- Fatigue parameters
  workload INTEGER,           -- 1-5
  attention INTEGER,          -- 1-5
  commute_time INTEGER,       -- minutes
  break_frequency INTEGER,    -- minutes
  break_length INTEGER,       -- minutes
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Development

```bash
# Run development server
npm run dev

# Type checking
npx tsc --noEmit

# Build for production
npm run build
```

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Code Quality Standards

- **TypeScript**: Strict mode enabled, no `any` types in interfaces
- **Error Handling**: Typed error catching with `instanceof Error`
- **Imports**: Use `@/` path alias for clean imports
- **State**: React hooks with proper typing
- **Styling**: Tailwind CSS with consistent patterns
- **Components**: Single responsibility, props interfaces defined

## Key Features

1. **Dashboard** - Project overview with stats and quick actions
2. **Planning Views** - Timeline, Gantt, and Weekly views for assignment
3. **Drag & Drop** - Assign employees by dragging to calendar cells
4. **Person View** - Employee-centric calendar with fatigue analysis
5. **Real-time FRI** - Live fatigue calculation as parameters change
6. **Cross-Project Compliance** - Check employees across all projects
7. **Team Assignments** - Bulk assign teams to shifts
8. **Excel Import/Export** - Portable assignment data

## License

Proprietary - All rights reserved
