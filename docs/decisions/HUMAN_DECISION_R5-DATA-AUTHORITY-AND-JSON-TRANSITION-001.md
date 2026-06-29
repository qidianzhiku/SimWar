# Human Decision: R5 Data Authority and JSON Transition

```yaml
decision_id: HUMAN_DECISION_R5-DATA-AUTHORITY-AND-JSON-TRANSITION-001
status: accepted_with_deferred_details
accepted_by: Project Owner
accepted_at: not specified in source objective
source: Codex goal objective attachment
scope: >
  Preserve the accepted ADR-DATA-005 target authority direction, preserve
  ADR-DATA-005A Team / TeamMember authority principles, accept R4 Run Manifest
  and Replay Evidence as a computed reproducibility layer, and record JSON
  transition principles without authorizing implementation.
non_goals: >
  This decision does not authorize source-code implementation, PostgreSQL
  runtime activation, SQL, schema, migration, Docker DB, provider changes,
  durable settlement, #111 / #114 / #115 closeout, AI truth write, Billing,
  Payment, Entitlement, Plugin Marketplace, second-industry development, or
  production deployment.
```

## Decision

### 1. Existing Accepted Authority Direction Remains Effective

ADR-DATA-005 remains the accepted parent direction:

- PostgreSQL is the target durable authority for Team / TeamMember,
  ParameterSet, and ScenarioPackage metadata.
- This does not activate PostgreSQL runtime.
- This does not authorize schema, migration, SQL, provider activation,
  dual-write, durable settlement, transaction, row lock, cross-process
  recovery, or production migration.

ADR-DATA-005A remains effective for Team / TeamMember:

- Current live authorization continues to use the existing runtime semantics.
- Future historical interpretation requires an immutable Run membership
  reference.
- Implementation details remain deferred until separately scoped.

### 2. Current Runtime Authority Remains JSON

Until later decisions and implementation evidence explicitly change it:

- JSON remains the current active default runtime.
- Team / TeamMember, ParameterSet, and ScenarioPackage current authority remain
  unchanged.
- No PostgreSQL store may become an active writer or reader by implication.
- No silent fallback, silent dual-write, or unmanaged dual authority is allowed.

### 3. R4 Run Manifest and Replay Evidence Layer

R4 Run Manifest and Replay Evidence are accepted as a computed reproducibility
and audit-evidence layer.

They:

- freeze and record current JSON-runtime calculation evidence;
- support deterministic replay verification;
- must not overwrite formal historical results;
- do not become a new formal truth writer;
- do not constitute PostgreSQL activation, durable settlement, cross-process
  recovery, or production-grade durability proof.

Teacher and Admin replay metadata remains permission-scoped. Student views must
not expose full manifests, decision batch hashes, runtime source digests,
private replay metadata, `state_true`, or other-Team sensitive data.

### 4. JSON Transition Principles

Any future transition from current JSON runtime toward target durable authority
must:

- preserve explicit fixture and seed compatibility;
- explicitly design import, export, archive, backward-reading, replay
  preservation, migration, rollback, and compatibility boundaries;
- prohibit silent dual authority and silent dual-write;
- define one authoritative write path per domain at each transition stage;
- retain auditable links between frozen Run inputs, historical results, and
  replay evidence.

### 5. Deferred Details

The following remain deferred and require separately scoped Human Decisions or
Design Gates before implementation:

- Team / TeamMember lifecycle states, immutable membership capture timing,
  history retention, and historical visibility behavior;
- ParameterSet draft, candidate, approval, clone, revoke, deprecate, Run
  binding, and Shadow Replay lifecycle rules;
- ScenarioPackage artifact boundary, digest policy, versioning, publish,
  deprecate, rollback, and compatibility policy;
- PostgreSQL schema, migration, adapter, provider activation, read runtime,
  write runtime, and rollback strategy;
- durable settlement, transaction, unique constraint, row lock, crash recovery,
  cross-process idempotency, and #111 closeout;
- production migration, Internal Pilot Release, controlled pilot, and
  production deployment.

### 6. OMD State Reconciliation

The OMD register must be reconciled with accepted ADR-DATA-005A status:

- Do not represent ADR-DATA-005A as wholly deferred.
- Distinguish accepted parent direction from deferred implementation details.
- Do not modify the meaning or acceptance status of ADR-DATA-005 or
  ADR-DATA-005A.

## Explicit Non-Goals

This decision does not authorize:

```text
source-code implementation
PostgreSQL runtime activation
SQL
schema
migration
Docker DB
provider changes
durable settlement
#111 closeout
#114 closeout
#115 closeout
AI truth write
Billing
Payment
Entitlement
Plugin Marketplace
second-industry development
production deployment
```

## Next Allowed Task

```text
R5-OMD-STATE-RECONCILIATION-DOCS-ONLY-PR
```
