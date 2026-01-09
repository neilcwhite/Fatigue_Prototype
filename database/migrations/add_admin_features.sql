-- ============================================
-- ADMIN ROLE SYSTEM - DATABASE MIGRATION
-- ============================================
-- This migration adds support for 5-tier role system, project archiving,
-- and Sentinel number tracking for employees.

-- 1. Update user_profile table to support 5-tier role system
-- ============================================
-- Change role enum from 3 tiers (admin, manager, viewer) to 5 tiers
-- Role hierarchy: super_admin > admin > sheq > manager > user

-- Drop existing check constraint if it exists
ALTER TABLE user_profile DROP CONSTRAINT IF EXISTS user_profile_role_check;

-- Add new check constraint with 5 roles
ALTER TABLE user_profile
ADD CONSTRAINT user_profile_role_check
CHECK (role IN ('super_admin', 'admin', 'sheq', 'manager', 'user'));

-- Update existing roles (map old roles to new system)
-- Old 'admin' -> New 'admin'
-- Old 'manager' -> New 'manager'
-- Old 'viewer' -> New 'user'
UPDATE user_profile SET role = 'user' WHERE role = 'viewer';

-- 2. Add archived field to projects table
-- ============================================
-- Allows soft delete of projects (hides from normal users, not deleted)
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Add index for filtering archived projects
CREATE INDEX IF NOT EXISTS idx_projects_archived
ON projects(organisation_id, archived);

-- 3. Add sentinel_number field to employees table
-- ============================================
-- Sentinel numbers: 3-15 characters, alphanumeric
-- Used for CSV import de-duplication and employee identification
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS sentinel_number VARCHAR(15);

-- Add unique constraint for sentinel_number within organisation
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_sentinel_org
ON employees(organisation_id, sentinel_number)
WHERE sentinel_number IS NOT NULL;

-- Add check constraint for sentinel_number format
ALTER TABLE employees
ADD CONSTRAINT employees_sentinel_format_check
CHECK (
  sentinel_number IS NULL OR
  (LENGTH(sentinel_number) BETWEEN 3 AND 15 AND sentinel_number ~ '^[A-Za-z0-9]+$')
);

-- 4. Add comments for documentation
-- ============================================
COMMENT ON COLUMN user_profile.role IS 'User role: super_admin (full access), admin (archive/delete/import), sheq (compliance view), manager (project management), user (read-only)';
COMMENT ON COLUMN projects.archived IS 'Soft delete flag - hides project and related FAMPs from non-admin users';
COMMENT ON COLUMN employees.sentinel_number IS 'External employee identifier, 3-15 alphanumeric characters, used for CSV import de-duplication';

-- 5. Row Level Security (RLS) updates
-- ============================================
-- Note: Existing RLS policies will need updating to respect archived flag
-- This is application-level logic and should be handled in the app code

-- Example RLS policy for projects (commented out - adjust based on your existing policies):
-- DROP POLICY IF EXISTS "Users can view non-archived projects" ON projects;
-- CREATE POLICY "Users can view non-archived projects" ON projects
--   FOR SELECT
--   USING (
--     organisation_id = (SELECT organisation_id FROM user_profile WHERE id = auth.uid())
--     AND (
--       archived = FALSE
--       OR
--       EXISTS (
--         SELECT 1 FROM user_profile
--         WHERE id = auth.uid()
--         AND role IN ('super_admin', 'admin')
--       )
--     )
--   );

-- ============================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================
-- To rollback this migration:
-- 1. ALTER TABLE employees DROP COLUMN sentinel_number;
-- 2. ALTER TABLE projects DROP COLUMN archived;
-- 3. Revert role constraint to original 3 roles
-- 4. Update user roles back to viewer from user
