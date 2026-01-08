-- Add fatigue parameter columns to assignments table
-- These allow overriding pattern defaults for specific assignments

ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS commute_in integer,
ADD COLUMN IF NOT EXISTS commute_out integer,
ADD COLUMN IF NOT EXISTS workload integer,
ADD COLUMN IF NOT EXISTS attention integer,
ADD COLUMN IF NOT EXISTS break_frequency integer,
ADD COLUMN IF NOT EXISTS break_length integer,
ADD COLUMN IF NOT EXISTS continuous_work integer,
ADD COLUMN IF NOT EXISTS break_after_continuous integer;

-- Add constraints to validate ranges
ALTER TABLE assignments
ADD CONSTRAINT check_commute_in_range CHECK (commute_in IS NULL OR (commute_in >= 0 AND commute_in <= 480)),
ADD CONSTRAINT check_commute_out_range CHECK (commute_out IS NULL OR (commute_out >= 0 AND commute_out <= 480)),
ADD CONSTRAINT check_workload_range CHECK (workload IS NULL OR (workload >= 1 AND workload <= 4)),
ADD CONSTRAINT check_attention_range CHECK (attention IS NULL OR (attention >= 1 AND attention <= 4)),
ADD CONSTRAINT check_break_frequency_range CHECK (break_frequency IS NULL OR (break_frequency >= 0 AND break_frequency <= 720)),
ADD CONSTRAINT check_break_length_range CHECK (break_length IS NULL OR (break_length >= 0 AND break_length <= 120)),
ADD CONSTRAINT check_continuous_work_range CHECK (continuous_work IS NULL OR (continuous_work >= 0 AND continuous_work <= 720)),
ADD CONSTRAINT check_break_after_continuous_range CHECK (break_after_continuous IS NULL OR (break_after_continuous >= 0 AND break_after_continuous <= 120));

-- Add comments for documentation
COMMENT ON COLUMN assignments.commute_in IS 'Minutes commute to work (overrides pattern default)';
COMMENT ON COLUMN assignments.commute_out IS 'Minutes commute from work (overrides pattern default)';
COMMENT ON COLUMN assignments.workload IS 'Workload level 1-4, where 1=demanding, 4=minimal (overrides pattern default)';
COMMENT ON COLUMN assignments.attention IS 'Attention level 1-4, where 1=constant, 4=relaxed (overrides pattern default)';
COMMENT ON COLUMN assignments.break_frequency IS 'Minutes between breaks (overrides pattern default)';
COMMENT ON COLUMN assignments.break_length IS 'Minutes per break (overrides pattern default)';
COMMENT ON COLUMN assignments.continuous_work IS 'Max continuous work time in minutes (overrides pattern default)';
COMMENT ON COLUMN assignments.break_after_continuous IS 'Rest time after continuous work in minutes (overrides pattern default)';
