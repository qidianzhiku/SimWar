# R7 BFF Endpoint Implementation No-Go Register

Stop the future implementation gate when any item below is true:

- Student can invoke the operation or receive Teacher-only metadata.
- Tenant context is missing, inferred, or crosses tenant boundaries.
- Course/run authority is missing or can be substituted by a Platform scope.
- Scenario Package is unapproved, mutable, or not provenance-linked.
- ParameterSet is writable, hot-swappable, or not version-bound.
- Replay executes, writes formal truth, or overwrites an official result.
- `state_true`, `SettlementResult`, score, rank, protected digest, or private trace is exposed or mutated.
- Route, handler, frontend fetch, runtime activation, database, schema, OpenAPI,
  AI, or Plugin work enters without a separate authorization.
- Required security, browser, tenant, or negative-visibility evidence is
  missing or `UNKNOWN`.

Current status: `IMPLEMENTATION_GATE_ONLY`.
