-- ============================================
-- ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- Production Security Hardening - Multi-tenant Isolation
-- ============================================
--
-- This migration enables RLS and creates comprehensive policies for all core tables.
-- Each policy ensures users can only access data within their organisation.
--
-- Prerequisites:
--   - user_profiles table must exist with (id UUID, organisation_id UUID)
--   - organisations table must exist
--   - All tables must have organisation_id column
--
-- IMPORTANT: Run this migration BEFORE enabling authenticated users in production
-- ============================================

-- ==================== ORGANISATIONS TABLE ====================

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

-- Users can only view their own organisation
CREATE POLICY "Users can view their own organisation"
  ON organisations FOR SELECT
  USING (
    id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Only service role can insert/update/delete organisations
-- (Organisations are typically created via admin portal or seed data)

-- ==================== USER_PROFILES TABLE ====================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());

-- Service role can insert profiles (happens during signup)
-- No delete policy - profiles should be soft-deleted if needed

-- ==================== EMPLOYEES TABLE ====================

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view employees in their organisation"
  ON employees FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert employees in their organisation"
  ON employees FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update employees in their organisation"
  ON employees FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete employees in their organisation"
  ON employees FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ==================== PROJECTS TABLE ====================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view projects in their organisation"
  ON projects FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert projects in their organisation"
  ON projects FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update projects in their organisation"
  ON projects FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete projects in their organisation"
  ON projects FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ==================== TEAMS TABLE ====================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view teams in their organisation"
  ON teams FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert teams in their organisation"
  ON teams FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update teams in their organisation"
  ON teams FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete teams in their organisation"
  ON teams FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ==================== SHIFT_PATTERNS TABLE ====================

ALTER TABLE shift_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shift patterns in their organisation"
  ON shift_patterns FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert shift patterns in their organisation"
  ON shift_patterns FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update shift patterns in their organisation"
  ON shift_patterns FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete shift patterns in their organisation"
  ON shift_patterns FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ==================== ASSIGNMENTS TABLE ====================

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assignments in their organisation"
  ON assignments FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert assignments in their organisation"
  ON assignments FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update assignments in their organisation"
  ON assignments FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete assignments in their organisation"
  ON assignments FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ==================== FATIGUE_ASSESSMENTS TABLE ====================
-- Note: RLS already enabled in 20260107_create_fatigue_assessments.sql
-- This section documents the existing policies for completeness

-- Policies already exist:
-- - "Users can view assessments in their organisation" (SELECT)
-- - "Users can insert assessments in their organisation" (INSERT)
-- - "Users can update assessments in their organisation" (UPDATE)
-- - "Users can delete assessments in their organisation" (DELETE)

-- ==================== GRANT PERMISSIONS ====================

-- Grant authenticated users access to all tables
GRANT ALL ON organisations TO authenticated;
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON employees TO authenticated;
GRANT ALL ON projects TO authenticated;
GRANT ALL ON teams TO authenticated;
GRANT ALL ON shift_patterns TO authenticated;
GRANT ALL ON assignments TO authenticated;

-- Service role should have unrestricted access (for admin operations)
GRANT ALL ON organisations TO service_role;
GRANT ALL ON user_profiles TO service_role;
GRANT ALL ON employees TO service_role;
GRANT ALL ON projects TO service_role;
GRANT ALL ON teams TO service_role;
GRANT ALL ON shift_patterns TO service_role;
GRANT ALL ON assignments TO service_role;

-- ==================== VERIFICATION QUERIES ====================
-- Run these after migration to verify RLS is working correctly
-- ============================================

-- Verify all tables have RLS enabled
-- Run as admin:
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('organisations', 'user_profiles', 'employees', 'projects', 'teams', 'shift_patterns', 'assignments', 'fatigue_assessments')
-- ORDER BY tablename;
-- Expected: rowsecurity = true for all tables

-- Verify policies exist
-- Run as admin:
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
-- Expected: 4 policies per table (SELECT, INSERT, UPDATE, DELETE)

-- Test as authenticated user
-- Run as authenticated user (should only return data from your organisation):
-- SELECT COUNT(*) FROM employees;
-- SELECT COUNT(*) FROM projects;
-- SELECT COUNT(*) FROM assignments;

-- Test cross-tenant isolation
-- Try to insert a record with a different organisation_id (should fail):
-- INSERT INTO employees (name, organisation_id) VALUES ('Test', '00000000-0000-0000-0000-000000000000');
-- Expected: INSERT fails due to RLS policy

-- ==================== NOTES ====================
--
-- 1. TESTING: Always test RLS policies in a non-production environment first
-- 2. BACKUP: Take a full database backup before running this migration
-- 3. MONITORING: Monitor query performance after enabling RLS (policies add overhead)
-- 4. INDEXES: Ensure organisation_id is indexed on all tables for performance
-- 5. SERVICE ROLE: Admin operations should use service role key, not anon key
-- 6. SOFT DELETES: Consider adding soft delete (is_deleted) columns instead of hard deletes
-- 7. AUDIT TRAIL: Consider adding trigger functions to log all changes
--
-- ============================================
