# R7 BFF Endpoint Implementation Gate

Source master: `aec5d6f762a16cd3f503bf6c4d33e45a753a830c`

This package defines prerequisites for a future Teacher-only Scenario
Selection BFF endpoint. It is a pure contract and validator. It does not
create a route, handler, controller, frontend fetch, runtime activation,
scenario execution, database change, or OpenAPI/schema change.

Before any implementation, the future route must have an authenticated
Teacher, explicit `tenant_id`, `course_id`, `run_id`, `teacher_id`,
`scenario_package_id`, and `parameter_set_id`. The target Teacher must be
authorized for the course/run and the Scenario Package must be approved.
ParameterSet references remain read-only. Replay remains non-executing and
non-overwriting.

Student invocation is denied. Student projections must exclude private
Scenario evidence, ParameterSet internals, Replay metadata, protected
digests, `state_true`, and other tenant/team data. Tenant Admin and Platform
Admin authority are not inferred by this gate.

The required future authorization is
`OWNER_AUTHORIZED_R7_BFF_ENDPOINT_IMPLEMENTATION`. Gate validation is not
that authorization and is not a runtime readiness or release claim.
