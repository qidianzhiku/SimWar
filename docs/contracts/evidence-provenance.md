# D2 Evidence and Provenance Contract

`evidence-provenance.v1` is a teacher-only, JSON-runtime contract for
transforming an allowlisted role-workflow event into an immutable evidence
artifact and append-only provenance edges.

The sole writer is `EvidenceCaptureCommandService`. The contract is not a
learning-confirmation, final-grade, Truth, SettlementResult, Score, Rank,
Replay, Student, AI, PostgreSQL, or external lineage authority.

Eligible source events are `section_ready`, `merge_created`, and
`team_confirmed`. Private draft payloads are never copied. Exact package,
goal, rubric, source-event, and transformation-rule references are required.
Same idempotency key and digest returns the existing artifact; a conflicting
digest is rejected. JSON persistence is current-process only and does not
prove durable recovery or cross-process idempotency.
