# R7 Teacher Scenario Selection Compatibility Matrix

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

## Teacher Scenario Selection BFF/DTO Boundary

| Area                       | Current Status               | Evidence Label              | Boundary                                         |
| -------------------------- | ---------------------------- | --------------------------- | ------------------------------------------------ |
| Scenario package reference | REFERENCE_ONLY               | CONTRACT_BACKED_EVIDENCE    | no runtime scenario publish                      |
| ParameterSet reference     | REFERENCE_ONLY               | CONTRACT_BACKED_EVIDENCE    | official_parameter_set_write = false             |
| Plugin package reference   | REFERENCE_ONLY               | CONTRACT_BACKED_EVIDENCE    | Plugin Runtime: NOT_AUTHORIZED                   |
| Shadow Replay reference    | REFERENCE_ONLY_NON_EXECUTING | CONTRACT_BACKED_EVIDENCE    | shadow_replay_overwrites_official_result = false |
| Teacher selection DTO      | BOUNDARY_PACKAGE_ONLY        | CONTRACT_BACKED_EVIDENCE    | runtime_route_enabled = false                    |
| Student projection         | UNCHANGED                    | STUDENT_PROJECTION_EVIDENCE | student_visibility_expansion = false             |
| Direct store               | NONE                         | SOURCE_INTEGRITY_EVIDENCE   | direct_store_access = false                      |

## Required Future Gates

```text
OWNER_AUTHORIZED_TEACHER_SELECTION_RUNTIME_ROUTE
OWNER_AUTHORIZED_PARAMETERSET_VERSION_REVIEW
OWNER_AUTHORIZED_SHADOW_REPLAY_EXECUTION_GUARD
OWNER_AUTHORIZED_R8_G1_RELEASE_REVIEW
```

## Negative Boundary Assertions

```text
runtime_route_enabled = false
teacher_bff_endpoint_enabled = false
frontend_ui_enabled = false
official_parameter_set_write = false
official_scenario_binding_write = false
shadow_replay_executes = false
shadow_replay_overwrites_official_result = false
student_visibility_expansion = false
```

## Explicit Non-Proofs

This compatibility matrix is not a runtime BFF route, Scenario Factory runtime, official Scenario binding, official ParameterSet write, Shadow Replay execution, R8-G1 release, Teacher rehearsal, Pilot readiness, or Production readiness.

Relates to #111.
Relates to #114.
Relates to #115.
