# MAIN-SH-FV-O1 Governed Shanghai Full Vertical Design

**Mission:** `MAIN-SH-FV-O1-GOVERNED-SHANGHAI-FULL-VERTICAL`

**Owner authorization:** `OWNER-MAIN-SH-FV-O1-20260828`, `APPROVED_ACTIVE`

## Outcome

Turn the already implemented W5 governed-model path and the existing R7 Shanghai scenario assets into one reproducible, role-safe product journey. A teacher selects an exact Course/Run/Round context and operates an existing W5 draft lifecycle; the resulting exact binding can be previewed through a Shanghai full-vertical composition endpoint; a team-scoped Student receives only the existing role-safe convergence projection; and a tenant Admin receives the exact binding and read-only provenance needed to audit the same candidate.

This is a product composition increment. It does not create a second model registry, store, truth engine, settlement authority, formal writer, provider, or frontend truth calculation.

## Architecture

`ShanghaiFullVerticalService` will be a read/composition boundary over `W5GovernedModelService` and the existing repository facade. It will accept only exact tenant/course/run/round/draft context, verify the W5 draft's frozen binding against the current Run's ScenarioPackage and ParameterSet references, and expose three distinct DTOs. Existing W5 mutation endpoints remain the only teacher draft mutation path; the new GET endpoints are read-only projections and do not append audits or write persistence.

The shared contract will define the role-specific projection shapes and make the visibility boundary explicit. Teacher and Admin may receive exact provenance references as appropriate; Student receives the same bounded W5 student projection without parameter values, content digests, private scenario data, or other-team information. REALIZED remains labeled as Simulation Core-owned and non-written by this composition path.

## Product journey

1. Teacher loads the Shanghai vertical for an exact course. The response lists existing W5 drafts and reports whether an explicit draft has an exact binding.
2. Teacher uses the existing W5 Studio controls to create, validate, freeze, and bind one draft to an exact Run/Round. The composition endpoint then returns a deterministic preview for that exact binding.
3. Student requests the same exact draft/run/round and receives a role-safe projection scoped to the authenticated team.
4. Admin requests the same exact context and receives tenant-scoped provenance, runtime authority, and audit projection.

## API surface

- `GET /api/v1/bff/teacher/shanghai/full-vertical?courseId=...&draftId=...&runId=...&roundNo=...`
- `GET /api/v1/bff/student/shanghai/full-vertical?draftId=...&runId=...&roundNo=...`
- `GET /api/v1/bff/admin/shanghai/full-vertical?courseId=...&draftId=...&runId=...&roundNo=...`

Teacher `draftId`, `runId`, and `roundNo` are optional for the catalog state; when supplied together they are all required for exact preview. Student and Admin require all exact identifiers. All endpoints fail closed on tenant, course, run, round, draft, team, or binding mismatch.

## Non-goals and hard boundaries

- No settlement, replay manifest/hash, canonical decision, or official REALIZED change.
- No formal writer mutation; `formal_writer_mutations=0`.
- No PostgreSQL/RLS activation and no provider activation.
- No new persistent store or registry.
- No automatic next mission, Pilot, Production, Human Validation claim, or merge.
- Shanghai inputs remain synthetic/bounded and explicitly marked uncalibrated.

## Verification

The implementation is test-first. Unit tests cover exact-binding verification and Student redaction. Integration tests run the real HTTP server through Teacher, Student, and Admin BFF paths, including negative tenant/binding cases and a two-team same-candidate/different-consumer-binding assertion. Existing focused W5 tests remain part of the verification set. A real-BFF browser test uses the current dev harness with route mocks disabled and proves the teacher preview and the three role labels without claiming Human Validation or full accessibility.

