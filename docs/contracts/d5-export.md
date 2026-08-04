# D5 Export Contract

`d5-export.v1` is the bounded export contract for the D4 `StudentLearningReport`
projection. It creates an immutable, teacher/admin-only `LearningExportBundle`
containing deterministic xAPI statement data and a coarsened AoL dataset.

The bundle is derived from exact D4 report references. It is not a second
learning authority: D3 remains the confirmation authority and D4 remains the
report projection. D5 does not write Truth, SettlementResult, Score, Rank, or
Replay state, and it has no Student route.

The only delivery destination in this wave is an in-process or localhost Mock
LRS. Delivery jobs and receipts are operational JSON-internal records. Durable
outbox, cross-process delivery, external credentials, PostgreSQL, and recovery
are known limits rather than implied capabilities.

The contract rejects arbitrary private payloads, student email, raw evidence,
and unbounded free text. AoL rows use a minimum cohort policy and suppress
small cohorts. Repeating the same exact report set and transformation policy
produces the same bundle digest; a conflicting idempotency payload is an
explicit conflict, never a silent replacement.
