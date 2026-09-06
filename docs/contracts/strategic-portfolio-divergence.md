# SP-O3 Strategic Portfolio Divergence

SP-O3 is a derived, query-only comparison over the existing W4 Strategic
Portfolio projection and exact M4 non-official path evidence. It does not
create a portfolio, select a winning path, calculate a score or rank, or write
official state, settlement, replay, or next-round truth.

The teacher request must carry an exact tenant/course/run/team/round binding,
the exact M4 counterfactual input, the expected W4 portfolio digest, a versioned
divergence-policy digest, and an idempotency key. The server re-reads W4 and
reuses the existing M4 service; client values are selectors, never authority.

The envelope proves only the dimensions exposed by the current seam:
cash_delta, capacity_delta, project_count_delta, and changed mechanism paths.
Path-specific members, allocations, dependency impact, and model readiness are
reported as NOT_PROVEN. A stale expected portfolio digest fails closed with
`SP_O3_REBASE_REQUIRED`.

Teacher and tenant-admin responses retain exact comparison evidence. Student
responses are role-safe summaries bound to the student team and omit tenant
governance identities, path identifiers, decision IDs, and private details.
All responses declare Provider OFF, `query_only`, and no official writes.
