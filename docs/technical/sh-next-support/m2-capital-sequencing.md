# M2 Multi-region Capital Sequencing World

M2 moves from scattered Shanghai geo/project/portfolio candidates to a
five-city, reproducible support world covering Shanghai, Suzhou, Hangzhou,
Ningbo, and Jiaxing. Each city preserves geography, period, unit, CRS, source
IDs, and an explicit deterministic catchment method. Project slots retain
CAPEX, duration, area, beds, workforce, policy, financing, status, and generic
schema compatibility.

The package records DuckDB Spatial, H3, and OSMnx as `TOOL_NOT_RUN` in this
bounded environment and uses a deterministic catchment fallback. H3 is never
treated as a substitute for exact geometry. Public URIs are reference-only;
the synthetic fallback does not claim official values.

The bounded enumeration produces conservative, balanced, and aggressive
nonofficial sequencing candidates with fixed seeds and digests. It cannot
write an official decision. Three fixed-seed golden variants cover the center,
five-city, and cross-region worlds and name the forward ESL and RT consumers.

`schema_portability.supports_second_city_stub=true` and
`shanghai_constants_in_kernel=false` make the city identity an asset field,
not a kernel branch. No current C0 MAIN consumer seam was proven, so formal
join remains `C1 / JOIN_WITH_LIMITS`.

## Verification

```text
npm run build -w @simwar/sh-next-support
npx vitest run tests/sh-next-support/m1-executive-season.test.ts tests/sh-next-support/m1-contract.test.ts tests/sh-next-support/m2-capital-sequencing.test.ts tests/sh-next-support/m2-contract.test.ts
```

MJP uses Suzhou and `SH-M2-PROJECT-SUZHOU-A` and checks accessibility metadata,
project feasibility, exact refs, and second-city-compatible schema behavior.
