-- Create work_verification_records table for manager sign-offs
-- This table stores manager approvals of work hours and fatigue assessments

CREATE TABLE IF NOT EXISTS work_verification_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Period covered by this verification
  period_number INTEGER, -- Network Rail period (1-13), null if custom range
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Manager who signed off
  manager_id UUID NOT NULL, -- References auth.users(id)
  manager_name TEXT NOT NULL,
  manager_role TEXT NOT NULL, -- 'manager', 'sheq', 'admin', 'super_admin'

  -- Sign-off details
  sign_off_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  comments TEXT,

  -- Snapshot of work data at time of sign-off (JSON)
  summary_data JSONB NOT NULL,
  /* Expected structure:
  {
    total_assignments: number,
    total_hours_planned: number,
    total_hours_actual: number,
    modifications_count: number,
    farp_assessments_count: number,
    completed_farps: number,
    pending_farps: number,
    violations: [
      { type: string, count: number, dates: string[] }
    ],
    employee_breakdown: [
      {
        employee_id: number,
        employee_name: string,
        planned_hours: number,
        actual_hours: number,
        assignments_count: number,
        custom_times_count: number,
        violations: string[]
      }
    ],
    shift_patterns_used: [
      { pattern_id: string, pattern_name: string, assignment_count: number }
    ]
  }
  */

  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT valid_period CHECK (period_number IS NULL OR (period_number >= 1 AND period_number <= 13))
);

-- Create indexes for common queries
CREATE INDEX idx_work_verifications_org ON work_verification_records(organisation_id);
CREATE INDEX idx_work_verifications_project ON work_verification_records(project_id);
CREATE INDEX idx_work_verifications_dates ON work_verification_records(start_date, end_date);
CREATE INDEX idx_work_verifications_period ON work_verification_records(period_number);
CREATE INDEX idx_work_verifications_manager ON work_verification_records(manager_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_work_verification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_work_verification_updated_at
  BEFORE UPDATE ON work_verification_records
  FOR EACH ROW
  EXECUTE FUNCTION update_work_verification_updated_at();

-- Enable Row Level Security
ALTER TABLE work_verification_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can only see verification records for their organization
CREATE POLICY "Users can view own org work verifications"
  ON work_verification_records
  FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Only managers and above can create verification records
CREATE POLICY "Managers can create work verifications"
  ON work_verification_records
  FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('manager', 'sheq', 'admin', 'super_admin')
    )
  );

-- Only managers and above can update verification records (e.g., add comments)
CREATE POLICY "Managers can update work verifications"
  ON work_verification_records
  FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('manager', 'sheq', 'admin', 'super_admin')
    )
  );

-- Only admins can delete verification records
CREATE POLICY "Admins can delete work verifications"
  ON work_verification_records
  FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON work_verification_records TO authenticated;
GRANT DELETE ON work_verification_records TO authenticated;

COMMENT ON TABLE work_verification_records IS 'Manager sign-offs for work hours and fatigue assessments, demonstrating planned and controlled fatigue management for auditors';
COMMENT ON COLUMN work_verification_records.summary_data IS 'JSON snapshot of all work data at time of sign-off for audit trail';
