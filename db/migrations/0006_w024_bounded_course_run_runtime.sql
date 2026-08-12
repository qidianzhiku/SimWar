-- W024 bounded Course/Run runtime cutover.
-- This migration is forward-only and does not activate PostgreSQL by itself.
-- JSON mode remains the default until SIMWAR_REPOSITORY_MODE=postgres is set.

CREATE TABLE IF NOT EXISTS w024_schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS w024_runtime_records (
  tenant_id text NOT NULL,
  record_type text NOT NULL,
  record_id text NOT NULL,
  course_id text,
  run_id text,
  round_id text,
  team_id text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, record_type, record_id),
  FOREIGN KEY (tenant_id, run_id)
    REFERENCES simulation_runs (tenant_id, run_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS w024_runtime_records_scope_idx
  ON w024_runtime_records (tenant_id, record_type, course_id, run_id, round_id, team_id);

CREATE TABLE IF NOT EXISTS w024_role_workflow_records (
  record_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  run_id text NOT NULL,
  team_id text NOT NULL,
  round_id text,
  record_type text NOT NULL,
  payload jsonb NOT NULL,
  append_sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, run_id)
    REFERENCES simulation_runs (tenant_id, run_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  FOREIGN KEY (tenant_id, run_id, round_id)
    REFERENCES simulation_rounds (tenant_id, run_id, round_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS w024_role_workflow_scope_idx
  ON w024_role_workflow_records (tenant_id, run_id, team_id, round_id, append_sequence);

INSERT INTO w024_schema_migrations (version)
VALUES ('0006_w024_bounded_course_run_runtime')
ON CONFLICT (version) DO NOTHING;
