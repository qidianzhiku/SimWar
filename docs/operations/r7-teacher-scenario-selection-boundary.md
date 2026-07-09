# R7 Teacher Scenario Selection Boundary

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

## Teacher scenario selection boundary

Allowed actions:

```text
preview_seed_package
select_internal_draft_for_rehearsal
request_owner_review
```

Forbidden actions:

```text
write_state_true
write_settlement_result
publish_runtime_scenario
modify_official_parameter_set
```

## Operational limits

Teacher selection remains an internal-only draft workflow. It does not authorize:

```text
Scenario Factory runtime route
frontend product release
formal run binding
official ParameterSet write
official Replay result write
Plugin Runtime
AI truth write
PostgreSQL runtime
Pilot
Production
```

## Evidence handoff

Future review must confirm:

```text
Scenario source metadata
Template field dictionary
License / provenance register
QA register
ParameterSet and Shadow Replay boundary
```

## Alignment Package Status Boundary

```text
Source SHA:
2038c8f0ebaa762461cd1140565426e37a268b2c
```

## Teacher scenario selection next-slice package

The next slice remains internal-only and reference-only. Teacher-facing selection may inspect compatibility evidence, but it must not publish runtime scenarios, mutate official ParameterSet records, execute Shadow Replay, or overwrite formal results.

Allowed next-slice actions:

```text
preview_alignment_matrix
compare_internal_seed_references
request_owner_parameter_review
```

Forbidden next-slice actions:

```text
write_state_true
write_settlement_result
publish_runtime_scenario
modify_official_parameter_set
execute_shadow_replay
overwrite_official_replay_result
```

## ParameterSet compatibility matrix

```text
official_parameter_set_write = false
parameter_set_version_mutation = false
```

## Shadow Replay compatibility matrix

```text
shadow_replay_executes = false
shadow_replay_overwrites_official_result = false
```

## Calibration register

```text
calibration_register_id = r7-parameterset-shadow-replay-calibration-register-v1
status = DRAFT_REGISTER_ONLY
```

## Teacher Scenario Selection BFF/DTO Boundary

```text
Source SHA:
f51d49cf736bef1e3645b6b56f85c41c12d9872e

runtime_route_enabled = false
teacher_bff_endpoint_enabled = false
frontend_ui_enabled = false
direct_store_access = false
official_parameter_set_write = false
official_scenario_binding_write = false
shadow_replay_executes = false
shadow_replay_overwrites_official_result = false
student_visibility_expansion = false
```

Teacher scenario selection remains a boundary package only. It may define DTO, query and command contract fields for a future teacher BFF, but it must not introduce a runtime route, frontend UI, official Scenario binding, official ParameterSet write, Shadow Replay execution, or Student visibility expansion.

```text
AI Advisory: NOT_AUTHORIZED_TO_WRITE_TRUTH
Plugin Runtime: NOT_AUTHORIZED
```

Relates to #111.
Relates to #114.
Relates to #115.
