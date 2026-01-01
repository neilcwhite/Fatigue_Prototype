# Fatigue Management System

A Network Rail compliant shift planning and fatigue monitoring system, implementing HSE Research Report RR446 fatigue calculations.

**Version**: 2.0 (January 2026)

## Recent Updates

### Security Enhancements (v2.0)
- **Tenant Isolation**: All database mutations now include `organisation_id` filter to prevent cross-tenant access
- **Auth Hardening**: Removed fallback profile that could bypass tenant isolation on auth errors
- **Secure IDs**: Shift pattern IDs now use `crypto.randomUUID()` instead of predictable sequential patterns
- **Scoped Realtime**: Realtime subscriptions filtered by organisation to prevent data leakage
- **Error Surfacing**: Data load failures now display clear error messages instead of silently showing empty data
- **Config Validation**: Early check for Supabase environment variables with user-friendly error display

### Fatigue View Enhancements (v2.0)
- **Travel Times**: Travel In/Out columns in 7-day editor for commute tracking per shift
- **Inline FRI Display**: See calculated FRI for each working day directly in the table
- **Worst-Case Column**: Shows FRI with Workload=5, Attention=5 for high-demand role monitoring
- **Dropdown Selects**: Workload and Attention restricted to 1-5 via dropdown (no manual entry)
- **Global Settings Bar**: Summary showing continuous work limits and break requirements
- **Weekly Summary**: Average FRI and Peak FRI displayed below the shift table
- **Quick Role Check**: Compare how different roles would score on the same pattern

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
│   │   ├── FatigueView.tsx     # Pattern builder, 7-day editor, save/update
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
- **Security**: Signs out user on profile load failure (no fallback bypass)

### `/src/hooks/useAppData.ts`
Data management hook:
- Loads all data for current organisation
- Real-time subscriptions for live updates (scoped by organisation)
- CRUD operations for all entities
- Automatic snake_case/camelCase conversion
- **Security**: All mutations include `organisation_id` filter
- **Security**: Errors surfaced with clear RLS policy messages

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

**Note**: FRI values are displayed to 3 decimal places throughout the application for precision (e.g., 1.045, 1.160).

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

1. **Dashboard** - Project overview with stats, compliance alerts, and quick navigation
2. **Planning Views** - Timeline, Gantt, and Weekly views with VS Code-style resizable panels
3. **Drag & Drop** - Assign employees by dragging to calendar cells with multi-select (Ctrl+click)
4. **Person View** - Employee-centric calendar with dual colour coding (NR compliance + FRI)
5. **Real-time FRI** - Live fatigue calculation with per-shift risk indicators
6. **Cross-Project Compliance** - Check employees working across multiple projects
7. **Team Assignments** - Bulk assign teams to shifts
8. **Excel Import/Export** - Portable assignment data
9. **Custom Times** - Override shift times for individual assignments (moves to Custom row)
10. **Pattern Hatching** - Visual indication of non-working days per shift pattern

## Person View

The PersonView provides an employee-centric calendar showing all assignments across projects with compliance and fatigue analysis.

### Colour Scheme

The calendar uses a dual colour system to show both compliance and fatigue risk:

| Element | Purpose | Colours |
|---------|---------|---------|
| **Cell Background** | Network Rail Compliance | Red (error), Amber (warning), Green (OK), White (no shifts) |
| **Shift Chip** | Fatigue Risk Index (FRI) | Green (<1.0), Yellow (1.0-1.1), Orange (1.1-1.2), Red (>=1.2) |
| **FRI Badge** | Per-day max FRI | Solid colour badge in top-right corner with tooltip |

### Features

- **Period Navigation** - Navigate by Network Rail 13-period year (Sat-Fri weeks)
- **Export Schedule** - Download employee schedule as Excel file
- **Compliance Summary** - Issues count, shift count, hours, project count, max FRI
- **Shift Pattern Parameters** - View workload, attention, commute, breaks per pattern
- **Edit Assignments** - Click edit icon to modify times, pattern, or add notes
- **FRI Analysis** - Per-assignment fatigue risk with cumulative effects

## Planning View

The PlanningView provides project-centric shift assignment with multiple view modes.

### View Modes

| Mode | Description |
|------|-------------|
| **Timeline** | Shift patterns as rows, dates as columns, hatched for non-working days |
| **Gantt** | Employee-focused timeline view |
| **Weekly** | Week-based grid layout |

### Features

- **VS Code-style Panels** - Drag the resize handle to adjust planner/employee panel split
- **Employee Panel** - Searchable employee list with compliance status indicators
- **Multi-select** - Ctrl+click to select multiple employees, then drag to assign
- **Pattern Hatching** - Days where pattern doesn't work shown with diagonal hatching
- **Custom Times** - Drop on hatched cell to set custom start/end times (creates Custom row)
- **Copy Mode** - Click assignment chip to copy to other cells

## Fatigue Risk Assessment Tool

The FatigueView provides a comprehensive shift pattern editor with HSE RR446 fatigue calculations.

### View Modes

| Mode | Description |
|------|-------------|
| **7-Day Week** | Network Rail week (Sat-Fri) with rest day checkboxes |
| **Multi-Week Pattern** | Flexible day-based pattern builder for longer rosters |

### 7-Day Weekly Editor

- Network Rail week runs **Saturday to Friday**
- Check "Rest" checkbox to mark non-working days
- Rest days don't contribute to fatigue calculations
- Visual distinction: working days in green, rest days in grey
- Working/rest day counts shown in summary

#### Column Layout

| Column | Description |
|--------|-------------|
| Day | Day of week (Sat-Fri) |
| Rest | Checkbox for rest days |
| In | Travel time to site (minutes) |
| Start | Shift start time (HH:MM) |
| End | Shift end time (HH:MM) |
| Out | Travel time from site (minutes) |
| Hrs | Calculated shift duration |
| W | Workload (1-5 dropdown) |
| A | Attention (1-5 dropdown) |
| BF | Break frequency (minutes) |
| BL | Break length (minutes) |
| FRI | Calculated Fatigue Risk Index |
| Worst | FRI with W=5, A=5 (high-demand scenario) |

#### Global Settings Bar

Shows cumulative fatigue parameters applied across all shifts:
- **Continuous Work**: Maximum hours before mandatory break
- **Break After**: Required break duration after continuous work period

#### Weekly Summary

Displayed below the shift table:
- **Avg FRI**: Average FRI across all working days
- **Peak FRI**: Highest FRI value in the sequence (worst day)
- Working/rest day counts

### Save & Update Patterns

| Action | Description |
|--------|-------------|
| **Save as New Pattern** | Create a new shift pattern and assign to a project |
| **Update Pattern** | Save changes back to the loaded pattern |

When saving a new pattern:
1. Enter a pattern name (e.g., "Day Shift Mon-Fri")
2. Select the target project
3. Choose duty type (Possession, Non-Possession, etc.)
4. Toggle night shift if applicable
5. Click "Save Pattern"

### Role Presets

Pre-configured workload/attention values for common rail industry roles:

| Role | Workload | Attention | Description |
|------|----------|-----------|-------------|
| COSS | 4 | 5 | Controller of Site Safety |
| PICOP | 4 | 5 | Person In Charge Of Possession |
| Lookout | 2 | 5 | High vigilance required |
| Site Warden | 3 | 4 | Site access control |
| Machine Operator | 4 | 4 | Heavy plant operation |
| Skilled Operative | 3 | 3 | Experienced track worker |
| Labourer | 3 | 2 | General duties |

### Role Comparison

Compare fatigue compliance across multiple roles for the same shift pattern:
1. Click "Compare Roles"
2. Select roles to compare
3. View compliance status (pass/fail) for each role
4. Identify which roles are suitable for the pattern

### Quick Role Check

A streamlined role comparison available directly in the 7-day editor:
- Shows FRI compliance for common rail roles against the current pattern
- Green/red indicators for pass/fail
- Helps quickly identify which roles can safely work the pattern

### Worst-Case Analysis

The "Worst" column shows what the FRI would be if the shift were performed by someone with:
- **Workload = 5** (maximum physical/mental demand)
- **Attention = 5** (maximum vigilance required)

This helps assess:
- Whether the pattern is safe even for high-demand roles
- The headroom available before critical fatigue levels
- Risk exposure if conditions change during the shift

## Security

### Multi-Tenant Architecture

The system implements strict tenant isolation:

| Layer | Protection |
|-------|------------|
| **Database** | Row Level Security (RLS) policies on all tables |
| **API** | All queries/mutations include `organisation_id` filter |
| **Realtime** | Subscriptions scoped by organisation |
| **Auth** | No fallback profiles - errors trigger sign out |
| **IDs** | Cryptographically random UUIDs for shift patterns |

### Production Hardening Checklist

- [ ] Enable RLS on all Supabase tables
- [ ] Configure auth email verification
- [ ] Set up proper CORS origins
- [ ] Enable Supabase Auth rate limiting
- [ ] Configure session expiry policies
- [ ] Set up audit logging
- [ ] Enable database backups

## License

Proprietary - All rights reserved
