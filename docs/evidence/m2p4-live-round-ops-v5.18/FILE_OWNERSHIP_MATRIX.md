# FILE_OWNERSHIP_MATRIX

## Product-owned mutation

- Teacher UI projection and command gating: `apps/teacher/src/App.tsx`
- Shared M2-P4 types: `packages/shared-contracts/src/m2p4-live-round-ops.ts`, `packages/shared-contracts/src/index.ts`
- API read-only projection: `services/api/src/m2p4-live-round-ops.ts`, `services/api/src/server.ts`, `services/api/src/teacher-student-bff-dto.ts`
- Contract surfaces: `contracts/openapi/p0-api.openapi.yaml`, M1 envelope schemas, `contracts/schemas/m2p4-live-round-ops.v1.json`
- Dedicated tests/fixture/runner: `tests/unit/m2p4-live-round-ops.test.ts`, `tests/integration/project-aware-course-launch.test.ts`, M2-P4 e2e files, `scripts/run-m2-p4-browser.mjs`, `playwright.config.ts`, `package.json`

## Protected boundaries

- No settlement kernel, Replay truth hash, W4 writer, API authority, workflow, or test unrelated to the above was changed.
- No master, protected branch, force push, merge, Production, Pilot, Human Validation, W6, or provider state was mutated by this receipt.
- Graphify output and browser temporary stores were not committed.
