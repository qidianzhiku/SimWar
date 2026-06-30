# Human Decision: R2 Truth, Replay, and Hash Semantics

```yaml
decision_id: HUMAN_DECISION_R2-TRUTH-REPLAY-HASH-SEMANTICS-001
status: accepted_with_conditions
accepted_by: Project Owner
accepted_at: 2026-06-30
scope: >
  Clarify the current M1 JSON runtime Replay Evidence and hash vocabulary,
  allow additive evidence-only semantics and parity fixes, and preserve the
  existing formal truth, settlement, and legacy replay_hash boundaries.
non_goals: >
  This decision does not authorize an independent truth_hash, legacy
  replay_hash changes, SettlementResult shape changes, historical result or
  evidence rewrite, PostgreSQL runtime activation, schema, SQL, migration,
  durable settlement, #111 / #114 / #115 closeout, AI truth write, Billing,
  Plugin Marketplace, Internal Pilot, Controlled Pilot, or Production claims.
evidence_refs:
  - AUD-R2-TRUTH-REPLAY-HASH-EVIDENCE-AND-REWORK-PLANNING
  - PR #184
  - docs/governance/open-major-decisions.md
next_allowed_task: AUD-R2-TRUTH-REPLAY-HASH-AUTHORITY-REWORK
```

## Decision

For the current M1 JSON active runtime, the existing `replay_hash` remains a
legacy replay and result-reference fingerprint. It must not be renamed,
described, or treated as an independent `truth_hash`, cross-adapter proof,
durable settlement proof, tamper-proof production evidence, or
production-grade integrity proof.

New Replay Evidence semantics may be added only as additive evidence metadata
for newly generated evidence. The additive evidence layer may introduce a
versioned evidence vocabulary and an evidence-only canonical digest, provided
that it does not change settlement, publish, `SettlementResult`, `state_true`,
historical results, historical manifests, historical replay evidence, or the
legacy `replay_hash` input, algorithm, value, or generation location.

## Accepted Scope

This decision accepts the following bounded work:

- record an explicit Replay Evidence semantics version for newly generated M1
  JSON runtime evidence;
- record a clear evidence kind / vocabulary for this evidence layer;
- add an evidence-only canonical digest when it can be implemented with
  existing stable project helpers or platform primitives;
- align runtime projection, shared DTO, OpenAPI, JSON Schema, fixtures, and
  contract gate behavior for public Teacher / Admin replay evidence;
- add focused tests for legacy `replay_hash` regression, deterministic replay,
  golden evidence, ordering drift, exclusion explanation intent, replay
  no-write, historical non-overwrite, and Student visibility trimming.

## Semantic Boundaries

- `manifest_hash` is a Replay Evidence Manifest Integrity Hash. It may cover
  manifest identity, runtime identity, governance metadata, exclusion
  explanations, and audit evidence fields. It is not a formal truth proof.
- `decision_batch_hash` identifies the frozen decision batch used by the
  current M1 JSON runtime evidence path.
- `json_runtime_source_digest` records JSON runtime identity evidence. It does
  not activate another runtime and does not prove durable settlement.
- `replay_result_digest` is replay output comparison evidence.
- `excluded_from_truth_hash` is an exclusion explanation / governance intent.
  It is not proof that an independent truth hash exists.
- No independent `truth_hash` is implemented by this decision.

## Historical Non-Rewrite Rule

Historical published results, historical `replay_hash` values, historical
manifests, historical Replay Evidence, and already published Round states must
not be rewritten, backfilled, replaced, or re-settled by this decision.

## Explicit Non-Goals

This decision does not authorize:

```text
independent truth_hash implementation
legacy replay_hash input changes
legacy replay_hash algorithm changes
legacy replay_hash value changes
legacy replay_hash field rename
SettlementResult shape changes
formal result write changes
settlement or publish semantic changes
state_true changes
historical result rewrite
historical manifest rewrite
historical evidence rewrite
PostgreSQL active runtime
SQL
schema
migration
Docker DB
provider activation
transaction
row lock
unique constraint
cross-process recovery
durable settlement
#111 closeout
#114 closeout
#115 closeout
AI truth write
Plugin truth write
Billing or Entitlement truth write
Internal Pilot claim
Controlled Pilot claim
Production claim
```

## Allowed Follow-up Task

```text
AUD-R2-TRUTH-REPLAY-HASH-AUTHORITY-REWORK
```
