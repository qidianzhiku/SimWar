# Phase 6 Limited Internal Evidence Capture Template

## Status Boundary

```text
Current master anchor:
695cf955b3c9ab1d96b7fb59ac92671cf82dfdcf

G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

Phase 7:
NOT_AUTHORIZED

Controlled Pilot:
NOT_AUTHORIZED

Production:
NOT_AUTHORIZED

PostgreSQL runtime:
NOT_AUTHORIZED
```

Use this form only for synthetic, isolated Phase 6 pack evidence. It is a blank
template, not evidence that a session ran or passed.

## Capture Policy

```text
SYNTHETIC_DATA_ONLY
DO_NOT_RECORD_SECRETS_OR_PRIVATE_PAYLOADS
DO_NOT_RECORD_REAL_USER_OR_CUSTOMER_DATA
DO_NOT_RECORD_STATE_TRUE_OR_PRIVATE_REPLAY_PAYLOADS
```

Record stable identifiers and classifications, not request/response bodies.

## Session Record

```yaml
source_sha: 695cf955b3c9ab1d96b7fb59ac92671cf82dfdcf
exception_expiry: 2026-07-21T23:59:59+08:00
captured_at: <ISO-8601 timestamp>
actor_role: <teacher|student|tenant_admin|platform_admin|internal_operator>
tenant_id: <synthetic tenant identifier>
course_id: <synthetic course identifier or NOT_APPLICABLE>
run_id: <synthetic run identifier or NOT_APPLICABLE>
round_no: <positive integer or NOT_APPLICABLE>
request_id: <stable request identifier or NOT_APPLICABLE>
evidence_label: <approved evidence label>
result: <PASS|PASS_WITH_LIMITS|FAIL|NOT_RUN|UNKNOWN>
explicit_non_proof: <what this evidence does not establish>
expiry_trigger: <source, policy, product or evidence change>
no_go_trigger: <trigger observed or NONE>
owner_disposition_required: <YES|NO>
```

`UNKNOWN` and `NOT_RUN` never count as `PASS`.

## Product Alignment Record

```yaml
teacher_workspace_observed: <YES|NO|NOT_RUN>
student_redacted_result_observed: <YES|NO|NOT_RUN>
tenant_scope_preserved: <YES|NO|NOT_RUN>
student_forbidden_marker_scan: <PASS|FAIL|NOT_RUN>
known_limits_visible: <YES|NO|NOT_RUN>
formal_state_mutation_observed: <YES|NO|NOT_RUN>
direct_store_access_observed: <YES|NO|NOT_RUN>
```

Any private marker, cross-tenant/team visibility, implicit platform authority,
formal-state mutation or direct-store access is a no-go result.

## Replay Review Record

```yaml
official_result_identity_before: <safe identifier or NOT_RUN>
official_result_identity_after: <safe identifier or NOT_RUN>
replay_status: <matched|mismatch|NOT_RUN>
replay_writes_formal_results: <false|true|NOT_RUN>
dedicated_shadow_replay_http_route: NOT_PROVEN
durable_recovery: NOT_PROVEN
```

`replay_writes_formal_results: true` is an immediate no-go. Replay evidence is
not backup, restore, crash recovery or durable settlement proof.

## Abort, Reset and Cleanup Record

```yaml
abort_trigger: <stable error/no-go code or NONE>
evidence_preserved_before_reset: <YES|NO|NOT_RUN>
reset_boundary: SYNTHETIC_IN_MEMORY_RESET_ONLY
fresh_store_verified: <YES|NO|NOT_RUN>
real_data_touched: NO
production_cleanup_claimed: NO
durable_recovery_claimed: NO
```

Do not use SQL, migration, database deletion, direct JSON editing or production
cleanup tooling for this pack.

## Final Disposition

```yaml
pack_candidate_status: <PASS_WITH_LIMITS|FAIL|NOT_RUN|UNKNOWN>
phase6_closure: NOT_COMPLETED
phase7: NOT_AUTHORIZED
g0_pass: NOT_GRANTED
l1_status: NOT_READY
controlled_pilot: NOT_AUTHORIZED
production: NOT_AUTHORIZED
reviewer_notes: <bounded notes without private payloads>
```

## Expiry

This template and any record created from it expire at
`2026-07-21T23:59:59+08:00` or earlier on the event triggers defined in
`docs/operations/r8-g1-internal-application-pack-index.md`.

## Explicit Non-Proof

Completing this form does not prove Phase 6 closure, Phase 7 authorization, a
real Teacher rehearsal, Pilot, Production, PostgreSQL parity, crash recovery,
backup restore, durable cleanup, durable recovery or durable settlement.
