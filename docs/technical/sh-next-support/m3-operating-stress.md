# M3 Operating Economics Stress World

M3 is an isolated Shanghai support capability that compiles a deterministic,
candidate-only operating stress world. It keeps WANT, CAN, REALIZED, FINANCE,
POLICY, and STAKEHOLDER as separate layers and applies an explicit shock
library through normal, single-shock, double-shock, and recovery corridors.

The pack reuses the current GSI governed stakeholder shadow contract as a
Provider-OFF binding. Its five bounded signals and model-call receipt are
candidate evidence only and are explicitly excluded from formal truth hashes.
Teacher diagnostics include the mechanism and provenance context; Student
diagnostics are filtered to `STUDENT_SAFE` and never expose raw stakeholder
proposals, private truth, official score, or final rank. Cross-tenant
projections fail closed.

All values are synthetic bounded support anchors. `UNKNOWN` stakeholder
evidence remains unknown, and no value is presented as an official measurement
or calibration result. The current consumer class is C1 because no exact C0
MAIN runtime seam was proven in the source freeze; formal Truth, Settlement,
Score, Rank, and ParameterSet writers remain disabled.

## Verification

```text
npx vitest run tests/sh-next-support/m3-operating-stress.test.ts
npm run build -w @simwar/sh-next-support
npx vitest run tests/sh-next-support/m1-executive-season.test.ts tests/sh-next-support/m1-contract.test.ts tests/sh-next-support/m2-capital-sequencing.test.ts tests/sh-next-support/m2-contract.test.ts tests/sh-next-support/m3-operating-stress.test.ts tests/sh-next-support/m3-contract.test.ts
```

The MJP is `M3-CORRIDOR-WORKFORCE-QUALITY-CASH`: it demonstrates an explicit
combined workforce, quality, and cash corridor with replay-stable results and
role-safe diagnostics.
