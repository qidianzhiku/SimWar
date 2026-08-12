# W023 Validation Session Contract

`ValidationSession` is an L4 operations and bounded evidence record for the
machine-controlled synthetic rehearsal path. Its only active execution mode
is `SYNTHETIC_REHEARSAL`; it never claims Human Validation, teaching
effectiveness, or real-human attestation.

The lifecycle is `DRAFT -> PREFLIGHT_READY -> LIVE -> CLOSED`, with an
abort path from `DRAFT`, `PREFLIGHT_READY`, or `LIVE`. Exact Course/Run
identity, tenant, machine-admission reference, and the roster are frozen for
the LIVE session. Session duty labels are metadata and never grant platform
RBAC or access to Truth, Decision, Settlement, Score, Rank, or Replay writers.

Observation and Incident records are append-only, bounded, teacher-safe
evidence. Private replay payloads, internal settlement payloads, raw student
private events, and formal truth fields are rejected. CLOSED and ABORTED
sessions produce a deterministic JSON bundle, SHA-256 evidence digest, and a
derived Markdown report.

Runtime authority remains `JSON_INTERNAL_ONLY`. PostgreSQL, Human Validation,
teaching effectiveness, durable recovery, Pilot, and Production remain
unproven or unauthorized.
