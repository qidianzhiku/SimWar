# Governed multi-epoch evidence adoption and retained Run admission

O5 extends the existing Model Qualification governance plane. It does not create a
model registry, data store, truth engine, settlement authority, or formal writer.
The active application runtime remains JSON. Provider and durable database
activation are outside this change.

## Explicit future admission

Teacher and tenant Admin use their existing role BFF to request an exact qualified
epoch, review that immutable proposal, and record one disposition. An epoch binds
tenant/course, source package and content digest, calibration dataset and digest,
qualification and digest, exact model version/artifact, and source expiry.
The server derives the epoch from retained authority records; callers supply a
qualification identifier and an explicit expected adoption id/digest, not their
own evidence object.

Only `ADOPTED_FOR_FUTURE_ADMISSION` advances the explicit selection for the exact
model/artifact scope. `DEFERRED_WITH_EXPIRY`, `REJECTED_CANDIDATE`, and
`REBASE_REQUIRED` are retained dispositions and do not replace the selection.
Review is not adoption. The domain fails closed on scope, identity, command,
digest, predecessor, or ambiguous-state conflicts. It never sorts timestamps or
uses latest/default/array-last selection. Retry fingerprints exclude execution
time; immutable proposal, review and adoption digests include their receipt data.

Existing `MAIN_MODEL_GOVERNANCE` persists the optional `evidence_adoption` state
inside the existing ModelQualificationRecord. A pure reducer owns no persistence.
Within the active single-process JSON runtime, a scoped admission guard prevents
Model Qualification mutations during asynchronous formal Run creation. This is
not a distributed transaction or multi-process durability claim.

## Version boundary and historical resolution

`QualifiedRunAdmission` v1 remains readable as historical evidence. New O5
admission uses `qualified-run-admission.v2` and requires adoption id/digest in
addition to the exact O4 CoursePackage, ScenarioPackage, ParameterSet,
ModelVersion, ModelArtifact, SourcePackage, CalibrationDataset and Qualification.
O4 eligibility is rechecked before writes. Once a course has O5 adoption state,
omitting the qualified selector cannot bypass admission.

The existing Run writer stores a private, immutable
`qualified-run-admission-snapshot.v1` in its existing Run payload. This snapshot
does not enter FormalRunRuntimeBinding, replay hash inputs, settlement selection,
or the public seven-field Run projection. Ordinary status updates preserve it;
replacement or backfill onto an old Run is rejected. New Run/Round/binding writes
continue to use the existing formal creation and failure compensation path.

Teacher/Admin historical readback uses the exact saved snapshot plus retained
Model Qualification evidence, not the current adoption pointer or current model
catalog eligibility. An expired or retired historical epoch can remain readable;
missing or altered retained identity fails closed. Historical W025 v1 lookup
requires its exact launch id and returns the stored v1 receipt unchanged. It never
synthesizes an adoption or upgrades a past receipt. The existing W025 launch path
uses vNext for new admission and its saved receipt for an idempotent retry.

## Role-safe surfaces

Teacher and Admin share an exact-context adoption panel inside their existing MQR
surface. Commands, selectors and historical inspection are explicit. A context
change discards pending responses and prevents painting a prior context's receipt;
same-tick submit events are serialized. Student receives only safe applicability
and known-limit information, never private adoption digests or historical receipts.
Adoption is not model truth, official REALIZED, settlement, score or rank.

The canonical OpenAPI describes both governance roles' request/review/disposition
routes, exact historical lookup, and the vNext admission schema. The Model
Qualification schema retains old fixtures and validates the optional O5 extension.

## Verification entry points

From a clean checkout, install declared dependencies with `npm ci`, then:

```powershell
npm run build:test-prerequisites
npm run build -w @simwar/ui
npx vitest run tests/unit/model-qualification-evidence-adoption.test.ts tests/integration/model-qualification-evidence-adoption.test.ts tests/contract/model-qualification-evidence-adoption-history.test.ts
npx vitest run tests/integration/model-qualification-adopted-formal-run.test.ts tests/integration/model-qualification-admission-snapshot.test.ts tests/integration/model-qualification-o5-http.test.ts tests/contract/model-qualification-adoption-openapi.test.ts tests/unit/model-qualification-adopted-run-admission.test.ts tests/unit/model-qualification-adoption-route-parsing.test.ts tests/unit/ui-model-qualification-adoption.test.tsx
npx playwright test --config playwright.o5.config.ts --workers=1
```

The O5 browser configuration uses a synthetic course initialized through existing
authority commands, real API/BFF routes and no target-route mocks. Give concurrent
runs independent `SIMWAR_PLAYWRIGHT_*_PORT` values and a store file under the
controlled temporary `simwar-playwright/<mission>/playwright-store.json` root.
Focused browser/axe results do not establish Human Validation, full WCAG
conformance, production readiness or durable PostgreSQL application activation.

## O6 adoption operations and rollback dry-run

O6 adds a read-only operations layer over the existing O5 evidence-adoption
authority. Teacher and Admin can inspect current adoption health, request a
deterministic drift assessment, and preview the impact of selecting one exact
historically adopted predecessor. Student receives only a role-safe
applicability, freshness, requalification-impact, and known-limit projection.
The operations layer does not add a writer, store, registry, truth engine,
settlement authority, scheduler, rollback-apply route, or automatic rollback.

The canonical role-BFF entry points are:

- `GET /api/v1/bff/teacher/model-qualification/adoption-operations`
- `GET /api/v1/bff/admin/model-qualification/adoption-operations`
- `GET /api/v1/bff/student/model-qualification/adoption-operations`
- Teacher/Admin `POST .../drift-assessments`
- Teacher/Admin `POST .../rollback-dry-runs`

Every assessment and rollback dry-run binds the caller's exact adoption
identifier and digest to both the complete current adoption-state digest and the
versioned operations-policy digest. If the adoption selection or either digest
changes before evaluation, the result is `REBASE_REQUIRED`; the runtime never
falls back to latest, current, default, first, last, or newest-timestamp
selection. A rollback candidate must be the exact retained predecessor and must
independently remain eligible for future admission. Historical readability alone
is not rollback eligibility.

The O6 endpoints fail closed on missing qualifications, tenant/course or role
scope conflicts, malformed exact identities, stale state/policy digests, missing
predecessors, expired or invalid source rights, and unresolved qualification or
requalification conditions. Student requests for an unknown qualification return
`MODEL_QUALIFICATION_NOT_FOUND` with HTTP 404 rather than an `UNAVAILABLE`
projection. Teacher/Admin projection refresh failures clear unverified current
receipts and expose an explicit retry control; the UI does not keep displaying a
stale ready receipt.

Teacher/Admin drift-assessment and rollback-dry-run receipts expose the
applicable hard non-effect fields below. The Student-safe projection deliberately
does not expose the private Teacher/Admin receipt or every receipt-only field;
the same non-write boundaries still govern its read-only runtime path.

```text
rollback_applied=false
adoption_mutation=false
official_truth_write=false
history_deleted=false
historical_receipt_rewritten=false
Provider=OFF
```

Run the O6-focused verification from a clean checkout after building the shared
prerequisites:

```powershell
npx vitest run tests/unit/model-qualification-adoption-drift-assessment.test.ts tests/unit/model-qualification-rollback-dry-run.test.ts tests/integration/model-qualification-o6-operations.test.ts tests/integration/model-qualification-o6-http.test.ts tests/contract/model-qualification-adoption-operations-openapi.test.ts tests/unit/ui-model-qualification-adoption.test.tsx tests/unit/ui-model-qualification-operations-student.test.tsx
npm run test:contract
npm run test:e2e:ui:o6
```

The O6 Playwright path uses real role BFF routes with target-route mocks set to
zero. Each run must use an independent store under the controlled temporary
`simwar-playwright/<mission>/playwright-store.json` root. O6 browser and focused
axe evidence does not prove Human Validation, full WCAG conformance, Pilot,
Production, Release, Provider activation, or durable database activation.

## O7 governed rollback request and explicit re-adoption

O7 converts an exact O6 `READY_WITH_LIMITS` predecessor dry-run into one
immutable `GovernedRollbackRequest` and one linked, standard O5 evidence-adoption
proposal. Both records are committed through the existing
`MAIN_MODEL_GOVERNANCE` authority in one boundary. Request creation keeps the
current selection unchanged and never applies rollback:

```text
ROLLBACK_DRY_RUN != ROLLBACK_REQUEST
ROLLBACK_REQUEST != ADOPTION_PROPOSAL
ADOPTION_PROPOSAL != REVIEW
REVIEW != ADOPTION
READOPTION != HISTORICAL_REWRITE
READOPTION != FORMAL_ROLLBACK
READOPTION != SIMULATION_TRUTH
REQUEST_CREATION_WRITES_CURRENT_SELECTION=false
rollback_applied=false
```

Suppose A is an exact historically adopted predecessor and B is the current
adoption. A governed request based on an exact B-to-A dry-run creates a linked
proposal for A, but B remains selected. The existing O5 review and explicit
`ADOPTED_FOR_FUTURE_ADMISSION` disposition may later create C. C has a new
adoption id and digest, points to B as its predecessor, and may reuse A's exact
evidence epoch. Future admissions select C; historical runs admitted under A or
B keep their original immutable receipts.

The generic O5 request path remains valid for genuinely new evidence epochs. A
generic request targeting an epoch already present in historical adopted
lineage fails closed with `EVIDENCE_ADOPTION_ROLLBACK_REQUEST_REQUIRED` (the
canonical `ROLLBACK_REQUEST_REQUIRED` family) unless a valid governed rollback
basis is used. No latest/current/default/first/last/newest-timestamp fallback is
permitted.

Teacher and Admin can create the governed request only from an exact-context,
still-current O6 receipt. The server reauthenticates tenant/course/role, dry-run
identity and digest, adoption-state digest, operations-policy digest, current
selection, exact predecessor and current predecessor eligibility. Student has no
rollback-request mutation route or privileged request/review/disposition
controls. The immutable public `rollback_request_digest` is SHA-256 over the
canonical persisted request body excluding only the digest field itself, so a
reader can independently verify the receipt. Persisted requests must also match
their command fingerprint, fingerprint-derived request id, one linked proposal,
and exact tenant/course lineage before reuse or projection. Recomputing only the
public digest after persisted payload drift therefore fails closed.
Transport-unknown retries retain and reuse the same command and payload;
same-command payload or role drift conflicts. Once mutation success is known, the
pending command is cleared. A subsequent projection-refresh failure clears
unverified UI receipts and requires explicit exact-context reload; it must not
replay the known-successful mutation.

Run the O7-focused validation from a clean checkout after building shared
prerequisites:

```powershell
npx vitest run tests/unit/model-qualification-governed-rollback-request.test.ts tests/unit/model-qualification-explicit-readoption.test.ts tests/integration/model-qualification-o7-http.test.ts tests/contract/model-qualification-governed-rollback-openapi.test.ts
npm run test:contract
npm run test:e2e:ui:o7
```

O7 remains Provider OFF and adds no new Writer, Store, Registry, truth engine,
settlement authority, automatic rollback, formal rollback, Human Validation,
Pilot, Production or Release claim.

## O8 rollback request outcome resolution and historical consistency

O8 adds `RollbackRequestOutcomeResolution` as a derived, query-only view over
the immutable O7 request and the existing O5 proposal, review, disposition and
adoption records. It does not change the O7 request status, append an outcome
record, apply rollback, or create a second lifecycle authority. The resolution
keeps three predicates separate:

```text
OUTCOME != CURRENT_EFFECT != CONSISTENCY
```

The historical outcome is derived in the exact order `request -> linked
proposal -> review -> disposition -> resulting adoption`. No review is
`PENDING_REVIEW`, not rejection; an approved proposal without disposition is
`APPROVED_PENDING_DISPOSITION`; an adopted result is
`READOPTED_FOR_FUTURE_ADMISSION`. Later adoption D can make the current effect
of C `SUPERSEDED`, and source expiry, rights degradation or unresolved
requalification can reduce current qualification consistency, but none of
those later facts may rewrite the historical outcome or an A/B admission
receipt. Ambiguous or tampered linkage is `REBASE_REQUIRED` and
`INCONSISTENT`, fail closed.

Teacher and Admin read the exact detailed timeline through:

- `GET /api/v1/bff/teacher/model-qualification/evidence-adoptions/rollback-requests/{rollbackRequestId}/outcome?courseId=...`
- `GET /api/v1/bff/admin/model-qualification/evidence-adoptions/rollback-requests/{rollbackRequestId}/outcome?courseId=...`

The Student route is aggregate-safe and contains no rollback request,
proposal, adoption identity, digest, reason, or privileged mutation control:

- `GET /api/v1/bff/student/model-qualification/evidence-adoptions/rollback-outcomes?courseId=...`

It exposes only applicability, qualification consistency, historical
consistency, known limits, `Provider=OFF`, advisory-only and non-write flags.
The O8 schema is `model-qualification-rollback-outcome.v1.json`, and the
public API response is versioned as
`MODEL_QUALIFICATION_ROLLBACK_OUTCOME_STUDENT_GET_V1` for the role-safe
projection. All O8 reads reuse the existing course-scoped admission guard and
`MAIN_MODEL_GOVERNANCE` ownership; there is no outcome writer, outcome store,
registry, automatic rollback, or formal truth mutation.

O8-focused checks include:

```powershell
npx vitest run tests/unit/model-qualification-rollback-request-resolution.test.ts tests/unit/model-qualification-readoption-historical-consistency.test.ts tests/contract/model-qualification-rollback-outcome-openapi.test.ts
npm run test:contract
```

The O8 resolution remains an advisory governance projection. It does not
prove Human Validation, full WCAG conformance, Pilot, Production, Release,
Provider activation or durable PostgreSQL application runtime activation.
