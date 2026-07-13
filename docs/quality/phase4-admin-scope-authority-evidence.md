# Phase 4 Admin Scoped Summary And Explicit Platform Authority Evidence

## Scope

This package consumes the existing Admin BFF contracts in the Admin application without changing
API routes, authentication, shared contracts, persistence, settlement, or replay semantics.

- Tenant Admin uses `GET /api/v1/bff/admin/tenant-summary`.
- Platform Admin uses `GET /api/v1/bff/admin/platform-authority?scope=platform`.
- Teacher and Student roles receive no Admin summary product surface.
- The browser does not provide `x-tenant-id` authority to either Admin BFF request.
- A BFF failure does not fall back to `GET /api/v1/admin/state`.

Source anchor: `f9aa4e2ddf9a33be1ca680c4f93fb1e3b62845a0`.

## Product Surface

The Tenant Admin surface displays only the current tenant identifier and aggregate course, team,
run, and audit-event counts returned by `TenantAdminSummaryDTO`. Existing tenant-scoped user
operations remain available only to `tenant_admin`.

The Platform Admin surface displays the explicit platform authority label and aggregate tenant
count returned by `PlatformAdminAuthorityDTO`. It does not render tenant identifiers, tenant
payloads, user directories, or write controls.

Both product surfaces validate the expected role and authority shape before rendering. A malformed
or over-broad response fails closed with a safe UI message.

## Browser Evidence

`tests/e2e-ui/admin-scope-authority.spec.ts` uses the existing isolated Playwright JSON store and
real API routes. It proves:

- Tenant Admin receives one tenant-summary GET with no client tenant header.
- Tenant Admin cannot call the explicit Platform Admin authority endpoint.
- Platform Admin uses the exact `scope=platform` query and receives only a safe aggregate.
- Missing platform scope returns `BFF-422-001` and does not expose tenant-private payloads.
- Teacher and Student receive no Admin product surface and direct Admin BFF access is denied.
- Missing tenant context does not create implicit platform authority.
- Admin summary reads do not change tenants, users, courses, runs, or settlement results.
- Protected truth, replay, trace, and evidence-digest markers do not enter page text or console.

## Validation

The implementation package requires the repository's current quality gates plus the targeted unit
and browser suites. Validation results are recorded in the mission report; this document does not
claim remote CI status.

## Explicit Non-Proofs

- Admin BFF consumption does not grant `G0 PASS`.
- Admin BFF consumption does not make `L1 READY`.
- Browser evidence is not complete security proof.
- Aggregate visibility is not Scenario runtime activation.
- JSON runtime evidence is not durable settlement.
- This package does not authorize Controlled Pilot or Production.

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY
```
