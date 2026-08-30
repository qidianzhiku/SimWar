# MOD Next6 consumption support

This package implements the bounded MOD support lane for the six Macro chain
defined by the 2026-08-29 mission contract. The executable boundary is the pure
`executeNext6Macro` compiler in `packages/mod-support/src/next6-consumption.ts`.

The compiler accepts exact versioned references and declared observations and
returns deterministic candidate evidence. It records a State A → State B
transition, domain-specific metrics, transformations, quality conflicts, MJP
fixture digests, role-safe fields, a Product Consumption Receipt or explicit
C1 integration debt, Tombstone/Reuse, Method Delta and Known Limits.

The current result is support-level (`C1_SUPPORT`) for all six Macros. The
current master snapshot did not prove a fresh executable MAIN Product
Consumption Receipt for this MOD wave, and active MAIN PRs #468/#469 remain
outside this isolated change. Candidate evidence must not be promoted to
official Truth, Settlement, Score, Rank, Replay truth, formal ParameterSet or
calibrated ModelVersion.

Validation:

- `npm run build -w @simwar/mod-support`
- `npx.cmd vitest run tests/unit/mod-next6-consumption.test.ts tests/unit/mod-support-macro.test.ts tests/unit/mod-support-evidence-safety.test.ts`
- `npm run test:contract`
- `node scripts/generate-mod-next6-evidence.mjs <new-output-directory>`

The evidence generator writes outside the repository and refuses an existing
or in-repository output path. The final mission ZIP is independently checked
after compression for readable members, duplicate names, unsafe paths, JSON
parsing, required members and SHA-256 agreement.
