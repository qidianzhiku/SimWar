# M28 dual-epoch living scenario operations

## State transition

M28 moves the Shanghai support lane from `SINGLE_EPOCH_STATIC_SCENARIO_WITHOUT_LIVING_OPERATIONS` to `DUAL_EPOCH_LIVING_SCENARIO_OPERATIONS_EXECUTED_CANDIDATE`.

Epoch A and Epoch B are separate, immutable candidate snapshots. Epoch B is a deterministic refresh candidate over the exact M25 public-source evidence epoch and M27 Hangzhou `regional-transfer.v1` candidate. The pack records the complete ordered operation chain:

`REFRESH → DIFF → IMPACT → REQUALIFICATION → ROLLBACK_CANDIDATE → HISTORICAL_RESOLUTION → WITHDRAW`

Every operation and every epoch has a deterministic digest. Historical resolution requires the exact epoch ID and version. Withdrawal is a governance state and is explicitly not deletion; `history_deleted=false` is retained in both the historical and withdrawal records.

## Safety and authority

This is a support-owned candidate compiler pack. It does not add a scheduler, database writer, runtime admission path, provider, formal ParameterSet write, official Truth write, Settlement write, Score write, or Rank write. MAIN remains responsible for formal binding and any shared writer. The requalification status is `LIMITED` with `calibration_evidence=NOT_PROVEN`.

Expiry and rights changes reject the candidate and require a newly compiled epoch. The runbook and alert list are evidence and operating guidance only; they do not execute refreshes or mutate frozen inputs.

## Reuse and known limits

M25 source receipts/digests and M27 exact Hangzhou lineage are reused. M19–M24 remains tombstoned as `TOMBSTONED_PROFESSIONAL_CANDIDATE_WITH_LIMITS`; no second lifecycle writer is introduced. The two epochs are deterministic snapshots over the same public-source evidence, not a live data pipeline, calibrated outcome dataset, or product route.
