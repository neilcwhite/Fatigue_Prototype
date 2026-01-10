-- Create weekly_shift_verification table for granular weekly shift-level manager sign-offs
-- Replaces the period-based work_verification_records with a more granular weekly grid approach

CREATE TABLE IF NOT EXISTS weekly_shift_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Week identification (Network Rail weeks start on Saturday)
  week_start_date DATE NOT NULL, -- Saturday of the week
  week_end_date DATE NOT NULL,   -- Friday of the week (6 days later)
  year INTEGER NOT NULL,          -- Financial year (2024, 2025, etc.)
  period_number INTEGER NOT NULL, -- Network Rail period (1-13)
  week_in_period INTEGER NOT NULL, -- Week within period (1-4)

  -- Shift pattern sign-offs (JSON array of signed off shift patterns)
  signed_off_shifts JSONB NOT NULL DEFAULT '[]'::jsonb,
  /* Expected structure:
  [
    {
      shift_pattern_id: string,
      shift_pattern_name: string,
      signed_off_by: uuid (manager_id),
      signed_off_by_name: string,
      signed_off_at: timestamp,
      employee_count: number, // how many employees worked this pattern in the week
      total_assignments: number, // total assignments for this pattern in the week
      notes: string (optional)
    }
  ]
  */

  -- Overall week status
  is_fully_signed_off BOOLEAN NOT NULL DEFAULT false, -- true when all shifts for the week are signed off

  -- Manager who completed the sign-off (when fully signed)
  completed_by_id UUID, -- References auth.users(id)
  completed_by_name TEXT,
  completed_by_role TEXT, -- 'manager', 'sheq', 'admin', 'super_admin'
  completed_at TIMESTAMPTZ,

  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_week_range CHECK (week_end_date = week_start_date + INTERVAL '6 days'),
  CONSTRAINT valid_period CHECK (period_number >= 1 AND period_number <= 13),
  CONSTRAINT valid_week_in_period CHECK (week_in_period >= 1 AND week_in_period <= 4),
  CONSTRAINT unique_week_per_project UNIQUE (organisation_id, project_id, week_start_date)
);

-- Create indexes for common queries
CREATE INDEX idx_weekly_verification_org ON weekly_shift_verification(organisation_id);
CREATE INDEX idx_weekly_verification_project ON weekly_shift_verification(project_id);
CREATE INDEX idx_weekly_verification_week_start ON weekly_shift_verification(week_start_date);
CREATE INDEX idx_weekly_verification_unsigned ON weekly_shift_verification(project_id, is_fully_signed_off, week_start_date)
  WHERE is_fully_signed_off = false;
CREATE INDEX idx_weekly_verification_period ON weekly_shift_verification(year, period_number);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_weekly_verification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_weekly_verification_updated_at
  BEFORE UPDATE ON weekly_shift_verification
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_verification_updated_at();

-- Enable Row Level Security
ALTER TABLE weekly_shift_verification ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can only see verification records for their organization
CREATE POLICY "Users can view own org weekly verifications"
  ON weekly_shift_verification
  FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Only managers and above can create/update verification records
CREATE POLICY "Managers can create weekly verifications"
  ON weekly_shift_verification
  FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('manager', 'sheq', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Managers can update weekly verifications"
  ON weekly_shift_verification
  FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('manager', 'sheq', 'admin', 'super_admin')
    )
  );

-- Only admins can delete verification records
CREATE POLICY "Admins can delete weekly verifications"
  ON weekly_shift_verification
  FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON weekly_shift_verification TO authenticated;
GRANT DELETE ON weekly_shift_verification TO authenticated;

COMMENT ON TABLE weekly_shift_verification IS 'Weekly shift-level verification for manager sign-offs. Provides granular tracking of which specific shifts have been verified each week.';
COMMENT ON COLUMN weekly_shift_verification.signed_off_shifts IS 'JSON array tracking which shift patterns have been signed off by managers for this week';
COMMENT ON COLUMN weekly_shift_verification.is_fully_signed_off IS 'True when all shifts for the week have been signed off by a manager';
