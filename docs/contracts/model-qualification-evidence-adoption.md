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
