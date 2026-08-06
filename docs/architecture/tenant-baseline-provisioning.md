# Tenant baseline provisioning and CoursePackage bootstrap

## Decision

This capability uses **tenant-local immutable materialization**. A platform
administrator explicitly selects exact, approved formal `ParameterSet` and
`ScenarioPackage` versions and provisions a new tenant through
`POST /api/v1/admin/tenant-baselines/provision`.

The command is an API control-plane operation. It does not read legacy
`tenant_demo` arrays, does not create a catalog or a second asset registry, and
does not activate PostgreSQL, migrations, RLS, simulation, settlement, replay,
or any Truth write path.

## Authority and provenance

The existing formal ParameterSet and ScenarioPackage command services remain
the sole normal writers. The provisioner composes their existing immutable
lifecycles:

```text
approved source ParameterSet + approved source ScenarioPackage
  -> target-local ParameterSet DRAFT -> VALIDATED -> FROZEN -> APPROVED
  -> target-local ScenarioPackage DRAFT -> VALIDATED -> FROZEN -> APPROVED
```

Each target version carries the same immutable
`TenantBaselineProvenance` record. It preserves:

- source tenant and exact ParameterSet reference;
- source tenant and exact ScenarioPackage reference;
- request and idempotency-key digests;
- the `tenant-baseline-provenance.v1` schema marker.

Free-form display metadata is deliberately excluded from the provisioning
request, provenance, formal lifecycle snapshots, approvals, and content-digest
inputs. It is not a formal baseline identity or idempotency input. The request
digest covers only target identity, exact structured source references/source
tenant identities, the provenance schema version, and the idempotency identity.

The target ScenarioPackage binds the target-local approved ParameterSet, never
the source tenant's ParameterSet. CoursePackage validation therefore continues
to use its existing same-tenant source authority checks. A source update never
changes a previously provisioned target baseline or a CoursePackage that has
already bound its exact reference.

## Identity, retry, conflict, and failure semantics

The target asset IDs are deterministic hashes of the target tenant and the
idempotency-key digest. A retry with the same complete request returns
`REUSED`; it must find both target assets approved, provenance-identical, and
bound together. The same idempotency key with different structured source
provenance returns `TENANT_BASELINE-409-001` and never overwrites an
approved version.

The source ScenarioPackage and ParameterSet must:

1. belong to the same explicitly named source tenant;
2. be exact references;
3. be `APPROVED`; and
4. show that the source ScenarioPackage binds that exact source ParameterSet.

Failure mapping is intentionally consistent with the existing API envelope:

| Situation                                             | HTTP / code                   |
| ----------------------------------------------------- | ----------------------------- |
| Non-platform caller                                   | `403 TENANT_BASELINE-403-001` |
| Unknown source or target                              | `404 TENANT_BASELINE-404-001` |
| Unapproved or malformed source request                | `422 TENANT_BASELINE-422-001` |
| Reused idempotency identity with different provenance | `409 TENANT_BASELINE-409-001` |

For the active JSON-internal runtime, the formal authority persistence seam
identifies the exact ParameterSet and ScenarioPackage lifecycle records that
the provisioning attempt generated. Normal writes still use the existing
command services; private compensation removes only records with the attempt's
tenant, deterministic asset IDs, and provenance digests. If a later append
fails, that exact materialization is removed and persisted without replacing
whole authority collections. This prevents a successful ParameterSet plus a
missing ScenarioPackage while preserving unrelated formal-authority writes in
the running JSON process.

## Security and Truth boundary

Only `platform_admin` may provision across tenants. Tenant administrator,
teacher, and student roles cannot provision source assets. A target tenant
receives its own IDs and content digests; a CoursePackage request with another
tenant's ScenarioPackage reference is rejected by the existing CoursePackage
input and source-scope boundary.

The provisioner may write only the two target formal lifecycle collections and
an audit log. It must not write Decisions, SettlementResults, FinanceLedger,
Score, Rank, replay data, Run state, Round state, or the approved source
versions. `TenantBaselineProvenance` is control-plane evidence, not a replay or
settlement input.

## Runtime evidence and known limits

`tests/integration/tenant-baseline-provisioning-endpoint.test.ts` exercises the
route through `createApiServer` and real HTTP requests. In one single server it
creates a source tenant and two new target tenants, checks no target baseline
exists, provisions both, verifies idempotent reuse and conflict behavior,
drives a target-local CoursePackage to `AVAILABLE` in each tenant, rejects a
foreign reference, and snapshots Truth-adjacent collections before and after.
This is E3 evidence.

`tests/unit/tenant-baseline-provisioning.test.ts` injects a ScenarioPackage
append failure after the target ParameterSet lifecycle has started and verifies
that exact JSON compensation leaves no target half-baseline while preserving an
unrelated concurrent formal-authority write. This is focused E1/E2 failure-path
evidence; it is not a durable cross-process transaction proof.

The current JSON adapter cannot give a crash-safe, multi-process transaction
guarantee across two registries. PostgreSQL activation, RLS, a global approved
catalog, an Admin baseline-selection UI, teacher source authoring, Eldercare,
Pilot, and Production remain outside this change and require separate owner
authorization.

`automatic_next_start: false`
