# Formal ParameterSet Lifecycle API Design

## Goal

Make the existing persisted `ParameterSetCommandService` available through a
small, authenticated API so a formal ScenarioPackage can eventually depend on
an approved ParameterSet without tests writing lifecycle snapshots directly.

## Scope

`platform_admin` receives the new `parameter_set:manage` permission. The API
will create a draft and transition one exact reference through `VALIDATED`,
`FROZEN`, `APPROVED`, and `RETIRED`. Each accepted write appends the existing
audit-log shape. The API only adapts requests to the existing command service;
it does not calculate truth, select a runtime scenario, activate a plugin, or
change a Run.

## Boundary

The `ParameterSetCommandService` remains the sole formal writer. The API
runtime explicitly retains the instance composed from the persisted formal
authority runtime so the HTTP layer can construct its actor from the
authenticated request context and pass a tenant-scoped draft or exact
reference to that service. It must not access the JSON formal-authority
collections directly or reuse the narrower Run-binding read port as a writer.

Only `platform_admin` may use this first governance ingress. Tenant admins,
teachers, and students are rejected. Platform administrators still act only
within the request tenant; a body tenant identifier cannot select a different
tenant.

## API Shape

The public contract exposes:

- `POST /api/v1/formal-authority/parameter-sets` to create a `DRAFT`;
- `POST /api/v1/formal-authority/parameter-sets/{parameterSetId}/versions/{version}/validate`;
- `POST /api/v1/formal-authority/parameter-sets/{parameterSetId}/versions/{version}/freeze`;
- `POST /api/v1/formal-authority/parameter-sets/{parameterSetId}/versions/{version}/approve`;
- `POST /api/v1/formal-authority/parameter-sets/{parameterSetId}/versions/{version}/retire`.

All transition requests carry the full immutable reference, including
`content_digest`, so no floating identity can be resolved by the HTTP layer.
Approval additionally carries a nonblank `approval_id`.

## Error and Audit Behavior

Malformed bodies produce the established 422 error envelope. Authentication
and permission failures use the existing 401/403 behavior. Command-service
failures are projected without exposing internal store details. Successful
commands append an audit event with the acting platform administrator, request
correlation id, formal resource id, and transition action.

## Tests

An integration test drives the complete lifecycle through HTTP using the
persisted default runtime. It proves the approval snapshot and record survive
the API call, rejects a tenant-admin request, rejects an invalid transition,
and checks that audit records are appended. Existing unit authority tests
continue to protect digest, immutability, and transition semantics.

## Non-Goals

No ScenarioPackage write endpoint, PluginRelease endpoint, UI, runtime
activation, Run binding change, replay execution, settlement mutation,
PostgreSQL activation, migration, external model, or live data is included.
