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

## S0 Seed-Identity Coverage Preparation (Historical)

This section records test preparation against source HEAD
`686da95e7cefe7480b4384ddee64d2570d30ad06`, not a completed security fix.

- The JSON seed snapshot defines eight identities. The shared-runtime login
  denial set at this source covers five; `usr_default_cfo`, `usr_default_cmo`,
  and `usr_default_coo` are not yet in that set.
- The proposed regression matrix checks every seed identity in both production
  and staging configurations, preserving the existing refusal code, withholding
  authentication tokens, and leaving the session collection unchanged.
- Complete synthetic snapshots reopened through the native store path must retain
  that refusal. Snapshots missing the required `users` array must continue to fail
  validation; normalization must not be treated as an authorized repair path.
- Development/test seed fixtures and legitimate non-seed users remain positive
  controls, alongside wrong-tenant, inactive-user, and invalid-password negatives.
- Fixtures and cleanup belong only to the isolated S0 task. No deployed data,
  credentials, existing sessions, or other tasks' stores may be used or changed.

The prepared HTTP cases in `tests/integration/r3-runtime-boundary.test.ts` have
not been executed in this preparation phase. They are neither observed RED
evidence nor a GREEN acceptance. A separate no-HTTP configuration test, if run,
does not validate the seed-login matrix.

The `services/api/src/server.ts` WRITE_HOLD remains in force. No server fix,
build, loopback HTTP test, Browser, Gate F, deployment, or delivery permission is
granted by this preparation. Shared deployment reachability and credential
rotation remain UNKNOWN; no production vulnerability or remediation is claimed.

## S0 Owner04 Bounded Repair Result

On 2026-10-19, the isolated S0 working candidate based on
`686da95e7cefe7480b4384ddee64d2570d30ad06` completed the separately authorized
Owner04 repair. The earlier preparation record above remains historical, not a
description of the repaired candidate or a retroactive grant of authority.

- The only implementation delta adds `usr_default_cfo`, `usr_default_cmo`, and
  `usr_default_coo` to the existing shared-runtime seed-login denial set. The
  rejection path and session-creation order remain unchanged.
- The two complete affected HTTP test files produced 68 cases: RED retained 12
  expected failures for these three identities across production/staging and
  first-open/reopened synthetic snapshots; GREEN passed all 68 with native exit
  zero. Both prerequisite builds completed with native exit zero.
- The prior isolated installation and 20/20 no-HTTP configuration regression
  were reused. Neither result substitutes for the HTTP matrix or full-suite
  qualification.
- The independent source review accepted the frozen candidate for GREEN only.
  It did not approve commit, remote delivery, merge, or Gate F.
- The frozen GREEN server SHA-256 is
  `2aa00bfb7d082be35060c05044c337bfc4cb96b9f9260f66c306f6d316f3dd9a`;
  the affected boundary-test SHA-256 is
  `bb288348105c1d16f31cff1c503be94404a771183d1066c18a831aa2ca360dc9`.
- The result archive is
  `DELIVERY_SIMWAR_MAIN15_S0_OWNER04_BOUNDED_REPAIR_20261019T0849Z.zip`, SHA-256
  `fdbdeec644cbd4583bad7535b82f686f2218cc0a0cd86bf83185bf3e4eeb47da`.
  It binds the receipts and locators/hashes of locally retained runtime evidence.

The Owner04 server edit window and resource window ended. The server WRITE_HOLD,
closed Student App window, original mainline WIP, and RW4 responsibility boundary
remain in force. Two controller prestart errors and all historical consumption
remain recorded; no budget was refunded or reset.

This is bounded local JSON-runtime evidence, not a claim of full repository
qualification, Git delivery, deployed remediation, credential rotation, Gate F,
or formal MAIN consumption. Shared deployment reachability and operational
credential state remain UNKNOWN. Subsequent qualification and delivery require
their own source-bound results and authority.
