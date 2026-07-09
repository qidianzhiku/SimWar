# R7 Scenario ParameterSet and Shadow Replay Alignment

## Status Boundary

```text
Source SHA:
2038c8f0ebaa762461cd1140565426e37a268b2c

Seed Package Source SHA:
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

This document defines a source/docs/tests-only alignment package for the merged R7 Scenario Factory seed package. It records how the seed package references ParameterSet and Shadow Replay boundaries without activating runtime execution, official ParameterSet writes, formal result replacement, AI runtime, Plugin runtime, PostgreSQL runtime, Pilot, or Production.

## ParameterSet compatibility matrix

| Area                  | Current Contract             | Status                       | Future Gate                                  | Non-Proof                          |
| --------------------- | ---------------------------- | ---------------------------- | -------------------------------------------- | ---------------------------------- |
| scenario_package_id   | Identifier reference only    | COMPATIBLE_BY_REFERENCE_ONLY | OWNER_AUTHORIZED_PARAMETERSET_VERSION_REVIEW | not a runtime scenario registry    |
| parameter_set_id      | Identifier reference only    | COMPATIBLE_BY_REFERENCE_ONLY | OWNER_AUTHORIZED_PARAMETERSET_VERSION_REVIEW | not an official ParameterSet write |
| parameter_set_version | Version reference only       | COMPATIBLE_BY_REFERENCE_ONLY | OWNER_AUTHORIZED_PARAMETERSET_VERSION_REVIEW | not a version mutation             |
| plugin_package_id     | Identifier reference only    | COMPATIBLE_BY_REFERENCE_ONLY | OWNER_AUTHORIZED_PARAMETERSET_VERSION_REVIEW | not Plugin runtime activation      |
| seed                  | Deterministic reference only | COMPATIBLE_BY_REFERENCE_ONLY | OWNER_AUTHORIZED_PARAMETERSET_VERSION_REVIEW | not production calibration         |

```text
official_parameter_set_write = false
parameter_set_version_mutation = false
parameter_set_versioning_required_before_runtime_release = true
```

## Shadow Replay compatibility matrix

| Area                    | Current Contract                  | Status                                     | Future Gate                                    | Non-Proof                   |
| ----------------------- | --------------------------------- | ------------------------------------------ | ---------------------------------------------- | --------------------------- |
| shadow_replay_reference | Governance reference only         | SHADOW_REPLAY_REFERENCE_ONLY_NON_OVERWRITE | OWNER_AUTHORIZED_SHADOW_REPLAY_EXECUTION_GUARD | not Shadow Replay execution |
| non_overwrite_boundary  | Formal result overwrite forbidden | SHADOW_REPLAY_REFERENCE_ONLY_NON_OVERWRITE | OWNER_AUTHORIZED_SHADOW_REPLAY_EXECUTION_GUARD | not durable recovery        |
| future_execution_guard  | Owner authorization required      | SHADOW_REPLAY_REFERENCE_ONLY_NON_OVERWRITE | OWNER_AUTHORIZED_SHADOW_REPLAY_EXECUTION_GUARD | not Pilot readiness         |

```text
shadow_replay_executes = false
shadow_replay_overwrites_official_result = false
shadow_replay_writes_formal_results = false
replay_writes_formal_results = false
replay_hash_semantics_changed = false
manifest_hash_semantics_changed = false
```

## Calibration register

The calibration register is a draft register only. It does not write ScenarioPackage, ParameterSet, PluginPackage, official Replay, or official result records.

```text
Calibration Register:
r7-parameterset-shadow-replay-calibration-register-v1

Status:
DRAFT_REGISTER_ONLY

writes_parameter_set = false
writes_plugin_package = false
writes_scenario_package = false
writes_official_result = false
```

## Teacher scenario selection next-slice package

Allowed actions:

```text
preview_alignment_matrix
compare_internal_seed_references
request_owner_parameter_review
```

Forbidden actions:

```text
write_state_true
write_settlement_result
publish_runtime_scenario
modify_official_parameter_set
execute_shadow_replay
overwrite_official_replay_result
```

## Runtime and truth boundary

Forbidden writes remain:

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
Shadow Replay Runtime: NOT_AUTHORIZED
Pilot / Production: NOT_AUTHORIZED
Durable Settlement: NOT_PROVEN
```

## Explicit Non-Proof

```text
ParameterSet alignment != official ParameterSet write
Shadow Replay alignment != Shadow Replay execution
Shadow Replay alignment != official result overwrite
Alignment package != Scenario Factory runtime
Alignment package != R8-G1 release
Alignment package != Teacher rehearsal
Alignment package != Pilot readiness
Alignment package != Production readiness
```

Relates to #111.
Relates to #114.
Relates to #115.
