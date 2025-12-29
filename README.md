# Fatigue Management System - Prototype

A Network Rail fatigue management and compliance system built with Next.js and Supabase.

## Features

- ✅ User authentication (email/password)
- ✅ Multi-project dashboard with statistics
- ✅ Timeline planning view with 28-day periods
- ✅ Shift pattern management
- ✅ Drag-and-drop assignment
- ✅ Compliance rule enforcement
- ✅ HSE Fatigue Index calculator
- ✅ Network Rail period system support

## Quick Start

### Prerequisites

- Node.js 18+ installed
- Supabase project (already configured)
- Vercel account for deployment

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open http://localhost:3000

### Deployment to Vercel

1. Push this code to your GitHub repository
2. Go to vercel.com and click "New Project"
3. Import your GitHub repository
4. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://tditgrtsggyogttfwzso.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_TrbrfiGPuSFngQuIJU9fJg_kbzcaLVi`
5. Click Deploy

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main entry point
│   └── globals.css        # Global styles
├── components/
│   ├── auth/              # Authentication components
│   ├── dashboard/         # Dashboard and project cards
│   ├── planning/          # Timeline planning view
│   └── calculator/        # Fatigue calculator
└── lib/
    ├── supabase.ts        # Supabase client
    ├── types.ts           # TypeScript definitions
    ├── fatigue-calculator.ts  # HSE RR446 algorithm
    ├── compliance.ts      # Compliance rules engine
    ├── data-service.ts    # Database operations
    └── network-rail-periods.ts  # Period calculations
```

## Compliance Rules

| Rule | Limit | Severity |
|------|-------|----------|
| Maximum shift length | 12 hours | Error |
| Minimum rest period | 12 hours | Error |
| Maximum weekly hours | 72 hours (rolling 7 days) | Error |
| Day-to-night transition | Prohibited same day | Error |
| Approaching weekly limit | >66 hours | Warning |

## Fatigue Index

Based on HSE Research Report RR446:

- **< 1.0** — Low Risk (Green)
- **1.0 - 1.1** — Moderate (Yellow)
- **1.1 - 1.2** — Elevated (Orange)
- **> 1.2** — High Risk (Red)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase publishable key |

## First Time Setup

1. Deploy the application
2. Create an account (first user becomes admin)
3. Add employees
4. Create a project
5. Create shift patterns
6. Start assigning shifts

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Hosting**: Vercel

## License

Confidential - C Spencer Ltd
