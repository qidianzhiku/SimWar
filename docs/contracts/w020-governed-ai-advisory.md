# W020 Governed AI Advisory Contract

W020 exposes deterministic, advisory-only role assistance through the API.
The API assembles a tenant-, course-, run-, round-, team- and role-scoped
context from authenticated state. It forwards only allowlisted metadata to the
in-repository deterministic mock provider.

The provider emits `CoachOutput` and `ModelCallLog`. Both are advisory/audit
records. They cannot write canonical decisions, SettlementResult, score, rank,
state_true, replay manifests, learning confirmations, or student-private raw
payloads. The JSON repository is the only active runtime persistence boundary.

Student route:

`POST /api/v1/bff/student/advisors/role`

Teacher routes:

`POST /api/v1/bff/teacher/advisors/debrief`

`GET /api/v1/bff/teacher/advisors/audit`

The same tenant-scoped idempotency key and context digest returns the existing
record. A changed digest produces a stable conflict. Teacher audit output
contains provider/model/purpose/status/hashes/cost/latency only; raw prompt and
raw event payload are never returned. There is intentionally no student audit
route.
