-- ============================================
-- FATIGUE ASSESSMENTS TABLE
-- For storing FAMP (Fatigue Assessment and Mitigation Plan) records
-- Based on Network Rail NR/L2/OHS/003 standard
-- ============================================

-- Create the fatigue_assessments table
CREATE TABLE IF NOT EXISTS fatigue_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  -- Part 1: Details of person being assessed
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  job_title TEXT,
  contract_no TEXT,
  location TEXT,
  assessment_date DATE NOT NULL,
  shift_start_time TIME,
  shift_end_time TIME,
  assessor_name TEXT NOT NULL,
  assessor_role TEXT,

  -- Link to violation that triggered this (optional)
  violation_type TEXT,
  violation_date DATE,
  assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL,

  -- Part 2: Reasons for assessment (stored as JSONB array)
  assessment_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Part 3: Assessment questions and answers (stored as JSONB array)
  assessment_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_score INTEGER NOT NULL DEFAULT 0,

  -- Part 4: Risk assessment result
  exceedance_level TEXT NOT NULL DEFAULT 'none' CHECK (exceedance_level IN ('none', 'level1', 'level2')),
  calculated_risk_level TEXT NOT NULL CHECK (calculated_risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  final_risk_level TEXT NOT NULL CHECK (final_risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  risk_adjustment_notes TEXT,

  -- Part 5: Mitigations (stored as JSONB array)
  applied_mitigations JSONB NOT NULL DEFAULT '[]'::jsonb,
  other_mitigation_details TEXT,

  -- Part 6: Authorisation
  employee_accepted BOOLEAN NOT NULL DEFAULT false,
  employee_acceptance_date TIMESTAMPTZ,
  employee_comments TEXT,
  manager_approved BOOLEAN NOT NULL DEFAULT false,
  manager_approval_date TIMESTAMPTZ,
  manager_name TEXT,
  manager_comments TEXT,

  -- Status and audit
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_employee', 'pending_manager', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_fatigue_assessments_org ON fatigue_assessments(organisation_id);
CREATE INDEX IF NOT EXISTS idx_fatigue_assessments_employee ON fatigue_assessments(employee_id);
CREATE INDEX IF NOT EXISTS idx_fatigue_assessments_date ON fatigue_assessments(assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_fatigue_assessments_status ON fatigue_assessments(status);
CREATE INDEX IF NOT EXISTS idx_fatigue_assessments_risk ON fatigue_assessments(final_risk_level);

-- Enable Row Level Security
ALTER TABLE fatigue_assessments ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access assessments in their organisation
CREATE POLICY "Users can view assessments in their organisation"
  ON fatigue_assessments FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert assessments in their organisation"
  ON fatigue_assessments FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update assessments in their organisation"
  ON fatigue_assessments FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete assessments in their organisation"
  ON fatigue_assessments FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_fatigue_assessment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fatigue_assessments_updated_at
  BEFORE UPDATE ON fatigue_assessments
  FOR EACH ROW
  EXECUTE FUNCTION update_fatigue_assessment_timestamp();

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE fatigue_assessments;

-- Grant permissions
GRANT ALL ON fatigue_assessments TO authenticated;
GRANT ALL ON fatigue_assessments TO service_role;
