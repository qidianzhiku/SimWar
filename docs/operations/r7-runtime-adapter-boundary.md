# R7 Runtime Adapter Boundary

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

The current package is an operational boundary for a future R7 runtime adapter. It allows documentation, shared-contract types, pure validators and compatibility guards. It does not allow route binding, runtime service registration, frontend entrypoint work, official Scenario binding, official ParameterSet write, Shadow Replay execution or Plugin runtime.

## Operational Limits

```text
runtime_route_enabled = false
scenario_runtime_executes = false
teacher_selection_ui_enabled = false
official_parameter_set_write = false
shadow_replay_overwrites_official_result = false
student_visibility_expansion = false
postgresql_runtime = NOT_AUTHORIZED
pilot = NOT_AUTHORIZED
production = NOT_AUTHORIZED
```

## Handoff Requirements

Before runtime activation, a later mission must provide:

```text
Owner authorization for runtime adapter route
Teacher selection UI scope
Scenario binding guard
ParameterSet version review
Shadow Replay execution guard
Plugin runtime authorization
student projection review
security review for runtime/API changes
```

Relates to #111.
Relates to #114.
Relates to #115.
