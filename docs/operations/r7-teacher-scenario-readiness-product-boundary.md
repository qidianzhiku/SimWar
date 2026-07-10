# R7 Teacher Scenario Readiness Product Boundary

## Operator Flow

1. Sign in through the existing Teacher authentication flow.
2. Open a Teacher Run Workspace with an existing Run.
3. Enter internal Scenario Package and ParameterSet identifiers.
4. Select `Check readiness`.
5. Read `READY`, `BLOCKED`, or a generic safe error state.

## Known Limits

```text
Readiness check only
No Scenario runtime activation
No ParameterSet binding or mutation
No Replay execution
No settlement
No official result publishing
No Pilot or Production readiness claim
```

The panel is internal-only. It does not provide a Scenario catalog, search,
autocomplete, Student access, Admin bypass, background persistence, or an
activation action.

```text
G0 Status: EXCEPTION
G0 PASS: NOT_GRANTED
L1 Status: NOT_READY
```
