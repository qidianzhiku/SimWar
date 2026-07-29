# Static CourseBlueprint v0 Migration Decision

## Status

`M1_TEACHING_PRODUCT_PACKAGE.courseBlueprint` is `LEGACY_READ_ONLY`.

## Current Consumers

- The Teacher application may render the static package as a legacy teaching panel.
- The Student application may use its existing learner onboarding projection.
- Unit fixtures may use the constant as a comparison fixture.

## Formal Authority

New Course creation can use only an exact, `APPROVED` CourseBlueprint version
through `CourseBlueprintCommandService`. Static v0 never bootstraps the formal
registry, is never auto-approved, and cannot create a CourseBlueprint binding.

## Boundary

CourseBlueprint bindings are independent teaching-structure records. B5
`FormalCourseAuthorityBinding` remains the sole binding for ScenarioPackage,
ParameterSet, Plugin, and Engine inputs. CourseBlueprint data is excluded from
simulation truth, settlement, score, rank, and replay hash inputs.

## Invalidation And Removal Gate

This decision is invalidated by any change to CourseBlueprint identity,
lifecycle, Course creation orchestration, Teacher/Student projection, or B5
binding semantics. Static v0 can be removed only after its Teacher and Student
consumers have a separately reviewed migration and regression evidence.

## Ordinary Revert Runbook

CourseBlueprint remains synthetic/internal and JSON-only in C1. Before an
ordinary code revert:

1. Stop the API process so no JSON snapshot write can overlap the rollback.
2. Copy the complete JSON store to a timestamped, access-controlled evidence
   location and verify its SHA-256 digest.
3. Export the three C1 collections (`courseBlueprintBindings`,
   `formalCourseBlueprintApprovalRecords`, and
   `formalCourseBlueprintLifecycleSnapshots`) as an immutable evidence record.
4. Apply an ordinary revert of the C1 product commit. Do not rewrite Git
   history, delete B5 bindings, or edit existing Course/Run records.
5. Start the reverted runtime only against a pre-C1 snapshot. The archived C1
   snapshot is read-only and must not be passed to a runtime that does not
   preserve its C1 collections.
6. Verify the legacy B5 Course/Run Golden path and confirm the active runtime
   remains `JSON_INTERNAL_ONLY`.

This runbook preserves append-only C1 evidence outside the reverted runtime.
It does not claim crash-safe transactions, PostgreSQL recovery, or restoration
of C1 writes into an older binary.
