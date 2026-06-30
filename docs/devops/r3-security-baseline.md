# R3 Security Baseline

This note records the R3 security baseline for the current JSON active runtime. It is a delivery boundary for auth, tenant, RBAC, Team membership, field visibility, internal-route exposure, and demo posture before any real teaching trial is considered.

## Runtime Posture

- Shared environments must fail closed when required runtime security configuration is missing or unsafe.
- Session tokens remain signed by the current project implementation and are checked against stored session hash and expiry.
- Demo shortcuts are allowed only when an explicit demo-mode environment is configured. Frontend apps must not silently prefill or auto-submit demo credentials in non-demo, shared, or production-like modes.
- Operational source, PR descriptions, logs, and reports must not disclose secret, token, private key, or credential values. Test-only seed literals remain limited to local verification and must not be copied into delivery reports.

## Tenant, RBAC, and Team Membership

- Request tenant context is checked before protected resource access.
- Cross-tenant request headers are rejected for non-platform actors.
- RBAC enforcement remains centralized through the current role-to-permission matrix and route-level permission checks.
- Student decision submission remains limited to the actor's own Team, current tenant, course, run, and round.
- Invalid roles are rejected before user role assignment.
- Creating a user requires an explicit password; no fallback credential is assigned by the API.

## Field Visibility

- Student result views must not include `state_true`, replay-private metadata, `decision_batch_hash`, `json_runtime_source_digest`, `canonical_evidence_digest`, Teacher/Audit metadata, or other-Team sensitive data.
- Teacher and Admin result views may keep their currently authorized fields, including classroom replay evidence and teaching debrief material.
- Error envelopes must not expose stack traces, token values, credential values, password hashes, or internal implementation details.

## Internal Settlement Route

- `/internal/v1/runs/{runId}/rounds/{roundNo}/settle` is an internal service-principal-only operation.
- The route must require the internal service bearer credential and service principal marker at runtime.
- Public browser clients and frontend code must not call `/internal/v1`.
- The OpenAPI contract must mark the internal operation as internal-only and not a public-client operation.

## Direct-Store Boundary

- `npm run check:direct-store-boundaries` must report zero new unapproved runtime direct-store access.
- Existing approved legacy exceptions are evidence limitations, not a complete security proof.
- This baseline does not close #114.

## Not Claimed

- This is not Internal Pilot readiness.
- This is not Controlled Teaching Pilot readiness.
- This is not Production readiness.
- This does not activate PostgreSQL, schema, migration, SQL, provider switching, RLS, durable settlement, transaction, row lock, backup/restore, or cross-process recovery.
- This does not close #111, #114, or #115.
