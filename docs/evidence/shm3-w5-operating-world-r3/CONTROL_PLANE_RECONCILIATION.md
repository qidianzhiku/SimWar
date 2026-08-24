# Control-Plane Reconciliation — SH-M3 W5 Operating World R3

Status: `JOIN_WITH_LIMITS`

## Reconciled authority graph

```text
OperatingWorldService draft/binding
        │ exact binding digest
        ▼
existing W4 capital action admission
        │ optional nested manifest digest
        ▼
existing W4 official outcome + replay input manifest
        │ read-only exact join after settlement/publication
        ▼
W3 OperatingWorldConsequenceTrace projection
        ├── Student: bounded public effect, no W4 action/manifest refs
        └── Teacher: governed W4 action/manifest refs
```

## Reconciliation decisions

- `PORT_AS_IS`: the R2 Operating World service and its single draft persistence path remain the lifecycle authority for Operating World drafts and bindings.
- `PORT_PATCH`: the W4 settlement admission seam may add one optional `operating_world_binding_digest` to the existing replay input manifest when the exact current W4 capital action contains the matching binding source.
- `NESTED_VALUE_OBJECT`: the digest is nested in the existing W4 manifest. It is not a new top-level W4 state, new settlement result field, or alternate replay hash input.
- `PROJECTION_ONLY`: the R3 trace is built from exact W4 action/manifest/outcome evidence and existing W3 context. It is returned through BFF projections and cannot mutate official state.
- `DROP_DUPLICATE`: no second Operating World store, W4 outcome writer, settlement engine, replay registry, publication path, or W5 lifecycle is introduced.

## Fail-closed conditions

The trace is unavailable or non-official when the binding is missing, stale, unsupported, preview/shadow/information-only, blocked, scope-mismatched, or when the W4 action and replay manifest carry different binding digests. The implementation must not synthesize official evidence from a preview receipt or a candidate projection.

## Evidence limits

- This receipt proves the local source and test shape only; it does not prove provider activation, production readiness, remote integration, or post-merge checks.
- CodeGraph was not available in this isolated R3 worktree; no stale graph output is used as current source proof.
- The current JSON runtime is the verified local authority. PostgreSQL, Pilot, Production, and real provider/model activation remain outside this candidate.
- No raw Shanghai data is copied into the repository; source provenance for any future local-data binding remains a separate evidence obligation.
