-- ============================================
-- ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES - SAFE VERSION
-- Production Security Hardening - Multi-tenant Isolation
-- ============================================
--
-- This migration safely enables RLS and creates policies only if they don't exist.
-- Uses DROP POLICY IF EXISTS and CREATE OR REPLACE where possible.
--
-- Prerequisites:
--   - user_profiles table must exist with (id UUID, organisation_id UUID)
--   - organisations table must exist
--   - All tables must have organisation_id column
--
-- SAFE TO RUN MULTIPLE TIMES
-- ============================================

-- ==================== ORGANISATIONS TABLE ====================

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

-- Drop existing policy and recreate (safe way to update)
DROP POLICY IF EXISTS "Users can view their own organisation" ON organisations;
CREATE POLICY "Users can view their own organisation"
  ON organisations FOR SELECT
  USING (
    id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ==================== USER_PROFILES TABLE ====================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());

-- ==================== EMPLOYEES TABLE ====================

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view employees in their organisation" ON employees;
CREATE POLICY "Users can view employees in their organisation"
  ON employees FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert employees in their organisation" ON employees;
CREATE POLICY "Users can insert employees in their organisation"
  ON employees FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update employees in their organisation" ON employees;
CREATE POLICY "Users can update employees in their organisation"
  ON employees FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete employees in their organisation" ON employees;
CREATE POLICY "Users can delete employees in their organisation"
  ON employees FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ==================== PROJECTS TABLE ====================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view projects in their organisation" ON projects;
CREATE POLICY "Users can view projects in their organisation"
  ON projects FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert projects in their organisation" ON projects;
CREATE POLICY "Users can insert projects in their organisation"
  ON projects FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update projects in their organisation" ON projects;
CREATE POLICY "Users can update projects in their organisation"
  ON projects FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete projects in their organisation" ON projects;
CREATE POLICY "Users can delete projects in their organisation"
  ON projects FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ==================== TEAMS TABLE ====================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view teams in their organisation" ON teams;
CREATE POLICY "Users can view teams in their organisation"
  ON teams FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert teams in their organisation" ON teams;
CREATE POLICY "Users can insert teams in their organisation"
  ON teams FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update teams in their organisation" ON teams;
CREATE POLICY "Users can update teams in their organisation"
  ON teams FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete teams in their organisation" ON teams;
CREATE POLICY "Users can delete teams in their organisation"
  ON teams FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ==================== SHIFT_PATTERNS TABLE ====================

ALTER TABLE shift_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view shift patterns in their organisation" ON shift_patterns;
CREATE POLICY "Users can view shift patterns in their organisation"
  ON shift_patterns FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert shift patterns in their organisation" ON shift_patterns;
CREATE POLICY "Users can insert shift patterns in their organisation"
  ON shift_patterns FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update shift patterns in their organisation" ON shift_patterns;
CREATE POLICY "Users can update shift patterns in their organisation"
  ON shift_patterns FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete shift patterns in their organisation" ON shift_patterns;
CREATE POLICY "Users can delete shift patterns in their organisation"
  ON shift_patterns FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ==================== ASSIGNMENTS TABLE ====================

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view assignments in their organisation" ON assignments;
CREATE POLICY "Users can view assignments in their organisation"
  ON assignments FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert assignments in their organisation" ON assignments;
CREATE POLICY "Users can insert assignments in their organisation"
  ON assignments FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update assignments in their organisation" ON assignments;
CREATE POLICY "Users can update assignments in their organisation"
  ON assignments FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete assignments in their organisation" ON assignments;
CREATE POLICY "Users can delete assignments in their organisation"
  ON assignments FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ==================== FATIGUE_ASSESSMENTS TABLE ====================
-- RLS already enabled in previous migration, just ensure policies are up to date

ALTER TABLE fatigue_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view assessments in their organisation" ON fatigue_assessments;
CREATE POLICY "Users can view assessments in their organisation"
  ON fatigue_assessments FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert assessments in their organisation" ON fatigue_assessments;
CREATE POLICY "Users can insert assessments in their organisation"
  ON fatigue_assessments FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update assessments in their organisation" ON fatigue_assessments;
CREATE POLICY "Users can update assessments in their organisation"
  ON fatigue_assessments FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete assessments in their organisation" ON fatigue_assessments;
CREATE POLICY "Users can delete assessments in their organisation"
  ON fatigue_assessments FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ==================== GRANT PERMISSIONS ====================

-- Grant authenticated users access to all tables
GRANT ALL ON organisations TO authenticated;
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON employees TO authenticated;
GRANT ALL ON projects TO authenticated;
GRANT ALL ON teams TO authenticated;
GRANT ALL ON shift_patterns TO authenticated;
GRANT ALL ON assignments TO authenticated;
GRANT ALL ON fatigue_assessments TO authenticated;

-- Service role should have unrestricted access (for admin operations)
GRANT ALL ON organisations TO service_role;
GRANT ALL ON user_profiles TO service_role;
GRANT ALL ON employees TO service_role;
GRANT ALL ON projects TO service_role;
GRANT ALL ON teams TO service_role;
GRANT ALL ON shift_patterns TO service_role;
GRANT ALL ON assignments TO service_role;
GRANT ALL ON fatigue_assessments TO service_role;

-- ==================== SUMMARY ====================

-- Show summary of RLS status
DO $$
DECLARE
  rls_count INTEGER;
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO rls_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('organisations', 'user_profiles', 'employees', 'projects',
                      'teams', 'shift_patterns', 'assignments', 'fatigue_assessments')
    AND rowsecurity = true;

  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  RAISE NOTICE '================================================';
  RAISE NOTICE 'RLS SETUP COMPLETE!';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Tables with RLS enabled: % / 8', rls_count;
  RAISE NOTICE 'Total policies created: %', policy_count;
  RAISE NOTICE '================================================';

  IF rls_count = 8 THEN
    RAISE NOTICE '✓ SUCCESS: All tables are protected with RLS';
  ELSE
    RAISE WARNING '⚠ WARNING: Only % tables have RLS enabled', rls_count;
  END IF;
END $$;

-- ==================== NOTES ====================
--
-- This migration is SAFE TO RUN MULTIPLE TIMES
-- - Uses DROP POLICY IF EXISTS before creating policies
-- - ALTER TABLE ENABLE RLS is idempotent (safe if already enabled)
-- - GRANT statements are idempotent
--
-- ============================================
