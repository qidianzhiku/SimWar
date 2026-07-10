# R7 BFF Endpoint Implementation Boundary

The implementation gate is a reviewable internal safety contract. It may be
used to decide whether a separately authorized Teacher Scenario Selection BFF
implementation is sufficiently specified, but it cannot execute that
operation.

Required future evidence includes authenticated Teacher identity, explicit
tenant/course/run scope, approved Scenario Package provenance, read-only
ParameterSet references, Replay non-overwrite evidence, Student negative
visibility tests, security review, and browser regression coverage.

No route, handler, controller, frontend fetch, runtime adapter activation,
Scenario execution, PostgreSQL, SQL, migration, AI runtime, Plugin runtime,
Pilot, or Production action is authorized by this document.
