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

The legal lifecycle is:

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
only `AVAILABLE` teacher-safe projections. There is intentionally no student
route or student DTO.

Stable command errors are `COURSE_PACKAGE_INPUT_INVALID`,
`COURSE_PACKAGE_NOT_FOUND`, `COURSE_PACKAGE_TENANT_SCOPE_VIOLATION`,
`COURSE_PACKAGE_DUPLICATE_VERSION`, `COURSE_PACKAGE_DEPENDENCY_NOT_BINDABLE`,
`COURSE_PACKAGE_COMPATIBILITY_MISMATCH`, `COURSE_PACKAGE_IMPORT_DIGEST_INVALID`,
`COURSE_PACKAGE_LIFECYCLE_INVALID`, and `COURSE_PACKAGE_FORBIDDEN`.

The JSON schema, fixture, shared types, and OpenAPI entries are frozen by this
contract commit. Runtime implementation follows in a separate commit.

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
