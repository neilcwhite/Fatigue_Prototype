-- ============================================
-- RLS VERIFICATION QUERIES
-- Run these in Supabase SQL Editor to verify RLS is working
-- ============================================

-- Query 1: Check RLS is enabled on all tables
-- Expected: All 8 tables should show rowsecurity = true
SELECT
  tablename,
  CASE
    WHEN rowsecurity THEN '✓ RLS Enabled'
    ELSE '✗ RLS Disabled'
  END as status
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

-- Query 2: Count policies per table
-- Expected: Each table should have 2-4 policies
SELECT
  tablename,
  COUNT(*) as policy_count,
  STRING_AGG(policyname, ', ') as policies
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
GROUP BY tablename
ORDER BY tablename;

-- Query 3: List all RLS policies
-- Shows exactly what policies exist
SELECT
  tablename,
  policyname,
  cmd as operation,
  CASE
    WHEN qual IS NOT NULL THEN 'Yes'
    ELSE 'No'
  END as has_using_clause
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;
