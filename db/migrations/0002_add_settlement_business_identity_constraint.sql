DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM settlement_results
    WHERE tenant_id IS NULL
       OR run_id IS NULL
       OR round_no IS NULL
  ) THEN
    RAISE EXCEPTION 'settlement_results_business_identity_null';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT tenant_id, run_id, round_no
      FROM settlement_results
      GROUP BY tenant_id, run_id, round_no
      HAVING COUNT(*) > 1
    ) AS duplicate_business_identity
  ) THEN
    RAISE EXCEPTION 'settlement_results_business_identity_duplicate';
  END IF;
END $$;

ALTER TABLE settlement_results
  ADD CONSTRAINT settlement_results_business_identity_key
  UNIQUE (tenant_id, run_id, round_no);
