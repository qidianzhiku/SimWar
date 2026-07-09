# R7 Teacher Scenario Selection BFF/DTO Boundary

## Status Boundary

```text
Source SHA:
f51d49cf736bef1e3645b6b56f85c41c12d9872e

G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

R8-G1 Status:
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

## Purpose

This boundary package defines the next R7 teacher scenario selection BFF/DTO contract surface as an internal-only shared-contract seed. It turns the merged Scenario Factory seed package and ParameterSet / Shadow Replay alignment package into a typed teacher-facing selection boundary without activating any runtime route.

## Teacher Scenario Selection BFF/DTO Boundary

The DTO contract is reference-only and may expose only internal teacher selection evidence:

```text
tenant_id_required = true
course_id_required = true
run_id_required = true
scenario_package_id_required = true
parameter_set_id_required = true
plugin_package_id_required = true
actor_role = teacher
source_runtime_path = NOT_BOUND_TO_RUNTIME_ROUTE
```

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

Forbidden fields:

```text
state_true
SettlementResult
truth_hash
replay_hash
manifest_hash
canonical_evidence_digest
private_parameter_set
private_shadow_replay_trace
official_parameter_set
```

## Runtime and Projection Guard

```text
runtime_route_enabled = false
teacher_bff_endpoint_enabled = false
frontend_ui_enabled = false
direct_store_access = false
official_parameter_set_write = false
official_scenario_binding_write = false
state_true_exposure = false
settlement_result_write = false
shadow_replay_executes = false
shadow_replay_overwrites_official_result = false
replay_hash_semantics_changed = false
manifest_hash_semantics_changed = false
student_visibility_expansion = false
frontend_direct_internal_settle_route = false
```

## Advisory Slot Boundary

The DTO keeps a placeholder for future advisory output, but the placeholder is not an AI runtime and cannot write formal truth.

```text
advisory_only = true
coach_output_reference = COACH_OUTPUT_REFERENCE_ONLY
model_call_log_reference = MODEL_CALL_LOG_REFERENCE_ONLY
ai_writes_formal_truth = false
```

## Runtime Authorization

```text
teacher_bff_runtime_route = NOT_AUTHORIZED
scenario_factory_runtime_route = NOT_AUTHORIZED
shadow_replay_runtime = NOT_AUTHORIZED
ai_runtime = NOT_AUTHORIZED
plugin_runtime = NOT_AUTHORIZED
postgresql_runtime = NOT_AUTHORIZED
durable_settlement = NOT_PROVEN
pilot = NOT_AUTHORIZED
production = NOT_AUTHORIZED
```

## Explicit Non-Proofs

```text
Teacher selection DTO boundary != runtime BFF route
Teacher selection DTO boundary != Scenario Factory runtime
Teacher selection DTO boundary != official Scenario binding
Teacher selection DTO boundary != official ParameterSet write
Teacher selection DTO boundary != Shadow Replay execution
Teacher selection DTO boundary != R8-G1 release
Teacher selection DTO boundary != Teacher rehearsal
Teacher selection DTO boundary != Pilot readiness
Teacher selection DTO boundary != Production readiness
```

Relates to #111.
Relates to #114.
Relates to #115.
