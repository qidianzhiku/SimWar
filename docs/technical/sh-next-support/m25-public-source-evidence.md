# M25 public-source reality evidence epoch

M25 adds an SH-owned, candidate-only compiler for a dated public-source evidence epoch. It preserves the existing `SourceAsset → Observation → Feature → RegionalTransfer → ScenarioCandidate` semantics without adding a kernel, runtime, registry, writer, or route.

## State transition

- State A: M19/M22-era synthetic or reference-only anchors without a current public-source epoch.
- State B: `PUBLIC_SOURCE_REALITY_EVIDENCE_EPOCH_BOUND`.

The epoch binds exact official URLs, retrieval status, locators, definitions, geography, time scope, rights status, expiry, revalidation policy, and deterministic digests. Shanghai is represented by the 2025 Shanghai Statistical Yearbook HTML index and a JS-limited Shanghai civil-affairs page; Hangzhou is represented by the official 2022 “一老一小” solution page and its labeled 2025 target table.

## Safety boundary

Numeric Hangzhou values remain planning targets, not current outcomes. Shanghai table availability is not converted into a row value, and the JS-limited page produces no numeric observation. All features carry `calibration_evidence=NOT_PROVEN`, and the transfer remains `REQUALIFICATION_REQUIRED` / `CANDIDATE_ONLY`. The module does not write ParameterSet, official Truth, Settlement, Score, Rank, Provider, PostgreSQL/RLS, Pilot, Production, or Human Validation state.

`validateM25PublicSourceRealityEvidenceEpochPack` recomputes the epoch, source, observation, feature, transformation, transfer, and scenario digests and fails closed for unsupported reality classes, missing units, activation boundary violations, and authority violations.
