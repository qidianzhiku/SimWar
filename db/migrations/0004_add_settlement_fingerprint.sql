--
-- T4-F1 forward migration:
-- - keep published migrations immutable;
-- - persist the deterministic replay-relevant outcome fingerprint;
-- - leave historical rows nullable so an upgrade never invents a fingerprint;
-- - the existing business-key uniqueness remains owned by migration 0002.
--

ALTER TABLE settlement_results
  ADD COLUMN IF NOT EXISTS settlement_fingerprint text;

ALTER TABLE settlement_results
  ADD CONSTRAINT settlement_results_fingerprint_shape
  CHECK (
    settlement_fingerprint IS NULL
    OR settlement_fingerprint ~ '^[0-9a-f]{64}$'
  );

CREATE INDEX IF NOT EXISTS settlement_results_fingerprint_idx
  ON settlement_results (tenant_id, run_id, round_no, settlement_fingerprint);
