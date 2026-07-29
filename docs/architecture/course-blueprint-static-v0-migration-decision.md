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
