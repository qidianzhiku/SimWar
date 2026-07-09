# R7 Scenario Factory MVP Seed Package

## Status Boundary

```text
Source SHA:
33b0983859d4f01a48d298ee2f23253ffb8455fc

G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

R8-G1 Status:
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

This document defines the R7 Scenario Factory MVP seed package. It is a pure shared-contract and documentation package. It does not create a runtime route, BFF surface, database table, migration, production scenario registry, AI runtime, Plugin runtime, Pilot path, Production path, or durable settlement proof.

## Scenario source metadata

Allowed source kinds:

```text
synthetic_internal_seed
teacher_authored_draft
```

Each source record must carry:

```text
source_kind
source_owner
source_version
license_provenance_id
qa_record_id
```

Teacher-authored draft sources require Owner review before any future runtime release. This package does not authorize teacher-authored content to enter a formal run.

## Template field dictionary

The MVP template id is:

```text
r7-scenario-factory-mvp-template-v1
```

Required fields:

```text
scenario_package_id
scenario_version
parameter_set_id
parameter_set_version
plugin_package_id
plugin_package_version
seed
teaching_objectives
privacy_classification
license_provenance_id
qa_record_id
```

Scenario references are identifiers only. They do not bind a run, publish a scenario, write a ParameterSet, or activate a PluginPackage.

## ParameterSet and Shadow Replay boundary

The seed package records a future boundary for ParameterSet and Shadow Replay use:

```text
official_parameter_set_write = false
replay_writes_formal_results = false
shadow_replay_writes_formal_results = false
parameter_set_versioning_required_before_runtime_release = true
```

Shadow Replay is referenced as a future governance lane only. It does not overwrite official results.

## Runtime and truth boundary

Forbidden writes:

```text
state_true
SettlementResult
score
rank
truth_hash
replay_hash
manifest_hash
canonical_evidence_digest
official_parameter_set
official_replay_result
plugin_runtime_trace
ai_formal_output
```

```text
AI Advisory: NOT_AUTHORIZED_TO_WRITE_TRUTH
Plugin Runtime: NOT_AUTHORIZED
PostgreSQL Runtime: NOT_AUTHORIZED
Pilot / Production: NOT_AUTHORIZED
Durable Settlement: NOT_PROVEN
```

## Explicit Non-Proof

```text
Seed package != Scenario Factory runtime
Seed package != R8-G1 release
Seed package != Teacher rehearsal
Seed package != Pilot readiness
Seed package != Production readiness
Seed package != PostgreSQL runtime readiness
Seed package != durable settlement proof
```

Relates to #111.
Relates to #114.
Relates to #115.
