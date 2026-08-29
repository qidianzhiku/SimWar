# M4 Second-City Portability and Compatibility Candidate

M4 implements the support-side State A → State B transition for
`SH-RT-NEXT-01-SECOND-CITY-PORTABILITY-COMPATIBILITY-RELEASE`. It selects one
public-safe second city by a deterministic coverage policy and compiles
Shanghai, that second city, and a synthetic third-city stub through the same
generic candidate compiler, schema version, and digest policy.

The current deterministic selection is Suzhou because it wins the bounded
public-safe coverage tie-break in the candidate catalog. This is an asset-data
choice, not a Shanghai-specific branch in the compiler. City identity remains a
string field in the package, and the reverse portability proof replaces the
second-city package with a synthetic stub without requiring a Shanghai enum or
constant.

Each package is assembled through the auditable chain:

```text
Source → Observation → Feature → RegionalTransfer → ScenarioCandidate →
generic compile(v1) → exact package digest → compatibility report
```

The compatibility report compares asset, parameter, profile, policy, and
project candidate dimensions. Regional differences are classified as
`NON_BREAKING` because they are bounded candidate data with units, rights,
validity windows, and explicit versions. The report keeps migration candidates
for a future MAIN-owned join; it is not a formal migration or runtime write.

Resolution is fail-closed: a package reference without an explicit `v1` and
package digest is rejected, implicit latest resolution is rejected, and history
deletion is rejected. Candidate versions are immutable in this support pack.

The pack remains C1 `JOIN_WITH_LIMITS`. It is Provider-OFF, JSON-internal, and
candidate-only. It does not write ScenarioPackage, ParameterSet, Truth,
Settlement, Score, Rank, or Runtime state. Public sources are reference-only
metadata and values are bounded synthetic candidates; no official statistic or
calibration result is claimed.

## Verification

```text
npm run build -w @simwar/sh-next-support
npx vitest run tests/sh-next-support/m4-portability.test.ts tests/sh-next-support/m4-contract.test.ts
```

The MJP is a three-package parity proof with zero breaking compatibility diffs,
an exact compatibility report, and a reverse portability pass.
