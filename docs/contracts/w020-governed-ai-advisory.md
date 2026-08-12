# W020 Governed AI Advisory Contract

W020 exposes deterministic, advisory-only role assistance through the API. The
API assembles tenant-, course-, run-, round-, team- and role-scoped context from
authenticated state and sends only allowlisted metadata to an in-repository
deterministic mock provider. There is no external provider, secret, network
call, tool call or business-state write.

The provider returns an untrusted content-only candidate. The governed Agent
Gateway owns policy enforcement, canonical input hashing, `CoachOutput`
identity, `ModelCallLog`, and runtime output validation. `CoachOutput` and
`ModelCallLog` are persisted only as advisory/audit records. The public BFF
receipt contains only validated context, projection, request status and Known
Limits; it never returns the internal `CoachOutput` or `ModelCallLog`.

## Request Variants

Student route:

`POST /api/v1/bff/student/advisors/role`

The closed request requires exact `run_id`, `round_id`, `team_id`, `role_key`
and `idempotency_key`. `activity_id` is forbidden. The authenticated student
must own the requested tenant, team and active role assignment.

Teacher route:

`POST /api/v1/bff/teacher/advisors/debrief`

The closed request requires exact `run_id`, `round_id`, `team_id`, `role_key`,
`activity_id` and `idempotency_key`. The source Course must be published or
active, the Run completed, and the Round published. The exact role/activity
must resolve to an eligible `teaching-closure.v1` source with a course report,
confirmed outcome, confirmed student-safe preview, positive evidence counts,
no missing prerequisites, and `JSON_INTERNAL_ONLY` authority.

The Teacher projection contains only:

- exact activity and role;
- bounded discussion prompts;
- explanation candidates;
- tradeoffs;
- next focus;
- Known Limits.

It does not copy raw events, raw evidence, private payloads, settlement,
replay, score, rank, final-grade or TeacherConfirmation writer state.

## Audit And Persistence

Teacher audit route:

`GET /api/v1/bff/teacher/advisors/audit`

The route returns closed audit entries containing only `model_call_log_id`,
tenant, provider, model, purpose, status, input/output hashes, prompt/completion
token counts, cost, latency, timestamp, surface and context digest. It never
returns raw prompt, provider error detail, advisory text or raw event payload.
There is intentionally no Student audit route.

Successful output and its audit entry are persisted atomically. Provider
failure or rejected output persists one bounded failed/rejected audit entry
and no visible advisory. Audit persistence failure fails closed.

The same tenant-scoped idempotency key and canonical context digest returns the
existing logical output. A changed digest produces a stable conflict. The JSON
repository remains the only active runtime persistence boundary.

## Non-Interference

W020 cannot write canonical Decision, Truth, `SettlementResult`, score, rank,
replay state, `ParameterSet`, TeacherConfirmation or final grade. Human
Validation, external AI effectiveness, durable recovery, Pilot and Production
remain unproven or unauthorized.
