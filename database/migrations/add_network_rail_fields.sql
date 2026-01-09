-- ============================================
-- ADD NETWORK RAIL FIELDS TO EMPLOYEES TABLE
-- ============================================
-- Adds optional fields from Network Rail CSV exports:
-- - primary_sponsor: Primary sponsor organization
-- - sub_sponsors: Sub-sponsor organizations
-- - current_employer: Current employer name
--
-- Note: Date of Birth and NI Number are NOT included for GDPR compliance

-- Add primary_sponsor field
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS primary_sponsor VARCHAR(255);

-- Add sub_sponsors field
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS sub_sponsors TEXT;

-- Add current_employer field
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS current_employer VARCHAR(255);

-- Add comments for documentation
COMMENT ON COLUMN employees.primary_sponsor IS 'Primary sponsor organization (from Network Rail CSV)';
COMMENT ON COLUMN employees.sub_sponsors IS 'Sub-sponsor organizations (from Network Rail CSV)';
COMMENT ON COLUMN employees.current_employer IS 'Current employer name (from Network Rail CSV)';

-- ============================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================
-- To rollback this migration:
-- ALTER TABLE employees DROP COLUMN primary_sponsor;
-- ALTER TABLE employees DROP COLUMN sub_sponsors;
-- ALTER TABLE employees DROP COLUMN current_employer;
