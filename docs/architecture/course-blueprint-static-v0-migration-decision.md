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
ordinary code revert, a pre-C1 rollback baseline must already exist. Create
that baseline before enabling C1 writes:

1. Stop the API and copy the last known-good pre-C1 JSON store to a dedicated,
   access-controlled rollback location. Do not synthesize this baseline by
   deleting C1 collections from a newer snapshot.
2. Record a manifest containing the source commit, snapshot version, creation
   timestamp, absolute backup path, byte length, and SHA-256 digest.
3. Verify the copied digest and load the copy with the pre-C1 binary. Run the
   legacy B5 Course/Run Golden check against a disposable copy, then mark the
   manifest `PRE_C1_BASELINE_VERIFIED`.

If this verified baseline is absent or its digest fails, runtime rollback is
blocked. Keep the current runtime stopped or disable the C1 ingress; do not
start an older binary against a C1-bearing snapshot.

With that prerequisite satisfied:

1. Stop the API process so no JSON snapshot write can overlap the rollback.
2. Copy the complete JSON store to a timestamped, access-controlled evidence
   location and verify its SHA-256 digest.
3. Export the three C1 collections (`courseBlueprintBindings`,
   `formalCourseBlueprintApprovalRecords`, and
   `formalCourseBlueprintLifecycleSnapshots`) as an immutable evidence record.
4. Apply an ordinary revert of the eventual PR #295 merge commit. Do not
   cherry-pick inverse fragments, rewrite Git history, delete B5 bindings, or
   edit existing Course/Run records.
5. Resolve the exact `PRE_C1_BASELINE_VERIFIED` manifest, recheck its SHA-256,
   and restore that snapshot to a new runtime path. Never overwrite either the
   pre-C1 backup or the archived C1 snapshot.
6. Load and inspect the restored copy with the reverted binary before opening
   network ingress. A load error, digest mismatch, or B5 Golden failure blocks
   restart.
7. Start the reverted runtime only against the verified restored copy.
8. Verify the legacy B5 Course/Run Golden path again and confirm the active
   runtime remains `JSON_INTERNAL_ONLY`.

This runbook preserves append-only C1 evidence outside the reverted runtime.
It does not claim crash-safe transactions, PostgreSQL recovery, or restoration
of C1 writes into an older binary.
