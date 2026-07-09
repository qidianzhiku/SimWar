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

```text
AI Advisory: NOT_AUTHORIZED_TO_WRITE_TRUTH
Plugin Runtime: NOT_AUTHORIZED
```

Relates to #111.
Relates to #114.
Relates to #115.
