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

## Project Structure

```
fatigue-management/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Main page (to be created)
│   │   └── globals.css         # Global styles + Tailwind
│   │
│   ├── components/             # React components
│   │   ├── auth/               # Authentication (LoginForm, SignOutHeader)
│   │   ├── dashboard/          # Dashboard (ProjectCard, StatsCards)
│   │   ├── planning/           # Planning views (Timeline, Gantt, Weekly)
│   │   ├── calculator/         # Fatigue calculator
│   │   ├── modals/             # Modal dialogs
│   │   └── ui/                 # Shared UI components
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── useSupabase.ts      # Supabase client hook
│   │   ├── useProjects.ts      # Projects data hook
│   │   └── useCompliance.ts    # Compliance checking hook
│   │
│   └── lib/                    # Core business logic
│       ├── types.ts            # TypeScript interfaces
│       ├── supabase.ts         # Supabase client & helpers
│       ├── fatigue.ts          # HSE RR446 calculations
│       ├── compliance.ts       # Network Rail rules
│       └── periods.ts          # NR period utilities
│
├── package.json
├── tsconfig.json               # Strict TypeScript config
├── tailwind.config.ts
└── .env.local.example
```

## Core Modules

### `/src/lib/types.ts`
TypeScript interfaces for all entities:
- `Employee`, `Project`, `Team`, `ShiftPattern`, `Assignment`
- `FatigueResult`, `RiskLevel`, `ComplianceViolation`
- `NetworkRailPeriod`

### `/src/lib/fatigue.ts`
HSE Research Report RR446 fatigue index calculator:
- `calculateFatigueSequence()` - Calculate fatigue for shift sequence
- `getRiskLevel()` - Classify risk (low/moderate/elevated/critical)
- `FATIGUE_TEMPLATES` - Pre-built shift patterns

### `/src/lib/compliance.ts`
Network Rail compliance rule checking:
- Maximum 12-hour shifts
- Minimum 12-hour rest between shifts
- Maximum 72 hours per rolling 7 days
- Maximum 13 consecutive days
- Maximum 7 consecutive nights

### `/src/lib/periods.ts`
Network Rail 13-period financial year:
- `generateNetworkRailPeriods()` - Generate periods for a year
- `findPeriodForDate()` - Find which period a date falls into
- `getCurrentPeriod()` - Get current period

## Supabase Schema

The system uses these tables (matching the v76 POC):

```sql
-- Organisations (multi-tenant)
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'viewer',
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employees
CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  team_id INTEGER,
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  start_date DATE,
  end_date DATE,
  type TEXT,
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  member_ids INTEGER[],
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shift patterns
CREATE TABLE shift_patterns (
  id TEXT PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  name TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  weekly_schedule JSONB,
  duty_type TEXT DEFAULT 'Non-Possession',
  is_night BOOLEAN DEFAULT FALSE,
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assignments
CREATE TABLE assignments (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id),
  project_id INTEGER REFERENCES projects(id),
  shift_pattern_id TEXT REFERENCES shift_patterns(id),
  date DATE NOT NULL,
  custom_start_time TEXT,
  custom_end_time TEXT,
  notes TEXT,
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Development

```bash
# Run development server
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Build for production
npm run build
```

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Reference Documents

- `Fatigue-Management-System-Technical-Specification.docx` - Full requirements
- `Fatigue-Algorithm-Reference.docx` - HSE RR446 formulas
- `Coding-Standards.docx` - Development conventions
- `fatigue-management-v76.html` - Working POC reference

## Compliance Rules (Non-negotiable)

| Rule | Limit | Source |
|------|-------|--------|
| Maximum shift duration | 12 hours | NR/L2/OHS/003 |
| Minimum rest between shifts | 12 hours | NR/L2/OHS/003 |
| Maximum weekly hours | 72 hours (rolling 7 days) | Working Time Regs |
| Maximum consecutive days | 13 days | NR/L2/OHS/003 |
| Maximum consecutive nights | 7 nights | NR/L2/OHS/003 |

## Fatigue Risk Levels

| Index | Level | Colour |
|-------|-------|--------|
| < 1.0 | Low | Green |
| 1.0 - 1.1 | Moderate | Yellow |
| 1.1 - 1.2 | Elevated | Orange |
| > 1.2 | Critical | Red |

## License

Proprietary - All rights reserved
