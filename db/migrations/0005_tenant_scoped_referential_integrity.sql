-- W015 T4-F2: tenant-scoped referential integrity for inactive PostgreSQL support.
--
-- This is a forward-only migration. JSON_INTERNAL_ONLY remains the active
-- runtime authority; these constraints are not a PostgreSQL provider switch.
-- The preflight is fail-closed and performs no repair, delete, or update.

LOCK TABLE courses,
  simulation_runs,
  simulation_rounds,
  decisions,
  settlement_results,
  replay_records
  IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  violation_count bigint;
  sample_value text;
BEGIN
  SELECT COUNT(*), MIN(format('%s/%s', runs.tenant_id, runs.run_id))
    INTO violation_count, sample_value
    FROM simulation_runs AS runs
    LEFT JOIN courses AS courses
      ON courses.tenant_id = runs.tenant_id
     AND courses.course_id = runs.course_id
    WHERE courses.id IS NULL;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'w015_preflight_orphan_run_course count=% sample=%', violation_count, sample_value;
  END IF;

  SELECT COUNT(*), MIN(format('%s/%s', rounds.tenant_id, rounds.round_id))
    INTO violation_count, sample_value
    FROM simulation_rounds AS rounds
    LEFT JOIN simulation_runs AS runs
      ON runs.tenant_id = rounds.tenant_id
     AND runs.run_id = rounds.run_id
    WHERE runs.id IS NULL;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'w015_preflight_orphan_round_run count=% sample=%', violation_count, sample_value;
  END IF;

  SELECT COUNT(*), MIN(format('%s/%s', decisions.tenant_id, decisions.decision_id))
    INTO violation_count, sample_value
    FROM decisions
    LEFT JOIN simulation_runs AS runs
      ON runs.tenant_id = decisions.tenant_id
     AND runs.run_id = decisions.run_id
    WHERE runs.id IS NULL;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'w015_preflight_orphan_decision_run count=% sample=%', violation_count, sample_value;
  END IF;

  SELECT COUNT(*), MIN(format('%s/%s', decisions.tenant_id, decisions.decision_id))
    INTO violation_count, sample_value
    FROM decisions
    LEFT JOIN simulation_rounds AS rounds
      ON rounds.tenant_id = decisions.tenant_id
     AND rounds.run_id = decisions.run_id
     AND rounds.round_id = decisions.round_id
    WHERE rounds.id IS NULL;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'w015_preflight_orphan_decision_round_run count=% sample=%', violation_count, sample_value;
  END IF;

  SELECT COUNT(*), MIN(format('%s/%s', results.tenant_id, results.settlement_result_id))
    INTO violation_count, sample_value
    FROM settlement_results AS results
    LEFT JOIN simulation_runs AS runs
      ON runs.tenant_id = results.tenant_id
     AND runs.run_id = results.run_id
    WHERE runs.id IS NULL;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'w015_preflight_orphan_settlement_run count=% sample=%', violation_count, sample_value;
  END IF;

  SELECT COUNT(*), MIN(format('%s/%s', results.tenant_id, results.settlement_result_id))
    INTO violation_count, sample_value
    FROM settlement_results AS results
    LEFT JOIN simulation_rounds AS rounds
      ON rounds.tenant_id = results.tenant_id
     AND rounds.run_id = results.run_id
     AND rounds.round_id = results.round_id
    WHERE rounds.id IS NULL;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'w015_preflight_orphan_settlement_round_run count=% sample=%', violation_count, sample_value;
  END IF;

  SELECT COUNT(*), MIN(format('%s/%s', records.tenant_id, records.id))
    INTO violation_count, sample_value
    FROM replay_records AS records
    WHERE num_nonnulls(records.run_id, records.round_id) = 1;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'w015_preflight_partial_replay_run_round count=% sample=%', violation_count, sample_value;
  END IF;

  SELECT COUNT(*), MIN(format('%s/%s', records.tenant_id, records.id))
    INTO violation_count, sample_value
    FROM replay_records AS records
    WHERE records.source_result_id IS NOT NULL
      AND (records.run_id IS NULL OR records.round_id IS NULL);
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'w015_preflight_partial_replay_source_result count=% sample=%', violation_count, sample_value;
  END IF;

  SELECT COUNT(*), MIN(format('%s/%s', records.tenant_id, records.id))
    INTO violation_count, sample_value
    FROM replay_records AS records
    LEFT JOIN simulation_runs AS runs
      ON runs.tenant_id = records.tenant_id
     AND runs.run_id = records.run_id
    WHERE records.run_id IS NOT NULL
      AND runs.id IS NULL;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'w015_preflight_orphan_replay_run count=% sample=%', violation_count, sample_value;
  END IF;

  SELECT COUNT(*), MIN(format('%s/%s', records.tenant_id, records.id))
    INTO violation_count, sample_value
    FROM replay_records AS records
    LEFT JOIN simulation_rounds AS rounds
      ON rounds.tenant_id = records.tenant_id
     AND rounds.run_id = records.run_id
     AND rounds.round_id = records.round_id
    WHERE records.run_id IS NOT NULL
      AND rounds.id IS NULL;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'w015_preflight_orphan_replay_round_run count=% sample=%', violation_count, sample_value;
  END IF;

  SELECT COUNT(*), MIN(format('%s/%s', records.tenant_id, records.id))
    INTO violation_count, sample_value
    FROM replay_records AS records
    LEFT JOIN settlement_results AS results
      ON results.tenant_id = records.tenant_id
     AND results.run_id = records.run_id
     AND results.round_id = records.round_id
     AND results.settlement_result_id = records.source_result_id
    WHERE records.source_result_id IS NOT NULL
      AND results.id IS NULL;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'w015_preflight_orphan_replay_source_result count=% sample=%', violation_count, sample_value;
  END IF;

  SELECT COUNT(*), MIN(format('%s/%s', duplicate_keys.tenant_id, duplicate_keys.run_id))
    INTO violation_count, sample_value
    FROM (
      SELECT tenant_id, run_id
      FROM simulation_runs
      GROUP BY tenant_id, run_id
      HAVING COUNT(*) > 1
    ) AS duplicate_keys;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'w015_preflight_duplicate_run_parent_key count=% sample=%', violation_count, sample_value;
  END IF;

  SELECT COUNT(*), MIN(format('%s/%s/%s', duplicate_keys.tenant_id, duplicate_keys.run_id, duplicate_keys.round_id))
    INTO violation_count, sample_value
    FROM (
      SELECT tenant_id, run_id, round_id
      FROM simulation_rounds
      GROUP BY tenant_id, run_id, round_id
      HAVING COUNT(*) > 1
    ) AS duplicate_keys;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'w015_preflight_duplicate_round_parent_key count=% sample=%', violation_count, sample_value;
  END IF;

  SELECT COUNT(*), MIN(format('%s/%s/%s/%s', duplicate_keys.tenant_id, duplicate_keys.run_id, duplicate_keys.round_id, duplicate_keys.settlement_result_id))
    INTO violation_count, sample_value
    FROM (
      SELECT tenant_id, run_id, round_id, settlement_result_id
      FROM settlement_results
      GROUP BY tenant_id, run_id, round_id, settlement_result_id
      HAVING COUNT(*) > 1
    ) AS duplicate_keys;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'w015_preflight_duplicate_settlement_parent_key count=% sample=%', violation_count, sample_value;
  END IF;

  SELECT COUNT(*), MIN(format('%s/%s/%s', duplicate_keys.tenant_id, duplicate_keys.run_id, duplicate_keys.round_no))
    INTO violation_count, sample_value
    FROM (
      SELECT tenant_id, run_id, round_no
      FROM settlement_results
      GROUP BY tenant_id, run_id, round_no
      HAVING COUNT(*) > 1
    ) AS duplicate_keys;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'w015_preflight_duplicate_settlement_business_key count=% sample=%', violation_count, sample_value;
  END IF;
END
$$;

ALTER TABLE simulation_runs
  ADD CONSTRAINT simulation_runs_tenant_run_key UNIQUE (tenant_id, run_id);

ALTER TABLE simulation_rounds
  ADD CONSTRAINT simulation_rounds_tenant_run_round_key UNIQUE (tenant_id, run_id, round_id);

ALTER TABLE settlement_results
  ADD CONSTRAINT settlement_results_tenant_run_round_result_key UNIQUE (
    tenant_id,
    run_id,
    round_id,
    settlement_result_id
  );

ALTER TABLE simulation_runs
  ADD CONSTRAINT simulation_runs_course_fk
  FOREIGN KEY (tenant_id, course_id)
  REFERENCES courses (tenant_id, course_id)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;

ALTER TABLE simulation_rounds
  ADD CONSTRAINT simulation_rounds_run_fk
  FOREIGN KEY (tenant_id, run_id)
  REFERENCES simulation_runs (tenant_id, run_id)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;

ALTER TABLE decisions
  ADD CONSTRAINT decisions_run_fk
  FOREIGN KEY (tenant_id, run_id)
  REFERENCES simulation_runs (tenant_id, run_id)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;

ALTER TABLE decisions
  ADD CONSTRAINT decisions_round_run_fk
  FOREIGN KEY (tenant_id, run_id, round_id)
  REFERENCES simulation_rounds (tenant_id, run_id, round_id)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;

ALTER TABLE settlement_results
  ADD CONSTRAINT settlement_results_run_fk
  FOREIGN KEY (tenant_id, run_id)
  REFERENCES simulation_runs (tenant_id, run_id)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;

ALTER TABLE settlement_results
  ADD CONSTRAINT settlement_results_round_run_fk
  FOREIGN KEY (tenant_id, run_id, round_id)
  REFERENCES simulation_rounds (tenant_id, run_id, round_id)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;

ALTER TABLE replay_records
  ADD CONSTRAINT replay_records_run_round_null_policy
  CHECK (
    (run_id IS NULL AND round_id IS NULL)
    OR (run_id IS NOT NULL AND round_id IS NOT NULL)
  );

ALTER TABLE replay_records
  ADD CONSTRAINT replay_records_source_result_null_policy
  CHECK (
    source_result_id IS NULL
    OR (run_id IS NOT NULL AND round_id IS NOT NULL)
  );

ALTER TABLE replay_records
  ADD CONSTRAINT replay_records_run_fk
  FOREIGN KEY (tenant_id, run_id)
  REFERENCES simulation_runs (tenant_id, run_id)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;

ALTER TABLE replay_records
  ADD CONSTRAINT replay_records_round_run_fk
  FOREIGN KEY (tenant_id, run_id, round_id)
  REFERENCES simulation_rounds (tenant_id, run_id, round_id)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;

ALTER TABLE replay_records
  ADD CONSTRAINT replay_records_source_settlement_fk
  FOREIGN KEY (tenant_id, run_id, round_id, source_result_id)
  REFERENCES settlement_results (tenant_id, run_id, round_id, settlement_result_id)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;
