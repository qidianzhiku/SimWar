-- Initial SimWar repository schema skeleton.
--
-- This migration is intentionally conservative:
-- - It prepares repository-backed tables for a future Postgres adapter.
-- - It does not wire Postgres into runtime.
-- - It does not define a migration runner.
-- - It keeps complex contract-shaped objects in JSONB payload/metadata fields.
-- - It preserves truth-chain fields without changing their semantics.

CREATE TABLE IF NOT EXISTS courses (
  id text PRIMARY KEY,
  course_id text NOT NULL UNIQUE,
  tenant_id text NOT NULL,
  status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT courses_id_matches_course_id CHECK (id = course_id)
);

CREATE INDEX IF NOT EXISTS courses_tenant_id_idx ON courses (tenant_id);
CREATE INDEX IF NOT EXISTS courses_created_at_idx ON courses (created_at);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  tenant_id text NOT NULL,
  status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_id_matches_user_id CHECK (id = user_id)
);

CREATE INDEX IF NOT EXISTS users_tenant_id_idx ON users (tenant_id);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at);

CREATE TABLE IF NOT EXISTS simulation_runs (
  id text PRIMARY KEY,
  run_id text NOT NULL UNIQUE,
  tenant_id text NOT NULL,
  course_id text NOT NULL,
  scenario_package_id text NOT NULL,
  parameter_set_id text NOT NULL,
  seed integer NOT NULL,
  status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simulation_runs_id_matches_run_id CHECK (id = run_id)
);

CREATE INDEX IF NOT EXISTS simulation_runs_tenant_id_idx ON simulation_runs (tenant_id);
CREATE INDEX IF NOT EXISTS simulation_runs_course_id_idx ON simulation_runs (course_id);
CREATE INDEX IF NOT EXISTS simulation_runs_created_at_idx ON simulation_runs (created_at);

CREATE TABLE IF NOT EXISTS simulation_rounds (
  id text PRIMARY KEY,
  round_id text NOT NULL UNIQUE,
  tenant_id text NOT NULL,
  run_id text NOT NULL,
  round_no integer,
  status text,
  decision_batch_id text,
  replay_hash text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simulation_rounds_id_matches_round_id CHECK (id = round_id)
);

CREATE INDEX IF NOT EXISTS simulation_rounds_tenant_id_idx ON simulation_rounds (tenant_id);
CREATE INDEX IF NOT EXISTS simulation_rounds_run_id_idx ON simulation_rounds (run_id);
CREATE INDEX IF NOT EXISTS simulation_rounds_status_idx ON simulation_rounds (status);
CREATE INDEX IF NOT EXISTS simulation_rounds_created_at_idx ON simulation_rounds (created_at);

CREATE TABLE IF NOT EXISTS decisions (
  id text PRIMARY KEY,
  decision_id text NOT NULL,
  tenant_id text NOT NULL,
  run_id text NOT NULL,
  round_id text NOT NULL,
  round_no integer NOT NULL,
  team_id text NOT NULL,
  version integer NOT NULL,
  status text,
  canonical_source text,
  merge_commit_id text,
  team_confirmation_id text,
  submitted_by text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT decisions_tenant_decision_id_unique UNIQUE (tenant_id, decision_id)
);

CREATE INDEX IF NOT EXISTS decisions_tenant_id_idx ON decisions (tenant_id);
CREATE INDEX IF NOT EXISTS decisions_run_id_idx ON decisions (run_id);
CREATE INDEX IF NOT EXISTS decisions_round_id_idx ON decisions (round_id);
CREATE INDEX IF NOT EXISTS decisions_team_id_idx ON decisions (team_id);
CREATE INDEX IF NOT EXISTS decisions_created_at_idx ON decisions (created_at);
CREATE INDEX IF NOT EXISTS decisions_run_round_team_version_idx
  ON decisions (run_id, round_id, team_id, version);

CREATE TABLE IF NOT EXISTS settlement_results (
  id text PRIMARY KEY,
  settlement_result_id text NOT NULL,
  tenant_id text NOT NULL,
  run_id text NOT NULL,
  round_id text NOT NULL,
  round_no integer NOT NULL,
  parameter_set_id text NOT NULL,
  scenario_package_id text NOT NULL,
  replay_hash text NOT NULL,
  team_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settlement_results_tenant_result_id_unique UNIQUE (
    tenant_id,
    settlement_result_id
  )
);

CREATE INDEX IF NOT EXISTS settlement_results_tenant_id_idx ON settlement_results (tenant_id);
CREATE INDEX IF NOT EXISTS settlement_results_run_id_idx ON settlement_results (run_id);
CREATE INDEX IF NOT EXISTS settlement_results_round_id_idx ON settlement_results (round_id);
CREATE INDEX IF NOT EXISTS settlement_results_created_at_idx ON settlement_results (created_at);
CREATE INDEX IF NOT EXISTS settlement_results_run_round_idx
  ON settlement_results (run_id, round_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY,
  audit_id text NOT NULL UNIQUE,
  audit_sequence bigint GENERATED BY DEFAULT AS IDENTITY,
  tenant_id text NOT NULL,
  actor_id text,
  actor_role text,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  request_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_id_matches_audit_id CHECK (id = audit_id),
  CONSTRAINT audit_logs_audit_sequence_unique UNIQUE (audit_sequence)
);

CREATE INDEX IF NOT EXISTS audit_logs_tenant_id_idx ON audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx
  ON audit_logs (tenant_id, resource_type, resource_id, created_at);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at);

CREATE TABLE IF NOT EXISTS state_snapshots (
  id text PRIMARY KEY,
  snapshot_id text NOT NULL UNIQUE,
  tenant_id text NOT NULL,
  run_id text,
  round_id text,
  team_id text,
  aggregate_type text,
  aggregate_id text,
  sequence bigint,
  snapshot_type text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT state_snapshots_id_matches_snapshot_id CHECK (id = snapshot_id)
);

CREATE INDEX IF NOT EXISTS state_snapshots_tenant_id_idx ON state_snapshots (tenant_id);
CREATE INDEX IF NOT EXISTS state_snapshots_run_id_idx ON state_snapshots (run_id);
CREATE INDEX IF NOT EXISTS state_snapshots_round_id_idx ON state_snapshots (round_id);
CREATE INDEX IF NOT EXISTS state_snapshots_team_id_idx ON state_snapshots (team_id);
CREATE INDEX IF NOT EXISTS state_snapshots_aggregate_idx
  ON state_snapshots (tenant_id, aggregate_type, aggregate_id, sequence);
CREATE INDEX IF NOT EXISTS state_snapshots_created_at_idx ON state_snapshots (created_at);

CREATE TABLE IF NOT EXISTS replay_records (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  run_id text,
  round_id text,
  record_type text NOT NULL,
  manifest_id text,
  replay_run_id text,
  replay_report_id text,
  replay_diff_report_id text,
  source_result_id text,
  input_hash text,
  manifest_hash text,
  replay_result_hash text,
  status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS replay_records_tenant_id_idx ON replay_records (tenant_id);
CREATE INDEX IF NOT EXISTS replay_records_run_id_idx ON replay_records (run_id);
CREATE INDEX IF NOT EXISTS replay_records_round_id_idx ON replay_records (round_id);
CREATE INDEX IF NOT EXISTS replay_records_record_type_idx ON replay_records (record_type);
CREATE INDEX IF NOT EXISTS replay_records_manifest_id_idx ON replay_records (manifest_id);
CREATE INDEX IF NOT EXISTS replay_records_replay_run_id_idx ON replay_records (replay_run_id);
CREATE INDEX IF NOT EXISTS replay_records_replay_report_id_idx
  ON replay_records (replay_report_id);
CREATE INDEX IF NOT EXISTS replay_records_created_at_idx ON replay_records (created_at);
