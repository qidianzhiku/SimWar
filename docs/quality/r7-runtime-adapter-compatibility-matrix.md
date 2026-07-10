# R7 Runtime Adapter Compatibility Matrix

## Status Boundary

```text
Source SHA:
9bc3c1dac3491fd6103fb50354bff566b75579ef

G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

R8-G1 Status:
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

## Runtime adapter preparation without activation

| Area                       | Current Status                             | Evidence Scope                    | Required Future Gate                         |
| -------------------------- | ------------------------------------------ | --------------------------------- | -------------------------------------------- |
| Teacher selection boundary | READY_BY_REFERENCE                         | merged DTO/query/command boundary | OWNER_AUTHORIZED_R7_SCENARIO_RUNTIME_ADAPTER |
| Scenario package reference | REFERENCE_ONLY_NON_BINDING                 | scenario_package_id only          | Scenario runtime activation review           |
| ParameterSet reference     | REFERENCE_ONLY_NON_WRITING                 | parameter_set_id and version only | ParameterSet version review                  |
| Plugin package reference   | REFERENCE_ONLY_NON_RUNTIME                 | plugin_package_id only            | Plugin runtime authorization                 |
| Seed reference             | REFERENCE_ONLY_NON_EXECUTING               | seed only                         | runtime adapter execution gate               |
| Shadow Replay reference    | REFERENCE_ONLY_NON_EXECUTING_NON_OVERWRITE | non-overwrite boundary            | Shadow Replay execution guard                |

## Activation and Boundary Matrix

```text
runtime_route_enabled = false
api_route_enabled = false
bff_endpoint_enabled = false
frontend_ui_enabled = false
scenario_runtime_executes = false
service_registration = false
official_parameter_set_write = false
official_scenario_binding_write = false
shadow_replay_overwrites_official_result = false
student_visibility_expansion = false
direct_store_delta = NONE
```

## Non-Proof Matrix

This compatibility matrix is not Scenario runtime activation, not a runtime API route, not Teacher scenario selection UI, not official Scenario binding, not official ParameterSet write, not Shadow Replay execution, not Plugin runtime, not AI advisory runtime, not R8-G1 release, not Pilot readiness and not Production readiness.

Relates to #111.
Relates to #114.
Relates to #115.
