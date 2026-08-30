# C5 CoursePackageVersion Contract Freeze

## Scope and authority decision

`CoursePackageVersion` is a new, JSON-internal, immutable teaching/configuration
aggregate. It is not a relabeled `CourseBlueprint`, a `ScenarioPackage`, a
`ParameterSet`, a Model artifact, or a formal Course/Run binding.

`CoursePackageCommandService` is the only writer for the new aggregate and its
append-only lifecycle snapshots. It is the sole C5 writer only: it does not
create, update, approve, retire, or otherwise write an existing
`CourseBlueprint`, `ScenarioPackage`, `ParameterSet`, `ModelVersion`, Course,
Run, canonical Decision, truth field, SettlementResult, Score, Rank, Replay
input, Replay result, PostgreSQL record, migration, or external AI result.

## Identity and legal lifecycle

The closed identity is `(tenant_id, course_package_id, version, content_digest)`.
Every dependency uses an exact id, exact version, and SHA-256 content digest;
`latest`, wildcards, aliases, and unresolved placeholders are invalid.

The baseline C5 lifecycle is:

```text
DRAFT -> VALIDATED -> AVAILABLE -> RETIRED
```

Content and the three dependency references are immutable for a version. A
transition records a new lifecycle snapshot with the same package content digest;
it does not mutate a source object. A clone or import creates a different DRAFT
version that must complete validation independently.

## Binding relationship and validation

Each package binds exactly one approved `CourseBlueprint`, `ScenarioPackage`,
and `ParameterSet` reference. Before `VALIDATED` and again before `AVAILABLE`,
the command service reads the existing lifecycle services and verifies:

1. all references are tenant-scoped and currently approved/bindable;
2. the ScenarioPackage's exact ParameterSet reference equals the package's;
3. each CourseBlueprint scenario compatibility constraint equals the selected
   ScenarioPackage compatibility metadata.

The package records a teaching/configuration choice only. It does not create a
Course or Run binding and never changes an existing or historical Course.

Instructor assets are excluded because their established lifecycle is
course-bound and teacher-owned. Role workflow records are excluded because they
are run/round/team-bound and remain on the existing canonical decision path.

## Boundary and API posture

The server derives `tenant_id` and `created_by` from the authenticated request;
client draft, clone, and import inputs cannot supply either as authoritative
values. Admin endpoints own lifecycle commands and export. The teacher BFF lists
`AVAILABLE` baseline packages and strictly validated `PUBLISHED` Course
Factory packages as teacher-safe projections. There is intentionally no
student route or student DTO.

Stable command errors are `COURSE_PACKAGE_INPUT_INVALID`,
`COURSE_PACKAGE_NOT_FOUND`, `COURSE_PACKAGE_TENANT_SCOPE_VIOLATION`,
`COURSE_PACKAGE_DUPLICATE_VERSION`, `COURSE_PACKAGE_DEPENDENCY_NOT_BINDABLE`,
`COURSE_PACKAGE_COMPATIBILITY_MISMATCH`, `COURSE_PACKAGE_IMPORT_DIGEST_INVALID`,
`COURSE_PACKAGE_LIFECYCLE_INVALID`, and `COURSE_PACKAGE_FORBIDDEN`.

Package titles and descriptions are non-empty and cannot contain leading or
trailing whitespace. The runtime, JSON Schema, and OpenAPI contract enforce
the same rule. A successful administrative export appends a tenant-scoped
`course_package_version.export` audit record before its payload is returned.
If that audit write fails, the request returns the stable
`COURSE_PACKAGE_EXPORT_AUDIT_FAILED` response without exporting the package;
this read-path failure does not introduce retries, transactions, recovery, or
any new source-authority write.

The JSON schema, fixture, shared types, and OpenAPI entries are frozen by this
contract commit. Runtime implementation follows in a separate commit.

## Wave 002 Phase B authorization delta

The contract-freeze commit `f22e360c8369ceca98438b1cdc846ce41cd80e46`
remains the authoritative C5 freeze. Wave 002's required primary outcome adds
one narrow server-authorized workflow: an authenticated tenant-scoped
`teacher` may call `POST /api/v1/bff/teacher/course-package-versions/clone`
with a closed exact reference to an `AVAILABLE` package. It delegates to the
same sole-writer `CoursePackageCommandService`, derives tenant and actor on the
server, and returns `CoursePackageVersionTeacherDto` only. The result is a new
immutable `DRAFT` package, never a Course or Run; it cannot write a source
lifecycle, truth, SettlementResult, Score, Rank, ParameterSet, ModelVersion,
Replay, PostgreSQL, migration, external AI, instructor asset, or role workflow
record.

## R3 governed Course Factory extension

R3 evolves the same aggregate and the same sole
`CoursePackageCommandService` writer; it does not create a second registry,
store, provider, or truth authority. A version carrying valid
`factory_metadata.schema_version = course-factory.v1` follows this separate
closed lifecycle:

```text
DRAFT -> VALIDATED -> APPROVED -> PUBLISHED -> SUPERSEDED -> RETIRED
                                      \--------------------> RETIRED
```

The existing baseline lifecycle remains
`DRAFT -> VALIDATED -> AVAILABLE -> RETIRED`. The legacy C5 lifecycle route
may retire only an `AVAILABLE` baseline package. It must reject Course Factory
versions; all factory transitions pass through `CourseFactoryService` and the
factory-specific command methods on the same writer.

`factory_metadata` is authority-bearing, not a presence flag. The shared
runtime guard validates the exact tenant, source references, digests, rights,
expiry timestamp, provenance and no-user-data policy at persistence, service
and delivery boundaries. A malformed or partial metadata object cannot create
a factory history, enter the Teacher delivery projection, or reach W025 or
Learning Design consumption. A legacy `PUBLISHED` value without strictly
valid factory metadata is not delivery-ready.

R3 remains configuration and delivery authority only. Its factory transitions
cannot create or mutate a Course, Run, canonical Decision, truth field,
SettlementResult, Score, Rank, Replay input/result, provider or PostgreSQL
record.

## Freeze receipt

- Source anchor: `origin/master` at `7527ba5256b3245e5a95a2b3c481e86711e44b95`.
- Isolated branch: `wave002/c5-backend`.
- Runtime boundary: `JSON_INTERNAL_ONLY`.
- Source mapping evidence: CourseBlueprint, ScenarioPackage, and ParameterSet
  remain exact-reference lifecycle services; InstructorAssetRegistry remains
  course-bound; RoleWorkflowCommandService remains run/round/team-bound.
- CodeGraph: unavailable by repository state (`.codegraph` absent); explicit
  source review used instead.
- Contract RED timestamp: `2026-08-02T11:06:59.0829171+08:00`.
