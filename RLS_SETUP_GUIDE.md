# Row Level Security (RLS) Setup Guide

## Overview

This guide walks you through enabling and verifying Row Level Security (RLS) for your Fatigue Management System. RLS is **critical for production** as it provides database-level multi-tenant isolation.

---

## What is RLS?

Row Level Security (RLS) is a PostgreSQL feature that restricts which rows users can access in a table. In our multi-tenant system:

- Each organisation has a unique `organisation_id`
- All data tables include `organisation_id` column
- RLS policies ensure users can **only** see/modify data from their organisation
- Protection happens at the **database level** (can't be bypassed by API bugs)

**Without RLS:** A bug in your frontend could leak data between organisations
**With RLS:** Even with bugs, users physically cannot access other organisations' data

---

## Prerequisites

Before running the RLS migration, ensure:

1. ✅ **user_profiles table exists** with columns:
   - `id` (UUID) - matches auth.users.id
   - `organisation_id` (UUID) - links to organisations table

2. ✅ **organisations table exists** with:
   - `id` (UUID) - primary key
   - Organisation details (name, etc.)

3. ✅ **All data tables have organisation_id column**:
   - employees
   - projects
   - teams
   - shift_patterns
   - assignments
   - fatigue_assessments (already done)

4. ✅ **Indexes exist on organisation_id** for performance:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organisation_id);
   CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organisation_id);
   CREATE INDEX IF NOT EXISTS idx_teams_org ON teams(organisation_id);
   CREATE INDEX IF NOT EXISTS idx_shift_patterns_org ON shift_patterns(organisation_id);
   CREATE INDEX IF NOT EXISTS idx_assignments_org ON assignments(organisation_id);
   ```

---

## Step-by-Step Setup

### Step 1: Backup Your Database

**CRITICAL:** Always backup before enabling RLS

#### Option A: Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **Database** → **Backups**
3. Click **"Create Backup"**
4. Wait for confirmation

#### Option B: Supabase CLI
```bash
supabase db dump -f backup_before_rls_$(date +%Y%m%d).sql
```

#### Option C: pg_dump
```bash
pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup_before_rls.sql
```

---

### Step 2: Review the Migration

Open and review the migration file:

**File:** `supabase/migrations/20260109_enable_rls_all_tables.sql`

**What it does:**
1. Enables RLS on all core tables
2. Creates 4 policies per table (SELECT, INSERT, UPDATE, DELETE)
3. All policies check `organisation_id` matches user's profile
4. Grants permissions to `authenticated` and `service_role`

**Key Pattern:**
```sql
-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Allow SELECT only for user's organisation
CREATE POLICY "Users can view employees in their organisation"
  ON employees FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );
```

---

### Step 3: Run the Migration

Choose your method:

#### Option A: Supabase Dashboard (Recommended for beginners)

1. Go to **SQL Editor** in Supabase dashboard
2. Click **"New Query"**
3. Copy the contents of `20260109_enable_rls_all_tables.sql`
4. Paste into the editor
5. Click **"Run"**
6. Check for errors in the output

#### Option B: Supabase CLI (Recommended for production)

```bash
# Ensure you're logged in
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Push migration
supabase db push
```

#### Option C: psql

```bash
psql -h db.xxx.supabase.co -U postgres -d postgres -f supabase/migrations/20260109_enable_rls_all_tables.sql
```

---

### Step 4: Verify RLS is Enabled

Run these verification queries in the Supabase SQL Editor:

#### 4.1 Check RLS is enabled on all tables

```sql
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'organisations',
    'user_profiles',
    'employees',
    'projects',
    'teams',
    'shift_patterns',
    'assignments',
    'fatigue_assessments'
  )
ORDER BY tablename;
```

**Expected Result:** `rowsecurity = true` for all tables

#### 4.2 Check policies exist

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  CASE
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END as qual_status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'organisations',
    'user_profiles',
    'employees',
    'projects',
    'teams',
    'shift_patterns',
    'assignments',
    'fatigue_assessments'
  )
ORDER BY tablename, policyname;
```

**Expected Result:** Each table should have 2-4 policies (SELECT, INSERT, UPDATE, DELETE or subset)

#### 4.3 Test as authenticated user

**IMPORTANT:** Run this with a test user account (not service role)

```sql
-- Should return only your organisation's data
SELECT COUNT(*) as employee_count FROM employees;
SELECT COUNT(*) as project_count FROM projects;
SELECT COUNT(*) as assignment_count FROM assignments;

-- Check organisation_id matches your profile
SELECT
  e.id,
  e.name,
  e.organisation_id,
  up.organisation_id as user_org_id,
  CASE
    WHEN e.organisation_id = up.organisation_id THEN '✓ Match'
    ELSE '✗ MISMATCH - RLS NOT WORKING'
  END as status
FROM employees e
CROSS JOIN user_profiles up
WHERE up.id = auth.uid()
LIMIT 5;
```

**Expected Result:** All rows should show "✓ Match"

#### 4.4 Test cross-tenant isolation

**IMPORTANT:** Use a test organisation ID (not your real one)

```sql
-- This should FAIL with RLS policy violation
INSERT INTO employees (name, organisation_id)
VALUES ('Hacker Test', '00000000-0000-0000-0000-000000000000');
```

**Expected Result:** Error message like:
```
new row violates row-level security policy for table "employees"
```

If the INSERT succeeds, **RLS is not working correctly** - do not proceed to production!

---

### Step 5: Test with Your Application

1. **Start your dev environment:**
   ```bash
   npm run dev
   ```

2. **Sign in with a test user**

3. **Create test data:**
   - Create a project
   - Add an employee
   - Create an assignment

4. **Verify data appears correctly:**
   - Dashboard should show your data
   - No errors in browser console
   - Network tab shows successful API calls

5. **Test with a second user (different organisation):**
   - Create a second test account with different email domain
   - Sign in with the second account
   - Verify you **cannot** see the first user's data

---

## Common Issues & Troubleshooting

### Issue: "relation user_profiles does not exist"

**Cause:** user_profiles table hasn't been created yet

**Solution:** Create user_profiles table first:
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_org ON user_profiles(organisation_id);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());
```

### Issue: "new row violates row-level security policy"

**Cause:** You're trying to insert data with an organisation_id that doesn't match your profile

**Solution:**
1. Check your user_profiles.organisation_id: `SELECT * FROM user_profiles WHERE id = auth.uid();`
2. Ensure all INSERT operations include the correct organisation_id from your profile
3. Update your frontend code to automatically add organisation_id from user context

### Issue: Queries return 0 rows after enabling RLS

**Cause:** Existing data has NULL organisation_id or mismatched IDs

**Solution:**
```sql
-- Check for NULL organisation_ids
SELECT 'employees' as table_name, COUNT(*) as null_count
FROM employees WHERE organisation_id IS NULL
UNION ALL
SELECT 'projects', COUNT(*) FROM projects WHERE organisation_id IS NULL
UNION ALL
SELECT 'assignments', COUNT(*) FROM assignments WHERE organisation_id IS NULL;

-- Fix NULL values (replace YOUR_ORG_ID with your actual org ID)
UPDATE employees SET organisation_id = 'YOUR_ORG_ID' WHERE organisation_id IS NULL;
UPDATE projects SET organisation_id = 'YOUR_ORG_ID' WHERE organisation_id IS NULL;
UPDATE assignments SET organisation_id = 'YOUR_ORG_ID' WHERE organisation_id IS NULL;
```

### Issue: Performance degradation after enabling RLS

**Cause:** Missing indexes on organisation_id

**Solution:**
```sql
-- Add indexes (should already exist, but verify)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employees_org ON employees(organisation_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_org ON projects(organisation_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teams_org ON teams(organisation_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_patterns_org ON shift_patterns(organisation_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignments_org ON assignments(organisation_id);

-- Verify indexes exist
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE '%_org';
```

### Issue: Service role queries fail

**Cause:** Service role should bypass RLS, but might need explicit grants

**Solution:**
```sql
-- Grant service_role access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
```

---

## RLS Best Practices

### ✅ DO:

1. **Always test in staging first** - Never enable RLS directly in production
2. **Backup before migration** - Have a rollback plan
3. **Use indexes** - organisation_id should be indexed on all tables
4. **Monitor performance** - RLS adds query overhead
5. **Test cross-tenant isolation** - Verify users can't access other orgs' data
6. **Use service role for admin tasks** - Bypass RLS when needed for admin operations

### ❌ DON'T:

1. **Don't disable RLS in production** - Defeats the entire security model
2. **Don't use anon key for admin tasks** - Use service role instead
3. **Don't trust client-side checks** - RLS is your last line of defense
4. **Don't forget to grant permissions** - Authenticated users need table access
5. **Don't skip verification** - Always test cross-tenant isolation

---

## Performance Optimization

RLS policies are evaluated on **every query**. Optimize with:

### 1. Indexes
```sql
-- Already in migration, but verify they exist
CREATE INDEX CONCURRENTLY idx_employees_org ON employees(organisation_id);
```

### 2. Materialized Views (for reporting)
```sql
-- For expensive reports, use materialized views with RLS
CREATE MATERIALIZED VIEW employee_stats_by_org AS
SELECT
  organisation_id,
  COUNT(*) as employee_count,
  -- other stats
FROM employees
GROUP BY organisation_id;

REFRESH MATERIALIZED VIEW employee_stats_by_org;
```

### 3. Policy Optimization
Current policies use subqueries which are efficient. PostgreSQL optimizes:
```sql
USING (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
  )
)
```

This is evaluated once per session, not per row.

---

## Monitoring RLS

### Check active policies
```sql
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

### Monitor query performance
```sql
-- Enable query logging (as superuser)
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1s
SELECT pg_reload_conf();

-- View slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Audit RLS enforcement
```sql
-- Check which tables have RLS enabled
SELECT
  schemaname,
  tablename,
  rowsecurity,
  CASE
    WHEN rowsecurity THEN '✓ Protected'
    ELSE '✗ VULNERABLE'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity, tablename;
```

---

## Rollback Plan

If something goes wrong, disable RLS temporarily:

```sql
-- EMERGENCY: Disable RLS (ONLY for debugging, NOT for production)
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE shift_patterns DISABLE ROW LEVEL SECURITY;
ALTER TABLE assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE fatigue_assessments DISABLE ROW LEVEL SECURITY;

-- Re-enable after fixing issues
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
-- ... etc
```

**NEVER leave RLS disabled in production!**

---

## Next Steps After RLS Setup

Once RLS is verified working:

1. ✅ **Enable email verification** in Supabase Auth settings
2. ✅ **Set up rate limiting** in Supabase Auth
3. ✅ **Configure CORS** to only allow your domain
4. ✅ **Enable database backups** (daily recommended)
5. ✅ **Set up monitoring** (error tracking, performance)
6. ✅ **Document admin procedures** for cross-organisation queries
7. ✅ **Train team** on RLS implications for development

---

## Reference: Policy Pattern

All policies follow this standard pattern:

```sql
-- SELECT: Allow viewing data in user's organisation
CREATE POLICY "Users can view [table] in their organisation"
  ON [table] FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- INSERT: Allow creating data only in user's organisation
CREATE POLICY "Users can insert [table] in their organisation"
  ON [table] FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- UPDATE: Allow updating only user's organisation data
CREATE POLICY "Users can update [table] in their organisation"
  ON [table] FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- DELETE: Allow deleting only user's organisation data
CREATE POLICY "Users can delete [table] in their organisation"
  ON [table] FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );
```

---

## Support

If you encounter issues:

1. Check the [Common Issues](#common-issues--troubleshooting) section
2. Review Supabase logs in the dashboard
3. Test queries directly in SQL Editor with explicit `auth.uid()` checks
4. Verify user_profiles table has correct organisation_id for your test users

---

**Migration File:** `supabase/migrations/20260109_enable_rls_all_tables.sql`
**Status:** Ready to deploy
**Priority:** CRITICAL for production
**Estimated Time:** 5-10 minutes to run + 30 minutes verification

---

## Quick Checklist

- [ ] Backup database
- [ ] Review migration SQL
- [ ] Run migration in staging environment
- [ ] Verify RLS enabled on all tables (Step 4.1)
- [ ] Verify policies exist (Step 4.2)
- [ ] Test as authenticated user (Step 4.3)
- [ ] Test cross-tenant isolation (Step 4.4)
- [ ] Test with application (Step 5)
- [ ] Monitor performance for 24 hours
- [ ] Deploy to production
- [ ] Verify production environment
- [ ] Update runbook with RLS procedures

---

**Document Version:** 1.0
**Last Updated:** January 9, 2026
**Author:** Claude Code
